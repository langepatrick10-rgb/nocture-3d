import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const IMPORTS = path.join(root, 'Piano3D Imports')
const DROP_ROOMS = path.join(root, 'Drop rooms here')
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

function roomMime(file: string): string {
  const name = file.toLowerCase()
  if (name.endsWith('.glb')) return 'model/gltf-binary'
  if (name.endsWith('.gltf')) return 'model/gltf+json'
  if (name.endsWith('.json')) return 'application/json'
  if (name.endsWith('.bin')) return 'application/octet-stream'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.ktx2')) return 'image/ktx2'
  return 'application/octet-stream'
}

function safeRoomFile(name: string): string | null {
  let decoded = name
  try {
    decoded = decodeURIComponent(name)
  } catch {
    return null
  }
  if (!decoded || decoded.includes('\0')) return null
  const abs = path.normalize(path.join(DROP_ROOMS, decoded))
  const relative = path.relative(DROP_ROOMS, abs)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
    return null
  }
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null
}

function listDroppedRooms() {
  if (!fs.existsSync(DROP_ROOMS)) return []
  return fs
    .readdirSync(DROP_ROOMS)
    .filter(
      (file) =>
        /\.(glb|gltf)$/i.test(file) &&
        !/^scary_interior\.(glb|gltf)$/i.test(file) &&
        !/^modern apartment\.(glb|gltf)$/i.test(file) &&
        fs.statSync(path.join(DROP_ROOMS, file)).isFile(),
    )
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((file) => {
      const id = file.replace(/\.(glb|gltf)$/i, '')
      const jsonPath = path.join(DROP_ROOMS, `${id}.json`)
      let extra: Record<string, unknown> = {}
      if (fs.existsSync(jsonPath)) {
        try {
          extra = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>
        } catch {
          extra = {}
        }
      }
      const num = (value: unknown, fallback: number) => {
        const n = typeof value === 'number' ? value : Number(value)
        return Number.isFinite(n) ? n : fallback
      }
      return {
        id,
        label: typeof extra.label === 'string' && extra.label.trim() ? extra.label : id,
        file,
        url: `/rooms/${encodeURIComponent(file)}`,
        pianoX: num(extra.pianoX, 0),
        pianoY: num(extra.pianoY, 0),
        pianoZ: num(extra.pianoZ, 0),
        pianoYaw: num(extra.pianoYaw, 0),
        pianoScale: Math.max(0.1, num(extra.pianoScale, 1)),
        orbitDistance: Math.max(0.8, num(extra.orbitDistance, 3.2)),
        orbitYaw: num(extra.orbitYaw, 30),
        orbitPitch: Math.min(95, Math.max(15, num(extra.orbitPitch, 60))),
        cameraWindow: Math.min(360, Math.max(20, num(extra.cameraWindow, 360))),
        cameraWindowY: Math.min(140, Math.max(10, num(extra.cameraWindowY, 70))),
      }
    })
}

function copyDroppedRooms(destRoot: string) {
  const dest = path.join(destRoot, 'rooms')
  fs.mkdirSync(dest, { recursive: true })
  const rooms = listDroppedRooms().map((room) => ({
    ...room,
    url: `./rooms/${encodeURIComponent(room.file)}`,
  }))
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(rooms, null, 2))
  if (!fs.existsSync(DROP_ROOMS)) return
  for (const name of fs.readdirSync(DROP_ROOMS)) {
    if (name.startsWith('.') || name === 'PUT GLB FILES HERE.txt') continue
    const from = path.join(DROP_ROOMS, name)
    if (!fs.statSync(from).isFile()) continue
    fs.copyFileSync(from, path.join(dest, name))
  }
}

function roomsPlugin(): Plugin {
  return {
    name: 'dropped-rooms',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? ''

        if (req.method === 'GET' && (pathname === '/api/rooms' || pathname === '/rooms/manifest.json')) {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(listDroppedRooms()))
          return
        }

        if (req.method === 'GET' && pathname.startsWith('/rooms/')) {
          const file = safeRoomFile(pathname.slice('/rooms/'.length))
          if (!file) {
            next()
            return
          }
          res.setHeader('Content-Type', roomMime(file))
          res.setHeader('Cache-Control', 'no-cache')
          fs.createReadStream(file).pipe(res)
          return
        }

        next()
      })
    },
    writeBundle(options) {
      copyDroppedRooms(options.dir ?? path.join(root, 'dist'))
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
  plugins: [react(), serveImportedGrands(), pianoLibraryPlugin(), roomsPlugin()],
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [root, IMPORTS, DROP_ROOMS, TRANSKUN_DIR, ORT_DIR],
    },
    watch: {
      ignored: ['**/Drop rooms here/**'],
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
