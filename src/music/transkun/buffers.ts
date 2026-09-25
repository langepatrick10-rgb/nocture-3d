import { DEFAULT_PARAMS, type TranskunParams } from './params'

export interface TranskunBuffers {
  params: TranskunParams
  freq2mels: Float32Array
  windows: Float32Array[]
  symbols: Int32Array
  melFirst: Int32Array
  melLast: Int32Array
}

async function fetchBinary(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url}`)
  return res.arrayBuffer()
}

export async function loadTranskunBuffers(baseUrl: string): Promise<TranskunBuffers> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

  const [paramsRes, freq2melsBuf, windowsBuf, symbolsBuf] = await Promise.all([
    fetch(base + 'params.json').then(async (r) => {
      if (!r.ok) throw new Error('Could not load Transkun params')
      return r.json() as Promise<Partial<TranskunParams>>
    }),
    fetchBinary(base + 'freq2mels.f32'),
    fetchBinary(base + 'windows.f32'),
    fetchBinary(base + 'symbols.i32'),
  ])

  const params: TranskunParams = { ...DEFAULT_PARAMS, ...paramsRes }

  const freq2mels = new Float32Array(freq2melsBuf)
  if (freq2mels.length !== params.rfftBins * params.nMels) {
    throw new Error(`freq2mels.f32 has the wrong size (${freq2mels.length})`)
  }

  const flatWindows = new Float32Array(windowsBuf)
  const windows: Float32Array[] = []
  for (let w = 0; w < params.nWindows; w++) {
    windows.push(flatWindows.slice(w * params.windowSize, (w + 1) * params.windowSize))
  }

  const symbols = new Int32Array(symbolsBuf)
  const nMels = params.nMels
  const rfftBins = params.rfftBins
  const melFirst = new Int32Array(nMels)
  const melLast = new Int32Array(nMels)
  for (let m = 0; m < nMels; m++) {
    let first = -1
    let last = -1
    for (let k = 0; k < rfftBins; k++) {
      if (freq2mels[k * nMels + m] !== 0) {
        if (first < 0) first = k
        last = k
      }
    }
    melFirst[m] = first < 0 ? 0 : first
    melLast[m] = last < 0 ? -1 : last
  }

  return { params, freq2mels, windows, symbols, melFirst, melLast }
}
