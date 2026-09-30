import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { AgentProfile } from './profileStore.js';

export interface ServerModelConfig {
  model: Model<Api>;
  apiKey: string;
}

const models = builtinModels();
const providerKeyNames: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

export function loadAgentConfig(env: NodeJS.ProcessEnv): ServerModelConfig | null {
  const provider = env.TODOTREE_AGENT_PROVIDER?.trim();
  const modelId = env.TODOTREE_AGENT_MODEL?.trim();
  if (!provider || !modelId) return null;
  const model = models.getModel(provider, modelId);
  if (!model) return null;
  const keyName = providerKeyNames[provider] ?? `${provider.replace(/-/g, '_').toUpperCase()}_API_KEY`;
  const apiKey = env[keyName]?.trim();
  return apiKey ? { model, apiKey } : null;
}

export function loadLegacyAgentProfile(env: NodeJS.ProcessEnv, profileFileExists = false): AgentProfile | null {
  if (profileFileExists) return null;
  const config = loadAgentConfig(env);
  if (!config) return null;
  return {
    id: 'legacy-env-profile',
    name: '环境变量',
    apiBaseUrl: config.model.baseUrl,
    modelId: config.model.id,
    apiKey: config.apiKey,
    legacy: true,
  };
}
