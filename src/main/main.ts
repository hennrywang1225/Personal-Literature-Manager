import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1050,
    minHeight: 720,
    title: 'Personal Literature Manager',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(__dirname, '../preload/preload.js')
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
