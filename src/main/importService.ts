import { randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'
import { DEFAULT_IMPORTANCE } from '../shared/constants'
import type {
  DocumentRecord,
  FileType,
  ImportCandidate,
  ImportConfirmation,
} from '../shared/types'
import type { createDocumentRepository } from './documentRepository'
import { detectFileType, type FileStore } from './fileStore'
import type { DerivedPdfMetadata } from './pdfMetadata'

type DocumentRepository = ReturnType<typeof createDocumentRepository>

export interface CreateImportServiceOptions {
  repo: DocumentRepository
  store: FileStore
  extractPdfMetadata: (
    sourcePath: string,
    originalFileName: string,
  ) => Promise<DerivedPdfMetadata>
}

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function titleFromFileName(fileName: string) {
  const extension = extname(fileName)
  return cleanWhitespace(basename(fileName, extension).replace(/[_-]+/g, ' '))
}

function originalFileNameFromPath(sourcePath: string) {
  return basename(sourcePath)
}

function fallbackCandidate(
  sourcePath: string,
  originalFileName: string,
  fileType: FileType,
): ImportCandidate {
  return {
    sourcePath,
    originalFileName,
    fileType,
    detectedTitle: titleFromFileName(originalFileName),
    detectedAuthors: '',
    detectedYear: null,
    detectedDoi: '',
    detectedVenue: '',
    extractionStatus: 'fallback',
  }
}

function storageId() {
  return `import-${randomUUID()}`
}

export function createImportService({
  repo,
  store,
  extractPdfMetadata,
}: CreateImportServiceOptions) {
  async function createCandidates(sourcePaths: string[]): Promise<ImportCandidate[]> {
    const candidates: ImportCandidate[] = []

    for (const sourcePath of sourcePaths) {
      const originalFileName = originalFileNameFromPath(sourcePath)
      const fileType = detectFileType(originalFileName)

      if (fileType !== 'pdf') {
        candidates.push(fallbackCandidate(sourcePath, originalFileName, fileType))
        continue
      }

      try {
        candidates.push({
          sourcePath,
          originalFileName,
          fileType,
          ...(await extractPdfMetadata(sourcePath, originalFileName)),
        })
      } catch {
        candidates.push(fallbackCandidate(sourcePath, originalFileName, fileType))
      }
    }

    return candidates
  }

  async function confirmImports(
    confirmations: ImportConfirmation[],
  ): Promise<DocumentRecord[]> {
    const imported: DocumentRecord[] = []

    for (const confirmation of confirmations) {
      const originalFileName = originalFileNameFromPath(confirmation.sourcePath)
      const fileType = detectFileType(originalFileName)
      const stored = await store.copyIntoLibrary(
        confirmation.sourcePath,
        storageId(),
        originalFileName,
      )
      const title = cleanWhitespace(confirmation.title) || titleFromFileName(originalFileName)

      imported.push(
        repo.createDocument({
          ...confirmation,
          title,
          importance: confirmation.importance ?? DEFAULT_IMPORTANCE,
          fileType,
          originalFileName,
          storedFileName: stored.storedFileName,
          storedFilePath: stored.absolutePath,
        }),
      )
    }

    return imported
  }

  return {
    createCandidates,
    confirmImports,
  }
}
