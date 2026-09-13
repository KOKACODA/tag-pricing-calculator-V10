// ============================================================
// KOKALabel 报价系统 - 授权模块（主进程）
// 在线激活 + 离线使用；一码一机（设备绑定由服务器执行）；
// 到期完全锁死（可输新密钥续期）；本地激活文件带 HMAC 签名防篡改。
// 兼容 Electron 22（Node 16，无全局 fetch → 用 https 模块发请求）
// ============================================================
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 本地激活文件签名密钥（内置；专业逆向可提取，属"检测提示"级防护）
const LOCAL_SECRET = 'KOKA-LICENSE-SIG-v1-7c92ab4e-8842-41b0';

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'license-config.json'), 'utf8'));
  } catch (e) {
    return { apiBase: '' };
  }
}

function getMachineId() {
  const seed = [
    os.hostname(), os.platform(), os.arch(),
    (os.cpus()[0] || {}).model || '',
    String(os.totalmem()),
    process.env.PROCESSOR_IDENTIFIER || '',
    process.env.COMPUTERNAME || ''
  ].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

// 授权文件目录：支持环境变量覆盖（测试/调试用），默认 electron userData
let _licenseDir = process.env.KOKA_LICENSE_DIR || null;
function getLicenseFile() {
  if (!_licenseDir) {
    const { app } = require('electron');
    _licenseDir = app.getPath('userData');
  }
  return path.join(_licenseDir, 'license.json');
}

function sign(payloadObj) {
  const data = JSON.stringify(payloadObj);
  const sig = crypto.createHmac('sha256', LOCAL_SECRET).update(data).digest('hex');
  return Object.assign({}, payloadObj, { sig });
}

function verify(obj) {
  if (!obj || typeof obj !== 'object' || !obj.sig) return false;
  const sig = obj.sig;
  const rest = Object.assign({}, obj);
  delete rest.sig;
  const expect = crypto.createHmac('sha256', LOCAL_SECRET)
    .update(JSON.stringify(rest)).digest('hex');
  return expect === sig;
}

function loadLicense() {
  try {
    const raw = fs.readFileSync(getLicenseFile(), 'utf8');
    const obj = JSON.parse(raw);
    return verify(obj) ? obj : { corrupt: true };
  } catch (e) {
    return null;
  }
}

function saveLicense(obj) {
  const file = getLicenseFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(sign(obj)), 'utf8');
}

// 检查本地授权状态
// 返回 { status: 'active' | 'expired' | 'none' | 'invalid' | 'time-rollback', ... }
function checkStatus() {
  const lic = loadLicense();
  if (!lic) return { status: 'none' };
  if (lic.corrupt) return { status: 'invalid', reason: '授权文件被篡改或损坏' };
  const now = Date.now();
  // 时间回拨检测：本地系统时间不能比上次记录倒退超过 24h
  if (lic.lastSeen && now < lic.lastSeen - 24 * 3600 * 1000) {
    return { status: 'time-rollback', reason: '检测到系统时间被回拨', license: lic };
  }
  const expiresMs = new Date(lic.expiresAt).getTime();
  if (now > expiresMs) {
    return { status: 'expired', reason: '授权已到期', expiresAt: lic.expiresAt, license: lic };
  }
  saveLicense(Object.assign({}, lic, { lastSeen: now }));
  return { status: 'active', expiresAt: lic.expiresAt, customer: lic.customer, license: lic };
}

// 通用 HTTP POST JSON（兼容 Node 16）
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(new Error('invalid url')); }
    const mod = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 15000
    }, (res) => {
      let chunks = '';
      res.on('data', c => { chunks += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch (e) { resolve({ status: res.statusCode, body: null }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

// 在线激活
async function activateKey(rawKey) {
  const cfg = getConfig();
  if (!cfg.apiBase) return { ok: false, code: 'no-endpoint', message: '激活服务未配置，请联系管理员' };
  const key = String(rawKey || '').trim();
  if (!key) return { ok: false, code: 'empty', message: '请输入产品密钥' };
  const deviceId = getMachineId();
  let res;
  try {
    res = await postJson(cfg.apiBase + '/api/license/activate', {
      key, deviceId, deviceName: os.hostname()
    });
  } catch (e) {
    return { ok: false, code: 'network', message: '无法连接激活服务器，请检查网络后重试' };
  }
  if (!res.body || res.body.ok !== true) {
    const code = res.body && res.body.code;
    let message = (res.body && res.body.message) || '密钥无效或服务器拒绝';
    if (code === 'device_mismatch') message = '该密钥已在其他电脑激活（一个密钥限一台设备）';
    if (code === 'expired_key') message = '该密钥已过期';
    if (code === 'revoked') message = '该密钥已被吊销';
    if (code === 'not_found') message = '密钥不存在，请核对后重试';
    return { ok: false, code: code || 'rejected', message };
  }
  const now = Date.now();
  const serverNow = new Date(res.body.serverTime).getTime();
  if (isNaN(serverNow)) return { ok: false, code: 'bad-response', message: '服务器返回异常' };
  // 本机时间与服务器偏差过大 → 拒绝（防改本地时间）
  if (Math.abs(now - serverNow) > 7 * 24 * 3600 * 1000) {
    return { ok: false, code: 'clock-skew', message: '本机时间与服务器偏差超过 7 天，请先校准系统时间' };
  }
  saveLicense({
    keyHash: crypto.createHash('sha256').update(key).digest('hex'),
    customer: res.body.customer || '',
    deviceId,
    expiresAt: res.body.expiresAt,
    activatedAt: serverNow,
    lastSeen: now
  });
  return { ok: true, expiresAt: res.body.expiresAt, customer: res.body.customer || '' };
}

module.exports = { checkStatus, activateKey, getMachineId, getLicenseFile, isEnabled, getApiBase };

// 授权总开关：后端未就绪/不想启用时置 false（跳过授权检查，exe 正常用）
function isEnabled() {
  const cfg = getConfig();
  return !!cfg.enabled;
}
function getApiBase() {
  return getConfig().apiBase || '';
}
