import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openLibraryDatabase, type LibraryDatabase } from './database'
import { createDocumentRepository } from './documentRepository'

const tempDirs: string[] = []

function makeDatabasePath() {
  const tempDir = mkdtempSync(join(tmpdir(), 'literature-manager-repo-'))
  tempDirs.push(tempDir)
  return join(tempDir, 'library.db')
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true })
  }
})

async function withRepository<T>(
  test: (repo: ReturnType<typeof createDocumentRepository>, db: LibraryDatabase) => Promise<T>,
) {
  const db = await openLibraryDatabase({ databasePath: makeDatabasePath() })
  const repo = createDocumentRepository(db)

  try {
    return await test(repo, db)
  } finally {
    db.close()
  }
}

describe('createDocumentRepository', () => {
  it('creates categories, documents, assigns tags, and loads a snapshot', async () => {
    await withRepository(async (repo) => {
      const category = repo.upsertCategory({ name: 'Deep Learning' })
      const document = repo.createDocument({
        sourcePath: 'C:/incoming/paper.pdf',
        title: 'Transformer Segmentation',
        authors: 'Alice Zhang; Bo Wang',
        year: 2024,
        doi: '10.1000/segmentation',
        venue: 'MICCAI',
        categoryId: category.id,
        tags: ['transformer', 'medical imaging'],
        importance: 5,
        readingStatus: 'Intensive',
        note: 'Key baseline.',
        fileType: 'pdf',
        originalFileName: 'paper.pdf',
        storedFileName: 'doc-transformer.pdf',
        storedFilePath: 'documents/doc-transformer.pdf',
      })

      expect(category.id).toMatch(/^cat-/)
      expect(document.id).toMatch(/^doc-/)
      expect(document.categoryName).toBe('Deep Learning')
      expect(document.tags).toEqual(['medical imaging', 'transformer'])

      const snapshot = repo.getSnapshot()

      expect(snapshot.categories).toEqual([category])
      expect(snapshot.tags.map((tag) => tag.name)).toEqual([
        'medical imaging',
        'transformer',
      ])
      expect(snapshot.documents).toHaveLength(1)
      expect(snapshot.documents[0]).toMatchObject({
        id: document.id,
        title: 'Transformer Segmentation',
        categoryId: category.id,
        categoryName: 'Deep Learning',
        tags: ['medical imaging', 'transformer'],
      })
    })
  })

  it('updates document fields and tag assignments', async () => {
    await withRepository(async (repo) => {
      const document = repo.createDocument({
        sourcePath: 'C:/incoming/notes.md',
        title: 'Clinical Workflow Notes',
        authors: 'Chen Li',
        year: 2022,
        doi: '',
        venue: 'Radiology Today',
        categoryId: null,
        tags: ['workflow'],
        importance: 2,
        readingStatus: 'To Read',
        note: 'Initial note.',
        fileType: 'md',
        originalFileName: 'notes.md',
        storedFileName: 'doc-notes.md',
        storedFilePath: 'documents/doc-notes.md',
      })

      const updated = repo.updateDocument(document.id, {
        title: 'Clinical Workflow Notes Updated',
        importance: 4,
        readingStatus: 'Reading',
        note: 'Updated note.',
        tags: ['radiology', 'workflow'],
      })

      expect(updated).toMatchObject({
        id: document.id,
        title: 'Clinical Workflow Notes Updated',
        importance: 4,
        readingStatus: 'Reading',
        note: 'Updated note.',
        tags: ['radiology', 'workflow'],
      })
      expect(repo.getDocument(document.id)).toEqual(updated)
    })
  })

  it('rolls back document and tag writes when tag assignment fails', async () => {
    await withRepository(async (repo, db) => {
      db.exec(
        `create trigger reject_blocked_tag_link
         before insert on document_tags
         when exists (
           select 1 from tags
           where tags.id = new.tag_id and tags.name = 'blocked'
         )
         begin
           select raise(abort, 'blocked tag link');
         end`,
      )

      expect(() =>
        repo.createDocument({
          sourcePath: 'C:/incoming/rollback.pdf',
          title: 'Rollback Paper',
          authors: 'Alice Zhang',
          year: 2024,
          doi: '',
          venue: '',
          categoryId: null,
          tags: ['blocked'],
          importance: 3,
          readingStatus: 'To Read',
          note: '',
          fileType: 'pdf',
          originalFileName: 'rollback.pdf',
          storedFileName: 'doc-rollback.pdf',
          storedFilePath: 'files/doc-rollback.pdf',
        }),
      ).toThrow(/blocked tag link/)

      expect(repo.getSnapshot()).toMatchObject({
        documents: [],
        tags: [],
      })
    })
  })
})
