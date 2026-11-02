/**
 * Representative photos come from Wikipedia / Wikimedia Commons via the
 * MediaWiki API (CORS-enabled with origin=*).
 *
 * Lookup order for a title:
 *   1. the exact page (redirects followed) and its lead image
 *   2. if that page has no image or doesn't exist, a Wikipedia search for the
 *      title, taking the first result that has an image
 * Any failure resolves to `null` and the UI shows a designed placeholder.
 */
const CACHE_KEY = 'rp.wikiimg.v2'
const API = 'https://en.wikipedia.org/w/api.php'
const memory = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

function loadCache(): Record<string, string> {
  try {
    localStorage.removeItem('rp.wikiimg.v1')
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}
const persisted = loadCache()
Object.entries(persisted).forEach(([k, v]) => memory.set(k, v))

function saveCache(title: string, url: string | null) {
  // Failures aren't persisted — the network might be back next visit
  if (url === null) return
  persisted[title] = url
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(persisted))
  } catch {
    /* ignore */
  }
}

/**
 * Wikimedia only serves thumbnails at standard widths; other widths can be
 * refused. Snap the requested width up to the nearest standard size.
 */
const STANDARD_WIDTHS = [250, 330, 500, 960, 1280, 1920]
export function sizedImage(url: string, width: number) {
  if (!/\/\d+px-/.test(url)) return url
  const w = STANDARD_WIDTHS.find((s) => s >= width) ?? STANDARD_WIDTHS[STANDARD_WIDTHS.length - 1]
  return url.replace(/\/(\d+)px-/, `/${w}px-`)
}

export function getCachedWikiImage(title: string): string | null | undefined {
  return memory.get(title)
}

interface ApiPage {
  index?: number
  thumbnail?: { source: string }
}

async function query(params: Record<string, string>, signal: AbortSignal): Promise<ApiPage[]> {
  const qs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '960',
    ...params,
  })
  const r = await fetch(`${API}?${qs}`, { signal })
  if (!r.ok) return []
  const j = await r.json()
  const pages: ApiPage[] = j?.query?.pages ?? []
  return [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
}

async function lookup(title: string, signal: AbortSignal): Promise<string | null> {
  const exact = await query({ titles: title, redirects: '1' }, signal)
  const hit = exact.find((p) => p.thumbnail?.source)
  if (hit) return hit.thumbnail!.source
  const searched = await query({ generator: 'search', gsrsearch: title, gsrlimit: '5', gsrnamespace: '0' }, signal)
  return searched.find((p) => p.thumbnail?.source)?.thumbnail?.source ?? null
}

export function fetchWikiImage(title: string): Promise<string | null> {
  if (memory.has(title)) return Promise.resolve(memory.get(title) ?? null)
  const existing = inflight.get(title)
  if (existing) return existing

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  const p = lookup(title, ctrl.signal)
    .catch(() => null)
    .then((url) => {
      clearTimeout(timer)
      memory.set(title, url)
      saveCache(title, url)
      inflight.delete(title)
      return url
    })
  inflight.set(title, p)
  return p
}
