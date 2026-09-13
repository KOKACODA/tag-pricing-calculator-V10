// ============================================================
// v9.8.0 在线修改（个人主页 · 数据管理 · 第 3 个标签页）
// 覆盖：报价表组/报价表 CRUD、改名持久化、归属移动、
//       applyPriceListData 原地覆盖语义、UI 结构与事件绑定存在性
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

// v10.6.0 整合:9.8「在线修改」/报价表组管理（F1~F3） 在 v10.6 已移除。本文件暂挂(skip),
// 后续按 docs/功能差别标记-9.8与10.6.md 加回功能后,删除本变量即可恢复全部用例。
const __skipReason = "SKIP: 9.8「在线修改」/报价表组管理（F1~F3）";


const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

// 内存版 localStorage：验证「改名/增删即写存储」的持久化语义
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    _dump: () => map
  };
}

function loadDataModule(storage) {
  const source = fs.readFileSync(path.join(projectRoot, "js", "data.js"), "utf8");
  const context = {
    localStorage: storage,
    console: { info: () => {}, warn: () => {}, error: () => {} },
    setTimeout, clearTimeout, Promise, Date, Math
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "data.js" });
  // 暴露待测函数与状态（function 声明会挂到全局，let 变量需显式转发）
  return vm.runInContext(`({
    getPriceListGroups, getGroupName, addPriceListGroup, renamePriceListGroup,
    deletePriceListGroup, renamePriceList, movePriceListToGroup, applyPriceListData,
    addPriceList, deletePriceList, getPapersByPriceList, getCurrentPriceListId,
    get priceLists() { return PRICE_LISTS; },
    get paperConfig() { return PAPER_CONFIG; },
    get craftConfig() { return CRAFT_CONFIG; },
    get currentPriceListId() { return CURRENT_PRICE_LIST_ID; },
    get groupNameMap() { return GROUP_NAME_MAP; }
  })`, context);
}

// ---------- 数据层：报价表组 CRUD ----------

test("默认包含两个报价表组，getGroupName 可解析组名", { skip: __skipReason }, () => {
  const m = loadDataModule(createMemoryStorage());
  const groups = m.getPriceListGroups();
  assert.equal(groups.length, 2);
  assert.equal(m.getGroupName("group1"), "1楼小组");
  assert.equal(m.getGroupName("group2"), "3楼小组");
  assert.equal(m.getGroupName("not_exist"), "未分组");
});

test("新增报价表组：成功持久化；重名与空名被拒绝", { skip: __skipReason }, () => {
  const storage = createMemoryStorage();
  const m = loadDataModule(storage);

  const r = m.addPriceListGroup(" 2楼小组 ");
  assert.equal(r.ok, true);
  assert.equal(m.getPriceListGroups().length, 3);
  assert.equal(m.getGroupName(r.id), "2楼小组"); // 名称去首尾空格
  // 持久化：写入 localStorage
  assert.ok(storage.getItem("tagPricing_priceListGroups").includes("2楼小组"));

  assert.equal(m.addPriceListGroup("2楼小组").ok, false); // 重名
  assert.equal(m.addPriceListGroup("  ").ok, false);      // 空名
  assert.equal(m.getPriceListGroups().length, 3);
});

test("重命名报价表组：生效并同步 GROUP_NAME_MAP；重名/空名被拒绝", { skip: __skipReason }, () => {
  const storage = createMemoryStorage();
  const m = loadDataModule(storage);

  const r = m.renamePriceListGroup("group1", "一楼A组");
  assert.equal(r.ok, true);
  assert.equal(m.getGroupName("group1"), "一楼A组");
  assert.equal(m.groupNameMap.group1, "一楼A组"); // 导出 Excel 元信息同步

  assert.equal(m.renamePriceListGroup("group1", "3楼小组").ok, false); // 与 group2 重名
  assert.equal(m.renamePriceListGroup("group1", "").ok, false);
  assert.equal(m.renamePriceListGroup("not_exist", "x").ok, false);
});

test("删除报价表组：空组可删；有报价表的组与最后一个组不可删", { skip: __skipReason }, () => {
  const m = loadDataModule(createMemoryStorage());

  assert.equal(m.deletePriceListGroup("group1").ok, false); // group1 内有 priceList1
  assert.equal(m.deletePriceListGroup("group_not_exist").ok, false);

  const added = m.addPriceListGroup("临时空组");
  assert.equal(m.deletePriceListGroup(added.id).ok, true);
  assert.equal(m.getPriceListGroups().length, 2);

  // 移空 group1：此时共 2 个组，删掉空的 group1 后剩 1 个组（允许）
  m.movePriceListToGroup("priceList1", "group2");
  assert.equal(m.deletePriceListGroup("group1").ok, true);
  assert.equal(m.getPriceListGroups().length, 1);
  // 最后一个组不可删（触底保护）
  assert.equal(m.deletePriceListGroup("group2").ok, false);
});

