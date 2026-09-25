import { useEffect, useMemo, useRef, useState } from 'react'
import { publicUrl } from '../assetUrl'
import { player } from '../engine/player'
import { useAppStore } from '../engine/store'
import {
  addAudioFiles,
  addMidiFiles,
  addOnlineHit,
  concertLibrary,
  loadLibrary,
  removeImported,
} from '../music/libraryActions'
import { searchOnlineMidi, type OnlineMidiHit } from '../music/onlineMidi'
import { onRecentChange, readRecent, type RecentEntry } from '../music/recent'
import type { LibraryEntry } from '../music/library'

type Source = 'recent' | 'concert' | 'yours' | 'online'

const SOURCES: { id: Source; label: string; hint: string }[] = [
  { id: 'recent', label: 'Recently played', hint: 'Songs you opened here' },
  { id: 'concert', label: 'Concert library', hint: 'Built-in piano works' },
  { id: 'yours', label: 'Your library', hint: 'Dropped MIDI and MP3' },
  { id: 'online', label: 'Online Search', hint: 'Find MIDI on the web' },
]

function matches(entry: { title: string; composer: string; genre?: string }, query: string): boolean {
  if (!query) return true
  const hay = `${entry.composer} ${entry.title} ${entry.genre ?? ''}`.toLowerCase()
  return hay.includes(query)
}

function recentToEntry(item: RecentEntry, yours: LibraryEntry[]): LibraryEntry | null {
  if (item.kind === 'user') return yours.find((entry) => entry.id === item.id) ?? null
  return concertLibrary().find((entry) => entry.id === item.id) ?? null
}

