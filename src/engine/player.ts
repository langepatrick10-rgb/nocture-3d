import {
  FIRST_MIDI,
  KEY_COUNT,
  LAST_MIDI,
  midiToIndex,
} from '../music/layout'
import {
  firstPossiblyActive,
  groupsForHands,
  notesForHands,
  type OnsetGroup,
  type ParsedSong,
  type SongNote,
} from '../music/song'
import { attackNote, playNote, releaseNote, setReverbWet, unlockAudio } from './audio'
import { expectedMask, expectHand, handCode, noteGen, pressHand, pressSong, pressUser } from './live'
import { useAppStore, type Hands, type PracticeMode } from './store'

const UI_HZ = 8
let clockRaf = 0
let clockTick: ((ts: number) => void) | null = null

function startPlayerClock(tick: (ts: number) => void): void {
  clockTick = tick
  if (clockRaf) return
  const loop = (ts: number) => {
    clockTick?.(ts)
    clockRaf = requestAnimationFrame(loop)
  }
  clockRaf = requestAnimationFrame(loop)
}

class PianoPlayer {
  private song: ParsedSong
  private playing = false
  private frozen = false
  private time = 0
  private lastTs: number | null = null
  private lastUi = 0
  private audioCursor = 0
  private visualCursor = 0
  private activeNotes: SongNote[] = []
  private filteredNotes: SongNote[] = []
  private filteredGroups: OnsetGroup[] = []
  private groupIndex = 0
  private heldUser = new Set<number>()
  private sustain = false
  private sustained = new Set<number>()
  private lastPlayed: SongNote[] = []
  private lastPlayedAt = 0
  private lastVisualTime = -1
  private hadSongPress = false

  constructor(song: ParsedSong) {
    this.song = song
    this.rebuildFilters()
    this.tick = this.tick.bind(this)
    startPlayerClock(this.tick)
  }

  getTime(): number {
    return this.time
  }

  getSong(): ParsedSong {
    return this.song
  }

  isFrozen(): boolean {
    return this.frozen
  }

  getFilteredNotes(): SongNote[] {
    return this.filteredNotes
  }

  load(song: ParsedSong): void {
    this.stop(false)
    this.song = song
    this.time = 0
    this.rebuildFilters()
    this.resetCursors()
    useAppStore.getState().setSong(song)
    this.syncVisuals()
    this.pushUi()
  }

  async toggle(): Promise<void> {
    if (this.playing) this.pause()
    else await this.play()
  }

  async play(): Promise<void> {
    await unlockAudio()
    setReverbWet(useAppStore.getState().reverb)
    if (this.time >= this.loopEnd() - 0.04) this.seek(this.loopStart())
    this.playing = true
    this.lastTs = null
    this.lastVisualTime = this.time - 0.0001
    this.maybeFreezeAtPlayhead()
    useAppStore.getState().setPlaying(true)
    useAppStore.getState().setStatus(this.frozen ? 'Tap to play' : 'Playing')
  }

  pause(): void {
    this.playing = false
    this.releaseSongAudio()
    useAppStore.getState().setPlaying(false)
    if (!this.frozen) useAppStore.getState().setStatus('Paused')
  }

  stop(updateStore = true): void {
    this.playing = false
    this.frozen = false
    this.releaseSongAudio()
    this.clearExpected()
    this.lastPlayed = []
    if (updateStore) {
      useAppStore.getState().setPlaying(false)
      useAppStore.getState().setWaiting(false)
      useAppStore.getState().setStatus('Stopped')
    }
  }

  seek(nextTime: number): void {
    this.releaseSongAudio()
    this.time = Math.min(Math.max(nextTime, 0), this.song.duration)
    this.frozen = false
    this.clearExpected()
    this.resetCursors()
    useAppStore.getState().setWaiting(false)
    this.syncVisuals()
    this.pushUi()
  }

  setSpeed(speed: number): void {
    useAppStore.getState().setSpeed(speed)
  }

  setPracticeMode(mode: PracticeMode): void {
    useAppStore.getState().setPracticeMode(mode)
    this.frozen = false
    this.clearExpected()
    useAppStore.getState().setWaiting(false)
    this.resetCursors()
  }

  setHands(hands: Hands): void {
    useAppStore.getState().setHands(hands)
    this.rebuildFilters()
    this.resetCursors()
    this.syncVisuals()
  }

