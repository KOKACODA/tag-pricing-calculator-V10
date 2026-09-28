# development.md — 开发方式、执行命令、回归测试清单

> 面向开发者 / AI Agent 的日常开发流程与质量门禁。

## 前置约定

- 所有改动在分支 `v8` 上进行。
- 改价格只动 `js/data.js` 的 `DEFAULT_*` 常量；改计算只动 `js/app.js` 的计算函数（见 `component-api.md`）。
- 遵守 `AGENTS.md` 的「常见改动怎么做」与「改完必做」。

## 环境

- Node.js ≥ 16（测试用 `node:test`）。
- 无 `package.json`、无构建步骤、无框架依赖（SheetJS 已本地化）。

## 执行命令

```bash
# 语法检查
node --check js/app.js js/data.js

# 全量单元测试
node --test tests/*.test.mjs

# 单个测试文件
node --test tests/online-edit.test.mjs

# 按名字过滤测试
node --test --test-name-pattern "唛头" tests/online-edit.test.mjs

# 本地起静态服务器（可选；index.html 可直接双击）
python3 -m http.server 8080
```

## 测试计数（当前基线）

- 通过 51 / 跳过 5（`integrity.test.mjs` 完整性签名 F8 尚未加回，见 `docs/功能差别标记-9.8与10.6.md`）/ 失败 0。

## 回归测试清单

改动后至少跑以下几类并确认相应断言仍绿：

| 改动类型 | 必跑测试 | 关注点 |
|---|---|---|
| **改价格数据 / 默认配置** | `floor1-data.test.mjs`、`online-edit.test.mjs` | 默认纸张数、价格表组 / 报价表、迁移守卫不误伤 |
| **新增默认报价表 / 组** | 上述 + 全量 | 确认 `migrateV8Restructure` / `migrateFloor1V951` 不误伤旧用户改价、不丢弃新表纸张（v10.9.0 曾踩坑） |
| **改计算规则 / 出血 / 吊绳** | `bleed.test.mjs`、`quote-history.test.mjs` | `calcBleedArea`、区间匹配、吊绳 0 价、历史固化 |
| **改导入导出 Excel** | `export-sheet-name.test.mjs`、`online-edit.test.mjs` | sheet 名清洗、模板结构、备注 / 是否出血行读取 |
| **改账号 / 权限 / 安全** | `auth-e2e.test.mjs`、`security-hardening.test.mjs` | 角色门控、会话、口令、导入校验、防注入 |
| **改统计报表 / 快照** | `stats.test.mjs` | 统计聚合、利润分桶、柱状图、导出 |
| **改 UI / 页面结构** | `ui-enhancements.test.mjs` | 渲染存在性、交互绑定 |
| **任意改动** | 全量 `node --test tests/*.test.mjs` | 51 通过 / 0 失败，5 跳过需保持不变 |

> 若触发 `integrity.test.mjs` 从 skip 变为 fail（F8 若被加回则启用并跑），属于预期变化，需在 `docs/功能差别标记` 更新。

## 改完必做清单

1. `node --check` 通过。
2. 全量测试通过（0 失败）。
3. 更新 `CHANGELOG.md`（版本号递增或加「维护」记录）。
4. 有 API / 组件变化 → 更新 `component-api.md`；有视觉变化 → 核对 `DESIGN.md`。
5. 更新 `docs/ai/TODO.md` 进度。
6. 需要发版时：git 提交 + 推送 `v8` + tag，并用 wrangler 直传部署（需 `CLOUDFLARE_API_TOKEN`）。