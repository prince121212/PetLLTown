# Pet Manifest

`getPetManifest` 返回单个宠物包的动作、帧序列、音效和性格配置。第一版先用 `xiaotuanzi` 默认 manifest 跑通链路，后续上传资源后只需要替换 `assets.baseUrl` 和动作帧范围。

## 数据来源

- 默认配置：`cloudbase/configs/pets/*.manifest.json`
- 云函数内置配置：`cloudfunctions/getPetManifest/manifests/*.manifest.json`
- 同步命令：`npm run sync:manifests`
- 云端覆盖集合：`pets`

建议云数据库文档：

```json
{
  "_id": "xiaotuanzi",
  "enabled": true,
  "manifest": {}
}
```

`manifest` 可以直接放完整 manifest。云端没有配置时，云函数会使用内置 manifest。

## 动作约定

- `loop`：循环动作，例如待机、睡觉、倾听。
- `transition`：一次性转场动作，例如开心回应、醒来。
- `connectAt`：允许切换动作的衔接点。
- `framePattern`：当前使用 `frame_{index:0000}.png`，后续 WebP 或新云存储路径只改 manifest。
- `assets.baseUrl`：小程序内优先使用 `cloud://.../` fileID 前缀，避免 HTTPS 默认域名权限导致 403。

前端当前先使用 manifest 驱动首页主动画；选择页的多宠物预览仍复用当前素材，等多个宠物包资源齐备后再切换为每个宠物自己的 preview manifest。
