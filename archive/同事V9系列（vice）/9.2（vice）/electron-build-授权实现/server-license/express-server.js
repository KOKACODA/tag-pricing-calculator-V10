// ============================================================
// KOKALabel 报价系统 - 激活接口（通用 Node/Express 版）
// 用法：npm install express 后：node server-license/express-server.js
// 密钥表用一个 JSON 文件存储（keys.json，结构见 README），生产建议换 DB
// ============================================================
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const KEYS_FILE = path.join(__dirname, 'keys.json');
const loadKeys = () => { try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); } catch (e) { return {}; } };
const saveKeys = (k) => fs.writeFileSync(KEYS_FILE, JSON.stringify(k, null, 2), 'utf8');

app.post('/api/license/activate', (req, res) => {
  const { key, deviceId, deviceName } = req.body || {};
  if (!key || !deviceId) return res.status(400).json({ ok: false, code: 'bad_request', message: '缺少 key 或 deviceId' });
  const keys = loadKeys();
  const rec = keys[key];
  const serverTime = new Date().toISOString();
  if (!rec) return res.status(404).json({ ok: false, code: 'not_found', message: '密钥不存在' });
  if (rec.revoked) return res.status(403).json({ ok: false, code: 'revoked', message: '密钥已被吊销' });
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() < Date.now())
    return res.status(403).json({ ok: false, code: 'expired_key', message: '密钥已过期' });
  if (rec.deviceId && rec.deviceId !== deviceId)
    return res.status(403).json({ ok: false, code: 'device_mismatch', message: '该密钥已在其他设备激活' });
  if (!rec.deviceId) {
    rec.deviceId = deviceId;
    rec.activatedAt = serverTime;
    rec.deviceName = deviceName || '';
    saveKeys(keys);
  }
  return res.json({ ok: true, customer: rec.customer || '', expiresAt: rec.expiresAt, serverTime });
});

app.get('/api/license/verify', (req, res) => {
  const keys = loadKeys();
  const rec = keys[req.query.key];
  if (!rec) return res.status(404).json({ ok: false, code: 'not_found' });
  return res.json({ ok: true, revoked: !!rec.revoked, expiresAt: rec.expiresAt, deviceBound: rec.deviceId || null, serverTime: new Date().toISOString() });
});

app.listen(8787, () => console.log('授权服务已启动 http://localhost:8787'));
