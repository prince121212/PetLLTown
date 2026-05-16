# 宠物小小镇项目交接记录

本文档给下一轮 AI 或开发者接手使用。目标是避免重新讨论已经达成的共识，直接从开发继续推进。

## 项目定位

- 项目名称：宠物小小镇。
- 默认宠物名：小团子。
- 小程序简介方向：手机里住着一只会听你说话的 AI 小宠物。
- 核心体验：不像“播放宠物动画的小程序”，而像用户手机里住进了一只小生命。
- 第一版形式：微信小程序，不做微信小游戏。
- Web/HTML Demo 只作为视觉和素材验证，不是正式主项目。

## 当前仓库

- 正式仓库：`/Users/huangchangwei/Desktop/gitSpaceC/PetLLTown`
- 原型仓库：`/Users/huangchangwei/Desktop/gitSpaceC/Toy/pet-toy`
- 正式仓库已初始化 Git，当前分支：`main`。
- 后续前端和后端都放在 `PetLLTown` 一个仓库里。

推荐结构：

```text
PetLLTown/
  miniprogram/              # 小程序前端
  cloudfunctions/           # CloudBase 云函数后端
  cloudbase/
    database/               # 数据库初始化、集合规则、索引说明
    configs/                # 默认配置 JSON
  scripts/                  # 部署、上传素材、初始化数据脚本
  docs/                     # 产品和技术文档
  .env.local                # 本地凭证，不提交
```

## 当前前端状态

`miniprogram/` 已经从微信模板清理成宠物小小镇的前端壳。

当前页面：

- 首页：黑色沉浸背景，展示宠物透明序列帧循环，底部是类似 Siri 的监听视觉。
- 设置页：简洁设置入口，小广告位置可以保留。
- 更换宠物页：全屏黑色背景，左右滑选择宠物。

当前实现特点：

- `app.json` 只有 `pages/index/index`。
- 使用自定义导航。
- 首页主舞台改为播放云端 MP4，避免小程序高频切远程 PNG 帧导致黑屏/闪烁。
- 底部语音光球播放 `siri.webm` 转码后的云端 MP4。
- 前端已接入 `bootstrap` 云函数，并保留本地 fallback。
- 前端已接入 `getPetManifest`，首页主动画由宠物 manifest 驱动。
- 当前 demo 帧资源已上传到 CloudBase 云存储，配置使用 `cloud://` fileID 前缀。
- 本地开发为了临时资源，`project.private.config.json` 里关闭了 `urlCheck`。上线前必须改回合法域名或使用云存储 fileID。

当前资源前缀：

```text
cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/frames/
```

当前首页视频资源：

```text
cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/pets/xiaotuanzi/actions/idle/videos/xiaotuanzi-idle.webm
cloud://cloud1-d0gz0y40r67b3198e.636c-cloud1-d0gz0y40r67b3198e-1396635429/ui/listen-orb/listen-orb.mp4
```

## 后端技术方案

统一使用腾讯云方案：

- CloudBase / 微信云开发：云函数、云数据库、云存储。
- COS/CDN：存放宠物素材包，包括 PNG/WebP 序列帧、音效、manifest。
- 腾讯云 ASR 一句话识别：语音转文字。
- 腾讯混元 / DeepSeek 类模型：基础 AI 反馈、意图判断、回复生成。
- 微信支付：年会员和宠物包购买。

不自建服务器，第一版不使用 CVM。

## 后端设计原则

为了减少小程序审核次数：

- 前端只做稳定壳、播放器、录音、页面渲染、支付调用、云函数调用。
- 文案、页面配置、宠物列表、素材地址、价格、广告、AI 策略都由后端返回。
- 后端可以返回 JSON 页面配置，但不能返回远程 JS，也不能让小程序执行远程代码。
- 新功能想不重新审核，前提是前端已经内置了对应的通用组件和动作能力。
- 所有资源域名、fileID、版本号都从 `bootstrap` 获取，前端不要硬编码生产资源地址。

## 第一批云函数

建议按这个顺序开发：

1. `bootstrap`
   - 返回应用名称、首页配置、设置页配置、宠物列表、素材基础地址、会员配置、广告配置。
2. `getPetManifest`
   - 返回某个宠物的动作、帧序列、音效、默认状态。
3. `voiceTranscribe`
   - 接收录音文件，调用腾讯云 ASR 一句话识别。
