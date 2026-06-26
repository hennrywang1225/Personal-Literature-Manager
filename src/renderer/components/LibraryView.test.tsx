// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LibrarySnapshot } from '../../shared/types'
import { LibraryView } from './LibraryView'

const snapshot: LibrarySnapshot = {
  categories: [
    {
      id: 'cat-1',
      name: '深度学习',
      parentId: null,
      sortOrder: 1,
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    },
  ],
  tags: [
    {
      id: 'tag-1',
      name: 'Transformer',
      color: '#2563eb',
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    },
  ],
  documents: [
    {
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
      importance: 5,
      readingStatus: 'To Read',
      note: '',
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
      lastOpenedAt: null,
    },
  ],
}

const hierarchicalSnapshot: LibrarySnapshot = {
  ...snapshot,
  categories: [
    {
      id: 'cat-project',
      name: '毕设',
      parentId: null,
      sortOrder: 1,
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    },
    {
      id: 'cat-control',
      name: '四旋翼控制',
      parentId: 'cat-project',
      sortOrder: 1,
      createdAt: '2026-06-22T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    },
  ],
  documents: [
    {
      ...snapshot.documents[0],
      id: 'doc-parent',
      title: '毕设总述',
      categoryId: 'cat-project',
      categoryName: '毕设',
    },
    {
      ...snapshot.documents[0],
      id: 'doc-child',
      title: '四旋翼控制论文',
      categoryId: 'cat-control',
      categoryName: '四旋翼控制',
    },
  ],
}

function renderLibraryView(overrides: Partial<Parameters<typeof LibraryView>[0]> = {}) {
  const props: Parameters<typeof LibraryView>[0] = {
    snapshot,
    selectedDocumentId: 'doc-1',
    onSelectDocument: vi.fn(),
    onOpenReader: vi.fn(),
    onImport: vi.fn(),
    onCreateCategory: vi.fn(),
    onExportSelection: vi.fn(),
    onExportCategory: vi.fn(),
    onExportAll: vi.fn(),
    onBulkUpdateCategory: vi.fn(),
    onDeleteDocuments: vi.fn(),
    onUpdateDocument: vi.fn(),
    ...overrides,
  }

  render(<LibraryView {...props} />)
  return props
}

afterEach(() => {
  cleanup()
})

describe('LibraryView', () => {
  it('keeps the normal toolbar focused on search, import, and export menu', () => {
    renderLibraryView()

    expect(screen.getByRole('toolbar', { name: '文献操作' })).toHaveClass(
      'toolbar-actions',
    )
    expect(screen.getByRole('searchbox', { name: '搜索文献' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导入文献' })).toBeInTheDocument()
    expect(screen.getByLabelText('导出操作')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导出选中' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('批量移动分类')).not.toBeInTheDocument()
  })

  it('shows bulk actions only after documents are checked', () => {
    renderLibraryView({ selectedDocumentId: null })

    expect(screen.queryByRole('button', { name: '导出选中' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除选中' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('选择 Attention Is All You Need'))

    expect(screen.getByText('已选 1 篇')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出选中' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除选中' })).toBeInTheDocument()
    expect(screen.getByLabelText('批量移动分类')).toBeInTheDocument()
  })

  it('exports the selected sidebar category from the export menu', () => {
    const onExportCategory = vi.fn()
    renderLibraryView({ onExportCategory })

    fireEvent.click(screen.getByRole('button', { name: '深度学习 1' }))
    fireEvent.change(screen.getByLabelText('导出操作'), {
      target: { value: 'category' },
    })

    expect(onExportCategory).toHaveBeenCalledWith('cat-1')
  })

  it('exports all documents from the export menu', () => {
    const onExportAll = vi.fn()
    renderLibraryView({ onExportAll })

    fireEvent.change(screen.getByLabelText('导出操作'), {
      target: { value: 'all' },
    })

    expect(onExportAll).toHaveBeenCalled()
  })

  it('opens the selected document in reader mode', () => {
    const onOpenReader = vi.fn()
    renderLibraryView({ onOpenReader })

    expect(screen.getByText('Attention Is All You Need')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开阅读模式' }))

    expect(onOpenReader).toHaveBeenCalledWith('doc-1')
  })

  it('creates a category from the sidebar', async () => {
    const onCreateCategory = vi.fn().mockResolvedValue({
      id: 'cat-2',
      name: '强化学习',
      parentId: null,
      sortOrder: 2,
      createdAt: '2026-06-25T00:00:00.000Z',
      updatedAt: '2026-06-25T00:00:00.000Z',
    })
    renderLibraryView({ onCreateCategory })

    expect(screen.queryByLabelText('分类名称')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '新建顶级分类' }))
    fireEvent.change(screen.getByLabelText('分类名称'), {
      target: { value: '  强化学习  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存分类' }))

    await waitFor(() => {
      expect(onCreateCategory).toHaveBeenCalledWith('强化学习', null)
    })
    expect(screen.queryByLabelText('分类名称')).not.toBeInTheDocument()
  })

  it('creates a child category under the selected category', async () => {
    const onCreateCategory = vi.fn().mockResolvedValue({
      id: 'cat-new',
      name: '降阶观测器',
      parentId: 'cat-project',
      sortOrder: 2,
      createdAt: '2026-06-25T00:00:00.000Z',
      updatedAt: '2026-06-25T00:00:00.000Z',
    })
    renderLibraryView({
      snapshot: hierarchicalSnapshot,
      selectedDocumentId: 'doc-parent',
      onCreateCategory,
    })

    fireEvent.click(screen.getByRole('button', { name: '毕设 2' }))
    fireEvent.click(screen.getByRole('button', { name: '在当前分类下新建子分类' }))
    fireEvent.change(screen.getByLabelText('分类名称'), {
      target: { value: '  降阶观测器  ' },
    })
    expect(screen.getByPlaceholderText('在 毕设 下新建')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByLabelText('分类名称'), {
      code: 'Enter',
      key: 'Enter',
    })

    await waitFor(() => {
      expect(onCreateCategory).toHaveBeenCalledWith('降阶观测器', 'cat-project')
    })
  })

  it('collapses and expands category tree branches', () => {
    renderLibraryView({
      snapshot: hierarchicalSnapshot,
      selectedDocumentId: 'doc-parent',
    })

    expect(screen.getByRole('button', { name: '四旋翼控制 1' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '收起 毕设' }))

    expect(
      screen.queryByRole('button', { name: '四旋翼控制 1' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '展开 毕设' }))

    expect(screen.getByRole('button', { name: '四旋翼控制 1' })).toBeInTheDocument()
  })

  it('shows the file type column before author without a decorative dot column', () => {
    renderLibraryView()

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent?.trim()),
    ).toEqual(['', '标题', '类型', '作者', '年份', '分类', '重要', '状态'])

    const row = screen.getByRole('row', { name: /Attention Is All You Need/ })

    expect(
      within(row).getAllByRole('cell').map((cell) => cell.textContent?.trim()),
    ).toEqual([
      '',
      'Attention Is All You Need',
      'PDF',
      'Ashish Vaswani et al.',
      '2017',
      '深度学习',
      '5',
      '待读',
    ])
    expect(within(row).queryByText('.')).not.toBeInTheDocument()
    expect(
      Array.from(
        screen
          .getByRole('table')
          .querySelectorAll('.document-table th, .document-table td'),
      )
        .map((cell) => cell.textContent?.trim())
        .filter((text) => text === '.'),
    ).toEqual([])
  })

  it('shows a parent category as a summary of its child categories without duplicates', () => {
    renderLibraryView({
      snapshot: hierarchicalSnapshot,
      selectedDocumentId: 'doc-parent',
    })

    expect(screen.getByRole('button', { name: '毕设 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '四旋翼控制 1' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '毕设 2' }))

    expect(screen.getByText('毕设总述')).toBeInTheDocument()
    expect(screen.getByText('四旋翼控制论文')).toBeInTheDocument()
    expect(screen.getAllByText('四旋翼控制论文')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '四旋翼控制 1' }))

    expect(screen.queryByText('毕设总述')).not.toBeInTheDocument()
    expect(screen.getByText('四旋翼控制论文')).toBeInTheDocument()
  })

  it('updates the selected document category from the detail panel', () => {
    const onUpdateDocument = vi.fn()
    renderLibraryView({
      snapshot: {
        ...snapshot,
        documents: [
          {
            ...snapshot.documents[0],
            categoryId: null,
            categoryName: null,
          },
        ],
      },
      onUpdateDocument,
    })

    fireEvent.change(screen.getByLabelText('分类'), {
      target: { value: 'cat-1' },
    })

    expect(onUpdateDocument).toHaveBeenCalledWith('doc-1', {
      categoryId: 'cat-1',
    })
  })

  it('exports checked documents from the bulk action bar', () => {
    const onExportSelection = vi.fn()
    renderLibraryView({ onExportSelection })

    fireEvent.click(screen.getByLabelText('选择 Attention Is All You Need'))
    fireEvent.click(screen.getByRole('button', { name: '导出选中' }))

    expect(onExportSelection).toHaveBeenCalledWith(['doc-1'])
  })

  it('deletes checked documents from the bulk action bar', async () => {
    const onDeleteDocuments = vi.fn().mockResolvedValue(undefined)
    renderLibraryView({ onDeleteDocuments })

    fireEvent.click(screen.getByLabelText('选择 Attention Is All You Need'))
    fireEvent.click(screen.getByRole('button', { name: '删除选中' }))

    await waitFor(() => {
      expect(onDeleteDocuments).toHaveBeenCalledWith(['doc-1'])
    })
  })

  it('deletes the selected document from the detail panel', async () => {
    const onDeleteDocuments = vi.fn().mockResolvedValue(undefined)
    renderLibraryView({ onDeleteDocuments })

    fireEvent.click(screen.getByRole('button', { name: '删除当前文献' }))

    await waitFor(() => {
      expect(onDeleteDocuments).toHaveBeenCalledWith(['doc-1'])
    })
  })

  it('bulk moves checked documents to a category', () => {
    const onBulkUpdateCategory = vi.fn()
    renderLibraryView({ onBulkUpdateCategory })

    fireEvent.click(screen.getByLabelText('选择 Attention Is All You Need'))
    fireEvent.change(screen.getByLabelText('批量移动分类'), {
      target: { value: 'cat-1' },
    })

    expect(onBulkUpdateCategory).toHaveBeenCalledWith(['doc-1'], 'cat-1')
  })

  it('imports directly into the selected sidebar category', () => {
    const onImport = vi.fn()
    renderLibraryView({ onImport })

    fireEvent.click(screen.getByRole('button', { name: '深度学习 1' }))
    fireEvent.click(screen.getByRole('button', { name: '导入文献' }))

    expect(onImport).toHaveBeenCalledWith('cat-1')
  })
})
