> ℹ️ **归档说明（2026-10-10）**：本目录已从仓库根 `转手文档/` 下沉至 `docs/handover/`；
> 文中目录树为 **v10.8.0 时期快照**。**当前仓库结构与最新文档索引见根目录 [README.md](../../README.md)。**
> 最新的核心逻辑与计划文档见 [`docs/CORE-LOGIC.md`](../CORE-LOGIC.md) 与 [`docs/plans/`](../plans/)。
>
> ⚠️ **路径已变更（2026-10-10）**：旧文中的 `KOKALabel报价系统-v7.8\`（Git 工作副本）现位于
> `E:\Wb\报价优化\kokalabel-quote\`；旧文中的 `E:\报价系统7.9\` 根路径现为 `E:\Wb\报价优化\`。
> 旧路径 `E:\报价系统7.9\` 及其下的 `_verify\` 已不再存在，回归测试见本仓库 `tests/`。

# v10.8.0 归档说明 · 文档索引

> 归档时间：2026-10-07 ｜ 版本：**v10.8.0**（已上线）｜ 线上：https://kokalabel-quote.pages.dev
> 本目录 = 项目转手文档全集。代码本体在 Git 仓库 `zly62612364469/kokalabel-quote`（本地目录 `kokalabel-quote\`）。

## 目录结构

```
报价系统7.9\
├─ KOKALabel报价系统-v7.8\          ← ★ Git 工作副本（源码唯一真相源）
│   ├─ index.html / login.html / robots.txt / _headers
│   ├─ js\        data.js（默认报价数据 + 迁移链）/ app.js（业务逻辑）/ auth.js（账号与云同步）/ login.js
│   ├─ css\       style.css
│   ├─ functions\ Cloudflare Pages Functions（登录 / 账号管理 / 报价云端共享）
│   ├─ assets\    KOKA图标全套（favicon.svg/ico/png + apple-touch-icon.png + logo）
│   ├─ docs\plans\  SOP 手册、扁平化重构记录
│   ├─ tests\     历史测试脚本
│   ├─ CHANGELOG.md / 问题日志.md
│   └─ 转手文档\   ← ★本套（项目日志管理与交接文档）
│       ├─ README.md（本文件·索引）
│       ├─ 01-项目转手交接文档.md          ← 新接手者必读：架构/目录/账号/部署/坑位/操作手册
│       ├─ 02-项目总结文档.md              ← 项目背景、功能全景、版本演进、决策记录
│       ├─ 03-版本日志-V10.3至V10.8.0.md   ← 逐版本详细日志（需求→实现→坑→发布）
│       └─ 04-工作日志-2026-09-11至10-07.md ← 逐日工作流水（含每日惯例）
├─ KOKALabel-v10.8.0\               ← 干净部署源（只含站点必需文件，用于 CF 部署）
└─ _verify\v1080.test.cjs           ← v10.8.0 功能回归测试（jsdom，21 项）
```

## 快速上手

- **本地使用**：双击 `KOKALabel报价系统-v7.8/index.html`（`file://` 免登录，数据存本机 localStorage）
- **部署**：见《01》第七节（`npx wrangler@3.114.0 pages deploy <部署源> --project-name kokalabel-quote --branch main`，**必须 wrangler v3**）
- **推 GitHub**：见《01》第八节（**本机网络有坑**，需绕代理 + 固定真实 IP）
- **账号**：admin(superadmin) / jianqing(sales) / zls(visitor)；密码见《01》第十节
- **回归测试**：`node _verify/v1080.test.cjs`（21 项全绿为准）

## 文档阅读顺序（接手者）

1. 本 README（30 秒了解目录）
2. 《01-项目转手交接文档》—— 看完即可独立操作
3. 《03-版本日志》近期段落 —— 了解最近改了什么、为什么
4. 《02-项目总结文档》—— 需要理解全局或做规划时再读
5. 《04-工作日志》—— 查具体某天做了什么

## 重要提醒

- 品牌显示文案为「**KOKA**」；代码内部标识符（`KOKA` 对象、`KOKA_AUTH` KV、`tagPricing_` 存储前缀、`koka*` 类名）**保持原名勿改**（关系用户数据与云端兼容）。
- 所有价格/表头的本地编辑，**必须点「↑ 保存为全局默认」才会上传云端**，其他账号才能看到。
- 改动前请先读《01》第九节的版本管理规范（python 替换版本号、迁移串豁免、行尾符 LF、HTML 结构校验等纪律）。
- **本套文档含真实凭据（KV id、账号密码）**，外传前请先脱敏。
