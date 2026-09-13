// ============================================================
// KOKALabel 报价系统 - 激活接口（Cloudflare Pages Functions 模板）
// 部署到你的 Pages 项目：本文件放 <项目>/functions/api/license/activate.js
// 绑定 KV 命名空间（变量名 LICENSE）：存储密钥表
// 密钥表写入（用 tools/gen-license-keys.js 生成 CSV 后批量 PUT）：
//   key: { customer, expiresAt, deviceId:null, revoked:false, createdAt }
// ============================================================

export async function onRequestPost(context) {
  const env = context.env;               // Pages 环境，env.LICENSE = KV
  const LICENSE = env.LICENSE;
  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return json({ ok: false, code: 'bad_request', message: '请求格式错误' }, 400);
  }
  const { key, deviceId } = body || {};
  if (!key || !deviceId) {
    return json({ ok: false, code: 'bad_request', message: '缺少 key 或 deviceId' }, 400);
  }

  const serverTime = new Date().toISOString();
  const recRaw = await LICENSE.get(key).catch(() => null);
  if (!recRaw) {
    return json({ ok: false, code: 'not_found', message: '密钥不存在' }, 404);
  }

  let rec;
  try { rec = JSON.parse(recRaw); } catch (e) {
    return json({ ok: false, code: 'server_error', message: '密钥数据异常' }, 500);
  }

  // 吊销检查
  if (rec.revoked) {
    return json({ ok: false, code: 'revoked', message: '密钥已被吊销' }, 403);
  }
  // 到期检查（按服务器时间，防客户端改本地时间）
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() < Date.now()) {
    return json({ ok: false, code: 'expired_key', message: '密钥已过期' }, 403);
  }
  // 设备绑定：一码一机
  if (rec.deviceId && rec.deviceId !== deviceId) {
    return json({ ok: false, code: 'device_mismatch', message: '该密钥已在其他设备激活' }, 403);
  }

  // 首次激活：绑定设备
  if (!rec.deviceId) {
    rec.deviceId = deviceId;
    rec.activatedAt = serverTime;
    rec.deviceName = (body && body.deviceName) || '';
    await LICENSE.put(key, JSON.stringify(rec));
  }

  return json({
    ok: true,
    customer: rec.customer || '',
    expiresAt: rec.expiresAt,
    serverTime   // exe 用服务器时间校准本地（防改时间）
  }, 200);
}

// 可选：GET 校验（exe 联网同步/吊销检查用）
export async function onRequestGet(context) {
  const LICENSE = context.env.LICENSE;
  const url = new URL(context.request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ ok: false, message: '缺少 key' }, 400);
  const recRaw = await LICENSE.get(key).catch(() => null);
  if (!recRaw) return json({ ok: false, code: 'not_found' }, 404);
  const rec = JSON.parse(recRaw);
  return json({
    ok: true,
    revoked: !!rec.revoked,
    expiresAt: rec.expiresAt,
    deviceBound: rec.deviceId || null,
    serverTime: new Date().toISOString()
  }, 200);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
