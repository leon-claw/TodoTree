import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Calendar } from 'lucide-react';
import { TodoNodeData } from '../treeLayout';

interface TodoNodeProps {
  data: TodoNodeData;
}

export const TodoNode: React.FC<TodoNodeProps> = ({ data }) => {
  const { todo, tagsMap, isSelected, onSelect } = data;

  return (
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
      className={`relative box-border flex h-[124px] w-[270px] cursor-pointer select-none flex-col overflow-hidden rounded-lg border bg-white p-3 text-left shadow-xs transition-all ${
        isSelected ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border !border-white !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border !border-white !bg-slate-400" />

      <div className="h-[38px] min-h-[38px] overflow-hidden">
        <h4 className="line-clamp-2 break-words text-sm font-medium leading-snug text-slate-900">
          {todo.title || '未命名待办'}
        </h4>
      </div>
      {todo.note && (
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
    </div>
  );
};
