import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApi } from './app.js';
import { loadAgentConfig } from './config.js';

const webDist = resolve(fileURLToPath(new URL('../../web/dist/', import.meta.url)));
const app = createApi(loadAgentConfig(process.env), undefined, webDist);
const port = Number(process.env.TODOTREE_PORT ?? 3001);
const host = process.env.TODOTREE_HOST ?? '127.0.0.1';
await app.listen({ port, host });
