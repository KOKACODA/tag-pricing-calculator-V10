// GET /api/auth/status —— 系统初始化状态（无需登录，供登录页判断是否显示初始化密钥）
import { json, listUsers } from '../../_lib.js';

export async function onRequestGet(context) {
  const users = await listUsers(context.env);
  return json({ ok: true, initialized: users.length > 0 });
}
