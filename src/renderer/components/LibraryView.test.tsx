// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

describe('LibraryView', () => {
  it('opens the selected document in reader mode', () => {
    const onOpenReader = vi.fn()

    render(
      <LibraryView
        snapshot={snapshot}
        selectedDocumentId="doc-1"
        onSelectDocument={vi.fn()}
        onOpenReader={onOpenReader}
        onImport={vi.fn()}
        onExportAll={vi.fn()}
        onUpdateDocument={vi.fn()}
      />,
    )

    expect(screen.getByText('Attention Is All You Need')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开阅读模式' }))

    expect(onOpenReader).toHaveBeenCalledWith('doc-1')
  })
})
