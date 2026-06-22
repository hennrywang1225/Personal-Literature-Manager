import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../..')

describe('project scaffold', () => {
  it('uses the required package identity and Vitest test script', () => {
    const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as {
      name: string
      description: string
      scripts: Record<string, string>
    }

    expect(packageJson.name).toBe('personal-literature-manager')
    expect(packageJson.description).toBe('Personal Windows literature manager')
    expect(packageJson.scripts.test).toBe('vitest run')
  })

  it('sets the required BrowserWindow title', () => {
    const mainSource = readFileSync(resolve(projectRoot, 'src/main/main.ts'), 'utf8')

    expect(mainSource).toMatch(/title:\s*['"]Personal Literature Manager['"]/)
  })

  it('uses the required builder identity and node compiler option', () => {
    const builderConfig = readFileSync(resolve(projectRoot, 'electron-builder.yml'), 'utf8')
    const nodeTsConfig = JSON.parse(readFileSync(resolve(projectRoot, 'tsconfig.node.json'), 'utf8')) as {
      compilerOptions: Record<string, unknown>
    }

    expect(builderConfig).toContain('appId: com.local.personal-literature-manager')
    expect(builderConfig).toContain('productName: Personal Literature Manager')
    expect(nodeTsConfig.compilerOptions.esModuleInterop).toBe(true)
  })
})
