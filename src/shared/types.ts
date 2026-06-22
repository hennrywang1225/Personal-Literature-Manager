export type FileType = 'pdf' | 'doc' | 'docx' | 'txt' | 'md'

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

export type ImportanceLevel = 1 | 2 | 3 | 4 | 5

export interface CategoryRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface TagRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface DocumentRecord {
  id: string
  title: string
  authors: string[]
  year: number | null
  doi: string | null
  venue: string | null
  fileType: FileType
  originalFileName: string
  storedFileName: string
  storedFilePath: string
  categoryId: string | null
  categoryName: string | null
  tags: string[]
  importance: ImportanceLevel
  readingStatus: ReadingStatus
  note: string | null
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
}

export interface DocumentFilters {
  query?: string
  categoryId?: string
  tag?: string
  fileType?: FileType
  status?: ReadingStatus
  minImportance?: ImportanceLevel
  sortBy: DocumentSortKey
  sortDirection: SortDirection
}

export interface ImportCandidate {
  id: string
  filePath: string
  originalFileName: string
  fileType: FileType
  title: string
  authors: string[]
  year: number | null
  doi: string | null
}

export interface ImportConfirmation {
  candidateId: string
  title: string
  authors: string[]
  year: number | null
  doi: string | null
  venue: string | null
  categoryId: string | null
  tags: string[]
  importance: ImportanceLevel
  readingStatus: ReadingStatus
  note: string | null
}

export interface LibrarySnapshot {
  documents: DocumentRecord[]
  categories: CategoryRecord[]
  tags: TagRecord[]
  exportedAt: string
}
