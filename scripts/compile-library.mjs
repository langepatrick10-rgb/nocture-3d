import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import MidiPkg from '@tonejs/midi'
const Midi = MidiPkg.Midi ?? MidiPkg

const root = dirname(fileURLToPath(import.meta.url))
const midiDir = join(root, '../public/library')
const FIRST = 21
const LAST = 108

const catalog = [
  { id: 'elise', file: 'elise.mid', title: 'Für Elise', composer: 'Beethoven' },
  { id: 'moonlight', file: 'moonlight-1.mid', title: 'Moonlight Sonata, I', composer: 'Beethoven' },
  { id: 'moonlight3', file: 'beethoven-moonlight-3.mid', title: 'Moonlight Sonata, III', composer: 'Beethoven' },
  { id: 'pathetique', file: 'beethoven-pathetique-2.mid', title: 'Pathétique Sonata, II', composer: 'Beethoven' },
  { id: 'bach846', file: 'bach-wtc-prelude-1.mid', title: 'Prelude in C, BWV 846', composer: 'Bach' },
  { id: 'bach847', file: 'bach-wtc-prelude-2.mid', title: 'Prelude in C minor, BWV 847', composer: 'Bach' },
  { id: 'bach850', file: 'bach-wtc-prelude-5.mid', title: 'Prelude in D, BWV 850', composer: 'Bach' },
  { id: 'k545', file: 'mozart-k545-1.mid', title: 'Sonata K.545, I', composer: 'Mozart' },
  { id: 'turca', file: 'mozart-alla-turca.mid', title: 'Rondo Alla Turca', composer: 'Mozart' },
  { id: 'p4', file: 'chopin-prelude-e-minor.mid', title: 'Prelude in E minor, Op. 28 No. 4', composer: 'Chopin' },
  { id: 'p7', file: 'chopin-prelude-a-major.mid', title: 'Prelude in A major, Op. 28 No. 7', composer: 'Chopin' },
  { id: 'p20', file: 'chopin-prelude-c-minor.mid', title: 'Prelude in C minor, Op. 28 No. 20', composer: 'Chopin' },
  { id: 'raindrop', file: 'chopin-raindrop.mid', title: 'Raindrop Prelude', composer: 'Chopin' },
  { id: 'nocturne', file: 'chopin-nocturne-op27-2.mid', title: 'Nocturne in D-flat, Op. 27 No. 2', composer: 'Chopin' },
  { id: 'waltz', file: 'chopin-waltz-op18.mid', title: 'Grande Valse Brillante, Op. 18', composer: 'Chopin' },
  { id: 'fantaisie', file: 'chopin-fantaisie-impromptu.mid', title: 'Fantaisie-Impromptu', composer: 'Chopin' },
  { id: 'revolutionary', file: 'chopin-revolutionary.mid', title: 'Revolutionary Étude', composer: 'Chopin' },
  { id: 'clair', file: 'debussy-clair-de-lune.mid', title: 'Clair de lune', composer: 'Debussy' },
  { id: 'prel', file: 'debussy-prelude.mid', title: 'Prélude from Suite bergamasque', composer: 'Debussy' },
  { id: 'traeumerei', file: 'schumann-traeumerei.mid', title: 'Träumerei', composer: 'Schumann' },
  { id: 'kinderszenen', file: 'schumann-von-fremden-laendern.mid', title: 'Von fremden Ländern und Menschen', composer: 'Schumann' },
  { id: 'bird', file: 'grieg-little-bird.mid', title: 'Little Bird, Op. 43 No. 4', composer: 'Grieg' },
  { id: 'butterfly', file: 'grieg-butterfly.mid', title: 'Butterfly', composer: 'Grieg' },
  { id: 'pearls', file: 'burgmuller-the-pearls.mid', title: 'The Pearls', composer: 'Burgmüller' },
  { id: 'arabesqueb', file: 'burgmuller-spring.mid', title: 'The Clear Stream', composer: 'Burgmüller' },
  { id: 'liebestraum', file: 'liszt-liebestraum-3.mid', title: 'Liebestraum No. 3', composer: 'Liszt' },
  { id: 'unsospiro', file: 'liszt-un-sospiro.mid', title: 'Un sospiro', composer: 'Liszt' },
  { id: 'brahms', file: 'brahms-intermezzo-op117-1.mid', title: 'Intermezzo in E-flat, Op. 117 No. 1', composer: 'Brahms' },
  { id: 'gondola', file: 'mendelssohn-gondola.mid', title: 'Venetian Gondola Song', composer: 'Mendelssohn' },
  { id: 'june', file: 'tchaikovsky-june.mid', title: 'June (Barcarolle)', composer: 'Tchaikovsky' },
  { id: 'imp', file: 'schubert-impromptu-3.mid', title: 'Impromptu No. 3', composer: 'Schubert' },
  { id: 'promenade', file: 'mussorgsky-promenade.mid', title: 'Promenade', composer: 'Mussorgsky' },
]

const MIDDLE_C = 60
const CHORD_WINDOW = 0.03
const ONE_HAND_SPAN = 12
const SPLIT_GAP = 5

