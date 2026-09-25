import { KEYS, isBlackKey, type KeySpec } from '../music/layout'
import type { SongNote } from '../music/song'

export const WHITE_KEYS = KEYS.filter((key) => !key.isBlack)
export const BLACK_KEYS = KEYS.filter((key) => key.isBlack)
export const WHITE_COUNT = WHITE_KEYS.length

export type KeyCamera = {
  start: number
  span: number
}

export const DEFAULT_CAMERA: KeyCamera = { start: 0, span: WHITE_COUNT }

export function clampCamera(camera: KeyCamera): KeyCamera {
  const span = Math.min(WHITE_COUNT, Math.max(8, camera.span))
  const start = Math.min(WHITE_COUNT - span, Math.max(0, camera.start))
  return { start, span }
}

export function whiteIndex(midi: number): number {
  if (!isBlackKey(midi)) {
    const index = WHITE_KEYS.findIndex((key) => key.midi === midi)
    return index < 0 ? 0 : index
  }
  const left = WHITE_KEYS.findIndex((key) => key.midi === midi - 1)
  if (left < 0) return 0
  const pc = midi % 12
  const bias = pc === 1 || pc === 6 ? -0.08 : pc === 3 || pc === 10 ? 0.08 : 0
  return left + 1 + bias
}

export function zoomCamera(camera: KeyCamera, factor: number, around = 0.5): KeyCamera {
  const current = clampCamera(camera)
  const focus = current.start + current.span * around
  return clampCamera({ start: focus - current.span * factor * around, span: current.span * factor })
}

export function panCamera(camera: KeyCamera, deltaWhites: number): KeyCamera {
  return clampCamera({ start: camera.start + deltaWhites, span: camera.span })
}

export function cameraForNotes(notes: SongNote[]): KeyCamera {
  if (notes.length === 0) return DEFAULT_CAMERA
  let min = WHITE_COUNT
  let max = 0
  for (const note of notes) {
    const index = whiteIndex(note.midi)
    min = Math.min(min, Math.floor(index))
    max = Math.max(max, Math.ceil(index))
  }
  min = Math.max(0, min - 2)
  max = Math.min(WHITE_COUNT - 1, max + 2)
  return clampCamera({ start: min, span: Math.max(10, max - min + 1) })
}

export function whiteLayout(camera: KeyCamera): Array<KeySpec & { left: number; width: number }> {
  const view = clampCamera(camera)
  const width = 100 / view.span
  const from = Math.max(0, Math.floor(view.start) - 1)
  const to = Math.min(WHITE_COUNT, Math.ceil(view.start + view.span) + 1)
  return WHITE_KEYS.slice(from, to).map((key, offset) => {
    const index = from + offset
    return { ...key, left: (index - view.start) * width, width }
  })
}

export function blackLayout(
  camera: KeyCamera,
): Array<KeySpec & { left: number; width: number }> {
  const view = clampCamera(camera)
  const whiteWidth = 100 / view.span
  const width = whiteWidth * 0.58
  const out: Array<KeySpec & { left: number; width: number }> = []
  for (const key of BLACK_KEYS) {
    const center = (whiteIndex(key.midi) - view.start) * whiteWidth
    const left = center - width / 2
    if (left + width <= -2 || left >= 102) continue
    out.push({ ...key, left, width })
  }
  return out
}

export function noteColumn(
  midi: number,
  camera: KeyCamera,
  width: number,
): { x: number; w: number } {
  const view = clampCamera(camera)
  const whiteW = width / view.span
  if (!isBlackKey(midi)) {
    const index = whiteIndex(midi)
    return { x: (index - view.start) * whiteW + whiteW * 0.1, w: whiteW * 0.8 }
  }
  const center = ((whiteIndex(midi) - view.start) / view.span) * width
  const w = whiteW * 0.52
  return { x: center - w / 2, w }
}