// ---------- 数据层：报价表改名 / 移动 / 增删 ----------

test("重命名报价表：生效并持久化；重名被拒绝", { skip: __skipReason }, () => {
  const storage = createMemoryStorage();
  const m = loadDataModule(storage);

  assert.equal(m.renamePriceList("priceList1", "1楼报价表").ok, true);
  assert.equal(m.priceLists.find(p => p.id === "priceList1").name, "1楼报价表");
  assert.ok(storage.getItem("tagPricing_priceLists").includes("1楼报价表"));

  assert.equal(m.renamePriceList("priceList1", "3楼").ok, false); // 与 priceList2 重名
  assert.equal(m.renamePriceList("priceList1", "").ok, false);
  assert.equal(m.renamePriceList("not_exist", "x").ok, false);
});

test("移动报价表到其他组：生效并持久化；非法组被拒绝", { skip: __skipReason }, () => {
  const storage = createMemoryStorage();
  const m = loadDataModule(storage);

  assert.equal(m.movePriceListToGroup("priceList1", "group2").ok, true);
  assert.equal(m.priceLists.find(p => p.id === "priceList1").groupId, "group2");
  assert.ok(storage.getItem("tagPricing_priceLists").includes('"groupId":"group2"'));

  assert.equal(m.movePriceListToGroup("priceList1", "group_not_exist").ok, false);
  assert.equal(m.movePriceListToGroup("not_exist", "group1").ok, false);
});

test("addPriceList 支持指定组与不切换当前报价表（向后兼容旧调用）", { skip: __skipReason }, () => {
  const m = loadDataModule(createMemoryStorage());

  // 旧调用（无 groupId/switchTo）：默认切到新表
  const id1 = m.addPriceList("旧方式新表");
  assert.equal(m.currentPriceListId, id1);
  assert.equal(m.priceLists.find(p => p.id === id1).groupId, "group1");

  // 在线修改区：指定组 + 不抢焦点
  const id2 = m.addPriceList("在线新增", "group2", false);
  assert.equal(m.currentPriceListId, id1); // 当前报价表未变
  assert.equal(m.priceLists.find(p => p.id === id2).groupId, "group2");
});

test("applyPriceListData：原地覆盖目标报价表，不影响其他报价表", { skip: __skipReason }, () => {
  const m = loadDataModule(createMemoryStorage());
  const floor2CountBefore = m.getPapersByPriceList("priceList2").length;
  const floor1PapersBefore = m.getPapersByPriceList("priceList1");
  const floor1PaperIds = floor1PapersBefore.map(p => p.id);

  const parsed = {
    papers: [{
      id: "test_paper_x",
      name: "测试纸张",
      shortName: "测试",
      priceListId: "whatever",
      discount: 1,
      specs: [{ code: "A1", maxArea: 1000, prices: { "500": 1.5, "1000": 2.5 } }],
      directCoeff: null
    }],
    crafts: { test_paper_x: [{ name: "烫金", prices: { "500": 0.5 } }] }
  };
  const r = m.applyPriceListData("priceList1", parsed);
  assert.equal(r.ok, true);
  assert.equal(r.paperCount, 1);
  assert.equal(r.craftCount, 1);

  // 目标报价表：旧纸张全部替换为新纸张，且 priceListId 已改绑
  const floor1 = m.getPapersByPriceList("priceList1");
  assert.equal(floor1.length, 1);
  assert.equal(floor1[0].id, "test_paper_x");
  assert.ok(floor1PaperIds.every(id => !floor1.some(p => p.id === id)));

  // 其他报价表纸张不受影响
  assert.equal(m.getPapersByPriceList("priceList2").length, floor2CountBefore);

  // 旧工艺已清理，新工艺已合入
  assert.equal(m.craftConfig.test_paper_x.length, 1);
  assert.ok(floor1PaperIds.every(id => !m.craftConfig[id]));

  // 边界：空解析结果 / 目标不存在
  assert.equal(m.applyPriceListData("priceList1", { papers: [], crafts: {} }).ok, false);
  assert.equal(m.applyPriceListData("not_exist", parsed).ok, false);
});

