// Kept free of three.js so the main bundle doesn't pull in the 3D engine
/** Great-circle distance in km */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Rough cruise-time estimate (simulation only) */
export function estimateFlightTime(km: number, lang: 'ko' | 'ja' = 'ko') {
  const hours = km / 820 + 0.5
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60 / 5) * 5
  const mm = m.toString().padStart(2, '0')
  return lang === 'ja' ? `${h}時間${mm}分` : `${h}시간 ${mm}분`
}
