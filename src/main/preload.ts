import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  CategoryRecord,
  CreatePdfAnnotationInput,
  DocumentRecord,
  ImportCandidate,
  ImportConfirmation,
  LibrarySnapshot,
  PdfAnnotationRecord,
} from '../shared/types'

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
  upsertCategory(
    name: string,
    parentId?: string | null,
  ): Promise<CategoryRecord>
  updateDocument(id: string, patch: UpdateDocumentPatch): Promise<DocumentRecord>
  updateDocumentsCategory(
    ids: string[],
    categoryId: string | null,
  ): Promise<DocumentRecord[]>
  deleteDocuments(ids: string[]): Promise<DocumentRecord[]>
  getFileUrl(documentId: string): Promise<string>
  getTextContent(documentId: string): Promise<string>
  listPdfAnnotations(documentId: string): Promise<PdfAnnotationRecord[]>
  createPdfAnnotation(
    input: CreatePdfAnnotationInput,
  ): Promise<PdfAnnotationRecord>
  deletePdfAnnotation(annotationId: string): Promise<PdfAnnotationRecord>
  openExternal(documentId: string): Promise<string>
  exportSelection(documentIds: string[]): Promise<string | null>
  exportCategory(categoryId: string | null): Promise<string | null>
  exportAll(): Promise<string | null>
  getSettings(): Promise<AppSettings>
  chooseLibraryRoot(): Promise<AppSettings>
  chooseDefaultExportDirectory(): Promise<AppSettings>
}

const literatureApi: LiteratureApi = {
  getSnapshot: () => ipcRenderer.invoke('library:getSnapshot'),
  chooseImportFiles: () => ipcRenderer.invoke('library:chooseImportFiles'),
  confirmImports: (confirmations) =>
    ipcRenderer.invoke('library:confirmImports', confirmations),
  upsertCategory: (name, parentId = null) =>
    ipcRenderer.invoke('library:upsertCategory', {
      name,
      parentId,
    }) as Promise<CategoryRecord>,
  updateDocument: (id, patch) =>
    ipcRenderer.invoke('library:updateDocument', id, patch),
  updateDocumentsCategory: (ids, categoryId) =>
    ipcRenderer.invoke('library:updateDocumentsCategory', ids, categoryId),
  deleteDocuments: (ids) =>
    ipcRenderer.invoke('library:deleteDocuments', ids) as Promise<DocumentRecord[]>,
  getFileUrl: (documentId) => ipcRenderer.invoke('library:getFileUrl', documentId),
  getTextContent: (documentId) =>
    ipcRenderer.invoke('library:getTextContent', documentId),
  listPdfAnnotations: (documentId) =>
    ipcRenderer.invoke(
      'library:listPdfAnnotations',
      documentId,
    ) as Promise<PdfAnnotationRecord[]>,
  createPdfAnnotation: (input) =>
    ipcRenderer.invoke(
      'library:createPdfAnnotation',
      input,
    ) as Promise<PdfAnnotationRecord>,
  deletePdfAnnotation: (annotationId) =>
    ipcRenderer.invoke(
      'library:deletePdfAnnotation',
      annotationId,
    ) as Promise<PdfAnnotationRecord>,
  openExternal: (documentId) =>
    ipcRenderer.invoke('library:openExternal', documentId),
  exportSelection: (documentIds) =>
    ipcRenderer.invoke('library:exportSelection', documentIds) as Promise<string | null>,
  exportCategory: (categoryId) =>
    ipcRenderer.invoke('library:exportCategory', categoryId) as Promise<string | null>,
  exportAll: () => ipcRenderer.invoke('library:exportAll') as Promise<string | null>,
  getSettings: () => ipcRenderer.invoke('library:getSettings') as Promise<AppSettings>,
  chooseLibraryRoot: () =>
    ipcRenderer.invoke('library:chooseLibraryRoot') as Promise<AppSettings>,
  chooseDefaultExportDirectory: () =>
    ipcRenderer.invoke('library:chooseDefaultExportDirectory') as Promise<AppSettings>,
}

contextBridge.exposeInMainWorld('literature', literatureApi)
contextBridge.exposeInMainWorld('libraryApi', literatureApi)
