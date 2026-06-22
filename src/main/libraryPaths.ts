import { join, normalize } from 'node:path'

export interface LibraryPathInput {
  isPackaged: boolean
  appDataPath: string
  exeDir: string
}

export interface LibraryPaths {
  root: string
  databasePath: string
  filesDir: string
  exportsDir: string
}

export function resolveLibraryRoot(input: LibraryPathInput): string {
  if (input.isPackaged) {
    return normalize(
      join(input.appDataPath, 'Personal Literature Manager', 'Library'),
    )
  }

  return normalize(join(input.exeDir, 'LiteratureLibrary'))
}

export function buildLibraryPaths(root: string): LibraryPaths {
  return {
    root,
    databasePath: normalize(join(root, 'library.db')),
    filesDir: normalize(join(root, 'files')),
    exportsDir: normalize(join(root, 'exports')),
  }
}
