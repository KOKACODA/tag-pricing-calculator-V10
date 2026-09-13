import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

// v9.7.3：1 楼报价表数据变更（28 组 → 33 组）与迁移逻辑测试
function loadDataJs(store) {
  const dataSource = fs.readFileSync(path.join(projectRoot, "js", "data.js"), "utf8");
  const context = {
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); }
    },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    console: { info: () => {}, warn: () => {}, error: () => {} },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    window: { addEventListener: () => {}, removeEventListener: () => {}, confirm: () => true },
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math
  };
  vm.createContext(context);
  vm.runInContext(
    dataSource + "\n" +
    "globalThis.__dataApi = { " +
    "DEFAULT_PAPER_CONFIG, DEFAULT_CRAFT_CONFIG, " +
    "get papers() { return PAPER_CONFIG; }, " +
    "get crafts() { return CRAFT_CONFIG; }, " +
    "get dataVersion() { return loadFromStorage('dataVersion'); } " +
    "};",
    context,
    { filename: "floor1-data.bundle.js" }
  );
  return context.__dataApi;
}

function legacyStore() {
  // 模拟 v9.0.1 老用户：3 楼（含一处用户改价）+ 旧 28 组 1 楼（简化的两条即可证明替换）
  // 注意：真实 saveToStorage 会 JSON.stringify，dataVersion 存储形态是 "\"9.0.1\""
  return new Map([
    ["tagPricing_dataVersion", JSON.stringify("9.0.1")],
    ["tagPricing_paperConfig", JSON.stringify([
      { id: "paper1", priceListId: "priceList2", name: "3楼小组-1", shortName: "350铜版纸", discount: 0.88, specs: [] }, // 3 楼含用户改价
      { id: "paper2_1", priceListId: "priceList1", name: "旧1楼-1", shortName: "700米兰纹", discount: 1, specs: [] },
      { id: "paper2_28", priceListId: "priceList1", name: "旧1楼-28", shortName: "旧纸", discount: 1, specs: [] }
    ])],
    ["tagPricing_craftConfig", JSON.stringify({
      paper1: [{ id: "craft1", name: "3楼工艺", prices: { "1000": 10 } }],
      paper2_1: [{ id: "craft2_1_1", name: "旧1楼工艺", prices: { "1000": 10 } }]
    })]
  ]);
}

test("v9.7.3 默认数据：1 楼 33 组（paper2_1~34 缺 30），3 楼 10 组原样", () => {
  const api = loadDataJs(new Map());
  const f1 = api.DEFAULT_PAPER_CONFIG.filter(p => p.priceListId !== "priceList2");
  const f3 = api.DEFAULT_PAPER_CONFIG.filter(p => p.priceListId === "priceList2");

  assert.equal(f1.length, 33);
  assert.equal(f3.length, 10);
  assert.ok(api.DEFAULT_PAPER_CONFIG.some(p => p.id === "paper2_34"));
  assert.ok(!api.DEFAULT_PAPER_CONFIG.some(p => p.id === "paper2_30"));
  // 合并纸已拆分
  assert.ok(f1.some(p => p.shortName === "600白纹/600黑卡/600牛皮"));
  assert.ok(!f1.some(p => p.shortName === "600白纹/600黑卡/600牛皮/800纹棉"));
  // 新增纸张
  ["85C白卡纸", "200双铜纸", "200厚胶带", "巴黎白彩透卡", "900白金卡"].forEach(sn => {
    assert.ok(f1.some(p => p.shortName === sn), `应存在 ${sn}`);
  });
});

test("v9.7.3 默认数据：抽查价格与源 Excel 一致", () => {
  const api = loadDataJs(new Map());
  const p1 = api.DEFAULT_PAPER_CONFIG.find(p => p.id === "paper2_1");
  assert.equal(p1.shortName, "700米兰纹");
  // vm 跨 realm 对象原型不同，deepStrictEqual 会失败，先 JSON 往返归一到本 realm
  assert.deepEqual(JSON.parse(JSON.stringify(p1.specs[0])), { code: "002", maxArea: 1999, prices: { "1000": 35, "2000": 63, "3000": 91, "4000": 112, "5000": 125, "10000": 230, "20000": 440 } });

  const p5 = api.DEFAULT_PAPER_CONFIG.find(p => p.id === "paper2_5");
  assert.deepEqual(JSON.parse(JSON.stringify(p5.specs[0].prices)), { "1000": 40, "2000": 72, "3000": 105, "4000": 132, "5000": 160, "10000": 305, "20000": 578 });
});

test("v9.7.3 默认工艺：27 组 1 楼工艺段，paper2_1 为 5 项 7 档", () => {
  const api = loadDataJs(new Map());
  const f1Keys = Object.keys(api.DEFAULT_CRAFT_CONFIG).filter(k => /^paper2_\d+$/.test(k));
  assert.equal(f1Keys.length, 27);

  const c1 = api.DEFAULT_CRAFT_CONFIG["paper2_1"];
  assert.equal(c1.length, 5);
  assert.equal(c1[0].name, "无色压凹（单面）");
  assert.equal(Object.keys(c1[0].prices).length, 7);
});

test("v9.9.0 迁移（v10.6 基线）：老用户（9.0.1）1 楼替换为 33 组，3 楼改价保留，工艺重建", () => {
  const store = legacyStore();
  const api = loadDataJs(store);

  assert.equal(api.dataVersion, "9.9.0"); // v10.6 基线:同事版迁移链 9.5.1→9.9.0(无 9.7.3 步)
  const f1 = api.papers.filter(p => p.priceListId !== "priceList2");
  const f3 = api.papers.filter(p => p.priceListId === "priceList2");
  assert.equal(f1.length, 33, "1 楼应为新默认 33 组");
  assert.equal(f3.length, 10, "3 楼应保留 10 组");
  assert.equal(f3.find(p => p.id === "paper1").discount, 0.88, "3 楼用户改价应保留");
  assert.ok(!f1.some(p => p.name === "旧1楼-1"), "旧 1 楼数据应被替换");
  // 工艺：3 楼 key 保留，1 楼按新默认重建（旧工艺名不应存在）
  assert.ok(api.crafts["paper1"], "3 楼工艺应保留");
  assert.equal(api.crafts["paper2_1"][0].name, "无色压凹（单面）", "1 楼工艺应为新默认");
  assert.equal(Object.keys(api.crafts).filter(k => /^paper2_\d+$/.test(k)).length, 27);
});

test("v9.9.0 迁移幂等：已是 9.9.0 的用户再次加载不重复迁移（v10.6 基线）", () => {
  const store = legacyStore();
  loadDataJs(store); // 第一次：迁移至 9.9.0（v10.6 基线）
  assert.equal(JSON.parse(store.get("tagPricing_dataVersion")), "9.9.0"); // 存储值经过 JSON.stringify
  const papersAfterFirst = JSON.parse(store.get("tagPricing_paperConfig"));
  assert.equal(papersAfterFirst.filter(p => p.priceListId !== "priceList2").length, 33);

  const api2 = loadDataJs(store); // 第二次：应跳过迁移
  assert.equal(api2.papers.filter(p => p.priceListId !== "priceList2").length, 33);
  assert.equal(api2.dataVersion, "9.9.0");
});
