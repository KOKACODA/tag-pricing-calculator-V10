# architecture.md — 项目架构、数据流说明

> 讲清「系统怎么分层、数据怎么流转、计算怎么算」。想改代码前先看这篇 + `component-api.md`。

## 总体分层

```
┌────────────────────────────────────────────────────────────┐
│  index.html（骨架 + CSP）· login.html（线上登录页）            │
│  css/style.css（全部样式 / 设计 token）                      │
└───────────────▲───────────────┬──────────────────────────────┘
                │ DOM 渲染        │ 事件 / 交互
┌───────────────┴───────────────▼──────────────────────────────┐
│  js/app.js   计算（calculate）+ 渲染 + 交互 + 导入导出 + 统计    │
│  js/auth.js  前端账号门控 / 角色面板 / 默认数据应用             │
└───────────────▲───────────────┬──────────────────────────────┘
                │ 读写            │ 读写
┌───────────────┴───────────────▼──────────────────────────────┐
│  js/data.js  静态价格数据 + localStorage 持久化 + 版本迁移      │
└───────────────▲──────────────────────────────────────────────┘
                │ fetch /api/*
┌───────────────┴──────────────────────────────────────────────┐
│  functions/（Cloudflare Pages Functions + KV）                │
│  auth/*（登录/登出/会话/状态）· admin/users（账号管理）· default  │
└──────────────────────────────────────────────────────────────┘
```

- **纯前端离线**（`file://`）：跳过 `js/auth.js` 门控与 `functions/`，直接使用本地 `localStorage`。
- **线上**：登录后前端通过 `auth.js` 应用云端默认数据，权限按角色门控 UI 与 `functions/` 后端。

## 核心数据流（报价）

```
Excel 报价表（多 Sheet）──导入──► 纸张 Paper（含规格矩阵 prices）
                     审查规格降价裕度
用户输入 尺寸/纸张/工艺/数量/吊绳/邮费/客户等级
   │
   ▼
calculate(inputs) ──► 面积（是否出血±3mm）──► 匹配规格档位/系数
   │                    （标准 = matchSpec / 不出血 = matchSpecNoBleed）
   │                    直接系数 = getDirectCoeffsForTier
   ├─► 纸张价 + 工艺价 + 吊绳价 + 邮费
   ├─► 按客户等级毛利系数 / 临时系数加成
   ▼
成本 + 报价（多纸张合计 / 单品明细）
```

- 一个报价表 = 一个 Excel 文件；每张纸 = 一个 Sheet。
- 唯一事实源：`js/data.js` 的 `PAPER_CONFIG`（运行时）、默认改写 `DEFAULT_PAPER_CONFIG`。

## 存储与迁移

- 全部存 `localStorage`，key 前缀 `tagPricing_`（`tagPricing_paperConfig`、`tagPricing_craftConfig`、`tagPricing_ropeConfig`、`tagPricing_shippingConfig`、`tagPricing_customerLevels`、`tagPricing_priceLists`、`tagPricing_priceListGroups`、`tagPricing_currentPriceListId`、`tagPricing_dataVersion`、`tagPricing_appProfile`、报价历史 / 快照等）。
- 读取：`loadFromStorage(key, default)`；写入：`saveToStorage(key, value)`。
- 版本迁移链：若干 IIFE + `verCompare(dataVersion, ver)` 守卫，把老用户数据逐步升级到当前版本。
  - 迁移原则：保留用户改价（如 3 楼折扣），重建默认 1 楼，遇到新增默认报价表不得丢弃（v10.9.0 修复了两处旧迁移误伤）。
- 新增默认报价表组 / 报价表会带来历史迁移回归，改 `DEFAULT_*` 后务必全量跑测试 + 核对迁移用例。

## 计算管线（`js/app.js`）

- `calculate(inputs)` — 总入口，输出成本 / 报价。
- `calcBleedArea(length, width, hasBleed)` — 出血 ±3mm。
- `matchSpec(paper, area, hasBleed)` / `matchSpecNoBleed` — 规格匹配（出血 / 区间）。
- `getDirectCoeffsForTier` / `calcAreaCoefficient` — 直接系数与面积系数。
- `computeStandardOverridePrice` / `computeDirectTempTotals` — 临时系数 / 邮费修改的公共计算（屏幕渲染与保存记录共用，改结算规则只改这里）。
- `collectQuoteOverride` / `buildQuoteHistoryRecord` — 保存报价时固化临时修改到历史记录。

## 前端账号与角色（`js/auth.js` + `functions/`）

- 角色：管理员 / 业务员 / 访客。
- `functions/_lib.js` 提供共享库：PBKDF2 口令哈希、会话签发 / 校验、角色判断、管理员保护。
- 会话存 KV（`s:*`，带过期）；账号存 KV（`u:*`）；默认数据存 KV（`default:*`）。
- http 部署强制登录；`file://` 离线不启用（按机主放行）。

## 后端 API（Pages Functions，见 `component-api.md`）

- `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/session`、`GET /api/auth/status`。
- `GET/POST /api/admin/users`、`PATCH/DELETE /api/admin/users/[name]`。
- `GET/POST /api/default`。

## 文件职责一句话

| 文件 | 职责 |
|---|---|
| `js/data.js` | 静态价格 + 存储抽象 + 版本迁移 + 报价表组管理函数 |
| `js/app.js` | 计算、渲染、交互、导入导出、在线修改、统计报表、快照 |
| `js/auth.js` | 前端账号门控、角色面板、默认数据应用、上传入口 |
| `js/vendor/xlsx.full.min.js` | SheetJS（只读库） |
| `index.html` | 骨架 + CSP + 布局容器与各页面 DOM |
| `css/style.css` | 全部样式与设计 token |
| `functions/` | Cloudflare 后端（账号 / 会话 / 默认数据） |