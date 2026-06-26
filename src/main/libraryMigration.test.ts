import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { migrateLibraryRoot } from './libraryMigration'

const tempDirs: string[] = []

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'literature-manager-migration-'))
  tempDirs.push(root)
  return root
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true })
  }
})

describe('migrateLibraryRoot', () => {
  it('copies the current database and managed files into a new library folder', async () => {
    const fromRoot = makeRoot()
    const toRoot = makeRoot()
    mkdirSync(join(fromRoot, 'files'), { recursive: true })
    writeFileSync(join(fromRoot, 'library.db'), 'database')
    writeFileSync(join(fromRoot, 'files', 'doc-1.pdf'), 'paper')

    await migrateLibraryRoot({ fromRoot, toRoot })

    expect(readFileSync(join(toRoot, 'library.db'), 'utf8')).toBe('database')
    expect(readFileSync(join(toRoot, 'files', 'doc-1.pdf'), 'utf8')).toBe('paper')
  })

  it('does not overwrite an existing library database at the chosen folder', async () => {
    const fromRoot = makeRoot()
    const toRoot = makeRoot()
    writeFileSync(join(fromRoot, 'library.db'), 'old')
    writeFileSync(join(toRoot, 'library.db'), 'existing')

    const result = await migrateLibraryRoot({ fromRoot, toRoot })

    expect(result.usedExistingLibrary).toBe(true)
    expect(readFileSync(join(toRoot, 'library.db'), 'utf8')).toBe('existing')
  })

  it('rejects a target inside the current library folder', async () => {
    const fromRoot = makeRoot()
    const toRoot = join(fromRoot, 'nested')

    await expect(migrateLibraryRoot({ fromRoot, toRoot })).rejects.toThrow(
      /cannot move the library inside itself/,
    )
    expect(existsSync(toRoot)).toBe(false)
  })
})
