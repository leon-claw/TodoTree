import { isDeepStrictEqual } from 'node:util';
import { createProvider } from '@earendil-works/pi-ai';
import type { Api, AssistantMessageEvent, Model, SimpleStreamOptions, TranscriptContext } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import type { AgentProfile, AgentProfileStore } from './profileStore.js';

export type ProfileStreamer = (
  profile: AgentProfile,
  context: TranscriptContext,
  options: SimpleStreamOptions,
) => AsyncIterable<AssistantMessageEvent>;

export interface AgentProfileRuntime {
  stream(profile: AgentProfile, context: TranscriptContext, options: SimpleStreamOptions): AsyncIterable<AssistantMessageEvent>;
  test(profile: AgentProfile, signal: AbortSignal): Promise<void>;
}

export function buildProfileModel(profile: AgentProfile): Model<Api> {
  return {
    id: profile.modelId,
    name: profile.name,
    api: 'openai-completions',
    provider: `todotree-${profile.id}`,
    baseUrl: profile.apiBaseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  };
}

function profileProvider(profile: AgentProfile) {
  const model = buildProfileModel(profile);
  return createProvider({
    id: model.provider,
    name: profile.name,
    baseUrl: profile.apiBaseUrl,
    auth: {
      apiKey: {
        name: 'Agent profile API key',
        resolve: async ({ credential }) => credential?.key ? { auth: { apiKey: credential.key } } : undefined,
      },
    },
    models: [model],
    api: openAICompletionsApi(),
  });
}

export function streamProfile(profile: AgentProfile, context: TranscriptContext, options: SimpleStreamOptions) {
  if (!profile.apiKey) throw new Error('Agent profile has no API key');
  const model = buildProfileModel(profile);
  return profileProvider(profile).streamSimple(model, context, { ...options, apiKey: profile.apiKey });
}

export function resolveStreamProfile(
  store: AgentProfileStore,
  profileId: string,
  requestedModel: Model<Api>,
): AgentProfile | undefined {
  const profile = store.get(profileId);
  if (!profile?.apiKey || !isDeepStrictEqual(buildProfileModel(profile), requestedModel)) return undefined;
  return profile;
}

export async function testProfileConnection(
  profile: AgentProfile,
  signal: AbortSignal,
  streamer: ProfileStreamer = streamProfile,
): Promise<void> {
  if (!profile.apiKey) throw new Error('Agent profile has no API key');
  const timeoutSignal = AbortSignal.timeout(30_000);
  const testSignal = AbortSignal.any([signal, timeoutSignal]);
  const context = {
    messages: [{ role: 'user', content: 'Reply with OK.', timestamp: 1 }],
  } as unknown as TranscriptContext;
  const options: SimpleStreamOptions = {
    apiKey: profile.apiKey,
    maxTokens: 8,
    temperature: 0,
    timeoutMs: 30_000,
    signal: testSignal,
  };

  for await (const event of streamer(profile, context, options)) {
    if (event.type === 'error') throw new Error(event.error.errorMessage ?? 'Provider request failed');
  }
}

export function safeProviderError(error: unknown): string {
  const candidate = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  if (/timeout|timed out|abort/i.test(candidate)) return '连接超时（30 秒），请稍后重试。';
  if (/401|403|unauthorized|forbidden|invalid api.?key|authentication/i.test(candidate)) return '认证失败，请检查 API Key。';
  if (/404|model.{0,20}(not found|unknown)|not found/i.test(candidate)) return '接口或模型未找到，请检查 API 地址和模型 ID。';
  if (/429|rate.?limit|too many requests/i.test(candidate)) return '模型服务限流，请稍后重试。';
  if (/ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ERR_INVALID_URL|failed to parse url|fetch failed|networkerror/i.test(candidate)) {
    return '无法连接到该 API 地址，请检查地址和网络。';
  }
  return '模型连接失败，请检查 API 地址、模型 ID 和 Key。';
}

export const defaultProfileRuntime: AgentProfileRuntime = {
  stream: streamProfile,
  test: testProfileConnection,
};
