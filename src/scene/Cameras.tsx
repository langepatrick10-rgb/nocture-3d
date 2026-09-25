import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { useAppStore } from '../engine/store'

const PLAY_POS = new Vector3(0.12, 1.18, 1.72)
const PLAY_TARGET = new Vector3(0, 0.8, 0.62)
const MARBLE_PLAY_POS = new Vector3(0.32, 1.78, 3.12)
const MARBLE_PLAY_TARGET = new Vector3(0.02, 0.68, 0.18)
const ORBIT_TARGET = new Vector3(0.04, 0.76, 0.42)
const DEFAULT_POS: [number, number, number] = [0.95, 1.48, 1.92]
const MARBLE_DEFAULT_POS: [number, number, number] = [1.35, 1.85, 2.65]

function theaterPoint(elapsed: number, out: Vector3, marble: boolean): void {
  const t = elapsed * 0.16
  if (marble) {
    out.set(
      Math.sin(t) * 3.95,
      1.78 + Math.sin(t * 0.55) * 0.25,
      3.15 + Math.cos(t * 0.9) * 1.65,
    )
    return
  }
  out.set(
    Math.sin(t) * 2.45,
    1.2 + Math.sin(t * 0.55) * 0.18,
    1.7 + Math.cos(t * 0.9) * 1.35,
  )
}

export function Cameras() {
  const mode = useAppStore((s) => s.cameraMode)
  const marble = useAppStore((s) => s.pianoId === 'marble' && !s.pianoGltfUrl)
  const { camera } = useThree()
  const look = useRef(new Vector3(0, 0.82, 0.1))
  const lookTarget = useRef(new Vector3(0, 0.82, 0.1))
  const pos = useRef(new Vector3())

  useLayoutEffect(() => {
    camera.position.set(...(marble ? MARBLE_DEFAULT_POS : DEFAULT_POS))
    camera.lookAt(ORBIT_TARGET)
  }, [camera, marble])

  useFrame((state, delta) => {
    if (mode === 'orbit') return
    const damp = 1 - Math.exp(-delta * 5.2)

    if (mode === 'play') {
      pos.current.copy(marble ? MARBLE_PLAY_POS : PLAY_POS)
      lookTarget.current.copy(marble ? MARBLE_PLAY_TARGET : PLAY_TARGET)
    } else {
      theaterPoint(state.clock.elapsedTime, pos.current, marble)
      lookTarget.current.set(0, marble ? 0.68 : 0.74, marble ? 0.22 : 0.55)
    }

    camera.position.lerp(pos.current, damp)
    look.current.lerp(lookTarget.current, damp)
    camera.lookAt(look.current)
  })

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={marble ? MARBLE_DEFAULT_POS : DEFAULT_POS}
        fov={40}
        near={0.08}
        far={40}
      />
      <OrbitControls
        enabled={mode === 'orbit'}
        makeDefault={mode === 'orbit'}
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={marble ? 2.45 : 1.3}
        maxDistance={9}
        minPolarAngle={0.22}
        maxPolarAngle={Math.PI / 2.12}
        target={ORBIT_TARGET}
      />
    </>
  )
}
