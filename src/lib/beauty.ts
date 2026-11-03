/**
 * Beauty filter for the passport photo.
 *
 * 1. MediaPipe Face Mesh (self-hosted in public/mediapipe, Apache-2.0) finds
 *    468 face landmarks — runs on-device, nothing is uploaded.
 * 2. Small mask canvases are drawn from the landmarks: skin, lips, brows,
 *    eyes, T-zone highlight and jaw contour.
 * 3. A WebGL shader narrows the lower face as one smooth field (no dents),
 *    soft-focuses and brightens skin, lifts the T-zone, sheer-tints the
 *    lips in the chosen personal-colour shade and deepens the brows.
 */

export type Pt = { x: number; y: number }
export type Landmarks = Pt[]

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */

export type Strength = 'soft' | 'mid' | 'strong'
export type LipTone = 'none' | 'spring' | 'summer' | 'autumn' | 'winter'

export interface BeautySettings {
  on: boolean
  strength: Strength
  lip: LipTone
}

export const LIP_TONES: { id: LipTone; ko: string; ja: string; color: string }[] = [
  { id: 'none', ko: '없음', ja: 'なし', color: 'transparent' },
  { id: 'spring', ko: '봄 웜 · 코랄', ja: 'イエベ春・コーラル', color: '#ee6b57' },
  { id: 'summer', ko: '여름 쿨 · 로즈', ja: 'ブルベ夏・ローズ', color: '#d65f80' },
  { id: 'autumn', ko: '가을 웜 · 브릭', ja: 'イエベ秋・ブリック', color: '#b4503a' },
  { id: 'winter', ko: '겨울 쿨 · 체리', ja: 'ブルベ冬・チェリー', color: '#b3203e' },
]

const STRENGTH: Record<Strength, number> = { soft: 0.5, mid: 0.8, strong: 1.05 }
/** fraction the lower face is narrowed by */
const SLIM_AMOUNT: Record<Strength, number> = { soft: 0.03, mid: 0.055, strong: 0.08 }

/* ------------------------------------------------------------------ */
/* face mesh loader                                                    */
/* ------------------------------------------------------------------ */

type FaceMeshResults = { multiFaceLandmarks?: { x: number; y: number }[][] }
interface FaceMeshInstance {
  setOptions(o: Record<string, unknown>): void
  onResults(cb: (r: FaceMeshResults) => void): void
  initialize(): Promise<void>
  send(input: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>
  close(): Promise<void>
}
declare global {
  interface Window {
    FaceMesh?: new (cfg: { locateFile: (f: string) => string }) => FaceMeshInstance
  }
}

export interface FaceDetector {
  detect(src: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<Landmarks | null>
}

let detectorPromise: Promise<FaceDetector> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.src = src
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('script'))
    document.head.appendChild(s)
  })
}

export function loadFaceDetector(): Promise<FaceDetector> {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    const base = new URL(`${import.meta.env.BASE_URL}mediapipe/face_mesh/`, window.location.href).href
    await loadScript(base + 'face_mesh.js')
    if (!window.FaceMesh) throw new Error('facemesh')
    const fm = new window.FaceMesh({ locateFile: (f) => base + f })
    fm.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5, selfieMode: false })
    let resolveNext: ((l: Landmarks | null) => void) | null = null
    fm.onResults((r) => {
      const lm = r.multiFaceLandmarks?.[0]
      resolveNext?.(lm ? lm.map((p) => ({ x: p.x, y: p.y })) : null)
      resolveNext = null
    })
    await fm.initialize()
    let queue = Promise.resolve<Landmarks | null>(null)
    return {
      detect(src) {
        queue = queue.then(
          () =>
            new Promise<Landmarks | null>((resolve) => {
              resolveNext = resolve
              fm.send({ image: src }).catch(() => resolve(null))
            }),
        )
        return queue
      },
    }
  })()
  detectorPromise.catch(() => {
    detectorPromise = null
  })
  return detectorPromise
}

