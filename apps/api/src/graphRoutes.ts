import type { FastifyInstance, FastifyRequest } from 'fastify';
import { GraphifyError, readGraphStatus, runGraphify } from './graphRunner.js';
import type { GraphifyInput, GraphifyOptions } from './graphRunner.js';
import { readIndexedSource, SourceExcerptError } from './sourceExcerpt.js';

interface Counter { windowStartedAt: number; count: number; active: number }
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_CONCURRENT = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clientKey(request: FastifyRequest): string { return request.ip; }

export function registerGraphRoutes(app: FastifyInstance, projectRoot: string, options: Omit<GraphifyOptions, 'projectRoot'> = {}): void {
  const runnerOptions: GraphifyOptions = { ...options, projectRoot };
  const counters = new Map<string, Counter>();
  const acquire = (request: FastifyRequest): (() => void) | null => {
    const now = Date.now();
    const key = clientKey(request);
    let counter = counters.get(key);
    if (!counter || now - counter.windowStartedAt >= WINDOW_MS) {
      counter = { windowStartedAt: now, count: 0, active: 0 };
      counters.set(key, counter);
    }
    if (counter.count >= MAX_REQUESTS_PER_WINDOW || counter.active >= MAX_CONCURRENT) return null;
    counter.count += 1;
    counter.active += 1;
    return () => { counter!.active = Math.max(0, counter!.active - 1); };
  };

  app.get('/api/graph/status', async () => readGraphStatus(runnerOptions));

  const registerOperation = (url: string, parse: (body: Record<string, unknown>) => GraphifyInput) => {
    app.post(url, async (request, reply) => {
      if (!isRecord(request.body)) return reply.code(400).send({ error: '请求内容必须是 JSON 对象' });
      const release = acquire(request);
      if (!release) return reply.code(429).send({ error: 'Graphify 查询过于频繁，请稍后重试' });
      const abort = new AbortController();
      const abortRequest = () => abort.abort();
      request.raw.once('aborted', abortRequest);
      reply.raw.once('close', () => { if (!reply.raw.writableEnded) abortRequest(); });
      try {
        const result = await runGraphify(parse(request.body), abort.signal, runnerOptions);
        return { result };
      } catch (error) {
        const graphError = error instanceof GraphifyError ? error : new GraphifyError('Graphify 查询失败', 502);
        return reply.code(graphError.statusCode).send({ error: graphError.message });
      } finally {
        request.raw.off('aborted', abortRequest);
        release();
      }
    });
  };

  registerOperation('/api/graph/query', (body) => ({ kind: 'query', question: body.question as string }));
  registerOperation('/api/graph/path', (body) => ({ kind: 'path', from: body.from as string, to: body.to as string }));
  registerOperation('/api/graph/explain', (body) => ({ kind: 'explain', node: body.node as string }));

  app.post('/api/graph/source', async (request, reply) => {
    if (!isRecord(request.body)) return reply.code(400).send({ error: '请求内容必须是 JSON 对象' });
    const release = acquire(request);
    if (!release) return reply.code(429).send({ error: 'Graphify 查询过于频繁，请稍后重试' });
    try {
      const result = await readIndexedSource(projectRoot, request.body.sourceFile as string, request.body.startLine as number);
      return result;
    } catch (error) {
      if (error instanceof SourceExcerptError) return reply.code(error.statusCode).send({ error: error.message });
      return reply.code(502).send({ error: '读取索引源码失败' });
    } finally { release(); }
  });
}
