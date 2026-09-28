import type { Tag, Todo } from './types';

export interface FlowPathItem {
  id: string;
  title: string;
}

export interface FlowEntry {
  id: string;
  parentId: string | null;
  title: string;
  note: string;
  tagIds: string[];
  path: FlowPathItem[];
  order: number;
  depth: number;
  descendantCount: number;
  incompleteLeafCount: number;
  isLeaf: boolean;
  completed: boolean;
}

/** Build a preorder navigation index without modifying the source tree. */
export function indexFlowTodos(todos: Todo[]): FlowEntry[] {
  const entries: FlowEntry[] = [];
  let order = 0;

  const visit = (
    todo: Todo,
    parentId: string | null,
    parentPath: FlowPathItem[],
  ): { descendantCount: number; incompleteLeafCount: number } => {
    const path = [...parentPath, { id: todo.id, title: todo.title }];
    const children = todo.children ?? [];
    const entry: FlowEntry = {
      id: todo.id,
      parentId,
      title: todo.title,
      note: todo.note,
      tagIds: [...todo.tagIds],
      path,
      order: order++,
      depth: path.length - 1,
      descendantCount: 0,
      incompleteLeafCount: 0,
      isLeaf: children.length === 0,
      completed: todo.completed,
    };
    entries.push(entry);

    if (children.length === 0) {
      entry.incompleteLeafCount = todo.completed ? 0 : 1;
      return { descendantCount: 0, incompleteLeafCount: entry.incompleteLeafCount };
    }

    let descendantCount = 0;
    let incompleteLeafCount = 0;
    for (const child of children) {
      const counts = visit(child, todo.id, path);
      descendantCount += counts.descendantCount + 1;
      incompleteLeafCount += counts.incompleteLeafCount;
    }
    entry.descendantCount = descendantCount;
    entry.incompleteLeafCount = incompleteLeafCount;
    return { descendantCount, incompleteLeafCount };
  };

  for (const todo of todos) visit(todo, null, []);
  return entries;
}

/** Search titles, notes, and assigned tag names with predictable relevance tiers. */
export function searchFlowTodos(
  entries: FlowEntry[],
  tags: Tag[],
  query: string,
): FlowEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const tagTitles = new Map(tags.map((tag) => [tag.id, tag.title.toLowerCase()]));
  return entries
    .map((entry) => {
      const title = entry.title.toLowerCase();
      const note = entry.note.toLowerCase();
      const matchesTag = entry.tagIds.some((tagId) =>
        tagTitles.get(tagId)?.includes(normalizedQuery),
      );
      let rank: number;
      if (title.startsWith(normalizedQuery)) rank = 0;
      else if (title.includes(normalizedQuery)) rank = 1;
      else if (note.includes(normalizedQuery) || matchesTag) rank = 2;
      else return null;
      return { entry, rank };
    })
    .filter((match): match is { entry: FlowEntry; rank: number } => match !== null)
    .sort((left, right) => left.rank - right.rank || left.entry.order - right.entry.order)
    .map(({ entry }) => entry);
}

/** Return parent IDs from root to direct parent; a root or unknown ID has none. */
export function getAncestorIds(entries: FlowEntry[], id: string): string[] {
  const entry = entries.find((candidate) => candidate.id === id);
  return entry ? entry.path.slice(0, -1).map(({ id: ancestorId }) => ancestorId) : [];
}
