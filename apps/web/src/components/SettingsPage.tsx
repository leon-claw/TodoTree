import { FormEvent, useRef, useState } from 'react';
import { AlertCircle, Check, Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { createDefaultTag, validateAppData } from '../storage';
import { AppData, Tag } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface SettingsPageProps {
  appData: AppData;
  onUpdateTags: (tags: Tag[]) => void;
  onImportAppData: (data: AppData) => void;
}

const PRESET_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#475569', '#ea580c'];

function countTodos(todos: AppData['todos']): number {
  return todos.reduce((count, todo) => count + 1 + countTodos(todo.children), 0);
}

export function SettingsPage({ appData, onUpdateTags, onImportAppData }: SettingsPageProps) {
  const { tags } = appData;
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editedTagTitle, setEditedTagTitle] = useState('');
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPendingData, setImportPendingData] = useState<AppData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const updateTag = (id: string, updates: Partial<Tag>) => {
    onUpdateTags(tags.map((tag) => tag.id === id ? { ...tag, ...updates } : tag));
  };
  const addTag = (event: FormEvent) => {
    event.preventDefault();
    const title = newTagName.trim();
    if (!title) return;
    onUpdateTags([...tags, createDefaultTag(title, newTagColor)]);
    setNewTagName('');
  };
  const startTagEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditedTagTitle(tag.title);
  };
  const cancelTagEdit = () => {
    setEditingTagId(null);
    setEditedTagTitle('');
  };
  const saveTagEdit = (tag: Tag) => {
    const title = editedTagTitle.trim();
    if (!title) return;
    updateTag(tag.id, { title });
    cancelTagEdit();
  };
  const confirmDeleteTag = () => {
    if (!tagToDelete) return;
    onUpdateTags(tags.filter((tag) => tag.id !== tagToDelete.id));
    setTagToDelete(null);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tree-todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccessMsg(null);
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') throw new Error('文件内容无法读取为文本');
        const validation = validateAppData(JSON.parse(reader.result));
        if (!validation.valid) {
          setImportError(`数据校验未通过：${validation.error}`);
          return;
        }
        setImportPendingData(validation.data);
      } catch (error) {
        setImportError(`文件解析失败：${error instanceof Error ? error.message : '非标准 JSON 格式'}`);
      }
    };
    reader.onerror = () => setImportError('文件读取失败，请检查文件后重试。');
    reader.onabort = () => setImportError('文件读取已取消，当前数据未更改。');
    try {
      reader.readAsText(file);
    } catch (error) {
      setImportError(`文件读取失败：${error instanceof Error ? error.message : '请检查文件后重试。'}`);
    }
  };
  const confirmImport = () => {
    if (!importPendingData) return;
    onImportAppData(importPendingData);
    setImportPendingData(null);
    setImportSuccessMsg('数据导入成功，已整体替换现有数据。');
  };

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 overflow-y-auto p-4 sm:p-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">设置</h2>
        <p className="mt-1 text-xs text-slate-500">管理系统标签及本地数据导入导出</p>
      </div>

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <h3 className="text-base font-semibold text-slate-900">标签管理</h3>
          <p className="mt-0.5 text-xs text-slate-500">在此创建和修改待办任务中使用的标签分类与色彩</p>
        </div>
        <div className="space-y-2.5">
          {tags.length === 0 ? <p className="text-xs text-slate-400">当前没有标签</p> : tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:gap-3">
              <input type="color" value={tag.color} onChange={(event) => updateTag(tag.id, { color: event.target.value })} aria-label={`更改「${tag.title}」标签颜色`} className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
              {editingTagId === tag.id ? (
                <input
                  autoFocus
                  type="text"
                  value={editedTagTitle}
                  onChange={(event) => setEditedTagTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); saveTagEdit(tag); }
                    if (event.key === 'Escape') cancelTagEdit();
                  }}
                  aria-label={`编辑「${tag.title}」标签名称`}
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : <span className="min-w-0 flex-1 truncate px-2.5 py-1 text-xs text-slate-900">{tag.title}</span>}
              {editingTagId === tag.id ? (
                <>
                  <button type="button" onClick={() => saveTagEdit(tag)} disabled={!editedTagTitle.trim()} aria-label="保存标签名称" className="rounded p-1.5 text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40"><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={cancelTagEdit} aria-label="取消编辑标签名称" className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-200"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <button type="button" onClick={() => startTagEdit(tag)} aria-label={`编辑「${tag.title}」标签名称`} className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
              )}
              <button type="button" onClick={() => setTagToDelete(tag)} aria-label={`删除「${tag.title}」标签`} className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <form onSubmit={addTag} className="flex flex-col items-stretch gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-xs font-medium text-slate-600">新增标签颜色:</span>
            <div className="flex items-center gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button key={color} type="button" onClick={() => setNewTagColor(color)} aria-label={`选择标签颜色 ${color}`} aria-pressed={newTagColor === color} className={`h-5 w-5 rounded-full transition-transform ${newTagColor === color ? 'scale-125 ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110'}`} style={{ backgroundColor: color }} />
              ))}
              <input type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} aria-label="选择自定义标签颜色" className="ml-1 h-5 w-5 cursor-pointer rounded border-0 p-0" />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input type="text" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} aria-label="新标签名称" placeholder="标签名称..." className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button type="submit" disabled={!newTagName.trim()} className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />添加</button>
          </div>
        </form>
      </section>

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <h3 className="text-base font-semibold text-slate-900">数据备份与恢复</h3>
          <p className="mt-0.5 text-xs text-slate-500">数据保存在本地浏览器中，可通过导出/导入 JSON 文件进行迁移和备份</p>
        </div>
        {importError && <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />{importError}</div>}
        {importSuccessMsg && <div role="status" className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{importSuccessMsg}</div>}
        <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div><h4 className="text-sm font-semibold text-slate-800">导出数据 (JSON)</h4><p className="mt-1 text-xs text-slate-500">下载包含全部待办树（共 {countTodos(appData.todos)} 项）和 {tags.length} 个标签的 JSON 备份文件。</p></div>
            <button type="button" onClick={exportData} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-100"><Download className="h-4 w-4 text-slate-500" />导出并下载 JSON</button>
          </div>
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div><h4 className="text-sm font-semibold text-slate-800">导入数据 (JSON)</h4><p className="mt-1 text-xs text-slate-500">选择已导出的 JSON 备份文件。系统将严格校验格式，确认后整体替换当前数据。</p></div>
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700"><Upload className="h-4 w-4" />选择并导入 JSON 文件</button>
          </div>
        </div>
      </section>

      <ConfirmModal
        isOpen={!!tagToDelete}
        title="确认删除此标签？"
        message={`删除标签「${tagToDelete?.title}」后，该标签将从标签列表中移除。`}
        confirmLabel="确认删除"
        cancelLabel="取消"
        isDanger
        onConfirm={confirmDeleteTag}
        onCancel={() => setTagToDelete(null)}
      />
      <ConfirmModal
        isOpen={!!importPendingData}
        title="确认整体替换当前数据？"
        message={`导入文件校验通过！包含 ${countTodos(importPendingData?.todos ?? [])} 项待办及 ${importPendingData?.tags.length ?? 0} 个标签。\n\n警告：确认导入将彻底覆盖并替换当前浏览器中的所有现有数据，此操作无法撤销。是否继续？`}
        confirmLabel="确认整体替换"
        cancelLabel="取消导入"
        isDanger
        onConfirm={confirmImport}
        onCancel={() => setImportPendingData(null)}
      />
    </div>
  );
}