  userNoteOn(midi: number, velocity = 0.85): void {
    if (midi < FIRST_MIDI || midi > LAST_MIDI) return
    void unlockAudio()
    this.heldUser.add(midi)
    pressUser[midiToIndex(midi)] = 1
    noteGen[midiToIndex(midi)] += 1
    attackNote(midi, velocity)
  }

  userNoteOff(midi: number): void {
    if (midi < FIRST_MIDI || midi > LAST_MIDI) return
    if (this.sustain) {
      this.sustained.add(midi)
      return
    }
    this.heldUser.delete(midi)
    pressUser[midiToIndex(midi)] = 0
    releaseNote(midi)
  }

  releaseAllUser(): void {
    for (const midi of this.heldUser) {
      pressUser[midiToIndex(midi)] = 0
      releaseNote(midi)
    }
    this.heldUser.clear()
    this.sustained.clear()
  }

  setSustain(down: boolean): void {
    this.sustain = down
    if (down) return
    for (const midi of this.sustained) {
      this.heldUser.delete(midi)
      pressUser[midiToIndex(midi)] = 0
      releaseNote(midi)
    }
    this.sustained.clear()
  }

  async stepNext(): Promise<void> {
    if (useAppStore.getState().practiceMode !== 'step') return
    const group = this.currentGroup()
    if (!group) {
      this.stop()
      useAppStore.getState().setStatus('Finished')
      return
    }
    if (Math.abs(this.time - group.time) > 0.02) this.freeze(group)
    void unlockAudio()
    this.playGroup(group)
    this.holdPlayedGroup(group)
    this.groupIndex += 1
    this.audioCursor = this.filteredNotes.findIndex((note) => note.time > group.time + 0.02)
    if (this.audioCursor < 0) this.audioCursor = this.filteredNotes.length
    if (!this.currentGroup()) useAppStore.getState().setStatus('Finished')
  }

  private loopStart(): number {
    const state = useAppStore.getState()
    return state.loopEnabled ? state.loopStart : 0
  }

  private loopEnd(): number {
    const state = useAppStore.getState()
    return state.loopEnabled ? Math.max(state.loopEnd, state.loopStart + 0.2) : this.song.duration
  }

  private rebuildFilters(): void {
    const hands = useAppStore.getState().hands
    this.filteredNotes = notesForHands(this.song.notes, hands)
    this.filteredGroups = groupsForHands(this.song.groups, hands)
  }

  private resetCursors(): void {
    this.audioCursor = this.filteredNotes.findIndex((note) => note.time >= this.time - 0.0001)
    if (this.audioCursor < 0) this.audioCursor = this.filteredNotes.length
    this.groupIndex = this.filteredGroups.findIndex((group) => group.time >= this.time - 0.0001)
    if (this.groupIndex < 0) this.groupIndex = this.filteredGroups.length
    this.lastVisualTime = this.time - 0.0001
    this.visualCursor = firstPossiblyActive(this.filteredNotes, this.time)
  }

  private currentGroup(): OnsetGroup | undefined {
    return this.filteredGroups[this.groupIndex]
  }

  private tick(ts: number): void {
    const dt = this.lastTs === null ? 0 : Math.min((ts - this.lastTs) / 1000, 0.08)
    this.lastTs = ts

    if (this.playing && !this.frozen && dt > 0) {
      const speed = useAppStore.getState().speed
      const mode = useAppStore.getState().practiceMode
      const group = this.currentGroup()

      if (mode === 'step') {
        if (group) {
          this.freeze(group)
        } else {
          this.time = this.song.duration
          this.stop()
          useAppStore.getState().setStatus('Finished')
        }
      } else {
        const prev = this.time
        const next = prev + dt * speed
        if (next >= this.loopEnd()) {
          if (useAppStore.getState().loopEnabled) {
            this.time = this.loopStart()
            this.releaseSongAudio()
            this.resetCursors()
          } else {
            this.time = this.song.duration
            this.stop()
            useAppStore.getState().setStatus('Finished')
          }
        } else {
          this.triggerRange(prev, next)
          this.time = next
        }
      }
    }

    this.syncVisuals()
    if (ts - this.lastUi > 1000 / UI_HZ) {
      this.lastUi = ts
      this.pushUi()
    }
  }

  private triggerRange(from: number, to: number): void {
    if (useAppStore.getState().practiceMode !== 'listen') return
    while (this.audioCursor < this.filteredNotes.length) {
      const note = this.filteredNotes[this.audioCursor]
      if (note.time < from) {
        this.audioCursor += 1
        continue
      }
      if (note.time > to) break
      playNote(note.midi, note.duration / useAppStore.getState().speed, note.velocity)
      this.audioCursor += 1
    }
  }

