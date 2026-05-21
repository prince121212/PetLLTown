# AI Respond

`aiRespond` 负责把 ASR 文本变成小团子的短回复和动作建议。当前使用 CloudBase Node SDK AI 能力，模型配置为：

- provider: `hunyuan-v3`
- model: `hy3-preview`

参考文档：

```text
https://docs.cloudbase.net/api-reference/server/node-sdk/ai
```

## 云函数

`cloudfunctions/aiRespond` 接收：

```json
{
  "text": "你好小团子，今天一起玩吧",
  "petId": "xiaotuanzi"
}
```

返回成功：

```json
{
  "ok": true,
  "data": {
    "reply": "好呀，我超想和你玩~",
    "emotion": "happy",
    "nextAction": "happy",
    "source": "ai"
  },
  "meta": {
    "model": "hy3-preview",
    "provider": "hunyuan-v3"
  }
}
```

如果 CloudBase AI 暂时不可用，云函数会返回 `source: "fallback"` 的规则兜底回复，并在 `meta.error` 和 `ai_logs` 中记录错误，不影响前端交互。

记忆写入是独立于回复生成的第二步：云函数会先生成宠物回复，再单独调用一次 AI 进行记忆抽取。这样像“我最喜欢打篮球”这类稳定偏好更容易被保存到 `user_memories`，而普通闲聊通常不会进入记忆。

## 部署

确保集合存在：

```bash
npm run seed:cloudbase -- --apply
```

部署云函数：

```bash
npm run deploy:ai
```

检查云函数：

```bash
npm run check:cloudbase
```

`check:cloudbase` 应显示：

```json
"aiRespond": {
  "ok": true,
  "ready": true,
  "provider": "hunyuan-v3",
  "model": "hy3-preview"
}
```

## 数据

`ai_logs` 记录 `_openid`、`petId`、`provider`、`model`、状态、回复长度、动作建议、token usage、记忆来源、错误码和耗时。
