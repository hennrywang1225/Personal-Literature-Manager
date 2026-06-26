import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())

vi.mock('electron', () => ({
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }),
  },
}))

import { registerIpcHandlers } from './ipcHandlers'

function validImportConfirmation(overrides: Record<string, unknown> = {}) {
  return {
    sourcePath: 'notes.txt',
    title: 'Notes',
    authors: '',
    year: null,
    doi: '',
    venue: '',
    categoryId: null,
    tags: [],
    importance: 3,
    readingStatus: 'To Read',
    note: '',
    ...overrides,
  }
}

function registerTestHandlers() {
  const options = {
    repo: {
      getSnapshot: vi.fn(() => ({ documents: [], categories: [], tags: [] })),
      upsertCategory: vi.fn(() => ({
        id: 'cat-1',
        name: '机器学习',
        parentId: null,
        sortOrder: 1,
        createdAt: '2026-06-25T00:00:00.000Z',
        updatedAt: '2026-06-25T00:00:00.000Z',
      })),
      updateDocument: vi.fn(),
      updateDocumentsCategory: vi.fn(() => []),
      deleteDocuments: vi.fn(() => []),
      listPdfAnnotations: vi.fn(() => []),
      createPdfAnnotation: vi.fn((input) => ({
        id: 'ann-1',
        createdAt: '2026-06-26T00:00:00.000Z',
        updatedAt: '2026-06-26T00:00:00.000Z',
        ...input,
      })),
      deletePdfAnnotation: vi.fn(() => ({
        id: 'ann-1',
        documentId: 'doc-1',
        pageNumber: 1,
        type: 'highlight',
        color: '#fde68a',
        rects: [],
        createdAt: '2026-06-26T00:00:00.000Z',
        updatedAt: '2026-06-26T00:00:00.000Z',
      })),
    },
    importService: {
      createCandidates: vi.fn(),
      confirmImports: vi.fn(),
    },
    saveDatabase: vi.fn(),
    getFileUrl: vi.fn(),
    getTextContent: vi.fn(),
    openExternal: vi.fn(),
    exportSelection: vi.fn(),
    exportCategory: vi.fn(),
    exportAll: vi.fn(),
    getSettings: vi.fn(() => ({
      libraryRoot: 'D:\\Papers',
      defaultExportDir: 'E:\\Exports',
    })),
    chooseLibraryRoot: vi.fn(),
    chooseDefaultExportDirectory: vi.fn(),
  }

  registerIpcHandlers(options)

  return options
}

beforeEach(() => {
  handlers.clear()
  vi.clearAllMocks()
})

