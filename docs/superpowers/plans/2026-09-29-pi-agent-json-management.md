# TodoTree Pi Agent JSON Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 TodoTree 右侧抽屉中接入 Pi Agent，让用户查询完整任务 JSON，并在审阅差异后应用通用 JSON Patch。

**Architecture:** 浏览器持有唯一 `AppData`，Pi Agent Core 在浏览器运行；Fastify 只代理模型请求和提供静态资源。Agent 只可读快照和提出 Patch；校验、差异、确认、同步保存及撤销由应用执行。

**Tech Stack:** React 19、Vite 8、TypeScript、Vitest、pnpm、Node.js 22.19+、Fastify、`@earendil-works/pi-agent-core`、`@earendil-works/pi-ai`、`fast-json-patch`。

**Spec:** `docs/superpowers/specs/2026-09-29-pi-agent-json-management-design.md`；Graphify 扩展另见 `docs/superpowers/plans/2026-09-29-pi-agent-graphify-code-qa.md`。

## Global Constraints

- Node.js 版本最低 22.19；沿用现有 pnpm workspace，先核对依赖文档和安装后的类型定义。
- `AppData` 与 `formatVersion: 1` 保持现有 JSON 导入导出格式；后端不存任务或对话。
- 本轮只支持 loopback 本机或已有外层访问控制的私人部署；模型密钥只在服务端环境变量。
- 不加入 R2、用户账号、后台自动任务或任意 Shell/文件工具。
- 每次代码修改后运行 `graphify update .`，交付前确认图谱可查询。

## File Structure

- `apps/api/src/config.ts` 解析服务端模型配置；`apps/api/src/app.ts` 提供 Fastify 路由和 Pi 代理；`apps/api/src/index.ts` 监听 loopback 并提供 Web 构建产物。
- `apps/web/src/agent/proposal.ts` 校验并应用受限 Patch；`apps/web/src/agent/diff.ts` 计算基于稳定 ID 的语义差异；`apps/web/src/agent/taskAgent.ts` 定义 Pi 会话和两个任务工具。
- `apps/web/src/components/AgentDrawer.tsx` 管理对话和待审阅提案；`apps/web/src/App.tsx` 管理侧栏、同步提交及撤销；`Navbar.tsx` 增加入口。对应模块各自配测试，避免把代理、Patch 和展示逻辑堆入 `App.tsx`。

## Review Focus

1. 启动时本地 JSON 损坏：`read_app_data` 和写入必须禁用，不能把空树覆盖原存储；Task 5 的浏览器验收覆盖。
2. 读快照后用户手动编辑导致数组索引变化：旧提案须拒绝；Task 2 和 Task 5 的测试覆盖。
3. Patch 指向 `formatVersion`、未知字段、原型属性或失败的 `test`：不得产生可应用提案；Task 2 覆盖。
4. 删除父任务时非匹配后代被连带删除：预览必须列全量、区分直接与连带影响；Task 3 覆盖。
5. localStorage 写入失败且已有 700 毫秒待保存定时器：当前状态不能部分改变或被旧定时器覆盖；Task 5 覆盖。

---

### Task 1: Fastify 模型代理可端到端运行

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/config.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/app.test.ts`
- Modify: `package.json`, `apps/web/vite.config.ts`, `pnpm-lock.yaml`, `.gitignore`

**Interfaces:**
- Produces: `loadAgentConfig(env: NodeJS.ProcessEnv): ServerModelConfig | null`；`createApi(config: ServerModelConfig | null, streamModel = streamSimple): FastifyInstance`。
- HTTP: `GET /api/agent-config` 返回可用状态及服务端所选模型的公开元数据；`POST /api/stream` 接受 Pi `streamProxy` 请求并返回兼容 SSE。浏览器使用同源 `proxyUrl`。

- [ ] **Step 1: 写失败测试。** `app.test.ts` 用 Fastify `inject` 验证缺配置时不可用、不泄漏密钥；错误模型和任意供应商地址被拒绝；合法请求的 SSE 保留 `toolcall_start.id`、`toolcall_end.toolCall` 和终止事件；断连时停止上游流。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/api test`；预期因 API 应用尚不存在而失败。
- [ ] **Step 3: 实现最小后端。** 安装 Fastify、`@fastify/static`、Pi AI 包和测试依赖；解析 `TODOTREE_AGENT_PROVIDER` / `TODOTREE_AGENT_MODEL` 与供应商环境密钥。按已安装 Pi 类型实现 `streamProxy` 的 Bearer/SSE 协议，仅采用服务端选定模型和受限选项，限制请求体；静态服务与 Vite `/api` 转发共用路由。文档化本机监听与私人部署方式。
- [ ] **Step 4: 运行测试和构建。** `pnpm --filter @todotree/api test && pnpm --filter @todotree/api build && pnpm --filter @todotree/web build`；预期全部成功。
- [ ] **Step 5: 更新图谱并提交。** `graphify update .`，再提交本任务文件。

