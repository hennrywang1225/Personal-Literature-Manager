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
  exportSelection: vi.fn<(documentIds: string[]) => Promise<string>>(),
  exportCategory: vi.fn<(categoryId: string | null) => Promise<string>>(),
  exportAll: vi.fn<() => Promise<string>>(),
}))

const readerViewRenders = vi.hoisted(
  () =>
    [] as Array<{
      selectedDocumentId: string | null
      fileUrl: string | null
      fileUrlError: string | null
    }>,
)

vi.mock('./api/client', () => ({
  libraryApi: {
    getSnapshot: apiMocks.getSnapshot,
    chooseImportFiles: apiMocks.chooseImportFiles,
    confirmImports: apiMocks.confirmImports,
    updateDocument: apiMocks.updateDocument,
    getFileUrl: apiMocks.getFileUrl,
    openExternal: apiMocks.openExternal,
    exportSelection: apiMocks.exportSelection,
    exportCategory: apiMocks.exportCategory,
    exportAll: apiMocks.exportAll,
  },
}))

vi.mock('./components/ReaderView', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./components/ReaderView')>()

  return {
    ReaderView: (props: Parameters<typeof actual.ReaderView>[0]) => {
      readerViewRenders.push({
        fileUrl: props.fileUrl,
        fileUrlError: props.fileUrlError,
        selectedDocumentId: props.selectedDocumentId,
      })

      return <actual.ReaderView {...props} />
    },
  }
})

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

const secondPdfDocument: DocumentRecord = {
  ...importedDocument,
  id: 'doc-3',
  title: 'Second PDF',
  authors: 'Second Author',
  originalFileName: 'second.pdf',
  storedFileName: 'doc-3.pdf',
  storedFilePath: 'C:/library/doc-3.pdf',
}

const categorizedDocument: DocumentRecord = {
  ...importedDocument,
  categoryId: 'cat-1',
  categoryName: '深度学习',
}

const readerSnapshot: LibrarySnapshot = {
  ...snapshot,
  documents: [importedDocument, textDocument],
}

const twoPdfSnapshot: LibrarySnapshot = {
  ...snapshot,
  documents: [importedDocument, secondPdfDocument],
}

const categorizedSnapshot: LibrarySnapshot = {
  documents: [categorizedDocument],
  categories: [
    {
      id: 'cat-1',
      name: '深度学习',
      parentId: null,
      sortOrder: 1,
      createdAt: '2026-06-23T00:00:00.000Z',
      updatedAt: '2026-06-23T00:00:00.000Z',
    },
  ],
  tags: [],
}

