import { Edge, Node } from '@xyflow/react';
import { hierarchy, tree } from 'd3-hierarchy';
import { indexFlowTodos } from './flowNavigation';
import type { SemanticZoomLevel } from './flowZoom';
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
  isLocationHighlighted: boolean;
  isCollapsed: boolean;
  semanticZoomLevel: SemanticZoomLevel;
  compactFontSize: number;
  descendantCount: number;
  incompleteLeafCount: number;
  onSelect: (id: string) => void;
  onRequestAdd: (parentId: string | null, targetLabel: string, anchor?: ComposerAnchor) => void;
  onRequestDelete: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  parentId: string | null;
  parentTitle: string | null;
  dropTargetState: 'valid' | 'invalid' | null;
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
  locationHighlightId: string | null = null,
  collapsedIds: ReadonlySet<string> = new Set(),
  onToggleCollapse: (id: string) => void = () => {},
  semanticZoomLevel: SemanticZoomLevel = 'detail',
  compactFontSize = 12,
): { nodes: Node<TodoNodeData>[]; edges: Edge[] } {
  if (rootTodos.length === 0) return { nodes: [], edges: [] };

  const tagsMap: Record<string, Tag> = {};
  for (const tag of tags) tagsMap[tag.id] = tag;
  const entriesById = new Map(indexFlowTodos(rootTodos).map((entry) => [entry.id, entry]));

  function toHierarchy(todo: Todo): HierarchyDatum {
    return {
      id: todo.id,
      todo,
      children: todo.children.length > 0 && !collapsedIds.has(todo.id)
        ? todo.children.map(toHierarchy)
        : undefined,
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
    const flowEntry = entriesById.get(todo.id);
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
        isLocationHighlighted: locationHighlightId === todo.id,
        isCollapsed: collapsedIds.has(todo.id),
        semanticZoomLevel,
        compactFontSize,
        descendantCount: flowEntry?.descendantCount ?? 0,
        incompleteLeafCount: flowEntry?.incompleteLeafCount ?? 0,
        onToggleCollapse,
        onSelect,
        onRequestAdd,
        onRequestDelete,
        parentId,
        parentTitle,
        dropTargetState: null,
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
