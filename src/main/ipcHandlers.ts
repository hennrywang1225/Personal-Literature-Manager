import { dialog, ipcMain } from 'electron'
import type {
  DocumentRecord,
  ImportCandidate,
  ImportConfirmation,
  LibrarySnapshot,
} from '../shared/types'
import type { createDocumentRepository } from './documentRepository'
import type { createImportService } from './importService'

type DocumentRepository = ReturnType<typeof createDocumentRepository>
type ImportService = ReturnType<typeof createImportService>
type UpdateDocumentPatch = Partial<
  Pick<
    DocumentRecord,
    | 'title'
    | 'authors'
    | 'year'
    | 'doi'
    | 'venue'
    | 'categoryId'
    | 'tags'
    | 'importance'
    | 'readingStatus'
    | 'note'
  >
>

export interface RegisterIpcHandlersOptions {
  repo: Pick<DocumentRepository, 'getSnapshot' | 'updateDocument'>
  importService: Pick<ImportService, 'createCandidates' | 'confirmImports'>
  saveDatabase: () => Promise<void>
  getFileUrl: (documentId: string) => string | Promise<string>
  openExternal: (documentId: string) => string | Promise<string>
  exportSelection: (ids: string[]) => unknown | Promise<unknown>
  exportCategory: (categoryId: string) => unknown | Promise<unknown>
  exportAll: () => unknown | Promise<unknown>
}

const importFilters = [
  { name: 'Supported documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'markdown'] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: 'Word documents', extensions: ['doc', 'docx'] },
  { name: 'Text and Markdown', extensions: ['txt', 'md', 'markdown'] },
]

export function registerIpcHandlers(options: RegisterIpcHandlersOptions) {
  ipcMain.handle('library:getSnapshot', (): LibrarySnapshot => {
    return options.repo.getSnapshot()
  })

  ipcMain.handle('library:chooseImportFiles', async (): Promise<ImportCandidate[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: importFilters,
    })

    if (result.canceled) {
      return []
    }

    return options.importService.createCandidates(result.filePaths)
  })

  ipcMain.handle(
    'library:confirmImports',
    async (_event, confirmations: ImportConfirmation[]): Promise<DocumentRecord[]> => {
      const imported = await options.importService.confirmImports(confirmations)
      await options.saveDatabase()
      return imported
    },
  )

  ipcMain.handle(
    'library:updateDocument',
    async (_event, id: string, patch: UpdateDocumentPatch): Promise<DocumentRecord> => {
      const updated = options.repo.updateDocument(id, patch)
      await options.saveDatabase()
      return updated
    },
  )

  ipcMain.handle('library:getFileUrl', (_event, documentId: string) => {
    return options.getFileUrl(documentId)
  })

  ipcMain.handle('library:openExternal', (_event, documentId: string) => {
    return options.openExternal(documentId)
  })

  ipcMain.handle('library:exportSelection', (_event, ids: string[]) => {
    return options.exportSelection(ids)
  })

  ipcMain.handle('library:exportCategory', (_event, categoryId: string) => {
    return options.exportCategory(categoryId)
  })

  ipcMain.handle('library:exportAll', () => {
    return options.exportAll()
  })
}
