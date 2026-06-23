// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRecord, LibrarySnapshot } from '../../shared/types'
import { ReaderView } from './ReaderView'

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

const snapshot: LibrarySnapshot = {
  categories: [],
  tags: [],
  documents: [pdfDocument, textDocument],
}

function renderReaderView(
  overrides: Partial<ComponentProps<typeof ReaderView>> = {},
) {
  const props: ComponentProps<typeof ReaderView> = {
    fileUrl: 'file:///C:/library/doc-1.pdf',
    fileUrlError: null,
    onBackToLibrary: vi.fn(),
    onOpenExternal: vi.fn(),
    onSelectDocument: vi.fn(),
    onUpdateDocument: vi.fn(),
    selectedDocumentId: 'doc-1',
    snapshot,
    ...overrides,
  }

  render(<ReaderView {...props} />)

  return props
}

afterEach(() => {
  cleanup()
})

describe('ReaderView', () => {
  it('renders the selected PDF in an iframe when fileUrl is available', () => {
    renderReaderView()

    expect(
      screen.getByTitle('PDF 预览：Attention Is All You Need'),
    ).toHaveAttribute('src', 'file:///C:/library/doc-1.pdf')
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
})
