import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

function loadQuoteHistoryHelpers() {
  const dataSource = fs.readFileSync(path.join(projectRoot, "js", "data.js"), "utf8");
  const appSource = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
  const renderBoundary = appSource.indexOf("const els =");

  assert.notEqual(renderBoundary, -1, "应能定位 DOM 渲染层边界");

  const context = {
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    console: {
      info: () => {},
      warn: () => {},
      error: () => {}
    },
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math
  };
  vm.createContext(context);

  const source = `${dataSource}\n${appSource.slice(0, renderBoundary)}\n` +
    "globalThis.__quoteHistoryApi = { " +
    "shouldShowDefaultQuoteCards, formatQuoteRecordNumber, buildQuoteHistoryRecord, " +
    "computeStandardOverridePrice, computeDirectTempTotals " +
    "};";
  vm.runInContext(source, context, { filename: "quote-history.bundle.js" });
  return context.__quoteHistoryApi;
}

// v9.6：getHistoryRecordPrimaryPrice 位于渲染层之后，按函数名抽取片段单独求值
function loadPrimaryPriceHelper() {
  const dataSource = fs.readFileSync(path.join(projectRoot, "js", "data.js"), "utf8");
  const appSource = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
  const start = appSource.indexOf("function getHistoryRecordPrimaryPrice(record) {");
  const end = appSource.indexOf("function getHistoryRecordTier(record) {");
  assert.notEqual(start, -1, "应能定位 getHistoryRecordPrimaryPrice");
  assert.notEqual(end, -1, "应能定位 getHistoryRecordTier");

  const context = { console: { info: () => {}, warn: () => {}, error: () => {} } };
  vm.createContext(context);
  const source = `${dataSource}\n${appSource.slice(start, end)}\n` +
    "globalThis.__primaryPriceApi = { getHistoryRecordPrimaryPrice };";
  vm.runInContext(source, context, { filename: "primary-price.helper.js" });
  return context.__primaryPriceApi;
}

test("默认报价显隐偏好只影响标准报价", () => {
  const api = loadQuoteHistoryHelpers();

  assert.equal(api.shouldShowDefaultQuoteCards("standard", true), true);
  assert.equal(api.shouldShowDefaultQuoteCards("standard", false), false);
  assert.equal(api.shouldShowDefaultQuoteCards("direct", false), true);
});

test("报价记录编号使用固定的日期时间格式", () => {
  const api = loadQuoteHistoryHelpers();
  const createdAt = new Date(2026, 8, 2, 14, 30, 45);

  assert.equal(api.formatQuoteRecordNumber(createdAt), "BJ-20260902-143045");
});

test("客户名为空时使用编号，有客户名时使用修剪后的客户名", () => {
  const api = loadQuoteHistoryHelpers();
  const base = {
    id: "history-1",
    createdAt: new Date(2026, 8, 2, 14, 30, 45),
    note: "  秋季吊牌订单  ",
    mode: "standard",
    priceList: { id: "priceList1", name: "1号报价表" },
    inputs: { tier: 1000, sheets: [{ paperId: "paper1", width: "55", length: "30" }] },
    result: { cost: 72, pricesByLevel: [{ levelName: "普通客户", price: 86.4 }] },
    ropeName: "白色方头",
    regionName: "广东省内"
  };

  const unnamed = api.buildQuoteHistoryRecord({ ...base, customerName: "   " });
  const named = api.buildQuoteHistoryRecord({ ...base, id: "history-2", customerName: "  海成服饰  " });

  assert.equal(unnamed.title, "BJ-20260902-143045");
  assert.equal(unnamed.customerName, "");
  assert.equal(named.title, "海成服饰");
  assert.equal(named.customerName, "海成服饰");
  assert.equal(named.note, "秋季吊牌订单");
  assert.equal(named.schemaVersion, 2);
});

