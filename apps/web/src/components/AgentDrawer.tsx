import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Send, X } from 'lucide-react';
import type { Api, Model } from '@earendil-works/pi-ai';
import type { Agent } from '@earendil-works/pi-agent-core';
import type { AppData, Todo } from '../types';
import type { AgentProposal } from '../agent/proposal';
import type { AppDataChangeSummary, EntityChange } from '../agent/diff';
import { createTaskAgent } from '../agent/taskAgent';

interface AgentDrawerProps {
  open: boolean;
  onClose: () => void;
  getData: () => AppData;
  dataAvailable: boolean;
  onApply: (proposal: AgentProposal) => string | null;
  canUndo: boolean;
  onUndo: () => string | null;
}
interface PendingProposal { proposal: AgentProposal; summary: AppDataChangeSummary }
interface AgentConfig { available: boolean; model?: Model<Api> }

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((block): block is { type: 'text'; text: string } =>
    !!block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text).join('\n');
}
function findTodo(items: Todo[], id: string): Todo | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const child = findTodo(item.children, id);
    if (child) return child;
  }
}
function formatValue(value: unknown): string {
  return typeof value === 'string' ? value || '（空）' : JSON.stringify(value);
}
function ChangeList({ label, changes, proposal }: { label: string; changes: EntityChange[]; proposal: AgentProposal }) {
  if (!changes.length) return null;
  return <div className="space-y-2">
    <h4 className="text-xs font-semibold text-slate-700">{label} · {changes.length}</h4>
    {changes.map((change) => {
      const old = findTodo(proposal.base.todos, change.id);
      return <div key={change.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs leading-5">
        <div className="font-medium text-slate-900">{change.title || '未命名'} <span className="font-mono text-slate-400">#{change.id}</span></div>
        {change.beforePath && <div className="break-all text-slate-600">原路径：{change.beforePath.join(' / ')}</div>}
        {change.afterPath && <div className="break-all text-slate-600">新路径：{change.afterPath.join(' / ')}</div>}
        {change.deletion && <div className="text-red-700">{change.deletion === 'direct' ? '直接删除' : '随父任务连带删除'}{old?.dueDate ? ` · 截止 ${old.dueDate}` : ''}</div>}
        {change.fields?.map((field) => <div key={field.field} className="break-all text-slate-600">{field.field}：{formatValue(field.before)} → {formatValue(field.after)}</div>)}
      </div>;
    })}
  </div>;
}

export function AgentDrawer({ open, onClose, getData, dataAvailable, onApply, canUndo, onUndo }: AgentDrawerProps) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingProposal | null>(null);
  const pendingRef = useRef<PendingProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [sentDataNotice, setSentDataNotice] = useState(false);
  const agentRef = useRef<Agent | null>(null);
  const getDataRef = useRef(getData);
  getDataRef.current = getData;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent-config').then(async (response) => {
      if (!response.ok) throw new Error('无法读取 Agent 配置');
      return response.json() as Promise<AgentConfig>;
    }).then((result) => { if (!cancelled) setConfig(result); })
      .catch((cause) => { if (!cancelled) setConfigError(cause instanceof Error ? cause.message : 'Agent 配置读取失败'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!config?.available || !config.model || agentRef.current) return;
    const agent = createTaskAgent({
      model: config.model,
      proxyUrl: `${window.location.origin}/api/stream`,
      getData: () => getDataRef.current(),
      onProposal: (proposal, summary) => {
        if (pendingRef.current) throw new Error('请先应用或拒绝待审阅提案');
        const next = { proposal, summary };
        pendingRef.current = next;
        setPending(next);
      },
    });
    agentRef.current = agent;
    const unsubscribe = agent.subscribe((event) => {
      if (event.type === 'message_update' || event.type === 'message_end' || event.type === 'agent_end' || event.type === 'message_start') {
        setRevision((value) => value + 1);
      }
    });
    return () => { unsubscribe(); agent.abort(); agentRef.current = null; };
  }, [config]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="alertdialog"], [data-task-composer]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const send = async () => {
    const text = draft.trim();
    const agent = agentRef.current;
    if (!text || !agent || !dataAvailable || busy) return;
    setDraft('');
    setError(null);
    setSentDataNotice(true);
    setBusy(true);
    try {
      await agent.prompt(text);
      if (agent.state.errorMessage) throw new Error(agent.state.errorMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请求失败，请重试');
      setDraft((current) => current || text);
    } finally {
      setBusy(false);
      setRevision((value) => value + 1);
    }
  };
  const apply = () => {
    if (!pending) return;
    const result = onApply(pending.proposal);
    if (result) { setError(result); return; }
    pendingRef.current = null;
    setPending(null);
    setError(null);
  };
  const reject = () => { pendingRef.current = null; setPending(null); setError(null); };
  const undo = () => { const result = onUndo(); if (result) setError(result); else setError(null); };
  const messages = agentRef.current?.state.messages.filter((message) => message.role === 'user' || message.role === 'assistant') ?? [];
  const streaming = agentRef.current?.state.streamingMessage;
  void revision;

  return <aside aria-label="Agent 抽屉" aria-hidden={!open} className={`${open ? 'flex' : 'hidden'} fixed inset-0 z-40 w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:relative md:inset-auto md:z-20 md:h-full md:w-[29rem] md:shrink-0`}>
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
      <div className="flex items-center gap-2 font-semibold text-slate-900"><Bot className="h-5 w-5 text-blue-600" /> Agent <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">任务数据</span></div>
      <button type="button" onClick={onClose} aria-label="关闭 Agent" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">可询问任务和标签，也可提出修改。写入前会展示实际差异，由你确认后才保存。{!sentDataNotice && <span className="block pt-1 font-medium">首次请求会将当前任务 JSON 经本地代理发送至配置的模型服务。</span>}</div>
      {!dataAvailable && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">本地数据读取异常。请先通过设置页恢复有效数据，再使用 Agent。</div>}
      {configError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{configError}</div>}
      {config && !config.available && <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Agent 尚未配置模型。请在服务端设置模型和密钥。</div>}
      {messages.map((message, index) => {
        const content = messageText(message.content);
        if (!content) return null;
        return <div key={index} className={`max-w-[95%] whitespace-pre-wrap break-words rounded-xl p-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-800'}`}>{content}</div>;
      })}
      {streaming?.role === 'assistant' && messageText(streaming.content) && <div className="max-w-[95%] whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800">{messageText(streaming.content)}</div>}
      {busy && <div className="text-xs text-slate-500">Agent 正在处理…</div>}
      {pending && <section aria-label="待审阅变更" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-3">
        <div><h3 className="font-semibold text-slate-900">待审阅变更</h3><p className="mt-1 text-xs text-slate-700">新增 {pending.summary.totals.added} · 修改 {pending.summary.totals.updated} · 移动 {pending.summary.totals.moved} · 删除 {pending.summary.totals.deleted}</p></div>
        {pending.summary.totals.deleted > 0 && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-800">直接删除 {pending.summary.totals.directDeleted} 项，连带删除 {pending.summary.totals.cascadeDeleted} 项。请核对下列全部删除范围。</p>}
        <ChangeList label="新增任务" changes={pending.summary.todos.added} proposal={pending.proposal} />
        <ChangeList label="修改任务" changes={pending.summary.todos.updated} proposal={pending.proposal} />
        <ChangeList label="移动任务" changes={pending.summary.todos.moved} proposal={pending.proposal} />
        <ChangeList label="删除任务" changes={pending.summary.todos.deleted} proposal={pending.proposal} />
        <ChangeList label="新增标签" changes={pending.summary.tags.added} proposal={pending.proposal} />
        <ChangeList label="修改标签" changes={pending.summary.tags.updated} proposal={pending.proposal} />
        <ChangeList label="移动标签" changes={pending.summary.tags.moved} proposal={pending.proposal} />
        <ChangeList label="删除标签" changes={pending.summary.tags.deleted} proposal={pending.proposal} />
        <details className="text-xs text-slate-600"><summary className="flex cursor-pointer items-center gap-1"><ChevronDown className="h-3 w-3" />技术详情：Patch 与 JSON 差异</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-100">{JSON.stringify({ patch: pending.proposal.patch, before: pending.proposal.base, after: pending.proposal.next }, null, 2)}</pre></details>
        <p className="text-xs font-medium text-slate-800">实际影响：{pending.summary.totals.added + pending.summary.totals.updated + pending.summary.totals.moved + pending.summary.totals.deleted} 项（包含 {pending.summary.totals.deleted} 项删除）</p>
        <div className="flex gap-2"><button type="button" onClick={reject} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">拒绝</button><button type="button" onClick={apply} disabled={!dataAvailable} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending.summary.totals.deleted ? `删除 ${pending.summary.totals.deleted} 项并应用变更` : '应用变更'}</button></div>
      </section>}
      {canUndo && <button type="button" onClick={undo} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">撤销本次 Agent 变更</button>}
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>
    <form className="border-t border-slate-200 p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <label htmlFor="agent-prompt" className="sr-only">给 Agent 的指令</label>
      <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <textarea id="agent-prompt" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} rows={2} placeholder="例如：找出所有已过期任务，然后删除" disabled={!dataAvailable || !config?.available} className="max-h-40 min-h-12 flex-1 resize-none outline-none placeholder:text-slate-400 disabled:bg-white" />
        <button type="submit" aria-label="发送指令" disabled={!draft.trim() || !dataAvailable || !config?.available || busy} className="rounded-lg bg-blue-600 p-2 text-white disabled:bg-slate-200 disabled:text-slate-400"><Send className="h-4 w-4" /></button>
      </div>
      <div className="mt-1 text-right text-[11px] text-slate-400">Enter 发送 · Shift+Enter 换行</div>
    </form>
  </aside>;
}
