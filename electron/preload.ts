import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  showDevTools: () => ipcRenderer.invoke('show-devtools')
})

declare global {
  interface Window {
    electronAPI: {
      openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
      showDevTools: () => Promise<void>
    }
  }
}
