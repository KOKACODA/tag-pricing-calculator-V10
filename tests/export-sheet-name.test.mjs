import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

// v9.7.2：toSafeSheetName 位于 app.js 渲染层之后（导出函数区），按函数名抽取片段单独求值
function loadSheetNameHelper() {
  const appSource = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
  const start = appSource.indexOf("const SHEET_NAME_SANITIZE_MAP");
  const end = appSource.indexOf("function exportPaperExcel()");

  assert.notEqual(start, -1, "应能定位 SHEET_NAME_SANITIZE_MAP");
  assert.notEqual(end, -1, "应能定位 exportPaperExcel");
  assert.ok(end > start, "清洗函数应在导出函数之前");

  const context = { console: { info: () => {}, warn: () => {}, error: () => {} } };
  vm.createContext(context);
  const source = `${appSource.slice(start, end)}\n` +
    "globalThis.__sheetNameApi = { toSafeSheetName };";
  vm.runInContext(source, context, { filename: "sheet-name.helper.js" });
  return context.__sheetNameApi;
}

test("非法半角字符替换为全角等价（/ : ? * [ ] \\）", () => {
  const api = loadSheetNameHelper();
  assert.equal(api.toSafeSheetName("600白纹/600黑卡", new Set()), "600白纹／600黑卡");
  assert.equal(api.toSafeSheetName("a:b?c*d[e]f\\g", new Set()), "a：b？c＊d【e】f＼g");
});

test("超长名称截断至 31 字符且不含非法字符", () => {
  const api = loadSheetNameHelper();
  const long = "400米白/350牛皮/200大地/400木香/160牛油/25c磨砂片"; // 36 字符（1 楼小组-11 实际简称）
  const trimmed = api.toSafeSheetName(long, new Set());
  assert.equal(trimmed.length, 31);
  assert.ok(!/[:\\/?*[\]]/.test(trimmed));
});

test("空名回退为 Sheet，清洗后重名追加序号", () => {
  const api = loadSheetNameHelper();
  assert.equal(api.toSafeSheetName("", new Set()), "Sheet");
  assert.equal(api.toSafeSheetName(null, new Set()), "Sheet");
  assert.equal(api.toSafeSheetName("abc", new Set(["abc"])), "abc(2)");
  assert.equal(api.toSafeSheetName("abc", new Set(["abc", "abc(2)"])), "abc(3)");
});

test("合法名称原样保留（含数字/汉字/全角括号）", () => {
  const api = loadSheetNameHelper();
  assert.equal(api.toSafeSheetName("350铜版纸", new Set()), "350铜版纸");
  assert.equal(api.toSafeSheetName("900克 A级铜版纸 双面过哑胶（厚度1.05mm）", new Set()),
    "900克 A级铜版纸 双面过哑胶（厚度1.05mm）");
});