function createDeferred<T>() {
  let reject!: (error: unknown) => void
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  readerViewRenders.length = 0
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

  it('exports all documents and shows the zip path', async () => {
    apiMocks.getSnapshot.mockResolvedValue(snapshot)
    apiMocks.exportAll.mockResolvedValue('C:/exports/library-backup.zip')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '导出全部' }))

    await waitFor(() => {
      expect(apiMocks.exportAll).toHaveBeenCalled()
    })
    expect(
      await screen.findByText('已导出：C:/exports/library-backup.zip'),
    ).toBeInTheDocument()
  })

  it('exports the selected document and shows the zip path', async () => {
    apiMocks.getSnapshot.mockResolvedValue({
      ...snapshot,
      documents: [importedDocument],
    })
    apiMocks.exportSelection.mockResolvedValue('C:/exports/selected.zip')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '导出选中' }))

    await waitFor(() => {
      expect(apiMocks.exportSelection).toHaveBeenCalledWith(['doc-1'])
    })
    expect(
      await screen.findByText('已导出：C:/exports/selected.zip'),
    ).toBeInTheDocument()
  })

  it('exports the current category and shows the zip path', async () => {
    apiMocks.getSnapshot.mockResolvedValue(categorizedSnapshot)
    apiMocks.exportCategory.mockResolvedValue('C:/exports/category.zip')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '深度学习 1' }))
    fireEvent.click(screen.getByRole('button', { name: '导出当前分类' }))

    await waitFor(() => {
      expect(apiMocks.exportCategory).toHaveBeenCalledWith('cat-1')
    })
    expect(
      await screen.findByText('已导出：C:/exports/category.zip'),
    ).toBeInTheDocument()
  })

  it('shows export errors', async () => {
    apiMocks.getSnapshot.mockResolvedValue(snapshot)
    apiMocks.exportAll.mockRejectedValue(new Error('导出失败'))

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '导出全部' }))

    expect(await screen.findByText('导出失败')).toBeInTheDocument()
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
    apiMocks.openExternal.mockResolvedValue('')

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

  it('does not render a stale PDF URL while switching between PDF documents', async () => {
    const firstFileUrl = createDeferred<string>()
    const secondFileUrl = createDeferred<string>()
    apiMocks.getSnapshot.mockResolvedValue(twoPdfSnapshot)
    apiMocks.getFileUrl.mockImplementation((documentId) =>
      documentId === 'doc-1' ? firstFileUrl.promise : secondFileUrl.promise,
    )

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))
    await waitFor(() => {
      expect(apiMocks.getFileUrl).toHaveBeenCalledWith('doc-1')
    })

    firstFileUrl.resolve('file:///C:/library/doc-1.pdf')
    expect(await screen.findByTitle('PDF 预览：Edited Paper')).toHaveAttribute(
      'src',
      'file:///C:/library/doc-1.pdf',
    )

    fireEvent.click(screen.getByRole('button', { name: /Second PDF/ }))
    await waitFor(() => {
      expect(apiMocks.getFileUrl).toHaveBeenCalledWith('doc-3')
    })

    expect(readerViewRenders).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileUrl: 'file:///C:/library/doc-1.pdf',
          selectedDocumentId: 'doc-3',
        }),
      ]),
    )
    expect(screen.queryByTitle('PDF 预览：Second PDF')).not.toBeInTheDocument()

    secondFileUrl.resolve('file:///C:/library/doc-3.pdf')
    expect(await screen.findByTitle('PDF 预览：Second PDF')).toHaveAttribute(
      'src',
      'file:///C:/library/doc-3.pdf',
    )
  })

  it('does not render a stale PDF error while switching between PDF documents', async () => {
    const firstFileUrl = createDeferred<string>()
    const secondFileUrl = createDeferred<string>()
    apiMocks.getSnapshot.mockResolvedValue(twoPdfSnapshot)
    apiMocks.getFileUrl.mockImplementation((documentId) =>
      documentId === 'doc-1' ? firstFileUrl.promise : secondFileUrl.promise,
    )

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))
    await waitFor(() => {
      expect(apiMocks.getFileUrl).toHaveBeenCalledWith('doc-1')
    })

    firstFileUrl.reject(new Error('A 文件无法预览'))
    expect(await screen.findByText('A 文件无法预览')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Second PDF/ }))
    await waitFor(() => {
      expect(apiMocks.getFileUrl).toHaveBeenCalledWith('doc-3')
    })

    expect(readerViewRenders).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileUrlError: 'A 文件无法预览',
          selectedDocumentId: 'doc-3',
        }),
      ]),
    )
    expect(screen.queryByText('A 文件无法预览')).not.toBeInTheDocument()

    secondFileUrl.resolve('file:///C:/library/doc-3.pdf')
    expect(await screen.findByTitle('PDF 预览：Second PDF')).toHaveAttribute(
      'src',
      'file:///C:/library/doc-3.pdf',
    )
  })

  it('shows a visible error when external open resolves an error message', async () => {
    apiMocks.getSnapshot.mockResolvedValue(readerSnapshot)
    apiMocks.getFileUrl.mockResolvedValue('file:///C:/library/doc-1.pdf')
    apiMocks.openExternal.mockResolvedValue('没有关联的默认应用')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))
    expect(await screen.findByTitle('PDF 预览：Edited Paper')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Reading Notes/ }))
    fireEvent.click(screen.getByRole('button', { name: '外部打开' }))

    expect(await screen.findByText('没有关联的默认应用')).toBeInTheDocument()
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

  it('shows reader update errors and clears them after a successful reader edit', async () => {
    apiMocks.getSnapshot.mockResolvedValue(readerSnapshot)
    apiMocks.getFileUrl.mockResolvedValue('file:///C:/library/doc-1.pdf')
    apiMocks.updateDocument
      .mockRejectedValueOnce(new Error('保存修改失败'))
      .mockResolvedValueOnce({
        ...importedDocument,
        importance: 4,
      })

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))
    expect(await screen.findByTitle('PDF 预览：Edited Paper')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('阅读状态'), {
      target: { value: 'Read' },
    })

    expect(await screen.findByText('保存修改失败')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /设置为 4 星/ }))

    await waitFor(() => {
      expect(screen.queryByText('保存修改失败')).not.toBeInTheDocument()
    })
    expect(apiMocks.updateDocument).toHaveBeenCalledWith('doc-1', {
      readingStatus: 'Read',
    })
    expect(apiMocks.updateDocument).toHaveBeenCalledWith('doc-1', {
      importance: 4,
    })
  })
})
