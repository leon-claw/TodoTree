# Tree Todo

一个支持递归拆分的本地 Todo Web 应用，提供列表视图、树形图视图、标签管理，以及 JSON 导入和导出。数据保存在当前浏览器的本地存储中，不需要服务器或账号；设备间迁移通过 JSON 文件手动完成。

## 开发

需要 Node.js 20.19+（或 22.12+）和 pnpm。

```sh
pnpm install
pnpm dev
```

## 构建

```sh
pnpm build
pnpm preview
```

Web 应用位于 `apps/web`。当前 workspace 只包含这个实际存在的应用。
