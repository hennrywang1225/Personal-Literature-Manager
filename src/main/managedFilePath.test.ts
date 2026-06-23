import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveManagedFilePath } from './managedFilePath'

describe('resolveManagedFilePath', () => {
  const libraryRoot = resolve('C:/Library')
  const filesDir = join(libraryRoot, 'files')

  it('resolves managed file paths inside the files directory', () => {
    expect(
      resolveManagedFilePath({
        documentId: 'doc-1',
        libraryRoot,
        filesDir,
        storedFilePath: 'files/doc-1.pdf',
      }),
    ).toBe(join(filesDir, 'doc-1.pdf'))
  })

  it('accepts platform separators for the files prefix', () => {
    expect(
      resolveManagedFilePath({
        documentId: 'doc-1',
        libraryRoot,
        filesDir,
        storedFilePath: join('files', 'doc-1.pdf'),
      }),
    ).toBe(join(filesDir, 'doc-1.pdf'))
  })

  it('rejects absolute stored file paths', () => {
    expect(() =>
      resolveManagedFilePath({
        documentId: 'doc-1',
        libraryRoot,
        filesDir,
        storedFilePath: join(filesDir, 'doc-1.pdf'),
      }),
    ).toThrow(/unsafe managed file path for document doc-1:/)
  })

  it('rejects traversal segments before resolving the path', () => {
    expect(() =>
      resolveManagedFilePath({
        documentId: 'doc-1',
        libraryRoot,
        filesDir,
        storedFilePath: '../secret.pdf',
      }),
    ).toThrow(/unsafe managed file path for document doc-1: \.\.\/secret\.pdf/)
  })

  it('rejects paths outside the files prefix', () => {
    expect(() =>
      resolveManagedFilePath({
        documentId: 'doc-1',
        libraryRoot,
        filesDir,
        storedFilePath: 'exports/doc-1.pdf',
      }),
    ).toThrow(/unsafe managed file path for document doc-1: exports\/doc-1\.pdf/)
  })

  it('rejects files-prefix paths that resolve outside filesDir', () => {
    expect(() =>
      resolveManagedFilePath({
        documentId: 'doc-1',
        libraryRoot,
        filesDir,
        storedFilePath: 'files/../exports/doc-1.pdf',
      }),
    ).toThrow(/unsafe managed file path for document doc-1: files\/\.\.\/exports\/doc-1\.pdf/)
  })
})
