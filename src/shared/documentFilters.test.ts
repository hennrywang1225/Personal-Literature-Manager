import { describe, expect, it } from 'vitest'
import { filterAndSortDocuments } from './documentFilters'
import type { DocumentFilters, DocumentRecord } from './types'

const documents: DocumentRecord[] = [
  {
    id: 'doc-a',
    title: 'Transformer Segmentation for Medical Imaging',
    authors: 'Alice Zhang; Bo Wang',
    year: 2024,
    doi: '10.1000/med-transformer',
    venue: 'MICCAI',
    fileType: 'pdf',
    originalFileName: 'transformer-medical-imaging.pdf',
    storedFileName: 'doc-a.pdf',
    storedFilePath: 'library/doc-a.pdf',
    categoryId: 'cat-deep-learning',
    categoryName: '深度学习',
    tags: ['transformer', 'segmentation', '医学影像'],
    importance: 5,
    readingStatus: 'Intensive',
    note: 'Key baseline for tumor segmentation review.',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-12T09:00:00.000Z',
    lastOpenedAt: '2026-01-13T09:00:00.000Z',
  },
  {
    id: 'doc-b',
    title: 'Clinical Workflow Notes',
    authors: 'Chen Li',
    year: 2022,
    doi: '10.2000/clinical-notes',
    venue: 'Radiology Today',
    fileType: 'md',
    originalFileName: 'clinical-workflow.md',
    storedFileName: 'doc-b.md',
    storedFilePath: 'library/doc-b.md',
    categoryId: 'cat-medical-imaging',
    categoryName: '医学影像',
    tags: ['workflow', 'radiology'],
    importance: 2,
    readingStatus: 'To Read',
    note: 'Summarizes reporting handoff practices.',
    createdAt: '2026-02-10T09:00:00.000Z',
    updatedAt: '2026-02-12T09:00:00.000Z',
    lastOpenedAt: null,
  },
]

const baseFilters: DocumentFilters = {
  sortBy: 'title',
  sortDirection: 'asc',
}

const filteredIds = (filters: Partial<DocumentFilters>) =>
  filterAndSortDocuments(documents, { ...baseFilters, ...filters }).map(
    (document) => document.id,
  )

describe('filterAndSortDocuments', () => {
  it.each([
    ['title', 'transformer', ['doc-a']],
    ['authors', 'chen li', ['doc-b']],
    ['tags', 'segmentation', ['doc-a']],
    ['category', '深度学习', ['doc-a']],
    ['note', 'handoff', ['doc-b']],
    ['DOI', '10.1000/med', ['doc-a']],
  ])('search matches %s', (_field, query, expectedIds) => {
    expect(filteredIds({ query })).toEqual(expectedIds)
  })

  it('filters by categoryId, reading status, file type, tag, and minimum importance', () => {
    expect(
      filteredIds({
        categoryId: 'cat-deep-learning',
        status: 'Intensive',
        fileType: 'pdf',
        tag: '医学影像',
        minImportance: 4,
      }),
    ).toEqual(['doc-a'])
  })

  it('sorts by importance descending with title as a deterministic tie-breaker', () => {
    expect(
      filterAndSortDocuments(documents, {
        sortBy: 'importance',
        sortDirection: 'desc',
      }).map((document) => document.id),
    ).toEqual(['doc-a', 'doc-b'])
  })
})
