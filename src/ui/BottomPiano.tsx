import { useEffect, useRef } from 'react'
import { expectHand, HAND_LEFT, HAND_RIGHT, pressHand, pressSong, pressUser, expectedMask } from '../engine/live'
import { player } from '../engine/player'
import { useAppStore } from '../engine/store'
import { midiToIndex } from '../music/layout'
import { blackLayout, whiteLayout } from './keyCamera'

export function BottomPiano() {
  const keyStart = useAppStore((s) => s.keyStart)
  const keySpan = useAppStore((s) => s.keySpan)
  const tap = useAppStore((s) => s.practiceMode === 'step')
  const nodes = useRef(new Map<number, HTMLButtonElement>())

  useEffect(() => {
    let frame = 0
    const loop = () => {
      const state = useAppStore.getState()
      const hands = state.colorMode === 'hands'
      const tap = state.practiceMode === 'step'
      for (const [midi, el] of nodes.current) {
        const i = midiToIndex(midi)
        const expect = !!expectedMask[i]
        const on = !!(pressUser[i] || pressSong[i] || (tap && expect))
        const coded = pressSong[i] ? pressHand[i] : expect ? expectHand[i] : 0
        const left = hands && (on || expect) && coded === HAND_LEFT
        const right = hands && (on || expect) && coded === HAND_RIGHT
        el.classList.toggle('is-on', on && !hands)
        el.classList.toggle('is-left', !!left)
        el.classList.toggle('is-right', !!right)
        el.classList.toggle('is-expect', false)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  const camera = { start: keyStart, span: keySpan }
  const whites = whiteLayout(camera)
  const blacks = blackLayout(camera)

  return (
    <div
      className={`bottom-piano${tap ? ' is-tap' : ''}`}
      aria-label="On-screen piano"
      onWheel={(event) => {
        event.preventDefault()
        const store = useAppStore.getState()
        if (event.shiftKey) store.panKeys(event.deltaY > 0 ? 1.1 : -1.1)
        else {
          const rect = event.currentTarget.getBoundingClientRect()
          store.zoomKeys(event.deltaY > 0 ? 1.22 : 0.82, (event.clientX - rect.left) / rect.width)
        }
      }}
    >
      {whites.map((key) => (
        <button
          key={key.midi}
          type="button"
          ref={(el) => {
            if (el) nodes.current.set(key.midi, el)
            else nodes.current.delete(key.midi)
          }}
          className="strip-white"
          style={{ left: `${key.left}%`, width: `${key.width}%` }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            player.userNoteOn(key.midi)
          }}
          onPointerUp={() => player.userNoteOff(key.midi)}
          onPointerCancel={() => player.userNoteOff(key.midi)}
        >
          {key.octaveLabel ? <span>{key.octaveLabel}</span> : null}
        </button>
      ))}
      {blacks.map((key) => (
        <button
          key={key.midi}
          type="button"
          ref={(el) => {
            if (el) nodes.current.set(key.midi, el)
            else nodes.current.delete(key.midi)
          }}
          className="strip-black"
          style={{ left: `${key.left}%`, width: `${key.width}%` }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            player.userNoteOn(key.midi)
          }}
          onPointerUp={() => player.userNoteOff(key.midi)}
          onPointerCancel={() => player.userNoteOff(key.midi)}
        />
      ))}
    </div>
  )
}