/* ------------------------------------------------------------------ */
/* landmark indices (MediaPipe face mesh topology)                     */
/* ------------------------------------------------------------------ */

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
const BROW_L = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
const BROW_R = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
const EYE_L = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
const EYE_R = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
const T_ZONE = [151, 9, 8, 168, 6, 197, 195, 5]

/* ------------------------------------------------------------------ */
/* masks                                                               */
/* ------------------------------------------------------------------ */

const MW = 120
const MH = 154

function maskCanvas() {
  const c = document.createElement('canvas')
  c.width = MW
  c.height = MH
  return c.getContext('2d', { willReadFrequently: true })!
}

/* ------------------------------------------------------------------ */
/* shader                                                              */
/* ------------------------------------------------------------------ */

const VS = `
attribute vec2 a;
varying vec2 vUv;
void main(){ vUv = vec2(a.x*0.5+0.5, 0.5-a.y*0.5); gl_Position = vec4(a,0.0,1.0); }`

const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uMaskA;   // r skin, g lips, b brows
uniform sampler2D uMaskB;   // r eyes, g t-zone, b contour
uniform vec4 uCrop;         // source uv rect (x, y, w, h)
uniform float uMirror;
uniform vec2 uRes;          // output px
uniform float uFace;        // 1 when a face was found and filter is on
uniform float uK;           // strength
uniform float uFaceW;       // face width in output px
uniform vec2 uAxisO;        // eye-line centre (output px)
uniform vec2 uAxisD;        // unit vector down the face
uniform float uFaceH;       // eye line → chin, px
uniform float uSlim;        // lower-face narrowing amount
uniform vec3 uLip;
uniform float uLipOn;

vec2 toSrc(vec2 uv){
  uv = clamp(uv, 0.0, 1.0);
  if (uMirror > 0.5) uv.x = 1.0 - uv.x;
  return uCrop.xy + uv * uCrop.zw;
}
vec3 src(vec2 uv){ return texture2D(uSrc, toSrc(uv)).rgb; }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

vec4 blurMask(sampler2D m, vec2 uv){
  vec2 t = vec2(1.0/${MW}.0, 1.0/${MH}.0) * 1.5;
  vec4 s = texture2D(m, uv) * 0.2;
  s += texture2D(m, uv + vec2(t.x, 0.0)) * 0.1;
  s += texture2D(m, uv - vec2(t.x, 0.0)) * 0.1;
  s += texture2D(m, uv + vec2(0.0, t.y)) * 0.1;
  s += texture2D(m, uv - vec2(0.0, t.y)) * 0.1;
  s += texture2D(m, uv + t) * 0.1;
  s += texture2D(m, uv - t) * 0.1;
  s += texture2D(m, uv + vec2(t.x, -t.y)) * 0.1;
  s += texture2D(m, uv + vec2(-t.x, t.y)) * 0.1;
  return s;
}

vec3 softLight(vec3 b, vec3 l){
  vec3 lo = 2.0*b*l + b*b*(1.0 - 2.0*l);
  vec3 hi = sqrt(b)*(2.0*l - 1.0) + 2.0*b*(1.0 - l);
  return mix(lo, hi, step(0.5, l));
}

