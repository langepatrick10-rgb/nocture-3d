export type Hand = 'left' | 'right'

export type SongNote = {
  midi: number
  time: number
  duration: number
  velocity: number
  hand: Hand
}

export type OnsetGroup = {
  time: number
  notes: SongNote[]
}

export type ParsedSong = {
  name: string
  duration: number
  notes: SongNote[]
  groups: OnsetGroup[]
}

const GROUP_WINDOW = 0.045

export function buildSong(name: string, notes: SongNote[]): ParsedSong {
  const sorted = [...notes].sort(
    (a, b) => a.time - b.time || a.midi - b.midi,
  )
  const duration =
    sorted.reduce((max, note) => Math.max(max, note.time + note.duration), 0) +
    0.6
  return {
    name,
    duration,
    notes: sorted,
    groups: groupOnsets(sorted),
  }
}

export function groupOnsets(notes: SongNote[]): OnsetGroup[] {
  const groups: OnsetGroup[] = []
  for (const note of notes) {
    const last = groups[groups.length - 1]
    if (last && note.time - last.time <= GROUP_WINDOW) {
      last.notes.push(note)
    } else {
      groups.push({ time: note.time, notes: [note] })
    }
  }
  return groups
}

export function notesForHands(notes: SongNote[], hands: 'both' | Hand): SongNote[] {
  if (hands === 'both') return notes
  return notes.filter((note) => note.hand === hands)
}

export function groupsForHands(
  groups: OnsetGroup[],
  hands: 'both' | Hand,
): OnsetGroup[] {
  if (hands === 'both') return groups
  const filtered: OnsetGroup[] = []
  for (const group of groups) {
    const notes = group.notes.filter((note) => note.hand === hands)
    if (notes.length > 0) filtered.push({ time: group.time, notes })
  }
  return filtered
}

export function firstNoteAtOrAfter(notes: SongNote[], time: number): number {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (notes[mid].time < time) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function firstPossiblyActive(notes: SongNote[], time: number, pad = 16): number {
  return firstNoteAtOrAfter(notes, time - pad)
}
