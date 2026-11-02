export type ContinentId =
  | 'asia'
  | 'europe'
  | 'africa'
  | 'north-america'
  | 'south-america'
  | 'oceania'

export interface Airport {
  iata: string
  name: string
  nameKo: string
  latitude: number
  longitude: number
  city: string
  countryCode: string
}

export interface Attraction {
  name: string
  nameKo: string
  description: string
  location: string
  /** English Wikipedia page title used to fetch a representative photo */
  wiki: string
}

export interface Food {
  name: string
  nameKo: string
  description: string
  wiki: string
}

export type StampShape = 'circle' | 'rect' | 'octagon' | 'hexagon' | 'oval' | 'shield'
export type StampSymbol =
  | 'landmark'
  | 'mountain'
  | 'waves'
  | 'sun'
  | 'castle'
  | 'church'
  | 'trees'
  | 'snowflake'
  | 'tent'
  | 'pyramid'
  | 'ship'
  | 'flower'

export interface Destination {
  id: string
  city: string
  cityKo: string
  localName: string
  country: string
  countryKo: string
  /** ISO 3166-1 alpha-2 */
  countryCode: string
  continent: ContinentId
  timezone: string
  /** City-centre coordinates */
  latitude: number
  longitude: number
  /** Airports serving the city — first entry is the primary one */
  airports: string[]
  /** When the primary airport is outside the city */
  transfer?: string
  slogan: string
  heroImage: { wiki: string }
  attractions: Attraction[]
  foods: Food[]
  languages: {
    names: string[]
    greeting: { local: string; reading: string; meaning: string }
  }
  currency: { name: string; code: string; note?: string }
  culture: string[]
  travelTips: {
    transport: string
    etiquette: string
    bestSeason: string
    safety: string
  }
  exclusionTags: string[]
  /** Hue (0-360) used for fallback imagery */
  hue: number
  stamp: { shape: StampShape; color: string; symbol: StampSymbol }
}

/** Destination resolved with its primary airport — what the UI consumes */
export interface ResolvedDestination extends Destination {
  airport: Airport
  airportName: string
  iataCode: string
  airportLatitude: number
  airportLongitude: number
}

export interface TripRecord {
  /** Unique id per journey — prevents duplicate stamps */
  tripId: string
  destinationId: string
  city: string
  cityKo: string
  country: string
  countryKo: string
  countryCode: string
  continent: ContinentId
  iataCode: string
  /** ISO timestamp */
  visitedAt: string
  memo: string
  stamp: {
    shape: StampShape
    color: string
    symbol: StampSymbol
    rotation: number
  }
}
