import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGraphTools, createGraphApi } from './codeAgent';
import type { GraphApi } from './codeAgent';

afterEach(() => vi.unstubAllGlobals());

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

function setup(api = graphApi()) {
  return createGraphTools({ graphApi: api });
}

describe('read-only Graphify tools', () => {
  it('exposes only the four read-only Graphify tools', () => {
    const tools = setup();
    expect(tools.map((tool) => tool.name)).toEqual([
      'query_project_graph', 'trace_project_graph', 'explain_project_node', 'read_indexed_source',
    ]);
    expect(tools.map((tool) => tool.name)).not.toContain('read_app_data');
    expect(tools.map((tool) => tool.name)).not.toContain('propose_app_data_patch');
  });

  it('calls only the supplied read-only Graphify API and retains graph evidence', async () => {
    const api = graphApi({
      query: vi.fn(async (question) => ({ result: `source:storage.ts:50 EXTRACTED ${question}` })),
      path: vi.fn(async (from, to) => ({ result: `path ${from} -> ${to}` })),
      explain: vi.fn(async (node) => ({ result: `node ${node} AMBIGUOUS` })),
      source: vi.fn(async (sourceFile, startLine) => ({ path: sourceFile, startLine, lines: ['line 50'] })),
    });
    const tools = setup(api);
    const run = async (name: string, params: unknown, signal = new AbortController().signal) => {
      const tool = tools.find((item) => item.name === name);
      if (!tool) throw new Error(`Missing ${name}`);
      return tool.execute('call', params as never, signal);
    };
    const signal = new AbortController().signal;
    expect((await run('query_project_graph', { question: 'AppData' }, signal)).content[0]).toMatchObject({ text: expect.stringContaining('source:storage.ts:50') });
    expect(api.query).toHaveBeenCalledWith('AppData', signal);
    expect((await run('trace_project_graph', { from: 'App', to: 'storage.ts' })).content[0]).toMatchObject({ text: expect.stringContaining('App -> storage.ts') });
    expect((await run('explain_project_node', { node: 'AppData' })).content[0]).toMatchObject({ text: expect.stringContaining('AMBIGUOUS') });
    expect((await run('read_indexed_source', { sourceFile: 'apps/web/src/storage.ts', startLine: 50 })).content[0]).toMatchObject({ text: expect.stringContaining('line 50') });
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
    const tools = setup(graphApi({ query: async () => { throw new Error('Graphify 不可用'); } }));
    const tool = tools.find((item) => item.name === 'query_project_graph');
    if (!tool) throw new Error('Query tool missing');
    await expect(tool.execute('call', { question: 'AppData' } as never, new AbortController().signal)).rejects.toThrow('Graphify 不可用');
  });
});
