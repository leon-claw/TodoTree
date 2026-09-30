# TodoTree Unified Pi Agent and Model Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在设置页管理多组 LLM API 地址、模型和 Key，并让一个 Pi Agent 在同一段对话里安全操作任务 JSON、回答项目代码问题。

**Architecture:** Fastify 在服务端以受限本地 JSON 文件保存模型配置和 Key，代理所有模型请求，并提供不持久化的一键连接测试。浏览器只拿非秘密配置元数据；一个 Pi Agent 装载现有两类 JSON 工具和四类 Graphify 工具，当前模型变化时保留同一会话。

**Tech Stack:** React 19、TypeScript、Pi Agent Core、Pi AI、Fastify、Node.js 22.19+、Vitest、pnpm、Graphify CLI。

**Spec:** `docs/superpowers/specs/2026-09-30-pi-agent-unified-profiles-design.md`

## Global Constraints

- 新增 profile 固定使用 OpenAI Chat Completions 兼容请求格式；设置页不显示协议字段。
- 保存 profile 时不做 API 地址连通性或模型存在性检查；连接测试发送固定短请求，不携带 AppData/Graphify 结果，可能产生少量费用。
- Key 只存于后端配置文件，磁盘文件权限为 `0600`；公开读取、日志、前端持久化和错误响应均不得包含 Key。
- 一个 Pi Agent 和一个会话始终同时拥有两项 AppData 工具及四项只读 Graphify 工具。
- AppData 写入继续经基版校验、完整差异审阅、用户确认、同步保存；Graphify/源码工具仍受现有命令和路径边界限制。
- 现有环境变量仅在 profile 文件不存在时提供只读兼容配置；profile 文件一旦创建，环境变量不覆盖其中的活动配置。
- 不加入 R2 同步、远程 JSON 副本、多用户会话、公开部署认证或密钥链依赖。
- 每个代码任务通过后运行 `graphify update .`；提交前再次运行完整测试、构建和 Graphify 查询。

## Review Focus

1. Profile 文件损坏或权限不足时不能静默创建空配置并覆盖旧 Key；Task 1 必须测试保留原文件并报告不可用。
2. 保存新 profile 与切换活动配置并发写入时不能丢失一份更新，活动 ID 不能指向已删除 profile；Task 1 必须测试串行原子保存和删除行为。
3. 连接测试使用未保存表单或编辑中的服务器 Key 时不能持久化草稿、泄漏 Key 或把 AppData 发送给测试模型；Task 2 与 Task 4 覆盖。
4. `/api/stream` 不能因伪造模型字段或 profile ID 连接客户端指定的任意地址；Task 2 覆盖。
5. 一轮 Agent 运行期间切换 profile 不能让同一轮的工具后续请求突然换 Key/模型；Task 5 覆盖延后模型切换。

---

### Task 1: 安全的 profile 文件存储与兼容加载

**Files:**
- Create: `apps/api/src/profileStore.ts`, `apps/api/src/profileStore.test.ts`
- Modify: `apps/api/src/config.ts`, `apps/api/src/config.test.ts`

**Interfaces:**
- Produces: `AgentProfile`（`id: string`, `name: string`, `apiBaseUrl: string`, `modelId: string`, `apiKey: string`, `legacy?: boolean`）；`AgentProfileInput`（创建所需的名称、地址、模型和 Key）；`AgentProfileUpdate`（上述可更新字段、`apiKey?: string`, `clearApiKey?: boolean`）；`AgentProfileStore`（`snapshot(): ProfileSnapshot`, `get(id): AgentProfile | undefined`, `create(input): Promise<void>`, `update(id,input): Promise<void>`, `activate(id): Promise<void>`, `remove(id): Promise<void>`）；`openAgentProfileStore({ configDir, env }): Promise<AgentProfileStore>`。
- `ProfileSnapshot` 的 `profiles` 是 `Omit<AgentProfile, "apiKey">[]` 加 `hasApiKey`，并包含活动 ID、存储故障和配置文件是否已存在；`get()` 仅供服务端内部取密钥。profile ID 用 `crypto.randomUUID()` 生成。
- 当文件不存在时，可由 `config.ts` 提供旧环境变量的只读临时 profile；profile 文件存在后完全以文件为准。存储损坏状态须可观察且不能覆盖原文件。

