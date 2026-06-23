// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRecord, LibrarySnapshot } from '../shared/types'
import { App } from './App'

const snapshot: LibrarySnapshot = {
  documents: [],
  categories: [],
  tags: [],
}

const importCandidate = {
  sourcePath: 'C:/paper.pdf',
  originalFileName: 'paper.pdf',
  fileType: 'pdf' as const,
  detectedTitle: 'Detected Paper',
  detectedAuthors: 'Author',
  detectedYear: 2026,
  detectedDoi: '10.1000/example',
  detectedVenue: '',
  extractionStatus: 'detected' as const,
}

const importedDocument: DocumentRecord = {
  id: 'doc-1',
  title: 'Edited Paper',
  authors: 'Author',
  year: 2026,
  doi: '10.1000/example',
  venue: '',
  fileType: 'pdf',
  originalFileName: 'paper.pdf',
  storedFileName: 'doc-1.pdf',
  storedFilePath: 'C:/library/doc-1.pdf',
  categoryId: null,
  categoryName: null,
  tags: [],
  importance: 3,
  readingStatus: 'To Read',
  note: '',
  createdAt: '2026-06-23T00:00:00.000Z',
  updatedAt: '2026-06-23T00:00:00.000Z',
  lastOpenedAt: null,
}

const apiMocks = vi.hoisted(() => ({
  getSnapshot: vi.fn<() => Promise<LibrarySnapshot>>(),
  chooseImportFiles: vi.fn<() => Promise<unknown[]>>(),
  confirmImports: vi.fn<() => Promise<DocumentRecord[]>>(),
  updateDocument: vi.fn(),
  exportAll: vi.fn(),
}))

vi.mock('./api/client', () => ({
  libraryApi: {
    getSnapshot: apiMocks.getSnapshot,
    chooseImportFiles: apiMocks.chooseImportFiles,
    confirmImports: apiMocks.confirmImports,
    updateDocument: apiMocks.updateDocument,
    exportAll: apiMocks.exportAll,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('renders the application shell title', async () => {
    apiMocks.getSnapshot.mockResolvedValue(snapshot)

    render(<App />)

    expect(screen.getByRole('heading', { name: '个人文献管理器' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '文献库' })).toBeInTheDocument()
  })

  it('imports reviewed files and refreshes the library', async () => {
    apiMocks.getSnapshot
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({
        ...snapshot,
        documents: [importedDocument],
      })
    apiMocks.chooseImportFiles.mockResolvedValue([importCandidate])
    apiMocks.confirmImports.mockResolvedValue([importedDocument])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '导入文献' }))
    fireEvent.change(await screen.findByLabelText('标题'), {
      target: { value: 'Edited Paper' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存导入' }))

    await waitFor(() => {
      expect(apiMocks.confirmImports).toHaveBeenCalledWith([
        expect.objectContaining({
          sourcePath: 'C:/paper.pdf',
          title: 'Edited Paper',
          readingStatus: 'To Read',
        }),
      ])
    })
    expect(apiMocks.getSnapshot).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('已导入 1 篇文献。')).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /Edited Paper/ })).toHaveClass(
      'is-selected',
    )
  })

  it('keeps the import dialog open and shows submit errors inside it', async () => {
    apiMocks.getSnapshot
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({
        ...snapshot,
        documents: [importedDocument],
      })
    apiMocks.chooseImportFiles.mockResolvedValue([importCandidate])
    apiMocks.confirmImports
      .mockRejectedValueOnce(new Error('磁盘已满'))
      .mockResolvedValueOnce([importedDocument])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '导入文献' }))
    fireEvent.click(await screen.findByRole('button', { name: '保存导入' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('磁盘已满')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: '保存导入' }))

    await waitFor(() => {
      expect(apiMocks.confirmImports).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('已导入 1 篇文献。')).toBeInTheDocument()
    expect(screen.queryByText('磁盘已满')).not.toBeInTheDocument()
  })
})
