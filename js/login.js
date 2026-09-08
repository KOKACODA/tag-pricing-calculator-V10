// ============================================================
// KOKALabel 报价系统 · 登录页脚本（独立文件，满足 CSP script-src 'self'）
// ============================================================
(function () {
  const $u = document.getElementById('username'), $p = document.getElementById('password'),
    $m = document.getElementById('msg'), $b = document.getElementById('loginBtn');
  const $sk = document.getElementById('setupKey'), $sf = document.getElementById('setupField');
  const returnTo = new URLSearchParams(location.search).get('return') || '/';

  function setMsg(t, ok) { $m.textContent = t || ''; $m.className = 'msg ' + (ok ? 'ok' : 'err'); }

  // 已登录直接回
  (async () => {
    const t = sessionStorage.getItem('koka_token');
    if (t) {
      try { const r = await fetch('/api/auth/session', { headers: { Authorization: 'Bearer ' + t } }); if (r.ok) location.href = returnTo; } catch (e) { /* 忽略 */ }
    }
  })();

  // 未初始化时显示初始化密钥输入框
  (async () => {
    try {
      const r = await fetch('/api/auth/status');
      if (r.ok) { const d = await r.json(); if (!d.initialized) $sf.style.display = ''; }
    } catch (e) { /* 忽略 */ }
  })();

  async function login() {
    const username = $u.value.trim(), password = $p.value;
    if (!username || !password) { setMsg('请输入账号和密码'); return; }
    $b.disabled = true; setMsg('登录中…');
    try {
      const body = { username, password, device: navigator.userAgent };
      if ($sk.value.trim()) body.setupKey = $sk.value.trim();
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const d = await r.json();
      if (d.ok) { sessionStorage.setItem('koka_token', d.token); setMsg('登录成功，正在进入…', true); setTimeout(() => { location.href = returnTo; }, 400); }
      else setMsg(d.message || '登录失败');
    } catch (e) { setMsg('网络错误，请重试'); }
    $b.disabled = false;
  }

  $b.addEventListener('click', login);
  $p.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $sk.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
})();
