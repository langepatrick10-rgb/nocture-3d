import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { expectedMask, pressSong, pressUser } from '../engine/live'
import { player } from '../engine/player'
import { useAppStore } from '../engine/store'
import { midiToIndex } from '../music/layout'
import { firstPossiblyActive } from '../music/song'
import { clampCamera, noteColumn, WHITE_COUNT, whiteLayout } from './keyCamera'
import { noteFill } from './noteColors'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function NoteScroll() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const camera = useRef({ start: 0, span: WHITE_COUNT, seconds: 5 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{
    distance: number
    start: number
    span: number
    seconds: number
  } | null>(null)
  const drag = useRef<{
    x: number
    y: number
    start: number
    time: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let width = 1
    let height = 1
    let lastDraw = performance.now()
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const store = useAppStore.getState()
      const box = wrap.getBoundingClientRect()
      const around = box.width > 0 ? (event.clientX - box.left) / box.width : 0.5
      if (event.shiftKey) {
        store.panKeys(event.deltaY > 0 ? 1.1 : -1.1)
        return
      }
      if (event.altKey) {
        store.setSecondsAhead(store.secondsAhead * (event.deltaY > 0 ? 1.1 : 0.9))
        return
      }
      store.zoomKeys(event.deltaY > 0 ? 1.22 : 0.82, around)
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    const draw = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.008, (now - lastDraw) / 1000))
      lastDraw = now
      const state = useAppStore.getState()
      const target = clampCamera({ start: state.keyStart, span: state.keySpan })
      const cam = camera.current
      const follow = 1 - Math.exp(-dt * 11)
      cam.start += (target.start - cam.start) * follow
      cam.span += (target.span - cam.span) * follow
      cam.seconds += (state.secondsAhead - cam.seconds) * follow

      const hitY = height - 8
      const pps = hitY / cam.seconds
      const t = player.getTime()
      const notes = player.getFilteredNotes()
      const view = clampCamera(cam)

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#050506'
      ctx.fillRect(0, 0, width, height)

      ctx.globalAlpha = 0.18
      for (const key of whiteLayout(view)) {
        const x = (key.left / 100) * width
        ctx.fillStyle = key.octaveLabel ? '#2a261c' : '#121212'
        ctx.fillRect(x, 0, (key.width / 100) * width, height)
      }
      ctx.globalAlpha = 1

      ctx.strokeStyle = 'rgba(214, 188, 132, 0.55)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, hitY)
      ctx.lineTo(width, hitY)
      ctx.stroke()
      ctx.fillStyle = 'rgba(214, 188, 132, 0.12)'
      ctx.fillRect(0, hitY, width, height - hitY)

      const tMin = t - 0.12
      const tMax = t + cam.seconds + 0.4
      for (let n = firstPossiblyActive(notes, tMin); n < notes.length; n++) {
        const note = notes[n]
        if (note.time + note.duration < tMin) continue
        if (note.time > tMax) break
        const col = noteColumn(note.midi, view, width)
        if (col.x + col.w < 0 || col.x > width) continue
        const i = midiToIndex(note.midi)
        const active = pressSong[i] || pressUser[i]
        const atLine = Math.abs(note.time - t) <= 0.05
        const expect = !!expectedMask[i] && atLine
        const bottom = hitY - (note.time - t) * pps
        const top = bottom - Math.max(note.duration * pps, 10)
        if (bottom < 0 || top >= hitY) continue
        const y = Math.min(bottom, hitY)
        const noteTop = Math.max(top, 0)
        const h = y - noteTop
        if (h < 2) continue
        const color = noteFill(note.hand, state.colorMode, expect || !!active)
        ctx.fillStyle = color
        ctx.globalAlpha = 1
        roundRect(ctx, col.x, noteTop, col.w, h, Math.min(8, col.w / 2))
        ctx.fill()
        if (expect && state.colorMode !== 'hands') {
          ctx.strokeStyle = '#f0e2bc'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      wrap.removeEventListener('wheel', onWheel)
    }
  }, [])

  const finishTap = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    drag.current = null
  }

  return (
    <div
      ref={wrapRef}
      className="note-scroll"
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        const state = useAppStore.getState()
        if (state.practiceMode === 'step' && (state.waiting || state.playing)) {
          void player.stepNext()
          return
        }
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (pointers.current.size === 1) {
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            start: useAppStore.getState().keyStart,
            time: player.getTime(),
            moved: false,
          }
        }
        if (pointers.current.size === 2) {
          const pts = [...pointers.current.values()]
          pinch.current = {
            distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
            start: useAppStore.getState().keyStart,
            span: useAppStore.getState().keySpan,
            seconds: useAppStore.getState().secondsAhead,
          }
          drag.current = null
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (pointers.current.size === 2 && pinch.current) {
          const pts = [...pointers.current.values()]
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
          const horiz = Math.abs(pts[0].x - pts[1].x) >= Math.abs(pts[0].y - pts[1].y)
          const scale = pinch.current.distance / Math.max(24, dist)
          if (horiz) {
            const next = clampCamera({
              start: pinch.current.start,
              span: pinch.current.span * scale,
            })
            useAppStore.getState().setKeyCamera(next.start, next.span)
          } else {
            useAppStore.getState().setSecondsAhead(pinch.current.seconds * scale)
          }
          return
        }
        const info = drag.current
        if (!info) return
        const dx = event.clientX - info.x
        const dy = event.clientY - info.y
        if (Math.hypot(dx, dy) > 8) info.moved = true
        const wrap = wrapRef.current
        if (!wrap) return
        const width = wrap.clientWidth
        const height = wrap.clientHeight
        const store = useAppStore.getState()
        const span = store.keySpan
        store.setKeyCamera(info.start - (dx / width) * span, span)
        if (!store.playing && Math.abs(dy) > Math.abs(dx)) {
          const pps = (height - 8) / store.secondsAhead
          player.seek(info.time + dy / pps)
        }
      }}
      onPointerUp={finishTap}
      onPointerCancel={finishTap}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
