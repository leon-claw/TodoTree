import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGraphify, GraphifyError } from './graphRunner';

const executableSource = `#!/usr/bin/env node
const fs = require('node:fs');
if (process.env.GRAPHIFY_CAPTURE) fs.writeFileSync(process.env.GRAPHIFY_CAPTURE, JSON.stringify(process.argv.slice(2)));
const delay = Number(process.env.GRAPHIFY_DELAY_MS || 0);
setTimeout(() => process.stdout.write(process.env.GRAPHIFY_OUTPUT ?? 'graph result'), delay);
`;

let root: string;
let executable: string;
let capture: string;
async function harness() {
  root = await mkdtemp(join(tmpdir(), 'todotree-graph-runner-'));
  executable = join(root, 'fake graphify');
  capture = join(root, 'args.json');
  await mkdir(join(root, 'graphify-out'));
  await writeFile(join(root, 'graphify-out', 'graph.json'), JSON.stringify({ built_at_commit: 'abc123' }));
  await writeFile(executable, executableSource);
  await chmod(executable, 0o755);
}

beforeEach(harness);
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

describe('runGraphify', () => {
  it('passes fixed query/path/explain arguments and keeps shell metacharacters inside one argument', async () => {
    const sideEffectPath = join(root, 'shell-injection-marker');
    const question = `todos; touch ${sideEffectPath}`;
    expect(await runGraphify({ kind: 'query', question }, undefined, { projectRoot: root, executable, env: { GRAPHIFY_CAPTURE: capture } })).toBe('graph result');
    expect(JSON.parse(await readFile(capture, 'utf8'))).toEqual(['query', question, '--budget', '2000']);
    await expect(access(sideEffectPath)).rejects.toThrow();
    await runGraphify({ kind: 'path', from: 'A', to: 'B' }, undefined, { projectRoot: root, executable, env: { GRAPHIFY_CAPTURE: capture } });
    expect(JSON.parse(await readFile(capture, 'utf8'))).toEqual(['path', 'A', 'B', '--undirected']);
    await runGraphify({ kind: 'explain', node: 'AppData' }, undefined, { projectRoot: root, executable, env: { GRAPHIFY_CAPTURE: capture } });
    expect(JSON.parse(await readFile(capture, 'utf8'))).toEqual(['explain', 'AppData']);
  });

  it('rejects missing graph, invalid input and empty output with readable errors', async () => {
    await rm(join(root, 'graphify-out', 'graph.json'));
    await expect(runGraphify({ kind: 'query', question: 'Where?' }, undefined, { projectRoot: root, executable }))
      .rejects.toMatchObject({ name: 'GraphifyError', statusCode: 503 });
    await writeFile(join(root, 'graphify-out', 'graph.json'), '{}');
    await expect(runGraphify({ kind: 'query', question: 'x'.repeat(1001) }, undefined, { projectRoot: root, executable }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(runGraphify({ kind: 'explain', node: '\u0000' }, undefined, { projectRoot: root, executable }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(runGraphify({ kind: 'query', question: '--budget 5' }, undefined, { projectRoot: root, executable }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(runGraphify({ kind: 'query', question: 'Where?' }, undefined, { projectRoot: root, executable, env: { GRAPHIFY_OUTPUT: '  ' } }))
      .rejects.toBeInstanceOf(GraphifyError);
  });

  it('bounds process time and captured output size', async () => {
    await expect(runGraphify({ kind: 'query', question: 'wait' }, undefined, {
      projectRoot: root, executable, timeoutMs: 120, env: { GRAPHIFY_DELAY_MS: '2000' },
    })).rejects.toMatchObject({ name: 'GraphifyError', statusCode: 504 });
    await expect(runGraphify({ kind: 'query', question: 'large' }, undefined, {
      projectRoot: root, executable, maxOutputBytes: 64, env: { GRAPHIFY_OUTPUT: 'x'.repeat(200) },
    })).rejects.toMatchObject({ name: 'GraphifyError', statusCode: 502 });
  });
});
