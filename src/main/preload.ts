import { contextBridge, ipcRenderer } from 'electron'
import type {
  DocumentRecord,
  ImportCandidate,
  ImportConfirmation,
  LibrarySnapshot,
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
  updateDocument(id: string, patch: UpdateDocumentPatch): Promise<DocumentRecord>
  getFileUrl(documentId: string): Promise<string>
  openExternal(documentId: string): Promise<string>
  exportSelection(documentIds: string[]): Promise<string>
  exportCategory(categoryId: string | null): Promise<string>
  exportAll(): Promise<string>
}

const literatureApi: LiteratureApi = {
  getSnapshot: () => ipcRenderer.invoke('library:getSnapshot'),
  chooseImportFiles: () => ipcRenderer.invoke('library:chooseImportFiles'),
  confirmImports: (confirmations) =>
    ipcRenderer.invoke('library:confirmImports', confirmations),
  updateDocument: (id, patch) =>
    ipcRenderer.invoke('library:updateDocument', id, patch),
  getFileUrl: (documentId) => ipcRenderer.invoke('library:getFileUrl', documentId),
  openExternal: (documentId) =>
    ipcRenderer.invoke('library:openExternal', documentId),
  exportSelection: (documentIds) =>
    ipcRenderer.invoke('library:exportSelection', documentIds) as Promise<string>,
  exportCategory: (categoryId) =>
    ipcRenderer.invoke('library:exportCategory', categoryId) as Promise<string>,
  exportAll: () => ipcRenderer.invoke('library:exportAll') as Promise<string>,
}

contextBridge.exposeInMainWorld('literature', literatureApi)
contextBridge.exposeInMainWorld('libraryApi', literatureApi)
