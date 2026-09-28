import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Circle, GitBranch, Plus, Trash2, X } from 'lucide-react';
import { isLeaf } from '../storage';
import { Tag, Todo } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface SettingsPanelProps {
  todo: Todo | null;
  tags: Tag[];
  onClose: () => void;
  onUpdate: (updated: Todo) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}

function countDescendants(todo: Todo): number {
  return todo.children.reduce((count, child) => count + 1 + countDescendants(child), 0);
}

export function SettingsPanel({ todo, tags, onClose, onUpdate, onAddChild, onDelete }: SettingsPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="alertdialog"]')) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!todo) return null;
  const leaf = isLeaf(todo);

  const toggleTag = (tagId: string) => {
    const current = todo.tagIds;
    const tagIds = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    onUpdate({ ...todo, tagIds });
  };
  const updateScore = (key: 'importance' | 'urgency', value: number) => {
    const score = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
    onUpdate({ ...todo, [key]: score });
  };
  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete(todo.id);
    onClose();
  };

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-panel-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl md:top-14 md:z-20 md:h-[calc(100vh-3.5rem)] md:w-96 md:shadow-md"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 id="todo-panel-title" className="text-base font-semibold text-slate-900">待办详情设置</h3>
            <p className="mt-0.5 text-xs text-slate-500">{leaf ? '叶子待办节点' : `父节点（包含 ${todo.children.length} 个子待办）`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭待办详情设置" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          {leaf ? (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="font-medium text-slate-700">完成状态</span>
              <button
                type="button"
                onClick={() => onUpdate({ ...todo, completed: !todo.completed })}
                aria-pressed={todo.completed}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${todo.completed ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {todo.completed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-400" />}
                {todo.completed ? '已完成' : '未完成'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <GitBranch className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />当前为父节点，不能标记完成。
            </div>
          )}

          <div>
            <label htmlFor="todo-title" className="mb-1.5 block text-xs font-semibold text-slate-700">标题</label>
            <input id="todo-title" type="text" value={todo.title} onChange={(e) => onUpdate({ ...todo, title: e.target.value })} placeholder="请输入待办标题" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="todo-note" className="mb-1.5 block text-xs font-semibold text-slate-700">备注</label>
            <textarea id="todo-note" value={todo.note} onChange={(e) => onUpdate({ ...todo, note: e.target.value })} rows={3} placeholder="添加详细描述或备注..." className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="todo-due-date" className="text-xs font-semibold text-slate-700">截止日期</label>
              {todo.dueDate && <button type="button" onClick={() => onUpdate({ ...todo, dueDate: '' })} className="text-xs text-blue-600 hover:text-blue-800">清除日期</button>}
            </div>
            <input id="todo-due-date" type="date" value={todo.dueDate} onChange={(e) => onUpdate({ ...todo, dueDate: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {(['importance', 'urgency'] as const).map((key) => {
            const label = key === 'importance' ? '重要程度' : '紧急程度';
            return (
              <div key={key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor={`todo-${key}`} className="text-xs font-semibold text-slate-700">{label}</label>
                  <span className="font-mono text-xs font-medium tabular-nums text-slate-600">{todo[key]} / 100</span>
                </div>
                <div className="flex items-center gap-3">
                  <input id={`todo-${key}`} type="range" min={0} max={100} value={todo[key]} onChange={(e) => updateScore(key, Number(e.target.value))} className="flex-1 cursor-pointer accent-blue-600" />
                  <input type="number" min={0} max={100} value={todo[key]} onChange={(e) => updateScore(key, Number(e.target.value))} aria-label={`${label}数值`} className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            );
          })}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-700">标签选择（支持多选）</legend>
            {tags.length === 0 ? (
              <p className="text-xs text-slate-400">暂无可用标签，可在设置页面创建。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = todo.tagIds.includes(tag.id);
                  return (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} aria-pressed={selected} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${selected ? 'ring-2 ring-blue-500 font-semibold' : 'opacity-70 hover:opacity-100'}`} style={{ backgroundColor: `${tag.color}15`, color: tag.color, borderColor: tag.color }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />{tag.title}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
          <div className="pt-2">
            {leaf && todo.completed ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />已完成的叶子待办不可直接添加子节点。请先取消完成，再添加子待办。
              </div>
            ) : (
              <button type="button" onClick={() => onAddChild(todo.id)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100">
                <Plus className="h-4 w-4" aria-hidden="true" />添加子待办
              </button>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" onClick={() => setShowDeleteConfirm(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
            <Trash2 className="h-4 w-4" aria-hidden="true" />删除当前待办
          </button>
        </div>
      </aside>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="确认删除该待办事项？"
        message={leaf
          ? '删除后无法撤销。若这是其父节点的最后一个子项，父节点将转换为未完成的叶子待办。'
          : `此操作将同时删除该节点及其全部 ${countDescendants(todo)} 个后代子待办，且无法撤销。`}
        confirmLabel="确认删除"
        cancelLabel="取消"
        isDanger
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
