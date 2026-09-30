# Graph Report - TodoTree  (2026-09-30)

## Corpus Check
- 66 files · ~29,004 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 492 nodes · 849 edges · 24 communities (22 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `038463fb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- dependencies
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
- AgentDrawer.tsx
- 桌面任务拆分与执行流程整改实施计划
- 导航、详情布局与标签页整改计划
- api/package.json
- app.ts
- TodoTree 内置 Pi Agent 管理 JSON：设计规格
- compilerOptions
- Review Focus
- Review Focus
- proposal.ts

## God Nodes (most connected - your core abstractions)
1. `App()` - 22 edges
2. `Todo` - 21 edges
3. `Tag` - 19 edges
4. `AppData` - 19 edges
5. `compilerOptions` - 12 edges
6. `lucide-react` - 12 edges
7. `react` - 12 edges
8. `createProposal()` - 11 edges
9. `TodoTree 产品体验与整改建议` - 11 edges
10. `registerGraphRoutes()` - 10 edges

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

## Communities (24 total, 2 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.08
Nodes (47): AgentCommitReceipt, commitAgentProposal(), CommitResult, undoAgentCommit(), revalidateProposal(), App(), AppHistoryState, ConfirmModal() (+39 more)

### Community 1 - "dependencies"
Cohesion: 0.07
Nodes (26): dependencies, d3-hierarchy, @earendil-works/pi-agent-core, @earendil-works/pi-ai, fast-json-patch, lucide-react, react, react-dom (+18 more)

### Community 2 - "TodoTree 产品体验与整改建议"
Cohesion: 0.06
Nodes (30): 10. 实现定位与约束, 1. 产品要帮助用户完成什么, 2.1 环境与方法, 2.2 可复现观察, 2.3 尚未完成的验证, 2. 实际体验范围与证据, 3. 需要优先整改的事项, 4.1 节点上能看见、能直接使用的操作 (+22 more)

### Community 3 - "GraphView.tsx"
Cohesion: 0.07
Nodes (54): FlowNavigator(), FlowNavigatorProps, FlowCanvas(), GraphView(), GraphViewProps, ListView(), ListViewProps, clampScore() (+46 more)

### Community 4 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 5 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, tailwindcss, @tailwindcss/vite, @types/d3-hierarchy, @types/react, @types/react-dom, typescript, vite (+11 more)

### Community 6 - "package.json"
Cohesion: 0.18
Nodes (10): engines, node, name, packageManager, private, scripts, build, dev (+2 more)

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

### Community 14 - "AgentDrawer.tsx"
Cohesion: 0.09
Nodes (36): CodeAgentDependencies, createCodeAgent(), createGraphApi(), GraphApi, GraphResult, GraphStatusResponse, responseJson(), SourceExcerpt (+28 more)

### Community 15 - "桌面任务拆分与执行流程整改实施计划"
Cohesion: 0.33
Nodes (5): 全局约束, 执行步骤, 文件职责, 桌面任务拆分与执行流程整改实施计划, 重点审阅输入

### Community 17 - "api/package.json"
Cohesion: 0.08
Nodes (25): dependencies, @earendil-works/pi-ai, fastify, @fastify/static, devDependencies, tsx, @types/node, typescript (+17 more)

### Community 18 - "app.ts"
Cohesion: 0.05
Nodes (45): createApi(), isRecord(), models, ModelStreamer, proxyEvent(), config, context, model (+37 more)

### Community 19 - "TodoTree 内置 Pi Agent 管理 JSON：设计规格"
Cohesion: 0.11
Nodes (17): TodoTree Pi Agent 的 Graphify 代码问答：设计规格, 依据, 同一抽屉中的两个上下文, 图谱新鲜度与证据, 工具接口与后端, 目标与范围, 验收, Pi 与数据边界 (+9 more)

### Community 20 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+7 more)

### Community 21 - "Review Focus"
Cohesion: 0.18
Nodes (10): File Structure, Global Constraints, Review Focus, Task 1: Fastify 模型代理可端到端运行, Task 2: 通用 Patch 提案与完整校验, Task 3: 基于实际快照的语义差异, Task 4: 浏览器 Pi 任务工具与会话, Task 5: 抽屉、同步提交与单步撤销 (+2 more)

### Community 22 - "Review Focus"
Cohesion: 0.25
Nodes (7): File Structure, Global Constraints, Review Focus, Task 1: 后端受限 Graphify 查询, Task 2: 已索引源码的受限摘录, Task 3: 独立 Pi 代码会话和抽屉切换, TodoTree Pi Agent Graphify Code Q&A Implementation Plan

### Community 23 - "proposal.ts"
Cohesion: 0.16
Nodes (17): data(), proposal(), checkIdentityAndExtraFields(), checkPatch(), collectNodes(), createProposal(), PathKind, pointerTokens() (+9 more)

## Knowledge Gaps
- **199 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+194 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Todo` connect `GraphView.tsx` to `App.tsx`, `AgentDrawer.tsx`, `proposal.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `AppData` connect `AgentDrawer.tsx` to `App.tsx`, `GraphView.tsx`, `proposal.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `Tag` connect `GraphView.tsx` to `App.tsx`, `AgentDrawer.tsx`, `proposal.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _199 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08395989974937343 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `TodoTree 产品体验与整改建议` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._