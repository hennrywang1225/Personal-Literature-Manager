// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AppSettings,
  CategoryRecord,
  CreatePdfAnnotationInput,
  DocumentRecord,
  LibrarySnapshot,
  PdfAnnotationRecord,
} from '../shared/types'
import { App } from './App'

const snapshot: LibrarySnapshot = {
  documents: [],
  categories: [],
  tags: [],
}

const appSettings: AppSettings = {
  libraryRoot: 'D:\\Papers\\Library',
  defaultExportDir: 'E:\\Exports',
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

const pdfAnnotation: PdfAnnotationRecord = {
  id: 'ann-1',
  documentId: 'doc-1',
  pageNumber: 1,
  type: 'highlight',
  color: '#fde047',
  rects: [
    {
      height: 0.03,
      pageNumber: 1,
      width: 0.4,
      x: 0.12,
      y: 0.22,
    },
  ],
  createdAt: '2026-06-26T00:00:00.000Z',
  updatedAt: '2026-06-26T00:00:00.000Z',
}

const createdCategory: CategoryRecord = {
  id: 'cat-2',
  name: '机器学习',
  parentId: null,
  sortOrder: 2,
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
}

const apiMocks = vi.hoisted(() => ({
  getSnapshot: vi.fn<() => Promise<LibrarySnapshot>>(),
  chooseImportFiles: vi.fn<() => Promise<unknown[]>>(),
  confirmImports: vi.fn<() => Promise<DocumentRecord[]>>(),
  upsertCategory: vi.fn<
    (name: string, parentId?: string | null) => Promise<CategoryRecord>
  >(),
  updateDocument: vi.fn(),
  updateDocumentsCategory: vi.fn(),
  deleteDocuments: vi.fn<(documentIds: string[]) => Promise<DocumentRecord[]>>(),
  getFileUrl: vi.fn<(documentId: string) => Promise<string>>(),
  listPdfAnnotations: vi.fn<(documentId: string) => Promise<PdfAnnotationRecord[]>>(),
  createPdfAnnotation: vi.fn<
    (input: CreatePdfAnnotationInput) => Promise<PdfAnnotationRecord>
  >(),
  deletePdfAnnotation: vi.fn<
    (annotationId: string) => Promise<PdfAnnotationRecord>
  >(),
  getTextContent: vi.fn<(documentId: string) => Promise<string>>(),
  openExternal: vi.fn<(documentId: string) => Promise<string>>(),
  exportSelection: vi.fn<(documentIds: string[]) => Promise<string>>(),
  exportCategory: vi.fn<(categoryId: string | null) => Promise<string>>(),
  exportAll: vi.fn<() => Promise<string>>(),
  getSettings: vi.fn<() => Promise<AppSettings>>(),
  chooseLibraryRoot: vi.fn<() => Promise<AppSettings>>(),
  chooseDefaultExportDirectory: vi.fn<() => Promise<AppSettings>>(),
}))

const readerViewRenders = vi.hoisted(
  () =>
    [] as Array<{
      selectedDocumentId: string | null
      fileUrl: string | null
      fileUrlError: string | null
      markdownContent: string | null
      markdownContentError: string | null
      pdfAnnotations: PdfAnnotationRecord[]
    }>,
)

const pdfViewerRenders = vi.hoisted(
  () =>
    [] as Array<{
      annotations: PdfAnnotationRecord[]
      documentId: string
      fileUrl: string
      onCreateAnnotation: (input: CreatePdfAnnotationInput) => void | Promise<void>
      onDeleteAnnotation: (annotationId: string) => void | Promise<void>
    }>,
)

vi.mock('./api/client', () => ({
  libraryApi: {
    getSnapshot: apiMocks.getSnapshot,
    chooseImportFiles: apiMocks.chooseImportFiles,
    confirmImports: apiMocks.confirmImports,
    upsertCategory: apiMocks.upsertCategory,
    updateDocument: apiMocks.updateDocument,
    updateDocumentsCategory: apiMocks.updateDocumentsCategory,
    deleteDocuments: apiMocks.deleteDocuments,
    getFileUrl: apiMocks.getFileUrl,
    listPdfAnnotations: apiMocks.listPdfAnnotations,
    createPdfAnnotation: apiMocks.createPdfAnnotation,
    deletePdfAnnotation: apiMocks.deletePdfAnnotation,
    getTextContent: apiMocks.getTextContent,
    openExternal: apiMocks.openExternal,
    exportSelection: apiMocks.exportSelection,
    exportCategory: apiMocks.exportCategory,
    exportAll: apiMocks.exportAll,
    getSettings: apiMocks.getSettings,
    chooseLibraryRoot: apiMocks.chooseLibraryRoot,
    chooseDefaultExportDirectory: apiMocks.chooseDefaultExportDirectory,
  },
}))

vi.mock('./components/PdfAnnotationViewer', () => ({
  PdfAnnotationViewer: (
    props: (typeof pdfViewerRenders)[number],
  ): JSX.Element => {
    pdfViewerRenders.push(props)

    return (
      <div data-testid="pdf-annotation-viewer">
        PDF 标注阅读器：{props.fileUrl}，标注 {props.annotations.length} 条
      </div>
    )
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
        markdownContent: props.markdownContent,
        markdownContentError: props.markdownContentError,
        pdfAnnotations: props.pdfAnnotations,
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

const markdownDocument: DocumentRecord = {
  ...importedDocument,
  id: 'doc-4',
  title: 'Markdown Notes',
  authors: 'Local Author',
  year: 2026,
  fileType: 'md',
  originalFileName: 'notes.md',
  storedFileName: 'doc-4.md',
  storedFilePath: 'C:/library/doc-4.md',
  tags: ['Notes'],
  importance: 3,
  readingStatus: 'Reading',
  note: '',
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

const markdownSnapshot: LibrarySnapshot = {
  ...snapshot,
  documents: [markdownDocument],
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
  apiMocks.getSettings.mockResolvedValue(appSettings)
  apiMocks.listPdfAnnotations.mockResolvedValue([])
  apiMocks.createPdfAnnotation.mockResolvedValue(pdfAnnotation)
  apiMocks.deletePdfAnnotation.mockResolvedValue(pdfAnnotation)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  readerViewRenders.length = 0
  pdfViewerRenders.length = 0
})

afterEach(() => {
  vi.restoreAllMocks()
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

    const { container } = render(<App />)

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
    expect(container.querySelector('.app-workspace > .status-message')).toBeNull()
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

  it('imports into the currently selected category by default', async () => {
    const importedCategorizedDocument: DocumentRecord = {
      ...importedDocument,
      id: 'doc-4',
      categoryId: 'cat-1',
      categoryName: '深度学习',
    }
    apiMocks.getSnapshot
      .mockResolvedValueOnce(categorizedSnapshot)
      .mockResolvedValueOnce({
        ...categorizedSnapshot,
        documents: [categorizedDocument, importedCategorizedDocument],
      })
    apiMocks.chooseImportFiles.mockResolvedValue([importCandidate])
    apiMocks.confirmImports.mockResolvedValue([importedCategorizedDocument])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '深度学习 1' }))
    fireEvent.click(screen.getByRole('button', { name: '导入文献' }))
    fireEvent.click(await screen.findByRole('button', { name: '保存导入' }))

    await waitFor(() => {
      expect(apiMocks.confirmImports).toHaveBeenCalledWith([
        expect.objectContaining({
          categoryId: 'cat-1',
        }),
      ])
    })
  })

  it('exports all documents and shows the zip path', async () => {
    apiMocks.getSnapshot.mockResolvedValue(snapshot)
    apiMocks.exportAll.mockResolvedValue('C:/exports/library-backup.zip')

    render(<App />)

    fireEvent.change(await screen.findByLabelText('导出操作'), {
      target: { value: 'all' },
    })

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

    fireEvent.click(await screen.findByLabelText('选择 Edited Paper'))
    fireEvent.click(await screen.findByRole('button', { name: '导出选中' }))

    await waitFor(() => {
      expect(apiMocks.exportSelection).toHaveBeenCalledWith(['doc-1'])
    })
    expect(
      await screen.findByText('已导出：C:/exports/selected.zip'),
    ).toBeInTheDocument()
  })

  it('deletes selected documents after confirmation and refreshes the list', async () => {
    apiMocks.getSnapshot.mockResolvedValue({
      ...snapshot,
      documents: [importedDocument, secondPdfDocument],
    })
    apiMocks.deleteDocuments.mockResolvedValue([importedDocument])

    render(<App />)

    fireEvent.click(await screen.findByLabelText('选择 Edited Paper'))
    fireEvent.click(screen.getByRole('button', { name: '删除选中' }))

    await waitFor(() => {
      expect(apiMocks.deleteDocuments).toHaveBeenCalledWith(['doc-1'])
    })
    expect(window.confirm).toHaveBeenCalledWith(
      '确定删除选中的 1 篇文献吗？此操作会从文献库移除记录和已导入文件。',
    )
    expect(await screen.findByText('已删除 1 篇文献。')).toBeInTheDocument()
    expect(screen.queryByText('Edited Paper')).not.toBeInTheDocument()
    expect(screen.getByText('Second PDF')).toBeInTheDocument()
  })

  it('keeps documents when deletion is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    apiMocks.getSnapshot.mockResolvedValue({
      ...snapshot,
      documents: [importedDocument],
    })

    render(<App />)

    fireEvent.click(await screen.findByLabelText('选择 Edited Paper'))
    fireEvent.click(screen.getByRole('button', { name: '删除选中' }))

    expect(apiMocks.deleteDocuments).not.toHaveBeenCalled()
    expect(screen.getByText('Edited Paper')).toBeInTheDocument()
  })

  it('exports the current category and shows the zip path', async () => {
    apiMocks.getSnapshot.mockResolvedValue(categorizedSnapshot)
    apiMocks.exportCategory.mockResolvedValue('C:/exports/category.zip')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '深度学习 1' }))
    fireEvent.change(screen.getByLabelText('导出操作'), {
      target: { value: 'category' },
    })

    await waitFor(() => {
      expect(apiMocks.exportCategory).toHaveBeenCalledWith('cat-1')
    })
    expect(
      await screen.findByText('已导出：C:/exports/category.zip'),
    ).toBeInTheDocument()
  })

  it('creates a category and refreshes the library', async () => {
    apiMocks.getSnapshot
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({
        ...snapshot,
        categories: [createdCategory],
      })
    apiMocks.upsertCategory.mockResolvedValue(createdCategory)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '新建顶级分类' }))
    fireEvent.change(screen.getByLabelText('分类名称'), {
      target: { value: '  机器学习  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存分类' }))

    await waitFor(() => {
      expect(apiMocks.upsertCategory).toHaveBeenCalledWith('机器学习', null)
    })
    expect(apiMocks.getSnapshot).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('button', { name: '机器学习 0' })).toBeInTheDocument()
    expect(await screen.findByText('已创建分类：机器学习')).toBeInTheDocument()
  })

  it('opens settings and changes library/export locations from there', async () => {
    const changedSettings: AppSettings = {
      libraryRoot: 'D:\\NewLibrary',
      defaultExportDir: 'F:\\Exports',
    }
    apiMocks.getSnapshot.mockResolvedValue(snapshot)
    apiMocks.chooseLibraryRoot.mockResolvedValue({
      ...appSettings,
      libraryRoot: changedSettings.libraryRoot,
    })
    apiMocks.chooseDefaultExportDirectory.mockResolvedValue(changedSettings)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '设置' }))
    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByText('D:\\Papers\\Library')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '更改文献库位置' }))
    await waitFor(() => {
      expect(apiMocks.chooseLibraryRoot).toHaveBeenCalled()
    })
    expect(await screen.findByText('D:\\NewLibrary')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '更改默认导出位置' }))
    await waitFor(() => {
      expect(apiMocks.chooseDefaultExportDirectory).toHaveBeenCalled()
    })
    expect(await screen.findByText('F:\\Exports')).toBeInTheDocument()
  })

  it('shows export errors', async () => {
    apiMocks.getSnapshot.mockResolvedValue(snapshot)
    apiMocks.exportAll.mockRejectedValue(new Error('导出失败'))

    render(<App />)

    fireEvent.change(await screen.findByLabelText('导出操作'), {
      target: { value: 'all' },
    })

    expect(await screen.findByText('导出失败')).toBeInTheDocument()
  })

  it('loads a PDF file URL and annotations after entering reader mode', async () => {
    apiMocks.getSnapshot.mockResolvedValue(readerSnapshot)
    apiMocks.getFileUrl.mockResolvedValue('file:///C:/library/doc-1.pdf')
    apiMocks.listPdfAnnotations.mockResolvedValue([pdfAnnotation])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))

    await waitFor(() => {
      expect(apiMocks.getFileUrl).toHaveBeenCalledWith('doc-1')
      expect(apiMocks.listPdfAnnotations).toHaveBeenCalledWith('doc-1')
    })
    expect(await screen.findByTestId('pdf-annotation-viewer')).toHaveTextContent(
      'file:///C:/library/doc-1.pdf',
    )
    expect(pdfViewerRenders.at(-1)?.annotations).toEqual([pdfAnnotation])
  })

  it('creates and deletes PDF annotations from reader mode', async () => {
    const newAnnotationInput: CreatePdfAnnotationInput = {
      color: '#fde047',
      documentId: 'doc-1',
      pageNumber: 1,
      rects: [
        {
          height: 0.03,
          pageNumber: 1,
          width: 0.4,
          x: 0.12,
          y: 0.22,
        },
      ],
      type: 'highlight',
    }
    apiMocks.getSnapshot.mockResolvedValue(readerSnapshot)
    apiMocks.getFileUrl.mockResolvedValue('file:///C:/library/doc-1.pdf')
    apiMocks.listPdfAnnotations.mockResolvedValue([])

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))
    await screen.findByTestId('pdf-annotation-viewer')

    await act(async () => {
      await pdfViewerRenders.at(-1)?.onCreateAnnotation(newAnnotationInput)
    })

    expect(apiMocks.createPdfAnnotation).toHaveBeenCalledWith(newAnnotationInput)
    await waitFor(() => {
      expect(pdfViewerRenders.at(-1)?.annotations).toEqual([pdfAnnotation])
    })

    await act(async () => {
      await pdfViewerRenders.at(-1)?.onDeleteAnnotation('ann-1')
    })

    expect(apiMocks.deletePdfAnnotation).toHaveBeenCalledWith('ann-1')
    await waitFor(() => {
      expect(pdfViewerRenders.at(-1)?.annotations).toEqual([])
    })
  })

  it('loads Markdown content and renders it in reader mode', async () => {
    apiMocks.getSnapshot.mockResolvedValue(markdownSnapshot)
    apiMocks.getTextContent.mockResolvedValue(
      '# 研究计划\n\n- 梳理控制方向\n- 标注重点论文',
    )

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))

    await waitFor(() => {
      expect(apiMocks.getTextContent).toHaveBeenCalledWith('doc-4')
    })
    expect(
      await screen.findByRole('heading', { name: '研究计划' }),
    ).toBeInTheDocument()
    expect(apiMocks.getFileUrl).not.toHaveBeenCalled()
  })

  it('clears the file URL for non-PDF selections and opens them externally', async () => {
    apiMocks.getSnapshot.mockResolvedValue(readerSnapshot)
    apiMocks.getFileUrl.mockResolvedValue('file:///C:/library/doc-1.pdf')
    apiMocks.openExternal.mockResolvedValue('')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))
    expect(await screen.findByTestId('pdf-annotation-viewer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Reading Notes/ }))

    await waitFor(() => {
      expect(screen.queryByTestId('pdf-annotation-viewer')).not.toBeInTheDocument()
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
    expect(await screen.findByTestId('pdf-annotation-viewer')).toHaveTextContent(
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
    expect(screen.queryByTestId('pdf-annotation-viewer')).not.toBeInTheDocument()

    secondFileUrl.resolve('file:///C:/library/doc-3.pdf')
    expect(await screen.findByTestId('pdf-annotation-viewer')).toHaveTextContent(
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
    expect(await screen.findByTestId('pdf-annotation-viewer')).toHaveTextContent(
      'file:///C:/library/doc-3.pdf',
    )
  })

  it('shows a visible error when external open resolves an error message', async () => {
    apiMocks.getSnapshot.mockResolvedValue(readerSnapshot)
    apiMocks.getFileUrl.mockResolvedValue('file:///C:/library/doc-1.pdf')
    apiMocks.openExternal.mockResolvedValue('没有关联的默认应用')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '打开阅读模式' }))
    expect(await screen.findByTestId('pdf-annotation-viewer')).toBeInTheDocument()

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
    expect(screen.queryByTestId('pdf-annotation-viewer')).not.toBeInTheDocument()
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
    expect(await screen.findByTestId('pdf-annotation-viewer')).toBeInTheDocument()

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
