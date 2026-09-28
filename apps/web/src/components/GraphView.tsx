import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, Node, NodeMouseHandler, OnNodeDrag } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { FlowNavigator } from './FlowNavigator';
import { expandFlowPath, getAncestorIds, indexFlowTodos } from '../flowNavigation';
import type { FlowLocationRequest } from '../flowNavigation';
import { canMoveTodoUnderParent } from '../storage';
import { getInitialFlowViewport, getSemanticZoomLevel, READING_ZOOM } from '../flowZoom';
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
  active: boolean;
  locationRequest: FlowLocationRequest | null;
  onLocateTodo: (id: string) => void;
  onLocationHandled: (sequence: number) => void;
  onLocationMissing: (id: string) => void;
  treeRevision: number;
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
  active,
  locationRequest,
  onLocateTodo,
  onLocationHandled,
  onLocationMissing,
  treeRevision,
}: GraphViewProps) {
  const nodeTypes = useMemo(() => ({ todoNode: TodoNode }), []);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const previousTreeRevision = useRef(treeRevision);
  const [locationHighlightId, setLocationHighlightId] = useState<string | null>(null);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const locationSequenceRef = useRef<number | null>(null);
  const locationTimerRef = useRef<number | null>(null);
  const flowEntries = useMemo(() => indexFlowTodos(todos), [todos]);
  const [zoomPresentation, setZoomPresentation] = useState({
    level: 'detail' as ReturnType<typeof getSemanticZoomLevel>,
    compactFontSize: 12,
    percent: 100,
  });
  const [showReturnToCurrentTask, setShowReturnToCurrentTask] = useState(false);
  const nodesInitialized = useNodesInitialized();
  const initialCameraAppliedRef = useRef(false);
  const { fitView, getIntersectingNodes, getNodes, getZoom, setCenter, zoomTo } = useReactFlow<Node<TodoNodeData>, Edge>();
  const updateZoomPresentation = useCallback((zoom: number) => {
    const next = {
      level: getSemanticZoomLevel(zoom),
      compactFontSize: Math.ceil(12 / Math.max(zoom, 0.01)),
      percent: Math.round(zoom * 100),
    };
    setZoomPresentation((current) => (
      current.level === next.level
      && current.compactFontSize === next.compactFontSize
      && current.percent === next.percent
        ? current
        : next
    ));
  }, []);
  const focusTodoAtReadingZoom = useCallback((id: string, duration = 280) => {
    const target = getNodes().find((node) => node.id === id);
    if (!target) return;
    void setCenter(
      target.position.x + NODE_WIDTH / 2,
      target.position.y + NODE_HEIGHT / 2,
      { zoom: READING_ZOOM, duration },
    );
    setShowReturnToCurrentTask(false);
  }, [getNodes, setCenter]);
  const selectTodo = useCallback((id: string) => {
    const needsReadableZoom = getSemanticZoomLevel(getZoom()) !== 'detail';
    onSelectTodo(id);
    if (!needsReadableZoom) {
      setShowReturnToCurrentTask(false);
      return;
    }
    let secondFrame = 0;
    window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => focusTodoAtReadingZoom(id));
    });
  }, [focusTodoAtReadingZoom, getZoom, onSelectTodo]);
  const toggleCollapse = useCallback((id: string) => {
    if (collapsedIds.has(id)) {
      setCollapsedIds((current) => {
        const expanded = new Set(current);
        expanded.delete(id);
        return expanded;
      });
      return;
    }
    setCollapsedIds((current) => new Set(current).add(id));
    if (selectedId && getAncestorIds(flowEntries, selectedId).includes(id)) onLocateTodo(id);
  }, [collapsedIds, flowEntries, onLocateTodo, selectedId]);
  const revealPathAndLocate = useCallback((id: string) => {
    setCollapsedIds((current) => expandFlowPath(flowEntries, id, current));
    onLocateTodo(id);
  }, [flowEntries, onLocateTodo]);
  const { nodes: calculatedNodes, edges: calculatedEdges } = useMemo(
    () => buildTreeFlowElements(
      todos, tags, selectedId, selectTodo, onRequestAdd, onRequestDelete,
      locationHighlightId, collapsedIds, toggleCollapse,
      zoomPresentation.level, zoomPresentation.compactFontSize,
    ),
    [todos, tags, selectedId, selectTodo, onRequestAdd, onRequestDelete, locationHighlightId, collapsedIds, toggleCollapse, zoomPresentation.level, zoomPresentation.compactFontSize],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(calculatedNodes);
  const [edges, setEdges] = useEdgesState(calculatedEdges);
  const lastDragDiagnostic = useRef<{ draggedId: string; targetId: string | null; valid: boolean; lastPosition: { x: number; y: number }; loggedFirstMove: boolean } | null>(null);

  useEffect(() => {
    setNodes(calculatedNodes);
    setEdges(calculatedEdges);
  }, [calculatedNodes, calculatedEdges, setNodes, setEdges]);

  useEffect(() => {
    if (previousTreeRevision.current === treeRevision) return;
    previousTreeRevision.current = treeRevision;
    setCollapsedIds(new Set());
  }, [treeRevision]);

  useEffect(() => {
    if (!active || initialCameraAppliedRef.current || !nodesInitialized || nodes.length === 0) return;
    let cancelled = false;
    const initializeCamera = async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const didFit = await fitView({ padding: 0.15, duration: 0 });
      if (cancelled || !didFit) return;
      initialCameraAppliedRef.current = true;
      const fittedZoom = getZoom();
      updateZoomPresentation(fittedZoom);
      const initialViewport = getInitialFlowViewport(fittedZoom, selectedId, todos[0]?.id ?? null);
      if (initialViewport.kind === 'focus') {
        const target = getNodes().find((node) => node.id === initialViewport.focusId);
        if (target) {
          await setCenter(
            target.position.x + NODE_WIDTH / 2,
            target.position.y + NODE_HEIGHT / 2,
            { zoom: initialViewport.zoom, duration: 0 },
          );
          updateZoomPresentation(initialViewport.zoom);
        }
      }
    };
    void initializeCamera();
    return () => { cancelled = true; };
  }, [active, fitView, getNodes, getZoom, nodes.length, nodesInitialized, selectedId, setCenter, todos, updateZoomPresentation]);

  useEffect(() => {
    if (!locationRequest || locationSequenceRef.current === locationRequest.sequence) return;
    if (!flowEntries.some((entry) => entry.id === locationRequest.id)) {
      locationSequenceRef.current = locationRequest.sequence;
      setLocationFeedback('任务已不存在，已取消定位');
      if (locationTimerRef.current !== null) window.clearTimeout(locationTimerRef.current);
      locationTimerRef.current = window.setTimeout(() => setLocationFeedback(null), 3200);
      onLocationMissing(locationRequest.id);
      onLocationHandled(locationRequest.sequence);
      return;
    }
    const collapsedAncestors = getAncestorIds(flowEntries, locationRequest.id)
      .filter((ancestorId) => collapsedIds.has(ancestorId));
    if (collapsedAncestors.length > 0) {
      setCollapsedIds((current) => expandFlowPath(flowEntries, locationRequest.id, current));
      return;
    }
    const target = calculatedNodes.find((node) => node.id === locationRequest.id);
    if (!target) return;

    locationSequenceRef.current = locationRequest.sequence;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const zoom = Math.max(getZoom() || 1, 0.9);
        setCenter(
          target.position.x + NODE_WIDTH / 2,
          target.position.y + NODE_HEIGHT / 2,
          { zoom, duration: 320 },
        );
        setLocationHighlightId(locationRequest.id);
        if (locationTimerRef.current !== null) window.clearTimeout(locationTimerRef.current);
        locationTimerRef.current = window.setTimeout(() => setLocationHighlightId(null), 1400);
        onLocationHandled(locationRequest.sequence);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [calculatedNodes, collapsedIds, flowEntries, getZoom, locationRequest, onLocationHandled, onLocationMissing, setCenter]);

  useEffect(() => () => {
    if (locationTimerRef.current !== null) window.clearTimeout(locationTimerRef.current);
  }, []);

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

  const handleNodeClick: NodeMouseHandler<Node<TodoNodeData>> = (_, node) => selectTodo(node.id);
  const handleViewAll = useCallback(() => {
    setShowReturnToCurrentTask(true);
    void fitView({ padding: 0.15, duration: 280 });
  }, [fitView]);
  const handleReturnToCurrentTask = useCallback(() => {
    const targetId = selectedId ?? todos[0]?.id;
    if (targetId) focusTodoAtReadingZoom(targetId);
    setShowReturnToCurrentTask(false);
  }, [focusTodoAtReadingZoom, selectedId, todos]);

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
        <FlowNavigator
          entries={flowEntries}
          tags={tags}
          selectedId={selectedId}
          active={active}
          collapsedIds={collapsedIds}
          onLocate={revealPathAndLocate}
          onToggleCollapse={toggleCollapse}
        />
        <span className="hidden rounded-md border border-slate-200 bg-white/90 px-2.5 py-1.5 text-xs text-slate-500 shadow-2xs backdrop-blur-xs sm:inline-block">
          {zoomPresentation.level === 'detail' ? '拖到节点上可设为子任务 · 点击节点查看详情' : '点击节点放大查看 · 大纲始终可读'}
        </span>
      </div>
      {locationFeedback && (
        <div role="status" aria-live="polite" className="absolute right-4 top-4 z-20 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">
          {locationFeedback}
        </div>
      )}
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
          onMove={(_event, viewport) => updateZoomPresentation(viewport.zoom)}
          minZoom={0.08}
          maxZoom={1.8}
          nodesDraggable={zoomPresentation.level === 'detail'}
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          zoomOnPinch
          zoomOnScroll
          preventScrolling
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
          <Controls showInteractive={false} showFitView={false} position="bottom-left" />
          <Panel position="bottom-right" className="!bottom-4 !right-4">
            <div role="group" aria-label="Flow 缩放控制" className="flex flex-wrap items-center justify-end gap-1.5 rounded-lg border border-slate-200 bg-white/95 p-1.5 text-xs shadow-sm backdrop-blur-sm">
              <span aria-live="polite" className="min-w-11 px-1 text-center font-mono tabular-nums text-slate-600">{zoomPresentation.percent}%</span>
              <button type="button" onClick={() => { void zoomTo(1, { duration: 220 }); }} className="rounded-md border border-slate-200 px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-50">100%</button>
              <button type="button" onClick={handleViewAll} className="rounded-md border border-slate-200 px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-50">查看全图</button>
              {showReturnToCurrentTask && (
                <button type="button" onClick={handleReturnToCurrentTask} className="rounded-md bg-blue-600 px-2 py-1.5 font-medium text-white hover:bg-blue-700">返回当前任务</button>
              )}
            </div>
          </Panel>
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
