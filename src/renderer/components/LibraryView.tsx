import { Archive, Download, FileArchive, FileInput, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { filterAndSortDocuments } from '../../shared/documentFilters'
import type {
  DocumentRecord,
  LibrarySnapshot,
  ReadingStatus,
} from '../../shared/types'
import { Stars } from './Stars'
import { TagEditor } from './TagEditor'

type DocumentPatch = Partial<
  Pick<
    DocumentRecord,
    'title' | 'authors' | 'tags' | 'importance' | 'readingStatus' | 'note'
  >
>

interface LibraryViewProps {
  snapshot: LibrarySnapshot
  selectedDocumentId: string | null
  onSelectDocument: (documentId: string) => void
  onOpenReader: (documentId: string) => void
  onImport: () => void
  onExportSelection: () => void
  onExportCategory: (categoryId: string | null) => void
  onExportAll: () => void
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

export function LibraryView({
  snapshot,
  selectedDocumentId,
  onSelectDocument,
  onOpenReader,
  onImport,
  onExportSelection,
  onExportCategory,
  onExportAll,
  onUpdateDocument,
}: LibraryViewProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [quickFilter, setQuickFilter] = useState<'all' | 'fiveStar' | 'toRead'>(
    'all',
  )

  const documents = useMemo(
    () =>
      filterAndSortDocuments(snapshot.documents, {
        query,
        categoryId,
        minImportance: quickFilter === 'fiveStar' ? 5 : undefined,
        status: quickFilter === 'toRead' ? 'To Read' : undefined,
        sortBy: 'importance',
        sortDirection: 'desc',
      }),
    [categoryId, query, quickFilter, snapshot.documents],
  )

  const selectedDocument =
    snapshot.documents.find((document) => document.id === selectedDocumentId) ??
    null

  const updateSelectedDocument = (patch: DocumentPatch) => {
    if (selectedDocument) {
      void onUpdateDocument(selectedDocument.id, patch)
    }
  }

  return (
    <section className="library-layout" aria-label="文献库">
      <aside className="library-sidebar">
        <section>
          <h2>分类</h2>
          <button
            className={!categoryId ? 'sidebar-item is-active' : 'sidebar-item'}
            onClick={() => setCategoryId(undefined)}
            type="button"
          >
            <span>全部文献</span>
            <span>{snapshot.documents.length}</span>
          </button>
          {snapshot.categories.map((category) => (
            <button
              className={
                categoryId === category.id
                  ? 'sidebar-item is-active'
                  : 'sidebar-item'
              }
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              type="button"
            >
              <span>{category.name}</span>
              <span>
                {
                  snapshot.documents.filter(
                    (document) => document.categoryId === category.id,
                  ).length
                }
              </span>
            </button>
          ))}
        </section>
        <section>
          <h2>快速筛选</h2>
          <button
            className={
              quickFilter === 'fiveStar'
                ? 'sidebar-item is-active'
                : 'sidebar-item'
            }
            onClick={() => setQuickFilter('fiveStar')}
            type="button"
          >
            五星重点
          </button>
          <button
            className={
              quickFilter === 'toRead'
                ? 'sidebar-item is-active'
                : 'sidebar-item'
            }
            onClick={() => setQuickFilter('toRead')}
            type="button"
          >
            待读
          </button>
          <button
            className={
              quickFilter === 'all' ? 'sidebar-item is-active' : 'sidebar-item'
            }
            onClick={() => setQuickFilter('all')}
            type="button"
          >
            清除筛选
          </button>
        </section>
      </aside>

      <section className="library-main">
        <div className="library-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="搜索文献"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、作者、标签、备注、DOI"
              type="search"
              value={query}
            />
          </label>
          <div
            aria-label="文献操作"
            className="toolbar-actions"
            role="toolbar"
          >
            <button
              className="icon-button"
              disabled={!selectedDocumentId}
              onClick={onExportSelection}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              导出选中
            </button>
            <button
              className="icon-button"
              disabled={!categoryId}
              onClick={() => onExportCategory(categoryId ?? null)}
              type="button"
            >
              <Archive aria-hidden="true" size={16} />
              导出当前分类
            </button>
            <button className="icon-button" onClick={onExportAll} type="button">
              <FileArchive aria-hidden="true" size={16} />
              导出全部
            </button>
            <button className="primary-button" onClick={onImport} type="button">
              <FileInput aria-hidden="true" size={16} />
              导入文献
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="document-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>作者</th>
                <th>年份</th>
                <th>分类</th>
                <th>重要</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr
                  className={
                    document.id === selectedDocumentId ? 'is-selected' : ''
                  }
                  key={document.id}
                  onClick={() => onSelectDocument(document.id)}
                >
                  <td>
                    <button
                      className="row-title"
                      onClick={() => onSelectDocument(document.id)}
                      type="button"
                    >
                      {document.title}
                    </button>
                  </td>
                  <td>{document.authors || '未填写'}</td>
                  <td>{document.year ?? '未知'}</td>
                  <td>{document.categoryName ?? '未分类'}</td>
                  <td>{document.importance}</td>
                  <td>{readingStatusLabels[document.readingStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="detail-panel">
        {selectedDocument ? (
          <>
            <div className="detail-heading">
              <h2>文献详情</h2>
              <span>{selectedDocument.fileType.toUpperCase()}</span>
            </div>
            <label>
              标题
              <input
                defaultValue={selectedDocument.title}
                key={`${selectedDocument.id}-title`}
                onBlur={(event) =>
                  updateSelectedDocument({ title: event.target.value })
                }
                type="text"
              />
            </label>
            <label>
              作者
              <input
                defaultValue={selectedDocument.authors}
                key={`${selectedDocument.id}-authors`}
                onBlur={(event) =>
                  updateSelectedDocument({ authors: event.target.value })
                }
                type="text"
              />
            </label>
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
              备注
              <textarea
                defaultValue={selectedDocument.note}
                key={`${selectedDocument.id}-note`}
                onBlur={(event) =>
                  updateSelectedDocument({ note: event.target.value })
                }
                rows={6}
              />
            </label>
            <button
              className="primary-button full-width"
              onClick={() => onOpenReader(selectedDocument.id)}
              type="button"
            >
              打开阅读模式
            </button>
          </>
        ) : (
          <div className="empty-detail">
            <h2>未选择文献</h2>
            <p>从左侧表格选择一篇文献后，可编辑标题、作者、标签和备注。</p>
          </div>
        )}
      </aside>
    </section>
  )
}
