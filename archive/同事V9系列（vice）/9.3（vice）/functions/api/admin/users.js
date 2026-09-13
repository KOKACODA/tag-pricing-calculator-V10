// /api/admin/users  —— 管理员：列账号 / 创建分账号（GET/POST）
import { json, getUser, saveUser, listUsers, hashPassword, randomSalt, getSession, authToken, publicUser } from '../../_lib.js';

async function requireAdmin(env, req) {
  const sid = authToken(req);
  if (!sid) return { error: json({ ok: false, message: '未登录' }, 401) };
  const sess = await getSession(env, sid);
  if (!sess) return { error: json({ ok: false, message: '会话失效' }, 401) };
  if (sess.role !== 'admin') return { error: json({ ok: false, message: '需要管理员权限' }, 403) };
  return { sess };
}

export async function onRequestGet(context) {
  const { error } = await requireAdmin(context.env, context.request);
  if (error) return error;
  const users = await listUsers(context.env);
  const list = users.map(u => {
    const { pwdHash, salt, ...rest } = u;
    return { ...rest };
  });
  return json({ ok: true, users: list });
}

export async function onRequestPost(context) {
  const { error } = await requireAdmin(context.env, context.request);
  if (error) return error;
  let body;
  try { body = await context.request.json(); } catch (e) { return json({ ok: false, message: '请求格式错误' }, 400); }
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) return json({ ok: false, message: '账号和初始密码必填' }, 400);
  if (!/^[a-z0-9_.-]{2,32}$/.test(username)) return json({ ok: false, message: '账号仅限 2-32 位小写字母/数字/._-' }, 400);
  if (password.length < 6) return json({ ok: false, message: '密码至少 6 位' }, 400);
  if (await getUser(context.env, username)) return json({ ok: false, message: '账号已存在' }, 409);

  // 使用期限：days > 0 → 从现在起 N 天；expiresAt 显式时间；都不给 → null（永久）
  let expiresAt = null;
  if (body.expiresAt) expiresAt = new Date(body.expiresAt).toISOString();
  else if (parseInt(body.days, 10) > 0) expiresAt = new Date(Date.now() + parseInt(body.days, 10) * 86400000).toISOString();

  const salt = randomSalt();
  const user = {
    username, role: body.role === 'admin' ? 'admin' : 'user',
    pwdHash: await hashPassword(password, salt), salt,
    enabled: body.enabled !== false, expiresAt,
    createdAt: Date.now(), lastLogin: null,
    note: String(body.note || '').slice(0, 100)
  };
  await saveUser(context.env, username, user);
  return json({ ok: true, user: publicUser(user) }, 201);
}
