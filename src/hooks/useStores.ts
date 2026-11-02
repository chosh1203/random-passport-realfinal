import { useEffect, useState, useSyncExternalStore } from 'react'
import { settingsStore, travelStore } from '../lib/storage'

export function useTrips() {
  return useSyncExternalStore(travelStore.subscribe, travelStore.getTrips, travelStore.getTrips)
}

export function useSettings() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get)
}

function systemPrefersReduced() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** OS preference, overridable in settings */
export function useReducedMotion(): boolean {
  const { motion } = useSettings()
  const [system, setSystem] = useState(systemPrefersReduced)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setSystem(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  if (motion === 'reduced') return true
  if (motion === 'full') return false
  return system
}

/** Live clock for a given IANA timezone */
export function useLocalTime(timezone: string | undefined, lang: 'ko' | 'ja' = 'ko') {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  if (!timezone) return null
  try {
    const fmt = new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'ko-KR', {
      timeZone: timezone,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const offsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
    const offset = offsetFmt.formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? ''
    return { text: fmt.format(now), offset }
  } catch {
    return null
  }
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}
