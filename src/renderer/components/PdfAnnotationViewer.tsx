import {
  Highlighter,
  MousePointer2,
  Trash2,
  Underline,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CreatePdfAnnotationInput,
  PdfAnnotationRecord,
  PdfAnnotationRect,
  PdfAnnotationType,
} from '../../shared/types'

type PdfTool = 'select' | PdfAnnotationType
type PdfViewMode = 'read' | 'annotate'

interface PdfAnnotationViewerProps {
  documentId: string
  fileUrl: string
  annotations: PdfAnnotationRecord[]
  onCreateAnnotation: (input: CreatePdfAnnotationInput) => void | Promise<void>
  onDeleteAnnotation: (annotationId: string) => void | Promise<void>
}

interface RectLike {
  height: number
  left: number
  top: number
  width: number
}

interface PdfJsViewport {
  height: number
  transform: number[]
  width: number
}

interface PdfJsTextItem {
  height?: number
  str?: string
  transform: number[]
  width?: number
}

interface PdfJsPage {
  getTextContent(): Promise<{ items: PdfJsTextItem[] }>
  getViewport(options: { scale: number }): PdfJsViewport
  render(options: {
    canvasContext: CanvasRenderingContext2D
    viewport: PdfJsViewport
  }): { promise: Promise<unknown> }
}

interface PdfJsDocument {
  destroy(): Promise<void> | void
  getPage(pageNumber: number): Promise<PdfJsPage>
  numPages: number
}

interface PdfJsModule {
  GlobalWorkerOptions?: {
    workerSrc: string
  }
  Util?: {
    transform(first: number[], second: number[]): number[]
  }
  getDocument(source: unknown): {
    promise: Promise<PdfJsDocument>
  }
}

interface PdfTextSpan {
  height: number
  left: number
  pageNumber: number
  text: string
  top: number
  width: number
}

interface PdfPageState {
  page: PdfJsPage
  pageNumber: number
  textSpans: PdfTextSpan[]
  viewport: PdfJsViewport
}

const pdfWorkerUrl = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).toString()

const annotationColors = [
  { label: '黄色', value: '#fde047' },
  { label: '绿色', value: '#86efac' },
  { label: '蓝色', value: '#93c5fd' },
]

function roundCoordinate(value: number): number {
  return Number(value.toFixed(4))
}

function clampCoordinate(value: number): number {
  if (value < 0) {
    return 0
  }

  if (value > 1) {
    return 1
  }

  return value
}

export function normalizeClientRectForPage(
  rect: RectLike,
  pageRect: RectLike,
  pageNumber: number,
): PdfAnnotationRect {
  return {
    height: roundCoordinate(clampCoordinate(rect.height / pageRect.height)),
    pageNumber,
    width: roundCoordinate(clampCoordinate(rect.width / pageRect.width)),
    x: roundCoordinate(clampCoordinate((rect.left - pageRect.left) / pageRect.width)),
    y: roundCoordinate(clampCoordinate((rect.top - pageRect.top) / pageRect.height)),
  }
}

function pageContainsRect(rect: RectLike, pageRect: RectLike): boolean {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  return (
    centerX >= pageRect.left &&
    centerX <= pageRect.left + pageRect.width &&
    centerY >= pageRect.top &&
    centerY <= pageRect.top + pageRect.height
  )
}

function collectSelectionRects(root: HTMLElement): PdfAnnotationRect[] {
  const selection = window.getSelection()

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return []
  }

  const pages = Array.from(
    root.querySelectorAll<HTMLElement>('[data-pdf-page-number]'),
  )
  const rects: PdfAnnotationRect[] = []

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)

    for (const clientRect of Array.from(range.getClientRects())) {
      if (clientRect.width <= 0 || clientRect.height <= 0) {
        continue
      }

      const pageElement = pages.find((page) =>
        pageContainsRect(clientRect, page.getBoundingClientRect()),
      )

      if (!pageElement) {
        continue
      }

      const pageNumber = Number(pageElement.dataset.pdfPageNumber)
      const pageRect = pageElement.getBoundingClientRect()

      if (!Number.isFinite(pageNumber) || pageRect.width <= 0 || pageRect.height <= 0) {
        continue
      }

      rects.push(normalizeClientRectForPage(clientRect, pageRect, pageNumber))
    }
  }

  return rects
}

