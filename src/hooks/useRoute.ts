import { useEffect, useState } from 'react'

/**
 * Minimal hash router — every page is directly linkable
 * (#/, #/destination/samarkand, #/passport, #/stats, #/collection, #/settings)
 * and works from any static host or sub-folder without server rewrites.
 */
export type Route =
  | { name: 'home' }
  | { name: 'destination'; id?: string }
  | { name: 'passport' }
  | { name: 'stats' }
  | { name: 'collection' }
  | { name: 'settings' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  switch (parts[0]) {
    case 'destination':
      return { name: 'destination', id: parts[1] ? decodeURIComponent(parts[1]) : undefined }
    case 'passport':
      return { name: 'passport' }
    case 'stats':
      return { name: 'stats' }
    case 'collection':
      return { name: 'collection' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'home' }
  }
}

export function navigate(path: string) {
  const next = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash === next) return
  window.location.hash = next
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
