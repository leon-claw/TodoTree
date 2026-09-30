# TodoTree

一个支持递归拆分的本地 Todo Web 应用，提供列表视图、树形图视图、标签管理，以及 JSON 导入和导出。任务数据保存在当前浏览器的本地存储中。可选 Pi Agent 提供任务 JSON 管理和只读项目代码问答。

## 要求

- Node.js 22.19 或更高版本
- pnpm

## 本机开发

```sh
pnpm install
pnpm dev
```

前端由 Vite 提供；Fastify API 默认监听 `127.0.0.1:3001`。没有模型配置时，TodoTree 的本地任务功能仍可用，Agent 抽屉会显示模型未配置。

要启用 Pi Agent，在启动前设置服务端模型和密钥。例如：

```sh
export TODOTREE_AGENT_PROVIDER=openai
export TODOTREE_AGENT_MODEL=gpt-4o
export OPENAI_API_KEY=your-server-side-key
pnpm dev
```

支持 Pi AI 已知的供应商模型。模型密钥只由 Node API 读取，不放进浏览器构建产物。任务数据模式会在请求时把当前 AppData 发给配置的模型服务；项目代码模式会把 Graphify 结果和按需读取的源码摘录发给同一模型服务。两种模式使用独立对话。

## 项目代码问答

项目代码模式需要 TodoTree 的完整 Git 检出、可用的 Graphify CLI 和 `graphify-out/graph.json`。在项目根目录运行：

```sh
graphify update .
pnpm dev
```

服务端只调用 Graphify 的 `query`、`path`、`explain` 命令。源码摘录仅限图谱已索引、Git 已跟踪的 `apps/`、`docs/` 文件，以及 `README.md`、`DESIGN.md`、`package.json`、`pnpm-workspace.yaml` 和根目录 `tsconfig*.json`。它不提供 Shell 或 `graphify update` 工具。

请确保运行 API 的进程能在 `PATH` 中找到 `graphify`。若 CLI 不在 `PATH`，可设置服务端变量 `TODOTREE_GRAPHIFY_BIN` 为 Graphify 可执行文件的绝对路径。修改项目源码后，运行 `graphify update .` 以刷新代码索引。

## 构建与本机预览

```sh
pnpm build
pnpm preview
```

`pnpm preview` 由 Fastify 同时提供 Web 构建产物和 API。API 默认只监听本机回环地址；私有远程部署应由外层认证保护，不要直接把未认证 API 暴露到公网。可用 `TODOTREE_HOST` 与 `TODOTREE_PORT` 配置监听地址和端口。
