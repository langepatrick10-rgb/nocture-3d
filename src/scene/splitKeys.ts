import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Vector3,
} from 'three'
import { FIRST_MIDI, KEY_COUNT, isBlackKey as isMidiBlack } from '../music/layout'
import type { BoundKey } from './keyBind'

const HINGE_FROM_BACK = 0.18
export const KEY_PRESS_RADIANS = 0.078
const KEY_LIFT = 0.0026

type Island = {
  verts: number[]
  xmin: number
  xmax: number
  ymin: number
  ymax: number
  zmin: number
  zmax: number
}

function find(parent: Int32Array, a: number): number {
  while (parent[a] !== a) {
    parent[a] = parent[parent[a]]
    a = parent[a]
  }
  return a
}

function union(parent: Int32Array, a: number, b: number): void {
  a = find(parent, a)
  b = find(parent, b)
  if (a !== b) parent[b] = a
}

function triangleIndex(geo: BufferGeometry): ArrayLike<number> | null {
  const indexed = geo.getIndex()
  if (indexed) return indexed.array
  const pos = geo.getAttribute('position')
  if (!pos || pos.count < 3 || pos.count % 3 !== 0) return null
  const arr = new Uint32Array(pos.count)
  for (let i = 0; i < pos.count; i++) arr[i] = i
  return arr
}

function islandsFrom(mesh: Mesh): Island[] {
  const geo = mesh.geometry
  const pos = geo.getAttribute('position')
  const idx = triangleIndex(geo)
  if (!pos || !idx) return []

  const parent = new Int32Array(pos.count)
  for (let i = 0; i < pos.count; i++) parent[i] = i
  for (let i = 0; i < idx.length; i += 3) {
    union(parent, idx[i], idx[i + 1])
    union(parent, idx[i + 1], idx[i + 2])
  }
  for (let i = 0; i < pos.count; i++) parent[i] = find(parent, i)

  const byRoot = new Map<number, Island>()
  for (let i = 0; i < pos.count; i++) {
    const root = parent[i]
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    let island = byRoot.get(root)
    if (!island) {
      island = { verts: [], xmin: x, xmax: x, ymin: y, ymax: y, zmin: z, zmax: z }
      byRoot.set(root, island)
    }
    island.verts.push(i)
    island.xmin = Math.min(island.xmin, x)
    island.xmax = Math.max(island.xmax, x)
    island.ymin = Math.min(island.ymin, y)
    island.ymax = Math.max(island.ymax, y)
    island.zmin = Math.min(island.zmin, z)
    island.zmax = Math.max(island.zmax, z)
  }
  return [...byRoot.values()]
}

function isWhiteKey(island: Island): boolean {
  const dx = island.xmax - island.xmin
  const dz = island.zmax - island.zmin
  const y = (island.ymin + island.ymax) / 2
  const z = (island.zmin + island.zmax) / 2
  return (
    island.verts.length >= 140 &&
    dx > 0.045 &&
    dx < 0.085 &&
    dz > 0.3 &&
    dz < 0.5 &&
    y > 1.76 &&
    y < 1.92 &&
    z > 0.42
  )
}

function isBlackKeyIsland(island: Island): boolean {
  const dx = island.xmax - island.xmin
  const dz = island.zmax - island.zmin
  const y = (island.ymin + island.ymax) / 2
  const z = (island.zmin + island.zmax) / 2
  return (
    island.verts.length >= 120 &&
    dx > 0.018 &&
    dx < 0.04 &&
    dz > 0.2 &&
    dz < 0.32 &&
    y > 1.78 &&
    y < 1.92 &&
    z > 0.45
  )
}

function pickKeyIslands(islands: Island[]): Island[] {
  const whites = islands.filter(isWhiteKey).sort((a, b) => a.xmin - b.xmin)
  const blacks = islands.filter(isBlackKeyIsland).sort((a, b) => a.xmin - b.xmin)
  if (whites.length === 52 && blacks.length === 36) {
    return [...whites, ...blacks].sort((a, b) => (a.xmin + a.xmax) / 2 - (b.xmin + b.xmax) / 2)
  }
  return []
}

