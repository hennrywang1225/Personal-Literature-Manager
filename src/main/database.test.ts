import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openLibraryDatabase } from './database'

const tempDirs: string[] = []

function makeDatabasePath() {
  const tempDir = mkdtempSync(join(tmpdir(), 'literature-manager-db-'))
  tempDirs.push(tempDir)
  return join(tempDir, 'nested', 'library.db')
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true })
  }
})

describe('openLibraryDatabase', () => {
  it('creates the schema and saves database bytes to disk', async () => {
    const databasePath = makeDatabasePath()
    const db = await openLibraryDatabase({ databasePath })

    try {
      db.exec(
        `insert into categories (id, name, parent_id, sort_order, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?)`,
        ['cat-test', 'Deep Learning', null, 0, '2026-06-22T00:00:00.000Z', '2026-06-22T00:00:00.000Z'],
      )
      db.save()
    } finally {
      db.close()
    }

    expect(existsSync(databasePath)).toBe(true)
    expect(readFileSync(databasePath).byteLength).toBeGreaterThan(100)
  })
})
