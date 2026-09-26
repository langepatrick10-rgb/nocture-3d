export const STUDIO_ID = 'studio'

export type RoomPlacement = {
  id: string
  label: string
  file: string
  url: string
  pianoX: number
  pianoY: number
  pianoZ: number
  pianoYaw: number
  pianoScale: number
  orbitDistance: number
  orbitYaw: number
  orbitPitch: number
  cameraWindow: number
  cameraWindowY: number
}

const ROOM_ORDER = [
  'living room',
  'victorian',
  'rainy street',
  'japanese loft',
  'fnaf',
  'the backrooms',
]

export function sortRooms(rooms: RoomPlacement[]): RoomPlacement[] {
  return [...rooms].sort((a, b) => {
    const left = ROOM_ORDER.indexOf(a.id.trim().toLowerCase())
    const right = ROOM_ORDER.indexOf(b.id.trim().toLowerCase())
    const rankA = left === -1 ? 100 : left
    const rankB = right === -1 ? 100 : right
    if (rankA !== rankB) return rankA - rankB
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  })
}

export const STUDIO_PLACEMENT: RoomPlacement = {
  id: STUDIO_ID,
  label: 'Studio floor',
  file: '',
  url: '',
  pianoX: 0,
  pianoY: 0,
  pianoZ: 0,
  pianoYaw: 0,
  pianoScale: 1,
  orbitDistance: 2.4,
  orbitYaw: 30,
  orbitPitch: 60,
  cameraWindow: 360,
  cameraWindowY: 70,
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normalizePlacement(raw: Partial<RoomPlacement> & { id: string }): RoomPlacement {
  return {
    id: raw.id,
    label: raw.label?.trim() || raw.id,
    file: raw.file ?? '',
    url: raw.url ?? '',
    pianoX: num(raw.pianoX, 0),
    pianoY: num(raw.pianoY, 0),
    pianoZ: num(raw.pianoZ, 0),
    pianoYaw: num(raw.pianoYaw, 0),
    pianoScale: Math.max(0.1, num(raw.pianoScale, 1)),
    orbitDistance: Math.max(0.8, num(raw.orbitDistance, 3.2)),
    orbitYaw: num(raw.orbitYaw, 30),
    orbitPitch: Math.min(95, Math.max(15, num(raw.orbitPitch, 60))),
    cameraWindow: Math.min(360, Math.max(20, num(raw.cameraWindow, 360))),
    cameraWindowY: Math.min(140, Math.max(10, num(raw.cameraWindowY, 70))),
  }
}

export async function fetchRooms(): Promise<RoomPlacement[] | null> {
  const urls = ['/api/rooms', '/rooms/manifest.json']
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) continue
      const data: unknown = await response.json()
      if (!Array.isArray(data)) continue
      return data
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) =>
          normalizePlacement({
            id: String(item.id ?? ''),
            label: typeof item.label === 'string' ? item.label : undefined,
            file: typeof item.file === 'string' ? item.file : undefined,
            url: typeof item.url === 'string' ? item.url : undefined,
            pianoX: item.pianoX as number | undefined,
            pianoY: item.pianoY as number | undefined,
            pianoZ: item.pianoZ as number | undefined,
            pianoYaw: item.pianoYaw as number | undefined,
            pianoScale: item.pianoScale as number | undefined,
            orbitDistance: item.orbitDistance as number | undefined,
            orbitYaw: item.orbitYaw as number | undefined,
            orbitPitch: item.orbitPitch as number | undefined,
            cameraWindow: item.cameraWindow as number | undefined,
            cameraWindowY: item.cameraWindowY as number | undefined,
          }),
        )
        .filter((item) => item.id && item.url)
    } catch {
      /* try the next source */
    }
  }
  return null
}
