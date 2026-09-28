import { useEffect, useMemo, useRef, useState } from 'react';
import { GraphView } from './components/GraphView';
import { ListView } from './components/ListView';
import { Navbar } from './components/Navbar';
import { SettingsPage } from './components/SettingsPage';
import { SettingsPanel } from './components/SettingsPanel';
import {
  addChildTodoToTree,
  addRootTodoToTree,
  collectLeafTodos,
  deleteTodoFromTree,
  findTodoById,
  loadAppData,
  saveAppData,
  toggleLeafCompletion,
  updateTodoInTree,
} from './storage';
import { ActiveTab, AppData, Tag, Todo } from './types';

export default function App() {
  const [loadedData] = useState(() => loadAppData());
  const [appData, setAppData] = useState<AppData>(loadedData.data);
  const [storageError, setStorageError] = useState<string | null>(loadedData.error);
  const previousAppData = useRef(loadedData.data);
  const [activeTab, setActiveTab] = useState<ActiveTab>('list');
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  useEffect(() => {
    if (previousAppData.current === appData) return;
    previousAppData.current = appData;
    setStorageError(saveAppData(appData));
  }, [appData]);

  const selectedTodo = useMemo(
    () => selectedTodoId ? findTodoById(appData.todos, selectedTodoId) : null,
    [appData.todos, selectedTodoId],
  );
  const leafItems = useMemo(() => collectLeafTodos(appData.todos), [appData.todos]);

  const handleToggleComplete = (id: string) => {
    setAppData((prev) => ({ ...prev, todos: toggleLeafCompletion(prev.todos, id) }));
  };

  const handleUpdateTodo = (updated: Todo) => {
    setAppData((prev) => ({
      ...prev,
      todos: updateTodoInTree(prev.todos, updated.id, () => updated),
    }));
  };

  const handleAddRootTodo = () => {
    const { todos, newTodo } = addRootTodoToTree(appData.todos);
    setAppData((prev) => ({ ...prev, todos }));
    setSelectedTodoId(newTodo.id);
  };

  const handleAddChildTodo = (parentId: string) => {
    const result = addChildTodoToTree(appData.todos, parentId);
    if (!result) return;
    setAppData((prev) => ({ ...prev, todos: result.todos }));
    setSelectedTodoId(result.newTodo.id);
  };

  const handleDeleteTodo = (id: string) => {
    setAppData((prev) => ({ ...prev, todos: deleteTodoFromTree(prev.todos, id) }));
    if (selectedTodoId === id) setSelectedTodoId(null);
  };

  const handleUpdateTags = (newTags: Tag[]) => {
    setAppData((prev) => {
      const validTagIds = new Set(newTags.map((tag) => tag.id));
      const removeDeletedTags = (todos: Todo[]): Todo[] => todos.map((todo) => ({
        ...todo,
        tagIds: todo.tagIds.filter((id) => validTagIds.has(id)),
        children: removeDeletedTags(todo.children),
      }));
      return { ...prev, tags: newTags, todos: removeDeletedTags(prev.todos) };
    });
  };

  const handleImportAppData = (imported: AppData) => {
    setAppData(imported);
    setSelectedTodoId(null);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="relative flex flex-1 overflow-hidden">
        {storageError && (
          <div role="alert" className="absolute left-3 right-3 top-3 z-40 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm md:left-auto md:right-4 md:max-w-lg">
            {storageError}
          </div>
        )}
        {activeTab === 'list' && (
          <ListView
            leafItems={leafItems}
            tags={appData.tags}
            onToggleComplete={handleToggleComplete}
            onSelectTodo={setSelectedTodoId}
            onAddRootTodo={handleAddRootTodo}
          />
        )}
        {activeTab === 'graph' && (
          <GraphView
            todos={appData.todos}
            tags={appData.tags}
            selectedId={selectedTodoId}
            onSelectTodo={setSelectedTodoId}
            onAddRootTodo={handleAddRootTodo}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPage appData={appData} onUpdateTags={handleUpdateTags} onImportAppData={handleImportAppData} />
        )}
        {activeTab !== 'settings' && selectedTodo && (
          <SettingsPanel
            todo={selectedTodo}
            tags={appData.tags}
            onClose={() => setSelectedTodoId(null)}
            onUpdate={handleUpdateTodo}
            onAddChild={handleAddChildTodo}
            onDelete={handleDeleteTodo}
          />
        )}
      </main>
    </div>
  );
}
