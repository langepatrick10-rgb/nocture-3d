import { publicUrl } from '../assetUrl'
import { DEFAULT_GRAND_URL, MARBLE_GRAND_URL } from './ImportedGrand'

export type PianoLook = {
  id: string
  label: string
  url: string
}

export type RoomCamera = {
  position: [number, number, number]
  target: [number, number, number]
  minDistance: number
  maxDistance: number
  minPolar: number
  maxPolar: number
  minAzimuth: number
  maxAzimuth: number
  fullSpin: boolean
  orbitAim: number
  orbitHalf: number
  radius: number
  minY: number
  maxY: number
}

export type EnvironmentLook = {
  id: string
  label: string
  background: string
  blur: number
  intensity: number
  files?: string
  preset?: 'apartment' | 'city' | 'dawn' | 'forest' | 'lobby' | 'night' | 'park' | 'studio' | 'sunset' | 'warehouse'
  fogNear?: number
  fogFar?: number
  exposure?: number
}

export const PIANOS: PianoLook[] = [
  { id: 'c6x', label: 'Concert grand', url: DEFAULT_GRAND_URL },
  { id: 'marble', label: 'Marble grand', url: MARBLE_GRAND_URL },
]

export const ENVIRONMENTS: EnvironmentLook[] = [
  {
    id: 'studio',
    label: 'Studio floor',
    background: '#1a1612',
    blur: 0.28,
    intensity: 0.52,
    preset: 'apartment',
    fogNear: 10,
    fogFar: 28,
    exposure: 1,
  },
  {
    id: 'hall',
    label: 'Mirrored hall',
    files: publicUrl('hdr/mirrored_hall_2k.hdr'),
    background: '#1a1612',
    blur: 0.12,
    intensity: 0.55,
  },
  {
    id: 'lobby',
    label: 'Lobby',
    preset: 'lobby',
    background: '#1c1814',
    blur: 0.2,
    intensity: 0.62,
  },
  {
    id: 'night',
    label: 'Night',
    preset: 'night',
    background: '#07080c',
    blur: 0.38,
    intensity: 0.52,
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    preset: 'warehouse',
    background: '#161412',
    blur: 0.3,
    intensity: 0.58,
  },
  {
    id: 'sunset',
    label: 'Sunset',
    preset: 'sunset',
    background: '#2a1810',
    blur: 0.22,
    intensity: 0.64,
  },
  {
    id: 'forest',
    label: 'Forest',
    preset: 'forest',
    background: '#0c1410',
    blur: 0.36,
    intensity: 0.54,
  },
  {
    id: 'apartment',
    label: 'Apartment',
    preset: 'apartment',
    background: '#16140f',
    blur: 0.2,
    intensity: 0.6,
  },
]

export function isStandardEnvironment(id: string): boolean {
  return ENVIRONMENTS.some((item) => item.id === id)
}

export function environmentById(id: string): EnvironmentLook {
  return ENVIRONMENTS.find((item) => item.id === id) ?? ENVIRONMENTS[0]
}
