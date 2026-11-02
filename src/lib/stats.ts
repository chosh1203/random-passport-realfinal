import { CONTINENTS } from '../data/continents'
import type { ContinentId, TripRecord } from '../data/types'

export interface TravelStats {
  countries: number
  cities: number
  continents: number
  trips: number
  firstDate: string | null
  latest: TripRecord | null
  byContinent: { id: ContinentId; name: string; value: number; color: string }[]
  monthly: { key: string; label: string; count: number }[]
  cityList: { destinationId: string; cityKo: string; countryKo: string; countryCode: string; visits: number; last: string }[]
  /** One stamp per country (first visit) for the collection grid */
  countryStamps: TripRecord[]
}

export function sortByDateDesc(trips: TripRecord[]) {
  return [...trips].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
}

export function computeStats(trips: TripRecord[], monthsBack = 6, lang: 'ko' | 'ja' = 'ko'): TravelStats {
  const sorted = sortByDateDesc(trips)
  const countrySet = new Map<string, TripRecord>()
  ;[...sorted].reverse().forEach((t) => {
    if (!countrySet.has(t.countryCode)) countrySet.set(t.countryCode, t)
  })
  const cityMap = new Map<string, TravelStats['cityList'][number]>()
  sorted.forEach((t) => {
    const c = cityMap.get(t.destinationId)
    if (c) c.visits += 1
    else cityMap.set(t.destinationId, { destinationId: t.destinationId, cityKo: t.cityKo, countryKo: t.countryKo, countryCode: t.countryCode, visits: 1, last: t.visitedAt })
  })

  const continentCounts = new Map<ContinentId, number>()
  countrySet.forEach((t) => continentCounts.set(t.continent, (continentCounts.get(t.continent) ?? 0) + 1))

  const now = new Date()
  const monthly: TravelStats['monthly'] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthly.push({ key, label: lang === 'ja' ? `${d.getMonth() + 1}月` : `${d.getMonth() + 1}월`, count: 0 })
  }
  trips.forEach((t) => {
    const d = new Date(t.visitedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const m = monthly.find((x) => x.key === key)
    if (m) m.count += 1
  })

  return {
    countries: countrySet.size,
    cities: cityMap.size,
    continents: continentCounts.size,
    trips: trips.length,
    firstDate: sorted.length ? sorted[sorted.length - 1].visitedAt : null,
    latest: sorted[0] ?? null,
    byContinent: [...continentCounts.entries()].map(([id, value]) => ({ id, value, name: lang === 'ja' ? CONTINENTS[id].ja : CONTINENTS[id].ko, color: CONTINENTS[id].color })),
    monthly,
    cityList: [...cityMap.values()],
    countryStamps: [...countrySet.values()],
  }
}

export function formatDate(iso: string, style: 'dot' | 'stamp' | 'long' = 'dot', lang: 'ko' | 'ja' = 'ko') {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (style === 'stamp') {
    const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    return `${String(day).padStart(2, '0')} ${mon} ${y}`
  }
  if (style === 'long') return lang === 'ja' ? `${y}年${m}月${day}日` : `${y}년 ${m}월 ${day}일`
  return `${y}.${String(m).padStart(2, '0')}.${String(day).padStart(2, '0')}`
}

/** Deterministic pseudo-random in [0,1) from a string — for stamp tilt/position */
export function hashUnit(s: string, salt = 0) {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}
