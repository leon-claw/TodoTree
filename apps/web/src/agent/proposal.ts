import { applyPatch } from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import type { AppData, Todo, Tag } from '../types';
import { validateAppData } from '../storage';

export interface AgentProposal {
  baseVersion: string;
  base: AppData;
  patch: Operation[];
  next: AppData;
}

export type ProposalResult =
  | { ok: true; proposal: AgentProposal }
  | { ok: false; error: string };

type PathKind = 'todoNode' | 'tagNode' | 'todoField' | 'tagField' | 'todoId' | 'tagId' | 'tagIds' | 'tagIdItem' | 'children';
const todoFields = new Set(['id', 'title', 'note', 'dueDate', 'importance', 'urgency', 'tagIds', 'children', 'completed']);
const tagFields = new Set(['id', 'title', 'color']);
const unsafeTokens = new Set(['__proto__', 'prototype', 'constructor']);
const arrayIndex = /^(0|[1-9]\d*|-)$/;

function pointerTokens(pointer: string): string[] {
  if (!pointer.startsWith('/')) throw new Error('Patch 路径必须是 JSON Pointer');
  const tokens = pointer.slice(1).split('/').map((part) => {
    if (/~(?![01])/.test(part)) throw new Error('Patch 路径包含无效转义');
    return part.replace(/~1/g, '/').replace(/~0/g, '~');
  });
  if (tokens.some((part) => unsafeTokens.has(part))) throw new Error('Patch 路径包含禁止的属性');
  return tokens;
}

function pathKind(pointer: string): PathKind {
  const tokens = pointerTokens(pointer);
  const root = tokens.shift();
  if (root !== 'todos' && root !== 'tags') throw new Error('Agent 只能修改任务和标签');
  const firstIndex = tokens.shift();
  if (!firstIndex || !arrayIndex.test(firstIndex)) throw new Error('不能替换整个任务或标签列表');
  if (root === 'tags') {
    if (tokens.length === 0) return 'tagNode';
    const field = tokens.shift();
    if (!field || !tagFields.has(field) || tokens.length) throw new Error('标签字段路径无效');
    return field === 'id' ? 'tagId' : 'tagField';
  }
  while (true) {
    if (tokens.length === 0) return 'todoNode';
    const field = tokens.shift();
    if (!field || !todoFields.has(field)) throw new Error('任务字段路径无效');
    if (field === 'children') {
      if (tokens.length === 0) return 'children';
      const index = tokens.shift();
      if (!index || !arrayIndex.test(index)) throw new Error('子任务索引无效');
      continue;
    }
    if (field === 'tagIds') {
      if (tokens.length === 0) return 'tagIds';
      const index = tokens.shift();
      if (!index || !arrayIndex.test(index) || tokens.length) throw new Error('标签引用路径无效');
      return 'tagIdItem';
    }
    if (tokens.length) throw new Error('任务字段路径无效');
    return field === 'id' ? 'todoId' : 'todoField';
  }
}

function checkPatch(patch: Operation[]): void {
  if (!Array.isArray(patch) || patch.length === 0 || patch.length > 200 || JSON.stringify(patch).length > 262144) {
    throw new Error('Patch 为空或过大');
  }
  for (const operation of patch) {
    if (!operation || typeof operation !== 'object' || typeof operation.op !== 'string' || typeof operation.path !== 'string') {
      throw new Error('Patch 操作无效');
    }
    if (!['add', 'remove', 'replace', 'move', 'copy', 'test'].includes(operation.op)) {
      throw new Error('不支持的 Patch 操作');
    }
    const kind = pathKind(operation.path);
    if ((kind === 'todoId' || kind === 'tagId' || kind === 'children') && operation.op !== 'test') {
      throw new Error('不能修改稳定 ID 或直接替换子任务数组');
    }
    if ((kind === 'todoNode' || kind === 'tagNode') && operation.op === 'replace') {
      throw new Error('不能整体替换现有任务或标签');
    }
    if (operation.op === 'move' || operation.op === 'copy') {
      if (!('from' in operation) || typeof operation.from !== 'string') throw new Error('Patch 缺少来源路径');
      const fromKind = pathKind(operation.from);
      if (fromKind === 'todoId' || fromKind === 'tagId' || fromKind === 'children') throw new Error('不能移动稳定 ID 或子任务数组');
      if (operation.op === 'move' && fromKind !== kind) throw new Error('移动来源与目标类型不符');
    }
  }
}

function collectNodes(data: AppData): { todos: Map<string, Todo>; tags: Map<string, Tag> } {
  const todos = new Map<string, Todo>();
  const visit = (items: Todo[]) => {
    for (const todo of items) {
      todos.set(todo.id, todo);
      visit(todo.children);
    }
  };
  visit(data.todos);
  return { todos, tags: new Map(data.tags.map((tag) => [tag.id, tag])) };
}

function unknownFields(value: object, known: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !known.has(key)));
}

function checkIdentityAndExtraFields(base: AppData, next: AppData): void {
  const before = collectNodes(base);
  const after = collectNodes(next);
  for (const [id, item] of after.todos) {
    const old = before.todos.get(id);
    if ((!old || old.title !== item.title) && !item.title.trim()) throw new Error('新增或改名任务的标题不能为空');
    const extra = unknownFields(item, todoFields);
    if (JSON.stringify(extra) !== JSON.stringify(old ? unknownFields(old, todoFields) : {})) {
      throw new Error('Agent 不可增改模型之外的任务字段');
    }
  }
  for (const [id, item] of after.tags) {
    const old = before.tags.get(id);
    const extra = unknownFields(item, tagFields);
    if (JSON.stringify(extra) !== JSON.stringify(old ? unknownFields(old, tagFields) : {})) {
      throw new Error('Agent 不可增改模型之外的标签字段');
    }
  }
}

export function readSnapshot(data: AppData): { baseVersion: string; data: AppData } {
  return { baseVersion: crypto.randomUUID(), data: structuredClone(data) };
}

export function createProposal(
  base: AppData,
  current: AppData,
  baseVersion: string,
  receivedVersion: string,
  patch: Operation[],
): ProposalResult {
  if (baseVersion !== receivedVersion || JSON.stringify(base) !== JSON.stringify(current)) {
    return { ok: false, error: '任务数据已变化，请重新读取后生成提案' };
  }
  try {
    checkPatch(patch);
    const copiedPatch = structuredClone(patch);
    const result = applyPatch(structuredClone(base), copiedPatch, true, false, true);
    if (result.some((operation) => operation.test === false)) throw new Error('Patch 前置条件不成立');
    const next = result.newDocument;
    const validated = validateAppData(next);
    if (!validated.valid) throw new Error(validated.error);
    checkIdentityAndExtraFields(base, validated.data);
    if (JSON.stringify(base) === JSON.stringify(validated.data)) throw new Error('提案未产生实际变化');
    return { ok: true, proposal: { baseVersion, base: structuredClone(base), patch: copiedPatch, next: validated.data } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Patch 无效' };
  }
}

export function revalidateProposal(current: AppData, proposal: AgentProposal): ProposalResult {
  const result = createProposal(proposal.base, current, proposal.baseVersion, proposal.baseVersion, proposal.patch);
  if (!result.ok) return result;
  if (JSON.stringify(result.proposal.next) !== JSON.stringify(proposal.next)) {
    return { ok: false, error: '提案内容已变化，请重新生成' };
  }
  return result;
}
