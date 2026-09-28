# Graph Report - /Users/leon.w/Documents/ChatGPT/TodoMatrix2  (2026-09-27)

## Corpus Check
- Corpus is ~6,921 words - fits in a single context window. You may not need a graph.

## Summary
- 159 nodes · 255 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Todo State and Persistence
- Web Dependencies and Manifest
- UI Components and Types
- Graph View and Tree Layout
- TypeScript Compiler Options
- Build and Development Tooling
- Workspace Scripts
- Todo Domain and Interaction Rules
- Product and Visual Design
- Project Skills and Agent Guidance
- Architecture and Implementation Principles
- Vite App Configuration
- HTML App Entry

## God Nodes (most connected - your core abstractions)
1. `Tag` - 13 edges
2. `Todo` - 13 edges
3. `compilerOptions` - 12 edges
4. `App()` - 11 edges
5. `isLeaf()` - 8 edges
6. `lucide-react` - 7 edges
7. `react` - 6 edges
8. `addChildTodoToTree()` - 5 edges
9. `TodoNodeData` - 5 edges
10. `AppData` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Local Tree Todo Product` --semantically_similar_to--> `Tree Todo Application`  [INFERRED] [semantically similar]
  README.md → docs/superpowers/specs/2026-09-27-recursive-todo-design.md
- `Tree Todo Visual System` --conceptually_related_to--> `Tree Todo Application`  [INFERRED]
  DESIGN.md → docs/superpowers/specs/2026-09-27-recursive-todo-design.md
- `Responsive List, Graph, and Detail Layout` --conceptually_related_to--> `Leaf Todo List View`  [INFERRED]
  DESIGN.md → docs/superpowers/specs/2026-09-27-recursive-todo-design.md
- `Simple, Incremental, Modular, Durable Implementation` --rationale_for--> `Minimal pnpm Workspace Architecture`  [INFERRED]
  AGENTS.md → docs/superpowers/specs/2026-09-27-recursive-todo-design.md
- `pnpm Workspace Includes apps/*` --references--> `Web Application at apps/web`  [INFERRED]
  pnpm-workspace.yaml → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Recursive Tree Data Model and Its Views** — docs_superpowers_specs_2026_09_27_recursive_todo_design_recursive_json_tree, docs_superpowers_specs_2026_09_27_recursive_todo_design_list_view, docs_superpowers_specs_2026_09_27_recursive_todo_design_graph_view [EXTRACTED 1.00]

## Communities (13 total, 1 thin omitted)

### Community 0 - "Todo State and Persistence"
Cohesion: 0.21
Nodes (20): App(), PRESET_COLORS, SettingsPage(), SettingsPageProps, addChildTodoToTree(), addRootTodoToTree(), collectLeafTodos(), createDefaultTag() (+12 more)

### Community 1 - "Web Dependencies and Manifest"
Cohesion: 0.10
Nodes (19): dependencies, d3-hierarchy, lucide-react, react, react-dom, @xyflow/react, name, private (+11 more)

### Community 2 - "UI Components and Types"
Cohesion: 0.18
Nodes (15): ConfirmModal(), ConfirmModalProps, GraphViewProps, ListView(), ListViewProps, Navbar(), NavbarProps, SettingsPanel() (+7 more)

### Community 3 - "Graph View and Tree Layout"
Cohesion: 0.16
Nodes (14): FlowCanvas(), GraphView(), TodoNode(), TodoNodeProps, buildTreeFlowElements(), GAP_X, GAP_Y, NODE_HEIGHT (+6 more)

### Community 4 - "TypeScript Compiler Options"
Cohesion: 0.11
Nodes (18): compilerOptions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 5 - "Build and Development Tooling"
Cohesion: 0.12
Nodes (17): devDependencies, tailwindcss, @tailwindcss/vite, @types/d3-hierarchy, @types/react, @types/react-dom, typescript, vite (+9 more)

### Community 6 - "Workspace Scripts"
Cohesion: 0.20
Nodes (9): engines, node, name, packageManager, private, scripts, build, dev (+1 more)

### Community 7 - "Todo Domain and Interaction Rules"
Cohesion: 0.32
Nodes (8): Responsive List, Graph, and Detail Layout, Cascade Deletion and Parent Leaf Transition, React Flow and Tree Layout, Left-to-Right Tree Graph View, Leaf-Only Completion Invariant, Leaf Todo List View, Recursive JSON Todo Tree, Derive Views from the Single Tree Data Source

### Community 8 - "Product and Visual Design"
Cohesion: 0.33
Nodes (6): Tree Todo Visual System, Validate Imports Before Replacing Data, First-Version Feature Boundaries, Local Storage and Manual JSON Migration, Tree Todo Application, Local Tree Todo Product

### Community 9 - "Project Skills and Agent Guidance"
Cohesion: 0.40
Nodes (5): Graphify Query and Update Guidance, New Project Bootstrap Skill Interface, New Project Bootstrap Workflow, Evidence-Based Design Documentation and Graphify, Review and Neutralize Generated Templates

### Community 10 - "Architecture and Implementation Principles"
Cohesion: 0.40
Nodes (5): Simple, Incremental, Modular, Durable Implementation, Minimal pnpm Workspace Architecture, React, TypeScript, and Vite Web Stack, pnpm Workspace Includes apps/*, Web Application at apps/web

### Community 11 - "Vite App Configuration"
Cohesion: 0.50
Nodes (3): @tailwindcss/vite, vite, @vitejs/plugin-react

## Knowledge Gaps
- **62 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Build and Development Tooling` to `Web Dependencies and Manifest`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `Todo` connect `UI Components and Types` to `Todo State and Persistence`, `Graph View and Tree Layout`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Web Dependencies and Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `TypeScript Compiler Options` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Build and Development Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._