import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  DoubleSide,
  InstancedMesh,
  Object3D,
  Vector3,
} from 'three'

const DROP_COUNT = 4000
const SPLASH_COUNT = 140
const WIDTH = 18
const DEPTH = 18
const HEIGHT = 13
const dummy = new Object3D()
const origin = new Vector3()

function streakMap() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const glow = ctx.createLinearGradient(16, 0, 16, 128)
  glow.addColorStop(0, 'rgba(186, 210, 232, 0)')
  glow.addColorStop(0.35, 'rgba(198, 220, 240, 0.12)')
  glow.addColorStop(0.78, 'rgba(220, 236, 252, 0.55)')
  glow.addColorStop(1, 'rgba(236, 246, 255, 0.9)')
  ctx.fillStyle = glow
  ctx.fillRect(13, 0, 6, 128)
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

const STREAK = streakMap()

type Drop = {
  x: number
  z: number
  y: number
  len: number
  speed: number
}

type Splash = {
  x: number
  z: number
  age: number
  life: number
}

function seedDrops(): Drop[] {
  const drops: Drop[] = []
  for (let i = 0; i < DROP_COUNT; i++) {
    drops.push({
      x: (Math.random() - 0.5) * WIDTH,
      z: (Math.random() - 0.5) * DEPTH,
      y: Math.random() * HEIGHT,
      len: 0.14 + Math.random() * 0.22,
      speed: 9 + Math.random() * 7,
    })
  }
  return drops
}

function hideInstance(mesh: InstancedMesh, index: number) {
  dummy.position.set(0, -40, 0)
  dummy.scale.set(0, 0, 0)
  dummy.updateMatrix()
  mesh.setMatrixAt(index, dummy.matrix)
}

export function StreetRain({
  x,
  y,
  z,
}: {
  x: number
  y: number
  z: number
}) {
  const rainRef = useRef<InstancedMesh>(null)
  const splashRef = useRef<InstancedMesh>(null)
  const drops = useMemo(seedDrops, [])
  const splashes = useMemo<Splash[]>(
    () => Array.from({ length: SPLASH_COUNT }, () => ({ x: 0, z: 0, age: 99, life: 0.28 })),
    [],
  )
  const splashCursor = useRef(0)

  useLayoutEffect(() => {
    const rain = rainRef.current
    const splash = splashRef.current
    if (rain) {
      for (let i = 0; i < DROP_COUNT; i++) hideInstance(rain, i)
      rain.instanceMatrix.needsUpdate = true
    }
    if (splash) {
      for (let i = 0; i < SPLASH_COUNT; i++) hideInstance(splash, i)
      splash.instanceMatrix.needsUpdate = true
    }
  }, [])

  useFrame((state, delta) => {
    const rain = rainRef.current
    const splash = splashRef.current
    if (!rain || !splash) return
    const dt = Math.min(0.05, delta)
    origin.set(state.camera.position.x * 0.62 + x * 0.38, y, state.camera.position.z * 0.62 + z * 0.38)
    const wind = 1.15 * dt

    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i]
      drop.y -= drop.speed * dt
      drop.x += wind
      if (drop.x > WIDTH * 0.5) drop.x -= WIDTH
      if (drop.y < 0.04) {
        const slot = splashes[splashCursor.current % SPLASH_COUNT]
        splashCursor.current += 1
        slot.x = origin.x + drop.x
        slot.z = origin.z + drop.z
        slot.age = 0
        slot.life = 0.18 + Math.random() * 0.16
        drop.y = HEIGHT - Math.random() * 1.4
      }
      dummy.position.set(origin.x + drop.x, origin.y + drop.y, origin.z + drop.z)
      dummy.lookAt(state.camera.position.x, dummy.position.y, state.camera.position.z)
      dummy.scale.set(1, drop.len / 0.22, 1)
      dummy.updateMatrix()
      rain.setMatrixAt(i, dummy.matrix)
    }
    rain.instanceMatrix.needsUpdate = true

    for (let i = 0; i < splashes.length; i++) {
      const ring = splashes[i]
      ring.age += dt
      if (ring.age >= ring.life) {
        hideInstance(splash, i)
        continue
      }
      const t = ring.age / ring.life
      const scale = 0.08 + t * 0.42
      dummy.position.set(ring.x, origin.y + 0.018, ring.z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.set(scale, scale, 1)
      dummy.updateMatrix()
      splash.setMatrixAt(i, dummy.matrix)
    }
    splash.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh
        ref={rainRef}
        args={[undefined, undefined, DROP_COUNT]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      >
        <planeGeometry args={[0.012, 0.24]} />
        <meshBasicMaterial
          map={STREAK ?? undefined}
          color="#c9dbeb"
          transparent
          opacity={0.46}
          depthWrite={false}
          side={DoubleSide}
          fog
        />
      </instancedMesh>
      <instancedMesh
        ref={splashRef}
        args={[undefined, undefined, SPLASH_COUNT]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      >
        <ringGeometry args={[0.04, 0.09, 10]} />
        <meshBasicMaterial color="#c5d8ea" transparent opacity={0.28} depthWrite={false} fog />
      </instancedMesh>
    </group>
  )
}
