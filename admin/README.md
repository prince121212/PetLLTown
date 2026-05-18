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

- 读取线上配置。
- 编辑宠物列表、背景列表、首页配置。
- 保存后直接写入线上启动配置 `app_configs/bootstrap`。
- 查看配置校验和操作日志。
- 上传单个宠物 idle WebM，自动验收 alpha、转双通道 MP4、抽预览帧、上传云存储并生成宠物 manifest。
- 上传背景图片或视频，由后台检查后上传云存储并自动生成背景 ID、类型和媒体地址。

后台采用简单运营模式，不保留草稿、审核上线、发布中心和回滚入口。

## 管理 API

配置接口：

- `GET /api/config/state`
- `PUT /api/config`

素材接口：

- `POST /api/media/pets/inspect`
- `POST /api/media/pets/transcode`
- `POST /api/media/pets/upload`
- `POST /api/media/pets/create-from-webm`

## 注意

素材自动化依赖本机或部署机安装 `ffmpeg` 和 `ffprobe`。
`npm run seed:cloudbase -- --apply` 默认不会覆盖已经存在的 `app_configs/bootstrap`；只有明确传入 `--overwrite-bootstrap` 时才会替换线上启动配置。
