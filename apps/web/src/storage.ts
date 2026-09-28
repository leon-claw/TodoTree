import { AppData, Tag, Todo } from './types';

const STORAGE_KEY = 'tree_todo_app_data_v1';

export const INITIAL_DATA: AppData = {
  formatVersion: 1,
  todos: [],
  tags: [],
};

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2, 11)}_${Date.now().toString(36)}`;
}

export function createDefaultTodo(title = '新待办事项'): Todo {
  return {
    id: generateId(),
    title,
    note: '',
    dueDate: '',
    importance: 0,
    urgency: 0,
    tagIds: [],
    children: [],
    completed: false,
  };
}

export function createDefaultTag(title: string, color: string): Tag {
  return { id: generateId(), title, color };
}

export function isLeaf(todo: Todo): boolean {
  return todo.children.length === 0;
}

function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export function loadAppData(): { data: AppData; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: INITIAL_DATA, error: null };
    const validation = validateAppData(JSON.parse(raw));
    if (validation.valid) return { data: validation.data, error: null };
    return { data: INITIAL_DATA, error: `本地数据无法读取：${validation.error}。原始数据已保留。` };
  } catch {
    return { data: INITIAL_DATA, error: '本地数据无法读取。原始数据已保留。' };
  }
}

export function saveAppData(data: AppData): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return '保存失败：浏览器无法写入本地存储。请导出数据备份后再继续编辑。';
  }
}

export function validateAppData(json: unknown): { valid: true; data: AppData } | { valid: false; error: string } {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { valid: false, error: '导入内容必须是合法的 JSON 对象' };
  }
  const obj = json as Record<string, unknown>;
  if (obj.formatVersion !== 1) {
    return { valid: false, error: '不支持的数据格式版本 (formatVersion 必须为 1)' };
  }
  if (!Array.isArray(obj.tags)) return { valid: false, error: '缺少标签列表 (tags 必须为数组)' };

  const validTagIds = new Set<string>();
  for (const value of obj.tags) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, error: '存在无效的标签项' };
    }
    const tag = value as Record<string, unknown>;
    if (typeof tag.id !== 'string' || !tag.id.trim()) return { valid: false, error: '标签必须具有非空的稳定 ID' };
    if (validTagIds.has(tag.id)) return { valid: false, error: `存在重复的标签 ID: ${tag.id}` };
    if (typeof tag.title !== 'string' || !tag.title.trim()) return { valid: false, error: '标签标题必须为非空字符串' };
    if (typeof tag.color !== 'string' || !/^#[\da-fA-F]{6}$/.test(tag.color)) {
      return { valid: false, error: `标签「${tag.title}」颜色必须是六位十六进制色值` };
    }
    validTagIds.add(tag.id);
  }

  if (!Array.isArray(obj.todos)) return { valid: false, error: '缺少待办列表 (todos 必须为数组)' };
  const seenTodoIds = new Set<string>();

  function validateTodoNode(value: unknown): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '待办树中包含非对象节点';
    const todo = value as Record<string, unknown>;
    if (typeof todo.id !== 'string' || !todo.id.trim()) return '待办节点必须具有稳定 ID';
    if (seenTodoIds.has(todo.id)) return `存在重复的待办 ID: ${todo.id}`;
    seenTodoIds.add(todo.id);
    if (typeof todo.title !== 'string') return `待办 [${todo.id}] 标题必须为字符串`;
    if (typeof todo.note !== 'string') return `待办 [${todo.id}] 备注必须为字符串`;
    if (typeof todo.dueDate !== 'string') return `待办 [${todo.id}] 截止日期必须为字符串`;
    if (todo.dueDate !== '' && !isValidDateString(todo.dueDate)) {
      return `待办 [${todo.id}] 截止日期无效，必须是实际存在的 YYYY-MM-DD 日期或空字符串`;
    }
    if (typeof todo.importance !== 'number' || !Number.isInteger(todo.importance) || todo.importance < 0 || todo.importance > 100) {
      return `待办 [${todo.id}] 重要程度必须为 0–100 的整数`;
    }
    if (typeof todo.urgency !== 'number' || !Number.isInteger(todo.urgency) || todo.urgency < 0 || todo.urgency > 100) {
      return `待办 [${todo.id}] 紧急程度必须为 0–100 的整数`;
    }
    if (!Array.isArray(todo.tagIds)) return `待办 [${todo.id}] tagIds 必须为数组`;
    const todoTagIds = new Set<string>();
    for (const tagId of todo.tagIds) {
      if (typeof tagId !== 'string' || !validTagIds.has(tagId)) return `待办 [${todo.id}] 引用了不存在的标签 ID: ${tagId}`;
      if (todoTagIds.has(tagId)) return `待办 [${todo.id}] 包含重复的标签引用: ${tagId}`;
      todoTagIds.add(tagId);
    }
    if (!Array.isArray(todo.children)) return `待办 [${todo.id}] children 必须为数组`;
    if (typeof todo.completed !== 'boolean') return `待办 [${todo.id}] completed 必须为布尔值`;
    if (todo.children.length > 0 && todo.completed) return `父待办 [${todo.id}] 不能标记为已完成`;
    for (const child of todo.children) {
      const error = validateTodoNode(child);
      if (error) return error;
    }
    return null;
  }

  for (const todo of obj.todos) {
    const error = validateTodoNode(todo);
    if (error) return { valid: false, error };
  }
  return { valid: true, data: obj as unknown as AppData };
}

export function findTodoById(todos: Todo[], id: string): Todo | null {
  for (const todo of todos) {
    if (todo.id === id) return todo;
    const found = findTodoById(todo.children, id);
    if (found) return found;
  }
  return null;
}

export function findTodoAndParent(
  todos: Todo[],
  id: string,
  parent: Todo | null = null,
): { todo: Todo; parent: Todo | null } | null {
  for (const todo of todos) {
    if (todo.id === id) return { todo, parent };
    const found = findTodoAndParent(todo.children, id, todo);
    if (found) return found;
  }
  return null;
}

export function updateTodoInTree(todos: Todo[], id: string, updater: (todo: Todo) => Todo): Todo[] {
  return todos.map((todo) => {
    if (todo.id === id) return updater({ ...todo });
    if (todo.children.length === 0) return todo;
    return { ...todo, children: updateTodoInTree(todo.children, id, updater) };
  });
}

export function addRootTodoToTree(todos: Todo[]): { todos: Todo[]; newTodo: Todo } {
  const newTodo = createDefaultTodo('新建待办事项');
  return { todos: [...todos, newTodo], newTodo };
}

export function addChildTodoToTree(todos: Todo[], parentId: string): { todos: Todo[]; newTodo: Todo } | null {
  const parent = findTodoById(todos, parentId);
  if (!parent || (isLeaf(parent) && parent.completed)) return null;
  const newTodo = createDefaultTodo('新建子待办');
  return {
    todos: updateTodoInTree(todos, parentId, (todo) => ({
      ...todo,
      completed: false,
      children: [...todo.children, newTodo],
    })),
    newTodo,
  };
}

export function deleteTodoFromTree(todos: Todo[], idToDelete: string): Todo[] {
  function remove(list: Todo[]): Todo[] {
    return list
      .filter((todo) => todo.id !== idToDelete)
      .map((todo) => {
        if (todo.children.length === 0) return todo;
        const children = remove(todo.children);
        return children.length === 0
          ? { ...todo, children, completed: false }
          : { ...todo, children };
      });
  }
  return remove(todos);
}

export function toggleLeafCompletion(todos: Todo[], id: string): Todo[] {
  return todos.map((todo) => {
    if (todo.id === id) return isLeaf(todo) ? { ...todo, completed: !todo.completed } : todo;
    return todo.children.length === 0
      ? todo
      : { ...todo, children: toggleLeafCompletion(todo.children, id) };
  });
}

export interface LeafItem {
  todo: Todo;
  path: string[];
}

export function collectLeafTodos(todos: Todo[]): LeafItem[] {
  const leaves: LeafItem[] = [];
  function visit(items: Todo[], path: string[]) {
    for (const todo of items) {
      if (isLeaf(todo)) leaves.push({ todo, path });
      else visit(todo.children, [...path, todo.title || '未命名待办']);
    }
  }
  visit(todos, []);
  return leaves;
}
