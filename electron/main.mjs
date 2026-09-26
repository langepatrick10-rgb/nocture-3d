import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchMidiBytes, searchOnlineMidi } from './midiNet.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const logPath = path.join(os.tmpdir(), 'piano3d-main.log')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'piano3d',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

function log(message) {
  try {
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`)
  } catch {
    /* ignore */
  }
}

process.on('uncaughtException', (error) => log(`uncaught ${error.stack || error}`))
process.on('unhandledRejection', (error) => log(`unhandled ${error}`))
fs.writeFileSync(logPath, `boot ${new Date().toISOString()}\n`)

function firstExisting(paths) {
  return paths.find((item) => fs.existsSync(item))
}

function mimeFor(file) {
  const name = file.toLowerCase()
  if (name.endsWith('.html')) return 'text/html; charset=utf-8'
  if (name.endsWith('.js') || name.endsWith('.mjs')) return 'text/javascript; charset=utf-8'
  if (name.endsWith('.css')) return 'text/css; charset=utf-8'
  if (name.endsWith('.wasm')) return 'application/wasm'
  if (name.endsWith('.json')) return 'application/json'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  if (name.endsWith('.glb')) return 'model/gltf-binary'
  if (name.endsWith('.gltf')) return 'model/gltf+json'
  if (name.endsWith('.bin')) return 'application/octet-stream'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.ktx2')) return 'image/ktx2'
  if (name.endsWith('.mp3')) return 'audio/mpeg'
  if (name.endsWith('.ogg') || name.endsWith('.oga')) return 'audio/ogg'
  if (name.endsWith('.wav')) return 'audio/wav'
  if (name.endsWith('.mid') || name.endsWith('.midi')) return 'audio/midi'
  if (name.endsWith('.woff2')) return 'font/woff2'
  return 'application/octet-stream'
}

function resolveAppFile(distRoot, requestUrl) {
  let pathname = '/'
  try {
    pathname = decodeURIComponent(new URL(requestUrl).pathname)
  } catch {
    return null
  }
  const rel = pathname.replace(/^\/+/, '') || 'index.html'
  if (rel.includes('\0') || rel.split(/[\\/]/).includes('..')) return null
  const abs = path.normalize(path.join(distRoot, rel))
  const relative = path.relative(distRoot, abs)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return null
  return abs
}

function registerAppProtocol(distRoot) {
  protocol.handle('piano3d', (request) => {
    const file = resolveAppFile(distRoot, request.url)
    if (!file) {
      log(`protocol 404 ${request.url}`)
      return new Response('Not found', { status: 404 })
    }
    try {
      const body = fs.readFileSync(file)
      return new Response(body, {
        headers: {
          'Content-Type': mimeFor(file),
          'Cache-Control': 'no-cache',
        },
      })
    } catch (error) {
      log(`protocol fail ${request.url} ${error}`)
      return new Response('Read failed', { status: 500 })
    }
  })
}

const distHtml = path.join(here, '../dist/index.html')
const iconPath = firstExisting([
  path.join(here, 'icon.png'),
  path.join(here, '../dist/icon.png'),
  path.join(here, '../public/icon.png'),
])
const splashHtml = path.join(here, 'splash.html')

log(`here=${here} packaged=${app.isPackaged} dist=${fs.existsSync(distHtml)} icon=${iconPath || 'none'}`)

app.setName('Nocture 3D')
app.setAppUserModelId('local.piano3d.app')
app.commandLine.appendSwitch('force-high-performance-gpu')
app.commandLine.appendSwitch('enable-gpu-rasterization')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

function loadApp(win) {
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    log(`fail-load ${code} ${desc} ${url}`)
    if (!win.isDestroyed()) win.show()
  })
  win.webContents.on('did-finish-load', () => log('finish-load'))

  const live = process.argv.includes('--dev')
  if (!live && (app.isPackaged || fs.existsSync(distHtml))) {
    void win.loadURL('piano3d://app/index.html')
    return
  }
  void win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
}

function sendFullscreen(win) {
  if (!win || win.isDestroyed()) return
  win.webContents.send('fullscreen', win.isFullScreen())
}

ipcMain.handle('toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return false
  const next = !win.isFullScreen()
  win.setFullScreen(next)
  sendFullscreen(win)
  return next
})

ipcMain.handle('get-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return Boolean(win && !win.isDestroyed() && win.isFullScreen())
})

ipcMain.handle('midi-search', async (_event, query) => searchOnlineMidi(query))
ipcMain.handle('midi-fetch', async (_event, url) => new Uint8Array(await fetchMidiBytes(url)))

function createSplash() {
  const splash = new BrowserWindow({
    width: 1100,
    height: 620,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    show: true,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#07080c',
    icon: iconPath,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (fs.existsSync(splashHtml)) void splash.loadFile(splashHtml)
  return splash
}

function createWindow(splash) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#07080c',
    title: 'Nocture : 3D',
    icon: iconPath,
    autoHideMenuBar: true,
    fullscreen: true,
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })

  win.on('enter-full-screen', () => sendFullscreen(win))
  win.on('leave-full-screen', () => sendFullscreen(win))
  win.webContents.on('did-finish-load', () => sendFullscreen(win))

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11' || (input.key === 'Escape' && win.isFullScreen())) {
      event.preventDefault()
      win.setFullScreen(!win.isFullScreen())
      sendFullscreen(win)
    }
  })

  const reveal = () => {
    if (!splash.isDestroyed()) splash.close()
    if (!win.isDestroyed() && !win.isVisible()) {
      win.setFullScreen(true)
      win.show()
      win.focus()
      sendFullscreen(win)
    }
  }

  win.once('ready-to-show', reveal)
  loadApp(win)
  return win
}

if (gotLock) {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows().find(
      (item) => !item.isDestroyed() && item.getTitle() === 'Nocture : 3D',
    ) ?? BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  app.whenReady().then(() => {
    log('whenReady')
    const distRoot = path.dirname(distHtml)
    if (fs.existsSync(distHtml)) registerAppProtocol(distRoot)
    const splash = createSplash()
    const win = createWindow(splash)
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.close()
      if (!win.isDestroyed() && !win.isVisible()) win.show()
    }, 8000)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
