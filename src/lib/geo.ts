import * as THREE from 'three'

export const GLOBE_RADIUS = 1

/**
 * lat/lon → point on sphere. Matches three.js SphereGeometry UV layout,
 * so an equirectangular texture lines up with real coordinates.
 */
export function latLonToVector3(lat: number, lon: number, radius = GLOBE_RADIUS): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

/** Spherical linear interpolation between two unit vectors (great-circle). */
export function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number, out = new THREE.Vector3()) {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1)
  const omega = Math.acos(dot)
  if (omega < 1e-6) return out.copy(a)
  if (Math.PI - omega < 1e-4) {
    // Antipodal: rotate about any axis perpendicular to a
    const axis = new THREE.Vector3(0, 1, 0).cross(a)
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
    axis.normalize()
    return out.copy(a).applyAxisAngle(axis, Math.PI * t)
  }
  const s = Math.sin(omega)
  const wa = Math.sin((1 - t) * omega) / s
  const wb = Math.sin(t * omega) / s
  return out.set(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb)
}

/** Great-circle angle in radians */
export function angularDistance(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.acos(THREE.MathUtils.clamp(a.clone().normalize().dot(b.clone().normalize()), -1, 1))
}

/**
 * Flight arc that lifts off the surface. Altitude scales with distance so
 * long-haul routes arc higher; slerp guarantees the short great-circle path.
 */
export function buildFlightCurve(fromLat: number, fromLon: number, toLat: number, toLon: number, segments = 160) {
  const a = latLonToVector3(fromLat, fromLon).normalize()
  const b = latLonToVector3(toLat, toLon).normalize()
  const angle = angularDistance(a, b)
  const peak = 0.05 + 0.2 * (angle / Math.PI)
  const pts: THREE.Vector3[] = []
  const tmp = new THREE.Vector3()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    slerpUnit(a, b, t, tmp)
    const lift = Math.sin(Math.PI * t)
    const r = GLOBE_RADIUS * (1.004 + peak * Math.pow(lift, 0.85))
    pts.push(tmp.clone().normalize().multiplyScalar(r))
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  return { curve, angle, midpoint: slerpUnit(a, b, 0.5).normalize() }
}

