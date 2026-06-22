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
      await db.save()
    } finally {
      db.close()
    }

    expect(existsSync(databasePath)).toBe(true)
    expect(readFileSync(databasePath).byteLength).toBeGreaterThan(100)

    const reopened = await openLibraryDatabase({ databasePath })

    try {
      expect(
        reopened.select<{ name: string }>(
          'select name from categories where id = ?',
          ['cat-test'],
        ),
      ).toEqual([{ name: 'Deep Learning' }])
    } finally {
      reopened.close()
    }
  })

  it('rejects documents with invalid runtime domain values', async () => {
    const db = await openLibraryDatabase({ databasePath: makeDatabasePath() })
    const insertDocument = (
      overrides: Partial<{
        fileType: string
        importance: number
        readingStatus: string
      }>,
    ) =>
      db.exec(
        `insert into documents (
          id, title, authors, year, doi, venue, file_type, original_file_name,
          stored_file_name, stored_file_path, category_id, importance, reading_status,
          note, created_at, updated_at, last_opened_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `doc-${overrides.fileType ?? overrides.importance ?? overrides.readingStatus}`,
          'Invalid Domain Record',
          'Alice',
          2024,
          '',
          '',
          overrides.fileType ?? 'pdf',
          'paper.pdf',
          'paper.pdf',
          'files/paper.pdf',
          null,
          overrides.importance ?? 3,
          overrides.readingStatus ?? 'To Read',
          '',
          '2026-06-22T00:00:00.000Z',
          '2026-06-22T00:00:00.000Z',
          null,
        ],
      )

    try {
      expect(() => insertDocument({ fileType: 'ppt' })).toThrow()
      expect(() => insertDocument({ importance: 6 })).toThrow()
      expect(() => insertDocument({ readingStatus: 'Archived' })).toThrow()
    } finally {
      db.close()
    }
  })
})
