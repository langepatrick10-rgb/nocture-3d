export async function loadAudioMono(bytes: ArrayBuffer, targetSampleRate: number): Promise<Float32Array> {
  const AudioCtx = window.AudioContext
  const ctx = new AudioCtx({ sampleRate: targetSampleRate })
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await ctx.decodeAudioData(bytes.slice(0))
  } finally {
    await ctx.close().catch(() => undefined)
  }

  if (audioBuffer.sampleRate !== targetSampleRate) {
    const offlineLength = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate))
    const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, offlineLength, targetSampleRate)
    const src = offlineCtx.createBufferSource()
    src.buffer = audioBuffer
    src.connect(offlineCtx.destination)
    src.start()
    audioBuffer = await offlineCtx.startRendering()
  }

  const { numberOfChannels, length } = audioBuffer
  const mono = new Float32Array(length)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; i++) mono[i] += data[i]
  }
  if (numberOfChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= numberOfChannels
  }
  return mono
}
