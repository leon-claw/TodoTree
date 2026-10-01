import { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Circle, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { createProfileApi } from '../agent/profileApi';
import type { AgentProfileSummary, AgentProfilesSnapshot, ConnectionTestResult, SaveAgentProfileInput } from '../agent/profileApi';
import { ConfirmModal } from './ConfirmModal';

interface ProfileDraft {
  profileId?: string;
  name: string;
  apiBaseUrl: string;
  modelId: string;
  apiKey: string;
  clearApiKey: boolean;
}

const profileApi = createProfileApi();
const emptyDraft = (): ProfileDraft => ({ name: '', apiBaseUrl: '', modelId: '', apiKey: '', clearApiKey: false });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试。';
}

export function AgentProfilesSection() {
  const [snapshot, setSnapshot] = useState<AgentProfilesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentProfileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await profileApi.getProfiles());
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const setDraftField = (field: keyof ProfileDraft, value: string | boolean) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setTestResult(null);
    setError(null);
    setNotice(null);
  };

  const beginEdit = (profile: AgentProfileSummary) => {
    if (profile.legacy) return;
    setDraft({
      profileId: profile.id,
      name: profile.name,
      apiBaseUrl: profile.apiBaseUrl,
      modelId: profile.modelId,
      apiKey: '',
      clearApiKey: false,
    });
    setTestResult(null);
    setError(null);
    setNotice(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const input: SaveAgentProfileInput = {
      name: draft.name,
      apiBaseUrl: draft.apiBaseUrl,
      modelId: draft.modelId,
      ...(draft.apiKey.trim() ? { apiKey: draft.apiKey } : {}),
      ...(draft.clearApiKey ? { clearApiKey: true } : {}),
      ...(draft.profileId ? { profileId: draft.profileId } : {}),
    };
    try {
      setSnapshot(await profileApi.saveProfile(input));
      setDraft(null);
      setTestResult(null);
      setNotice('配置已保存。');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!draft) return;
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      setTestResult(await profileApi.testProfile({
        name: draft.name,
        apiBaseUrl: draft.apiBaseUrl,
        modelId: draft.modelId,
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey } : {}),
        ...(draft.profileId ? { profileId: draft.profileId } : {}),
      }));
    } catch (testError) {
      setTestResult({ ok: false, message: errorMessage(testError) });
    } finally {
      setTesting(false);
    }
  };

  const handleActivate = async (profileId: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await profileApi.activateProfile(profileId);
      setSnapshot(next);
      setNotice('已切换当前模型。');
    } catch (activateError) {
      setError(errorMessage(activateError));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setSnapshot(await profileApi.deleteProfile(deleteTarget.id));
      setNotice('配置已删除。');
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  };

  const editingProfile = draft?.profileId
    ? snapshot?.profiles.find((profile) => profile.id === draft.profileId)
    : undefined;
  const canTest = Boolean(
    draft?.name.trim() &&
    draft.apiBaseUrl.trim() &&
    draft.modelId.trim() &&
    (draft.apiKey.trim() || (editingProfile?.hasApiKey && !draft.clearApiKey)),
  );

  return (
    <>
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Agent 模型</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              管理 Agent 使用的模型配置。Agent 对话和工具返回内容会发送到所选 API 地址；请确认你信任该服务。Key 由本机后端保存并用于身份验证。
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setDraft(emptyDraft()); setTestResult(null); setError(null); setNotice(null); }}
            disabled={busy || loading || draft !== null}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />新增配置
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
          </div>
        )}
        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{notice}
          </div>
        )}
        {snapshot?.unavailableReason && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{snapshot.unavailableReason}</p>
        )}

        {loading ? (
          <p role="status" className="text-sm text-slate-500">正在读取模型配置…</p>
        ) : snapshot?.profiles.length ? (
          <div className="space-y-3">
            {snapshot.profiles.map((profile) => {
              const active = snapshot.activeProfileId === profile.id;
              return (
                <article
                  key={profile.id}
                  className={'rounded-lg border bg-white p-4 ' + (active ? 'border-blue-200 border-l-4 border-l-blue-500' : 'border-slate-200')}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-semibold text-slate-900">{profile.name}</h4>
                        {active && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"><Check className="h-3 w-3" />当前使用</span>}
                        {profile.legacy && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">环境变量配置</span>}
                      </div>
                      <p className="break-all font-mono text-xs text-slate-600">{profile.modelId}</p>
                      <p className="break-all text-xs text-slate-500">{profile.apiBaseUrl}</p>
                      <p className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                        {profile.hasApiKey ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-amber-600" />}
                        {profile.hasApiKey ? 'Key 已保存' : '尚未保存 Key'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {!active && !profile.legacy && (
                        <button type="button" onClick={() => void handleActivate(profile.id)} disabled={busy || draft !== null} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">设为当前</button>
                      )}
                      {!profile.legacy && (
                        <>
                          <button type="button" onClick={() => beginEdit(profile)} disabled={busy || draft !== null} aria-label={'编辑 ' + profile.name} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pencil className="h-3.5 w-3.5" />编辑</button>
                          <button type="button" onClick={() => setDeleteTarget(profile)} disabled={busy || draft !== null || (active && snapshot.profiles.length > 1)} aria-label={'删除 ' + profile.name} title={active && snapshot.profiles.length > 1 ? '先切换到另一个配置' : undefined} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />删除</button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-700">还没有 Agent 模型配置</p>
            <p className="mt-1 text-xs text-slate-500">添加 API 地址、模型 ID 和 Key 后即可开始对话。</p>
          </div>
        )}

        {!loading && (
          <button type="button" onClick={() => void refresh()} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />重新读取配置
          </button>
        )}

        {draft && (
          <form onSubmit={(event) => void handleSave(event)} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{draft.profileId ? '编辑模型配置' : '新增模型配置'}</h4>
                <p className="mt-0.5 text-[11px] text-slate-500">连接测试会使用当前表单内容，不会保存配置。</p>
              </div>
              <button type="button" onClick={() => { setDraft(null); setTestResult(null); setError(null); }} aria-label="关闭模型配置表单" className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                <span>配置名称</span>
                <input required maxLength={80} value={draft.name} onChange={(event) => setDraftField('name', event.target.value)} placeholder="例如：个人模型" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                <span>模型 ID</span>
                <input required maxLength={256} value={draft.modelId} onChange={(event) => setDraftField('modelId', event.target.value)} placeholder="例如：gpt-4o" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
                <span>API 地址</span>
                <input required maxLength={2048} value={draft.apiBaseUrl} onChange={(event) => setDraftField('apiBaseUrl', event.target.value)} placeholder="填写服务提供方给出的 API 基址" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                <span className="block font-normal text-[11px] leading-4 text-slate-500">不检查地址格式；可用“测试连接”确认服务是否可调用。</span>
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
                <span>API Key</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required={!draft.profileId}
                  value={draft.apiKey}
                  onChange={(event) => setDraft((current) => current ? { ...current, apiKey: event.target.value, clearApiKey: false } : current)}
                  placeholder={draft.profileId ? (editingProfile?.hasApiKey ? '留空以保留已保存的 Key' : '请填写 API Key') : '填写 API Key'}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {draft.profileId && editingProfile?.hasApiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      if (draft.clearApiKey) setDraftField('clearApiKey', false);
                      else setDraft((current) => current ? { ...current, clearApiKey: true, apiKey: '' } : current);
                    }}
                    className="text-[11px] font-medium text-blue-700 hover:text-blue-900"
                  >
                    {draft.clearApiKey ? '取消清除，保留已保存的 Key' : '清除已保存的 Key'}
                  </button>
                )}
                {!draft.profileId && <span className="block font-normal text-[11px] text-slate-500">Key 只发送给本机后端保存，不写入浏览器存储。</span>}
              </label>
            </div>
            {draft.clearApiKey && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">保存时会移除已保存的 Key。</p>}
            {testResult && (
              <p role={testResult.ok ? 'status' : 'alert'} className={'flex items-start gap-2 rounded-lg border p-3 text-xs ' + (testResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700')}>
                {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{testResult.ok ? testResult.message : '连接失败：' + testResult.message}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={handleTest} disabled={busy || testing || !canTest} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                {testing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {testing ? '正在测试…' : '测试连接'}
              </button>
              <button type="button" onClick={() => { setDraft(null); setTestResult(null); setError(null); }} disabled={busy || testing} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50">取消</button>
              <button type="submit" disabled={busy || testing} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {busy ? '正在保存…' : '保存配置'}
              </button>
            </div>
          </form>
        )}
      </section>

      <p className="px-1 text-[11px] leading-4 text-slate-400">
        测试连接会实际请求模型，可能产生费用；它只发送一条固定的简短消息，不会发送任务数据或项目内容。实际对话时，Agent 会将对话和工具返回内容发送给当前配置的 API。
      </p>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={deleteTarget ? '删除「' + deleteTarget.name + '」配置？' : '删除模型配置？'}
        message="删除后，该配置的 API Key 也会从本机后端配置中移除。"
        confirmLabel={busy ? '正在删除…' : '删除配置'}
        cancelLabel="取消"
        isDanger
        onConfirm={() => { void handleDelete(); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
