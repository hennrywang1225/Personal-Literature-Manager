import type { DocumentFilters, DocumentRecord, DocumentSortKey } from './types'

type FilterValue = string | number | null

const normalizeSearchValue = (value: FilterValue | string[]) => {
  if (Array.isArray(value)) {
    return value.join(' ')
  }

  return value === null ? '' : String(value)
}

const getSearchText = (document: DocumentRecord) =>
  [
    document.title,
    document.authors,
    document.year,
    document.doi,
    document.venue,
    document.categoryName,
    document.note,
    document.tags,
  ]
    .map(normalizeSearchValue)
    .join(' ')
    .toLowerCase()

const getSortValue = (
  document: DocumentRecord,
  sortBy: DocumentSortKey,
): FilterValue => document[sortBy]

const compareValues = (left: FilterValue, right: FilterValue) => {
  const normalizedLeft = normalizeSearchValue(left)
  const normalizedRight = normalizeSearchValue(right)

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return normalizedLeft.localeCompare(normalizedRight, undefined, {
    sensitivity: 'base',
    numeric: true,
  })
}

const compareByTitle = (left: DocumentRecord, right: DocumentRecord) =>
  left.title.localeCompare(right.title, undefined, {
    sensitivity: 'base',
    numeric: true,
  })

export const filterAndSortDocuments = (
  documents: DocumentRecord[],
  filters: DocumentFilters,
) => {
  const query = filters.query?.trim().toLowerCase()

  return documents
    .filter((document) => {
      if (query && !getSearchText(document).includes(query)) {
        return false
      }

      if (filters.categoryId && document.categoryId !== filters.categoryId) {
        return false
      }

      if (filters.tag && !document.tags.includes(filters.tag)) {
        return false
      }

      if (filters.fileType && document.fileType !== filters.fileType) {
        return false
      }

      if (filters.status && document.readingStatus !== filters.status) {
        return false
      }

      if (
        filters.minImportance !== undefined &&
        document.importance < filters.minImportance
      ) {
        return false
      }

      return true
    })
    .sort((left, right) => {
      const sortResult = compareValues(
        getSortValue(left, filters.sortBy),
        getSortValue(right, filters.sortBy),
      )
      const directedSortResult =
        filters.sortDirection === 'desc' ? -sortResult : sortResult

      return directedSortResult || compareByTitle(left, right)
    })
}
