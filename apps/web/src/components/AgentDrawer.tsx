import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, ChevronDown, Send, Settings, X } from 'lucide-react';
import type { Agent } from '@earendil-works/pi-agent-core';
import type { AppData, Todo } from '../types';
import type { AgentProposal } from '../agent/proposal';
import type { AppDataChangeSummary, EntityChange } from '../agent/diff';
import { createTodoAgent } from '../agent/todoAgent';
import { createGraphApi } from '../agent/codeAgent';
import type { GraphStatusResponse } from '../agent/codeAgent';
import { createProfileApi } from '../agent/profileApi';
import type { AgentProfileSummary, AgentProfilesSnapshot } from '../agent/profileApi';
import { applyPendingAgentModel, selectAgentModel } from '../agent/profileSwitch';
import type { PendingAgentModel } from '../agent/profileSwitch';

interface AgentDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  getData: () => AppData;
  dataAvailable: boolean;
  onApply: (proposal: AgentProposal) => string | null;
  canUndo: boolean;
  onUndo: () => string | null;
}
interface PendingProposal { proposal: AgentProposal; summary: AppDataChangeSummary }

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
        {change.fields?.map((field) => <div key={field.field} className="break-all text-slate-600">{field.field}：{change.beforePath ? `${formatValue(field.before)} → ${formatValue(field.after)}` : formatValue(field.after)}</div>)}
      </div>;
    })}
  </div>;
}

