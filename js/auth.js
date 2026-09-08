// ============================================================
// KOKALabel 报价系统 · 账号访问控制（前端）
// - 通过 http/https 部署时强制登录（管理员/业务员/访客）
// - file:// 或本机离线打开不启用（不影响本地/exe 使用）
// - 管理员登录后可在「个人主页」管理账号；可上传默认数据
// - 角色：admin=管理员(超级管理员) / sales=业务员 / guest=访客
// ============================================================
(function () {
  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  if (!isHttp) return; // 本地/离线：不启用

  const SKEY = 'koka_token';
  const returnUrl = () => '/login.html?return=' + encodeURIComponent(location.pathname + location.search + location.hash);

  const token = sessionStorage.getItem(SKEY);

  // 暴露 API（供业务与页面使用）
  window.KOKA = {
    token,
    user: null,
    loginAt: null,
    roleLabel: function (r) { return r === 'admin' ? '管理员' : r === 'sales' ? '业务员' : '访客'; },
    api: async function (url, opts = {}) {
      const headers = Object.assign({}, opts.headers || {});
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(url, Object.assign({}, opts, { headers }));
      if (res.status === 401) { sessionStorage.removeItem(SKEY); location.replace(returnUrl()); throw new Error('登录已失效'); }
      return res;
    },
    logout: function () { sessionStorage.removeItem(SKEY); location.href = returnUrl(); },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    fmtDate: function (t) { if (!t) return '—'; try { return new Date(t).toLocaleString('zh-CN', { hour12: false }); } catch (e) { return '—'; } }
  };

  // 未登录：立即跳登录（先隐藏页面避免闪烁）
  if (!token) { document.documentElement.style.display = 'none'; location.replace(returnUrl()); return; }

  // 有 token：隐藏页面 → 校验会话 → 拉取默认数据 → 放行
  document.documentElement.style.display = 'none';
  fetch('/api/auth/session', { headers: { Authorization: 'Bearer ' + token } })
    .then(async r => {
      if (!r.ok) throw new Error('bad');
      const d = await r.json();
      KOKA.user = d.user;
      KOKA.loginAt = d.loginAt;
      const reloaded = await applyDefaultData();
      if (reloaded) return; // 已应用新默认数据并重载页面
      document.documentElement.style.display = '';
      applyRoleGating();
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderAccountPanel);
      else renderAccountPanel();
    })
    .catch(() => { sessionStorage.removeItem(SKEY); location.replace(returnUrl()); });

  // ---------- 默认数据自动应用（管理员上传 → 全员共享） ----------
  // 后端默认数据版本 > 本地已应用版本 → 覆盖配置类 localStorage → 重载页面让 data.js 生效
  async function applyDefaultData() {
    try {
      const r = await fetch('/api/default', { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) return false;
      const d = await r.json();
      if (!d.ok || !d.data || !d.version) return false;
      const applied = localStorage.getItem('koka_default_version');
      if (applied && Number(applied) >= Number(d.version)) return false;
      const store = (k, v) => { try { localStorage.setItem('tagPricing_' + k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } };
      const data = d.data;
      if (data.paperConfig) store('paperConfig', data.paperConfig);
      if (data.craftConfig) store('craftConfig', data.craftConfig);
      if (data.ropeConfig) store('ropeConfig', data.ropeConfig);
      if (data.shippingConfig) store('shippingConfig', data.shippingConfig);
      if (data.customerLevels) store('customerLevels', data.customerLevels);
      if (data.priceLists) store('priceLists', data.priceLists);
      localStorage.setItem('koka_default_version', String(d.version));
      location.reload();
      return true;
    } catch (e) { return false; }
  }

  // ---------- 角色页面控制：访客只保留「智能报价计算器」 ----------
  function applyRoleGating() {
    const role = KOKA.user && KOKA.user.role;
    if (role !== 'guest') return;
    document.querySelectorAll('.nav-btn[data-page="table"], .nav-btn[data-page="profile"]').forEach(b => { b.style.display = 'none'; });
    ['page-table', 'page-profile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const active = document.querySelector('.page.active');
    if (active && active.id !== 'page-calculator') {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const calc = document.getElementById('page-calculator');
      if (calc) calc.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === 'calculator'));
    }
  }

  // ---------- 个人主页账号面板（当前账号 + 管理员管理区） ----------
  async function renderAccountPanel() {
    const page = document.getElementById('page-profile');
    if (!page) return;
    const u = KOKA.user;
    const infoCard = document.createElement('div');
    infoCard.className = 'card';
    infoCard.style.marginBottom = '16px';
    const expText = u.exp ? '授权使用至 ' + KOKA.fmtDate(u.exp) : '长期使用';
    const displayName = u.nickname ? (u.nickname + '（' + u.username + '）') : u.username;
    infoCard.innerHTML = `
      <h2 class="card-title">当前登录 · <span id="kokaAccountName">${KOKA.esc(displayName)}</span>
        <span style="font-size:13px;color:#64748b;font-weight:500">（${KOKA.esc(KOKA.roleLabel(u.role))} · ${KOKA.esc(expText)}）</span>
        <button id="kokaLogoutBtn" style="float:right;padding:6px 14px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px">退出登录</button>
      </h2>`;
    page.insertBefore(infoCard, page.firstChild);
    document.getElementById('kokaLogoutBtn').addEventListener('click', () => KOKA.logout());

    if (u.role === 'admin') await renderAdminPanel(page);
  }

  async function renderAdminPanel(page) {
    const box = document.createElement('div');
    box.className = 'card';
    box.id = 'accountAdminBox';
    box.innerHTML = `
      <h2 class="card-title">账号管理（管理员）</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <input id="aUser" placeholder="新账号" style="flex:1;min-width:110px;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        <input id="aPass" placeholder="初始密码(≥6位)" type="password" style="flex:1;min-width:110px;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        <select id="aRole" style="padding:8px;border:1px solid #cbd5e1;border-radius:8px">
          <option value="guest">访客</option>
          <option value="sales">业务员</option>
          <option value="admin">管理员</option>
        </select>
        <input id="aNick" placeholder="昵称(可选)" style="flex:1;min-width:90px;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        <input id="aDays" placeholder="时长(天)，空=永久" type="number" min="1" style="width:150px;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        <button id="aAdd" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer">新增账号</button>
      </div>
      <div style="overflow:auto"><table id="aTable" style="width:100%;border-collapse:collapse;font-size:13px"></table></div>
      <div id="aMsg" style="margin-top:8px;font-size:13px;min-height:18px"></div>`;
    page.appendChild(box);

    const msg = box.querySelector('#aMsg');
    const say = (t, err) => { msg.textContent = t; msg.style.color = err ? '#dc2626' : '#059669'; };

    async function load() {
      try {
        const r = await KOKA.api('/api/admin/users');
        const d = await r.json();
        const rows = (d.users || []).map(uu => {
          const last = uu.lastLogin;
          const exp = uu.expiresAt ? '至 ' + KOKA.fmtDate(uu.expiresAt) : '永久';
          const nm = uu.nickname ? (uu.nickname + ' <span style="color:#94a3b8">(' + KOKA.esc(uu.username) + ')</span>') : '<b>' + KOKA.esc(uu.username) + '</b>';
          const self = uu.username === KOKA.user.username;
          return `<tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:8px 6px">${nm}<br><span style="font-size:12px;color:${uu.role === 'admin' ? '#b45309' : '#64748b'}">${KOKA.esc(KOKA.roleLabel(uu.role))}</span></td>
            <td style="padding:8px 6px">${uu.enabled ? '<span style="color:#059669">启用</span>' : '<span style="color:#dc2626">停用</span>'} · ${KOKA.esc(exp)}</td>
            <td style="padding:8px 6px;font-size:12px;color:#64748b">最近登录：${KOKA.fmtDate(last && last.at)}<br>${KOKA.esc(last ? (last.device || '').slice(0, 60) : '—')}${last && last.ip && last.ip !== 'unknown' ? '<br>IP:' + KOKA.esc(last.ip) : ''}</td>
            <td style="padding:8px 6px;white-space:nowrap">
              <button data-act="nick" data-n="${KOKA.esc(uu.username)}" style="margin:1px">昵称</button>
              <button data-act="pw" data-n="${KOKA.esc(uu.username)}" style="margin:1px">改密码</button>
              ${self ? '<span style="color:#94a3b8;margin:1px">当前账号</span>' : `
              <button data-act="days" data-n="${KOKA.esc(uu.username)}" style="margin:1px">设时长</button>
              <button data-act="toggle" data-n="${KOKA.esc(uu.username)}" style="margin:1px">${uu.enabled ? '停用' : '启用'}</button>
              <button data-act="del" data-n="${KOKA.esc(uu.username)}" style="margin:1px;color:#dc2626">删除</button>`}
            </td></tr>`;
        }).join('');
        box.querySelector('#aTable').innerHTML = `<thead><tr><th align="left" style="padding:6px">账号/昵称</th><th align="left">角色</th><th align="left">状态/期限</th><th align="left">最近登录(时间/设备/IP)</th><th align="left">操作</th></tr></thead><tbody>${rows}</tbody>`;
      } catch (e) { say(e.message, true); }
    }

    box.querySelector('#aAdd').addEventListener('click', async () => {
      const un = box.querySelector('#aUser').value.trim();
      const pw = box.querySelector('#aPass').value;
      const role = box.querySelector('#aRole').value;
      const nick = box.querySelector('#aNick').value.trim();
      const days = box.querySelector('#aDays').value;
      if (!un || !pw) { say('请填账号和初始密码', true); return; }
      const body = { username: un, password: pw, role };
      if (nick) body.nickname = nick;
      if (days) body.days = parseInt(days, 10);
      try {
        const r = await KOKA.api('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
        const d = await r.json();
        say(d.ok ? '已创建账号 ' + un : (d.message || '创建失败'), !d.ok);
        if (d.ok) { ['#aUser', '#aPass', '#aNick', '#aDays'].forEach(s => { box.querySelector(s).value = ''; }); load(); }
      } catch (e) { say(e.message, true); }
    });

    box.querySelector('#aTable').addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      const name = btn.dataset.n;
      const act = btn.dataset.act;
      try {
        if (act === 'nick') {
          const v = prompt('设置「' + name + '」的昵称（留空清除）：', '');
          if (v === null) return;
          const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(name), { method: 'PATCH', body: JSON.stringify({ nickname: v }) });
          const d = await r.json(); say(d.ok ? '已更新昵称' : (d.message || '失败'), !d.ok);
        } else if (act === 'pw') {
          const v = prompt('重置「' + name + '」的密码：', '');
          if (!v) return;
          const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(name), { method: 'PATCH', body: JSON.stringify({ password: v }) });
          const d = await r.json(); say(d.ok ? '已重置密码' : (d.message || '失败'), !d.ok);
        } else if (act === 'days') {
          const v = prompt('「' + name + '」设置使用时长(天)，留空=永久：', '365');
          if (v === null) return;
          const body = v.trim() === '' ? { days: 0 } : { days: parseInt(v, 10) };
          const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(name), { method: 'PATCH', body: JSON.stringify(body) });
          const d = await r.json(); say(d.ok ? '已设置' : (d.message || '失败'), !d.ok);
        } else if (act === 'toggle') {
          // v9.5 修复：按钮文本=将要执行的动作。显示「停用」→ enabled:false；显示「启用」→ enabled:true
          const cur = btn.textContent.trim();
          const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(name), { method: 'PATCH', body: JSON.stringify({ enabled: cur === '停用' ? false : true }) });
          const d = await r.json(); say(d.ok ? '已更新' : (d.message || '失败'), !d.ok);
        } else if (act === 'del') {
          if (!confirm('确认删除账号「' + name + '」？此操作不可恢复')) return;
          const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(name), { method: 'DELETE' });
          const d = await r.json(); say(d.ok ? '已删除' : (d.message || '失败'), !d.ok);
        }
        load();
      } catch (e) { say(e.message, true); }
    });

    await load();
  }
})();
