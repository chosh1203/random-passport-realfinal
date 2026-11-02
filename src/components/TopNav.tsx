import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, BookOpen, Compass, Globe2, Menu, Settings, Stamp as StampIcon, UserCircle2, Volume2, VolumeX, X } from 'lucide-react'
import { useState } from 'react'
import type { Route } from '../hooks/useRoute'
import { useSettings } from '../hooks/useStores'
import { unlockAudio } from '../lib/sound'
import { settingsStore } from '../lib/storage'
import { setLang, useLang, useT } from '../i18n'
import { Logo } from './ui'

const PRIMARY = [
  { href: '#/', en: 'EXPLORE', ko: '탐험', ja: '探検', match: ['home'], icon: Globe2 },
  { href: '#/destination', en: 'DISCOVER', ko: '발견', ja: '発見', match: ['destination'], icon: Compass },
  { href: '#/collection', en: 'COLLECT', ko: '수집', ja: '収集', match: ['collection'], icon: StampIcon },
] as const

const SECONDARY = [
  { href: '#/passport', label: '디지털 여권', labelJa: 'デジタルパスポート', en: 'PASSPORT', match: 'passport', icon: BookOpen },
  { href: '#/stats', label: '여행 기록 & 통계', labelJa: '旅の記録と統計', en: 'TRAVEL LOG', match: 'stats', icon: BarChart3 },
] as const

function LangToggle({ compact = false }: { compact?: boolean }) {
  const lang = useLang()
  return (
    <div className={`flex items-center rounded-lg border-2 border-paper/35 p-0.5 ${compact ? '' : ''}`} role="group" aria-label="Language / 言語">
      {(
        [
          ['ko', '한국어', 'KO'],
          ['ja', '日本語', 'JA'],
        ] as const
      ).map(([code, label, short]) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          lang={code}
          aria-pressed={lang === code}
          className={`rounded-md px-2 py-0.5 text-[12px] font-semibold transition ${lang === code ? 'bg-yellow text-ink' : 'text-paper/80 hover:text-paper'}`}
        >
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{short}</span>
        </button>
      ))}
    </div>
  )
}

function SoundToggle() {
  const { sound } = useSettings()
  const tr = useT()
  return (
    <button
      onClick={() => {
        unlockAudio()
        settingsStore.set({ sound: !sound })
      }}
      className="rounded-full p-1.5 text-paper/80 transition hover:text-yellow"
      aria-label={sound ? tr('효과음 끄기', '効果音をオフ') : tr('효과음 켜기', '効果音をオン')}
      aria-pressed={sound}
      title={sound ? tr('효과음 켜짐', '効果音オン') : tr('효과음 꺼짐', '効果音オフ')}
    >
      {sound ? <Volume2 className="h-5.5 w-5.5" strokeWidth={1.8} /> : <VolumeX className="h-5.5 w-5.5" strokeWidth={1.8} />}
    </button>
  )
}

export function TopNav({ route }: { route: Route }) {
  const [open, setOpen] = useState(false)
  const tr = useT()
  return (
    <header className="sticky top-0 z-50 w-full border-b-[3px] border-ink bg-board">
      <div className="mx-auto flex h-[64px] max-w-[1600px] items-center justify-between gap-6 px-4 md:px-8">
        <a href="#/" className="shrink-0" aria-label="RANDOM PASSPORT">
          <Logo className="h-[28px] w-auto md:h-[32px]" />
        </a>

        <nav className="hidden items-center gap-1.5 lg:flex" aria-label={tr('주요 메뉴', 'メインメニュー')}>
          {PRIMARY.map((item) => {
            const active = (item.match as readonly string[]).includes(route.name)
            return (
              <a
                key={item.en}
                href={item.href}
                className={`rounded-lg border-2 px-3 py-1 font-mono text-[12px] font-semibold tracking-[0.14em] transition ${
                  active ? 'nav-pill-active' : 'border-transparent text-paper/75 hover:text-paper'
                }`}
                aria-current={active ? 'page' : undefined}
                title={tr(item.ko, item.ja)}
              >
                {item.en}
              </a>
            )
          })}
          <span className="mx-2 h-5 w-[2px] bg-paper/25" />
          {SECONDARY.map((item) => {
            const active = route.name === item.match
            return (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-lg border-2 px-3.5 py-1 text-[13px] font-semibold transition ${
                  active ? 'nav-pill-active' : 'border-paper/30 text-paper/85 hover:border-paper/70 hover:text-paper'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {tr(item.label, item.labelJa)}
              </a>
            )
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <LangToggle />
          <SoundToggle />
          <a
            href="#/settings"
            className={`hidden rounded-full p-1.5 transition lg:inline-flex ${route.name === 'settings' ? 'text-yellow' : 'text-paper/80 hover:text-yellow'}`}
            aria-label={tr('설정', '設定')}
            title={tr('설정', '設定')}
          >
            <UserCircle2 className="h-6 w-6" strokeWidth={1.6} />
          </a>
          <button className="rounded-full p-1.5 text-paper/85 transition hover:text-yellow lg:hidden" onClick={() => setOpen(true)} aria-label={tr('메뉴 열기', 'メニューを開く')}>
            <Menu className="h-6 w-6" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[90] bg-[#1c1d21]/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.nav
              className="glass absolute right-3 top-3 w-[min(320px,calc(100vw-24px))] p-4"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              aria-label={tr('모바일 메뉴', 'モバイルメニュー')}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="eyebrow">MENU</span>
                <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-ink hover:bg-yellow" aria-label={tr('메뉴 닫기', 'メニューを閉じる')}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              {[...PRIMARY.map((p) => ({ href: p.href, label: tr(p.ko, p.ja), en: p.en, icon: p.icon, active: (p.match as readonly string[]).includes(route.name) })),
                ...SECONDARY.map((s) => ({ href: s.href, label: tr(s.label, s.labelJa), en: s.en, icon: s.icon, active: route.name === s.match })),
                { href: '#/settings', label: tr('설정', '設定'), en: 'SETTINGS', icon: Settings, active: route.name === 'settings' }].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`mb-1 flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 transition ${l.active ? 'nav-pill-active' : 'border-transparent text-mute hover:bg-surface-light hover:text-ink'}`}
                >
                  <l.icon className="h-4.5 w-4.5" />
                  <span className="flex-1 text-[15px] font-medium">{l.label}</span>
                  <span className="font-mono text-[10px] tracking-[0.14em] text-dim">{l.en}</span>
                </a>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
