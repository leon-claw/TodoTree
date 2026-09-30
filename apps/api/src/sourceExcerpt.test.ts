import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readIndexedSource } from './sourceExcerpt';

const execFileAsync = promisify(execFile);
let root: string;
let outside: string;
const sourceLines = Array.from({ length: 100 }, (_, index) => `line-${index + 1}`).join('\n');
const indexed = [
  'apps/web/src/storage.ts', 'apps/web/src/untracked.ts', 'apps/web/.env.local',
  'apps/web/src/escape.ts', 'README.md', 'docs/design.md', '.env',
];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'todotree-source-excerpt-'));
  outside = await mkdtemp(join(tmpdir(), 'todotree-source-outside-'));
  await mkdir(join(root, 'apps/web/src'), { recursive: true });
  await mkdir(join(root, 'apps/web'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'apps/web/src/storage.ts'), sourceLines);
  await writeFile(join(root, 'apps/web/src/untracked.ts'), 'untracked');
  await writeFile(join(root, 'apps/web/.env.local'), 'SECRET=do-not-read');
  await writeFile(join(root, 'README.md'), 'project docs');
  await writeFile(join(root, 'docs/design.md'), 'design docs');
  await writeFile(join(root, '.env'), 'ROOT_SECRET=do-not-read');
  await writeFile(join(outside, 'secret.ts'), 'outside');
  await symlink(join(outside, 'secret.ts'), join(root, 'apps/web/src/escape.ts'));
  await execFileAsync('git', ['init', '--quiet'], { cwd: root });
  await execFileAsync('git', ['add', '--', 'apps/web/src/storage.ts', 'apps/web/.env.local', 'README.md', 'docs/design.md', '.env', 'apps/web/src/escape.ts'], { cwd: root });
  await mkdir(join(root, 'graphify-out'));
  await writeFile(join(root, 'graphify-out/graph.json'), JSON.stringify({ nodes: indexed.map((source_file) => ({ source_file })) }));
});
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  if (outside) await rm(outside, { recursive: true, force: true });
});

describe('readIndexedSource', () => {
  it('reads at most 80 lines from a tracked indexed source and permits indexed root docs', async () => {
    const result = await readIndexedSource(root, 'apps/web/src/storage.ts', 2);
    expect(result.path).toBe('apps/web/src/storage.ts');
    expect(result.startLine).toBe(2);
    expect(result.lines).toHaveLength(80);
    expect(result.lines[0]).toBe('line-2');
    expect(result.lines.at(-1)).toBe('line-81');
    expect(result.lines).not.toContain('line-82');
    expect((await readIndexedSource(root, 'README.md', 1)).lines).toEqual(['project docs']);
  });

  it('rejects unindexed, traversal, absolute, hidden, secret and untracked paths', async () => {
    for (const file of ['apps/web/src/not-indexed.ts', '../outside/secret.ts', join(outside, 'secret.ts'),
      '.env', 'apps/web/.env.local', 'apps/web/src/untracked.ts', 'node_modules/pkg/index.js']) {
      await expect(readIndexedSource(root, file, 1), file).rejects.toThrow();
    }
  });

  it('rejects symlinks outside the checkout and invalid line numbers', async () => {
    await expect(readIndexedSource(root, 'apps/web/src/escape.ts', 1)).rejects.toThrow();
    for (const line of [0, -1, 1.5, Number.NaN, 101]) {
      await expect(readIndexedSource(root, 'apps/web/src/storage.ts', line)).rejects.toThrow();
    }
  });

  it('rejects non-text and oversized source files', async () => {
    await writeFile(join(root, 'apps/web/src/binary.ts'), Buffer.from([0xff, 0x00]));
    await writeFile(join(root, 'apps/web/src/large.ts'), 'x'.repeat(1_048_577));
    await execFileAsync('git', ['add', '--', 'apps/web/src/binary.ts', 'apps/web/src/large.ts'], { cwd: root });
    await writeFile(join(root, 'graphify-out/graph.json'), JSON.stringify({ nodes: [
      { source_file: 'apps/web/src/binary.ts' }, { source_file: 'apps/web/src/large.ts' },
    ] }));
    await expect(readIndexedSource(root, 'apps/web/src/binary.ts', 1)).rejects.toThrow();
    await expect(readIndexedSource(root, 'apps/web/src/large.ts', 1)).rejects.toThrow();
  });
});
