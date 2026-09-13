# KOKALabel 报价系统 · 授权后端模板（Cloudflare Pages Functions）

> 版本：v9.2.0 ｜ 用途：exe「在线激活 + 离线使用」的服务端

## 一、目录
```
server-license/
├── functions/api/license/activate.js   ← 激活接口（POST）+ 校验接口（GET）
├── express-server.js                    ← 通用 Node/Express 版（不用 Cloudflare 时用）
└── README.md
```

## 二、Cloudflare Pages 部署
1. 把 `functions/` 放进你的 Pages 项目根目录（例如 box-wms 项目）。
2. 创建一个 **KV 命名空间**（控制台 → Workers & Pages → KV），命名如 `LICENSE`。
3. 在 Pages 项目 → 设置 → Functions → KV 绑定：变量名填 **`LICENSE`**，选刚建的命名空间。
4. 部署后接口地址即 `https://你的域名/api/license/activate`。

## 三、密钥表数据（写入 KV）
用 `tools/gen-license-keys.js` 生成：
```bash
node tools/gen-license-keys.js --customer "XX公司" --days 365 --out keys.csv
```
把 CSV 每行的 key 作为 KV 的 key，值为 JSON：
```json
{ "customer": "XX公司", "expiresAt": "2027-09-04T00:00:00.000Z", "deviceId": null, "revoked": false, "createdAt": "2026-09-04T..." }
```
写入方式：Cloudflare 控制台 KV 页面手动粘贴，或用脚本 wrangler kv key put。

### 续期（到期后解锁）
修改该 key 的 `expiresAt` 为新的截止时间即可 —— 客户在 exe 里重新输入同一密钥即续期成功。

### 吊销
把该 key 的 `revoked` 置 `true` → exe 下次联网同步即锁死（本版激活后以本地到期为准，吊销需联网校验；后续可加启动联网同步）。

## 四、接口行为
`POST /api/license/activate`  body `{ key, deviceId, deviceName }`
| 返回 code | 含义 |
|---|---|
| `ok:true` + `expiresAt` + `serverTime` | 激活成功（首次则绑定 deviceId） |
| `not_found` | 密钥不存在 |
| `revoked` | 已吊销 |
| `expired_key` | 已过期 |
| `device_mismatch` | 已在其他设备激活（一码一机） |

exe 侧用 `serverTime` 校准本地时间（偏差 >7 天拒绝激活，防改本地时间续期）。

## 五、不使用 Cloudflare？
用同目录 `express-server.js`（Node/Express），本地或任意 Node 服务器部署即可。
