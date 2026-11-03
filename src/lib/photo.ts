import { useSyncExternalStore } from 'react'

/** Passport photo, kept in localStorage as a small JPEG data URL. */
const KEY = 'rp.photo.v1'
const listeners = new Set<() => void>()

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

let current: string | null = typeof window !== 'undefined' ? read() : null

export const photoStore = {
  get: () => current,
  set(dataUrl: string | null): boolean {
    try {
      if (dataUrl) window.localStorage.setItem(KEY, dataUrl)
      else window.localStorage.removeItem(KEY)
    } catch {
      // storage full or blocked: keep it for this visit only
      current = dataUrl
      listeners.forEach((l) => l())
      return false
    }
    current = dataUrl
    listeners.forEach((l) => l())
    return true
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function usePassportPhoto() {
  return useSyncExternalStore(photoStore.subscribe, photoStore.get, () => null)
}

/** Passport-ratio (7:9) centre crop, resized to 300×386 JPEG. */
export const PHOTO_W = 300
export const PHOTO_H = 386

export function cropToPhoto(source: CanvasImageSource, sw: number, sh: number, mirror = false): string {
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_W
  canvas.height = PHOTO_H
  const ctx = canvas.getContext('2d')!
  const target = PHOTO_W / PHOTO_H
  let cw = sw
  let ch = sh
  if (sw / sh > target) cw = sh * target
  else ch = sw / target
  const cx = (sw - cw) / 2
  const cy = (sh - ch) / 2
  if (mirror) {
    ctx.translate(PHOTO_W, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, cx, cy, cw, ch, 0, 0, PHOTO_W, PHOTO_H)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function fileToPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        resolve(cropToPhoto(img, img.naturalWidth, img.naturalHeight))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode'))
    }
    img.src = url
  })
}
