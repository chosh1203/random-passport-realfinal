import { AIRPORTS, isValidAirport, ORIGIN_IATA } from '../data/airports'
import { DESTINATIONS } from '../data/destinations'
import { EXCLUDED_CITIES, EXCLUDED_TAGS } from '../data/exclusions'
import type { Airport, Destination, ResolvedDestination } from '../data/types'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '')

const excludedNames = new Set(
  EXCLUDED_CITIES.flatMap((c) => [norm(c.name), norm(c.nameKo)]).filter(Boolean),
)

export function isExcluded(d: Destination): boolean {
  if (excludedNames.has(norm(d.city)) || excludedNames.has(norm(d.cityKo)) || excludedNames.has(norm(d.id))) return true
  return d.exclusionTags.some((t) => EXCLUDED_TAGS.includes(t))
}

/** Pick the first valid airport for a destination. */
export function resolveDestination(d: Destination): ResolvedDestination | null {
  const airport = d.airports.map((code) => AIRPORTS[code]).find(isValidAirport)
  if (!airport) return null
  return {
    ...d,
    airport,
    airportName: airport.nameKo,
    iataCode: airport.iata,
    airportLatitude: airport.latitude,
    airportLongitude: airport.longitude,
  }
}

let cache: ResolvedDestination[] | null = null

/** Valid, non-excluded, airport-resolved destinations. */
export function getDestinationPool(): ResolvedDestination[] {
  if (cache) return cache
  cache = DESTINATIONS.filter((d) => !isExcluded(d))
    .map(resolveDestination)
    .filter((d): d is ResolvedDestination => d !== null)
  return cache
}

export function getDestinationById(id: string | undefined | null): ResolvedDestination | null {
  if (!id) return null
  const d = DESTINATIONS.find((x) => x.id === id)
  return d ? resolveDestination(d) : null
}

export function getOriginAirport(): Airport {
  return AIRPORTS[ORIGIN_IATA]
}

export function getAirport(code: string): Airport | undefined {
  return AIRPORTS[code]
}

/**
 * Random draw from the curated pool.
 * `avoidId` keeps the same city from coming up twice in a row.
 */
export function pickRandomDestination(avoidId?: string | null): ResolvedDestination | null {
  const pool = getDestinationPool()
  if (pool.length === 0) return null
  const candidates = avoidId && pool.length > 1 ? pool.filter((d) => d.id !== avoidId) : pool
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return candidates[buf[0] % candidates.length]
}

export function totalCountriesInPool(): number {
  return new Set(getDestinationPool().map((d) => d.countryCode)).size
}
