import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

// v10.6.0：v10.5 用 sanitizeSheetName 函数替代 v9.7.2 的 SHEET_NAME_SANITIZE_MAP + toSafeSheetName。
// 差异：非法字符替换为下划线（非 9.8 的全角等价）；无重名序号处理（同名 sheet 直接覆盖）。
// 该差异已记录于 docs/功能差别标记-9.8与10.6.md。
function loadSheetNameHelper() {
  const appSource = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
  const start = appSource.indexOf("function sanitizeSheetName(name)");
  const end = appSource.indexOf("function exportPaperExcelInner()");

  assert.notEqual(start, -1, "应能定位 sanitizeSheetName");
  assert.notEqual(end, -1, "应能定位 exportPaperExcelInner");
  assert.ok(end > start, "清洗函数应在导出函数之前");

  const context = { console: { info: () => {}, warn: () => {}, error: () => {} } };
  vm.createContext(context);
  const source = `${appSource.slice(start, end)}\n` +
    "globalThis.__sheetNameApi = { sanitizeSheetName };";
  vm.runInContext(source, context, { filename: "sheet-name.helper.js" });
  return context.__sheetNameApi;
}

test("非法半角字符替换为下划线（/ : \\ ? * [ ]）", () => {
  const api = loadSheetNameHelper();
  assert.equal(api.sanitizeSheetName("600白纹/600黑卡"), "600白纹_600黑卡");
  assert.equal(api.sanitizeSheetName("a:b?c*d[e]f\\g"), "a_b_c_d_e_f_g");
});

test("超长名称截断至 31 字符且不含非法字符", () => {
  const api = loadSheetNameHelper();
  const long = "400米白/350牛皮/200大地/400木香/160牛油/25c磨砂片"; // 36 字符（1 楼小组-11 实际简称）
  const trimmed = api.sanitizeSheetName(long);
  assert.equal(trimmed.length, 31);
  assert.ok(!/[:\\/?*[\]]/.test(trimmed));
});

test("空名/无值回退为 Sheet", () => {
  const api = loadSheetNameHelper();
  assert.equal(api.sanitizeSheetName(""), "Sheet");
  assert.equal(api.sanitizeSheetName(null), "Sheet");
  assert.equal(api.sanitizeSheetName(undefined), "Sheet");
});

test("合法名称原样保留（含数字/汉字/全角括号）", () => {
  const api = loadSheetNameHelper();
  assert.equal(api.sanitizeSheetName("350铜版纸"), "350铜版纸");
  assert.equal(api.sanitizeSheetName("900克 A级铜版纸 双面过哑胶（厚度1.05mm）"),
    "900克 A级铜版纸 双面过哑胶（厚度1.05mm）");
});
