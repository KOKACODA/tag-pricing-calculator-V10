// POST /api/auth/logout —— 注销当前会话
import { json, authToken, deleteSession } from '../../_lib.js';

export async function onRequestPost(context) {
  const sid = authToken(context.request);
  if (sid) await deleteSession(context.env, sid);
  return json({ ok: true });
}
