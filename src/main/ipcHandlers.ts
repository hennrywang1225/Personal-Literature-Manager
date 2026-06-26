import { dialog, ipcMain } from 'electron'
import { READING_STATUSES } from '../shared/constants'
import type {
  AppSettings,
  CategoryRecord,
  CreatePdfAnnotationInput,
  DocumentRecord,
  ImportCandidate,
  ImportConfirmation,
  LibrarySnapshot,
  PdfAnnotationRecord,
  PdfAnnotationRect,
  PdfAnnotationType,
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
  repo: Pick<
    DocumentRepository,
    | 'getSnapshot'
    | 'upsertCategory'
    | 'updateDocument'
    | 'updateDocumentsCategory'
    | 'deleteDocuments'
    | 'listPdfAnnotations'
    | 'createPdfAnnotation'
    | 'deletePdfAnnotation'
  >
  importService: Pick<ImportService, 'createCandidates' | 'confirmImports'>
  saveDatabase: () => Promise<void>
  getFileUrl: (documentId: string) => string | Promise<string>
  getTextContent: (documentId: string) => string | Promise<string>
  openExternal: (documentId: string) => string | Promise<string>
  exportSelection: (ids: string[]) => Promise<string | null>
  exportCategory: (categoryId: string | null) => Promise<string | null>
  exportAll: () => Promise<string | null>
  getSettings: () => AppSettings | Promise<AppSettings>
  chooseLibraryRoot: () => AppSettings | Promise<AppSettings>
  chooseDefaultExportDirectory: () => AppSettings | Promise<AppSettings>
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

function assertFiniteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
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

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
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

function validateCategoryPayload(payload: unknown): {
  name: string
  parentId: string | null
} {
  if (!isRecord(payload)) {
    throw new Error('category payload must be an object')
  }

  assertString(payload.name, 'category name')
  assertStringOrNull(payload.parentId ?? null, 'category parentId')

  const name = payload.name.trim()

  if (!name) {
    throw new Error('category name must not be empty')
  }

  return {
    name,
    parentId: payload.parentId ?? null,
  }
}

function validateBulkCategoryArgs(
  ids: unknown,
  categoryId: unknown,
): { ids: string[]; categoryId: string | null } {
  assertStringArray(ids, 'document ids')
  assertStringOrNull(categoryId, 'category id')

  return {
    ids,
    categoryId,
  }
}

function assertPdfAnnotationType(
  value: unknown,
  label: string,
): asserts value is PdfAnnotationType {
  if (value !== 'highlight' && value !== 'underline') {
    throw new Error(`${label} must be highlight or underline`)
  }
}

function validatePdfAnnotationRect(
  value: unknown,
  index: number,
): PdfAnnotationRect {
  if (!isRecord(value)) {
    throw new Error(`annotation rect ${index} must be an object`)
  }

  assertNumberOrNull(value.pageNumber, `annotation rect ${index} pageNumber`)
  assertFiniteNumber(value.x, `annotation rect ${index} x`)
  assertFiniteNumber(value.y, `annotation rect ${index} y`)
  assertFiniteNumber(value.width, `annotation rect width`)
  assertFiniteNumber(value.height, `annotation rect ${index} height`)

  if (value.pageNumber === null || value.pageNumber < 1) {
    throw new Error(`annotation rect ${index} pageNumber must be at least 1`)
  }

  if (value.width <= 0 || value.height <= 0) {
    throw new Error(`annotation rect ${index} size must be positive`)
  }

  return {
    pageNumber: value.pageNumber,
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
  }
}

function validateCreatePdfAnnotationPayload(
  payload: unknown,
): CreatePdfAnnotationInput {
  if (!isRecord(payload)) {
    throw new Error('PDF annotation payload must be an object')
  }

  assertString(payload.documentId, 'annotation documentId')
  assertNumberOrNull(payload.pageNumber, 'annotation pageNumber')
  assertPdfAnnotationType(payload.type, 'annotation type')
  assertString(payload.color, 'annotation color')

  if (payload.pageNumber === null || payload.pageNumber < 1) {
    throw new Error('annotation pageNumber must be at least 1')
  }

  if (!Array.isArray(payload.rects) || payload.rects.length === 0) {
    throw new Error('annotation rects must be a non-empty array')
  }

  return {
    documentId: payload.documentId,
    pageNumber: payload.pageNumber,
    type: payload.type,
    color: payload.color,
    rects: payload.rects.map(validatePdfAnnotationRect),
  }
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

  ipcMain.handle(
    'library:updateDocumentsCategory',
    async (
      _event,
      rawIds: unknown,
      rawCategoryId: unknown,
    ): Promise<DocumentRecord[]> => {
      const { ids, categoryId } = validateBulkCategoryArgs(rawIds, rawCategoryId)
      const updated = options.repo.updateDocumentsCategory(ids, categoryId)

      await options.saveDatabase()
      return updated
    },
  )

  ipcMain.handle(
    'library:deleteDocuments',
    async (_event, rawIds: unknown): Promise<DocumentRecord[]> => {
      assertStringArray(rawIds, 'document ids')
      const deleted = options.repo.deleteDocuments(rawIds)

      await options.saveDatabase()
      return deleted
    },
  )

  ipcMain.handle(
    'library:upsertCategory',
    async (_event, payload: unknown): Promise<CategoryRecord> => {
      const category = options.repo.upsertCategory(validateCategoryPayload(payload))

      await options.saveDatabase()
      return category
    },
  )

  ipcMain.handle('library:getFileUrl', (_event, documentId: string) => {
    return options.getFileUrl(documentId)
  })

  ipcMain.handle('library:getTextContent', (_event, documentId: string) => {
    return options.getTextContent(documentId)
  })

  ipcMain.handle(
    'library:listPdfAnnotations',
    async (_event, rawDocumentId: unknown): Promise<PdfAnnotationRecord[]> => {
      assertString(rawDocumentId, 'document id')
      return options.repo.listPdfAnnotations(rawDocumentId)
    },
  )

  ipcMain.handle(
    'library:createPdfAnnotation',
    async (_event, payload: unknown): Promise<PdfAnnotationRecord> => {
      const annotation = options.repo.createPdfAnnotation(
        validateCreatePdfAnnotationPayload(payload),
      )

      await options.saveDatabase()
      return annotation
    },
  )

  ipcMain.handle(
    'library:deletePdfAnnotation',
    async (_event, rawAnnotationId: unknown): Promise<PdfAnnotationRecord> => {
      assertString(rawAnnotationId, 'annotation id')
      const annotation = options.repo.deletePdfAnnotation(rawAnnotationId)

      await options.saveDatabase()
      return annotation
    },
  )

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

  ipcMain.handle('library:getSettings', () => {
    return options.getSettings()
  })

  ipcMain.handle('library:chooseLibraryRoot', () => {
    return options.chooseLibraryRoot()
  })

  ipcMain.handle('library:chooseDefaultExportDirectory', () => {
    return options.chooseDefaultExportDirectory()
  })
}
