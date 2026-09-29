import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from './app';

const model = { provider: 'openai', id: 'test-model', api: 'openai-responses', baseUrl: 'https://api.openai.com/v1' };
const config = { model, apiKey: 'server-secret' };
const context = { messages: [{ role: 'user', content: 'hello', timestamp: 1 }] };
const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

describe('agent model API', () => {
  it('serves the built web app and SPA routes from Fastify', async () => {
    const root = await mkdtemp(join(tmpdir(), 'todotree-web-'));
    await writeFile(join(root, 'index.html'), '<h1>TodoTree</h1>');
    const app = createApi(null, undefined, root);
    try {
      expect((await app.inject({ method: 'GET', url: '/' })).body).toContain('TodoTree');
      expect((await app.inject({ method: 'GET', url: '/graph/todo/task-1' })).body).toContain('TodoTree');
    } finally {
      await app.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports unconfigured status without exposing credentials', async () => {
    const app = createApi(null);
    const response = await app.inject({ method: 'GET', url: '/api/agent-config' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ available: false });
    await app.close();
  });

  it('returns only public model metadata', async () => {
    const app = createApi(config as never);
    const response = await app.inject({ method: 'GET', url: '/api/agent-config' });
    expect(response.json()).toEqual({ available: true, model });
    expect(response.body).not.toContain('server-secret');
    await app.close();
  });

  it('rejects a model or provider URL chosen by the browser', async () => {
    const app = createApi(config as never);
    const wrongModel = await app.inject({ method: 'POST', url: '/api/stream', headers: { authorization: 'Bearer local' },
      payload: { model: { ...model, id: 'other-model' }, context } });
    const customUrl = await app.inject({ method: 'POST', url: '/api/stream', headers: { authorization: 'Bearer local' },
      payload: { model: { ...model, baseUrl: 'https://evil.invalid/v1' }, context } });
    expect(wrongModel.statusCode).toBe(400);
    expect(customUrl.statusCode).toBe(400);
    await app.close();
  });

  it('aborts the upstream model request when the browser disconnects', async () => {
    let upstreamAborted = false;
    const fakeStream = ((_model: unknown, _context: unknown, options: { signal: AbortSignal }) => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'start' };
        await new Promise<void>((resolve) => {
          options.signal.addEventListener('abort', () => { upstreamAborted = true; resolve(); }, { once: true });
          setTimeout(resolve, 800);
        });
      },
    })) as never;
    const app = createApi(config as never, fakeStream);
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const controller = new AbortController();
      const response = await fetch(`${address}/api/stream`, {
        method: 'POST', headers: { authorization: 'Bearer local', 'content-type': 'application/json' },
        body: JSON.stringify({ model, context }), signal: controller.signal,
      });
      await response.body?.getReader().read();
      controller.abort();
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(upstreamAborted).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('preserves Pi tool call IDs and terminal events over SSE', async () => {
    const toolCall = { type: 'toolCall', id: 'call-1', name: 'read_app_data', arguments: {} };
    const fakeStream = (() => ({ async *[Symbol.asyncIterator]() {
      yield { type: 'start' };
      yield { type: 'toolcall_start', contentIndex: 0, partial: { content: [toolCall] } };
      yield { type: 'toolcall_end', contentIndex: 0, toolCall };
      yield { type: 'done', reason: 'toolUse', message: { usage } };
    } })) as never;
    const app = createApi(config as never, fakeStream);
    const response = await app.inject({ method: 'POST', url: '/api/stream', headers: { authorization: 'Bearer local' },
      payload: { model, context } });
    const events = response.body.split('\n').filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)));
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(events).toContainEqual({ type: 'toolcall_start', contentIndex: 0, id: 'call-1', toolName: 'read_app_data' });
    expect(events).toContainEqual({ type: 'toolcall_end', contentIndex: 0, toolCall });
    expect(events).toContainEqual({ type: 'done', reason: 'toolUse', usage });
    await app.close();
  });
});
