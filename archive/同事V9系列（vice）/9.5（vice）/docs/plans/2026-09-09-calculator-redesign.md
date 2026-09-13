# 计算器页 UI 重构记录（v9.5.0）

> 日期：2026-09-09 ｜ 分支：`v9.5-redesign` ｜ 依据：客户参考截图（合版彩页在线报价风格，B 端简约）
> 原则：**换皮不换骨**——保留全部元素 id 与业务逻辑，仅重排布局与视觉；出问题可随时回退。

## 一、实现对照表（需求 → 实现）

| 需求 | 实现 | 备注 |
|---|---|---|
| 顶部蓝色导航条 + 3 tab | `nav.navbar` 渐变蓝（#0e5fd8→#1677ff），tab 白字/激活白条 | 原有结构 |
| 导航右侧：标准报价/直接系数计算按钮 | `.nav-controls` 内 `.mode-btn×2`（顺序：标准、直接） | 移自参数卡标题行，逻辑不变（app.js 同步 active） |
| 导航右侧：报价表组选择器 | `#quickPriceListSelector` 移入导航 | |
| 导航右侧：默认报价显示开关 | `#defaultQuoteToggle` 移入导航 | 白底胶囊适配蓝底 |
| 参数输入卡片（白底圆角阴影） | 原 `.card` 保留 | |
| 批量档位下拉 + 纸张数量 | 原 `#tier` / `#sheetCount` 一行 | |
| 纸张条目折叠面板（纸张1/纸张2 + 说明） | `renderSheets` 模板改 `.sheet-fold-head`（标题+说明+箭头），默认**展开**，点标题收起 | 静态初始卡会被重绘 |
| 纸张材质下拉（备注小字/展开自动收起） | 原 `.paper-dropdown` 保留 | |
| 展开尺寸 宽/长 + 自动加3mm出血 | 原 `.sheet-width/.sheet-length` 保留 | |
| 附加工艺折叠 + 红* + 点击展开 | `.fold-panel`（默认收起），勾选后标题显示「已选 N」 | `onCraftChange` 同步计数 |
| 继续添加纸张条目按钮 | `#addSheetBtn`（sheetCount+1 并触发重绘） | |
| 吊绳类型折叠 + 红* + 点击展开 | `#ropePanel`（默认收起；外壳保留 `.form-group`，direct 模式隐藏逻辑不受影响） | |
| 收货地区下拉 | 原 `#region` 保留（单下拉，对应邮费表 9 地区） | |
| 规格表格（纸张/尺寸/面积/代码/单价，面积标红） | 原 `#resSheetTable`，CSS 面积列红 | |
| 报价明细行 7 项 | 原 `resTier/resPaperOriginalPrice/resPaperPrice/resCraftPrice/resRopePrice/resTagCost/resShippingPrice` 顺序一致 | |
| 成本合计红底高亮 + 大红字 | `.cost-total-row` 强化（#fff1f0 底/#ffa39e 边/26px 红字） | |
| 快速切换档位按钮组（激活蓝底白字） | 原 `#tierQuickBtns`（样式已有 active 蓝） | |
| 客户报价系数卡片组（右上倍数/选中红边） | 原 `price-cards`：`.coeff-badge` 右上、`.highlight` 红边 | 卡片名取自客户层级设置（个人主页可改名） |
| 临时毛利系数 + 备注 | 原 `#customCoeffBar` | |
| 邮费快速修改 + 清除 + 备注 | 原 `#shippingOverrideBar` | |
| 报价归档（客户名称/备注/保存/查看记录） | 原 `quote-save-panel` | |
| 全局 #1677ff / 金额红 / 浅灰蓝背景 / system-ui | `:root` 覆盖 + body 字体 | 追加样式段统一覆盖 |

## 二、改动文件
- `index.html`：导航栏右侧控件区、参数卡标题精简、纸张设置行加按钮、吊绳折叠面板
- `js/app.js`：`renderSheets` 模板（sheet 折叠 + 工艺折叠 + 已选计数）、`onCraftChange` 计数同步、`bindEvents` 折叠委托 + addSheetBtn
- `css/style.css`：追加 v9.5 样式段（主色/导航/折叠/结果区微调）
- 版本号统一 v9.5.0

## 三、回退方式
- 本分支：`git checkout v9.4-roles`（回到 v9.4.5 稳定版，commit `059e9cb`）
- 单文件回退：`git checkout v9.4-roles -- index.html js/app.js css/style.css`
- 归档快照：`Desktop\KL\V9\9.4`（v9.4.5）；本次完成后建议建 `V9\9.5` 快照
- 线上回退：Cloudflare Pages → 项目 → Deployments → 选上一个部署 Rollback

## 四、已知边界
- 「收货地区」沿用单下拉（对应邮费表 9 地区），未做省市区三级联动（数据结构限制，如需三级需重建邮费数据模型）
- 客户卡片名称来自「个人主页 → 报价设置」的层级名称（默认 普通/优质/大客户 可自行改名）
- 折叠面板为自定义组件（非 shadcn，保持零依赖单文件架构，视觉对齐）
