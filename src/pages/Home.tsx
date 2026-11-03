import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, BarChart3, BookOpen, Loader2, Plane, RotateCcw, SkipForward, Stamp as StampIcon } from 'lucide-react'
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Flag, Logo, MiniEarth } from '../components/ui'
import { CONTINENTS } from '../data/continents'
import type { ContinentId, ResolvedDestination } from '../data/types'
import type { FlightPhase } from '../globe/GlobeScene'
import { navigate, type Route } from '../hooks/useRoute'
import { useReducedMotion, useSettings, useTrips } from '../hooks/useStores'
import { getDestinationPool, getOriginAirport, pickRandomDestination } from '../lib/destinations'
import { distanceKm, estimateFlightTime } from '../lib/distance'
import { consumeLaunch } from '../lib/launch'
import { playArrival, playDice, playHop, startEngine, unlockAudio, type EngineHandle } from '../lib/sound'
import { hashUnit, sortByDateDesc } from '../lib/stats'
import { newTripId, travelStore } from '../lib/storage'
import { makeTrip } from '../lib/trips'
import { buildAnnouncements, flightNumber, type Announcement } from '../lib/announce'
import { CabinScene } from '../components/CabinScene'
import { airportLocalName, localizeDestination, originCityName, useLang, useT, type Lang } from '../i18n'

const GlobeScene = lazy(() => import('../globe/GlobeScene').then((m) => ({ default: memo(m.default) })))

const AUTO_ADVANCE_MS = 4500
const FLIGHT_SECONDS = 15
const CONTINENT_ORDER: ContinentId[] = ['asia', 'europe', 'africa', 'south-america', 'north-america', 'oceania']

/* Board layout: 28 city tiles around a 9×9 grid, START in the bottom-right corner, moving clockwise */
function tilePlacement(i: number): { row: number; col: number; side: 'bottom' | 'left' | 'top' | 'right' } {
  if (i < 7) return { row: 9, col: 8 - i, side: 'bottom' }
  if (i < 14) return { row: 8 - (i - 7), col: 1, side: 'left' }
  if (i < 21) return { row: 1, col: 2 + (i - 14), side: 'top' }
  return { row: 2 + (i - 21), col: 9, side: 'right' }
}

function shortName(cityKo: string) {
  return cityKo.replace(/\(.*\)/, '')
}

