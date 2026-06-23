import { dialog, ipcMain } from 'electron'
import { READING_STATUSES } from '../shared/constants'
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

const importConfirmationStringFields = [
  'sourcePath',
  'title',
  'authors',
  'doi',
  'venue',
  'note',
] as const

const updateStringFields = ['title', 'authors', 'doi', 'venue', 'note'] as const

const updatePatchKeys = new Set([
  'title',
  'authors',
  'year',
  'doi',
  'venue',
  'categoryId',
  'tags',
  'importance',
  'readingStatus',
  'note',
])

export interface RegisterIpcHandlersOptions {
  repo: Pick<DocumentRepository, 'getSnapshot' | 'updateDocument'>
  importService: Pick<ImportService, 'createCandidates' | 'confirmImports'>
  saveDatabase: () => Promise<void>
  getFileUrl: (documentId: string) => string | Promise<string>
  openExternal: (documentId: string) => string | Promise<string>
  exportSelection: (ids: string[]) => Promise<string>
  exportCategory: (categoryId: string | null) => Promise<string>
  exportAll: () => Promise<string>
}

const importFilters = [
  { name: 'Supported documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'markdown'] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: 'Word documents', extensions: ['doc', 'docx'] },
  { name: 'Text and Markdown', extensions: ['txt', 'md', 'markdown'] },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }
}

function assertNumberOrNull(value: unknown, label: string): asserts value is number | null {
  if (
    value !== null &&
    (typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !Number.isInteger(value))
  ) {
    throw new Error(`${label} must be a finite integer or null`)
  }
}

function assertStringOrNull(value: unknown, label: string): asserts value is string | null {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`${label} must be a string or null`)
  }
}

function assertTags(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) {
    throw new Error(`${label} must be an array of strings`)
  }
}

function assertImportance(
  value: unknown,
  label: string,
): asserts value is DocumentRecord['importance'] {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5) {
    throw new Error(`${label} must be an integer from 1 to 5`)
  }
}

function assertReadingStatus(
  value: unknown,
  label: string,
): asserts value is DocumentRecord['readingStatus'] {
  if (typeof value !== 'string' || !READING_STATUSES.includes(value as DocumentRecord['readingStatus'])) {
    throw new Error(`${label} must be one of ${READING_STATUSES.join(', ')}`)
  }
}

function validateImportConfirmations(value: unknown): ImportConfirmation[] {
  if (!Array.isArray(value)) {
    throw new Error('confirmImports payload must be an array')
  }

  return value.map((item, index) => {
    const label = `confirmImports[${index}]`

    if (!isRecord(item)) {
      throw new Error(`${label} must be an object`)
    }

    for (const field of importConfirmationStringFields) {
      assertString(item[field], `${label}.${field}`)
    }

    assertNumberOrNull(item.year, `${label}.year`)
    assertStringOrNull(item.categoryId, `${label}.categoryId`)
    assertTags(item.tags, `${label}.tags`)
    assertImportance(item.importance, `${label}.importance`)
    assertReadingStatus(item.readingStatus, `${label}.readingStatus`)

    return {
      sourcePath: item.sourcePath,
      title: item.title,
      authors: item.authors,
      year: item.year,
      doi: item.doi,
      venue: item.venue,
      categoryId: item.categoryId,
      tags: item.tags,
      importance: item.importance,
      readingStatus: item.readingStatus,
      note: item.note,
    }
  })
}

function validateUpdateDocumentArgs(
  id: unknown,
  patch: unknown,
): { id: string; patch: UpdateDocumentPatch } {
  assertString(id, 'document id')

  if (!isRecord(patch)) {
    throw new Error('update patch must be an object')
  }

  for (const key of Object.keys(patch)) {
    if (!updatePatchKeys.has(key)) {
      throw new Error(`update patch contains unsupported key: ${key}`)
    }
  }

  for (const field of updateStringFields) {
    if (field in patch) {
      assertString(patch[field], `update patch.${field}`)
    }
  }

  if ('year' in patch) {
    assertNumberOrNull(patch.year, 'update patch.year')
  }

  if ('categoryId' in patch) {
    assertStringOrNull(patch.categoryId, 'update patch.categoryId')
  }

  if ('tags' in patch) {
    assertTags(patch.tags, 'update patch.tags')
  }

  if ('importance' in patch) {
    assertImportance(patch.importance, 'update patch.importance')
  }

  if ('readingStatus' in patch) {
    assertReadingStatus(patch.readingStatus, 'update patch.readingStatus')
  }

  return { id, patch: patch as UpdateDocumentPatch }
}

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
    async (_event, payload: unknown): Promise<DocumentRecord[]> => {
      const imported = await options.importService.confirmImports(
        validateImportConfirmations(payload),
      )
      await options.saveDatabase()
      return imported
    },
  )

  ipcMain.handle(
    'library:updateDocument',
    async (_event, rawId: unknown, rawPatch: unknown): Promise<DocumentRecord> => {
      const { id, patch } = validateUpdateDocumentArgs(rawId, rawPatch)
      const updated = await options.repo.updateDocument(id, patch)
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

  ipcMain.handle('library:exportCategory', (_event, categoryId: string | null) => {
    return options.exportCategory(categoryId)
  })

  ipcMain.handle('library:exportAll', () => {
    return options.exportAll()
  })
}
