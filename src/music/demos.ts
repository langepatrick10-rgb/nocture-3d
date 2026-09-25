import { buildSong, type ParsedSong, type SongNote } from './song'

const BEAT = 0.48

type BeatNote = {
  midi: number
  beat: number
  dur: number
  hand: SongNote['hand']
  velocity?: number
}

function fromBeats(name: string, events: BeatNote[]): ParsedSong {
  const notes: SongNote[] = events.map((event) => ({
    midi: event.midi,
    time: event.beat * BEAT,
    duration: event.dur * BEAT,
    velocity: event.velocity ?? 0.78,
    hand: event.hand,
  }))
  return buildSong(name, notes)
}

function melody(
  startBeat: number,
  seq: Array<[number, number]>,
  hand: SongNote['hand'] = 'right',
): BeatNote[] {
  const out: BeatNote[] = []
  let beat = startBeat
  for (const [midi, dur] of seq) {
    out.push({ midi, beat, dur, hand })
    beat += dur
  }
  return out
}

export const DEMO_SONGS: ParsedSong[] = [
  fromBeats('Ode to Joy', [
    ...melody(0, [
      [64, 1],
      [64, 1],
      [65, 1],
      [67, 1],
      [67, 1],
      [65, 1],
      [64, 1],
      [62, 1],
      [60, 1],
      [60, 1],
      [62, 1],
      [64, 1],
      [64, 1.5],
      [62, 0.5],
      [62, 2],
      [64, 1],
      [64, 1],
      [65, 1],
      [67, 1],
      [67, 1],
      [65, 1],
      [64, 1],
      [62, 1],
      [60, 1],
      [60, 1],
      [62, 1],
      [64, 1],
      [62, 1.5],
      [60, 0.5],
      [60, 2],
    ]),
    ...melody(
      0,
      [
        [48, 2],
        [43, 2],
        [45, 2],
        [47, 2],
        [48, 2],
        [43, 2],
        [48, 2],
        [43, 2],
        [48, 2],
        [43, 2],
        [45, 2],
        [47, 2],
        [48, 2],
        [43, 2],
        [48, 4],
      ],
      'left',
    ),
    ...melody(
      0,
      [
        [52, 2],
        [50, 2],
        [53, 2],
        [55, 2],
        [52, 2],
        [50, 2],
        [52, 2],
        [50, 2],
        [52, 2],
        [50, 2],
        [53, 2],
        [55, 2],
        [52, 2],
        [50, 2],
        [52, 4],
      ],
      'left',
    ),
  ]),
  fromBeats('C Major Scale', [
    ...melody(0, [
      [60, 1],
      [62, 1],
      [64, 1],
      [65, 1],
      [67, 1],
      [69, 1],
      [71, 1],
      [72, 2],
      [71, 1],
      [69, 1],
      [67, 1],
      [65, 1],
      [64, 1],
      [62, 1],
      [60, 2],
    ]),
    ...melody(
      0,
      [
        [48, 2],
        [50, 2],
        [52, 2],
        [48, 2],
        [47, 2],
        [45, 2],
        [43, 2],
        [48, 2],
      ],
      'left',
    ),
  ]),
  fromBeats('Chord Practice', [
    { midi: 60, beat: 0, dur: 2, hand: 'right' },
    { midi: 64, beat: 0, dur: 2, hand: 'right' },
    { midi: 67, beat: 0, dur: 2, hand: 'right' },
    { midi: 48, beat: 0, dur: 2, hand: 'left' },
    { midi: 55, beat: 2, dur: 2, hand: 'right' },
    { midi: 59, beat: 2, dur: 2, hand: 'right' },
    { midi: 62, beat: 2, dur: 2, hand: 'right' },
    { midi: 43, beat: 2, dur: 2, hand: 'left' },
    { midi: 57, beat: 4, dur: 2, hand: 'right' },
    { midi: 60, beat: 4, dur: 2, hand: 'right' },
    { midi: 64, beat: 4, dur: 2, hand: 'right' },
    { midi: 45, beat: 4, dur: 2, hand: 'left' },
    { midi: 53, beat: 6, dur: 2, hand: 'right' },
    { midi: 57, beat: 6, dur: 2, hand: 'right' },
    { midi: 60, beat: 6, dur: 2, hand: 'right' },
    { midi: 41, beat: 6, dur: 2, hand: 'left' },
    { midi: 60, beat: 8, dur: 2, hand: 'right' },
    { midi: 64, beat: 8, dur: 2, hand: 'right' },
    { midi: 67, beat: 8, dur: 2, hand: 'right' },
    { midi: 48, beat: 8, dur: 2, hand: 'left' },
  ]),
]

export const DEFAULT_SONG = DEMO_SONGS[0]
