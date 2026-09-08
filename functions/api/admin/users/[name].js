// /api/admin/users/[name]  —— 管理员：改昵称/改密 / 设时长 / 启停 / 删除
import { json, getUser, saveUser, hashPassword, getSession, authToken, normalizeRole, countActiveAdmins } from '../../../_lib.js';

async function requireAdmin(env, req) {
  const sid = authToken(req);
  if (!sid) return { error: json({ ok: false, message: '未登录' }, 401) };
  const sess = await getSession(env, sid);
  if (!sess) return { error: json({ ok: false, message: '会话失效' }, 401) };
  if (sess.role !== 'admin') return { error: json({ ok: false, message: '需要管理员权限' }, 403) };
  return { sess };
}

export async function onRequestPatch(context) {
  const { error } = await requireAdmin(context.env, context.request);
  if (error) return error;
  const name = decodeURIComponent(context.params.name || '').toLowerCase();
  const user = await getUser(context.env, name);
  if (!user) return json({ ok: false, message: '账号不存在' }, 404);

  let body;
  try { body = await context.request.json(); } catch (e) { return json({ ok: false, message: '请求格式错误' }, 400); }

  // 禁止管理员停用/删除自己（避免锁死）
  const sess = (await requireAdmin(context.env, context.request)).sess;
  if (sess.username === name && (body.enabled === false || body._delete)) {
    return json({ ok: false, message: '不能对自己执行该操作' }, 400);
  }

  // 停用管理员时：至少保留一个启用管理员（默认保留一个管理员）
  if (user.role === 'admin' && body.enabled === false) {
    const activeAdmins = await countActiveAdmins(context.env);
    if (activeAdmins <= 1) return json({ ok: false, message: '至少保留一个启用的管理员' }, 400);
  }
  // 把最后的管理员降级为其他角色：同样禁止
  if (user.role === 'admin' && body.role !== undefined && normalizeRole(body.role) !== 'admin') {
    const activeAdmins = await countActiveAdmins(context.env);
    if (activeAdmins <= 1) return json({ ok: false, message: '至少保留一个启用的管理员' }, 400);
  }

  if (body.password) {
    if (String(body.password).length < 6) return json({ ok: false, message: '密码至少 6 位' }, 400);
    user.salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    user.pwdHash = await hashPassword(body.password, user.salt);
  }
  if (body.nickname !== undefined) user.nickname = String(body.nickname || '').trim().slice(0, 30) || null;
  if (body.expiresAt !== undefined) user.expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
  else if (body.days !== undefined) user.expiresAt = parseInt(body.days, 10) > 0 ? new Date(parseInt(body.days, 10) * 86400000 + Date.now()).toISOString() : null;
  if (body.enabled !== undefined) user.enabled = !!body.enabled;
  if (body.role !== undefined) user.role = normalizeRole(body.role);
  if (body.note !== undefined) user.note = String(body.note || '').slice(0, 100);

  await saveUser(context.env, name, user);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { error } = await requireAdmin(context.env, context.request);
  if (error) return error;
  const name = decodeURIComponent(context.params.name || '').toLowerCase();
  const sess = (await requireAdmin(context.env, context.request)).sess;
  if (sess.username === name) return json({ ok: false, message: '不能删除自己的账号' }, 400);
  const user = await getUser(context.env, name);
  if (!user) return json({ ok: false, message: '账号不存在' }, 404);
  // 至少保留一个启用管理员
  if (user.role === 'admin') {
    const activeAdmins = await countActiveAdmins(context.env);
    if (activeAdmins <= 1) return json({ ok: false, message: '至少保留一个启用的管理员' }, 400);
  }
  await context.env.AUTH.delete('u:' + name);
  return json({ ok: true });
}
