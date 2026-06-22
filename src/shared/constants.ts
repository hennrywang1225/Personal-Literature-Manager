import type { FileType, ReadingStatus } from './types'

export const SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
  '.markdown',
] as const

export const SUPPORTED_FILE_TYPES: FileType[] = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'md',
]

export const READING_STATUSES: ReadingStatus[] = [
  'To Read',
  'Reading',
  'Read',
  'Intensive',
]

export const DEFAULT_IMPORTANCE = 3 as const

export const MIN_IMPORTANCE = 1

export const MAX_IMPORTANCE = 5
