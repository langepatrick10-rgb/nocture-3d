import * as Tone from 'tone'
import { connectToOutput, unlockAudio } from './audio'

export async function playFlashlightClick(on: boolean): Promise<void> {
  await unlockAudio()
  const now = Tone.now()
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: on ? 0.03 : 0.045, sustain: 0, release: 0.012 },
    volume: on ? -9 : -11,
  })
  const band = new Tone.Filter({ frequency: on ? 3400 : 1500, type: 'bandpass', Q: 1.7 })
  const tick = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 1.8,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    volume: on ? -15 : -17,
  })
  noise.connect(band)
  connectToOutput(band)
  connectToOutput(tick)
  noise.triggerAttackRelease(0.028, now)
  tick.triggerAttackRelease(on ? 'A4' : 'E4', 0.035, now)
  window.setTimeout(() => {
    noise.dispose()
    band.dispose()
    tick.dispose()
  }, 450)
}
