import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openLibraryDatabase, type LibraryDatabase } from './database'
import { createDocumentRepository } from './documentRepository'
import { createFileStore } from './fileStore'
import { createImportService } from './importService'

const tempDirs: string[] = []

function makeTempDir() {
  const tempDir = mkdtempSync(join(tmpdir(), 'literature-manager-import-'))
  tempDirs.push(tempDir)
  return tempDir
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true })
  }
})

async function withImportService<T>(
  test: (
    service: ReturnType<typeof createImportService>,
    db: LibraryDatabase,
  ) => Promise<T>,
) {
  const tempDir = makeTempDir()
  const db = await openLibraryDatabase({
    databasePath: join(tempDir, 'library', 'library.db'),
  })
  const repo = createDocumentRepository(db)
  const store = createFileStore({ filesDir: join(tempDir, 'library', 'files') })
  const service = createImportService({
    repo,
    store,
    extractPdfMetadata: async () => {
      throw new Error('not used for txt')
    },
  })

  try {
    return await test(service, db)
  } finally {
    db.close()
  }
}

describe('createImportService', () => {
  it('creates txt import candidates and confirms imports into managed storage', async () => {
    await withImportService(async (service) => {
      const tempDir = makeTempDir()
      const sourcePath = join(tempDir, 'sample.txt')
      writeFileSync(sourcePath, 'personal notes')

      const candidates = await service.createCandidates([sourcePath])

      expect(candidates).toEqual([
        expect.objectContaining({
          sourcePath,
          originalFileName: 'sample.txt',
          fileType: 'txt',
          detectedTitle: 'sample',
          detectedAuthors: '',
          detectedYear: null,
          detectedDoi: '',
          detectedVenue: '',
          extractionStatus: 'fallback',
        }),
      ])

      const imported = await service.confirmImports([
        {
          sourcePath,
          title: 'My Notes',
          authors: '',
          year: null,
          doi: '',
          venue: '',
          categoryId: null,
          tags: ['笔记'],
          importance: 3,
          readingStatus: 'To Read',
          note: '',
        },
      ])

      expect(imported).toHaveLength(1)
      expect(imported[0]).toMatchObject({
        title: 'My Notes',
        tags: ['笔记'],
        fileType: 'txt',
        originalFileName: 'sample.txt',
      })
      expect(imported[0].storedFileName).toMatch(/\.txt$/)
      expect(existsSync(imported[0].storedFilePath)).toBe(true)
    })
  })
})
