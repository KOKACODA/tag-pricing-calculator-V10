# AGENTS.md — 项目入口说明书（AI 协作基础信息）

> 面向任何新接手的开发者或 AI Agent。**接手机器人请先读本文件**，再按需读同目录其它文档。
> 本文件是「AI 协作文档集」的唯一入口，与 `docs/` 下既有的中文历史文档（项目总结 / 部署日志 / 问题日志等）互补、**不合并**。

## 这是什么

KOKALabel 报价系统：**吊牌 / 标签 / 不干胶印刷报价计算器**，纯前端原生 HTML + CSS + JS（无框架）。
- 核心数据流：报价表（Excel 多 Sheet）→ 纸张 Paper（规格矩阵）→ `calculate()` → 成本 / 报价。
- 计算逻辑全在 `js/app.js`；价格数据全在 `js/data.js`。一个报价表 = 一个 Excel 文件，每张纸 = 一个 Sheet。
- 数据存浏览器 `localStorage`；线上部署（Cloudflare Pages）额外启用账号登录体系（Pages Functions + KV，角色：管理员 / 业务员 / 访客，可上传全用户共享默认数据）。
- 线上：https://tag-pricing-calculator-v5.pages.dev（v10.9.0）。本地 `file://` 双击打开可离线使用（不启用登录）。

## 本目录文档地图（先浏览这份）

| 文件 | 用途 |
|---|---|
| `AGENTS.md` | 本文件：AI 协作基础信息 + 改动指南 |
| `project-overview.md` | 项目整体概述（功能 / 技术栈 / 部署 / 分支） |
| `architecture.md` | 架构与数据流、文件地图、计算管线 |
| `component-api.md` | 关键 JS 函数 / 后端 API 索引（按需 grep） |
| `user-guide.md` | 用户使用手册（不改码也能操作产品） |
| `development.md` | 开发方式、执行命令、回归测试清单 |
| `DESIGN.md` | 视觉规范（色彩 / 排版 / 布局约定） |
| `TODO.md` | 任务、优先级、开发进度（切换 AI / 重启会话读它接续） |

## 分支真相（先确认，最容易踩坑）

- `v8` = 当前线上版本（v10.9.0），**一切改动在这里**。
- `main` = 已与 `v8` 同步。
- GitHub 仓库：`KOKACODA/tag-pricing-calculator-V10`（旧地址 `tag-pricing-calculator-v5` 自动重定向）。
- **Git 自动部署已断**（仓库改名导致 Cloudflare Pages Git 集成失效）：发版需 `wrangler pages deploy` 直传，需 `CLOUDFLARE_API_TOKEN`，详见 `docs/部署日志.md` 最新条目。
- `archive/` 为同事版归档（V9 系列 vice 后缀 / V10 系列），仅记录不部署，通常不动。
- 旧 v7.10 谱系（独立 git 历史）经本地备份 tag `archive/v7.10-main` 追溯，见 `docs/项目历史与技术总档案.md`。

## 文件地图（含数量 —— 别把大文件整个读）

| 路径 | 规模 | 何时读 / 怎么读 |
|---|---|---|
| `js/data.js` | ~9600 行 | **90% 是静态价格数据，永不整读**。只读顶部 `DEFAULT_*` 配置区；改价用 grep 定位纸张 id 或简称 |
| `js/app.js` | ~5200 行 | 按函数读（见 `component-api.md`），不要整读 |
| `index.html` | ~1150 行 | 改页面结构 / 加对话框时读 |
| `login.html` / `js/login.js` | 小 | 登录页（在线部署时启用） |
| `js/auth.js` | ~230 行 | 前端账号门控 / 个人主页账号面板 |
| `functions/` | 8 文件 | 后端账号 / 会话 / 默认数据 API；改鉴权读 `_lib.js` 与 `api/` |
| `css/style.css` | ~3300 行 | 改样式才读；色彩 token 见 `DESIGN.md` |
| `assets/` | 3 图标 | KOKA 品牌图标，无特殊情况不动 |
| `js/vendor/xlsx.full.min.js` | 内置库 | **永不读**，SheetJS 已本地化 |
| `tests/*.test.mjs` | 10 文件 | 见 `development.md` 回归清单 |
| `docs/ai/*` | 8 文件 | 本文档集（协调协作 / 进度） |
| `docs/`（中文历史） | 多个 | 项目总结 / 部署日志 / 问题日志等，深挖历史时读 |

## 常见改动怎么做（省 token 的关键）

- **改价格**：只动 `js/data.js` 顶部 `DEFAULT_PAPER_CONFIG` / `DEFAULT_CRAFT_CONFIG` / `DEFAULT_ROPE_CONFIG` / `SHIPPING_CONFIG` / `DEFAULT_CUSTOMER_LEVELS`。
- **改计算规则**：`js/app.js` → `calculate()` 及其调用的函数（含 `computeStandardOverridePrice` / `computeDirectTempTotals`）。
- **加页面 / 按钮**：`index.html` 结构 + `app.js` 对应 render / 事件绑定。
- **改登录 / 权限**：前端 `js/auth.js`（门控 / 面板）+ 后端 `functions/`（角色 / 会话 / 默认数据）。
- **改导入导出**：`app.js` 里 `downloadPaperTemplate` / `exportPaperExcel` / `importPaperExcel` / `parseShippingExcel` / `parsePaperExcel`。
- **改报价表组 / 报价表管理（在线修改）**：`app.js` `renderOnlineManager` + `data.js` 组管理函数；权限见 `component-api.md`。
- **上传为默认数据（管理员）**：`app.js` `initDefaultDataUpload()` → `/api/default` POST + KV，其它账号下次登录 `auth.js applyDefaultData` 自动应用。
- **默认管理员初始化**：首次部署空 KV，登录页填「初始化密钥」（部署变量 `SETUP_KEY`），自动创建 `ADMIN_USER`（账号 KOKA）/ `ADMIN_PASS`（密码 12345677）。

## 改完必做

- 更新 `CHANGELOG.md`（版本号递增，或加「维护」记录）。
- 若新增功能有视觉影响，核对 `DESIGN.md`。若新增组件 / API，更新 `component-api.md`。
- 更新 `docs/ai/TODO.md` 任务进度。
- **发版上线**：Git 自动部署已断，需 `wrangler pages deploy . --project-name=tag-pricing-calculator-v5 --branch=v8` 直传（需 `CLOUDFLARE_API_TOKEN`）；推送 GitHub 与部署是两个独立步骤，部署日志见 `docs/部署日志.md`。

## 验证命令

```bash
node --check js/app.js js/data.js   # 语法检查
node --test tests/*.test.mjs        # 单元测试
```

## 更深层内容（按需再读，一上手不要读）

- `docs/项目总结.md`（~250 行）— 设计新功能 / 要懂全部业务规则时再读。
- `docs/main-branch-summary.md` — main 分支（v7.10 旧谱系）历史档案。
- `docs/问题日志.md`、`docs/归档说明-v8.md` — 问题追踪 / 迁移来历。
- `docs/功能差别标记-9.8与10.6.md` — 9.8 独有功能待加回清单（F1~F11）唯一标记入口。
- `CHANGELOG.md` — 查历史；近期改动用 `git log --oneline -10` 快速扫。