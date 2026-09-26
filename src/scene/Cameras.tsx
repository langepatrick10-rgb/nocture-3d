import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { usePlacement } from '../engine/roomStore'
import { useAppStore } from '../engine/store'
import type { RoomCamera } from './look'
import type { RoomPlacement } from '../engine/roomFiles'

const PLAY_POS = new Vector3(0.12, 1.18, 1.72)
const PLAY_TARGET = new Vector3(0, 0.8, 0.62)
const MARBLE_PLAY_POS = new Vector3(0.32, 1.78, 3.12)
const MARBLE_PLAY_TARGET = new Vector3(0.02, 0.68, 0.18)
const ORBIT_LOCAL = new Vector3(0.04, 0.76, 0.42)
const DEFAULT_POS: [number, number, number] = [0.95, 1.48, 1.92]
const MARBLE_DEFAULT_POS: [number, number, number] = [1.35, 1.85, 2.65]
const Y_AXIS = new Vector3(0, 1, 0)
const offset = new Vector3()
const focus = new Vector3()

function toWorld(local: Vector3, placement: RoomPlacement, out: Vector3) {
  out.copy(local).multiplyScalar(placement.pianoScale)
  out.applyAxisAngle(Y_AXIS, (placement.pianoYaw * Math.PI) / 180)
  out.x += placement.pianoX
  out.y += placement.pianoY
  out.z += placement.pianoZ
}

function wrapPi(angle: number) {
  let value = angle
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}

function cameraForPlacement(placement: RoomPlacement): RoomCamera {
  const scale = placement.pianoScale
  const dist = placement.orbitDistance
  const windowDeg = Math.min(360, Math.max(20, placement.cameraWindow))
  const half = (windowDeg * Math.PI) / 360
  const aim = (placement.orbitYaw * Math.PI) / 180
  const fullSpin = windowDeg >= 359
  const polar = (Math.min(95, Math.max(15, placement.orbitPitch)) * Math.PI) / 180
  const halfY = (Math.min(140, Math.max(10, placement.cameraWindowY)) * Math.PI) / 360
  const minPolar = Math.min(1.65, Math.max(0.12, polar - halfY))
  const maxPolar = Math.min(1.72, Math.max(minPolar + 0.08, polar + halfY))
  const sinP = Math.sin(polar)
  toWorld(ORBIT_LOCAL, placement, focus)
  const target: [number, number, number] = [focus.x, focus.y, focus.z]
  return {
    position: [
      target[0] + Math.sin(aim) * sinP * dist,
      target[1] + Math.cos(polar) * dist,
      target[2] + Math.cos(aim) * sinP * dist,
    ],
    target,
    minDistance: Math.max(1.05, dist * 0.42),
    maxDistance: dist,
    minPolar,
    maxPolar,
    minAzimuth: aim - half,
    maxAzimuth: aim + half,
    fullSpin,
    orbitAim: aim,
    orbitHalf: half,
    radius: dist,
    minY: placement.pianoY + 0.38 * scale,
    maxY: placement.pianoY + Math.max(2.1, dist * 0.72),
  }
}

function clampOrbit(position: Vector3, target: Vector3, room: RoomCamera): void {
  offset.copy(position).sub(target)
  let dist = offset.length()
  if (dist < 1e-5) {
    position.copy(target).add(new Vector3(0, 0.2, room.minDistance))
    offset.copy(position).sub(target)
    dist = offset.length()
  }
  dist = Math.min(room.maxDistance, Math.max(room.minDistance, dist))
  let theta = Math.atan2(offset.x, offset.z)
  let phi = Math.acos(Math.min(1, Math.max(-1, offset.y / Math.max(dist, 1e-5))))
  if (!room.fullSpin) {
    let delta = wrapPi(theta - room.orbitAim)
    if (Math.abs(delta) > room.orbitHalf) delta = Math.sign(delta) * room.orbitHalf
    theta = room.orbitAim + delta
  }
  phi = Math.min(room.maxPolar, Math.max(room.minPolar, phi))
  const sinP = Math.sin(phi)
  offset.set(Math.sin(theta) * sinP * dist, Math.cos(phi) * dist, Math.cos(theta) * sinP * dist)
  position.copy(target).add(offset)
  position.y = Math.min(room.maxY, Math.max(room.minY, position.y))
}

