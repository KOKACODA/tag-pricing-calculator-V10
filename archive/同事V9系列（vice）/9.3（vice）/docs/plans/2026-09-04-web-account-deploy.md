# KOKALabel 报价系统 · 网页版账号体系部署说明（v9.3.0）

> 日期：2026-09-04 ｜ 状态：已上线

## 一、线上地址
- **站点**：https://kokalabel-quote.pages.dev （Cloudflare Pages）
- **代码仓库**：https://github.com/zly62612364469/kokalabel-quote （私有）

## 二、账号体系
- 访问网页 → 自动跳转登录页 `login.html`；凭账号密码进入。
- 管理员（admin）登录后，在「个人主页 → 账号管理」可：
  - 新增分账号（填账号/初始密码/使用时长天数，空=永久）
  - 设时长 / 重置密码 / 停用启用 / 删除（不能对自己操作）
  - 查看每个账号的最近登录时间 / 设备(UA) / IP
- 账号到期后登录被拒（提示"使用期限已到"），管理员续期（改 expiresAt）即可。
- 本地 `file://` 双击 / exe **不受登录影响**（仅 http 部署强制登录）。

## 三、技术实现（本项目根目录）
```
functions/                 # Cloudflare Pages Functions（后端）
  _lib.js                  # 共享：密码 PBKDF2、会话、KV 读写
  api/auth/login.js        # 登录（含首次 SETUP_KEY 初始化管理员）
  api/auth/session.js      # 会话校验
  api/auth/logout.js       # 登出
  api/admin/users.js       # 管理员：列/建分账号
  api/admin/users/[name].js# 管理员：设时长/改密/启停/删除
login.html                 # 登录页
js/auth.js                 # 前端拦截 + 账号/管理面板
```
- 存储：Cloudflare KV `KOKA_AUTH`（账号键 `u:<name>`、会话 `s:<token>` TTL 7 天）
- 项目环境变量：`SETUP_KEY` / `ADMIN_USER` / `ADMIN_PASS`（Pages 项目 → Settings → Environment variables）
- KV 绑定：Pages Functions 绑定名 `AUTH`（指向 KOKA_AUTH）

## 四、重新部署（改代码后）
需要 wrangler（v3）：
```bash
export CLOUDFLARE_API_TOKEN=<你的token>
export CLOUDFLARE_ACCOUNT_ID=27625dbe76d8de686bcc821c5a7ff0df
npx wrangler@3.114.0 pages deploy "E:/报价系统7.9/KOKALabel报价系统-v7.8" --project-name kokalabel-quote --branch main
```
（本项目推送 GitHub main 后，也可在 CF 项目接入 Git 自动构建，本次用 direct upload）

## 五、安全要点
- 密码 PBKDF2(100k)+随机盐；会话随机 token 存 KV（TTL 7 天）
- 账号到期按服务器时间判断；管理员端 API 均校验会话+角色
- 密码/凭据不放代码与文档；初始管理员密码见交付说明（登录后建议改密）
