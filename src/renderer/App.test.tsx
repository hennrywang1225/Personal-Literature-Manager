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
  getFileUrl: vi.fn<(documentId: string) => Promise<string>>(),
  openExternal: vi.fn<(documentId: string) => Promise<string>>(),
  exportAll: vi.fn(),
}))

vi.mock('./api/client', () => ({
  libraryApi: {
    getSnapshot: apiMocks.getSnapshot,
    chooseImportFiles: apiMocks.chooseImportFiles,
    confirmImports: apiMocks.confirmImports,
    updateDocument: apiMocks.updateDocument,
    getFileUrl: apiMocks.getFileUrl,
    openExternal: apiMocks.openExternal,
    exportAll: apiMocks.exportAll,
  },
}))

const textDocument: DocumentRecord = {
  ...importedDocument,
  id: 'doc-2',
  title: 'Reading Notes',
  authors: 'Local Author',
  year: 2026,
  fileType: 'txt',
  originalFileName: 'notes.txt',
  storedFileName: 'doc-2.txt',
  storedFilePath: 'C:/library/doc-2.txt',
  tags: ['Notes'],
  importance: 2,
  readingStatus: 'Reading',
  note: '',
}

const readerSnapshot: LibrarySnapshot = {
  ...snapshot,
  documents: [importedDocument, textDocument],
}

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

  it('loads a PDF file URL and renders the reader iframe after entering reader mode', async () => {
    apiMocks.getSnapshot.mockResolvedValue(readerSnapshot)
    apiMocks.getFileUrl.mockResolvedValue('file:///C:/library/doc-1.pdf')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))

    await waitFor(() => {
      expect(apiMocks.getFileUrl).toHaveBeenCalledWith('doc-1')
    })
    expect(await screen.findByTitle('PDF 预览：Edited Paper')).toHaveAttribute(
      'src',
      'file:///C:/library/doc-1.pdf',
    )
  })

  it('clears the file URL for non-PDF selections and opens them externally', async () => {
    apiMocks.getSnapshot.mockResolvedValue(readerSnapshot)
    apiMocks.getFileUrl.mockResolvedValue('file:///C:/library/doc-1.pdf')
    apiMocks.openExternal.mockResolvedValue('C:/library/doc-2.txt')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))
    expect(await screen.findByTitle('PDF 预览：Edited Paper')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Reading Notes/ }))

    await waitFor(() => {
      expect(screen.queryByTitle('PDF 预览：Edited Paper')).not.toBeInTheDocument()
    })
    expect(apiMocks.getFileUrl).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '外部打开' }))

    await waitFor(() => {
      expect(apiMocks.openExternal).toHaveBeenCalledWith('doc-2')
    })
  })

  it('shows a visible error when loading a PDF file URL fails', async () => {
    apiMocks.getSnapshot.mockResolvedValue({
      ...snapshot,
      documents: [importedDocument],
    })
    apiMocks.getFileUrl.mockRejectedValue(new Error('无法生成文件链接'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))

    expect(await screen.findByText('无法生成文件链接')).toBeInTheDocument()
    expect(screen.queryByTitle('PDF 预览：Edited Paper')).not.toBeInTheDocument()
  })
})