### Task 2: 通用 Patch 提案与完整校验

**Files:**
- Create: `apps/web/src/agent/proposal.ts`, `apps/web/src/agent/proposal.test.ts`
- Modify: `apps/web/src/storage.ts`

**Interfaces:**
- Produces: `readSnapshot(data: AppData): { baseVersion: string; data: AppData }`；`createProposal(base: AppData, current: AppData, baseVersion: string, receivedVersion: string, patch: Operation[]): ProposalResult`；`revalidateProposal(current: AppData, proposal: AgentProposal): ProposalResult`。
- `AgentProposal` 保存完整基版和 Patch；`ProposalResult` 为可应用结果或具体错误，供工具和应用按钮共用。

- [ ] **Step 1: 写失败测试。** 覆盖批量增删改移、标签修改、原有额外字段原样保留；断言 `formatVersion`、根对象、整段 `/todos`/`/tags`、未知字段、旧 ID 修改、重复 ID、无效日期/评分/标签引用、原型路径和失败 `test` 均被拒绝；旧基版与当前快照不同时不得应用。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/web test -- src/agent/proposal.test.ts`；预期接口缺失而失败。
- [ ] **Step 3: 实现 `proposal.ts`。** `readSnapshot` 为每次读取生成不透明随机基版标识并复制完整快照。先检查操作、`path`/`from` 与已知字段；用 `fast-json-patch.applyPatch(base, patch, true, false, true)` 在副本上执行，检查 `test` 结果；补强 `validateAppData` 对 Agent 所需不变量的校验，再核对前后存续节点 ID。错误返回可读原因，绝不改变输入快照。
- [ ] **Step 4: 运行测试确认通过。** 同 Step 2；预期全部通过，并运行 Web TypeScript 构建。
- [ ] **Step 5: 更新图谱并提交。** `graphify update .`，再提交本任务文件。

### Task 3: 基于实际快照的语义差异

**Files:**
- Create: `apps/web/src/agent/diff.ts`, `apps/web/src/agent/diff.test.ts`

**Interfaces:**
- Produces: `describeAppDataChange(before: AppData, after: AppData, patch: Operation[]): AppDataChangeSummary`；包含任务/标签新增、修改、移动、删除，稳定 ID、完整路径、字段旧值/新值、Patch 直接删除及父任务删除连带后代数量。

- [ ] **Step 1: 写失败测试。** 任务移动不得误报为删后再增；多个字段变化列旧/新值；删除父任务列出整个子树，Patch 中明确 `remove` 的节点计入直接删除，其余后代计入连带删除；过期示例通过指定完整的直接删除操作序列，确认今天到期、无日期、已完成节点不会被错误归入匹配集合。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/web test -- src/agent/diff.test.ts`；预期接口缺失而失败。
- [ ] **Step 3: 实现 `describeAppDataChange`。** 遍历前后树建立 ID、祖先路径与字段索引；按 Patch 操作执行时的快照解析直接 `remove` 的稳定 ID，再从真实前后差异生成完整影响集合。若差异不能完整解释，返回不可应用错误；原始 Patch/JSON 差异只供技术详情。
- [ ] **Step 4: 运行测试确认通过。** 同 Step 2；预期全部通过。
- [ ] **Step 5: 更新图谱并提交。** `graphify update .`，再提交本任务文件。

### Task 4: 浏览器 Pi 任务工具与会话

