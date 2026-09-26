import * as Tone from 'tone'
import { publicUrl } from '../assetUrl'
import { connectToOutput, unlockAudio } from './audio'

export type AtmosphereKind = 'off' | 'rain' | 'backrooms' | 'fnaf' | 'fire' | 'chatter' | 'street'

type Bed = {
  stop: () => void
}

type Slot = {
  master: Tone.Gain | null
  bed: Bed | null
  kind: AtmosphereKind
  gen: number
  appliedRev: number
}

const g = globalThis as typeof globalThis & { __noctureAtmosphere?: Slot }

function stopBed(state: Slot) {
  try {
    state.bed?.stop()
  } catch {
    /* already disposed */
  }
  state.bed = null
}

function silence(state: Slot) {
  const gain = state.master
  if (!gain) return
  try {
    gain.gain.cancelScheduledValues(Tone.now())
    gain.gain.value = 0
  } catch {
    /* already disposed */
  }
}

function halt(state: Slot) {
  silence(state)
  stopBed(state)
  state.kind = 'off'
}

const slot: Slot = g.__noctureAtmosphere ?? {
  master: null,
  bed: null,
  kind: 'off',
  gen: 0,
  appliedRev: -1,
}
halt(slot)
g.__noctureAtmosphere = slot

export const ATMOSPHERE_REV = 13

function ensureMaster(): Tone.Gain {
  if (!slot.master) {
    slot.master = new Tone.Gain(0)
    connectToOutput(slot.master)
  }
  return slot.master
}

function fade(gain: Tone.Gain, value: number, seconds: number) {
  gain.gain.cancelScheduledValues(Tone.now())
  gain.gain.rampTo(value, seconds)
}

function makeRain(parent: Tone.Gain): Bed {
  const pink = new Tone.Noise('pink')
  const brown = new Tone.Noise('brown')
  const air = new Tone.Filter(420, 'highpass')
  const body = new Tone.Filter(2200, 'lowpass')
  const rumble = new Tone.Filter(700, 'lowpass')
  const rainGain = new Tone.Gain(0.055)
  const rumbleGain = new Tone.Gain(0.028)
  const wind = new Tone.LFO({ frequency: 0.11, min: 0.04, max: 0.07 }).start()
  wind.connect(rainGain.gain)
  pink.connect(air)
  air.connect(body)
  body.connect(rainGain)
  brown.connect(rumble)
  rumble.connect(rumbleGain)
  rainGain.connect(parent)
  rumbleGain.connect(parent)
  pink.start()
  brown.start()

  const drop = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.04 },
    volume: -34,
  })
  const dropFilter = new Tone.Filter({ frequency: 2100, type: 'bandpass', Q: 1.4 })
  drop.connect(dropFilter)
  dropFilter.connect(parent)
  let drip = 0
  const dripOnce = () => {
    drop.triggerAttackRelease(0.04)
    drip = window.setTimeout(dripOnce, 220 + Math.random() * 640)
  }
  drip = window.setTimeout(dripOnce, 400)

  return {
    stop() {
      window.clearTimeout(drip)
      pink.stop()
      brown.stop()
      wind.stop()
      pink.dispose()
      brown.dispose()
      air.dispose()
      body.dispose()
      rumble.dispose()
      rainGain.dispose()
      rumbleGain.dispose()
      wind.dispose()
      drop.dispose()
      dropFilter.dispose()
    },
  }
}

function makeBackrooms(parent: Tone.Gain): Bed {
  const low = new Tone.Oscillator(146.8, 'sine')
  const fifth = new Tone.Oscillator(174.6, 'triangle')
  const beat = new Tone.Oscillator(148.2, 'sine')
  const filter = new Tone.Filter({ frequency: 520, type: 'lowpass', Q: 0.7 })
  const lfo = new Tone.LFO({ frequency: 0.05, min: 280, max: 720 }).start()
  lfo.connect(filter.frequency)
  const chorus = new Tone.Chorus({ frequency: 0.28, delayTime: 4.2, depth: 0.55, wet: 0.55 }).start()
  const verb = new Tone.Reverb({ decay: 9, wet: 0.48, preDelay: 0.1 })
  const vol = new Tone.Gain(0.11)
  const shimmer = new Tone.Oscillator(784, 'sine')
  const shimmerGain = new Tone.Gain(0.018)
  const shimmerLfo = new Tone.LFO({ frequency: 0.07, min: 0.008, max: 0.028 }).start()
  shimmerLfo.connect(shimmerGain.gain)
  void verb.generate()
  low.connect(filter)
  fifth.connect(filter)
  beat.connect(filter)
  filter.connect(chorus)
  chorus.connect(verb)
  verb.connect(vol)
  shimmer.connect(shimmerGain)
  shimmerGain.connect(verb)
  vol.connect(parent)
  low.start()
  fifth.start()
  beat.start()
  shimmer.start()
  return {
    stop() {
      low.stop()
      fifth.stop()
      beat.stop()
      shimmer.stop()
      lfo.stop()
      shimmerLfo.stop()
      chorus.stop()
      low.dispose()
      fifth.dispose()
      beat.dispose()
      shimmer.dispose()
      filter.dispose()
      lfo.dispose()
      chorus.dispose()
      verb.dispose()
      vol.dispose()
      shimmerGain.dispose()
      shimmerLfo.dispose()
    },
  }
}

