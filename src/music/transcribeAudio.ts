import { loadAudioMono } from './transkun/audioLoad'
import { prepareTranscribeRuntime, transcribePcm } from './transcribeCore'

const SAMPLE_RATE = 44100

export { isAudioFile } from './audioFiles'

export async function transcribeAudioToMidi(
  bytes: ArrayBuffer,
  _fileName: string,
  onProgress?: (pct: number) => void,
): Promise<ArrayBuffer> {
  prepareTranscribeRuntime(new URL('.', location.href).href)
  onProgress?.(1)
  const pcm = await loadAudioMono(bytes, SAMPLE_RATE)
  onProgress?.(5)
  return transcribePcm(pcm, onProgress)
}
