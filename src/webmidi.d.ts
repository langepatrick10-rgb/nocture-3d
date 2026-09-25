interface MIDIMessageEvent extends Event {
  data: Uint8Array | null
}

interface MIDIInput {
  name?: string
  onmidimessage: ((event: MIDIMessageEvent) => void) | null
}

interface MIDIInputMap {
  forEach(callback: (input: MIDIInput) => void): void
}

interface MIDIAccess {
  inputs: MIDIInputMap
  onstatechange: (() => void) | null
}

interface Navigator {
  requestMIDIAccess: (options?: { sysex?: boolean }) => Promise<MIDIAccess>
}
