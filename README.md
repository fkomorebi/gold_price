# Gold Price Widget

这是一个桌面小工具，用于显示实时金价。

## 功能特点

- 小巧的窗口尺寸，固定在屏幕右上角
- 透明背景，始终置顶显示
- 支持窗口拖拽移动
- 每30秒自动更新金价数据
- 显示数据更新时间戳
- 右键菜单提供退出功能

## 安装依赖

```bash
pnpm install
```

## 开发运行

```bash
# 构建并运行应用
pnpm start

# 或者使用开发模式
pnpm dev
```

## 打包应用

### 打包为目录格式（用于测试）

```bash
pnpm pack
```

### 打包为 Windows 平台安装包

```bash
pnpm dist
```

### 打包为所有平台（Windows、macOS、Linux）

```bash
pnpm dist:all
```

### 分别打包各平台

- Windows: `pnpm dist`
- macOS: `pnpm dist:mac`
- Linux: `pnpm dist:linux`
  
## 配置说明

- 打包配置位于 `electron-builder.config.js` 文件中
- 构建后的文件将保存在 `dist` 目录中
- （不再使用 esbuild 打包主进程）

## 项目结构

- [main.js](file:///c:/Users/fkomo/Documents/projects/projects/gold_price/main.js) - 主进程代码
- [renderer.js](file:///c:/Users/fkomo/Documents/projects/projects/gold_price/renderer.js) - 渲染进程代码
- [index.html](file:///c:/Users/fkomo/Documents/projects/projects/gold_price/index.html) - 应用界面
- [package.json](file:///c:/Users/fkomo/Documents/projects/projects/gold_price/package.json) - 项目配置和构建脚本
- [electron-builder.config.js](file:///c:/Users/fkomo/Document/projects/projects/gold_price/electron-builder.config.js) - 打包配置

## 技术栈

- Electron: 桌面应用框架
- electron-builder: 应用打包和分发工具
- axios: HTTP 请求客户端