import { geoBounds, geoGraticule10, geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import { useMemo } from 'react'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-50m.json'
import { CONTINENTS } from '../data/continents'
import type { ResolvedDestination } from '../data/types'
import { distanceKm } from '../lib/distance'
import { useMediaQuery } from '../hooks/useStores'

/**
 * Board-game style location map: the country filled in its continent colour,
 * neighbours as cream card-stock, the city as a red pin and — when the airport
 * is outside the city — the airport with a dashed transfer line.
 * Data: Natural Earth 1:50m via world-atlas (public domain).
 */

/** ISO 3166-1 alpha-2 → numeric, for the countries in the curated pool */
const ISO_NUM: Record<string, string> = {
  UZ: '860', MK: '807', GE: '268', KG: '417', TJ: '762', EG: '818', AR: '032', PE: '604', OM: '512',
  RO: '642', BG: '100', ME: '499', AL: '008', LA: '418', LK: '144', CL: '152', MX: '484', TZ: '834',
  MA: '504', NO: '578', SI: '705', AM: '051', AU: '036', KZ: '398', NA: '516', BA: '070', MY: '458',
}

type CountryFeature = Feature<Geometry, { name: string }>

let cached: CountryFeature[] | null = null
function countries(): CountryFeature[] {
  if (cached) return cached
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>
  cached = fc.features as CountryFeature[]
  return cached
}

/** Keep only the parts of a country near the city (drops far-flung islands) */
function nearParts(f: CountryFeature, lon: number, lat: number): CountryFeature {
  const g = f.geometry
  if (g.type !== 'MultiPolygon') return f
  const parts = (g as MultiPolygon).coordinates.filter((poly) => {
    const [[x0, y0], [x1, y1]] = geoBounds({ type: 'Polygon', coordinates: poly } as Polygon)
    return x1 >= lon - 22 && x0 <= lon + 22 && y1 >= lat - 16 && y0 <= lat + 16
  })
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: parts.length ? parts : (g as MultiPolygon).coordinates } }
}

export default function CityMap({ dest, airportLabel }: { dest: ResolvedDestination; airportLabel: string }) {
  // a smaller canvas on phones keeps pins and labels readable after scaling
  const narrow = useMediaQuery('(max-width: 640px)')
  const W = narrow ? 400 : 640
  const H = narrow ? 340 : 480
  const pad = narrow ? 56 : 110
  const map = useMemo(() => {
    const all = countries()
    const target = all.find((c) => String(c.id) === ISO_NUM[dest.countryCode])
    const focus = target ? nearParts(target, dest.longitude, dest.latitude) : null
    const projection = geoMercator()
    if (focus) {
      projection.fitExtent(
        [
          [pad, pad * 0.8],
          [W - pad, H - pad * 0.8],
        ],
        focus,
      )
    } else {
      projection.center([dest.longitude, dest.latitude]).scale(900).translate([W / 2, H / 2])
    }
    const path = geoPath(projection)
    // only draw countries that intersect the view
    const visible = all.filter((c) => {
      const [[x0, y0], [x1, y1]] = path.bounds(c)
      return x1 > -80 && x0 < W + 80 && y1 > -80 && y0 < H + 80 && x1 - x0 < W * 40
    })
    const city = projection([dest.longitude, dest.latitude]) ?? [W / 2, H / 2]
    const airport = projection([dest.airportLongitude, dest.airportLatitude]) ?? city
    const farAirport = distanceKm(dest.latitude, dest.longitude, dest.airportLatitude, dest.airportLongitude) > 25
    return {
      grid: path(geoGraticule10()) ?? '',
      others: visible.filter((c) => c !== target).map((c) => ({ id: String(c.id ?? c.properties.name), d: path(c) ?? '' })),
      target: target ? path(target) ?? '' : '',
      city,
      airport,
      farAirport,
    }
  }, [dest, W, H, pad])

  const name = dest.cityKo.replace(/[(（].*[)）]/, '')
  const color = CONTINENTS[dest.continent].color
  const labelW = Math.max(70, name.length * 17 + 28)
  const [cx, cy] = map.city
  const labelAbove = cy > 120
  const lat = `${Math.abs(dest.latitude).toFixed(2)}°${dest.latitude >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(dest.longitude).toFixed(2)}°${dest.longitude >= 0 ? 'E' : 'W'}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label={`${name}, ${dest.countryKo} — ${lat} ${lon}`}>
      <defs>
        <pattern id="map-dots" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="#1c1d21" opacity="0.12" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#3d8fd9" />
      <path d={map.grid} fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
      {map.others.map((c) => (
        <path key={c.id} d={c.d} fill="#f6ecd0" stroke="#1c1d21" strokeOpacity="0.45" strokeWidth="0.8" strokeLinejoin="round" />
      ))}
      {map.target && (
        <>
          <path d={map.target} fill={color} stroke="#1c1d21" strokeWidth="2.5" strokeLinejoin="round" />
          <path d={map.target} fill="url(#map-dots)" />
        </>
      )}

      {/* airport + transfer line */}
      {map.farAirport && (
        <g>
          <line x1={map.airport[0]} y1={map.airport[1]} x2={cx} y2={cy} stroke="#1c1d21" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round" />
          <rect x={map.airport[0] - 9} y={map.airport[1] - 9} width="18" height="18" rx="3" fill="#fbf6e9" stroke="#1c1d21" strokeWidth="2.5" />
          <path d={`M${map.airport[0] - 4} ${map.airport[1] + 3} L${map.airport[0] + 5} ${map.airport[1] - 4} M${map.airport[0] - 1} ${map.airport[1] - 3} L${map.airport[0] + 2} ${map.airport[1] + 3}`} stroke="#1c1d21" strokeWidth="2" strokeLinecap="round" />
          <g transform={`translate(${map.airport[0] + 14} ${map.airport[1] + 5})`}>
            <rect x="0" y="-12" width={airportLabel.length * 10 + 16} height="22" rx="4" fill="#fbf6e9" stroke="#1c1d21" strokeWidth="2" />
            <text x="8" y="4" fontSize="13" fontWeight="700" fill="#1c1d21" fontFamily="var(--font-sans)">
              {airportLabel}
            </text>
          </g>
        </g>
      )}

      {/* city pin */}
      <g>
        <circle cx={cx} cy={cy} r="22" fill="#d4422c" opacity="0.18" />
        <circle cx={cx} cy={cy} r="10" fill="#d4422c" stroke="#1c1d21" strokeWidth="3" />
        <circle cx={cx} cy={cy} r="3.5" fill="#fbf6e9" />
        <g transform={`translate(${cx - labelW / 2} ${labelAbove ? cy - 58 : cy + 22})`}>
          <rect x="4" y="4" width={labelW} height="34" rx="6" fill="#1c1d21" />
          <rect x="0" y="0" width={labelW} height="34" rx="6" fill="#fbf6e9" stroke="#1c1d21" strokeWidth="2.5" />
          <text x={labelW / 2} y="23" textAnchor="middle" fontSize="17" fontWeight="800" fill="#1c1d21" fontFamily="var(--font-display)">
            {name}
          </text>
        </g>
      </g>
    </svg>
  )
}
