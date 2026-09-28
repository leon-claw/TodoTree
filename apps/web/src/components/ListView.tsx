import { Calendar, CheckCircle2, ChevronRight, Circle, Plus } from 'lucide-react';
import { Tag, Todo } from '../types';

interface ListViewProps {
  leafItems: { todo: Todo; path: string[] }[];
  tags: Tag[];
  onToggleComplete: (id: string) => void;
  onSelectTodo: (id: string) => void;
  onBlankClick: () => void;
  onAddRootTodo: () => void;
}

export function ListView({ leafItems, tags, onToggleComplete, onSelectTodo, onBlankClick, onAddRootTodo }: ListViewProps) {
  const tagsMap: Record<string, Tag> = Object.fromEntries(tags.map((tag) => [tag.id, tag]));
  const completedCount = leafItems.filter(({ todo }) => todo.completed).length;
  const handleViewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-list-item]')) onBlankClick();
  };

  if (leafItems.length === 0) {
    return (
      <div onClick={handleViewClick} className="flex min-w-0 flex-1 flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-medium text-slate-700">暂无叶子待办事项</h3>
        <p className="mt-1 max-w-sm text-xs text-slate-500">所有没有子项的叶子待办都会显示在这里。</p>
        <button
          type="button"
          onClick={onAddRootTodo}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />新建根待办
        </button>
      </div>
    );
  }

  return (
    <div onClick={handleViewClick} className="flex min-w-0 flex-1 overflow-hidden">
      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">叶子待办列表</h2>
            <p className="mt-0.5 text-xs text-slate-500">按重要＋紧急排序 · 共 {leafItems.length} 项（已完成 {completedCount} 项）</p>
          </div>
          <button
            type="button"
            onClick={onAddRootTodo}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:text-sm"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />新建根待办
          </button>
        </div>

        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          {leafItems.map(({ todo, path }) => (
            <div
              key={todo.id}
              data-list-item="true"
              onClick={() => onSelectTodo(todo.id)}
              className={`flex cursor-pointer items-start gap-3.5 p-4 transition-colors hover:bg-slate-50/80 ${todo.completed ? 'bg-slate-50/50' : 'bg-white'}`}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleComplete(todo.id);
                }}
                aria-label={todo.completed ? '标记为未完成' : '标记为已完成'}
                aria-pressed={todo.completed}
                className="mt-0.5 shrink-0 text-slate-400 transition-colors hover:text-blue-600"
              >
                {todo.completed
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <Circle className="h-5 w-5 text-slate-400 hover:text-slate-600" />}
              </button>

              <div className="min-w-0 flex-1">
                {path.length > 0 && (
                  <div className="mb-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                    {path.map((segment, index) => (
                      <span key={`${index}-${segment}`} className="flex items-center gap-1">
                        <span>{segment}</span><ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />
                      </span>
                    ))}
                  </div>
                )}
                <h3 className={`text-sm font-medium leading-snug text-slate-900 ${todo.completed ? 'text-slate-400 line-through' : ''}`}>
                  {todo.title || '未命名待办'}
                </h3>
                {todo.note && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{todo.note}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                  {todo.dueDate && (
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-600">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{todo.dueDate}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2 font-mono tabular-nums text-slate-600">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-800">
                      总分 {todo.importance + todo.urgency}
                    </span>
                    <span>重要 {todo.importance}</span>
                    <span>紧急 {todo.urgency}</span>
                  </span>
                  {todo.tagIds.map((tagId) => {
                    const tag = tagsMap[tagId];
                    if (!tag) return null;
                    return (
                      <span key={tag.id} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${tag.color}15`, color: tag.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />{tag.title}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
