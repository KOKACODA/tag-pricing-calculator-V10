// GET /api/auth/session  —— 校验会话，返回当前登录用户
import { json, getUser, getSession, authToken, accountExpired, publicUser } from '../../_lib.js';

export async function onRequestGet(context) {
  const env = context.env;
  const sid = authToken(context.request);
  if (!sid) return json({ ok: false, message: '未登录' }, 401);
  const sess = await getSession(env, sid);
  if (!sess) return json({ ok: false, message: '会话失效，请重新登录' }, 401);
  const user = await getUser(env, sess.username);
  if (!user || !user.enabled) {
    await deleteSess(env, sid);
    return json({ ok: false, message: '账号不存在或已停用' }, 401);
  }
  if (accountExpired(user)) return json({ ok: false, message: '账号使用期限已到', code: 'expired' }, 403);
  return json({ ok: true, user: publicUser(user, { exp: user.expiresAt }), loginAt: sess.loginAt });
}
async function deleteSess(env, sid) { await env.AUTH.delete('s:' + sid); }
