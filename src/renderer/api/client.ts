import type { LiteratureApi } from '../../main/preload'

declare global {
  interface Window {
    literature?: LiteratureApi
    libraryApi?: LiteratureApi
  }
}

const missingApiMessage = '文献管理器主进程 API 未加载，请重新打开软件'

const rejectMissingApi = () => Promise.reject(new Error(missingApiMessage))

const missingApi: LiteratureApi = {
  getSnapshot: rejectMissingApi,
  chooseImportFiles: rejectMissingApi,
  confirmImports: rejectMissingApi,
  upsertCategory: rejectMissingApi,
  updateDocument: rejectMissingApi,
  updateDocumentsCategory: rejectMissingApi,
  deleteDocuments: rejectMissingApi,
  getFileUrl: rejectMissingApi,
  getTextContent: rejectMissingApi,
  listPdfAnnotations: rejectMissingApi,
  createPdfAnnotation: rejectMissingApi,
  deletePdfAnnotation: rejectMissingApi,
  openExternal: rejectMissingApi,
  exportSelection: rejectMissingApi,
  exportCategory: rejectMissingApi,
  exportAll: rejectMissingApi,
  getSettings: rejectMissingApi,
  chooseLibraryRoot: rejectMissingApi,
  chooseDefaultExportDirectory: rejectMissingApi,
}

export const libraryApi = window.literature ?? window.libraryApi ?? missingApi
