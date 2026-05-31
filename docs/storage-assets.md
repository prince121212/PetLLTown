# Storage Assets

当前 demo 帧已经上传到云存储：

```text
cloud://pet-dev-d6gpc4gw88ca1aa43.7065-pet-dev-d6gpc4gw88ca1aa43-1438790868/pets/xiaotuanzi/actions/idle/frames/frame_0001.png
```

对应目录：

```text
pets/xiaotuanzi/actions/idle/frames/
```

## 上传命令

先 dry-run：

```bash
npm run upload:frames
```

确认后上传：

```bash
npm run upload:frames -- --apply
```

脚本会读取 `.env.local`，并通过 CloudBase 环境信息自动确认真实存储区域。当前环境实际区域是 `ap-shanghai`。

## 访问方式

云存储默认域名如果没有公开读权限，直接 `https://.../frame_0001.png` 可能返回 403。这不是上传失败。

小程序内优先使用 `cloud://...` fileID 前缀，`image` 组件可以直接加载云存储文件。后续如果要走 HTTPS/CDN，需要在云开发控制台调整存储读权限或配置合法下载域名。
