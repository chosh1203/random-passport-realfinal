import { AnimatePresence, motion } from 'motion/react'
import { ImageOff, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { fetchWikiImage, getCachedWikiImage, sizedImage } from '../lib/wikiImage'

const BASE = import.meta.env.BASE_URL

export function asset(path: string) {
  if (path.startsWith('data:')) return path
  return `${BASE}${path.replace(/^\//, '')}`
}

/* ---------------- Logo ---------------- */
export function Logo({ className = '', alt = 'RANDOM PASSPORT' }: { className?: string; alt?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className={`font-display font-semibold leading-[0.9] tracking-wide text-ink ${className}`} aria-label={alt}>
        RAND<span className="text-primary">O</span>M<br />PASSPORT
      </span>
    )
  }
  return <img src={asset('logo.png')} alt={alt} className={`select-none ${className}`} draggable={false} onError={() => setFailed(true)} />
}

/* ---------------- Flag ---------------- */
export function Flag({ code, className = 'h-4 w-6' }: { code: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !code) {
    return (
      <span className={`inline-flex items-center justify-center rounded-[3px] border border-line bg-surface-light font-mono text-[9px] text-cyan ${className}`}>
        {code}
      </span>
    )
  }
  return (
    <img
      src={`https://flagcdn.com/w80/${code.toLowerCase()}.png`}
      alt={`${code} flag`}
      className={`inline-block rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.15)] ${className}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

/* ---------------- Wikipedia-backed image with graceful fallback ---------------- */
export function SmartImage({
  wiki,
  alt,
  hue = 210,
  width = 800,
  className = '',
  label,
}: {
  wiki: string
  alt: string
  hue?: number
  width?: number
  className?: string
  label?: string
}) {
  const cached = getCachedWikiImage(wiki)
  const [src, setSrc] = useState<string | null | undefined>(cached)
  const [loaded, setLoaded] = useState(false)
  const [broken, setBroken] = useState(false)
  const [raw, setRaw] = useState(false)

  useEffect(() => {
    let alive = true
    setLoaded(false)
    setBroken(false)
    setRaw(false)
    const c = getCachedWikiImage(wiki)
    if (c !== undefined) {
      setSrc(c)
      return
    }
    setSrc(undefined)
    fetchWikiImage(wiki).then((u) => alive && setSrc(u))
    return () => {
      alive = false
    }
  }, [wiki])

  const fallback = src === null || broken
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} overflow-hidden bg-surface ${className}`}>
      {(src === undefined || (!loaded && !fallback)) && <div className="skeleton absolute inset-0" aria-hidden />}
      {fallback && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
          style={{
            backgroundColor: `hsl(${hue} 42% 84%)`,
            backgroundImage: `repeating-linear-gradient(135deg, hsl(${hue} 38% 76%) 0 2px, transparent 2px 12px)`,
          }}
          role="img"
          aria-label={alt}
        >
          <ImageOff className="h-5 w-5 text-ink/50" aria-hidden />
          {label && <span className="px-3 font-serif text-lg text-ink/80">{label}</span>}
        </div>
      )}
      {src && !broken && (
        <img
          src={raw ? src : sizedImage(src, width)}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            // If the resized thumbnail is refused, fall back to the URL Wikipedia gave us
            if (!raw && sizedImage(src, width) !== src) {
              setRaw(true)
              return
            }
            setBroken(true)
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, children, labelledBy, wide = false }: { open: boolean; onClose: () => void; children: ReactNode; labelledBy?: string; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1c1d21]/55 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className={`glass relative max-h-[90vh] w-full overflow-y-auto scrollbar-thin ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full border-2 border-ink bg-surface p-1.5 text-ink transition hover:bg-yellow" aria-label="닫기 / 閉じる">
              <X className="h-4 w-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------------- Section heading ---------------- */
export function SectionTitle({ en, ko, icon, action }: { en: string; ko: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-yellow text-ink">{icon}</span>}
        <div>
          <div className="eyebrow !text-[10px] !text-primary">{en}</div>
          <h2 className="font-display text-[22px] leading-tight text-ink">{ko}</h2>
        </div>
      </div>
      {action}
    </div>
  )
}

/* ---------------- Board-style CSS globe (banners, WebGL fallback) ---------------- */
export function MiniEarth({ className = '' }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-full border-[3px] border-ink ${className.includes('absolute') ? '' : 'relative'} ${className}`}
      style={{ background: '#3d8fd9', boxShadow: '5px 5px 0 #1c1d21' }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${asset('textures/earth-water.png')})`,
          backgroundSize: '200% 100%',
          filter: 'invert(1) sepia(0.45) brightness(0.97)',
          mixBlendMode: 'lighten',
          animation: 'earth-spin 60s linear infinite',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(28,29,33,0.55) 1.3px, transparent 1.6px)',
          backgroundSize: '6px 6px',
          WebkitMaskImage: 'radial-gradient(circle at 30% 28%, transparent 48%, #000 78%)',
          maskImage: 'radial-gradient(circle at 30% 28%, transparent 48%, #000 78%)',
        }}
      />
      <style>{`@keyframes earth-spin{from{background-position:0 0}to{background-position:-200% 0}}`}</style>
    </div>
  )
}
