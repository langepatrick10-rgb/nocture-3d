export type RoomMood = {
  background: string
  fogMode: 'none' | 'linear' | 'exp2'
  fogColor: string
  fogNear: number
  fogFar: number
  fogDensity: number
  hemiSky: string
  hemiGround: string
  hemi: number
  dirColor: string
  dir: number
  dirOffset: [number, number, number]
  envPreset: 'apartment' | 'night' | 'city'
  envIntensity: number
  exposure: number
  bloomIntensity: number
  bloomThreshold: number
  contactOpacity: number
  rain: boolean
  dimUnlit: number | null
  sceneCastShadow: boolean
  shadowSpan: number
  shadowFar: number
  brightness: number
  contrast: number
  noise: number
  vignette: number
}

const DEFAULT_ROOM: RoomMood = {
  background: '#1a1612',
  fogMode: 'linear',
  fogColor: '#1a1612',
  fogNear: 10,
  fogFar: 28,
  fogDensity: 0,
  hemiSky: '#f4ead8',
  hemiGround: '#3a3228',
  hemi: 0.22,
  dirColor: '#fff1d6',
  dir: 0.42,
  dirOffset: [-4, 6, 3],
  envPreset: 'apartment',
  envIntensity: 0.32,
  exposure: 1,
  bloomIntensity: 0.07,
  bloomThreshold: 0.86,
  contactOpacity: 0.4,
  rain: false,
  dimUnlit: null,
  sceneCastShadow: false,
  shadowSpan: 8,
  shadowFar: 24,
  brightness: 0,
  contrast: 0,
  noise: 0,
  vignette: 0,
}

const BACKROOMS: RoomMood = {
  background: '#8f886c',
  fogMode: 'exp2',
  fogColor: '#b7ae8c',
  fogNear: 1.2,
  fogFar: 16,
  fogDensity: 0.052,
  hemiSky: '#e4dcaf',
  hemiGround: '#5c5644',
  hemi: 0.12,
  dirColor: '#efe6c0',
  dir: 0.16,
  dirOffset: [-2, 5, 1],
  envPreset: 'apartment',
  envIntensity: 0.12,
  exposure: 0.86,
  bloomIntensity: 0.04,
  bloomThreshold: 0.9,
  contactOpacity: 0.22,
  rain: false,
  dimUnlit: 0.78,
  sceneCastShadow: false,
  shadowSpan: 8,
  shadowFar: 24,
  brightness: -0.05,
  contrast: -0.04,
  noise: 0.028,
  vignette: 0.38,
}

const RAINY_STREET: RoomMood = {
  background: '#10141c',
  fogMode: 'exp2',
  fogColor: '#1a222c',
  fogNear: 5,
  fogFar: 42,
  fogDensity: 0.016,
  hemiSky: '#7d8ea4',
  hemiGround: '#242018',
  hemi: 0.16,
  dirColor: '#d2dced',
  dir: 0.4,
  dirOffset: [-7, 12, 3],
  envPreset: 'night',
  envIntensity: 0.2,
  exposure: 0.92,
  bloomIntensity: 0.06,
  bloomThreshold: 0.86,
  contactOpacity: 0.5,
  rain: true,
  dimUnlit: null,
  sceneCastShadow: true,
  shadowSpan: 22,
  shadowFar: 48,
  brightness: -0.02,
  contrast: 0.04,
  noise: 0,
  vignette: 0.48,
}

export function roomFileName(url: string) {
  try {
    return decodeURIComponent(url).replace(/\\/g, '/').split('/').pop() ?? ''
  } catch {
    return url
  }
}

export function isFlashlightHall(url: string) {
  return /^(fnaf|scary_interior)\.(glb|gltf)$/i.test(roomFileName(url))
}

export function isBackrooms(url: string) {
  return /backroom/i.test(roomFileName(url))
}

export function isRainyStreet(url: string) {
  return /rainy|\brain/i.test(roomFileName(url))
}

export function getRoomMood(url: string): RoomMood {
  if (isBackrooms(url)) return BACKROOMS
  if (isRainyStreet(url)) return RAINY_STREET
  return DEFAULT_ROOM
}

export function isLivingRoom(url: string) {
  return /living/i.test(roomFileName(url))
}

export function isVictorian(url: string) {
  return /victorian/i.test(roomFileName(url))
}

export function isJapaneseLoft(url: string) {
  return /japanese|loft/i.test(roomFileName(url))
}

export type RoomAcoustics = {
  decay: number
  preDelay: number
  wetScale: number
  hp: number
  lp: number
  slapTime: number
  slapFeedback: number
  slapWet: number
}

const DRY_SLAP = { slapTime: 0.08, slapFeedback: 0.02, slapWet: 0 }

const STUDIO_ACOUSTICS: RoomAcoustics = {
  decay: 1.2,
  preDelay: 0.008,
  wetScale: 0.62,
  hp: 110,
  lp: 9800,
  ...DRY_SLAP,
}
const LIVING_ACOUSTICS: RoomAcoustics = {
  decay: 0.8,
  preDelay: 0.01,
  wetScale: 0.7,
  hp: 85,
  lp: 3000,
  ...DRY_SLAP,
}
const VICTORIAN_ACOUSTICS: RoomAcoustics = {
  decay: 6.6,
  preDelay: 0.042,
  wetScale: 2.4,
  hp: 48,
  lp: 14500,
  ...DRY_SLAP,
}
const RAINY_ACOUSTICS: RoomAcoustics = {
  decay: 0.42,
  preDelay: 0.085,
  wetScale: 1.1,
  hp: 260,
  lp: 1700,
  slapTime: 0.1,
  slapFeedback: 0.2,
  slapWet: 0.46,
}
const LOFT_ACOUSTICS: RoomAcoustics = {
  decay: 1.7,
  preDelay: 0.014,
  wetScale: 1.2,
  hp: 80,
  lp: 5200,
  ...DRY_SLAP,
}
const FNAF_ACOUSTICS: RoomAcoustics = {
  decay: 3.5,
  preDelay: 0.125,
  wetScale: 1.9,
  hp: 210,
  lp: 2800,
  slapTime: 0.18,
  slapFeedback: 0.26,
  slapWet: 0.48,
}
const BACKROOMS_ACOUSTICS: RoomAcoustics = {
  decay: 8.2,
  preDelay: 0.03,
  wetScale: 2.5,
  hp: 90,
  lp: 4000,
  slapTime: 0.048,
  slapFeedback: 0.12,
  slapWet: 0.22,
}

export function getRoomAcoustics(url: string): RoomAcoustics {
  if (!url) return STUDIO_ACOUSTICS
  if (isBackrooms(url)) return BACKROOMS_ACOUSTICS
  if (isRainyStreet(url)) return RAINY_ACOUSTICS
  if (isFlashlightHall(url)) return FNAF_ACOUSTICS
  if (isVictorian(url)) return VICTORIAN_ACOUSTICS
  if (isLivingRoom(url)) return LIVING_ACOUSTICS
  if (isJapaneseLoft(url)) return LOFT_ACOUSTICS
  return LIVING_ACOUSTICS
}

export function atmosphereKindFromUrl(url: string): 'off' | 'rain' | 'backrooms' | 'fnaf' {
  if (isRainyStreet(url)) return 'rain'
  if (isBackrooms(url)) return 'backrooms'
  if (isFlashlightHall(url)) return 'fnaf'
  return 'off'
}
