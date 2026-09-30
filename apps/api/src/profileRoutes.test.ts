import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { AgentProfileRuntime } from './profileModel';
import { openAgentProfileStore } from './profileStore';
import type { AgentProfileStore } from './profileStore';
import { registerProfileRoutes } from './profileRoutes';

const directories: string[] = [];
const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

async function makeStore() {
  const configDir = await mkdtemp(path.join(tmpdir(), 'todotree-profile-routes-'));
  directories.push(configDir);
  return openAgentProfileStore({ configDir, env: {} });
}

function makeRuntime(overrides: Partial<AgentProfileRuntime> = {}) {
  return {
    async *stream() {
      yield { type: 'start' } as never;
      yield { type: 'done', reason: 'stop', message: { usage } } as never;
    },
    async test() {},
    ...overrides,
  } satisfies AgentProfileRuntime;
}

function makeApp(store: AgentProfileStore, runtime = makeRuntime()) {
  const app = Fastify();
  registerProfileRoutes(app, store, runtime);
  return app;
}

const createProfile = (name: string, apiKey = 'server-secret') => ({
  name,
  apiBaseUrl: 'not a URL',
  modelId: 'model-x',
  apiKey,
});

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('agent profile routes', () => {
  it('returns profile metadata and a public Pi model without returning any key', async () => {
    const store = await makeStore();
    await store.create(createProfile('Test model'));
    const app = makeApp(store);

    const response = await app.inject({ method: 'GET', url: '/api/agent-profiles' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      activeProfileId: store.snapshot().profiles[0].id,
      profiles: [{ name: 'Test model', apiBaseUrl: 'not a URL', modelId: 'model-x', hasApiKey: true,
        model: { api: 'openai-completions', provider: `todotree-${store.snapshot().profiles[0].id}`, baseUrl: 'not a URL' } }],
    });
    expect(response.body).not.toContain('server-secret');
    await app.close();
  });

  it('creates, updates, activates, and protects active profile deletion', async () => {
    const store = await makeStore();
    const app = makeApp(store);
    try {
      const firstResponse = await app.inject({ method: 'POST', url: '/api/agent-profiles', payload: createProfile('First') });
      const firstId = firstResponse.json().profiles[0].id;
      await app.inject({ method: 'PUT', url: `/api/agent-profiles/${firstId}`, payload: {
        name: 'First edited', apiBaseUrl: 'still not a URL', modelId: 'model-y', apiKey: '',
      } });
      const secondResponse = await app.inject({ method: 'POST', url: '/api/agent-profiles', payload: createProfile('Second') });
      const secondId = secondResponse.json().profiles[1].id;

      expect((await app.inject({ method: 'DELETE', url: `/api/agent-profiles/${firstId}` })).statusCode).toBe(409);
      await app.inject({ method: 'PUT', url: `/api/agent-profiles/${secondId}/active`, payload: {} });
      expect((await app.inject({ method: 'DELETE', url: `/api/agent-profiles/${firstId}` })).statusCode).toBe(200);

      const profiles = (await app.inject({ method: 'GET', url: '/api/agent-profiles' })).json();
      expect(profiles.activeProfileId).toBe(secondId);
      expect(profiles.profiles).toHaveLength(1);
      expect(profiles.profiles[0].hasApiKey).toBe(true);
    } finally { await app.close(); }
  });

  it('tests unsaved form values without persisting them, and uses a saved key for an edited profile', async () => {
    const store = await makeStore();
    const testedProfiles: Array<{ name: string; apiBaseUrl: string; modelId: string; apiKey: string }> = [];
    const app = makeApp(store, makeRuntime({ test: async (profile) => { testedProfiles.push(profile); } }));
    try {
      const unsaved = await app.inject({ method: 'POST', url: '/api/agent-profiles/test', payload: {
        ...createProfile('Draft', 'draft-secret'), apiBaseUrl: 'draft address', modelId: 'draft-model',
      } });
      expect(unsaved.json()).toEqual({ ok: true, message: '连接成功' });
      expect(store.snapshot()).toMatchObject({ profiles: [], configFileExists: false });
      expect(testedProfiles[0]).toMatchObject({ name: 'Draft', apiBaseUrl: 'draft address', modelId: 'draft-model', apiKey: 'draft-secret' });

      await store.create(createProfile('Saved', 'saved-secret'));
      const id = store.snapshot().profiles[0].id;
      const edited = await app.inject({ method: 'POST', url: '/api/agent-profiles/test', payload: {
        profileId: id, name: 'Edited draft', apiBaseUrl: 'edited address', modelId: 'edited-model', apiKey: '',
      } });
      expect(edited.json()).toEqual({ ok: true, message: '连接成功' });
      expect(testedProfiles[1]).toMatchObject({ name: 'Edited draft', apiBaseUrl: 'edited address', modelId: 'edited-model', apiKey: 'saved-secret' });
      expect(store.get(id)?.apiBaseUrl).toBe('not a URL');
    } finally { await app.close(); }
  });

  it('returns a safe connection-test error without key or raw upstream text', async () => {
    const store = await makeStore();
    const app = makeApp(store, makeRuntime({ test: async () => { throw new Error('server-secret: raw upstream response body'); } }));
    try {
      const response = await app.inject({ method: 'POST', url: '/api/agent-profiles/test', payload: createProfile('Draft') });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ ok: false, message: expect.any(String) });
      expect(response.body).not.toContain('server-secret');
      expect(response.body).not.toContain('raw upstream response body');
    } finally { await app.close(); }
  });

});
