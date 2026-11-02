/**
 * Popular-with-Korean-travellers cities removed from the random draw.
 * Edit this list freely — matching is done on city name (EN/KO) and id.
 * Whole countries are never excluded; only cities.
 */
export interface ExcludedCity {
  name: string
  nameKo: string
  nameJa: string
}

export const EXCLUDED_CITIES: ExcludedCity[] = [
  { name: 'Tokyo', nameKo: '도쿄', nameJa: '東京' },
  { name: 'Osaka', nameKo: '오사카', nameJa: '大阪' },
  { name: 'Fukuoka', nameKo: '후쿠오카', nameJa: '福岡' },
  { name: 'Sapporo', nameKo: '삿포로', nameJa: '札幌' },
  { name: 'Paris', nameKo: '파리', nameJa: 'パリ' },
  { name: 'London', nameKo: '런던', nameJa: 'ロンドン' },
  { name: 'Rome', nameKo: '로마', nameJa: 'ローマ' },
  { name: 'New York', nameKo: '뉴욕', nameJa: 'ニューヨーク' },
  { name: 'Bangkok', nameKo: '방콕', nameJa: 'バンコク' },
  { name: 'Da Nang', nameKo: '다낭', nameJa: 'ダナン' },
  { name: 'Bali', nameKo: '발리', nameJa: 'バリ' },
  { name: 'Singapore', nameKo: '싱가포르', nameJa: 'シンガポール' },
  { name: 'Taipei', nameKo: '타이베이', nameJa: '台北' },
  { name: 'Hong Kong', nameKo: '홍콩', nameJa: '香港' },
]

/** Any destination carrying one of these tags is also skipped */
export const EXCLUDED_TAGS: string[] = ['mass-tourism-kr']
