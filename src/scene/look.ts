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
]

export function environmentById(id: string): EnvironmentLook {
  return ENVIRONMENTS.find((item) => item.id === id) ?? ENVIRONMENTS[0]
}
