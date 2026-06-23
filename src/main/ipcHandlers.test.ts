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

function registerTestHandlers() {
  const options = {
    repo: {
      getSnapshot: vi.fn(() => ({ documents: [], categories: [], tags: [] })),
      updateDocument: vi.fn(),
    },
    importService: {
      createCandidates: vi.fn(),
      confirmImports: vi.fn(),
    },
    saveDatabase: vi.fn(),
    getFileUrl: vi.fn(),
    openExternal: vi.fn(),
    exportSelection: vi.fn(),
    exportCategory: vi.fn(),
    exportAll: vi.fn(),
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
        {
          sourcePath: 'notes.txt',
          title: 'Notes',
          authors: '',
          year: null,
          doi: '',
          venue: '',
          categoryId: null,
          tags: ['笔记'],
          importance: 6,
          readingStatus: 'To Read',
          note: '',
        },
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
        {
          sourcePath: 'notes.txt',
          title: 'Notes',
          authors: '',
          year: Number.NaN,
          doi: '',
          venue: '',
          categoryId: null,
          tags: [],
          importance: 3,
          readingStatus: 'To Read',
          note: '',
        },
      ]),
    ).rejects.toThrow(/year must be a finite number or null/)

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
})
