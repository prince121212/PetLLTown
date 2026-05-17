# 宠物小小镇后台

第一版后台包含两个进程：

- Vite React 管理台：`http://localhost:5173`
- Node 管理服务：`http://localhost:8787`

## 技术栈

- Vite + React + TypeScript
- React Router 预留路由能力
- TanStack Query 管理请求
- React Hook Form + Zod 作为后续复杂表单基础
- Node.js + Express 作为本地/服务器管理 API
- CloudBase Node SDK 读写配置
- `ffmpeg` / `ffprobe` 处理宠物透明素材

## 本地运行

```bash
npm install
npm --prefix admin install
npm run admin:dev
```

管理服务会读取仓库根目录的 `.env.local`。

## 第一版功能

- 读取线上配置和草稿配置。
- 编辑宠物列表、背景列表、首页配置。
- 保存草稿。
- 发布草稿。
- 回滚版本。
- 上传单个宠物 idle WebM，自动验收 alpha、转双通道 MP4、抽预览帧、上传云存储并生成宠物 manifest。

## 注意

素材自动化依赖本机或部署机安装 `ffmpeg` 和 `ffprobe`。
