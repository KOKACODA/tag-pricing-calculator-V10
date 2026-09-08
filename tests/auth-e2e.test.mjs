// ============================================================
// KOKALabel v9.5 账号体系端到端测试（内存 KV 模拟，无网络依赖）
// 覆盖：初始化返回token / 启停bug修复 / 至少保留一个管理员 /
//       管理员删除保护 / 默认数据上传权限 / 角色权限
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---------- 内存 KV 模拟 ----------
function memKV() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) {
      return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(k => ({ name: k })) };
    },
    _raw: m
  };
}

// 请求对象模拟（body 可为 null）
function fakeReq(body) {
  return {
    json: async () => body,
    headers: new Map([['CF-Connecting-IP', '127.0.0.1'], ['User-Agent', 'node-test']])
  };
}
function fakeCtx(env, params = {}, body = null) {
  const ctx = { env, params, request: fakeReq(body) };
  return ctx;
}
function authedCtx(env, token, params = {}, body = null) {
  const ctx = fakeCtx(env, params, body);
  if (token) ctx.request.headers.set('Authorization', 'Bearer ' + token);
  return ctx;
}

const MODULES = {
  lib: await import('file:///workspace/tag-pricing-calculator-v5/functions/_lib.js'),
  login: await import('file:///workspace/tag-pricing-calculator-v5/functions/api/auth/login.js'),
  session: await import('file:///workspace/tag-pricing-calculator-v5/functions/api/auth/session.js'),
  users: await import('file:///workspace/tag-pricing-calculator-v5/functions/api/admin/users.js'),
  userOne: await import('file:///workspace/tag-pricing-calculator-v5/functions/api/admin/users/[name].js'),
  status: await import('file:///workspace/tag-pricing-calculator-v5/functions/api/auth/status.js'),
  def: await import('file:///workspace/tag-pricing-calculator-v5/functions/api/default.js')
};
const parse = async res => res.json();

// 初始化系统（首次登录 + setupKey），返回 admin token
async function initSystem(env, setupKey) {
  const res = await MODULES.login.onRequestPost(authedCtx(env, null, {}, { setupKey, username: 'KOKA', password: '12345677' }));
  const d = await parse(res);
  assert.equal(d.ok, true, '初始化应成功: ' + JSON.stringify(d));
  assert.ok(d.token, '初始化后必须直接返回 token');
  return d;
}

test('初始化：SETUP_KEY 创建默认管理员并直接返回 token 与用户', async () => {
  const env = { AUTH: memKV(), SETUP_KEY: 'sk_test', ADMIN_USER: 'KOKA', ADMIN_PASS: '12345677', ADMIN_NICK: '老板' };
  const d = await initSystem(env, 'sk_test');
  assert.equal(d.setup, 'created');
  assert.equal(d.username, 'koka');
  assert.equal(d.user.role, 'admin');
  assert.equal(d.user.nickname, '老板');

  // 用返回的 token 校验会话
  const sd = await parse(await MODULES.session.onRequestGet(authedCtx(env, d.token)));
  assert.equal(sd.ok, true);
  assert.equal(sd.user.username, 'koka');
  assert.equal(sd.user.role, 'admin');

  // 状态接口：已初始化
  const st = await parse(await MODULES.status.onRequestGet(fakeCtx(env)));
  assert.equal(st.initialized, true);

  // 用默认账号密码正式登录（不再需要 setupKey）
  const ld = await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'KOKA', password: '12345677' })));
  assert.equal(ld.ok, true);
  assert.ok(ld.token);

  // 错误 setupKey 无法初始化（仅首次）
  const env2 = { AUTH: memKV(), SETUP_KEY: 'sk', ADMIN_USER: 'KOKA', ADMIN_PASS: 'x' };
  const bad = await parse(await MODULES.login.onRequestPost(authedCtx(env2, null, {}, { setupKey: 'wrong', username: 'KOKA', password: 'x' })));
  assert.equal(bad.ok, false);
});

