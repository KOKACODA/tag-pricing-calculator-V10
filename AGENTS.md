# AGENTS.md — 接手本仓库前先读这一份

> 本文约 60 行，是留给任何新接手的开发者或 AI Agent 的「只读入口」。读完即可开工，不用通读整个代码库。

## 一句话定位

KOKALabel 报价系统：吊牌/标签印刷报价计算器。核心为原生 HTML + CSS + JS（无框架），数据存浏览器 `localStorage`；**线上部署（Cloudflare Pages）额外启用账号登录体系**（Pages Functions + KV，角色：管理员/业务员/访客，可上传全用户共享默认数据）。线上：https://tag-pricing-calculator-v5.pages.dev（v10.6.0）。本地 `file://` 双击打开仍可离线使用（不启用登录）。

> **v10.6.0 整合说明**：本版 = 同事 v10.5 代码 + KOKA 品牌/图标（亲成改动全部回退）+ 9.8 登录体系（不使用 v10.5 登录）。9.8 独有功能（在线修改/统计报表等）已在 v10.6 移除，待后续版本加回，**唯一标记入口 = `docs/功能差别标记-9.8与10.6.md`**（加回一项即在文档标记）。

## 分支真相（先确认，最容易踩坑）

- `v8` = 当前线上版本（v10.6.0），**一切改动在这里**。
- `main` = 已与 `v8` 同步（v10.6.0）。
- GitHub 仓库已改名 `tag-pricing-calculator-V10`（旧地址 `tag-pricing-calculator-v5` 自动重定向，仍可访问）。
- **Git 自动部署已断**（仓库改名导致 Cloudflare Pages Git 集成失效）：发版需 `wrangler pages deploy` 直传，详见 `docs/部署日志.md` 最新条目。
- `archive/` 为同事版归档：`同事V9系列（vice）/`（9.0~9.9，后缀 vice 与仓库 9.8 基线区分，仅记录不部署）与 `同事V10系列/`（V10.0~V10.5 快照）。
- 旧 v7.10 谱系（独立 git 历史）经本地备份 tag `archive/v7.10-main` 追溯，完整记录见 `docs/项目历史与技术总档案.md`。

## 核心数据流（一句话）

报价表（Excel 多 Sheet）→ 纸张 Paper（规格矩阵）→ `calculate()` → 成本/报价。
计算逻辑全在 `js/app.js`；价格数据全在 `js/data.js`。一个报价表 = 一个 Excel 文件，每张纸 = 一个 Sheet。

## 文件地图（含行数 —— 别把大文件整个读）

| 文件 | 行数 | 何时读 / 怎么读 |
|---|---|---|
| `js/data.js` | ~9500 | **90% 是静态价格数据。永不整读**。只看顶部 `DEFAULT_*` 配置区；改价用 grep 定位纸张 id 或简称 |
| `js/app.js` | ~5200 | 按函数读（见下方函数索引），不要整读 |
| `index.html` | ~1150 | 改页面结构 / 加对话框时读 |
| `login.html` | ~80 | 登录页（在线部署时启用） |
| `js/auth.js` | ~230 | 前端账号门控 / 个人主页账号面板；改角色权限时读 |
| `functions/` | 8 文件 | 后端账号/会话/默认数据 API；改鉴权时读 `_lib.js` 与 `api/` |
| `css/style.css` | ~3250 | 改样式时才读，通常不动 |
| `assets/` | 3 图标 | favicon / apple-touch-icon，无特殊情况不动 |
| `js/vendor/xlsx.full.min.js` | 内置库 | **永不读**。SheetJS 已本地化，离线可用 |
| `archive/` | 同事版归档 | 版本记录用，通常不动；需要对比同事实现时读对应版本目录 |
| `docs/功能差别标记-9.8与10.6.md` | ~70 | 9.8 独有功能待加回清单；加回 9.8 功能前必读 |
| `AGENTS.md` | ~80 | 本文档，接手必读 |

## 常见改动怎么做（省 token 的关键）

- **改价格**：只动 `js/data.js` 顶部 `DEFAULT_PAPER_CONFIG` / `DEFAULT_CRAFT_CONFIG` / `DEFAULT_ROPE_CONFIG` / `SHIPPING_CONFIG` / `DEFAULT_CUSTOMER_LEVELS`。
- **改计算规则**：`js/app.js` → `calculate()` 及其调用的函数。
- **加页面/按钮**：`index.html` 结构 + `app.js` 对应 render / 事件绑定。
- **改登录/权限**：前端 `js/auth.js`（门控/面板）+ 后端 `functions/`（角色/会话/默认数据）。
- **改导入导出**：`app.js` 里 `downloadPaperTemplate` / `exportPaperExcel` / `importPaperExcel` / `parseShippingExcel`。
- **改报价表组/报价表管理（在线修改）**：⚠️ v10.6 **已移除**该功能（9.8 基线有：`renderOnlineManager` / `handleOnlineGroupsClick` / `applyPriceListData` + `priceListGroups` 字段）。要加回时先读 `docs/功能差别标记-9.8与10.6.md`（F1/F2/F3），并从 commit `c3bc57b`（9.8 基线）取实现。
- **上传为默认数据（管理员）**：`app.js` `initDefaultDataUpload()`——把当前报价表/纸张/工艺/吊绳/邮费/客户等级上传为全用户共享默认数据（`/api/default` POST + KV），其他账号下次登录自动应用（`auth.js applyDefaultData`）。
- **默认管理员初始化**：首次部署空 KV 时，登录页填「初始化密钥」（部署变量 `SETUP_KEY`），系统自动创建 `ADMIN_USER`（账号 KOKA）/ `ADMIN_PASS`（密码 12345677）管理员并直接登录。

## 函数索引（按需 grep）

- `calculate(inputs)` — 核心计算
- `computeStandardOverridePrice` / `computeDirectTempTotals` — v9.7 公共计算函数：临时系数/邮费修改与每纸临时系数的价格计算（屏幕渲染与保存记录共用，改计算规则只改这里）
- `collectQuoteOverride` / `buildQuoteHistoryRecord` — v9.6 保存报价时固化临时修改到 `snapshot.override`
- `getDirectCoeffsForTier` / `matchSpec` / `calcAreaCoefficient` — 系数与规格匹配
- `applyDefaultQuoteVisibility` — 报价区显隐控制
- `openShippingWeightDialog` / `openManualShippingDialog` — 邮费两档对话框
- `loadFromStorage` / `saveToStorage` / `migrate*` — 存储与版本迁移

## 验证命令

```bash
node --check js/app.js js/data.js   # 语法检查
node --test tests/*.test.mjs        # 单元测试
```

## 更深层内容（按需再读，一上手不要读）

- `docs/项目总结.md`（~250 行）— 设计新功能 / 要懂全部业务规则时再读
- `docs/main-branch-summary.md` — main 分支（v7.10 旧谱系）完整历史档案，做课题研究 / 追旧版本演化时读
- `docs/问题日志.md`、`docs/归档说明-v8.md` — 问题追踪 / 迁移来历
- `CHANGELOG.md` — 查历史用；近期改动可用 `git log --oneline -10` 快速扫

## 改完必做

- 更新 `CHANGELOG.md`（版本号递增，或加「维护」记录）
- 若文件地图 / 架构有变，同步更新本文件对应段落
- **发版上线**：Git 自动部署已断（仓库改名），需 `wrangler pages deploy . --project-name=tag-pricing-calculator-v5 --branch=v8` 直传（详见 `docs/部署日志.md`）；推送 GitHub 与部署是两个独立步骤