export default function Home({ route }: { route: Route }) {
  const origin = getOriginAirport()
  const reduced = useReducedMotion()
  const settings = useSettings()
  const trips = useTrips()
  const lang = useLang()
  const tr = useT()
  const langRef = useRef(lang)
  langRef.current = lang

  const tiles = useMemo(() => {
    const pool = [...getDestinationPool()].sort(
      (a, b) => CONTINENT_ORDER.indexOf(a.continent) - CONTINENT_ORDER.indexOf(b.continent) || a.cityKo.localeCompare(b.cityKo, 'ko'),
    )
    return pool.slice(0, 28)
  }, [])
  const visited = useMemo(() => new Set(trips.map((t) => t.destinationId)), [trips])

  const [phase, setPhase] = useState<FlightPhase>('idle')
  const [dest, setDest] = useState<ResolvedDestination | null>(null)
  const [journeyId, setJourneyId] = useState<string | null>(null)
  const [skipToken, setSkipToken] = useState(0)
  const [ready, setReady] = useState<'loading' | 'ready' | 'error'>('loading')
  const [webglFailed, setWebglFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [pawn, setPawn] = useState(-1)
  const [hopMs, setHopMs] = useState(120)
  const [caption, setCaption] = useState<{ key: number; text: string } | null>(null)
  const script = useRef<Announcement[]>([])
  const nextLine = useRef(0)
  const [landed, setLanded] = useState<number | null>(null)
  const [dice, setDice] = useState<[number, number]>([5, 3])
  const [rolling, setRolling] = useState(false)

  const progressBar = useRef<HTMLDivElement>(null)
  const progressPlane = useRef<HTMLDivElement>(null)
  const savedJourney = useRef<string | null>(null)
  const timers = useRef<number[]>([])
  const engine = useRef<EngineHandle | null>(null)
  const pawnRef = useRef(-1)
  const boardRef = useRef<HTMLDivElement>(null)
  pawnRef.current = pawn

  const clearTimers = () => {
    timers.current.forEach((t) => {
      window.clearTimeout(t)
      window.clearInterval(t)
    })
    timers.current = []
  }
  useEffect(
    () => () => {
      clearTimers()
      engine.current?.stop(0.3)
    },
    [],
  )

  const busy = phase === 'selecting' || phase === 'revealed' || phase === 'flying'
  const lastDestinationId = useMemo(() => sortByDateDesc(trips)[0]?.destinationId ?? null, [trips])

  const handleArrive = useCallback((d: ResolvedDestination | null, id: string | null) => {
    if (!d || !id) return
    if (savedJourney.current !== id) {
      savedJourney.current = id
      travelStore.addTrip(makeTrip(d, id))
      engine.current?.stop(1.4)
      engine.current = null
      playArrival()
      const last = script.current.find((a) => a.at === 2)
      nextLine.current = script.current.length
      if (last) setCaption({ key: Date.now(), text: last.text })
    }
    if (progressBar.current) progressBar.current.style.width = '100%'
    if (progressPlane.current) progressPlane.current.style.left = '100%'
    setPhase('arrived')
  }, [])

  const beginFlight = useCallback(
    (next: ResolvedDestination, id: string) => {
      setPhase('revealed')
      engine.current?.stop(0.2)
      engine.current = startEngine(FLIGHT_SECONDS)
      // cabin announcements for this journey
      const L = localizeDestination(next, langRef.current)
      const o = getOriginAirport()
      script.current = buildAnnouncements(L, langRef.current, distanceKm(o.latitude, o.longitude, next.airportLatitude, next.airportLongitude), id)
      nextLine.current = 1
      const first = script.current[0]
      setCaption({ key: Date.now(), text: first.text })
      if (webglFailed) {
        timers.current.push(
          window.setTimeout(() => {
            setPhase('flying')
            engine.current?.throttleUp()
          }, 600),
        )
        timers.current.push(window.setTimeout(() => handleArrive(next, id), 2600))
      }
    },
    [webglFailed, handleArrive],
  )

  const start = useCallback(() => {
    if (busy) return
    unlockAudio()
    clearTimers()
    setError(null)
    const avoid = settings.avoidRepeat ? (dest?.id ?? lastDestinationId) : null
    const next = pickRandomDestination(avoid)
    const target = next ? tiles.findIndex((t) => t.id === next.id) : -1
    if (!next || target < 0) {
      setError(tr('유효한 목적지 데이터를 찾지 못했습니다. 잠시 후 다시 굴려 주세요.', '有効な目的地データが見つかりませんでした。少し待ってからもう一度振ってください。'))
      return
    }
    if (window.innerWidth < 1024) boardRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
    const id = newTripId()
    setDest(next)
    setJourneyId(id)
    setAutoAdvance(true)
    setLanded(null)
    setCaption(null)
    setPhase('selecting')
    if (progressBar.current) progressBar.current.style.width = '0%'
    if (progressPlane.current) progressPlane.current.style.left = '0%'

    const finalDice: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]

    if (reduced) {
      setDice(finalDice)
      setPawn(target)
      setLanded(target)
      timers.current.push(window.setTimeout(() => beginFlight(next, id), 250))
      return
    }

    // 1. dice tumble
    setRolling(true)
    playDice(0.85)
    const iv = window.setInterval(() => setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), 75)
    timers.current.push(iv)
    timers.current.push(
      window.setTimeout(() => {
        window.clearInterval(iv)
        setDice(finalDice)
        setRolling(false)
      }, 900),
    )

    // 2. pawn races around the board, slowing down onto the target tile
    const from = pawnRef.current
    const d = from < 0 ? target + 1 : (target - from + 28) % 28 || 28
    const total = d < 8 ? d + 28 : d
    let elapsed = 450
    for (let k = 1; k <= total; k++) {
      const pos = ((((from < 0 ? -1 : from) + k) % 28) + 28) % 28
      const step = 70 + 210 * Math.pow(k / total, 2.5)
      elapsed += step
      const last = k === total
      timers.current.push(
        window.setTimeout(() => {
          setHopMs(Math.min(step * 0.9, 240))
          setPawn(pos)
          if (k % 2 === 0 || k > total - 8) playHop()
          if (last) {
            setLanded(pos)
            timers.current.push(window.setTimeout(() => beginFlight(next, id), 450))
          }
        }, elapsed),
      )
    }
  }, [busy, settings.avoidRepeat, dest, lastDestinationId, reduced, tiles, beginFlight, tr])

  // auto transition to the destination page after arrival
  useEffect(() => {
    if (phase !== 'arrived' || !dest || !autoAdvance) return
    const t = window.setTimeout(() => navigate(`/destination/${dest.id}`), AUTO_ADVANCE_MS)
    return () => window.clearTimeout(t)
  }, [phase, dest, autoAdvance])

  // launch requested from another page
  useEffect(() => {
    if (ready === 'loading' && !webglFailed) return
    if (consumeLaunch()) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, webglFailed, route])

  const journeyRef = useRef<{ dest: ResolvedDestination | null; id: string | null }>({ dest: null, id: null })
  journeyRef.current = { dest, id: journeyId }
  const onReady = useCallback((s: 'ready' | 'error') => setReady(s), [])
  const onArcReady = useCallback(() => {
    setPhase((p) => {
      if (p === 'revealed') {
        engine.current?.throttleUp()
        return 'flying'
      }
      return p
    })
  }, [])
  const onArrive = useCallback(() => handleArrive(journeyRef.current.dest, journeyRef.current.id), [handleArrive])
  const onProgress = useCallback((p: number) => {
    const line = script.current[nextLine.current]
    if (line && line.at <= 1 && p >= line.at) {
      nextLine.current += 1
      setCaption({ key: Date.now(), text: line.text })
    }
    const pct = `${(p * 100).toFixed(1)}%`
    if (progressBar.current) progressBar.current.style.width = pct
    if (progressPlane.current) progressPlane.current.style.left = pct
  }, [])

  const skip = () => {
    if (webglFailed) {
      clearTimers()
      handleArrive(dest, journeyId)
      return
    }
    engine.current?.throttleUp()
    nextLine.current = script.current.length - 1
    setPhase('flying')
    setSkipToken((n) => n + 1)
  }

  const destL = useMemo(() => (dest ? localizeDestination(dest, lang) : null), [dest, lang])
  const inJourney = !!dest && (phase === 'revealed' || phase === 'flying' || phase === 'arrived')
  const headline =
    lang === 'ja' ? (
      <>
        世界にはまだ、
        <br />
        あなたの知らない街がある。
      </>
    ) : (
      <>
        세상에는 아직
        <br />
        당신이 모르는 도시가 있습니다.
      </>
    )
  const countries = new Set(trips.map((t) => t.countryCode)).size

  return (
    <section className="board-surface min-h-[calc(100svh-67px)] text-paper" style={{ '--board': 'clamp(520px, min(calc(100svh - 115px), calc(100vw - 500px)), 900px)' } as React.CSSProperties}>
      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:gap-8 sm:py-6 md:px-8 lg:grid-cols-[minmax(320px,1fr)_auto] lg:items-center lg:gap-10">
        {/* ---------------- LEFT: copy / boarding pass ---------------- */}
        <div className="order-2 min-w-0 lg:order-1">
          <AnimatePresence mode="wait" initial={false}>
            {!inJourney ? (
              <motion.div key="hero" className="flex flex-col" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
                <h1 className="sr-only">RANDOM PASSPORT</h1>
                <Logo className="hidden w-full max-w-[460px] lg:block" />
                <div className="mt-5 hidden flex-wrap items-baseline gap-x-4 gap-y-1 lg:flex">
                  <span className="font-serif text-[30px] leading-none text-yellow md:text-[34px]">OFF THE MAP</span>
                  <span className="font-mono text-[12px] font-semibold tracking-[0.18em] text-paper/70">DISCOVER THE UNEXPECTED</span>
                </div>
                <p className="mt-6 hidden font-display text-[34px] leading-[1.35] tracking-[-0.01em] lg:block">
                  {headline}
                </p>
                <p className="max-w-[440px] text-[14px] font-medium leading-[1.7] text-paper/80 sm:text-[15px] lg:mt-4">
                  {lang === 'ja' ? (
                    <>
                      有名な観光地はひとまず忘れて、
                      <br className="hidden sm:block" />
                      まだあまり知られていない街へ出かけるランダム旅行。
                      <br />
                      サイコロを振ると、コマが止まった街へ飛行機が飛び立ちます。
                    </>
                  ) : (
                    <>
                      유명한 관광지는 잠시 잊고,
                      <br className="hidden sm:block" /> 한국인이 잘 모르는 이색적인 도시로 떠나는 랜덤 여행.
                      <br />
                      주사위를 굴리면 말이 멈춘 도시로 비행기가 출발합니다.
                    </>
                  )}
                </p>

                <div className="order-first mb-5 flex flex-wrap items-center gap-3.5 sm:mb-7 sm:gap-4 lg:order-none lg:mb-0 lg:mt-8 lg:gap-5">
                  <Dice values={dice} rolling={rolling} />
                  <button className="btn-primary w-full whitespace-nowrap !px-4 !text-[16px] sm:w-auto sm:!px-[30px] sm:!text-[18px]" onClick={start} disabled={busy || (ready === 'loading' && !webglFailed)}>
                    {phase === 'selecting' ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> {tr('말이 이동하는 중', 'コマが移動中')}
                      </>
                    ) : (
                      <>
                        <Plane className="h-5 w-5 -rotate-45" strokeWidth={2.4} /> TAKE ME SOMEWHERE UNKNOWN
                      </>
                    )}
                  </button>
                </div>
                {error && (
                  <p className="mt-4 text-sm font-semibold text-yellow" role="alert">
                    {error}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-[11px] font-semibold tracking-[0.08em] text-paper/70 sm:text-[12px] lg:mt-8">
                  <span>DEPARTURE · INCHEON, SOUTH KOREA</span>
                  <span>DESTINATION · UNKNOWN</span>
                  {trips.length > 0 && (
                    <a href="#/stats" className="text-yellow hover:underline">
                      {tr(`지금까지 ${countries}개국 · 도장 ${trips.length}개 →`, `これまで ${countries}か国 · スタンプ ${trips.length}個 →`)}
                    </a>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key={'pass-' + journeyId} className="flex flex-col gap-4 lg:h-[var(--board)] lg:gap-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}>
                <div className="min-h-0 lg:flex lg:max-h-[320px] lg:min-h-[150px] lg:flex-1">
                  <CabinScene
                    text={caption?.text ?? ''}
                    speaker={tr('객실 승무원', '客室乗務員')}
                    flightNo={flightNumber(journeyId ?? '')}
                    reduced={reduced}
                  />
                </div>
                <BoardingPass
                  dest={destL!}
                  lang={lang}
                  journeyId={journeyId ?? ''}
                  phase={phase}
                  progressBar={progressBar}
                  progressPlane={progressPlane}
                  autoAdvance={autoAdvance}
                  reduced={reduced}
                  onSkip={skip}
                  onStay={() => setAutoAdvance(false)}
                  onAgain={() => {
                    setPhase('idle')
                    setTimeout(() => start(), 0)
                  }}
                />
                <p className="shrink-0 text-[11px] text-paper/60">{tr('※ 실제 항공 운항 경로가 아닌, 공항 좌표를 기반으로 한 가상 시각화입니다.', '※ 実際の航空路線ではなく、空港の座標をもとにした仮想の可視化です。')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---------------- MOBILE: headline above the board ---------------- */}
        <div className="order-0 lg:hidden">
          <div className="font-serif text-[22px] leading-none text-yellow">OFF THE MAP</div>
          <p className="mt-2.5 font-display text-[24px] leading-[1.35] tracking-[-0.01em] sm:text-[28px]">
            {headline}
          </p>
        </div>

        {/* ---------------- RIGHT: the board ---------------- */}
        <div ref={boardRef} className="order-1 mx-auto w-full max-w-[640px] scroll-mt-[76px] lg:order-2 lg:mx-0 lg:w-[var(--board)] lg:max-w-none">
          <div className="board" aria-label={tr('RANDOM PASSPORT 보드판 — 28개 이색 도시', 'RANDOM PASSPORT ボード — 28のまだ知らない街')}>
            {/* corners */}
            <div className="corner bg-yellow" style={{ gridRow: 9, gridColumn: 9, position: 'relative' }}>
              <small>START</small>
              <span>{tr('인천 출발', '仁川 出発')}</span>
              <small>ICN →</small>
            </div>
            <a href="#/passport" className="corner bg-sky" style={{ gridRow: 9, gridColumn: 1 }}>
              <BookOpen strokeWidth={2.2} />
              <span>{tr('디지털 여권', 'パスポート')}</span>
              <small>PASSPORT</small>
            </a>
            <a href="#/collection" className="corner bg-green" style={{ gridRow: 1, gridColumn: 1 }}>
              <StampIcon strokeWidth={2.2} className="text-paper" />
              <span className="text-paper">{tr('도장 수집', 'スタンプ')}</span>
              <small className="text-paper/85">COLLECT</small>
            </a>
            <a href="#/stats" className="corner bg-red" style={{ gridRow: 1, gridColumn: 9 }}>
              <BarChart3 strokeWidth={2.2} className="text-paper" />
              <span className="text-paper">{tr('여행 기록', '旅の記録')}</span>
              <small className="text-paper/85">TRAVEL LOG</small>
            </a>

            {tiles.map((tRaw, i) => {
              const t = localizeDestination(tRaw, lang)
              const p = tilePlacement(i)
              return (
                <div
                  key={t.id}
                  className="tile"
                  data-side={p.side}
                  data-active={pawn === i && landed !== i ? 'true' : undefined}
                  data-landed={landed === i ? 'true' : undefined}
                  style={{ gridRow: p.row, gridColumn: p.col }}
                  title={`${t.cityKo}, ${t.countryKo} (${t.iataCode})`}
                >
                  <div className="tile-band" style={{ background: CONTINENTS[t.continent].color }} />
                  <div className="tile-body">
                    <img src={`https://flagcdn.com/w40/${t.countryCode.toLowerCase()}.png`} alt="" className="tile-flag" loading="lazy" />
                    <span className="tile-name">{shortName(t.cityKo)}</span>
                    <span className="tile-code">{t.iataCode}</span>
                  </div>
                  {visited.has(t.id) && <span className="tile-visited" title={tr('방문함', '訪問済み')} />}
                </div>
              )
            })}

            <PawnTrack pawn={pawn} hopMs={reduced ? 0 : hopMs} />

            {/* centre: the globe */}
            <div className="board-center board-surface" aria-label={tr('3D 지구본 — 드래그로 회전, 스크롤로 확대·축소', '3D地球儀 — ドラッグで回転、スクロールで拡大・縮小')}>
              {webglFailed ? (
                <div className="flex h-full items-center justify-center">
                  <MiniEarth className="h-[72%] w-[72%]" />
                </div>
              ) : (
                <ErrorBoundary fallback={null} onError={() => setWebglFailed(true)}>
                  <Suspense fallback={null}>
                    <div className="absolute inset-0">
                      <GlobeScene
                        phase={phase}
                        origin={origin}
                        destination={destL}
                        originLabel={tr('인천 출발', '仁川 出発')}
                        journeyId={journeyId}
                        reducedMotion={reduced}
                        skipToken={skipToken}
                        onReady={onReady}
                        onArcReady={onArcReady}
                        onProgress={onProgress}
                        onArrive={onArrive}
                      />
                    </div>
                  </Suspense>
                </ErrorBoundary>
              )}

              {ready === 'loading' && !webglFailed && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-2 rounded-lg border-2 border-ink bg-surface px-3 py-1.5 font-mono text-[11px] font-semibold text-ink">
                    <Loader2 className="h-4 w-4 animate-spin" /> {tr('지구본 준비 중', '地球儀を準備中')}
                  </span>
                </div>
              )}

              {/* top tag */}
              <div className="pointer-events-none absolute inset-x-0 top-[4%] flex justify-center px-3">
                <AnimatePresence mode="wait" initial={false}>
                  {inJourney && destL ? (
                    <motion.div
                      key={'tag-' + journeyId}
                      className="flex items-center gap-2 rounded-lg border-2 border-ink bg-surface px-3 py-1.5 text-ink shadow-[3px_3px_0_var(--color-ink)]"
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -10, opacity: 0 }}
                    >
                      <Flag code={destL.countryCode} className="h-3.5 w-5" />
                      <span className="font-display text-[clamp(13px,2.6cqw,20px)] leading-none">{shortName(destL.cityKo)}</span>
                      <span className="font-mono text-[11px] font-semibold text-mute">{destL.iataCode}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="tag-unknown"
                      className="rounded-md border-2 border-paper/40 px-2.5 py-1 font-mono text-[clamp(8px,1.3cqw,11px)] font-semibold tracking-[0.2em] text-paper/75"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      EXPLORE THE UNEXPECTED
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- Pawn ----------------
 * The pawn runs along the coloured band — the innermost strip of every tile —
 * so it travels a clean square and never covers a city name. Positions are in
 * board units: 1.4 (corner) + 7 × 1 + 1.4 = 9.8; the band centre sits 1.253
 * units in from the outer edge.
 */
const U = 9.8
const TRACK = 1.253 / U
type Pt = { x: number; y: number }
const CORNER: Record<'BR' | 'BL' | 'TL' | 'TR', Pt> = {
  BR: { x: 1 - TRACK, y: 1 - TRACK },
  BL: { x: TRACK, y: 1 - TRACK },
  TL: { x: TRACK, y: TRACK },
  TR: { x: 1 - TRACK, y: TRACK },
}
function trackPoint(i: number): Pt {
  if (i < 0) return CORNER.BR
  const p = tilePlacement(i)
  const along = (n: number) => (1.4 + (n - 2) + 0.5) / U
  if (p.side === 'bottom') return { x: along(p.col), y: 1 - TRACK }
  if (p.side === 'top') return { x: along(p.col), y: TRACK }
  if (p.side === 'left') return { x: TRACK, y: along(p.row) }
  return { x: 1 - TRACK, y: along(p.row) }
}
function cornerBetween(a: number, b: number): Pt | null {
  if (a === 6 && b === 7) return CORNER.BL
  if (a === 13 && b === 14) return CORNER.TL
  if (a === 20 && b === 21) return CORNER.TR
  if (a === 27 && b === 0) return CORNER.BR
  return null
}

function PawnTrack({ pawn, hopMs }: { pawn: number; hopMs: number }) {
  const prev = useRef(pawn)
  const from = prev.current
  const to = trackPoint(pawn)
  const corner = from !== pawn ? cornerBetween(from, pawn) : null
  useEffect(() => {
    prev.current = pawn
  }, [pawn])
  const pct = (v: number) => `${(v * 100).toFixed(3)}%`
  const animate = corner ? { left: [pct(trackPoint(from).x), pct(corner.x), pct(to.x)], top: [pct(trackPoint(from).y), pct(corner.y), pct(to.y)] } : { left: pct(to.x), top: pct(to.y) }
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      <motion.span
        className="absolute flex h-[3.6cqw] min-h-[15px] w-[3.6cqw] min-w-[15px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-red text-paper shadow-[0_2px_0_var(--color-ink)]"
        initial={false}
        animate={animate}
        transition={{ duration: hopMs / 1000, ease: 'linear' }}
      >
        <Plane className="h-[62%] w-[62%] -rotate-45" strokeWidth={2.6} />
      </motion.span>
    </div>
  )
}

/* ---------------- Dice ---------------- */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function Die({ value, rolling, delay }: { value: number; rolling: boolean; delay: number }) {
  return (
    <motion.div
      className="die"
      animate={rolling ? { rotate: [0, -24, 18, -10, 8, 0], y: [0, -14, 0, -6, 0, 0] } : { rotate: 0, y: 0 }}
      transition={rolling ? { duration: 0.85, delay, ease: 'easeOut' } : { duration: 0.2 }}
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={value === 1 && i === 4 ? 'red' : ''} style={{ visibility: PIPS[value].includes(i) ? 'visible' : 'hidden' }} />
      ))}
    </motion.div>
  )
}

function Dice({ values, rolling }: { values: [number, number]; rolling: boolean }) {
  return (
    <div className="flex gap-2.5" role="img" aria-label={`🎲 ${values[0]}, ${values[1]}`}>
      <Die value={values[0]} rolling={rolling} delay={0} />
      <Die value={values[1]} rolling={rolling} delay={0.06} />
    </div>
  )
}

/* ---------------- Boarding pass (flight HUD) ---------------- */
function BoardingPass({
  dest,
  lang,
  journeyId,
  phase,
  progressBar,
  progressPlane,
  autoAdvance,
  reduced,
  onSkip,
  onStay,
  onAgain,
}: {
  dest: ResolvedDestination
  lang: Lang
  journeyId: string
  phase: FlightPhase
  progressBar: React.RefObject<HTMLDivElement | null>
  progressPlane: React.RefObject<HTMLDivElement | null>
  autoAdvance: boolean
  reduced: boolean
  onSkip: () => void
  onStay: () => void
  onAgain: () => void
}) {
  const origin = getOriginAirport()
  const km = distanceKm(origin.latitude, origin.longitude, dest.airportLatitude, dest.airportLongitude)
  const flightNo = flightNumber(journeyId)
  const seat = `${Math.floor(hashUnit(journeyId, 3) * 40) + 1}${'ABCDEF'[Math.floor(hashUnit(journeyId, 4) * 6)]}`
  const today = new Date()
  const date = `${String(today.getDate()).padStart(2, '0')} ${today.toLocaleString('en-US', { month: 'short' }).toUpperCase()}`
  const arrived = phase === 'arrived'
  const ja = lang === 'ja'
  const status = arrived ? (ja ? '到着しました' : '도착 완료') : phase === 'flying' ? (ja ? '飛行中' : '비행 중') : ja ? '航路を作成中' : '항로 생성 중'

  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl border-[2.5px] border-ink bg-surface text-ink shadow-[6px_6px_0_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3 border-b-[2.5px] border-ink bg-red px-4 py-2 text-paper sm:px-5 sm:py-2.5">
        <span className="font-display text-[16px] tracking-[0.02em] sm:text-[18px]">{ja ? '搭乗券' : '탑승권'} · BOARDING PASS</span>
        <span className="font-mono text-[13px] font-semibold tracking-[0.1em]">{flightNo}</span>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="min-w-0">
              <div className="hud-label">FROM</div>
              <div className="font-serif text-[32px] leading-none sm:text-[40px]">{origin.iata}</div>
              <div className="truncate text-[12px] font-medium text-mute sm:text-[13px]">{originCityName(lang)}<span className="hidden sm:inline"> · {airportLocalName(origin, lang)}</span></div>
            </div>
            <Plane className="mb-5 h-5 w-5 rotate-45 text-ink sm:mb-6 sm:h-6 sm:w-6" strokeWidth={2.2} />
            <div className="min-w-0 text-right">
              <div className="hud-label">TO</div>
              <div className="font-serif text-[32px] leading-none text-red sm:text-[40px]">{dest.iataCode}</div>
              <div className="flex items-center justify-end gap-1.5 truncate text-[12px] font-medium text-mute sm:text-[13px]">
                <Flag code={dest.countryCode} className="h-3 w-4.5" /> {shortName(dest.cityKo)}<span className="hidden sm:inline">, {dest.countryKo}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 sm:mt-6">
            <div className="relative h-[10px] rounded-full border-2 border-ink bg-surface-light">
              <div ref={progressBar} className="h-full rounded-full bg-yellow" style={{ width: arrived ? '100%' : '0%' }} />
              <div ref={progressPlane} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: arrived ? '100%' : '0%' }}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-red text-paper">
                  <Plane className="h-3.5 w-3.5 rotate-45" strokeWidth={2.6} />
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="font-display text-[17px]">{status}</span>
              <span className="font-mono text-[12px] font-medium text-mute">
                {ja ? `約${Math.round(km).toLocaleString()}km · 予想 ${estimateFlightTime(km, lang)}` : `약 ${Math.round(km).toLocaleString()}km · 예상 ${estimateFlightTime(km)}`}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
            {!arrived ? (
              <button className="btn-ghost" onClick={onSkip}>
                {ja ? 'スキップ' : '건너뛰기'} <SkipForward className="h-4 w-4" />
              </button>
            ) : (
              <>
                <span className="mr-auto self-center rotate-[-8deg] rounded-md border-[3px] border-red px-2 py-0.5 font-display text-[15px] text-red sm:hidden [@media(min-width:1024px)_and_(max-height:880px)]:!inline-block">ARRIVED</span>
                <a href={`#/destination/${dest.id}`} className="btn-ghost !bg-yellow">
                  {ja ? 'シティカードを見る' : '도시 카드 보기'} <ArrowRight className="h-4 w-4" />
                </a>
                <button className="btn-ghost" onClick={onAgain}>
                  <RotateCcw className="h-4 w-4" /> {ja ? 'もう一度振る' : '다시 굴리기'}
                </button>
                {autoAdvance && (
                  <button className="btn-ghost" onClick={onStay}>
                    {ja ? '地球儀にとどまる' : '지구본에 머무르기'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="relative hidden border-dashed border-ink p-5 sm:block sm:w-[150px] sm:border-l-[2.5px] [@media(min-width:1024px)_and_(max-height:880px)]:!hidden">
          <dl className="grid grid-cols-3 gap-3 sm:grid-cols-1">
            {[
              ['DATE', date],
              ['SEAT', seat],
              ['GATE', 'R7'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="hud-label">{k}</dt>
                <dd className="font-mono text-[17px] font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {arrived && (
            <motion.div
              className="absolute bottom-3 right-3 rotate-[-12deg] rounded-md border-[3px] border-red px-2 py-0.5 font-display text-[18px] text-red"
              initial={{ scale: 1.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16, delay: reduced ? 0 : 0.9 }}
            >
              ARRIVED
            </motion.div>
          )}
        </div>
      </div>

      {arrived && (
        <div className="border-t-[2.5px] border-ink bg-surface-light px-4 py-2.5 text-[13px] font-medium sm:px-5">
          {ja ? `${shortName(dest.cityKo)}に到着しました。パスポートに入国スタンプが押されました。` : `${shortName(dest.cityKo)}에 도착했어요. 여권에 입국 도장이 찍혔습니다. `}“{dest.slogan}”
        </div>
      )}
      {arrived && autoAdvance && !reduced && (
        <motion.div className="absolute bottom-0 left-0 h-[4px] bg-ink" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: 'linear' }} />
      )}
    </div>
  )
}
