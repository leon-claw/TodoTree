import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Model, Api } from '@earendil-works/pi-ai';
import { buildProfileModel, safeProviderError } from './profileModel.js';
import type { AgentProfileRuntime } from './profileModel.js';
import type { AgentProfile, AgentProfileStore } from './profileStore.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`请填写有效的${name}。`);
  }
  return value;
}

function publicSnapshot(store: AgentProfileStore) {
  const snapshot = store.snapshot();
  return {
    profiles: snapshot.profiles.map((profile) => {
      const fullProfile = store.get(profile.id);
      return { ...profile, model: fullProfile ? buildProfileModel(fullProfile) : undefined };
    }),
    activeProfileId: snapshot.activeProfileId,
    ...(snapshot.unavailableReason ? { unavailableReason: snapshot.unavailableReason } : {}),
  };
}

function sendProfileError(error: unknown, reply: FastifyReply, store: AgentProfileStore) {
  const message = error instanceof Error ? error.message : 'Agent 配置操作失败。';
  if (store.snapshot().unavailableReason) return reply.code(503).send({ error: store.snapshot().unavailableReason });
  if (message.includes('Switch active profile')) return reply.code(409).send({ error: '请先切换当前配置，再删除它。' });
  if (message.includes('not found')) return reply.code(404).send({ error: 'Agent 配置不存在。' });
  return reply.code(400).send({ error: message });
}

function makeDraftProfile(body: Record<string, unknown>, saved: AgentProfile | undefined): AgentProfile {
  const profileId = body.profileId;
  const name = body.name === undefined && saved ? saved.name : formString(body.name, '配置名称', 80);
  const apiBaseUrl = formString(body.apiBaseUrl, 'API 地址', 2048);
  const modelId = formString(body.modelId, '模型 ID', 256);
  if (body.apiKey !== undefined && typeof body.apiKey !== 'string') throw new Error('Key 格式无效。');
  const submittedKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  const apiKey = submittedKey.trim() ? formString(submittedKey, 'Key', 4096) : saved?.apiKey ?? '';
  if (!apiKey) throw new Error('请填写 API Key。');
  return { id: typeof profileId === 'string' ? profileId : 'connection-test', name, apiBaseUrl, modelId, apiKey };
}

export function registerProfileRoutes(app: FastifyInstance, store: AgentProfileStore, runtime: AgentProfileRuntime): void {
  app.get('/api/agent-profiles', async () => publicSnapshot(store));

  app.post('/api/agent-profiles', async (request, reply) => {
    if (!isRecord(request.body)) return reply.code(400).send({ error: '请求内容必须是 JSON 对象。' });
    try {
      await store.create({
        name: formString(request.body.name, '配置名称', 80),
        apiBaseUrl: formString(request.body.apiBaseUrl, 'API 地址', 2048),
        modelId: formString(request.body.modelId, '模型 ID', 256),
        apiKey: formString(request.body.apiKey, 'Key', 4096),
      });
      return reply.code(201).send(publicSnapshot(store));
    } catch (error) { return sendProfileError(error, reply, store); }
  });

  app.put('/api/agent-profiles/:id', async (request, reply) => {
    if (!isRecord(request.body)) return reply.code(400).send({ error: '请求内容必须是 JSON 对象。' });
    const { id } = request.params as { id: string };
    try {
      if (request.body.apiKey !== undefined && typeof request.body.apiKey !== 'string') throw new Error('Key 格式无效。');
      await store.update(id, {
        name: formString(request.body.name, '配置名称', 80),
        apiBaseUrl: formString(request.body.apiBaseUrl, 'API 地址', 2048),
        modelId: formString(request.body.modelId, '模型 ID', 256),
        ...(typeof request.body.apiKey === 'string' ? { apiKey: request.body.apiKey } : {}),
        ...(request.body.clearApiKey === true ? { clearApiKey: true } : {}),
      });
      return publicSnapshot(store);
    } catch (error) { return sendProfileError(error, reply, store); }
  });

  app.delete('/api/agent-profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await store.remove(id);
      return publicSnapshot(store);
    } catch (error) { return sendProfileError(error, reply, store); }
  });

  app.put('/api/agent-profiles/:id/active', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await store.activate(id);
      return publicSnapshot(store);
    } catch (error) { return sendProfileError(error, reply, store); }
  });

  app.post('/api/agent-profiles/test', async (request, reply) => {
    if (!isRecord(request.body)) return reply.code(400).send({ ok: false, message: '请求内容必须是 JSON 对象。' });
    const body = request.body;
    let saved: AgentProfile | undefined;
    if (body.profileId !== undefined) {
      if (typeof body.profileId !== 'string' || !body.profileId) return reply.code(400).send({ ok: false, message: '配置 ID 无效。' });
      saved = store.get(body.profileId);
      if (!saved) return reply.code(404).send({ ok: false, message: 'Agent 配置不存在。' });
    }

    let profile: AgentProfile;
    try { profile = makeDraftProfile(body, saved); }
    catch (error) { return reply.code(400).send({ ok: false, message: error instanceof Error ? error.message : '配置无效。' }); }

    const controller = new AbortController();
    const abort = () => controller.abort();
    request.raw.once('aborted', abort);
    reply.raw.once('close', () => { if (!reply.raw.writableEnded) abort(); });
    try {
      await runtime.test(profile, controller.signal);
      return { ok: true, message: '连接成功' };
    } catch (error) {
      return { ok: false, message: safeProviderError(error) };
    } finally {
      request.raw.off('aborted', abort);
    }
  });
}

export function profileIdFromStreamRequest(options: unknown): string | undefined {
  if (!isRecord(options) || !isRecord(options.metadata)) return undefined;
  const profileId = options.metadata.todoTreeProfileId;
  return typeof profileId === 'string' && profileId.length > 0 ? profileId : undefined;
}

export function requestedProfileModel(value: unknown): Model<Api> | undefined {
  return isRecord(value) ? value as unknown as Model<Api> : undefined;
}
