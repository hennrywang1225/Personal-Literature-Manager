import { randomUUID } from 'node:crypto'
import AdmZip from 'adm-zip'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { DocumentRecord, LibrarySnapshot } from '../shared/types'

export interface CreateExportServiceOptions {
  libraryRoot: string
  exportsDir: string
  getSnapshot: () => LibrarySnapshot | Promise<LibrarySnapshot>
}

type ExportKind = 'selected' | 'category' | 'all'

const exportFileNames: Record<ExportKind, string> = {
  selected: 'selected-documents',
  category: 'category-documents',
  all: 'all-documents',
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}

function timeStamp() {
  return new Date().toISOString().slice(11, 19).replace(/:/g, '')
}

function shortId() {
  return randomUUID().replace(/-/g, '').slice(0, 8)
}

function zipPathForStoredFile(storedFilePath: string) {
  return storedFilePath.replace(/\\/g, '/')
}

function limitSnapshot(
  snapshot: LibrarySnapshot,
  documents: DocumentRecord[],
): LibrarySnapshot {
  const categoryIds = new Set(documents.map((document) => document.categoryId).filter(Boolean))
  const tagNames = new Set(documents.flatMap((document) => document.tags))

  return {
    documents,
    categories: snapshot.categories.filter((category) => categoryIds.has(category.id)),
    tags: snapshot.tags.filter((tag) => tagNames.has(tag.name)),
  }
}

function isInsideDirectory(parentPath: string, childPath: string) {
  const relativePath = relative(parentPath, childPath)
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

function validateStoredFilePath(libraryRoot: string, document: DocumentRecord) {
  const archivePath = zipPathForStoredFile(document.storedFilePath)
  const archivePathSegments = archivePath.split('/')
  const managedFilesDir = resolve(libraryRoot, 'files')
  const absolutePath = resolve(libraryRoot, document.storedFilePath)

  if (
    isAbsolute(document.storedFilePath) ||
    !archivePath.startsWith('files/') ||
    archivePathSegments.includes('..') ||
    !isInsideDirectory(managedFilesDir, absolutePath)
  ) {
    throw new Error(
      `unsafe managed file path for document ${document.id}: ${archivePath}`,
    )
  }

  return { absolutePath, archivePath }
}

async function validateDocumentFiles(libraryRoot: string, documents: DocumentRecord[]) {
  const files = documents.map((document) => ({
    document,
    ...validateStoredFilePath(libraryRoot, document),
  }))

  for (const file of files) {
    try {
      const fileStat = await stat(file.absolutePath)
      if (!fileStat.isFile()) {
        throw new Error('not a file')
      }
    } catch {
      throw new Error(
        `missing managed file for document ${file.document.id}: ${file.archivePath}`,
      )
    }
  }

  return files
}

export function createExportService({
  libraryRoot,
  exportsDir,
  getSnapshot,
}: CreateExportServiceOptions) {
  async function writeExport(
    kind: ExportKind,
    snapshot: LibrarySnapshot,
    documents: DocumentRecord[],
  ) {
    const limitedSnapshot = limitSnapshot(snapshot, documents)

    const documentFiles = await validateDocumentFiles(libraryRoot, limitedSnapshot.documents)
    await mkdir(exportsDir, { recursive: true })

    const zip = new AdmZip()
    zip.addFile(
      'metadata.json',
      Buffer.from(JSON.stringify(limitedSnapshot, null, 2), 'utf8'),
    )

    for (const file of documentFiles) {
      zip.addFile(file.archivePath, await readFile(file.absolutePath))
    }

    const exportPath = join(
      exportsDir,
      `${exportFileNames[kind]}-${dateStamp()}-${timeStamp()}-${shortId()}.zip`,
    )
    zip.writeZip(exportPath)
    return exportPath
  }

  async function exportSelection(documentIds: string[]): Promise<string> {
    const snapshot = await getSnapshot()
    const selectedIds = new Set(documentIds)
    return writeExport(
      'selected',
      snapshot,
      snapshot.documents.filter((document) => selectedIds.has(document.id)),
    )
  }

  async function exportCategory(categoryId: string | null): Promise<string> {
    const snapshot = await getSnapshot()
    return writeExport(
      'category',
      snapshot,
      snapshot.documents.filter((document) => document.categoryId === categoryId),
    )
  }

  async function exportAll(): Promise<string> {
    const snapshot = await getSnapshot()
    return writeExport('all', snapshot, snapshot.documents)
  }

  return {
    exportSelection,
    exportCategory,
    exportAll,
  }
}
