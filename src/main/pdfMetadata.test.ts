import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { deriveMetadataFromPdfSignals, extractPdfMetadata } from './pdfMetadata'

const getDocumentMock = vi.hoisted(() => vi.fn())

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: getDocumentMock,
}))

describe('deriveMetadataFromPdfSignals', () => {
  it('prefers embedded metadata and detects DOI/year from first-page text', () => {
    expect(
      deriveMetadataFromPdfSignals({
        fileName: 'fallback-title.pdf',
        embeddedTitle: '  Embedded   Paper   Title  ',
        embeddedAuthor: '  Alice Zhang ;   Bo Wang ',
        firstPageText:
          'Proceedings text. Published in 2024. DOI: 10.1145/1234567.890123.',
      }),
    ).toEqual({
      detectedTitle: 'Embedded Paper Title',
      detectedAuthors: 'Alice Zhang ; Bo Wang',
      detectedYear: 2024,
      detectedDoi: '10.1145/1234567.890123',
      detectedVenue: '',
      extractionStatus: 'detected',
    })
  })

  it('falls back to file name when no metadata is available', () => {
    expect(
      deriveMetadataFromPdfSignals({
        fileName: 'clinical_workflow-notes.pdf',
      }),
    ).toEqual({
      detectedTitle: 'clinical workflow notes',
      detectedAuthors: '',
      detectedYear: null,
      detectedDoi: '',
      detectedVenue: '',
      extractionStatus: 'fallback',
    })
  })

  it('uses a conservative first-page title before falling back to file name', () => {
    expect(
      deriveMetadataFromPdfSignals({
        fileName: 'fallback-title.pdf',
        embeddedTitle: '   ',
        firstPageText: `
          Graph Neural Networks for Clinical Triage

          Alice Zhang and Bo Wang
          Published in 2023
        `,
      }),
    ).toMatchObject({
      detectedTitle: 'Graph Neural Networks for Clinical Triage',
      detectedYear: 2023,
      extractionStatus: 'detected',
    })
  })

  it('prefers Chinese filename title and author over journal headers and CNKI metadata', () => {
    expect(
      deriveMetadataFromPdfSignals({
        fileName: '基于改进LESO的四旋翼无人机模糊线性自抗扰控制方法_李壮举.pdf',
        embeddedAuthor: 'CNKI',
        firstPageText: `
          第 9 期 2024 年 9 月电子学报 ACTA ELECTRONICA SINICA
          基于改进LESO的四旋翼无人机模糊线性自抗扰控制方法
          李壮举
        `,
      }),
    ).toMatchObject({
      detectedTitle: '基于改进LESO的四旋翼无人机模糊线性自抗扰控制方法',
      detectedAuthors: '李壮举',
      detectedYear: 2024,
      extractionStatus: 'detected',
    })
  })
})

describe('extractPdfMetadata', () => {
  it('returns filename fallback metadata when pdf.js extraction fails', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'literature-manager-pdf-'))
    const sourcePath = join(tempDir, 'broken.pdf')
    writeFileSync(sourcePath, '%PDF-broken')
    getDocumentMock.mockReturnValueOnce({
      promise: Promise.resolve({
        getMetadata: vi.fn().mockRejectedValue(new Error('metadata failed')),
        destroy: vi.fn(),
      }),
    })

    try {
      await expect(
        extractPdfMetadata(sourcePath, 'broken-paper.pdf'),
      ).resolves.toEqual({
        detectedTitle: 'broken paper',
        detectedAuthors: '',
        detectedYear: null,
        detectedDoi: '',
        detectedVenue: '',
        extractionStatus: 'fallback',
      })
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })
})
