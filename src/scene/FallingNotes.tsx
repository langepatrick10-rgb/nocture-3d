import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'
import { player } from '../engine/player'
import { useAppStore } from '../engine/store'
import { isBlackKey, midiToIndex } from '../music/layout'
import { firstPossiblyActive } from '../music/song'
import { GOLD_HEX, GOLD_LIT_HEX, LEFT_HEX, LEFT_LIT_HEX, RIGHT_HEX, RIGHT_LIT_HEX } from '../ui/noteColors'
import { keyWorldCount, keyWorldX, keyWorldY, keyWorldZ } from './keyWorld'

const MAX = 520
const FALL_SPEED = 0.92
const LOOKAHEAD = 3.4
const dummy = new Object3D()
const gold = new Color(GOLD_HEX)
const goldLit = new Color(GOLD_LIT_HEX)
const left = new Color(LEFT_HEX)
const leftLit = new Color(LEFT_LIT_HEX)
const right = new Color(RIGHT_HEX)
const rightLit = new Color(RIGHT_LIT_HEX)

export function FallingNotes() {
  const mesh = useRef<InstancedMesh>(null)
  const show = useAppStore((s) => s.showFallingNotes)

  useLayoutEffect(() => {
    if (mesh.current) mesh.current.count = 0
  }, [show])

  useFrame(() => {
    const inst = mesh.current
    if (!inst) return
    if (!show || keyWorldCount() < 70) {
      inst.count = 0
      inst.instanceMatrix.needsUpdate = true
      return
    }

    const t = player.getTime()
    const notes = player.getFilteredNotes()
    const mode = useAppStore.getState().colorMode
    let count = 0
    let spacing = 0.046
    const keyN = keyWorldCount()
    if (keyN > 1) {
      const dx = Math.abs(keyWorldX[keyN - 1] - keyWorldX[0])
      if (dx > 0.4) spacing = dx / Math.max(51, keyN - 1)
    }

    for (let index = firstPossiblyActive(notes, t - 0.5); index < notes.length; index++) {
      const note = notes[index]
      if (note.time + note.duration < t - 0.08) continue
      if (note.time > t + LOOKAHEAD) break
      if (count >= MAX) break
      const i = midiToIndex(note.midi)
      const x = keyWorldX[i]
      const y = keyWorldY[i]
      const z = keyWorldZ[i]
      if (x === 0 && y === 0 && z === 0) continue
      const untilHit = note.time - t
      const lift = Math.max(untilHit, 0) * FALL_SPEED
      const h = Math.max(0.08, note.duration * FALL_SPEED * 0.31)
      dummy.position.set(x, y + 0.03 + lift + h / 2, z)
      dummy.scale.set(isBlackKey(note.midi) ? spacing * 0.52 : spacing * 0.78, h, spacing * 0.42)
      dummy.updateMatrix()
      inst.setMatrixAt(count, dummy.matrix)
      const hitting = untilHit <= 0 && t < note.time + note.duration
      const restCol = mode === 'hands' ? (note.hand === 'left' ? left : right) : gold
      const litCol = mode === 'hands' ? (note.hand === 'left' ? leftLit : rightLit) : goldLit
      inst.setColorAt(count, hitting ? litCol : restCol)
      count += 1
    }
    inst.count = count
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  })

  if (!show) return null

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <boxGeometry />
      <meshStandardMaterial
        transparent
        opacity={0.98}
        roughness={0.32}
        metalness={0.08}
        emissive="#d8dde8"
        emissiveIntensity={0.18}
      />
    </instancedMesh>
  )
}
