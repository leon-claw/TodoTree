import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  NodeMouseHandler,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { Plus } from 'lucide-react';
import { buildTreeFlowElements } from '../treeLayout';
import { ComposerAnchor, Tag, Todo } from '../types';
import { TodoNode } from './TodoNode';

interface GraphViewProps {
  todos: Todo[];
  tags: Tag[];
  selectedId: string | null;
  onSelectTodo: (id: string | null) => void;
  onAddRootTodo: () => void;
  onRequestAdd: (parentId: string | null, targetLabel: string, anchor?: ComposerAnchor) => void;
  onRequestDelete: (id: string) => void;
}

function FlowCanvas({ todos, tags, selectedId, onSelectTodo, onAddRootTodo, onRequestAdd, onRequestDelete }: GraphViewProps) {
  const nodeTypes = useMemo(() => ({ todoNode: TodoNode }), []);
  const { nodes: calculatedNodes, edges: calculatedEdges } = useMemo(
    () => buildTreeFlowElements(todos, tags, selectedId, onSelectTodo, onRequestAdd, onRequestDelete),
    [todos, tags, selectedId, onSelectTodo, onRequestAdd, onRequestDelete],
  );
  const [nodes, setNodes] = useNodesState(calculatedNodes);
  const [edges, setEdges] = useEdgesState(calculatedEdges);

  useEffect(() => {
    setNodes(calculatedNodes);
    setEdges(calculatedEdges);
  }, [calculatedNodes, calculatedEdges, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler = (_, node) => onSelectTodo(node.id);

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
          点击节点查看详情 · 节点旁可添加子项、同级任务或删除
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
          onNodeClick={handleNodeClick}
          onPaneClick={() => onSelectTodo(null)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={1.8}
          nodesDraggable={false}
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
