import type { Api, Model } from '@earendil-works/pi-ai';

export interface AgentProfileSummary {
  id: string;
  name: string;
  apiBaseUrl: string;
  modelId: string;
  hasApiKey: boolean;
  legacy?: boolean;
  model: Model<Api>;
}

export interface AgentProfilesSnapshot {
  profiles: AgentProfileSummary[];
  activeProfileId: string | null;
  unavailableReason?: string | null;
}

export interface AgentProfileFields {
  name: string;
  apiBaseUrl: string;
  modelId: string;
  apiKey?: string;
}

export interface SaveAgentProfileInput extends AgentProfileFields {
  profileId?: string;
  clearApiKey?: boolean;
}

export interface TestAgentProfileInput extends AgentProfileFields {
  profileId?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error('服务器返回了无效 JSON。');
  }
}

async function performFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error('无法连接到 TodoTree 后端，请确认服务正在运行。');
  }
}

function httpError(body: unknown, status: number): Error {
  if (isRecord(body)) {
    if (typeof body.error === 'string' && body.error) return new Error(body.error);
    if (typeof body.message === 'string' && body.message) return new Error(body.message);
  }
  return new Error('请求失败（HTTP ' + status + '）。');
}

function decodeSnapshot(value: unknown): AgentProfilesSnapshot {
  if (
    !isRecord(value) ||
    !Array.isArray(value.profiles) ||
    !(value.activeProfileId === null || typeof value.activeProfileId === 'string')
  ) throw new Error('Agent 配置响应格式无效。');

  const profiles = value.profiles.map((profile): AgentProfileSummary => {
    if (
      !isRecord(profile) ||
      typeof profile.id !== 'string' ||
      typeof profile.name !== 'string' ||
      typeof profile.apiBaseUrl !== 'string' ||
      typeof profile.modelId !== 'string' ||
      typeof profile.hasApiKey !== 'boolean' ||
      !isRecord(profile.model)
    ) throw new Error('Agent 配置响应格式无效。');

    const { apiKey: _discarded, ...modelFields } = profile.model;
    return {
      id: profile.id,
      name: profile.name,
      apiBaseUrl: profile.apiBaseUrl,
      modelId: profile.modelId,
      hasApiKey: profile.hasApiKey,
      ...(typeof profile.legacy === 'boolean' ? { legacy: profile.legacy } : {}),
      model: modelFields as unknown as Model<Api>,
    };
  });

  return {
    profiles,
    activeProfileId: value.activeProfileId,
    ...(typeof value.unavailableReason === 'string' || value.unavailableReason === null
      ? { unavailableReason: value.unavailableReason }
      : {}),
  };
}

export function createProfileApi(baseUrl = '') {
  const request = async (route: string, init: RequestInit = {}): Promise<unknown> => {
    const response = await performFetch(baseUrl + route, init);
    const body = await parseJson(response);
    if (!response.ok) throw httpError(body, response.status);
    return body;
  };
  const jsonInit = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const getProfiles = async () => decodeSnapshot(await request('/api/agent-profiles', { method: 'GET' }));
  const saveProfile = async (input: SaveAgentProfileInput) => {
    const { profileId, ...body } = input;
    const route = profileId
      ? '/api/agent-profiles/' + encodeURIComponent(profileId)
      : '/api/agent-profiles';
    const method = profileId ? 'PUT' : 'POST';
    return decodeSnapshot(await request(route, jsonInit(method, body)));
  };
  const activateProfile = async (profileId: string) => decodeSnapshot(await request(
    '/api/agent-profiles/' + encodeURIComponent(profileId) + '/active',
    { method: 'PUT' },
  ));
  const deleteProfile = async (profileId: string) => decodeSnapshot(await request(
    '/api/agent-profiles/' + encodeURIComponent(profileId),
    { method: 'DELETE' },
  ));
  const testProfile = async (input: TestAgentProfileInput): Promise<ConnectionTestResult> => {
    const response = await performFetch(baseUrl + '/api/agent-profiles/test', jsonInit('POST', input));
    const body = await parseJson(response);
    if (
      isRecord(body) &&
      typeof body.ok === 'boolean' &&
      typeof body.message === 'string'
    ) return { ok: body.ok, message: body.message };
    if (!response.ok) throw httpError(body, response.status);
    throw new Error('连接测试响应格式无效。');
  };

  return { getProfiles, saveProfile, activateProfile, deleteProfile, testProfile };
}
