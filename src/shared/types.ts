export type FileType = 'pdf' | 'doc' | 'docx' | 'txt' | 'md'

export type PdfAnnotationType = 'highlight' | 'underline'

export type ReadingStatus = 'To Read' | 'Reading' | 'Read' | 'Intensive'

export type SortDirection = 'asc' | 'desc'

export type DocumentSortKey =
  | 'title'
  | 'authors'
  | 'year'
  | 'importance'
  | 'readingStatus'
  | 'createdAt'
  | 'updatedAt'
  | 'lastOpenedAt'

export interface CategoryRecord {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TagRecord {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface DocumentRecord {
  id: string
  title: string
  authors: string
  year: number | null
  doi: string
  venue: string
  fileType: FileType
  originalFileName: string
  storedFileName: string
  storedFilePath: string
  categoryId: string | null
  categoryName: string | null
  tags: string[]
  importance: 1 | 2 | 3 | 4 | 5
  readingStatus: ReadingStatus
  note: string
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
}

export interface PdfAnnotationRect {
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
}

export interface PdfAnnotationRecord {
  id: string
  documentId: string
  pageNumber: number
  type: PdfAnnotationType
  color: string
  rects: PdfAnnotationRect[]
  createdAt: string
  updatedAt: string
}

export interface CreatePdfAnnotationInput {
  documentId: string
  pageNumber: number
  type: PdfAnnotationType
  color: string
  rects: PdfAnnotationRect[]
}

export interface DocumentFilters {
  query?: string
  categoryId?: string
  tag?: string
  fileType?: FileType
  status?: ReadingStatus
  minImportance?: 1 | 2 | 3 | 4 | 5
  sortBy: DocumentSortKey
  sortDirection: SortDirection
}

export interface ImportCandidate {
  sourcePath: string
  originalFileName: string
  fileType: FileType
  detectedTitle: string
  detectedAuthors: string
  detectedYear: number | null
  detectedDoi: string
  detectedVenue: string
  extractionStatus: 'detected' | 'fallback'
}

export interface ImportConfirmation {
  sourcePath: string
  title: string
  authors: string
  year: number | null
  doi: string
  venue: string
  categoryId: string | null
  tags: string[]
  importance: 1 | 2 | 3 | 4 | 5
  readingStatus: ReadingStatus
  note: string
}

export interface LibrarySnapshot {
  documents: DocumentRecord[]
  categories: CategoryRecord[]
  tags: TagRecord[]
}

export interface AppSettings {
  libraryRoot: string
  defaultExportDir: string | null
}
