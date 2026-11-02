import {
  Castle,
  Church,
  Flower2,
  Landmark,
  Mountain,
  Plane,
  Ship,
  Snowflake,
  Sun,
  Tent,
  Trees,
  Triangle,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import type { StampShape, StampSymbol, TripRecord } from '../data/types'
import { formatDate } from '../lib/stats'

const SYMBOLS: Record<StampSymbol, LucideIcon> = {
  landmark: Landmark,
  mountain: Mountain,
  waves: Waves,
  sun: Sun,
  castle: Castle,
  church: Church,
  trees: Trees,
  snowflake: Snowflake,
  tent: Tent,
  pyramid: Triangle,
  ship: Ship,
  flower: Flower2,
}

/** Shared SVG filter that gives stamps an uneven-ink look. Render once. */
export function StampDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id="stamp-ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.55" result="mask" />
          <feComposite in="SourceGraphic" in2="mask" operator="in" result="inked" />
          <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="1" seed="3" result="warp" />
          <feDisplacementMap in="inked" in2="warp" scale="1.6" />
        </filter>
      </defs>
    </svg>
  )
}

function ShapeOutline({ shape, color }: { shape: StampShape; color: string }) {
  const common = { fill: 'none', stroke: color }
  switch (shape) {
    case 'circle':
      return (
        <>
          <circle cx="80" cy="80" r="74" strokeWidth="4" {...common} />
          <circle cx="80" cy="80" r="66" strokeWidth="1.5" {...common} />
          <circle cx="80" cy="80" r="44" strokeWidth="1.2" strokeDasharray="2 3" {...common} />
        </>
      )
    case 'oval':
      return (
        <>
          <ellipse cx="80" cy="80" rx="76" ry="60" strokeWidth="4" {...common} />
          <ellipse cx="80" cy="80" rx="68" ry="52" strokeWidth="1.5" {...common} />
        </>
      )
    case 'rect':
      return (
        <>
          <rect x="6" y="22" width="148" height="116" rx="8" strokeWidth="4" {...common} />
          <rect x="13" y="29" width="134" height="102" rx="4" strokeWidth="1.5" {...common} />
        </>
      )
    case 'octagon': {
      const p = (r: number) =>
        Array.from({ length: 8 }, (_, i) => {
          const a = (Math.PI / 8) * (2 * i + 1)
          return `${80 + r * Math.cos(a)},${80 + r * Math.sin(a)}`
        }).join(' ')
      return (
        <>
          <polygon points={p(76)} strokeWidth="4" {...common} />
          <polygon points={p(68)} strokeWidth="1.5" {...common} />
        </>
      )
    }
    case 'hexagon': {
      const p = (r: number) =>
        Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i
          return `${80 + r * Math.cos(a)},${80 + r * Math.sin(a) * 0.86}`
        }).join(' ')
      return (
        <>
          <polygon points={p(76)} strokeWidth="4" {...common} />
          <polygon points={p(67)} strokeWidth="1.5" {...common} />
        </>
      )
    }
    case 'shield':
      return (
        <>
          <path d="M14 22 H146 V86 C146 118 112 138 80 152 C48 138 14 118 14 86 Z" strokeWidth="4" {...common} />
          <path d="M22 30 H138 V86 C138 112 108 130 80 143 C52 130 22 112 22 86 Z" strokeWidth="1.5" {...common} />
        </>
      )
  }
}

/**
 * Entry stamp. Country-specific colour, outline shape and symbol.
 * `id` must be unique per rendered stamp (used for text path ids).
 */
export function Stamp({
  trip,
  size = 132,
  id,
  tilt = true,
  className = '',
}: {
  trip: Pick<TripRecord, 'country' | 'city' | 'iataCode' | 'visitedAt' | 'stamp'>
  size?: number
  id: string
  tilt?: boolean
  className?: string
}) {
  const { shape, color, symbol, rotation } = trip.stamp
  const Icon = SYMBOLS[symbol] ?? Plane
  const country = trip.country.toUpperCase()
  const isRound = shape === 'circle' || shape === 'oval'
  const ry = shape === 'oval' ? 54 : 58
  const pathId = `arc-${id}`
  const bottomId = `arcb-${id}`
  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      className={className}
      style={{ transform: tilt ? `rotate(${rotation}deg)` : undefined, filter: 'url(#stamp-ink)', opacity: 0.88 }}
      role="img"
      aria-label={`${trip.country} ${trip.city} · ${formatDate(trip.visitedAt)}`}
    >
      <ShapeOutline shape={shape} color={color} />
      {isRound ? (
        <>
          <defs>
            <path id={pathId} d={`M ${80 - 58} 80 A 58 ${ry} 0 0 1 ${80 + 58} 80`} />
            <path id={bottomId} d={`M ${80 - 60} 80 A 60 ${ry + 2} 0 0 0 ${80 + 60} 80`} />
          </defs>
          <text fill={color} fontSize={country.length > 12 ? 10 : 13} fontWeight={700} letterSpacing="1.5" fontFamily="Paperlogy, sans-serif">
            <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
              {country}
            </textPath>
          </text>
          <text fill={color} fontSize="9" fontWeight={600} letterSpacing="1" fontFamily="Paperlogy, sans-serif" dy="9">
            <textPath href={`#${bottomId}`} startOffset="50%" textAnchor="middle">
              {formatDate(trip.visitedAt, 'stamp')}
            </textPath>
          </text>
        </>
      ) : (
        <>
          <text x="80" y={shape === 'shield' ? 46 : 50} textAnchor="middle" fill={color} fontSize={country.length > 12 ? 9.5 : 12.5} fontWeight={700} letterSpacing="1.2" fontFamily="Paperlogy, sans-serif">
            {country}
          </text>
          <text x="80" y={shape === 'shield' ? 128 : 122} textAnchor="middle" fill={color} fontSize="9" fontWeight={600} letterSpacing="1" fontFamily="Paperlogy, sans-serif">
            {formatDate(trip.visitedAt, 'stamp')}
          </text>
        </>
      )}
      <Icon x={66} y={56} width={28} height={28} color={color} strokeWidth={2} />
      <text x="80" y="100" textAnchor="middle" fill={color} fontSize="17" fontWeight={800} letterSpacing="2" fontFamily="Paperlogy, sans-serif">
        {trip.iataCode}
      </text>
      <text x="80" y="111" textAnchor="middle" fill={color} fontSize="7.5" fontWeight={600} letterSpacing="1.2" fontFamily="Paperlogy, sans-serif">
        {trip.city.toUpperCase()}
      </text>
    </svg>
  )
}
