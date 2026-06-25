import { dirname, join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { openLibraryDatabase } from './database'
import { createDocumentRepository } from './documentRepository'
import { createExportService } from './exportService'
import { createFileStore } from './fileStore'
import { createImportService } from './importService'
import { registerIpcHandlers } from './ipcHandlers'
import { buildLibraryPaths, resolveLibraryRoot } from './libraryPaths'
import { resolveManagedFilePath } from './managedFilePath'
import { extractPdfMetadata } from './pdfMetadata'

const createWindow = (): BrowserWindow => {
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
      preload: join(__dirname, '../preload/preload.cjs')
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

  return mainWindow
}

app.whenReady().then(async () => {
  const root = resolveLibraryRoot({
    isPackaged: app.isPackaged,
    appDataPath: app.getPath('appData'),
    exeDir: dirname(app.getPath('exe')),
  })
  const paths = buildLibraryPaths(root)
  const db = await openLibraryDatabase({ databasePath: paths.databasePath })
  let databaseClosed = false

  app.once('before-quit', () => {
    if (!databaseClosed) {
      databaseClosed = true
      db.close()
    }
  })

  const repo = createDocumentRepository(db)
  const store = createFileStore({ filesDir: paths.filesDir })
  const importService = createImportService({ repo, store, extractPdfMetadata })
  const exportService = createExportService({
    libraryRoot: root,
    exportsDir: paths.exportsDir,
    getSnapshot: repo.getSnapshot,
  })

  createWindow()

  registerIpcHandlers({
    repo,
    importService,
    saveDatabase: () => db.save(),
    getFileUrl(documentId) {
      const document = repo.getDocument(documentId)
      return store.toFileUrl(
        resolveManagedFilePath({
          documentId: document.id,
          libraryRoot: root,
          filesDir: paths.filesDir,
          storedFilePath: document.storedFilePath,
        }),
      )
    },
    openExternal(documentId) {
      const document = repo.getDocument(documentId)
      return store.openExternal(
        resolveManagedFilePath({
          documentId: document.id,
          libraryRoot: root,
          filesDir: paths.filesDir,
          storedFilePath: document.storedFilePath,
        }),
      )
    },
    exportSelection: exportService.exportSelection,
    exportCategory: exportService.exportCategory,
    exportAll: exportService.exportAll,
  })

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
