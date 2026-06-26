import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type {
  CreatePdfAnnotationInput,
  DocumentRecord,
  LibrarySnapshot,
  PdfAnnotationRecord,
  ReadingStatus,
} from '../../shared/types'
import { PdfAnnotationViewer } from './PdfAnnotationViewer'
import { Stars } from './Stars'
import { TagEditor } from './TagEditor'

type DocumentPatch = Partial<
  Pick<DocumentRecord, 'tags' | 'importance' | 'readingStatus' | 'note'>
>

interface ReaderViewProps {
  snapshot: LibrarySnapshot
  selectedDocumentId: string | null
  fileUrl: string | null
  fileUrlError: string | null
  markdownContent: string | null
  markdownContentError: string | null
  pdfAnnotations: PdfAnnotationRecord[]
  onSelectDocument: (documentId: string) => void
  onBackToLibrary: () => void
  onCreatePdfAnnotation: (
    input: CreatePdfAnnotationInput,
  ) => void | Promise<void>
  onDeletePdfAnnotation: (annotationId: string) => void | Promise<void>
  onOpenExternal: (documentId: string) => void | Promise<void>
  onUpdateDocument: (
    documentId: string,
    patch: DocumentPatch,
  ) => void | Promise<void>
}

const readingStatusLabels: Record<ReadingStatus, string> = {
  'To Read': '待读',
  Reading: '阅读中',
  Read: '已读',
  Intensive: '精读',
}

function formatAuthorsAndYear(document: DocumentRecord): string {
  const authors = document.authors || '未填写作者'
  const year = document.year ?? '年份未知'

  return `${authors} · ${year}`
}