  private freeze(group: OnsetGroup): void {
    this.time = group.time
    this.lastVisualTime = this.time - 0.0001
    this.frozen = true
    this.playing = true
    expectedMask.fill(0)
    expectHand.fill(0)
    for (const note of group.notes) {
      const i = midiToIndex(note.midi)
      expectedMask[i] = 1
      expectHand[i] = handCode(note.hand)
    }
    useAppStore.getState().setWaiting(true)
    useAppStore.getState().setStatus('Tap to play')
  }

  private playGroup(group: OnsetGroup): void {
    const speed = useAppStore.getState().speed
    this.lastPlayed = group.notes
    this.lastPlayedAt = performance.now()
    for (const note of group.notes) {
      const i = midiToIndex(note.midi)
      playNote(note.midi, Math.max(note.duration / speed, 0.16), note.velocity)
      pressSong[i] = 1
      pressHand[i] = handCode(note.hand)
      noteGen[i] += 1
    }
  }

  private maybeFreezeAtPlayhead(): void {
    if (useAppStore.getState().practiceMode === 'listen') return
    const group = this.currentGroup()
    if (group) this.freeze(group)
  }

  private holdPlayedGroup(group: OnsetGroup): void {
    this.time = group.time
    this.lastVisualTime = this.time - 0.0001
    this.frozen = true
    this.playing = true
    expectedMask.fill(0)
    expectHand.fill(0)
    for (const note of group.notes) {
      const i = midiToIndex(note.midi)
      expectedMask[i] = 1
      expectHand[i] = handCode(note.hand)
    }
    useAppStore.getState().setWaiting(true)
    useAppStore.getState().setStatus('Tap to play')
  }

  private clearExpected(): void {
    expectedMask.fill(0)
    expectHand.fill(0)
  }

  private releaseSongAudio(): void {
    for (const note of this.activeNotes) releaseNote(note.midi)
    this.activeNotes = []
    pressSong.fill(0)
    pressHand.fill(0)
  }

  private downLast = new Uint8Array(KEY_COUNT)

  private syncVisuals(): void {
    if (!this.playing) {
      if (this.hadSongPress) {
        pressSong.fill(0)
        pressHand.fill(0)
        this.downLast.fill(0)
        this.hadSongPress = false
      }
      return
    }
    const notes = this.filteredNotes
    const t = this.time
    const prev = this.lastVisualTime
    this.activeNotes = []
    const next = new Uint8Array(KEY_COUNT)
    const hands = new Uint8Array(KEY_COUNT)
    let cursor = this.visualCursor
    while (cursor < notes.length && notes[cursor].time + notes[cursor].duration < t) {
      cursor += 1
    }
    this.visualCursor = cursor
    for (let n = cursor; n < notes.length; n++) {
      const note = notes[n]
      if (note.time > t + 0.05) break
      const i = midiToIndex(note.midi)
      if (i < 0 || i >= KEY_COUNT) continue
      const attacking = prev < note.time && t >= note.time
      if (t >= note.time && t < note.time + note.duration) {
        next[i] = 1
        hands[i] = handCode(note.hand)
        this.activeNotes.push(note)
      }
      if (attacking && this.downLast[i]) noteGen[i] += 1
    }
    if (this.frozen) {
      for (let i = 0; i < KEY_COUNT; i++) {
        if (!expectedMask[i]) continue
        next[i] = 1
        if (expectHand[i]) hands[i] = expectHand[i]
      }
    } else if (
      useAppStore.getState().practiceMode !== 'step' &&
      performance.now() - this.lastPlayedAt < 90
    ) {
      for (const note of this.lastPlayed) {
        const i = midiToIndex(note.midi)
        if (i < 0 || i >= KEY_COUNT) continue
        next[i] = 1
        hands[i] = handCode(note.hand)
      }
    }
    pressSong.set(next)
    pressHand.set(hands)
    this.downLast.set(next)
    this.lastVisualTime = t
    this.hadSongPress = true
  }

  private pushUi(): void {
    const store = useAppStore.getState()
    if (Math.abs(store.songTime - this.time) > 0.01) store.setSongTime(this.time)
  }
}

export const player = new PianoPlayer(useAppStore.getState().song)
