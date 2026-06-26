import type { CategoryRecord } from './types'

export interface CategoryTreeNode {
  category: CategoryRecord
  children: CategoryTreeNode[]
  depth: number
  path: string
}

function sortCategories(categories: CategoryRecord[]) {
  return [...categories].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  )
}

function buildChildren(
  parentId: string | null,
  categoriesByParent: Map<string | null, CategoryRecord[]>,
  depth: number,
  parentPath: string,
): CategoryTreeNode[] {
  return sortCategories(categoriesByParent.get(parentId) ?? []).map(
    (category) => {
      const path = parentPath ? `${parentPath} / ${category.name}` : category.name

      return {
        category,
        children: buildChildren(
          category.id,
          categoriesByParent,
          depth + 1,
          path,
        ),
        depth,
        path,
      }
    },
  )
}

export function buildCategoryTree(
  categories: CategoryRecord[],
): CategoryTreeNode[] {
  const categoryIds = new Set(categories.map((category) => category.id))
  const categoriesByParent = new Map<string | null, CategoryRecord[]>()

  for (const category of categories) {
    const parentId =
      category.parentId && categoryIds.has(category.parentId)
        ? category.parentId
        : null
    const siblings = categoriesByParent.get(parentId) ?? []

    siblings.push(category)
    categoriesByParent.set(parentId, siblings)
  }

  return buildChildren(null, categoriesByParent, 0, '')
}

function flattenNodes(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}

export function flattenCategoryTree(
  categories: CategoryRecord[],
): CategoryTreeNode[] {
  return flattenNodes(buildCategoryTree(categories))
}

export function getCategoryAndDescendantIds(
  categories: CategoryRecord[],
  categoryId: string,
): string[] {
  const node = flattenCategoryTree(categories).find(
    (item) => item.category.id === categoryId,
  )

  if (!node) {
    return []
  }

  return flattenNodes([node]).map((item) => item.category.id)
}
