# KOKALabel 报价系统 · 授权功能集成说明（v9.2.0）

> 日期：2026-09-04 ｜ 版本：v9.2.0 ｜ 状态：实现完成，待部署后端 + 配置接口地址

## 一、功能总览
按《2026-09-04-security-plan.md》P1 实现，exe 加入产品授权：
- **在线激活 + 离线使用**：首次联网到你的服务器校验密钥；激活后断网可用
- **一码一机**：密钥绑定设备（服务器记录首个激活的 deviceId，换机拒绝）
- **到期完全锁死**：到期后只显示激活窗口，输续期密钥可再激活（续期=服务器延长该 key 的 expiresAt）
- **无试用期**：未激活/过期/授权异常一律锁主界面
- **本地防篡改**：激活文件 HMAC 签名 + 时间回拨检测（提示级）

## 二、授权实现文件位置（electron-build/，未入源码工程 git）
| 文件 | 作用 |
|---|---|
| `electron-build/license.js` | 授权核心：设备指纹、激活/状态检查、HMAC 签名、在线激活 |
| `electron-build/license-config.json` | 配置：`apiBase`（部署后填你的域名，如 `https://your-domain.com`） |
| `electron-build/main.js` | 启动授权分流：未激活/过期 → 激活窗口；已激活 → 主窗口 |
| `electron-build/preload.js` | 激活窗口 IPC 桥 |
| `electron-build/activation.html` | 激活窗口 UI |
| `electron-build/tools/gen-license-keys.js` | 管理员密钥生成工具 |
| `electron-build/server-license/` | 后端接口模板（Cloudflare Functions + Express 两版） |
| `electron-build/.gitignore` | 独立 git（app/、dist、node_modules 不入库） |

## 三、部署步骤（管理员）
1. **生成密钥**：`node electron-build/tools/gen-license-keys.js --customer "XX公司" --days 365 --out keys.csv`
2. **部署后端**：见 `electron-build/server-license/README.md`（Cloudflare Pages Functions 或 Express）
   - 把 keys.csv 的密钥写入服务器密钥表（KV/DB/keys.json）
3. **配置接口地址**：在 `electron-build/license-config.json` 的 `apiBase` 填你后端域名
4. **打包**：`npm run dist`（exe 即带授权；未填 apiBase 时激活会提示"激活服务未配置"）

## 四、使用流程
```
管理员生成密钥 → 发给客户
客户打开 exe → 激活窗口输密钥 → 联网校验+绑定本机 → 正常使用
到期 → 锁死 → 找管理员续期(改 expiresAt) → 重输密钥激活
吊销 → 服务器 revoked=true（下次联网同步失效）
```

## 五、已知边界（如实说明）
- 纯前端/本地授权，HMAC 密钥与 JS 逻辑可被专业逆向提取 → 属"防普通用户 + 检测提示"级，非绝对防破解
- 本版激活后以本地到期日为准离线可用；联网吊销同步可在 P3 加强（启动时可选调 GET /verify）
- 时间回拨检测基于"激活时服务器时间 + 本地不能回拨>24h"的规则，已覆盖常见改时间手法

## 六、打包双版本（记：待实施）
- Win7：Electron 22（~90MB，免运行时）；Win10/11：Tauri（3-10MB，自带 WebView2）
- XP 不支持（已确认放弃）。详见工作日志。
