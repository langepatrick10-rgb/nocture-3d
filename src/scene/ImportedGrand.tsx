import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Color, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, Texture, Vector3, type Object3D } from 'three'
import { noteGen, pressHand, pressSong, pressUser } from '../engine/live'
import { player } from '../engine/player'
import { useAppStore } from '../engine/store'
import { publicUrl } from '../assetUrl'
import { KEY_COUNT, isBlackKey, midiToIndex } from '../music/layout'
import { fitObjectToWidth, type BoundKey } from './keyBind'
import { keyWorldX, keyWorldY, keyWorldZ, setKeyWorldCount } from './keyWorld'
import { FLOOR_Y } from './scale'
import {
  KEY_PRESS_RADIANS,
  paintNamedKeyMeshes,
  restyleBoundKeys,
  splitC6XKeys,
  splitWhiteBlackKeys,
} from './splitKeys'

export const DEFAULT_GRAND_URL = `${publicUrl('models/grand-piano.glb')}?reset=1`
export const MARBLE_GRAND_URL = `${publicUrl('models/grand-piano-marble.glb')}?tex=3&reset=1`

const WORLD = new Vector3()

const GOLD = new Color('#e2b43a')
const GOLD_HOT = new Color('#ffe7a0')
const BLUE = new Color('#3d7dff')
const BLUE_HOT = new Color('#9ec2ff')
const RED = new Color('#ff4a45')
const RED_HOT = new Color('#ff9a8c')
const BLACK = new Color(0, 0, 0)
const IVORY = new Color('#efeae0')
const EBONY = new Color('#1c1c1c')

type Prepared = {
  prepared?: boolean
  slimmed?: boolean
  keys?: BoundKey[]
}

const GRAND_FIT_REV = 4
const COLOR_MAX = 1536
const OTHER_MAX = 1024
const MAP_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const

function downscaleTexture(tex: Texture, maxSize: number, anisotropy: number): void {
  const img = tex.image as { width?: number; height?: number } | undefined
  if (!img?.width || !img.height) return
  tex.anisotropy = anisotropy
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.generateMipmaps = true
  if (img.width <= maxSize && img.height <= maxSize) return
  const scale = maxSize / Math.max(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  try {
    ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height)
    tex.image = canvas
    tex.needsUpdate = true
  } catch {
    /* keep original if the image can't be drawn */
  }
}

function slimTextures(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const item of source) {
      const mat = item as MeshStandardMaterial
      for (const key of MAP_KEYS) {
        const tex = mat[key]
        if (!tex) continue
        const color = key === 'map' || key === 'normalMap'
        downscaleTexture(tex, color ? COLOR_MAX : OTHER_MAX, color ? 4 : 2)
      }
    }
  })
}

function applyShadows(root: Object3D, heavy: boolean): void {
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    if (!heavy) {
      mesh.castShadow = mesh.visible
      mesh.receiveShadow = mesh.visible
      return
    }
    const count = mesh.geometry.getAttribute('position')?.count ?? 0
    const important = /key|lid|body|frame|chair|leg/i.test(`${mesh.name} ${materialName(mesh)}`)
    mesh.castShadow = important && count > 24
    mesh.receiveShadow = important
  })
}

function materialName(node: Object3D): string {
  const mesh = node as Mesh
  const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined
  if (Array.isArray(mat)) return mat.map((item) => item.name).join(' ')
  return mat?.name ?? ''
}

function isFurniture(node: Object3D): boolean {
  return /chair|bench|seat|stool/i.test(`${node.name} ${materialName(node)}`)
}

function hardenMaterials(root: Object3D, heavy: boolean): void {
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (heavy) {
      for (const item of source) {
        const mat = item as MeshStandardMaterial
        mat.transparent = false
        mat.depthWrite = true
        mat.opacity = 1
      }
      return
    }
    const next = source.map((item) => {
      const mat = item.clone() as MeshStandardMaterial
      if (/logo/i.test(mat.name)) return mat
      mat.transparent = false
      mat.depthWrite = true
      mat.opacity = 1
      if (/body/i.test(mat.name) && mat.roughness < 0.05) mat.roughness = 1
      return mat
    })
    mesh.material = next.length === 1 ? next[0] : next
  })
}

function luminance(color: Color): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
}

function isTintedColor(color: Color): boolean {
  return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) > 0.16
}

