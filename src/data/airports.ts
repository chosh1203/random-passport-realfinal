import type { Airport } from './types'

/**
 * Airport registry — kept separate from city content so one city can be
 * served by several airports (and several cities can share one airport).
 * Coordinates: decimal degrees, WGS84.
 */
export const ORIGIN_IATA = 'ICN'

export const AIRPORTS: Record<string, Airport> = {
  ICN: { iata: 'ICN', name: 'Incheon International Airport', nameKo: '인천국제공항', latitude: 37.4602, longitude: 126.4407, city: 'Incheon', countryCode: 'KR' },

  SKD: { iata: 'SKD', name: 'Samarkand International Airport', nameKo: '사마르칸트 국제공항', latitude: 39.7005, longitude: 66.9838, city: 'Samarkand', countryCode: 'UZ' },
  OHD: { iata: 'OHD', name: 'Ohrid St. Paul the Apostle Airport', nameKo: '오흐리드 성 바울 공항', latitude: 41.18, longitude: 20.7423, city: 'Ohrid', countryCode: 'MK' },
  KUT: { iata: 'KUT', name: 'David the Builder Kutaisi International Airport', nameKo: '쿠타이시 국제공항', latitude: 42.1767, longitude: 42.4826, city: 'Kutaisi', countryCode: 'GE' },
  OSS: { iata: 'OSS', name: 'Osh Airport', nameKo: '오시 공항', latitude: 40.609, longitude: 72.7933, city: 'Osh', countryCode: 'KG' },
  FRU: { iata: 'FRU', name: 'Manas International Airport', nameKo: '마나스 국제공항', latitude: 43.0613, longitude: 74.4776, city: 'Bishkek', countryCode: 'KG' },
  DYU: { iata: 'DYU', name: 'Dushanbe International Airport', nameKo: '두샨베 국제공항', latitude: 38.5433, longitude: 68.825, city: 'Dushanbe', countryCode: 'TJ' },
  CAI: { iata: 'CAI', name: 'Cairo International Airport', nameKo: '카이로 국제공항', latitude: 30.1219, longitude: 31.4056, city: 'Cairo', countryCode: 'EG' },
  SPX: { iata: 'SPX', name: 'Sphinx International Airport', nameKo: '스핑크스 국제공항', latitude: 30.1186, longitude: 30.8963, city: 'Giza', countryCode: 'EG' },
  SLA: { iata: 'SLA', name: 'Martín Miguel de Güemes International Airport', nameKo: '살타 국제공항', latitude: -24.856, longitude: -65.4862, city: 'Salta', countryCode: 'AR' },
  AQP: { iata: 'AQP', name: 'Rodríguez Ballón International Airport', nameKo: '아레키파 국제공항', latitude: -16.3411, longitude: -71.5831, city: 'Arequipa', countryCode: 'PE' },
  MCT: { iata: 'MCT', name: 'Muscat International Airport', nameKo: '무스카트 국제공항', latitude: 23.5933, longitude: 58.2844, city: 'Muscat', countryCode: 'OM' },
  TSR: { iata: 'TSR', name: 'Timișoara Traian Vuia International Airport', nameKo: '티미쇼아라 국제공항', latitude: 45.8099, longitude: 21.3379, city: 'Timișoara', countryCode: 'RO' },
  PDV: { iata: 'PDV', name: 'Plovdiv Airport', nameKo: '플로브디프 공항', latitude: 42.0678, longitude: 24.8508, city: 'Plovdiv', countryCode: 'BG' },
  SOF: { iata: 'SOF', name: 'Sofia Airport', nameKo: '소피아 공항', latitude: 42.6967, longitude: 23.4114, city: 'Sofia', countryCode: 'BG' },
  TIV: { iata: 'TIV', name: 'Tivat Airport', nameKo: '티바트 공항', latitude: 42.4047, longitude: 18.7233, city: 'Tivat', countryCode: 'ME' },
  TIA: { iata: 'TIA', name: 'Tirana International Airport', nameKo: '티라나 국제공항', latitude: 41.4147, longitude: 19.7206, city: 'Tirana', countryCode: 'AL' },
  LPQ: { iata: 'LPQ', name: 'Luang Prabang International Airport', nameKo: '루앙프라방 국제공항', latitude: 19.8973, longitude: 102.1608, city: 'Luang Prabang', countryCode: 'LA' },
  CMB: { iata: 'CMB', name: 'Bandaranaike International Airport', nameKo: '반다라나이케 국제공항', latitude: 7.1808, longitude: 79.8841, city: 'Colombo', countryCode: 'LK' },
  SCL: { iata: 'SCL', name: 'Arturo Merino Benítez International Airport', nameKo: '산티아고 국제공항', latitude: -33.393, longitude: -70.7858, city: 'Santiago', countryCode: 'CL' },
  OAX: { iata: 'OAX', name: 'Oaxaca International Airport', nameKo: '오악사카 국제공항', latitude: 16.9999, longitude: -96.7266, city: 'Oaxaca', countryCode: 'MX' },
  ZNZ: { iata: 'ZNZ', name: 'Abeid Amani Karume International Airport', nameKo: '잔지바르 국제공항', latitude: -6.222, longitude: 39.2249, city: 'Zanzibar', countryCode: 'TZ' },
  ESU: { iata: 'ESU', name: 'Essaouira-Mogador Airport', nameKo: '에사우이라 모가도르 공항', latitude: 31.3975, longitude: -9.6817, city: 'Essaouira', countryCode: 'MA' },
  RAK: { iata: 'RAK', name: 'Marrakesh Menara Airport', nameKo: '마라케시 메나라 공항', latitude: 31.6069, longitude: -8.0363, city: 'Marrakesh', countryCode: 'MA' },
  TOS: { iata: 'TOS', name: 'Tromsø Airport', nameKo: '트롬쇠 공항', latitude: 69.6833, longitude: 18.9189, city: 'Tromsø', countryCode: 'NO' },
  LJU: { iata: 'LJU', name: 'Ljubljana Jože Pučnik Airport', nameKo: '류블랴나 공항', latitude: 46.2237, longitude: 14.4576, city: 'Ljubljana', countryCode: 'SI' },
  EVN: { iata: 'EVN', name: 'Zvartnots International Airport', nameKo: '즈바르트노츠 국제공항', latitude: 40.1473, longitude: 44.3959, city: 'Yerevan', countryCode: 'AM' },
  HBA: { iata: 'HBA', name: 'Hobart International Airport', nameKo: '호바트 국제공항', latitude: -42.8361, longitude: 147.5103, city: 'Hobart', countryCode: 'AU' },
  ALA: { iata: 'ALA', name: 'Almaty International Airport', nameKo: '알마티 국제공항', latitude: 43.3521, longitude: 77.0405, city: 'Almaty', countryCode: 'KZ' },
  WDH: { iata: 'WDH', name: 'Hosea Kutako International Airport', nameKo: '호세아 쿠타코 국제공항', latitude: -22.4799, longitude: 17.4709, city: 'Windhoek', countryCode: 'NA' },
  SJJ: { iata: 'SJJ', name: 'Sarajevo International Airport', nameKo: '사라예보 국제공항', latitude: 43.8246, longitude: 18.3315, city: 'Sarajevo', countryCode: 'BA' },
  PEN: { iata: 'PEN', name: 'Penang International Airport', nameKo: '페낭 국제공항', latitude: 5.2971, longitude: 100.277, city: 'Penang', countryCode: 'MY' },
}

export function isValidAirport(a: Airport | undefined): a is Airport {
  return (
    !!a &&
    Number.isFinite(a.latitude) &&
    Number.isFinite(a.longitude) &&
    Math.abs(a.latitude) <= 90 &&
    Math.abs(a.longitude) <= 180
  )
}
