import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { locateSqlJsFile, openLibraryDatabase } from './database'

const tempDirs: string[] = []
const originalNodeEnv = process.env.NODE_ENV
const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
  .resourcesPath

function makeDatabasePath() {
  const tempDir = mkdtempSync(join(tmpdir(), 'literature-manager-db-'))
  tempDirs.push(tempDir)
  return join(tempDir, 'nested', 'library.db')
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: originalResourcesPath,
  })

  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true })
  }
})

describe('openLibraryDatabase', () => {
  it('locates sql.js wasm from packaged resources outside tests', () => {
    const resourceDir = mkdtempSync(join(tmpdir(), 'literature-manager-resources-'))
    tempDirs.push(resourceDir)
    const wasmPath = join(resourceDir, 'sql-wasm.wasm')
    writeFileSync(wasmPath, 'wasm')

    process.env.NODE_ENV = 'production'
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: resourceDir,
    })

    expect(locateSqlJsFile('sql-wasm.wasm')).toBe(wasmPath)
  })

  it('keeps the node_modules sql.js path during tests', () => {
    const resourceDir = mkdtempSync(join(tmpdir(), 'literature-manager-resources-'))
    tempDirs.push(resourceDir)
    writeFileSync(join(resourceDir, 'sql-wasm.wasm'), 'wasm')

    process.env.NODE_ENV = 'test'
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: resourceDir,
    })

    expect(locateSqlJsFile('sql-wasm.wasm')).toBe(
      join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    )
  })

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

  it('creates the PDF annotation schema', async () => {
    const db = await openLibraryDatabase({ databasePath: makeDatabasePath() })

    try {
      const columns = db.select<{ name: string }>(
        "pragma table_info('pdf_annotations')",
      )

      expect(columns.map((column) => column.name)).toEqual([
        'id',
        'document_id',
        'page_number',
        'type',
        'color',
        'rects_json',
        'created_at',
        'updated_at',
      ])
    } finally {
      db.close()
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
