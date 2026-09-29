import { describe, expect, it } from 'vitest';
import { loadAgentConfig } from './config';

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
});
