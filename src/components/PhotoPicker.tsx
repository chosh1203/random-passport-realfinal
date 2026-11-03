import { Camera, ImagePlus, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { BeautyRenderer, centerCrop, faceCrop, LIP_TONES, loadFaceDetector, smoothLandmarks, type BeautySettings, type Crop, type FaceDetector, type Landmarks, type Strength } from '../lib/beauty'
import { cropToPhoto, PHOTO_H, PHOTO_W, photoStore, usePassportPhoto } from '../lib/photo'
import { Modal } from './ui'

type Mode = 'choose' | 'studio'
type Kind = 'camera' | 'image'
type FaceStatus = 'loading' | 'ready' | 'noface' | 'unavailable'

const OUT_W = PHOTO_W * 2
const OUT_H = PHOTO_H * 2
const SETTINGS_KEY = 'rp.beauty.v1'
const DEFAULT: BeautySettings = { on: true, strength: 'mid', lip: 'none' }

function readSettings(): BeautySettings {
  try {
    const v = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null')
    return v ? { ...DEFAULT, ...v } : DEFAULT
  } catch {
    return DEFAULT
  }
}
function writeSettings(s: BeautySettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** Decode a file and shrink it so it fits comfortably in a GPU texture. */
function fileToCanvas(file: File, max = 1400): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode'))
    }
    img.src = url
  })
}

/**
 * Passport photo chooser: upload a file or take one with the camera, then
 * adjust the beauty filter (face slimming, skin, T-zone, brows, lip colour).
 * The camera is only requested after the user presses the camera button.
 */
