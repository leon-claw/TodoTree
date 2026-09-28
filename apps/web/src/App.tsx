import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GraphView } from './components/GraphView';
import { indexFlowTodos } from './flowNavigation';
import type { FlowLocationRequest } from './flowNavigation';
import { ListView } from './components/ListView';
import { Navbar } from './components/Navbar';
import { ConfirmModal } from './components/ConfirmModal';
import { SettingsPage } from './components/SettingsPage';
import { SettingsPanel } from './components/SettingsPanel';
import { TagManagementPage } from './components/TagManagementPage';
import { TaskComposer } from './components/TaskComposer';
import {
  addTodosToTree,
  collectLeafTodos,
  countTodoDescendants,
  deleteTodoFromTree,
  findTodoById,
  isLeaf,
  loadAppData,
  moveTodoUnderParent,
  saveAppData,
  toggleLeafCompletion,
  updateTodoInTree,
} from './storage';
import { ActiveTab, AppData, AppRoute, ComposerAnchor, Tag, Todo } from './types';
import { baseRouteFor, detailRouteFor, parseAppRoute, routeForTab, tabForRoute, todoIdForRoute } from './routes';

interface AppHistoryState extends Record<string, unknown> {
  treeTodoRoute?: AppRoute;
  treeTodoParentRoute?: AppRoute | null;
  treeTodoCanReturn?: boolean;
}

function appHistoryState(route: AppRoute, parentRoute: AppRoute | null = null, canReturn = false): AppHistoryState {
  const current = window.history.state;
  const preserved = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  return {
    ...preserved,
    treeTodoRoute: route,
    treeTodoParentRoute: parentRoute,
    treeTodoCanReturn: canReturn,
  };
}

