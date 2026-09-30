import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { loadLegacyAgentProfile } from './config.js';

export interface AgentProfile {
  id: string;
  name: string;
  apiBaseUrl: string;
  modelId: string;
  apiKey: string;
  legacy?: boolean;
}

export interface AgentProfileInput {
  name: string;
  apiBaseUrl: string;
  modelId: string;
  apiKey: string;
}

export interface AgentProfileUpdate {
  name: string;
  apiBaseUrl: string;
  modelId: string;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface PublicAgentProfile extends Omit<AgentProfile, 'apiKey'> {
  hasApiKey: boolean;
}

export interface ProfileSnapshot {
  profiles: PublicAgentProfile[];
  activeProfileId: string | null;
  unavailableReason: string | null;
  configFileExists: boolean;
}

export interface AgentProfileStore {
  snapshot(): ProfileSnapshot;
  get(id: string): AgentProfile | undefined;
  create(input: AgentProfileInput): Promise<void>;
  update(id: string, input: AgentProfileUpdate): Promise<void>;
  activate(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

interface StoredProfiles {
  profiles: AgentProfile[];
  activeProfileId: string | null;
}

interface OpenStoreOptions {
  configDir?: string;
  env?: NodeJS.ProcessEnv;
}

const PROFILE_FILE = 'agent-profiles.json';
const MAX_LENGTHS = { name: 80, apiBaseUrl: 2048, modelId: 256, apiKey: 4096 } as const;

function validateField(value: string, field: keyof typeof MAX_LENGTHS): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_LENGTHS[field]) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function validateStoredProfiles(value: unknown): StoredProfiles {
  if (!value || typeof value !== 'object') throw new Error('Invalid profile storage format');
  const input = value as Partial<StoredProfiles>;
  if (!Array.isArray(input.profiles) || !(input.activeProfileId === null || typeof input.activeProfileId === 'string')) {
    throw new Error('Invalid profile storage format');
  }

  const profiles = input.profiles.map((candidate): AgentProfile => {
    if (!candidate || typeof candidate !== 'object') throw new Error('Invalid profile storage format');
    const item = candidate as AgentProfile;
    if (
      typeof item.id !== 'string' || item.id.length === 0 ||
      typeof item.name !== 'string' || typeof item.apiBaseUrl !== 'string' ||
      typeof item.modelId !== 'string' || typeof item.apiKey !== 'string' ||
      item.name.trim().length === 0 || item.name.length > MAX_LENGTHS.name ||
      item.apiBaseUrl.trim().length === 0 || item.apiBaseUrl.length > MAX_LENGTHS.apiBaseUrl ||
      item.modelId.trim().length === 0 || item.modelId.length > MAX_LENGTHS.modelId ||
      item.apiKey.length > MAX_LENGTHS.apiKey
    ) throw new Error('Invalid profile storage format');
    return { id: item.id, name: item.name, apiBaseUrl: item.apiBaseUrl, modelId: item.modelId, apiKey: item.apiKey };
  });

  if (new Set(profiles.map(({ id }) => id)).size !== profiles.length) throw new Error('Duplicate profile id');
  if (input.activeProfileId !== null && !profiles.some(({ id }) => id === input.activeProfileId)) {
    throw new Error('Invalid active profile id');
  }
  return { profiles, activeProfileId: input.activeProfileId };
}

export async function openAgentProfileStore(options: OpenStoreOptions = {}): Promise<AgentProfileStore> {
  const env = options.env ?? process.env;
  const configDir = options.configDir ?? env.TODOTREE_CONFIG_DIR ?? path.join(homedir(), '.todotree');
  const filePath = path.join(configDir, PROFILE_FILE);
  let stored: StoredProfiles = { profiles: [], activeProfileId: null };
  let configFileExists = false;
  let unavailableReason: string | null = null;
  let legacyProfile: AgentProfile | null = null;

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Profile storage is not a file');
    configFileExists = true;
    await chmod(filePath, 0o600);
    stored = validateStoredProfiles(JSON.parse(await readFile(filePath, 'utf8')));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      // A missing parent directory is the normal first-run state; an existing
      // non-directory parent is surfaced as ENOTDIR and remains unavailable.
      try {
        const parent = await stat(configDir);
        if (!parent.isDirectory()) throw new Error('Profile storage directory is not a directory');
      } catch (parentError) {
        if ((parentError as NodeJS.ErrnoException).code !== 'ENOENT') throw parentError;
      }
      legacyProfile = loadLegacyAgentProfile(env);
    } else {
      unavailableReason = '无法读取 Agent 配置文件，请检查文件格式和权限。';
    }
  }

