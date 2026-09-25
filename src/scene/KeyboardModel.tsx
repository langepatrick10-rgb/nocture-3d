import { Text, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Vector3,
} from 'three'
import { publicUrl } from '../assetUrl'
import { expectedMask, pressSong, pressUser } from '../engine/live'
import { player } from '../engine/player'
import { KEYS, midiToIndex, WHITE_LENGTH, type KeySpec } from '../music/layout'
import { HINGE_X, PRESS_RADIANS, WHITE_CUTS } from './keyLayout'

const KEYBOARD_URL = publicUrl('models/keyboard.glb')
const LEFT = new Color('#1d6f86')
const RIGHT = new Color('#a56b1e')
const PRESS_GLOW = new Color('#3a2a10')
const REST = new Color('#000000')
const SIZE = new Vector3()

function cutAttribute(geo: BufferGeometry) {
  return geo.getAttribute('_cut') ?? geo.getAttribute('_CUT') ?? geo.getAttribute('cut') ?? geo.getAttribute('CUT')
}

function withWhiteCuts(source: BufferGeometry, left: number, right: number): BufferGeometry {
  const geo = source.clone()
  const pos = geo.getAttribute('position')
  const cut = cutAttribute(geo)
  if (!pos || !cut) return geo
  for (let i = 0; i < pos.count; i++) {
    const dir = cut.getX(i)
    const width = 0.01 * (dir < 0 ? left : right)
    pos.setZ(i, pos.getZ(i) + dir * width)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

function findKeyMeshes(root: Object3D): { white?: Mesh; black?: Mesh } {
  const meshes: Mesh[] = []
  root.traverse((node) => {
    const mesh = node as Mesh
    if (mesh.isMesh) meshes.push(mesh)
  })
  const white =
    meshes.find((mesh) => /white/i.test(mesh.name)) ??
    meshes.find((mesh) => mesh.geometry.getAttribute('position')?.count === 1448)
  const black =
    meshes.find((mesh) => /black/i.test(mesh.name)) ??
    meshes.find((mesh) => mesh.geometry.getAttribute('position')?.count === 1128)
  return { white, black }
}

function HingedKey({
  spec,
  geometry,
  material,
  keyScale,
  hingeX,
}: {
  spec: KeySpec
  geometry: BufferGeometry
  material: MeshStandardMaterial
  keyScale: number
  hingeX: number
}) {
  const hinge = useRef<Group>(null)
  const press = useRef(0)
  const mat = useMemo(() => material.clone(), [material])

  useFrame((_, delta) => {
    const group = hinge.current
    if (!group) return
    const i = midiToIndex(spec.midi)
    const down = pressUser[i] || pressSong[i]
    const expect = expectedMask[i]
    const target = down ? 1 : 0
    const rate = target > press.current ? 26 : 12
    press.current += (target - press.current) * Math.min(1, delta * rate)
    group.rotation.z = -press.current * PRESS_RADIANS

    if (expect) mat.emissive.copy(spec.midi < 60 ? LEFT : RIGHT)
    else if (down) mat.emissive.copy(PRESS_GLOW)
    else mat.emissive.copy(REST)
    mat.emissiveIntensity = expect || down ? 0.55 : 0
  })

  return (
    <group position={[0, 0, -spec.x]}>
      <group ref={hinge} position={[hingeX, 0, 0]}>
        <mesh
          geometry={geometry}
          material={mat}
          scale={keyScale}
          position={[-hingeX, 0, 0]}
          castShadow
          receiveShadow
          onPointerDown={(event) => {
            event.stopPropagation()
            player.userNoteOn(spec.midi)
          }}
          onPointerUp={(event) => {
            event.stopPropagation()
            player.userNoteOff(spec.midi)
          }}
          onPointerLeave={() => player.userNoteOff(spec.midi)}
        />
        {spec.octaveLabel ? (
          <Text
            position={[-hingeX + WHITE_LENGTH * 0.82, 0.04, 0]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            fontSize={0.11}
            color="#6d6458"
            anchorX="center"
            anchorY="middle"
          >
            {spec.octaveLabel}
          </Text>
        ) : null}
      </group>
    </group>
  )
}

export function SculptedKeys() {
  const gltf = useGLTF(KEYBOARD_URL)
  const { white, black } = findKeyMeshes(gltf.scene)
  const whites = useMemo(() => KEYS.filter((key) => !key.isBlack), [])
  const blacks = useMemo(() => KEYS.filter((key) => key.isBlack), [])
  const fit = useMemo(() => {
    if (!white) return { keyScale: 1, hingeX: HINGE_X, zShift: 0 }
    const geo = white.geometry
    if (!geo.boundingBox) geo.computeBoundingBox()
    const box = geo.boundingBox
    if (!box) return { keyScale: 1, hingeX: HINGE_X, zShift: 0 }
    const len = box.getSize(SIZE).x
    const keyScale = WHITE_LENGTH / Math.max(len, 0.001)
    const hingeX = box.min.x * keyScale
    const zShift = WHITE_LENGTH / 2 - box.max.x * keyScale
    return { keyScale, hingeX, zShift }
  }, [white])
  const whiteGeos = useMemo(() => {
    if (!white) return []
    return whites.map((_, index) => {
      const cut = WHITE_CUTS[index] ?? { left: 0, right: 0 }
      return withWhiteCuts(white.geometry, cut.left, cut.right)
    })
  }, [white, whites])

  if (!white || !black) return null

  const ivory = white.material as MeshStandardMaterial
  const ebony = black.material as MeshStandardMaterial

  return (
    <group position={[0, 0.07, fit.zShift]} rotation={[0, -Math.PI / 2, 0]}>
      {whites.map((spec, index) => (
        <HingedKey
          key={spec.midi}
          spec={spec}
          geometry={whiteGeos[index]}
          material={ivory}
          keyScale={fit.keyScale}
          hingeX={fit.hingeX}
        />
      ))}
      {blacks.map((spec) => (
        <HingedKey
          key={spec.midi}
          spec={spec}
          geometry={black.geometry}
          material={ebony}
          keyScale={fit.keyScale}
          hingeX={fit.hingeX}
        />
      ))}
    </group>
  )
}

useGLTF.preload(KEYBOARD_URL)
