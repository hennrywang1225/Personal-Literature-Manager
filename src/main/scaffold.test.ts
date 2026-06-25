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
    expect(packageJson.scripts['dist:win']).toContain(
      'ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/',
    )
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
    expect(builderConfig).toContain('electronDist: node_modules/electron/dist')
    expect(builderConfig).toContain('extraResources:')
    expect(builderConfig).toContain('node_modules/sql.js/dist/sql-wasm.wasm')
    expect(builderConfig).toContain('artifactName: "${productName}-${version}-${arch}-nsis.${ext}"')
    expect(builderConfig).toContain('signAndEditExecutable: false')
    expect(builderConfig).toContain('artifactName: "${productName}-${version}-portable.${ext}"')
    expect(nodeTsConfig.compilerOptions.esModuleInterop).toBe(true)
  })
})
