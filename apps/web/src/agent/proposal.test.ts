import { describe, expect, it } from 'vitest';
import type { AppData, Todo } from '../types';
import { createProposal, readSnapshot, revalidateProposal } from './proposal';

const todo = (id: string, title: string, children: Todo[] = []): Todo => ({
  id, title, note: '', dueDate: '', importance: 0, urgency: 0,
  tagIds: [], children, completed: false,
});
const baseData = (): AppData => ({
  formatVersion: 1,
  todos: [todo('parent', 'Parent', [todo('child', 'Child')])],
  tags: [{ id: 'tag', title: 'Work', color: '#112233' }],
});
const propose = (base: AppData, patch: unknown[], current = base) =>
  createProposal(base, current, 'base-1', 'base-1', patch as never);

describe('Agent JSON proposal', () => {
  it('returns an independent snapshot and opaque version', () => {
    const data = baseData();
    const snapshot = readSnapshot(data);
    expect(snapshot.baseVersion).toBeTruthy();
    expect(snapshot.data).toEqual(data);
    expect(snapshot.data).not.toBe(data);
    snapshot.data.todos[0].title = 'changed';
    expect(data.todos[0].title).toBe('Parent');
  });

  it('supports edits, insertion, movement and tags without mutating the original', () => {
    const base = baseData();
    const patch = [
      { op: 'replace', path: '/todos/0/title', value: 'Renamed' },
      { op: 'move', from: '/todos/0/children/0', path: '/todos/1' },
      { op: 'add', path: '/todos/-', value: todo('new', 'New') },
      { op: 'replace', path: '/tags/0/color', value: '#abcdef' },
    ];
    const result = propose(base, patch);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.next.todos.map((item) => item.id)).toEqual(['parent', 'child', 'new']);
    expect(result.proposal.next.todos[0].title).toBe('Renamed');
    expect(result.proposal.next.tags[0].color).toBe('#abcdef');
    expect(base.todos[0].children[0].id).toBe('child');
    expect(base.tags[0].color).toBe('#112233');
  });

  it.each([
    [{ op: 'replace', path: '', value: baseData() }],
    [{ op: 'replace', path: '/formatVersion', value: 2 }],
    [{ op: 'replace', path: '/todos', value: [] }],
    [{ op: 'replace', path: '/tags', value: [] }],
    [{ op: 'replace', path: '/todos/0/id', value: 'changed' }],
    [{ op: 'add', path: '/todos/0/unknown', value: 'x' }],
    [{ op: 'add', path: '/todos/0/__proto__/bad', value: true }],
    [{ op: 'move', from: '/todos/0/id', path: '/todos/0/title' }],
  ].map((patch) => ({ patch })))('rejects paths outside known mutable fields', ({ patch }) => {
    expect(propose(baseData(), patch).ok).toBe(false);
  });

  it.each([
    [{ op: 'add', path: '/todos/-', value: todo('child', 'Duplicate') }],
    [{ op: 'add', path: '/todos/-', value: { ...todo('new', 'New'), secret: 'x' } }],
    [{ op: 'replace', path: '/todos/0/dueDate', value: '2026-02-30' }],
    [{ op: 'replace', path: '/todos/0/importance', value: 101 }],
    [{ op: 'replace', path: '/todos/0/tagIds', value: ['missing'] }],
    [{ op: 'replace', path: '/todos/0/completed', value: true }],
    [{ op: 'replace', path: '/todos/0/title', value: '   ' }],
    [{ op: 'test', path: '/todos/0/title', value: 'wrong' }],
  ].map((patch) => ({ patch })))('rejects invalid resulting data or failed preconditions', ({ patch }) => {
    expect(propose(baseData(), patch).ok).toBe(false);
  });

  it('preserves extra imported fields on surviving nodes', () => {
    const base = baseData();
    (base.todos[0] as unknown as Record<string, unknown>).legacy = { stable: true };
    const result = propose(base, [{ op: 'replace', path: '/todos/0/title', value: 'Safe' }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.proposal.next.todos[0] as unknown as Record<string, unknown>).legacy).toEqual({ stable: true });
  });

  it('rejects stale snapshots at proposal and apply time', () => {
    const base = baseData();
    const current = structuredClone(base);
    current.todos[0].title = 'Manual edit';
    expect(propose(base, [{ op: 'replace', path: '/todos/0/title', value: 'Agent edit' }], current).ok).toBe(false);
    const result = propose(base, [{ op: 'replace', path: '/todos/0/title', value: 'Agent edit' }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(revalidateProposal(current, result.proposal).ok).toBe(false);
  });
});
