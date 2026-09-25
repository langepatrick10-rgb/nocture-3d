import { player } from './player'
import { useAppStore } from './store'

let attached = false

function onMessage(event: MIDIMessageEvent): void {
  const data = event.data
  if (!data || data.length < 2) return
  const cmd = data[0] & 0xf0
  const note = data[1]
  const vel = data.length > 2 ? data[2] : 0

  if (cmd === 0x90 && vel > 0) {
    player.userNoteOn(note, Math.max(vel / 127, 0.12))
  } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
    player.userNoteOff(note)
  } else if (cmd === 0xb0 && note === 64) {
    player.setSustain(vel >= 64)
  }
}

export async function connectWebMidi(): Promise<void> {
  if (attached || !('requestMIDIAccess' in navigator)) {
    if (!('requestMIDIAccess' in navigator)) {
      useAppStore.getState().setStatus('Web MIDI is not supported in this browser.')
    }
    return
  }

  try {
    const access = await navigator.requestMIDIAccess({ sysex: false })
    const attach = () => {
      let name: string | null = null
      access.inputs.forEach((input) => {
        input.onmidimessage = onMessage
        name = input.name || name
      })
      useAppStore.getState().setMidiDeviceName(name)
      if (name) useAppStore.getState().setStatus(`MIDI: ${name}`)
    }
    attach()
    access.onstatechange = () => attach()
    attached = true
  } catch {
    useAppStore.getState().setStatus('MIDI access was blocked.')
  }
}
