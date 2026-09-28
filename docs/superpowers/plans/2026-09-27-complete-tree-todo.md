# TodoTree 完整功能实现计划

> **For agentic workers:** 使用 `superpowers:executing-plans` 在当前任务中逐项实现；本计划以 `docs/superpowers/specs/2026-09-27-recursive-todo-design.md` 为产品依据。

**Goal:** 补齐 Gemini 初稿中与已确认规格不一致或边界不完整的部分，让递归 Todo、双视图、侧栏编辑、标签与 JSON 迁移在桌面和移动端都能连贯使用。

**Architecture:** 保持 `AppData.todos` 作为唯一 Todo 树数据源；树更新和 JSON 校验留在 `storage.ts`，视图只派生并呈现数据。沿用现有 React、TypeScript、Vite、React Flow、d3-hierarchy 与 Tailwind，不引入新依赖。

**Tech Stack:** pnpm workspace、React 19、TypeScript、Vite、`@xyflow/react`、`d3-hierarchy`、Tailwind CSS。

**Spec:** `docs/superpowers/specs/2026-09-27-recursive-todo-design.md`

## Global Constraints

- 桌面与移动浏览器均可使用；数据只保存在浏览器本地，以 JSON 手动迁移。
- 递归 Todo 树是唯一数据源；图表为父节点在左、子节点在右的树，节点采用一致卡片样式。
- 只有叶子 Todo 可以完成；已完成的叶子先取消完成，才可以添加子节点；列表只显示叶子 Todo。
- 点击图表节点打开设置面板；面板管理标题、字符串备注、字符串截止日期、0–100 重要/紧急程度和多个标签。
- 删除节点时级联删除全部后代；删除最后一个子节点后，父节点变成未完成叶子。
- 设置页管理有标题和颜色的标签，并支持经过校验、确认后整体替换的 JSON 导入与导出。
- 不添加云端账户、自动同步、通知、筛选、自由连线、拖拽重排或其他未确认功能。
- 只复用现有依赖，不增加预防性抽象或无关配置。

## Review Focus

- 删除最后一个子节点后，原父节点恢复为未完成叶子；删除父节点时所有后代一并消失。
- 已完成叶子不能直接添加子节点；非叶子节点不能被完成。
- 非法或取消的 JSON 导入不修改当前数据；格式正确但日历日期无效的数据也要拒绝。
- 增加/删除深层节点后，图表重新排布并能看到新结构；编辑标题等属性不应造成节点重叠。
- 标签重命名、改色、删除及多选之后，引用保持有效，空名称不会成为可导出的坏数据。

## 初始功能审计

以下状态来自 Gemini 初稿源码及已确认规格的逐项对照；本次只用产品需求验收功能，不把 `DESIGN.md` 纳入审计。

- **已实现：** 递归 Todo 树、子项创建规则、级联删除和删除最后一个子项后父项恢复为未完成叶子（`storage.ts`）；图表节点选择后打开详情面板，列表派生所有叶子并可切换完成状态（`App.tsx`、`GraphView.tsx`、`ListView.tsx`、`SettingsPanel.tsx`）；备注、截止日期、重要/紧急程度和多标签编辑；标签创建、改色、删除时清除任务引用（`SettingsPage.tsx`、`App.tsx`）；本地 JSON 持久化、导入校验和确认替换、导出下载（`storage.ts`、`SettingsPage.tsx`）；移动端全屏详情面板及图表触控平移/缩放（`SettingsPanel.tsx`、`GraphView.tsx`）。
- **部分完成：** 导入验证已覆盖基本字段、版本、数值范围、重复 Todo/标签 ID、父项完成状态及悬空标签引用，但日期只校验字符串格式，标签颜色只检查非空，重复标签引用未拒绝（`validateAppData`）；文件读取异常缺少 `FileReader.onerror/onabort` 提示，文件选择值仅在成功回调路径清理；导出后立即撤销对象 URL（`SettingsPage.tsx`）。
- **行为不符：** 图表卡片允许直接切换叶子完成状态、父项展示不同徽标，违反相同节点样式及完成操作仅在列表/详情面板的交互要求（`TodoNode.tsx`）；`fitView` 只依赖根任务数量，新增/删除深层子项不会重新适配；卡片高度随备注/标签内容变化，但布局使用固定节点高度（`GraphView.tsx`、`TodoNode.tsx`、`treeLayout.ts`）。
- **运行时阻塞：** `FlowCanvas` 调用 `useReactFlow()`，但图表外层没有 `ReactFlowProvider`，切换到图表视图会因缺少 React Flow context 而崩溃（`GraphView.tsx`）。
- **缺失/不完整：** 列表空态没有创建根任务入口（`ListView.tsx`）；标签重命名直接逐字写入，空白草稿可被保存进当前数据（`SettingsPage.tsx`）；详情面板和确认弹窗缺少对话框语义、Escape 操作和明确的程序化表单标签，多个按钮无可见键盘焦点（`SettingsPanel.tsx`、`ConfirmModal.tsx`、`index.css`）；小屏品牌与三项完整导航标签可能挤压（`Navbar.tsx`）。

