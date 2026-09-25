export {}

declare global {
  interface Window {
    pianoDesktop?: {
      toggleFullscreen: () => Promise<boolean>
      getFullscreen: () => Promise<boolean>
      onFullscreen: (cb: (on: boolean) => void) => () => void
      searchMidi: (query: string) => Promise<
        Array<{ title: string; composer: string; source: 'mutopia' | 'bitmidi'; midiUrl: string }>
      >
      fetchMidi: (url: string) => Promise<Uint8Array>
    }
  }
}
