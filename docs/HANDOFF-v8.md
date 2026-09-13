# KOKALabel 报价系统 v9.8.0 — 项目转手文档

> 本文档供新接手的开发者或 AI Agent 快速了解项目全貌与当前状态。
> 最后更新：2026-09-09 ｜ 当前版本：v9.8.0（`v8` 分支，已上线）
> 技术细节的权威来源是 `docs/项目总结.md`；全量历史 + 技术 + 转手方案见 `docs/项目历史与技术总档案.md`。本文档仅作快速上手索引。

---

## 一、项目概览

| 项目 | 说明 |
|---|---|
| 名称 | KOKALabel 报价系统 |
| 用途 | 吊牌 / 标签 / 不干胶印刷品报价（纸张 + 工艺 + 吊绳 + 邮费 + 客户等级系数） |
| 部署 | Cloudflare Pages（项目名 `tag-pricing-calculator-v5`，wrangler 直传） |
| 正式地址 | https://tag-pricing-calculator-v5.pages.dev（当前 v9.8.0） |
| GitHub | KOKACODA/tag-pricing-calculator-V10 |
| 技术栈 | 原生 HTML + CSS + JavaScript（无框架）；SheetJS 本地化于 `js/vendor/xlsx.full.min.js` |
| 存储 | 浏览器 `localStorage`（键前缀 `tagPricing_`，无后端、无数据库） |
| 账号体系 | 线上启用 Cloudflare Pages Functions + KV（角色：管理员 / 业务员 / 访客）；本地 `file://` 双击仍可离线使用（不启用登录） |

---

## 二、分支与版本关系（重要）

| 分支 | 版本 | 状态 |
|---|---|---|
| `v8` | v9.8.0 | **当前线上版本**，一切改动在这里 |
| `main` | v9.8.0 | 已与 `v8` 同步（v9.5.0 起随版同步） |

- v8 谱系来自另一台设备导出的压缩包（`8.5` / `8.6` / `8.8` 三个文件夹），根提交为 `v7.8 baseline`，与 `main` **无共同提交**，是两条独立 git 历史。
- **Git 自动部署已断**：GitHub 仓库改名 `tag-pricing-calculator-V10` 后，Cloudflare Pages 的 Git 集成失效（推送不再触发自动构建）。当前发版方式为 `wrangler pages deploy` 直传（见第五节）。
- 生产域名已切换至 v8 分支最新提交；`main` 仅作历史保留，请勿再基于它开发。

---

## 三、文件结构（`v8` 分支）

```
tag-pricing-calculator-v5/
├── index.html                      # HTML 骨架 + CSP（约 1200 行）
├── login.html                      # 账号登录页（在线部署时启用）
├── css/style.css                   # 全部样式（约 3400 行）
├── js/
│   ├── data.js                     # 数据配置 + 存储 + 版本迁移（约 10000 行，90% 为静态价格数据）
│   ├── app.js                      # 计算 + 渲染 + 交互 + 导入导出（约 5500 行）
│   ├── auth.js                     # 前端账号访问控制（角色门控 / 账号面板）
│   ├── login.js                    # 登录页脚本
│   └── vendor/xlsx.full.min.js     # SheetJS（本地化，离线可用）
├── assets/                         # 站点图标（favicon / apple-touch-icon）
├── functions/                      # Cloudflare Pages Functions 后端
│   ├── _lib.js                     # 共享库（PBKDF2 / 会话 / 角色 / 管理员保护）
│   └── api/                        # auth/*、admin/users/*、default
├── wrangler.toml                   # KV 绑定配置（AUTH 命名空间）
├── tests/*.test.mjs                # Node 内置测试（vm 加载纯函数，9 个文件）
├── _headers / robots.txt           # Cloudflare 安全头 / noindex 屏蔽收录
├── .gitignore                      # 忽略 node_modules / .wrangler 等
├── AGENTS.md                       # AI Agent 接手只读入口
├── CHANGELOG.md                    # 版本变更日志
└── docs/
    ├── HANDOFF-v8.md               # 本文档（转手 / 交接）
    ├── 项目历史与技术总档案.md      # 全量历史 + 技术 + 转手方案（总纲）
    ├── 项目总结.md                 # 完整项目总结（技术细节权威来源）
    ├── 归档说明-v8.md              # v8 谱系迁移归档
    ├── 部署日志.md                 # 部署与运维记录（发版先看这里）
    ├── 问题日志.md                 # 已知问题与处理记录
    ├── main-branch-summary.md     # main 分支（v7.10 旧谱系）完整历史档案
    └── plans/                      # 历史设计文档
```