function groupRectsByPage(rects: PdfAnnotationRect[]): Map<number, PdfAnnotationRect[]> {
  const groupedRects = new Map<number, PdfAnnotationRect[]>()

  rects.forEach((rect) => {
    groupedRects.set(rect.pageNumber, [
      ...(groupedRects.get(rect.pageNumber) ?? []),
      rect,
    ])
  })

  return groupedRects
}

function createTextSpan(
  item: PdfJsTextItem,
  viewport: PdfJsViewport,
  pdfjs: PdfJsModule,
  pageNumber: number,
): PdfTextSpan {
  const transform = pdfjs.Util?.transform
    ? pdfjs.Util.transform(viewport.transform, item.transform)
    : item.transform
  const fontHeight = Math.max(
    Math.hypot(transform[2] ?? 0, transform[3] ?? 0),
    item.height ?? 10,
    1,
  )

  return {
    height: fontHeight,
    left: transform[4] ?? 0,
    pageNumber,
    text: item.str ?? '',
    top: (transform[5] ?? 0) - fontHeight,
    width: Math.max(item.width ?? fontHeight * Math.max(item.str?.length ?? 1, 1), 1),
  }
}

function annotationLabel(annotation: PdfAnnotationRecord): string {
  return `PDF 标注：${annotation.type === 'highlight' ? '高亮' : '下划线'}，第 ${
    annotation.pageNumber
  } 页`
}

function PdfPageView({
  annotations,
  pageState,
  selectedAnnotationId,
  onSelectAnnotation,
}: {
  annotations: PdfAnnotationRecord[]
  pageState: PdfPageState
  selectedAnnotationId: string | null
  onSelectAnnotation: (annotationId: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let isCancelled = false
    const canvas = canvasRef.current
    const canvasContext = canvas?.getContext('2d')

    if (!canvas || !canvasContext) {
      return () => {
        isCancelled = true
      }
    }

    canvas.width = pageState.viewport.width
    canvas.height = pageState.viewport.height

    const renderTask = pageState.page.render({
      canvasContext,
      viewport: pageState.viewport,
    })

    renderTask.promise.catch(() => {
      if (!isCancelled) {
        // pdf.js already exposes load failures through the document promise.
      }
    })

    return () => {
      isCancelled = true
    }
  }, [pageState])

  const pageAnnotations = useMemo(
    () =>
      annotations.filter((annotation) =>
        annotation.rects.some((rect) => rect.pageNumber === pageState.pageNumber),
      ),
    [annotations, pageState.pageNumber],
  )

  return (
    <div
      className="pdf-page"
      data-pdf-page-number={pageState.pageNumber}
      data-testid={`pdf-page-${pageState.pageNumber}`}
      style={{
        height: `${pageState.viewport.height}px`,
        width: `${pageState.viewport.width}px`,
      }}
    >
      <canvas
        aria-label={`PDF 第 ${pageState.pageNumber} 页`}
        className="pdf-page-canvas"
        ref={canvasRef}
      />
      <div className="pdf-text-layer" aria-hidden="true">
        {pageState.textSpans.map((span, index) => (
          <span
            className="pdf-text-span"
            key={`${span.pageNumber}-${index}-${span.left}-${span.top}`}
            style={{
              height: `${span.height}px`,
              left: `${span.left}px`,
              top: `${span.top}px`,
              width: `${span.width}px`,
            }}
          >
            {span.text}
          </span>
        ))}
      </div>
      <div className="pdf-annotation-layer">
        {pageAnnotations.flatMap((annotation) =>
          annotation.rects
            .filter((rect) => rect.pageNumber === pageState.pageNumber)
            .map((rect, index) => (
              <button
                aria-label={annotationLabel(annotation)}
                className={
                  annotation.id === selectedAnnotationId
                    ? `pdf-annotation-mark is-${annotation.type} is-selected`
                    : `pdf-annotation-mark is-${annotation.type}`
                }
                key={`${annotation.id}-${index}`}
                onClick={() => onSelectAnnotation(annotation.id)}
                style={{
                  borderBottomColor: annotation.color,
                  backgroundColor:
                    annotation.type === 'highlight' ? annotation.color : 'transparent',
                  height: `${rect.height * 100}%`,
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                }}
                type="button"
              />
            )),
        )}
      </div>
    </div>
  )
}

