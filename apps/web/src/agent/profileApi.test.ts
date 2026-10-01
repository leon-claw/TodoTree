import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProfileApi } from './profileApi';

afterEach(() => vi.unstubAllGlobals());

const model = {
  id: 'model-x', name: 'Work model', api: 'openai-completions', provider: 'todotree-p1',
  baseUrl: 'https://api.example.test/v1', reasoning: false, input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128_000, maxTokens: 8_192,
};
const safeSnapshot = {
  profiles: [{
    id: 'p1', name: 'Work model', apiBaseUrl: 'https://api.example.test/v1', modelId: 'model-x',
    hasApiKey: true, model,
  }],
  activeProfileId: 'p1',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setFetch(responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>(async () => responses.shift() ?? jsonResponse(safeSnapshot));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('profile API client', () => {
  it('loads a safe DTO and never exposes a returned key field', async () => {
    const fetchMock = setFetch([jsonResponse({
      ...safeSnapshot,
      profiles: [{
        ...safeSnapshot.profiles[0],
        apiKey: 'should-not-escape',
        model: { ...model, apiKey: 'nested-should-not-escape' },
      }],
    })]);
    const api = createProfileApi('/backend');

    const result = await api.getProfiles();

    expect(fetchMock).toHaveBeenCalledWith('/backend/api/agent-profiles', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual(safeSnapshot);
    expect(result.profiles[0]).not.toHaveProperty('apiKey');
    expect(result.profiles[0]?.model).not.toHaveProperty('apiKey');
  });

  it('uses the profile routes, verbs, and JSON bodies for create, edit, activation, deletion, and test', async () => {
    const fetchMock = setFetch([
      jsonResponse(safeSnapshot),
      jsonResponse(safeSnapshot),
      jsonResponse(safeSnapshot),
      jsonResponse(safeSnapshot),
      jsonResponse(safeSnapshot),
      jsonResponse({ ok: false, message: '认证失败，请检查 API Key。' }),
    ]);
    const api = createProfileApi();

    await api.saveProfile({ name: 'New', apiBaseUrl: 'not validated', modelId: 'm1', apiKey: 'secret' });
    await api.saveProfile({ profileId: 'p1', name: 'Edited', apiBaseUrl: 'still not validated', modelId: 'm2', clearApiKey: true });
    await api.saveProfile({ profileId: 'p1', name: 'Keep key', apiBaseUrl: 'still not validated', modelId: 'm3' });
    await api.activateProfile('p1');
    await api.deleteProfile('p1');
    const testResult = await api.testProfile({ name: 'Draft', apiBaseUrl: 'draft endpoint', modelId: 'draft-model', apiKey: 'draft-secret' });

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['/api/agent-profiles', 'POST'],
      ['/api/agent-profiles/p1', 'PUT'],
      ['/api/agent-profiles/p1', 'PUT'],
      ['/api/agent-profiles/p1/active', 'PUT'],
      ['/api/agent-profiles/p1', 'DELETE'],
      ['/api/agent-profiles/test', 'POST'],
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      name: 'New', apiBaseUrl: 'not validated', modelId: 'm1', apiKey: 'secret',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      name: 'Edited', apiBaseUrl: 'still not validated', modelId: 'm2', clearApiKey: true,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      name: 'Keep key', apiBaseUrl: 'still not validated', modelId: 'm3',
    });
    expect(fetchMock.mock.calls[3]?.[1]?.body).toBeUndefined();
    expect(fetchMock.mock.calls[4]?.[1]?.body).toBeUndefined();
    expect(JSON.parse(String(fetchMock.mock.calls[5]?.[1]?.body))).toEqual({
      name: 'Draft', apiBaseUrl: 'draft endpoint', modelId: 'draft-model', apiKey: 'draft-secret',
    });
    expect(testResult).toEqual({ ok: false, message: '认证失败，请检查 API Key。' });
  });

  it('returns successful connection-test results explicitly', async () => {
    setFetch([jsonResponse({ ok: true, message: '连接成功' })]);

    await expect(createProfileApi().testProfile({
      name: 'Draft', apiBaseUrl: 'local mock', modelId: 'model-x', apiKey: 'temporary',
    })).resolves.toEqual({ ok: true, message: '连接成功' });
  });

  it('turns HTTP errors and malformed JSON into readable errors', async () => {
    const api = createProfileApi();
    setFetch([
      jsonResponse({ error: '请先切换当前配置，再删除它。' }, 409),
      new Response('not-json', { status: 200 }),
    ]);

    await expect(api.deleteProfile('p1')).rejects.toThrow('请先切换当前配置，再删除它。');
    await expect(api.getProfiles()).rejects.toThrow('服务器返回了无效 JSON。');
  });

  it('rejects malformed successful DTOs instead of fabricating an empty profile list', async () => {
    setFetch([jsonResponse({ profiles: 'invalid', activeProfileId: null })]);

    await expect(createProfileApi().getProfiles()).rejects.toThrow('Agent 配置响应格式无效。');
  });

  it('turns an unreachable backend into a readable error', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => { throw new TypeError('Failed to fetch'); }));

    await expect(createProfileApi().getProfiles()).rejects.toThrow('无法连接到 TodoTree 后端，请确认服务正在运行。');
  });
});
