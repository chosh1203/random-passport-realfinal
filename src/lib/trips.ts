import type { ResolvedDestination, TripRecord } from '../data/types'
import { hashUnit } from './stats'

export function makeTrip(d: ResolvedDestination, tripId: string, at = new Date()): TripRecord {
  return {
    tripId,
    destinationId: d.id,
    city: d.city,
    cityKo: d.cityKo,
    country: d.country,
    countryKo: d.countryKo,
    countryCode: d.countryCode,
    continent: d.continent,
    iataCode: d.iataCode,
    visitedAt: at.toISOString(),
    memo: d.slogan,
    stamp: { ...d.stamp, rotation: Math.round((hashUnit(tripId) * 2 - 1) * 14) },
  }
}