test("历史记录深拷贝输入和计算结果", () => {
  const api = loadQuoteHistoryHelpers();
  const inputs = { tier: 1000, sheets: [{ paperId: "paper1", width: "55", length: "30" }] };
  const result = { cost: 72, pricesByLevel: [{ levelName: "普通客户", price: 86.4 }] };

  const record = api.buildQuoteHistoryRecord({
    id: "history-3",
    createdAt: new Date(2026, 8, 2, 14, 30, 45),
    customerName: "测试客户",
    note: "",
    mode: "standard",
    priceList: { id: "priceList1", name: "1号报价表" },
    inputs,
    result,
    ropeName: "白色方头",
    regionName: "广东省内"
  });

  inputs.sheets[0].width = "99";
  result.cost = 999;
  result.pricesByLevel[0].price = 999;

  assert.equal(record.inputs.sheets[0].width, "55");
  assert.equal(record.snapshot.cost, 72);
  assert.equal(record.snapshot.pricesByLevel[0].price, 86.4);
});

test("v9.6 保存时生效的临时修改写入 snapshot.override 并深拷贝", () => {
  const api = loadQuoteHistoryHelpers();
  const base = {
    id: "override-1",
    createdAt: new Date(2026, 8, 2, 14, 30, 45),
    customerName: "测试客户",
    note: "",
    mode: "standard",
    priceList: { id: "priceList1", name: "1号报价表" },
    inputs: { tier: 1000 },
    result: { cost: 72, shippingPrice: 8, pricesByLevel: [{ levelName: "普通客户", price: 86.4 }] },
    ropeName: "",
    regionName: "广东省内"
  };

  // 无临时修改 → 不写入 override
  const plain = api.buildQuoteHistoryRecord({ ...base });
  assert.equal(plain.snapshot.override, undefined);

  // 有临时修改 → 写入并深拷贝（外部改动不影响记录）
  const overrideInput = { kind: "standard", coeff: 1.35, newShipping: 10, price1: 100, price2: 99 };
  const modified = api.buildQuoteHistoryRecord({ ...base, id: "override-2", override: overrideInput });
  overrideInput.price1 = 999;
  assert.equal(modified.snapshot.override.kind, "standard");
  assert.equal(modified.snapshot.override.coeff, 1.35);
  assert.equal(modified.snapshot.override.price1, 100);
});

test("v9.6 历史价格读取优先返回临时修改后的价格", () => {
  const api = loadPrimaryPriceHelper();
  const baseRecord = {
    id: "price-1",
    snapshot: { cost: 72, pricesByLevel: [{ levelName: "普通客户", price: 86.4 }] }
  };

  // 无 override → 原 pricesByLevel 价格
  assert.equal(api.getHistoryRecordPrimaryPrice(baseRecord), 86.4);

  // 标准模式：系数 + 邮费都修改 → price1
  const both = { ...baseRecord, snapshot: { ...baseRecord.snapshot, override: { kind: "standard", coeff: 1.35, newShipping: 10, price1: 100, price2: 99 } } };
  assert.equal(api.getHistoryRecordPrimaryPrice(both), 100);

  // 标准模式：仅系数修改 → price
  const coeffOnly = { ...baseRecord, snapshot: { ...baseRecord.snapshot, override: { kind: "standard", coeff: 1.35, price: 97.2 } } };
  assert.equal(api.getHistoryRecordPrimaryPrice(coeffOnly), 97.2);

  // 标准模式：仅邮费修改 → 第一个等级修改后价
  const shipOnly = { ...baseRecord, snapshot: { ...baseRecord.snapshot, override: { kind: "standard", newShipping: 10, newCost: 74, pricesByLevel: [{ levelName: "普通客户", price: 88.8 }] } } };
  assert.equal(api.getHistoryRecordPrimaryPrice(shipOnly), 88.8);

  // 直接系数模式：临时系数总价
  const direct = { ...baseRecord, snapshot: { ...baseRecord.snapshot, override: { kind: "direct", total: 123.45, items: [] } } };
  assert.equal(api.getHistoryRecordPrimaryPrice(direct), 123.45);

  // override 存在但价格非法 → 回退原价
  const fallback = { ...baseRecord, snapshot: { ...baseRecord.snapshot, override: { kind: "standard" } } };
  assert.equal(api.getHistoryRecordPrimaryPrice(fallback), 86.4);
});