export function AgentDrawer({ open, onClose, onOpenSettings, getData, dataAvailable, onApply, canUndo, onUndo }: AgentDrawerProps) {
  const [profileSnapshot, setProfileSnapshot] = useState<AgentProfilesSnapshot | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [graphStatus, setGraphStatus] = useState<GraphStatusResponse | null>(null);
  const [graphStatusError, setGraphStatusError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingProposal | null>(null);
  const pendingRef = useRef<PendingProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [sentAgentNotice, setSentAgentNotice] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<AgentProfileSummary | null>(null);
  const profileApiRef = useRef(createProfileApi());
  const profileSnapshotRef = useRef<AgentProfilesSnapshot | null>(null);
  const profilesRef = useRef<AgentProfileSummary[]>([]);
  const currentProfileRef = useRef<AgentProfileSummary | null>(null);
  const pendingModelRef = useRef<PendingAgentModel>({ current: null });
  const activationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const activationSequenceRef = useRef(0);
  const agentRef = useRef<Agent | null>(null);
  const unsubscribeAgentRef = useRef<(() => void) | null>(null);
  const graphApiRef = useRef(createGraphApi());
  const getDataRef = useRef(getData);
  getDataRef.current = getData;
  const ensureAgentForProfile = useCallback((profile: AgentProfileSummary) => {
    const currentAgent = agentRef.current;
    if (!currentAgent) {
      currentProfileRef.current = profile;
      const agent = createTodoAgent({
        model: profile.model,
        proxyBaseUrl: window.location.origin,
        getProfileId: () => currentProfileRef.current?.id ?? '',
        getData: () => getDataRef.current(),
        onProposal: (proposal, summary) => {
          if (pendingRef.current) throw new Error('请先应用或拒绝待审阅提案');
          const next = { proposal, summary };
          pendingRef.current = next;
          setPending(next);
        },
        graphApi: graphApiRef.current,
      });
      agentRef.current = agent;
      setCurrentProfile(profile);
      unsubscribeAgentRef.current = agent.subscribe((event) => {
        if (event.type === 'agent_end') {
          applyPendingAgentModel(agent, pendingModelRef.current);
          const appliedProfile = profilesRef.current.find((candidate) => candidate.model.provider === agent.state.model.provider) ?? null;
          currentProfileRef.current = appliedProfile;
          setCurrentProfile(appliedProfile);
        }
        if (event.type === 'message_update' || event.type === 'message_end' || event.type === 'agent_end' || event.type === 'message_start') {
          setRevision((value) => value + 1);
        }
      });
      return;
    }

    const wasStreaming = currentAgent.state.isStreaming;
    selectAgentModel(currentAgent, profile.model, pendingModelRef.current);
    if (!wasStreaming) {
      currentProfileRef.current = profile;
      setCurrentProfile(profile);
    }
  }, []);

  const syncProfileSnapshot = useCallback((next: AgentProfilesSnapshot) => {
    profileSnapshotRef.current = next;
    profilesRef.current = next.profiles;
    setProfileSnapshot(next);
    const activeProfile = next.profiles.find((profile) => profile.id === next.activeProfileId);
    if (activeProfile) {
      ensureAgentForProfile(activeProfile);
    } else if (!agentRef.current?.state.isStreaming) {
      currentProfileRef.current = null;
      pendingModelRef.current.current = null;
      setCurrentProfile(null);
    }
  }, [ensureAgentForProfile]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    setProfileLoading(true);
    setProfileError(null);
    setGraphStatusError(null);
    profileApiRef.current.getProfiles().then((next) => {
      if (!cancelled) syncProfileSnapshot(next);
    }).catch((cause) => {
      if (!cancelled) setProfileError(cause instanceof Error ? cause.message : 'Agent 配置读取失败。');
    }).finally(() => {
      if (!cancelled) setProfileLoading(false);
    });
    graphApiRef.current.status(controller.signal).then((result) => {
      if (!cancelled) setGraphStatus(result);
    }).catch((cause) => {
      if (!cancelled) setGraphStatusError(cause instanceof Error ? cause.message : '读取 Graphify 状态失败。');
    });
    return () => { cancelled = true; controller.abort(); };
  }, [open, syncProfileSnapshot]);

  useEffect(() => () => {
    unsubscribeAgentRef.current?.();
    agentRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="alertdialog"], [data-task-composer]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSelectProfile = (profileId: string) => {
    const profile = profilesRef.current.find((candidate) => candidate.id === profileId);
    const before = profileSnapshotRef.current;
    if (!profile || !before || before.activeProfileId === profileId) return;

    const optimistic = { ...before, activeProfileId: profileId };
    profileSnapshotRef.current = optimistic;
    setProfileSnapshot(optimistic);
    setError(null);
    const agent = agentRef.current;
    if (agent) {
      const wasStreaming = agent.state.isStreaming;
      selectAgentModel(agent, profile.model, pendingModelRef.current);
      if (!wasStreaming) {
        currentProfileRef.current = profile;
        setCurrentProfile(profile);
      }
    }
    setRevision((value) => value + 1);

    const sequence = ++activationSequenceRef.current;
    const activate = async () => {
      try {
        const next = await profileApiRef.current.activateProfile(profileId);
        if (sequence === activationSequenceRef.current) syncProfileSnapshot(next);
      } catch (cause) {
        if (sequence !== activationSequenceRef.current) return;
        setError(cause instanceof Error ? cause.message : '切换模型失败。');
        try {
          const actual = await profileApiRef.current.getProfiles();
          if (sequence === activationSequenceRef.current) syncProfileSnapshot(actual);
        } catch {
          setProfileError('无法确认当前模型配置，请重新打开抽屉后重试。');
        }
      }
    };
    activationQueueRef.current = activationQueueRef.current.then(activate, activate);
  };

  const send = async () => {
    const text = draft.trim();
    const agent = agentRef.current;
    const activeProfile = profileSnapshot?.profiles.find((profile) => profile.id === profileSnapshot.activeProfileId);
    if (!text || !agent || !activeProfile?.hasApiKey || busy) return;
    setDraft('');
    setError(null);
    setSentAgentNotice(true);
    setBusy(true);
    try {
      await agent.prompt(text);
      if (agent.state.errorMessage) throw new Error(agent.state.errorMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请求失败，请重试。');
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
  const activeAgent = agentRef.current;
  const messages = activeAgent?.state.messages.filter((message) => message.role === 'user' || message.role === 'assistant') ?? [];
  const streaming = activeAgent?.state.streamingMessage;
  const activeProfile = profileSnapshot?.profiles.find((profile) => profile.id === profileSnapshot.activeProfileId) ?? null;
  const deferredProfile = pendingModelRef.current.current
    ? profileSnapshot?.profiles.find((profile) => profile.model.provider === pendingModelRef.current.current?.provider) ?? null
    : null;
  const canSend = Boolean(activeAgent && activeProfile?.hasApiKey);
  void revision;

  return <aside aria-label="Agent 抽屉" aria-hidden={!open} className={(open ? 'flex' : 'hidden') + ' fixed inset-0 z-40 w-full flex-col border-l border-slate-200 bg-white shadow-2xl md:relative md:inset-auto md:z-20 md:h-full md:w-[29rem] md:shrink-0'}>
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold text-slate-900"><Bot className="h-5 w-5 shrink-0 text-blue-600" />Agent</div>
        <p className="truncate pl-7 text-[11px] text-slate-500">{currentProfile ? '当前模型：' + currentProfile.name : '尚未配置模型'}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="关闭 Agent" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
    </header>
    <section className="shrink-0 space-y-2 border-b border-slate-200 bg-white px-3 py-3">
      <div className="flex items-center gap-2">
        <label htmlFor="agent-model-profile" className="sr-only">当前 Agent 模型</label>
        <div className="relative min-w-0 flex-1">
          <select
            id="agent-model-profile"
            aria-label="当前 Agent 模型"
            value={profileSnapshot?.activeProfileId ?? ''}
            onChange={(event) => handleSelectProfile(event.target.value)}
            disabled={profileLoading || !profileSnapshot?.profiles.length}
            className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="" disabled>{profileLoading ? '正在读取模型…' : '选择模型配置'}</option>
            {profileSnapshot?.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}{profile.hasApiKey ? '' : '（缺少 Key）'}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        </div>
        <button type="button" onClick={onOpenSettings} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Settings className="h-3.5 w-3.5" aria-hidden="true" />配置模型
        </button>
      </div>
      {deferredProfile && currentProfile && deferredProfile.id !== currentProfile.id && (
        <p role="status" className="text-[11px] leading-4 text-blue-700">本次请求继续使用「{currentProfile.name}」，完成后切换到「{deferredProfile.name}」。</p>
      )}
    </section>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
        可以在同一段对话里管理任务数据和询问项目代码。任务修改会先生成待审阅提案，项目代码只读。
      </div>
      {!sentAgentNotice && (
        <div role="note" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
          你配置的 API 地址由你选择并负责。请求会发送 Agent 对话和工具返回内容；任务查询可能包含读取到的 JSON，项目问答可能包含 Graphify 结果和源码片段。保存时不会检查地址格式或可信度；你可以主动运行连接测试检查是否可用。
        </div>
      )}
      {profileLoading && !profileSnapshot && <p role="status" className="text-xs text-slate-500">正在读取 Agent 模型配置…</p>}
      {profileError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{profileError}</div>}
      {profileSnapshot?.unavailableReason && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{profileSnapshot.unavailableReason}</div>}
      {!profileLoading && !activeProfile && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>Agent 尚未配置模型。</p>
          <button type="button" onClick={onOpenSettings} className="mt-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">前往设置</button>
        </div>
      )}
      {activeProfile && !activeProfile.hasApiKey && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">当前配置没有已保存的 Key。请在设置页编辑该模型配置后再发送请求。</div>
      )}
      <div className={'rounded-lg border p-3 text-xs leading-5 ' + (graphStatus?.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600')}>
        {graphStatus?.available
          ? 'Graphify 可用 · 图谱版本 ' + (graphStatus.builtAtCommit ?? '未知')
          : graphStatusError
            ? '无法读取 Graphify 状态：' + graphStatusError + '。任务数据能力仍可使用。'
            : graphStatus
              ? 'Graphify 当前不可用，项目代码问题可能无法核实；任务数据能力仍可使用。'
              : '正在检查 Graphify 状态…'}
      </div>
      {!dataAvailable && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">本地任务数据读取异常。Agent 仍可回答项目代码问题；任务数据请求可能无法完成。</div>}
      {messages.map((message, index) => {
        const content = messageText(message.content);
        if (!content) return null;
        return <div key={index} className={'max-w-[95%] whitespace-pre-wrap break-words rounded-xl p-3 text-sm leading-6 ' + (message.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-800')}>{content}</div>;
      })}
      {streaming?.role === 'assistant' && messageText(streaming.content) && <div className="max-w-[95%] whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800">{messageText(streaming.content)}</div>}
      {busy && <div role="status" className="text-xs text-slate-500">Agent 正在处理…</div>}
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
        <div className="flex gap-2"><button type="button" onClick={reject} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">拒绝</button><button type="button" onClick={apply} disabled={!dataAvailable} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending.summary.totals.deleted ? '删除 ' + pending.summary.totals.deleted + ' 项并应用变更' : '应用变更'}</button></div>
      </section>}
      {canUndo && <button type="button" onClick={undo} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">撤销本次 Agent 变更</button>}
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </div>
    <form className="border-t border-slate-200 p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <label htmlFor="agent-prompt" className="sr-only">给 Agent 的指令</label>
      <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <textarea
          id="agent-prompt"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
          rows={2}
          placeholder="例如：找出所有已过期任务，然后删除；也可以问项目架构"
          disabled={profileLoading || !canSend}
          className="max-h-40 min-h-12 flex-1 resize-none outline-none placeholder:text-slate-400 disabled:bg-white"
        />
        <button type="submit" aria-label="发送指令" disabled={!draft.trim() || profileLoading || !canSend || busy} className="rounded-lg bg-blue-600 p-2 text-white disabled:bg-slate-200 disabled:text-slate-400"><Send className="h-4 w-4" /></button>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>{busy ? '请求完成前仍可切换，下一轮使用新模型。' : '任务与代码使用同一段对话。'}</span>
        <span>Enter 发送 · Shift+Enter 换行</span>
      </div>
    </form>
  </aside>;
}