test('登录：错误密码 / 不存在账号 / 停用账号均被拒绝', async () => {
  const env = { AUTH: memKV(), SETUP_KEY: 'sk', ADMIN_USER: 'KOKA', ADMIN_PASS: '12345677' };
  await initSystem(env, 'sk');
  const adminTok = (await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'KOKA', password: '12345677' }))).then ? null : null;
  const adminLogin = await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'KOKA', password: '12345677' })));
  const adminTok2 = adminLogin.token;
  // 创建业务员
  const mk = await parse(await MODULES.users.onRequestPost(authedCtx(env, adminTok2, {}, { username: 'sales1', password: 'pass123', role: 'sales' })));
  assert.equal(mk.ok, true);

  // 错误密码
  const badLogin = await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'koka', password: 'wrong123' })));
  assert.equal(badLogin.ok, false);
  assert.match(badLogin.message, /密码错误/);

  // 不存在账号
  const noUser = await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'nobody', password: 'x123456' })));
  assert.equal(noUser.ok, false);

  // 停用 sales1 → sales1 不能再登录（bug 修复验证）
  const dis = await parse(await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok2, { name: 'sales1' }, { enabled: false })));
  assert.equal(dis.ok, true);
  const disabledLogin = await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'sales1', password: 'pass123' })));
  assert.equal(disabledLogin.ok, false);
  assert.match(disabledLogin.message, /停用/);

  // 重新启用 → 可登录
  await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok2, { name: 'sales1' }, { enabled: true }));
  const reLogin = await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'sales1', password: 'pass123' })));
  assert.equal(reLogin.ok, true);
});

test('管理员保护：不能删除自己 / 不能停用最后的管理员 / 至少保留一个', async () => {
  const env = { AUTH: memKV(), SETUP_KEY: 'sk', ADMIN_USER: 'KOKA', ADMIN_PASS: '12345677' };
  await initSystem(env, 'sk');
  const adminTok = (await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'KOKA', password: '12345677' })))).token;

  // 管理员不能删除自己
  const selfDel = await parse(await MODULES.userOne.onRequestDelete(authedCtx(env, adminTok, { name: 'koka' })));
  assert.equal(selfDel.ok, false);
  assert.match(selfDel.message, /不能删除自己/);

  // 管理员不能停用自己
  const selfDis = await parse(await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok, { name: 'koka' }, { enabled: false })));
  assert.equal(selfDis.ok, false);

  // 只有一个管理员时不能停用（保护最后管理员：不能对自己操作 / 至少保留一个 都算保护生效）
  const onlyAdmin = await parse(await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok, { name: 'koka' }, { enabled: false })));
  assert.equal(onlyAdmin.ok, false);
  assert.match(onlyAdmin.message, /不能对自己执行该操作|至少保留一个/);

  // 新增第二个管理员 → 可相互停用/删除
  await MODULES.users.onRequestPost(authedCtx(env, adminTok, {}, { username: 'admin2', password: 'pass123', role: 'admin' }));
  const disAdmin2 = await parse(await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok, { name: 'admin2' }, { enabled: false })));
  assert.equal(disAdmin2.ok, true);
  await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok, { name: 'admin2' }, { enabled: true }));
  const delAdmin2 = await parse(await MODULES.userOne.onRequestDelete(authedCtx(env, adminTok, { name: 'admin2' })));
  assert.equal(delAdmin2.ok, true);

  // 删除后只剩一个管理员，再次尝试停用 koka → 拒绝
  const again = await parse(await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok, { name: 'koka' }, { enabled: false })));
  assert.equal(again.ok, false);
});

