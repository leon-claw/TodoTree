import { useRef, useState } from 'react';
import { AlertCircle, Check, ChevronRight, Download, Tags, Upload } from 'lucide-react';
import { validateAppData } from '../storage';
import { AppData } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface SettingsPageProps {
  appData: AppData;
  onImportAppData: (data: AppData) => boolean;
  onOpenTagManagement: () => void;
}

function countTodos(todos: AppData['todos']): number {
  return todos.reduce((count, todo) => count + 1 + countTodos(todo.children), 0);
}

export function SettingsPage({ appData, onImportAppData, onOpenTagManagement }: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPendingData, setImportPendingData] = useState<AppData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `todotree-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
    if (onImportAppData(importPendingData)) {
      setImportPendingData(null);
      setImportSuccessMsg('数据导入成功，已整体替换现有数据。');
    } else {
      setImportError('数据保存失败，导入未应用。');
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 overflow-y-auto p-4 sm:p-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">设置</h2>
        <p className="mt-1 text-xs text-slate-500">管理系统标签及本地数据导入导出；修改会自动保存到本地</p>
      </div>

      <section className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">标签管理</h3>
          <p className="mt-0.5 text-xs text-slate-500">创建、修改待办使用的标签分类与颜色 · 当前 {appData.tags.length} 个</p>
        </div>
        <button type="button" onClick={onOpenTagManagement} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:text-sm">
          <Tags className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span>管理标签</span>
          <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </button>
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
            <div><h4 className="text-sm font-semibold text-slate-800">导出数据 (JSON)</h4><p className="mt-1 text-xs text-slate-500">下载包含全部待办树（共 {countTodos(appData.todos)} 项）和 {appData.tags.length} 个标签的 JSON 备份文件。</p></div>
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
