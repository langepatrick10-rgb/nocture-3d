import { DEMO_SONGS } from './demos'
import { buildSong, type ParsedSong, type SongNote } from './song'
import libraryData from './library-data.json'
import { parseMidiArrayBuffer } from './parseMidi'
import { getStoredMidi } from './userLibrary'

export type LibraryEntry = {
  id: string
  title: string
  composer: string
  genre: 'Practice' | 'Classical' | 'Yours'
  kind: 'builtin' | 'midi' | 'user'
}

type RawSong = {
  name: string
  notes: SongNote[]
}

const BUNDLED = libraryData as Record<string, RawSong>
const cache = new Map<string, ParsedSong>()

const BUILTINS: LibraryEntry[] = [
  { id: 'ode', title: 'Ode to Joy', composer: 'Beethoven', genre: 'Practice', kind: 'builtin' },
  { id: 'scale', title: 'C Major Scale', composer: 'Practice', genre: 'Practice', kind: 'builtin' },
  { id: 'chords', title: 'Chord Practice', composer: 'Practice', genre: 'Practice', kind: 'builtin' },
]

const MIDI_META: Record<string, Omit<LibraryEntry, 'id' | 'kind'>> = {
  elise: { title: 'Für Elise', composer: 'Beethoven', genre: 'Classical' },
  moonlight: { title: 'Moonlight Sonata, I', composer: 'Beethoven', genre: 'Classical' },
  moonlight3: { title: 'Moonlight Sonata, III', composer: 'Beethoven', genre: 'Classical' },
  pathetique: { title: 'Pathétique Sonata, II', composer: 'Beethoven', genre: 'Classical' },
  bach846: { title: 'Prelude in C, BWV 846', composer: 'Bach', genre: 'Classical' },
  bach847: { title: 'Prelude in C minor, BWV 847', composer: 'Bach', genre: 'Classical' },
  bach850: { title: 'Prelude in D, BWV 850', composer: 'Bach', genre: 'Classical' },
  k545: { title: 'Sonata K.545, I', composer: 'Mozart', genre: 'Classical' },
  turca: { title: 'Rondo Alla Turca', composer: 'Mozart', genre: 'Classical' },
  p4: { title: 'Prelude in E minor, Op. 28 No. 4', composer: 'Chopin', genre: 'Classical' },
  p7: { title: 'Prelude in A major, Op. 28 No. 7', composer: 'Chopin', genre: 'Classical' },
  p20: { title: 'Prelude in C minor, Op. 28 No. 20', composer: 'Chopin', genre: 'Classical' },
  raindrop: { title: 'Raindrop Prelude', composer: 'Chopin', genre: 'Classical' },
  nocturne: { title: 'Nocturne in D-flat, Op. 27 No. 2', composer: 'Chopin', genre: 'Classical' },
  waltz: { title: 'Grande Valse Brillante, Op. 18', composer: 'Chopin', genre: 'Classical' },
  fantaisie: { title: 'Fantaisie-Impromptu', composer: 'Chopin', genre: 'Classical' },
  revolutionary: { title: 'Revolutionary Étude', composer: 'Chopin', genre: 'Classical' },
  clair: { title: 'Clair de lune', composer: 'Debussy', genre: 'Classical' },
  prel: { title: 'Prélude from Suite bergamasque', composer: 'Debussy', genre: 'Classical' },
  traeumerei: { title: 'Träumerei', composer: 'Schumann', genre: 'Classical' },
  kinderszenen: { title: 'Von fremden Ländern und Menschen', composer: 'Schumann', genre: 'Classical' },
  bird: { title: 'Little Bird, Op. 43 No. 4', composer: 'Grieg', genre: 'Classical' },
  butterfly: { title: 'Butterfly', composer: 'Grieg', genre: 'Classical' },
  pearls: { title: 'The Pearls', composer: 'Burgmüller', genre: 'Classical' },
  arabesqueb: { title: 'The Clear Stream', composer: 'Burgmüller', genre: 'Classical' },
  liebestraum: { title: 'Liebestraum No. 3', composer: 'Liszt', genre: 'Classical' },
  unsospiro: { title: 'Un sospiro', composer: 'Liszt', genre: 'Classical' },
  brahms: { title: 'Intermezzo in E-flat, Op. 117 No. 1', composer: 'Brahms', genre: 'Classical' },
  gondola: { title: 'Venetian Gondola Song', composer: 'Mendelssohn', genre: 'Classical' },
  june: { title: 'June (Barcarolle)', composer: 'Tchaikovsky', genre: 'Classical' },
  imp: { title: 'Impromptu No. 3', composer: 'Schubert', genre: 'Classical' },
  promenade: { title: 'Promenade', composer: 'Mussorgsky', genre: 'Classical' },
}

export const LIBRARY: LibraryEntry[] = [
  ...BUILTINS,
  ...Object.keys(BUNDLED)
    .filter((id) => MIDI_META[id] && BUNDLED[id]?.notes?.length)
    .map((id) => ({ id, kind: 'midi' as const, ...MIDI_META[id] })),
]

export function forgetSong(id: string): void {
  cache.delete(id)
}

export async function loadLibrarySong(entry: LibraryEntry): Promise<ParsedSong> {
  if (entry.kind === 'builtin') {
    const song = DEMO_SONGS.find((item) => item.name === entry.title)
    if (!song) throw new Error(`Missing built-in song ${entry.title}`)
    return song
  }
  const hit = cache.get(entry.id)
  if (hit) return hit
  if (entry.kind === 'user') {
    const rec = await getStoredMidi(entry.id)
    if (!rec?.bytes) throw new Error(`Missing imported song ${entry.title}`)
    const parsed = await parseMidiArrayBuffer(rec.bytes.slice(0), rec.fileName)
    const song = buildSong(displayName(entry), parsed.notes)
    cache.set(entry.id, song)
    return song
  }
  const raw = BUNDLED[entry.id]
  if (!raw?.notes?.length) throw new Error(`Missing song ${entry.title}`)
  const song = buildSong(displayName(entry), raw.notes)
  cache.set(entry.id, song)
  return song
}

export function displayName(entry: LibraryEntry): string {
  if (entry.composer === 'Practice') return entry.title
  return `${entry.composer} — ${entry.title}`
}

export function entryForSongName(name: string): LibraryEntry | undefined {
  return LIBRARY.find((entry) => displayName(entry) === name || entry.title === name)
}
