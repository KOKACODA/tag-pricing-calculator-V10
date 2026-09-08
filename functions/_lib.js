// ============================================================
// KOKALabel 报价系统 · 账号体系共享库（Cloudflare Pages Functions）
// 依赖 KV 绑定：AUTH（账号表 USERS + 会话表 SESSIONS + 默认数据）
// 角色：admin=管理员(超级管理员) / sales=业务员 / guest=访客
// ============================================================

// ---------- 角色 ----------
export const ROLES = { ADMIN: 'admin', SALES: 'sales', GUEST: 'guest' };
export function normalizeRole(r) {
  return r === ROLES.ADMIN || r === ROLES.SALES || r === ROLES.GUEST ? r : ROLES.GUEST;
}
export function roleLabel(r) {
  return r === ROLES.ADMIN ? '管理员' : r === ROLES.SALES ? '业务员' : '访客';
}

// ---------- 通用 JSON 响应 ----------
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

// ---------- 密码哈希（PBKDF2，Web Crypto）----------
const enc = new TextEncoder();
export async function hashPassword(pwd, saltHex) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return bytesToHex(new Uint8Array(bits));
}
export function randomSalt() { return randomHex(16); }
export function randomToken() { return randomHex(32); }
function randomHex(bytes) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return bytesToHex(a); }
function bytesToHex(u8) { return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(hex) { const a = new Uint8Array(hex.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16); return a; }

// ---------- 账号 CRUD（KV AUTH，key: u:<username>）----------
const U_PREFIX = 'u:';
const U_INDEX = 'u_index';
export async function getUser(env, username) {
  const raw = await env.AUTH.get(U_PREFIX + username);
  return raw ? JSON.parse(raw) : null;
}
export async function saveUser(env, username, user) {
  await env.AUTH.put(U_PREFIX + username, JSON.stringify(user));
  // 同步更新用户名索引（幂等）
  const names = await indexNames(env);
  if (!names.includes(username)) {
    names.push(username);
    await env.AUTH.put(U_INDEX, JSON.stringify(names));
  }
}
export async function deleteUser(env, username) {
  await env.AUTH.delete(U_PREFIX + username);
  const names = await indexNames(env);
  const next = names.filter(n => n !== username);
  if (next.length !== names.length) await env.AUTH.put(U_INDEX, JSON.stringify(next));
}
// 读取用户名索引；缺失时回退到一次前缀扫描并回填（兼容旧数据）
async function indexNames(env) {
  const raw = await env.AUTH.get(U_INDEX);
  if (raw) { try { const a = JSON.parse(raw); if (Array.isArray(a)) return a; } catch (e) { /* 重扫 */ } }
  const list = await env.AUTH.list({ prefix: U_PREFIX });
  const names = list.keys.map(k => k.name.slice(U_PREFIX.length));
  await env.AUTH.put(U_INDEX, JSON.stringify(names));
  return names;
}
// 用「索引 + 强一致 get」枚举用户，避免 KV list 传播延迟导致列表缺账号
export async function listUsers(env) {
  const names = await indexNames(env);
  const out = [];
  for (const n of names) {
    const raw = await env.AUTH.get(U_PREFIX + n);
    if (raw) { try { out.push(JSON.parse(raw)); } catch (e) { /* 跳过坏数据 */ } }
  }
  return out;
}

// ---------- 会话 ----------
const S_PREFIX = 's:';
export async function createSession(env, username, role, req) {
  const sid = randomToken();
  const ip = (req.headers.get('CF-Connecting-IP')) || 'unknown';
  const ua = req.headers.get('User-Agent') || '';
  const payload = { username, role, loginAt: Date.now(), ip, device: ua.slice(0, 200) };
  await env.AUTH.put(S_PREFIX + sid, JSON.stringify(payload), { expirationTtl: 7 * 86400 }); // 7天
  return { sid, ...payload };
}
export async function getSession(env, sid) {
  if (!sid) return null;
  const raw = await env.AUTH.get(S_PREFIX + sid);
  return raw ? JSON.parse(raw) : null;
}
export async function deleteSession(env, sid) {
  if (sid) await env.AUTH.delete(S_PREFIX + sid);
}
// 会话里带的 deviceName 解析辅助（前端可传 device 便于记录）
export function clientIp(req) { return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown'; }

// ---------- 鉴权辅助 ----------
export function authToken(req) {
  const h = req.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
// 账号使用期限：expiresAt（null=永久）是否已到
export function accountExpired(user) {
  if (!user.expiresAt) return false;
  return Date.now() > new Date(user.expiresAt).getTime();
}
// 返回给前端的脱敏账号（不含密码）
export function publicUser(user, extra = {}) {
  const { pwdHash, salt, ...rest } = user;
  return { ...rest, ...extra };
}

// ---------- 默认数据（管理员上传，全用户共享）----------
const D_PREFIX = 'default:';
export async function getDefaultData(env) {
  const raw = await env.AUTH.get(D_PREFIX + 'quote');
  return raw ? JSON.parse(raw) : null;
}
export async function setDefaultData(env, data, by) {
  const record = { version: Date.now(), by: by || 'unknown', at: Date.now(), data };
  await env.AUTH.put(D_PREFIX + 'quote', JSON.stringify(record));
  return record;
}

// ---------- 管理员保护：统计当前启用中的管理员数 ----------
export async function countActiveAdmins(env) {
  const users = await listUsers(env);
  return users.filter(u => u.role === 'admin' && u.enabled !== false).length;
}
