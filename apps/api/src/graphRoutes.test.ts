import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Fastify from 'fastify';
import { registerGraphRoutes } from './graphRoutes';
import { createApi } from './app';

let root: string;
let executable: string;
let capture: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'todotree-graph-routes-'));
  await mkdir(join(root, 'graphify-out'));
  await writeFile(join(root, 'graphify-out', 'graph.json'), JSON.stringify({ built_at_commit: 'feedbeef', nodes: [] }));
  executable = join(root, 'fake graphify');
  capture = join(root, 'args.json');
  await writeFile(executable, `#!/usr/bin/env node\nconst fs=require('node:fs'); fs.writeFileSync(process.env.GRAPHIFY_CAPTURE,JSON.stringify(process.argv.slice(2))); process.stdout.write('scoped result');\n`);
  await chmod(executable, 0o755);
});
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

function makeApp() {
  const app = Fastify();
  registerGraphRoutes(app, root, { executable, env: { GRAPHIFY_CAPTURE: capture } });
  return app;
}

describe('read-only Graphify routes', () => {
  it('reports graph readiness and serves bounded query/path/explain operations', async () => {
    const app = makeApp();
    try {
      expect((await app.inject({ url: '/api/graph/status' })).json()).toEqual({ available: true, builtAtCommit: 'feedbeef' });
      expect((await app.inject({ method: 'POST', url: '/api/graph/query', payload: { question: 'AppData' } })).json()).toEqual({ result: 'scoped result' });
      expect((await app.inject({ method: 'POST', url: '/api/graph/path', payload: { from: 'App', to: 'Storage' } })).json()).toEqual({ result: 'scoped result' });
      expect((await app.inject({ method: 'POST', url: '/api/graph/explain', payload: { node: 'AppData' } })).json()).toEqual({ result: 'scoped result' });
    } finally { await app.close(); }
  });


  it('keeps the model stream available while the Graphify graph is missing', async () => {
    const model = { provider: 'openai', id: 'test-model', api: 'openai-responses', baseUrl: 'https://api.openai.com/v1' };
    const fakeStream = (() => ({ async *[Symbol.asyncIterator]() { yield { type: 'start' }; } })) as never;
    const app = createApi({ model, apiKey: 'server-secret' } as never, fakeStream, undefined, root, { executable });
    await rm(join(root, 'graphify-out', 'graph.json'));
    try {
      const status = await app.inject({ url: '/api/graph/status' });
      const stream = await app.inject({ method: 'POST', url: '/api/stream', headers: { authorization: 'Bearer local' },
        payload: { model, context: { messages: [{ role: 'user', content: 'hello', timestamp: 1 }] } } });
      expect(status.json()).toMatchObject({ available: false });
      expect(stream.statusCode).toBe(200);
      expect(stream.headers['content-type']).toContain('text/event-stream');
    } finally { await app.close(); }
  });

  it('validates request payloads and reports missing Graphify without taking down the app', async () => {
    const app = makeApp();
    try {
      expect((await app.inject({ method: 'POST', url: '/api/graph/query', payload: { question: '' } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/api/graph/path', payload: { from: 'A' } })).statusCode).toBe(400);
      await rm(join(root, 'graphify-out', 'graph.json'));
      const status = await app.inject({ url: '/api/graph/status' });
      const query = await app.inject({ method: 'POST', url: '/api/graph/query', payload: { question: 'AppData' } });
      expect(status.json()).toMatchObject({ available: false, builtAtCommit: null });
      expect(query.statusCode).toBe(503);
      expect((await app.inject({ url: '/health' })).statusCode).toBe(404);
    } finally { await app.close(); }
  });
});
