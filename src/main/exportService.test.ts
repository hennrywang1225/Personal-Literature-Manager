import AdmZip from 'adm-zip'
import { mkdtempSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { DocumentRecord, LibrarySnapshot } from '../shared/types'
import { createExportService } from './exportService'

const tempDirs: string[] = []
const tempFiles: string[] = []

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'literature-manager-export-'))
  tempDirs.push(root)
  mkdirSync(join(root, 'files'), { recursive: true })
  mkdirSync(join(root, 'exports'), { recursive: true })
  return root
}

afterEach(() => {
  for (const tempFile of tempFiles.splice(0)) {
    try {
      unlinkSync(tempFile)
    } catch {
      // Already removed.
    }
  }

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

    expect(zipPath).toMatch(/selected-documents-\d{4}-\d{2}-\d{2}-\d{6}-[a-f0-9]{8}\.zip$/)
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

    expect(zipPath).toMatch(/category-documents-\d{4}-\d{2}-\d{2}-\d{6}-[a-f0-9]{8}\.zip$/)
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

    expect(zipPath).toMatch(/all-documents-\d{4}-\d{2}-\d{2}-\d{6}-[a-f0-9]{8}\.zip$/)
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

  it('rejects traversal paths before reading outside the managed files directory', async () => {
    const root = makeTempRoot()
    const outsideFilePath = resolve(root, '..', 'secret.txt')
    tempFiles.push(outsideFilePath)
    writeFileSync(outsideFilePath, 'secret')
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () => makeSnapshot([makeDocument({ storedFilePath: '../secret.txt' })]),
    })

    await expect(service.exportSelection(['doc-1'])).rejects.toThrow(
      /unsafe managed file path for document doc-1: \.\.\/secret\.txt/,
    )
    expect(readdirSync(join(root, 'exports'))).toEqual([])
  })

  it('rejects absolute stored file paths', async () => {
    const root = makeTempRoot()
    const secretPath = resolve(root, '..', 'absolute-secret.pdf')
    tempFiles.push(secretPath)
    writeFileSync(secretPath, 'secret')
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () =>
        makeSnapshot([makeDocument({ storedFilePath: secretPath.replace(/\\/g, '/') })]),
    })

    await expect(service.exportSelection(['doc-1'])).rejects.toThrow(
      /unsafe managed file path for document doc-1:/,
    )
    expect(readdirSync(join(root, 'exports'))).toEqual([])
  })

  it('rejects files-prefix paths that traverse into exports', async () => {
    const root = makeTempRoot()
    writeFileSync(join(root, 'exports', 'foo.pdf'), 'not managed')
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () =>
        makeSnapshot([makeDocument({ storedFilePath: 'files/../exports/foo.pdf' })]),
    })

    await expect(service.exportSelection(['doc-1'])).rejects.toThrow(
      /unsafe managed file path for document doc-1: files\/\.\.\/exports\/foo\.pdf/,
    )
    expect(readdirSync(join(root, 'exports'))).toEqual(['foo.pdf'])
  })

  it('creates a unique zip path for repeated same-day exports', async () => {
    const root = makeTempRoot()
    writeFileSync(join(root, 'files', 'doc-1.pdf'), 'pdf content')
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () => makeSnapshot(),
    })

    const firstZipPath = await service.exportSelection(['doc-1'])
    const secondZipPath = await service.exportSelection(['doc-1'])

    expect(secondZipPath).not.toBe(firstZipPath)
    expect(readdirSync(join(root, 'exports')).sort()).toEqual(
      [basename(firstZipPath), basename(secondZipPath)].sort(),
    )
  })

  it('writes an export to the caller-selected directory', async () => {
    const root = makeTempRoot()
    const chosenExportDir = join(makeTempRoot(), 'chosen-exports')
    writeFileSync(join(root, 'files', 'doc-1.pdf'), 'pdf content')
    const service = createExportService({
      libraryRoot: root,
      exportsDir: join(root, 'exports'),
      getSnapshot: () => makeSnapshot(),
    })

    const zipPath = await service.exportSelection(['doc-1'], chosenExportDir)

    expect(zipPath.startsWith(chosenExportDir)).toBe(true)
    expect(readdirSync(join(root, 'exports'))).toEqual([])
    expect(readdirSync(chosenExportDir)).toEqual([basename(zipPath)])
  })
})
