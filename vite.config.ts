import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const IMPORTS = path.join(root, 'Piano3D Imports')
const TRANSKUN_DIR = path.join(root, 'models/transkun')
const ORT_DIR = path.join(root, 'node_modules/onnxruntime-web/dist')
const ORT_FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.jspi.wasm',
  'ort-wasm-simd-threaded.jspi.mjs',
]

const GRAND_FILES: Record<string, string> = {
  '/models/grand-piano.glb': path.join(IMPORTS, 'grand_piano.glb'),
  '/models/grand-piano-marble.glb': path.join(IMPORTS, 'grand_piano_marble.glb'),
}

function mimeFor(name: string): string {
  if (name.endsWith('.json')) return 'application/json'
  if (name.endsWith('.wasm')) return 'application/wasm'
  if (name.endsWith('.mjs') || name.endsWith('.js')) return 'text/javascript'
  if (name.endsWith('.onnx')) return 'application/octet-stream'
  return 'application/octet-stream'
}

function serveDir(urlPrefix: string, dir: string) {
  return (reqUrl: string): string | null => {
    if (!reqUrl.startsWith(urlPrefix)) return null
    const name = reqUrl.slice(urlPrefix.length)
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) return null
    const file = path.join(dir, name)
    return fs.existsSync(file) ? file : null
  }
}

function serveImportedGrands(): Plugin {
  return {
    name: 'serve-imported-grands',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        const filePath = GRAND_FILES[url]
        if (!filePath || !fs.existsSync(filePath)) {
          next()
          return
        }
        res.setHeader('Content-Type', 'model/gltf-binary')
        res.setHeader('Cache-Control', 'no-cache')
        fs.createReadStream(filePath).pipe(res)
      })
    },
    generateBundle() {
      for (const [url, filePath] of Object.entries(GRAND_FILES)) {
        if (!fs.existsSync(filePath)) continue
        this.emitFile({
          type: 'asset',
          fileName: url.slice(1),
          source: fs.readFileSync(filePath),
        })
      }
    },
  }
}

function pianoLibraryPlugin(): Plugin {
  const transkunFile = serveDir('/transkun/', TRANSKUN_DIR)
  const ortFile = serveDir('/ort/', ORT_DIR)

  const copyRuntime = (dir: string) => {
    const transkunDest = path.join(dir, 'transkun')
    fs.mkdirSync(transkunDest, { recursive: true })
    for (const name of fs.readdirSync(TRANSKUN_DIR)) {
      fs.copyFileSync(path.join(TRANSKUN_DIR, name), path.join(transkunDest, name))
    }
    const ortDest = path.join(dir, 'ort')
    fs.mkdirSync(ortDest, { recursive: true })
    for (const name of ORT_FILES) {
      const from = path.join(ORT_DIR, name)
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(ortDest, name))
    }
  }

  return {
    name: 'piano-library',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void (async () => {
          const raw = req.url ?? ''
          const pathname = raw.split('?')[0] ?? ''
          const params = new URL(raw, 'http://piano3d.local').searchParams

          const local = transkunFile(pathname) ?? ortFile(pathname)
          if (local) {
            res.setHeader('Content-Type', mimeFor(path.basename(local)))
            res.setHeader('Cache-Control', 'no-cache')
            fs.createReadStream(local).pipe(res)
            return
          }

          if (pathname === '/api/midi-search') {
            try {
              // @ts-expect-error Electron helper is untyped ESM
              const net = (await import('./electron/midiNet.mjs')) as {
                searchOnlineMidi: (query: string) => Promise<unknown>
              }
              const hits = await net.searchOnlineMidi(params.get('q') ?? '')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(hits))
            } catch (error) {
              res.statusCode = 502
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
            }
            return
          }

          if (pathname === '/api/midi-fetch') {
            try {
              // @ts-expect-error Electron helper is untyped ESM
              const net = (await import('./electron/midiNet.mjs')) as {
                fetchMidiBytes: (url: string) => Promise<Uint8Array>
              }
              const bytes = await net.fetchMidiBytes(params.get('url') ?? '')
              res.setHeader('Content-Type', 'audio/midi')
              res.end(Buffer.from(bytes))
            } catch (error) {
              res.statusCode = 502
              res.end(error instanceof Error ? error.message : String(error))
            }
            return
          }

          next()
        })()
      })
    },
    writeBundle(options) {
      copyRuntime(options.dir ?? path.join(root, 'dist'))
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), serveImportedGrands(), pianoLibraryPlugin()],
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [root, IMPORTS, TRANSKUN_DIR, ORT_DIR],
    },
  },
  optimizeDeps: {
    include: ['tone', '@tonejs/midi', 'three'],
    exclude: ['onnxruntime-web'],
  },
  resolve: {
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
  assetsInclude: ['**/*.mid', '**/*.onnx', '**/*.wasm'],
})
