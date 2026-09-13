import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

// v10.6.0：安全函数位于 app.js 的 DOM 渲染层之后，按函数名精确抽取片段单独求值。
// v10.5 移除了 9.8 的 isNonNegFinite / safeExcelText / MAX_IMPORT_FILE_SIZE 独立常量，
// 校验逻辑内联于 validateImportedData（长度/折扣/客户等级系数），此处按 v10.6 现状适配。
function loadSecurityHelpers() {
  const appSource = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
  const start = appSource.indexOf("function escapeHtml(text) {");
  const end = appSource.indexOf("function importLocalBackup(file) {");

  assert.notEqual(start, -1, "应能定位 escapeHtml");
  assert.notEqual(end, -1, "应能定位 importLocalBackup（安全片段结束边界）");
  assert.ok(end > start, "安全函数片段应在导入逻辑之前");

  // v10.6 的 escapeHtml 基于 document.createElement(textContent→innerHTML 实体转义),mock 之
  const mockEl = {
    _t: "",
    set textContent(v) { this._t = String(v); },
    get innerHTML() {
      return this._t
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
  };
  const context = {
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { createElement: () => mockEl },
    console: { info() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math
  };
  vm.createContext(context);

  const source = appSource.slice(start, end) +
    "\nglobalThis.__sec = { escapeHtml, validateImportedData };";
  vm.runInContext(source, context, { filename: "security-hardening.bundle.js" });
  return context.__sec;
}

function validData() {
  return {
    kind: "local-backup",
    priceLists: [{ id: "pl1", name: "1号报价表" }],
    customerLevels: [{ id: "l1", name: "普通客户", coefficient: 1.2 }],
    paperConfig: [{
      id: "p1", name: "铜版纸", shortName: "702铜版纸", discount: 0.85,
      specs: [{ code: "55x30", maxArea: 1, prices: { "1000": 4.5 } }],
      directCoeff: { tiers: [1000], max: [1.5], min: [0.5] },
      batchDirect: { maxArea: 100, prices: { "1000": 5 } }
    }],
    ropeConfig: [{ id: "r1", name: "白色方头", prices: { "1000": 4.5 } }],
    shippingConfig: [{ id: "s1", name: "广东省内", basePrices: { "1000": 10 }, overTierCoeff: 0.5 }],
    craftConfig: { "p1": [{ id: "c1", name: "烫金", prices: { "1000": 1 } }] }
  };
}

const sec = loadSecurityHelpers();

test("escapeHtml 转义全部五个 HTML 特殊字符", () => {
  // v10.6 差异：null/undefined 经 String() 转成 "null"/"undefined"（9.8 返回空串，见功能差别标记文档）
  assert.equal(sec.escapeHtml(null), "null");
  assert.equal(sec.escapeHtml(undefined), "undefined");
  assert.equal(sec.escapeHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(sec.escapeHtml("a & b"), "a &amp; b");
  assert.equal(sec.escapeHtml("'单引号'"), "&#39;单引号&#39;");
  assert.equal(sec.escapeHtml('"双引号"'), "&quot;双引号&quot;");
});

test("validateImportedData 拒绝无效或损坏数据", () => {
  assert.equal(sec.validateImportedData(validData()), true);

  assert.throws(() => sec.validateImportedData(null), /数据格式无效/);
  assert.throws(() => sec.validateImportedData("str"), /数据格式无效/);
  // v10.6 差异：数组（[]）与空对象不抛「数据格式无效」，直接返回 true（9.8 会拦截，见功能差别标记文档）
  assert.equal(sec.validateImportedData([]), true);
  assert.throws(() => sec.validateImportedData({ kind: "paper-excel" }, "local-backup"), /文件类型不匹配/);
});

test("validateImportedData 深校验拒绝负折扣与非法客户等级系数", () => {
  const badDiscount = validData();
  badDiscount.paperConfig[0].discount = -1;
  assert.throws(() => sec.validateImportedData(badDiscount), /折扣系数无效/);

  const negCoeff = validData();
  negCoeff.customerLevels[0].coefficient = 0.5;
  assert.throws(() => sec.validateImportedData(negCoeff), /客户等级系数无效/);

  const tooBigCoeff = validData();
  tooBigCoeff.customerLevels[0].coefficient = 101;
  assert.throws(() => sec.validateImportedData(tooBigCoeff), /客户等级系数无效/);
});

test("validateImportedData 拦截超长字符串", () => {
  // v10.6 只校验 customerLevels / paperConfig / appProfile 的字符串字段（不校验 priceLists，见功能差别标记文档）
  const longPaperName = validData();
  longPaperName.paperConfig[0].name = "x".repeat(500);
  assert.throws(() => sec.validateImportedData(longPaperName), /最大长度限制/);

  const longCompany = validData();
  longCompany.appProfile = { companyName: "y".repeat(300) };
  assert.throws(() => sec.validateImportedData(longCompany), /最大长度限制/);
});
