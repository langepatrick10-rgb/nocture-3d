import { loadTranskunBuffers } from './transkun/buffers'
import { setRuntimeBase, transkunAssetUrl, TranskunHeadsModel, TranskunModel } from './transkun/onnxModel'
import { TranskunTranscriber } from './transkun/transcriber'
import { writeMidi } from './transkun/midiWriter'

const MAX_SECONDS = 8 * 60
const SAMPLE_RATE = 44100

let engine: TranskunTranscriber | null = null
let engineLoading: Promise<TranskunTranscriber> | null = null

async function getEngine(onProgress?: (pct: number) => void): Promise<TranskunTranscriber> {
  if (engine) return engine
  if (!engineLoading) {
    engineLoading = (async () => {
      onProgress?.(1)
      const buffers = await loadTranskunBuffers(transkunAssetUrl(''))
      const model = new TranskunModel(transkunAssetUrl('transkun.onnx'))
      const heads = new TranskunHeadsModel(transkunAssetUrl('transkun-heads.onnx'))
      onProgress?.(4)
      await model.load()
      await heads.load()
      engine = new TranskunTranscriber(buffers, model, heads)
      return engine
    })().catch((error) => {
      engineLoading = null
      throw error
    })
  }
  return engineLoading
}

export async function transcribePcm(
  audio: Float32Array,
  onProgress?: (pct: number) => void,
): Promise<ArrayBuffer> {
  const maxSamples = Math.floor(MAX_SECONDS * SAMPLE_RATE)
  const clipped = audio.length > maxSamples ? audio.subarray(0, maxSamples) : audio
  const transcriber = await getEngine(onProgress)
  const result = await transcriber.transcribe(clipped, (progress) => {
    const frac = progress.segmentsTotal === 0 ? 1 : progress.segmentsDone / progress.segmentsTotal
    onProgress?.(Math.min(99, 5 + Math.round(frac * 94)))
  })
  if (result.notes.length < 3) throw new Error('No piano notes found in that recording')
  onProgress?.(100)
  const midi = writeMidi(result.notes, result.pedal, SAMPLE_RATE)
  const copy = new Uint8Array(midi.byteLength)
  copy.set(midi)
  return copy.buffer
}

export function prepareTranscribeRuntime(origin: string): void {
  setRuntimeBase(origin)
}