test('权限：访客/业务员不能管理账号、不能上传默认数据；管理员可以', async () => {
  const env = { AUTH: memKV(), SETUP_KEY: 'sk', ADMIN_USER: 'KOKA', ADMIN_PASS: '12345677' };
  await initSystem(env, 'sk');
  const adminTok = (await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'KOKA', password: '12345677' })))).token;
  await MODULES.users.onRequestPost(authedCtx(env, adminTok, {}, { username: 'sales1', password: 'pass123', role: 'sales' }));
  await MODULES.users.onRequestPost(authedCtx(env, adminTok, {}, { username: 'guest1', password: 'pass123', role: 'guest' }));

  const salesTok = (await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'sales1', password: 'pass123' })))).token;
  const guestTok = (await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'guest1', password: 'pass123' })))).token;

  // 访客/业务员不能列账号
  assert.equal((await parse(await MODULES.users.onRequestGet(authedCtx(env, guestTok)))).ok, false);
  assert.equal((await parse(await MODULES.users.onRequestGet(authedCtx(env, salesTok)))).ok, false);
  // 管理员可以
  const list = await parse(await MODULES.users.onRequestGet(authedCtx(env, adminTok)));
  assert.equal(list.ok, true);
  assert.ok(Array.isArray(list.users));

  // 访客/业务员不能上传默认数据；管理员可以
  const packet = { data: { priceLists: [], paperConfig: {} } };
  assert.equal((await parse(await MODULES.def.onRequestPost(authedCtx(env, guestTok, {}, packet)))).ok, false);
  assert.equal((await parse(await MODULES.def.onRequestPost(authedCtx(env, salesTok, {}, packet)))).ok, false);
  const up = await parse(await MODULES.def.onRequestPost(authedCtx(env, adminTok, {}, packet)));
  assert.equal(up.ok, true);
  assert.ok(up.version);

  // 所有登录用户都能拉取默认数据
  const g = await parse(await MODULES.def.onRequestGet(authedCtx(env, guestTok)));
  assert.equal(g.ok, true);
  assert.equal(g.version, up.version);
  assert.deepEqual(g.data, packet.data);

  // 未登录不能拉取
  assert.equal((await parse(await MODULES.def.onRequestGet(authedCtx(env, null)))).ok, false);
});

test('昵称/密码修改：管理员可改自己和子账号', async () => {
  const env = { AUTH: memKV(), SETUP_KEY: 'sk', ADMIN_USER: 'KOKA', ADMIN_PASS: '12345677' };
  await initSystem(env, 'sk');
  const adminTok = (await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'KOKA', password: '12345677' })))).token;
  await MODULES.users.onRequestPost(authedCtx(env, adminTok, {}, { username: 'sales1', password: 'pass123', role: 'sales' }));

  // 改自己昵称
  let r = await parse(await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok, { name: 'koka' }, { nickname: '超级管理员' })));
  assert.equal(r.ok, true);

  // 改子账号昵称 + 密码
  r = await parse(await MODULES.userOne.onRequestPatch(authedCtx(env, adminTok, { name: 'sales1' }, { nickname: '小张', password: 'newpass456' })));
  assert.equal(r.ok, true);

  // 新密码可登录
  const nl = await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'sales1', password: 'newpass456' })));
  assert.equal(nl.ok, true);
  // 旧密码失效
  const old = await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'sales1', password: 'pass123' })));
  assert.equal(old.ok, false);
});

test('业务员/访客会话中角色正确下发，供前端门控', async () => {
  const env = { AUTH: memKV(), SETUP_KEY: 'sk', ADMIN_USER: 'KOKA', ADMIN_PASS: '12345677' };
  await initSystem(env, 'sk');
  const adminTok = (await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'KOKA', password: '12345677' })))).token;
  await MODULES.users.onRequestPost(authedCtx(env, adminTok, {}, { username: 'sales1', password: 'pass123', role: 'sales' }));
  await MODULES.users.onRequestPost(authedCtx(env, adminTok, {}, { username: 'guest1', password: 'pass123', role: 'guest' }));

  const salesTok = (await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'sales1', password: 'pass123' })))).token;
  const guestTok = (await parse(await MODULES.login.onRequestPost(authedCtx(env, null, {}, { username: 'guest1', password: 'pass123' })))).token;

  const sd = await parse(await MODULES.session.onRequestGet(authedCtx(env, salesTok)));
  assert.equal(sd.ok, true);
  assert.equal(sd.user.role, 'sales');
  const gd = await parse(await MODULES.session.onRequestGet(authedCtx(env, guestTok)));
  assert.equal(gd.ok, true);
  assert.equal(gd.user.role, 'guest');
});

test('默认数据蒙版纸→铜版纸：数据源已修改', async () => {
  const src = await (await import('node:fs/promises')).readFile('/workspace/tag-pricing-calculator-v5/js/data.js', 'utf8');
  assert.match(src, /"id": "paper2_22"/);
  assert.match(src, /900克 A级铜版纸 双面过哑胶（厚度1\.05mm）/);
  assert.doesNotMatch(src, /"id": "paper2_22"[\s\S]{0,400}900克 A级蒙版纸/);
});
