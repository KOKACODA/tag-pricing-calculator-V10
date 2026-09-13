# KOKALabel 报价系统 · 网页版账号体系 + 角色 + 报价云端默认 部署说明（v9.4.0）

> 日期：2026-09-08 ｜ 状态：已上线（含顶栏防遮挡修复 v9.4.1）

## 一、线上地址
- **站点**：https://kokalabel-quote.pages.dev （Cloudflare Pages）
- **代码仓库**：https://github.com/zly62612364469/kokalabel-quote （私有）

## 二、账号体系

### 角色矩阵（v9.4.0）
| 角色 | 范围 | 改报价 | 改/删账号 |
|---|---|---|---|
| 超级管理员 superadmin | 全部 | ✅ 可改 + 发布为全局默认 | ✅ 全权（含角色升降、停用） |
| 管理员 admin | 销售/访客/同/低级管理员 | ❌（只读） | ✅ 互管/互停/互删（不删自己、不动超管、不删最后一名管理员） |
| 业务员 sales | 全部页面，只读 | ❌ | ❌ |
| 访客 visitor | 仅智能报价计算器 | ❌ | ❌ |

> 角色归一：旧数据 `role:'user'` 自动视为 `sales`。当前线上初始账号 `admin` 已被提升为 **superadmin**（`u:admin` 的 role=KV 写入）。

### 登录与使用
- 访问网页 → 自动跳 `login.html`；账号密码登录。
- 顶栏右端显示当前账号、角色徽章与"退出"按钮（不悬浮，集成在导航栏右侧）。
- 个人主页显示当前账号信息；超管/管理员可看到"账号管理"卡片：
  - 新增账号（选角色、昵称、使用天数、初始密码）
  - 行内操作：改角色 / 改昵称 / 重置密码 / 设时长 / 停用·启用 / 删除（按权限显隐）
  - 包含每个账号的最近登录时间 / 设备(UA) / IP
- 账号到期后登录被拒（提示"使用期限已到"），超管/管理员续期。
- 本地 `file://` 双击 / exe **不受登录影响**（仅 http 部署强制登录）。

### 报价默认数据云端共享（v9.4.0）
- 报价表组查询页右上角"↑ 保存为全局默认"（**仅 superadmin 可见**）：把当前纸张/工艺/吊绳/邮费四套数据发布到云端。
- 业务员/访客/管理员登录后，前端自动 GET `/api/quote`，若版本比本地新 → 覆盖本地 localStorage 并刷新一次。
- **v9.4.1/9.4.2 自动同步**：**所有登录角色（超管/管理员/业务员/访客）每 30 秒**静默检测 `/api/quote`，发现有人新发布 → 提示「正在刷新应用…」→ 1 秒后自动刷新（无需手动刷新/重登）。超管本地若有未发布修改、遇他人发布会被覆盖（刷新前有提示）。

## 三、文件结构
```
functions/                         # Cloudflare Pages Functions（后端）
  _lib.js                          # 共享：密码 PBKDF2、会话、KV 读写、角色 rank/canManage
  api/auth/login.js                # 登录（含首次 SETUP_KEY 初始化）
  api/auth/session.js              # 会话校验（含 role 归一）
  api/auth/logout.js               # 登出
  api/admin/users.js               # 超管/管理员：列账号、创建账号（带角色+昵称）
  api/admin/users/[name].js        # 超管/管理员：改密/设时长/启停/改角色/删除（权限矩阵）
  api/quote.js                     # 云端默认报价：GET（任意登录）/ POST（仅 superadmin）
login.html                         # 登录页
js/auth.js                         # 前端拦截 + 顶栏 + 管理面板 + 云同步 + 上传按钮
js/app.js                          # 页面守卫（访客仅计算器）+ 编辑只读守卫 + 折叠
css/style.css                      # 折叠/角色徽章/顶栏样式
```
- KV `KOKA_AUTH`（命名空间 id `b373f627...`）：账号 `u:<name>`、会话 `s:<token>`（TTL 7 天）、云端默认 `q:v1`
- 环境变量（Pages 项目 → Settings → Environment variables）：`SETUP_KEY` / `ADMIN_USER` / `ADMIN_PASS`
- KV 绑定：Functions 绑定名 `AUTH`（指向 KOKA_AUTH）

## 四、UI 交互细节
- **计算器「附加工艺」「吊绳类型」默认折叠**（点击标题展开，▸ 箭头指示）
- **报价表就地编辑只读保护**：非 superadmin 角色点击价格单元格 → 提示"仅超级管理员可修改"
- **访客导航**：隐藏"报价表组查询""个人主页"，强制停留在计算器
- **顶栏防遮挡**：账号/角色/退出按钮内嵌到顶部导航栏（`nav.nav-inner`）右端，与"个人主页"按钮同栏

## 五、API 一览
| 方法 | 路径 | 权限 | 用途 |
|---|---|---|---|
| POST | `/api/auth/login` | 公开 | 登录；首次传 `setupKey` 初始化管理员 |
| GET  | `/api/auth/session` | 登录 | 会话校验（含 role 归一） |
| POST | `/api/auth/logout` | 登录 | 注销 |
| GET  | `/api/admin/users` | 角色 rank≥2 | 列出所有账号（按角色排序） |
| POST | `/api/admin/users` | 角色 rank≥2 | 创建账号（超管可建超管/管/业/访；管理员可建管/业/访） |
| PATCH | `/api/admin/users/<name>` | actor 可管理 target（或自己） | 改昵称/密码/时长/启停/角色 |
| DELETE | `/api/admin/users/<name>` | actor 可管理 target 且非自己 | 删除账号（默认保留≥1管理员） |
| GET  | `/api/quote` | 任意登录 | 获取云端默认报价数据 |
| POST | `/api/quote` | **仅 superadmin** | 发布全量默认数据（纸张/工艺/吊绳/邮费） |

## 六、重新部署
```bash
export CLOUDFLARE_API_TOKEN=<你的token>
export CLOUDFLARE_ACCOUNT_ID=27625dbe76d8de686bcc821c5a7ff0df
npx wrangler@3.114.0 pages deploy "E:/报价系统7.9/KOKALabel报价系统-v7.8" --project-name kokalabel-quote --branch main
```
（Pages Functions 必须用 wrangler v3 才会打包上传；v4 不会上传 Functions bundle）

## 七、安全要点
- 密码 PBKDF2(10万次)+随机盐；会话 token 随机 KV 存储 TTL 7 天
- 超级管理员是唯一能发布默认报价的角色；**首次部署后请立刻改 ADMIN_PASS 并在 admin 登录后通过「个人主页 → 修改密码」改密**
- localStorage 中的报价数据仅对超管生效；其它角色被云端默认自动覆盖
- 停用立即生效（修复了原"停用仍能登录"的 bug）

（本项目推送 GitHub main 后，也可在 CF 项目接入 Git 自动构建，本次用 direct upload）

## 五、安全要点
- 密码 PBKDF2(100k)+随机盐；会话随机 token 存 KV（TTL 7 天）
- 账号到期按服务器时间判断；管理员端 API 均校验会话+角色
- 密码/凭据不放代码与文档；初始管理员密码见交付说明（登录后建议改密）
