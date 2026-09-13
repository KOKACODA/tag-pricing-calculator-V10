// /api/quote  —— 报价默认数据（服务器共享，superadmin 维护）
// GET  ：已登录任意角色读取云端默认报价数据（供业务员/访客/计算器使用）
// POST ：仅超级管理员(superadmin)上传/更新全量默认数据
import { json, requireSession, normRole } from '../_lib.js';

const QKEY = 'q:v1';
const ALLOWED = ['paperConfig', 'craftConfig', 'ropeConfig', 'shippingConfig'];

export async function onRequestGet(context) {
  const { error } = await requireSession(context.env, context.request);
  if (error) return error;
  const raw = await context.env.AUTH.get(QKEY);
  if (!raw) return json({ ok: true, exists: false });
  const data = JSON.parse(raw);
  return json({ ok: true, exists: true, ...data });
}

export async function onRequestPost(context) {
  const { user, error } = await requireSession(context.env, context.request);
  if (error) return error;
  if (normRole(user.role) !== 'superadmin') return json({ ok: false, message: '仅超级管理员可发布默认报价数据' }, 403);
  let body;
  try { body = await context.request.json(); } catch (e) { return json({ ok: false, message: '请求格式错误' }, 400); }
  const saved = {};
  for (const k of ALLOWED) {
    if (body[k] === undefined) return json({ ok: false, message: '缺少数据段：' + k }, 400);
    saved[k] = body[k];
  }
  const payload = {
    ...saved,
    version: '1',
    updatedAt: Date.now(),
    by: user.username
  };
  await context.env.AUTH.put(QKEY, JSON.stringify(payload));
  return json({ ok: true, updatedAt: payload.updatedAt });
}
