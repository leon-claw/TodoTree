export interface Tag {
  id: string;
  title: string;
  color: string;
}

export interface Todo {
  id: string;
  title: string;
  note: string;
  dueDate: string; // YYYY-MM-DD or ""
  importance: number; // 0-100
  urgency: number; // 0-100
  tagIds: string[];
  children: Todo[];
  completed: boolean; // Only meaningful for leaf nodes; false when created
}

export interface AppData {
  formatVersion: number;
  todos: Todo[];
  tags: Tag[];
}

export type ActiveTab = 'list' | 'graph' | 'settings';
export type AppRoute = '/graph' | '/list' | '/settings' | '/settings/tags'
  | `/graph/todo/${string}`
  | `/list/todo/${string}`;

export interface ComposerAnchor {
  left: number;
  top: number;
  right: number;
  viewportLeft: number;
  viewportRight: number;
}
