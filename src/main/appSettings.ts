import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, normalize } from 'node:path'
import type { AppSettings } from '../shared/types'

interface StoredAppSettings {
  libraryRoot?: string
  defaultExportDir?: string | null
}

export interface CreateAppSettingsStoreOptions {
  settingsPath: string
  defaultLibraryRoot: string
  defaultExportDir: string
}

function normalizeNullablePath(path: string | null | undefined) {
  return path ? normalize(path) : null
}

function readSettingsFile(settingsPath: string): StoredAppSettings {
  if (!existsSync(settingsPath)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8')) as StoredAppSettings
  } catch {
    return {}
  }
}

export function createAppSettingsStore({
  settingsPath,
  defaultLibraryRoot,
  defaultExportDir,
}: CreateAppSettingsStoreOptions) {
  let settings = readSettingsFile(settingsPath)

  function get(): AppSettings {
    return {
      libraryRoot: normalize(settings.libraryRoot ?? defaultLibraryRoot),
      defaultExportDir: normalizeNullablePath(
        settings.defaultExportDir ?? defaultExportDir,
      ),
    }
  }

  function persist() {
    const current = get()
    mkdirSync(dirname(settingsPath), { recursive: true })
    writeFileSync(settingsPath, JSON.stringify(current, null, 2), 'utf8')
  }

  function update(patch: Partial<AppSettings>): AppSettings {
    settings = {
      ...settings,
      ...patch,
    }
    persist()
    return get()
  }

  return {
    get,
    update,
  }
}
