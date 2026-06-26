// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiteratureApi } from '../../main/preload'
import type { LibrarySnapshot } from '../../shared/types'

const snapshot: LibrarySnapshot = {
  categories: [],
  documents: [],
  tags: [],
}

function makeApi(): LiteratureApi {
  return {
    getSnapshot: vi.fn(async () => snapshot),
    chooseImportFiles: vi.fn(async () => []),
    confirmImports: vi.fn(async () => []),
    upsertCategory: vi.fn(),
    updateDocument: vi.fn(),
    updateDocumentsCategory: vi.fn(),
    deleteDocuments: vi.fn(),
    getFileUrl: vi.fn(),
    getTextContent: vi.fn(),
    listPdfAnnotations: vi.fn(),
    createPdfAnnotation: vi.fn(),
    deletePdfAnnotation: vi.fn(),
    openExternal: vi.fn(),
    exportSelection: vi.fn(),
    exportCategory: vi.fn(),
    exportAll: vi.fn(),
    getSettings: vi.fn(),
    chooseLibraryRoot: vi.fn(),
    chooseDefaultExportDirectory: vi.fn(),
  }
}

async function loadClient() {
  vi.resetModules()
  return import('./client')
}

afterEach(() => {
  delete window.literature
  delete window.libraryApi
})

describe('libraryApi client', () => {
  it('uses the current preload API when it is available', async () => {
    const api = makeApi()
    window.literature = api

    const { libraryApi } = await loadClient()

    await expect(libraryApi.getSnapshot()).resolves.toBe(snapshot)
    expect(api.getSnapshot).toHaveBeenCalledTimes(1)
  })

  it('falls back to the legacy preload API name', async () => {
    const api = makeApi()
    window.libraryApi = api

    const { libraryApi } = await loadClient()

    await expect(libraryApi.chooseImportFiles()).resolves.toEqual([])
    expect(api.chooseImportFiles).toHaveBeenCalledTimes(1)
  })

  it('returns a clear async error when the preload API is missing', async () => {
    const { libraryApi } = await loadClient()

    await expect(libraryApi.chooseImportFiles()).rejects.toThrow(
      '文献管理器主进程 API 未加载，请重新打开软件',
    )
  })
})
