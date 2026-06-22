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
  exportSelection(ids: string[]): Promise<unknown>
  exportCategory(categoryId: string): Promise<unknown>
  exportAll(): Promise<unknown>
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
  exportSelection: (ids) => ipcRenderer.invoke('library:exportSelection', ids),
  exportCategory: (categoryId) =>
    ipcRenderer.invoke('library:exportCategory', categoryId),
  exportAll: () => ipcRenderer.invoke('library:exportAll'),
}

contextBridge.exposeInMainWorld('literature', literatureApi)
