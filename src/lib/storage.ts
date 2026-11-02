import type { TripRecord } from '../data/types'

/**
 * Persistence layer. The app only talks to `travelStore` / `settingsStore`,
 * so swapping localStorage for a backend later means replacing this file.
 */
export interface TravelStore {
  getTrips(): TripRecord[]
  addTrip(trip: TripRecord): boolean
  updateMemo(tripId: string, memo: string): void
  clear(): void
  subscribe(listener: () => void): () => void
}

export interface Settings {
  avoidRepeat: boolean
  sound: boolean
  lang: 'ko' | 'ja'
  motion: 'system' | 'reduced' | 'full'
}

const TRIPS_KEY = 'rp.trips.v1'
const SETTINGS_KEY = 'rp.settings.v1'
const DEFAULT_SETTINGS: Settings = {
  avoidRepeat: true,
  sound: true,
  lang: typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : 'ko',
  motion: 'system',
}

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeWrite(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable (private mode / quota) — keep in-memory state */
  }
}

function isTrip(x: unknown): x is TripRecord {
  const t = x as TripRecord
  return !!t && typeof t.tripId === 'string' && typeof t.destinationId === 'string' && typeof t.visitedAt === 'string'
}

function createLocalTravelStore(): TravelStore {
  const listeners = new Set<() => void>()
  let trips: TripRecord[] = load()

  function load(): TripRecord[] {
    const raw = safeRead(TRIPS_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(isTrip) : []
    } catch {
      return []
    }
  }
  function persist() {
    safeWrite(TRIPS_KEY, JSON.stringify(trips))
    listeners.forEach((l) => l())
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === TRIPS_KEY) {
        trips = load()
        listeners.forEach((l) => l())
      }
    })
  }

  return {
    getTrips: () => trips,
    addTrip(trip) {
      if (trips.some((t) => t.tripId === trip.tripId)) return false
      trips = [...trips, trip]
      persist()
      return true
    },
    updateMemo(tripId, memo) {
      trips = trips.map((t) => (t.tripId === tripId ? { ...t, memo } : t))
      persist()
    },
    clear() {
      trips = []
      persist()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function createSettingsStore() {
  const listeners = new Set<() => void>()
  let settings: Settings = (() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(safeRead(SETTINGS_KEY) ?? '{}') }
    } catch {
      return DEFAULT_SETTINGS
    }
  })()
  return {
    get: () => settings,
    set(patch: Partial<Settings>) {
      settings = { ...settings, ...patch }
      safeWrite(SETTINGS_KEY, JSON.stringify(settings))
      listeners.forEach((l) => l())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const travelStore: TravelStore = createLocalTravelStore()
export const settingsStore = createSettingsStore()

export function newTripId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