---

## 四、核心架构

### 三级数据层级

```
小组 Group（默认「1楼小组」「3楼小组」，v9.8.0 起可在线增删改名）
 └─ 报价表 PriceList（「1楼」33 组纸、「3楼」10 组纸，可在线增删改名、移动归属）
     └─ 纸张 Paper（每张纸 = 一个 Excel Sheet）
```

- 一个报价表 = 一个 Excel 文件（多 Sheet）。
- 吊绳 / 邮费 / 客户等级为全局共享配置，不随报价表切换。
- 纸张关键字段：`discount`（折扣，仅标准模式）、`directCoeff`（直接系数三行 `{tiers,max,min}`）、`batchDirect`（批量固定价 `{maxArea,prices}`）、`specs`（规格矩阵 `{code,maxArea,prices}`）。
- **v9.8.0 数据层**：新增 `PRICE_LIST_GROUPS` 持久化键（`priceListGroups`），报价表组与报价表的关系通过 `priceList.groupId` 关联；新增字段已同步接入本地备份 / 完整配置 / 快照 / 重置 / 云下发五条链路（`validateImportedData` 增组结构校验，旧文件向后兼容）。

### 三种计价路径

| 模式 | 成本 | 报价 |
|---|---|---|
| 直接系数（默认） | 纸张 + 工艺 | (纸张 + 工艺) × 直接系数 |
| 标准报价 | 纸张折后价 + 工艺 + 吊绳 + 邮费 | 成本 × 客户等级毛利系数 |
| 批量直接报价 | 固定价 + 工艺（面积 ≤ `batchDirect.maxArea` 且档位有价） | 直接用固定价，不打折不乘系数 |

- 出血面积 = (长+3)×(宽+3)；面积 > 10000 时面积系数 = 面积/10000。
- 强制面积映射：4000–4999→005，5000–5499→055，5500–6000→006（6000 边界强制 006）。
- 邮费 9 地区，档位 500/1000/2000/5000/10000；超量(>10000)弹重量输入 × 超量系数，中间档弹手动输入。
- 「修改后成本」红字**始终显示**，不受「默认报价」开关控制。
- 「吊牌成本合计」= 成本合计 − 邮费（标准模式）/ 成本合计（直接系数模式）。

### v9.8.0「在线修改」模块（个人主页 · 数据管理第 3 个标签页）

- 位置：报价历史与云同步之间，仅管理员可用（http 部署时非管理员显示锁定提示；`file://` 离线视为机主放行）。
- 区块一「报价表组与报价表管理」：按组卡片渲染（组名 / 报价表数 / 重命名组 / 新增报价表 / 删除组，仅空组且非最后一组可删），组内报价表表格支持重命名、删除（联动清理纸张与工艺）、归属组下拉直接移动。
- 区块二「按模板修改报价数据（管理员）」：选定目标报价表 → 导出含现有数据的模板（Excel）→ 修改后导入即原地覆盖该报价表（`applyPriceListData` 先清旧纸张/工艺再合入新数据，区别于价格配置页的「导入 = 新增报价表」）；模板内改「总报价表」名会同步重命名目标报价表。

---

## 五、开发与部署

### 本地运行

```bash
git clone https://github.com/KOKACODA/tag-pricing-calculator-V10.git
git checkout v8                     # 切到当前线上分支
python3 -m http.server 8080         # 或直接双击 index.html（离线可用）
```

### 验证命令

```bash
node --check js/app.js js/data.js   # 语法检查
node --test tests/*.test.mjs        # 单元测试（当前 9 个文件，57/57 通过）
```

### 上线流程（Git 自动部署已断，走 wrangler 直传）

```bash
# 在项目根目录执行；CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID 从仓库外凭据备份获取
CLOUDFLARE_API_TOKEN="<令牌>" CLOUDFLARE_ACCOUNT_ID="a4fdb353836f801c65072d7810fbcc32" \
  npx wrangler pages deploy . --project-name=tag-pricing-calculator-v5 --branch=v8 --commit-dirty=true
```

