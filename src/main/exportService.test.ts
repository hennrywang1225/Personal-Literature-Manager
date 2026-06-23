import AdmZip from 'adm-zip'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { DocumentRecord, LibrarySnapshot } from '../shared/types'
import { createExportService } from './exportService'

const tempDirs: string[] = []

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'literature-manager-export-'))
  tempDirs.push(root)
  mkdirSync(join(root, 'files'), { recursive: true })
  mkdirSync(join(root, 'exports'), { recursive: true })
  return root
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true })
  }
})

function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-1',
    title: 'Paper',
    authors: 'Ada Lovelace',
    year: 2024,
    doi: '',
    venue: '',
    fileType: 'pdf',
    originalFileName: 'paper.pdf',
    storedFileName: 'doc-1.pdf',
    storedFilePath: 'files/doc-1.pdf',
    categoryId: 'cat-1',
    categoryName: '深度学习',
    tags: ['必读'],
    importance: 5,
    readingStatus: 'To Read',
    note: '',
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
    lastOpenedAt: null,
    ...overrides,
  }
}

function makeSnapshot(documents: DocumentRecord[] = [makeDocument()]): LibrarySnapshot {
  return {
    documents,
    categories: [
      {
        id: 'cat-1',
        name: '深度学习',
        parentId: null,
        sortOrder: 1,
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
      {
        id: 'cat-2',
        name: '医学影像',
        parentId: null,
        sortOrder: 2,
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ],
    tags: [
      {
        id: 'tag-1',
        name: '必读',
        color: '#ef4444',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
      {
        id: 'tag-2',
        name: '稍后',
        color: '#64748b',
        createdAt: '2026-06-22T00:00:00.000Z',
        updatedAt: '2026-06-22T00:00:00.000Z',
      },
    ],
  }
}

function readMetadata(zipPath: string): LibrarySnapshot {
  const zip = new AdmZip(zipPath)
  const metadataEntry = zip.getEntry('metadata.json')
  expect(metadataEntry).toBeTruthy()
  return JSON.parse(metadataEntry!.getData().toString('utf8')) as LibrarySnapshot
}

describe('createExportService', () => {
  it('exports selected documents with metadata and managed files', async () => {
    const root = makeTempRoot()
    writeFileSync(join(root, 'files', 'doc-1.pdf'), 'pdf content')
    const snapshot = makeSnapshot()
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () => snapshot,
    })

    const zipPath = await service.exportSelection(['doc-1'])

    expect(zipPath).toMatch(/selected-documents-\d{4}-\d{2}-\d{2}\.zip$/)
    const zip = new AdmZip(zipPath)
    expect(zip.getEntry('metadata.json')).toBeTruthy()
    expect(zip.getEntry('files/doc-1.pdf')).toBeTruthy()
    const metadata = readMetadata(zipPath)
    expect(metadata.documents).toHaveLength(1)
    expect(metadata.documents[0].title).toBe('Paper')
    expect(metadata.categories.map((category) => category.id)).toEqual(['cat-1'])
    expect(metadata.tags.map((tag) => tag.name)).toEqual(['必读'])
  })

  it('exports documents in a category only', async () => {
    const root = makeTempRoot()
    writeFileSync(join(root, 'files', 'doc-1.pdf'), 'pdf content')
    writeFileSync(join(root, 'files', 'doc-2.pdf'), 'other pdf content')
    const snapshot = makeSnapshot([
      makeDocument(),
      makeDocument({
        id: 'doc-2',
        title: 'Other Paper',
        storedFileName: 'doc-2.pdf',
        storedFilePath: 'files/doc-2.pdf',
        categoryId: 'cat-2',
        categoryName: '医学影像',
        tags: ['稍后'],
      }),
    ])
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () => snapshot,
    })

    const zipPath = await service.exportCategory('cat-1')

    expect(zipPath).toMatch(/category-documents-\d{4}-\d{2}-\d{2}\.zip$/)
    const zip = new AdmZip(zipPath)
    expect(zip.getEntry('files/doc-1.pdf')).toBeTruthy()
    expect(zip.getEntry('files/doc-2.pdf')).toBeNull()
    const metadata = readMetadata(zipPath)
    expect(metadata.documents.map((document) => document.id)).toEqual(['doc-1'])
    expect(metadata.categories.map((category) => category.id)).toEqual(['cat-1'])
    expect(metadata.tags.map((tag) => tag.name)).toEqual(['必读'])
  })

  it('exports all documents', async () => {
    const root = makeTempRoot()
    writeFileSync(join(root, 'files', 'doc-1.pdf'), 'pdf content')
    writeFileSync(join(root, 'files', 'doc-2.pdf'), 'other pdf content')
    const snapshot = makeSnapshot([
      makeDocument(),
      makeDocument({
        id: 'doc-2',
        title: 'Other Paper',
        storedFileName: 'doc-2.pdf',
        storedFilePath: 'files/doc-2.pdf',
        categoryId: 'cat-2',
        categoryName: '医学影像',
        tags: ['稍后'],
      }),
    ])
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () => snapshot,
    })

    const zipPath = await service.exportAll()

    expect(zipPath).toMatch(/all-documents-\d{4}-\d{2}-\d{2}\.zip$/)
    const zip = new AdmZip(zipPath)
    expect(zip.getEntry('files/doc-1.pdf')).toBeTruthy()
    expect(zip.getEntry('files/doc-2.pdf')).toBeTruthy()
    const metadata = readMetadata(zipPath)
    expect(metadata.documents.map((document) => document.id)).toEqual(['doc-1', 'doc-2'])
    expect(metadata.categories.map((category) => category.id)).toEqual(['cat-1', 'cat-2'])
    expect(metadata.tags.map((tag) => tag.name)).toEqual(['必读', '稍后'])
  })

  it('throws a clear error when a required managed file is missing', async () => {
    const root = makeTempRoot()
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () => makeSnapshot(),
    })

    await expect(service.exportSelection(['doc-1'])).rejects.toThrow(
      /missing managed file for document doc-1: files\/doc-1\.pdf/,
    )
  })
})
