export type OnlineMidiHit = {
  title: string
  composer: string
  source: 'mutopia' | 'bitmidi'
  midiUrl: string
}

function copyBytes(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy.buffer
}

function toArrayBuffer(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) {
    const copy = new Uint8Array(data.byteLength)
    copy.set(new Uint8Array(data))
    return copy.buffer
  }
  if (data instanceof Uint8Array) return copyBytes(data)
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    return copyBytes(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
  }
  if (Array.isArray(data)) return copyBytes(Uint8Array.from(data as number[]))
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: number[] }).data)) {
    return copyBytes(Uint8Array.from((data as { data: number[] }).data))
  }
  throw new Error('Could not read MIDI download')
}

export async function searchOnlineMidi(query: string): Promise<OnlineMidiHit[]> {
  const desktop = window.pianoDesktop
  if (desktop?.searchMidi) return desktop.searchMidi(query)
  const response = await fetch(`/api/midi-search?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('Online search failed')
  return (await response.json()) as OnlineMidiHit[]
}

export async function fetchOnlineMidi(url: string): Promise<ArrayBuffer> {
  const desktop = window.pianoDesktop
  if (desktop?.fetchMidi) return toArrayBuffer(await desktop.fetchMidi(url))
  const response = await fetch(`/api/midi-fetch?url=${encodeURIComponent(url)}`)
  if (!response.ok) throw new Error('Could not download that MIDI file')
  return response.arrayBuffer()
}
