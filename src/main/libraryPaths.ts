import { join, normalize } from 'node:path'

export interface LibraryPathInput {
  isPackaged: boolean
  appDataPath: string
  exeDir: string
}

export interface LibraryPaths {
  libraryRoot: string
  databasePath: string
  documentsDir: string
}

export function resolveLibraryRoot(input: LibraryPathInput): string {
  if (input.isPackaged) {
    return normalize(
      join(input.appDataPath, 'Personal Literature Manager', 'Library'),
    )
  }

  return normalize(join(input.exeDir, 'LiteratureLibrary'))
}

export function buildLibraryPaths(input: LibraryPathInput): LibraryPaths {
  const libraryRoot = resolveLibraryRoot(input)

  return {
    libraryRoot,
    databasePath: normalize(join(libraryRoot, 'library.db')),
    documentsDir: normalize(join(libraryRoot, 'documents')),
  }
}