function copyComponent(source: BufferGeometry, vertIds: number[]): BufferGeometry {
  const lookup = new Map<number, number>()
  vertIds.forEach((id, i) => lookup.set(id, i))
  const out = new BufferGeometry()
  for (const name of Object.keys(source.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') continue
    const attr = source.getAttribute(name)
    const width = attr.itemSize
    const data = new Float32Array(vertIds.length * width)
    vertIds.forEach((id, i) => {
      for (let k = 0; k < width; k++) data[i * width + k] = attr.getComponent(id, k)
    })
    out.setAttribute(name, new BufferAttribute(data, width, attr.normalized))
  }
  const srcIndex = source.getIndex()
  const next: number[] = []
  if (srcIndex) {
    const arr = srcIndex.array
    for (let i = 0; i < arr.length; i += 3) {
      const a = lookup.get(arr[i])
      const b = lookup.get(arr[i + 1])
      const c = lookup.get(arr[i + 2])
      if (a === undefined || b === undefined || c === undefined) continue
      next.push(a, b, c)
    }
  } else {
    for (let i = 0; i < vertIds.length; i += 3) next.push(i, i + 1, i + 2)
  }
  out.setIndex(next)
  return out
}

function finishKeyGeometry(mesh: Mesh): void {
  const geo = mesh.geometry
  if (!geo.userData.normalsFixed) {
    geo.computeVertexNormals()
    geo.userData.normalsFixed = true
  }
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
}

const KEY_LOOK = 4
const IVORY = new Color('#efeae0')
const EBONY = new Color('#1c1c1c')

function luminance(color: Color): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
}

function midiOf(mesh: Mesh): number | undefined {
  const own = mesh.userData.midi
  if (typeof own === 'number') return own
  const parent = mesh.parent?.userData.midi
  return typeof parent === 'number' ? parent : undefined
}

function keyIsBlack(mesh: Mesh): boolean {
  if (typeof mesh.userData.keyBlack === 'boolean') return mesh.userData.keyBlack
  const parentBlack = mesh.parent?.userData.keyBlack
  if (typeof parentBlack === 'boolean') return parentBlack
  const midi = midiOf(mesh)
  if (typeof midi === 'number') return isMidiBlack(midi)
  const mat = mesh.material as MeshStandardMaterial | undefined
  return mat?.color ? luminance(mat.color) < 0.32 : false
}

function killGlass(mat: MeshStandardMaterial, black: boolean): void {
  mat.transparent = false
  mat.opacity = 1
  mat.depthWrite = true
  mat.flatShading = false
  mat.metalness = 0
  mat.roughness = black ? 0.74 : 0.88
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
  mat.emissive.set(0, 0, 0)
  mat.emissiveIntensity = 1
  mat.needsUpdate = true
  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.03
  const extra = mat as MeshStandardMaterial & {
    transmission?: number
    thickness?: number
    attenuationDistance?: number
    clearcoat?: number
    sheen?: number
    iridescence?: number
    specularIntensity?: number
  }
  if (typeof extra.transmission === 'number') extra.transmission = 0
  if (typeof extra.thickness === 'number') extra.thickness = 0
  if (typeof extra.clearcoat === 'number') extra.clearcoat = 0
  if (typeof extra.sheen === 'number') extra.sheen = 0
  if (typeof extra.iridescence === 'number') extra.iridescence = 0
  if (typeof extra.specularIntensity === 'number') extra.specularIntensity = 0.08
}

function restyleSourceKeyMesh(mesh: Mesh, black: boolean): void {
  const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial
  const mat = mesh.userData.keyBedStyled ? (mesh.material as MeshStandardMaterial) : source.clone()
  killGlass(mat, black)
  mat.color.copy(black ? EBONY : IVORY)
  mesh.material = mat
  mesh.userData.keyBlack = black
  mesh.userData.keyBedStyled = true
}

function styleKeyMesh(mesh: Mesh, material: MeshStandardMaterial): void {
  const mat = mesh.userData.keyStyled
    ? (mesh.material as MeshStandardMaterial)
    : material.clone()
  const black = keyIsBlack(mesh)
  mesh.userData.keyBlack = black
  if (mesh.geometry.getAttribute('color')) mesh.geometry.deleteAttribute('color')
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -2
  mat.polygonOffsetUnits = -2
  killGlass(mat, black)
  mat.color.copy(black ? EBONY : IVORY)
  mesh.userData.restColor = mat.color.clone()
  mesh.userData.restEmissive = new Color(0, 0, 0)
  mesh.userData.keyLook = KEY_LOOK
  mesh.material = mat
  mesh.castShadow = true
  mesh.receiveShadow = false
  mesh.renderOrder = 2
  mesh.userData.keyStyled = true
  mesh.userData.restMetal = 0
  mesh.userData.restRough = mat.roughness
  mesh.userData.restEmissiveIntensity = 1
  mesh.userData.restEnv = 0.03
}

