import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ScoreCoordinatePickerProps {
  importance: number;
  urgency: number;
  onChange: (importance: number, urgency: number) => void;
}

const chartSize = 256;
const plotLeft = 38;
const plotRight = 232;
const plotTop = 20;
const plotBottom = 210;
const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function ScoreCoordinatePicker({ importance, urgency, onChange }: ScoreCoordinatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLElement>(null);

  const updatePosition = () => {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    setIsMobile(mobile);
    if (mobile) return;

    const trigger = triggerRef.current?.getBoundingClientRect();
    const panel = triggerRef.current?.closest('aside[role="dialog"]')?.getBoundingClientRect();
    if (!trigger || !panel) return;

    const width = 320;
    const estimatedHeight = 384;
    setPosition({
      left: Math.max(16, panel.left - width - 16),
      top: Math.min(
        Math.max(16, trigger.top - 44),
        Math.max(16, window.innerHeight - estimatedHeight - 16),
      ),
    });
  };

  const togglePicker = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    updatePosition();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (pickerRef.current?.contains(target) || triggerRef.current?.contains(target)) return;

      setIsOpen(false);
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    const handleResize = () => updatePosition();
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const updateFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * chartSize;
    const y = ((event.clientY - bounds.top) / bounds.height) * chartSize;
    const nextImportance = clampScore(((x - plotLeft) / (plotRight - plotLeft)) * 100);
    const nextUrgency = clampScore(((plotBottom - y) / (plotBottom - plotTop)) * 100);
    onChange(nextImportance, nextUrgency);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
  };

  const handleChartKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const step = event.shiftKey ? 10 : 1;
    let nextImportance = importance;
    let nextUrgency = urgency;
    if (event.key === 'ArrowLeft') nextImportance -= step;
    else if (event.key === 'ArrowRight') nextImportance += step;
    else if (event.key === 'ArrowDown') nextUrgency -= step;
    else if (event.key === 'ArrowUp') nextUrgency += step;
    else return;
    event.preventDefault();
    onChange(clampScore(nextImportance), clampScore(nextUrgency));
  };

  const pointX = plotLeft + (importance / 100) * (plotRight - plotLeft);
  const pointY = plotBottom - (urgency / 100) * (plotBottom - plotTop);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={togglePicker}
        aria-label="打开二维坐标编辑器"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="用二维坐标调整重要程度和紧急程度"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="M3.5 2.5v15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m14.5 14.5 3 3-3 0M6.5 6.5h.01M10.5 10.5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && createPortal(
        <>
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] bg-slate-900/20 md:bg-transparent" />
          <div className="pointer-events-none fixed inset-0 z-[61] flex items-end justify-center md:block">
            <section
              ref={pickerRef}
              role="dialog"
              aria-modal={isMobile}
              aria-labelledby="score-coordinate-title"
              style={isMobile ? undefined : { left: position.left, top: position.top }}
              className="pointer-events-auto max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl md:fixed md:max-h-[calc(100dvh-2rem)] md:w-80 md:rounded-xl md:p-4"
            >
              <header className="mb-3 flex items-center justify-between gap-3">
                <h2 id="score-coordinate-title" className="text-sm font-semibold text-slate-900">调整重要程度与紧急程度</h2>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="关闭坐标编辑器"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </header>

              <div className="flex flex-col items-center">
                <span className="mb-1 w-full text-center text-[11px] font-medium text-slate-500">紧急程度 ↑</span>
                <svg
                  viewBox="0 0 256 256"
                  role="group"
                  tabIndex={0}
                  aria-label={'重要程度 ' + importance + '，紧急程度 ' + urgency + '。使用方向键调整。'}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onKeyDown={handleChartKeyDown}
                  className="aspect-square w-full max-w-64 touch-none select-none rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[0, 25, 50, 75, 100].map((tick) => {
                    const x = plotLeft + (tick / 100) * (plotRight - plotLeft);
                    const y = plotBottom - (tick / 100) * (plotBottom - plotTop);
                    return (
                      <g key={tick}>
                        <line x1={x} y1={plotTop} x2={x} y2={plotBottom} stroke="#e2e8f0" strokeWidth="1" />
                        <line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                      </g>
                    );
                  })}
                  <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#475569" strokeWidth="2" />
                  <line x1={plotLeft} y1={plotBottom} x2={plotLeft} y2={plotTop} stroke="#475569" strokeWidth="2" />
                  <path d="m232 210-7-4v8zM38 20l-4 7h8z" fill="#475569" />
                  {[0, 50, 100].map((tick) => {
                    const x = plotLeft + (tick / 100) * (plotRight - plotLeft);
                    const y = plotBottom - (tick / 100) * (plotBottom - plotTop);
                    return (
                      <g key={tick} fill="#64748b" fontSize="10">
                        <text x={x} y="232" textAnchor="middle">{tick}</text>
                        <text x="30" y={y + 3} textAnchor="end">{tick}</text>
                      </g>
                    );
                  })}
                  <line x1={pointX} y1={pointY} x2={pointX} y2={plotBottom} stroke="#93c5fd" strokeDasharray="3 3" />
                  <line x1={plotLeft} y1={pointY} x2={pointX} y2={pointY} stroke="#93c5fd" strokeDasharray="3 3" />
                  <circle cx={pointX} cy={pointY} r="10" fill="#2563eb" stroke="white" strokeWidth="3" />
                  <circle cx={pointX} cy={pointY} r="3" fill="white" />
                </svg>
                <span className="mt-1 text-[11px] font-medium text-slate-500">重要程度 →</span>
              </div>

              <div className="mt-3 flex items-center justify-center gap-4 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium tabular-nums text-blue-800">
                <span>重要 {importance}</span>
                <span aria-hidden="true" className="text-blue-300">·</span>
                <span>紧急 {urgency}</span>
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400">拖动坐标点，或聚焦图表后使用方向键微调</p>
            </section>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
