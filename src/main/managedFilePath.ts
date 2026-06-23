import { isAbsolute, relative, resolve } from 'node:path'

export interface ResolveManagedFilePathInput {
  documentId: string
  libraryRoot: string
  filesDir: string
  storedFilePath: string
}

function toArchivePath(storedFilePath: string) {
  return storedFilePath.replace(/\\/g, '/')
}

function hasAbsolutePathSyntax(storedFilePath: string) {
  return (
    isAbsolute(storedFilePath) ||
    /^[A-Za-z]:[\\/]/.test(storedFilePath) ||
    storedFilePath.startsWith('/') ||
    storedFilePath.startsWith('\\')
  )
}

function isInsideDirectory(parentPath: string, childPath: string) {
  const pathFromParent = relative(resolve(parentPath), resolve(childPath))
  return (
    pathFromParent !== '' &&
    !pathFromParent.startsWith('..') &&
    !/^[A-Za-z]:/.test(pathFromParent)
  )
}

export function resolveManagedFilePath({
  documentId,
  libraryRoot,
  filesDir,
  storedFilePath,
}: ResolveManagedFilePathInput) {
  const archivePath = toArchivePath(storedFilePath)
  const archivePathSegments = archivePath.split('/')
  const absolutePath = resolve(libraryRoot, storedFilePath)

  if (
    hasAbsolutePathSyntax(storedFilePath) ||
    archivePathSegments[0] !== 'files' ||
    archivePathSegments.length < 2 ||
    archivePathSegments.includes('..') ||
    !isInsideDirectory(filesDir, absolutePath)
  ) {
    throw new Error(
      `unsafe managed file path for document ${documentId}: ${archivePath}`,
    )
  }

  return absolutePath
}
