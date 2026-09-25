import { Box3, type Mesh, Object3D, Vector3 } from 'three'
import { FIRST_MIDI, KEY_COUNT, LAST_MIDI, noteName } from '../music/layout'

const MIDI_NAME = /(?:^|[_\s.-])(?:key|note|midi)[_\s.-]*(\d{1,3})$/i
const NOTE_NAME = /^([a-g])([#s]|sharp|is)?(-?\d)$/i
const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

export type BoundKey = { midi: number; object: Object3D }

function midiFromName(raw: string): number | null {
  const cleaned = raw.trim().replace(/\.\d+$/, '')
  const midiMatch = MIDI_NAME.exec(cleaned)
  if (midiMatch) {
    const midi = Number(midiMatch[1])
    if (midi >= FIRST_MIDI && midi <= LAST_MIDI) return midi
  }
  const noteMatch = NOTE_NAME.exec(cleaned.replace(/_/g, ''))
  if (!noteMatch) {
    const exact = noteNameLookup(cleaned)
    return exact
  }
  const letter = noteMatch[1].toLowerCase()
  const sharp = Boolean(noteMatch[2])
  const octave = Number(noteMatch[3])
  const pc = PC[letter]
  if (pc === undefined) return null
  const midi = (octave + 1) * 12 + pc + (sharp ? 1 : 0)
  if (midi < FIRST_MIDI || midi > LAST_MIDI) return null
  return midi
}

function noteNameLookup(raw: string): number | null {
  const compact = raw.replace(/[^a-g#0-9-]/gi, '')
  for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
    if (noteName(midi).toLowerCase() === compact.toLowerCase()) return midi
  }
  return null
}

export function findNamedKeys(root: Object3D): BoundKey[] {
  const byMidi = new Map<number, Object3D>()
  root.traverse((node) => {
    if (!node.name) return
    const midi = midiFromName(node.name)
    if (midi === null) return
    if (!byMidi.has(midi)) byMidi.set(midi, node)
  })
  return [...byMidi.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([midi, object]) => ({ midi, object }))
}

function bindAlongAxis(
  items: Array<{ object: Object3D; x: number; z: number }>,
): BoundKey[] {
  if (items.length < 70) return []
  const xs = items.map((item) => item.x)
  const zs = items.map((item) => item.z)
  const spanX = Math.max(...xs) - Math.min(...xs)
  const spanZ = Math.max(...zs) - Math.min(...zs)
  const sorted = [...items].sort((a, b) => (spanX >= spanZ ? a.x - b.x : a.z - b.z))
  const start = Math.max(0, Math.floor((sorted.length - KEY_COUNT) / 2))
  const slice = sorted.slice(start, start + KEY_COUNT)
  if (slice.length < 70) return []
  return slice.map((item, index) => ({
    midi: FIRST_MIDI + index,
    object: item.object,
  }))
}

export function findPlayableKeys(root: Object3D): BoundKey[] {
  const named = findNamedKeys(root)
  if (named.length >= 70) return named

  const box = new Box3()
  const size = new Vector3()
  const center = new Vector3()
  const meshes: Array<{ object: Object3D; x: number; z: number; name: string }> = []
  root.updateWorldMatrix(true, true)
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    box.setFromObject(mesh)
    if (box.isEmpty()) return
    box.getSize(size)
    box.getCenter(center)
    const longest = Math.max(size.x, size.y, size.z)
    if (longest < 0.008 || longest > 0.45) return
    meshes.push({
      object: mesh,
      x: center.x,
      z: center.z,
      name: mesh.name,
    })
  })

  const namedKeyish = meshes.filter((item) =>
    /key|ivory|ebony|white|black/i.test(item.name),
  )
  const fromNames = bindAlongAxis(namedKeyish)
  if (fromNames.length >= 70) return fromNames
  return bindAlongAxis(meshes)
}

function isWorldVisible(node: Object3D): boolean {
  let current: Object3D | null = node
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

export function visibleBox(root: Object3D): Box3 {
  const box = new Box3()
  const piece = new Box3()
  box.makeEmpty()
  root.updateWorldMatrix(true, true)
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh || !isWorldVisible(mesh)) return
    piece.setFromObject(mesh)
    if (!piece.isEmpty()) box.union(piece)
  })
  return box
}

export function fitObjectToWidth(root: Object3D, width: number, floorY = 0): void {
  let box = visibleBox(root)
  const size = box.getSize(new Vector3())
  const span = Math.max(size.x, size.z, 0.001)
  root.scale.multiplyScalar(width / span)
  box = visibleBox(root)
  const center = box.getCenter(new Vector3())
  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y += floorY - box.min.y
}
