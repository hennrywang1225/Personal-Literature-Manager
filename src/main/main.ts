import { rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import { createAppSettingsStore } from './appSettings'
import { openLibraryDatabase } from './database'
import { createDocumentRepository } from './documentRepository'
import { createExportService } from './exportService'
import { createFileStore } from './fileStore'
import { createImportService } from './importService'
import { registerIpcHandlers } from './ipcHandlers'
import { buildLibraryPaths, resolveLibraryRoot } from './libraryPaths'
import { migrateLibraryRoot } from './libraryMigration'
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
  const defaultRoot = resolveLibraryRoot({
    isPackaged: app.isPackaged,
    appDataPath: app.getPath('appData'),
    exeDir: dirname(app.getPath('exe')),
  })
  const defaultPaths = buildLibraryPaths(defaultRoot)
  const settingsStore = createAppSettingsStore({
    settingsPath: join(app.getPath('userData'), 'settings.json'),
    defaultLibraryRoot: defaultRoot,
    defaultExportDir: defaultPaths.exportsDir,
  })

  async function createRuntime(root: string) {
    const paths = buildLibraryPaths(root)
    const db = await openLibraryDatabase({ databasePath: paths.databasePath })
    const repo = createDocumentRepository(db)
    const store = createFileStore({ filesDir: paths.filesDir })
    const importService = createImportService({
      repo,
      store,
      extractPdfMetadata,
    })
    const exportService = createExportService({
      libraryRoot: paths.root,
      exportsDir: paths.exportsDir,
      getSnapshot: repo.getSnapshot,
    })

    return {
      db,
      exportService,
      importService,
      paths,
      repo,
      store,
    }
  }

  let runtime = await createRuntime(settingsStore.get().libraryRoot)

  app.once('before-quit', () => {
    runtime.db.close()
  })

  async function chooseDirectory(title: string, defaultPath: string | null) {
    const result = await dialog.showOpenDialog({
      title,
      defaultPath: defaultPath ?? undefined,
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  }

  async function chooseExportDirectory() {
    const settings = settingsStore.get()
    const exportDir = await chooseDirectory(
      '选择导出位置',
      settings.defaultExportDir ?? runtime.paths.exportsDir,
    )

    if (!exportDir) {
      return null
    }

    settingsStore.update({ defaultExportDir: exportDir })
    return exportDir
  }

  async function chooseLibraryRoot() {
    const selectedRoot = await chooseDirectory(
      '选择文献库位置',
      settingsStore.get().libraryRoot,
    )

    if (!selectedRoot) {
      return settingsStore.get()
    }

    const previousExportDir = settingsStore.get().defaultExportDir
    const previousBuiltInExportDir = runtime.paths.exportsDir

    await runtime.db.save()
    await migrateLibraryRoot({
      fromRoot: runtime.paths.root,
      toRoot: selectedRoot,
    })
    runtime.db.close()
    runtime = await createRuntime(selectedRoot)

    const nextBuiltInExportDir = runtime.paths.exportsDir
    const shouldMoveDefaultExportDir =
      !previousExportDir || previousExportDir === previousBuiltInExportDir

    return settingsStore.update({
      libraryRoot: selectedRoot,
      defaultExportDir: shouldMoveDefaultExportDir
        ? nextBuiltInExportDir
        : previousExportDir,
    })
  }

  async function chooseDefaultExportDirectory() {
    const selectedExportDir = await chooseDirectory(
      '选择默认导出位置',
      settingsStore.get().defaultExportDir ?? runtime.paths.exportsDir,
    )

    if (!selectedExportDir) {
      return settingsStore.get()
    }

    return settingsStore.update({ defaultExportDir: selectedExportDir })
  }

  createWindow()

  registerIpcHandlers({
    repo: {
      getSnapshot: () => runtime.repo.getSnapshot(),
      upsertCategory: (input) => runtime.repo.upsertCategory(input),
      updateDocument: (id, patch) => runtime.repo.updateDocument(id, patch),
      updateDocumentsCategory: (ids, categoryId) =>
        runtime.repo.updateDocumentsCategory(ids, categoryId),
      deleteDocuments: (ids) => {
        const deletedDocuments = runtime.repo.deleteDocuments(ids)

        for (const document of deletedDocuments) {
          try {
            rmSync(
              resolveManagedFilePath({
                documentId: document.id,
                libraryRoot: runtime.paths.root,
                filesDir: runtime.paths.filesDir,
                storedFilePath: document.storedFilePath,
              }),
              { force: true },
            )
          } catch {
            // Keep the library record deletion even if an already-missing file cannot be removed.
          }
        }

        return deletedDocuments
      },
      listPdfAnnotations: (documentId) =>
        runtime.repo.listPdfAnnotations(documentId),
      createPdfAnnotation: (input) => runtime.repo.createPdfAnnotation(input),
      deletePdfAnnotation: (id) => runtime.repo.deletePdfAnnotation(id),
    },
    importService: {
      createCandidates: (filePaths) =>
        runtime.importService.createCandidates(filePaths),
      confirmImports: (confirmations) =>
        runtime.importService.confirmImports(confirmations),
    },
    saveDatabase: () => runtime.db.save(),
    getFileUrl(documentId) {
      const document = runtime.repo.getDocument(documentId)
      return runtime.store.toFileUrl(
        resolveManagedFilePath({
          documentId: document.id,
          libraryRoot: runtime.paths.root,
          filesDir: runtime.paths.filesDir,
          storedFilePath: document.storedFilePath,
        }),
      )
    },
    async getTextContent(documentId) {
      const document = runtime.repo.getDocument(documentId)

      if (document.fileType !== 'md') {
        throw new Error(`${document.fileType.toUpperCase()} 文件不能作为 Markdown 读取`)
      }

      return readFile(
        resolveManagedFilePath({
          documentId: document.id,
          libraryRoot: runtime.paths.root,
          filesDir: runtime.paths.filesDir,
          storedFilePath: document.storedFilePath,
        }),
        'utf8',
      )
    },
    openExternal(documentId) {
      const document = runtime.repo.getDocument(documentId)
      return runtime.store.openExternal(
        resolveManagedFilePath({
          documentId: document.id,
          libraryRoot: runtime.paths.root,
          filesDir: runtime.paths.filesDir,
          storedFilePath: document.storedFilePath,
        }),
      )
    },
    async exportSelection(ids) {
      const exportDir = await chooseExportDirectory()
      return exportDir
        ? runtime.exportService.exportSelection(ids, exportDir)
        : null
    },
    async exportCategory(categoryId) {
      const exportDir = await chooseExportDirectory()
      return exportDir
        ? runtime.exportService.exportCategory(categoryId, exportDir)
        : null
    },
    async exportAll() {
      const exportDir = await chooseExportDirectory()
      return exportDir ? runtime.exportService.exportAll(exportDir) : null
    },
    getSettings: () => settingsStore.get(),
    chooseLibraryRoot,
    chooseDefaultExportDirectory,
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