function restoreRest(mesh: Mesh | null): void {
  const mat = mesh?.material as MeshStandardMaterial | undefined
  if (!mesh || !mat?.emissive) return
  const midi = (mesh.userData.midi ?? mesh.parent?.userData.midi) as number | undefined
  const black =
    typeof mesh.userData.keyBlack === 'boolean'
      ? mesh.userData.keyBlack
      : typeof midi === 'number'
        ? isBlackKey(midi)
        : luminance(mat.color) < 0.32
  const restColor = black ? EBONY : IVORY
  mesh.userData.restColor = restColor.clone()
  mesh.userData.keyBlack = black
  const restEmissive = mesh.userData.restEmissive as Color | undefined
  mat.color.copy(restColor)
  mat.vertexColors = false
  mat.map = null
  mat.aoMap = null
  mat.normalMap = null
  mat.roughnessMap = null
  mat.metalnessMap = null
  mat.emissiveMap = null
  mat.bumpMap = null
  mat.displacementMap = null
  mat.alphaMap = null
  mat.lightMap = null
  mat.needsUpdate = true
  if (restEmissive) mat.emissive.copy(restEmissive)
  else mat.emissive.copy(BLACK)
  mat.emissiveIntensity = 1
  mat.metalness = 0
  mat.roughness = black ? 0.74 : 0.88
  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.03
}

function findBodyMesh(root: Object3D): Mesh | null {
  let named: Mesh | null = null
  let largest: Mesh | null = null
  let largestCount = 0
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const count = mesh.geometry.getAttribute('position')?.count ?? 0
    if (count > largestCount) {
      largestCount = count
      largest = mesh
    }
    if (/body/i.test(materialName(mesh))) named = mesh
  })
  return named ?? largest
}

function midiFrom(node: Object3D | null): number | null {
  let current: Object3D | null = node
  while (current) {
    if (typeof current.userData.midi === 'number') return current.userData.midi
    current = current.parent
  }
  return null
}

function keyMeshOf(object: Object3D): Mesh | null {
  const child = object.children[0] as Mesh | undefined
  if (child?.isMesh) return child
  let found: Mesh | null = null
  object.traverse((node) => {
    const mesh = node as Mesh
    if (!found && mesh.isMesh) found = mesh
  })
  return found
}

function prepareGrand(root: Object3D, heavy: boolean): BoundKey[] {
  const leftover = root.getObjectByName('nocture-sustain-pedals')
  leftover?.removeFromParent()
  const data = root.userData as Prepared
  if (heavy && !data.slimmed) {
    slimTextures(root)
    data.slimmed = true
  }
  applyShadows(root, heavy)
  const ready = Boolean(data.prepared && data.keys && data.keys.length >= 70)
  if (!ready) {
    hardenMaterials(root, heavy)
    let keys = splitWhiteBlackKeys(root)
    if (keys.length < 70) {
      const body = findBodyMesh(root)
      keys = body ? splitC6XKeys(body) : []
    }
    data.keys = keys
    data.prepared = true
  }
  paintNamedKeyMeshes(root)
  if (ready) restyleBoundKeys(data.keys ?? [])
  root.traverse((node) => {
    if (isFurniture(node)) node.visible = false
  })
  fitObjectToWidth(root, 2.45, FLOOR_Y)
  root.traverse((node) => {
    if (isFurniture(node)) node.visible = true
  })
  applyShadows(root, heavy)
  return data.keys ?? []
}

