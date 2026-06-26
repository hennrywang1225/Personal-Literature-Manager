import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import { isAbsolute, join, normalize, relative, resolve } from 'node:path'

export interface MigrateLibraryRootInput {
  fromRoot: string
  toRoot: string
}

export interface MigrateLibraryRootResult {
  migrated: boolean
  usedExistingLibrary: boolean
}

function isSamePath(firstPath: string, secondPath: string) {
  return resolve(firstPath).toLowerCase() === resolve(secondPath).toLowerCase()
}

function isInsideDirectory(parentPath: string, childPath: string) {
  const relativePath = relative(resolve(parentPath), resolve(childPath))
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

export async function migrateLibraryRoot({
  fromRoot,
  toRoot,
}: MigrateLibraryRootInput): Promise<MigrateLibraryRootResult> {
  const normalizedFrom = normalize(fromRoot)
  const normalizedTo = normalize(toRoot)

  if (isSamePath(normalizedFrom, normalizedTo)) {
    return { migrated: false, usedExistingLibrary: true }
  }

  if (isInsideDirectory(normalizedFrom, normalizedTo)) {
    throw new Error('cannot move the library inside itself')
  }

  await mkdir(normalizedTo, { recursive: true })

  if (existsSync(join(normalizedTo, 'library.db'))) {
    return { migrated: false, usedExistingLibrary: true }
  }

  if (!existsSync(normalizedFrom)) {
    return { migrated: false, usedExistingLibrary: false }
  }

  await cp(normalizedFrom, normalizedTo, {
    errorOnExist: false,
    force: false,
    recursive: true,
  })

  return { migrated: true, usedExistingLibrary: false }
}