export function restyleBoundKeys(keys: BoundKey[]): void {
  for (const { object } of keys) {
    if (!object.userData.extraLift) {
      object.position.y += 0.0012
      object.userData.extraLift = true
    }
    object.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      finishKeyGeometry(mesh)
      const source = (
        Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      ) as MeshStandardMaterial
      styleKeyMesh(mesh, source)
    })
  }
}

function styleKeyGroup(group: Object3D, material?: MeshStandardMaterial): void {
  group.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const source =
      material ??
      ((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial)
    finishKeyGeometry(mesh)
    styleKeyMesh(mesh, source)
  })
}

export function styleBoundKeys(keys: BoundKey[]): void {
  for (const key of keys) styleKeyGroup(key.object)
}

function stripIslands(source: BufferGeometry, skip: Set<number>): BufferGeometry {
  const index = source.getIndex()
  const geo = source.clone()
  if (!index) return geo
  const keep: number[] = []
  const arr = index.array
  for (let i = 0; i < arr.length; i += 3) {
    if (skip.has(arr[i]) || skip.has(arr[i + 1]) || skip.has(arr[i + 2])) continue
    keep.push(arr[i], arr[i + 1], arr[i + 2])
  }
  geo.setIndex(keep)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

export function existingSplitKeys(root: Object3D): BoundKey[] {
  const found: BoundKey[] = []
  root.traverse((node) => {
    const match = /^Key_(\d+)$/.exec(node.name)
    if (!match) return
    found.push({ midi: Number(match[1]), object: node })
  })
  return found.sort((a, b) => a.midi - b.midi)
}

export function splitC6XKeys(mesh: Mesh): BoundKey[] {
  const already = existingSplitKeys(mesh.parent ?? mesh)
  if (already.length >= 70) {
    already.forEach((key) => styleKeyGroup(key.object))
    return already
  }

  const islands = islandsFrom(mesh)
  const keys = pickKeyIslands(islands)
  if (keys.length !== KEY_COUNT) {
    console.warn(
      `[piano] key split failed: ${islands.length} islands, ${keys.length} keys (need ${KEY_COUNT})`,
    )
    return []
  }
  return detachIslands(mesh, keys)
}

function meshLabel(node: Object3D): string {
  const mesh = node as Mesh
  const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined
  const matName = Array.isArray(mat) ? mat.map((item) => item.name).join(' ') : (mat?.name ?? '')
  return `${mesh.name} ${matName}`
}

function longestIslands(islands: Island[], want: number): Island[] {
  return [...islands]
    .filter((island) => island.verts.length >= 60)
    .sort((a, b) => {
      const as = Math.max(a.xmax - a.xmin, a.zmax - a.zmin) * a.verts.length
      const bs = Math.max(b.xmax - b.xmin, b.zmax - b.zmin) * b.verts.length
      return bs - as
    })
    .slice(0, want)
}

function centroid(island: Island): { x: number; y: number; z: number } {
  return {
    x: (island.xmin + island.xmax) / 2,
    y: (island.ymin + island.ymax) / 2,
    z: (island.zmin + island.zmax) / 2,
  }
}

function keyboardAxis(islands: Island[]): 'x' | 'z' {
  const xs = islands.map((island) => centroid(island).x)
  const zs = islands.map((island) => centroid(island).z)
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values)
  return spread(xs) >= spread(zs) ? 'x' : 'z'
}