export function ImportedGrand({ url }: { url: string }) {
  const gltf = useGLTF(url)
  const root = gltf.scene
  const heavy = url === MARBLE_GRAND_URL
  const keysRef = useRef<BoundKey[]>([])
  const meshes = useRef<(Mesh | null)[]>([])
  const travel = useRef(new Float32Array(KEY_COUNT))
  const glow = useRef(new Float32Array(KEY_COUNT))
  const lastGen = useRef(new Uint32Array(KEY_COUNT))
  const lastTint = useRef(new Uint8Array(KEY_COUNT).fill(255))
  const fadeHand = useRef(new Uint8Array(KEY_COUNT))
  const pointerKeys = useRef(new Map<number, number>())

  useLayoutEffect(() => {
    keysRef.current = prepareGrand(root, heavy)
    const list = new Array<Mesh | null>(KEY_COUNT).fill(null)
    for (const { midi, object } of keysRef.current) {
      list[midiToIndex(midi)] = keyMeshOf(object)
    }
    meshes.current = list
    lastTint.current.fill(255)
    glow.current.fill(0)
    for (const mesh of list) restoreRest(mesh)
    setKeyWorldCount(keysRef.current.length)
    Object.assign(window, {
      __PIANO_KEYS: keysRef.current.length,
    })
    useAppStore.getState().setPianoLoading(false)
    useAppStore.getState().setStatus('Piano ready.')
  }, [root, heavy, GRAND_FIT_REV])

  useEffect(() => {
    const releasePointer = (event: PointerEvent) => {
      const midi = pointerKeys.current.get(event.pointerId)
      if (midi === undefined) return
      pointerKeys.current.delete(event.pointerId)
      player.userNoteOff(midi)
    }
    const releaseAll = () => {
      for (const midi of pointerKeys.current.values()) player.userNoteOff(midi)
      pointerKeys.current.clear()
      player.releaseAllUser()
    }
    window.addEventListener('pointerup', releasePointer)
    window.addEventListener('pointercancel', releasePointer)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('pointerup', releasePointer)
      window.removeEventListener('pointercancel', releasePointer)
      window.removeEventListener('blur', releaseAll)
    }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const keys = keysRef.current
    const meshList = meshes.current
    const dips = travel.current
    const lights = glow.current
    const gens = lastGen.current
    const tints = lastTint.current
    const fades = fadeHand.current
    const handsMode = useAppStore.getState().colorMode === 'hands'
    for (let k = 0; k < keys.length; k++) {
      const { midi, object } = keys[k]
      const i = midiToIndex(midi)
      object.getWorldPosition(WORLD)
      keyWorldX[i] = WORLD.x
      keyWorldY[i] = WORLD.y
      keyWorldZ[i] = WORLD.z
      if (noteGen[i] !== gens[i]) {
        gens[i] = noteGen[i]
        if (dips[i] > 0.7) dips[i] *= 0.42
      }
      const held = pressUser[i] || pressSong[i]
      if (!handsMode) fades[i] = 0
      else if (pressSong[i] && pressHand[i]) fades[i] = pressHand[i]
      const tint = handsMode && fades[i] ? fades[i] : 0

      const dipTarget = held ? 1 : 0
      const dipRate = dipTarget > dips[i] ? 18 : 13
      dips[i] += (dipTarget - dips[i]) * (1 - Math.exp(-dt * dipRate))
      if (!held && dips[i] < 0.002) {
        dips[i] = 0
        object.rotation.x = 0
      } else {
        object.rotation.x = dips[i] * KEY_PRESS_RADIANS
      }

      const glowTarget = held ? 1 : 0
      const glowRate = glowTarget > lights[i] ? 20 : 16
      const previous = lights[i]
      lights[i] += (glowTarget - lights[i]) * (1 - Math.exp(-dt * glowRate))
      const amount = lights[i]

      if (!held && amount < 0.01) {
        lights[i] = 0
        fades[i] = 0
        if (tints[i] !== 255 || previous !== 0) restoreRest(meshList[i])
        tints[i] = 255
        continue
      }
      if (held && Math.abs(amount - previous) < 0.003 && amount > 0.95 && tints[i] === tint) continue
      tints[i] = tint
      const mesh = meshList[i]
      const mat = mesh?.material as MeshStandardMaterial | undefined
      if (!mesh || !mat?.emissive) continue
      let restColor = mesh.userData.restColor as Color | undefined
      const black =
        typeof mesh.userData.keyBlack === 'boolean' ? mesh.userData.keyBlack : isBlackKey(midi)
      if (!restColor || isTintedColor(restColor) || (!black && luminance(restColor) < 0.55)) {
        restColor = black ? EBONY : IVORY
        mesh.userData.restColor = restColor.clone()
      }
      const restEmissive = (mesh.userData.restEmissive as Color | undefined) ?? BLACK
      const restRough = black ? 0.74 : 0.88
      const cool = tint === 1 ? BLUE : tint === 2 ? RED : GOLD
      const hot = tint === 1 ? BLUE_HOT : tint === 2 ? RED_HOT : GOLD_HOT
      const colorMix = tint === 0 ? 0.82 : 0.92
      const emitMix = tint === 0 ? 0.78 : 0.88
      mat.color.copy(restColor).lerp(cool, amount * colorMix)
      mat.emissive.copy(restEmissive).lerp(cool, amount * emitMix).lerp(hot, amount * 0.28)
      mat.emissiveIntensity = 1 * (1 - amount) + 1.15 * amount
      mat.metalness = amount * 0.22
      mat.roughness = restRough * (1 - amount) + 0.38 * amount
      if ('envMapIntensity' in mat) mat.envMapIntensity = 0.03 + amount * 0.28
    }
  })

  return (
    <primitive
      object={root}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        const midi = midiFrom(event.object)
        if (midi === null) return
        event.stopPropagation()
        pointerKeys.current.set(event.pointerId, midi)
        const target = event.nativeEvent.target as Element | undefined
        target?.setPointerCapture?.(event.pointerId)
        player.userNoteOn(midi)
      }}
      onPointerUp={(event: ThreeEvent<PointerEvent>) => {
        const midi = pointerKeys.current.get(event.pointerId) ?? midiFrom(event.object)
        pointerKeys.current.delete(event.pointerId)
        if (midi !== null && midi !== undefined) player.userNoteOff(midi)
      }}
      onPointerCancel={(event: ThreeEvent<PointerEvent>) => {
        const midi = pointerKeys.current.get(event.pointerId) ?? midiFrom(event.object)
        pointerKeys.current.delete(event.pointerId)
        if (midi !== null && midi !== undefined) player.userNoteOff(midi)
      }}
    />
  )
}

useGLTF.preload(DEFAULT_GRAND_URL)
