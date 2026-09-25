import type { LibraryEntry } from './library'
import { parseMidiArrayBuffer } from './parseMidi'

const DB_NAME = 'piano3d'
const STORE = 'user-midi'
const VERSION = 1

export type StoredMidi = {
  id: string
  title: string
  composer: string
  fileName: string
  addedAt: number
  bytes: ArrayBuffer
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open library'))
  })
}

function wait<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Library request failed'))
  })
}

export function isMidiFile(file: File): boolean {
  return /\.mid(i)?$/i.test(file.name) || file.type === 'audio/midi' || file.type === 'audio/mid'
}

function slugFromName(fileName: string): string {
  const slug = fileName
    .replace(/\.mid(i)?$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'song'
}

export function userMidiId(key: string): string {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619)
  return `user-${slugFromName(key)}-${(hash >>> 0).toString(16)}`
}

function metaFromNames(fileName: string, midiName: string): { title: string; composer: string } {
  const base = fileName.replace(/\.mid(i)?$/i, '').replace(/[_]+/g, ' ').trim()
  const parts = base.split(/\s+-\s+/)
  if (parts.length >= 2) {
    return { composer: parts[0] ?? 'Imported', title: parts.slice(1).join(' - ') }
  }
  return { composer: 'Imported', title: midiName || base || 'Imported MIDI' }
}

export function entryFromStored(record: StoredMidi): LibraryEntry {
  return {
    id: record.id,
    title: record.title,
    composer: record.composer,
    genre: 'Yours',
    kind: 'user',
  }
}

export async function listStoredMidi(): Promise<StoredMidi[]> {
  const db = await openDb()
  try {
    const records = await wait(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())
    return (records as StoredMidi[]).sort((a, b) => b.addedAt - a.addedAt)
  } finally {
    db.close()
  }
}

export async function getStoredMidi(id: string): Promise<StoredMidi | undefined> {
  const db = await openDb()
  try {
    return (await wait(db.transaction(STORE, 'readonly').objectStore(STORE).get(id))) as
      | StoredMidi
      | undefined
  } finally {
    db.close()
  }
}

export async function saveStoredMidi(record: StoredMidi): Promise<void> {
  const db = await openDb()
  try {
    await wait(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record))
  } finally {
    db.close()
  }
}

export async function deleteStoredMidi(id: string): Promise<void> {
  const db = await openDb()
  try {
    await wait(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
  } finally {
    db.close()
  }
}

export async function importMidiBuffer(
  bytes: ArrayBuffer,
  fileName: string,
  extra?: { title?: string; composer?: string; id?: string },
): Promise<LibraryEntry | null> {
  const parsed = await parseMidiArrayBuffer(bytes.slice(0), fileName)
  if (!parsed.notes.length) return null
  const meta = metaFromNames(fileName, parsed.name)
  const record: StoredMidi = {
    id: extra?.id ?? `user-${slugFromName(fileName)}`,
    title: extra?.title ?? meta.title,
    composer: extra?.composer ?? meta.composer,
    fileName,
    addedAt: Date.now(),
    bytes: bytes.slice(0),
  }
  await saveStoredMidi(record)
  return entryFromStored(record)
}

export async function importUserMidiFiles(files: File[]): Promise<LibraryEntry[]> {
  const entries: LibraryEntry[] = []
  for (const file of files) {
    if (!isMidiFile(file)) continue
    const entry = await importMidiBuffer(await file.arrayBuffer(), file.name)
    if (entry) entries.push(entry)
  }
  return entries
}
