import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApi } from './app.js';
import { openAgentProfileStore } from './profileStore.js';

const webDist = resolve(fileURLToPath(new URL('../../web/dist/', import.meta.url)));
const projectRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const profileStore = await openAgentProfileStore({ env: process.env });
const app = createApi(profileStore, undefined, webDist, projectRoot);
const port = Number(process.env.TODOTREE_PORT ?? 3001);
const host = process.env.TODOTREE_HOST ?? '127.0.0.1';
await app.listen({ port, host });
