import * as ort from 'onnxruntime-web/webgpu'

let ortReady = false
let runtimeBase = ''
let preferGpu = true

async function createSession(url: string): Promise<ort.InferenceSession> {
  configureOrt()
  if (preferGpu) {
    try {
      return await ort.InferenceSession.create(url, { executionProviders: ['webgpu', 'wasm'] })
    } catch {
      preferGpu = false
    }
  }
  return await ort.InferenceSession.create(url, { executionProviders: ['wasm'] })
}

export function setRuntimeBase(url: string): void {
  runtimeBase = url.endsWith('/') ? url : `${url}/`
}

function pageBase(): string {
  if (runtimeBase) return runtimeBase
  const href = globalThis.location?.href
  if (!href || href.startsWith('blob:')) {
    const origin = globalThis.location?.origin ?? ''
    return origin.endsWith('/') ? origin : `${origin}/`
  }
  return new URL('.', href).href
}

function assetFolder(name: string): string {
  return new URL(`${name}/`, pageBase()).href
}

export function transkunAssetUrl(file: string): string {
  return new URL(file.replace(/^\//, ''), assetFolder('transkun')).href
}

function configureOrt(): void {
  if (ortReady) return
  ort.env.wasm.wasmPaths = assetFolder('ort')
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = true
  ort.env.wasm.proxy = false
  ortReady = true
}

export class TranskunModel {
  private session: ort.InferenceSession | null = null
  private readonly url: string

  constructor(url: string) {
    this.url = url
  }

  async load(): Promise<void> {
    this.session = await createSession(this.url)
  }

  async run(
    features: Float32Array,
    nFrame: number,
    nMels: number,
    nWindows: number,
  ): Promise<{ s: Float32Array; ctx: Float32Array; t: number }> {
    if (!this.session) throw new Error('Transkun model is not loaded')
    const input = new ort.Tensor('float32', features, [1, nFrame, nMels, nWindows])
    const results = await this.session.run({ featuresBatch: input })
    const sTensor = results.S
    const ctxTensor = results.ctx
    if (!sTensor || !ctxTensor) throw new Error('Transkun model returned no scores')
    return {
      s: sTensor.data as Float32Array,
      ctx: ctxTensor.data as Float32Array,
      t: sTensor.dims[0] ?? nFrame,
    }
  }
}

export class TranskunHeadsModel {
  private session: ort.InferenceSession | null = null
  private readonly url: string

  constructor(url: string) {
    this.url = url
  }

  async load(): Promise<void> {
    this.session = await createSession(this.url)
  }

  async run(attr: Float32Array, n: number): Promise<{ velLogits: Float32Array; ofRaw: Float32Array }> {
    if (!this.session) throw new Error('Transkun heads are not loaded')
    if (n === 0) return { velLogits: new Float32Array(0), ofRaw: new Float32Array(0) }
    const input = new ort.Tensor('float32', attr, [n, 768])
    const results = await this.session.run({ attr: input })
    return {
      velLogits: (results.velLogits?.data as Float32Array) ?? new Float32Array(0),
      ofRaw: (results.ofRaw?.data as Float32Array) ?? new Float32Array(0),
    }
  }
}