  let queue: Promise<void> = Promise.resolve();
  const ensureAvailable = () => {
    if (unavailableReason) throw new Error(unavailableReason);
  };
  const profileById = (id: string) => stored.profiles.find((profile) => profile.id === id);

  async function persist(next: StoredProfiles) {
    await mkdir(configDir, { recursive: true, mode: 0o700 });
    await chmod(configDir, 0o700);
    const tempPath = path.join(configDir, `.${PROFILE_FILE}.${randomUUID()}.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(tempPath, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(tempPath, filePath);
      await chmod(filePath, 0o600);
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw new Error('无法保存 Agent 配置，请检查目录权限和磁盘空间。', { cause: error });
    }
  }

  function mutate(change: (next: StoredProfiles) => void | Promise<void>): Promise<void> {
    const operation = queue.then(async () => {
      ensureAvailable();
      const next: StoredProfiles = structuredClone(stored);
      await change(next);
      validateStoredProfiles(next);
      await persist(next);
      stored = next;
      configFileExists = true;
      legacyProfile = null;
    });
    queue = operation.catch(() => undefined);
    return operation;
  }

  function snapshot(): ProfileSnapshot {
    const profiles = [...stored.profiles, ...(legacyProfile ? [legacyProfile] : [])].map(({ apiKey, ...profile }) => ({
      ...profile,
      hasApiKey: Boolean(apiKey),
    }));
    return {
      profiles,
      activeProfileId: legacyProfile ? legacyProfile.id : stored.activeProfileId,
      unavailableReason,
      configFileExists,
    };
  }

  function get(id: string): AgentProfile | undefined {
    const profile = profileById(id) ?? (legacyProfile?.id === id ? legacyProfile : undefined);
    return profile ? { ...profile } : undefined;
  }

  return {
    snapshot,
    get,
    create(input) {
      return mutate((next) => {
        const created: AgentProfile = {
          id: randomUUID(),
          name: validateField(input.name, 'name'),
          apiBaseUrl: validateField(input.apiBaseUrl, 'apiBaseUrl'),
          modelId: validateField(input.modelId, 'modelId'),
          apiKey: validateField(input.apiKey, 'apiKey'),
        };
        next.profiles.push(created);
        if (next.profiles.length === 1 || legacyProfile) next.activeProfileId = created.id;
      });
    },
    update(id, input) {
      return mutate((next) => {
        const profile = next.profiles.find((candidate) => candidate.id === id);
        if (!profile) throw new Error('Profile not found or is read-only');
        profile.name = validateField(input.name, 'name');
        profile.apiBaseUrl = validateField(input.apiBaseUrl, 'apiBaseUrl');
        profile.modelId = validateField(input.modelId, 'modelId');
        if (input.clearApiKey) profile.apiKey = '';
        else if (input.apiKey?.trim()) profile.apiKey = validateField(input.apiKey, 'apiKey');
      });
    },
    activate(id) {
      return mutate((next) => {
        if (!next.profiles.some(({ id: currentId }) => currentId === id)) throw new Error('Profile not found or is read-only');
        next.activeProfileId = id;
      });
    },
    remove(id) {
      return mutate((next) => {
        const index = next.profiles.findIndex(({ id: currentId }) => currentId === id);
        if (index < 0) throw new Error('Profile not found or is read-only');
        if (next.activeProfileId === id && next.profiles.length > 1) throw new Error('Switch active profile before deleting it');
        next.profiles.splice(index, 1);
        if (next.activeProfileId === id) next.activeProfileId = null;
      });
    },
  };
}
