import { ArrowLeft, Bot, CheckSquare, GitFork, Settings } from 'lucide-react';
import { ActiveTab } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  agentOpen: boolean;
  onToggleAgent: () => void;
  showBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
}

export function Navbar({ activeTab, onTabChange, agentOpen, onToggleAgent, showBack = false, backLabel = '返回', onBack }: NavbarProps) {
  const tabs: { id: ActiveTab; label: string; compact: string; Icon: typeof CheckSquare }[] = [
    { id: 'graph', label: '图表视图', compact: '图表', Icon: GitFork },
    { id: 'list', label: '列表视图', compact: '列表', Icon: CheckSquare },
    { id: 'settings', label: '设置页面', compact: '设置', Icon: Settings },
  ];

  return (
    <header className="z-30 flex h-14 shrink-0 select-none items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 sm:px-6">
      <div className="flex shrink-0 items-center gap-2">
        <div aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-base font-bold text-white shadow-sm">T</div>
        <span className="hidden text-base font-semibold tracking-tight text-slate-900 sm:inline sm:text-lg">TodoTree</span>
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:ml-2 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>{backLabel}</span>
          </button>
        )}
      </div>
      <nav aria-label="主导航" className="flex min-w-0 max-w-[calc(100vw-3rem)] items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
        {tabs.map(({ id, label, compact, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-label={label}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${activeTab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sm:hidden">{compact}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>
      <button type="button" onClick={onToggleAgent} aria-label="打开 Agent" aria-expanded={agentOpen} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${agentOpen ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}><Bot className="h-4 w-4" /><span className="hidden sm:inline">Agent</span></button>
    </header>
  );
}
