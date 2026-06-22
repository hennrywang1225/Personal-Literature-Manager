import { constants } from 'node:fs'
import { access, copyFile, mkdir } from 'node:fs/promises'
import { extname, join, normalize, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FileType } from '../shared/types'

const extensionToFileType: Record<string, FileType> = {
  '.pdf': 'pdf',
  '.doc': 'doc',
  '.docx': 'docx',
  '.txt': 'txt',
  '.md': 'md',
  '.markdown': 'md',
}

export interface StoredFileResult {
  storedFileName: string
  relativePath: string
  absolutePath: string
}

export interface FileStore {
  copyIntoLibrary(
    sourcePath: string,
    documentId: string,
    originalFileName: string,
  ): Promise<StoredFileResult>
  toFileUrl(absolutePath: string): string
  openExternal(absolutePath: string): Promise<string>
}

export function detectFileType(fileName: string): FileType {
  const extension = extname(fileName).toLowerCase()
  const fileType = extensionToFileType[extension]

  if (!fileType) {
    throw new Error(`Unsupported file type: ${fileName}`)
  }

  return fileType
}

function safeOriginalExtension(fileName: string): string {
  detectFileType(fileName)
  return extname(fileName).toLowerCase()
}

function assertSafeDocumentId(documentId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(documentId)) {
    throw new Error(
      `Invalid documentId: ${documentId}. Use only letters, numbers, underscores, and hyphens.`,
    )
  }
}

function assertPathInsideFilesDir(filesDir: string, absolutePath: string) {
  const resolvedFilesDir = resolve(filesDir)
  const resolvedPath = resolve(absolutePath)
  const pathFromFilesDir = relative(resolvedFilesDir, resolvedPath)

  if (
    pathFromFilesDir.startsWith('..') ||
    pathFromFilesDir === '' ||
    /^[A-Za-z]:/.test(pathFromFilesDir)
  ) {
    throw new Error(`Stored file path escapes filesDir: ${absolutePath}`)
  }
}

export function createFileStore({ filesDir }: { filesDir: string }): FileStore {
  const normalizedFilesDir = normalize(filesDir)

  return {
    async copyIntoLibrary(sourcePath, documentId, originalFileName) {
      await access(sourcePath, constants.R_OK)
      await mkdir(normalizedFilesDir, { recursive: true })

      assertSafeDocumentId(documentId)

      const storedFileName = `${documentId}${safeOriginalExtension(originalFileName)}`
      const absolutePath = normalize(join(normalizedFilesDir, storedFileName))
      assertPathInsideFilesDir(normalizedFilesDir, absolutePath)

      await copyFile(sourcePath, absolutePath)

      return {
        storedFileName,
        relativePath: `files/${storedFileName}`,
        absolutePath,
      }
    },

    toFileUrl(absolutePath) {
      return pathToFileURL(absolutePath).toString()
    },

    async openExternal(absolutePath) {
      const { shell } = await import('electron')
      return shell.openPath(absolutePath)
    },
  }
}
