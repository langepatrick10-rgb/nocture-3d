import { create } from 'zustand'
import { DEFAULT_SONG } from '../music/demos'
import type { LibraryEntry } from '../music/library'
import type { ParsedSong } from '../music/song'
import {
  clampCamera,
  cameraForNotes,
  panCamera,
  WHITE_COUNT,
  zoomCamera,
} from '../ui/keyCamera'

export type CameraMode = 'orbit' | 'play' | 'theater'
export type PracticeMode = 'listen' | 'step'
export type Hands = 'both' | 'left' | 'right'
export type ViewMode = 'stage' | 'scroll'
export type ColorMode = 'gold' | 'hands'

export const CAMERA_LABELS: Record<CameraMode, string> = {
  orbit: 'Orbit',
  play: 'Play Cam',
  theater: 'Theater Cam',
}

export type AppState = {
  samplesReady: boolean
  usingFallbackSynth: boolean
  song: ParsedSong
  songTime: number
  playing: boolean
  waiting: boolean
  speed: number
  practiceMode: PracticeMode
  hands: Hands
  cameraMode: CameraMode
  loopEnabled: boolean
  loopStart: number
  loopEnd: number
  showFallingNotes: boolean
  reverb: number
  midiDeviceName: string | null
  recording: boolean
  dragOver: boolean
  status: string
  pianoId: string
  pianoLoading: boolean
  environmentId: string
  flashlightOn: boolean
  viewMode: ViewMode
  colorMode: ColorMode
  libraryId: string
  userLibrary: LibraryEntry[]
  transcribeJob: { name: string; pct: number } | null
  songHallOpen: boolean
  keyStart: number
  keySpan: number
  secondsAhead: number
}

export type AppActions = {
  setSamplesReady: (ready: boolean, fallback: boolean) => void
  setSong: (song: ParsedSong) => void
  setSongTime: (time: number) => void
  setPlaying: (playing: boolean) => void
  setWaiting: (waiting: boolean) => void
  setSpeed: (speed: number) => void
  setPracticeMode: (mode: PracticeMode) => void
  setHands: (hands: Hands) => void
  setCameraMode: (mode: CameraMode) => void
  setLoopEnabled: (enabled: boolean) => void
  setLoopStart: (time: number) => void
  setLoopEnd: (time: number) => void
  setShowFallingNotes: (show: boolean) => void
  setReverb: (value: number) => void
  setMidiDeviceName: (name: string | null) => void
  setRecording: (recording: boolean) => void
  setDragOver: (over: boolean) => void
  setStatus: (status: string) => void
  setPianoId: (id: string) => void
  setPianoLoading: (loading: boolean) => void
  setEnvironmentId: (id: string) => void
  setFlashlightOn: (on: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setColorMode: (mode: ColorMode) => void
  setLibraryId: (id: string) => void
  setUserLibrary: (entries: LibraryEntry[]) => void
  upsertUserEntry: (entry: LibraryEntry) => void
  removeUserEntry: (id: string) => void
  setTranscribeJob: (job: { name: string; pct: number } | null) => void
  setSongHallOpen: (open: boolean) => void
  setKeyCamera: (start: number, span: number) => void
  panKeys: (deltaWhites: number) => void
  zoomKeys: (factor: number, around?: number) => void
  setSecondsAhead: (seconds: number) => void
  fitKeysToSong: (song?: ParsedSong) => void
  showAllKeys: () => void
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  samplesReady: false,
  usingFallbackSynth: false,
  song: DEFAULT_SONG,
  songTime: 0,
  playing: false,
  waiting: false,
  speed: 1,
  practiceMode: 'listen',
  hands: 'both',
  cameraMode: 'orbit',
  loopEnabled: false,
  loopStart: 0,
  loopEnd: DEFAULT_SONG.duration,
  showFallingNotes: false,
  reverb: 0.22,
  midiDeviceName: null,
  recording: false,
  dragOver: false,
  status: 'Loading piano samples…',
  pianoId: 'c6x',
  pianoLoading: true,
  environmentId: 'studio',
  flashlightOn: false,
  viewMode: 'stage',
  colorMode: 'gold',
  libraryId: 'ode',
  userLibrary: [],
  transcribeJob: null,
  songHallOpen: false,
  keyStart: 0,
  keySpan: WHITE_COUNT,
  secondsAhead: 5,

  setSamplesReady: (samplesReady, usingFallbackSynth) =>
    set({ samplesReady, usingFallbackSynth }),
  setSong: (song) => {
    set({
      song,
      songTime: 0,
      playing: false,
      waiting: false,
      loopStart: 0,
      loopEnd: song.duration,
    })
  },
  setSongTime: (songTime) => set({ songTime }),
  setPlaying: (playing) => set({ playing }),
  setWaiting: (waiting) => set({ waiting }),
  setSpeed: (speed) => set({ speed }),
  setPracticeMode: (practiceMode) => set({ practiceMode }),
  setHands: (hands) => set({ hands }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
  setLoopStart: (loopStart) => set({ loopStart }),
  setLoopEnd: (loopEnd) => set({ loopEnd }),
  setShowFallingNotes: (showFallingNotes) => set({ showFallingNotes }),
  setReverb: (reverb) => set({ reverb }),
  setMidiDeviceName: (midiDeviceName) => set({ midiDeviceName }),
  setRecording: (recording) => set({ recording }),
  setDragOver: (dragOver) => set({ dragOver }),
  setStatus: (status) => set({ status }),
  setPianoId: (pianoId) =>
    set((state) =>
      state.pianoId === pianoId
        ? state
        : { pianoId, pianoLoading: true, status: 'Loading piano…' },
    ),
  setPianoLoading: (pianoLoading) => set({ pianoLoading }),
  setEnvironmentId: (environmentId) => set({ environmentId }),
  setFlashlightOn: (flashlightOn) => set({ flashlightOn }),
  setViewMode: (viewMode) => set({ viewMode }),
  setColorMode: (colorMode) => set({ colorMode }),
  setLibraryId: (libraryId) => set({ libraryId }),
  setUserLibrary: (userLibrary) => set({ userLibrary }),
  upsertUserEntry: (entry) =>
    set((state) => ({
      userLibrary: [entry, ...state.userLibrary.filter((item) => item.id !== entry.id)],
    })),
  removeUserEntry: (id) =>
    set((state) => ({
      userLibrary: state.userLibrary.filter((item) => item.id !== id),
      libraryId: state.libraryId === id ? 'ode' : state.libraryId,
    })),
  setTranscribeJob: (transcribeJob) => set({ transcribeJob }),
  setSongHallOpen: (songHallOpen) => set({ songHallOpen }),
  setKeyCamera: (start, span) => {
    const next = clampCamera({ start, span })
    set({ keyStart: next.start, keySpan: next.span })
  },
  panKeys: (deltaWhites) =>
    set((state) => {
      const next = panCamera({ start: state.keyStart, span: state.keySpan }, deltaWhites)
      return { keyStart: next.start, keySpan: next.span }
    }),
  zoomKeys: (factor, around = 0.5) =>
    set((state) => {
      const next = zoomCamera({ start: state.keyStart, span: state.keySpan }, factor, around)
      return { keyStart: next.start, keySpan: next.span }
    }),
  setSecondsAhead: (seconds) =>
    set({ secondsAhead: Math.min(14, Math.max(1.6, seconds)) }),
  fitKeysToSong: (song) =>
    set((state) => {
      const next = cameraForNotes((song ?? state.song).notes)
      return { keyStart: next.start, keySpan: next.span }
    }),
  showAllKeys: () => set({ keyStart: 0, keySpan: WHITE_COUNT }),
}))
