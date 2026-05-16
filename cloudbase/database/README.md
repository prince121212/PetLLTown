# CloudBase Database

第一阶段只需要让 `bootstrap` 云函数可用。云函数会优先读取云数据库里的 `app_configs/bootstrap`，读取不到时自动使用随函数部署的默认配置。

建议初始化记录：

```json
{
  "_id": "bootstrap",
  "enabled": true,
  "config": {}
}
```

`config` 字段可以覆盖 `cloudbase/configs/bootstrap.default.json` 的同名字段。先保持空对象也可以，方便在云端验证函数和前端调用链。

## pets

`getPetManifest` 会优先读取 `pets/{petId}`。第一版可先创建：

```json
{
  "_id": "xiaotuanzi",
  "enabled": true,
  "manifest": {}
}
```

`manifest` 为空时仍会使用云函数内置 manifest；需要热更新宠物动作和素材地址时，把完整 manifest 写入这里。

## 初始化脚本

推荐使用脚本初始化集合和文档，避免在控制台手动复制大段 JSON：

```bash
npm run seed:cloudbase
npm run seed:cloudbase -- --apply
```

脚本会创建或更新：

- `app_configs/bootstrap`
- `pets/xiaotuanzi`
- `voice_logs`

## voice_logs

`voiceTranscribe` 会写入每次语音识别调用的状态、文件大小、音频时长、ASR RequestId、错误码、耗时和创建时间。默认不保存原始录音文件，云函数会在识别后删除临时上传文件。
