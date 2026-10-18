const KEY = 'piano3d-recent'
const MAX = 18

export type RecentEntry = {
  id: string
  title: string
  composer: string
  genre: string
  kind: 'builtin' | 'midi' | 'user' | 'online'
  playedAt: number
  midiUrl?: string
}

function emit(): void {
  window.dispatchEvent(new Event('piano3d-recent'))
}

export function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as RecentEntry[]) : []
    return parsed.filter((item) => item?.id && item.title)
  } catch {
    return []
  }
}

export function rememberPlayed(entry: {
  id: string
  title: string
  composer: string
  genre: string
  kind: 'builtin' | 'midi' | 'user' | 'online'
  midiUrl?: string
}): void {
  const next = [
    {
      id: entry.id,
      title: entry.title,
      composer: entry.composer,
      genre: entry.genre,
      kind: entry.kind,
      midiUrl: entry.midiUrl,
      playedAt: Date.now(),
    },
    ...readRecent().filter((item) => item.id !== entry.id),
  ].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
  emit()
}

export function forgetRecent(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(readRecent().filter((item) => item.id !== id)))
  emit()
}

export function onRecentChange(callback: () => void): () => void {
  window.addEventListener('piano3d-recent', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('piano3d-recent', callback)
    window.removeEventListener('storage', callback)
  }
}
