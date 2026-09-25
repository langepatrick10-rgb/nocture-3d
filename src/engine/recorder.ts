import { getRecordStream } from './audio'
import { useAppStore } from './store'

let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
let canvasEl: HTMLCanvasElement | null = null

export function setRecordCanvas(canvas: HTMLCanvasElement): void {
  canvasEl = canvas
}

function pickMime(): string | undefined {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

export function startRecording(): void {
  if (!canvasEl) {
    useAppStore.getState().setStatus('Canvas is not ready to record.')
    return
  }

  const video = canvasEl.captureStream(30)
  const audio = getRecordStream()
  const mixed = new MediaStream([
    ...video.getVideoTracks(),
    ...(audio ? audio.getAudioTracks() : []),
  ])

  chunks = []
  const mime = pickMime()
  recorder = mime ? new MediaRecorder(mixed, { mimeType: mime }) : new MediaRecorder(mixed)
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/webm' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nocture-3d-${Date.now()}.webm`
    a.click()
    URL.revokeObjectURL(url)
    useAppStore.getState().setRecording(false)
    useAppStore.getState().setStatus('Recording saved.')
  }
  recorder.start()
  useAppStore.getState().setRecording(true)
  useAppStore.getState().setStatus('Recording…')
}

export function stopRecording(): void {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  recorder = null
}