export function PdfAnnotationViewer({
  annotations,
  documentId,
  fileUrl,
  onCreateAnnotation,
  onDeleteAnnotation,
}: PdfAnnotationViewerProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [activeTool, setActiveTool] = useState<PdfTool>('select')
  const [color, setColor] = useState(annotationColors[0].value)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pages, setPages] = useState<PdfPageState[]>([])
  const [scale, setScale] = useState(1.25)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null,
  )
  const [toolMessage, setToolMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<PdfViewMode>('read')

  useEffect(() => {
    let isMounted = true
    let loadedDocument: PdfJsDocument | null = null

    if (viewMode !== 'annotate') {
      setErrorMessage(null)
      setIsLoading(false)
      setPages([])

      return () => {
        isMounted = false
      }
    }

    async function loadPdf() {
      setErrorMessage(null)
      setIsLoading(true)
      setPages([])

      try {
        const pdfjs = (await import(
          'pdfjs-dist/legacy/build/pdf.mjs'
        )) as PdfJsModule

        if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        }

        const loadingTask = pdfjs.getDocument({
          url: fileUrl,
          useWorkerFetch: false,
        })
        loadedDocument = await loadingTask.promise
        const nextPages: PdfPageState[] = []

        for (
          let pageNumber = 1;
          pageNumber <= loadedDocument.numPages;
          pageNumber += 1
        ) {
          const page = await loadedDocument.getPage(pageNumber)
          const viewport = page.getViewport({ scale })
          const textContent = await page.getTextContent()

          nextPages.push({
            page,
            pageNumber,
            textSpans: textContent.items
              .map((item) => createTextSpan(item, viewport, pdfjs, pageNumber))
              .filter((span) => span.text.trim().length > 0),
            viewport,
          })
        }

        if (isMounted) {
          setPages(nextPages)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : '无法加载 PDF 文件',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadPdf()

    return () => {
      isMounted = false
      void loadedDocument?.destroy()
    }
  }, [fileUrl, scale, viewMode])

  const createAnnotationsFromSelection = async (type: PdfAnnotationType) => {
    setActiveTool(type)
    setToolMessage(null)

    const root = rootRef.current

    if (!root) {
      return
    }

    const rects = collectSelectionRects(root)

    if (rects.length === 0) {
      setToolMessage('先选中 PDF 里的文字，再点击高亮或下划线。')
      return
    }

    setIsSaving(true)

    try {
      await Promise.all(
        Array.from(groupRectsByPage(rects).entries()).map(([pageNumber, pageRects]) =>
          onCreateAnnotation({
            color,
            documentId,
            pageNumber,
            rects: pageRects,
            type,
          }),
        ),
      )
      window.getSelection()?.removeAllRanges()
      setToolMessage(null)
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : '保存标注失败')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteSelectedAnnotation = async () => {
    if (!selectedAnnotationId) {
      return
    }

    setIsSaving(true)

    try {
      await onDeleteAnnotation(selectedAnnotationId)
      setSelectedAnnotationId(null)
      setToolMessage(null)
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : '删除标注失败')
    } finally {
      setIsSaving(false)
    }
  }

  const maybeAnnotateSelection = () => {
    if (activeTool === 'select') {
      return
    }

    void createAnnotationsFromSelection(activeTool)
  }

  return (
    <div className="pdf-annotation-viewer">
      <div className="pdf-view-mode-bar">
        <button
          aria-pressed={viewMode === 'read'}
          className={
            viewMode === 'read' ? 'tool-button is-active' : 'tool-button'
          }
          onClick={() => setViewMode('read')}
          type="button"
        >
          清晰阅读
        </button>
        <button
          aria-pressed={viewMode === 'annotate'}
          className={
            viewMode === 'annotate' ? 'tool-button is-active' : 'tool-button'
          }
          onClick={() => setViewMode('annotate')}
          type="button"
        >
          标注模式
        </button>
      </div>

      {viewMode === 'read' ? (
        <iframe
          className="reader-pdf-frame pdf-clear-reader-frame"
          src={fileUrl}
          title="清晰 PDF 阅读"
        />
      ) : (
        <>
          <div
            className="pdf-annotation-toolbar"
            onMouseDown={(event) => event.preventDefault()}
            role="toolbar"
            aria-label="PDF 标注工具"
          >
            <button
              aria-pressed={activeTool === 'select'}
              className={
                activeTool === 'select' ? 'tool-button is-active' : 'tool-button'
              }
              onClick={() => setActiveTool('select')}
              type="button"
            >
              <MousePointer2 aria-hidden="true" size={16} />
              选择
            </button>
            <button
              aria-pressed={activeTool === 'highlight'}
              className={
                activeTool === 'highlight' ? 'tool-button is-active' : 'tool-button'
              }
              disabled={isSaving}
              onClick={() => void createAnnotationsFromSelection('highlight')}
              type="button"
            >
              <Highlighter aria-hidden="true" size={16} />
              高亮
            </button>
            <button
              aria-pressed={activeTool === 'underline'}
              className={
                activeTool === 'underline' ? 'tool-button is-active' : 'tool-button'
              }
              disabled={isSaving}
              onClick={() => void createAnnotationsFromSelection('underline')}
              type="button"
            >
              <Underline aria-hidden="true" size={16} />
              下划线
            </button>
            <div className="pdf-color-group" aria-label="标注颜色">
              {annotationColors.map((item) => (
                <button
                  aria-label={item.label}
                  aria-pressed={color === item.value}
                  className={
                    color === item.value
                      ? 'pdf-color-button is-active'
                      : 'pdf-color-button'
                  }
                  key={item.value}
                  onClick={() => setColor(item.value)}
                  style={{ backgroundColor: item.value }}
                  type="button"
                />
              ))}
            </div>
            <button
              className="tool-button"
              onClick={() =>
                setScale((currentScale) => Math.max(currentScale - 0.15, 0.7))
              }
              type="button"
            >
              <ZoomOut aria-hidden="true" size={16} />
              缩小
            </button>
            <span className="pdf-zoom-value">{Math.round(scale * 100)}%</span>
            <button
              className="tool-button"
              onClick={() =>
                setScale((currentScale) => Math.min(currentScale + 0.15, 2.4))
              }
              type="button"
            >
              <ZoomIn aria-hidden="true" size={16} />
              放大
            </button>
            <button
              className="tool-button is-danger"
              disabled={!selectedAnnotationId || isSaving}
              onClick={() => void deleteSelectedAnnotation()}
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
              删除标注
            </button>
          </div>
          {toolMessage ? <p className="pdf-tool-message">{toolMessage}</p> : null}
          <div
            className="pdf-scroll-region"
            onMouseUp={maybeAnnotateSelection}
            ref={rootRef}
          >
            {isLoading ? <p className="pdf-loading-message">正在加载 PDF...</p> : null}
            {errorMessage ? <p className="pdf-loading-message">{errorMessage}</p> : null}
            {!isLoading && !errorMessage
              ? pages.map((pageState) => (
                  <PdfPageView
                    annotations={annotations}
                    key={pageState.pageNumber}
                    onSelectAnnotation={setSelectedAnnotationId}
                    pageState={pageState}
                    selectedAnnotationId={selectedAnnotationId}
                  />
                ))
              : null}
          </div>
        </>
      )}
    </div>
  )
}
