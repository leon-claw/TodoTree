import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ListTree,
  Search,
  X,
} from 'lucide-react';
import { getAncestorIds, searchFlowTodos } from '../flowNavigation';
import type { FlowEntry } from '../flowNavigation';
import type { Tag } from '../types';

interface FlowNavigatorProps {
  entries: FlowEntry[];
  tags: Tag[];
  selectedId: string | null;
  active: boolean;
  collapsedIds: ReadonlySet<string>;
  onLocate: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

export function FlowNavigator({
  entries,
  tags,
  selectedId,
  active,
  collapsedIds,
  onLocate,
  onToggleCollapse,
}: FlowNavigatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const results = useMemo(() => searchFlowTodos(entries, tags, query), [entries, tags, query]);
  const selectedAncestors = useMemo(
    () => new Set(selectedId ? getAncestorIds(entries, selectedId) : []),
    [entries, selectedId],
  );

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
    resultRefs.current = resultRefs.current.slice(0, results.length);
  }, [results.length]);

  useEffect(() => {
    if ((!isOpen && !isOutlineOpen) || !active) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setIsOutlineOpen(false);
      }
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => window.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [active, isOpen, isOutlineOpen]);

  useEffect(() => {
    if (!active) return;
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOutlineOpen(false);
        setQuery('');
        setIsOpen(true);
      } else if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) {
        if (isOpen) setIsOpen(false);
        else if (isOutlineOpen) setIsOutlineOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [active, isOpen, isOutlineOpen]);

  useEffect(() => {
    if (isOpen) resultRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const chooseResult = (id: string) => {
    setIsOpen(false);
    setQuery('');
    onLocate(id);
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      chooseResult(results[activeIndex].id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          setIsOutlineOpen(false);
          setQuery('');
          setIsOpen(true);
        }}
        title="查找任务（⌘K / Ctrl+K）"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:text-sm"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span>查找任务</span>
        <kbd className="hidden rounded border border-slate-200 px-1 py-0.5 text-[10px] text-slate-400 lg:inline">⌘K</kbd>
      </button>
      <button
        type="button"
        aria-expanded={isOutlineOpen}
        aria-controls="flow-outline"
        onClick={() => {
          setIsOpen(false);
          setIsOutlineOpen((open) => !open);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:text-sm"
      >
        <ListTree className="h-4 w-4" aria-hidden="true" />
        <span>大纲</span>
      </button>

      {isOpen && (
        <section
          role="dialog"
          aria-label="查找任务"
          className="absolute left-0 top-full z-30 mt-2 w-[min(38rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="搜索任务标题、备注或标签…"
              aria-label="搜索任务标题、备注或标签"
              aria-controls="flow-search-results"
              aria-activedescendant={results[activeIndex] ? `flow-result-${activeIndex}` : undefined}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="关闭查找任务"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div id="flow-search-results" role="listbox" aria-label="搜索结果" className="max-h-[min(60vh,28rem)] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                {query.trim() ? '没有找到任务' : '输入关键词，查找任意层级的任务'}
              </p>
            ) : results.map((entry, index) => {
              const parentPath = entry.path.slice(0, -1).map(({ title }) => title).join(' › ');
              return (
                <button
                  key={entry.id}
                  ref={(element) => { resultRefs.current[index] = element; }}
                  id={`flow-result-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => chooseResult(entry.id)}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    activeIndex === index ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  {entry.isLeaf && entry.completed
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    : <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${entry.isLeaf ? 'text-slate-300' : 'text-blue-500'}`} aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${entry.isLeaf && entry.completed ? 'text-slate-500 line-through' : 'font-medium text-slate-900'}`}>
                      {entry.title || '未命名待办'}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {parentPath || '根任务'}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-[11px] text-slate-400">
                    {entry.isLeaf ? (entry.completed ? '已完成' : '叶子任务') : '父任务'}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
            <span>↑↓ 选择 · Enter 定位 · Esc 关闭</span>
            {selectedId && <span>当前任务已标记</span>}
          </div>
        </section>
      )}

      {isOutlineOpen && (
        <section
          id="flow-outline"
          aria-label="任务大纲"
          className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">任务大纲</h3>
              <p className="text-[11px] text-slate-400">{entries.length} 项 · 点击任务定位</p>
            </div>
            <button
              type="button"
              aria-label="关闭大纲"
              onClick={() => setIsOutlineOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            ><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <div className="max-h-[min(65vh,34rem)] overflow-y-auto p-1.5">
            {entries.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">暂无任务</p>
            ) : entries.map((entry) => {
              const isSelected = entry.id === selectedId;
              const isAncestor = selectedAncestors.has(entry.id);
              const isCollapsed = collapsedIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className={`flex min-w-0 items-center gap-1 rounded-md pr-1 ${
                    isSelected ? 'bg-blue-50' : isAncestor ? 'bg-slate-50' : 'hover:bg-slate-50'
                  }`}
                  style={{ paddingLeft: `${6 + Math.min(entry.depth, 10) * 14}px` }}
                >
                  {entry.descendantCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => onToggleCollapse(entry.id)}
                      aria-label={`${isCollapsed ? '展开' : '折叠'}：${entry.title || '未命名待办'}`}
                      aria-expanded={!isCollapsed}
                      title={isCollapsed ? '展开分支' : '折叠分支'}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                    >
                      {isCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                  ) : <span aria-hidden="true" className="w-6 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => onLocate(entry.id)}
                    aria-current={isSelected ? 'location' : undefined}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded py-1.5 text-left text-xs ${
                      isSelected ? 'font-semibold text-blue-800' : isAncestor ? 'font-medium text-blue-700' : 'text-slate-700'
                    }`}
                    title={entry.path.map(({ title }) => title).join(' › ')}
                  >
                    <span className="min-w-0 flex-1 truncate">{entry.title || '未命名待办'}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {entry.isLeaf ? (entry.completed ? '完成' : '叶子') : '父任务'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
