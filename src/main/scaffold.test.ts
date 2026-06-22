import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')

describe('project scaffold', () => {
  it('uses the required Vitest test script', () => {
    const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts.test).toBe('vitest run')
  })

  it('sets the required BrowserWindow title', () => {
    const mainSource = readFileSync(resolve(projectRoot, 'src/main/main.ts'), 'utf8')

    expect(mainSource).toContain('title: \'Personal Literature Manager\'')
  })
})