- [x] **Step 1: 写 profile store 失败测试。** 验证初始空状态、创建/修改/激活/删除后重载保留、输入 `not a URL` 的非空地址可以保存、空 Key 更新保留旧 Key、显式清除 Key、唯一 profile 删除后活动 ID 为空、目录 `0700` 与文件 `0600`、并发写入无丢失；活动 profile 尚未切换时拒绝删除（除最后一份则清空活动 ID）；损坏 JSON 或读写错误返回明确故障且不覆盖原文件。
- [x] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/api test -- src/profileStore.test.ts`；预期 store 模块不存在。
- [x] **Step 3: 实现 `profileStore.ts`。** 默认目录为 `homedir()/.todotree`，允许 `TODOTREE_CONFIG_DIR` 覆盖；写入以临时文件和原子替换完成。序列化并发修改，必填名称（1–80 字符）、API 地址（1–2048 字符）、模型 ID（1–256 字符）和 Key（1–4096 字符）；保存时不解析 API 地址，也不验证网络连通性。创建 profile 文件后，不再回退到环境变量。
- [x] **Step 4: 扩展旧模型配置测试。** 有效旧环境变量仅在 profile 文件缺失时生成只读兼容 profile；文件存在时（包括空 profile 列表）不读取环境变量作为活动模型。
- [x] **Step 5: 运行 API 测试并更新图谱。** `pnpm --filter @todotree/api test`；预期全部通过，随后运行 `graphify update .`。
- [x] **Step 6: 提交。** 提交 store、环境变量兼容和对应测试。

### Task 2: profile 管理、Pi 流式代理与连接测试 API

**Files:**
- Create: `apps/api/src/profileModel.ts`, `apps/api/src/profileModel.test.ts`, `apps/api/src/profileRoutes.ts`, `apps/api/src/profileRoutes.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `apps/api/src/index.ts`

**Interfaces:**
- Consumes: Task 1 的 `AgentProfileStore`。
- Produces: `buildProfileModel(profile): Model<Api>`；`streamProfile(profile, context, options)`；`testProfileConnection(profile, signal): Promise<void>`；`resolveStreamProfile(store, profileId, requestedModel): AgentProfile | undefined`；`GET /api/agent-profiles`、`POST /api/agent-profiles`、`PUT /api/agent-profiles/:id`、`DELETE /api/agent-profiles/:id`、`PUT /api/agent-profiles/:id/active`、`POST /api/agent-profiles/test`。`createApi(store, runtime, webDist?, graphProjectRoot?, graphOptions?)` 中的 `runtime` 提供 `stream(profile, context, options)` 与 `test(profile, signal)`，默认使用 Pi 实现，测试可注入 fake。
- `GET` 返回 `{ profiles, activeProfileId, unavailableReason? }`；profile 含配置名称、API 地址、模型 ID、`hasApiKey` 和 Pi 公共模型描述，不含 Key。测试端点接收 `{ profileId?, name?, apiBaseUrl, modelId, apiKey? }`；有 ID 时用已保存 Key（除非传入新 Key），无 ID 时用表单 Key。表单值只用于本次测试。
- Pi `streamProxy` 的 `options.metadata.todoTreeProfileId` 携带当前 profile ID；`/api/stream` 先查服务端 profile，再严格比对公开模型描述，然后用服务器 Key 调用对应地址。该内部 ID 字段必须从 provider options 中剥离，不能转发给 LLM。不得信任请求自带的替代地址或 Key。

- [x] **Step 1: 写失败路由测试。** 使用临时目录和 fake model runtime，验证 profile CRUD 和激活；删除活动 profile 前须先切换，有其他 profile 时返回冲突；读取响应不含 Key；无效/伪造 ID 或修改 model base URL 的流式请求被拒绝；无 Key 时拒绝模型请求；合法 Pi SSE 保留原事件行为。
- [x] **Step 2: 写失败连接测试。** 成功时返回 `ok: true`；无效地址、错误 Key/模型及超时返回 `ok: false` 与安全摘要；不回显 Key/上游原始响应体、不保存未保存草稿、不发送任何任务/Graphify 工具结果。固定提示短小、`maxTokens` 不高于 8，设置 30 秒超时。
- [x] **Step 3: 运行路由测试确认失败。** `pnpm --filter @todotree/api test -- src/profileRoutes.test.ts src/app.test.ts`；预期新路由和 runtime 尚不存在。
- [x] **Step 4: 实现 Pi OpenAI-compatible profile runtime。** 根据 profile 构造 `openai-completions` Pi model/custom provider，并把 profile ID 编进服务端生成的 `model.provider`；使用 `apiKey` 请求选项。连接测试调用同一 runtime 和一个固定短提示，所有错误摘要先剥除 Key 与不安全上游内容。
- [x] **Step 5: 实现 profile 路由并替换固定模型代理。** 路由通过 Task 1 store 读写；`/api/stream` 由请求模型 provider 定位 profile 并精确核对模型。将 `/api/agent-config` 替换为安全的 profile 列表 API；保持静态资源、断连取消和现有 SSE 协议。
- [x] **Step 6: 运行 API 测试。** `pnpm --filter @todotree/api test && pnpm --filter @todotree/api build`；预期全部通过。
- [x] **Step 7: 更新图谱并提交。** `graphify update .` 后提交后端 runtime、路由及测试。

