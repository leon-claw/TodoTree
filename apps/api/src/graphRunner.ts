import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { ChildProcess } from 'node:child_process';

export type GraphifyInput =
  | { kind: 'query'; question: string }
  | { kind: 'path'; from: string; to: string }
  | { kind: 'explain'; node: string };

export interface GraphifyOptions {
  projectRoot: string;
  executable?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
}

export class GraphifyError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'GraphifyError';
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_OUTPUT_LIMIT = 64 * 1024;
const GRAPH_FILE = 'graphify-out/graph.json';

function validateText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000 || value.includes('\0') || value.trimStart().startsWith('-')) {
    throw new GraphifyError(`${name} 必须是 1–1000 个字符的普通文本，且不能以连字符开头`, 400);
  }
  return value.trim();
}

function argumentsFor(input: GraphifyInput): string[] {
  switch (input.kind) {
    case 'query': return ['query', validateText(input.question, '问题'), '--budget', '2000'];
    case 'path': return ['path', validateText(input.from, '起点'), validateText(input.to, '终点'), '--undirected'];
    case 'explain': return ['explain', validateText(input.node, '节点名')];
  }
}

async function executablePath(options: GraphifyOptions): Promise<string | null> {
  const configured = options.executable ?? process.env.TODOTREE_GRAPHIFY_BIN;
  const candidates = configured ? [configured] : (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, 'graphify'));
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return candidate; } catch { /* try next PATH entry */ }
  }
  return null;
}

async function ensureGraph(options: GraphifyOptions): Promise<void> {
  try { await access(join(options.projectRoot, GRAPH_FILE)); }
  catch { throw new GraphifyError('Graphify 图谱不存在；请在项目检出中运行 graphify update .', 503); }
}

function execute(executable: string, args: string[], options: GraphifyOptions, signal?: AbortSignal): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_OUTPUT_LIMIT;
  return new Promise((resolve, reject) => {
    let child: ChildProcess | undefined;
    try {
      child = execFile(executable, args, {
        cwd: options.projectRoot,
        env: { ...process.env, ...options.env },
        timeout: timeoutMs,
        maxBuffer: maxOutputBytes,
        encoding: 'utf8',
        windowsHide: true,
        signal,
      }, (error, stdout, stderr) => {
        if (error) {
          if (signal?.aborted || error.name === 'AbortError') {
            reject(new GraphifyError('Graphify 查询已取消', 499));
          } else if (error.killed || error.code === 'ETIMEDOUT') {
            reject(new GraphifyError(`Graphify 查询超过 ${timeoutMs} 毫秒，已停止`, 504));
          } else if ((error as NodeJS.ErrnoException).code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
            reject(new GraphifyError(`Graphify 输出超过 ${maxOutputBytes} 字节上限`, 502));
          } else if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new GraphifyError('找不到 Graphify CLI；请安装 Graphify 并确保服务进程的 PATH 可访问它', 503));
          } else {
            const detail = String(stderr || error.message).trim().slice(0, 1200);
            reject(new GraphifyError(`Graphify 查询失败${detail ? `：${detail}` : ''}`, 502));
          }
          return;
        }
        const result = String(stdout).trim();
        if (!result) {
          reject(new GraphifyError('Graphify 没有返回结果；请缩小问题范围或检查图谱内容', 404));
          return;
        }
        resolve(result);
      });
    } catch (error) {
      reject(new GraphifyError(error instanceof Error ? error.message : '无法启动 Graphify CLI', 503));
    }
    if (signal?.aborted) child?.kill();
  });
}

export async function runGraphify(input: GraphifyInput, signal?: AbortSignal, options?: GraphifyOptions): Promise<string> {
  if (!options) throw new GraphifyError('Graphify 项目目录未配置', 503);
  const args = argumentsFor(input);
  await ensureGraph(options);
  const executable = await executablePath(options);
  if (!executable) throw new GraphifyError('找不到 Graphify CLI；请安装 Graphify 并确保服务进程的 PATH 可访问它', 503);
  return execute(executable, args, options, signal);
}

export async function readGraphStatus(options: GraphifyOptions): Promise<{ available: boolean; builtAtCommit: string | null }> {
  let builtAtCommit: string | null = null;
  let graphExists = false;
  try {
    const parsed: unknown = JSON.parse(await readFile(join(options.projectRoot, GRAPH_FILE), 'utf8'));
    graphExists = true;
    if (parsed && typeof parsed === 'object' && 'built_at_commit' in parsed
      && typeof parsed.built_at_commit === 'string') builtAtCommit = parsed.built_at_commit;
    if (!parsed || typeof parsed !== 'object' || !('nodes' in parsed) || !Array.isArray(parsed.nodes)) graphExists = false;
  } catch { /* missing or invalid graph is reported as unavailable */ }
  const executable = await executablePath(options);
  return { available: graphExists && executable !== null, builtAtCommit };
}
