#!/usr/bin/env node
// ============================================================
// KOKALabel 报价系统 - 产品密钥生成工具（管理员用）
// 用法：
//   node tools/gen-license-keys.js --customer "XX公司" --days 365
//   node tools/gen-license-keys.js --customers "A公司,B公司,C公司" --days 180 --out keys.csv
// 输出 CSV：key,customer,expiresAt(ISO),createdAt —— 导入你的服务器密钥表
// ============================================================
const crypto = require('crypto');

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (name, def) => { const i = a.indexOf('--' + name); return i >= 0 && a[i + 1] ? a[i + 1] : def; };
  return {
    customer: get('customer', ''),
    customers: get('customers', ''),
    days: parseInt(get('days', '365'), 10) || 365,
    out: get('out', ''),
    count: parseInt(get('count', '1'), 10) || 1
  };
}

// 生成密钥：KOKA-XXXXX-XXXXX-XXXXX（去掉易混淆 0O1lI）
function genKey() {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const seg = n => Array.from(crypto.randomBytes(n)).map(b => charset[b % charset.length]).join('');
  return 'KOKA-' + seg(5) + '-' + seg(5) + '-' + seg(5);
}

function main() {
  const o = parseArgs();
  const customers = (o.customers ? o.customers.split(/[,，]/).map(s => s.trim()).filter(Boolean)
                 : (o.customer ? Array(o.count).fill(o.customer.trim()) : ['客户']));
  const rows = [];
  for (const c of customers) {
    const expires = new Date(Date.now() + o.days * 86400000);
    rows.push({ key: genKey(), customer: c || '客户', expiresAt: expires.toISOString(), createdAt: new Date().toISOString() });
  }
  const header = 'key,customer,expiresAt,createdAt';
  const lines = [header].concat(rows.map(r => [r.key, r.customer, r.expiresAt, r.createdAt].join(',')));
  const text = lines.join('\n');
  if (o.out) {
    require('fs').writeFileSync(o.out, text, 'utf8');
    console.log('已写入 ' + o.out + '（共 ' + rows.length + ' 个密钥）');
  } else {
    console.log(text);
  }
  console.log('\n到期日示例: ' + rows[0].expiresAt.slice(0, 10) + ' （' + o.days + ' 天）');
}

main();
