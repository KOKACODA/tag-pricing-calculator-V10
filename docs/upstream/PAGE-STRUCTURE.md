# PAGE-STRUCTURE.md · 页面结构与关键 DOM 锚点

> 当前版本 **v12.9** ｜ 更新 2026-10-10
> 版本真相源 = 仓库 `index.html` 的 `<title>`。
> web 端共 **5 个视图**（单页切换）+ 2 个历史浮窗；本地 `file://` 版保持原 3 视图（新菜单隐藏）。

---

## 一、视图切换机制

侧边导航按钮带 `data-page` 属性，点击切换 `<section class="page">` 的 `active` 类：

```html
<nav class="sidenav">
  <button class="nav-btn active" data-page="calculator">智能报价计算器</button>
  <button class="nav-btn web-only" data-page="data" hidden>数据管理</button>      <!-- v11.1 -->
  <button class="nav-btn web-only" data-page="settings" hidden>报价设置</button>  <!-- v11.1 -->
  <button class="nav-btn" data-page="table">报价表组查询</button>
  <button class="nav-btn" data-page="profile">个人主页</button>
</nav>
```

| `data-page` | 容器 id | 显示条件 |
|---|---|---|
| `calculator` | `#page-calculator` | ✅ 默认显示 |
| `data` | `#page-data` | 仅 web 端；移动端（ui-vertical）隐藏 |
| `settings` | `#page-settings` | 仅 web 端；移动端（ui-vertical）隐藏 |
| `table` | `#page-table` | |
| `profile` | `#page-profile` | |

- web-only 按钮的显示控制在 `applyUiLayoutMode()`：`hidden = 无KOKA || 移动端`。
- 访客（visitor）由 `auth.js` 的 `applyPagePermission()` 隐藏除计算器外的全部按钮。

另有全局浮层：
- `#personalizePanel` —— 个性化面板（内联下拉，点外部关闭）
- `#historyListDialog` —— 报价历史列表浮窗（v11.1，见「浮窗」节）
- `#historyDetailDialog` —— 报价详情浮窗
- `#shippingWeightDialog` / `#manualShippingDialog` —— 邮费输入对话框

---

## 二、视图 1：智能报价计算器（`#page-calculator`）

主入口，左侧参数区 + 右侧结果区。

### 参数区（自上而下）

| 区块 | 关键 id | 说明 |
|---|---|---|
| 报价表快捷切换 | `#quickPriceListSelector` | 顶栏快捷下拉 |
| 纸张数量 / 档位 / 地区 | `#sheetCount` `#tier` `#region` | |
| 纸张卡片 | `#sheetsWrap`（动态） | 每张纸独立选材质/尺寸/工艺 |
| 吊绳类型 | `#ropeFold` `#ropeFoldHead` `#ropeFoldSummary` `#rope` | **可折叠**，默认折叠 |
| 快速切换档位（v11.2） | `#tierQuickSwitch` `#tierQuickHead` `#tierQuickBtns` | **可折叠，默认折叠** |
| 临时直接系数 | `#tempCoeffBar` `#tempCoeffInputs` | 直接系数模式专用 |

### 结果区

| 区块 | 关键 id | 说明 |
|---|---|---|
| 各纸张明细表 | `#resSheetTable` | 显示代码 `▲▼` 切换器 |
| 吊绳费 | `#resRopePrice` | 金额 `.rope-result-price[data-rope-edit]` **可点击修改**（v10.9.0），覆盖时 `.rope-price-overridden` 高亮 |
| 邮费 | `#resShippingPrice` | 金额 `.ship-result-price[data-ship-edit]` **可点击修改**（v11.0），覆盖高亮同上 |
| 成本合计 / 吊牌成本 | `#resCost` `#resTagCost` | 随覆盖联动 |
| 临时修改重置（v11.0） | `#resultResetRow` `#resetRopeShipBtn` | 仅存在吊绳/邮费覆盖时显示 |
| 面积系数行 | `#areaCoefficientRow` | 面积 > 10000 时显示 |
| 临时毛利系数 | `#customCoeffBar` `#customCoeffInput` `#customPriceCard` | 提示与标题同行（v11.2） |
| 保存面板 | `.quote-save-panel` | `#saveQuoteBtn`（保存含改动提示）/ `#openQuoteHistoryBtn`（打开历史浮窗） |

---

## 三、视图 2：数据管理（`#page-data`，v11.1 新增）

tabs 顺序（**报价历史第一、默认激活**）：

