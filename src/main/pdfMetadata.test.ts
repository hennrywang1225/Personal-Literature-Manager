import { describe, expect, it } from 'vitest'
import { deriveMetadataFromPdfSignals } from './pdfMetadata'

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
})
