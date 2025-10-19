import { app, BrowserWindow, ipcMain, shell, dialog, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.ts'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  })

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(startUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Set up download handler to track where files are saved
  session.defaultSession.on('will-download', (event, item, webContents) => {
    console.log('[Electron] Download started:', item.getFilename())
    
    // Don't show the save dialog, just save to Downloads
    const downloadsPath = path.join(os.homedir(), 'Downloads')
    const fileName = item.getFilename()
    const savePath = path.join(downloadsPath, fileName)
    
    console.log('[Electron] Saving to:', savePath)
    item.setSavePath(savePath)
    
    // After download completes, open the file
    item.once('done', (event) => {
      console.log('[Electron] Download done, state:', event)
      if (event === 'completed') {
        console.log('[Electron] Opening file:', savePath)
        shell.openPath(savePath)
          .then((error) => {
            if (error) {
              console.error('[Electron] Failed to open file:', error)
            } else {
              console.log('[Electron] File opened successfully')
            }
          })
          .catch((error) => {
            console.error('[Electron] Error opening file:', error)
          })
      }
    })
  })
}

// IPC handler for opening files with native applications
ipcMain.handle('open-file', async (_event, fileName: string) => {
  try {
    console.log('[IPC] open-file called with:', fileName)
    const downloadsPath = path.join(os.homedir(), 'Downloads')
    const filePath = path.join(downloadsPath, fileName)
    
    console.log('[IPC] Looking for file at:', filePath)
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      console.error('[IPC] File not found:', filePath)
      return { success: false, error: `File not found: ${filePath}` }
    }
    
    console.log('[IPC] File exists, opening with shell.openPath()...')
    const result = await shell.openPath(filePath)
    
    if (result === '') {
      console.log('[IPC] File opened successfully')
      return { success: true }
    } else {
      console.error('[IPC] shell.openPath returned error:', result)
      return { success: false, error: result }
    }
  } catch (error) {
    console.error('[IPC] Exception in open-file handler:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC handler to show DevTools console for debugging
ipcMain.handle('show-devtools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools()
  }
})

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('web-contents-created', (_event, contents) => {
  // Prevent navigation to external URLs
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
})
