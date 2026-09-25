export interface TranskunParams {
  fs: number
  windowSize: number
  hopSize: number
  nMels: number
  nWindows: number
  eps: number
  fMin: number
  fMax: number
  rfftBins: number
  segmentSizeSeconds: number
  segmentHopSeconds: number
  nSymbols: number
}

export const DEFAULT_PARAMS: TranskunParams = {
  fs: 44100,
  windowSize: 4096,
  hopSize: 1024,
  nMels: 229,
  nWindows: 6,
  eps: 1e-5,
  fMin: 30.0,
  fMax: 8000.0,
  rfftBins: 2049,
  segmentSizeSeconds: 16.0,
  segmentHopSeconds: 8.0,
  nSymbols: 90,
}

export const CTX_DIM = 256
export const ATTR_DIM = 3 * CTX_DIM
export const VELOCITY_CLASSES = 128
export const SUSTAIN_SYMBOL = -64
export const SOFT_SYMBOL = -67
