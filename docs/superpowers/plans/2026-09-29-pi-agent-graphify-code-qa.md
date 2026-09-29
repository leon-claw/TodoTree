# TodoTree Pi Agent Graphify Code Q&A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在同一 Agent 抽屉加入独立、只读的项目代码问答，依据 Graphify 和少量已索引源码回答 TodoTree 架构问题。

**Architecture:** 复用已运行的 Pi 浏览器会话基础、Fastify 模型代理和抽屉；代码模式有独立 Pi 会话。Fastify 用固定参数运行本机 Graphify CLI，并按图谱索引严格限制源码摘录。

**Tech Stack:** React 19、TypeScript、Pi Agent Core、Fastify、Node.js 22.19+、Graphify CLI、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-29-pi-agent-graphify-code-qa-design.md`；先完成 `docs/superpowers/plans/2026-09-29-pi-agent-json-management.md` 的可运行基础。

## Global Constraints

- 代码模式只读：不能访问任务 `AppData` 工具，不能写项目文件或触发 `graphify update`。
- 后端仍是 Node.js/Fastify；本机或私人部署须是包含 `.git`、项目源码、`graphify-out/graph.json` 和 Graphify CLI 的项目检出。
- 只执行 `query`、`path`、`explain`；固定工作目录、参数数组、超时、输入与输出上限，绝不交给 Shell。
- 摘录最多 80 行，只限图谱 `source_file` 指向的已跟踪 `apps/`、`docs/` 或规定根目录文件；拒绝路径越界和密钥。
- 每次代码修改后运行 `graphify update .`，交付前确认 `built_at_commit` 与查询结果可见。

## File Structure

- `apps/api/src/graphRunner.ts` 运行受限 Graphify 命令；`apps/api/src/sourceExcerpt.ts` 核对索引和路径并读源码；`apps/api/src/graphRoutes.ts` 提供只读 HTTP 接口。
- `apps/web/src/agent/codeAgent.ts` 定义四个只读 Pi 工具和独立会话；`AgentDrawer.tsx` 增加模式切换及图谱状态展示。

## Review Focus

1. 用户输入含 Shell 元字符：命令必须把它当单个参数，不能执行附带命令；Task 1 测试。
2. 图谱来源路径是符号链接或 `../`：不能读出项目外或允许范围外；Task 2 测试。
3. 图谱节点指向隐藏配置或未跟踪文件：源码工具应拒绝；Task 2 测试。
4. 图谱不存在、CLI 超时或输出过大：代码模式解释原因，任务模式仍可用；Task 1 和 Task 3 测试。
5. 切换模式时旧对话上下文或任务 JSON 串入代码模式：两个 Agent 的消息和工具列表必须隔离；Task 3 测试。

---

### Task 1: 后端受限 Graphify 查询

**Files:**
- Create: `apps/api/src/graphRunner.ts`, `apps/api/src/graphRoutes.ts`, `apps/api/src/graphRunner.test.ts`, `apps/api/src/graphRoutes.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `runGraphify(input: { kind: 'query'; question: string } | { kind: 'path'; from: string; to: string } | { kind: 'explain'; node: string }, signal?: AbortSignal): Promise<string>`；`registerGraphRoutes(app: FastifyInstance, projectRoot: string): void`。
- HTTP: `GET /api/graph/status`（可用状态和 `built_at_commit`）；`POST /api/graph/query`、`/path`、`/explain`（局部结果或明确错误）。

- [ ] **Step 1: 写失败测试。** 验证 `query` 带 `--budget 2000`、`path` 带 `--undirected`、`explain` 原样查找；Shell 元字符不能形成第二命令；缺图、空结果、超时和超限输出返回可解释错误且不影响 `/api/stream`。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/api test -- src/graphRunner.test.ts src/graphRoutes.test.ts`；预期模块缺失而失败。
- [ ] **Step 3: 实现 runner 和路由。** 用 `spawn` 或 `execFile` 固定 Graphify 可执行文件、cwd 和参数数组；校验字符串长度与次数，限制进程运行时长和标准输出字节数，捕获退出码；状态端点仅读图元数据。
- [ ] **Step 4: 运行测试确认通过。** 同 Step 2；预期全部通过，并在实际项目根运行一个受限查询。
- [ ] **Step 5: 更新图谱并提交。** `graphify update .`，再提交本任务文件。

### Task 2: 已索引源码的受限摘录

**Files:**
- Create: `apps/api/src/sourceExcerpt.ts`, `apps/api/src/sourceExcerpt.test.ts`
- Modify: `apps/api/src/graphRoutes.ts`

**Interfaces:**
- Produces: `readIndexedSource(projectRoot: string, sourceFile: string, startLine: number): Promise<{ path: string; startLine: number; lines: string[] }>`。
- HTTP: `POST /api/graph/source` 返回最多 80 行及实际路径/行号。

- [ ] **Step 1: 写失败测试。** 图谱 `source_file` 中的 `apps/web/src/storage.ts` 可读；无索引路径、`../`、绝对路径、符号链接越界、隐藏文件、`.env`、未跟踪文件和行号非法均拒绝；第 81 行不得进入返回。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/api test -- src/sourceExcerpt.test.ts`；预期接口缺失而失败。
- [ ] **Step 3: 实现来源核对。** 读取 `graph.json` 节点 `source_file` 集合，核对允许清单、`git ls-files` 的跟踪状态与 `realpath` 归属；只读取 UTF-8 文本并限制文件大小。路由调用此函数，不接收任意文件路径读取请求。
- [ ] **Step 4: 运行测试确认通过。** 同 Step 2；预期全部通过。
- [ ] **Step 5: 更新图谱并提交。** `graphify update .`，再提交本任务文件。

### Task 3: 独立 Pi 代码会话和抽屉切换

**Files:**
- Create: `apps/web/src/agent/codeAgent.ts`, `apps/web/src/agent/codeAgent.test.ts`
- Modify: `apps/web/src/components/AgentDrawer.tsx`, `README.md`

**Interfaces:**
- Produces: `createCodeAgent({ model, proxyUrl, graphApi }: CodeAgentDependencies): Agent`；只装载 `query_project_graph`、`trace_project_graph`、`explain_project_node`、`read_indexed_source`。
- Consumes: Tasks 1–2 的只读 HTTP 接口与主计划的抽屉/模型代理。

- [ ] **Step 1: 写失败测试。** 代码会话无 `read_app_data`、`propose_app_data_patch`；模式切换保留各自历史且模型上下文不互传；图谱失败只禁用代码模式；回答提示要求文件行号，并明示 `INFERRED` / `AMBIGUOUS`。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/web test -- src/agent/codeAgent.test.ts`；预期接口缺失而失败。
- [ ] **Step 3: 实现代码模式。** 同一抽屉顶部增加“任务数据 / 项目代码”；首用显示图谱/源码传输提示，代码模式标记只读，隐藏应用按钮；展示 `built_at_commit`，使用独立 Pi 会话和四个工具。图谱结果被当作证据数据，无法核对时说明不足。
- [ ] **Step 4: 验证两种模式。** `pnpm --filter @todotree/api test && pnpm --filter @todotree/web test && pnpm build`；真实浏览器分别问“任务 JSON 从哪里保存”和“两个模块如何相连”，检查来源行号及模式隔离；模拟 Graphify 缺失后确认任务模式仍工作。
- [ ] **Step 5: 更新图谱并提交。** `graphify update .`，补充 Graphify CLI 的本机部署要求并提交本任务文件。
