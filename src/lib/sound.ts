import { settingsStore } from './storage'

/**
 * All sounds are synthesised with the Web Audio API — no audio files to
 * load or license. Browsers only allow audio after a user gesture, so
 * `unlockAudio()` is called from the click that starts a journey.
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

function enabled() {
  return settingsStore.get().sound
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      return null
    }
    master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
  }
  return ctx
}

export function unlockAudio() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

function noise(c: AudioContext) {
  if (!noiseBuf) {
    // 2 s of brown-ish noise (integrated white noise) — a deep, rumbling base
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.035 * w) / 1.035
      d[i] = last * 3.2 + w * 0.12
    }
  }
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  return src
}

/* ---------------- Jet engine ---------------- */
export interface EngineHandle {
  /** take-off → cruise: raise pitch and volume */
  throttleUp(): void
  /** fade out (landing / skip) */
  stop(fadeSeconds?: number): void
}

const SILENT: EngineHandle = { throttleUp() {}, stop() {} }

/**
 * Taxi rumble starts quietly; `throttleUp()` swells into a take-off roar
 * that pans across the stereo field while the plane crosses the globe.
 */
export function startEngine(cruiseSeconds: number): EngineHandle {
  if (!enabled()) return SILENT
  const c = getCtx()
  if (!c || !master) return SILENT
  const t0 = c.currentTime

  const out = c.createGain()
  out.gain.setValueAtTime(0.0001, t0)
  out.gain.exponentialRampToValueAtTime(0.22, t0 + 0.9)
  const pan = c.createStereoPanner()
  pan.pan.setValueAtTime(-0.55, t0)
  out.connect(pan).connect(master)

  // 1. low rumble
  const rumbleSrc = noise(c)
  const rumbleLp = c.createBiquadFilter()
  rumbleLp.type = 'lowpass'
  rumbleLp.frequency.setValueAtTime(260, t0)
  rumbleLp.Q.value = 0.8
  const rumbleGain = c.createGain()
  rumbleGain.gain.value = 1
  rumbleSrc.connect(rumbleLp).connect(rumbleGain).connect(out)

  // 2. jet hiss / whoosh
  const hissSrc = noise(c)
  const hissBp = c.createBiquadFilter()
  hissBp.type = 'bandpass'
  hissBp.frequency.setValueAtTime(1400, t0)
  hissBp.Q.value = 0.9
  const hissGain = c.createGain()
  hissGain.gain.setValueAtTime(0.05, t0)
  hissSrc.connect(hissBp).connect(hissGain).connect(out)

  // 3. turbine whine
  const whine = c.createOscillator()
  whine.type = 'sawtooth'
  whine.frequency.setValueAtTime(70, t0)
  const whineLp = c.createBiquadFilter()
  whineLp.type = 'lowpass'
  whineLp.frequency.value = 900
  const whineGain = c.createGain()
  whineGain.gain.setValueAtTime(0.025, t0)
  const wobble = c.createOscillator()
  wobble.frequency.value = 5.5
  const wobbleDepth = c.createGain()
  wobbleDepth.gain.value = 2.5
  wobble.connect(wobbleDepth).connect(whine.frequency)
  whine.connect(whineLp).connect(whineGain).connect(out)

  const nodes = [rumbleSrc, hissSrc, whine, wobble]
  nodes.forEach((n) => n.start(t0))

  let stopped = false
  return {
    throttleUp() {
      if (stopped) return
      const t = c.currentTime
      const climb = 1.6
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t)
      out.gain.exponentialRampToValueAtTime(0.36, t + climb)
      // settle lower during cruise so cabin announcements stay audible
      out.gain.exponentialRampToValueAtTime(0.16, t + climb + 2)
      rumbleLp.frequency.setTargetAtTime(620, t, 0.6)
      hissBp.frequency.setTargetAtTime(2600, t, 0.7)
      hissGain.gain.setTargetAtTime(0.16, t, 0.6)
      whine.frequency.setTargetAtTime(150, t, 0.8)
      whineGain.gain.setTargetAtTime(0.04, t, 0.6)
      pan.pan.linearRampToValueAtTime(0.55, t + cruiseSeconds)
    },
    stop(fade = 1.4) {
      if (stopped) return
      stopped = true
      const t = c.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t)
      out.gain.exponentialRampToValueAtTime(0.0001, t + fade)
      rumbleLp.frequency.setTargetAtTime(180, t, fade / 3)
      whine.frequency.setTargetAtTime(60, t, fade / 3)
      nodes.forEach((n) => n.stop(t + fade + 0.05))
      window.setTimeout(() => pan.disconnect(), (fade + 0.2) * 1000)
    },
  }
}

/* ---------------- Short effects ---------------- */
function click(at: number, freq: number, gain: number, dur = 0.05) {
  const c = ctx!
  const src = noise(c)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = 6
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(bp).connect(g).connect(master!)
  src.start(at, Math.random() * 1.5)
  src.stop(at + dur + 0.02)
}

/** Dice rattling on a board */
export function playDice(durationSeconds = 0.9) {
  if (!enabled()) return
  const c = getCtx()
  if (!c || !master) return
  const t0 = c.currentTime
  let t = 0
  while (t < durationSeconds) {
    click(t0 + t, 1800 + Math.random() * 2400, 0.5 + Math.random() * 0.4, 0.035)
    t += 0.035 + Math.random() * 0.07 * (1 + t)
  }
  click(t0 + durationSeconds + 0.04, 900, 0.9, 0.08)
}

/** A pawn tapping onto a tile */
export function playHop() {
  if (!enabled() || !ctx || !master) return
  click(ctx.currentTime, 700 + Math.random() * 200, 0.22, 0.03)
}

/** Seat-belt style "ding–dong" + a stamp thud on arrival */
export function playArrival() {
  if (!enabled()) return
  const c = getCtx()
  if (!c || !master) return
  const t0 = c.currentTime
  ;[
    [784, 0],
    [622, 0.38],
  ].forEach(([f, d]) => {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0 + d)
    g.gain.exponentialRampToValueAtTime(0.28, t0 + d + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 1.4)
    o.connect(g).connect(master!)
    o.start(t0 + d)
    o.stop(t0 + d + 1.5)
  })
  // stamp thud
  const thud = c.createOscillator()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(140, t0 + 1.0)
  thud.frequency.exponentialRampToValueAtTime(55, t0 + 1.15)
  const tg = c.createGain()
  tg.gain.setValueAtTime(0.0001, t0 + 1.0)
  tg.gain.exponentialRampToValueAtTime(0.5, t0 + 1.005)
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2)
  thud.connect(tg).connect(master)
  thud.start(t0 + 1.0)
  thud.stop(t0 + 1.25)
  click(t0 + 1.0, 400, 0.6, 0.06)
}

/** Cabin PA "pong" before an announcement */
export function playPA() {
  if (!enabled()) return
  const c = getCtx()
  if (!c || !master) return
  const t0 = c.currentTime
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.value = 698
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9)
  o.connect(g).connect(master)
  o.start(t0)
  o.stop(t0 + 1)
}
