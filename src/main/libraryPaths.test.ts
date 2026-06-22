import { describe, expect, it } from 'vitest'
import { resolveLibraryRoot } from './libraryPaths'

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