- 项目 `production_branch` 已重设为 `v8`，直传后生产域名即更新。
- 部署令牌存于仓库外凭据备份（`KOKALabel-凭据备份-勿提交.md`，不在 git 仓库内）；部署记录与验证方式见 `docs/部署日志.md`。
- 推送 GitHub（`git push origin v8` + `main` 同步）与部署是两个独立步骤，可分别执行。
- SheetJS 已本地化，导出 / 导入 Excel 无需联网。
- 任何修改请同步更新 `CHANGELOG.md` 与本文档的「最后更新」信息。

---

## 六、维护注意事项

1. **GitHub 仓库已改名 `tag-pricing-calculator-V10`**：旧地址自动重定向仍可访问；Cloudflare Pages Git 集成因改名失效，发版走 wrangler 直传（见第五节）。若要恢复自动部署，需在 Cloudflare 面板重新绑定新仓库。
2. **部署令牌**：有两枚令牌曾被记录（旧令牌 `cfut_E6qV…` 与新令牌 `cfut_ku37…`），2026-09-09 验证两者均有效；凭据备份文件中新令牌标记为「当前有效」，旧令牌建议在 Cloudflare 面板轮换作废。令牌属敏感信息，严禁提交到 git。
3. **文档分工**：技术细节以 `docs/项目总结.md` 为准；问题追踪见 `docs/问题日志.md`；迁移来历见 `docs/归档说明-v8.md`。
4. **数据迁移**：旧版 localStorage 用户首次加载会自动迁移到 v8 结构（`data.js` 内置幂等 `migrate*` 函数），无需手动重置；v9.8.0 对老用户默认沿用原有两组报价表组，向后兼容。
5. **新增功能先看占位**：云同步 / 客户管理 / 订单管理 / 统计 / 价格趋势 / PDF 报价单目前仍为占位功能，未实现。
6. **改报价表组/报价表管理**：`data.js` 的 `addPriceListGroup` / `renamePriceListGroup` / `renamePriceList` / `movePriceListToGroup` / `applyPriceListData` + `app.js` 的 `renderOnlineManager` / `handleOnlineGroupsClick`；新增字段 `priceListGroups` 需同步备份/导入/快照/重置/云下发五条链路。

---

## 七、快速索引

- 计算逻辑入口：`js/app.js` → `calculate(inputs)`
- 数据唯一维护区：`js/data.js` 顶部 `DEFAULT_PAPER_CONFIG` / `DEFAULT_CRAFT_CONFIG` / `DEFAULT_ROPE_CONFIG` / `SHIPPING_CONFIG` / `DEFAULT_CUSTOMER_LEVELS`
- 报价表组管理：`js/data.js` → `getPriceListGroups` / `addPriceListGroup` / `renamePriceListGroup` / `deletePriceListGroup`
- 报价表管理：`js/data.js` → `addPriceList(name, groupId, switchTo)` / `renamePriceList` / `movePriceListToGroup` / `deletePriceList` / `applyPriceListData`
- 在线修改渲染与事件：`js/app.js` → `renderOnlineManager` / `handleOnlineGroupsClick` / `isOnlineEditAdmin`
- 模板导出：`js/app.js` → `paperToSheetRows`（v9.8.0 起参数化，可导出任意报价表模板）
- 邮费三档 + 对话框：`js/app.js` → 邮费段 / `openShippingWeightDialog` / `openManualShippingDialog`
- 显隐控制：`js/app.js` → `applyDefaultQuoteVisibility`
- 吊牌成本合计：`index.html` `#resTagCost` + `js/app.js` 计算后赋值
- 模板 / 导入导出：`js/app.js` → `downloadPaperTemplate` / `exportPaperExcel` / `importPaperExcel` / `parseShippingExcel` 等

---

## 八、新接手者上手步骤（30 分钟）

1. 读 `AGENTS.md`（约 75 行，接手必读入口）→ 读本文档。
2. `git clone https://github.com/KOKACODA/tag-pricing-calculator-V10.git && git checkout v8`。
3. 本地双击 `index.html` 直接跑通（离线可用，无需后端）。
4. 跑 `node --test tests/*.test.mjs` 确认 57/57 通过。
5. 想了解业务规则再读 `docs/项目总结.md`；发版流程看 `docs/部署日志.md` 最新条目。
