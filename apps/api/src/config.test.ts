import { describe, expect, it } from 'vitest';
import { loadAgentConfig, loadLegacyAgentProfile } from './config';

describe('loadAgentConfig', () => {
  it('uses only a server configured built-in model and provider key', () => {
    const config = loadAgentConfig({ TODOTREE_AGENT_PROVIDER: 'openai', TODOTREE_AGENT_MODEL: 'gpt-4o', OPENAI_API_KEY: 'private-key' });
    expect(config?.model.provider).toBe('openai');
    expect(config?.model.id).toBe('gpt-4o');
    expect(config?.apiKey).toBe('private-key');
  });

  it('stays unavailable without a key or for an unknown model', () => {
    expect(loadAgentConfig({ TODOTREE_AGENT_PROVIDER: 'openai', TODOTREE_AGENT_MODEL: 'gpt-4o' })).toBeNull();
    expect(loadAgentConfig({ TODOTREE_AGENT_PROVIDER: 'openai', TODOTREE_AGENT_MODEL: 'unknown', OPENAI_API_KEY: 'private-key' })).toBeNull();
  });

  it('exposes a read-only compatibility profile only while the profile file is absent', () => {
    const env = { TODOTREE_AGENT_PROVIDER: 'openai', TODOTREE_AGENT_MODEL: 'gpt-4o', OPENAI_API_KEY: 'private-key' };

    expect(loadLegacyAgentProfile(env)).toMatchObject({
      id: 'legacy-env-profile',
      name: '环境变量',
      modelId: 'gpt-4o',
      apiKey: 'private-key',
      legacy: true,
    });
    expect(loadLegacyAgentProfile(env, true)).toBeNull();
    expect(loadLegacyAgentProfile({ ...env, OPENAI_API_KEY: undefined })).toBeNull();
  });
});