export function PhotoPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useT()
  const photo = usePassportPhoto()
  const [mode, setMode] = useState<Mode>('choose')
  const [kind, setKind] = useState<Kind>('camera')
  const [frozen, setFrozen] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [face, setFace] = useState<FaceStatus>('loading')
  const [settings, setSettingsState] = useState<BeautySettings>(readSettings)

  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stillRef = useRef<HTMLCanvasElement | null>(null)
  const lmRef = useRef<Landmarks | null>(null)
  const cropRef = useRef<Crop | undefined>(undefined)
  const detectorRef = useRef<FaceDetector | null>(null)
  const rendererRef = useRef<BeautyRenderer | null | undefined>(undefined)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const setSettings = (patch: Partial<BeautySettings>) =>
    setSettingsState((s) => {
      const next = { ...s, ...patch }
      writeSettings(next)
      return next
    })

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const reset = useCallback(() => {
    stopCamera()
    setMode('choose')
    setFrozen(false)
    setError('')
    stillRef.current = null
    lmRef.current = null
    rendererRef.current = undefined
  }, [stopCamera])

  const close = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  useEffect(() => () => stopCamera(), [stopCamera])

  /* ---------- face detector (loaded once the studio opens) ---------- */
  useEffect(() => {
    if (mode !== 'studio') return
    let alive = true
    setFace(detectorRef.current ? 'ready' : 'loading')
    loadFaceDetector()
      .then(async (d) => {
        if (!alive) return
        detectorRef.current = d
        setFace('ready')
        // a still image only needs one pass
        if (stillRef.current) {
          const lm = await d.detect(stillRef.current)
          if (!alive) return
          lmRef.current = lm
          if (lm && kind === 'image') cropRef.current = faceCrop(lm, stillRef.current.width, stillRef.current.height, OUT_W / OUT_H)
          setFace(lm ? 'ready' : 'noface')
          drawStill()
        }
      })
      .catch(() => alive && setFace('unavailable'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  /* ---------- rendering ---------- */
  const renderer = () => {
    if (rendererRef.current === undefined && canvasRef.current) rendererRef.current = BeautyRenderer.create(canvasRef.current)
    return rendererRef.current ?? null
  }

  const drawFrame = (src: HTMLVideoElement | HTMLCanvasElement, sw: number, sh: number, mirror: boolean, crop?: Crop) => {
    const r = renderer()
    if (r) {
      r.render(src, sw, sh, lmRef.current, settingsRef.current, mirror, crop)
      return
    }
    // no WebGL: plain crop
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const c = crop ?? centerCrop(sw, sh, OUT_W / OUT_H)
    ctx.save()
    if (mirror) {
      ctx.translate(OUT_W, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(src, c.x, c.y, c.w, c.h, 0, 0, OUT_W, OUT_H)
    ctx.restore()
  }

  const drawStill = () => {
    const s = stillRef.current
    if (s) drawFrame(s, s.width, s.height, kind === 'camera', kind === 'image' ? cropRef.current : undefined)
  }

  // live camera loop
  useEffect(() => {
    if (mode !== 'studio' || kind !== 'camera' || frozen) return
    const v = videoRef.current
    if (!v || !streamRef.current) return
    v.srcObject = streamRef.current
    v.play().catch(() => {})
    let raf = 0
    let busy = false
    let misses = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (v.readyState < 2 || !v.videoWidth) return
      const d = detectorRef.current
      if (d && !busy && settingsRef.current.on) {
        busy = true
        d.detect(v).then((lm) => {
          busy = false
          lmRef.current = smoothLandmarks(lmRef.current, lm)
          misses = lm ? 0 : misses + 1
          if (misses === 0) setFace('ready')
          else if (misses > 8) setFace('noface')
        })
      }
      drawFrame(v, v.videoWidth, v.videoHeight, true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, kind, frozen])

  // still image: redraw when settings change
  useEffect(() => {
    if (mode === 'studio' && (kind === 'image' || frozen)) drawStill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, mode, kind, frozen])

  /* ---------- actions ---------- */
  const save = () => {
    const c = canvasRef.current
    if (!c) return
    const ok = photoStore.set(cropToPhoto(c, c.width, c.height))
    if (!ok) {
      setError(tr('저장 공간이 부족해 이번 방문 동안만 사진이 보여요.', '保存容量が足りないため、写真はこの訪問中のみ表示されます。'))
      return
    }
    close()
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      setError(tr('이미지 파일만 올릴 수 있어요.', '画像ファイルのみアップロードできます。'))
      return
    }
    try {
      stillRef.current = await fileToCanvas(file)
      lmRef.current = null
      cropRef.current = undefined
      rendererRef.current = undefined
      setError('')
      setKind('image')
      setFrozen(false)
      setMode('studio')
    } catch {
      setError(tr('이 사진은 열 수 없어요. JPG나 PNG 사진을 골라 주세요.', 'この写真は開けません。JPGかPNGの写真を選んでください。'))
    }
  }

  const startCamera = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(tr('이 브라우저에서는 카메라를 쓸 수 없어요. 사진 업로드를 이용해 주세요.', 'このブラウザではカメラを使えません。写真アップロードをご利用ください。'))
      return
    }
    setStarting(true)
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      stillRef.current = null
      lmRef.current = null
      rendererRef.current = undefined
      setKind('camera')
      setFrozen(false)
      setMode('studio')
    } catch (err) {
      const name = (err as DOMException)?.name
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? tr('카메라 권한이 거부됐어요. 주소창의 카메라 아이콘에서 허용하거나 사진 업로드를 이용해 주세요.', 'カメラの許可が拒否されました。アドレスバーのカメラアイコンから許可するか、写真アップロードをご利用ください。')
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? tr('연결된 카메라를 찾지 못했어요. 사진 업로드를 이용해 주세요.', 'カメラが見つかりません。写真アップロードをご利用ください。')
            : tr('카메라를 켤 수 없어요. 다른 앱이 쓰고 있는지 확인해 주세요.', 'カメラを起動できません。他のアプリが使用中でないか確認してください。'),
      )
    } finally {
      setStarting(false)
    }
  }

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    stillRef.current = c
    setFrozen(true)
  }

  const retake = () => {
    stillRef.current = null
    setFrozen(false)
  }

  const back = () => {
    stopCamera()
    stillRef.current = null
    lmRef.current = null
    rendererRef.current = undefined
    setFrozen(false)
    setMode('choose')
  }

  /* ---------- UI ---------- */
  const btn = 'flex items-center justify-center gap-2 rounded-lg border-[2.5px] border-ink px-4 py-2.5 text-sm font-bold text-ink shadow-[3px_3px_0_#1c1d21] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50'
  const chip = (on: boolean) => `rounded-full border-2 border-ink px-3 py-1 text-xs font-bold transition ${on ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-yellow'}`
  const strengths: { id: Strength; label: string }[] = [
    { id: 'soft', label: tr('자연스럽게', 'ナチュラル') },
    { id: 'mid', label: tr('보통', 'ふつう') },
    { id: 'strong', label: tr('확실하게', 'しっかり') },
  ]
  const live = kind === 'camera' && !frozen
  const status =
    !settings.on
      ? tr('원본', 'オリジナル')
      : face === 'loading'
        ? tr('보정 준비 중…', '補正の準備中…')
        : face === 'noface'
          ? tr('얼굴을 찾고 있어요', '顔を探しています')
          : face === 'unavailable'
            ? tr('보정을 불러오지 못했어요', '補正を読み込めませんでした')
            : tr('보정 적용 중', '補正中')

  // portal: the passport pages are transformed (page flips), which would trap a fixed overlay
  return createPortal(
    <Modal open={open} onClose={close} labelledBy="photo-title">
      <div className="p-6 max-sm:p-4">
        <h2 id="photo-title" className="font-display text-lg font-extrabold text-ink">
          {tr('여권 사진', '旅券の写真')}
        </h2>

        {mode === 'choose' ? (
          <>
            <p className="mt-1 text-sm text-ink/70">{tr('사진을 올리거나 카메라로 바로 찍을 수 있어요. 보정은 기기 안에서만 처리되고, 사진은 이 기기에만 저장돼요.', '写真をアップロードするか、カメラで撮影できます。補正は端末内で処理され、写真はこの端末にのみ保存されます。')}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 rounded-xl border-[2.5px] border-ink bg-paper px-3 py-5 text-ink shadow-[4px_4px_0_#1c1d21] transition hover:bg-yellow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm font-bold">{tr('사진 업로드', '写真をアップロード')}</span>
                <span className="text-[11px] text-ink/60">{tr('JPG · PNG', 'JPG・PNG')}</span>
              </button>
              <button type="button" onClick={startCamera} disabled={starting} className="flex flex-col items-center gap-2 rounded-xl border-[2.5px] border-ink bg-paper px-3 py-5 text-ink shadow-[4px_4px_0_#1c1d21] transition hover:bg-yellow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60">
                <Camera className="h-8 w-8" />
                <span className="text-sm font-bold">{starting ? tr('카메라 켜는 중…', 'カメラ起動中…') : tr('카메라로 촬영', 'カメラで撮影')}</span>
                <span className="text-[11px] text-ink/60">{tr('카메라 권한을 요청해요', 'カメラの許可を求めます')}</span>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            {photo && (
              <button
                type="button"
                onClick={() => {
                  photoStore.set(null)
                  close()
                }}
                className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-red underline-offset-2 hover:underline"
              >
                <Trash2 className="h-4 w-4" />
                {tr('지금 사진 삭제', '今の写真を削除')}
              </button>
            )}
          </>
        ) : (
          <>
            {/* preview */}
            <div className="relative mx-auto mt-3 aspect-[300/386] w-[min(250px,58vw)] overflow-hidden rounded-lg border-[2.5px] border-ink bg-ink">
              <canvas ref={canvasRef} width={OUT_W} height={OUT_H} className="h-full w-full" aria-label={tr('사진 미리보기', '写真プレビュー')} />
              {live && <div className="pointer-events-none absolute left-1/2 top-[44%] h-[54%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-paper/70" aria-hidden />}
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-paper">
                {settings.on && face === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {status}
              </span>
            </div>
            <video ref={videoRef} playsInline muted className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />

            {/* filter controls */}
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-bold text-ink/70">{tr('보정', '補正')}</span>
                <button type="button" className={chip(settings.on)} onClick={() => setSettings({ on: true })} aria-pressed={settings.on}>
                  ON
                </button>
                <button type="button" className={chip(!settings.on)} onClick={() => setSettings({ on: false })} aria-pressed={!settings.on}>
                  {tr('원본', 'オリジナル')}
                </button>
              </div>
              <div className={`flex flex-wrap items-center gap-2 ${settings.on ? '' : 'pointer-events-none opacity-40'}`}>
                <span className="w-16 shrink-0 text-xs font-bold text-ink/70">{tr('강도', '強さ')}</span>
                {strengths.map((s) => (
                  <button key={s.id} type="button" className={chip(settings.strength === s.id)} onClick={() => setSettings({ strength: s.id })} aria-pressed={settings.strength === s.id}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className={`flex flex-wrap items-start gap-2 ${settings.on ? '' : 'pointer-events-none opacity-40'}`}>
                <span className="w-16 shrink-0 pt-1 text-xs font-bold leading-tight text-ink/70">{tr('립 컬러', 'リップ')}</span>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {LIP_TONES.map((t) => (
                    <button key={t.id} type="button" className={`${chip(settings.lip === t.id)} flex items-center gap-1.5`} onClick={() => setSettings({ lip: t.id })} aria-pressed={settings.lip === t.id}>
                      <span className={`h-3 w-3 rounded-full border border-ink/40 ${t.id === 'none' ? 'bg-[linear-gradient(135deg,transparent_45%,#1c1d21_45%,#1c1d21_55%,transparent_55%)]' : ''}`} style={t.id === 'none' ? undefined : { background: t.color }} />
                      {tr(t.ko, t.ja)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {live ? (
                <>
                  <button type="button" onClick={back} className={`${btn} bg-paper`}>
                    {tr('뒤로', '戻る')}
                  </button>
                  <button type="button" onClick={capture} className={`${btn} bg-yellow`}>
                    <Camera className="h-4 w-4" />
                    {tr('촬영', '撮影')}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={kind === 'camera' ? retake : back} className={`${btn} bg-paper`}>
                    <RotateCcw className="h-4 w-4" />
                    {kind === 'camera' ? tr('다시 찍기', '撮り直す') : tr('다른 사진', '別の写真')}
                  </button>
                  <button type="button" onClick={save} className={`${btn} bg-yellow`}>
                    {tr('사용하기', '使う')}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {error && <p className="mt-4 rounded-lg border-2 border-red/60 bg-red/10 px-3 py-2 text-sm font-semibold text-ink">{error}</p>}
      </div>
    </Modal>,
    document.body,
  )
}