4. `aiRespond`
   - 根据用户文本、宠物设定、近期记忆生成反馈和下一动作建议。
5. `memoryRecent`
   - 读取用户近期记忆。
6. `memoryWrite`
   - 写入用户记忆。
7. `checkEntitlement`
   - 判断会员、宠物包、永久记忆权限。
8. `createOrder`
   - 创建微信支付订单。
9. `paymentNotify`
   - 支付回调，更新用户权益。

## 数据集合建议

建议建立：

- `app_configs`：启动配置、页面配置、价格、广告。
- `pets`：宠物包列表、manifest 地址、上架状态。
- `users`：用户基础信息、会员状态。
- `memories`：用户与宠物的记忆。
- `voice_logs`：语音识别调用日志，用于控量和排查。
- `ai_logs`：AI 调用日志，用于控量和优化。
- `orders`：会员和宠物包订单。

## 素材方案

不考虑 spritesheet。

统一使用透明 PNG/WebP 序列帧：

- 每个宠物包必须使用同一套动作 ID。
- 猫、狗、鸟、卡通 IP 都必须遵守同一规格。
- 只要规格一致，就可以整套替换。
- 素材放云端，不放小程序包里。
- 小程序包只放兜底图或极少量启动素材。

动作类型只保留两类：

- `loop`：循环动作，例如待机、睡觉、呼吸、听用户说话。
- `transition`：转场动作，例如从睡觉到醒来、从待机到互动。

动作衔接原则：

- 每段动作的首尾帧必须能衔接。
- 宠物位置、大小、锚点、朝向不能突然变化。
- 每个动作导出时必须使用统一画布尺寸、统一主体锚点、统一安全区域。
- 用户触摸或说话后，不一定立刻切动作。当前动作先播到可衔接点，再切到下一段。

## AI 使用共识

AI 要用，但不是每一帧都用。

适合 AI 的地方：

- 理解用户说了什么。
- 判断用户情绪和意图。
- 生成短反馈。
- 选择下一段动作。
- 维护长期记忆。
- 决定宠物性格化表达。

不适合 AI 的地方：

- 高频动画播放。
- 每帧决策。
- 简单触摸反馈。
- 固定 UI 逻辑。

播放机制：

- 前端有本地状态机。
- AI 可以在当前几秒动作播放期间完成决策。
- 动作切换等待当前动作到达可衔接点。
- 简单事件可以本地先给反馈，AI 返回后再调整下一动作。

语音处理：

- 线上语音识别走腾讯云 ASR。
- 不直接把腾讯云密钥放前端。
- 前端录音上传给云函数，云函数调用 ASR。
- 基础语音识别和基础 AI 反馈对用户免费。
- 需要做调用频控、每日次数限制、日志和成本统计。

## 商业化共识

- 不做月会员，只做年会员。
- 首年可以低价，续费恢复正常价格。
- 免费版保留短期记忆，建议 7 天。
- 年会员提供永久记忆。
- 新宠物包付费购买，宠物包包含形象、动作、声音、性格、回复风格，不拆开卖声音包。
- 基础 AI 反馈免费。
- 语音识别不单独收费。
- 设置页可以放一个小面积广告。
- 首页不放广告，不放工具按钮，不做杂乱操作面板。

自动续费策略：

- MVP 先做手动年费，不做自动续费。
- 后续如接入微信委托扣款，小程序内不主动提醒续费成功。
- 扣费失败后再提示，并给 1 天宽限期。

## 腾讯云与凭证

用户已获得：

- CloudBase 6 个月免费资格。
- 云存储 6 个月免费资格。
- CloudBase 环境 ID：`cloud1-d0gz0y40r67b3198e`
- 云存储桶：`636c-cloud1-d0gz0y40r67b3198e-1396635429`
- 默认域名：`636c-cloud1-d0gz0y40r67b3198e-1396635429.tcb.qcloud.la`
- 实际 CloudBase 区域：`ap-shanghai`
- 小程序 AppID：`wx640831368d15e774`

本地凭证已写入：

```text
/Users/huangchangwei/Desktop/gitSpaceC/PetLLTown/.env.local
```

注意：

- `.env.local` 已加入 `.gitignore`，不要提交。
- 不要在文档、代码、提交记录里写明 SecretId、SecretKey、登录密码。

## 当前开发进度

