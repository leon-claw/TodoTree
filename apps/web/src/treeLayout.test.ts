import { describe, expect, it, vi } from 'vitest';
import { buildTreeFlowElements } from './treeLayout';
import type { Todo } from './types';

const todos: Todo[] = [{
  id: 'root', title: '项目', note: '', dueDate: '', importance: 0, urgency: 0,
  tagIds: [], completed: false, children: [
    {
      id: 'branch', title: '阶段', note: '', dueDate: '', importance: 0, urgency: 0,
      tagIds: [], completed: false, children: [
        { id: 'open-leaf', title: '进行中', note: '', dueDate: '', importance: 0, urgency: 0, tagIds: [], completed: false, children: [] },
        { id: 'done-leaf', title: '已完成', note: '', dueDate: '', importance: 0, urgency: 0, tagIds: [], completed: true, children: [] },
      ],
    },
    { id: 'sibling', title: '其他', note: '', dueDate: '', importance: 0, urgency: 0, tagIds: [], completed: false, children: [] },
  ],
}];

const onSelect = vi.fn();
const onRequestAdd = vi.fn();
const onRequestDelete = vi.fn();

describe('buildTreeFlowElements with collapsed branches', () => {
  it('hides folded descendants and their edges while preserving real parent data and counts', () => {
    const onToggleCollapse = vi.fn();
    const { nodes, edges } = buildTreeFlowElements(
      todos, [], null, onSelect, onRequestAdd, onRequestDelete,
      null, new Set(['branch']), onToggleCollapse,
    );

    expect(nodes.map(({ id }) => id)).toEqual(['root', 'branch', 'sibling']);
    expect(edges.map(({ source, target }) => [source, target])).toEqual([
      ['root', 'branch'], ['root', 'sibling'],
    ]);
    const branch = nodes.find(({ id }) => id === 'branch');
    expect(branch?.data).toMatchObject({
      parentId: 'root',
      isCollapsed: true,
      descendantCount: 2,
      incompleteLeafCount: 1,
    });
    expect(branch?.data.todo.children.map(({ id }) => id)).toEqual(['open-leaf', 'done-leaf']);
    branch?.data.onToggleCollapse(branch.id);
    expect(onToggleCollapse).toHaveBeenCalledWith('branch');
  });
});
