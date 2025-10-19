import { contextBridge, ipcRenderer } from 'electron'

console.log('[Preload] Exposing electronAPI to window...')

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  showDevTools: () => ipcRenderer.invoke('show-devtools'),
  isElectron: () => ipcRenderer.invoke('is-electron')
})

console.log('[Preload] electronAPI exposed successfully')

declare global {
  interface Window {
    electronAPI: {
      openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
      showDevTools: () => Promise<void>
      isElectron: () => Promise<{ isElectron: boolean }>
    }
  }
}
