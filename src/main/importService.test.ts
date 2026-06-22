import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
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
    paths: { filesDir: string; tempDir: string },
  ) => Promise<T>,
) {
  const tempDir = makeTempDir()
  const filesDir = join(tempDir, 'library', 'files')
  const db = await openLibraryDatabase({
    databasePath: join(tempDir, 'library', 'library.db'),
  })
  const repo = createDocumentRepository(db)
  const store = createFileStore({ filesDir })
  const service = createImportService({
    repo,
    store,
    extractPdfMetadata: async () => {
      throw new Error('not used for txt')
    },
  })

  try {
    return await test(service, db, { filesDir, tempDir })
  } finally {
    db.close()
  }
}

function rejectBlockedTagSql() {
  return `create trigger reject_blocked_tag_link
    before insert on document_tags
    when exists (
      select 1 from tags
      where tags.id = new.tag_id and tags.name = 'blocked'
    )
    begin
      select raise(abort, 'blocked tag link');
    end`
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
      expect(imported[0].storedFilePath).toBe(`files/${imported[0].storedFileName}`)
      expect(isAbsolute(imported[0].storedFilePath)).toBe(false)
    })
  })

  it('rolls back documents and removes copied files when a later batch import fails', async () => {
    await withImportService(async (service, db, { filesDir, tempDir }) => {
      db.exec(rejectBlockedTagSql())
      const firstSourcePath = join(tempDir, 'first.txt')
      const secondSourcePath = join(tempDir, 'second.txt')
      writeFileSync(firstSourcePath, 'first')
      writeFileSync(secondSourcePath, 'second')

      await expect(
        service.confirmImports([
          {
            sourcePath: firstSourcePath,
            title: 'First',
            authors: '',
            year: null,
            doi: '',
            venue: '',
            categoryId: null,
            tags: ['safe'],
            importance: 3,
            readingStatus: 'To Read',
            note: '',
          },
          {
            sourcePath: secondSourcePath,
            title: 'Second',
            authors: '',
            year: null,
            doi: '',
            venue: '',
            categoryId: null,
            tags: ['blocked'],
            importance: 3,
            readingStatus: 'To Read',
            note: '',
          },
        ]),
      ).rejects.toThrow(/blocked tag link/)

      expect(db.select('select id from documents')).toEqual([])
      expect(db.select('select id from tags')).toEqual([])
      expect(existsSync(filesDir) ? readdirSync(filesDir) : []).toEqual([])
    })
  })

  it('removes a copied file when document creation fails', async () => {
    await withImportService(async (service, db, { filesDir, tempDir }) => {
      db.exec(rejectBlockedTagSql())
      const sourcePath = join(tempDir, 'blocked.txt')
      writeFileSync(sourcePath, 'blocked')

      await expect(
        service.confirmImports([
          {
            sourcePath,
            title: 'Blocked',
            authors: '',
            year: null,
            doi: '',
            venue: '',
            categoryId: null,
            tags: ['blocked'],
            importance: 3,
            readingStatus: 'To Read',
            note: '',
          },
        ]),
      ).rejects.toThrow(/blocked tag link/)

      expect(db.select('select id from documents')).toEqual([])
      expect(db.select('select id from tags')).toEqual([])
      expect(existsSync(filesDir) ? readdirSync(filesDir) : []).toEqual([])
    })
  })
})
