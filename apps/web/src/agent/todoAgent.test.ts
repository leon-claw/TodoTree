import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { AgentToolResult } from '@earendil-works/pi-agent-core';
import type { AppData } from '../types';
import type { GraphApi } from './codeAgent';
import { createTodoAgent } from './todoAgent';
import type { TodoAgentDependencies } from './todoAgent';

afterEach(() => vi.unstubAllGlobals());

const model = { provider: 'openai', id: 'gpt-4o' } as Model<Api>;
const initial = (): AppData => ({ formatVersion: 1, tags: [], todos: [{
  id: 'old', title: 'Old', note: '', dueDate: '2026-09-28', importance: 0, urgency: 0,
  tagIds: [], children: [], completed: false,
}] });

function graphApi(overrides: Partial<GraphApi> = {}): GraphApi {
  return {
    status: async () => ({ available: true, builtAtCommit: 'abc123' }),
    query: async (question) => ({ result: `query:${question}` }),
    path: async (from, to) => ({ result: `path:${from}:${to}` }),
    explain: async (node) => ({ result: `explain:${node}` }),
    source: async (sourceFile, startLine) => ({ path: sourceFile, startLine, lines: ['line'] }),
    ...overrides,
  };
}

function setup(overrides: Partial<TodoAgentDependencies> = {}) {
  let data = initial();
  const onProposal = vi.fn();
  const agent = createTodoAgent({
    model,
    proxyBaseUrl: 'http://localhost:3001',
    getProfileId: () => 'profile-1',
    getData: () => data,
    onProposal,
    graphApi: graphApi(),
    now: () => new Date(2026, 8, 29, 12),
    ...overrides,
  });
  const call = async (name: string, params: unknown) => {
    const tool = agent.state.tools.find((item) => item.name === name);
    if (!tool) throw new Error(`Missing ${name}`);
    return tool.execute('call-id', params as never, new AbortController().signal);
  };
  return {
    agent,
    onProposal,
    call,
    setData: (next: AppData) => { data = next; },
  };
}

function textOf(result: AgentToolResult): string {
  const block = result.content[0];
  if (block.type !== 'text') throw new Error('Expected text result');
  return block.text;
}

describe('combined TodoTree Pi Agent', () => {
  it('exposes both task-data and read-only Graphify tools in one agent', () => {
    const { agent } = setup();
    expect(agent.state.tools.map((tool) => tool.name)).toEqual([
      'read_app_data',
      'propose_app_data_patch',
      'query_project_graph',
      'trace_project_graph',
      'explain_project_node',
      'read_indexed_source',
    ]);
  });

  it('reads complete AppData and builds a reviewable proposal without saving', async () => {
    const { agent, call, onProposal } = setup();
    const read = JSON.parse(textOf(await call('read_app_data', {})));
    const proposal = await call('propose_app_data_patch', {
      baseVersion: read.baseVersion,
      patch: [{ op: 'remove', path: '/todos/0' }],
    });

    expect(read.data).toEqual(initial());
    expect(read.localToday).toBe('2026-09-29');
    expect(textOf(proposal)).toContain('待审阅');
    expect(onProposal).toHaveBeenCalledOnce();
    expect(agent.state.tools).toHaveLength(6);
  });

  it('keeps Graphify tools on the supplied read-only API without reading or proposing AppData', async () => {
    const query = vi.fn(async (question: string) => ({ result: `evidence:${question}` }));
    const getData = vi.fn(initial);
    const onProposal = vi.fn();
    const { call } = setup({ graphApi: graphApi({ query }), getData, onProposal });

    expect(textOf(await call('query_project_graph', { question: 'storage' }))).toContain('evidence:storage');
    expect(query).toHaveBeenCalledWith('storage', expect.any(AbortSignal));
    expect(getData).not.toHaveBeenCalled();
    expect(onProposal).not.toHaveBeenCalled();
  });

  it('routes the conversation through Pi streamProxy with the selected profile ID', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: 'test stop' }), {
      status: 404, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { agent } = setup();
    await agent.prompt('Read my tasks');

    expect(fetchMock).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://localhost:3001/api/stream');
    expect(payload.options.metadata.todoTreeProfileId).toBe('profile-1');
  });

  it('keeps evidence requirements, boundaries, and untrusted-tool rules in one prompt', () => {
    const { agent } = setup();
    expect(agent.state.systemPrompt).toContain('过期任务');
    expect(agent.state.systemPrompt).toContain('待审阅');
    expect(agent.state.systemPrompt).toContain('Graphify');
    expect(agent.state.systemPrompt).toContain('INFERRED');
    expect(agent.state.systemPrompt).toContain('AMBIGUOUS');
    expect(agent.state.systemPrompt).toContain('行号');
    expect(agent.state.systemPrompt).toContain('不可信数据');
  });
});
