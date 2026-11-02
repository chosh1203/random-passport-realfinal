import { motion } from 'motion/react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  Globe2,
  Home as HomeIcon,
  Layers,
  ListOrdered,
  MapPin,
  Plane,
  Settings as SettingsIcon,
  Shuffle,
  Stamp as StampIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PassportCover } from '../components/PassportCover'
import { Stamp } from '../components/Stamp'
import { TripModal } from '../components/StampModal'
import { Flag, MiniEarth, SmartImage } from '../components/ui'
import { CONTINENT_COUNT } from '../data/continents'
import type { TripRecord } from '../data/types'
import { navigate } from '../hooks/useRoute'
import { getDestinationById, totalCountriesInPool } from '../lib/destinations'
import { requestLaunch } from '../lib/launch'
import { computeStats, formatDate, sortByDateDesc } from '../lib/stats'
import { localizedById, useLang, useLocalizedTrips, useT } from '../i18n'

function launch() {
  requestLaunch()
  navigate('/')
}

export function Sidebar({ active }: { active: 'stats' | 'settings' }) {
  const tr = useT()
  const items = [
    { label: tr('홈', 'ホーム'), icon: HomeIcon, onClick: () => navigate('/'), key: 'home' },
    { label: tr('랜덤 여행', 'ランダム旅行'), icon: Shuffle, onClick: launch, key: 'random' },
    { label: tr('여행 기록 & 통계', '旅の記録と統計'), icon: BarChart3, onClick: () => navigate('/stats'), key: 'stats' },
    { label: tr('디지털 여권', 'デジタルパスポート'), icon: BookOpen, onClick: () => navigate('/passport'), key: 'passport' },
    { label: tr('설정', '設定'), icon: SettingsIcon, onClick: () => navigate('/settings'), key: 'settings' },
  ]
  return (
    <aside className="hidden w-[210px] shrink-0 lg:block">
      <nav className="glass sticky top-[88px] flex flex-col gap-1 p-3" aria-label={tr('대시보드 메뉴', 'ダッシュボードメニュー')}>
        {items.map((it) => {
          const on = it.key === active
          return (
            <button
              key={it.key}
              onClick={it.onClick}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[14px] transition ${
                on ? 'border-2 border-ink bg-yellow font-semibold text-ink shadow-[0_2px_0_var(--color-ink)]' : 'border-2 border-transparent text-mute hover:bg-surface-light hover:text-ink'
              }`}
              aria-current={on ? 'page' : undefined}
            >
              <it.icon className="h-4.5 w-4.5" />
              {it.label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export default function Stats() {
  const lang = useLang()
  const tr = useT()
  const trips = useLocalizedTrips()
  const stats = useMemo(() => computeStats(trips, 6, lang), [trips, lang])
  const recent = useMemo(() => sortByDateDesc(trips), [trips])
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<TripRecord | null>(null)
  const poolCountries = totalCountriesInPool()
  const empty = trips.length === 0

  const cards = [
    { icon: Globe2, label: tr('방문 국가 수', '訪れた国'), value: stats.countries, sub: tr(`/ ${poolCountries}개국`, `/ ${poolCountries}か国`) },
    { icon: MapPin, label: tr('방문 도시 수', '訪れた街'), value: stats.cities, sub: tr('도시', '都市') },
    { icon: Layers, label: tr('방문한 대륙 수', '訪れた大陸'), value: stats.continents, sub: `/ ${CONTINENT_COUNT}` },
    { icon: StampIcon, label: tr('총 여행 기록 수', '旅の記録'), value: stats.trips, sub: tr('회', '回') },
    { icon: CalendarDays, label: tr('첫 탐험 날짜', 'はじめての旅'), value: stats.firstDate ? formatDate(stats.firstDate) : '—', sub: '', small: true },
  ]

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6 px-4 pb-20 pt-6 md:px-8">
      <Sidebar active="stats" />

      <div className="min-w-0 flex-1">
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          {/* MAIN */}
          <div className="min-w-0 space-y-6">
            {/* Banner */}
            <section className="glass relative overflow-hidden px-6 py-8 md:px-9 md:py-10">
              <MiniEarth className="pointer-events-none absolute hidden md:block md:right-8 top-1/2 h-[180px] w-[180px] -translate-y-1/2" />
                            <div className="relative">
                <div className="eyebrow !text-primary">TRAVEL LOG & STATS</div>
                <h1 className="mt-2 font-display text-[32px] leading-tight md:text-[40px]">{tr('여행 기록 & 통계', '旅の記録と統計')}</h1>
                <p className="mt-2 text-mute">{tr('“지금까지의 여행이 당신만의 이야기가 됩니다.”', '「これまでの旅が、あなただけの物語になる。」')}</p>
              </div>
            </section>

            {/* Stat cards */}
            <section className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 2xl:grid-cols-5">
              {cards.map((c, i) => (
                <motion.div
                  key={c.label}
                  className={`glass flex items-center gap-3.5 px-3.5 py-3 sm:px-4 sm:py-4 ${c.small ? 'col-span-2 md:col-span-1' : ''}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-light/60 text-cyan sm:flex">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] text-mute">{c.label}</div>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-mono font-semibold text-ink ${c.small ? 'text-[17px]' : 'text-[24px] leading-tight sm:text-[26px]'}`}>{c.value}</span>
                      {c.sub && <span className="text-[12px] text-dim">{c.sub}</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </section>

            {empty && (
              <section className="glass flex flex-col items-center gap-4 px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-light/60 text-cyan shadow-[3px_3px_0_var(--color-ink)]">
                  <Compass className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-[20px] font-semibold">{tr('아직 여행 기록이 없어요', 'まだ旅の記録がありません')}</h2>
                  <p className="mt-1 text-mute">{tr('첫 랜덤 여행을 떠나면 방문 국가, 도시, 대륙 통계가 이곳에 쌓입니다.', 'はじめてのランダム旅行に出かけると、訪れた国・街・大陸の統計がここにたまっていきます。')}</p>
                </div>
                <button className="btn-primary" onClick={launch}>
                  <Plane className="h-5 w-5 -rotate-45" /> {tr('첫 탐험 떠나기', 'はじめての旅へ')}
                </button>
              </section>
            )}

            {/* Recent trips */}
            {!empty && (
              <section className="glass p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[16px] font-semibold">
                    <ListOrdered className="h-4.5 w-4.5 text-cyan" /> {tr('최근 여행 기록', '最近の旅')}
                  </h2>
                  {recent.length > 4 && (
                    <button className="text-[13px] text-cyan hover:underline" onClick={() => setShowAll((v) => !v)}>
                      {showAll ? tr('접기', '閉じる') : tr(`더보기 (${recent.length})`, `もっと見る (${recent.length})`)} →
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
                  {(showAll ? recent : recent.slice(0, 4)).map((t) => {
                    const d = localizedById(t.destinationId, lang)
                    return (
                      <button
                        key={t.tripId}
                        onClick={() => setSelected(t)}
                        className="group overflow-hidden rounded-xl border border-line/70 bg-bg/40 text-left transition hover:-translate-y-1 hover:border-primary/60"
                      >
                        <SmartImage wiki={d?.heroImage.wiki ?? t.city} alt={t.city} hue={d?.hue} width={500} className="aspect-[4/3] w-full sm:aspect-[16/10]" label={t.city} />
                        <div className="p-2.5 sm:p-3.5">
                          <div className="flex items-center gap-2">
                            <Flag code={t.countryCode} className="h-3.5 w-5" />
                            <span className="truncate font-semibold">{t.cityKo}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[12px] text-dim">
                            <span className="truncate">{t.countryKo} · <span className="font-mono text-mute">{t.iataCode}</span></span>
                            <span className="font-mono">{formatDate(t.visitedAt)}</span>
                          </div>
                          <p className="mt-2 hidden line-clamp-1 text-[12px] italic text-mute sm:block">“{t.memo || d?.slogan || tr('메모 없음', 'メモなし')}”</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Charts */}
            {!empty && (
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="glass p-5 md:p-6">
                  <h2 className="text-[16px] font-semibold">{tr('대륙별 방문 국가 비율', '大陸別の訪問国の割合')}</h2>
                  <p className="text-[12px] text-dim">{tr('국가는 중복 없이 한 번만 집계됩니다.', '同じ国は一度だけ数えます。')}</p>
                  <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
                    <div className="relative h-[176px] w-[176px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.byContinent} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={stats.byContinent.length > 1 ? 2 : 0} stroke="#1c1d21" strokeWidth={2} isAnimationActive>
                            {stats.byContinent.map((c) => (
                              <Cell key={c.id} fill={c.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTip unit={tr('개국', 'か国')} />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-[28px] font-semibold">{stats.countries}</span>
                        <span className="text-[11px] text-dim">{tr('개국', 'か国')}</span>
                      </div>
                    </div>
                    <ul className="w-full space-y-2" aria-label={tr('대륙별 범례', '大陸の凡例')}>
                      {stats.byContinent
                        .slice()
                        .sort((a, b) => b.value - a.value)
                        .map((c) => (
                          <li key={c.id} className="flex items-center gap-2.5 text-[13px]">
                            <span className="h-3 w-3 rounded-sm border border-ink" style={{ background: c.color }} />
                            <span className="flex-1 whitespace-nowrap text-mute">{c.name}</span>
                            <span className="font-mono text-ink">{c.value}</span>
                            <span className="w-10 text-right font-mono text-dim">{Math.round((c.value / Math.max(stats.countries, 1)) * 100)}%</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>

                <div className="glass p-5 md:p-6">
                  <h2 className="text-[16px] font-semibold">{tr('월별 여행 기록 추이', '月ごとの旅の記録')}</h2>
                  <p className="text-[12px] text-dim">{tr('최근 6개월, 여행 기록 수', '直近6か月の旅の記録数')}</p>
                  <div className="mt-4 h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.monthly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(28,29,33,0.12)" />
                        <XAxis dataKey="label" tick={{ fill: '#4d4a41', fontSize: 12 }} axisLine={{ stroke: '#1c1d21' }} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: '#7a7466', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(242,182,48,0.25)' }} content={<ChartTip unit={tr('회', '回')} />} />
                        <Bar dataKey="count" name={tr('여행', '旅')} fill="#2a78d6" stroke="#1c1d21" strokeWidth={1.5} radius={[4, 4, 0, 0]} maxBarSize={34} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass p-5 md:p-6">
                  <h2 className="text-[16px] font-semibold">{tr('방문 도시 목록', '訪れた街の一覧')}</h2>
                  <ul className="mt-3 max-h-[260px] divide-y divide-line/50 overflow-y-auto pr-1 scrollbar-thin">
                    {stats.cityList.map((c) => (
                      <li key={c.destinationId}>
                        <a href={`#/destination/${c.destinationId}`} className="flex items-center gap-3 py-2.5 text-[14px] transition hover:text-cyan">
                          <Flag code={c.countryCode} className="h-3.5 w-5" />
                          <span className="flex-1">
                            {c.cityKo} <span className="text-dim">· {c.countryKo}</span>
                          </span>
                          <span className="font-mono text-[12px] text-mute">{c.visits}{tr('회', '回')}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {stats.latest && (
                  <button onClick={() => setSelected(stats.latest)} className="glass group relative overflow-hidden text-left">
                    <SmartImage
                      wiki={getDestinationById(stats.latest.destinationId)?.heroImage.wiki ?? stats.latest.city}
                      alt={stats.latest.city}
                      hue={getDestinationById(stats.latest.destinationId)?.hue}
                      width={800}
                      className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/10" />
                    <div className="relative flex h-full min-h-[240px] flex-col justify-end p-6">
                      <div className="eyebrow !text-cyan">LATEST DISCOVERY</div>
                      <div className="mt-1 text-[13px] text-mute">{tr('가장 최근에 탐험한 도시', 'いちばん最近訪れた街')}</div>
                      <div className="mt-2 font-serif text-[36px] font-semibold leading-none">{stats.latest.city}</div>
                      <div className="mt-1 flex items-center gap-2 text-[14px]">
                        <Flag code={stats.latest.countryCode} className="h-3.5 w-5" />
                        {stats.latest.cityKo}, {stats.latest.countryKo} · <span className="font-mono text-mute">{formatDate(stats.latest.visitedAt)}</span>
                      </div>
                    </div>
                  </button>
                )}
              </section>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            <section className="glass p-5">
              <h2 className="eyebrow mb-4">PASSPORT SUMMARY · {tr('여권 요약', 'パスポート')}</h2>
              <div className="flex gap-4">
                <PassportCover compact className="h-[150px] w-[106px] shrink-0" />
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="text-[14px] font-semibold">{tr('나의 여권', 'わたしのパスポート')}</div>
                    <div className="mt-2 text-[12px] text-mute">{tr('총 방문 국가', '訪れた国')}</div>
                    <div className="font-mono text-[30px] font-semibold leading-none">{stats.countries}</div>
                    <div className="mt-2 text-[12px] text-mute">{tr('수집한 입국 도장', '集めたスタンプ')}</div>
                    <div className="font-mono text-[18px] font-semibold">
                      {stats.trips} <span className="text-[12px] text-dim">{tr('개', '個')}</span>
                    </div>
                  </div>
                  <a href="#/passport" className="btn-ghost mt-3 !px-3.5 !py-1.5 !text-[12px]">
                    {tr('여권 보기', 'パスポートを見る')} →
                  </a>
                </div>
              </div>
            </section>

            <section className="glass p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="eyebrow">STAMP COLLECTION</h2>
                <a href="#/collection" className="text-[12px] text-cyan hover:underline">
                  {tr('더보기', 'もっと見る')} →
                </a>
              </div>
              {stats.countryStamps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-mute">
                  {tr('첫 입국 도장을 기다리고 있어요.', 'はじめてのスタンプを待っています。')}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {stats.countryStamps.slice(0, 9).map((t) => (
                    <button
                      key={t.countryCode}
                      onClick={() => setSelected(t)}
                      className="paper flex aspect-square items-center justify-center rounded-lg transition hover:scale-[1.04]"
                      title={`${t.countryKo} · ${t.cityKo}`}
                    >
                      <Stamp trip={t} id={`col-${t.tripId}`} size={84} className="h-[88%] w-[88%]" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <TripModal trip={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function ChartTip({ active, payload, unit }: { active?: boolean; payload?: { name?: string; value?: number; payload?: { label?: string; name?: string; color?: string } }[]; unit: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const name = p.payload?.label ?? p.payload?.name ?? p.name
  return (
    <div className="glass-soft px-3 py-2 text-[12px]">
      <div className="text-mute">{name}</div>
      <div className="font-mono text-[15px] font-semibold text-ink">
        {p.value} {unit}
      </div>
    </div>
  )
}
