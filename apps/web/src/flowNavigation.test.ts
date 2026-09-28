import { describe, expect, it } from 'vitest';
import type { Tag, Todo } from './types';
import { getAncestorIds, indexFlowTodos, searchFlowTodos } from './flowNavigation';

const todos: Todo[] = [
  {
    id: 'root-1', title: '准备发布', note: '', dueDate: '', importance: 0, urgency: 0,
    tagIds: [], completed: false,
    children: [
      {
        id: 'parent', title: '报告', note: '季度总结', dueDate: '', importance: 0, urgency: 0,
        tagIds: ['work'], completed: false,
        children: [
          {
            id: 'leaf-open', title: '报告 REPORT', note: 'Finish the DRAFT today', dueDate: '',
            importance: 0, urgency: 0, tagIds: [], children: [], completed: false,
          },
          {
            id: 'leaf-done', title: '提交版本', note: '', dueDate: '', importance: 0,
            urgency: 0, tagIds: ['personal'], children: [], completed: true,
          },
        ],
      },
    ],
  },
  {
    id: 'root-2', title: '学中文', note: '阅读练习', dueDate: '', importance: 0, urgency: 0,
    tagIds: [], children: [
      {
        id: 'chinese-leaf', title: '完成阅读', note: '', dueDate: '', importance: 0,
        urgency: 0, tagIds: [], children: [], completed: false,
      },
    ], completed: false,
  },
];

const tags: Tag[] = [
  { id: 'work', title: '工作', color: '#123456' },
  { id: 'personal', title: 'Personal', color: '#654321' },
];

describe('indexFlowTodos', () => {
  it('indexes stable ID paths, parent links, original order, descendants and incomplete leaves', () => {
    const entries = indexFlowTodos(todos);

    expect(entries.map(({ id }) => id)).toEqual([
      'root-1', 'parent', 'leaf-open', 'leaf-done', 'root-2', 'chinese-leaf',
    ]);
    expect(entries.find(({ id }) => id === 'leaf-open')).toMatchObject({
      parentId: 'parent',
      path: [
        { id: 'root-1', title: '准备发布' },
        { id: 'parent', title: '报告' },
        { id: 'leaf-open', title: '报告 REPORT' },
      ],
      order: 2,
      descendantCount: 0,
      incompleteLeafCount: 1,
      isLeaf: true,
      completed: false,
    });
    expect(entries.find(({ id }) => id === 'root-1')).toMatchObject({
      parentId: null,
      descendantCount: 3,
      incompleteLeafCount: 1,
    });
    expect(entries.find(({ id }) => id === 'parent')).toMatchObject({
      descendantCount: 2,
      incompleteLeafCount: 1,
    });
  });

  it('returns ancestor IDs from the root toward the direct parent', () => {
    expect(getAncestorIds(indexFlowTodos(todos), 'leaf-open')).toEqual(['root-1', 'parent']);
    expect(getAncestorIds(indexFlowTodos(todos), 'root-1')).toEqual([]);
    expect(getAncestorIds(indexFlowTodos(todos), 'missing')).toEqual([]);
  });

  it('does not mutate the source tree', () => {
    const before = JSON.stringify(todos);
    indexFlowTodos(todos);
    expect(JSON.stringify(todos)).toBe(before);
  });
});

describe('searchFlowTodos', () => {
  const entries = indexFlowTodos(todos);

  it('ranks title prefixes before title substrings, then note and tag hits, keeping tree order per rank', () => {
    expect(searchFlowTodos(entries, tags, '报').map(({ id }) => id)).toEqual([
      'parent', 'leaf-open',
    ]);
    expect(searchFlowTodos(entries, tags, '季度').map(({ id }) => id)).toEqual(['parent']);
    expect(searchFlowTodos(entries, tags, '工作').map(({ id }) => id)).toEqual(['parent']);
  });

  it('matches English case-insensitively in titles, notes, and tag names, including completed leaves', () => {
    expect(searchFlowTodos(entries, tags, 'REPORT').map(({ id }) => id)).toEqual(['leaf-open']);
    expect(searchFlowTodos(entries, tags, 'draft').map(({ id }) => id)).toEqual(['leaf-open']);
    expect(searchFlowTodos(entries, tags, 'PERSONAL').map(({ id }) => id)).toEqual(['leaf-done']);
  });

  it('trims the query and returns no results for an empty query or no match', () => {
    expect(searchFlowTodos(entries, tags, '  中文  ').map(({ id }) => id)).toEqual(['root-2']);
    expect(searchFlowTodos(entries, tags, '   ')).toEqual([]);
    expect(searchFlowTodos(entries, tags, 'does-not-exist')).toEqual([]);
  });
});