function detachIslands(mesh: Mesh, keys: Island[], blackKeys?: boolean): BoundKey[] {
  const geo = mesh.geometry
  const skip = new Set<number>()
  for (const island of keys) {
    for (const vert of island.verts) skip.add(vert)
  }

  const material = (
    Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  ).clone() as MeshStandardMaterial
  const hinge = new Vector3()
  const bound: BoundKey[] = []

  keys.forEach((island, index) => {
    const piece = copyComponent(geo, island.verts)
    const dx = island.xmax - island.xmin
    const dz = island.zmax - island.zmin
    if (dz >= dx) {
      hinge.set((island.xmin + island.xmax) / 2, island.ymin, island.zmin + dz * HINGE_FROM_BACK)
    } else {
      hinge.set(island.xmin + dx * HINGE_FROM_BACK, island.ymin, (island.zmin + island.zmax) / 2)
    }
    const pos = piece.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) - hinge.x, pos.getY(i) - hinge.y, pos.getZ(i) - hinge.z)
    }
    pos.needsUpdate = true
    const group = new Group()
    group.name = `Key_${FIRST_MIDI + index}`
    group.position.copy(hinge)
    group.position.y += KEY_LIFT
    group.userData.midi = FIRST_MIDI + index
    group.userData.extraLift = true
    const keyMesh = new Mesh(piece, material)
    keyMesh.userData.midi = FIRST_MIDI + index
    if (typeof blackKeys === 'boolean') {
      group.userData.keyBlack = blackKeys
      keyMesh.userData.keyBlack = blackKeys
    }
    finishKeyGeometry(keyMesh)
    styleKeyMesh(keyMesh, material)
    group.add(keyMesh)
    mesh.add(group)
    bound.push({ midi: FIRST_MIDI + index, object: group })
  })

  mesh.geometry = stripIslands(geo, skip)
  mesh.userData.keysSplit = true
  if (typeof blackKeys === 'boolean') restyleSourceKeyMesh(mesh, blackKeys)
  return bound
}

export function paintNamedKeyMeshes(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh || mesh.userData.keyStyled) return
    const label = meshLabel(mesh)
    if (!/key/i.test(label)) return
    const white = /white/i.test(label)
    const black = /black/i.test(label) && !white
    if (!white && !black) return
    restyleSourceKeyMesh(mesh, black)
  })
}

export function splitWhiteBlackKeys(root: Object3D): BoundKey[] {
  let white: Mesh | undefined
  let black: Mesh | undefined
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const label = meshLabel(mesh)
    if (/key/i.test(label) && /white/i.test(label)) white = mesh
    if (/key/i.test(label) && /black/i.test(label)) black = mesh
  })
  if (!white || !black) return []
  const whiteMesh = white
  const blackMesh = black

  const whiteIslands = longestIslands(islandsFrom(white), 52)
  const blackIslands = longestIslands(islandsFrom(black), 36)
  if (whiteIslands.length !== 52 || blackIslands.length !== 36) {
    restyleSourceKeyMesh(whiteMesh, false)
    restyleSourceKeyMesh(blackMesh, true)
    console.warn(
      `[piano] white/black split failed: ${whiteIslands.length} white, ${blackIslands.length} black`,
    )
    return []
  }

  const axis = keyboardAxis([...whiteIslands, ...blackIslands])
  const tagged = [
    ...whiteIslands.map((island) => ({ island, mesh: whiteMesh })),
    ...blackIslands.map((island) => ({ island, mesh: blackMesh })),
  ].sort((a, b) => {
    const ca = centroid(a.island)
    const cb = centroid(b.island)
    return axis === 'x' ? ca.x - cb.x : ca.z - cb.z
  })

  const byMesh = new Map<Mesh, Island[]>()
  for (const item of tagged) {
    const list = byMesh.get(item.mesh) ?? []
    list.push(item.island)
    byMesh.set(item.mesh, list)
  }

  const bound: BoundKey[] = []
  const midiOf = new Map<Island, number>()
  tagged.forEach((item, index) => midiOf.set(item.island, FIRST_MIDI + index))

  for (const [mesh, islands] of byMesh) {
    const pieces = detachIslands(mesh, islands, mesh === blackMesh)
    pieces.forEach((key, index) => {
      const midi = midiOf.get(islands[index])
      if (midi === undefined) return
      key.midi = midi
      key.object.name = `Key_${midi}`
      key.object.userData.midi = midi
      key.object.traverse((node) => {
        node.userData.midi = midi
      })
    })
    bound.push(...pieces)
  }
  return bound.sort((a, b) => a.midi - b.midi)
}
