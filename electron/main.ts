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
    // Don't show the save dialog, just save to Downloads
    const downloadsPath = path.join(os.homedir(), 'Downloads')
    const fileName = item.getFilename()
    const savePath = path.join(downloadsPath, fileName)
    
    item.setSavePath(savePath)
    
    // After download completes, open the file
    item.once('done', (event) => {
      if (event === 'completed') {
        shell.openPath(savePath).catch((error) => {
          console.error('Failed to open file:', error)
        })
      }
    })
  })
}

// IPC handler for opening files with native applications
ipcMain.handle('open-file', async (_event, fileName: string) => {
  try {
    const downloadsPath = path.join(os.homedir(), 'Downloads')
    const filePath = path.join(downloadsPath, fileName)
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` }
    }
    
    const result = await shell.openPath(filePath)
    if (result === '') {
      return { success: true }
    } else {
      return { success: false, error: result }
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
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
