// /api/admin/users  —— 管理员/超管：列账号、创建账号（GET/POST）
import { json, getUser, saveUser, listUsers, hashPassword, randomSalt, publicUser,
         requireSession, canManage, roleRank, normRole } from '../../_lib.js';

const ROLES = ['visitor', 'sales', 'admin', 'superadmin'];

export async function onRequestGet(context) {
  const { user, error } = await requireSession(context.env, context.request);
  if (error) return error;
  if (roleRank(user.role) < 2) return json({ ok: false, message: '需要管理员权限' }, 403);
  const users = await listUsers(context.env);
  const list = users.map(u => publicUser(u))
    .sort((a, b) => roleRank(b.role) - roleRank(a.role) || String(a.username).localeCompare(String(b.username)));
  return json({ ok: true, users: list });
}

export async function onRequestPost(context) {
  const { user, error } = await requireSession(context.env, context.request);
  if (error) return error;
  const actorRole = normRole(user.role);
  if (roleRank(actorRole) < 2) return json({ ok: false, message: '需要管理员权限' }, 403);

  let body;
  try { body = await context.request.json(); } catch (e) { return json({ ok: false, message: '请求格式错误' }, 400); }
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) return json({ ok: false, message: '账号和初始密码必填' }, 400);
  if (!/^[a-z0-9_.-]{2,32}$/.test(username)) return json({ ok: false, message: '账号仅限 2-32 位小写字母/数字/._-' }, 400);
  if (password.length < 6) return json({ ok: false, message: '密码至少 6 位' }, 400);
  if (await getUser(context.env, username)) return json({ ok: false, message: '账号已存在' }, 409);

  let role = normRole(body.role) || 'sales';
  if (!ROLES.includes(role)) role = 'sales';
  if (!canManage(actorRole, role)) return json({ ok: false, message: '无权创建该角色账号' }, 403);
  if (role === 'superadmin' && actorRole !== 'superadmin') return json({ ok: false, message: '仅超级管理员可创建超级管理员' }, 403);

  let expiresAt = null;
  if (body.expiresAt) expiresAt = new Date(body.expiresAt).toISOString();
  else if (parseInt(body.days, 10) > 0) expiresAt = new Date(Date.now() + parseInt(body.days, 10) * 86400000).toISOString();

  const salt = randomSalt();
  const newUser = {
    username, role,
    nickname: String(body.nickname || '').slice(0, 30),
    pwdHash: await hashPassword(password, salt), salt,
    enabled: body.enabled !== false, expiresAt,
    createdAt: Date.now(), lastLogin: null,
    note: String(body.note || '').slice(0, 100)
  };
  await saveUser(context.env, username, newUser);
  return json({ ok: true, user: publicUser(newUser) }, 201);
}
