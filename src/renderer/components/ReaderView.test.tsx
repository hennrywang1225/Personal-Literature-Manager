// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CreatePdfAnnotationInput,
  DocumentRecord,
  LibrarySnapshot,
  PdfAnnotationRecord,
} from '../../shared/types'
import { ReaderView } from './ReaderView'

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

vi.mock('./PdfAnnotationViewer', () => ({
  PdfAnnotationViewer: (
    props: (typeof pdfViewerRenders)[number],
  ): JSX.Element => {
    pdfViewerRenders.push(props)

    return (
      <div data-testid="pdf-annotation-viewer">
        PDF 标注阅读器：{props.fileUrl}
      </div>
    )
  },
}))

const pdfDocument: DocumentRecord = {
  id: 'doc-1',
  title: 'Attention Is All You Need',
  authors: 'Ashish Vaswani et al.',
  year: 2017,
  doi: '10.48550/arXiv.1706.03762',
  venue: 'NeurIPS',
  fileType: 'pdf',
  originalFileName: 'attention-is-all-you-need.pdf',
  storedFileName: 'doc-1.pdf',
  storedFilePath: 'files/doc-1.pdf',
  categoryId: 'cat-1',
  categoryName: '深度学习',
  tags: ['Transformer'],
  importance: 4,
  readingStatus: 'To Read',
  note: '重点关注注意力机制。',
  createdAt: '2026-06-22T00:00:00.000Z',
  updatedAt: '2026-06-22T00:00:00.000Z',
  lastOpenedAt: null,
}

const textDocument: DocumentRecord = {
  ...pdfDocument,
  id: 'doc-2',
  title: 'Reading Notes',
  authors: 'Local Author',
  year: 2026,
  fileType: 'txt',
  originalFileName: 'notes.txt',
  storedFileName: 'doc-2.txt',
  storedFilePath: 'files/doc-2.txt',
  categoryId: null,
  categoryName: null,
  tags: ['Notes'],
  importance: 2,
  readingStatus: 'Reading',
  note: '',
}

const markdownDocument: DocumentRecord = {
  ...pdfDocument,
  id: 'doc-3',
  title: 'Markdown Notes',
  authors: 'Local Author',
  year: 2026,
  fileType: 'md',
  originalFileName: 'notes.md',
  storedFileName: 'doc-3.md',
  storedFilePath: 'files/doc-3.md',
  categoryId: null,
  categoryName: null,
  tags: ['Notes'],
  importance: 3,
  readingStatus: 'Reading',
  note: '',
}

const snapshot: LibrarySnapshot = {
  categories: [],
  tags: [],
  documents: [pdfDocument, textDocument, markdownDocument],
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
      width: 0.3,
      x: 0.1,
      y: 0.2,
    },
  ],
  createdAt: '2026-06-26T00:00:00.000Z',
  updatedAt: '2026-06-26T00:00:00.000Z',
}

function renderReaderView(
  overrides: Partial<ComponentProps<typeof ReaderView>> = {},
) {
  const props: ComponentProps<typeof ReaderView> = {
    fileUrl: 'file:///C:/library/doc-1.pdf',
    fileUrlError: null,
    markdownContent: null,
    markdownContentError: null,
    onBackToLibrary: vi.fn(),
    onCreatePdfAnnotation: vi.fn(),
    onDeletePdfAnnotation: vi.fn(),
    onOpenExternal: vi.fn(),
    onSelectDocument: vi.fn(),
    onUpdateDocument: vi.fn(),
    pdfAnnotations: [pdfAnnotation],
    selectedDocumentId: 'doc-1',
    snapshot,
    ...overrides,
  }

  render(<ReaderView {...props} />)

  return props
}

afterEach(() => {
  pdfViewerRenders.length = 0
  cleanup()
})

describe('ReaderView', () => {
  it('renders the selected PDF in the annotation viewer when fileUrl is available', () => {
    renderReaderView()

    expect(screen.getByTestId('pdf-annotation-viewer')).toHaveTextContent(
      'file:///C:/library/doc-1.pdf',
    )
    expect(pdfViewerRenders[0]).toMatchObject({
      annotations: [pdfAnnotation],
      documentId: 'doc-1',
      fileUrl: 'file:///C:/library/doc-1.pdf',
    })
    expect(screen.queryByTitle('PDF 预览：Attention Is All You Need')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Attention Is All You Need' }))
      .toBeInTheDocument()
  })

  it('selects documents from the left list and highlights the current document', () => {
    const props = renderReaderView()

    expect(
      screen.getByRole('button', { name: /Attention Is All You Need/ }),
    ).toHaveClass('is-active')

    fireEvent.click(screen.getByRole('button', { name: /Reading Notes/ }))

    expect(props.onSelectDocument).toHaveBeenCalledWith('doc-2')
  })

  it('returns to the library mode', () => {
    const props = renderReaderView()

    fireEvent.click(screen.getByRole('button', { name: '返回文献库' }))

    expect(props.onBackToLibrary).toHaveBeenCalled()
  })

  it('edits importance, status, note, and tags for the selected document', () => {
    const props = renderReaderView()

    fireEvent.click(screen.getByRole('button', { name: /设置为 5 星/ }))
    fireEvent.change(screen.getByLabelText('阅读状态'), {
      target: { value: 'Read' },
    })
    fireEvent.change(screen.getByLabelText('阅读笔记'), {
      target: { value: '这篇可以放进综述。' },
    })
    fireEvent.blur(screen.getByLabelText('阅读笔记'))
    fireEvent.change(screen.getByLabelText('添加标签'), {
      target: { value: 'Survey' },
    })
    fireEvent.keyDown(screen.getByLabelText('添加标签'), {
      code: 'Enter',
      key: 'Enter',
    })

    expect(props.onUpdateDocument).toHaveBeenCalledWith('doc-1', {
      importance: 5,
    })
    expect(props.onUpdateDocument).toHaveBeenCalledWith('doc-1', {
      readingStatus: 'Read',
    })
    expect(props.onUpdateDocument).toHaveBeenCalledWith('doc-1', {
      note: '这篇可以放进综述。',
    })
    expect(props.onUpdateDocument).toHaveBeenCalledWith('doc-1', {
      tags: ['Transformer', 'Survey'],
    })
  })

  it('shows an external-open state for non-PDF files and opens them externally', () => {
    const props = renderReaderView({
      fileUrl: null,
      selectedDocumentId: 'doc-2',
    })

    expect(
      screen.getByText('此文件类型不能在阅读区预览'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '外部打开' }))

    expect(props.onOpenExternal).toHaveBeenCalledWith('doc-2')
  })

  it('renders Markdown documents inside the reader', () => {
    renderReaderView({
      fileUrl: null,
      markdownContent: '# 研究计划\n\n- 梳理控制方向\n- 标注重点论文',
      selectedDocumentId: 'doc-3',
    })

    expect(
      screen.getByRole('heading', { name: '研究计划' }),
    ).toBeInTheDocument()
    expect(screen.getByText('梳理控制方向')).toBeInTheDocument()
    expect(
      screen.queryByText('此文件类型不能在阅读区预览'),
    ).not.toBeInTheDocument()
  })
})