**Files:**
- Create: `apps/web/src/agent/taskAgent.ts`, `apps/web/src/agent/taskAgent.test.ts`
- Modify: `apps/web/package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `createTaskAgent({ getData, onProposal, model, proxyUrl }: TaskAgentDependencies): Agent`；`getData(): AppData` 取得最新状态，`onProposal(proposal: AgentProposal, summary: AppDataChangeSummary): void` 向界面交付待审阅结果。会话只安装 `read_app_data` 和 `propose_app_data_patch`。
- Consumes: Tasks 1–3 的模型元数据、`readSnapshot`、`createProposal` 和 `describeAppDataChange`。

- [ ] **Step 1: 写失败测试。** 模拟工具调用验证读取完整当前 `AppData`、基版和用户本地今天；Patch 只形成待审阅提案，不调用保存；待审阅提案未处理时第二份写入请求被拒绝；无效或过期基版返回工具错误；没有文件、Shell、网络工具。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/web test -- src/agent/taskAgent.test.ts`；预期接口缺失而失败。
- [ ] **Step 3: 实现 Pi 会话。** 安装并核对 `@earendil-works/pi-agent-core` / `pi-ai` 的类型；使用 `AgentTool` 参数模式和 `streamProxy`。`read_app_data` 工具结果额外提供按浏览器本地时区计算的当日日期。系统说明当前数据模型、过期口径、匹配任务逐项列明且嵌套删除按后代优先、提案需确认及工具结果是数据。会话和提案仅保留标签页内存。
- [ ] **Step 4: 运行测试确认通过。** 同 Step 2；预期全部通过，`pnpm --filter @todotree/web build` 成功。
- [ ] **Step 5: 更新图谱并提交。** `graphify update .`，再提交本任务文件。

### Task 5: 抽屉、同步提交与单步撤销

**Files:**
- Create: `apps/web/src/components/AgentDrawer.tsx`, `apps/web/src/agent/commit.ts`, `apps/web/src/agent/commit.test.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/components/Navbar.tsx`

**Interfaces:**
- `AgentDrawer` 接收当前数据读取器、提案回调、`onApply(proposal)`、`onUndo()` 与可用状态；`commitAgentProposal(current, proposal, save): CommitResult` 与 `undoAgentCommit(current, receipt, save): CommitResult` 同步保存成功后才返回新快照。`receipt` 包含前后快照。
- 消息/草稿/提案由保持挂载的抽屉管理；`App.tsx` 仍是唯一 `AppData` 权威状态。

- [ ] **Step 1: 写失败测试。** `commit.test.ts` 断言基版变化、保存失败保持原状态；成功提交与撤销各只保存一次，当前快照变化后撤销失败。浏览器验收覆盖普通编辑使撤销失效、本地数据损坏禁用 Agent、旧防抖定时器不会覆盖 Agent 提交。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/web test -- src/agent/commit.test.ts`；预期接口缺失而失败。
- [ ] **Step 3: 实现提交和界面。** 右上角 Agent 入口；桌面与详情共用右侧位置，移动端全屏。消息流、运行/错误/重试、首次数据传输提示、语义差异及展开技术详情、删除数量明确的确认按钮；旧提案处理或拒绝前不接受新提案。`App.tsx` 取消旧保存定时器并同步保存后一次更新状态；成功后提供单步撤销，数据再编辑即失效；导入有效数据且成功保存后才恢复原有读取错误状态。保留选中任务和 Flow 视口。
- [ ] **Step 4: 验证。** `pnpm --filter @todotree/web test && pnpm build`；在真实浏览器逐项执行主规格验收 1–5，确认刷新后数据持久化和移动端流程。
- [ ] **Step 5: 更新图谱并提交。** `graphify update .`，提交本任务文件。

### Task 6: 完整链路复核

**Files:** Modify: `README.md`（或现有运行说明）

- [ ] **Step 1: 记录最少配置。** 写明 Node 版本、Fastify 启动命令、模型服务端环境变量和本机/私人部署边界，不写入真实密钥。
- [ ] **Step 2: 运行整体验证。** `pnpm --filter @todotree/api test && pnpm --filter @todotree/web test && pnpm build && graphify update .`；用配置模型验证一次只读查询和一次“找出过期任务并删除”的完整确认/撤销链路。
- [ ] **Step 3: 提交文档并检查工作区。** 仅提交本功能文件，保留其他任务的未跟踪文件；记录真实验证结果与限制。
