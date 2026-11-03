import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/**
 * Pixel-art cabin: a blurred aircraft interior, a flight-attendant sprite and
 * an RPG-style dialogue box that types out the cabin announcements. Silent.
 * Everything is drawn on low-resolution canvases and scaled up with
 * `image-rendering: pixelated`, so no image assets are needed.
 */

/* ---------------- palette ---------------- */
const C = {
  K: '#1c1d21', // outline
  H: '#3b2a20', // hair
  h: '#5a4030', // hair light
  S: '#f2c9a0', // skin
  s: '#d9a77f', // skin shade
  N: '#1b3d72', // uniform
  n: '#122b53', // uniform shade
  R: '#d4422c', // scarf
  r: '#a8301f', // scarf shade
  W: '#fbf6e9', // shirt
  Y: '#f2b630', // gold
  E: '#1c1d21', // eye
  M: '#b5483a', // mouth
  P: '#e89a8a', // cheek
} as const

/* 22 × 34 sprite. Rows 7 (eyes) and 9 (mouth) are swapped for blink / talk frames. */
const SPRITE = [
  '.......KKKKKKKK.......',
  '......KNNNNNNNNK......',
  '.....KNNNNNNNNNNK.....',
  '.....KYYYYYYYYYYK.....',
  '....KHHHHHHHHHHHHK....',
  '...KHHhSSSSSSSShHHK...',
  '...KHhSSSSSSSSSShHK...',
  '...KHSSSESSSSESSSHK...',
  '...KHSSSSSSSSSSSSHK...',
  '...KHSPSSSMMSSSPSHK...',
  '...KHHSSSSSSSSSSHHK...',
  '...KHHHKSSSSSSKHHHK...',
  '....KKK.KSSSSK.KKK....',
  '.......KRRRRRRK.......',
  '......KNRRWWRRNK......',
  '.....KNNNrWWrNNNK.....',
  '....KNNNNNWWNNNNNK....',
  '...KNNNNNNWWNNNNNNK...',
  '...KNNnNNNWWNNNnNNK...',
  '...KNNnNNYWWYNNnNNK...',
  '...KNNnNNNWWNNNnNNK...',
  '...KSKnNNNNNNNNnKSK...',
  '...KSKnNNNYYNNNnKSK...',
  '....K.KnNNNNNNNnK.K...',
  '......KnnnnnnnnnK.....',
  '......KNNNNNNNNNK.....',
  '......KNNNNNNNNNK.....',
  '.......KNNNNNNNK......',
  '.......KSSK.KSSK......',
  '.......KSSK.KSSK......',
  '.......KSSK.KSSK......',
  '.......KNNK.KNNK......',
  '......KNNNK.KNNNK.....',
  '......KKKKK.KKKKK.....',
]
const EYES_OPEN = SPRITE[7]
const EYES_CLOSED = '...KHSSSsSSSSsSSSHK...'
const MOUTH_CLOSED = SPRITE[9]
const MOUTH_OPEN = '...KHSPSSSKKSSSPSHK...'

function drawSprite(ctx: CanvasRenderingContext2D, rows: string[]) {
  ctx.clearRect(0, 0, 22, 34)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as keyof typeof C
      const col = C[ch]
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(x, y, 1, 1)
    }
  })
}

/* ---------------- cabin background (96 × 54) ---------------- */
function drawCabin(ctx: CanvasRenderingContext2D, cloudShift: number) {
  const W = 96
  const H = 54
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }
  // ceiling & walls
  r(0, 0, W, H, '#efe6cf')
  r(0, 0, W, 9, '#e3d8bc')
  r(0, 9, W, 1, '#c9bc9a')
  // overhead bins
  for (let i = 0; i < 6; i++) {
    r(2 + i * 16, 2, 14, 6, '#f6efdc')
    r(2 + i * 16, 7, 14, 1, '#b9ab88')
    r(8 + i * 16, 4, 2, 1, '#9d8f6c')
  }
  // windows with moving clouds
  for (let i = 0; i < 6; i++) {
    const wx = 4 + i * 16
    r(wx, 13, 9, 11, '#9d8f6c')
    r(wx + 1, 14, 7, 9, '#7fb6ea')
    r(wx + 1, 19, 7, 4, '#a9cff2')
    const cx = (((wx * 3 + cloudShift) % 12) + 12) % 12
    r(wx + 1 + (cx % 6), 16, 3, 1, '#ffffff')
    r(wx + (cx % 5), 17, 4, 1, '#ffffff')
  }
  r(0, 26, W, 1, '#c9bc9a')
  // floor / aisle carpet
  r(0, 40, W, 14, '#4a5d86')
  r(36, 40, 24, 14, '#3a4c74')
  for (let x = 0; x < W; x += 4) r(x, 46 + ((x / 4) % 2), 2, 1, '#5b6f99')
  // seat rows — left and right blocks, slight perspective
  const seat = (x: number, y: number, w: number, h: number) => {
    r(x, y, w, h, '#1b3d72')
    r(x, y, w, 2, '#2a5698')
    r(x + 1, y + 2, w - 2, 2, '#f6efdc') // headrest cover
    r(x, y + h - 1, w, 1, '#122b53')
  }
  for (let row = 0; row < 2; row++) {
    const y = 28 + row * 7
    const h = 12 - row * 1
    for (let i = 0; i < 3; i++) seat(2 + i * 11 - row, y, 10, h)
    for (let i = 0; i < 3; i++) seat(62 + i * 11 + row, y, 10, h)
  }
  // aisle lights
  for (let x = 38; x < 58; x += 5) r(x, 53, 2, 1, '#f2b630')
}

