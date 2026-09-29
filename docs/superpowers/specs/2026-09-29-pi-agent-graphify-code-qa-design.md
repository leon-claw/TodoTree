# TodoTree Pi Agent 的 Graphify 代码问答：设计规格

日期：2026-09-29
状态：待书面审阅

## 目标与范围

需求方确认在本轮 Pi Agent 交付中加入代码问答：用户可在 TodoTree 的同一个右侧抽屉询问应用自身的架构、模块关系和具体代码位置。回答优先依据项目已有的 `graphify-out/graph.json` 及 Graphify 的 `query`、`path`、`explain` 查询；需要核对准确行为时，才读取图谱所指向的少量源码行。此能力只读，不修改代码、Graphify 图或任务 JSON。任务 JSON 管理仍按[主规格](2026-09-29-pi-agent-json-management-design.md)实现；Cloudflare R2 同步仍不在本轮。

## 同一抽屉中的两个上下文

Agent 抽屉顶部提供“任务数据 / 项目代码”切换。任务数据模式运行主规格中的 Pi 会话与 JSON 工具；项目代码模式运行独立 Pi 会话，只能调用本规格的只读 Graphify 与源码摘录工具。切换后保留各自当前标签页内的对话，但不把一方的历史消息发送到另一方的模型上下文，避免代码问题无意带上用户任务数据。项目代码模式不显示“应用变更”按钮，并明确标示“只读”。

首次在项目代码模式向模型发送内容前，界面说明相关图谱结果和源码摘录会经模型代理发送给所配置的模型服务。回答必须给出图谱返回的文件路径及行号；图中标为 `INFERRED` 或 `AMBIGUOUS` 的关系要明示为推断或不确定。图谱查不到或源码无法核对时，Agent 说明证据不足，不把猜测写成项目事实。

## 工具接口与后端

浏览器中的 Pi Agent Core 在项目代码模式仅装载以下工具，工具通过现有 Fastify 后端调用受限接口：

- `query_project_graph(question)`：后端运行 `graphify query <question> --budget 2000`，返回有来源位置的局部子图。
- `trace_project_graph(from, to)`：后端运行 `graphify path <from> <to> --undirected`，返回关系路径；找不到时明确说明。
- `explain_project_node(node)`：后端运行 `graphify explain <node>`，返回节点、邻接关系和来源。
- `read_indexed_source(sourceFile, startLine)`：只读取图谱 `source_file` 中出现、属于 `apps/`、`docs/` 或预先列明的根目录文档与配置文件的已跟踪文本文件，从指定行起最多 80 行，用于核对图谱结论；返回实际文件路径与行号。根目录允许清单只含 `README.md`、`DESIGN.md`、`package.json`、`pnpm-workspace.yaml` 和 `tsconfig*.json`。

Fastify 用固定的 `graphify` 可执行文件和参数数组启动查询，工作目录固定为项目根目录，不经过 Shell；设置运行超时、输出大小和输入长度上限。源码读取在解析真实路径后检查项目根目录和允许范围，拒绝符号链接越界、隐藏配置、密钥文件及任意路径。Pi 不能指定额外命令或读取图谱之外的文件。Graphify CLI 是查询引擎；Node.js/Fastify 仍是应用后端框架，不在 Node 中重写 Graphify 的检索算法。

本轮支持主规格确定的本机或私人部署，并要求部署包含项目源码、`graphify-out/graph.json` 和可运行的 Graphify CLI。Graphify 缺失、图文件缺失或查询失败时，仅项目代码模式显示不可用及原因，任务数据模式继续工作。后端不在用户提问时自动重建图谱，也不向 Agent 暴露 `graphify update`。

## 图谱新鲜度与证据

按照项目 `AGENTS.md`，每次修改代码后运行 `graphify update .`；构建或交付前再次检查图谱可查询。界面显示图谱记录的 `built_at_commit`，让用户知道回答基于哪个代码版本。Graphify 是导航索引：架构关系先查图；具体函数行为以图中来源定位后的源码摘录为准。源码中可能含有指令样式的文本，Pi 必须把工具结果作为待分析数据，不把它当成新的系统指令。

## 验收

1. 用户问“任务 JSON 从哪里保存”，Agent 能通过图谱找到 `AppData`、`App.tsx` 和 `storage.ts`，按来源解释关系并给出可定位的文件行号。
2. 用户问两个模块如何相连，Agent 使用路径查询；无路径时如实说明，不虚构关系。
3. 用户问具体函数行为时，Agent 可读取图谱定位的短源码摘录，并区分源码事实与图谱的推断关系。
4. 代码模式无法调用任务 JSON 读写工具；切回任务模式不会携带代码会话历史。代码问答、失败或取消不改变 `AppData`、项目文件或图谱。
5. 图谱或 Graphify CLI 缺失、结果为空、来源文件不在允许范围、查询超时均有明确错误；任务数据模式仍可用。

## 依据

- 项目 Graphify 规则：`AGENTS.md` 与 `.codex/skills/graphify/SKILL.md`。
- 现有图谱：`graphify-out/graph.json`，含代码节点、关系、`source_file`、`source_location` 与 `built_at_commit`。
- Pi 的工具与会话接口：[官方 Agent 文档](https://raw.githubusercontent.com/earendil-works/pi/main/packages/agent/README.md)。
