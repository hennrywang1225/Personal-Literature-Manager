import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAppSettingsStore } from './appSettings'

const tempDirs: string[] = []

function makeSettingsPath() {
  const root = mkdtempSync(join(tmpdir(), 'literature-manager-settings-'))
  tempDirs.push(root)
  return join(root, 'settings.json')
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true })
  }
})

describe('createAppSettingsStore', () => {
  it('returns normalized defaults when no settings file exists', () => {
    const store = createAppSettingsStore({
      settingsPath: makeSettingsPath(),
      defaultLibraryRoot: 'D:/Literature/Library',
      defaultExportDir: 'D:/Literature/Exports',
    })

    expect(store.get()).toEqual({
      libraryRoot: 'D:\\Literature\\Library',
      defaultExportDir: 'D:\\Literature\\Exports',
    })
  })

  it('persists user-selected library and export paths', () => {
    const settingsPath = makeSettingsPath()
    const store = createAppSettingsStore({
      settingsPath,
      defaultLibraryRoot: 'C:/Default/Library',
      defaultExportDir: 'C:/Default/Exports',
    })

    store.update({
      libraryRoot: 'D:/Papers',
      defaultExportDir: 'E:/Backups',
    })

    const reloaded = createAppSettingsStore({
      settingsPath,
      defaultLibraryRoot: 'C:/Default/Library',
      defaultExportDir: 'C:/Default/Exports',
    })

    expect(reloaded.get()).toEqual({
      libraryRoot: 'D:\\Papers',
      defaultExportDir: 'E:\\Backups',
    })
  })
})