export function ReaderView({
  snapshot,
  selectedDocumentId,
  fileUrl,
  fileUrlError,
  markdownContent,
  markdownContentError,
  pdfAnnotations,
  onSelectDocument,
  onBackToLibrary,
  onCreatePdfAnnotation,
  onDeletePdfAnnotation,
  onOpenExternal,
  onUpdateDocument,
}: ReaderViewProps): JSX.Element {
  const selectedDocument =
    snapshot.documents.find((document) => document.id === selectedDocumentId) ??
    null

  const updateSelectedDocument = (patch: DocumentPatch) => {
    if (selectedDocument) {
      void onUpdateDocument(selectedDocument.id, patch)
    }
  }

  const openSelectedDocumentExternally = () => {
    if (selectedDocument) {
      void onOpenExternal(selectedDocument.id)
    }
  }

  return (
    <section className="reader-layout" aria-label="阅读模式">
      <aside className="reader-list-panel">
        <div className="reader-list-header">
          <button className="icon-button" onClick={onBackToLibrary} type="button">
            <ArrowLeft aria-hidden="true" size={16} />
            返回文献库
          </button>
          <h2>当前文献</h2>
        </div>

        <div className="reader-document-list" role="list" aria-label="当前文献列表">
          {snapshot.documents.map((document) => (
            <button
              className={
                document.id === selectedDocumentId
                  ? 'reader-document-item is-active'
                  : 'reader-document-item'
              }
              key={document.id}
              onClick={() => onSelectDocument(document.id)}
              type="button"
            >
              <span className="reader-document-title">{document.title}</span>
              <span className="reader-document-meta">
                {formatAuthorsAndYear(document)}
              </span>
              <span className="reader-document-type">
                {document.fileType.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="reader-main">
        {selectedDocument ? (
          <>
            <header className="reader-main-header">
              <div>
                <h2>{selectedDocument.title}</h2>
                <p>{formatAuthorsAndYear(selectedDocument)}</p>
              </div>
              {selectedDocument.fileType === 'pdf' ||
              selectedDocument.fileType === 'md' ? (
                <button
                  className="icon-button reader-secondary-action"
                  onClick={openSelectedDocumentExternally}
                  type="button"
                >
                  <ExternalLink aria-hidden="true" size={16} />
                  外部打开
                </button>
              ) : null}
            </header>

            <div className="reader-preview">
              {selectedDocument.fileType === 'pdf' && fileUrl ? (
                <PdfAnnotationViewer
                  annotations={pdfAnnotations}
                  documentId={selectedDocument.id}
                  fileUrl={fileUrl}
                  onCreateAnnotation={onCreatePdfAnnotation}
                  onDeleteAnnotation={onDeletePdfAnnotation}
                />
              ) : selectedDocument.fileType === 'md' && markdownContent ? (
                <article
                  aria-label={`Markdown 阅读：${selectedDocument.title}`}
                  className="markdown-reader"
                >
                  <ReactMarkdown>{markdownContent}</ReactMarkdown>
                </article>
              ) : (
                <div className="reader-empty-state">
                  <FileText aria-hidden="true" size={34} />
                  {selectedDocument.fileType === 'pdf' ? (
                    <>
                      <h3>{fileUrlError ? '无法加载 PDF 预览' : '正在准备 PDF 预览'}</h3>
                      <p>{fileUrlError ?? '文件链接生成后会显示在这里。'}</p>
                    </>
                  ) : selectedDocument.fileType === 'md' ? (
                    <>
                      <h3>
                        {markdownContentError
                          ? '无法加载 Markdown'
                          : '正在准备 Markdown 阅读'}
                      </h3>
                      <p>{markdownContentError ?? '文件内容读取后会显示在这里。'}</p>
                    </>
                  ) : (
                    <>
                      <h3>此文件类型不能在阅读区预览</h3>
                      <p>
                        {selectedDocument.fileType.toUpperCase()} 文件请使用系统默认应用打开。
                      </p>
                      <button
                        className="primary-button"
                        onClick={openSelectedDocumentExternally}
                        type="button"
                      >
                        <ExternalLink aria-hidden="true" size={16} />
                        外部打开
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="reader-empty-state">
            <FileText aria-hidden="true" size={34} />
            <h2>未选择文献</h2>
            <p>从左侧列表选择一篇文献后开始阅读。</p>
          </div>
        )}
      </section>

      <aside className="detail-panel reader-detail-panel">
        {selectedDocument ? (
          <>
            <div className="detail-heading">
              <h2>文献详情</h2>
              <span>{selectedDocument.fileType.toUpperCase()}</span>
            </div>
            <div className="reader-detail-summary">
              <p className="reader-detail-title">{selectedDocument.title}</p>
              <p>{formatAuthorsAndYear(selectedDocument)}</p>
              {selectedDocument.venue ? <p>{selectedDocument.venue}</p> : null}
              {selectedDocument.doi ? <p>DOI: {selectedDocument.doi}</p> : null}
            </div>
            <div className="field-block">
              <span>重要程度</span>
              <Stars
                onChange={(importance) => updateSelectedDocument({ importance })}
                value={selectedDocument.importance}
              />
            </div>
            <div className="field-block">
              <span>标签</span>
              <TagEditor
                onChange={(tags) => updateSelectedDocument({ tags })}
                tags={selectedDocument.tags}
              />
            </div>
            <label>
              阅读状态
              <select
                aria-label="阅读状态"
                onChange={(event) =>
                  updateSelectedDocument({
                    readingStatus: event.target.value as ReadingStatus,
                  })
                }
                value={selectedDocument.readingStatus}
              >
                {Object.entries(readingStatusLabels).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              阅读笔记
              <textarea
                aria-label="阅读笔记"
                defaultValue={selectedDocument.note}
                key={`${selectedDocument.id}-note`}
                onBlur={(event) =>
                  updateSelectedDocument({ note: event.target.value })
                }
                rows={8}
              />
            </label>
          </>
        ) : (
          <div className="empty-detail">
            <h2>未选择文献</h2>
            <p>选择文献后可编辑星标、标签、阅读状态和笔记。</p>
          </div>
        )}
      </aside>
    </section>
  )
}
