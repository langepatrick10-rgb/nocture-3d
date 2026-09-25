export const FIRST_MIDI = 21
export const LAST_MIDI = 108
export const KEY_COUNT = LAST_MIDI - FIRST_MIDI + 1

export const WHITE_WIDTH = 0.236
export const WHITE_LENGTH = 1.56
export const WHITE_HEIGHT = 0.2
export const BLACK_WIDTH = 0.138
export const BLACK_LENGTH = 0.98
export const BLACK_HEIGHT = 0.34

const BLACK_PC = new Set([1, 3, 6, 8, 10])
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export type KeySpec = {
  midi: number
  isBlack: boolean
  x: number
  name: string
  octaveLabel: string | null
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PC.has(midi % 12)
}

export function midiToIndex(midi: number): number {
  return midi - FIRST_MIDI
}

export function noteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NAMES[pc]}${octave}`
}

function buildKeys(): KeySpec[] {
  const whites: KeySpec[] = []
  let whiteIndex = 0
  for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
    if (isBlackKey(midi)) continue
    const pc = midi % 12
    whites.push({
      midi,
      isBlack: false,
      x: (whiteIndex + 0.5) * WHITE_WIDTH,
      name: noteName(midi),
      octaveLabel: pc === 0 ? noteName(midi) : null,
    })
    whiteIndex += 1
  }

  const offset = (whiteIndex * WHITE_WIDTH) / 2
  const byMidi = new Map<number, number>()
  for (const key of whites) {
    key.x -= offset
    byMidi.set(key.midi, key.x)
  }

  const blacks: KeySpec[] = []
  for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
    if (!isBlackKey(midi)) continue
    const left = byMidi.get(midi - 1)
    const right = byMidi.get(midi + 1)
    const x =
      left !== undefined && right !== undefined
        ? (left + right) / 2
        : (left ?? right ?? 0)
    blacks.push({
      midi,
      isBlack: true,
      x,
      name: noteName(midi),
      octaveLabel: null,
    })
  }

  return [...whites, ...blacks].sort((a, b) => a.midi - b.midi)
}

export const KEYS: KeySpec[] = buildKeys()
export const KEY_BY_MIDI = new Map(KEYS.map((key) => [key.midi, key]))
export const PIANO_WIDTH = KEYS.filter((key) => !key.isBlack).length * WHITE_WIDTH
