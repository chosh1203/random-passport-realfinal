import { useCallback, useEffect, useMemo } from 'react'
import { DESTINATIONS_JA } from '../data/destinations.ja'
import type { Airport, ResolvedDestination, TripRecord } from '../data/types'
import { useSettings, useTrips } from '../hooks/useStores'
import { getDestinationById } from '../lib/destinations'
import { settingsStore } from '../lib/storage'

export type Lang = 'ko' | 'ja'

export function useLang(): Lang {
  return useSettings().lang ?? 'ko'
}

export function setLang(lang: Lang) {
  settingsStore.set({ lang })
}

/** Inline bilingual strings: tr('한국어', '日本語') */
export function useT() {
  const lang = useLang()
  return useCallback((ko: string, ja: string) => (lang === 'ja' ? ja : ko), [lang])
}

/** Keep <html lang> in sync — drives the Japanese font stack in CSS */
export function useDocumentLang() {
  const lang = useLang()
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = lang === 'ja' ? 'RANDOM PASSPORT — 地図にない街へ' : 'RANDOM PASSPORT — Off the Map'
  }, [lang])
}

const cache = new Map<string, ResolvedDestination>()

/**
 * Returns the destination with its display fields (cityKo, countryKo,
 * slogan, attractions…) swapped to the requested language. Components keep
 * reading the same fields regardless of language.
 */
export function localizeDestination(d: ResolvedDestination, lang: Lang): ResolvedDestination {
  if (lang === 'ko') return d
  const key = `${d.id}:${lang}`
  const hit = cache.get(key)
  if (hit) return hit
  const ja = DESTINATIONS_JA[d.id]
  if (!ja) return d
  const out: ResolvedDestination = {
    ...d,
    cityKo: ja.city,
    countryKo: ja.country,
    slogan: ja.slogan,
    transfer: ja.transfer ?? d.transfer,
    airportName: d.airport.name,
    attractions: d.attractions.map((a, i) => ({
      ...a,
      nameKo: ja.attractions[i]?.name ?? a.name,
      description: ja.attractions[i]?.description ?? a.description,
      location: ja.attractions[i]?.location ?? a.location,
    })),
    foods: d.foods.map((f, i) => ({
      ...f,
      nameKo: ja.foods[i]?.name ?? f.name,
      description: ja.foods[i]?.description ?? f.description,
    })),
    languages: {
      names: ja.languages,
      greeting: { ...d.languages.greeting, reading: ja.greeting.reading, meaning: ja.greeting.meaning },
    },
    currency: { ...d.currency, name: ja.currency.name, note: ja.currency.note },
    culture: ja.culture,
    travelTips: ja.tips,
  }
  cache.set(key, out)
  return out
}

export function localizedById(id: string | null | undefined, lang: Lang) {
  const d = getDestinationById(id)
  return d ? localizeDestination(d, lang) : null
}

/** Trip records store the Korean names at the time of visit; show them in the current language */
export function localizeTrip(t: TripRecord, lang: Lang): TripRecord {
  if (lang === 'ko') return t
  const ja = DESTINATIONS_JA[t.destinationId]
  if (!ja) return t
  return { ...t, cityKo: ja.city, countryKo: ja.country, memo: t.memo === getDestinationById(t.destinationId)?.slogan ? ja.slogan : t.memo }
}

export function airportLocalName(a: Airport, lang: Lang) {
  if (lang === 'ko') return a.nameKo
  if (a.iata === 'ICN') return '仁川国際空港'
  return a.name
}

export function originCityName(lang: Lang) {
  return lang === 'ja' ? '仁川' : '인천'
}

/** Trip records with names in the current language */
export function useLocalizedTrips(): TripRecord[] {
  const trips = useTrips()
  const lang = useLang()
  return useMemo(() => trips.map((t) => localizeTrip(t, lang)), [trips, lang])
}
