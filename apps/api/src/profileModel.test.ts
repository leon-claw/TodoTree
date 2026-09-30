import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssistantMessageEvent, Model, Api, TranscriptContext, SimpleStreamOptions } from '@earendil-works/pi-ai';
import { openAgentProfileStore } from './profileStore';
import { buildProfileModel, resolveStreamProfile, safeProviderError, testProfileConnection } from './profileModel';
import type { AgentProfile } from './profileStore';

const directories: string[] = [];

async function makeStore() {
  const configDir = await mkdtemp(path.join(tmpdir(), 'todotree-profile-model-'));
  directories.push(configDir);
  return openAgentProfileStore({ configDir, env: {} });
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const profile: AgentProfile = {
  id: 'profile-123',
  name: 'Local model',
  apiBaseUrl: 'not a URL',
  modelId: 'model-x',
  apiKey: 'server-secret',
};

describe('profile model runtime', () => {
  it('builds a fixed Chat Completions model from profile data without validating the address', () => {
    expect(buildProfileModel(profile)).toMatchObject({
      provider: 'todotree-profile-123',
      id: 'model-x',
      name: 'Local model',
      api: 'openai-completions',
      baseUrl: 'not a URL',
    });
  });

  it('resolves a stream only when the server profile and requested model match exactly', async () => {
    const store = await makeStore();
    await store.create({ name: profile.name, apiBaseUrl: profile.apiBaseUrl, modelId: profile.modelId, apiKey: profile.apiKey });
    const saved = store.snapshot().profiles[0];
    const serverProfile = store.get(saved.id)!;
    const requestedModel = buildProfileModel(serverProfile);

    expect(resolveStreamProfile(store, saved.id, requestedModel)?.apiKey).toBe(profile.apiKey);
    expect(resolveStreamProfile(store, 'forged-id', requestedModel)).toBeUndefined();
    expect(resolveStreamProfile(store, saved.id, { ...requestedModel, baseUrl: 'https://attacker.invalid/v1' } as Model<Api>)).toBeUndefined();
  });

  it('tests with one short user message and no application or Graphify context', async () => {
    const stream = vi.fn((_profile: AgentProfile, _context: TranscriptContext, _options: SimpleStreamOptions) => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'start' } as AssistantMessageEvent;
        yield { type: 'done', reason: 'stop', message: { usage: {
          input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        } } } as AssistantMessageEvent;
      },
    }));

    await testProfileConnection(profile, new AbortController().signal, stream);

    const [testedProfile, context, options] = stream.mock.calls[0];
    expect(buildProfileModel(testedProfile).api).toBe('openai-completions');
    expect(testedProfile.modelId).toBe('model-x');
    expect(context.messages).toEqual([{ role: 'user', content: 'Reply with OK.', timestamp: 1 }]);
    expect(options).toMatchObject({ apiKey: 'server-secret', maxTokens: 8, temperature: 0 });
    expect(options.timeoutMs).toBe(30_000);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not contact the model when the profile has no API key', async () => {
    const stream = vi.fn();

    await expect(testProfileConnection({ ...profile, apiKey: '' }, new AbortController().signal, stream as never)).rejects.toThrow();

    expect(stream).not.toHaveBeenCalled();
  });

  it('summarizes address, credential, and timeout failures without echoing upstream details', () => {
    expect(safeProviderError(new Error('ERR_INVALID_URL: server-secret raw response body'))).toBe('无法连接到该 API 地址，请检查地址和网络。');
    expect(safeProviderError(new Error('401 invalid api key server-secret'))).toBe('认证失败，请检查 API Key。');
    expect(safeProviderError(new Error('TimeoutError: server-secret raw response body'))).toBe('连接超时（30 秒），请稍后重试。');
  });
});