| tab | 关键 id | 说明 |
|---|---|---|
| **报价历史** | `#historyTable` `#historyEmpty` `#clearHistoryBtn` | 与浮窗共用渲染（`buildHistoryRowsHtml`） |
| 价格配置 | `#exportExcelBtn` `#importExcelBtn` `#exportRopeExcelBtn` `#exportShippingExcelBtn` `#exportDataBtn` `#exportLocalBackupBtn` `#resetToDefaultsBtn` 等 | 各类导入导出 |
| 在线修改 | `#onlineLockNotice` `#onlineManagerRoot` `#onlineAddGroupBtn` `#onlineTplPriceList` | 仅超管可编辑 |
| **匹配规则**（v12.9） | `#ruleSetSelect` `#rulesTbody` `#rulesAddBtn` `#rulesResetBtn` `#rulesStatus` | 规格匹配规则表（全局 / 织唛专用两套），仅决定代码，价格仍取表格 |
| 云同步 | — | 占位 |

另有：**快照与统计报表卡**（`#snapshotTable` `#createSnapshotBtn` `#statsContent` `#exportStatsBtn`）、
**上传为默认数据**按钮（`#uploadDefaultBtn`，仅超管可见）。

---

## 四、视图 3：报价设置（`#page-settings`，v11.1 新增）

| 区块 | 关键 id | 说明 |
|---|---|---|
| 客户毛利系数 | `#levelSettings` `#addLevelBtn` `#resetLevelBtn` | |
| 金额显示 | `#decimalPlaces` | |
| 公司信息 | `#companyName` `#companyPhone` | |
| 默认选项 | `#defaultTier` `#defaultSizeType` `#defaultRope` `#defaultPaper` `#uiLayoutMode` `#hidePaperIndex` `#paperSelectMode` `#specMatchMode`（v12.9 规格匹配方式） | |
| 保存/导出 | `#saveProfileBtn` `#exportProfileBtn` | |
| 计算规则说明 | — | 静态说明 |

---

## 五、视图 4：报价表组查询（`#page-table`）

| 区块 | 关键 id | 说明 |
|---|---|---|
| 报价表切换器 | `#priceListSelector` `#deletePriceListBtn` | 删除按钮仅超管可见（v10.8.1） |
| **报价表备注** | `#priceListNote` `#priceListNoteBody` | 无备注整块 `hidden` |
| 搜索框 | `#searchInput` | |
| 价格矩阵表 | `#priceTable` `#craftTable` `#directCoeffTable` `#batchDirectTable` | 内联编辑 |
| Excel | `#exportExcelBtn` 等 | |

---

## 六、视图 5：个人主页（`#page-profile`）

| 区块 | 关键 id | 说明 |
|---|---|---|
| 账号区 | （auth.js 注入 `#kokaTopBar` / 账号卡） | 网页版 |
| **功能入口**（v11.2） | `#gotoDataMgrBtn` `#gotoSettingsBtn` | 移动端进入数据管理/报价设置的主入口 |
| 系统信息 | — | 当前版本 / 数据存储 / 测试阶段提示 |
| 全局恢复 | `#resetAllSettingsBtn` | 清除全部本地配置 |
| 账号管理 | （auth.js 注入） | 仅管理员+ 可见 |

---

## 七、浮窗

| 浮窗 | 关键 id | 说明 |
|---|---|---|
| **报价历史列表**（v11.1） | `#historyListDialog` `#dialogHistoryTable` `#dialogHistoryEmpty` `#dialogClearHistoryBtn` | 计算器「查看报价记录」打开；与数据管理主表共用渲染；载入参数后自动关闭 |
| 报价详情 | `#historyDetailDialog` `#historyDetailContent` `#historyDetailLoadBtn` | 保存时快照 + 临时修改明细 |
| 邮费重量 / 手动邮费 | `#shippingWeightDialog` `#manualShippingDialog` | 缺档时弹出 |

---

## 八、⚠️ 改 DOM 时的强制检查

`js/app.js` 顶部有一个集中的 `els` 对象——**任何 HTML `id` 的改动都必须全局 grep 同步 `els.*` 引用**；
`if (els.xxx)` 的判空会静默吞掉失效引用（表现为"点击无反应"）。

渲染方式：
- **静态**：`index.html` 里写死骨架（导航、卡片容器、固定表单）
- **动态渲染**：`app.js` 的 `render*` 函数用模板字符串写入 `innerHTML`
  （如 `renderPriceTable()` / `renderSheets()` / `renderRopeRadios()`）
- ⚠️ **`innerHTML` 重写 = 该区域内所有事件监听器全部丢失**，
  重渲染后必须重新绑定（统一封成 `rebuild*` 函数，内含 render + bind）；
  长列表用表格级事件委托（`tbody.onclick` 赋值幂等，如 `bindHistoryTableActions`）。
