# DEPLOYMENT.md · 构建与部署说明

> 当前版本 **v12.9** ｜ 更新 2026-10-10 ｜ 线上 https://kokalabel-quote.pages.dev
> 版本真相源 = 仓库 `index.html` 的 `<title>`。

---

## 一、构建

**没有构建步骤。** 项目是纯静态文件，改完即生效。

唯一的"构建"动作是：**从 git 工作副本生成一个干净的部署目录**
（把内部材料排除掉，避免被当静态资源公开）。

### 部署目录应包含（且只包含）

```
index.html  login.html  robots.txt  _headers  wrangler.toml
css/  js/  functions/  assets/
```

### 必须排除

| 排除项 | 原因 |
|---|---|
| `docs/` | 内部文档（含 handover/、plans/），会被公开访问 |
| `tests/` | 测试脚本 |
| `CHANGELOG.md` `TODO.md` | 内部记录（缺陷跟踪见 `docs/ISSUES.md`） |
| `_backup_*` | 备份目录 |

当前部署源：`E:\Wb\报价优化\KOKALabel-v12.9\`（24 个文件）
> 历史部署快照（v11.0 ~ v12.7）已归档至 `E:\Wb\报价优化\_archive\`，**仅作留存，勿作版本依据**。

---

## 二、部署到 Cloudflare Pages

### 本机可用 SOP（2026-10-09 实战验证）

⚠️ `npx wrangler` 在本机会因环境守卫失败；必须用本机 wrangler 实例直调 cli.js：

```bash
cd <干净部署目录>   # 如 E:\Wb\报价优化\KOKALabel-v11.2（24 个文件：index/login/robots/_headers/wrangler.toml + css/js/functions/assets）

env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy \
  CLOUDFLARE_API_TOKEN=<CF API Token> \
  node --no-warnings --experimental-vm-modules \
    "C:/Users/Mayn/.workbuddy/binaries/node/wrangler3/node_modules/wrangler/wrangler-dist/cli.js" \
    pages deploy "." --project-name kokalabel-quote --branch main
```

⚠️ 坑链记录（详见 `.workbuddy` 项目记忆）：
1. bin/wrangler.js 是 spawn 包装，直接 require cli.js 不会执行 main——必须按上面命令行直调 cli.js。
2. wrangler 安装时 `@esbuild/win32-x64` optional dep 可能静默缺失（npm 环境守卫拦截）→
   所有打包命令**无输出闪退 exit 1**；用 `npm pack @esbuild/win32-x64@0.17.19` 手动解压补齐。
3. 环境注入的代理变量会让 wrangler 走代理失败，必须 `env -u` 清掉。
4. wrangler 3.114.0 在 Windows 管道下 pages deploy 崩溃，**固定用 3.112.0**。

### 旧参考（原机器环境）

```bash
cd "E:\Wb\报价优化\KOKALabel-v12.9"

CLOUDFLARE_API_TOKEN=<CF API Token> \
  npx wrangler@3.114.0 pages deploy "." \
    --project-name kokalabel-quote --branch main
