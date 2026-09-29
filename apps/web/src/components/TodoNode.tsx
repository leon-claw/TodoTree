import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Calendar, CheckCircle2, ChevronDown, ChevronRight, Circle, Plus, Trash2 } from 'lucide-react';
import { TodoNodeData } from '../treeLayout';
import { getTagBorderStyle } from '../tagBorder';

interface TodoNodeProps {
  data: TodoNodeData;
}

function getComposerAnchor(button: HTMLButtonElement) {
  const node = button.closest('.react-flow__node')?.getBoundingClientRect() ?? button.getBoundingClientRect();
  const viewport = button.closest('.react-flow')?.getBoundingClientRect();
  return {
    left: node.left,
    top: node.top,
    right: node.right,
    viewportLeft: viewport?.left ?? 0,
    viewportRight: viewport?.right ?? window.innerWidth,
  };
}

export const TodoNode: React.FC<TodoNodeProps> = ({ data }) => {
  const {
    todo,
    tagsMap,
    isSelected,
    isLocationHighlighted,
    isCollapsed,
    semanticZoomLevel,
    compactFontSize,
    descendantCount,
    incompleteLeafCount,
    dropTargetState,
    onSelect,
    onRequestAdd,
    onRequestDelete,
    onToggleCollapse,
    parentId,
    parentTitle,
  } = data;
  const borderGradientId = `todo-border-${React.useId().replace(/:/g, '')}`;
  const isParent = todo.children.length > 0;
  const completedLeaf = !isParent && todo.completed;
  const isCompact = semanticZoomLevel === 'compact';
  const isOverview = semanticZoomLevel === 'overview';
  const tagColors = todo.tagIds.flatMap((tagId) => {
    const color = tagsMap[tagId]?.color;
    return color ? [color] : [];
  });
  const tagBorder = getTagBorderStyle(tagColors);
  const nodeBorder = dropTargetState === null ? tagBorder : {};
  const cardStateClass = dropTargetState === 'valid'
    ? 'border-emerald-500 ring-4 ring-emerald-400/30 shadow-md'
    : dropTargetState === 'invalid'
      ? 'border-rose-500 ring-4 ring-rose-400/30 shadow-md'
      : isSelected
        ? 'border-blue-600 ring-2 ring-blue-500/20'
        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm';
  const requestAddChild = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRequestAdd(todo.id, todo.title || '未命名待办', getComposerAnchor(event.currentTarget));
  };
  const requestAddSibling = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRequestAdd(parentId, parentTitle || '根任务列表', getComposerAnchor(event.currentTarget));
  };
  const requestDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRequestDelete(todo.id);
  };

  return (
    <div className="group relative h-[124px] w-[270px]">
      <div
        role="button"
        tabIndex={0}
        aria-label={`打开待办设置：${todo.title || '未命名待办'}`}
        aria-pressed={isSelected}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(todo.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(todo.id);
          }
        }}
        style={nodeBorder}
        className={`absolute inset-0 box-border flex ${isCompact || isOverview ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} select-none flex-col ${isOverview ? 'overflow-visible border-slate-300 shadow-none' : 'overflow-hidden bg-white p-3'} rounded-lg border text-left shadow-xs transition-all ${cardStateClass} ${isLocationHighlighted ? 'outline outline-4 outline-offset-2 outline-amber-300' : ''}`}
      >
        <Handle type="target" position={Position.Left} className={`!h-2 !w-2 !border !border-white !bg-slate-400 ${isCompact || isOverview ? '!pointer-events-none !opacity-0' : ''}`} />
        <Handle type="source" position={Position.Right} className={`!h-2 !w-2 !border !border-white !bg-slate-400 ${isCompact || isOverview ? '!pointer-events-none !opacity-0' : ''}`} />

        {isOverview ? (
          <div className="m-auto flex min-h-0 w-full items-center justify-center px-3 py-2 text-center">
            <span
              className="w-full break-words font-medium text-slate-900"
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
                maxHeight: `${Math.ceil(compactFontSize * 1.15 * 2)}px`,
                fontSize: `${compactFontSize}px`,
                lineHeight: `${Math.ceil(compactFontSize * 1.15)}px`,
                overflowWrap: 'anywhere',
              }}
            >
              {todo.title || '未命名待办'}
            </span>
          </div>
        ) : isCompact ? (
          <div className="flex h-full min-h-0 flex-col justify-center gap-1 overflow-hidden">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden" style={{ height: `${34 * compactFontSize / 12}px` }}>
              {completedLeaf
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                : <Circle className={`h-4 w-4 shrink-0 ${isParent ? 'text-blue-500' : 'text-slate-400'}`} aria-hidden="true" />}
              <h4
                className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium leading-tight text-slate-900"
                style={{ fontSize: `${compactFontSize}px` }}
              >
                {todo.title || '未命名待办'}
              </h4>
              {!isParent && <span className="shrink-0 text-slate-600" style={{ fontSize: `${compactFontSize}px` }}>{completedLeaf ? '完成' : '未完成'}</span>}
            </div>
            {isParent && (
              <p className="truncate text-slate-500" style={{ fontSize: `${compactFontSize}px` }}>
                {descendantCount} 个后代{isCollapsed ? ` · ${incompleteLeafCount} 个未完成叶子` : ''}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex h-[38px] min-h-[38px] items-start gap-1 overflow-hidden">
              <h4 className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-medium leading-snug text-slate-900">
                {todo.title || '未命名待办'}
              </h4>
              {isParent && (
                <button
                  type="button"
                  className="nodrag nopan mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={(event) => { event.stopPropagation(); onToggleCollapse(todo.id); }}
                  aria-label={`${isCollapsed ? '展开' : '折叠'}：${todo.title || '未命名待办'}`}
                  aria-expanded={!isCollapsed}
                  title={isCollapsed ? '展开子任务' : '折叠子任务'}
                >
                  {isCollapsed
                    ? <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                </button>
              )}
            </div>
            {isCollapsed ? (
              <p className="mt-1 h-4 min-h-4 overflow-hidden text-[11px] text-slate-500">
                {descendantCount} 个后代已折叠 · {incompleteLeafCount} 个未完成叶子
              </p>
            ) : todo.note && (
              <p className="mt-1 h-4 min-h-4 overflow-hidden text-xs text-slate-500 line-clamp-1">
                {todo.note}
              </p>
            )}
            <div className="mt-auto flex h-6 min-h-6 items-center gap-1 overflow-hidden border-t border-slate-100 pt-1 text-[10px] text-slate-500">
              {todo.dueDate && (
                <span className="flex shrink-0 items-center gap-1 font-mono tabular-nums text-slate-600">
                  <Calendar className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  {todo.dueDate}
                </span>
              )}
              {(todo.importance > 0 || todo.urgency > 0) && (
                <span className="shrink-0 font-mono tabular-nums text-slate-600">
                  {todo.importance > 0 && `重:${todo.importance}`}
                  {todo.importance > 0 && todo.urgency > 0 && ' '}
                  {todo.urgency > 0 && `急:${todo.urgency}`}
                </span>
              )}
              {todo.tagIds.length > 0 && (
                <div className="ml-auto flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
                  {todo.tagIds.slice(0, 1).map((tagId) => {
                    const tag = tagsMap[tagId];
                    if (!tag) return null;
                    return (
                      <span
                        key={tag.id}
                        className="inline-flex min-w-0 max-w-[76px] items-center gap-1 rounded px-1.5 py-0.5 font-medium"
                        style={{ backgroundColor: `${tag.color}18`, color: tag.color }}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="truncate">{tag.title}</span>
                      </span>
                    );
                  })}
                  {todo.tagIds.length > 1 && <span className="shrink-0">+{todo.tagIds.length - 1}</span>}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {dropTargetState === null && tagBorder.gradientStops && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          viewBox="0 0 270 124"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={borderGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {tagBorder.gradientStops.map((stop, index) => (
                <stop key={`${stop.offset}-${index}`} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="268" height="122" rx="8" ry="8" fill="none" stroke={`url(#${borderGradientId})`} strokeWidth="2" />
        </svg>
      )}

      {semanticZoomLevel === 'detail' && (
        <div
          className={`nodrag absolute -top-9 left-0 z-20 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm transition-opacity ${
            isSelected ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={requestAddChild}
            disabled={completedLeaf}
            title={completedLeaf ? '已完成的叶子任务需先取消完成' : '添加子任务'}
            aria-label={`为「${todo.title || '未命名待办'}」添加子任务`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />子任务
          </button>
          <button
            type="button"
            onClick={requestAddSibling}
            title="添加同级任务"
            aria-label={`为「${todo.title || '未命名待办'}」添加同级任务`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />同级
          </button>
          <button
            type="button"
            onClick={requestDelete}
            title="删除任务"
            aria-label={`删除「${todo.title || '未命名待办'}」`}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