仅实现上述已确认功能范围内的缺口，不新增功能或依赖。

---

### Task 1: 稳固 JSON 数据边界

**Files:**
- Modify: `apps/web/src/storage.ts`
- Modify: `apps/web/src/components/SettingsPage.tsx`

**Interfaces:**
- 保持现有 `validateAppData(json: unknown)`、`loadAppData()`、`saveAppData()` 的对外签名。
- 导入成功仍返回已校验的 `AppData`；失败不得触发替换回调。

- [x] 校验截止日期为真实日历日期（空字符串或 `YYYY-MM-DD`），而非只检查外观格式；校验标签颜色为有效六位十六进制色值、名称非空；拒绝重复 Todo/标签 ID、重复标签引用、悬空标签引用及已完成父节点。
- [x] 将文件解析改为可捕获读取和 JSON 解析错误的单一路径；保留校验失败、取消导入时不改动现有状态的行为，并在读取结束后清理文件选择值以允许重选同一文件。
- [x] 导出完成后延迟释放对象 URL，避免浏览器尚未读取 Blob 时 URL 已被撤销。

### Task 2: 完成图表与列表的核心操作

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/GraphView.tsx`
- Modify: `apps/web/src/components/TodoNode.tsx`
- Modify: `apps/web/src/components/ListView.tsx`
- Modify: `apps/web/src/treeLayout.ts`

**Interfaces:**
- 根 Todo 仍由 `App` 中的 `handleAddRootTodo` 创建，并选中新节点打开设置面板。
- 图表和列表共享 `Todo[]`；叶子完成入口保留在列表和设置面板。

- [x] 移除图表卡片中的完成开关，保持图表节点只负责显示、选择；在列表空态和列表内容页提供创建根 Todo 的入口。
- [x] 用树结构变化（节点 ID 与父子关系）触发图表 `fitView`，避免只观察根节点数量导致新增深层子节点后视口不更新；普通字段编辑不重置视口。
- [x] 固定或约束图表卡片内容高度，标题、备注和标签过长时截断/收纳，保证 d3 树布局的垂直间距不会被动态内容撑破。
- [x] 确认选择图表节点仍打开对应设置面板；列表仍只展示叶子并保留完成切换与祖先路径。
- [x] 为调用 `useReactFlow()` 的画布提供 `ReactFlowProvider`，避免图表视图运行时缺少 context。

### Task 3: 补全面板、标签编辑与移动端操作

**Files:**
- Modify: `apps/web/src/components/SettingsPanel.tsx`
- Modify: `apps/web/src/components/SettingsPage.tsx`
- Modify: `apps/web/src/components/ConfirmModal.tsx`
- Modify: `apps/web/src/components/Navbar.tsx`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- 保持现有设置面板与确认弹窗的回调接口；不引入新状态管理库。

- [x] 阻止标签名称编辑为空白后写入数据；支持提交/取消编辑，不让临时空输入破坏已有标签名；保留颜色修改和标签引用清理。
- [x] 为设置面板和确认弹窗补齐语义化对话框标记、明确的表单标签、Escape 关闭/取消和可见键盘焦点；确认删除及整体导入仍必须显式确认。
- [x] 调整窄屏导航标签的空间占用与横向滚动/折叠行为，避免品牌和三项导航互相挤压；保留图表画布的触控平移、缩放和全屏移动端详情面板。

### Task 4: 构建、Graphify 同步与最终覆盖检查

**Files:**
- Update: `graphify-out/`（通过 Graphify CLI）

**Interfaces:**
- 仅更新结构图，不改产品数据结构或增加依赖。

- [x] 运行 `pnpm build`，修复 TypeScript 或 Vite 构建问题。
- [x] 运行 `graphify update .` 更新代码结构图，并确认图谱诊断没有悬空引用。
- [x] 对照本计划的 Review Focus 和产品规格逐项检查实现，汇报已完成行为及尚存限制。

## 验收范围

- `pnpm build` 成功。
- 代码行为符合产品规格和 Review Focus 中五类边界场景。
- 保持现有 pnpm workspace 和依赖集合，不包含 Gemini 平台专属运行时代码。
- 本计划不添加或运行自动化测试；验收使用构建结果和逐项源码审阅。
- 浏览器交互检查未能启动：沙箱拒绝本地开发服务器绑定 `127.0.0.1:5173`（`EPERM`）；构建和源码覆盖检查已完成。
