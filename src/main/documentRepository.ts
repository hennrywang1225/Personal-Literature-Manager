import { randomUUID } from 'node:crypto'
import type {
  CategoryRecord,
  CreatePdfAnnotationInput,
  DocumentRecord,
  FileType,
  ImportConfirmation,
  LibrarySnapshot,
  PdfAnnotationRecord,
  PdfAnnotationRect,
  PdfAnnotationType,
  ReadingStatus,
  TagRecord,
} from '../shared/types'
import type { LibraryDatabase } from './database'

type CreateDocumentInput = ImportConfirmation & {
  fileType: FileType
  originalFileName: string
  storedFileName: string
  storedFilePath: string
}

type UpsertCategoryInput = {
  name: string
  parentId?: string | null
}

type UpdateDocumentPatch = Partial<
  Pick<
    DocumentRecord,
    | 'title'
    | 'authors'
    | 'year'
    | 'doi'
    | 'venue'
    | 'categoryId'
    | 'importance'
    | 'readingStatus'
    | 'note'
  >
> & {
  tags?: string[]
}

type CategoryRow = {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

type TagRow = {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

type DocumentRow = {
  id: string
  title: string
  authors: string
  year: number | null
  doi: string
  venue: string
  file_type: FileType
  original_file_name: string
  stored_file_name: string
  stored_file_path: string
  category_id: string | null
  category_name: string | null
  importance: 1 | 2 | 3 | 4 | 5
  reading_status: ReadingStatus
  note: string
  created_at: string
  updated_at: string
  last_opened_at: string | null
}

type PdfAnnotationRow = {
  id: string
  document_id: string
  page_number: number
  type: PdfAnnotationType
  color: string
  rects_json: string
  created_at: string
  updated_at: string
}

const tagColor = '#64748b'

function nowIso() {
  return new Date().toISOString()
}

function prefixedId(prefix: string) {
  return `${prefix}-${randomUUID()}`
}

function toCategory(row: CategoryRow): CategoryRecord {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toTag(row: TagRow): TagRecord {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDocument(row: DocumentRow, tags: string[]): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    year: row.year === null ? null : Number(row.year),
    doi: row.doi,
    venue: row.venue,
    fileType: row.file_type,
    originalFileName: row.original_file_name,
    storedFileName: row.stored_file_name,
    storedFilePath: row.stored_file_path,
    categoryId: row.category_id,
    categoryName: row.category_name,
    tags,
    importance: Number(row.importance) as 1 | 2 | 3 | 4 | 5,
    readingStatus: row.reading_status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
  }
}

function parseAnnotationRects(rectsJson: string): PdfAnnotationRect[] {
  const parsed = JSON.parse(rectsJson) as PdfAnnotationRect[]

  return parsed.map((rect) => ({
    pageNumber: Number(rect.pageNumber),
    x: Number(rect.x),
    y: Number(rect.y),
    width: Number(rect.width),
    height: Number(rect.height),
  }))
}

function toPdfAnnotation(row: PdfAnnotationRow): PdfAnnotationRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: Number(row.page_number),
    type: row.type,
    color: row.color,
    rects: parseAnnotationRects(row.rects_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeTagNames(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
}

export function createDocumentRepository(db: LibraryDatabase) {
  function findCategoryById(id: string) {
    return db.select<CategoryRow>('select * from categories where id = ?', [id])[0]
  }

  function upsertCategory({ name, parentId = null }: UpsertCategoryInput): CategoryRecord {
    const trimmedName = name.trim()
    const existing = db.select<CategoryRow>(
      'select * from categories where name = ?',
      [trimmedName],
    )[0]

    if (existing) {
      return toCategory(existing)
    }

    const timestamp = nowIso()
    const sortOrder =
      Number(
        db.select<{ next_sort_order: number }>(
          `select coalesce(max(sort_order), -1) + 1 as next_sort_order
           from categories
           where parent_id is ?`,
          [parentId],
        )[0]?.next_sort_order ?? 0,
      )
    const id = prefixedId('cat')

    db.exec(
      `insert into categories (id, name, parent_id, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
      [id, trimmedName, parentId, sortOrder, timestamp, timestamp],
    )

    return toCategory(findCategoryById(id))
  }

  function upsertTag(name: string): TagRecord {
    const trimmedName = name.trim()
    const existing = db.select<TagRow>('select * from tags where name = ?', [
      trimmedName,
    ])[0]

    if (existing) {
      return toTag(existing)
    }

    const timestamp = nowIso()
    const id = prefixedId('tag')

    db.exec(
      `insert into tags (id, name, color, created_at, updated_at)
       values (?, ?, ?, ?, ?)`,
      [id, trimmedName, tagColor, timestamp, timestamp],
    )

    return toTag(db.select<TagRow>('select * from tags where id = ?', [id])[0])
  }

  function setDocumentTags(documentId: string, tagNames: string[]) {
    db.exec('delete from document_tags where document_id = ?', [documentId])

    for (const tagName of normalizeTagNames(tagNames)) {
      const tag = upsertTag(tagName)
      db.exec(
        'insert into document_tags (document_id, tag_id) values (?, ?)',
        [documentId, tag.id],
      )
    }
  }

  function getDocumentTags(documentId: string) {
    return db
      .select<{ name: string }>(
        `select tags.name
         from tags
         inner join document_tags on document_tags.tag_id = tags.id
         where document_tags.document_id = ?
         order by tags.name`,
        [documentId],
      )
      .map((row) => row.name)
  }

  function getDocument(id: string): DocumentRecord {
    const row = db.select<DocumentRow>(
      `select documents.*, categories.name as category_name
       from documents
       left join categories on categories.id = documents.category_id
       where documents.id = ?`,
      [id],
    )[0]

    if (!row) {
      throw new Error(`Document not found: ${id}`)
    }

    return toDocument(row, getDocumentTags(id))
  }

  function getPdfAnnotation(id: string): PdfAnnotationRecord {
    const row = db.select<PdfAnnotationRow>(
      'select * from pdf_annotations where id = ?',
      [id],
    )[0]

    if (!row) {
      throw new Error(`PDF annotation not found: ${id}`)
    }

    return toPdfAnnotation(row)
  }

  function createDocument(input: CreateDocumentInput): DocumentRecord {
    return db.transaction(() => {
      const timestamp = nowIso()
      const id = prefixedId('doc')

      db.exec(
        `insert into documents (
          id, title, authors, year, doi, venue, file_type, original_file_name,
          stored_file_name, stored_file_path, category_id, importance, reading_status,
          note, created_at, updated_at, last_opened_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.title,
          input.authors,
          input.year,
          input.doi,
          input.venue,
          input.fileType,
          input.originalFileName,
          input.storedFileName,
          input.storedFilePath,
          input.categoryId,
          input.importance,
          input.readingStatus,
          input.note,
          timestamp,
          timestamp,
          null,
        ],
      )
      setDocumentTags(id, input.tags)

      return getDocument(id)
    })
  }

  function updateDocument(id: string, patch: UpdateDocumentPatch): DocumentRecord {
    getDocument(id)

    return db.transaction(() => {
      const fields: Array<[string, string | number | null]> = []
      const map: Array<[keyof UpdateDocumentPatch, string]> = [
        ['title', 'title'],
        ['authors', 'authors'],
        ['year', 'year'],
        ['doi', 'doi'],
        ['venue', 'venue'],
        ['categoryId', 'category_id'],
        ['importance', 'importance'],
        ['readingStatus', 'reading_status'],
        ['note', 'note'],
      ]

      for (const [key, column] of map) {
        if (key in patch) {
          fields.push([column, patch[key] as string | number | null])
        }
      }

      if (fields.length > 0) {
        const timestamp = nowIso()

        db.exec(
          `update documents
           set ${fields.map(([column]) => `${column} = ?`).join(', ')}, updated_at = ?
           where id = ?`,
          [...fields.map(([, value]) => value), timestamp, id],
        )
      }

      if (patch.tags) {
        setDocumentTags(id, patch.tags)
        db.exec('update documents set updated_at = ? where id = ?', [nowIso(), id])
      }

      return getDocument(id)
    })
  }

  function updateDocumentsCategory(
    ids: string[],
    categoryId: string | null,
  ): DocumentRecord[] {
    return db.transaction(() => {
      const uniqueIds = [...new Set(ids)]
      const timestamp = nowIso()

      for (const id of uniqueIds) {
        getDocument(id)
        db.exec(
          `update documents
           set category_id = ?, updated_at = ?
           where id = ?`,
          [categoryId, timestamp, id],
        )
      }

      return uniqueIds.map(getDocument)
    })
  }

  function deleteDocuments(ids: string[]): DocumentRecord[] {
    return db.transaction(() => {
      const uniqueIds = [...new Set(ids)]
      const documents = uniqueIds.map(getDocument)

      for (const id of uniqueIds) {
        db.exec('delete from document_tags where document_id = ?', [id])
        db.exec('delete from documents where id = ?', [id])
      }

      return documents
    })
  }

  function listPdfAnnotations(documentId: string): PdfAnnotationRecord[] {
    return db
      .select<PdfAnnotationRow>(
        `select * from pdf_annotations
         where document_id = ?
         order by page_number asc, created_at asc`,
        [documentId],
      )
      .map(toPdfAnnotation)
  }

  function createPdfAnnotation(
    input: CreatePdfAnnotationInput,
  ): PdfAnnotationRecord {
    getDocument(input.documentId)

    const timestamp = nowIso()
    const id = prefixedId('ann')

    db.exec(
      `insert into pdf_annotations (
        id, document_id, page_number, type, color, rects_json, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.documentId,
        input.pageNumber,
        input.type,
        input.color,
        JSON.stringify(input.rects),
        timestamp,
        timestamp,
      ],
    )

    return getPdfAnnotation(id)
  }

  function deletePdfAnnotation(id: string): PdfAnnotationRecord {
    const annotation = getPdfAnnotation(id)

    db.exec('delete from pdf_annotations where id = ?', [id])

    return annotation
  }

  function getSnapshot(): LibrarySnapshot {
    const categories = db
      .select<CategoryRow>(
        'select * from categories order by sort_order asc, name asc',
      )
      .map(toCategory)
    const tags = db
      .select<TagRow>('select * from tags order by name asc')
      .map(toTag)
    const documents = db
      .select<DocumentRow>(
        `select documents.*, categories.name as category_name
         from documents
         left join categories on categories.id = documents.category_id
         order by documents.updated_at desc`,
      )
      .map((row) => toDocument(row, getDocumentTags(row.id)))

    return { documents, categories, tags }
  }

  return {
    upsertCategory,
    upsertTag,
    transaction: db.transaction,
    createDocument,
    updateDocument,
    updateDocumentsCategory,
    deleteDocuments,
    listPdfAnnotations,
    createPdfAnnotation,
    deletePdfAnnotation,
    getSnapshot,
    getDocument,
  }
}