```

### ⚠️ 必须用 wrangler v3

**wrangler v4 不会上传 Functions**（本项目依赖 `/api/*`）。固定用 `wrangler@3.114.0`。

### ⚠️ KV 绑定（最常见的部署失败原因）

`wrangler.toml` 里的 KV id 必须是**本账号**的：

```toml
name = "kokalabel-quote"
compatibility_date = "2024-09-01"
pages_build_output_dir = "."

[[kv_namespaces]]
binding = "AUTH"
id = "b373f627c73048bd9da936db83933c33"
```

- 这是本账号 `KOKA_AUTH` 命名空间的 id（绑定名 `AUTH`），可用以下命令查：
  ```bash
  npx wrangler@3.114.0 kv:namespace list
  ```
- **外部 v10.7.0 包自带的是 `0554f3f4…`（属他人账号）**，
  直接用会报 **`KV namespace not found`** 部署失败。
- `wrangler.toml` **含 KV id，按惯例不入库**（已在 `.gitignore`）。
  所以从 git 拉下代码后，需要**手工创建这个文件**。

### 其它环境变量

| 变量 | 用途 |
|---|---|
| `SETUP_KEY` | 首次初始化系统的密钥（登录页探测 `/api/auth/status`） |
| `ADMIN_USER` / `ADMIN_PASS` | 首次创建的初始管理员账号 |

部署方式为 **direct upload**（非 Git 集成）。

---

## 三、部署后校验（必做）

```bash
# 1) 未登录访问报价接口应 401（说明 Functions 生效 + 账号体系在跑）
curl -s -o /dev/null -w "%{http_code}\n" https://kokalabel-quote.pages.dev/api/quote

# 2) 初始化状态（应 {"ok":true,"initialized":true}）
curl -s https://kokalabel-quote.pages.dev/api/auth/status

# 3) 首页标题与版本
curl -s https://kokalabel-quote.pages.dev/ | grep -o "<title>[^<]*</title>"
#    期望 <title>KOKALabel报价系统 v12.9</title>

# 4) 静态资源版本参数
curl -s https://kokalabel-quote.pages.dev/ | grep -o 'js/[a-z.]*?v=[0-9.]*'
#    期望全部 ?v=10.8.0
```

部署成功会输出预览地址形如 `https://<hash>.kokalabel-quote.pages.dev`；
生产域名固定为 `https://kokalabel-quote.pages.dev`。

---

## 四、推送 GitHub

仓库：`https://github.com/zly62612364469/kokalabel-quote`（**私有**）

### 4.1 ⚠️ 本机网络有三重坑

1. 环境注入了本地代理 `http_proxy=http://127.0.0.1:19134` → 走它必失败
2. `hosts` 把 `github.com` 解析到本地假服务 → 必须用 `curloptResolve` 固定真实 IP
3. 直连**时通时断**（成功率约 1/10 ~ 1/2）→ 必须写重试循环

（`curl` 全程返回 000 不可用，只有 git 的 schannel 路径能通。）

### 4.2 唯一可用命令形态

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  git -c http.schannelCheckRevoke=false \
      -c http.curloptResolve="github.com:443:20.205.243.166" \
      push "https://x-access-token:<PAT>@github.com/zly62612364469/kokalabel-quote.git" \
      "refs/heads/main:refs/heads/main" \
      "refs/heads/vX.Y-dev:refs/heads/vX.Y-dev" \
      "refs/tags/vX.Y.Z:refs/tags/vX.Y.Z"
```

- 提交信息文件用 **Windows 原生路径**（`git.exe` 不认 MSYS 的 `/tmp`）
- 本地已有同名 tag → 需 `push --force refs/tags/X:refs/tags/X`
- 推完**务必 `ls-remote` 回读校验**

### 4.3 ⚠️ 当前 PAT 状态

**旧 PAT 已失效**（`Invalid username or token`，2026-10-07 确认）。
接手后请重新生成（需 `repo` 权限；fine-grained token 需 `Contents: Read and write`）。

### 4.4 本机 `git merge` 会挂起

改用 plumbing：

```bash
git add -A
TREE=$(git write-tree)
NEW=$(git commit-tree "$TREE" -p <parent_sha> -F "E:/Wb/报价优化/_msg.txt")
printf '%s\n' "$NEW" > .git/refs/heads/main
printf '%s\n' "$NEW" > .git/refs/tags/vX.Y.Z
git pack-refs --all
```

所有写 `.git` 的操作需**关闭沙箱**，否则 `.git/refs/**` 的写入会被静默丢弃
（表现为 git 突然报 `not a git repository`，即使 `.git` 目录完整）。

---

## 五、发布 checklist

- [ ] 版本号已更新（python 精确替换，非 sed）
- [ ] `CHANGELOG.md` 已写新版本段落
- [ ] 回归测试全绿
- [ ] 提交推送 GitHub，`ls-remote` 已回读校验
- [ ] 生成干净部署目录
- [ ] `wrangler@3.114.0` 部署成功
- [ ] 线上四项校验通过（401 / initialized / title / `?v=`)
- [ ] 更新工作日志与 `TODO.md`

---

## 六、回滚

Cloudflare Pages 控制台 → 该项目 → Deployments → 选历史版本 → **Rollback**。
（Git 侧回滚用 `git revert` 或直接部署旧部署源目录。）