test("v9.7 computeStandardOverridePrice 四分支：无修改 / 仅系数 / 双修改 / 仅邮费", () => {
  const api = loadQuoteHistoryHelpers();
  const result = {
    cost: 72,
    shippingPrice: 8,
    costIncomplete: false,
    pricesByLevel: [{ levelName: "普通客户", coefficient: 1.2 }]
  };

  // 无任何生效修改 → null（不写入 override）
  assert.equal(api.computeStandardOverridePrice(result, {}), null);
  assert.equal(api.computeStandardOverridePrice(result, { coeff: 1.35, newShipping: 10, hasCoeff: false, hasShipOverride: false }), null);

  // 仅临时系数：price = 成本 × 系数
  const coeffOnly = api.computeStandardOverridePrice(result, { coeff: 1.35, newShipping: 10, hasCoeff: true, hasShipOverride: false });
  assert.equal(coeffOnly.price, 72 * 1.35);
  assert.equal(coeffOnly.price1, undefined);

  // 系数 + 邮费都修改：双算法价（渲染卡片与保存记录同源）
  const both = api.computeStandardOverridePrice(result, { coeff: 1.35, newShipping: 10, hasCoeff: true, hasShipOverride: true });
  assert.equal(both.newCost, 72 - 8 + 10);
  assert.equal(both.price1, (72 - 8 + 10) * 1.35);
  assert.equal(both.price2, (72 - 8) * 1.35 + 10);

  // 仅邮费快速修改：修改后成本 + 各客户等级按系数重算
  const shipOnly = api.computeStandardOverridePrice(result, { coeff: 1.35, newShipping: 10, hasCoeff: false, hasShipOverride: true });
  assert.equal(shipOnly.newCost, 74);
  assert.equal(shipOnly.pricesByLevel.length, 1);
  assert.equal(shipOnly.pricesByLevel[0].price, 74 * 1.2);
});

test("v9.7 computeDirectTempTotals 计算每纸临时系数（渲染与保存同源）", () => {
  const api = loadQuoteHistoryHelpers();
  // paperId 不存在于任何报价表 → hasDirect=false、discount=1，测试不依赖具体默认数据
  const result = {
    tier: 1000,
    sheetDetails: [
      { paperId: "paper-nope-1", paperName: "测试纸A", unitPrice: 80, originalUnitPrice: 100, sheetCraftTotal: 20 },
      { paperId: "paper-nope-2", paperName: "测试纸B", unitPrice: 60, originalUnitPrice: 60, sheetCraftTotal: 0, isBatchDirect: true }
    ],
    batchDirectTotal: 60,
    batchDirectCraftTotal: 0
  };

  const r = api.computeDirectTempTotals(result, ["1.5", "1"]);
  // 纸A：(基础价100 × 1 + 工艺20) × 1.5 = 180；纸B：批量直接价 60（已含在 batchDirectTotal）
  assert.equal(r.total, 240);
  assert.equal(r.modified, true);
  assert.equal(r.incomplete, false);
  assert.equal(r.items[0].kind, "temp");
  assert.equal(r.items[0].price, 180);
  assert.equal(r.items[0].def, 1);
  assert.equal(r.items[1].kind, "batchDirect");
  assert.equal(r.items[1].price, 60);

  // 全部系数等于默认值 → modified=false（保存时不写入 override）
  const untouched = api.computeDirectTempTotals(result, ["1", "1"]);
  assert.equal(untouched.modified, false);

  // 无效系数（空/非数字/<0.01）→ incomplete=true 且该纸标记 invalid
  const invalid = api.computeDirectTempTotals(result, ["abc", "1"]);
  assert.equal(invalid.incomplete, true);
  assert.equal(invalid.items[0].kind, "invalid");

  // 批量直接价缺价 → incomplete=true
  const missing = api.computeDirectTempTotals(
    { ...result, batchDirectTotal: 0, sheetDetails: result.sheetDetails.map(sd => ({ ...sd, unitPrice: sd.isBatchDirect ? null : sd.unitPrice })) },
    ["1", "1"]
  );
  assert.equal(missing.incomplete, true);
  assert.equal(missing.items[1].price, null);
});

