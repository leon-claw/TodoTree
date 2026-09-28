import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Circle, GitBranch, Plus, Trash2, X } from 'lucide-react';
import { ScoreCoordinatePicker } from './ScoreCoordinatePicker';
import { isLeaf } from '../storage';
import { Tag, Todo } from '../types';

interface SettingsPanelProps {
  todo: Todo | null;
  tags: Tag[];
  onClose: () => void;
  onUpdate: (updated: Todo) => void;
  onAddChild: (parentId: string) => void;
  onRequestDelete: (id: string) => void;
  overlay?: boolean;
}

export function SettingsPanel({ todo, tags, onClose, onUpdate, onAddChild, onRequestDelete, overlay = false }: SettingsPanelProps) {
  const [titleDraft, setTitleDraft] = useState(todo?.title ?? '');
  const [scoreDrafts, setScoreDrafts] = useState({
    importance: String(todo?.importance ?? 0),
    urgency: String(todo?.urgency ?? 0),
  });
  const titleIsComposingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setTitleDraft(todo?.title ?? '');
  }, [todo?.id, todo?.title]);

  useEffect(() => {
    setScoreDrafts({ importance: String(todo?.importance ?? 0), urgency: String(todo?.urgency ?? 0) });
  }, [todo?.id, todo?.importance, todo?.urgency]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="alertdialog"], [data-task-composer]')) {
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
    setScoreDrafts((current) => ({ ...current, [key]: String(score) }));
  };
  const previewScorePair = (importance: number, urgency: number) => {
    setScoreDrafts((current) => {
      const next = { importance: String(importance), urgency: String(urgency) };
      return current.importance === next.importance && current.urgency === next.urgency ? current : next;
    });
  };
  const commitScoreDraft = (key: 'importance' | 'urgency') => {
    const draft = scoreDrafts[key].trim();
    if (!draft || !Number.isFinite(Number(draft))) {
      setScoreDrafts((current) => ({ ...current, [key]: String(todo[key]) }));
      return;
    }
    updateScore(key, Number(draft));
  };
  const updateTitleDraft = (title: string) => {
    setTitleDraft(title);
    if (!titleIsComposingRef.current && title.trim()) onUpdate({ ...todo, title });
  };
  const finishTitleEdit = () => {
    const title = titleDraft.trim();
    if (!title) {
      setTitleDraft(todo.title);
      return;
    }
    setTitleDraft(title);
    if (title !== todo.title) onUpdate({ ...todo, title });
  };

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-panel-title"
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-xl ${overlay ? 'md:top-14 md:bottom-0 md:h-auto md:w-[26rem] md:flex-none md:shadow-xl' : 'md:relative md:inset-auto md:z-20 md:h-full md:w-[26rem] md:flex-none md:shadow-md'}`}
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
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${todo.completed ? 'border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
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
            <input
              id="todo-title"
              type="text"
              value={titleDraft}
              onChange={(e) => updateTitleDraft(e.target.value)}
              onBlur={finishTitleEdit}
              onCompositionStart={() => { titleIsComposingRef.current = true; }}
              onCompositionEnd={(event) => {
                titleIsComposingRef.current = false;
                const title = event.currentTarget.value;
                setTitleDraft(title);
                if (title.trim()) onUpdate({ ...todo, title });
              }}
              placeholder="请输入待办标题"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1.5 text-[11px] text-slate-400">修改会在停止输入后自动保存</p>
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
          <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-700">重要程度与紧急程度</h4>
                <p className="mt-0.5 text-[11px] text-slate-400">可用滑块、数值或二维坐标调整</p>
              </div>
              <ScoreCoordinatePicker
                importance={todo.importance}
                urgency={todo.urgency}
                onPreview={previewScorePair}
                onChange={(importance, urgency) => onUpdate({ ...todo, importance, urgency })}
              />
            </div>
            <div className="space-y-4">
              {(['importance', 'urgency'] as const).map((key) => {
                const label = key === 'importance' ? '重要程度' : '紧急程度';
                const draftValue = Number(scoreDrafts[key]);
                const displayedScore = scoreDrafts[key].trim() && Number.isInteger(draftValue)
                  ? Math.max(0, Math.min(100, draftValue))
                  : todo[key];
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor={'todo-' + key} className="text-xs font-semibold text-slate-700">{label}</label>
                      <span className="font-mono text-xs font-medium tabular-nums text-slate-600">{displayedScore} / 100</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input id={'todo-' + key} type="range" min={0} max={100} value={displayedScore} onChange={(e) => updateScore(key, Number(e.target.value))} className="flex-1 cursor-pointer accent-blue-600" />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreDrafts[key]}
                        onChange={(event) => {
                          const value = event.target.value;
                          setScoreDrafts((current) => ({ ...current, [key]: value }));
                          if (value.trim() && Number.isInteger(Number(value))) updateScore(key, Number(value));
                        }}
                        onBlur={() => commitScoreDraft(key)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                        aria-label={label + '数值'}
                        className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
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
          <button type="button" onClick={() => onRequestDelete(todo.id)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
            <Trash2 className="h-4 w-4" aria-hidden="true" />删除当前待办
          </button>
        </div>
      </aside>
    </>
  );
}
