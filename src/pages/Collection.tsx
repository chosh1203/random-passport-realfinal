import { Plane } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Stamp } from '../components/Stamp'
import { TripModal } from '../components/StampModal'
import { Flag } from '../components/ui'
import { CONTINENTS } from '../data/continents'
import type { ContinentId, TripRecord } from '../data/types'
import { navigate } from '../hooks/useRoute'
import { getDestinationPool } from '../lib/destinations'
import { requestLaunch } from '../lib/launch'
import { computeStats } from '../lib/stats'
import { localizeDestination, useLang, useLocalizedTrips, useT } from '../i18n'

/** COLLECT — every country in the curated pool, stamped or still locked */
export default function Collection() {
  const lang = useLang()
  const tr = useT()
  const trips = useLocalizedTrips()
  const stats = useMemo(() => computeStats(trips, 6, lang), [trips, lang])
  const [filter, setFilter] = useState<ContinentId | 'all'>('all')
  const [selected, setSelected] = useState<TripRecord | null>(null)

  const countries = useMemo(() => {
    const map = new Map<string, { countryCode: string; countryKo: string; country: string; continent: ContinentId; cities: string[] }>()
    getDestinationPool().map((x) => localizeDestination(x, lang)).forEach((d) => {
      const c = map.get(d.countryCode)
      if (c) c.cities.push(d.cityKo)
      else map.set(d.countryCode, { countryCode: d.countryCode, countryKo: d.countryKo, country: d.country, continent: d.continent, cities: [d.cityKo] })
    })
    return [...map.values()].sort((a, b) => a.countryKo.localeCompare(b.countryKo, 'ko'))
  }, [lang])

  const stampByCountry = useMemo(() => new Map(stats.countryStamps.map((t) => [t.countryCode, t])), [stats])
  const visible = countries.filter((c) => filter === 'all' || c.continent === filter)
  const collected = countries.filter((c) => stampByCountry.has(c.countryCode)).length
  const pct = Math.round((collected / Math.max(countries.length, 1)) * 100)

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-20 pt-8 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow !text-primary">COLLECT</div>
          <h1 className="mt-1 font-display text-[32px] leading-tight md:text-[40px]">{tr('입국 도장 컬렉션', 'スタンプコレクション')}</h1>
          <p className="mt-1 text-mute">{tr('아직 열리지 않은 칸은 랜덤 여행으로만 채울 수 있어요.', 'まだ開いていないマスは、ランダム旅行でしか埋められません。')}</p>
        </div>
        <div className="glass w-full max-w-[340px] px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-mute">{tr('수집 진행도', '収集状況')}</span>
            <span className="font-mono text-[22px] font-semibold">
              {collected}
              <span className="text-[14px] text-dim"> / {countries.length}{tr('개국', 'か国')}</span>
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-ink bg-surface-light">
            <div className="h-full rounded-full bg-yellow shadow-[3px_3px_0_var(--color-ink)] transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <div className="-mx-4 mt-7 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="tablist" aria-label={tr('대륙 필터', '大陸フィルター')}>
        {(['all', ...Object.keys(CONTINENTS)] as (ContinentId | 'all')[]).map((k) => {
          const on = filter === k
          const count = k === 'all' ? countries.length : countries.filter((c) => c.continent === k).length
          if (count === 0) return null
          return (
            <button
              key={k}
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(k)}
              className={`shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-[13px] font-semibold transition ${on ? 'nav-pill-active' : 'border-ink bg-surface text-ink hover:bg-surface-light'}`}
            >
              {k === 'all' ? tr('전체', 'すべて') : lang === 'ja' ? CONTINENTS[k].ja : CONTINENTS[k].ko} <span className="ml-1 font-mono text-[11px] text-dim">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-5">
        {visible.map((c) => {
          const t = stampByCountry.get(c.countryCode)
          return t ? (
            <button key={c.countryCode} onClick={() => setSelected(t)} className="paper group flex flex-col items-center rounded-xl border-2 border-ink p-2 sm:p-3 text-[#1d2a3c] shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-1">
              <Stamp trip={t} id={`cc-${t.tripId}`} size={150} className="h-auto w-[86%]" />
              <div className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold sm:text-[13px]">
                <Flag code={c.countryCode} className="h-3 w-4.5" /> {c.countryKo}
              </div>
              <div className="text-[11px] text-[#6a7a90]">{t.cityKo}</div>
            </button>
          ) : (
            <div
              key={c.countryCode}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-ink bg-board p-2 text-center sm:p-3 text-paper shadow-[3px_3px_0_var(--color-ink)]"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0 6px, transparent 6px 14px)' }}
              aria-label={`${c.countryKo} — ${tr('아직 미발견', 'まだ未発見')}`}
            >
              <div className="flex aspect-square w-[62%] items-center justify-center rounded-full border-[3px] border-yellow bg-board">
                <span className="font-display text-[26px] text-yellow sm:text-[34px]">?</span>
              </div>
              <div className="mt-2 font-display text-[13px] text-paper sm:mt-3 sm:text-[15px]">{tr('미발견', '未発見')}</div>
              <div className="font-mono text-[11px] font-semibold tracking-[0.08em] text-paper/70">{lang === 'ja' ? CONTINENTS[c.continent].ja : CONTINENTS[c.continent].ko}</div>
            </div>
          )
        })}
      </div>

      {collected < countries.length && (
        <div className="mt-12 flex justify-center">
          <button
            className="btn-primary"
            onClick={() => {
              requestLaunch()
              navigate('/')
            }}
          >
            <Plane className="h-5 w-5 -rotate-45" /> {tr('다음 도장 받으러 가기', '次のスタンプをもらいに')}
          </button>
        </div>
      )}

      <TripModal trip={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
