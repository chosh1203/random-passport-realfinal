import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, BookOpen, BookX, ChevronLeft, ChevronRight, Globe2, MapPin, Plane, Stamp as StampIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PassportCover } from '../components/PassportCover'
import { Stamp } from '../components/Stamp'
import { TripModal } from '../components/StampModal'
import type { TripRecord } from '../data/types'
import { useMediaQuery, useReducedMotion } from '../hooks/useStores'
import { navigate } from '../hooks/useRoute'
import { requestLaunch } from '../lib/launch'
import { computeStats, formatDate, hashUnit } from '../lib/stats'
import { useLang, useLocalizedTrips, useT } from '../i18n'

const STAMPS_PER_PAGE = 4

export default function Passport() {
  const trips = useLocalizedTrips()
  const lang = useLang()
  const tr = useT()
  const reduced = useReducedMotion()
  const isWide = useMediaQuery('(min-width: 1024px)')
  const stats = useMemo(() => computeStats(trips, 6, lang), [trips, lang])
  const chronological = useMemo(() => [...trips].sort((a, b) => a.visitedAt.localeCompare(b.visitedAt)), [trips])

  const [open, setOpen] = useState(false)
  const [spread, setSpread] = useState(0)
  const [dir, setDir] = useState(1)
  const [selected, setSelected] = useState<TripRecord | null>(null)

  // page 0 = identity page, then stamp pages
  const stampPages = Math.max(3, Math.ceil(chronological.length / STAMPS_PER_PAGE))
  const totalPages = 1 + stampPages
  const perView = isWide ? 2 : 1
  const totalViews = Math.ceil(totalPages / perView)
  const view = Math.min(spread, totalViews - 1)
  const pagesInView = Array.from({ length: perView }, (_, i) => view * perView + i).filter((p) => p < totalPages)

  const go = (d: number) => {
    const next = Math.min(totalViews - 1, Math.max(0, view + d))
    if (next === view) return
    setDir(d)
    setSpread(next)
  }

  return (
    <div className="mx-auto max-w-[1360px] px-5 pb-20 pt-8 md:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow !text-primary">DIGITAL PASSPORT</div>
          <h1 className="mt-1 font-display text-[32px] leading-tight md:text-[40px]">{tr('디지털 여권', 'デジタルパスポート')}</h1>
          <p className="mt-1 text-mute">{tr('방문한 도시는 입국 도장으로 기록됩니다. 도장을 누르면 여행 정보를 볼 수 있어요.', '訪れた街は入国スタンプとして記録されます。スタンプを押すと旅の情報が見られます。')}</p>
        </div>
        {open && (
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            <BookX className="h-4 w-4" /> {tr('여권 닫기', 'パスポートを閉じる')}
          </button>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* BOOK */}
        <div className="flex min-h-[440px] flex-col items-center justify-center sm:min-h-[560px]" style={{ perspective: 2000 }}>
          <AnimatePresence mode="wait" initial={false}>
            {!open ? (
              <motion.div
                key="cover"
                className="flex flex-col items-center"
                initial={{ opacity: 0, rotateY: reduced ? 0 : 25 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: reduced ? 0 : -80, transition: { duration: 0.45 } }}
                style={{ transformOrigin: 'left center' }}
              >
                <button onClick={() => setOpen(true)} className="group transition hover:-translate-y-1" aria-label={tr('여권 펼치기', 'パスポートを開く')}>
                  <PassportCover className="h-[380px] w-[268px] sm:h-[440px] sm:w-[310px] md:h-[500px] md:w-[352px]" />
                </button>
                <button className="btn-ghost mt-6" onClick={() => setOpen(true)}>
                  <BookOpen className="h-4 w-4" /> {tr('여권 펼치기', 'パスポートを開く')}
                </button>
              </motion.div>
            ) : (
              <motion.div key="book" className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="relative mx-auto w-full max-w-[920px]">
                  <div className="absolute -inset-2 rounded-2xl bg-[#0b1a33] shadow-[3px_3px_0_var(--color-ink)]" />
                  <AnimatePresence mode="wait" custom={dir} initial={false}>
                    <motion.div
                      key={view}
                      custom={dir}
                      className={`relative grid ${perView === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
                      initial={{ opacity: 0, rotateY: reduced ? 0 : dir * 18, x: reduced ? 0 : dir * 24 }}
                      animate={{ opacity: 1, rotateY: 0, x: 0 }}
                      exit={{ opacity: 0, rotateY: reduced ? 0 : dir * -18, x: reduced ? 0 : dir * -24 }}
                      transition={{ duration: reduced ? 0.01 : 0.38, ease: 'easeOut' }}
                      style={{ transformOrigin: 'center center' }}
                    >
                      {pagesInView.map((p, i) => (
                        <PassportPage
                          key={p}
                          page={p}
                          side={perView === 2 ? (i === 0 ? 'left' : 'right') : 'single'}
                          trips={chronological}
                          stats={stats}
                          onSelect={setSelected}
                        />
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="mt-8 flex items-center justify-center gap-4">
                  <button className="btn-ghost !p-2.5" onClick={() => go(-1)} disabled={view === 0} aria-label={tr('이전 페이지', '前のページ')} style={{ opacity: view === 0 ? 0.4 : 1 }}>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="font-mono text-[13px] text-mute">
                    {pagesInView.map((p) => p + 1).join('–')} / {totalPages}
                  </span>
                  <button className="btn-ghost !p-2.5" onClick={() => go(1)} disabled={view >= totalViews - 1} aria-label={tr('다음 페이지', '次のページ')} style={{ opacity: view >= totalViews - 1 ? 0.4 : 1 }}>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SIDE STATS */}
        <aside className="grid grid-cols-3 gap-2.5 lg:flex lg:flex-col lg:gap-3">
          {[
            { icon: Globe2, label: tr('방문 국가 수', '訪れた国'), value: stats.countries },
            { icon: MapPin, label: tr('방문 도시 수', '訪れた街'), value: stats.cities },
            { icon: StampIcon, label: tr('누적 입국 도장 수', '入国スタンプ'), value: stats.trips },
          ].map((s) => (
            <div key={s.label} className="glass flex flex-col items-start gap-1 px-3 py-3 lg:flex-row lg:items-center lg:gap-4 lg:px-5 lg:py-4">
              <span className="hidden h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-light/60 text-cyan lg:flex">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[12px] leading-tight text-mute lg:text-[13px]">{s.label}</div>
                <div className="font-mono text-[24px] font-semibold leading-tight lg:text-[28px]">{s.value}</div>
              </div>
            </div>
          ))}
          <a href="#/stats" className="btn-ghost col-span-3 mt-1 justify-center lg:mt-2">
            <BarChart3 className="h-4 w-4" /> {tr('여행 기록 & 통계 보기', '旅の記録と統計を見る')}
          </a>
          {trips.length === 0 && (
            <button
              className="btn-primary col-span-3 mt-2 !px-6 !py-3.5 !text-[14px]"
              onClick={() => {
                requestLaunch()
                navigate('/')
              }}
            >
              <Plane className="h-4 w-4 -rotate-45" /> {tr('첫 도장 받으러 가기', 'はじめてのスタンプをもらいに')}
            </button>
          )}
        </aside>
      </div>

      <TripModal trip={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function PassportPage({
  page,
  side,
  trips,
  stats,
  onSelect,
}: {
  page: number
  side: 'left' | 'right' | 'single'
  trips: TripRecord[]
  stats: ReturnType<typeof computeStats>
  onSelect: (t: TripRecord) => void
}) {
  const radius = side === 'left' ? 'rounded-l-xl' : side === 'right' ? 'rounded-r-xl' : 'rounded-xl'
  const spine =
    side === 'left'
      ? 'inset -18px 0 24px -14px rgba(60,40,10,0.35)'
      : side === 'right'
        ? 'inset 18px 0 24px -14px rgba(60,40,10,0.35)'
        : 'none'

  return (
    <div className={`paper paper-guilloche relative aspect-[0.72] overflow-hidden text-[#1d2a3c] ${radius}`} style={{ boxShadow: spine }}>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-3 font-display text-[9px] tracking-[0.25em] text-[#6a7a90]">
        <span>RANDOM PASSPORT</span>
        <span>{String(page + 1).padStart(2, '0')}</span>
      </div>
      {page === 0 ? <IdentityPage stats={stats} trips={trips} /> : <StampPage page={page} trips={trips} onSelect={onSelect} />}
    </div>
  )
}

function IdentityPage({ stats, trips }: { stats: ReturnType<typeof computeStats>; trips: TripRecord[] }) {
  const tr = useT()
  const no = trips[0] ? `RP${Math.floor(hashUnit(trips[0].tripId) * 9_000_000 + 1_000_000)}` : 'RP0000000'
  const issue = stats.firstDate ? formatDate(stats.firstDate, 'stamp') : '— — —'
  const fields: [string, string][] = [
    [tr('Type / 종류', 'Type / 型'), 'P'],
    [tr('Passport No. / 여권번호', 'Passport No. / 旅券番号'), no],
    [tr('Surname / 성', 'Surname / 姓'), 'EXPLORER'],
    [tr('Given names / 이름', 'Given names / 名'), 'WORLD'],
    [tr('Issuing authority / 발행', 'Issuing authority / 発行'), 'RANDOM PASSPORT'],
    [tr('Date of issue / 첫 탐험일', 'Date of issue / 初めての旅'), issue],
  ]
  const mrz1 = `P<RPEXPLORER<<WORLD${'<'.repeat(25)}`.slice(0, 44)
  const mrz2 = `${no}<0RP${String(stats.countries).padStart(3, '0')}${String(stats.cities).padStart(3, '0')}${'<'.repeat(30)}`.slice(0, 44)
  return (
    <div className="flex h-full flex-col px-[7%] pb-[6%] pt-[11%]">
      <div className="font-display text-[clamp(11px,1.4vw,14px)] font-semibold tracking-[0.3em] text-[#25456e]">PASSPORT · {tr('여권', '旅券')}</div>
      <div className="mt-[6%] flex gap-[6%]">
        <div className="flex aspect-[0.78] w-[34%] shrink-0 flex-col items-center justify-center rounded-md border border-[#9fb3cc] bg-gradient-to-b from-[#dfe8f2] to-[#c7d6e7]">
          <Plane className="h-1/3 w-1/3 -rotate-45 text-[#25456e]/70" />
          <span className="mt-1 font-display text-[8px] tracking-[0.2em] text-[#25456e]/70">EXPLORER</span>
        </div>
        <dl className="grid flex-1 grid-cols-1 content-start gap-[5px]">
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[clamp(7px,0.8vw,9px)] uppercase tracking-wide text-[#6a7a90]">{k}</dt>
              <dd className="font-mono text-[clamp(10px,1.1vw,13px)] font-semibold leading-tight">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 border-y border-[#9fb3cc]/70 py-3 text-center">
        {[
          ['COUNTRIES', stats.countries],
          ['CITIES', stats.cities],
          ['STAMPS', stats.trips],
        ].map(([k, v]) => (
          <div key={k as string}>
            <div className="font-mono text-[clamp(16px,2vw,22px)] font-semibold text-[#1f5fa8]">{v}</div>
            <div className="font-display text-[8px] tracking-[0.2em] text-[#6a7a90]">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 break-all font-mono text-[clamp(8px,0.95vw,11px)] leading-snug tracking-[0.12em] text-[#38495e]">
        <div>{mrz1}</div>
        <div>{mrz2}</div>
      </div>
    </div>
  )
}

function StampPage({ page, trips, onSelect }: { page: number; trips: TripRecord[]; onSelect: (t: TripRecord) => void }) {
  const tr = useT()
  const start = (page - 1) * STAMPS_PER_PAGE
  const items = trips.slice(start, start + STAMPS_PER_PAGE)
  const isFirstEmpty = trips.length === 0 && page === 1
  return (
    <div className="flex h-full flex-col px-[6%] pb-[6%] pt-[10%]">
      <div className="flex items-center justify-between font-display text-[10px] tracking-[0.25em] text-[#6a7a90]">
        <span>VISAS · {tr('입국 기록', '入国記録')}</span>
      </div>
      {isFirstEmpty ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#9fb3cc] text-center">
          <StampIcon className="h-8 w-8 text-[#9fb3cc]" />
          <p className="mt-3 px-6 text-[13px] font-medium text-[#4a5b70]">{tr('아직 찍힌 입국 도장이 없습니다', 'まだ入国スタンプはありません')}</p>
          <p className="mt-1 px-6 text-[12px] text-[#6a7a90]">{tr('첫 랜덤 여행을 떠나면 이곳에 도장이 찍혀요.', 'はじめてのランダム旅行に出かけると、ここにスタンプが押されます。')}</p>
        </div>
      ) : (
        <div className="mt-2 grid flex-1 grid-cols-2 grid-rows-2 place-items-center">
          {Array.from({ length: STAMPS_PER_PAGE }, (_, i) => {
            const t = items[i]
            if (!t) return <div key={i} />
            const dx = (hashUnit(t.tripId, 1) - 0.5) * 22
            const dy = (hashUnit(t.tripId, 2) - 0.5) * 22
            return (
              <motion.button
                key={t.tripId}
                onClick={() => onSelect(t)}
                className="relative w-[88%] rounded-full outline-none transition hover:scale-[1.06] focus-visible:ring-2 focus-visible:ring-primary"
                style={{ translate: `${dx}px ${dy}px`, mixBlendMode: 'multiply' }}
                initial={{ scale: 1.25, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 380, damping: 18 }}
                aria-label={`${t.countryKo} ${t.cityKo} — ${formatDate(t.visitedAt)}`}
                title={`${t.cityKo}, ${t.countryKo} · ${formatDate(t.visitedAt)}`}
              >
                <Stamp trip={t} id={`pp-${t.tripId}`} size={160} className="h-auto w-full" />
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
