# ARCHITECTURE.md · 项目架构、目录结构与数据组织

> 当前版本 **v12.9** ｜ 更新 2026-10-10
> 版本真相源 = 仓库 `index.html` 的 `<title>`；本章内容为架构总览，较早版本细节以 CHANGELOG 为准。

---

## 一、总体架构

```
┌─────────────────────────── 浏览器 ───────────────────────────┐
│  index.html / login.html                                      │
│    ├─ js/data.js   默认报价数据 + 版本迁移链   → localStorage │
│    ├─ js/app.js    业务逻辑（计算 / 渲染 / 交互）              │
│    └─ js/auth.js   账号与云同步（仅 http/https 生效）          │
└───────────────┬───────────────────────────────────────────────┘
                │ fetch /api/*
┌───────────────▼───────────────────────────────────────────────┐
│  Cloudflare Pages Functions                                    │
│    /api/quote           读/写全局默认报价数据                  │
│    /api/auth/{login,logout,session,status}                     │
│    /api/admin/users{,/[name]}                                  │
│         └─ _lib.js（PBKDF2 / KV 读写 / 会话 TTL）              │
└───────────────┬───────────────────────────────────────────────┘
                │
        Cloudflare KV  KOKA_AUTH
          u:*    用户表
          s:*    会话
          q:v1   全局默认报价数据
```

**分层原则**：计算与渲染分离 —— 核心是纯函数 `calculate(inputs)`，不操作 DOM。

---

## 二、目录结构

```
.
├─ index.html            主页面（单页三视图：计算器 / 报价表组查询 / 个人主页）
├─ login.html            登录页
├─ js/
│   ├─ data.js           ★ 默认数据 + 迁移链（项目最大文件）
│   ├─ app.js            ★ 业务逻辑
│   ├─ auth.js           账号门控与云同步
│   ├─ login.js          登录页脚本
│   └─ vendor/xlsx.full.min.js   本地化 SheetJS（勿动）
├─ css/style.css         全部样式（含各版本覆盖段）
├─ functions/            Cloudflare Pages Functions
│   ├─ _lib.js
│   └─ api/{quote.js, auth/*.js, admin/users*.js}
├─ assets/               图标 + logo
├─ docs/                 本文档目录
├─ tests/                历史测试脚本
├─ docs/handover/        交接文档全集（含历史工作日志）
├─ CHANGELOG.md / docs/ISSUES.md（缺陷跟踪）
└─ wrangler.toml         部署配置（含 KV id，**不入库**，见 .gitignore）
```

---

## 三、数据组织

### 3.1 三级层级

```
小组（Group）
  └─ 总报价表（PriceList）
        └─ Sheet 纸张报价表（Paper）
              └─ 规格（Spec：code + maxArea + prices{档位:价格}）
```

当前：**3 组 / 4 张报价表 / 45 张纸**

| 组 | 报价表 | 是否出血 | 说明 |
|---|---|---|---|
| 1楼小组 | 1楼 | 是 | 33 张纸 |
| 3楼小组 | 3楼 | 是 | 10 张纸 |
| 唛头小组 | 织边带（消光带） | **否** | 9 档规格 |
| 唛头小组 | 电脑机 | **否** | 9 档规格 |

### 3.2 全局共享数据（不随报价表切换）

- **吊绳** 27 种：`{ id, name, prices{档位:价格} }`，以 1000 张为基准价
- **邮费** 9 个地区：`{ id, name, basePrices{档位:价格}, overTierCoeff }`
- **工艺**：按纸张 id 分组挂载
- **客户等级**：毛利系数

### 3.3 localStorage 键位

| key | 内容 |
|---|---|
| `paperConfig` | 纸张配置（含规格 × 档位价格矩阵） |
| `craftConfig` | 工艺配置（按纸张 id 分组） |
| `ropeConfig` | 吊绳配置 |
| `shippingConfig` | 邮费配置 |
| `customerLevels` | 客户等级 |
| `priceLists` | 报价表（含 `bleed` / `note` 字段） |
| `priceListGroups` | 报价表组 |
| `currentPriceListId` | 当前报价表 id |
| `dataVersion` | **迁移基线**（当前 `10.8.0`） |
| `appProfile` | 个人偏好（默认纸张/吊绳/字号/`specMatchMode` 规格匹配方式） |
| `specMatchRules` | **v12.9**：规格匹配规则集 `{global:[…], <织唛报价表id>:[…]}`（仅本地，未云同步） |
| `uiFontScale` | 界面字号缩放（px 换算） |

读取统一走 `loadFromStorage(key, default)`：读不到就用内置默认值。

### 3.4 版本迁移链

`js/data.js` 尾部一串自执行 IIFE，顺序执行，逐级把老数据升到新结构：

```js
(function migrateXXX() {
  const dataVersion = loadFromStorage("dataVersion", "");
  if (verCompare(dataVersion, "X.Y.Z") >= 0) return;  // 守卫
  // ... 只补缺失项 ...
  saveToStorage("dataVersion", "X.Y.Z");
})();
```

已存在：`v5.4` / `v6.2` / `v7.8` / `v8.0` / `v8.4` / `v9.0.1` / `v9.5.1` / `v9.9.0` / **`v10.8.0`**。

> ⚠️ `dataVersion` 与界面版本号含义不同，不要混用。

---

## 四、核心计算流程

```
输入（DOM 读取）
  ↓
calculate(inputs)                              ← 纯函数，js/app.js
  ├─ 逐张纸：面积 → 规格匹配 → 单价
  │     面积 = bleeds ? (长+3)×(宽+3) : 长×宽
  │     规格 = 最小的「最大含出血面积」≥ 实际面积 那档
  │              （出血表先走 forceSpecByArea 强制映射 005/055/006）
  ├─ 吊绳：基准价(1000张) × max(1, 档位/1000)；全 0 价 = 免费
  ├─ 邮费：查表 / 重量×系数 / 手输
  ├─ 面积系数：面积 > 10000 → ×(面积/10000)
  └─ 客户等级系数
  ↓
返回 { sheetDetails, ropePrice, shippingPrice, cost, costKnown, pricesByLevel, warnings }
  ↓
渲染（onCalculate → 各 render* 函数）
```

### 关键辅助函数

| 函数 | 作用 |
|---|---|
| `hasExactTier(prices, tier)` | 该档位是否有价（空串/null 视为无价） |
| `matchSpec(paper, area, skipForce)` | 面积 → 规格（向上取档） |
| `forceSpecByArea(paper, area)` | 4000-6000 强制映射 005/055/006（吊牌专用） |
| `calcBleedArea(l, w)` | `(l+3)×(w+3)` |
| `calcAreaCoefficient(area)` | 面积 > 10000 时返回 面积/10000 |
| `getRopeBasePrice(prices)` | 取吊绳 1000 张基准价（≤0 返回 null） |
| `isFreeRope(rope)` | 全 0 价 = 「不加吊绳」这类免费选项 |
| `currentPriceListBleeds()` | 当前报价表是否出血（默认 true） |
| `getPriceListNote(id)` | 报价表备注 |

---

## 五、权限与云端

- 判定统一走 `KOKA.roleNum()` / `roleRank()`：
  `superadmin(3) > admin(2) > sales(1) > visitor(0)`
- 所有就地编辑入口统一用 `KOKA.canEditQuote()` 拦截（仅管理员及以上可改）。
- 「↑ 保存为全局默认」→ 写 KV `q:v1` → 所有客户端 10 秒轮询自动同步（覆盖本地 + reload）。
- `js/auth.js` **只在 `http/https` 生效**；`file://` / exe 不走登录与云同步。
