import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the scaffold placeholder text', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('个人文献管理器')
    expect(html).toContain('项目骨架已启动。')
  })
})
