import { motion } from 'motion/react'
import {
  AlertTriangle,
  ArrowLeft,
  Bus,
  CalendarDays,
  Clock3,
  Coins,
  Compass,
  ExternalLink,
  HandHeart,
  Info,
  Landmark,
  Languages,
  MapPin,
  Plane,
  ShieldAlert,
  Stamp as StampIcon,
  Sun,
  UtensilsCrossed,
} from 'lucide-react'
import { lazy, Suspense, useMemo } from 'react'

const CityMap = lazy(() => import('../components/CityMap'))
import { Stamp } from '../components/Stamp'
import { Flag, SectionTitle, SmartImage } from '../components/ui'
import { CONTINENTS } from '../data/continents'
import { useLocalTime, useTrips } from '../hooks/useStores'
import { navigate } from '../hooks/useRoute'
import { getAirport, getDestinationById } from '../lib/destinations'
import { formatDate, sortByDateDesc } from '../lib/stats'
import { requestLaunch } from '../lib/launch'
import { localizeDestination, localizeTrip, useLang, useT } from '../i18n'

function launchAgain() {
  requestLaunch()
  navigate('/')
}

export default function DestinationPage({ id }: { id?: string }) {
  const lang = useLang()
  const tr = useT()
  const trips = useTrips()
  const latestId = useMemo(() => sortByDateDesc(trips)[0]?.destinationId, [trips])
  const resolvedId = id ?? latestId
  const dest = useMemo(() => {
    const d = getDestinationById(resolvedId)
    return d ? localizeDestination(d, lang) : null
  }, [resolvedId, lang])
  const time = useLocalTime(dest?.timezone, lang)
  const visits = useMemo(() => sortByDateDesc(trips.filter((t) => t.destinationId === dest?.id)).map((t) => localizeTrip(t, lang)), [trips, dest, lang])

  // No destination drawn yet
  if (!id && !latestId) {
    return (
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title={tr('아직 발견한 도시가 없습니다', 'まだ見つけた街はありません')}
        body={tr('지구본에서 랜덤 목적지를 뽑으면 이곳에서 도시의 관광지, 음식, 언어와 문화를 탐색할 수 있어요.', 'サイコロを振って目的地を決めると、ここで街の観光地や料理、言葉と文化を知ることができます。')}
        cta={tr('첫 탐험 떠나기', 'はじめての旅へ')}
      />
    )
  }
  // Unknown id / failed data
  if (!dest) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title={tr('목적지 정보를 불러오지 못했습니다', '目的地の情報を読み込めませんでした')}
        body={tr('요청한 도시 데이터가 없거나 유효한 공항 정보가 없습니다. 다른 목적지로 다시 떠나 보세요.', 'この街のデータか空港情報が見つかりません。別の目的地へ出かけてみましょう。')}
        cta={tr('다른 목적지로 떠나기', '別の目的地へ')}
      />
    )
  }

  const quick = [
    { href: '#sec-attractions', label: tr('주요 관광지', '主な観光地'), en: 'ATTRACTIONS', icon: Landmark, wiki: dest.attractions[0]?.wiki },
    { href: '#sec-food', label: tr('대표 음식', '名物料理'), en: 'FOOD', icon: UtensilsCrossed, wiki: dest.foods[0]?.wiki },
    { href: '#sec-language', label: tr('언어 & 통화', '言葉と通貨'), en: 'LANGUAGE', icon: Languages, wiki: dest.attractions[1]?.wiki ?? dest.heroImage.wiki },
    { href: '#sec-tips', label: tr('여행 팁', '旅のヒント'), en: 'TRAVEL TIPS', icon: Info, wiki: dest.attractions[2]?.wiki ?? dest.heroImage.wiki },
  ]

  const extraAirports = dest.airports.slice(1).map(getAirport).filter(Boolean)

  return (
    <div className="relative isolate pb-24">
      {/* the city's photo, faint, behind the whole page */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-clip" aria-hidden>
        <div className="sticky top-0 h-[100svh]">
          <SmartImage wiki={dest.heroImage.wiki} alt="" hue={dest.hue} width={1920} className="absolute inset-0 h-full w-full opacity-[0.62]" />
          {/* light cream veil keeps text readable while the photo stays clearly visible */}
          <div className="absolute inset-0 bg-bg/25" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-bg/40" />
        </div>
      </div>
      {/* HERO — one city card: identity + slogan on the left, the photo filling the right.
          Facts that have their own sections below (currency, language, season…) are not repeated here. */}
      <section className="mx-auto max-w-[1280px] px-5 pt-6 md:px-10">
        <button onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/'))} className="btn-ghost shrink-0 whitespace-nowrap">
          <ArrowLeft className="h-4 w-4" /> {tr('돌아가기', '戻る')}
        </button>

        <motion.article
          className="glass mt-6 grid overflow-hidden !rounded-xl !border-[2.5px] !shadow-[6px_6px_0_var(--color-ink)] lg:grid-cols-[400px_1fr]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          {/* identity */}
          <div className="flex min-w-0 flex-col">
            <div className="border-b-[2.5px] border-ink px-6 py-5 text-center" style={{ background: CONTINENTS[dest.continent].color }}>
              <div className="font-mono text-[11px] font-semibold tracking-[0.2em] text-ink/80">
                CITY CARD · {CONTINENTS[dest.continent].en.toUpperCase()}
              </div>
              <h1 className="mt-2 font-display text-[40px] leading-none text-ink md:text-[46px]">{dest.cityKo.replace(/[(（].*[)）]/, '')}</h1>
              <div className="mt-2 font-serif text-[20px] leading-tight text-ink">{dest.city}</div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8 text-center">
              <div className="flex items-center gap-2 text-[15px] font-medium">
                <Flag code={dest.countryCode} className="h-4 w-6" />
                {dest.countryKo}
                <span className="font-mono text-[12px] tracking-[0.1em] text-mute">{dest.country.toUpperCase()}</span>
              </div>
              <p className="max-w-[300px] font-display text-[24px] leading-[1.4] md:text-[26px]">“{dest.slogan}”</p>
              <div className="font-serif text-[16px] text-mute">{dest.localName}</div>
            </div>

            <dl className="grid grid-cols-2 border-t-[2.5px] border-ink text-left">
              <div className="border-r-2 border-ink/20 px-5 py-3">
                <dt className="hud-label flex items-center gap-1.5">
                  <Plane className="h-3 w-3" /> {tr('도착 공항', '到着空港')}
                </dt>
                <dd className="mt-0.5 font-mono text-[18px] font-semibold">{dest.iataCode}</dd>
              </div>
              <div className="px-5 py-3">
                <dt className="hud-label flex items-center gap-1.5">
                  <Clock3 className="h-3 w-3" /> {tr('현지 시간', '現地時間')}
                </dt>
                <dd className="mt-0.5 font-mono text-[18px] font-semibold">
                  {time ? time.text.replace(/^.*?(\d{1,2}:\d{2}).*$/, '$1') : '—'} <span className="text-[11px] font-medium text-dim">{time?.offset}</span>
                </dd>
              </div>
            </dl>
          </div>

          {/* location map — fills the full height of the card */}
          <div className="relative min-h-[300px] overflow-hidden border-t-[2.5px] border-ink bg-[#3d8fd9] lg:min-h-[480px] lg:border-l-[2.5px] lg:border-t-0">
            <Suspense fallback={<div className="skeleton absolute inset-0" />}>
              <CityMap dest={dest} airportLabel={`${dest.iataCode} ${tr('공항', '空港')}`} />
            </Suspense>
            <div className="absolute left-3 top-3 rounded-md border-2 border-ink bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-ink">
              LOCATION · {Math.abs(dest.latitude).toFixed(2)}°{dest.latitude >= 0 ? 'N' : 'S'} {Math.abs(dest.longitude).toFixed(2)}°{dest.longitude >= 0 ? 'E' : 'W'}
            </div>
          </div>
        </motion.article>
      </section>

      <div className="mx-auto max-w-[1280px] px-5 md:px-10">
        {/* Quick tiles */}
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {quick.map((q, i) => (
            <motion.a
              key={q.href}
              href={q.href}
              onClick={(e) => {
                e.preventDefault()
                document.querySelector(q.href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="glass group overflow-hidden !rounded-2xl transition hover:-translate-y-1 hover:border-primary/60"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
            >
              <SmartImage wiki={q.wiki} alt={q.label} hue={dest.hue + i * 20} width={500} className="h-24 w-full md:h-28" />
              <div className="flex items-center gap-2.5 px-3.5 py-3">
                <q.icon className="h-4 w-4 text-cyan" />
                <span className="flex-1 text-[14px] font-medium">{q.label}</span>
                <span className="text-dim transition group-hover:translate-x-0.5 group-hover:text-cyan">›</span>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Getting there */}
        {(dest.transfer || extraAirports.length > 0) && (
          <div className="glass-soft mt-6 flex items-start gap-3 px-5 py-4 text-[14px]">
            <Bus className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
            <div>
              <div className="font-semibold">{tr('공항에서 도시까지', '空港から街まで')}</div>
              {dest.transfer && <p className="mt-1 text-mute">{dest.transfer}</p>}
              {extraAirports.length > 0 && (
                <p className="mt-1 text-dim">
                  {tr('다른 연결 공항', 'ほかの空港')}: {extraAirports.map((a) => `${lang === 'ja' ? a!.name : a!.nameKo} (${a!.iata})`).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Your visit */}
        {visits.length > 0 && (
          <div className="glass mt-6 flex flex-col items-center gap-5 px-5 py-5 sm:flex-row">
            <div className="paper flex h-[112px] w-[112px] shrink-0 items-center justify-center rounded-xl">
              <Stamp trip={visits[0]} id={`dest-${visits[0].tripId}`} size={100} />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="eyebrow !text-primary">YOUR VISIT</div>
              <div className="mt-1 text-[16px] font-semibold">
                {lang === 'ja' ? `${formatDate(visits[0].visitedAt, 'long', lang)} 入国 · この街を${visits.length}回訪れました` : `${formatDate(visits[0].visitedAt, 'long')} 입국 · 이 도시를 ${visits.length}번 방문했어요`}
              </div>
              {visits[0].memo && visits[0].memo !== dest.slogan && <p className="mt-1 text-[14px] text-mute">“{visits[0].memo}”</p>}
            </div>
            <a href="#/passport" className="btn-ghost">
              <StampIcon className="h-4 w-4" /> {tr('여권에서 보기', 'パスポートで見る')}
            </a>
          </div>
        )}

        {/* Attractions */}
        <section id="sec-attractions" className="scroll-mt-24 pt-14">
          <SectionTitle en="ATTRACTIONS" ko={tr('대표 관광지', '主な観光地')} icon={<Landmark className="h-4 w-4" />} />
          <div className="grid gap-4 md:grid-cols-3">
            {dest.attractions.map((a, i) => (
              <motion.article
                key={a.name}
                className="glass overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08 }}
              >
                <SmartImage wiki={a.wiki} alt={a.nameKo} hue={dest.hue + i * 25} width={700} className="aspect-[4/3] w-full" label={a.name} />
                <div className="p-5">
                  <h3 className="text-[17px] font-semibold">{a.nameKo}</h3>
                  <div className="font-serif text-[15px] italic text-dim">{a.name}</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-mute">{a.description}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-[12px] text-cyan">
                    <MapPin className="h-3.5 w-3.5" /> {a.location}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Food */}
        <section id="sec-food" className="scroll-mt-24 pt-14">
          <SectionTitle en="LOCAL FOOD" ko={tr('대표 음식', '名物料理')} icon={<UtensilsCrossed className="h-4 w-4" />} />
          <div className="grid gap-4 md:grid-cols-2">
            {dest.foods.map((f, i) => (
              <motion.article
                key={f.name}
                className="glass flex overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08 }}
              >
                <SmartImage wiki={f.wiki} alt={f.nameKo} hue={dest.hue + 30 + i * 30} width={500} className="w-[38%] min-w-[130px] shrink-0" label={f.name} />
                <div className="p-5">
                  <h3 className="text-[17px] font-semibold">{f.nameKo}</h3>
                  <div className="font-serif text-[15px] italic text-dim">{f.name}</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-mute">{f.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Language & currency & culture */}
        <section id="sec-language" className="scroll-mt-24 pt-14">
          <SectionTitle en="LANGUAGE · CURRENCY · CULTURE" ko={tr('언어 · 통화 · 현지 문화', '言葉 · 通貨 · 現地の文化')} icon={<Languages className="h-4 w-4" />} />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass p-6">
              <div className="flex items-center gap-2 text-cyan">
                <Languages className="h-4 w-4" /> <span className="eyebrow !text-cyan">LANGUAGE</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {dest.languages.names.map((n) => (
                  <span key={n} className="rounded-full border border-line bg-surface-light/60 px-3 py-1 text-[13px]">
                    {n}
                  </span>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-line/70 bg-bg/40 p-4">
                <div className="hud-label">{tr('현지 인사말', '現地のあいさつ')}</div>
                <div className="mt-1.5 font-serif text-[24px] leading-tight text-ink">{dest.languages.greeting.local}</div>
                <div className="mt-1 text-[14px] text-mute">
                  [{dest.languages.greeting.reading}] · {dest.languages.greeting.meaning}
                </div>
              </div>
            </div>

            <div className="glass p-6">
              <div className="flex items-center gap-2 text-cyan">
                <Coins className="h-4 w-4" /> <span className="eyebrow !text-cyan">CURRENCY</span>
              </div>
              <div className="mt-4 flex items-end gap-3">
                <span className="font-mono text-[44px] font-semibold leading-none text-ink">{dest.currency.code}</span>
              </div>
              <div className="mt-2 text-[16px]">{dest.currency.name}</div>
              {dest.currency.note && <p className="mt-2 text-[13px] text-mute">{dest.currency.note}</p>}
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-line/60 bg-bg/40 p-3 text-[12px] leading-relaxed text-dim">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {tr('실시간 환율은 제공하지 않습니다. 출국 전 은행·환전소에서 최신 환율을 확인하세요.', 'リアルタイムの為替レートは表示していません。出発前に銀行や両替所で最新のレートを確認してください。')}
              </p>
            </div>

            <div className="glass p-6">
              <div className="flex items-center gap-2 text-cyan">
                <HandHeart className="h-4 w-4" /> <span className="eyebrow !text-cyan">LOCAL CULTURE</span>
              </div>
              <ul className="mt-4 space-y-3">
                {dest.culture.map((c) => (
                  <li key={c} className="flex gap-3 text-[14px] leading-relaxed text-mute">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan shadow-[0_0_8px_#78d7ff]" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Tips */}
        <section id="sec-tips" className="scroll-mt-24 pt-14">
          <SectionTitle en="TRAVEL TIPS" ko={tr('여행 팁 및 주의사항', '旅のヒントと注意点')} icon={<Info className="h-4 w-4" />} />
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { icon: Bus, title: tr('교통수단', '交通手段'), body: dest.travelTips.transport },
              { icon: HandHeart, title: tr('현지 문화와 예절', '現地の文化とマナー'), body: dest.travelTips.etiquette },
              { icon: Sun, title: tr('여행하기 좋은 계절', '旅に適した季節'), body: dest.travelTips.bestSeason },
              { icon: ShieldAlert, title: tr('안전 관련 주의사항', '安全上の注意'), body: dest.travelTips.safety },
            ].map((t) => (
              <div key={t.title} className="glass-soft flex gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-light/60 text-cyan">
                  <t.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-mute">{t.body}</p>
                </div>
              </div>
            ))}
            <div className="glass-soft flex gap-4 !border-2 bg-[#fdf0cf] p-5 md:col-span-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-2 border-ink bg-yellow text-ink">
                <CalendarDays className="h-4.5 w-4.5" />
              </span>
              <div className="flex-1">
                <h3 className="font-semibold">{tr('입국 및 비자 안내', '入国・ビザについて')} <span className="ml-1 rounded border border-ink bg-yellow px-1.5 py-0.5 text-[11px] font-semibold text-ink">{tr('참고 정보', '参考情報')}</span></h3>
                <p className="mt-1 text-[14px] leading-relaxed text-mute">
                  {lang === 'ja'
                    ? `ビザ免除の有無や滞在可能期間、パスポートの残存期間の条件は随時変わります。このサイトは入国規定を確定的に案内するものではないので、出発前に必ず外務省の海外安全ホームページと${dest.countryKo}大使館の公式案内を確認してください。`
                    : `비자 면제 여부, 체류 가능 기간, 여권 유효기간 조건은 수시로 바뀝니다. 이 사이트는 입국 규정을 확정적으로 안내하지 않으니, 출국 전 반드시 외교부 해외안전여행과 ${dest.countryKo} 대사관 공식 안내를 확인하세요.`}
                </p>
                <a href={lang === 'ja' ? 'https://www.anzen.mofa.go.jp/' : 'https://www.0404.go.kr'} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-cyan hover:underline">
                  {tr('외교부 해외안전여행 (0404.go.kr)', '外務省 海外安全ホームページ')} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-16 flex flex-col items-center gap-4 text-center [text-shadow:0_0_8px_var(--color-bg),0_0_3px_var(--color-bg)]">
          <p className="text-mute">{tr('다음엔 어디로 가게 될까요?', '次はどこへ行くことになるでしょう?')}</p>
          <button className="btn-primary" onClick={launchAgain}>
            <Plane className="h-5 w-5 -rotate-45" /> TAKE ME SOMEWHERE UNKNOWN
          </button>
          <p className="max-w-[560px] text-[12px] text-dim">{tr('사진: Wikipedia / Wikimedia Commons. 여행 정보는 참고용이며 현지 사정에 따라 달라질 수 있습니다.', '写真: Wikipedia / Wikimedia Commons。旅行情報は参考用で、現地の事情により変わることがあります。')}</p>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, body, cta = '첫 탐험 떠나기' }: { icon: React.ReactNode; title: string; body: string; cta?: string }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-light/60 text-cyan shadow-[3px_3px_0_var(--color-ink)]">{icon}</span>
      <h1 className="mt-5 text-[22px] font-semibold">{title}</h1>
      <p className="mt-2 text-mute">{body}</p>
      <button className="btn-primary mt-8" onClick={launchAgain}>
        <Plane className="h-5 w-5 -rotate-45" /> {cta}
      </button>
    </div>
  )
}
