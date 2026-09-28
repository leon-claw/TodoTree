import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, Node, NodeMouseHandler, OnNodeDrag } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { canMoveTodoUnderParent } from '../storage';
import { buildTreeFlowElements, NODE_HEIGHT, NODE_WIDTH, TodoNodeData } from '../treeLayout';
import { ComposerAnchor, Tag, Todo } from '../types';
import { TodoNode } from './TodoNode';

interface GraphViewProps {
  todos: Todo[];
  tags: Tag[];
  selectedId: string | null;
  onSelectTodo: (id: string | null) => void;
  onAddRootTodo: () => void;
  onMoveTodo: (todoId: string, parentId: string) => void;
  onRequestAdd: (parentId: string | null, targetLabel: string, anchor?: ComposerAnchor) => void;
  onRequestDelete: (id: string) => void;
}

function FlowCanvas({
  todos,
  tags,
  selectedId,
  onSelectTodo,
  onAddRootTodo,
  onMoveTodo,
  onRequestAdd,
  onRequestDelete,
}: GraphViewProps) {
  const nodeTypes = useMemo(() => ({ todoNode: TodoNode }), []);
  const { nodes: calculatedNodes, edges: calculatedEdges } = useMemo(
    () => buildTreeFlowElements(todos, tags, selectedId, onSelectTodo, onRequestAdd, onRequestDelete),
    [todos, tags, selectedId, onSelectTodo, onRequestAdd, onRequestDelete],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(calculatedNodes);
  const [edges, setEdges] = useEdgesState(calculatedEdges);
  const { getIntersectingNodes, getNodes } = useReactFlow<Node<TodoNodeData>, Edge>();
  const lastDragDiagnostic = useRef<{ draggedId: string; targetId: string | null; valid: boolean; lastPosition: { x: number; y: number }; loggedFirstMove: boolean } | null>(null);

  useEffect(() => {
    setNodes(calculatedNodes);
    setEdges(calculatedEdges);
  }, [calculatedNodes, calculatedEdges, setNodes, setEdges]);

  const getDragState = useCallback((
    draggedNode: Node<TodoNodeData>,
    draggedGroup: Node<TodoNodeData>[],
  ) => {
    const draggedNodesById = new Map(draggedGroup.map((node) => [node.id, node]));
    draggedNodesById.set(draggedNode.id, draggedGroup.find((node) => node.id === draggedNode.id) ?? draggedNode);
    const canvasNodes = getNodes();
    const collisionNodes = canvasNodes.map((node) => draggedNodesById.get(node.id) ?? node);
    for (const draggedGroupNode of draggedNodesById.values()) {
      if (!collisionNodes.some((node) => node.id === draggedGroupNode.id)) collisionNodes.push(draggedGroupNode);
    }
    return {
      currentDraggedNode: draggedNodesById.get(draggedNode.id) ?? draggedNode,
      collisionNodes,
    };
  }, [getNodes]);

  const findDropTarget = useCallback((
    draggedNode: Node<TodoNodeData>,
    currentNodes: Node<TodoNodeData>[],
  ): Node<TodoNodeData> | null => {
    const centerX = draggedNode.position.x + NODE_WIDTH / 2;
    const centerY = draggedNode.position.y + NODE_HEIGHT / 2;
    const candidates = getIntersectingNodes(draggedNode, true, currentNodes)
      .filter((candidate) => candidate.id !== draggedNode.id)
      .filter((candidate) => (
        centerX >= candidate.position.x
        && centerX <= candidate.position.x + NODE_WIDTH
        && centerY >= candidate.position.y
        && centerY <= candidate.position.y + NODE_HEIGHT
      ));

    candidates.sort((first, second) => {
      const firstDistance = Math.hypot(
        centerX - (first.position.x + NODE_WIDTH / 2),
        centerY - (first.position.y + NODE_HEIGHT / 2),
      );
      const secondDistance = Math.hypot(
        centerX - (second.position.x + NODE_WIDTH / 2),
        centerY - (second.position.y + NODE_HEIGHT / 2),
      );
      return firstDistance - secondDistance;
    });
    return candidates[0] ?? null;
  }, [getIntersectingNodes]);

  const setDropTargetState = useCallback((
    targetId: string | null,
    isValid: boolean,
  ) => {
    setNodes((currentNodes) => {
      let changed = false;
      const nextNodes = currentNodes.map((node) => {
        const nextState: TodoNodeData['dropTargetState'] = node.id === targetId
          ? isValid ? 'valid' : 'invalid'
          : null;
        if (node.data.dropTargetState === nextState) return node;
        changed = true;
        return { ...node, data: { ...node.data, dropTargetState: nextState } };
      });
      return changed ? nextNodes : currentNodes;
    });
  }, [setNodes]);

  const handleNodeDragStart: OnNodeDrag<Node<TodoNodeData>> = useCallback(
    (_event, node) => {
      lastDragDiagnostic.current = { draggedId: node.id, targetId: null, valid: false, lastPosition: node.position, loggedFirstMove: false };
      console.info('[TodoTree drag] start', JSON.stringify({ todoId: node.id, position: node.position }));
    },
    [],
  );

  const handleNodeDrag: OnNodeDrag<Node<TodoNodeData>> = useCallback(
    (_event, draggedNode, currentNodes) => {
      const { currentDraggedNode, collisionNodes } = getDragState(draggedNode, currentNodes);
      const target = findDropTarget(currentDraggedNode, collisionNodes);
      const isValid = target !== null
        && canMoveTodoUnderParent(todos, currentDraggedNode.id, target.id);
      const previous = lastDragDiagnostic.current;
      if (previous && previous.draggedId === currentDraggedNode.id) {
        const moved = Math.hypot(
          currentDraggedNode.position.x - previous.lastPosition.x,
          currentDraggedNode.position.y - previous.lastPosition.y,
        ) > 0.1;
        if (moved && !previous.loggedFirstMove) {
          console.info('[TodoTree drag] first movement', JSON.stringify({
            todoId: currentDraggedNode.id,
            from: previous.lastPosition,
            to: currentDraggedNode.position,
          }));
          previous.loggedFirstMove = true;
        }
        if (previous.targetId !== (target?.id ?? null) || previous.valid !== isValid) {
          console.info('[TodoTree drag] target changed', JSON.stringify({
            draggedTodoId: currentDraggedNode.id,
            position: currentDraggedNode.position,
            targetTodoId: target?.id ?? null,
            valid: isValid,
          }));
          previous.targetId = target?.id ?? null;
          previous.valid = isValid;
        }
        previous.lastPosition = currentDraggedNode.position;
      }
      setDropTargetState(target?.id ?? null, isValid);
    },
    [findDropTarget, getDragState, setDropTargetState, todos],
  );

  const handleNodeDragStop: OnNodeDrag<Node<TodoNodeData>> = useCallback(
    (_event, draggedNode, currentNodes) => {
      const { currentDraggedNode, collisionNodes } = getDragState(draggedNode, currentNodes);
      const intersectingNodes = getIntersectingNodes(currentDraggedNode, true, collisionNodes);
      const target = findDropTarget(currentDraggedNode, collisionNodes);
      const isValid = target !== null
        && canMoveTodoUnderParent(todos, currentDraggedNode.id, target.id);
      console.info('[TodoTree drag] stop', JSON.stringify({
        draggedTodoId: currentDraggedNode.id,
        position: currentDraggedNode.position,
        draggedGroupTodoIds: currentNodes.map((node) => node.id),
        canvasTodoIds: collisionNodes.map((node) => node.id),
        intersectingTodoIds: intersectingNodes.map((node) => node.id),
        otherNodePositions: collisionNodes.filter((node) => node.id !== currentDraggedNode.id).map((node) => ({ id: node.id, position: node.position })),
        targetTodoId: target?.id ?? null,
        valid: isValid,
      }));

      if (target && isValid) {
        setDropTargetState(null, false);
        onMoveTodo(currentDraggedNode.id, target.id);
        return;
      }

      setDropTargetState(null, false);
      setNodes(calculatedNodes);
    },
    [calculatedNodes, findDropTarget, getDragState, getIntersectingNodes, onMoveTodo, setDropTargetState, setNodes, todos],
  );

  const handleNodeClick: NodeMouseHandler<Node<TodoNodeData>> = (_, node) => onSelectTodo(node.id);

  return (
    <div className="relative h-full w-full flex-1 overflow-hidden bg-slate-50">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={onAddRootTodo}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 sm:text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>新建根待办</span>
        </button>
        <span className="hidden rounded-md border border-slate-200 bg-white/90 px-2.5 py-1.5 text-xs text-slate-500 shadow-2xs backdrop-blur-xs sm:inline-block">
          拖到节点上可设为子任务 · 点击节点查看详情
        </span>
      </div>
      {nodes.length === 0 ? (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
          <p className="mb-4 text-sm text-slate-500">暂无待办事项，点击上方按钮开始创建</p>
          <button
            type="button"
            onClick={onAddRootTodo}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>创建第一个待办</span>
          </button>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={() => onSelectTodo(null)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={1.8}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          zoomOnPinch
          zoomOnScroll
          preventScrolling
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      )}
    </div>
  );
}

export function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
