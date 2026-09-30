import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openAgentProfileStore } from './profileStore';

const directories: string[] = [];

async function makeConfigDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'todotree-profiles-'));
  directories.push(dir);
  return dir;
}

const profile = (name: string, apiKey = 'secret-key') => ({
  name,
  apiBaseUrl: 'not a URL',
  modelId: 'model-x',
  apiKey,
});

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('openAgentProfileStore', () => {
  it('starts empty without creating the config file', async () => {
    const configDir = await makeConfigDir();
    const store = await openAgentProfileStore({ configDir, env: {} });

    expect(store.snapshot()).toMatchObject({ profiles: [], activeProfileId: null, unavailableReason: null, configFileExists: false });
    expect(await readdir(configDir)).toEqual([]);
  });

  it('persists profile edits, activation, and non-URL API addresses across reloads', async () => {
    const configDir = await makeConfigDir();
    const store = await openAgentProfileStore({ configDir, env: {} });
    await store.create(profile('Local model'));
    const created = store.snapshot().profiles[0];

    await store.update(created.id, { name: 'Edited model', apiBaseUrl: 'still not a URL', modelId: 'model-y', apiKey: '' });
    await store.activate(created.id);

    const reloaded = await openAgentProfileStore({ configDir, env: {} });
    expect(reloaded.snapshot()).toMatchObject({
      activeProfileId: created.id,
      profiles: [{ id: created.id, name: 'Edited model', apiBaseUrl: 'still not a URL', modelId: 'model-y', hasApiKey: true }],
      configFileExists: true,
      unavailableReason: null,
    });
    expect(reloaded.get(created.id)?.apiKey).toBe('secret-key');
  });

  it('clears a saved key only when explicitly requested', async () => {
    const store = await openAgentProfileStore({ configDir: await makeConfigDir(), env: {} });
    await store.create(profile('Model'));
    const id = store.snapshot().profiles[0].id;

    await store.update(id, { name: 'Model', apiBaseUrl: 'not a URL', modelId: 'model-x', clearApiKey: true });

    expect(store.snapshot().profiles[0].hasApiKey).toBe(false);
    expect(store.get(id)?.apiKey).toBe('');
  });

  it('requires switching away before deleting an active profile when another profile exists', async () => {
    const store = await openAgentProfileStore({ configDir: await makeConfigDir(), env: {} });
    await store.create(profile('First'));
    await store.create(profile('Second'));
    const [first, second] = store.snapshot().profiles;
    await store.activate(first.id);

    await expect(store.remove(first.id)).rejects.toThrow();
    await store.activate(second.id);
    await store.remove(first.id);

    expect(store.snapshot().profiles.map(({ id }) => id)).toEqual([second.id]);
    expect(store.snapshot().activeProfileId).toBe(second.id);
  });

  it('clears the active id when the only profile is deleted', async () => {
    const store = await openAgentProfileStore({ configDir: await makeConfigDir(), env: {} });
    await store.create(profile('Only profile'));
    const id = store.snapshot().profiles[0].id;
    await store.activate(id);

    await store.remove(id);

    expect(store.snapshot()).toMatchObject({ profiles: [], activeProfileId: null });
  });

  it('serializes concurrent creates without losing a profile', async () => {
    const configDir = await makeConfigDir();
    const store = await openAgentProfileStore({ configDir, env: {} });

    await Promise.all(Array.from({ length: 8 }, (_, index) => store.create(profile(`Profile ${index}`))));

    const reloaded = await openAgentProfileStore({ configDir, env: {} });
    expect(reloaded.snapshot().profiles).toHaveLength(8);
    expect(new Set(reloaded.snapshot().profiles.map(({ name }) => name)).size).toBe(8);
  });

  it('restricts config directory and file permissions', async () => {
    const configDir = path.join(await makeConfigDir(), 'private');
    const store = await openAgentProfileStore({ configDir, env: {} });
    await store.create(profile('Private'));

    expect((await stat(configDir)).mode & 0o777).toBe(0o700);
    expect((await stat(path.join(configDir, 'agent-profiles.json'))).mode & 0o777).toBe(0o600);
  });

  it('reports corrupt JSON and leaves the existing bytes untouched', async () => {
    const configDir = await makeConfigDir();
    const file = path.join(configDir, 'agent-profiles.json');
    const original = '{not-json';
    await writeFile(file, original, { mode: 0o600 });

    const store = await openAgentProfileStore({ configDir, env: {} });

    expect(store.snapshot().unavailableReason).toBeTruthy();
    await expect(store.create(profile('Must not overwrite'))).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('reports unreadable storage instead of silently starting an empty store', async () => {
    const parent = await makeConfigDir();
    const configDir = path.join(parent, 'not-a-directory');
    await writeFile(configDir, 'block directory creation');

    const store = await openAgentProfileStore({ configDir, env: {} });

    expect(store.snapshot().unavailableReason).toBeTruthy();
    await expect(store.create(profile('Must fail'))).rejects.toThrow();
  });

  it('rejects empty and overlong required fields without parsing the API address', async () => {
    const store = await openAgentProfileStore({ configDir: await makeConfigDir(), env: {} });

    await expect(store.create({ ...profile(''), name: ' ' })).rejects.toThrow();
    await expect(store.create({ ...profile('Too long'), apiBaseUrl: 'x'.repeat(2049) })).rejects.toThrow();
    await expect(store.create({ ...profile('Missing key'), apiKey: '' })).rejects.toThrow();
    expect(store.snapshot().profiles).toEqual([]);
  });
});
