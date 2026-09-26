import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { publicUrl } from '../assetUrl'
import { ATMOSPHERE_REV, setAtmosphere } from '../engine/atmosphere'
import { playFlashlightClick } from '../engine/sfx'
import { ensureAudio, setReverbWet, setRoomAcoustics } from '../engine/audio'
import { player } from '../engine/player'
import { startRecording, stopRecording } from '../engine/recorder'
import { useRoomStore } from '../engine/roomStore'
import { CAMERA_LABELS, useAppStore, type CameraMode } from '../engine/store'
import { connectWebMidi } from '../engine/webmidi'
import { isAudioFile } from '../music/audioFiles'
import { addAudioFiles, addMidiFiles } from '../music/libraryActions'
import { entryFromStored, isMidiFile, listStoredMidi } from '../music/userLibrary'
import { PIANOS } from '../scene/look'
import { atmosphereKindFromUrl, isFlashlightHall } from '../scene/roomMood'
import { SongSelect } from './SongSelect'

const PC_KEYS: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
}

function blurMenuSelects(root: HTMLElement | null) {
  if (!root) return
  for (const select of root.querySelectorAll('select')) select.blur()
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}

async function toggleFullscreen(): Promise<boolean> {
  const desktop = window.pianoDesktop
  if (desktop) return desktop.toggleFullscreen()
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return false
    }
    await document.documentElement.requestFullscreen()
    return true
  } catch {
    return Boolean(document.fullscreenElement)
  }
}

function Transport() {
  const song = useAppStore((s) => s.song)
  const songTime = useAppStore((s) => s.songTime)
  const playing = useAppStore((s) => s.playing)
  const duration = Math.max(song.duration, 0.001)
  const seekPct = `${Math.min(100, Math.max(0, (songTime / duration) * 100))}%`
  return (
    <div className="transport-dock">
      <div className="hud-transport">
        <div className="transport-actions">
          <button type="button" className="play" onClick={() => void player.toggle()}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              player.pause()
              player.seek(0)
            }}
          >
            Stop
          </button>
        </div>
        <span className="time">
          <em>{formatTime(songTime)}</em>
          <i />
          {formatTime(song.duration)}
        </span>
        <input
          className="seek"
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={Math.min(songTime, duration)}
          style={{ '--seek': seekPct } as CSSProperties}
          onChange={(event) => player.seek(Number(event.target.value))}
        />
      </div>
    </div>
  )
}

