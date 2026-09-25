import { player } from '../engine/player'
import { useAppStore } from '../engine/store'
import { LIBRARY, forgetSong, loadLibrarySong, type LibraryEntry } from './library'
import { isAudioFile } from './audioFiles'
import { fetchOnlineMidi, type OnlineMidiHit } from './onlineMidi'
import { rememberPlayed, forgetRecent } from './recent'
import {
  deleteStoredMidi,
  importMidiBuffer,
  importUserMidiFiles,
  isMidiFile,
  userMidiId,
} from './userLibrary'

async function addImportedEntries(entries: LibraryEntry[], status: string): Promise<void> {
  if (!entries.length) {
    useAppStore.getState().setStatus('No playable notes in that file')
    return
  }
  for (const entry of entries) {
    forgetSong(entry.id)
    useAppStore.getState().upsertUserEntry(entry)
  }
  const last = entries[entries.length - 1]
  if (!last) return
  await loadLibrary(last, status)
}

export async function addMidiFiles(files: File[]): Promise<void> {
  const midis = files.filter(isMidiFile)
  if (!midis.length) return
  try {
    const entries = await importUserMidiFiles(midis)
    await addImportedEntries(
      entries,
      entries.length === 1
        ? `Added ${entries[0]?.title ?? 'song'} to your library`
        : `Added ${entries.length} songs to your library`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not import MIDI'
    useAppStore.getState().setStatus(message)
  }
}

export async function addAudioFiles(files: File[]): Promise<void> {
  const audios = files.filter(isAudioFile)
  if (!audios.length) return
  const store = useAppStore.getState()
  player.pause()
  try {
    const entries: LibraryEntry[] = []
    for (const file of audios) {
      store.setTranscribeJob({ name: file.name, pct: 1 })
      store.setStatus(`Transcribing ${file.name}…`)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => window.setTimeout(resolve, 60))
      })
      const { transcribeAudioToMidi } = await import('./transcribeAudio')
      const midiBytes = await transcribeAudioToMidi(await file.arrayBuffer(), file.name, (pct) => {
        useAppStore.getState().setTranscribeJob({ name: file.name, pct })
        useAppStore.getState().setStatus(`Transcribing ${file.name}… ${pct}%`)
      })
      const title = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Transcribed piano'
      const entry = await importMidiBuffer(midiBytes, `${title}.mid`, {
        title,
        composer: 'Transcribed',
        id: userMidiId(`audio-${file.name}`),
      })
      if (entry) entries.push(entry)
    }
    await addImportedEntries(
      entries,
      entries.length === 1
        ? `Transcribed ${entries[0]?.title ?? 'recording'}`
        : `Transcribed ${entries.length} recordings`,
    )
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Could not transcribe audio'
    const message = /backend|initWasm|wasm|worker|fetch|404/i.test(raw)
      ? `Transcriber failed to start${raw ? ` (${raw})` : ''}. Fully quit Nocture : 3D and open it again.`
      : raw
    useAppStore.getState().setStatus(message)
  } finally {
    useAppStore.getState().setTranscribeJob(null)
  }
}

export async function addOnlineHit(hit: OnlineMidiHit): Promise<LibraryEntry | null> {
  try {
    useAppStore.getState().setStatus(`Downloading ${hit.title}…`)
    const bytes = await fetchOnlineMidi(hit.midiUrl)
    const entry = await importMidiBuffer(bytes, `${hit.title}.mid`, {
      title: hit.title,
      composer: hit.composer,
      id: userMidiId(hit.midiUrl),
    })
    await addImportedEntries(
      entry ? [entry] : [],
      `Added ${hit.title}`,
    )
    return entry
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not add that MIDI'
    useAppStore.getState().setStatus(message)
    return null
  }
}

export async function loadLibrary(entry: LibraryEntry, status?: string): Promise<void> {
  try {
    const song = await loadLibrarySong(entry)
    player.load(song)
    useAppStore.getState().setLibraryId(entry.id)
    rememberPlayed(entry)
    useAppStore.getState().setStatus(status ?? `Loaded ${song.name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load song'
    useAppStore.getState().setStatus(message)
  }
}

export async function removeImported(id: string): Promise<void> {
  forgetSong(id)
  forgetRecent(id)
  await deleteStoredMidi(id)
  useAppStore.getState().removeUserEntry(id)
  useAppStore.getState().setStatus('Removed from your library')
}

export function concertLibrary(): LibraryEntry[] {
  return LIBRARY
}
