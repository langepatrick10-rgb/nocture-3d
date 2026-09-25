import type { Hand, SongNote } from './song'

type TrackLike = {
  name: string
  channel?: number
  notes: Array<{
    midi: number
    time: number
    duration: number
    velocity: number
  }>
}

const MIDDLE_C = 60
const CHORD_WINDOW = 0.03
const ONE_HAND_SPAN = 12
const SPLIT_GAP = 5

export function handFromTrackName(name: string): Hand | null {
  const n = name.toLowerCase()
  if (/(left\s*hand|\blh\b|l\.h\.|mano sinistra|piano left|left piano)/i.test(n)) return 'left'
  if (/(right\s*hand|\brh\b|r\.h\.|mano destra|piano right|right piano)/i.test(n)) return 'right'
  if (/\bleft\b/.test(n) && !/\bright\b/.test(n)) return 'left'
  if (/\bright\b/.test(n) && !/\bleft\b/.test(n)) return 'right'
  if (/\bbass\b/.test(n) && !/\btreble\b/.test(n)) return 'left'
  if (/\btreble\b/.test(n) && !/\bbass\b/.test(n)) return 'right'
  return null
}

function meanPitch(notes: { midi: number }[]): number {
  return notes.reduce((sum, note) => sum + note.midi, 0) / notes.length
}

export function notesFromMidiTracks(tracks: TrackLike[]): Omit<SongNote, 'hand'>[] {
  const notes: Omit<SongNote, 'hand'>[] = []
  for (const track of tracks) {
    for (const note of track.notes) {
      notes.push({
        midi: note.midi,
        time: note.time,
        duration: Math.max(note.duration, 0.05),
        velocity: Math.min(Math.max(note.velocity, 0.15), 1),
      })
    }
  }
  return notes
}

export function assignHands(tracks: TrackLike[]): SongNote[] {
  const named = tracks.map((track) => handFromTrackName(track.name))
  const hasLeft = named.includes('left')
  const hasRight = named.includes('right')

  if (hasLeft && hasRight) {
    const out: SongNote[] = []
    tracks.forEach((track, index) => {
      const hand = named[index]
      for (const note of track.notes) {
        out.push({
          midi: note.midi,
          time: note.time,
          duration: Math.max(note.duration, 0.05),
          velocity: Math.min(Math.max(note.velocity, 0.15), 1),
          hand: hand ?? (note.midi < MIDDLE_C ? 'left' : 'right'),
        })
      }
    })
    return out
  }

  if (tracks.length === 2 && !hasLeft && !hasRight) {
    const avg0 = meanPitch(tracks[0]!.notes)
    const avg1 = meanPitch(tracks[1]!.notes)
    if (Math.abs(avg0 - avg1) >= 5) {
      const hands: [Hand, Hand] = avg0 < avg1 ? ['left', 'right'] : ['right', 'left']
      const out: SongNote[] = []
      tracks.forEach((track, index) => {
        for (const note of track.notes) {
          out.push({
            midi: note.midi,
            time: note.time,
            duration: Math.max(note.duration, 0.05),
            velocity: Math.min(Math.max(note.velocity, 0.15), 1),
            hand: hands[index]!,
          })
        }
      })
      return out
    }
  }

  return splitByTexture(notesFromMidiTracks(tracks))
}

export function splitByTexture(raw: Omit<SongNote, 'hand'>[]): SongNote[] {
  const sorted = [...raw].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const out: SongNote[] = []
  let lastLeft: number | null = null
  let lastRight: number | null = null
  let i = 0

  while (i < sorted.length) {
    const chord = [sorted[i]!]
    i += 1
    while (i < sorted.length && sorted[i]!.time - chord[0]!.time <= CHORD_WINDOW) {
      chord.push(sorted[i]!)
      i += 1
    }
    chord.sort((a, b) => a.midi - b.midi)
    const hands = handsForChord(
      chord.map((note) => note.midi),
      lastLeft,
      lastRight,
    )
    chord.forEach((note, index) => {
      const hand = hands[index]!
      out.push({ ...note, hand })
      if (hand === 'left') lastLeft = note.midi
      else lastRight = note.midi
    })
  }

  return out
}

function handsForChord(
  pitches: number[],
  lastLeft: number | null,
  lastRight: number | null,
): Hand[] {
  if (pitches.length === 1) {
    return [pickMonophonic(pitches[0]!, lastLeft, lastRight)]
  }

  let gapAt = 0
  let gapSize = -1
  for (let i = 1; i < pitches.length; i++) {
    const gap = pitches[i]! - pitches[i - 1]!
    if (gap > gapSize) {
      gapSize = gap
      gapAt = i
    }
  }

  const span = pitches[pitches.length - 1]! - pitches[0]!
  const canSplit = gapSize >= SPLIT_GAP && gapAt > 0 && gapAt < pitches.length
  if (canSplit && (span > ONE_HAND_SPAN || gapSize >= 7)) {
    return pitches.map((_, index) => (index < gapAt ? 'left' : 'right'))
  }

  const center = pitches.reduce((sum, midi) => sum + midi, 0) / pitches.length
  const hand = pickMonophonic(center, lastLeft, lastRight)
  return pitches.map(() => hand)
}

function pickMonophonic(
  pitch: number,
  lastLeft: number | null,
  lastRight: number | null,
): Hand {
  const dLeft = lastLeft === null ? Number.POSITIVE_INFINITY : Math.abs(pitch - lastLeft)
  const dRight = lastRight === null ? Number.POSITIVE_INFINITY : Math.abs(pitch - lastRight)
  if (Math.min(dLeft, dRight) <= 14 && Math.abs(dLeft - dRight) >= 2) {
    return dLeft < dRight ? 'left' : 'right'
  }
  return pitch < MIDDLE_C ? 'left' : 'right'
}
