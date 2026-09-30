import { describe, expect, it } from 'vitest';
import type { AppData } from '../types';
import type { AgentToolResult } from '@earendil-works/pi-agent-core';
import type { TaskAgentDependencies } from './taskAgent';
import { createTaskAgent } from './taskAgent';

const initial = (): AppData => ({ formatVersion: 1, tags: [], todos: [{
  id: 'old', title: 'Old', note: '', dueDate: '2026-09-28', importance: 0, urgency: 0,
  tagIds: [], children: [], completed: false,
}] });

function textOf(result: AgentToolResult): string {
  const block = result.content[0];
  if (block.type !== 'text') throw new Error('Expected text result');
  return block.text;
}

function setup(onProposal: TaskAgentDependencies['onProposal'] = () => {}) {
  let data = initial();
  const agent = createTaskAgent({
    model: { provider: 'openai', id: 'gpt-4o' } as never,
    proxyBaseUrl: 'http://127.0.0.1:3001',
    getData: () => data,
    onProposal,
    now: () => new Date(2026, 8, 29, 12),
  });
  const read = agent.state.tools.find((tool) => tool.name === 'read_app_data');
  const propose = agent.state.tools.find((tool) => tool.name === 'propose_app_data_patch');
  if (!read || !propose) throw new Error('Task tools missing');
  const call = async (tool: typeof read, params: unknown) => tool.execute('call-id', params as never, new AbortController().signal);
  return { agent, read: () => call(read, {}), propose: (params: unknown) => call(propose, params), setData: (next: AppData) => { data = next; } };
}

describe('Pi task tools', () => {
  it('loads the complete current JSON with a base version and local date', async () => {
    const tools = setup();
    const result = await tools.read();
    const payload = JSON.parse(textOf(result));
    expect(payload.data).toEqual(initial());
    expect(payload.baseVersion).toBeTruthy();
    expect(payload.localToday).toBe('2026-09-29');
    expect(tools.agent.state.tools.map((tool) => tool.name)).toEqual(['read_app_data', 'propose_app_data_patch']);
  });

  it('only produces a reviewable proposal and does not save or mutate AppData', async () => {
    const received: unknown[] = [];
    const tools = setup((proposal, summary) => { received.push({ proposal, summary }); });
    const read = JSON.parse(textOf(await tools.read()));
    const result = await tools.propose({ baseVersion: read.baseVersion, patch: [{ op: 'remove', path: '/todos/0' }] });
    expect(textOf(result)).toContain('待审阅');
    expect(received).toHaveLength(1);
    expect((received[0] as { summary: { totals: { deleted: number } } }).summary.totals.deleted).toBe(1);
    expect(read.data).toEqual(initial());
  });

  it('rejects invalid and stale proposals', async () => {
    const tools = setup();
    const read = JSON.parse(textOf(await tools.read()));
    await expect(tools.propose({ baseVersion: read.baseVersion, patch: [{ op: 'replace', path: '/formatVersion', value: 2 }] })).rejects.toThrow();
    const changed = initial();
    changed.todos[0].title = 'Manual edit';
    tools.setData(changed);
    await expect(tools.propose({ baseVersion: read.baseVersion, patch: [{ op: 'remove', path: '/todos/0' }] })).rejects.toThrow(/变化/);
  });

  it('refuses a second write while a proposal is pending', async () => {
    let pending = false;
    const tools = setup(() => {
      if (pending) throw new Error('请先处理待审阅提案');
      pending = true;
    });
    const read = JSON.parse(textOf(await tools.read()));
    const args = { baseVersion: read.baseVersion, patch: [{ op: 'remove', path: '/todos/0' }] };
    await tools.propose(args);
    await expect(tools.propose(args)).rejects.toThrow(/待审阅/);
  });
});