function theaterPoint(elapsed: number, out: Vector3, target: Vector3, room: RoomCamera, marble: boolean): void {
  const t = elapsed * 0.16
  const reach = Math.min(room.radius, room.maxDistance) * (marble ? 0.78 : 0.72)
  const swing = room.fullSpin ? 0.9 : Math.min(room.orbitHalf * 0.85, 0.9)
  const yaw = room.orbitAim + Math.sin(t) * swing
  const midPolar = (room.minPolar + room.maxPolar) * 0.5
  const polarSwing = (room.maxPolar - room.minPolar) * 0.28
  const phi = midPolar + Math.sin(t * 0.5) * polarSwing
  const sinP = Math.sin(phi)
  out.set(
    target.x + Math.sin(yaw) * sinP * reach * 0.92,
    target.y + Math.cos(phi) * reach,
    target.z + Math.cos(yaw) * sinP * reach,
  )
  clampOrbit(out, target, room)
}

function studioTheater(elapsed: number, out: Vector3, marble: boolean): void {
  const t = elapsed * 0.16
  if (marble) {
    out.set(Math.sin(t) * 3.95, 1.78 + Math.sin(t * 0.55) * 0.25, 3.15 + Math.cos(t * 0.9) * 1.65)
    return
  }
  out.set(Math.sin(t) * 2.45, 1.2 + Math.sin(t * 0.55) * 0.18, 1.7 + Math.cos(t * 0.9) * 1.35)
}

export function Cameras() {
  const mode = useAppStore((s) => s.cameraMode)
  const marble = useAppStore((s) => s.pianoId === 'marble')
  const environmentId = useAppStore((s) => s.environmentId)
  const placement = usePlacement()
  const inRoom = Boolean(placement.url)
  const { camera } = useThree()
  const room = useMemo(() => cameraForPlacement(placement), [placement])
  const orbitTarget = useMemo(
    () => (inRoom ? new Vector3(...room.target) : ORBIT_LOCAL.clone()),
    [inRoom, room],
  )
  const look = useRef(new Vector3())
  const lookTarget = useRef(new Vector3())
  const pos = useRef(new Vector3())
  const start = marble ? MARBLE_DEFAULT_POS : DEFAULT_POS
  const far = inRoom ? 220 : 40

  useLayoutEffect(() => {
    if (inRoom) {
      camera.position.set(...room.position)
      camera.lookAt(orbitTarget)
      look.current.copy(orbitTarget)
      lookTarget.current.copy(orbitTarget)
    } else {
      camera.position.set(...start)
      camera.lookAt(ORBIT_LOCAL)
      look.current.set(0, 0.82, 0.1)
      lookTarget.current.set(0, 0.82, 0.1)
    }
  }, [camera, environmentId, marble, inRoom, room.maxDistance, placement.orbitYaw, placement.orbitPitch, start, orbitTarget, room.position])

  useFrame((state, delta) => {
    if (mode === 'orbit') return
    const damp = 1 - Math.exp(-delta * 5.2)
    if (inRoom) {
      if (mode === 'play') {
        toWorld(marble ? MARBLE_PLAY_POS : PLAY_POS, placement, pos.current)
        toWorld(marble ? MARBLE_PLAY_TARGET : PLAY_TARGET, placement, lookTarget.current)
      } else {
        theaterPoint(state.clock.elapsedTime, pos.current, orbitTarget, room, marble)
        lookTarget.current.copy(orbitTarget)
      }
      clampOrbit(pos.current, mode === 'play' ? lookTarget.current : orbitTarget, room)
    } else if (mode === 'play') {
      pos.current.copy(marble ? MARBLE_PLAY_POS : PLAY_POS)
      lookTarget.current.copy(marble ? MARBLE_PLAY_TARGET : PLAY_TARGET)
    } else {
      studioTheater(state.clock.elapsedTime, pos.current, marble)
      lookTarget.current.set(0, marble ? 0.68 : 0.74, marble ? 0.22 : 0.55)
    }
    camera.position.lerp(pos.current, damp)
    look.current.lerp(lookTarget.current, damp)
    camera.lookAt(look.current)
  })

  useFrame(() => {
    if (mode !== 'orbit' || !inRoom) return
    orbitTarget.set(...room.target)
    clampOrbit(camera.position, orbitTarget, room)
  }, -2)

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={inRoom ? room.position : start}
        fov={40}
        near={0.08}
        far={far}
      />
      <OrbitControls
        enabled={mode === 'orbit'}
        makeDefault={mode === 'orbit'}
        enablePan={!inRoom}
        enableDamping
        dampingFactor={0.08}
        minDistance={inRoom ? room.minDistance : marble ? 2.45 : 1.3}
        maxDistance={inRoom ? room.maxDistance : 9}
        minPolarAngle={inRoom ? room.minPolar : 0.22}
        maxPolarAngle={inRoom ? room.maxPolar : Math.PI / 2.12}
        minAzimuthAngle={inRoom && !room.fullSpin ? room.minAzimuth : -Infinity}
        maxAzimuthAngle={inRoom && !room.fullSpin ? room.maxAzimuth : Infinity}
        target={orbitTarget}
      />
    </>
  )
}
