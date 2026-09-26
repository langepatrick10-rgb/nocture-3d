import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  Box3,
  Light,
  Object3D,
  Vector3,
  type Camera,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type SpotLight,
} from 'three'
import { usePlacement, useRoomStore } from '../engine/roomStore'
import { useAppStore } from '../engine/store'
import { getRoomMood, isFlashlightHall } from './roomMood'

function fitScene(root: Object3D) {
  const box = new Box3().setFromObject(root)
  if (box.isEmpty()) return
  const size = box.getSize(new Vector3())
  const longest = Math.max(size.x, size.y, size.z)
  let scale = 1
  if (longest > 200) scale = 0.001
  const scaled = longest * scale
  if (scaled > 60) scale *= 24 / scaled
  else if (scaled < 3.5) scale *= 12 / Math.max(scaled, 0.01)
  root.scale.setScalar(scale)
  box.setFromObject(root)
  const center = box.getCenter(new Vector3())
  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y -= box.min.y
}

function stripCamerasAndLights(root: Object3D) {
  const remove: Object3D[] = []
  root.traverse((obj) => {
    if ((obj as Camera).isCamera || obj instanceof Light) remove.push(obj)
  })
  for (const obj of remove) obj.removeFromParent()
}

function dimMaterial(mat: Material, factor: number) {
  const next = mat.clone()
  const colored = next as MeshStandardMaterial & MeshBasicMaterial
  if (colored.color) colored.color.multiplyScalar(factor)
  if (colored.emissive) colored.emissive.multiplyScalar(factor)
  if ('envMapIntensity' in colored && typeof colored.envMapIntensity === 'number') {
    colored.envMapIntensity *= factor
  }
  return next
}

function applyMood(root: Object3D, url: string) {
  const mood = getRoomMood(url)
  const cloned: Material[] = []
  const remap = new Map<Material, Material>()
  const size = new Vector3()
  const box = new Box3()
  root.updateMatrixWorld(true)

  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    mesh.frustumCulled = false
    mesh.receiveShadow = true
    if (mood.sceneCastShadow) {
      box.setFromObject(mesh)
      box.getSize(size)
      const longest = Math.max(size.x, size.y, size.z)
      mesh.castShadow = longest > 0.35 && longest < 12
    } else {
      mesh.castShadow = false
    }
    if (mood.dimUnlit == null) return
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const next = source.map((mat) => {
      let copy = remap.get(mat)
      if (!copy) {
        copy = dimMaterial(mat, mood.dimUnlit as number)
        remap.set(mat, copy)
        cloned.push(copy)
      }
      return copy
    })
    mesh.material = next.length === 1 ? next[0] : next
  })

  return () => {
    for (const mat of cloned) mat.dispose()
  }
}

const aimWorld = new Vector3()
const fromWorld = new Vector3()
const Y_AXIS = new Vector3(0, 1, 0)
const LIGHT_AIM_LOCAL = new Vector3(0.04, 0.76, 0.42)

function pianoOrbitPoint(
  placement: { pianoX: number; pianoY: number; pianoZ: number; pianoYaw: number; pianoScale: number },
  out: Vector3,
) {
  out.copy(LIGHT_AIM_LOCAL).multiplyScalar(placement.pianoScale)
  out.applyAxisAngle(Y_AXIS, (placement.pianoYaw * Math.PI) / 180)
  out.x += placement.pianoX
  out.y += placement.pianoY
  out.z += placement.pianoZ
}

export function SceneRoom({ url }: { url: string }) {
  const gltf = useGLTF(url)
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const placement = usePlacement()
  const flashlight = isFlashlightHall(url)
  const flashlightOn = useAppStore((s) => s.flashlightOn)
  const spotRef = useRef<SpotLight>(null)
  const targetRef = useRef<Object3D>(null)

  useLayoutEffect(() => {
    stripCamerasAndLights(root)
    fitScene(root)
    const disposeMood = applyMood(root, url)
    useRoomStore.getState().setSceneHasLights(flashlight)
    return () => {
      disposeMood()
      useRoomStore.getState().setSceneHasLights(false)
    }
  }, [root, url, flashlight])

  useLayoutEffect(() => {
    const spot = spotRef.current
    const target = targetRef.current
    if (!spot || !target) return
    pianoOrbitPoint(placement, aimWorld)
    const dist = placement.orbitDistance
    const yaw = (placement.orbitYaw * Math.PI) / 180
    const polar = (placement.orbitPitch * Math.PI) / 180
    const sinP = Math.sin(polar)
    fromWorld.set(
      aimWorld.x + Math.sin(yaw) * sinP * dist,
      aimWorld.y + Math.cos(polar) * dist,
      aimWorld.z + Math.cos(yaw) * sinP * dist,
    )
    spot.position.copy(fromWorld)
    target.position.copy(aimWorld)
    spot.target = target
    target.updateMatrixWorld()
  }, [
    flashlight,
    flashlightOn,
    placement.pianoX,
    placement.pianoY,
    placement.pianoZ,
    placement.pianoYaw,
    placement.pianoScale,
    placement.orbitDistance,
    placement.orbitYaw,
    placement.orbitPitch,
  ])

  return (
    <>
      <primitive object={root} />
      {flashlight ? (
        <>
          <object3D ref={targetRef} />
          <spotLight
            ref={spotRef}
            color="#ffe7b0"
            intensity={flashlightOn ? 95 : 0}
            distance={18}
            angle={0.18}
            penumbra={0.35}
            decay={2}
            castShadow={flashlightOn}
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.00025}
          />
        </>
      ) : null}
    </>
  )
}
