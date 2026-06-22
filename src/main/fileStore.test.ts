import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createFileStore, detectFileType } from './fileStore'

const tempDirs: string[] = []

function makeTempDir() {
  const tempDir = mkdtempSync(join(tmpdir(), 'literature-manager-files-'))
  tempDirs.push(tempDir)
  return tempDir
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true })
  }
})

describe('detectFileType', () => {
  it('detects supported file types from extensions', () => {
    expect(detectFileType('paper.PDF')).toBe('pdf')
    expect(detectFileType('notes.markdown')).toBe('md')
    expect(detectFileType('draft.docx')).toBe('docx')
  })

  it('rejects unsupported file extensions', () => {
    expect(() => detectFileType('slides.pptx')).toThrow(
      /Unsupported file type: slides\.pptx/,
    )
  })
})

describe('createFileStore', () => {
  it('copies files into the managed files directory and preserves bytes', async () => {
    const tempDir = makeTempDir()
    const sourcePath = join(tempDir, 'incoming', 'paper.PDF')
    const filesDir = join(tempDir, 'library', 'files')
    const sourceBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d])
    mkdirSync(join(tempDir, 'incoming'), { recursive: true })
    writeFileSync(sourcePath, sourceBytes, { flush: true })

    const result = await createFileStore({ filesDir }).copyIntoLibrary(
      sourcePath,
      'doc-123',
      'paper.PDF',
    )

    expect(result).toEqual({
      storedFileName: 'doc-123.pdf',
      relativePath: 'files/doc-123.pdf',
      absolutePath: normalize(join(filesDir, 'doc-123.pdf')),
    })
    expect(existsSync(result.absolutePath)).toBe(true)
    expect(readFileSync(result.absolutePath)).toEqual(sourceBytes)
  })

  it('preserves the normalized original extension when storing files', async () => {
    const tempDir = makeTempDir()
    const sourcePath = join(tempDir, 'incoming', 'notes.markdown')
    const filesDir = join(tempDir, 'library', 'files')
    mkdirSync(join(tempDir, 'incoming'), { recursive: true })
    writeFileSync(sourcePath, 'notes')

    const result = await createFileStore({ filesDir }).copyIntoLibrary(
      sourcePath,
      'doc-notes',
      'notes.markdown',
    )

    expect(result).toMatchObject({
      storedFileName: 'doc-notes.markdown',
      relativePath: 'files/doc-notes.markdown',
      absolutePath: normalize(join(filesDir, 'doc-notes.markdown')),
    })
  })

  it.each(['..\\outside', '../outside'])(
    'rejects unsafe document IDs and does not write outside filesDir: %s',
    async (documentId) => {
      const tempDir = makeTempDir()
      const sourcePath = join(tempDir, 'incoming', 'paper.pdf')
      const filesDir = join(tempDir, 'library', 'files')
      const outsidePath = join(tempDir, 'library', 'outside.pdf')
      mkdirSync(join(tempDir, 'incoming'), { recursive: true })
      writeFileSync(sourcePath, 'paper')

      await expect(
        createFileStore({ filesDir }).copyIntoLibrary(
          sourcePath,
          documentId,
          'paper.pdf',
        ),
      ).rejects.toThrow(/Invalid documentId/)

      expect(existsSync(outsidePath)).toBe(false)
    },
  )

  it('converts absolute paths to file URLs', () => {
    const absolutePath = normalize('C:/Library/files/doc-123.pdf')

    expect(
      createFileStore({ filesDir: 'C:/Library/files' }).toFileUrl(absolutePath),
    ).toBe(pathToFileURL(absolutePath).toString())
  })
})
