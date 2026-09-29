import { isDeepStrictEqual } from 'node:util';
import { Readable } from 'node:stream';
import { extname } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import type { Api, AssistantMessageEvent, Model, SimpleStreamOptions, TranscriptContext } from '@earendil-works/pi-ai';
import type { FastifyInstance } from 'fastify';
import type { ServerModelConfig } from './config.js';

type ModelStreamer = (
  model: Model<Api>,
  context: TranscriptContext,
  options: SimpleStreamOptions,
) => AsyncIterable<AssistantMessageEvent>;

const models = builtinModels();
const defaultStreamModel: ModelStreamer = (model, context, options) => models.streamSimple(model, context, options);

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
      errorMessage: event.error.errorMessage ?? '模型请求失败' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createApi(
  config: ServerModelConfig | null,
  streamModel: ModelStreamer = defaultStreamModel,
  webDist?: string,
): FastifyInstance {
  const app = Fastify({ bodyLimit: 4 * 1024 * 1024 });
  if (webDist) {
    app.register(fastifyStatic, { root: webDist, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/') && !extname(request.url.split('?')[0])) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not Found' });
    });
  }

  app.get('/api/agent-config', async () => config
    ? { available: true, model: config.model }
    : { available: false });

  app.post('/api/stream', async (request, reply) => {
    if (!config) return reply.code(503).send({ error: 'Agent 未配置' });
    if (request.headers.authorization !== 'Bearer local') return reply.code(401).send({ error: '缺少代理令牌' });
    const body = request.body;
    if (!isRecord(body) || !isRecord(body.model) || !isRecord(body.context)
      || !Array.isArray(body.context.messages) || !isDeepStrictEqual(body.model, config.model)) {
      return reply.code(400).send({ error: '模型或上下文无效' });
    }
    if (body.options !== undefined && !isRecord(body.options)) {
      return reply.code(400).send({ error: '模型选项无效' });
    }
    const requestedOptions = (body.options ?? {}) as Record<string, unknown>;
    const options: SimpleStreamOptions = { apiKey: config.apiKey };
    if (typeof requestedOptions.temperature === 'number' && Number.isFinite(requestedOptions.temperature)) {
      options.temperature = requestedOptions.temperature;
    }
    if (typeof requestedOptions.maxTokens === 'number' && Number.isInteger(requestedOptions.maxTokens)) {
      options.maxTokens = Math.min(Math.max(requestedOptions.maxTokens, 1), config.model.maxTokens || 8192);
    }
    if (typeof requestedOptions.reasoning === 'string') options.reasoning = requestedOptions.reasoning as SimpleStreamOptions['reasoning'];
    const abort = new AbortController();
    options.signal = abort.signal;
    reply.raw.on('close', () => abort.abort());
    const source = async function* (): AsyncGenerator<string> {
      try {
        for await (const event of streamModel(config.model, body.context as unknown as TranscriptContext, options)) {
          yield `data: ${JSON.stringify(proxyEvent(event))}\n\n`;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '模型请求失败';
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
