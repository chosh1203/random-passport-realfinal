import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Airport, ResolvedDestination } from '../data/types'
import { buildFlightCurve, latLonToVector3, slerpUnit } from '../lib/geo'
import { Earth } from './Earth'

export type FlightPhase = 'idle' | 'selecting' | 'revealed' | 'flying' | 'arrived'

export interface GlobeSceneProps {
  phase: FlightPhase
  origin: Airport
  destination: ResolvedDestination | null
  originLabel?: string
  /** Unique per journey; remounts flight state even for a repeated city */
  journeyId: string | null
  reducedMotion: boolean
  skipToken: number
  onReady?: (state: 'ready' | 'error') => void
  onArcReady?: () => void
  onProgress?: (p: number) => void
  onArrive?: () => void
}

export const FLIGHT_SECONDS = 15
const ARC_SECONDS = 2.4
const INK = '#1c1d21'
const RED = '#d4422c'
const PAPER = '#fbf6e9'
const YELLOW = '#f2b630'

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/* ------------------------------------------------------------------ */
/* Label: a printed paper tag drawn to a canvas                        */
/* ------------------------------------------------------------------ */
function makeLabelTexture(code: string, sub: string) {
  const c = document.createElement('canvas')
  const W = 512
  const H = 220
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.font = '900 66px Paperlogy, "Apple SD Gothic Neo", sans-serif'
  const codeW = g.measureText(code).width
  g.font = '600 36px Paperlogy, "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Apple SD Gothic Neo", sans-serif'
  const subW = g.measureText(sub).width
  const boxW = Math.min(W - 24, Math.max(codeW, subW) + 64)
  const x = (W - boxW) / 2
  const y = 12
  const h = 170
  // shadow
  g.fillStyle = INK
  g.beginPath()
  g.roundRect(x + 10, y + 10, boxW, h, 18)
  g.fill()
  // paper
  g.fillStyle = PAPER
  g.strokeStyle = INK
  g.lineWidth = 8
  g.beginPath()
  g.roundRect(x, y, boxW, h, 18)
  g.fill()
  g.stroke()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = INK
  g.font = '900 66px Paperlogy, "Apple SD Gothic Neo", sans-serif'
  g.fillText(code, W / 2, y + 66)
  g.fillStyle = '#4d4a41'
  g.font = '600 36px Paperlogy, "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Apple SD Gothic Neo", sans-serif'
  g.fillText(sub, W / 2, y + 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/* ------------------------------------------------------------------ */
/* Board pin marker                                                    */
/* ------------------------------------------------------------------ */
function AirportMarker({
  lat,
  lon,
  code,
  label,
  color,
  emphasis = 0,
  appear = true,
}: {
  lat: number
  lon: number
  code: string
  label: string
  color: string
  emphasis?: number
  appear?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const labelRef = useRef<THREE.Sprite>(null)
  const scaleRef = useRef(appear ? 1 : 0)
  const { camera } = useThree()
  const [fontsReady, setFontsReady] = useState(0)

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady((n) => n + 1))
  }, [])
  const labelTex = useMemo(() => {
    void fontsReady
    return makeLabelTexture(code, label)
  }, [code, label, fontsReady])
  useEffect(() => () => labelTex.dispose(), [labelTex])

  const { position, quaternion } = useMemo(() => {
    const p = latLonToVector3(lat, lon, 1.001)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize())
    return { position: p, quaternion: q }
  }, [lat, lon])
  const facingDir = useMemo(() => position.clone().normalize(), [position])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, appear ? 1 : 0, 7, dt)
    const s = scaleRef.current
    // pin "drops in" with a little overshoot feel via damping
    if (group.current) group.current.scale.setScalar(Math.max(s, 0.0001))
    if (ring.current) {
      const pulse = (t * 0.9) % 1
      ring.current.scale.setScalar(1 + pulse * (1.6 + emphasis * 1.6))
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * (0.55 + emphasis * 0.45)
    }
    if (labelRef.current) {
      tmp.copy(camera.position).normalize()
      const vis = THREE.MathUtils.clamp((facingDir.dot(tmp) - 0.15) * 5, 0, 1) * s
      ;(labelRef.current.material as THREE.SpriteMaterial).opacity = vis
    }
  })

  return (
    <group position={position} quaternion={quaternion}>
      <group ref={group}>
        {/* base washer */}
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.03, 32]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <circleGeometry args={[0.022, 32]} />
          <meshBasicMaterial color={PAPER} />
        </mesh>
        <mesh ref={ring} position={[0, 0, 0.003]}>
          <ringGeometry args={[0.03, 0.036, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {/* needle */}
        <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0028, 0.0028, 0.09, 8]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        {/* head */}
        <mesh position={[0, 0, 0.094]}>
          <sphereGeometry args={[0.022, 20, 16]} />
          <meshToonMaterial color={color} />
        </mesh>
      </group>
      <sprite ref={labelRef} position={[0, 0, 0.2]} scale={[0.3, 0.129, 1]} renderOrder={10}>
        <spriteMaterial map={labelTex} transparent opacity={0} depthWrite={false} depthTest={false} />
      </sprite>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Toy airplane                                                        */
/* ------------------------------------------------------------------ */
function AirplaneModel() {
  const body = <meshToonMaterial color={PAPER} />
  const wing = <meshToonMaterial color={RED} />
  const fin = <meshToonMaterial color={YELLOW} />
  return (
    <group scale={1.1}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.0095, 0.062, 6, 12]} />
        {body}
      </mesh>
      <mesh position={[0, 0, 0.034]}>
        <sphereGeometry args={[0.0096, 12, 10]} />
        <meshToonMaterial color={INK} />
      </mesh>
      <mesh position={[0, -0.001, 0.004]}>
        <boxGeometry args={[0.096, 0.004, 0.02]} />
        {wing}
      </mesh>
      <mesh position={[0, 0, -0.036]}>
        <boxGeometry args={[0.036, 0.003, 0.011]} />
        {wing}
      </mesh>
      <mesh position={[0, 0.012, -0.037]}>
        <boxGeometry args={[0.003, 0.022, 0.013]} />
        {fin}
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Flight: dashed route + solid red trail + plane                      */
/* ------------------------------------------------------------------ */
const trailVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const trailFragment = /* glsl */ `
  uniform float progress;
  uniform vec3 color;
  varying vec2 vUv;
  void main() {
    if (progress <= 0.0 || vUv.x > progress) discard;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

function Flight({
  origin,
  destination,
  phase,
  reducedMotion,
  skipToken,
  onArcReady,
  onProgress,
  onArrive,
}: Pick<GlobeSceneProps, 'origin' | 'phase' | 'reducedMotion' | 'skipToken' | 'onArcReady' | 'onProgress' | 'onArrive'> & { destination: ResolvedDestination }) {
  const segments = 220
  const curve = useMemo(
    () => buildFlightCurve(origin.latitude, origin.longitude, destination.airportLatitude, destination.airportLongitude, segments).curve,
    [origin, destination],
  )

  const routeLine = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(segments))
    const line = new THREE.Line(geom, new THREE.LineDashedMaterial({ color: INK, dashSize: 0.025, gapSize: 0.018 }))
    line.computeLineDistances()
    return line
  }, [curve])
  const tubeGeom = useMemo(() => new THREE.TubeGeometry(curve, segments, 0.0065, 8, false), [curve])
  const outlineGeom = useMemo(() => new THREE.TubeGeometry(curve, segments, 0.0105, 8, false), [curve])
  const trailMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { progress: { value: 0 }, color: { value: new THREE.Color(RED) } },
        vertexShader: trailVertex,
        fragmentShader: trailFragment,
      }),
    [],
  )
  const outlineMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { progress: { value: 0 }, color: { value: new THREE.Color(INK) } },
        vertexShader: trailVertex,
        fragmentShader: trailFragment,
        side: THREE.BackSide,
      }),
    [],
  )

  useEffect(
    () => () => {
      routeLine.geometry.dispose()
      tubeGeom.dispose()
      outlineGeom.dispose()
    },
    [routeLine, tubeGeom, outlineGeom],
  )

  const plane = useRef<THREE.Group>(null)
  const st = useRef({ arc: 0, t: 0, arcDone: false, arrived: false, lastEmit: -1 })

  const lastSkip = useRef(skipToken)
  useEffect(() => {
    if (skipToken !== lastSkip.current) {
      lastSkip.current = skipToken
      st.current.arc = 1
      st.current.t = 1
    }
  }, [skipToken])

  const pos = useMemo(() => new THREE.Vector3(), [])
  const tan = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.2)
    const s = st.current
    const arcDur = reducedMotion ? 0.01 : ARC_SECONDS
    const flyDur = reducedMotion ? 1.2 : FLIGHT_SECONDS

    if (phase === 'revealed' || phase === 'flying' || phase === 'arrived') {
      s.arc = Math.min(1, s.arc + dt / arcDur)
      if (s.arc >= 1 && !s.arcDone) {
        s.arcDone = true
        onArcReady?.()
      }
    }
    if (phase === 'flying') s.t = Math.min(1, s.t + dt / flyDur)
    if (phase === 'arrived') s.t = 1

    routeLine.geometry.setDrawRange(0, Math.floor(easeInOut(s.arc) * (segments + 1)))

    const eased = easeInOut(s.t)
    const prog = phase === 'flying' || phase === 'arrived' ? eased : 0
    trailMat.uniforms.progress.value = prog
    outlineMat.uniforms.progress.value = prog

    if (plane.current) {
      const visible = phase === 'flying' || phase === 'arrived'
      plane.current.visible = visible
      if (visible) {
        const u = THREE.MathUtils.clamp(eased, 0.0005, 0.9995)
        curve.getPointAt(u, pos)
        curve.getTangentAt(u, tan).normalize()
        up.copy(pos).normalize()
        right.crossVectors(up, tan).normalize()
        up.crossVectors(tan, right).normalize()
        m4.makeBasis(right, up, tan)
        plane.current.position.copy(pos).addScaledVector(up, 0.008)
        plane.current.quaternion.setFromRotationMatrix(m4)
      }
    }

    if (phase === 'flying') {
      if (Math.abs(s.t - s.lastEmit) > 0.004 || s.t === 1) {
        s.lastEmit = s.t
        onProgress?.(s.t)
      }
      if (s.t >= 1 && !s.arrived) {
        s.arrived = true
        onArrive?.()
      }
    }
  })

  return (
    <group>
      <primitive object={routeLine} />
      <mesh geometry={outlineGeom} material={outlineMat} />
      <mesh geometry={tubeGeom} material={trailMat} />
      <group ref={plane} visible={false}>
        <AirplaneModel />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Camera: auto-rotate when idle, autopilot during flight             */
/* ------------------------------------------------------------------ */
function CameraRig({ phase, origin, destination, reducedMotion }: Pick<GlobeSceneProps, 'phase' | 'origin' | 'destination' | 'reducedMotion'>) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size } = useThree()
  const interacting = useRef(false)
  const resumeTimer = useRef<number | undefined>(undefined)
  const userTookOver = useRef(false)
  const flightT = useRef(0)

  useEffect(() => {
    if (phase === 'revealed') {
      userTookOver.current = false
      flightT.current = 0
    }
  }, [phase])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const start = () => {
      interacting.current = true
      userTookOver.current = true
      window.clearTimeout(resumeTimer.current)
    }
    const end = () => {
      window.clearTimeout(resumeTimer.current)
      resumeTimer.current = window.setTimeout(() => (interacting.current = false), 3000)
    }
    c.addEventListener('start', start)
    c.addEventListener('end', end)
    return () => {
      c.removeEventListener('start', start)
      c.removeEventListener('end', end)
    }
  }, [])

  const aspect = size.width / Math.max(size.height, 1)
  // keep the whole globe (plus outline) in frame for any canvas shape
  const baseDist = Math.max(3.9, 1.22 / (Math.tan(THREE.MathUtils.degToRad(19)) * Math.min(aspect, 1)))

  const target = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const originV = useMemo(() => latLonToVector3(origin.latitude, origin.longitude).normalize(), [origin])
  const destV = useMemo(
    () => (destination ? latLonToVector3(destination.airportLatitude, destination.airportLongitude).normalize() : null),
    [destination],
  )

  useEffect(() => {
    camera.position.copy(latLonToVector3(30, 112, baseDist))
    camera.lookAt(0, 0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.2)
    const c = controls.current
    if (!c) return
    const flying = phase === 'revealed' || phase === 'flying'
    const autopilot = flying || (phase === 'arrived' && !userTookOver.current)
    c.enabled = !flying
    c.autoRotate = !reducedMotion && !interacting.current && (phase === 'idle' || phase === 'selecting')
    c.autoRotateSpeed = phase === 'selecting' ? 5 : 0.4

    if (autopilot && destV) {
      if (phase === 'flying') flightT.current = Math.min(1, flightT.current + dt / (reducedMotion ? 1.2 : FLIGHT_SECONDS))
      else if (phase === 'revealed') flightT.current = 0
      else flightT.current = 1
      const follow = phase === 'arrived' ? 1 : 0.5 + 0.5 * easeInOut(flightT.current) * 0.9
      slerpUnit(originV, destV, follow, dir).normalize()
      dir.y += 0.12
      dir.normalize()
      const dist = phase === 'arrived' ? baseDist * 0.9 : baseDist * 0.97
      target.copy(dir).multiplyScalar(dist)
      if (reducedMotion) {
        camera.position.copy(target)
      } else {
        camDir.copy(camera.position).normalize()
        const k = 1 - Math.exp(-dt * (phase === 'revealed' ? 2.2 : 1.6))
        slerpUnit(camDir, dir, k, camDir).normalize()
        const r = THREE.MathUtils.damp(camera.position.length(), dist, 2, dt)
        camera.position.copy(camDir.multiplyScalar(r))
      }
      camera.lookAt(0, 0, 0)
    }
    c.update()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.6}
      minDistance={1.6}
      maxDistance={8}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */
export default function GlobeScene(props: GlobeSceneProps) {
  const { phase, origin, destination, originLabel = '인천 출발', journeyId, reducedMotion, skipToken, onReady, onArcReady, onProgress, onArrive } = props
  const showDest = !!destination && (phase === 'revealed' || phase === 'flying' || phase === 'arrived')
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.05, far: 200, position: [0, 0, 4] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[5, 3, 4]} intensity={1.6} />
      <Earth onReady={onReady} />
      <AirportMarker lat={origin.latitude} lon={origin.longitude} code={origin.iata} label={originLabel} color={YELLOW} />
      {destination && (
        <AirportMarker
          key={'m-' + (journeyId ?? destination.id)}
          lat={destination.airportLatitude}
          lon={destination.airportLongitude}
          code={destination.iataCode}
          label={destination.cityKo.replace(/\(.*\)/, '')}
          color={RED}
          appear={showDest}
          emphasis={phase === 'arrived' ? 1 : 0}
        />
      )}
      {destination && showDest && (
        <Flight
          key={'f-' + (journeyId ?? destination.id)}
          origin={origin}
          destination={destination}
          phase={phase}
          reducedMotion={reducedMotion}
          skipToken={skipToken}
          onArcReady={onArcReady}
          onProgress={onProgress}
          onArrive={onArrive}
        />
      )}
      <CameraRig phase={phase} origin={origin} destination={destination} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
