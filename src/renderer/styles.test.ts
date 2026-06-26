import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(join(process.cwd(), 'src/renderer/styles.css'), 'utf8')

describe('renderer layout styles', () => {
  it('keeps reader side panels fixed while the reading pane scrolls internally', () => {
    expect(styles).toMatch(
      /\.reader-layout\s*{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s,
    )
    expect(styles).toMatch(/\.reader-list-panel\s*{[^}]*overflow:\s*hidden/s)
    expect(styles).toMatch(/\.reader-preview\s*{[^}]*overflow:\s*hidden/s)
    expect(styles).toMatch(
      /\.markdown-reader\s*{[^}]*height:\s*100%[^}]*overflow:\s*auto/s,
    )
  })

  it('centers category tools and keeps the selection column clean', () => {
    expect(styles).toMatch(/\.category-toolbar\s*{[^}]*justify-content:\s*center/s)
    expect(styles).toMatch(/\.selection-column\s*{[^}]*width:\s*52px/s)
    expect(styles).toMatch(/\.selection-column\s*{[^}]*font-size:\s*0/s)
    expect(styles).toMatch(/\.document-table th:nth-child\(2\)\s*{[^}]*padding-left:\s*18px/s)
  })
})
