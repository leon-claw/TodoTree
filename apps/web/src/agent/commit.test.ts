import { describe, expect, it, vi } from 'vitest';
import type { AppData } from '../types';
import { createProposal } from './proposal';
import { commitAgentProposal, undoAgentCommit } from './commit';

const data = (): AppData => ({ formatVersion: 1, tags: [], todos: [{ id: 'a', title: 'Task', note: '', dueDate: '', importance: 0, urgency: 0, tagIds: [], children: [], completed: false }] });
function proposal() {
  const base = data();
  const result = createProposal(base, base, 'version', 'version', [{ op: 'replace', path: '/todos/0/title', value: 'Updated' }]);
  if (!result.ok) throw new Error(result.error);
  return result.proposal;
}

describe('Agent synchronous commit and undo', () => {
  it('rejects stale data before saving', () => {
    const save = vi.fn(() => null);
    const current = data(); current.todos[0].note = 'manual';
    const result = commitAgentProposal(current, proposal(), save);
    expect(result.ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
  it('does not change state when saving fails', () => {
    const current = data();
    const save = vi.fn(() => 'disk full');
    const result = commitAgentProposal(current, proposal(), save);
    expect(result).toEqual({ ok: false, error: 'disk full' });
    expect(current.todos[0].title).toBe('Task');
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('saves a proposal and undo exactly once each', () => {
    const save = vi.fn(() => null);
    const applied = commitAgentProposal(data(), proposal(), save);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.data.todos[0].title).toBe('Updated');
    expect(save).toHaveBeenCalledTimes(1);
    const undone = undoAgentCommit(applied.data, applied.receipt, save);
    expect(undone.ok).toBe(true);
    if (undone.ok) expect(undone.data).toEqual(data());
    expect(save).toHaveBeenCalledTimes(2);
  });
  it('refuses undo after another edit without saving', () => {
    const save = vi.fn(() => null);
    const applied = commitAgentProposal(data(), proposal(), save);
    if (!applied.ok) throw new Error(applied.error);
    const changed = structuredClone(applied.data); changed.todos[0].note = 'manual';
    const result = undoAgentCommit(changed, applied.receipt, save);
    expect(result.ok).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
