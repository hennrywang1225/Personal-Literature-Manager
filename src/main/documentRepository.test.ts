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

  it('creates child categories under a parent category', async () => {
    await withRepository(async (repo) => {
      const project = repo.upsertCategory({ name: '毕设', parentId: null })
      const direction = repo.upsertCategory({
        name: '四旋翼控制',
        parentId: project.id,
      })

      expect(direction).toMatchObject({
        name: '四旋翼控制',
        parentId: project.id,
      })
      expect(repo.getSnapshot().categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: project.id,
            name: '毕设',
            parentId: null,
          }),
          expect.objectContaining({
            id: direction.id,
            name: '四旋翼控制',
            parentId: project.id,
          }),
        ]),
      )
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

  it('rolls back document field updates and tag replacement together', async () => {
    await withRepository(async (repo, db) => {
      const document = repo.createDocument({
        sourcePath: 'C:/incoming/update-rollback.pdf',
        title: 'Original',
        authors: 'Alice Zhang',
        year: 2024,
        doi: '',
        venue: '',
        categoryId: null,
        tags: ['safe'],
        importance: 3,
        readingStatus: 'To Read',
        note: 'Before',
        fileType: 'pdf',
        originalFileName: 'update-rollback.pdf',
        storedFileName: 'doc-update-rollback.pdf',
        storedFilePath: 'files/doc-update-rollback.pdf',
      })

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
        repo.updateDocument(document.id, {
          title: 'Changed',
          note: 'After',
          tags: ['blocked'],
        }),
      ).toThrow(/blocked tag link/)

      expect(repo.getDocument(document.id)).toMatchObject({
        title: 'Original',
        note: 'Before',
        tags: ['safe'],
      })
    })
  })

  it('moves multiple documents to another category in one operation', async () => {
    await withRepository(async (repo) => {
      const category = repo.upsertCategory({ name: 'Batch Category' })
      const first = repo.createDocument({
        sourcePath: 'one.pdf',
        title: 'One',
        authors: '',
        year: null,
        doi: '',
        venue: '',
        categoryId: null,
        tags: [],
        importance: 3,
        readingStatus: 'To Read',
        note: '',
        fileType: 'pdf',
        originalFileName: 'one.pdf',
        storedFileName: 'one.pdf',
        storedFilePath: 'files/one.pdf',
      })
      const second = repo.createDocument({
        sourcePath: 'two.pdf',
        title: 'Two',
        authors: '',
        year: null,
        doi: '',
        venue: '',
        categoryId: null,
        tags: [],
        importance: 3,
        readingStatus: 'To Read',
        note: '',
        fileType: 'pdf',
        originalFileName: 'two.pdf',
        storedFileName: 'two.pdf',
        storedFilePath: 'files/two.pdf',
      })

      const moved = repo.updateDocumentsCategory([first.id, second.id], category.id)

      expect(moved.map((document) => document.categoryId)).toEqual([
        category.id,
        category.id,
      ])
      expect(
        repo.getSnapshot().documents.map((document) => document.categoryName),
      ).toEqual(['Batch Category', 'Batch Category'])
    })
  })

  it('deletes documents and their tag assignments', async () => {
    await withRepository(async (repo, db) => {
      const document = repo.createDocument({
        sourcePath: 'delete.pdf',
        title: 'Delete Me',
        authors: '',
        year: null,
        doi: '',
        venue: '',
        categoryId: null,
        tags: ['temporary'],
        importance: 3,
        readingStatus: 'To Read',
        note: '',
        fileType: 'pdf',
        originalFileName: 'delete.pdf',
        storedFileName: 'delete.pdf',
        storedFilePath: 'files/delete.pdf',
      })

      const deleted = repo.deleteDocuments([document.id])

      expect(deleted).toEqual([document])
      expect(repo.getSnapshot().documents).toEqual([])
      expect(() => repo.getDocument(document.id)).toThrow(/Document not found/)
      expect(
        db.select('select * from document_tags where document_id = ?', [
          document.id,
        ]),
      ).toEqual([])
    })
  })

  it('creates, lists, and deletes PDF annotations', async () => {
    await withRepository(async (repo) => {
      const document = repo.createDocument({
        sourcePath: 'annotated.pdf',
        title: 'Annotated Paper',
        authors: '',
        year: null,
        doi: '',
        venue: '',
        categoryId: null,
        tags: [],
        importance: 3,
        readingStatus: 'To Read',
        note: '',
        fileType: 'pdf',
        originalFileName: 'annotated.pdf',
        storedFileName: 'annotated.pdf',
        storedFilePath: 'files/annotated.pdf',
      })

      const annotation = repo.createPdfAnnotation({
        documentId: document.id,
        pageNumber: 2,
        type: 'highlight',
        color: '#fde68a',
        rects: [
          {
            pageNumber: 2,
            x: 0.12,
            y: 0.2,
            width: 0.32,
            height: 0.04,
          },
        ],
      })

      expect(annotation).toMatchObject({
        documentId: document.id,
        pageNumber: 2,
        type: 'highlight',
        color: '#fde68a',
        rects: [
          {
            pageNumber: 2,
            x: 0.12,
            y: 0.2,
            width: 0.32,
            height: 0.04,
          },
        ],
      })
      expect(repo.listPdfAnnotations(document.id)).toEqual([annotation])
      expect(repo.deletePdfAnnotation(annotation.id)).toEqual(annotation)
      expect(repo.listPdfAnnotations(document.id)).toEqual([])
    })
  })

  it('removes PDF annotations when their document is deleted', async () => {
    await withRepository(async (repo) => {
      const document = repo.createDocument({
        sourcePath: 'annotated.pdf',
        title: 'Annotated Paper',
        authors: '',
        year: null,
        doi: '',
        venue: '',
        categoryId: null,
        tags: [],
        importance: 3,
        readingStatus: 'To Read',
        note: '',
        fileType: 'pdf',
        originalFileName: 'annotated.pdf',
        storedFileName: 'annotated.pdf',
        storedFilePath: 'files/annotated.pdf',
      })
      const annotation = repo.createPdfAnnotation({
        documentId: document.id,
        pageNumber: 1,
        type: 'underline',
        color: '#1d4ed8',
        rects: [
          {
            pageNumber: 1,
            x: 0.1,
            y: 0.4,
            width: 0.25,
            height: 0.03,
          },
        ],
      })

      repo.deleteDocuments([document.id])

      expect(() => repo.deletePdfAnnotation(annotation.id)).toThrow(
        /PDF annotation not found/,
      )
      expect(repo.listPdfAnnotations(document.id)).toEqual([])
    })
  })
})
