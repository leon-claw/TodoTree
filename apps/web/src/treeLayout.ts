import { Edge, Node } from '@xyflow/react';
import { hierarchy, tree } from 'd3-hierarchy';
import { ComposerAnchor, Tag, Todo } from './types';

export interface HierarchyDatum {
  id: string;
  todo: Todo;
  children?: HierarchyDatum[];
}

export interface TodoNodeData {
  todo: Todo;
  tagsMap: Record<string, Tag>;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRequestAdd: (parentId: string | null, targetLabel: string, anchor?: ComposerAnchor) => void;
  onRequestDelete: (id: string) => void;
  parentId: string | null;
  parentTitle: string | null;
  [key: string]: unknown;
}

export const NODE_WIDTH = 270;
export const NODE_HEIGHT = 124;
export const GAP_X = 96;
export const GAP_Y = 28;

export function buildTreeFlowElements(
  rootTodos: Todo[],
  tags: Tag[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  onRequestAdd: (parentId: string | null, targetLabel: string, anchor?: ComposerAnchor) => void,
  onRequestDelete: (id: string) => void,
): { nodes: Node<TodoNodeData>[]; edges: Edge[] } {
  if (rootTodos.length === 0) return { nodes: [], edges: [] };

  const tagsMap: Record<string, Tag> = {};
  for (const tag of tags) tagsMap[tag.id] = tag;

  function toHierarchy(todo: Todo): HierarchyDatum {
    return {
      id: todo.id,
      todo,
      children: todo.children.length > 0 ? todo.children.map(toHierarchy) : undefined,
    };
  }

  const virtualRoot: HierarchyDatum = {
    id: '__virtual_root__',
    todo: {} as Todo,
    children: rootTodos.map(toHierarchy),
  };
  const layout = tree<HierarchyDatum>()
    .nodeSize([NODE_HEIGHT + GAP_Y, NODE_WIDTH + GAP_X])
    .separation((a, b) => a.parent === b.parent ? 1 : 1.2)(hierarchy(virtualRoot));

  const nodes: Node<TodoNodeData>[] = [];
  const edges: Edge[] = [];
  layout.each((entry) => {
    if (entry.data.id === '__virtual_root__') return;
    const todo = entry.data.todo;
    const parentId = entry.parent?.data.id === '__virtual_root__' ? null : entry.parent?.data.todo.id ?? null;
    const parentTitle = entry.parent?.data.id === '__virtual_root__' ? null : entry.parent?.data.todo.title ?? null;
    nodes.push({
      id: todo.id,
      type: 'todoNode',
      position: {
        x: entry.y - (NODE_WIDTH + GAP_X),
        y: entry.x,
      },
      data: {
        todo,
        tagsMap,
        isSelected: selectedId === todo.id,
        onSelect,
        onRequestAdd,
        onRequestDelete,
        parentId,
        parentTitle,
      },
      selectable: true,
    });
    if (entry.parent && entry.parent.data.id !== '__virtual_root__') {
      edges.push({
        id: `edge_${entry.parent.data.todo.id}_${todo.id}`,
        source: entry.parent.data.todo.id,
        target: todo.id,
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      });
    }
  });
  return { nodes, edges };
}
