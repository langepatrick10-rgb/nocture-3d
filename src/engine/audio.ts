import * as Tone from 'tone'
import { publicUrl } from '../assetUrl'
import { useAppStore } from './store'

const SALAMANDER: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
}

type Voice = {
  attack: (midi: number, velocity: number, time?: number) => void
  release: (midi: number, time?: number) => void
  attackRelease: (
    midi: number,
    duration: number,
    velocity: number,
    time?: number,
  ) => void
  dispose: () => void
}

let voice: Voice | null = null
let reverb: Tone.Reverb | null = null
let recordDest: MediaStreamAudioDestinationNode | null = null
let started = false
let loadPromise: Promise<void> | null = null

function midiFreq(midi: number): string {
  return Tone.Frequency(midi, 'midi').toNote()
}

function samplerVoice(sampler: Tone.Sampler): Voice {
  return {
    attack(midi, velocity, time) {
      sampler.triggerAttack(midiFreq(midi), time, velocity)
    },
    release(midi, time) {
      sampler.triggerRelease(midiFreq(midi), time)
    },
    attackRelease(midi, duration, velocity, time) {
      sampler.triggerAttackRelease(midiFreq(midi), duration, time, velocity)
    },
    dispose() {
      sampler.dispose()
    },
  }
}

function synthVoice(synth: Tone.PolySynth<Tone.Synth>): Voice {
  return {
    attack(midi, velocity, time) {
      synth.triggerAttack(midiFreq(midi), time, velocity)
    },
    release(midi, time) {
      synth.triggerRelease(midiFreq(midi), time)
    },
    attackRelease(midi, duration, velocity, time) {
      synth.triggerAttackRelease(midiFreq(midi), duration, time, velocity)
    },
    dispose() {
      synth.dispose()
    },
  }
}

export function getRecordStream(): MediaStream | null {
  return recordDest?.stream ?? null
}

export function setReverbWet(wet: number): void {
  if (reverb) reverb.wet.value = wet
}

export async function unlockAudio(): Promise<void> {
  if (!started) {
    try {
      await Tone.start()
      started = true
    } catch {
      /* needs a user gesture */
    }
  }
  if (!loadPromise) loadPromise = loadInstrument()
}

export async function ensureAudio(): Promise<void> {
  await unlockAudio()
  if (loadPromise) await loadPromise
}

async function loadInstrument(): Promise<void> {
  const ctx = Tone.getContext()
  const raw = ctx.rawContext as AudioContext
  recordDest = raw.createMediaStreamDestination()

  reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: 0.22 })
  await reverb.generate()
  reverb.toDestination()
  reverb.connect(recordDest)

  const fallback = () => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.35, release: 0.8 },
    })
    synth.maxPolyphony = 64
    synth.connect(reverb!)
    voice = synthVoice(synth)
    useAppStore.getState().setSamplesReady(true, true)
    useAppStore
      .getState()
      .setStatus('Using built-in synth (samples unavailable).')
  }

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const sampler = new Tone.Sampler({
      urls: SALAMANDER,
      baseUrl: publicUrl('audio/salamander/'),
      release: 1.2,
      attack: 0.002,
      onload: () => {
        sampler.connect(reverb!)
        voice = samplerVoice(sampler)
        useAppStore.getState().setSamplesReady(true, false)
        useAppStore.getState().setStatus('Piano ready.')
        finish()
      },
      onerror: () => {
        sampler.dispose()
        fallback()
        finish()
      },
    })

    window.setTimeout(() => {
      if (settled) return
      sampler.dispose()
      fallback()
      finish()
    }, 12000)
  })
}

export function attackNote(midi: number, velocity: number, time?: number): void {
  voice?.attack(midi, velocity, time)
}

export function releaseNote(midi: number, time?: number): void {
  voice?.release(midi, time)
}

export function playNote(
  midi: number,
  duration: number,
  velocity: number,
  time?: number,
): void {
  voice?.attackRelease(midi, duration, velocity, time)
}
