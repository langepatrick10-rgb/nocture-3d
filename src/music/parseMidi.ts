import { Midi } from '@tonejs/midi'
import { LAST_MIDI, FIRST_MIDI } from './layout'
import { assignHands } from './hands'
import { buildSong, type ParsedSong } from './song'

export async function parseMidiArrayBuffer(
  buffer: ArrayBuffer,
  name: string,
): Promise<ParsedSong> {
  const midi = new Midi(buffer)
  const tracks = midi.tracks
    .filter((track) => track.notes.length > 0)
    .map((track) => ({
      name: track.name ?? '',
      channel: track.channel,
      notes: track.notes.filter((note) => note.midi >= FIRST_MIDI && note.midi <= LAST_MIDI),
    }))

  const notes = assignHands(tracks)
  const songName = midi.name?.trim() || name.replace(/\.mid(i)?$/i, '')
  return buildSong(songName, notes)
}
