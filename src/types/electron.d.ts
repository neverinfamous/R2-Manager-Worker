/**
 * Electron API exposed through context bridge (preload script)
 */
export interface ElectronAPI {
  openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
