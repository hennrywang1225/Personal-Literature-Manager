import { describe, expect, it } from 'vitest'
import { buildLibraryPaths, resolveLibraryRoot } from './libraryPaths'

describe('resolveLibraryRoot', () => {
  it('uses AppData for installed builds', () => {
    expect(
      resolveLibraryRoot({
        isPackaged: true,
        appDataPath: 'C:/Users/A/AppData/Roaming',
        exeDir: 'C:/Program Files/App',
      }),
    ).toBe('C:\\Users\\A\\AppData\\Roaming\\Personal Literature Manager\\Library')
  })

  it('uses an exeDir sibling for portable and dev builds', () => {
    expect(
      resolveLibraryRoot({
        isPackaged: false,
        appDataPath: 'C:/Users/A/AppData/Roaming',
        exeDir: 'D:/Tools/LitManager',
      }),
    ).toBe('D:\\Tools\\LitManager\\LiteratureLibrary')
  })
})

describe('buildLibraryPaths', () => {
  it('returns database, files, and exports paths under the library root', () => {
    expect(buildLibraryPaths('D:/Tools/LitManager/LiteratureLibrary')).toEqual({
      root: 'D:\\Tools\\LitManager\\LiteratureLibrary',
      databasePath: 'D:\\Tools\\LitManager\\LiteratureLibrary\\library.db',
      filesDir: 'D:\\Tools\\LitManager\\LiteratureLibrary\\files',
      exportsDir: 'D:\\Tools\\LitManager\\LiteratureLibrary\\exports',
    })
  })
})