export function Overlay() {
  const menuRef = useRef<HTMLElement>(null)
  const [more, setMore] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const songsOpen = useAppStore((s) => s.songHallOpen)
  const setSongsOpen = (open: boolean) => useAppStore.getState().setSongHallOpen(open)
  const [coverHold, setCoverHold] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const { active, progress } = useProgress()
  const usingFallbackSynth = useAppStore((s) => s.usingFallbackSynth)
  const song = useAppStore((s) => s.song)
  const waiting = useAppStore((s) => s.waiting)
  const speed = useAppStore((s) => s.speed)
  const practiceMode = useAppStore((s) => s.practiceMode)
  const hands = useAppStore((s) => s.hands)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const viewMode = useAppStore((s) => s.viewMode)
  const colorMode = useAppStore((s) => s.colorMode)
  const loopEnabled = useAppStore((s) => s.loopEnabled)
  const loopStart = useAppStore((s) => s.loopStart)
  const loopEnd = useAppStore((s) => s.loopEnd)
  const showFallingNotes = useAppStore((s) => s.showFallingNotes)
  const pianoId = useAppStore((s) => s.pianoId)
  const pianoLoading = useAppStore((s) => s.pianoLoading)
  const environmentId = useAppStore((s) => s.environmentId)
  const flashlightOn = useAppStore((s) => s.flashlightOn)
  const rooms = useRoomStore((s) => s.rooms)
  const reverb = useAppStore((s) => s.reverb)
  const midiDeviceName = useAppStore((s) => s.midiDeviceName)
  const recording = useAppStore((s) => s.recording)
  const dragOver = useAppStore((s) => s.dragOver)
  const status = useAppStore((s) => s.status)
  const transcribeJob = useAppStore((s) => s.transcribeJob)

  useEffect(() => {
    void useRoomStore.getState().refreshRooms()
    void connectWebMidi()
    void ensureAudio()
    void listStoredMidi()
      .then((records) => useAppStore.getState().setUserLibrary(records.map(entryFromStored)))
      .catch(() => undefined)

    let hide = 0
    const onOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      useAppStore.getState().setDragOver(true)
      window.clearTimeout(hide)
      hide = window.setTimeout(() => useAppStore.getState().setDragOver(false), 200)
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      window.clearTimeout(hide)
      useAppStore.getState().setDragOver(false)
      const files = [...(event.dataTransfer?.files ?? [])]
      const midis = files.filter(isMidiFile)
      const audios = files.filter(isAudioFile)
      if (midis.length) void addMidiFiles(midis)
      if (audios.length) void addAudioFiles(audios)
    }
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.clearTimeout(hide)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const atmosphereUrl = rooms.find((room) => room.id === environmentId)?.url ?? ''

  useEffect(() => {
    if (isFlashlightHall(atmosphereUrl)) useAppStore.getState().setFlashlightOn(false)
  }, [environmentId])

  useEffect(() => {
    const kind = atmosphereKindFromUrl(atmosphereUrl)
    void setAtmosphere(kind)
    void setRoomAcoustics(atmosphereUrl)
    const resume = () => {
      void setAtmosphere(kind)
    }
    window.addEventListener('pointerdown', resume, { once: true })
    return () => window.removeEventListener('pointerdown', resume)
  }, [atmosphereUrl, ATMOSPHERE_REV])

  if (pianoLoading && !coverHold) setCoverHold(true)
  const showCover = pianoLoading || coverHold

  useEffect(() => {
    if (pianoLoading) {
      blurMenuSelects(menuRef.current)
      setMore(false)
      setSideOpen(false)
      useAppStore.getState().setSongHallOpen(false)
    }
  }, [pianoLoading])

  useEffect(() => {
    if (pianoLoading || active) return
    if (!coverHold) return
    const id = window.setTimeout(() => setCoverHold(false), 700)
    return () => window.clearTimeout(id)
  }, [active, pianoLoading, coverHold])

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!useAppStore.getState().pianoLoading) setCoverHold(false)
    }, 90000)
    return () => window.clearTimeout(id)
  }, [pianoId, environmentId])

  useEffect(() => {
    setCoverHold(true)
  }, [environmentId])

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const node = event.target
      if (!(node instanceof Element)) return
      if (node.closest('.hud-menu') || node.closest('.hud-side') || node.closest('.song-select')) return
      blurMenuSelects(menuRef.current)
      setMore(false)
      setSideOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        blurMenuSelects(menuRef.current)
        setSongsOpen(false)
        setMore(false)
        setSideOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeMenus, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', closeMenus, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    const desktop = window.pianoDesktop
    if (desktop) {
      void desktop.getFullscreen().then(setFullscreen)
      return desktop.onFullscreen(setFullscreen)
    }
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    const down = new Set<string>()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

      if (event.code === 'Space') {
        event.preventDefault()
        if (waiting && practiceMode === 'step') void player.stepNext()
        else void player.toggle()
        return
      }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        event.preventDefault()
        player.setSustain(true)
        return
      }
      if (event.key === 'F11') {
        event.preventDefault()
        if (!window.pianoDesktop) void toggleFullscreen().then(setFullscreen)
        return
      }
      if (event.key === 'n' || event.key === 'N') {
        if (practiceMode === 'step') void player.stepNext()
        return
      }
      const midi = PC_KEYS[event.key.toLowerCase()]
      if (midi !== undefined && !down.has(event.key)) {
        down.add(event.key)
        player.userNoteOn(midi)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      down.delete(event.key)
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        player.setSustain(false)
      }
      const midi = PC_KEYS[event.key.toLowerCase()]
      if (midi !== undefined) player.userNoteOff(midi)
    }
    const onBlur = () => {
      for (const key of down) {
        const midi = PC_KEYS[key.toLowerCase()]
        if (midi !== undefined) player.userNoteOff(midi)
      }
      down.clear()
      player.releaseAllUser()
      player.setSustain(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [waiting, practiceMode])

  const setCamera = (mode: CameraMode) => {
    useAppStore.getState().setCameraMode(mode)
  }

  return (
    <div className={`overlay${dragOver ? ' is-drop' : ''}${more ? ' is-more' : ''}`}>
      {transcribeJob ? (
        <div className="boot is-transcribe">
          <img className="boot-art" src={publicUrl('cover.png')} alt="" />
          <div className="boot-copy">
            <small>Song Hall</small>
            <strong>Transcribing</strong>
            <span>
              {transcribeJob.name} · {transcribeJob.pct}%
            </span>
            <div className="boot-bar">
              <i style={{ width: `${Math.max(8, transcribeJob.pct)}%` }} />
            </div>
          </div>
        </div>
      ) : showCover ? (
        <div className="boot">
          <img className="boot-art" src={publicUrl('cover.png')} alt="" />
          <div className="boot-copy">
            <small>Concert grand</small>
            <strong>Nocture : 3D</strong>
            <span>
              {pianoLoading || active
                ? active
                  ? `Loading piano… ${Math.round(progress)}%`
                  : 'Loading piano…'
                : 'Opening the hall…'}
            </span>
            <div className="boot-bar">
              <i
                style={{
                  width: `${pianoLoading && !active ? 18 : Math.max(8, progress)}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {dragOver ? (
        <div className="drop-cover">
          <small>Your library</small>
          <strong>Drop MIDI or MP3 files</strong>
        </div>
      ) : null}

      <div className="hud-title">
        <p className="eyebrow">Nocture : 3D</p>
        <strong>{song.name}</strong>
        <span>{status}</span>
      </div>

      <nav
        className={`hud-side${sideOpen ? ' is-open' : ''}`}
        onPointerLeave={() => setSideOpen(false)}
      >
        <button
          type="button"
          className="hud-side-tab"
          aria-expanded={sideOpen}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse') event.preventDefault()
          }}
          onClick={(event) => {
            event.currentTarget.blur()
            setSideOpen(false)
          }}
        >
          <span>{viewMode === 'stage' ? '3D' : 'Notes'}</span>
          <small>
            {colorMode === 'gold' ? 'Gold' : 'Hands'}
            {fullscreen ? ' · Full' : ''}
          </small>
        </button>
        <div className="hud-side-drop">
          <section>
            <p>View</p>
            <div className="hud-side-row">
              <button
                type="button"
                className={viewMode === 'stage' ? 'is-on' : ''}
                onClick={() => useAppStore.getState().setViewMode('stage')}
              >
                3D
              </button>
              <button
                type="button"
                className={viewMode === 'scroll' ? 'is-on' : ''}
                onClick={() => useAppStore.getState().setViewMode('scroll')}
              >
                Notes
              </button>
            </div>
          </section>
          <section>
            <p>Color</p>
            <div className="hud-side-row">
              <button
                type="button"
                className={colorMode === 'gold' ? 'is-on' : ''}
                onClick={() => useAppStore.getState().setColorMode('gold')}
              >
                Gold
              </button>
              <button
                type="button"
                className={colorMode === 'hands' ? 'is-on' : ''}
                onClick={() => useAppStore.getState().setColorMode('hands')}
              >
                Hands
              </button>
            </div>
          </section>
          <section>
            <p>Display</p>
            <button
              type="button"
              className={fullscreen ? 'is-on' : ''}
              onClick={() => void toggleFullscreen().then(setFullscreen)}
            >
              {fullscreen ? 'Exit full' : 'Full'}
            </button>
          </section>
          {viewMode === 'stage' ? (
            <section>
              <p>Camera</p>
              {(Object.keys(CAMERA_LABELS) as CameraMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={cameraMode === mode ? 'is-on' : ''}
                  onClick={() => setCamera(mode)}
                >
                  {CAMERA_LABELS[mode]}
                </button>
              ))}
            </section>
          ) : null}
        </div>
      </nav>

      {viewMode === 'stage' && isFlashlightHall(rooms.find((room) => room.id === environmentId)?.url ?? '') ? (
        <button
          type="button"
          className={`hud-flash${flashlightOn ? ' is-on' : ''}`}
          title={flashlightOn ? 'Flashlight on' : 'Flashlight off'}
          aria-label="Flashlight"
          aria-pressed={flashlightOn}
          onClick={() => {
            const next = !useAppStore.getState().flashlightOn
            void playFlashlightClick(next)
            useAppStore.getState().setFlashlightOn(next)
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3 10.2h9.2v3.6H3c-.6 0-1-.4-1-1v-1.6c0-.6.4-1 1-1zm10.4-2.4 8.2-2.2c.5-.1.9.2.9.7v10.4c0 .5-.4.8-.9.7l-8.2-2.2V7.8z"
            />
          </svg>
        </button>
      ) : null}

      <div className="hud-left">
      <button
        type="button"
        className={`hud-left-tab${songsOpen ? ' is-on' : ''}`}
        onClick={() => {
          setMore(false)
          setSongsOpen(true)
        }}
      >
        <span>Song Hall</span>
        <small>{song.name}</small>
      </button>
      <nav
        ref={menuRef}
        className={`hud-menu${more ? ' is-open' : ''}`}
        onPointerLeave={() => {
          const active = document.activeElement
          if (active instanceof HTMLSelectElement && menuRef.current?.contains(active)) return
          blurMenuSelects(menuRef.current)
          setMore(false)
        }}
      >
        <button
          type="button"
          className="hud-left-tab"
          aria-expanded={more}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse') event.preventDefault()
          }}
          onClick={(event) => {
            event.currentTarget.blur()
            setMore(false)
          }}
        >
          <span>Menu</span>
          <small>Scene · Practice</small>
        </button>
        <aside className="panel">
          <section>
            <p>Scene</p>
            <label>
              Piano
              <select
                value={pianoId}
                onChange={(event) => {
                  const id = event.target.value
                  setCoverHold(true)
                  event.currentTarget.blur()
                  setMore(false)
                  useAppStore.getState().setPianoId(id)
                }}
              >
                {PIANOS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Room
              <select
                value={environmentId}
                onChange={(event) => {
                  setCoverHold(true)
                  event.currentTarget.blur()
                  setMore(false)
                  useAppStore.getState().setEnvironmentId(event.target.value)
                }}
              >
                <option value="studio">Studio floor</option>
                {rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section>
            <p>Practice</p>
            <div className="panel-pills">
              <button
                type="button"
                className={practiceMode === 'listen' ? 'is-on' : ''}
                onClick={() => player.setPracticeMode('listen')}
              >
                Listen
              </button>
              <button
                type="button"
                className={practiceMode === 'step' ? 'is-on' : ''}
                onClick={() => {
                  player.setPracticeMode('step')
                  useAppStore.getState().setViewMode('scroll')
                }}
              >
                Tap
              </button>
            </div>
            <div className="panel-pills three">
              <button
                type="button"
                className={hands === 'both' ? 'is-on' : ''}
                onClick={() => player.setHands('both')}
              >
                Both
              </button>
              <button
                type="button"
                className={hands === 'left' ? 'is-on' : ''}
                onClick={() => player.setHands('left')}
              >
                Left
              </button>
              <button
                type="button"
                className={hands === 'right' ? 'is-on' : ''}
                onClick={() => player.setHands('right')}
              >
                Right
              </button>
            </div>
            {practiceMode === 'step' ? (
              <button type="button" onClick={() => void player.stepNext()} disabled={!waiting}>
                Next note
              </button>
            ) : null}
          </section>

          <section>
            <p>Sound</p>
            <label>
              Speed {Math.round(speed * 100)}%
              <input
                type="range"
                min={0.25}
                max={1.25}
                step={0.05}
                value={speed}
                onChange={(event) => player.setSpeed(Number(event.target.value))}
              />
            </label>
            <label>
              Reverb {Math.round(reverb * 100)}%
              <input
                type="range"
                min={0}
                max={0.7}
                step={0.02}
                value={reverb}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  useAppStore.getState().setReverb(value)
                  setReverbWet(value)
                }}
              />
            </label>
          </section>

          <section>
            <p>Extras</p>
            <div className="panel-pills three">
              <button
                type="button"
                className={loopEnabled ? 'is-on' : ''}
                onClick={() => useAppStore.getState().setLoopEnabled(!loopEnabled)}
              >
                Loop
              </button>
              <button
                type="button"
                className={showFallingNotes ? 'is-on' : ''}
                onClick={() => useAppStore.getState().setShowFallingNotes(!showFallingNotes)}
              >
                Fall
              </button>
              <button
                type="button"
                className={recording ? 'is-on' : ''}
                onClick={() => (recording ? stopRecording() : startRecording())}
              >
                {recording ? 'Stop' : 'Rec'}
              </button>
            </div>
            {loopEnabled ? (
              <div className="loop-times">
                <label>
                  Start
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={Number(loopStart.toFixed(1))}
                    onChange={(event) => useAppStore.getState().setLoopStart(Number(event.target.value))}
                  />
                </label>
                <label>
                  End
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={Number(loopEnd.toFixed(1))}
                    onChange={(event) => useAppStore.getState().setLoopEnd(Number(event.target.value))}
                  />
                </label>
              </div>
            ) : null}
          </section>

          {usingFallbackSynth ? <p className="hint">Sampled piano unavailable — using synth.</p> : null}
          <span className="midi-flag">
            {midiDeviceName ? `MIDI · ${midiDeviceName}` : 'Drop MIDI or MP3, or open Song Hall'}
          </span>
        </aside>
      </nav>
      </div>

      <SongSelect open={songsOpen} onClose={() => setSongsOpen(false)} />

      <Transport />

      <p className="credit">Grand piano by Amatsukast · CC BY-NC-SA 4.0 · MIDI from piano-midi.de · CC BY-NC-SA 3.0</p>
    </div>
  )
}
