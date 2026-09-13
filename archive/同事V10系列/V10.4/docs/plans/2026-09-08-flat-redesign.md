# 计算器页「扁平化宽泛式」重构记录（v9.7.1）

> 日期：2026-09-08 ｜ 分支：`v9.7-flat`（自 `main-work` v9.6.0 切出）｜ 参考：合版在线报价风格截图（bbf71c516c66a5e9a8ad29bf2e833d7a.jpg）
> **本次为纯本地修改，不部署 Cloudflare Pages**；完成后生产文件复制到 `C:\Users\Mayn\Desktop\KL\9ge tebieban\9.7.1`。
> 原则：**换皮不换骨**——保留全部元素 id、业务逻辑与计算流程，仅重排布局与交互形态。

## 一、需求 → 实现对照表

| 需求 | 实现 | 备注 |
|---|---|---|
| 导航页不在顶部 | `nav.navbar`（顶部横条）→ `nav.sidenav`（左侧固定竖栏 200px）：品牌区「KOKALabel」+ 3 个 nav-btn 垂直排列 | class/data-page 不变，app.js 零改动；≤1100px 窄屏退化为顶部横条 |
| 垂直纵深 → 扁平化宽泛式 | 计算器页改 `calc-grid` 两栏：左栏参数表单（宽）+ 右栏报价结果（sticky 跟随），主区 flex:1 宽幅利用 | 窄屏单栏堆叠 |
| 渐进式卡片布局 → 平铺直列式表单 | 参数区去卡片外壳：顶部工具条（模式切换/报价表选择器/默认报价开关）+ 三个分区（报价条件 / 纸张设置 / 吊绳类型），小节标题 = 蓝色竖条+细线；行式紧凑（label 左置、间距压缩） | 高信息密度 |
| 弱化动态组合配置 | 删除纸张材质「点击展开→搜索→选择」渐进下拉（paper-dropdown/trigger/search 全部退场） | toggle/filter/position 等下拉函数保留但成为死代码（无入口，零风险） |
| 强化预设 SKU 快速点选 | 纸张材质改为 `sku-grid` 芯片直选：33 种材质一排排平铺，点一下即选中（蓝底白字），全称悬浮 title 显示 | `.paper-option` class 与 data-sheet/data-paper 属性保留，onPaperChange 复用 |
| 不要添加无关紧要的东西 | 不加占位公告/电话/新功能区块；报价表组查询、个人主页内容不动（仅随导航移位） | |

## 二、布局示意

```
┌──────────┬──────────────────────────────────────────────┐
│KOKALabel │ [直接系数计算|标准报价] [报价表▾] [默认报价⬋]     │
│          ├──────────────────────────────────────────────┤
│▸计算器    │ 报价条件：档位 | 纸张数量 | 收货地区（一行三列）   │
│▸报价表组  │ ────────────────────────────────────────      │
│▸个人主页  │ 纸张设置                                       │
│          │  纸张1：[350铜][400铜][702铜]…（SKU 芯片×33）    │
│          │        宽[55] 长[30]  工艺[芯片×N]              │
│          │  纸张2：…                                     │
│          │ ────────────────────────────────────────      │
│          │ 吊绳类型：[芯片×27]                            │
│          │ ──────────────────┬─────────────────────      │
│          │  （左栏结束）        │ 右栏：报价结果（sticky）     │
└──────────┴──────────────────────────────────────────────┘
```
实际 DOM：`calc-grid` 包两栏；右栏含原结果卡全部内容（明细表/明细行/价格卡/归档，id 全保留）。

## 三、改动文件

- `index.html`：nav→sidenav、外层 app-shell 包裹、calculator 页两栏容器、参数区平铺化重排、静态初始 sheet-card 改 SKU 芯片结构
- `js/app.js`：仅 `renderSheets` 模板（材质区芯片化）+ 1042-1071 绑定段（删 trigger/search 绑定）；其余 0 改动
- `css/style.css`：文件尾追加 v9.7 覆盖段（不动原样式）
- 版本号：v9.6.0 → v9.7.1（python 精确替换；**dataVersion 基线 9.5.1 不动**）

## 四、保留的关键 id / class（校验清单）

nav-btn×3(data-page)、tier、sheetCount、sheetList、rope、region、quickPriceListSelector、defaultQuoteToggle(+State)、mode-btn×2、resSheetTable、resTier/resPaperOriginalPrice/resPaperPrice/resCraftPrice/resRopePrice/resTagCost/resShippingPrice/resCost、resWarnings、areaCoefficientRow/resAreaCoefficient/resAreaCoeffDesc、tierQuickSwitch/tierQuickBtns、defaultPriceLabel、priceCards、customCoeffBar/customCoeffInput/customPriceCard、tempCoeffBar/tempCoeffInputs/tempCoeffResults、shippingOverride* 全组、quote-save-* 全组、sheet-width/sheet-length(data-sheet)、craft-item checkbox、paper-option(data-sheet/data-paper)。

## 五、回退方式

- `git checkout main-work`（回到 v9.6.0）
- 单文件回退：`git checkout main-work -- index.html js/app.js css/style.css`
- 本分支保留全部历史，废案不删除（与 v9.5 系列同一策略）

## v9.8.0 迭代（09-10，已部署）
1. **面积系数过程展示**：规格表（#resSheetTable）单价列 areaCoefficient>1 时显示 `¥基准 × 系数 = ¥结果`（原仅明细行有 × 系数、规格表只显基准价）。
2. **SKU 芯片完整显示**：去 ellipsis 截断 → word-break 换行，列宽 104px、字号 11.5px。
3. **UI 架构模式**：同一 DOM 双架构——body.ui-flat（左侧竖栏+双栏，默认）/ body.ui-vertical（顶部横条+单栏+卡片观感=垂直纵深式还原）。auto 按 UA 检测手机（iPhone/Android Mobile/Windows Phone…；iPad 不匹配→扁平）。个人主页→报价设置→UI 架构模式 select#uiLayoutMode，即时生效，localStorage「uiLayoutMode」按设备存储（不入云同步）。
4. 版本 v9.8.0（python 精确替换）；v9.7.1/v9.8.0 推 GitHub（tag v9.7.1/v9.8.0）；v9.8.0 部署 CF。

## v9.9.0 迭代（09-10，本地修改）
吊绳价格倍数制：1000 张基准；500 张与 1000 张同价；其余 = 基准 × 档位/1000（不再依赖精确档位，3500/7500 等任意档可算）。
- app.js：getRopeBasePrice（1000 档优先/500 回退）；calculate 吊绳段改倍数制（round2）；result 增 ropeBase/ropeMult；明细行 >1000 档显示 `¥基准/千张 × 倍数 = ¥结果`。
- data.js：DEFAULT_ROPE_CONFIG 27 组 500 档=1000 档（python 精确替换 26 处）；migrateRopeV99（dataVersion→9.9.0，老用户 500 档自动同价，内存+存储同步重赋）。
- node 同作用域模拟验证：新用户模板/老用户迁移双路径 + 500/3500/10000 档计算全部符合预期。