### Task 3: 将任务工具和 Graphify 工具组装成一个 Pi Agent

**Files:**
- Create: `apps/web/src/agent/todoAgent.ts`, `apps/web/src/agent/todoAgent.test.ts`
- Modify: `apps/web/src/agent/taskAgent.ts`, `apps/web/src/agent/taskAgent.test.ts`, `apps/web/src/agent/codeAgent.ts`, `apps/web/src/agent/codeAgent.test.ts`

**Interfaces:**
- Consumes: Task 2 的公共 Pi model、现有 `createGraphApi`、JSON proposal 及 Graphify API。
- Produces: `createTodoAgent({ model, proxyBaseUrl, getProfileId, getData, onProposal, graphApi, now }): Agent`，其中 `getProfileId(): string` 为流式请求填充 `options.metadata.todoTreeProfileId`。`agent.state.tools` 必须包含 `read_app_data`, `propose_app_data_patch`, `query_project_graph`, `trace_project_graph`, `explain_project_node`, `read_indexed_source`。
- 任务与 Graphify 工具创建逻辑可导出为工具工厂；删除分别构造 `createTaskAgent` / `createCodeAgent` 的入口，避免保留第二个会话构造方式。

- [ ] **Step 1: 写 combined Agent 失败测试。** 验证同一工具列表中恰好存在上述六个工具；JSON 读取与提案行为保持原有校验；Graphify 工具使用受限 HTTP API 且没有 JSON 数据访问；只读代码工具不能产生 proposal。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/web test -- src/agent/todoAgent.test.ts`；预期 combined Agent 工厂不存在。
- [ ] **Step 3: 提取原有工具工厂。** 从 `taskAgent.ts` 提取 AppData 工具；从 `codeAgent.ts` 提取 Graphify 工具。保留各自测试覆盖的实际边界行为。
- [ ] **Step 4: 实现 `createTodoAgent`.** 创建单个 Pi Agent，装载两组工具和一个系统提示；提示按问题选择工具，保留过期任务日期定义、删除范围复核、代码证据路径/行号、`INFERRED` 与 `AMBIGUOUS` 标注及工具结果不可信规则。单 Agent 继续使用 `streamProxy`。
- [ ] **Step 5: 运行 Web 测试及构建。** `pnpm --filter @todotree/web test && pnpm --filter @todotree/web build`；预期通过。
- [ ] **Step 6: 更新图谱并提交。** `graphify update .` 后提交工具重构、统一 Agent 和测试。

### Task 4: 设置页模型 profile 管理和连接测试

**Files:**
- Create: `apps/web/src/agent/profileApi.ts`, `apps/web/src/components/AgentProfilesSection.tsx`, `apps/web/src/agent/profileApi.test.ts`
- Modify: `apps/web/src/components/SettingsPage.tsx`

**Interfaces:**
- Consumes: Task 2 的 profile CRUD、activation 和 connection-test API。写入 DTO 为创建 `{ name, apiBaseUrl, modelId, apiKey }`、编辑 `{ name, apiBaseUrl, modelId, apiKey?, clearApiKey? }`。
- Produces: API client 的 `getProfiles`, `saveProfile`, `activateProfile`, `deleteProfile`, `testProfile`; 设置页区块提供 profile 列表与新增/编辑表单。
- 前端 API 类型不得把返回模型密钥定义成字段；只有表单临时持有用户输入的 Key，不写 `localStorage`。

- [ ] **Step 1: 写 API client 失败测试。** 验证 `getProfiles` 和每个写入方法使用指定 HTTP verb、JSON body、按安全 DTO 解码；错误 JSON/HTTP status 转为可显示消息，测试接口返回 `ok:false` 时不误报成功。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/web test -- src/agent/profileApi.test.ts`；预期 client 模块不存在。
- [ ] **Step 3: 实现 profile API client。** 统一解析 Fastify 错误、`hasApiKey` 及活动 ID；不把密码字段写进缓存、浏览器存储或 debug 输出。
- [ ] **Step 4: 实现设置页 profile 区块。** 显示名称/API 地址/模型/Key 是否已保存；支持新增、编辑、删除、设为当前、测试连接。编辑 Key 留空表示保留服务端 Key，清除操作显式传递 `clearApiKey`。连接测试用当前表单值，不自动保存；测试失败保留输入且仍允许保存。
- [ ] **Step 5: 验证设置页。** `pnpm --filter @todotree/web test && pnpm --filter @todotree/web build`；手动检查新增、编辑（空 Key）、清除、切换、删除、API 测试成功/失败态和错误呈现。
- [ ] **Step 6: 更新图谱并提交。** `graphify update .` 后提交设置页、API client 和测试。

