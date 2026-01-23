# gold_price

轻量的 Electron 桌面小工具，用于显示实时金价（gold_price）。

**主要信息**
- 入口文件：`main.js`
- 描述：桌面窗口实时展示金价数据，使用 `axios` 获取网络数据。

**先决条件**
- 已安装 Node.js
- 推荐使用 pnpm（项目中使用了 `pnpm`，且仓库包含 `pnpm-lock.yaml`）

**安装依赖**
```bash
pnpm install
```

**本地运行（开发）**
- 运行应用：
```bash
pnpm start
```
- 开发模式（若需要）：
```bash
pnpm run dev
```

**图标生成**
项目包含一个脚本用于生成应用图标：
```bash
pnpm run make-icons
```
脚本文件：`scripts/make-icons.js`，生成的图标位置位于 `build/icons/`。

**打包与发布**
- 仅打包到目录（不生成安装包）：
```bash
pnpm run pack
```
- 生成发行构建（安装包）：
```bash
pnpm run dist
```

**项目结构（简要）**
- `main.js` — Electron 主进程入口
- `renderer.js` / `index.html` — 渲染进程
- `assets/` — 静态资源
- `build/icons/` — 生成/存放图标
- `scripts/make-icons.js` — 图标生成脚本

**其他说明**
- 安装后 `postinstall` 脚本会运行 `electron-builder install-app-deps`，若遇到依赖问题请先确保本地环境满足 native 模块构建要求。
