# Graph Report - TodoTree  (2026-09-28)

## Corpus Check
- 30 files · ~11,985 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 235 nodes · 384 edges · 17 communities (15 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1a64e552`
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

## God Nodes (most connected - your core abstractions)
1. `App()` - 19 edges
2. `Tag` - 13 edges
3. `Todo` - 13 edges
4. `compilerOptions` - 12 edges
5. `TodoTree 产品体验与整改建议` - 11 edges
6. `lucide-react` - 10 edges
7. `react` - 10 edges
8. `isLeaf()` - 9 edges
9. `ComposerAnchor` - 8 edges
10. `4. Flow 核心交互建议` - 8 edges

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

## Communities (17 total, 2 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.18
Nodes (27): App(), AppHistoryState, SettingsPanel(), APP_ROUTES, baseRouteFor(), detailRouteFor(), parseAppRoute(), routeForTab() (+19 more)

### Community 1 - "web/package.json"
Cohesion: 0.10
Nodes (19): dependencies, d3-hierarchy, lucide-react, react, react-dom, @xyflow/react, name, private (+11 more)

### Community 2 - "TodoTree 产品体验与整改建议"
Cohesion: 0.06
Nodes (30): 10. 实现定位与约束, 1. 产品要帮助用户完成什么, 2.1 环境与方法, 2.2 可复现观察, 2.3 尚未完成的验证, 2. 实际体验范围与证据, 3. 需要优先整改的事项, 4.1 节点上能看见、能直接使用的操作 (+22 more)

### Community 3 - "GraphView.tsx"
Cohesion: 0.12
Nodes (28): FlowCanvas(), GraphView(), GraphViewProps, ListView(), ListViewProps, Navbar(), NavbarProps, SettingsPanelProps (+20 more)

### Community 4 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 5 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, tailwindcss, @tailwindcss/vite, @types/d3-hierarchy, @types/react, @types/react-dom, typescript, vite (+9 more)

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
Cohesion: 0.14
Nodes (17): ConfirmModal(), ConfirmModalProps, clampScore(), ScoreCoordinatePicker(), ScoreCoordinatePickerProps, countTodos(), SettingsPage(), SettingsPageProps (+9 more)

### Community 15 - "桌面任务拆分与执行流程整改实施计划"
Cohesion: 0.33
Nodes (5): 全局约束, 执行步骤, 文件职责, 桌面任务拆分与执行流程整改实施计划, 重点审阅输入

## Knowledge Gaps
- **97 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `web/package.json`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _97 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `TodoTree 产品体验与整改建议` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `GraphView.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._