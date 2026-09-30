import { execFile } from 'node:child_process';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import { posix, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GRAPH_FILE = 'graphify-out/graph.json';
const MAX_GRAPH_BYTES = 32 * 1024 * 1024;
const MAX_SOURCE_BYTES = 1_048_576;
const MAX_LINES = 80;
const ROOT_DOCUMENTS = new Set(['README.md', 'DESIGN.md', 'package.json', 'pnpm-workspace.yaml']);
const SECRET_FILE = /(^|[._-])(secret|credentials?|tokens?)([._-]|$)|\.(env|pem|key|p12|pfx|jks)$/i;
const FORBIDDEN_DIRECTORY = new Set(['node_modules', 'dist', 'build', 'coverage']);

export class SourceExcerptError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'SourceExcerptError';
  }
}

function isWithin(root: string, path: string): boolean {
  const relativePath = relative(root, path);
  return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !posix.isAbsolute(relativePath));
}

function normalizeSourcePath(sourceFile: string): string {
  if (typeof sourceFile !== 'string' || !sourceFile || sourceFile.length > 300 || sourceFile.includes('\0') || sourceFile.includes('\\')
    || sourceFile.startsWith('/') || /^[A-Za-z]:/.test(sourceFile)) {
    throw new SourceExcerptError('源码路径必须是项目内的相对路径', 400);
  }
  const segments = sourceFile.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.')
    || FORBIDDEN_DIRECTORY.has(segment.toLowerCase()))) {
    throw new SourceExcerptError('源码路径包含禁止的目录或文件', 403);
  }
  const name = segments.at(-1) ?? '';
  if (SECRET_FILE.test(name)) throw new SourceExcerptError('不能读取密钥或凭据文件', 403);
  const allowedScope = segments[0] === 'apps' || segments[0] === 'docs'
    ? segments.length >= 2
    : segments.length === 1 && (ROOT_DOCUMENTS.has(name) || /^tsconfig.*\.json$/i.test(name));
  if (!allowedScope) throw new SourceExcerptError('源码不在允许的项目目录范围内', 403);
  return segments.join('/');
}

async function indexedSources(projectRoot: string): Promise<Set<string>> {
  let graphBuffer: Buffer;
  try { graphBuffer = await readFile(resolve(projectRoot, GRAPH_FILE)); }
  catch { throw new SourceExcerptError('Graphify 图谱不存在或无法读取', 503); }
  if (graphBuffer.byteLength > MAX_GRAPH_BYTES) throw new SourceExcerptError('Graphify 图谱文件超过读取上限', 503);
  let graph: unknown;
  try { graph = JSON.parse(graphBuffer.toString('utf8')); }
  catch { throw new SourceExcerptError('Graphify 图谱格式无效', 503); }
  if (!graph || typeof graph !== 'object') throw new SourceExcerptError('Graphify 图谱格式无效', 503);
  const graphRecord = graph as Record<string, unknown>;
  const graphData = graphRecord.graph && typeof graphRecord.graph === 'object'
    ? graphRecord.graph as Record<string, unknown> : {};
  const sources = new Set<string>();
  for (const key of ['nodes', 'edges', 'links', 'hyperedges']) {
    for (const holder of [graphRecord, graphData]) {
      const values = holder[key];
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        if (value && typeof value === 'object' && 'source_file' in value && typeof value.source_file === 'string') {
          sources.add(value.source_file);
        }
      }
    }
  }
  return sources;
}

async function requireTrackedFile(projectRoot: string, sourceFile: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--error-unmatch', '--', sourceFile], {
      cwd: projectRoot, timeout: 2_000, maxBuffer: 16_384, encoding: 'utf8', windowsHide: true,
    });
    if (!stdout.split(/\r?\n/).includes(sourceFile)) throw new Error('not tracked');
  } catch {
    throw new SourceExcerptError('源码不在当前 Git 检出中跟踪', 403);
  }
}

export async function readIndexedSource(
  projectRoot: string,
  sourceFile: string,
  startLine: number,
): Promise<{ path: string; startLine: number; lines: string[] }> {
  const normalized = normalizeSourcePath(sourceFile);
  if (!Number.isSafeInteger(startLine) || startLine < 1) throw new SourceExcerptError('起始行号必须是正整数', 400);
  const indexed = await indexedSources(projectRoot);
  if (!indexed.has(normalized)) throw new SourceExcerptError('该文件不在当前 Graphify 图谱的来源索引中', 403);

  const rootReal = await realpath(projectRoot).catch(() => {
    throw new SourceExcerptError('项目根目录无法解析', 503);
  });
  const candidate = resolve(rootReal, ...normalized.split('/'));
  if (!isWithin(rootReal, candidate)) throw new SourceExcerptError('源码路径超出项目根目录', 403);
  const canonical = await realpath(candidate).catch(() => {
    throw new SourceExcerptError('来源文件不存在或无法解析', 404);
  });
  if (!isWithin(rootReal, canonical)) throw new SourceExcerptError('来源文件符号链接超出项目根目录', 403);
  const canonicalRelative = relative(rootReal, canonical).split(sep).join('/');
  normalizeSourcePath(canonicalRelative);
  if (!indexed.has(canonicalRelative)) throw new SourceExcerptError('符号链接目标不在 Graphify 来源索引中', 403);
  await requireTrackedFile(rootReal, normalized);
  if (canonicalRelative !== normalized) await requireTrackedFile(rootReal, canonicalRelative);

  const metadata = await lstat(candidate).catch(() => null);
  if (metadata?.isSymbolicLink()) {
    const resolvedMetadata = await stat(canonical).catch(() => null);
    if (!resolvedMetadata?.isFile()) throw new SourceExcerptError('来源不是普通文件', 403);
  } else if (!metadata?.isFile()) {
    throw new SourceExcerptError('来源不是普通文件', 403);
  }
  const fileInfo = await stat(canonical);
  if (fileInfo.size > MAX_SOURCE_BYTES) throw new SourceExcerptError('源码文件超过 1 MiB 读取上限', 413);
  const bytes = await readFile(canonical);
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new SourceExcerptError('源码文件超过 1 MiB 读取上限', 413);
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new SourceExcerptError('源码不是有效的 UTF-8 文本', 415); }
  if (text.includes('\0')) throw new SourceExcerptError('源码包含二进制内容，拒绝读取', 415);
  const lines = text.split(/\r?\n/);
  if (startLine > lines.length) throw new SourceExcerptError('起始行号超出文件范围', 400);
  return { path: normalized, startLine, lines: lines.slice(startLine - 1, startLine - 1 + MAX_LINES) };
}
