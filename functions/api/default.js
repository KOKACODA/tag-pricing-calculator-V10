// /api/default —— 默认数据（报价表默认配置）
// GET  : 任意登录用户拉取管理员上传的默认数据（无则返回 null）
// POST : 仅管理员上传（修改并确认后，自动成为全用户共享的默认数据）
import { json, getSession, authToken, getDefaultData, setDefaultData } from '../_lib.js';

async function requireLogin(context) {
  const sid = authToken(context.request);
  if (!sid) return { error: json({ ok: false, message: '未登录' }, 401) };
  const sess = await getSession(context.env, sid);
  if (!sess) return { error: json({ ok: false, message: '会话失效，请重新登录' }, 401) };
  return { sess };
}

export async function onRequestGet(context) {
  const { error } = await requireLogin(context);
  if (error) return error;
  const record = await getDefaultData(context.env);
  return json({ ok: true, version: record ? record.version : null, by: record ? record.by : null, at: record ? record.at : null, data: record ? record.data : null });
}

export async function onRequestPost(context) {
  const { error, sess } = await requireLogin(context);
  if (error) return error;
  if (sess.role !== 'admin') return json({ ok: false, message: '仅管理员可上传默认数据' }, 403);

  let body;
  try { body = await context.request.json(); } catch (e) { return json({ ok: false, message: '请求格式错误' }, 400); }
  const data = body && body.data;
  if (!data || typeof data !== 'object') return json({ ok: false, message: '缺少 data 数据包' }, 400);

  const record = await setDefaultData(context.env, data, sess.username);
  return json({ ok: true, version: record.version, at: record.at });
}