export function SongSelect({ open, onClose }: { open: boolean; onClose: () => void }) {
  const midiRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<Source>('concert')
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<RecentEntry[]>(() => readRecent())
  const [onlineHits, setOnlineHits] = useState<OnlineMidiHit[]>([])
  const [onlineStatus, setOnlineStatus] = useState('')
  const libraryId = useAppStore((s) => s.libraryId)
  const userLibrary = useAppStore((s) => s.userLibrary)

  useEffect(() => onRecentChange(() => setRecent(readRecent())), [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || source !== 'online') {
      setOnlineHits([])
      setOnlineStatus('')
      return
    }
    const q = query.trim()
    if (q.length < 2) {
      setOnlineHits([])
      setOnlineStatus('Type at least two letters to search')
      return
    }
    let cancelled = false
    const id = window.setTimeout(() => {
      setOnlineStatus('Searching…')
      void searchOnlineMidi(q)
        .then((hits) => {
          if (cancelled) return
          const seen = new Set<string>()
          const unique = hits.filter((hit) => {
            const key = hit.title.trim().toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          setOnlineHits(unique)
          setOnlineStatus(unique.length ? '' : 'No MIDI found for that search')
        })
        .catch(() => {
          if (cancelled) return
          setOnlineHits([])
          setOnlineStatus('Online search unavailable')
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [open, source, query])

  const concert = useMemo(
    () => concertLibrary().filter((entry) => matches(entry, query.trim().toLowerCase())),
    [query],
  )
  const yours = useMemo(
    () => userLibrary.filter((entry) => matches(entry, query.trim().toLowerCase())),
    [userLibrary, query],
  )
  const recentEntries = useMemo(
    () =>
      recent
        .map((item) => recentToEntry(item, userLibrary))
        .filter((entry): entry is LibraryEntry => Boolean(entry))
        .filter((entry) => matches(entry, query.trim().toLowerCase())),
    [recent, userLibrary, query],
  )

  if (!open) return null

  const groupedConcert = new Map<string, LibraryEntry[]>()
  for (const entry of concert) {
    const list = groupedConcert.get(entry.composer) ?? []
    list.push(entry)
    groupedConcert.set(entry.composer, list)
  }

  const play = async (entry: LibraryEntry, closeAfter: boolean) => {
    await loadLibrary(entry)
    if (closeAfter) onClose()
    void player.play()
  }

  return (
    <div className="song-select" role="dialog" aria-label="Select a song">
      <img className="song-select-art" src={publicUrl('cover.png')} alt="" />
      <button type="button" className="song-select-shade" aria-label="Close song hall" onClick={onClose} />
      <aside className="song-rail">
        <p>Sources</p>
        {SOURCES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={source === item.id ? 'is-on' : ''}
            onClick={() => {
              if (item.id === source) return
              setSource(item.id)
              setQuery('')
              setOnlineHits([])
              setOnlineStatus('')
            }}
          >
            <span>{item.label}</span>
            <small>{item.hint}</small>
          </button>
        ))}
        <div className="song-rail-actions">
          <button type="button" onClick={() => midiRef.current?.click()}>
            Import MIDI
          </button>
          <button type="button" onClick={() => audioRef.current?.click()}>
            Import MP3
          </button>
        </div>
      </aside>
      <section className="song-main">
        <header className="song-head">
          <div>
            <small>Nocture : 3D</small>
            <strong>Select a performance</strong>
          </div>
          <button type="button" className="song-close" onClick={onClose}>
            Close
          </button>
        </header>
        <input
          className="song-search"
          type="search"
          placeholder={source === 'online' ? 'Search online MIDI…' : 'Search titles and composers'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        {source === 'concert' && !query && recentEntries.length > 0 ? (
          <div className="song-recent-wrap">
            <p>Recently played</p>
            <div className="song-recent">
              {recentEntries.slice(0, 3).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={libraryId === entry.id ? 'is-on' : ''}
                  onClick={() => void play(entry, true)}
                >
                  <span>{entry.title}</span>
                  <small>{entry.composer}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="song-list">
          {source === 'concert'
            ? [...groupedConcert.entries()].map(([composer, songs]) => (
                <div key={composer} className="song-group">
                  <p>{composer}</p>
                  {songs.map((entry) => (
                    <SongRow
                      key={entry.id}
                      title={entry.title}
                      meta={`${entry.genre} · Concert`}
                      active={libraryId === entry.id}
                      onPlay={() => void play(entry, false)}
                      onSelect={() => void play(entry, true)}
                    />
                  ))}
                </div>
              ))
            : null}

          {source === 'yours'
            ? yours.map((entry) => (
                <SongRow
                  key={entry.id}
                  title={entry.title}
                  meta={entry.composer}
                  active={libraryId === entry.id}
                  onPlay={() => void play(entry, false)}
                  onSelect={() => void play(entry, true)}
                  onRemove={() => void removeImported(entry.id)}
                />
              ))
            : null}

          {source === 'recent'
            ? recentEntries.map((entry) => (
                <SongRow
                  key={entry.id}
                  title={entry.title}
                  meta={entry.composer}
                  active={libraryId === entry.id}
                  onPlay={() => void play(entry, false)}
                  onSelect={() => void play(entry, true)}
                />
              ))
            : null}

          {source === 'online'
            ? onlineHits.map((hit) => (
                <SongRow
                  key={hit.midiUrl}
                  title={hit.title}
                  onPlay={() =>
                    void addOnlineHit(hit).then((entry) => {
                      if (entry) void player.play()
                    })
                  }
                  onSelect={() =>
                    void addOnlineHit(hit).then((entry) => {
                      if (!entry) return
                      void player.play()
                      onClose()
                    })
                  }
                />
              ))
            : null}

          {source === 'concert' && !concert.length ? (
            <p className="song-empty">No concert pieces match that search.</p>
          ) : null}
          {source === 'yours' && !yours.length ? (
            <p className="song-empty">Drop MIDI or MP3 files, or use Import on the left.</p>
          ) : null}
          {source === 'recent' && !recentEntries.length ? (
            <p className="song-empty">Play a song and it will land here.</p>
          ) : null}
          {onlineStatus ? <p className="song-empty">{onlineStatus}</p> : null}
        </div>
      </section>
      <input
        ref={midiRef}
        type="file"
        accept=".mid,.midi,audio/midi"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          if (files.length) {
            setSource('yours')
            void addMidiFiles(files)
          }
          event.target.value = ''
        }}
      />
      <input
        ref={audioRef}
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,audio/mpeg,audio/wav,audio/mp4"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          if (files.length) {
            setSource('yours')
            void addAudioFiles(files)
          }
          event.target.value = ''
        }}
      />
    </div>
  )
}

function SongRow({
  title,
  meta,
  active,
  onPlay,
  onSelect,
  onRemove,
}: {
  title: string
  meta?: string
  active?: boolean
  onPlay: () => void
  onSelect: () => void
  onRemove?: () => void
}) {
  return (
    <div className={`song-row${active ? ' is-on' : ''}`}>
      <button type="button" className="song-pick" onClick={onSelect}>
        <span>{title}</span>
        {meta ? <small>{meta}</small> : null}
      </button>
      <button type="button" className="song-preview" onClick={onPlay}>
        Play
      </button>
      {onRemove ? (
        <button type="button" className="song-remove" aria-label={`Remove ${title}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </div>
  )
}
