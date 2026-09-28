# TODO.md — 任务、优先级、开发进度

> 记录任务、优先级与开发进度。**切换 AI / 重启新会话时先读本文件**即可接续开发，无需重读全部项目。
> 维护规则：每完成一项 → 勾选并更新「状态 / 版本 / 日期」；新任务加进对应优先级区。

## 当前状态（基线）

- 当前线上版本：**v10.9.0**（2026-09-24 上线）。
- 测试基线：**51 通过 / 5 跳过（`integrity.test.mjs`，F8 未加回）/ 0 失败**。
- 分支：`v8`（开发 + 线上），`main` 已同步。

---

## 历史已完成（里程碑）

- [x] **v10.7.0** —— 加回 9.8 三块功能：A 报价历史增强 / B 在线修改（F1/F2/F3）/ C 快照与统计报表（F4/F5/F6）。
- [x] **v10.8.0** —— 吊绳 0 价修复 + 是否出血规则（出血/区间匹配）。
- [x] **v10.9.0** —— 新增「唛头」默认报价表（含备注）+ 报价表备注独立框体 + 吊绳切换实时刷新 + 修复两处旧版迁移对新增第 3 报价表的误伤。

---

## 已完成 · 本期开合（v10.9.0）

- [x] 默认新增第 3 报价表组 `group3`「唛头报价」与报价表 `priceList3`「唛头」（2 张纸：织边带 / 电脑机，默认不出血、含备注）。 — `js/data.js`
- [x] Excel 导入读取「备注」行 → `paper.notes`；导出模板补「备注」行。 — `js/app.js`
- [x] 报价表组查询：纸种有备注时在表格下方独立框体展示「报价表备注：…」。 — `js/app.js` / `css/style.css` `.notes`
- [x] 吊绳切换不实时刷新：确认并保持 `bindRopeEvents` 在 `change` 时 `onCalculate()`，切换即重算。
- [x] 迁移误伤修复：`migrateV8Restructure` 加 `dataVersion>=8.0` 守卫；`migrateFloor1V951` 保留非 1/3 楼纸张。 — `js/data.js`
- [x] 新增/更新测试用例（唛头默认表 + 迁移回归），全量 51 通过。
- [x] 版本号全站 v10.8.0 → **v10.9.0** + CHANGELOG + 部署日志 + git 提交推送 + wrangler 部署（部署号 `7e1c2c6c`）。

---

## 待办 · 进行中

### P1（产品必须 / 发版阻塞）
- [ ] 云同步中心实为占位 UI，需实现真实云同步（从「上传/下载默认数据」扩展为账号级双向同步）。
  - 现状：数据管理「云同步」tab 为 `placeholder-badge` 占位；默认数据可单向上传。

### P2（增强 / 稳定）
- [ ] **F8 完整性签名加回**：`signExport / verifyImportIntegrity / sha256Hex / canonicalJson`（导出 JSON 带 `meta.integrity`，导入校验 ok/legacy/tampered）。完成后解除 `integrity.test.mjs` 的 skip。 — 见 `docs/功能差别标记-9.8与10.6.md`
- [ ] **F9 严格导入校验**：`isNonNegFinite / validateImportedData`（拦截数组/空对象、NaN、`priceLists` 字段、数量上限 6000）。
- [ ] **F10 sheet 重名去重**：`toSafeSheetName(name, usedSet)`，超长截断 + 重名追加序号（当前 `sanitizeSheetName` 同名直接覆盖）。
- [ ] 生产主域名 `index.html` 命中 CDN 边缘旧缓存：发版后核对刷新（运维提示，非代码缺陷）。

### P3（维护 / 文档）
- [ ] 根目录 `AGENTS.md` / `README.md` 版本号与结构提示仍为历史版本，已随 `docs/ai/*` 文档集补充；下次统一修订时可一并更新，避免与新文档集重复维护。
- [ ] 部署流程改进：将 `CLOUDFLARE_API_TOKEN` 获取 / wrangler 直传脚本化，降低手工录入。

---

## 回滚 / 快速定位

- 上一个大版本：`git log --oneline -10`。
- 完整变更：`CHANGELOG.md`；部署记录：`docs/部署日志.md`；遗留问题：`docs/问题日志.md`。
- 9.8 功能差异 / 待加回清单：`docs/功能差别标记-9.8与10.6.md`。