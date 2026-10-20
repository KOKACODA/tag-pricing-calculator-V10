# DEVELOPMENT.md · 开发与验证流程

> 当前版本 **v12.9** ｜ 更新 2026-10-10
> 版本真相源 = 仓库 `index.html` 的 `<title>`。

---

## 一、环境

无需安装任何依赖 —— 项目是纯静态、无构建。

| 用途 | 工具 |
|---|---|
| 本地运行 | 浏览器直接打开 `index.html` |
| 语法检查 | Node.js（`node --check`） |
| 功能验证 | Node.js + jsdom（自建回归脚本） |
| 部署 | Node.js + wrangler v3（本机实例见 docs/DEPLOYMENT.md 第二节） |

本机路径（供 AI Agent 参考，2026-10-09 更新）：

```
node    = C:/Users/Mayn/.workbuddy/binaries/node/versions/22.22.2-6/node.exe
jsdom   = C:/Users/Mayn/.workbuddy/binaries/node/workspace/node_modules/jsdom   （NODE_PATH 引用）
wrangler = C:/Users/Mayn/.workbuddy/binaries/node/wrangler3/node_modules/wrangler（v3.112.0，含手动补的 @esbuild/win32-x64）
git     = 系统Git（仓库级身份已配置 zly62612364469@users.noreply.github.com）
⚠️ 回归测试 = 仓库内 `tests/` 下的 jsdom 综合回归脚本（覆盖计价/就地编辑/页面/浮窗/折叠）+ 静态检查
   （旧路径 `E:/报价系统7.9/_verify/v1080.test.cjs` 已废弃，勿再引用）
```

---

## 二、日常开发循环

```
1. 跑一次综合回归建立基线（jsdom 全绿为准）
        NODE_PATH=<workspace>/node_modules node <回归脚本>

2. 改代码（只改本仓库 kokalabel-quote/）

3. 语法检查
        node --check js/app.js && node --check js/data.js
        node --check js/auth.js && node --check js/login.js
        # 以及 functions/**/*.js

4. 行尾符检查（CRLF 必须为 0）

5. 再跑回归测试；如改了行为，补/改断言

6. 本地肉眼验收：双击 index.html

7. 发布（见 docs/DEPLOYMENT.md）
```

---

## 三、功能验证：用 jsdom，不要用 Edge headless

### 为什么不用 Edge headless
- `--dump-dom` 在 **DOMContentLoaded 就快照**，body 末尾的内联探针脚本**根本不执行**
- `--screenshot` + `--virtual-time-budget` 同样不跑那些脚本
- 结果：探针永远读到初始态，**把正常代码误判成"功能坏了"**

### jsdom 正确姿势（三个缺一不可）

```js
const { JSDOM } = require("C:/Users/Mayn/.workbuddy/binaries/node/workspace/node_modules/jsdom");

// 1) 必须在同一进程内起静态服务器
const srv = http.createServer(/* 读 ROOT 下的文件并返回，带正确 MIME */);
await new Promise(r => srv.listen(PORT, r));

// 2) 用 fromURL（不能直接传 HTML 字符串，否则 js/*.js 与 css/*.css 全部 404）
const dom = await JSDOM.fromURL(`http://localhost:${PORT}/index.html`, {
  runScripts: "dangerously", resources: "usable", pretendToBeVisual: true
});

// 3) stub 网络（auth.js 会请求 /api/*，本机无 Functions）
window.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
window.XMLHttpRequest = class { open(){} send(){} addEventListener(){} /* ... */ };
```

### ⚠️ 顶层 `let`/`const` 不挂 `window`

`data.js` / `app.js` 是普通脚本，其中：

- 顶层 **`function` 声明** → 挂到 `window`，可直接 `window.calculate(...)`
- 顶层 **`let` / `const`**（`ROPE_CONFIG` / `SHIPPING_CONFIG` / `PAPER_CONFIG` 等）
  → **不是 `window` 属性**，`window.ROPE_CONFIG` 恒为 `undefined`

要用它们必须回到页面上下文：

```js
const regionId = window.eval("SHIPPING_CONFIG[0].id");
const rope0    = window.eval('ROPE_CONFIG.find(function(r){return r.id==="rope0";})');
```

> 若测试报 `Cannot read properties of undefined (reading '0')`，先怀疑这一条。

### 可断言的东西
`classList` 状态、`getComputedStyle`、`localStorage`、页面渲染出的文本、
以及直接调用纯函数（`calculate` / `matchSpec` / `getRopeBasePrice` …）的结果。

---

## 四、提交前检查清单

- [ ] 回归测试全绿（自建 jsdom 综合回归；原 `_verify/v1080.test.cjs` 未进仓库，重建列入 TODO）
- [ ] `node --check` 前端 JS + `functions/**/*.js` 全部通过
- [ ] 全项目 CRLF = 0
- [ ] 改过 HTML id → 已全局 grep 旧 id，`els` 悬空引用 = 0
- [ ] HTML 标签栈配对（无未闭合）
- [ ] 新版本串计数正确；旧版本串残留仅限"历史注释"
- [ ] 清理临时脚本 / 探针文件
- [ ] 无凭据残留：`grep -rl "ghp_\|cfut_" . --exclude-dir=node_modules`

---

## 五、写代码时的四条硬约束

1. **行尾符 LF** —— python 写文件必须 `write_bytes()` 或 `open(..., newline="\n")`
   （`write_text()` 在 Windows 上默认转 CRLF）
2. **改 id 必须同步 `els`** —— 否则产生静默失效（见 [PAGE-STRUCTURE.md](./PAGE-STRUCTURE.md) 第五节）
3. **重渲染必须重绑事件 + 保留用户当前选择**
4. **新增报价表级字段必须配迁移** —— 老用户 localStorage 里没有这个字段

---

## 六、发布流程

见 [DEPLOYMENT.md](./DEPLOYMENT.md)。顺序固定为：

**改版本号 → 写 CHANGELOG → 跑测试 → 提交推送 → 生成干净部署源 → 部署 → 线上校验**

---

## 七、AI Agent 协作

本仓库根目录有 [AGENTS.md](../AGENTS.md)，包含铁律、高危模式与提交规范。
AI Agent 在本仓库工作时请先读该文件。
