# 宠物小小镇后台

后台分两个进程：

- Vite React 管理台：`http://localhost:5173`
- Node 管理服务：`http://localhost:8787`

## 技术栈

- Vite + React + TypeScript
- React Router 路由
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

## 草稿、发布与回滚

第一版后台采用「草稿 / 发布 / 版本回滚」三段式：

- 编辑宠物、背景、首页配置时，所有改动写入草稿（`admin_config_drafts/bootstrap`），不会立即影响线上。
- 在「发布中心」可以查看草稿和线上的字段差异、校验问题，确认后发布到 `app_configs/bootstrap`。
- 每次发布同时写入版本记录（`admin_config_versions/{version}`），可在发布中心选择历史版本一键回滚。
- 回滚会创建一条新版本指向旧配置，原始版本保留可追溯。
- 「丢弃草稿」可以撤销当前未发布的所有改动。

侧边导航在草稿存在差异时会显示「未发布」徽标，方便快速定位。

## 第一版功能

- 读取线上配置 + 草稿，统一在管理台编辑。
- 编辑宠物列表、背景列表、首页配置（写草稿）。
- 启用 / 隐藏 / 删除宠物或背景；自动保护默认项。
- 发布中心：差异对比、字段校验、发布、丢弃草稿、历史版本回滚。
- 操作日志（`admin_audit_logs`）。
- 上传单个宠物 idle WebM，自动验收 alpha、转双通道 MP4、抽预览帧、上传云存储、生成 manifest，再写入草稿。
- 上传背景图片或视频，由后台检查后上传云存储并写入草稿。

## 管理 API

配置接口：

- `GET /api/state`：返回 published、draft、版本、操作日志
- `PUT /api/draft`：保存草稿
- `DELETE /api/draft`：丢弃草稿
- `POST /api/publish`：发布草稿到线上 + 写版本记录
- `POST /api/rollback`：回滚到指定版本

素材接口：

- `POST /api/media/pets/inspect`
- `POST /api/media/pets/transcode`
- `POST /api/media/pets/upload`
- `POST /api/media/pets/create-from-webm`：处理后写入草稿
- `POST /api/media/rooms/create-from-media`：处理后写入草稿

## 数据集合

- `app_configs/bootstrap`：线上启动配置（前台 `bootstrap` 云函数读取这里）
- `admin_config_drafts/bootstrap`：草稿
- `admin_config_versions/{versionId}`：发布版本
- `admin_audit_logs`：操作日志
- `pets/{petId}`：宠物 manifest（素材自动化写入）

## 注意

- 素材自动化依赖本机或部署机安装 `ffmpeg` 和 `ffprobe`。
- `npm run seed:cloudbase -- --apply` 默认不会覆盖已经存在的 `app_configs/bootstrap`；只有明确传入 `--overwrite-bootstrap` 时才会替换线上启动配置。
- 本地 `admin/server` 当前没有鉴权，仅本机使用。线上若要部署到 CloudBase，请改走 `cloudfunctions/adminConfig` 云函数并配置 `ADMIN_OPENIDS` 白名单。
