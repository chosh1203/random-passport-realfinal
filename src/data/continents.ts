import type { ContinentId } from './types'

export const CONTINENTS: Record<ContinentId, { ko: string; ja: string; en: string; color: string }> = {
  asia: { ko: '아시아', ja: 'アジア', en: 'Asia', color: '#2a78d6' },
  europe: { ko: '유럽', ja: 'ヨーロッパ', en: 'Europe', color: '#eb6834' },
  africa: { ko: '아프리카', ja: 'アフリカ', en: 'Africa', color: '#1baf7a' },
  'north-america': { ko: '북아메리카', ja: '北アメリカ', en: 'North America', color: '#eda100' },
  'south-america': { ko: '남아메리카', ja: '南アメリカ', en: 'South America', color: '#e87ba4' },
  oceania: { ko: '오세아니아', ja: 'オセアニア', en: 'Oceania', color: '#6250d6' },
}

export const CONTINENT_COUNT = Object.keys(CONTINENTS).length