function handFromTrackName(name) {
  const n = name.toLowerCase()
  if (/(left\s*hand|\blh\b|l\.h\.|mano sinistra|piano left|left piano)/i.test(n)) return 'left'
  if (/(right\s*hand|\brh\b|r\.h\.|mano destra|piano right|right piano)/i.test(n)) return 'right'
  if (/\bleft\b/.test(n) && !/\bright\b/.test(n)) return 'left'
  if (/\bright\b/.test(n) && !/\bleft\b/.test(n)) return 'right'
  if (/\bbass\b/.test(n) && !/\btreble\b/.test(n)) return 'left'
  if (/\btreble\b/.test(n) && !/\bbass\b/.test(n)) return 'right'
  return null
}

function meanPitch(notes) {
  return notes.reduce((sum, note) => sum + note.midi, 0) / notes.length
}

function pickMonophonic(pitch, lastLeft, lastRight) {
  const dLeft = lastLeft === null ? Number.POSITIVE_INFINITY : Math.abs(pitch - lastLeft)
  const dRight = lastRight === null ? Number.POSITIVE_INFINITY : Math.abs(pitch - lastRight)
  if (Math.min(dLeft, dRight) <= 14 && Math.abs(dLeft - dRight) >= 2) {
    return dLeft < dRight ? 'left' : 'right'
  }
  return pitch < MIDDLE_C ? 'left' : 'right'
}

function handsForChord(pitches, lastLeft, lastRight) {
  if (pitches.length === 1) return [pickMonophonic(pitches[0], lastLeft, lastRight)]
  let gapAt = 0
  let gapSize = -1
  for (let i = 1; i < pitches.length; i++) {
    const gap = pitches[i] - pitches[i - 1]
    if (gap > gapSize) {
      gapSize = gap
      gapAt = i
    }
  }
  const span = pitches[pitches.length - 1] - pitches[0]
  if (gapSize >= SPLIT_GAP && gapAt > 0 && (span > ONE_HAND_SPAN || gapSize >= 7)) {
    return pitches.map((_, index) => (index < gapAt ? 'left' : 'right'))
  }
  const center = pitches.reduce((sum, midi) => sum + midi, 0) / pitches.length
  const hand = pickMonophonic(center, lastLeft, lastRight)
  return pitches.map(() => hand)
}

function splitByTexture(raw) {
  const sorted = [...raw].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const out = []
  let lastLeft = null
  let lastRight = null
  let i = 0
  while (i < sorted.length) {
    const chord = [sorted[i]]
    i += 1
    while (i < sorted.length && sorted[i].time - chord[0].time <= CHORD_WINDOW) {
      chord.push(sorted[i])
      i += 1
    }
    chord.sort((a, b) => a.midi - b.midi)
    const hands = handsForChord(
      chord.map((note) => note.midi),
      lastLeft,
      lastRight,
    )
    chord.forEach((note, index) => {
      const hand = hands[index]
      out.push({ ...note, hand })
      if (hand === 'left') lastLeft = note.midi
      else lastRight = note.midi
    })
  }
  return out
}

function assignNoteHands(tracks) {
  const named = tracks.map((track) => handFromTrackName(track.name))
  const hasLeft = named.includes('left')
  const hasRight = named.includes('right')
  if (hasLeft && hasRight) {
    const out = []
    tracks.forEach((track, index) => {
      const hand = named[index]
      for (const note of track.notes) {
        out.push({ ...note, hand: hand ?? (note.midi < MIDDLE_C ? 'left' : 'right') })
      }
    })
    return out
  }
  if (tracks.length === 2 && !hasLeft && !hasRight) {
    const avg0 = meanPitch(tracks[0].notes)
    const avg1 = meanPitch(tracks[1].notes)
    if (Math.abs(avg0 - avg1) >= 5) {
      const hands = avg0 < avg1 ? ['left', 'right'] : ['right', 'left']
      const out = []
      tracks.forEach((track, index) => {
        for (const note of track.notes) out.push({ ...note, hand: hands[index] })
      })
      return out
    }
  }
  return splitByTexture(tracks.flatMap((track) => track.notes))
}

function round(value) {
  return Math.round(value * 1000) / 1000
}

const songs = {}
for (const entry of catalog) {
  const filePath = join(midiDir, entry.file)
  if (!existsSync(filePath)) {
    console.log('SKIP', entry.id)
    continue
  }
  const midi = new Midi(readFileSync(filePath))
  const tracks = midi.tracks
    .filter((track) => track.notes.length > 0)
    .map((track) => ({
      name: track.name ?? '',
      notes: track.notes
        .filter((note) => note.midi >= FIRST && note.midi <= LAST)
        .map((note) => ({
          midi: note.midi,
          time: round(note.time),
          duration: round(Math.max(note.duration, 0.05)),
          velocity: round(Math.min(Math.max(note.velocity, 0.15), 1)),
        })),
    }))
  const notes = assignNoteHands(tracks)
  notes.sort((a, b) => a.time - b.time || a.midi - b.midi)
  songs[entry.id] = {
    name: `${entry.composer} — ${entry.title}`,
    notes,
  }
  console.log(entry.id, notes.length, 'notes')
}

writeFileSync(join(root, '../src/music/library-data.json'), JSON.stringify(songs))
console.log('wrote library-data.json')
