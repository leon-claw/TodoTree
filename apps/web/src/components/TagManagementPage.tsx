import { FormEvent, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { createDefaultTag } from '../storage';
import { Tag } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface TagManagementPageProps {
  tags: Tag[];
  onUpdateTags: (tags: Tag[]) => void;
}

const PRESET_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#475569', '#ea580c'];

export function TagManagementPage({ tags, onUpdateTags }: TagManagementPageProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editedTagTitle, setEditedTagTitle] = useState('');
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

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
  const finishTagEdit = (tag: Tag) => {
    const title = editedTagTitle.trim();
    if (title) {
      if (title !== tag.title) updateTag(tag.id, { title });
      setEditedTagTitle(title);
    } else {
      setEditedTagTitle(tag.title);
    }
    setEditingTagId(null);
  };
  const confirmDeleteTag = () => {
    if (!tagToDelete) return;
    onUpdateTags(tags.filter((tag) => tag.id !== tagToDelete.id));
    setTagToDelete(null);
  };

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 overflow-y-auto p-4 sm:p-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">标签管理</h2>
        <p className="mt-1 text-xs text-slate-500">标签名称与颜色修改会自动保存到本地</p>
      </div>

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <h3 className="text-base font-semibold text-slate-900">待办标签</h3>
          <p className="mt-0.5 text-xs text-slate-500">创建和修改待办任务中使用的标签分类与颜色</p>
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
                  onChange={(event) => {
                    const title = event.target.value;
                    setEditedTagTitle(title);
                    if (title.trim()) updateTag(tag.id, { title });
                  }}
                  onBlur={() => finishTagEdit(tag)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); finishTagEdit(tag); }
                  }}
                  aria-label={`编辑「${tag.title}」标签名称`}
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : <span className="min-w-0 flex-1 truncate px-2.5 py-1 text-xs text-slate-900">{tag.title}</span>}
              {editingTagId !== tag.id && (
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
    </div>
  );
}
