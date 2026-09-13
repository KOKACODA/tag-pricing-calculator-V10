// POST /api/auth/login  { username, password, device? }
import { json, getUser, saveUser, listUsers, hashPassword, randomSalt, createSession, accountExpired, publicUser } from '../../_lib.js';

export async function onRequestPost(context) {
  const env = context.env;
  try {
    return await handle(context);
  } catch (e) {
    return json({ ok: false, code: 'exception', message: '服务异常: ' + (e && e.message || e) }, 500);
  }
}
async function handle(context) {
  const env = context.env;
  let body;
  try { body = await context.request.json(); } catch (e) { return json({ ok: false, message: '请求格式错误' }, 400); }
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  // —— 首次初始化管理员（USERS 为空且携带正确 SETUP_KEY）——
  const users = await listUsers(env);
  if (!users.length) {
    if (env.SETUP_KEY && body.setupKey === env.SETUP_KEY && env.ADMIN_PASS) {
      const salt = randomSalt();
      const admin = {
        role: 'admin', username: (env.ADMIN_USER || 'admin'),
        pwdHash: await hashPassword(env.ADMIN_PASS, salt), salt,
        enabled: true, expiresAt: null,
        createdAt: Date.now(), lastLogin: null
      };
      await saveUser(env, admin.username, admin);
      return json({ ok: true, setup: 'created', username: admin.username });
    }
    return json({ ok: false, message: '系统未初始化，请联系管理员' }, 403);
  }

  if (!username || !password) return json({ ok: false, message: '请输入账号和密码' }, 400);
  const user = await getUser(env, username);
  if (!user) return json({ ok: false, message: '账号不存在' }, 401);
  if (!user.enabled) return json({ ok: false, message: '账号已被停用' }, 403);
  if (accountExpired(user)) return json({ ok: false, message: '账号使用期限已到，请联系管理员续期' }, 403);
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.pwdHash) return json({ ok: false, message: '密码错误' }, 401);

  // 记录登录时间/设备/IP
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const device = String(body.device || (context.request.headers.get('User-Agent') || '')).slice(0, 200);
  user.lastLogin = { at: Date.now(), ip, device };
  user.lastLoginAt = Date.now();
  await saveUser(env, username, user);

  const sess = await createSession(env, username, user.role, context.request);
  return json({ ok: true, token: sess.sid, user: publicUser(user, { exp: user.expiresAt }) });
}
