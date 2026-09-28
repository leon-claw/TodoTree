# Graph Report - TodoTree-flow-navigation-zoom  (2026-09-29)

## Corpus Check
- 37 files · ~16,665 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 286 nodes · 491 edges · 19 communities (17 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cd6b9c5d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- web/package.json
- TodoTree 产品体验与整改建议
- GraphView.tsx
- compilerOptions
- devDependencies
- package.json
- Recursive JSON Todo Tree
- Tree Todo Application
- New Project Bootstrap Workflow
- Web Application at apps/web
- vite.config.ts
- Web Application HTML Shell
- TodoTree 完整功能实现计划
- SettingsPage.tsx
- 桌面任务拆分与执行流程整改实施计划
- 导航、详情布局与标签页整改计划
- types.ts
- Flow 查找、导航与缩放可读性实施计划

## God Nodes (most connected - your core abstractions)
1. `App()` - 20 edges
2. `Tag` - 17 edges
3. `Todo` - 15 edges
4. `compilerOptions` - 12 edges
5. `TodoTree 产品体验与整改建议` - 11 edges
6. `lucide-react` - 11 edges
7. `react` - 11 edges
8. `FlowCanvas()` - 9 edges
9. `isLeaf()` - 9 edges
10. `indexFlowTodos()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Local Tree Todo Product` --semantically_similar_to--> `Tree Todo Application`  [INFERRED] [semantically similar]
  README.md → docs/superpowers/specs/2026-09-27-recursive-todo-design.md
- `pnpm Workspace Includes apps/*` --references--> `Web Application at apps/web`  [INFERRED]
  pnpm-workspace.yaml → README.md
- `Simple, Incremental, Modular, Durable Implementation` --rationale_for--> `Minimal pnpm Workspace Architecture`  [INFERRED]
  AGENTS.md → docs/superpowers/specs/2026-09-27-recursive-todo-design.md
- `Responsive List, Graph, and Detail Layout` --conceptually_related_to--> `Leaf Todo List View`  [INFERRED]
  DESIGN.md → docs/superpowers/specs/2026-09-27-recursive-todo-design.md
- `Tree Todo Visual System` --conceptually_related_to--> `Tree Todo Application`  [INFERRED]
  DESIGN.md → docs/superpowers/specs/2026-09-27-recursive-todo-design.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Recursive Tree Data Model and Its Views** — docs_superpowers_specs_2026_09_27_recursive_todo_design_recursive_json_tree, docs_superpowers_specs_2026_09_27_recursive_todo_design_list_view, docs_superpowers_specs_2026_09_27_recursive_todo_design_graph_view [EXTRACTED 1.00]

## Communities (19 total, 2 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.15
Nodes (31): App(), AppHistoryState, Navbar(), NavbarProps, SettingsPanel(), APP_ROUTES, baseRouteFor(), detailRouteFor() (+23 more)

### Community 1 - "web/package.json"
Cohesion: 0.10
Nodes (20): dependencies, d3-hierarchy, lucide-react, react, react-dom, @xyflow/react, name, private (+12 more)

### Community 2 - "TodoTree 产品体验与整改建议"
Cohesion: 0.06
Nodes (30): 10. 实现定位与约束, 1. 产品要帮助用户完成什么, 2.1 环境与方法, 2.2 可复现观察, 2.3 尚未完成的验证, 2. 实际体验范围与证据, 3. 需要优先整改的事项, 4.1 节点上能看见、能直接使用的操作 (+22 more)

### Community 3 - "GraphView.tsx"
Cohesion: 0.12
Nodes (27): FlowCanvas(), GraphView(), getComposerAnchor(), TodoNode(), TodoNodeProps, indexFlowTodos(), COMPACT_ZOOM_THRESHOLD, DETAIL_ZOOM_THRESHOLD (+19 more)

### Community 4 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 5 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, tailwindcss, @tailwindcss/vite, @types/d3-hierarchy, @types/react, @types/react-dom, typescript, vite (+11 more)

### Community 6 - "package.json"
Cohesion: 0.20
Nodes (9): engines, node, name, packageManager, private, scripts, build, dev (+1 more)

### Community 7 - "Recursive JSON Todo Tree"
Cohesion: 0.32
Nodes (8): Responsive List, Graph, and Detail Layout, Cascade Deletion and Parent Leaf Transition, React Flow and Tree Layout, Left-to-Right Tree Graph View, Leaf-Only Completion Invariant, Leaf Todo List View, Recursive JSON Todo Tree, Derive Views from the Single Tree Data Source

### Community 8 - "Tree Todo Application"
Cohesion: 0.33
Nodes (6): Tree Todo Visual System, Validate Imports Before Replacing Data, First-Version Feature Boundaries, Local Storage and Manual JSON Migration, Tree Todo Application, Local Tree Todo Product

### Community 9 - "New Project Bootstrap Workflow"
Cohesion: 0.40
Nodes (5): Graphify Query and Update Guidance, New Project Bootstrap Skill Interface, New Project Bootstrap Workflow, Evidence-Based Design Documentation and Graphify, Review and Neutralize Generated Templates

### Community 10 - "Web Application at apps/web"
Cohesion: 0.40
Nodes (5): Simple, Incremental, Modular, Durable Implementation, Minimal pnpm Workspace Architecture, React, TypeScript, and Vite Web Stack, pnpm Workspace Includes apps/*, Web Application at apps/web

### Community 11 - "vite.config.ts"
Cohesion: 0.50
Nodes (3): @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 13 - "TodoTree 完整功能实现计划"
Cohesion: 0.20
Nodes (9): Global Constraints, Review Focus, Task 1: 稳固 JSON 数据边界, Task 2: 完成图表与列表的核心操作, Task 3: 补全面板、标签编辑与移动端操作, Task 4: 构建、Graphify 同步与最终覆盖检查, TodoTree 完整功能实现计划, 初始功能审计 (+1 more)

### Community 14 - "SettingsPage.tsx"
Cohesion: 0.11
Nodes (20): ConfirmModal(), ConfirmModalProps, clampScore(), ScoreCoordinatePicker(), ScoreCoordinatePickerProps, countTodos(), SettingsPage(), SettingsPageProps (+12 more)

### Community 15 - "桌面任务拆分与执行流程整改实施计划"
Cohesion: 0.33
Nodes (5): 全局约束, 执行步骤, 文件职责, 桌面任务拆分与执行流程整改实施计划, 重点审阅输入

### Community 17 - "types.ts"
Cohesion: 0.21
Nodes (17): FlowNavigator(), FlowNavigatorProps, GraphViewProps, ListView(), ListViewProps, SettingsPanelProps, expandFlowPath(), FlowEntry (+9 more)

### Community 18 - "Flow 查找、导航与缩放可读性实施计划"
Cohesion: 0.11
Nodes (18): 1. 搜索与定位, 2. 大纲与分支折叠, 3. 列表与详情导航, 4. 缩放可读性, Flow 查找、导航与缩放可读性实施计划, Global Constraints, Review Focus, Task 1：任务索引与搜索模型 (+10 more)

## Knowledge Gaps
- **124 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `web/package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `Tag` connect `types.ts` to `App.tsx`, `GraphView.tsx`, `SettingsPage.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `Todo` connect `types.ts` to `App.tsx`, `GraphView.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14789915966386555 - nodes in this community are weakly interconnected._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `TodoTree 产品体验与整改建议` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._