# Voice Transcribe

第二阶段先做真实 ASR 闭环：用户长按首页底部光球录音，松手上传临时语音文件，`voiceTranscribe` 云函数调用腾讯云一句话识别。

## 云函数

`cloudfunctions/voiceTranscribe` 接收：

```json
{
  "fileID": "cloud://...",
  "duration": 1200,
  "format": "mp3"
}
```

返回成功：

```json
{
  "ok": true,
  "data": {
    "text": "你好小团子",
    "duration": 1200,
    "fileSize": 12345,
    "requestId": "..."
  }
}
```

返回失败：

```json
{
  "ok": false,
  "error": {
    "code": "ASR_CONFIG_MISSING",
    "message": "ASR credentials are not configured",
    "requestId": ""
  }
}
```

## 配置

云函数环境变量需要使用非保留前缀：

- `ASR_SECRET_ID`
- `ASR_SECRET_KEY`
- `ASR_REGION`，默认可用 `ap-shanghai`

可用脚本从 `.env.local` 写入云端函数配置：

```bash
npm run set:voice-env
```

`.env.local` 仍可使用 `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY`，脚本会映射成云函数允许的 `ASR_*` 变量。

更新云函数代码和环境变量：

```bash
npm run deploy:voice
```

检查命令：

```bash
npm run check:cloudbase
```

首次部署后在微信开发者工具中右键 `cloudfunctions/voiceTranscribe`，选择“创建并部署：云端安装依赖（不上传 node_modules）”。如果 check 显示 `FUNCTION_NOT_FOUND`，说明云函数还没部署到当前环境。

## 数据

`voice_logs` 记录调用日志和错误，不长期保存原始录音文件。云函数识别完成后会删除前端上传的临时录音。

## 常见错误

- `ASR_SERVICE_UNOPENED`：腾讯云一句话识别还没开通或未生效，需要在腾讯云控制台开通 ASR 后再测。
- `ASR_AUDIO_EMPTY`：云函数已触发，腾讯云 ASR 收到了文件，但文件里没有有效语音。微信开发者工具模拟器容易录出空音频，优先用真机调试测试；如果仍出现，检查系统麦克风权限和当前输入设备。

开发者工具控制台里出现“录音文件格式说明 / 无法直接播放或者在客户端播放”属于工具提示，不等同于云函数失败。判断是否触发 ASR 以 `voice_logs` 为准。
