import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'

export interface PdfSignals {
  fileName: string
  embeddedTitle?: string | null
  embeddedAuthor?: string | null
  firstPageText?: string | null
}

export interface DerivedPdfMetadata {
  detectedTitle: string
  detectedAuthors: string
  detectedYear: number | null
  detectedDoi: string
  detectedVenue: string
  extractionStatus: 'detected' | 'fallback'
}

interface PdfJsMetadata {
  info?: {
    Title?: unknown
    Author?: unknown
  }
}

interface PdfJsTextItem {
  str?: unknown
}

function cleanWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function titleFromFileName(fileName: string): string {
  const extension = extname(fileName)
  const name = basename(fileName, extension)
  return cleanWhitespace(name.replace(/[_-]+/g, ' '))
}

function titleFromFirstPageText(text: string | null | undefined): string {
  const firstLine = (text ?? '')
    .split(/\r?\n/)
    .map((line) => cleanWhitespace(line))
    .find(
      (line) =>
        line.length >= 8 &&
        !/^doi\b/i.test(line) &&
        !/^abstract\b/i.test(line) &&
        !/^published\b/i.test(line),
    )

  if (!firstLine) {
    return ''
  }

  const sentence = firstLine.match(/^(.{8,160}?[.!?])(?:\s|$)/)?.[1] ?? firstLine
  return cleanWhitespace(sentence.slice(0, 160).replace(/[.!?]+$/g, ''))
}

function detectYear(text: string): number | null {
  const match = text.match(/\b(19\d{2}|20\d{2})\b/)
  return match ? Number(match[1]) : null
}

function detectDoi(text: string): string {
  const match = text.match(/\b10\.\d{4,9}\/[^\s"'<>]+/i)
  return match ? match[0].replace(/[.,;:)\]}]+$/g, '') : ''
}

export function deriveMetadataFromPdfSignals(
  signals: PdfSignals,
): DerivedPdfMetadata {
  const embeddedTitle = cleanWhitespace(signals.embeddedTitle)
  const firstPageTitle = titleFromFirstPageText(signals.firstPageText)
  const detectedTitle =
    embeddedTitle || firstPageTitle || titleFromFileName(signals.fileName)
  const detectedAuthors = cleanWhitespace(signals.embeddedAuthor)
  const firstPageText = cleanWhitespace(signals.firstPageText)
  const detectedYear = detectYear(firstPageText)
  const detectedDoi = detectDoi(firstPageText)
  const extractionStatus =
    embeddedTitle ||
    firstPageTitle ||
    detectedAuthors ||
    detectedYear ||
    detectedDoi
      ? 'detected'
      : 'fallback'

  return {
    detectedTitle,
    detectedAuthors,
    detectedYear,
    detectedDoi,
    detectedVenue: '',
    extractionStatus,
  }
}

export async function extractPdfMetadata(
  sourcePath: string,
  fileName: string,
): Promise<DerivedPdfMetadata> {
  let document:
    | {
        getMetadata(): Promise<PdfJsMetadata>
        getPage(pageNumber: number): Promise<{
          getTextContent(): Promise<{ items: PdfJsTextItem[] }>
        }>
        destroy(): Promise<void> | void
      }
    | undefined

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = new Uint8Array(await readFile(sourcePath))
    const loadingTask = pdfjs.getDocument({ data, useWorkerFetch: false })
    document = await loadingTask.promise
    const metadata = (await document.getMetadata()) as PdfJsMetadata
    const page = await document.getPage(1)
    const textContent = await page.getTextContent()
    const firstPageText = textContent.items
      .map((item: PdfJsTextItem) =>
        typeof item.str === 'string' ? item.str : '',
      )
      .join(' ')

    return deriveMetadataFromPdfSignals({
      fileName,
      embeddedTitle:
        typeof metadata.info?.Title === 'string'
          ? metadata.info.Title
          : undefined,
      embeddedAuthor:
        typeof metadata.info?.Author === 'string'
          ? metadata.info.Author
          : undefined,
      firstPageText,
    })
  } catch {
    return deriveMetadataFromPdfSignals({ fileName })
  } finally {
    await document?.destroy()
  }
}
