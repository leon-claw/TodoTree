import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ComposerAnchor } from '../types';

interface TaskComposerProps {
  targetLabel: string;
  anchor?: ComposerAnchor;
  error: string | null;
  onSubmit: (titles: string[]) => boolean;
  onCancel: () => void;
}

export function TaskComposer({ targetLabel, anchor, error, onSubmit, onCancel }: TaskComposerProps) {
  const [singleDraft, setSingleDraft] = useState('');
  const [batchDraft, setBatchDraft] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const draft = batchMode ? batchDraft : singleDraft;
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  const batchTitles = useMemo(
    () => batchDraft.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    [batchDraft],
  );
  const setDraft = (value: string) => batchMode ? setBatchDraft(value) : setSingleDraft(value);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    (batchMode ? textareaRef.current : inputRef.current)?.focus();
  }, [batchMode]);

  const handleSubmit = () => {
    if (isComposingRef.current) return;
    const titles = batchMode ? batchTitles : [draft.trim()].filter(Boolean);
    if (titles.length === 0) return;
    if (!onSubmit(titles)) return;
    setAddedCount((count) => count + titles.length);
    setDraft('');
    window.requestAnimationFrame(() => (batchMode ? textareaRef.current : inputRef.current)?.focus());
  };

  return (
    <div
      data-task-composer="true"
      className={`fixed inset-0 z-[60] flex overflow-y-auto ${anchor ? 'items-start justify-start bg-transparent' : 'items-start justify-center bg-slate-900/30 px-4 py-[12vh] backdrop-blur-xs'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-composer-title"
        style={anchor ? (() => {
          const width = Math.min(512, Math.max(0, anchor.viewportRight - anchor.viewportLeft - 32));
          const minLeft = anchor.viewportLeft + 16;
          const maxLeft = Math.max(minLeft, anchor.viewportRight - width - 16);
          const rightPlacement = anchor.right + 12 + width <= anchor.viewportRight - 16;
          const preferredLeft = rightPlacement ? anchor.right + 12 : anchor.left - width - 12;
          return {
            position: 'absolute' as const,
            left: Math.min(Math.max(minLeft, preferredLeft), maxLeft),
            top: Math.min(Math.max(16, anchor.top), Math.max(16, window.innerHeight - 420)),
            width,
            maxHeight: 'calc(100vh - 2rem)',
            overflowY: 'auto' as const,
          };
        })() : undefined}
        className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="task-composer-title" className="text-base font-semibold text-slate-900">添加任务</h2>
            <p className="mt-1 text-xs text-slate-500">添加到：{targetLabel}</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="结束添加" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-600">{batchMode ? '每行一个任务标题' : '输入一个任务标题'}</p>
            <button
              type="button"
              onClick={() => setBatchMode((value) => !value)}
              className="text-xs font-medium text-blue-700 hover:text-blue-900"
            >
              {batchMode ? '单条输入' : '批量输入'}
            </button>
          </div>

          {batchMode ? (
            <>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing && !isComposingRef.current) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                rows={6}
                placeholder={'信息检索\n寻找数据集\n做实验'}
                aria-label="批量任务标题，每行一个"
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500">将创建 {batchTitles.length} 个任务。空行会忽略，标题首尾空格会去除。按 Ctrl/⌘+Enter 确认。</p>
            </>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  if (event.nativeEvent.isComposing || event.keyCode === 229 || isComposingRef.current) return;
                  event.preventDefault();
                  handleSubmit();
                }}
                placeholder="输入任务标题"
                aria-label="任务标题"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500">按 Enter 添加；输入框会保留在当前目标，便于连续添加。</p>
            </>
          )}

          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          {addedCount > 0 && <p role="status" className="text-xs text-emerald-700">已添加 {addedCount} 项，可以继续输入。</p>}

          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              结束添加
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={batchMode ? batchTitles.length === 0 : !draft.trim()}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {batchMode ? `创建 ${batchTitles.length} 个任务` : '添加并继续'}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
