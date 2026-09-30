import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { AppData } from '../types';
import { createTaskAgent } from './taskAgent';
import { createCodeAgent, createGraphApi } from './codeAgent';
import type { CodeAgentDependencies } from './codeAgent';

afterEach(() => vi.unstubAllGlobals());

const model = { provider: 'openai', id: 'gpt-4o' } as Model<Api>;
const data: AppData = { formatVersion: 1, tags: [], todos: [] };
function graphApi(overrides: Partial<CodeAgentDependencies['graphApi']> = {}): CodeAgentDependencies['graphApi'] {
  return {
    status: async () => ({ available: true, builtAtCommit: 'abc123' }),
    query: async (question) => ({ result: `query:${question}` }),
    path: async (from, to) => ({ result: `path:${from}:${to}` }),
    explain: async (node) => ({ result: `explain:${node}` }),
    source: async (sourceFile, startLine) => ({ path: sourceFile, startLine, lines: ['line'] }),
    ...overrides,
  };
}

function setup(api = graphApi()) {
  return createCodeAgent({ model, proxyUrl: 'http://localhost:3001/api/stream', graphApi: api });
}

describe('Pi code Q&A agent', () => {
  it('exposes only the four read-only Graphify tools', () => {
    const code = setup();
    const task = createTaskAgent({ model, proxyUrl: 'http://localhost:3001/api/stream', getData: () => data, onProposal: () => {} });
    expect(code.state.tools.map((tool) => tool.name)).toEqual([
      'query_project_graph', 'trace_project_graph', 'explain_project_node', 'read_indexed_source',
    ]);
    expect(code.state.tools.map((tool) => tool.name)).not.toContain('read_app_data');
    expect(code.state.tools.map((tool) => tool.name)).not.toContain('propose_app_data_patch');
    expect(task.state.tools.map((tool) => tool.name)).toEqual(['read_app_data', 'propose_app_data_patch']);
  });

  it('keeps the code and task transcript states separate', () => {
    const code = setup();
    const task = createTaskAgent({ model, proxyUrl: 'http://localhost:3001/api/stream', getData: () => data, onProposal: () => {} });
    task.state.messages = [...task.state.messages, { role: 'user', content: 'private task request', timestamp: 1 } as never];
    expect(task.state.messages.some((message) => 'content' in message && message.content === 'private task request')).toBe(true);
    expect(code.state.messages.some((message) => 'content' in message && message.content === 'private task request')).toBe(false);
  });

  it('calls only the supplied read-only Graphify API and retains graph evidence', async () => {
    const api = graphApi({
      query: vi.fn(async (question) => ({ result: `source:storage.ts:50 EXTRACTED ${question}` })),
      path: vi.fn(async (from, to) => ({ result: `path ${from} -> ${to}` })),
      explain: vi.fn(async (node) => ({ result: `node ${node} AMBIGUOUS` })),
      source: vi.fn(async (sourceFile, startLine) => ({ path: sourceFile, startLine, lines: ['line 50'] })),
    });
    const agent = setup(api);
    const run = async (name: string, params: unknown, signal = new AbortController().signal) => {
      const tool = agent.state.tools.find((item) => item.name === name);
      if (!tool) throw new Error(`Missing ${name}`);
      return tool.execute('call', params as never, signal);
    };
    const signal = new AbortController().signal;
    expect((await run('query_project_graph', { question: 'AppData' }, signal)).content[0]).toMatchObject({ text: expect.stringContaining('source:storage.ts:50') });
    expect(api.query).toHaveBeenCalledWith('AppData', signal);
    expect((await run('trace_project_graph', { from: 'App', to: 'storage.ts' })).content[0]).toMatchObject({ text: expect.stringContaining('App -> storage.ts') });
    expect((await run('explain_project_node', { node: 'AppData' })).content[0]).toMatchObject({ text: expect.stringContaining('AMBIGUOUS') });
    expect((await run('read_indexed_source', { sourceFile: 'apps/web/src/storage.ts', startLine: 50 })).content[0]).toMatchObject({ text: expect.stringContaining('line 50') });
    expect(agent.state.systemPrompt).toContain('INFERRED');
    expect(agent.state.systemPrompt).toContain('AMBIGUOUS');
    expect(agent.state.systemPrompt).toMatch(/文件.{0,12}行号|行号/);
  });

  it('maps read-only Graphify calls to same-origin API routes and forwards cancellation', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => new Response(
      JSON.stringify(String(input).endsWith('/api/graph/status') ? { available: true, builtAtCommit: 'abc123' } : { result: 'graph result' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const api = createGraphApi('http://localhost:3001');
    const controller = new AbortController();
    expect(await api.status()).toEqual({ available: true, builtAtCommit: 'abc123' });
    expect(await api.query('AppData', controller.signal)).toEqual({ result: 'graph result' });
    expect(await api.path('App', 'storage')).toEqual({ result: 'graph result' });
    expect(await api.explain('AppData')).toEqual({ result: 'graph result' });
    expect(await api.source('apps/web/src/storage.ts', 50)).toEqual({ result: 'graph result' });
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'http://localhost:3001/api/graph/status', 'http://localhost:3001/api/graph/query',
      'http://localhost:3001/api/graph/path', 'http://localhost:3001/api/graph/explain',
      'http://localhost:3001/api/graph/source',
    ]);
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ from: 'App', to: 'storage' }));
  });

  it('returns API error messages to the code tools', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Graphify CLI 不可用' }), { status: 503 })));
    await expect(createGraphApi().query('AppData')).rejects.toThrow('Graphify CLI 不可用');
  });

  it('surfaces graph failures as tool errors', async () => {
    const agent = setup(graphApi({ query: async () => { throw new Error('Graphify 不可用'); } }));
    const tool = agent.state.tools.find((item) => item.name === 'query_project_graph');
    if (!tool) throw new Error('Query tool missing');
    await expect(tool.execute('call', { question: 'AppData' } as never, new AbortController().signal)).rejects.toThrow('Graphify 不可用');
  });
});
