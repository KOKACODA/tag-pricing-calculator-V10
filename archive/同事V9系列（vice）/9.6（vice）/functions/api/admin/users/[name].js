// /api/admin/users/[name]  —— 管理员/超管：改密 / 设时长 / 启停 / 改角色昵称 / 删除
// 规则：superadmin 全权；admin 可管 sales/visitor/admin（互管）；不能停用/删除自己；
//      系统默认至少保留 1 个管理员（admin/superadmin）；低角色无权。
import { json, getUser, saveUser, listUsers, hashPassword, getSession, authToken,
         requireSession, canManage, roleRank, normRole, isAdminLevel, publicUser } from '../../../_lib.js';

async function countAdminLevels(env) {
  const users = await listUsers(env);
  return users.filter(u => u.enabled && isAdminLevel(u.role)).length;
}

export async function onRequestPatch(context) {
  const { user: actor, error } = await requireSession(context.env, context.request);
  if (error) return error;
  const actorRole = normRole(actor.role);
  const name = decodeURIComponent(context.params.name || '').toLowerCase();
  if (name !== actor.username && roleRank(actorRole) < 2) return json({ ok: false, message: '需要管理员权限' }, 403);
  const target = await getUser(context.env, name);
  if (!target) return json({ ok: false, message: '账号不存在' }, 404);

  let body;
  try { body = await context.request.json(); } catch (e) { return json({ ok: false, message: '请求格式错误' }, 400); }

  const isSelf = name === actor.username;
  const targetRole = normRole(target.role);

  // 权限判定：管理操作需 canManage；对自己仅允许改昵称/密码（不允许自停/自降/自删已在下方拒绝）
  const manageAllowed = canManage(actorRole, targetRole);

  // —— 改自己昵称 / 改自己密码 ——
  if (isSelf) {
    if (body.nickname !== undefined) target.nickname = String(body.nickname || '').slice(0, 30);
    if (body.password !== undefined) {
      if (String(body.password).length < 6) return json({ ok: false, message: '密码至少 6 位' }, 400);
      target.salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      target.pwdHash = await hashPassword(body.password, target.salt);
    }
    // 自己不能停用/删除/降级
    if (body.enabled === false || body._delete || (body.role !== undefined && roleRank(body.role) < roleRank(targetRole)))
      return json({ ok: false, message: '不能对自己执行该操作' }, 400);
  }

  // —— 管理他人 ——
  if (!isSelf) {
    if (!manageAllowed) return json({ ok: false, message: '无权管理该账号' }, 403);

    // 改密码 / 昵称 / 时长 / 启停 / 角色
    if (body.password !== undefined) {
      if (String(body.password).length < 6) return json({ ok: false, message: '密码至少 6 位' }, 400);
      target.salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      target.pwdHash = await hashPassword(body.password, target.salt);
    }
    if (body.nickname !== undefined) target.nickname = String(body.nickname || '').slice(0, 30);
    if (body.expiresAt !== undefined) target.expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
    else if (body.days !== undefined) target.expiresAt = parseInt(body.days, 10) > 0 ? new Date(Date.now() + parseInt(body.days, 10) * 86400000).toISOString() : null;

    if (body.role !== undefined) {
      let nr = normRole(body.role);
      if (!['visitor', 'sales', 'admin', 'superadmin'].includes(nr)) nr = targetRole;
      if (!canManage(actorRole, nr)) return json({ ok: false, message: '无权设置该角色' }, 403);
      if (nr === 'superadmin' && actorRole !== 'superadmin') return json({ ok: false, message: '仅超级管理员可设置超级管理员' }, 403);
      // 把某管理员降级/转移前，保证系统仍剩管理员
      if (isAdminLevel(targetRole) && !isAdminLevel(nr)) {
        if (await countAdminLevels(context.env) <= 1) return json({ ok: false, message: '系统需至少保留一个管理员' }, 400);
      }
      target.role = nr;
    }
    if (body.enabled !== undefined) {
      if (body.enabled === false && isAdminLevel(targetRole)) {
        if (await countAdminLevels(context.env) <= 1) return json({ ok: false, message: '系统需至少保留一个管理员' }, 400);
      }
      target.enabled = !!body.enabled;
    }
    if (body.note !== undefined) target.note = String(body.note || '').slice(0, 100);
  }

  await saveUser(context.env, name, target);
  return json({ ok: true, user: publicUser(target) });
}

export async function onRequestDelete(context) {
  const { user: actor, error } = await requireSession(context.env, context.request);
  if (error) return error;
  const actorRole = normRole(actor.role);
  const name = decodeURIComponent(context.params.name || '').toLowerCase();
  if (name === actor.username) return json({ ok: false, message: '不能删除自己的账号' }, 400);
  if (roleRank(actorRole) < 2) return json({ ok: false, message: '需要管理员权限' }, 403);
  const target = await getUser(context.env, name);
  if (!target) return json({ ok: false, message: '账号不存在' }, 404);
  if (!canManage(actorRole, normRole(target.role))) return json({ ok: false, message: '无权删除该账号' }, 403);
  if (isAdminLevel(normRole(target.role)) && await countAdminLevels(context.env) <= 1) {
    return json({ ok: false, message: '系统需至少保留一个管理员' }, 400);
  }
  await context.env.AUTH.delete('u:' + name);
  return json({ ok: true });
}
