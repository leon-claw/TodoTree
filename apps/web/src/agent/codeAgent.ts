import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from '@earendil-works/pi-ai';

export interface GraphStatusResponse { available: boolean; builtAtCommit: string | null }
export interface GraphResult { result: string }
export interface SourceExcerpt { path: string; startLine: number; lines: string[] }
export interface GraphApi {
  status: (signal?: AbortSignal) => Promise<GraphStatusResponse>;
  query: (question: string, signal?: AbortSignal) => Promise<GraphResult>;
  path: (from: string, to: string, signal?: AbortSignal) => Promise<GraphResult>;
  explain: (node: string, signal?: AbortSignal) => Promise<GraphResult>;
  source: (sourceFile: string, startLine: number, signal?: AbortSignal) => Promise<SourceExcerpt>;
}
export interface GraphToolDependencies {
  graphApi: GraphApi;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T | { error?: string };
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error : `请求失败 (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function createGraphApi(baseUrl = ''): GraphApi {
  const post = async <T>(route: string, payload: unknown, signal?: AbortSignal): Promise<T> => responseJson<T>(await fetch(`${baseUrl}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal,
  }));
  return {
    status: async (signal) => responseJson<GraphStatusResponse>(await fetch(`${baseUrl}/api/graph/status`, { signal })),
    query: (question, signal) => post('/api/graph/query', { question }, signal),
    path: (from, to, signal) => post('/api/graph/path', { from, to }, signal),
    explain: (node, signal) => post('/api/graph/explain', { node }, signal),
    source: (sourceFile, startLine, signal) => post('/api/graph/source', { sourceFile, startLine }, signal),
  };
}

function textResult(result: GraphResult) {
  return { content: [{ type: 'text' as const, text: result.result }], details: result };
}

export function createGraphTools({ graphApi }: GraphToolDependencies): AgentTool[] {
  const queryParameters = Type.Object({ question: Type.String() });
  const queryTool: AgentTool<typeof queryParameters> = {
    name: 'query_project_graph',
    label: '查询项目图谱',
    description: '在 Graphify 架构图中查询相关节点和边，并返回带来源位置的局部结果。',
    parameters: queryParameters,
    execute: async (_id, params, signal) => textResult(await graphApi.query(params.question, signal)),
  };
  const pathParameters = Type.Object({ from: Type.String(), to: Type.String() });
  const pathTool: AgentTool<typeof pathParameters> = {
    name: 'trace_project_graph',
    label: '追踪模块关系',
    description: '查询两个项目概念之间的 Graphify 关系路径；无路径时如实说明。',
    parameters: pathParameters,
    execute: async (_id, params, signal) => textResult(await graphApi.path(params.from, params.to, signal)),
  };
  const explainParameters = Type.Object({ node: Type.String() });
  const explainTool: AgentTool<typeof explainParameters> = {
    name: 'explain_project_node',
    label: '解释项目节点',
    description: '查询一个图谱节点及其局部关系，并保留图谱来源和置信标记。',
    parameters: explainParameters,
    execute: async (_id, params, signal) => textResult(await graphApi.explain(params.node, signal)),
  };
  const sourceParameters = Type.Object({ sourceFile: Type.String(), startLine: Type.Number() });
  const sourceTool: AgentTool<typeof sourceParameters> = {
    name: 'read_indexed_source',
    label: '读取已索引源码',
    description: '仅读取当前 Graphify 图谱已索引并由后端许可的源码摘录，最多 80 行。',
    parameters: sourceParameters,
    execute: async (_id, params, signal) => {
      const excerpt = await graphApi.source(params.sourceFile, params.startLine, signal);
      return {
        content: [{ type: 'text', text: JSON.stringify(excerpt) }],
        details: excerpt,
      };
    },
  };

  return [queryTool, pathTool, explainTool, sourceTool];
}
