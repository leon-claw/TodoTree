# TodoTree

一个支持递归拆分的本地 Todo Web 应用，提供列表视图、树形图视图、标签管理，以及 JSON 导入和导出。任务数据保存在当前浏览器的本地存储中。Pi Agent 可在同一段对话中管理任务 JSON，并只读查询项目代码。

## 要求

- Node.js 22.19 或更高版本
- pnpm

## 本机开发

```sh
pnpm install
pnpm dev
```

前端由 Vite 提供；Node/Fastify API 默认监听 `127.0.0.1:3001`。没有模型配置时，TodoTree 的任务管理仍可用。

## 配置 Pi Agent

打开应用的“设置”页面，在“Agent 模型”中添加一份或多份配置，填写名称、API 地址、模型 ID 和 Key。保存后可以测试连接，或设为当前模型；编辑配置时 Key 留空会保留原 Key。Agent 抽屉也可以直接切换当前模型。

API 地址由用户选择并负责。保存时应用不验证地址的格式、协议、可信度或可用性；你可以主动点击“测试连接”。当前 Pi 运行时发送 OpenAI Chat Completions 兼容请求，因此上游服务需要接受这种请求格式。连接测试发送固定短提示，最多生成 8 个 token，30 秒超时，不会发送任务数据、Graphify 结果或源码；测试可能产生少量模型用量费用，测试失败不会阻止保存。

模型配置由本机 Node 后端保存，不进入浏览器存储。默认文件是 `~/.todotree/agent-profiles.json`；保存时目录权限设为 `0700`，配置文件权限设为 `0600`。Key 以明文保存在该文件中，请保护运行 TodoTree 的系统账户。可用 `TODOTREE_CONFIG_DIR` 指定配置目录。

如需兼容旧环境变量，只有在配置文件尚不存在时会读取 `TODOTREE_AGENT_PROVIDER`、`TODOTREE_AGENT_MODEL` 和相应供应商的 Key 环境变量（例如 `OPENAI_API_KEY`）。保存一份模型配置后，服务端只使用配置文件中的模型列表和当前选择，不再回退到环境变量。

首次发送 Agent 请求前，抽屉会说明数据去向。模型服务会收到对话历史和工具返回内容；任务查询可能将读取到的 AppData JSON 加入上下文，项目问答可能加入 Graphify 结果和按需读取的源码片段。任务写入先形成待审阅提案，只有用户在应用内确认后才会保存；项目代码能力只读。对话保留在当前页面的内存中，不写入任务 JSON 或模型配置文件。

## 项目代码问答

代码问答需要 TodoTree 的完整 Git 检出、可用的 Graphify CLI 和 `graphify-out/graph.json`。在项目根目录运行：

```sh
graphify update .
pnpm dev
```

服务端只调用 Graphify 的 `query`、`path`、`explain` 命令。源码摘录仅限图谱已索引、Git 已跟踪的 `apps/`、`docs/` 文件，以及 `README.md`、`DESIGN.md`、`package.json`、`pnpm-workspace.yaml` 和根目录 `tsconfig*.json`。Agent 不提供 Shell 或 `graphify update` 工具。请确保运行 API 的进程能在 `PATH` 中找到 `graphify`；也可设置 `TODOTREE_GRAPHIFY_BIN` 为 Graphify 可执行文件的绝对路径。修改项目源码后，运行 `graphify update .` 刷新代码索引。

## 构建与本机预览

```sh
pnpm build
pnpm preview
```

`pnpm preview` 由 Fastify 同时提供 Web 构建产物和 API。API 默认只监听本机回环地址。若配置 `TODOTREE_HOST` 供其他设备访问，应在可信网络中运行并由外层认证保护，不要将未认证 API 直接暴露到公网。可用 `TODOTREE_PORT` 配置端口。
