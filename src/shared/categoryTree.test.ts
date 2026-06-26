import { describe, expect, it } from 'vitest'
import type { CategoryRecord } from './types'
import {
  buildCategoryTree,
  flattenCategoryTree,
  getCategoryAndDescendantIds,
} from './categoryTree'

const categories: CategoryRecord[] = [
  {
    id: 'cat-project',
    name: '毕设',
    parentId: null,
    sortOrder: 1,
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z',
  },
  {
    id: 'cat-control',
    name: '四旋翼控制',
    parentId: 'cat-project',
    sortOrder: 1,
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z',
  },
  {
    id: 'cat-observer',
    name: '降阶观测器',
    parentId: 'cat-project',
    sortOrder: 0,
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-06-25T00:00:00.000Z',
  },
]

describe('categoryTree helpers', () => {
  it('builds nested category nodes ordered by sort order and name', () => {
    expect(buildCategoryTree(categories)).toMatchObject([
      {
        category: { id: 'cat-project', name: '毕设' },
        depth: 0,
        children: [
          {
            category: { id: 'cat-observer', name: '降阶观测器' },
            depth: 1,
          },
          {
            category: { id: 'cat-control', name: '四旋翼控制' },
            depth: 1,
          },
        ],
      },
    ])
  })

  it('flattens the tree with readable paths for selects and menus', () => {
    expect(flattenCategoryTree(categories).map((node) => node.path)).toEqual([
      '毕设',
      '毕设 / 降阶观测器',
      '毕设 / 四旋翼控制',
    ])
  })

  it('returns a category and all descendant ids exactly once', () => {
    expect(getCategoryAndDescendantIds(categories, 'cat-project')).toEqual([
      'cat-project',
      'cat-observer',
      'cat-control',
    ])
    expect(getCategoryAndDescendantIds(categories, 'cat-control')).toEqual([
      'cat-control',
    ])
  })
})