describe('registerIpcHandlers validation', () => {
  it('rejects invalid import confirmations before calling the import service', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:confirmImports')

    await expect(handler?.({}, { sourcePath: 'notes.txt' })).rejects.toThrow(
      /confirmImports payload must be an array/,
    )

    expect(options.importService.confirmImports).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('rejects invalid import confirmation item fields before calling the import service', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:confirmImports')

    await expect(
      handler?.({}, [
        validImportConfirmation({
          tags: ['笔记'],
          importance: 6,
        }),
      ]),
    ).rejects.toThrow(/importance must be an integer from 1 to 5/)

    expect(options.importService.confirmImports).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('rejects NaN import years before calling the import service', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:confirmImports')

    await expect(
      handler?.({}, [
        validImportConfirmation({
          year: Number.NaN,
        }),
      ]),
    ).rejects.toThrow(/year must be a finite integer or null/)

    expect(options.importService.confirmImports).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('rejects fractional import years before calling the import service', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:confirmImports')

    await expect(
      handler?.({}, [
        validImportConfirmation({
          year: 2026.5,
        }),
      ]),
    ).rejects.toThrow(/year must be a finite integer or null/)

    expect(options.importService.confirmImports).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('rejects invalid update document arguments before calling the repository', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:updateDocument')

    await expect(handler?.({}, 123, { title: 'Notes' })).rejects.toThrow(
      /document id must be a string/,
    )

    expect(options.repo.updateDocument).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('rejects unknown update patch keys before calling the repository', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:updateDocument')

    await expect(handler?.({}, 'doc-1', { title: 'Notes', storedFilePath: 'x' })).rejects.toThrow(
      /update patch contains unsupported key: storedFilePath/,
    )

    expect(options.repo.updateDocument).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('rejects fractional update years before calling the repository', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:updateDocument')

    await expect(handler?.({}, 'doc-1', { year: 2026.5 })).rejects.toThrow(
      /year must be a finite integer or null/,
    )

    expect(options.repo.updateDocument).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('creates categories and saves the database', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:upsertCategory')

    await expect(
      handler?.({}, { name: '  机器学习  ', parentId: 'cat-parent' }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'cat-1',
        name: '机器学习',
      }),
    )

    expect(options.repo.upsertCategory).toHaveBeenCalledWith({
      name: '机器学习',
      parentId: 'cat-parent',
    })
    expect(options.saveDatabase).toHaveBeenCalled()
  })

  it('rejects invalid category parent ids before calling the repository', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:upsertCategory')

    await expect(handler?.({}, { name: '方向', parentId: 123 })).rejects.toThrow(
      /category parentId must be a string or null/,
    )

    expect(options.repo.upsertCategory).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('rejects empty category names before calling the repository', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:upsertCategory')

    await expect(handler?.({}, { name: '   ' })).rejects.toThrow(
      /category name must not be empty/,
    )

    expect(options.repo.upsertCategory).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('updates multiple document categories and saves once', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:updateDocumentsCategory')

    await expect(handler?.({}, ['doc-1', 'doc-2'], 'cat-1')).resolves.toEqual([])

    expect(options.repo.updateDocumentsCategory).toHaveBeenCalledWith(
      ['doc-1', 'doc-2'],
      'cat-1',
    )
    expect(options.saveDatabase).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid bulk document ids before calling the repository', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:updateDocumentsCategory')

    await expect(handler?.({}, ['doc-1', 2], null)).rejects.toThrow(
      /document ids must be an array of strings/,
    )

    expect(options.repo.updateDocumentsCategory).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('deletes multiple documents and saves once', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:deleteDocuments')

    await expect(handler?.({}, ['doc-1', 'doc-2'])).resolves.toEqual([])

    expect(options.repo.deleteDocuments).toHaveBeenCalledWith(['doc-1', 'doc-2'])
    expect(options.saveDatabase).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid delete document ids before calling the repository', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:deleteDocuments')

    await expect(handler?.({}, ['doc-1', null])).rejects.toThrow(
      /document ids must be an array of strings/,
    )

    expect(options.repo.deleteDocuments).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('lists PDF annotations for a document', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:listPdfAnnotations')

    await expect(handler?.({}, 'doc-1')).resolves.toEqual([])

    expect(options.repo.listPdfAnnotations).toHaveBeenCalledWith('doc-1')
  })

  it('creates PDF annotations and saves the database', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:createPdfAnnotation')

    await expect(
      handler?.(
        {},
        {
          documentId: 'doc-1',
          pageNumber: 1,
          type: 'highlight',
          color: '#fde68a',
          rects: [
            {
              pageNumber: 1,
              x: 0.1,
              y: 0.2,
              width: 0.3,
              height: 0.04,
            },
          ],
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'ann-1',
        documentId: 'doc-1',
        type: 'highlight',
      }),
    )

    expect(options.repo.createPdfAnnotation).toHaveBeenCalledWith({
      documentId: 'doc-1',
      pageNumber: 1,
      type: 'highlight',
      color: '#fde68a',
      rects: [
        {
          pageNumber: 1,
          x: 0.1,
          y: 0.2,
          width: 0.3,
          height: 0.04,
        },
      ],
    })
    expect(options.saveDatabase).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid PDF annotation rectangles before calling the repository', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:createPdfAnnotation')

    await expect(
      handler?.(
        {},
        {
          documentId: 'doc-1',
          pageNumber: 1,
          type: 'highlight',
          color: '#fde68a',
          rects: [{ pageNumber: 1, x: 0, y: 0, width: Number.NaN, height: 0.1 }],
        },
      ),
    ).rejects.toThrow(/annotation rect width must be a finite number/)

    expect(options.repo.createPdfAnnotation).not.toHaveBeenCalled()
    expect(options.saveDatabase).not.toHaveBeenCalled()
  })

  it('deletes PDF annotations and saves the database', async () => {
    const options = registerTestHandlers()
    const handler = handlers.get('library:deletePdfAnnotation')

    await expect(handler?.({}, 'ann-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'ann-1',
      }),
    )

    expect(options.repo.deletePdfAnnotation).toHaveBeenCalledWith('ann-1')
    expect(options.saveDatabase).toHaveBeenCalledTimes(1)
  })

  it('registers settings handlers', async () => {
    const options = registerTestHandlers()

    expect(handlers.get('library:getSettings')?.({})).toEqual({
      libraryRoot: 'D:\\Papers',
      defaultExportDir: 'E:\\Exports',
    })
    await handlers.get('library:chooseLibraryRoot')?.({})
    await handlers.get('library:chooseDefaultExportDirectory')?.({})

    expect(options.chooseLibraryRoot).toHaveBeenCalled()
    expect(options.chooseDefaultExportDirectory).toHaveBeenCalled()
  })
})
