const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pianoDesktop', {
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  getFullscreen: () => ipcRenderer.invoke('get-fullscreen'),
  onFullscreen: (cb) => {
    const listener = (_event, value) => cb(Boolean(value))
    ipcRenderer.on('fullscreen', listener)
    return () => ipcRenderer.removeListener('fullscreen', listener)
  },
  searchMidi: (query) => ipcRenderer.invoke('midi-search', query),
  fetchMidi: (url) => ipcRenderer.invoke('midi-fetch', url),
})
