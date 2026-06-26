import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileInput,
  FolderPlus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  buildCategoryTree,
  flattenCategoryTree,
  getCategoryAndDescendantIds,
  type CategoryTreeNode,
} from '../../shared/categoryTree'
import { filterAndSortDocuments } from '../../shared/documentFilters'
import type {
  CategoryRecord,
  DocumentRecord,
  LibrarySnapshot,
  ReadingStatus,
} from '../../shared/types'
import { Stars } from './Stars'
import { TagEditor } from './TagEditor'

type DocumentPatch = Partial<
  Pick<
    DocumentRecord,
    | 'title'
    | 'authors'
    | 'categoryId'
    | 'tags'
    | 'importance'
    | 'readingStatus'
    | 'note'
  >
>

interface LibraryViewProps {
  snapshot: LibrarySnapshot
  selectedDocumentId: string | null
  onSelectDocument: (documentId: string) => void
  onOpenReader: (documentId: string) => void
  onImport: (categoryId: string | null) => void
  onCreateCategory: (
    name: string,
    parentId: string | null,
  ) => CategoryRecord | Promise<CategoryRecord>
  onExportSelection: (documentIds: string[]) => void
  onExportCategory: (categoryId: string | null) => void
  onExportAll: () => void
  onDeleteDocuments: (documentIds: string[]) => void | Promise<void>
  onBulkUpdateCategory: (
    documentIds: string[],
    categoryId: string | null,
  ) => void | Promise<void>
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
  onCreateCategory,
  onExportSelection,
  onExportCategory,
  onExportAll,
  onDeleteDocuments,
  onBulkUpdateCategory,
  onUpdateDocument,
}: LibraryViewProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [newCategoryName, setNewCategoryName] = useState('')
  const [createCategoryParentId, setCreateCategoryParentId] = useState<
    string | null | undefined
  >()
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => new Set(snapshot.categories.map((category) => category.id)),
  )
  const [checkedDocumentIds, setCheckedDocumentIds] = useState<string[]>([])
  const [quickFilter, setQuickFilter] = useState<'all' | 'fiveStar' | 'toRead'>(
    'all',
  )
  const categoryTree = useMemo(
    () => buildCategoryTree(snapshot.categories),
    [snapshot.categories],
  )
  const flatCategoryNodes = useMemo(
    () => flattenCategoryTree(snapshot.categories),
    [snapshot.categories],
  )
  const selectedCategoryIds = useMemo(
    () =>
      categoryId
        ? getCategoryAndDescendantIds(snapshot.categories, categoryId)
        : [],
    [categoryId, snapshot.categories],
  )

  const documents = useMemo(
    () => {
      const filteredDocuments = filterAndSortDocuments(snapshot.documents, {
        query,
        minImportance: quickFilter === 'fiveStar' ? 5 : undefined,
        status: quickFilter === 'toRead' ? 'To Read' : undefined,
        sortBy: 'importance',
        sortDirection: 'desc',
      })

      if (!categoryId) {
        return filteredDocuments
      }

      const categoryIds = new Set(selectedCategoryIds)

      return filteredDocuments.filter(
        (document) =>
          document.categoryId !== null && categoryIds.has(document.categoryId),
      )
    },
    [
      categoryId,
      query,
      quickFilter,
      selectedCategoryIds,
      snapshot.documents,
    ],
  )

  const selectedDocument =
    snapshot.documents.find((document) => document.id === selectedDocumentId) ??
    null
  const visibleDocumentIds = documents.map((document) => document.id)
  const checkedVisibleDocumentIds = checkedDocumentIds.filter((id) =>
    visibleDocumentIds.includes(id),
  )
  const isAllVisibleChecked =
    documents.length > 0 && checkedVisibleDocumentIds.length === documents.length
  const selectedCategory = categoryId
    ? snapshot.categories.find((category) => category.id === categoryId) ?? null
    : null
  const createParentCategory = createCategoryParentId
    ? snapshot.categories.find(
        (category) => category.id === createCategoryParentId,
      ) ?? null
    : null

  useEffect(() => {
    setExpandedCategoryIds((currentIds) => {
      let hasNewCategory = false
      const nextIds = new Set(currentIds)

      for (const category of snapshot.categories) {
        if (!nextIds.has(category.id)) {
          hasNewCategory = true
          nextIds.add(category.id)
        }
      }

      return hasNewCategory ? nextIds : currentIds
    })
  }, [snapshot.categories])

  const countCategoryDocuments = (currentCategoryId: string) => {
    const categoryIds = new Set(
      getCategoryAndDescendantIds(snapshot.categories, currentCategoryId),
    )

    return snapshot.documents.filter(
      (document) =>
        document.categoryId !== null && categoryIds.has(document.categoryId),
    ).length
  }

  const updateSelectedDocument = (patch: DocumentPatch) => {
    if (selectedDocument) {
      void onUpdateDocument(selectedDocument.id, patch)
    }
  }

  const toggleCheckedDocument = (documentId: string) => {
    setCheckedDocumentIds((currentIds) =>
      currentIds.includes(documentId)
        ? currentIds.filter((id) => id !== documentId)
        : [...currentIds, documentId],
    )
  }

  const toggleAllVisibleDocuments = () => {
    setCheckedDocumentIds((currentIds) => {
      if (isAllVisibleChecked) {
        return currentIds.filter((id) => !visibleDocumentIds.includes(id))
      }

      return [...new Set([...currentIds, ...visibleDocumentIds])]
    })
  }

  const handleBulkMoveCategory = async (nextCategoryId: string) => {
    if (checkedVisibleDocumentIds.length === 0 || !nextCategoryId) {
      return
    }

    await onBulkUpdateCategory(
      checkedVisibleDocumentIds,
      nextCategoryId === '__uncategorized' ? null : nextCategoryId,
    )
    setCheckedDocumentIds([])
  }

  const handleDeleteCheckedDocuments = async () => {
    if (checkedVisibleDocumentIds.length === 0) {
      return
    }

    await onDeleteDocuments(checkedVisibleDocumentIds)
    setCheckedDocumentIds((currentIds) =>
      currentIds.filter((id) => !checkedVisibleDocumentIds.includes(id)),
    )
  }

  const handleExportAction = (action: string) => {
    if (action === 'category') {
      onExportCategory(categoryId ?? null)
    }

    if (action === 'all') {
      onExportAll()
    }
  }

  const beginCreateCategory = (parentId: string | null) => {
    setCreateCategoryParentId(parentId)
    setNewCategoryName('')
    setCategoryError(null)

    if (parentId) {
      setExpandedCategoryIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.add(parentId)
        return nextIds
      })
    }
  }

  const cancelCreateCategory = () => {
    setCreateCategoryParentId(undefined)
    setNewCategoryName('')
    setCategoryError(null)
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()

    if (!name) {
      setCategoryError('请输入分类名称')
      return
    }

    const parentId = createCategoryParentId ?? null

    try {
      setIsCreatingCategory(true)
      setCategoryError(null)
      const category = await onCreateCategory(name, parentId)

      setNewCategoryName('')
      setCreateCategoryParentId(undefined)
      setCategoryId(category.id)

      if (parentId) {
        setExpandedCategoryIds((currentIds) => {
          const nextIds = new Set(currentIds)
          nextIds.add(parentId)
          nextIds.add(category.id)
          return nextIds
        })
      }
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : '创建分类失败')
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const handleCreateCategoryKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleCreateCategory()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelCreateCategory()
    }
  }

  const toggleCategoryExpanded = (nextCategoryId: string) => {
    setExpandedCategoryIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(nextCategoryId)) {
        nextIds.delete(nextCategoryId)
      } else {
        nextIds.add(nextCategoryId)
      }

      return nextIds
    })
  }

  const renderCategoryNode = (node: CategoryTreeNode): JSX.Element => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedCategoryIds.has(node.category.id)
    const documentCount = countCategoryDocuments(node.category.id)

    return (
      <div className="category-tree-node" key={node.category.id}>
        <div
          className="category-tree-row"
          style={{ paddingLeft: 4 + node.depth * 14 }}
        >
          {hasChildren ? (
            <button
              aria-label={`${isExpanded ? '收起' : '展开'} ${node.category.name}`}
              className="category-toggle-button"
              onClick={() => toggleCategoryExpanded(node.category.id)}
              type="button"
            >
              {isExpanded ? (
                <ChevronDown aria-hidden="true" size={14} />
              ) : (
                <ChevronRight aria-hidden="true" size={14} />
              )}
            </button>
          ) : (
            <span className="category-toggle-spacer" />
          )}
          <button
            className={
              categoryId === node.category.id
                ? 'category-node-button is-active'
                : 'category-node-button'
            }
            onClick={() => setCategoryId(node.category.id)}
            title={node.path}
            type="button"
          >
            <span className="category-tree-name">{node.category.name}</span>
            <span className="category-count">{documentCount}</span>
          </button>
        </div>
        {hasChildren && isExpanded
          ? node.children.map((childNode) => renderCategoryNode(childNode))
          : null}
      </div>
    )
  }

  return (
    <section className="library-layout" aria-label="文献库">
      <aside className="library-sidebar">
        <section>
          <div className="sidebar-section-heading">
            <h2>分类</h2>
            {selectedCategory ? <span>{selectedCategory.name}</span> : null}
          </div>
          <div
            aria-label="分类操作"
            className="category-toolbar"
            role="toolbar"
          >
            <button
              aria-label="新建顶级分类"
              className="category-tool-button"
              onClick={() => beginCreateCategory(null)}
              title="新建顶级分类"
              type="button"
            >
              <FolderPlus aria-hidden="true" size={15} />
            </button>
            <button
              aria-label="在当前分类下新建子分类"
              className="category-tool-button"
              disabled={!selectedCategory}
              onClick={() => beginCreateCategory(selectedCategory?.id ?? null)}
              title={
                selectedCategory
                  ? `在 ${selectedCategory.name} 下新建子分类`
                  : '先选择一个分类'
              }
              type="button"
            >
              <ChevronRight aria-hidden="true" size={15} />
              <FolderPlus aria-hidden="true" size={15} />
            </button>
          </div>
          {createCategoryParentId !== undefined ? (
            <form
              className="category-inline-create"
              onSubmit={(event) => {
                event.preventDefault()
                void handleCreateCategory()
              }}
            >
              <label className="sr-only" htmlFor="new-category-name">
                分类名称
              </label>
              <input
                autoFocus
                id="new-category-name"
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={handleCreateCategoryKeyDown}
                placeholder={
                  createParentCategory
                    ? `在 ${createParentCategory.name} 下新建`
                    : '新建顶级分类'
                }
                type="text"
                value={newCategoryName}
              />
              <div className="category-inline-actions">
                <button
                  aria-label="保存分类"
                  className="category-inline-button is-primary"
                  disabled={isCreatingCategory}
                  title="保存分类"
                  type="submit"
                >
                  <Check aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label="取消新建分类"
                  className="category-inline-button"
                  onClick={cancelCreateCategory}
                  title="取消"
                  type="button"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </div>
            </form>
          ) : null}
          {categoryError ? <p className="field-error">{categoryError}</p> : null}
          <div className="category-tree" aria-label="分类树">
            <div className="category-tree-row">
              <span className="category-toggle-spacer" />
              <button
                className={
                  !categoryId
                    ? 'category-node-button is-active'
                    : 'category-node-button'
                }
                onClick={() => setCategoryId(undefined)}
                type="button"
              >
                <span className="category-tree-name">全部文献</span>
                <span className="category-count">{snapshot.documents.length}</span>
              </button>
            </div>
            {categoryTree.map((node) => renderCategoryNode(node))}
          </div>
        </section>
        <section className="quick-filter-section">
          <h2>快速筛选</h2>
          <div className="quick-filter-group">
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
          </div>
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
            <label className="export-menu-field">
              <span className="sr-only">导出操作</span>
              <select
                aria-label="导出操作"
                onChange={(event) => {
                  handleExportAction(event.target.value)
                  event.target.value = ''
                }}
                value=""
              >
                <option value="">导出</option>
                <option disabled={!categoryId} value="category">
                  导出当前分类
                </option>
                <option value="all">导出全部</option>
              </select>
            </label>
            <button
              className="primary-button"
              onClick={() => onImport(categoryId ?? null)}
              type="button"
            >
              <FileInput aria-hidden="true" size={16} />
              导入文献
            </button>
          </div>
        </div>

        {checkedVisibleDocumentIds.length > 0 ? (
          <div
            aria-label="批量操作"
            className="bulk-action-bar"
            role="toolbar"
          >
            <span className="bulk-selection-count">
              已选 {checkedVisibleDocumentIds.length} 篇
            </span>
            <button
              className="icon-button"
              onClick={() => onExportSelection(checkedVisibleDocumentIds)}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              导出选中
            </button>
            <button
              className="icon-button danger-button"
              onClick={() => void handleDeleteCheckedDocuments()}
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
              删除选中
            </button>
            <label className="bulk-move-field">
              <span className="sr-only">批量移动分类</span>
              <select
                aria-label="批量移动分类"
                onChange={(event) => {
                  void handleBulkMoveCategory(event.target.value)
                  event.target.value = ''
                }}
                value=""
              >
                <option value="">移动到分类</option>
                <option value="__uncategorized">未分类</option>
                {flatCategoryNodes.map((node) => (
                  <option key={node.category.id} value={node.category.id}>
                    {node.path}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              onClick={() => setCheckedDocumentIds([])}
              type="button"
            >
              <X aria-hidden="true" size={16} />
              清空选择
            </button>
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="document-table">
            <thead>
              <tr>
                <th className="selection-column">
                  <input
                    aria-label="选择当前列表全部文献"
                    checked={isAllVisibleChecked}
                    onChange={toggleAllVisibleDocuments}
                    type="checkbox"
                  />
                </th>
                <th>标题</th>
                <th>类型</th>
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
                  <td className="selection-column">
                    <input
                      aria-label={`选择 ${document.title}`}
                      checked={checkedDocumentIds.includes(document.id)}
                      onChange={() => toggleCheckedDocument(document.id)}
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                  </td>
                  <td>
                    <button
                      className="row-title"
                      onClick={() => onSelectDocument(document.id)}
                      type="button"
                    >
                      {document.title}
                    </button>
                  </td>
                  <td className="document-type-cell">
                    <span className="document-type-badge">
                      {document.fileType.toUpperCase()}
                    </span>
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
            <label>
              分类
              <select
                onChange={(event) =>
                  updateSelectedDocument({
                    categoryId: event.target.value || null,
                  })
                }
                value={selectedDocument.categoryId ?? ''}
              >
                <option value="">未分类</option>
                {flatCategoryNodes.map((node) => (
                  <option key={node.category.id} value={node.category.id}>
                    {node.path}
                  </option>
                ))}
              </select>
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
            <button
              className="danger-button full-width"
              onClick={() => void onDeleteDocuments([selectedDocument.id])}
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
              删除当前文献
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
