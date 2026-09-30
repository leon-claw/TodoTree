import { isDeepStrictEqual } from 'node:util';
import { Readable } from 'node:stream';
import { extname, resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { AssistantMessageEvent, SimpleStreamOptions, TranscriptContext } from '@earendil-works/pi-ai';
import type { FastifyInstance } from 'fastify';
import { buildProfileModel, defaultProfileRuntime, resolveStreamProfile, safeProviderError } from './profileModel.js';
import type { AgentProfileRuntime } from './profileModel.js';
import { profileIdFromStreamRequest, registerProfileRoutes, requestedProfileModel } from './profileRoutes.js';
import type { AgentProfileStore } from './profileStore.js';
import { registerGraphRoutes } from './graphRoutes.js';
import type { GraphifyOptions } from './graphRunner.js';

function proxyEvent(event: AssistantMessageEvent): Record<string, unknown> {
  switch (event.type) {
    case 'start': return { type: 'start' };
    case 'text_start': return { type: event.type, contentIndex: event.contentIndex };
    case 'text_delta': return { type: event.type, contentIndex: event.contentIndex, delta: event.delta };
    case 'text_end': {
      const block = event.partial.content[event.contentIndex];
      return { type: event.type, contentIndex: event.contentIndex,
        ...(block?.type === 'text' && block.textSignature ? { contentSignature: block.textSignature } : {}) };
    }
    case 'thinking_start': return { type: event.type, contentIndex: event.contentIndex };
    case 'thinking_delta': return { type: event.type, contentIndex: event.contentIndex, delta: event.delta };
    case 'thinking_end': {
      const block = event.partial.content[event.contentIndex];
      return { type: event.type, contentIndex: event.contentIndex,
        ...(block?.type === 'thinking' && block.thinkingSignature ? { contentSignature: block.thinkingSignature } : {}) };
    }
    case 'toolcall_start': {
      const block = event.partial.content[event.contentIndex];
      if (block?.type !== 'toolCall' || !block.id) throw new Error('Pi tool call has no ID');
      return { type: event.type, contentIndex: event.contentIndex, id: block.id, toolName: block.name };
    }
    case 'toolcall_delta': return { type: event.type, contentIndex: event.contentIndex, delta: event.delta };
    case 'toolcall_end': return { type: event.type, contentIndex: event.contentIndex, toolCall: event.toolCall };
    case 'done': return { type: 'done', reason: event.reason === 'deferred' ? 'stop' : event.reason,
      usage: event.message.usage, ...(event.message.providerThinkingLevel ? { providerThinkingLevel: event.message.providerThinkingLevel } : {}) };
    case 'error': return { type: 'error', reason: event.reason, usage: event.error.usage,
      errorMessage: safeProviderError(event.error) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createApi(
  store: AgentProfileStore,
  runtime: AgentProfileRuntime = defaultProfileRuntime,
  webDist?: string,
  graphProjectRoot = resolve(process.cwd(), '../..'),
  graphOptions: Omit<GraphifyOptions, 'projectRoot'> = {},
): FastifyInstance {
  const app = Fastify({ bodyLimit: 4 * 1024 * 1024 });
  registerGraphRoutes(app, graphProjectRoot, graphOptions);
  registerProfileRoutes(app, store, runtime);
  if (webDist) {
    app.register(fastifyStatic, { root: webDist, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/') && !extname(request.url.split('?')[0])) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not Found' });
    });
  }

  app.post('/api/stream', async (request, reply) => {
    if (request.headers.authorization !== 'Bearer local') return reply.code(401).send({ error: '缺少代理令牌' });
    const body = request.body;
    if (!isRecord(body) || !isRecord(body.context) || !Array.isArray(body.context.messages)) {
      return reply.code(400).send({ error: '模型或上下文无效' });
    }
    if (body.options !== undefined && !isRecord(body.options)) {
      return reply.code(400).send({ error: '模型选项无效' });
    }
    const requestedOptions = (body.options ?? {}) as Record<string, unknown>;
    const requestedModel = requestedProfileModel(body.model);
    const profileId = profileIdFromStreamRequest(requestedOptions);
    const candidate = profileId ? store.get(profileId) : undefined;
    if (!profileId && !store.snapshot().activeProfileId) return reply.code(503).send({ error: 'Agent 尚未配置模型。' });
    if (!requestedModel || !profileId || !candidate || !isDeepStrictEqual(buildProfileModel(candidate), requestedModel)) {
      return reply.code(400).send({ error: '模型或配置 ID 无效' });
    }
    const profile = resolveStreamProfile(store, profileId, requestedModel);
    if (!profile) return reply.code(503).send({ error: '当前配置没有可用的 API Key' });

    const options: SimpleStreamOptions = { apiKey: profile.apiKey };
    if (typeof requestedOptions.temperature === 'number' && Number.isFinite(requestedOptions.temperature)) {
      options.temperature = requestedOptions.temperature;
    }
    if (typeof requestedOptions.maxTokens === 'number' && Number.isInteger(requestedOptions.maxTokens)) {
      options.maxTokens = Math.min(Math.max(requestedOptions.maxTokens, 1), requestedModel.maxTokens || 8192);
    }
    if (typeof requestedOptions.reasoning === 'string') options.reasoning = requestedOptions.reasoning as SimpleStreamOptions['reasoning'];
    const metadata = isRecord(requestedOptions.metadata) ? { ...requestedOptions.metadata } : undefined;
    if (metadata) {
      delete metadata.todoTreeProfileId;
      if (Object.keys(metadata).length > 0) options.metadata = metadata;
    }
    const abort = new AbortController();
    options.signal = abort.signal;
    reply.raw.on('close', () => abort.abort());
    const source = async function* (): AsyncGenerator<string> {
      try {
        for await (const event of runtime.stream(profile, body.context as unknown as TranscriptContext, options)) {
          yield `data: ${JSON.stringify(proxyEvent(event))}\n\n`;
        }
      } catch (error) {
        const message = safeProviderError(error);
        yield `data: ${JSON.stringify({ type: 'error', reason: 'error', errorMessage: message, usage: {
          input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        } })}\n\n`;
      }
    };
    return reply.header('content-type', 'text/event-stream; charset=utf-8')
      .header('cache-control', 'no-cache')
      .header('x-content-type-options', 'nosniff')
      .send(Readable.from(source()));
  });

  return app;
}
