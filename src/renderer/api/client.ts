import type {
  DocumentRecord,
  ImportCandidate,
  ImportConfirmation,
  LibrarySnapshot,
} from '@shared/types'

type UpdateDocumentPatch = Partial<
  Pick<
    DocumentRecord,
    | 'title'
    | 'authors'
    | 'year'
    | 'doi'
    | 'venue'
    | 'categoryId'
    | 'tags'
    | 'importance'
    | 'readingStatus'
    | 'note'
  >
>

export interface LiteratureApi {
  getSnapshot(): Promise<LibrarySnapshot>
  chooseImportFiles(): Promise<ImportCandidate[]>
  confirmImports(confirmations: ImportConfirmation[]): Promise<DocumentRecord[]>
  updateDocument(id: string, patch: UpdateDocumentPatch): Promise<DocumentRecord>
  getFileUrl(documentId: string): Promise<string>
  openExternal(documentId: string): Promise<string>
  exportSelection(ids: string[]): Promise<unknown>
  exportCategory(categoryId: string): Promise<unknown>
  exportAll(): Promise<unknown>
}

declare global {
  interface Window {
    literature: LiteratureApi
  }
}

export const libraryApi = window.literature