function makeFnaf(parent: Tone.Gain): Bed {
  const synth = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: 'triangle' },
    filter: { type: 'lowpass', Q: 0.9, frequency: 1400 },
    envelope: { attack: 0.22, decay: 0.45, sustain: 0.55, release: 1.6 },
    filterEnvelope: { attack: 0.18, decay: 0.7, sustain: 0.4, release: 1.4, baseFrequency: 520, octaves: 1.6 },
  })
  synth.maxPolyphony = 8
  synth.volume.value = -7
  const vib = new Tone.Vibrato({ frequency: 4.4, depth: 0.1, wet: 0.8 })
  const verb = new Tone.Reverb({ decay: 2.6, wet: 0.22, preDelay: 0.04 })
  void verb.generate()
  synth.chain(vib, verb, parent)
  let wait = 0
  const hum = () => {
    const now = Tone.now()
    synth.triggerAttackRelease('A2', 1.15, now, 0.82)
    synth.triggerAttackRelease('A3', 1.15, now, 0.32)
    synth.triggerAttackRelease('C3', 1.05, now + 1.25, 0.74)
    synth.triggerAttackRelease('C4', 1.05, now + 1.25, 0.28)
    synth.triggerAttackRelease('B2', 1.4, now + 2.45, 0.78)
    synth.triggerAttackRelease('B3', 1.4, now + 2.45, 0.3)
    synth.triggerAttackRelease('E2', 1.9, now + 4.05, 0.7)
    wait = window.setTimeout(hum, 60000 + Math.random() * 60000)
  }
  wait = window.setTimeout(hum, 50000 + Math.random() * 25000)
  return {
    stop() {
      window.clearTimeout(wait)
      synth.dispose()
      vib.dispose()
      verb.dispose()
    },
  }
}

type LoopClip = {
  file: string
  volume: number
  hp: number | null
  lp: number | null
}

function clipUrl(file: string) {
  return `${publicUrl(file)}?r=${ATMOSPHERE_REV}`
}

const CLIPS: Record<'fire' | 'chatter' | 'street', LoopClip> = {
  fire: { file: 'audio/atmosphere/fireplace.mp3', volume: -16, hp: null, lp: null },
  chatter: { file: 'audio/atmosphere/voices.mp3', volume: -12, hp: 140, lp: 500 },
  street: { file: 'audio/atmosphere/city.mp3', volume: -16, hp: 80, lp: 2200 },
}

export function preloadAtmosphereClips(): void {
  for (const clip of Object.values(CLIPS)) {
    void Tone.ToneAudioBuffer.fromUrl(clipUrl(clip.file))
  }
}

async function makeClip(parent: Tone.Gain, clip: LoopClip): Promise<Bed> {
  const url = clipUrl(clip.file)
  const player = new Tone.Player({
    url,
    loop: true,
    fadeIn: 0.7,
    fadeOut: 0.45,
  })
  player.volume.value = clip.volume
  const nodes: Tone.ToneAudioNode[] = [player]
  let tail: Tone.ToneAudioNode = player
  if (clip.hp !== null) {
    const hp = new Tone.Filter({ frequency: clip.hp, type: 'highpass', Q: 0.4 })
    tail.connect(hp)
    nodes.push(hp)
    tail = hp
  }
  if (clip.lp !== null) {
    const lp = new Tone.Filter({ frequency: clip.lp, type: 'lowpass', Q: 0.45 })
    tail.connect(lp)
    nodes.push(lp)
    tail = lp
  }
  tail.connect(parent)
  await player.load(url)
  player.start()
  return {
    stop() {
      try {
        player.stop()
      } catch {
        /* already stopped */
      }
      for (const node of nodes) node.dispose()
    },
  }
}

export function haltAtmosphere(): void {
  slot.gen += 1
  halt(slot)
  slot.appliedRev = ATMOSPHERE_REV
}

export async function setAtmosphere(next: AtmosphereKind): Promise<void> {
  if (next === 'off') {
    haltAtmosphere()
    return
  }
  if (next === slot.kind && slot.bed && slot.appliedRev === ATMOSPHERE_REV) return
  const mine = ++slot.gen
  await unlockAudio()
  if (mine !== slot.gen) return
  const out = ensureMaster()
  if (next === slot.kind && slot.bed && slot.appliedRev === ATMOSPHERE_REV) return
  slot.appliedRev = ATMOSPHERE_REV
  silence(slot)
  stopBed(slot)
  slot.kind = next
  try {
    if (next === 'rain') slot.bed = makeRain(out)
    else if (next === 'backrooms') slot.bed = makeBackrooms(out)
    else if (next === 'fire' || next === 'chatter' || next === 'street') {
      slot.bed = await makeClip(out, CLIPS[next])
      if (mine !== slot.gen) {
        stopBed(slot)
        return
      }
    } else slot.bed = makeFnaf(out)
    fade(out, 1, 0.4)
  } catch {
    stopBed(slot)
    slot.kind = 'off'
  }
}
