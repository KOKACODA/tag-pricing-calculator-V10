// ============================================================
// KOKALabel 报价系统 · 账号访问控制（v9.4）
// - http/https 部署强制登录；file:// 本地/exe 不启用
// - 角色：superadmin 超级管理员 / admin 管理员 / sales 业务员 / visitor 访客
// - 访客仅计算器；业务员全页只读；超级管理员可编辑并发布默认报价数据(云端共享)
// ============================================================
(function () {
  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  if (!isHttp) return;

  const SKEY = 'koka_token';
  const ROLE_LABEL = { superadmin: '超管', admin: '管理员', sales: '业务员', visitor: '访客' };
  const roleRank = r => ({ visitor: 0, sales: 1, user: 1, admin: 2, superadmin: 3 }[r] ?? 0);
  const normRole = r => (r === 'user' ? 'sales' : r);
  const returnUrl = () => '/login.html?return=' + encodeURIComponent(location.pathname + location.search + location.hash);

  const token = sessionStorage.getItem(SKEY);
  window.KOKA = {
    token, user: null,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    fmt: t => { if (!t) return '—'; try { return new Date(t).toLocaleString('zh-CN', { hour12: false }); } catch (e) { return '—'; } },
    api: async function (url, opts = {}) {
      const headers = Object.assign({}, opts.headers || {});
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(url, Object.assign({}, opts, { headers }));
      if (res.status === 401) { sessionStorage.removeItem(SKEY); location.replace(returnUrl()); throw new Error('登录已失效'); }
      return res;
    },
    logout: function () { sessionStorage.removeItem(SKEY); location.href = returnUrl(); },
    // v9.4 角色能力
    roleNum: function () { return roleRank(KOKA.user ? KOKA.user.role : 'visitor'); },
    canEditQuote: function () { return KOKA.roleNum() >= 3; },   // 仅超管可编辑/发布默认报价
    toast: function (msg, isErr) {
      let el = document.getElementById('kokaToast');
      if (!el) {
        el = document.createElement('div'); el.id = 'kokaToast';
        el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:99999;padding:10px 18px;border-radius:10px;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.15);color:#fff;transition:opacity .3s;';
        document.body.appendChild(el);
      }
      el.style.background = isErr ? '#dc2626' : '#059669';
      el.textContent = msg; el.style.opacity = '1';
      clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
    }
  };

  if (!token) { document.documentElement.style.display = 'none'; location.replace(returnUrl()); return; }

  document.documentElement.style.display = 'none';
  fetch('/api/auth/session', { headers: { Authorization: 'Bearer ' + token } })
    .then(async r => { if (!r.ok) throw new Error('bad'); return r.json(); })
    .then(d => {
      KOKA.user = d.user; KOKA.user.role = normRole(KOKA.user.role);
      KOKA.loginAt = d.loginAt;
      document.documentElement.style.display = '';
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
      else boot();
    })
    .catch(() => { sessionStorage.removeItem(SKEY); location.replace(returnUrl()); });

  async function boot() {
    applyPagePermission();
    renderTopBar();
    if (KOKA.user.role !== 'visitor') renderAccountPanel();
    if (KOKA.canEditQuote()) renderUploadDefaultBtn();
    await syncCloudQuote();   // 所有角色（含超管/管理员）：登录后先同步一次
    // v9.4.3：所有登录角色每 10 秒静默检测云端是否有新发布的默认报价，有则自动应用
    setInterval(() => { syncCloudQuote(); }, 10000);
  }

  // ---------- 页面权限：访客仅计算器 ----------
  function applyPagePermission() {
    const role = KOKA.user.role;
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
      const p = btn.dataset.page;
      btn.style.display = (role === 'visitor' && p !== 'calculator') ? 'none' : '';
    });
    if (role === 'visitor') {
      const cur = document.querySelector('.page.active');
      if (cur && cur.id !== 'page-calculator' && window.switchPage) switchPage('calculator');
    }
  }

  // ---------- 顶部账号条（内嵌到导航栏，不悬浮，避免遮挡"个人主页"按钮） ----------
  function renderTopBar() {
    const old = document.getElementById('kokaTopBar');
    if (old) old.remove();
    const bar = document.createElement('div'); bar.id = 'kokaTopBar';
    const u = KOKA.user;
    const nm = u.nickname || u.username;
    bar.innerHTML = '<span>' + KOKA.esc(nm) +
      '<span class="koka-role ' + KOKA.esc(u.role) + '">' + (ROLE_LABEL[u.role] || u.role) + '</span></span>' +
      '<button class="btn-exit">退出</button>';
    bar.querySelector('.btn-exit').addEventListener('click', () => KOKA.logout());
    // 注入到顶部导航的右端，与"个人主页"按钮并排，不再固定悬浮
    const navInner = document.querySelector('nav.nav-inner') || document.querySelector('header') || document.body;
    navInner.appendChild(bar);
  }

  // ---------- 云默认数据同步（非超管） ----------
  async function syncCloudQuote() {
    // v9.4.2：超管/管理员/业务员/访客都自动同步云端默认（多管理员协同时互见新版）
    // 说明：超管本地若有"未发布"的修改，遇到他人新发布会被覆盖——请先自行发布/保存
    try {
      const r = await KOKA.api('/api/quote');
      const d = await r.json();
      if (!d.ok || !d.exists) return;
      const lastTs = sessionStorage.getItem('koka_quote_ts');
      if (String(d.updatedAt) === lastTs) return;
      const map = { paperConfig: 'paperConfig', craftConfig: 'craftConfig', ropeConfig: 'ropeConfig', shippingConfig: 'shippingConfig' };
      for (const k of Object.keys(map)) if (d[k] != null) localStorage.setItem('tagPricing_' + map[k], JSON.stringify(d[k]));
      sessionStorage.setItem('koka_quote_ts', String(d.updatedAt));
      // 给用户 1 秒提示后再刷新应用，避免正在操作时突兀闪断
      KOKA.toast('检测到超管发布的【新报价数据】，正在刷新应用…');
      setTimeout(() => location.reload(), 1000);
    } catch (e) { /* 静默 */ }
  }

  // ---------- 超管：发布默认数据按钮（报价表组查询页） ----------
  async function renderUploadDefaultBtn() {
    const title = document.querySelector('#page-table .card-title');
    if (!title) return;
    const btn = document.createElement('button');
    btn.className = 'koka-upload-btn';
    btn.textContent = '↑ 保存为全局默认（云端共享）';
    btn.title = '把当前报价数据（纸张/工艺/吊绳/邮费）发布为所有分账号使用的默认数据';
    title.appendChild(btn);
    btn.addEventListener('click', async () => {
      if (!confirm('确认将当前报价数据发布为全局默认？\n发布后所有业务员/访客登录将使用此版本。')) return;
      try {
        let body;
        try { body = { paperConfig: PAPER_CONFIG, craftConfig: CRAFT_CONFIG, ropeConfig: ROPE_CONFIG, shippingConfig: SHIPPING_CONFIG }; }
        catch (e2) { body = null; }
        if (!body) { KOKA.toast('读取报价数据失败', true); return; }
        const r = await KOKA.api('/api/quote', { method: 'POST', body: JSON.stringify(body) });
        const d = await r.json();
        if (d.ok) { KOKA.toast('已发布为全局默认 ✅'); sessionStorage.setItem('koka_quote_ts', String(d.updatedAt)); }
        else KOKA.toast(d.message || '发布失败', true);
      } catch (e) { KOKA.toast('发布失败：' + e.message, true); }
    });
  }

  // ---------- 个人主页：当前账号卡 ----------
  async function renderAccountPanel() {
    const page = document.getElementById('page-profile');
    if (!page) return;
    const u = KOKA.user;
    const info = document.createElement('div');
    info.className = 'card'; info.style.marginBottom = '16px';
    const expText = u.exp ? '授权至 ' + KOKA.fmt(u.exp) : '长期使用';
    info.innerHTML = `
      <h2 class="card-title">当前账号：<span id="kokaAccName">${KOKA.esc(u.nickname || u.username)}</span>
        <span class="koka-role ${KOKA.esc(u.role)}">${ROLE_LABEL[u.role] || u.role}</span>
        <span style="font-size:13px;color:#64748b;font-weight:500;margin-left:6px">${KOKA.esc(u.username)} · ${KOKA.esc(expText)}</span>
        <span style="float:right">
          <button id="kokaMyNick" style="margin-right:6px;padding:6px 12px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer">修改昵称</button>
          <button id="kokaMyPwd" style="padding:6px 12px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer">修改密码</button>
        </span>
      </h2>`;
    page.insertBefore(info, page.firstChild);
    document.getElementById('kokaMyNick').addEventListener('click', async () => {
      const v = prompt('修改昵称（当前：' + (u.nickname || '') + '）：', u.nickname || '');
      if (v === null) return;
      const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(u.username), { method: 'PATCH', body: JSON.stringify({ nickname: v }) });
      const d = await r.json();
      if (d.ok) { u.nickname = v; document.getElementById('kokaAccName').textContent = v || u.username; KOKA.toast('昵称已更新'); }
      else KOKA.toast(d.message || '更新失败', true);
    });
    document.getElementById('kokaMyPwd').addEventListener('click', async () => {
      const v = prompt('设置新密码（≥6 位）：', '');
      if (!v) return;
      const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(u.username), { method: 'PATCH', body: JSON.stringify({ password: v }) });
      const d = await r.json();
      KOKA.toast(d.ok ? '密码已更新' : (d.message || '更新失败'), !d.ok);
    });
    if (roleRank(u.role) >= 2) await renderAdminPanel(page, u);
  }

  // ---------- 账号管理（超管/管理员） ----------
  function mayManage(actor, targetRole) {
    const a = roleRank(actor), t = roleRank(targetRole);
    if (a >= 3) return true;
    if (a === 2) return t >= 1 && t <= 2;
    return false;
  }

  async function renderAdminPanel(page, me) {
    const box = document.createElement('div');
    box.className = 'card'; box.id = 'accountAdminBox';
    box.innerHTML = `
      <h2 class="card-title">账号管理${roleRank(me.role) >= 3 ? '（超级管理员）' : ''}
        <span style="font-size:12px;color:#94a3b8;font-weight:500">管理员互管不能删/停自己；系统默认保留至少 1 个管理员</span>
      </h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <input id="aUser" placeholder="账号" style="flex:1;min-width:100px;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        <input id="aPass" placeholder="初始密码(≥6)" type="password" style="flex:1;min-width:110px;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        <input id="aNick" placeholder="昵称(选填)" style="flex:1;min-width:90px;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        <select id="aRole" style="padding:8px;border:1px solid #cbd5e1;border-radius:8px">
          ${roleRank(me.role) >= 3 ? '<option value="superadmin">超级管理员</option>' : ''}
          <option value="admin">管理员</option>
          <option value="sales" selected>业务员</option>
          <option value="visitor">访客</option>
        </select>
        <input id="aDays" placeholder="使用天数(空=永久)" type="number" min="1" style="width:140px;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        <button id="aAdd" style="padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer">新增</button>
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
          const exp = uu.expiresAt ? '至 ' + KOKA.fmt(uu.expiresAt) : '永久';
          const tRole = normRole(uu.role);
          const label = ROLE_LABEL[tRole] || tRole;
          const isMe = uu.username === me.username;
          const canM = mayManage(me.role, tRole);
          const st = uu.enabled ? '<span style="color:#059669">启用</span>' : '<span style="color:#dc2626">停用</span>';
          const sub = isMe ? '（当前登录）' : '@' + KOKA.esc(uu.username);
          const ops = [];
          if (isMe) {
            ops.push('<button data-act="nick" data-n="' + KOKA.esc(uu.username) + '">改昵称</button>');
            ops.push('<button data-act="pw" data-n="' + KOKA.esc(uu.username) + '">改密码</button>');
          } else if (canM) {
            ops.push('<button data-act="role" data-n="' + KOKA.esc(uu.username) + '">角色</button>');
            ops.push('<button data-act="nick" data-n="' + KOKA.esc(uu.username) + '">改昵称</button>');
            ops.push('<button data-act="pw" data-n="' + KOKA.esc(uu.username) + '">重置密码</button>');
            ops.push('<button data-act="days" data-n="' + KOKA.esc(uu.username) + '">设时长</button>');
            ops.push('<button data-act="toggle" data-n="' + KOKA.esc(uu.username) + '" data-en="' + (uu.enabled ? 1 : 0) + '">' + (uu.enabled ? '停用' : '启用') + '</button>');
            ops.push('<button data-act="del" data-n="' + KOKA.esc(uu.username) + '" style="color:#dc2626">删除</button>');
          } else ops.push('<span style="color:#94a3b8">—</span>');
          return `<tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:8px 6px;white-space:nowrap"><b>${KOKA.esc(uu.nickname || uu.username)}</b>
              <span class="koka-role ${KOKA.esc(tRole)}">${label}</span>
              <div style="font-size:11px;color:#94a3b8">${KOKA.esc(sub)}</div></td>
            <td style="padding:8px 6px;white-space:nowrap">${st} · ${KOKA.esc(exp)}</td>
            <td style="padding:8px 6px;font-size:12px;color:#64748b">${KOKA.fmt(last && last.at)}${last && last.device ? '<br>' + KOKA.esc(String(last.device).slice(0, 36)) : ''}${last && last.ip && last.ip !== 'unknown' ? ' · ' + KOKA.esc(last.ip) : ''}</td>
            <td style="padding:8px 6px;white-space:nowrap">${ops.join(' ')}</td></tr>`;
        }).join('');
        box.querySelector('#aTable').innerHTML =
          `<thead><tr><th align="left" style="padding:6px">账号</th><th align="left">状态/期限</th><th align="left">最近登录(时间/设备/IP)</th><th align="left">操作</th></tr></thead><tbody>${rows}</tbody>`;
      } catch (e) { say(e.message, true); }
    }

    box.querySelector('#aAdd').addEventListener('click', async () => {
      const un = box.querySelector('#aUser').value.trim();
      const pw = box.querySelector('#aPass').value;
      if (!un || !pw) { say('请填账号和初始密码', true); return; }
      const body = { username: un, password: pw, role: box.querySelector('#aRole').value };
      const nick = box.querySelector('#aNick').value.trim(); if (nick) body.nickname = nick;
      const days = box.querySelector('#aDays').value; if (days) body.days = parseInt(days, 10);
      try {
        const r = await KOKA.api('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
        const d = await r.json();
        say(d.ok ? '已创建 ' + un : (d.message || '创建失败'), !d.ok);
        if (d.ok) { ['#aUser', '#aPass', '#aNick', '#aDays'].forEach(s => box.querySelector(s).value = ''); load(); }
      } catch (e) { say(e.message, true); }
    });

    box.querySelector('#aTable').addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      const name = btn.dataset.n, act = btn.dataset.act;
      try {
        let body = null, doRequest = true;
        if (act === 'nick') { const v = prompt('「' + name + '」昵称：', ''); if (v === null) return; body = { nickname: v }; }
        else if (act === 'pw') { const v = prompt('为「' + name + '」设置新密码（≥6位）：', ''); if (!v) return; body = { password: v }; }
        else if (act === 'days') {
          const v = prompt('「' + name + '」使用时长(天)，留空=永久：', '365'); if (v === null) return;
          body = v.trim() === '' ? { days: 0 } : { days: parseInt(v, 10) };
        }
        else if (act === 'toggle') {
          const nowOn = btn.dataset.en === '1';
          if (!confirm(nowOn ? '确认停用「' + name + '」？停用后无法登录。' : '确认启用「' + name + '」？')) return;
          body = { enabled: !nowOn };
        }
        else if (act === 'del') {
          if (!confirm('确认删除账号「' + name + '」？不可恢复。')) return;
          doRequest = false;
          const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(name), { method: 'DELETE' });
          const d = await r.json(); say(d.ok ? '已删除' : (d.message || '失败'), !d.ok);
        }
        else if (act === 'role') {
          const opts = ['visitor', 'sales', 'admin'].concat(roleRank(me.role) >= 3 ? ['superadmin'] : []);
          const v = prompt('「' + name + '」新角色：' + opts.join('/'), '');
          if (!v || !opts.includes(v)) return;
          body = { role: v };
        }
        if (doRequest && body) {
          const r = await KOKA.api('/api/admin/users/' + encodeURIComponent(name), { method: 'PATCH', body: JSON.stringify(body) });
          const d = await r.json(); say(d.ok ? '已更新' : (d.message || '失败'), !d.ok);
        }
        load();
      } catch (e) { say(e.message, true); }
    });

    await load();
  }
})();