第一阶段已基本完成：

- `project.config.json` 已配置 `cloudfunctionRoot: "cloudfunctions/"`。
- 已建立 `cloudfunctions/bootstrap` 并在微信开发者工具中部署。
- 已建立 `cloudfunctions/getPetManifest` 并在微信开发者工具中部署。
- 已建立 `cloudbase/configs/bootstrap.default.json`。
- 已建立 `cloudbase/configs/pets/xiaotuanzi.manifest.json`。
- 已上传 150 张 demo 帧到 CloudBase 云存储。
- 已创建云数据库集合 `app_configs`、`pets`。
- 已写入云数据库文档 `app_configs/bootstrap`、`pets/xiaotuanzi`。
- `bootstrap` 和 `getPetManifest` 已验证从数据库读取配置。

常用命令：

```bash
npm run typecheck
npm run sync:bootstrap
npm run sync:manifests
npm run upload:frames
npm run upload:frames -- --apply
npm run upload:media
npm run upload:media -- --apply
npm run seed:cloudbase
npm run seed:cloudbase -- --apply
npm run check:cloudbase
```

当前 `npm run check:cloudbase` 结果：

- `bootstrap.source = database`
- `getPetManifest.source = database`
- 两者资源地址均为 `cloud://.../pets/xiaotuanzi/actions/idle/frames/`
- `voiceTranscribe.ready = true`
- `aiRespond.provider = hunyuan-v3`
- `aiRespond.model = hy3-preview`

第二阶段语音和 AI 开发状态：

- 首页已采用长按底部光球录音、松开发送。
- `voiceTranscribe` 已部署，已真实调用腾讯云 ASR 一句话识别成功。
- `voice_logs` 已创建并可记录成功/失败日志。
- `aiRespond` 已部署，使用 CloudBase AI Node SDK。
- AI provider 使用 `hunyuan-v3`，模型使用 `hy3-preview`。
- `ai_logs` 已创建并可记录成功/兜底日志。
- 前端已串联：录音 -> ASR 文本 -> `aiRespond` -> 展示小团子短回复。
- 腾讯云智能语音插件 AppID 与本项目无关；当前方案使用云函数服务端 SDK，不使用小程序插件前端 SDK。

## 近期开发路线

第一阶段：把项目变成可部署的云开发小程序。

1. 初始化 Git 仓库。已完成。
2. 补 `cloudfunctionRoot` 到 `project.config.json`。已完成。
3. 建立 `cloudfunctions/bootstrap`。已完成。
4. 建立 `cloudbase/configs/bootstrap.default.json`。已完成。
5. 前端从本地 `CDN_CONFIG` 改成调用 `wx.cloud.callFunction({ name: "bootstrap" })`。已完成。
6. 保留本地 fallback，避免云函数失败时页面空白。已完成。
7. 上传当前 demo 帧资源到腾讯云存储。已完成。
8. 用后端返回资源地址替换 GitHub Raw 临时地址。已完成，使用 `cloud://` fileID。
9. 在微信开发者工具里完成云环境联调。已完成基础云函数联调。

第二阶段：语音和 AI。

1. 接入录音权限和录音按钮/监听状态。已完成。
2. 建立 `voiceTranscribe`。已完成。
3. 接腾讯云 ASR 一句话识别。已完成，并真实识别成功。
4. 建立 `aiRespond`。已完成，并真实调用 `hy3-preview` 成功。
5. 做基础意图判断和动作选择。已完成最小版，返回 `emotion` 和 `nextAction`。
6. 写入调用日志和每日限额。

第三阶段：记忆、会员、宠物包。

1. 用户体系和 openid 初始化。
2. 短期记忆 7 天。
3. 年会员永久记忆。
4. 宠物包购买权限。
5. 微信支付。

## 下一轮 AI 接手重点

接手后不要重新做产品讨论，直接从这里开始：

1. 用微信开发者工具或真机测试完整链路：长按录音 -> ASR -> AI 回复。
2. 根据 `aiRespond.data.nextAction` 接入更明确的动作切换，目前前端先展示回复。
3. 增加每日次数限制和成本保护，优先对 `voiceTranscribe` 和 `aiRespond` 做 openid 频控。
4. 做 `memoryRecent` / `memoryWrite` 的最小短期记忆。
5. 所有新增文案和配置都优先放后端 JSON，不写死在前端。
