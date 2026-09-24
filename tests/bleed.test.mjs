import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

function loadBleedHelpers() {
  const dataSource = fs.readFileSync(path.join(projectRoot, "js", "data.js"), "utf8");
  const appSource = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
  const renderBoundary = appSource.indexOf("const els =");
  assert.notEqual(renderBoundary, -1, "应能定位 DOM 渲染层边界");

  const context = {
    localStorage: { getItem: () => null, setItem: () => {} },
    console: { info: () => {}, warn: () => {}, error: () => {} },
    setTimeout, clearTimeout, Promise, Date, Math, Number, String, Array, Set, JSON
  };
  vm.createContext(context);

  const source = `${dataSource}\n${appSource.slice(0, renderBoundary)}\n` +
    "globalThis.__bleedApi = { " +
    "getRopeBasePrice, calcBleedArea, matchSpec, calcAreaCoefficient " +
    "};";
  vm.runInContext(source, context, { filename: "bleed.bundle.js" });
  return context.__bleedApi;
}

// 唛头「不出血」报价表：规格 maxArea 即区间档位（对应 0-1040-1280-1600-2000-2400-2800-3200-3600-4000）
const MAI_TOU_NO_BLEED = {
  id: "maitou",
  name: "唛头-1：织边带（消光带）",
  shortName: "织边带（消光带）",
  hasBleed: false,
  specs: [
    { code: "1.3*8", maxArea: 1040, prices: {} },
    { code: "1.6*8", maxArea: 1280, prices: {} },
    { code: "2*8",   maxArea: 1600, prices: {} },
    { code: "2.5*8", maxArea: 2000, prices: {} },
    { code: "3*8",   maxArea: 2400, prices: {} },
    { code: "3.5*8", maxArea: 2800, prices: {} },
    { code: "4*8",   maxArea: 3200, prices: {} },
    { code: "4.5*8", maxArea: 3600, prices: {} },
    { code: "5*8",   maxArea: 4000, prices: {} }
  ]
};

test("加吊绳全 0 定价不被视为「未设置 1000 张基准价」", () => {
  const api = loadBleedHelpers();
  // 不加吊绳：500/1000 均为 0，属于合法免费价，应返回 0 而非 null
  assert.equal(api.getRopeBasePrice({ 500: 0, 1000: 0 }), 0);
  // 缺失两者才返回 null
  assert.equal(api.getRopeBasePrice({ 2000: 5, 5000: 10 }), null);
  // 不传对象返回 null
  assert.equal(api.getRopeBasePrice(null), null);
});

test("calcBleedArea 按是否出血决定是否加 3mm", () => {
  const api = loadBleedHelpers();
  assert.equal(api.calcBleedArea(30, 80, true), 33 * 83);   // 出血：四周各 3mm
  assert.equal(api.calcBleedArea(30, 80, false), 30 * 80);  // 不出血：按原尺寸
  assert.equal(api.calcBleedArea(30, 80), 33 * 83);         // 默认出血
});

test("不出血时按固定区间匹配规格（唛头）", () => {
  const api = loadBleedHelpers();
  // 面积 1000 → 区间上限 1040 → 1.3*8
  assert.equal(api.matchSpec(MAI_TOU_NO_BLEED, 1000, false).code, "1.3*8");
  // 面积 1100 → 区间 1280 → 1.6*8
  assert.equal(api.matchSpec(MAI_TOU_NO_BLEED, 1100, false).code, "1.6*8");
  // 面积 3500 → 区间 3600 → 4.5*8
  assert.equal(api.matchSpec(MAI_TOU_NO_BLEED, 3500, false).code, "4.5*8");
  // 面积恰好 2400 → 3*8
  assert.equal(api.matchSpec(MAI_TOU_NO_BLEED, 2400, false).code, "3*8");
  // 面积 2001 落在 (2000,2400] → 3*8
  assert.equal(api.matchSpec(MAI_TOU_NO_BLEED, 2001, false).code, "3*8");
});

test("不出血面积超出最大区间时用最大规格并附面积系数", () => {
  const api = loadBleedHelpers();
  const spec = api.matchSpec(MAI_TOU_NO_BLEED, 4500, false);
  assert.equal(spec.code, "5*8");
  assert.equal(spec.areaCoefficient, api.calcAreaCoefficient(4500));
});

test("出血模式仍走原匹配逻辑（不套区间）", () => {
  const api = loadBleedHelpers();
  const bleedPaper = { ...MAI_TOU_NO_BLEED, hasBleed: true };
  // 出血：面积 1100（含 3mm）→ 最小 >=1100 的规格是 1280 → 1.6*8
  const spec = api.matchSpec(bleedPaper, 1100, true);
  assert.equal(spec.code, "1.6*8");
});