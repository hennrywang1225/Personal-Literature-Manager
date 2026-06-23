// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LibrarySnapshot } from '../shared/types'
import { App } from './App'

const snapshot: LibrarySnapshot = {
  documents: [],
  categories: [],
  tags: [],
}

const apiMocks = vi.hoisted(() => ({
  getSnapshot: vi.fn<() => Promise<LibrarySnapshot>>(),
  chooseImportFiles: vi.fn<() => Promise<unknown[]>>(),
  updateDocument: vi.fn(),
  exportAll: vi.fn(),
}))

vi.mock('./api/client', () => ({
  libraryApi: {
    getSnapshot: apiMocks.getSnapshot,
    chooseImportFiles: apiMocks.chooseImportFiles,
    updateDocument: apiMocks.updateDocument,
    exportAll: apiMocks.exportAll,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('renders the application shell title', async () => {
    apiMocks.getSnapshot.mockResolvedValue(snapshot)

    render(<App />)

    expect(screen.getByRole('heading', { name: '个人文献管理器' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '文献库' })).toBeInTheDocument()
  })

  it('keeps import as a placeholder until confirmation UI exists', async () => {
    apiMocks.getSnapshot.mockResolvedValue(snapshot)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '导入文献' }))

    await waitFor(() => {
      expect(screen.getByText('导入确认窗口将在下一步实现。')).toBeInTheDocument()
    })
    expect(apiMocks.chooseImportFiles).not.toHaveBeenCalled()
    expect(apiMocks.getSnapshot).toHaveBeenCalledTimes(1)
  })
})
