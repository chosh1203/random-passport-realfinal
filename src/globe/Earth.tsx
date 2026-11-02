import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { asset } from '../components/ui'
import { GLOBE_RADIUS } from '../lib/geo'

/* --------------------------------------------------------------------------
 * Board-game globe: flat printed colours instead of a photo-real planet.
 *  - ocean: board blue with a faint lat/lon grid
 *  - land: cream card-stock, stepped by elevation (cream → olive → tan)
 *  - coastlines: ink line drawn from the water mask's edge
 *  - shadow side: printed halftone dots
 *  - silhouette: a thick ink outline (back-face shell)
 * If textures fail, the ocean + grid alone is shown — never a blank scene.
 * ------------------------------------------------------------------------ */

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  void main() {
    vUv = uv;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform sampler2D waterMap;
  uniform sampler2D bumpMap;
  uniform vec3 sunDir;
  uniform float useTex;
  uniform vec3 ocean;
  uniform vec3 landA;
  uniform vec3 landB;
  uniform vec3 landC;
  uniform vec3 ink;
  varying vec2 vUv;
  varying vec3 vNormalView;

  float gridLine(float v, float step) {
    float f = abs(fract(v / step + 0.5) - 0.5) * step;
    float w = fwidth(v) * 0.9;
    return 1.0 - smoothstep(0.0, w, f);
  }

  void main() {
    vec3 n = normalize(vNormalView);
    float ndl = dot(n, normalize(sunDir));

    float lat = (vUv.y - 0.5) * 180.0;
    float lon = (vUv.x - 0.5) * 360.0;
    float grid = max(gridLine(lat, 15.0), gridLine(lon, 15.0));
    vec3 sea = mix(ocean, vec3(1.0), grid * 0.16);

    vec3 col = sea;
    if (useTex > 0.5) {
      float water = texture2D(waterMap, vUv).r;
      float elev = texture2D(bumpMap, vUv).r;
      vec3 land = landA;
      land = mix(land, landB, step(0.22, elev));
      land = mix(land, landC, step(0.52, elev));
      float isWater = smoothstep(0.42, 0.58, water);
      col = mix(land, sea, isWater);
      // coastline ink
      float w = fwidth(water);
      float coast = 1.0 - smoothstep(0.0, max(w, 1e-4) * 1.4, abs(water - 0.5));
      col = mix(col, ink, coast * 0.9);
    }

    // two-tone toon light + printed halftone on the night side
    float shade = 1.0 - smoothstep(-0.2, 0.18, ndl);
    vec2 cell = gl_FragCoord.xy / 5.0;
    float d = length(fract(cell) - 0.5);
    float dots = 1.0 - smoothstep(0.0, 0.08, d - 0.58 * sqrt(shade));
    col *= 1.0 - 0.3 * max(dots, shade * 0.45);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export function Earth({ onReady }: { onReady?: (state: 'ready' | 'error') => void }) {
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          waterMap: { value: null },
          bumpMap: { value: null },
          sunDir: { value: new THREE.Vector3(0.75, 0.45, 0.5) },
          useTex: { value: 0 },
          ocean: { value: new THREE.Color('#3d8fd9') },
          landA: { value: new THREE.Color('#f6ecd0') },
          landB: { value: new THREE.Color('#d9d29b') },
          landC: { value: new THREE.Color('#c99f62') },
          ink: { value: new THREE.Color('#1c1d21') },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
      }),
    [],
  )

  useEffect(() => {
    let alive = true
    const loader = new THREE.TextureLoader()
    const load = (url: string) => new Promise<THREE.Texture>((res, rej) => loader.load(url, res, undefined, rej))
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
    Promise.race([Promise.all([load(asset('textures/earth-water.png')), load(asset('textures/earth-bump.png'))]), timeout])
      .then(([water, bump]) => {
        if (!alive) return
        water.anisotropy = 8
        material.uniforms.waterMap.value = water
        material.uniforms.bumpMap.value = bump
        material.uniforms.useTex.value = 1
        onReadyRef.current?.('ready')
      })
      .catch(() => alive && onReadyRef.current?.('error'))
    return () => {
      alive = false
    }
  }, [material])

  return (
    <group>
      <mesh material={material} name="earth">
        <sphereGeometry args={[GLOBE_RADIUS, 128, 96]} />
      </mesh>
      {/* ink silhouette */}
      <mesh scale={1.028}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 48]} />
        <meshBasicMaterial color="#1c1d21" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}
