import { applyPatch } from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import type { AppData, Todo, Tag } from '../types';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface EntityChange {
  id: string;
  title: string;
  beforePath?: string[];
  afterPath?: string[];
  fields?: FieldChange[];
  deletion?: 'direct' | 'cascade';
}

export interface AppDataChangeSummary {
  todos: { added: EntityChange[]; updated: EntityChange[]; moved: EntityChange[]; deleted: EntityChange[] };
  tags: { added: EntityChange[]; updated: EntityChange[]; moved: EntityChange[]; deleted: EntityChange[] };
  totals: { added: number; updated: number; moved: number; deleted: number; directDeleted: number; cascadeDeleted: number };
}

interface IndexedTodo {
  todo: Todo;
  parentId: string | null;
  path: string[];
}

function indexTodos(data: AppData): Map<string, IndexedTodo> {
  const index = new Map<string, IndexedTodo>();
  const visit = (items: Todo[], parentId: string | null, prefix: string[]) => {
    for (const todo of items) {
      const path = [...prefix, todo.title];
      index.set(todo.id, { todo, parentId, path });
      visit(todo.children, todo.id, path);
    }
  };
  visit(data.todos, null, []);
  return index;
}

function pointerValue(data: AppData, pointer: string): unknown {
  if (!pointer.startsWith('/')) throw new Error('Patch 路径无效');
  return pointer.slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((value, part) => value && typeof value === 'object'
      ? (value as Record<string, unknown>)[part]
      : undefined, data);
}

function todoFields(before: Todo, after: Todo): FieldChange[] {
  const names: (keyof Todo)[] = ['title', 'note', 'dueDate', 'importance', 'urgency', 'tagIds', 'completed'];
  return names.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

function tagFields(before: Tag, after: Tag): FieldChange[] {
  const names: (keyof Tag)[] = ['title', 'color'];
  return names.filter((field) => before[field] !== after[field])
    .map((field) => ({ field, before: before[field], after: after[field] }));
}

export function describeAppDataChange(before: AppData, after: AppData, patch: Operation[]): AppDataChangeSummary {
  let working = structuredClone(before);
  const directlyRemovedTodos = new Set<string>();
  const directlyRemovedTags = new Set<string>();
  const movedTodos = new Set<string>();
  const movedTags = new Set<string>();
  for (const operation of patch) {
    if (operation.op === 'remove' || operation.op === 'move') {
      const value = pointerValue(working, operation.op === 'move' ? operation.from : operation.path);
      if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
        const isTodo = 'children' in value;
        if (operation.op === 'remove') (isTodo ? directlyRemovedTodos : directlyRemovedTags).add(value.id);
        else (isTodo ? movedTodos : movedTags).add(value.id);
      }
    }
    working = applyPatch(working, [operation], true, false, true).newDocument;
  }
  if (JSON.stringify(working) !== JSON.stringify(after)) throw new Error('Patch 与实际差异不一致');

  const oldTodos = indexTodos(before);
  const newTodos = indexTodos(after);
  const oldTags = new Map(before.tags.map((tag) => [tag.id, tag]));
  const newTags = new Map(after.tags.map((tag) => [tag.id, tag]));
  const todos: AppDataChangeSummary['todos'] = { added: [], updated: [], moved: [], deleted: [] };
  const tags: AppDataChangeSummary['tags'] = { added: [], updated: [], moved: [], deleted: [] };

  for (const [id, next] of newTodos) {
    const old = oldTodos.get(id);
    if (!old) {
      todos.added.push({ id, title: next.todo.title, afterPath: next.path });
      continue;
    }
    const fields = todoFields(old.todo, next.todo);
    if (fields.length) todos.updated.push({ id, title: next.todo.title, beforePath: old.path, afterPath: next.path, fields });
    if (old.parentId !== next.parentId || movedTodos.has(id)) {
      todos.moved.push({ id, title: next.todo.title, beforePath: old.path, afterPath: next.path });
    }
  }
  for (const [id, old] of oldTodos) {
    if (!newTodos.has(id)) todos.deleted.push({ id, title: old.todo.title, beforePath: old.path,
      deletion: directlyRemovedTodos.has(id) ? 'direct' : 'cascade' });
  }
  for (const [id, next] of newTags) {
    const old = oldTags.get(id);
    if (!old) {
      tags.added.push({ id, title: next.title, afterPath: [next.title] });
      continue;
    }
    const fields = tagFields(old, next);
    if (fields.length) tags.updated.push({ id, title: next.title, beforePath: [old.title], afterPath: [next.title], fields });
    if (movedTags.has(id)) tags.moved.push({ id, title: next.title, beforePath: [old.title], afterPath: [next.title] });
  }
  for (const [id, old] of oldTags) {
    if (!newTags.has(id)) tags.deleted.push({ id, title: old.title, beforePath: [old.title],
      deletion: directlyRemovedTags.has(id) ? 'direct' : 'cascade' });
  }
  const deleted = [...todos.deleted, ...tags.deleted];
  return {
    todos, tags,
    totals: {
      added: todos.added.length + tags.added.length,
      updated: todos.updated.length + tags.updated.length,
      moved: todos.moved.length + tags.moved.length,
      deleted: deleted.length,
      directDeleted: deleted.filter((item) => item.deletion === 'direct').length,
      cascadeDeleted: deleted.filter((item) => item.deletion === 'cascade').length,
    },
  };
}
