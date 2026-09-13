# V10.4 归档说明 · 文档索引

> 归档时间：2026-09-10 21:20 ｜ 版本：**v10.3.0**（已上线）｜ 线上：https://kokalabel-quote.pages.dev
> 本目录 = 完整可运行生产包 + 项目文档 + 转手文档，可独立使用或整体交接。

## 目录结构

```
V10.4\
├─ index.html / login.html / robots.txt / _headers      ← 网页入口与部署配置
├─ js\          data.js（默认报价数据+迁移链）/ app.js（业务逻辑）/ auth.js（账号与云同步）
├─ css\         style.css（含 v9.7~v10.3 覆盖段）
├─ functions\   Cloudflare Pages Functions（api：登录/账号/报价云端共享）
├─ favicon.svg / favicon.ico / favicon.png / apple-touch-icon.png   ← 亲成新图标全套
├─ assets-logo-qincheng.svg                              ← 品牌 logo 源文件（SVG）
├─ docs\
│   ├─ CHANGELOG.md                                      ← 版本变更日志（v8.4.0 ~ v10.3.0）
│   └─ plans\                                             ← SOP 手册、部署说明、重构记录
└─ 转手文档\    ← ★项目日志管理与交接文档（本套）
    ├─ README.md（本文件·索引）
    ├─ 01-项目转手交接文档.md         ← 新 agent 必读：架构/目录/账号/部署/坑位/操作手册
    ├─ 02-项目总结文档.md             ← 项目背景、功能全景、版本演进、决策记录
    ├─ 03-版本日志-V9.6至V10.3.md     ← 逐版本详细日志（需求→实现→坑→发布）
    └─ 04-工作日志-2026-09-08至09-10.md ← 三日逐时段工作流水（含每日惯例）
```

## 快速上手

- **本地使用**：双击 `index.html`（file:// 免登录，数据存本机 localStorage）
- **部署**：见《01-项目转手交接文档》第七节（`npx wrangler@3.114.0 pages deploy . --project-name kokalabel-quote --branch main`，需 CF token）
- **推 GitHub**：见同文档第八节（**注意 hosts 屏蔽坑**，需用 `http.curloptResolve` 固定真实 IP 的绕行命令）
- **账号**：admin(superadmin) / jianqing(sales) / zls(visitor)；密码由用户自管

## 文档阅读顺序（接手者）

1. 本 README（30 秒了解目录）
2. 《01-项目转手交接文档》—— 看完即可独立操作
3. 《03-版本日志》近期段落 —— 了解最近改了什么、为什么
4. 《02-项目总结文档》—— 需要理解全局或做规划时再读
5. 《04-工作日志》—— 查具体某天做了什么

## 重要提醒

- 品牌显示文案为「亲成」；代码内部标识符（KOKA 对象、KOKA_AUTH KV、tagPricing_ 存储前缀）**保持原名勿改**（关系用户数据与云端兼容）。
- 所有价格/表头的本地编辑，**必须点「↑ 保存为全局默认」才会上传云端**，其他账号才能看到。
- 改动前请先读《01》第九节的版本管理规范（python 替换版本号、迁移串豁免、HTML 结构校验等 9 条纪律）。
