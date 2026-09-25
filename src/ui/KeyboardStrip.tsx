import { useEffect, useState } from 'react'
import { expectedMask, pressSong, pressUser } from '../engine/live'
import { player } from '../engine/player'
import { KEYS, midiToIndex } from '../music/layout'

const whites = KEYS.filter((key) => !key.isBlack)
const blacks = KEYS.filter((key) => key.isBlack)
const firstWhiteX = whites[0]?.x ?? 0
const lastWhiteX = whites[whites.length - 1]?.x ?? 1
const span = lastWhiteX - firstWhiteX || 1

export function KeyboardStrip() {
  const [, setTick] = useState(0)

  useEffect(() => {
    let frame = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last > 40) {
        last = t
        setTick((n) => n + 1)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="strip" aria-label="On-screen piano">
      {whites.map((key) => {
        const i = midiToIndex(key.midi)
        const on = pressUser[i] || pressSong[i]
        const expect = expectedMask[i]
        const left = ((key.x - firstWhiteX) / span) * 100
        const width = (100 / whites.length) * 0.98
        return (
          <button
            key={key.midi}
            type="button"
            className={`strip-white${on ? ' is-on' : ''}${expect ? ' is-expect' : ''}`}
            style={{ left: `${left}%`, width: `${width}%` }}
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
        )
      })}
      {blacks.map((key) => {
        const i = midiToIndex(key.midi)
        const on = pressUser[i] || pressSong[i]
        const expect = expectedMask[i]
        const left = ((key.x - firstWhiteX) / span) * 100
        return (
          <button
            key={key.midi}
            type="button"
            className={`strip-black${on ? ' is-on' : ''}${expect ? ' is-expect' : ''}`}
            style={{ left: `${left}%` }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              player.userNoteOn(key.midi)
            }}
            onPointerUp={() => player.userNoteOff(key.midi)}
            onPointerCancel={() => player.userNoteOff(key.midi)}
          />
        )
      })}
    </div>
  )
}
