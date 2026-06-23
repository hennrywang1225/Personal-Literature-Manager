import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./api/client', () => ({
  libraryApi: {
    getSnapshot: vi.fn(),
    chooseImportFiles: vi.fn(),
    updateDocument: vi.fn(),
    exportAll: vi.fn(),
  },
}))

describe('App', () => {
  it('renders the application shell title', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('个人文献管理器')
    expect(html).toContain('文献库')
  })
})