/* ---------------- typewriter ---------------- */
function useTypewriter(text: string, speed = 32) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (!text) return
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(id)
          return v
        }
        return v + 1
      })
    }, speed)
    return () => window.clearInterval(id)
  }, [text, speed])
  return { shown: text.slice(0, n), done: n >= text.length }
}

export function CabinScene({ text, speaker, flightNo, reduced }: { text: string; speaker: string; flightNo: string; reduced: boolean }) {
  const bgRef = useRef<HTMLCanvasElement>(null)
  const spriteRef = useRef<HTMLCanvasElement>(null)
  const { shown, done } = useTypewriter(text, reduced ? 1 : 32)
  const talking = !done

  // background: clouds drift past the windows
  useEffect(() => {
    const ctx = bgRef.current?.getContext('2d')
    if (!ctx) return
    let shift = 0
    drawCabin(ctx, shift)
    if (reduced) return
    const id = window.setInterval(() => {
      shift -= 1
      drawCabin(ctx, shift)
    }, 220)
    return () => window.clearInterval(id)
  }, [reduced])

  // sprite: blink every few seconds, mouth flaps while text is typing
  const talkingRef = useRef(talking)
  talkingRef.current = talking
  useEffect(() => {
    const ctx = spriteRef.current?.getContext('2d')
    if (!ctx) return
    let tick = 0
    const frame = () => {
      const rows = [...SPRITE]
      const blink = tick % 28 === 0 || tick % 28 === 1
      rows[7] = blink ? EYES_CLOSED : EYES_OPEN
      rows[9] = talkingRef.current && tick % 2 === 0 ? MOUTH_OPEN : MOUTH_CLOSED
      drawSprite(ctx, rows)
      tick += 1
    }
    frame()
    if (reduced) return
    const id = window.setInterval(frame, 120)
    return () => window.clearInterval(id)
  }, [reduced])

  return (
    <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl border-[2.5px] border-ink bg-[#efe6cf] shadow-[6px_6px_0_rgba(0,0,0,0.35)] max-sm:aspect-[16/8]">
      {/* blurred cabin */}
      <canvas ref={bgRef} width={96} height={54} className="absolute inset-0 h-full w-full scale-[1.06] blur-[2px] brightness-[0.97]" style={{ imageRendering: 'pixelated' }} aria-hidden />
      <div className="absolute inset-0 bg-[#1c1d21]/10" aria-hidden />

      {/* flight attendant */}
      <motion.canvas
        ref={spriteRef}
        width={22}
        height={34}
        className="absolute bottom-0 left-[4%] h-[92%] w-auto"
        style={{ imageRendering: 'pixelated', aspectRatio: '22 / 34' }}
        animate={reduced ? undefined : { y: [0, -2, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      {/* dialogue box */}
      <div className="absolute bottom-[7%] left-[30%] right-[3%] max-sm:left-[33%]">
        <div className="relative rounded-[3px] border-[3px] border-ink bg-board p-[3px] shadow-[0_0_0_3px_#fbf6e9,0_0_0_6px_#1c1d21]">
          <div className="absolute -top-[15px] left-3 rounded-[2px] border-[3px] border-ink bg-yellow px-2 py-[1px] text-[11px] font-bold text-ink max-sm:text-[10px]">
            {speaker} · {flightNo}
          </div>
          <div className="min-h-[3.6em] rounded-[2px] border-2 border-paper/60 px-3 pb-2 pt-3 text-[clamp(12px,1.25vw,15px)] font-semibold leading-[1.55] text-paper max-sm:min-h-[4.2em] max-sm:px-2 max-sm:text-[12px]" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                {shown}
              </motion.span>
            </AnimatePresence>
            {done && (
              <motion.span className="ml-1 inline-block text-yellow" animate={reduced ? undefined : { y: [0, 2, 0] }} transition={{ duration: 0.8, repeat: Infinity }} aria-hidden>
                ▼
              </motion.span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
