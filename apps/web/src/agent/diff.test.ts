import { describe, expect, it } from 'vitest';
import type { AppData, Todo } from '../types';
import { describeAppDataChange } from './diff';

const todo = (id: string, title: string, dueDate = '', children: Todo[] = [], completed = false): Todo => ({
  id, title, note: '', dueDate, importance: 0, urgency: 0, tagIds: [], children, completed,
});
const data = (todos: Todo[]): AppData => ({ formatVersion: 1, todos, tags: [{ id: 'work', title: 'Work', color: '#123456' }] });

describe('Agent semantic data changes', () => {
  it('reports a moved task without treating it or shifted siblings as additions or deletions', () => {
    const before = data([todo('parent', 'Parent', '', [todo('child', 'Child')]), todo('other', 'Other')]);
    const after = data([todo('parent', 'Parent'), todo('other', 'Other'), todo('child', 'Child')]);
    const result = describeAppDataChange(before, after, [{ op: 'move', from: '/todos/0/children/0', path: '/todos/2' }]);
    expect(result.todos.moved.map((item) => item.id)).toEqual(['child']);
    expect(result.todos.moved[0].beforePath).toEqual(['Parent', 'Child']);
    expect(result.todos.moved[0].afterPath).toEqual(['Child']);
    expect(result.todos.added).toEqual([]);
    expect(result.todos.deleted).toEqual([]);
  });

  it('shows old and new values of every changed field', () => {
    const before = data([todo('one', 'Old')]);
    const after = data([todo('one', 'New', '2026-10-01')]);
    const result = describeAppDataChange(before, after, [
      { op: 'replace', path: '/todos/0/title', value: 'New' },
      { op: 'replace', path: '/todos/0/dueDate', value: '2026-10-01' },
    ]);
    expect(result.todos.updated[0].fields).toEqual([
      { field: 'title', before: 'Old', after: 'New' },
      { field: 'dueDate', before: '', after: '2026-10-01' },
    ]);
    expect(result.todos.updated[0].id).toBe('one');
  });

  it('shows the whole removed subtree and distinguishes direct from cascading deletion', () => {
    const before = data([todo('parent', 'Parent', '', [todo('child', 'Child')])]);
    const after = data([]);
    const result = describeAppDataChange(before, after, [{ op: 'remove', path: '/todos/0' }]);
    expect(result.todos.deleted.map((item) => [item.id, item.deletion])).toEqual([
      ['parent', 'direct'], ['child', 'cascade'],
    ]);
    expect(result.todos.deleted[1].beforePath).toEqual(['Parent', 'Child']);
    expect(result.totals.directDeleted).toBe(1);
    expect(result.totals.cascadeDeleted).toBe(1);
  });

  it('keeps today, undated and completed tasks outside an overdue delete proposal', () => {
    const before = data([
      todo('parent', 'Past parent', '2026-09-28', [todo('child', 'Past child', '2026-09-27'), todo('undated', 'Undated')]),
      todo('today', 'Today', '2026-09-29'),
      todo('done', 'Done', '2026-09-28', [], true),
    ]);
    const after = data([todo('today', 'Today', '2026-09-29'), todo('done', 'Done', '2026-09-28', [], true)]);
    const result = describeAppDataChange(before, after, [
      { op: 'remove', path: '/todos/0/children/0' },
      { op: 'remove', path: '/todos/0' },
    ]);
    expect(result.todos.deleted.map((item) => [item.id, item.deletion])).toEqual([
      ['parent', 'direct'], ['child', 'direct'], ['undated', 'cascade'],
    ]);
    expect(result.totals.directDeleted).toBe(2);
    expect(result.totals.cascadeDeleted).toBe(1);
  });

  it('reports a same-parent reorder encoded as remove plus add', () => {
    const before = data([todo('a', 'A'), todo('b', 'B')]);
    const after = data([todo('b', 'B'), todo('a', 'A')]);
    const result = describeAppDataChange(before, after, [
      { op: 'remove', path: '/todos/0' },
      { op: 'add', path: '/todos/-', value: todo('a', 'A') },
    ]);
    expect(result.todos.moved.map((item) => item.id)).toEqual(['b', 'a']);
    expect(result.totals.moved).toBe(2);
  });

  it('shows all known values for newly added tasks and tags', () => {
    const before: AppData = { formatVersion: 1, todos: [], tags: [] };
    const addedTodo = { ...todo('new', 'New task', '2026-10-04'), note: 'Bring notes', importance: 3, urgency: 2, tagIds: ['work'], completed: true };
    const addedTag = { id: 'work', title: 'Work', color: '#123456' };
    const after: AppData = { formatVersion: 1, todos: [addedTodo], tags: [addedTag] };
    const result = describeAppDataChange(before, after, [
      { op: 'add', path: '/todos/-', value: addedTodo },
      { op: 'add', path: '/tags/-', value: addedTag },
    ]);
    expect(result.todos.added[0].fields).toEqual([
      { field: 'note', before: undefined, after: 'Bring notes' },
      { field: 'dueDate', before: undefined, after: '2026-10-04' },
      { field: 'importance', before: undefined, after: 3 },
      { field: 'urgency', before: undefined, after: 2 },
      { field: 'tagIds', before: undefined, after: ['work'] },
      { field: 'completed', before: undefined, after: true },
    ]);
    expect(result.tags.added[0].fields).toEqual([
      { field: 'color', before: undefined, after: '#123456' },
    ]);
  });

  it('refuses to describe a claimed result that does not match the Patch', () => {
    const before = data([todo('one', 'Old')]);
    const after = data([todo('one', 'Different')]);
    expect(() => describeAppDataChange(before, after, [{ op: 'replace', path: '/todos/0/title', value: 'New' }]))
      .toThrow(/不一致/);
  });
});
