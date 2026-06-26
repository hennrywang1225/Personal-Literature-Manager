// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PdfAnnotationRecord } from '../../shared/types'
import {
  PdfAnnotationViewer,
  normalizeClientRectForPage,
} from './PdfAnnotationViewer'

const pdfjsMocks = vi.hoisted(() => {
  const page = {
    getTextContent: vi.fn(async () => ({
      items: [
        {
          str: 'Mock paper line',
          transform: [1, 0, 0, 1, 20, 760],
          width: 120,
          height: 12,
        },
      ],
    })),
    getViewport: vi.fn(({ scale }: { scale: number }) => ({
      height: 800 * scale,
      transform: [scale, 0, 0, -scale, 0, 800 * scale],
      width: 600 * scale,
    })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
  }
  const document = {
    destroy: vi.fn(),
    getPage: vi.fn(async () => page),
    numPages: 1,
  }

  return {
    document,
    getDocument: vi.fn(() => ({ promise: Promise.resolve(document) })),
    page,
  }
})

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  Util: {
    transform: vi.fn(() => [1, 0, 0, 1, 20, 760]),
  },
  getDocument: pdfjsMocks.getDocument,
}))

const annotation: PdfAnnotationRecord = {
  id: 'ann-1',
  documentId: 'doc-1',
  pageNumber: 1,
  type: 'highlight',
  color: '#fde047',
  rects: [
    {
      height: 0.04,
      pageNumber: 1,
      width: 0.4,
      x: 0.2,
      y: 0.3,
    },
  ],
  createdAt: '2026-06-26T00:00:00.000Z',
  updatedAt: '2026-06-26T00:00:00.000Z',
}

function renderViewer(overrides: Partial<Parameters<typeof PdfAnnotationViewer>[0]> = {}) {
  const props: Parameters<typeof PdfAnnotationViewer>[0] = {
    annotations: [annotation],
    documentId: 'doc-1',
    fileUrl: 'file:///C:/library/doc-1.pdf',
    onCreateAnnotation: vi.fn(),
    onDeleteAnnotation: vi.fn(),
    ...overrides,
  }

  render(<PdfAnnotationViewer {...props} />)

  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('normalizeClientRectForPage', () => {
  it('converts a screen rectangle into normalized PDF page coordinates', () => {
    expect(
      normalizeClientRectForPage(
        { height: 20, left: 150, top: 240, width: 200 },
        { height: 800, left: 100, top: 200, width: 500 },
        2,
      ),
    ).toEqual({
      height: 0.025,
      pageNumber: 2,
      width: 0.4,
      x: 0.1,
      y: 0.05,
    })
  })
})

describe('PdfAnnotationViewer', () => {
  it('opens in the clear native PDF reader by default', () => {
    renderViewer()

    expect(screen.getByTitle('清晰 PDF 阅读')).toHaveAttribute(
      'src',
      'file:///C:/library/doc-1.pdf',
    )
    expect(screen.getByRole('button', { name: '标注模式' })).toBeInTheDocument()
    expect(screen.queryByRole('toolbar', { name: 'PDF 标注工具' })).not.toBeInTheDocument()
    expect(pdfjsMocks.getDocument).not.toHaveBeenCalled()
  })

  it('renders the PDF page, toolbar, and saved annotation overlays in annotation mode', async () => {
    renderViewer()

    fireEvent.click(screen.getByRole('button', { name: '标注模式' }))

    expect(await screen.findByText('Mock paper line')).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'PDF 标注工具' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '高亮' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下划线' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'PDF 标注：高亮，第 1 页' }),
    ).toBeInTheDocument()
  })

  it('creates a highlight from the current text selection', async () => {
    const onCreateAnnotation = vi.fn()
    renderViewer({ annotations: [], onCreateAnnotation })

    fireEvent.click(screen.getByRole('button', { name: '标注模式' }))
    await screen.findByText('Mock paper line')
    const page = screen.getByTestId('pdf-page-1')
    vi.spyOn(page, 'getBoundingClientRect').mockReturnValue({
      bottom: 1000,
      height: 800,
      left: 100,
      right: 700,
      top: 200,
      width: 600,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    })
    const removeAllRanges = vi.fn()
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () =>
        ({
          getClientRects: () => [
            {
              height: 24,
              left: 160,
              top: 320,
              width: 180,
            },
          ],
        }) as Range,
      removeAllRanges,
    } as unknown as Selection)

    fireEvent.click(screen.getByRole('button', { name: '高亮' }))

    await waitFor(() => {
      expect(onCreateAnnotation).toHaveBeenCalledWith({
        color: '#fde047',
        documentId: 'doc-1',
        pageNumber: 1,
        rects: [
          {
            height: 0.03,
            pageNumber: 1,
            width: 0.3,
            x: 0.1,
            y: 0.15,
          },
        ],
        type: 'highlight',
      })
    })
    expect(removeAllRanges).toHaveBeenCalled()
  })

  it('deletes the selected saved annotation', async () => {
    const onDeleteAnnotation = vi.fn()
    renderViewer({ onDeleteAnnotation })

    fireEvent.click(screen.getByRole('button', { name: '标注模式' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'PDF 标注：高亮，第 1 页' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '删除标注' }))

    expect(onDeleteAnnotation).toHaveBeenCalledWith('ann-1')
  })
})