export default function App() {
  const [loadedData] = useState(() => loadAppData());
  const [appData, setAppData] = useState<AppData>(loadedData.data);
  const [storageError, setStorageError] = useState<string | null>(loadedData.error);
  const latestAppData = useRef(loadedData.data);
  const lastSavedData = useRef(loadedData.data);
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(window.location.pathname) ?? '/graph');
  const routeRef = useRef(route);
  routeRef.current = route;
  const activeTab = tabForRoute(route);
  const selectedTodoId = todoIdForRoute(route);
  const [hasVisitedGraph, setHasVisitedGraph] = useState(false);
  const [hasVisitedList, setHasVisitedList] = useState(false);
  const [composerTarget, setComposerTarget] = useState<{ parentId: string | null; label: string; anchor?: ComposerAnchor } | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [locationRequest, setLocationRequest] = useState<FlowLocationRequest | null>(null);
  const [treeRevision, setTreeRevision] = useState(0);
  const locationSequence = useRef(0);

  latestAppData.current = appData;

  useEffect(() => {
    if (lastSavedData.current === appData) return;
    const timeoutId = window.setTimeout(() => {
      const error = saveAppData(appData);
      if (!error) lastSavedData.current = appData;
      setStorageError(error);
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [appData]);

  useEffect(() => {
    const currentRoute = parseAppRoute(window.location.pathname) ?? '/graph';
    const currentState = window.history.state as AppHistoryState | null;
    const hasCurrentRouteState = currentState?.treeTodoRoute === currentRoute;
    const routeToKeep = hasCurrentRouteState ? currentState?.treeTodoParentRoute ?? null : null;
    const canReturn = hasCurrentRouteState && currentState?.treeTodoCanReturn === true;
    if (window.location.pathname !== currentRoute || !hasCurrentRouteState) {
      window.history.replaceState(appHistoryState(currentRoute, routeToKeep, canReturn), '', currentRoute);
    }
    setRoute(currentRoute);

    const handlePopState = () => {
      const nextRoute = parseAppRoute(window.location.pathname) ?? '/graph';
      if (window.location.pathname !== nextRoute) {
        window.history.replaceState(appHistoryState(nextRoute), '', nextRoute);
      }
      setRoute(nextRoute);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const flushPendingSave = () => {
      const data = latestAppData.current;
      if (data === lastSavedData.current) return;
      const error = saveAppData(data);
      if (!error) lastSavedData.current = data;
      setStorageError(error);
    };
    window.addEventListener('pagehide', flushPendingSave);
    return () => window.removeEventListener('pagehide', flushPendingSave);
  }, []);

  useEffect(() => {
    if (activeTab === 'graph') setHasVisitedGraph(true);
    if (activeTab === 'list') setHasVisitedList(true);
  }, [activeTab]);

  const handleTabChange = (tab: ActiveTab) => {
    const nextRoute = routeForTab(tab);
    window.history.replaceState(appHistoryState(nextRoute), '', nextRoute);
    setRoute(nextRoute);
  };

  const handleOpenTagManagement = () => {
    const nextRoute: AppRoute = '/settings/tags';
    if (routeRef.current !== nextRoute) {
      window.history.pushState(appHistoryState(nextRoute, '/settings', true), '', nextRoute);
      setRoute(nextRoute);
    }
  };

  const handleRouteBack = () => {
    const state = window.history.state as AppHistoryState | null;
    if (state?.treeTodoRoute === routeRef.current && state.treeTodoParentRoute === '/settings' && state.treeTodoCanReturn) {
      window.history.back();
      return;
    }
    window.history.replaceState(appHistoryState('/settings'), '', '/settings');
    setRoute('/settings');
  };

  const handleSelectTodo = (id: string | null) => {
    setLocationRequest(null);
    const currentRoute = routeRef.current;
    const currentTodoId = todoIdForRoute(currentRoute);
    if (id === null) {
      if (currentTodoId === null) return;
      const parentRoute = baseRouteFor(currentRoute);
      const state = window.history.state as AppHistoryState | null;
      if (state?.treeTodoRoute === currentRoute && state.treeTodoParentRoute && state.treeTodoCanReturn) {
        window.history.back();
        setRoute(state.treeTodoParentRoute);
      } else {
        window.history.replaceState(appHistoryState(parentRoute), '', parentRoute);
        setRoute(parentRoute);
      }
      return;
    }
    if (activeTab !== 'graph' && activeTab !== 'list') return;
    const nextRoute = detailRouteFor(activeTab, id);
    if (currentRoute === nextRoute) return;
    const parentRoute = routeForTab(activeTab);
    const currentlyOnDetail = currentTodoId !== null;
    if (currentlyOnDetail) {
      const state = window.history.state as AppHistoryState | null;
      const isCurrentState = state?.treeTodoRoute === currentRoute;
      const returnRoute = isCurrentState && state.treeTodoParentRoute
        ? state.treeTodoParentRoute
        : parentRoute;
      const canReturn = isCurrentState && state.treeTodoCanReturn === true;
      window.history.replaceState(appHistoryState(nextRoute, returnRoute, canReturn), '', nextRoute);
    } else {
      window.history.pushState(appHistoryState(nextRoute, parentRoute, true), '', nextRoute);
    }
    setRoute(nextRoute);
  };

  const handleLocateTodo = useCallback((id: string) => {
    if (!findTodoById(latestAppData.current.todos, id)) return;
    const currentRoute = routeRef.current;
    const currentTab = tabForRoute(currentRoute);
    if (currentTab === 'graph') {
      handleSelectTodo(id);
    } else {
      const returnRoute: AppRoute = currentTab === 'list' ? currentRoute : '/settings';
      const nextRoute = detailRouteFor('graph', id);
      window.history.pushState(appHistoryState(nextRoute, returnRoute, true), '', nextRoute);
      setRoute(nextRoute);
    }
    setLocationRequest({ id, sequence: ++locationSequence.current });
  }, [handleSelectTodo]);

  const handleLocationHandled = useCallback((sequence: number) => {
    setLocationRequest((current) => current?.sequence === sequence ? null : current);
  }, []);

  const handleLocationMissing = useCallback((id: string) => {
    setLocationRequest((current) => current?.id === id ? null : current);
    const currentRoute = routeRef.current;
    if (todoIdForRoute(currentRoute) !== id) return;
    const parentRoute = baseRouteFor(currentRoute);
    window.history.replaceState(appHistoryState(parentRoute), '', parentRoute);
    setRoute(parentRoute);
  }, []);

  const flowEntries = useMemo(() => indexFlowTodos(appData.todos), [appData.todos]);
  const selectedTodoPath = useMemo(
    () => flowEntries.find((entry) => entry.id === selectedTodoId)?.path ?? [],
    [flowEntries, selectedTodoId],
  );
  const selectedTodo = useMemo(
    () => selectedTodoId ? findTodoById(appData.todos, selectedTodoId) : null,
    [appData.todos, selectedTodoId],
  );
  useEffect(() => {
    if (!selectedTodoId || selectedTodo) return;
    const parentRoute = baseRouteFor(route);
    window.history.replaceState(appHistoryState(parentRoute), '', parentRoute);
    setRoute(parentRoute);
  }, [route, selectedTodo, selectedTodoId]);
  const leafItems = useMemo(() => collectLeafTodos(appData.todos), [appData.todos]);
  const sortedLeafItems = useMemo(() => leafItems
    .map((item, index) => ({ ...item, index, score: item.todo.importance + item.todo.urgency }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ todo, path }) => ({ todo, path })), [leafItems]);
  const deleteTarget = useMemo(
    () => deleteTargetId ? findTodoById(appData.todos, deleteTargetId) : null,
    [appData.todos, deleteTargetId],
  );

  const handleToggleComplete = (id: string) => {
    setAppData((prev) => ({ ...prev, todos: toggleLeafCompletion(prev.todos, id) }));
  };

  const handleUpdateTodo = (updated: Todo) => {
    setAppData((prev) => ({
      ...prev,
      todos: updateTodoInTree(prev.todos, updated.id, () => updated),
    }));
  };

  const handleMoveTodo = (todoId: string, parentId: string) => {
    const acceptedPreview = moveTodoUnderParent(appData.todos, todoId, parentId) !== null;
    console.info('[TodoTree drag] app move requested', JSON.stringify({ todoId, parentId, acceptedPreview }));
    setAppData((prev) => {
      const todos = moveTodoUnderParent(prev.todos, todoId, parentId);
      return todos ? { ...prev, todos } : prev;
    });
  };

  const handleAddRootTodo = useCallback(() => {
    setComposerError(null);
    setComposerTarget({ parentId: null, label: '根任务列表' });
  }, []);

  const handleAddChildTodo = (parentId: string) => {
    const parent = findTodoById(appData.todos, parentId);
    setComposerError(null);
    setComposerTarget({ parentId, label: parent?.title || '所选父任务' });
  };

  const handleRequestAdd = useCallback((parentId: string | null, targetLabel: string, anchor?: ComposerAnchor) => {
    setComposerError(null);
    setComposerTarget({ parentId, label: targetLabel, anchor });
  }, []);

  const handleSubmitTasks = (titles: string[]) => {
    if (!composerTarget) return false;
    const todos = addTodosToTree(appData.todos, composerTarget.parentId, titles);
    if (!todos) {
      const parent = composerTarget.parentId ? findTodoById(appData.todos, composerTarget.parentId) : null;
      setComposerError(parent && isLeaf(parent) && parent.completed
        ? '已完成的叶子任务不可添加子任务，请先取消完成。'
        : '添加目标已不可用，请关闭后重新选择位置。');
      return false;
    }
    setAppData({ ...appData, todos });
    setComposerError(null);
    return true;
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget || !deleteTargetId) return;
    const selectedIsBeingDeleted = selectedTodoId !== null && findTodoById([deleteTarget], selectedTodoId) !== null;
    setAppData({ ...appData, todos: deleteTodoFromTree(appData.todos, deleteTargetId) });
    if (selectedIsBeingDeleted) handleSelectTodo(null);
    setDeleteTargetId(null);
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
    setTreeRevision((revision) => revision + 1);
  };

  const detailReturnRoute = (window.history.state as AppHistoryState | null)?.treeTodoParentRoute;
  const backLabel = route === '/settings/tags'
    ? '返回设置'
    : detailReturnRoute?.startsWith('/list')
      ? '返回列表'
      : activeTab === 'graph' ? '返回图表' : '返回列表';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        showBack={route === '/settings/tags' || selectedTodoId !== null}
        backLabel={backLabel}
        onBack={route === '/settings/tags' ? handleRouteBack : () => handleSelectTodo(null)}
      />
      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {storageError && (
          <div role="alert" className="absolute left-3 right-3 top-3 z-40 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm md:left-auto md:right-4 md:max-w-lg">
            {storageError}
          </div>
        )}
        <div className={`flex h-full min-h-0 min-w-0 flex-1 ${activeTab === 'list' ? '' : 'hidden'}`}>
          {(activeTab === 'list' || hasVisitedList) && (
            <ListView
              leafItems={sortedLeafItems}
              tags={appData.tags}
              onToggleComplete={handleToggleComplete}
              onSelectTodo={handleSelectTodo}
              onLocateTodo={handleLocateTodo}
              onBlankClick={() => handleSelectTodo(null)}
              onAddRootTodo={handleAddRootTodo}
            />
          )}
        </div>
        <div className={`h-full min-h-0 min-w-0 flex-1 ${activeTab === 'graph' ? '' : 'hidden'}`}>
          {(activeTab === 'graph' || hasVisitedGraph) && (
            <GraphView
              todos={appData.todos}
              tags={appData.tags}
              selectedId={selectedTodoId}
              onSelectTodo={handleSelectTodo}
              onAddRootTodo={handleAddRootTodo}
              onMoveTodo={handleMoveTodo}
              onRequestAdd={handleRequestAdd}
              onRequestDelete={setDeleteTargetId}
              active={activeTab === 'graph'}
              locationRequest={locationRequest}
              onLocateTodo={handleLocateTodo}
              onLocationHandled={handleLocationHandled}
              onLocationMissing={handleLocationMissing}
              treeRevision={treeRevision}
            />
          )}
        </div>
        {route === '/settings' && (
          <SettingsPage appData={appData} onImportAppData={handleImportAppData} onOpenTagManagement={handleOpenTagManagement} />
        )}
        {route === '/settings/tags' && (
          <TagManagementPage tags={appData.tags} onUpdateTags={handleUpdateTags} />
        )}
        {activeTab !== 'settings' && selectedTodo && (
          <SettingsPanel
            todo={selectedTodo}
            path={selectedTodoPath}
            tags={appData.tags}
            onClose={() => handleSelectTodo(null)}
            onUpdate={handleUpdateTodo}
            onAddChild={handleAddChildTodo}
            onLocateTodo={handleLocateTodo}
            onRequestDelete={setDeleteTargetId}
            overlay={activeTab === 'list'}
          />
        )}
        {composerTarget && (
          <TaskComposer
            targetLabel={composerTarget.label}
            anchor={composerTarget.anchor}
            error={composerError}
            onSubmit={handleSubmitTasks}
            onCancel={() => {
              setComposerTarget(null);
              setComposerError(null);
            }}
          />
        )}
        <ConfirmModal
          isOpen={deleteTarget !== null}
          title={deleteTarget ? `删除「${deleteTarget.title || '未命名待办'}」？` : '删除任务？'}
          message={deleteTarget
            ? `将一并删除它的 ${countTodoDescendants(deleteTarget)} 个后代任务，共 ${countTodoDescendants(deleteTarget) + 1} 项。`
            : ''}
          confirmLabel="确认删除"
          cancelLabel="取消"
          isDanger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      </main>
    </div>
  );
}
