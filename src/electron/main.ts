import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { execFile } from 'child_process'
import * as path from 'path'
import * as https from 'https'
import * as fs from 'fs'
import * as os from 'os'

let mainWindow: BrowserWindow | null

// Create the browser window.
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  })

  // Load the app URL from environment or localhost
  const isDev = process.env.NODE_ENV === 'development'
  const appUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(appUrl)

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App event listeners
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

// Helper to download file from URL
function downloadFile(url: string, fileName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(os.tmpdir(), 'r2-manager')
    const filePath = path.join(tempDir, fileName)

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const file = fs.createWriteStream(filePath)

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location || url, fileName)
          .then(resolve)
          .catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP ${response.statusCode}`))
        return
      }

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        resolve(filePath)
      })

      file.on('error', (err) => {
        fs.unlink(filePath, () => {}) // Delete the file if error occurs
        reject(err)
      })
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}) // Delete the file if error occurs
      reject(err)
    })
  })
}

// Helper to open file with default application
function openFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform

    let command: string
    let args: string[]

    if (platform === 'win32') {
      command = 'cmd'
      args = ['/c', 'start', '""', filePath]
    } else if (platform === 'darwin') {
      command = 'open'
      args = [filePath]
    } else {
      command = 'xdg-open'
      args = [filePath]
    }

    execFile(command, args, (error) => {
      if (error) {
        reject(new Error(`Failed to open file: ${error.message}`))
      } else {
        resolve()
      }
    })
  })
}

// IPC handlers for file operations
ipcMain.handle('open-file-natively', async (_event: Electron.IpcMainInvokeEvent, options: {
  fileName: string
  url: string
  bucketName?: string
  openAfterDownload?: boolean
}) => {
  try {
    const { fileName, url, openAfterDownload = true } = options

    // Download file to temp directory
    const filePath = await downloadFile(url, fileName)

    // Open with default application if requested
    if (openAfterDownload) {
      await openFile(filePath)
    }

    return { success: true, filePath }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(errorMessage)
  }
})

// Handle file selection dialog
ipcMain.handle('select-file', async () => {
  if (!mainWindow) {
    throw new Error('Main window not available')
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  })

  return result
})

// Handle multiple file selection
ipcMain.handle('select-files', async () => {
  if (!mainWindow) {
    throw new Error('Main window not available')
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  })

  return result
})
