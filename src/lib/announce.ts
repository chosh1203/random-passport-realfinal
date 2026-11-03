import type { ResolvedDestination } from '../data/types'
import { hashUnit } from './stats'

/**
 * In-flight cabin announcements, shown as dialogue from the pixel-art
 * flight attendant above the boarding pass. Text only — no voice, no chime.
 */
export interface Announcement {
  /** flight progress (0–1) at which it plays; -1 = at boarding, 2 = on arrival */
  at: number
  text: string
}

export function flightNumber(journeyId: string) {
  return `RP ${String(Math.floor(hashUnit(journeyId) * 900) + 100)}`
}

const short = (s: string) => s.replace(/[(（].*[)）]/, '')

function localClock(tz: string, lang: 'ko' | 'ja') {
  try {
    return new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'ko-KR', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: lang === 'ko' }).format(new Date())
  } catch {
    return ''
  }
}

export function buildAnnouncements(d: ResolvedDestination, lang: 'ko' | 'ja', km: number, journeyId: string): Announcement[] {
  const city = short(d.cityKo)
  const no = flightNumber(journeyId).replace(' ', '')
  const dist = Math.round(km / 100) * 100
  const food = d.foods[0]?.nameKo ?? ''
  const greet = d.languages.greeting
  const time = localClock(d.timezone, lang)
  if (lang === 'ja') {
    return [
      { at: -1, text: `皆さま、こんにちは。ランダムパスポート${no}便、${city}行きです。` },
      { at: 0.04, text: 'まもなく離陸いたします。シートベルトをしっかりお締めください。' },
      { at: 0.3, text: `巡航高度に達しました。${city}までは約${dist.toLocaleString()}キロです。` },
      { at: 0.52, text: `本日の機内食は、${d.countryKo}の名物「${food}」でございます。` },
      { at: 0.72, text: `${city}のあいさつは「${greet.reading}」。「${greet.meaning}」という意味です。` },
      { at: 0.88, text: `まもなく着陸いたします。現地時刻は${time}です。` },
      { at: 2, text: `${city}に到着いたしました。どうぞよい旅を。` },
    ]
  }
  return [
    { at: -1, text: `손님 여러분, 안녕하십니까. 랜덤 패스포트 ${no}편, ${city}행입니다.` },
    { at: 0.04, text: '곧 이륙하겠습니다. 좌석벨트를 단단히 매 주십시오.' },
    { at: 0.3, text: `순항 고도에 도달했습니다. ${city}까지는 약 ${dist.toLocaleString()}킬로미터입니다.` },
    { at: 0.52, text: `오늘의 기내식은 ${d.countryKo}의 명물, ${food}입니다.` },
    { at: 0.72, text: `${city}의 인사말은 '${greet.reading}', '${greet.meaning}'라는 뜻입니다.` },
    { at: 0.88, text: `곧 착륙하겠습니다. 현지 시각은 ${time}입니다.` },
    { at: 2, text: `${city}에 도착했습니다. 즐거운 여행 되십시오.` },
  ]
}

