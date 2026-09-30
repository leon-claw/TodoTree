import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentProfileRuntime } from './profileModel';
import { openAgentProfileStore } from './profileStore';
import { createApi } from './app';

const directories: string[] = [];
const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

async function makeStore() {
  const configDir = await mkdtemp(join(tmpdir(), 'todotree-config-'));
  directories.push(configDir);
  return openAgentProfileStore({ configDir, env: {} });
}

function defaultRuntime(overrides: Partial<AgentProfileRuntime> = {}): AgentProfileRuntime {
  return {
    async *stream() { yield { type: 'start' } as never; },
    async test() {},
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Fastify application', () => {
  it('serves the built web app and SPA routes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'todotree-web-'));
    directories.push(root);
    await writeFile(join(root, 'index.html'), '<h1>TodoTree</h1>');
    const store = await makeStore();
    const app = createApi(store, undefined, root);
    try {
      expect((await app.inject({ method: 'GET', url: '/' })).body).toContain('TodoTree');
      expect((await app.inject({ method: 'GET', url: '/graph/todo/task-1' })).body).toContain('TodoTree');
    } finally {
      await app.close();
    }
  });

  it('reports an empty profile list without exposing environment credentials', async () => {
    const store = await makeStore();
    const app = createApi(store);
    try {
      const response = await app.inject({ method: 'GET', url: '/api/agent-profiles' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ profiles: [], activeProfileId: null });
      expect((await app.inject({ method: 'GET', url: '/api/agent-config' })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('streams the selected profile with its server key and strips the internal profile id', async () => {
    const store = await makeStore();
    await store.create({ name: 'Saved model', apiBaseUrl: 'not a URL', modelId: 'model-x', apiKey: 'server-secret' });
    const saved = store.snapshot().profiles[0];
    let calledWith: { profileId: string; apiKey?: string; metadata?: Record<string, unknown>; maxTokens?: number; messages: unknown[] } | undefined;
    const app = createApi(store, defaultRuntime({ stream: async function* (profile, context, options) {
      calledWith = {
        profileId: profile.id,
        apiKey: options.apiKey,
        metadata: options.metadata,
        maxTokens: options.maxTokens,
        messages: context.messages,
      };
      const toolCall = { type: 'toolCall', id: 'call-1', name: 'read_app_data', arguments: {} };
      yield { type: 'start' } as never;
      yield { type: 'toolcall_start', contentIndex: 0, partial: { content: [toolCall] } } as never;
      yield { type: 'toolcall_end', contentIndex: 0, toolCall } as never;
      yield { type: 'done', reason: 'toolUse', message: { usage } } as never;
    } }));
    try {
      const model = (await app.inject({ method: 'GET', url: '/api/agent-profiles' })).json().profiles[0].model;
      const response = await app.inject({ method: 'POST', url: '/api/stream', headers: { authorization: 'Bearer local' }, payload: {
        model,
        context: { messages: [{ role: 'user', content: 'data from the current conversation', timestamp: 1 }] },
        options: { apiKey: 'browser-key', maxTokens: 99999,
          metadata: { todoTreeProfileId: saved.id, requestTag: 'retained' } },
      } });
      const events = response.body.split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(calledWith).toMatchObject({ profileId: saved.id, apiKey: 'server-secret',
        metadata: { requestTag: 'retained' }, maxTokens: 8192,
        messages: [{ role: 'user', content: 'data from the current conversation', timestamp: 1 }] });
      expect(calledWith?.metadata).not.toHaveProperty('todoTreeProfileId');
      expect(calledWith?.apiKey).not.toBe('browser-key');
      expect(events).toContainEqual({ type: 'toolcall_start', contentIndex: 0, id: 'call-1', toolName: 'read_app_data' });
      expect(events).toContainEqual({ type: 'toolcall_end', contentIndex: 0, toolCall: { type: 'toolCall', id: 'call-1', name: 'read_app_data', arguments: {} } });
      expect(events).toContainEqual({ type: 'done', reason: 'toolUse', usage });
    } finally { await app.close(); }
  });

  it('rejects forged profile IDs and modified model metadata before streaming', async () => {
    const store = await makeStore();
    await store.create({ name: 'Saved model', apiBaseUrl: 'not a URL', modelId: 'model-x', apiKey: 'server-secret' });
    const profile = store.snapshot().profiles[0];
    let streamCalls = 0;
    const app = createApi(store, defaultRuntime({ stream: async function* () { streamCalls += 1; } }));
    try {
      const model = (await app.inject({ method: 'GET', url: '/api/agent-profiles' })).json().profiles[0].model;
      const headers = { authorization: 'Bearer local' };
      const payload = { model, context: { messages: [{ role: 'user', content: 'hello', timestamp: 1 }] },
        options: { metadata: { todoTreeProfileId: profile.id } } };
      const forgedModel = await app.inject({ method: 'POST', url: '/api/stream', headers,
        payload: { ...payload, model: { ...model, baseUrl: 'https://attacker.invalid/v1' } } });
      const forgedId = await app.inject({ method: 'POST', url: '/api/stream', headers,
        payload: { ...payload, options: { metadata: { todoTreeProfileId: 'forged-id' } } } });
      const missingAuth = await app.inject({ method: 'POST', url: '/api/stream', payload });
      expect(forgedModel.statusCode).toBe(400);
      expect(forgedId.statusCode).toBe(400);
      expect(missingAuth.statusCode).toBe(401);
      expect(streamCalls).toBe(0);
    } finally { await app.close(); }
  });

  it('rejects stream requests when the selected profile has no key', async () => {
    const store = await makeStore();
    await store.create({ name: 'Saved model', apiBaseUrl: 'not a URL', modelId: 'model-x', apiKey: 'server-secret' });
    const profile = store.snapshot().profiles[0];
    await store.update(profile.id, { name: 'Saved model', apiBaseUrl: 'not a URL', modelId: 'model-x', clearApiKey: true });
    const app = createApi(store);
    try {
      const model = (await app.inject({ method: 'GET', url: '/api/agent-profiles' })).json().profiles[0].model;
      const response = await app.inject({ method: 'POST', url: '/api/stream', headers: { authorization: 'Bearer local' },
        payload: { model, context: { messages: [{ role: 'user', content: 'hello', timestamp: 1 }] },
          options: { metadata: { todoTreeProfileId: profile.id } } } });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toContain('Key');
    } finally { await app.close(); }
  });

  it('sanitizes upstream stream errors before sending them to the browser', async () => {
    const store = await makeStore();
    await store.create({ name: 'Saved model', apiBaseUrl: 'not a URL', modelId: 'model-x', apiKey: 'server-secret' });
    const profileId = store.snapshot().profiles[0].id;
    const app = createApi(store, defaultRuntime({ stream: async function* () {
      yield { type: 'error', reason: 'error', error: { usage, errorMessage: 'server-secret raw upstream response body' } } as never;
    } }));
    try {
      const model = (await app.inject({ method: 'GET', url: '/api/agent-profiles' })).json().profiles[0].model;
      const response = await app.inject({ method: 'POST', url: '/api/stream', headers: { authorization: 'Bearer local' },
        payload: { model, context: { messages: [{ role: 'user', content: 'hello', timestamp: 1 }] },
          options: { metadata: { todoTreeProfileId: profileId } } } });
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain('server-secret');
      expect(response.body).not.toContain('raw upstream response body');
      expect(response.body).toContain('模型连接失败');
    } finally { await app.close(); }
  });

  it('aborts an upstream profile request when the browser disconnects', async () => {
    const store = await makeStore();
    await store.create({ name: 'Saved model', apiBaseUrl: 'not a URL', modelId: 'model-x', apiKey: 'server-secret' });
    const profileId = store.snapshot().profiles[0].id;
    let upstreamAborted = false;
    const app = createApi(store, defaultRuntime({ stream: (_profile, _context, options) => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'start' } as never;
        await new Promise<void>((resolve) => {
          options.signal?.addEventListener('abort', () => { upstreamAborted = true; resolve(); }, { once: true });
          setTimeout(resolve, 800);
        });
      },
    }) }));
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const model = (await app.inject({ method: 'GET', url: '/api/agent-profiles' })).json().profiles[0].model;
      const controller = new AbortController();
      const response = await fetch(`${address}/api/stream`, {
        method: 'POST', headers: { authorization: 'Bearer local', 'content-type': 'application/json' },
        body: JSON.stringify({ model, context: { messages: [{ role: 'user', content: 'hello', timestamp: 1 }] },
          options: { metadata: { todoTreeProfileId: profileId } } }), signal: controller.signal,
      });
      await response.body?.getReader().read();
      controller.abort();
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(upstreamAborted).toBe(true);
    } finally { await app.close(); }
  });
});
