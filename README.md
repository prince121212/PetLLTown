# 宠物小小镇

微信小程序项目。核心体验是让用户手机里住着一只会听用户说话、能切换房间和宠物的小宠物。

## 当前状态

- 首页背景支持房间切换。
- 当前房间：
  - `土星奇旅`：本地静态背景 `/pages/index/wallpaper.jpg`
  - `初夏之风`：云端 H.264 MP4 视频背景
- 首页主体宠物使用透明双通道 H.264 MP4。
- 透明宠物视频由 `wx.createVideoDecoder()` 解码，WebGL shader 左半读取 RGB、右半读取 alpha mask。
- 首页舞台常驻。进入设置页、宠物选择页、房间选择页时只暂停绘制循环，不销毁 canvas/WebGL，返回首页时恢复渲染。
- 已接入长按语音按钮、ASR 云函数、AI 回复云函数的基础链路。

## 项目结构

```text
PetLLTown/
  miniprogram/              # 微信小程序前端
  cloudfunctions/           # CloudBase 云函数
  cloudbase/
    configs/                # 默认启动配置和宠物 manifest
    database/               # 数据库说明
  scripts/                  # 上传、同步、部署、检查脚本
  docs/                     # 云函数与资源说明
  ALPHA_VIDEO_MIGRATION.md  # 透明视频方案说明
  视频处理流程.md            # 透明视频处理步骤
  素材交付规范.md            # 后续宠物透明素材规格
  提示词.md                  # 生成宠物基础视频的提示词模板
```

## 关键配置

默认启动配置：

```text
cloudbase/configs/bootstrap.default.json
cloudfunctions/bootstrap/bootstrap.default.json
miniprogram/config/bootstrap.ts
```

同步本地配置到云函数内置配置：

```bash
npm run sync:bootstrap
```

写入 CloudBase 数据库：

```bash
npm run seed:cloudbase -- --apply
```

CloudBase 信息：

```text
环境 ID：cloud1-d0gz0y40r67b3198e
存储桶：636c-cloud1-d0gz0y40r67b3198e-1396635429
区域：ap-shanghai
```

本地凭证在 `.env.local`，不要提交。

## 常用命令

```bash
npm run typecheck
npm run sync:bootstrap
npm run sync:manifests
npm run upload:alpha-video
npm run upload:media
npm run seed:cloudbase
npm run seed:cloudbase -- --apply
npm run check:cloudbase
npm run deploy:voice
npm run deploy:asr-realtime
npm run deploy:ai
```

注意：`npm run check:cloudbase` 在当前环境可能会遇到 CloudBase SDK 云函数调用参数错误；需要时可以直接读取 `app_configs/bootstrap` 验证配置是否写入。

## 素材规范

第一阶段先准备 1 只宠物的 3 条基础透明视频：

```text
idle：5 秒，待机循环
listening：4 秒，用户录音/倾听中循环
reply：4 秒，宠物回应，播完回 idle
```

统一源素材规格：

```text
格式：VP9 WebM
透明：真实 alpha
尺寸：720x960
帧率：24fps
音频：无
背景：透明
主体：完整入镜，位置、大小、脚底高度一致
```

小程序运行时不直接播放 alpha WebM，而是转成左右双通道 MP4：

```text
格式：MP4 / H.264 / yuv420p
尺寸：1440x960
左半：720x960 RGB
右半：720x960 alpha mask
```

详细流程见：

```text
素材交付规范.md
视频处理流程.md
提示词.md
```

## 云函数

当前主要云函数：

```text
bootstrap         # 启动配置
getPetManifest    # 宠物 manifest
voiceTranscribe   # 腾讯云 ASR 语音识别
asrRealtimeSign   # 实时 ASR 签名
aiRespond         # AI 回复
```

数据库集合：

```text
app_configs
pets
voice_logs
ai_logs
```

## 开发习惯

- commit message 默认使用中文。
- 素材接入前先按 `素材交付规范.md` 验收。
- 主宠物透明视频运行时统一走双通道 H.264 MP4。
- 不恢复 PNG 帧序列兜底，除非明确需要。
- 不提交 `.env.local`、SecretId、SecretKey 或登录凭证。

## 近期建议

1. 接入 `listening`、`reply` 两条动作视频，形成 idle -> listening -> reply -> idle 的最小交互闭环。
