import { contextBridge, ipcRenderer } from 'electron'

// Expose a secure API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  openFileNatively: (options: {
    fileName: string
    url: string
    bucketName?: string
    openAfterDownload?: boolean
  }) => ipcRenderer.invoke('open-file-natively', options),

  selectFile: () => ipcRenderer.invoke('select-file'),

  selectFiles: () => ipcRenderer.invoke('select-files'),

  // Platform detection helper
  getPlatform: () => process.platform,

  // App version info
  getAppVersion: () => process.env.npm_package_version || 'unknown'
})

// Type declaration for window.electron
declare global {
  interface Window {
    electron: {
      openFileNatively: (options: {
        fileName: string
        url: string
        bucketName?: string
        openAfterDownload?: boolean
      }) => Promise<{ success: boolean; filePath: string }>
      selectFile: () => Promise<{ filePaths: string[]; canceled: boolean }>
      selectFiles: () => Promise<{ filePaths: string[]; canceled: boolean }>
      getPlatform: () => string
      getAppVersion: () => string
    }
  }
}