void main(){
  vec2 uv = vUv;
  if (uFace < 0.5) { gl_FragColor = vec4(src(uv), 1.0); return; }

  // ---- face slimming: narrow the whole lower face smoothly toward its centre line
  // (one continuous field, so the contour moves in as a whole — no dents)
  vec2 p = uv * uRes;
  vec2 N = vec2(-uAxisD.y, uAxisD.x);
  vec2 d = p - uAxisO;
  float v = dot(d, uAxisD) / uFaceH;      // 0 at the eyes, 1 at the chin
  float u = dot(d, N);
  float au = abs(u);
  float R = uFaceW * 0.5;
  float wy = smoothstep(-0.15, 0.75, v) * (1.0 - smoothstep(1.1, 1.6, v));
  float h = au * (1.0 - smoothstep(R, R * 2.0, au));
  vec2 off = N * sign(u) * uSlim * wy * h;
  // chin: a slight lift for a softer V-line
  float chinW = exp(-(u * u) / (2.0 * pow(uFaceW * 0.22, 2.0)));
  off += uAxisD * uSlim * 0.35 * uFaceH * smoothstep(0.6, 1.0, v) * (1.0 - smoothstep(1.05, 1.5, v)) * chinW;
  vec2 wuv = (p + off) / uRes;

  vec4 ma = blurMask(uMaskA, wuv);
  vec4 mb = blurMask(uMaskB, wuv);
  float skin = clamp(ma.r - ma.g * 1.2 - ma.b - mb.r * 1.2, 0.0, 1.0);
  float k = uK;

  vec3 orig = src(wuv);
  vec3 c = orig;

  // ---- skin: edge-preserving soft focus, keeping a little fine texture
  vec2 r = vec2(uFaceW * 0.016) / uRes;
  vec3 acc = c; float wsum = 1.0;
  vec3 near = c; float nsum = 1.0;
  for (int i = 0; i < 16; i++) {
    float ang = float(i) * 0.3927 + (mod(float(i), 2.0) * 0.2);
    float rad = (i < 8) ? 0.5 : 1.0;
    vec3 sm = src(wuv + vec2(cos(ang), sin(ang)) * r * rad * (1.0 + mod(float(i), 3.0) * 0.5));
    vec3 dc = sm - c;
    float w = exp(-dot(dc, dc) * 55.0);
    acc += sm * w; wsum += w;
    if (i < 8) { near += sm; nsum += 1.0; }
  }
  vec3 smoothC = acc / wsum;
  vec3 detail = c - near / nsum;
  vec3 skinC = smoothC + detail * 0.35;
  c = mix(c, skinC, skin * min(0.55 + 0.25 * k, 0.85));

  // ---- brightening: luminous, slightly rosy skin (screen-like lift, keeps colour)
  float l0 = luma(c);
  float lift = skin * (0.10 + 0.12 * k) + 0.03 * k;
  float l1 = 1.0 - (1.0 - l0) * (1.0 - lift);
  c = clamp(c + (l1 - l0), 0.0, 1.0);
  c = mix(c, c * vec3(1.025, 0.99, 1.0), skin * 0.6);
  // gentle contrast softening on skin = the "glow"
  c = mix(c, mix(vec3(luma(c)), c, 1.05) * 0.94 + 0.06, skin * 0.35 * k);

  // ---- T-zone: soft highlight only
  c = c + (1.0 - c) * mb.g * ma.r * 0.09 * k;

  // ---- brows: deepen existing hairs, natural brown
  float lc = luma(c);
  float hair = smoothstep(0.015, 0.12, luma(smoothC) - lc + 0.04);
  float br = ma.b * (0.3 + 0.7 * hair);
  c = c * mix(vec3(1.0), vec3(0.70, 0.62, 0.56), br * 0.7 * min(k, 1.0));

  // ---- lips: sheer tint (soft-light), keeps natural texture and shine
  float lp = ma.g * uLipOn;
  vec3 tinted = softLight(c, uLip);
  tinted = mix(tinted, tinted * (uLip / max(luma(uLip), 0.2)) * luma(tinted), 0.15);
  c = mix(c, clamp(tinted, 0.0, 1.0), lp * 0.62);

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/* ------------------------------------------------------------------ */
/* framing                                                             */
/* ------------------------------------------------------------------ */

export type Crop = { x: number; y: number; w: number; h: number }

export function centerCrop(sw: number, sh: number, target: number): Crop {
  let w = sw
  let h = sh
  if (sw / sh > target) w = sh * target
  else h = sw / target
  return { x: (sw - w) / 2, y: (sh - h) / 2, w, h }
}

/** Passport framing around the face: head ≈ 60 % of the height, a little space above. */
export function faceCrop(lm: Landmarks, sw: number, sh: number, target: number): Crop {
  let x0 = Infinity
  let x1 = -Infinity
  for (const i of FACE_OVAL) {
    x0 = Math.min(x0, lm[i].x * sw)
    x1 = Math.max(x1, lm[i].x * sw)
  }
  const top = lm[10].y * sh
  const chin = lm[152].y * sh
  const fh = chin - top
  const crown = top - fh * 0.3
  let h = (chin - crown) / 0.6
  let w = h * target
  // never crop larger than the photo
  const fit = Math.min(1, sw / w, sh / h)
  w *= fit
  h *= fit
  const cxm = (x0 + x1) / 2
  let x = cxm - w / 2
  let y = crown - h * 0.13
  x = Math.max(0, Math.min(sw - w, x))
  y = Math.max(0, Math.min(sh - h, y))
  return { x, y, w, h }
}

/* ------------------------------------------------------------------ */
/* renderer                                                            */
/* ------------------------------------------------------------------ */

export class BeautyRenderer {
  readonly canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private prog: WebGLProgram
  private tex: { src: WebGLTexture; a: WebGLTexture; b: WebGLTexture }
  private u: Record<string, WebGLUniformLocation | null> = {}
  private m = { face: maskCanvas(), lips: maskCanvas(), brows: maskCanvas(), eyes: maskCanvas(), tz: maskCanvas(), ct: maskCanvas() }
  private imgA = new ImageData(MW, MH)
  private imgB = new ImageData(MW, MH)

  static create(canvas: HTMLCanvasElement): BeautyRenderer | null {
    try {
      return new BeautyRenderer(canvas)
    } catch {
      return null
    }
  }

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false })
    if (!gl) throw new Error('webgl')
    this.gl = gl
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link')
    this.prog = prog
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const mk = () => {
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      return t
    }
    this.tex = { src: mk(), a: mk(), b: mk() }
    for (const n of ['uSrc', 'uMaskA', 'uMaskB', 'uCrop', 'uMirror', 'uRes', 'uFace', 'uK', 'uFaceW', 'uAxisO', 'uAxisD', 'uFaceH', 'uSlim', 'uLip', 'uLipOn']) {
      this.u[n] = gl.getUniformLocation(prog, n)
    }
    gl.uniform1i(this.u.uSrc, 0)
    gl.uniform1i(this.u.uMaskA, 1)
    gl.uniform1i(this.u.uMaskB, 2)
  }

  /**
   * Render `source` (centre-cropped to the canvas aspect) with the filter.
   * `lm` are MediaPipe landmarks normalised to the *source* frame.
   */
  render(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, sw: number, sh: number, lm: Landmarks | null, s: BeautySettings, mirror: boolean, crop?: Crop) {
    const gl = this.gl
    const W = this.canvas.width
    const H = this.canvas.height
    gl.viewport(0, 0, W, H)
    gl.useProgram(this.prog)

    const { x: cx, y: cy, w: cw, h: ch } = crop ?? centerCrop(sw, sh, W / H)
    gl.uniform4f(this.u.uCrop, cx / sw, cy / sh, cw / sw, ch / sh)
    gl.uniform1f(this.u.uMirror, mirror ? 1 : 0)
    gl.uniform2f(this.u.uRes, W, H)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex.src)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source)

    const active = s.on && !!lm
    gl.uniform1f(this.u.uFace, active ? 1 : 0)
    if (active && lm) {
      // landmarks → output pixel space
      const P = lm.map((p) => {
        let x = (p.x * sw - cx) / cw
        if (mirror) x = 1 - x
        return { x: x * W, y: ((p.y * sh - cy) / ch) * H }
      })
      const fw = Math.hypot(P[454].x - P[234].x, P[454].y - P[234].y)
      const k = STRENGTH[s.strength]
      gl.uniform1f(this.u.uK, k)
      gl.uniform1f(this.u.uFaceW, fw)

      // slimming axis: from the eye line down through the chin
      const eyeC = { x: (P[33].x + P[263].x) / 2, y: (P[33].y + P[263].y) / 2 }
      const chin = P[152]
      const ax = { x: chin.x - eyeC.x, y: chin.y - eyeC.y }
      const fh = Math.hypot(ax.x, ax.y) || 1
      gl.uniform2f(this.u.uAxisO, eyeC.x, eyeC.y)
      gl.uniform2f(this.u.uAxisD, ax.x / fh, ax.y / fh)
      gl.uniform1f(this.u.uFaceH, fh)
      gl.uniform1f(this.u.uSlim, SLIM_AMOUNT[s.strength])

      const lip = LIP_TONES.find((t) => t.id === s.lip)
      gl.uniform1f(this.u.uLipOn, s.lip === 'none' ? 0 : 1)
      gl.uniform3fv(this.u.uLip, hexToRgb(lip && lip.id !== 'none' ? lip.color : '#000000'))

      this.drawMasks(P, W, H, fw)
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private drawMasks(P: Pt[], W: number, H: number, fw: number) {
    const sx = MW / W
    const sy = MH / H
    const poly = (ctx: CanvasRenderingContext2D, idx: number[]) => {
      ctx.beginPath()
      idx.forEach((i, j) => (j ? ctx.lineTo(P[i].x * sx, P[i].y * sy) : ctx.moveTo(P[i].x * sx, P[i].y * sy)))
      ctx.closePath()
    }
    const line = (ctx: CanvasRenderingContext2D, idx: number[], width: number) => {
      ctx.beginPath()
      idx.forEach((i, j) => (j ? ctx.lineTo(P[i].x * sx, P[i].y * sy) : ctx.moveTo(P[i].x * sx, P[i].y * sy)))
      ctx.lineWidth = width * sx
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    const { face, lips, brows, eyes, tz, ct } = this.m
    for (const c of [face, lips, brows, eyes, tz, ct]) {
      c.globalCompositeOperation = 'source-over'
      c.clearRect(0, 0, MW, MH)
      c.fillStyle = '#fff'
      c.strokeStyle = '#fff'
    }
    poly(face, FACE_OVAL)
    face.fill()

    poly(lips, LIPS_OUTER)
    lips.fill()
    lips.globalCompositeOperation = 'destination-out'
    poly(lips, LIPS_INNER)
    lips.fill()

    poly(brows, BROW_L)
    brows.fill()
    poly(brows, BROW_R)
    brows.fill()

    poly(eyes, EYE_L)
    eyes.fill()
    poly(eyes, EYE_R)
    eyes.fill()
    line(eyes, [...EYE_L, EYE_L[0]], fw * 0.03)
    line(eyes, [...EYE_R, EYE_R[0]], fw * 0.03)

    tz.globalAlpha = 0.9
    line(tz, T_ZONE, fw * 0.075)
    tz.beginPath()
    tz.ellipse(P[151].x * sx, P[151].y * sy, fw * 0.13 * sx, fw * 0.07 * sy, 0, 0, Math.PI * 2)
    tz.fill()
    tz.globalAlpha = 0.5
    tz.beginPath()
    tz.ellipse(P[175].x * sx, P[175].y * sy, fw * 0.05 * sx, fw * 0.03 * sy, 0, 0, Math.PI * 2)
    tz.fill()
    tz.globalAlpha = 1


    const a = this.imgA.data
    const b = this.imgB.data
    const df = face.getImageData(0, 0, MW, MH).data
    const dl = lips.getImageData(0, 0, MW, MH).data
    const db = brows.getImageData(0, 0, MW, MH).data
    const de = eyes.getImageData(0, 0, MW, MH).data
    const dt = tz.getImageData(0, 0, MW, MH).data
    const dc = ct.getImageData(0, 0, MW, MH).data
    for (let i = 0; i < a.length; i += 4) {
      a[i] = df[i + 3]
      a[i + 1] = dl[i + 3]
      a[i + 2] = db[i + 3]
      a[i + 3] = 255
      b[i] = de[i + 3]
      b[i + 1] = dt[i + 3]
      b[i + 2] = dc[i + 3]
      b[i + 3] = 255
    }
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.tex.a)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.imgA)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.tex.b)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.imgB)
    gl.activeTexture(gl.TEXTURE0)
  }
}

/** Exponential smoothing so landmarks don't jitter frame to frame. */
export function smoothLandmarks(prev: Landmarks | null, next: Landmarks | null, a = 0.55): Landmarks | null {
  if (!next) return null
  if (!prev || prev.length !== next.length) return next
  return next.map((p, i) => ({ x: prev[i].x + (p.x - prev[i].x) * a, y: prev[i].y + (p.y - prev[i].y) * a }))
}
