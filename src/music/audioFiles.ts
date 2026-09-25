export function isAudioFile(file: File): boolean {
  if (/\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name)) return true
  return /^(audio\/(mpeg|mp3|wav|x-wav|mp4|aac|ogg|flac|webm|m4a)|video\/mp4)$/i.test(file.type)
}