### Task 5: Agent 抽屉合并会话并保留模型切换

**Files:**
- Modify: `apps/web/src/components/AgentDrawer.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/src/agent/profileSwitch.ts`, `apps/web/src/agent/profileSwitch.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `createTodoAgent` 与 Task 2/4 的 profile state/API。
- Produces: 一个常驻 `Agent` ref；统一共享消息、草稿、错误、busy 与数据传输提示；`selectAgentModel(agent, model, pending): void` 与 `applyPendingAgentModel(agent, pending): void`，其中 `pending` 是 `{ current: Model<Api> | null }`，前者运行中暂存最新选择，后者由 `agent_end` 应用。
- `AgentDrawer` 不接收 `task|code` mode；Agent 始终有六项工具，缺 Graphify 时只让相应工具报告原因。

- [ ] **Step 1: 写 profile 切换失败测试。** Agent 空闲时选新 model 立即生效；Agent 运行时新 model 延后到 `agent_end` 再生效；当前运行中的全部 continuation 使用运行开始时的 profile；多个切换只应用最后选择的 model；消息数组与提案不重置。
- [ ] **Step 2: 运行测试确认失败。** `pnpm --filter @todotree/web test -- src/agent/profileSwitch.test.ts`；预期切换 helper 不存在。
- [ ] **Step 3: 实现 profile 切换状态。** 添加 `profileSwitch.ts`，基于 Pi `Agent.state.isStreaming` 和 `agent_end` 事件延迟更新 `agent.state.model`，不创建新 Agent，不清空 messages/tools/proposal。
- [ ] **Step 4: 合并 AgentDrawer。** 移除双 Agent、task/code 模式 tab、独立 drafts/errors/notices；创建单 Agent 并使用 profile state 初始化或切换 model；每次抽屉打开时刷新活动 profile，保证从设置页切换后立即生效。抽屉展示当前模型名、设置页入口、Graphify 状态和一条共享数据传输提示；保留 proposal review/apply/reject/undo 的现有流程。
- [ ] **Step 5: 运行 Web 测试和构建。** `pnpm --filter @todotree/web test && pnpm --filter @todotree/web build`；手动验收一段对话连续执行任务查询和代码问答，切换模型后消息仍保留；首次模型请求前仅显示一次合并数据提示。
- [ ] **Step 6: 更新图谱并提交。** `graphify update .` 后提交单 Agent 抽屉及切换测试。

### Task 6: 更新部署文档和完成端到端复核

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–5 已运行的本地 profile API、连接测试和统一 Agent。
- Produces: 描述设置页配置、profile 文件位置/权限、固定兼容 API 格式、连接测试费用、环境变量兼容条件、共享对话数据范围及 loopback/私人部署要求的运行说明。

- [ ] **Step 1: 更新 README。** 删除把环境变量当作常规配置流程的说明；说明首次启动兼容读取方式、配置保存到哪里、Key 明文与文件权限、OpenAI-compatible Chat Completions 地址要求及一键测试行为。
- [ ] **Step 2: 执行完整验证。** `pnpm --filter @todotree/api test && pnpm --filter @todotree/web test && pnpm build && graphify update .`；检查 diff、配置 DTO 中的 Key 过滤、profile 路由的错误脱敏和图谱状态。
- [ ] **Step 3: 浏览器端到端验收。** 在设置页创建两份配置；用测试按钮验证成功/失败；保存并切换 profile；回到抽屉确认只有一个会话，连贯查询 AppData 与 Graphify；确认写入必须审阅，拒绝不保存，确认后撤销可用。若当前没有真实模型凭据，记录实时上游调用未验证并以 fake runtime 的 API 测试覆盖协议。
- [ ] **Step 4: 更新图谱、检查状态并提交。** 再次运行 `graphify update .`，确认图谱可 query；只提交本功能文件，并记录构建输出和任何未验证的真实 Provider 行为。

## Self-review Coverage

- 设置 profile 存储、权限、损坏文件和旧环境变量兼容：Task 1。
- API 管理、key-safe 响应、profile 路由、流式请求和未持久化连接测试：Task 2。
- 单 Agent 六工具和数据/代码边界：Task 3。
- 设置页 CRUD、密码编辑与测试流程：Task 4。
- 保留会话、共享上下文提示及运行时模型切换时序：Task 5。
- 部署说明、整体验收、构建与 Graphify：Task 6。
