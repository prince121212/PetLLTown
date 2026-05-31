# CloudBase Bootstrap

`bootstrap` 是小程序启动时的第一份后端配置，负责返回应用名称、首页文案、设置项、宠物列表、素材地址、会员和广告基础配置。

## 部署前检查

1. `project.config.json` 需要包含 `cloudfunctionRoot: "cloudfunctions/"`。
2. 微信开发者工具里选择环境 `pet-dev-d6gpc4gw88ca1aa43`。
3. 上传并部署 `cloudfunctions/bootstrap`。
4. 如需云端覆盖配置，在云数据库创建集合 `app_configs`，写入文档 `_id = bootstrap`。

## 配置来源

- 默认配置：`cloudbase/configs/bootstrap.default.json`
- 云函数部署内置配置：`cloudfunctions/bootstrap/bootstrap.default.json`
- 同步命令：`npm run sync:bootstrap`

云函数会先读 `app_configs/bootstrap.config`，失败或未配置时使用内置默认配置，前端再保留本地 fallback，三层兜底保证首页不会空白。

## 数据初始化

本地已有脚本可创建云端覆盖配置：

```bash
npm run seed:cloudbase -- --apply
```

写入后，`bootstrap` 云函数会优先使用云数据库里的 `app_configs/bootstrap.config`。

部署和数据初始化后，可以跑：

```bash
npm run check:cloudbase
```

它会调用 `bootstrap` 和 `getPetManifest`，确认两者是否从数据库读取配置。
