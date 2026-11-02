import { Ban, Database, Languages, Repeat, Trash2, Volume2, Wind } from 'lucide-react'
import { useState } from 'react'
import { EXCLUDED_CITIES } from '../data/exclusions'
import { useSettings, useTrips } from '../hooks/useStores'
import { getDestinationPool } from '../lib/destinations'
import { settingsStore, travelStore } from '../lib/storage'
import { Sidebar } from './Stats'
import { setLang, useLang, useT } from '../i18n'

export default function Settings() {
  const settings = useSettings()
  const trips = useTrips()
  const lang = useLang()
  const tr = useT()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6 px-4 pb-20 pt-6 md:px-8">
      <Sidebar active="settings" />
      <div className="min-w-0 max-w-[860px] flex-1 space-y-6">
        <header>
          <div className="eyebrow !text-primary">SETTINGS</div>
          <h1 className="mt-1 font-display text-[32px] leading-tight md:text-[40px]">{tr('설정', '設定')}</h1>
        </header>

        <section className="glass divide-y divide-line/60">
          <Row icon={<Languages className="h-4.5 w-4.5" />} title="언어 / 言語" desc={tr('사이트에 표시되는 언어를 고릅니다.', 'サイトに表示する言語を選びます。')}>
            <div className="flex rounded-full border-2 border-ink bg-surface p-1 text-[13px]">
              {(
                [
                  ['ko', '한국어'],
                  ['ja', '日本語'],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  lang={k}
                  onClick={() => setLang(k)}
                  className={`rounded-full px-3 py-1 transition ${lang === k ? 'bg-yellow font-semibold text-ink' : 'text-mute hover:text-ink'}`}
                  aria-pressed={lang === k}
                >
                  {l}
                </button>
              ))}
            </div>
          </Row>
          <Row icon={<Repeat className="h-4.5 w-4.5" />} title={tr('직전 목적지 제외', '直前の目的地を除外')} desc={tr('같은 도시가 연속으로 나오지 않도록 바로 전 목적지를 추첨에서 뺍니다.', '同じ街が続けて出ないよう、直前の目的地を抽選から外します。')}>
            <Toggle on={settings.avoidRepeat} onChange={(v) => settingsStore.set({ avoidRepeat: v })} label={tr('직전 목적지 제외', '直前の目的地を除外')} />
          </Row>
          <Row icon={<Volume2 className="h-4.5 w-4.5" />} title={tr('효과음', '効果音')} desc={tr('주사위 소리, 비행기 엔진 소리, 도착 차임을 재생합니다. 상단 스피커 버튼으로도 켜고 끌 수 있어요.', 'サイコロの音、飛行機のエンジン音、到着チャイムを鳴らします。上のスピーカーボタンでも切り替えられます。')}>
            <Toggle on={settings.sound} onChange={(v) => settingsStore.set({ sound: v })} label={tr('효과음', '効果音')} />
          </Row>
          <Row icon={<Wind className="h-4.5 w-4.5" />} title={tr('모션', 'モーション')} desc={tr('‘시스템’은 운영체제의 동작 줄이기 설정을 따릅니다. ‘줄이기’는 비행 시간과 카메라 이동을 짧게 만듭니다.', '「システム」はOSの視差効果を減らす設定に従います。「控えめ」は飛行時間とカメラの動きを短くします。')}>
            <div className="flex rounded-full border-2 border-ink bg-surface p-1 text-[13px]">
              {(
                [
                  ['system', tr('시스템', 'システム')],
                  ['reduced', tr('줄이기', '控えめ')],
                  ['full', tr('전체', 'すべて')],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => settingsStore.set({ motion: k })}
                  className={`rounded-full px-3 py-1 transition ${settings.motion === k ? 'bg-yellow font-semibold text-ink' : 'text-mute hover:text-ink'}`}
                  aria-pressed={settings.motion === k}
                >
                  {l}
                </button>
              ))}
            </div>
          </Row>
        </section>

        <section className="glass p-6">
          <div className="flex items-center gap-2">
            <Ban className="h-4.5 w-4.5 text-cyan" />
            <h2 className="font-semibold">{tr('추첨에서 제외되는 유명 도시', '抽選から外している有名な街')}</h2>
          </div>
          <p className="mt-1 text-[13px] text-mute">
            {tr('국가 전체가 아니라 도시 단위로 제외합니다. 현재 추첨 대상은 ', '国ごとではなく街ごとに外しています。いま抽選の対象は ')}<span className="font-mono text-ink">{getDestinationPool().length}</span>{tr('개 도시입니다.', 'の街です。')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXCLUDED_CITIES.map((c) => (
              <span key={c.name} className="rounded-full border border-line/70 bg-bg/40 px-3 py-1 text-[13px] text-mute line-through decoration-primary/60">
                {lang === 'ja' ? c.nameJa : c.nameKo}
              </span>
            ))}
          </div>
        </section>

        <section className="glass p-6">
          <div className="flex items-center gap-2">
            <Database className="h-4.5 w-4.5 text-cyan" />
            <h2 className="font-semibold">{tr('여행 데이터', '旅のデータ')}</h2>
          </div>
          <p className="mt-1 text-[13px] text-mute">{tr(`기록은 이 브라우저(localStorage)에만 저장됩니다. 현재 ${trips.length}개의 여행 기록이 있습니다.`, `記録はこのブラウザ(localStorage)にだけ保存されます。いま${trips.length}件の旅の記録があります。`)}</p>
          <div className="mt-4">
            {!confirm ? (
              <button className="btn-ghost !border-[#ff7b7b]/50 !text-[#ffb3b3]" onClick={() => setConfirm(true)} disabled={trips.length === 0} style={{ opacity: trips.length === 0 ? 0.5 : 1 }}>
                <Trash2 className="h-4 w-4" /> {tr('모든 기록 초기화', 'すべての記録をリセット')}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[14px]">{tr('여권 도장과 통계가 모두 삭제됩니다. 계속할까요?', 'パスポートのスタンプと統計がすべて消えます。続けますか?')}</span>
                <button
                  className="btn-ghost !border-[#ff7b7b] !bg-[#ff7b7b]/15 !text-[#ffd0d0]"
                  onClick={() => {
                    travelStore.clear()
                    setConfirm(false)
                  }}
                >
                  {tr('삭제', '削除')}
                </button>
                <button className="btn-ghost" onClick={() => setConfirm(false)}>
                  {tr('취소', 'キャンセル')}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5 sm:flex-nowrap sm:p-6">
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-light/60 text-cyan sm:flex">{icon}</span>
      <div className="min-w-0 flex-1 basis-[200px]">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 text-[13px] text-mute">{desc}</div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 rounded-full border-2 border-ink transition ${on ? 'bg-green' : 'bg-surface-light'}`}
    >
      <span className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-ink bg-surface transition-all ${on ? 'left-[21px]' : 'left-[2px]'}`} />
    </button>
  )
}
