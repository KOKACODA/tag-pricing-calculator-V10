# component-api.md — 组件 API 文档

> 关键函数 / API 的「按需 grep」索引。`js/data.js` 与 `js/app.js` 都较大，切勿整读，按需定位。

## 数据层（`js/data.js`）

### localStorage 键（前缀 `tagPricing_`）

| key | 内容 |
|---|---|
| `paperConfig` | 纸张数组（含规格矩阵） |
| `craftConfig` | 工艺配置（按纸张 id 分组） |
| `ropeConfig` | 吊绳配置 |
| `shippingConfig` | 邮费配置 |
| `customerLevels` | 客户等级 |
| `priceLists` | 报价表数组 |
| `priceListGroups` | 报价表组数组 |
| `currentPriceListId` | 当前报价表 ID |
| `dataVersion` | 数据版本（迁移链） |
| `appProfile` | 用户偏好 / 报价设置 |
| 报价历史 / 快照 | 各历史记录、快照集合 |

### 通用函数

- `loadFromStorage(key, default)` → 读取（JSON.parse）；`saveToStorage(key, value)` → 写入。
- `verCompare(a, b)` → 语义化版本比较，迁移守卫用。

### 报价表组 / 报价表管理

- `getPriceListGroups()` → 组数组。
- `getGroupName(groupId)` → 组名（缺省回退 `GROUP_NAME_MAP`，没有给「未分组」）。
- `addPriceListGroup(name)` → `{ok, id?}`。
- `renamePriceListGroup(id, name)` / `deletePriceListGroup(id)` → 管理组（重名/空名/有表/最后一个保护）。
- `renamePriceList(id, name)` / `movePriceListToGroup(id, groupId)` / `deletePriceList(id, groupId?)`。
- `addPriceList(name, groupId?, switchTo?)` → 新报价表 ID（ID 随机后缀防碰撞）。
- `applyPriceListData(priceListId, papers, crafts)` → 在线修改：先清后合，原地覆盖目标报价表。
- `getPapersByPriceList(priceListId)` / `getCurrentPriceListId()` / `getCurrentPriceList()` / `setCurrentPriceList(id)`。

### 默认配置常量（改价格只动这些）

`GROUP_META`、`GROUP_NAME_MAP`、`DEFAULT_PRICE_LIST_GROUPS`、`DEFAULT_PRICE_LISTS`、`DEFAULT_PAPER_CONFIG`、`DEFAULT_CRAFT_CONFIG`、`DEFAULT_ROPE_CONFIG`、`SHIPPING_CONFIG`、`DEFAULT_SHIPPING_CONFIG`、`DEFAULT_CUSTOMER_LEVELS`。

## 计算层（`js/app.js`）

- `calculate(inputs)` — 核心计算入口（成本 / 报价输出）。
- `calcBleedArea(length, width, hasBleed)` — 出血 ±3mm。
- `matchSpec(paper, area, hasBleed)` / `matchSpecNoBleed` — 规格匹配（出血 / 区间）。
- `getDirectCoeffsForTier` / `calcAreaCoefficient` — 直接系数 / 面积系数。
- `computeStandardOverridePrice` / `computeDirectTempTotals` — 临时系数 / 邮费修改公共计算（改结算规则改这里）。
- `collectQuoteOverride` / `buildQuoteHistoryRecord` — 保存时固化临时修改到历史快照 `snapshot.override`。

### 渲染 / 交互

- `renderPriceTable()` — 报价表组查询主渲染（含备注框 `paperNotes`）。
- `onCalculate()` — 重新计算并刷新报价区。
- `bindRopeEvents()` / `updateRopeFoldSummary()` / `rebuildRopeUI()` — 吊绳选择与实时刷新。
- `renderOnlineManager()` — 在线修改（组 / 表管理）渲染。
- `computeStats` / `renderStats` / `renderProfitBars` / `renderStatBarChart` / `exportStatsReport` — 统计报表。
- `applyDefaultQuoteVisibility` — 报价区显隐。
- `openShippingWeightDialog` / `openManualShippingDialog` — 邮费两档对话框。

### 导入导出

- `downloadPaperTemplate` / `exportPaperExcel` — 导出售表模板 / 整表。
- `importPaperExcel` / `importPaperExcelToPriceList` / `parsePaperExcel` — 导入纸张（读「折扣系数 / 是否出血 / 备注」行）。
- `parseShippingExcel` / `exportShippingExcel` — 邮费导入导出。
- `exportPriceListTemplateById` — 按报价表导出「含现有数据」模板（在线修改用）。
- `safeExcelText(str)` — 防公式注入（`=` 等前加 `'`）。
- `downloadJson` / `exportSnapshotSet` — 快照导出。

### 权限 / 账号

- `initDefaultDataUpload()` — 把当前报价表/纸张/工艺/吊绳/邮费/客户等级上传到 `/api/default`（仅管理员）。
- `auth.js` `applyDefaultData()` — 其它账号登录后自动应用云端默认数据。

## 后端 API（`functions/`，Cloudflare Pages Functions）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录（校验 / 建会话） |
| POST | `/api/auth/logout` | 登出（销毁会话） |
| GET | `/api/auth/session` | 会话查询 |
| GET | `/api/auth/status` | 是否初始化 / 状态 |
| GET | `/api/admin/users` | 列账号（管理员） |
| POST | `/api/admin/users` | 新建账号（管理员） |
| PATCH/DELETE | `/api/admin/users/[name]` | 改 / 删账号（管理员） |
| GET/POST | `/api/default` | 读取 / 上传共享默认数据（上传仅管理员） |

- 共享库：`functions/_lib.js`（PBKDF2、会话、角色、管理员保护）。
- KV 命名空间 `AUTH`：账号 `u:*`、会话 `s:*`、默认数据 `default:*`（见 `wrangler.toml`）。

## 测试（Node 单元测试，见 `development.md`）

10 个文件：`auth-e2e` / `bleed` / `export-sheet-name` / `floor1-data` / `integrity`（暂挂 skip）/ `online-edit` / `quote-history` / `security-hardening` / `stats` / `ui-enhancements`。