// ---------- UI 层：结构 / 渲染 / 绑定存在性 ----------

test("index.html：在线修改标签页位于报价历史与云同步之间", { skip: __skipReason }, () => {
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const tabHistory = html.indexOf('data-tab="history"');
  const tabOnline = html.indexOf('data-tab="online"');
  const tabCloud = html.indexOf('data-tab="cloud"');
  assert.ok(tabHistory !== -1 && tabOnline !== -1 && tabCloud !== -1);
  assert.ok(tabHistory < tabOnline && tabOnline < tabCloud, "顺序应为 报价历史 → 在线修改 → 云同步");
  assert.ok(html.includes('id="panel-online"'));
  // 面板同样夹在中间
  const panelHistory = html.indexOf('id="panel-history"');
  const panelOnline = html.indexOf('id="panel-online"');
  const panelCloud = html.indexOf('id="panel-cloud"');
  assert.ok(panelHistory < panelOnline && panelOnline < panelCloud);
});

test("app.js：在线修改渲染 / 权限门控 / 模板导入导出 / 事件绑定齐备", { skip: __skipReason }, () => {
  const src = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
  // 切到 online 标签时刷新渲染
  assert.match(src, /if \(tabName === "online"\) renderOnlineManager\(\)/);
  // 权限：http 部署仅管理员，本地离线放行
  assert.match(src, /function isOnlineEditAdmin\(\)/);
  assert.match(src, /KOKA\.user && KOKA\.user\.role === "admin"/);
  // 渲染与事件委托
  assert.match(src, /function renderOnlineManager\(\)/);
  assert.match(src, /handleOnlineGroupsClick/);
  assert.match(src, /handleOnlineGroupsChange/);
  assert.match(src, /select\.online-move-select/);
  // 管理员模板流：导出含现有数据 + 原地覆盖导入
  assert.match(src, /function exportPriceListTemplateById\(/);
  assert.match(src, /function importPaperExcelToPriceList\(/);
  assert.match(src, /applyPriceListData\(/);
  assert.match(src, /paperToSheetRows\(paper, pl\)/); // 导出指定报价表模板
  // 绑定存在（bindEvents 内）
  assert.match(src, /els\.onlineGroupsWrap\.addEventListener\("click", handleOnlineGroupsClick\)/);
  assert.match(src, /els\.onlineImportTplFile\.addEventListener\("change"/);
});

test("组配置全链路覆盖：备份/导入/快照/重置/云共享均包含 priceListGroups", { skip: __skipReason }, () => {
  const appSrc = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
  const authSrc = fs.readFileSync(path.join(projectRoot, "js", "auth.js"), "utf8");
  // 本地备份 / 完整配置 / 快照：保存与恢复
  const exportCount = (appSrc.match(/priceListGroups: PRICE_LIST_GROUPS/g) || []).length;
  assert.ok(exportCount >= 3, "本地备份/完整配置/快照/云上传至少 3 处导出 priceListGroups");
  const restoreCount = (appSrc.match(/PRICE_LIST_GROUPS = data\.priceListGroups|PRICE_LIST_GROUPS = item\.data\.priceListGroups/g) || []).length;
  assert.ok(restoreCount >= 3, "本地备份/完整配置/快照恢复共 3 处还原 priceListGroups");
  // 重置为默认：重置 key 列表包含 priceListGroups
  assert.match(appSrc, /"priceLists", "priceListGroups", "currentPriceListId"/);
  assert.match(appSrc, /PRICE_LIST_GROUPS = DEFAULT_PRICE_LIST_GROUPS\.map/);
  // 导入数据校验覆盖组结构
  assert.match(appSrc, /validateArray\(data\.priceListGroups, "报价表组配置"\)/);
  // 云端默认数据下发：auth.js 应用组配置
  assert.match(authSrc, /data\.priceListGroups\) store\('priceListGroups', data\.priceListGroups\)/);
});

test("style.css：在线修改区块样式齐备且使用设计变量", { skip: __skipReason }, () => {
  const css = fs.readFileSync(path.join(projectRoot, "css", "style.css"), "utf8");
  [".online-lock-notice", ".online-group-card", ".online-group-head", ".online-current-badge",
   ".online-move-select", ".online-tpl-row", ".online-tpl-select", ".online-section-gap"
  ].forEach(cls => assert.ok(css.includes(cls), `缺少样式 ${cls}`));
  assert.match(css, /\.online-group-card\s*\{[^}]*var\(--card\)/);
});
