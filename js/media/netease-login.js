// 网易云扫码登录（登录态存在本机 localStorage，不上传服务器）
// 流程：/api/music/qr-key 取 unikey → 画二维码 → 轮询 /api/music/qr-check → 803 成功拿到 cookie

(function () {
  'use strict';

  var LS_COOKIE = 'momo_netease_cookie';
  var LS_NICK = 'momo_netease_nick';
  var LS_UID = 'momo_netease_uid';
  var LS_PROFILE = 'momo_netease_profile_v1';

  var pollTimer = null;
  var currentKey = '';
  var expireAt = 0;
  var profileFetching = false;
  var profileLastTryAt = 0;

  function getCookie() {
    try { return localStorage.getItem(LS_COOKIE) || ''; } catch (e) { return ''; }
  }
  function getNick() {
    try { return localStorage.getItem(LS_NICK) || ''; } catch (e) { return ''; }
  }

  window.__mzNeteaseCookie = getCookie;
  window.__mzNeteaseLogged = function () { return !!getCookie(); };

  function getUidFromCookie(c) {
    // MUSIC_U 形如 MUSIC_U=xxxx，昵称拿不到时至少能判断登录态
    var m = /MUSIC_U=([^;]+)/.exec(c || '');
    return m ? m[1].slice(0, 6) : '';
  }

  function readProfileCache() {
    try {
      var raw = localStorage.getItem(LS_PROFILE);
      var p = raw ? JSON.parse(raw) : null;
      return p && typeof p === 'object' ? p : null;
    } catch (e) { return null; }
  }

  function saveProfileCache(p) {
    try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch (e) {}
  }

  function clearProfileCache() {
    try { localStorage.removeItem(LS_PROFILE); } catch (e) {}
  }

  function updateVipBadge() {
    var badge = document.getElementById('mz-mine-vip');
    if (!badge) return;
    var logged = !!getCookie();
    var p = readProfileCache();
    var vip = !!(logged && p && p.loggedIn && p.vip);
    badge.classList.toggle('on', vip);
    badge.textContent = 'VIP';
    if (!logged) {
      badge.title = '登录网易云后显示会员状态';
    } else if (p && p.loginExpired) {
      badge.title = '网易云登录已失效，重新扫码后显示';
    } else if (vip) {
      badge.title = '网易云' + (p.vipName || '黑胶VIP') + '已生效';
    } else if (p && p.loggedIn) {
      badge.title = '当前账号未开通黑胶VIP';
    } else {
      badge.title = '正在读取网易云会员状态';
    }
  }

  async function refreshProfile(force) {
    var cookie = getCookie();
    if (!cookie) {
      clearProfileCache();
      updateVipBadge();
      return;
    }
    var cached = readProfileCache();
    if (!force && cached && cached.loggedIn && Date.now() - Number(cached.checkedAt || 0) < 10 * 60 * 1000) {
      updateVipBadge();
      return;
    }
    if (profileFetching) return;
    if (!force && Date.now() - profileLastTryAt < 30 * 1000) return;

    profileFetching = true;
    profileLastTryAt = Date.now();
    try {
      var r = await fetch('/api/music/profile?cb=' + Date.now(), {
        cache: 'no-store',
        headers: { 'x-netease-cookie': cookie }
      });
      var d = await r.json().catch(function () { return {}; });
      if (d && d.loggedIn) {
        saveProfileCache({
          loggedIn: true,
          vip: !!d.vip,
          vipType: d.vipType || 0,
          vipName: d.vipName || '',
          nickname: d.nickname || '',
          avatarUrl: d.avatarUrl || '',
          checkedAt: Date.now()
        });
        if (!getNick() && d.nickname) {
          try { localStorage.setItem(LS_NICK, d.nickname); } catch (e) {}
        }
      } else if (d && d.loginExpired) {
        saveProfileCache({
          loggedIn: false,
          loginExpired: true,
          vip: false,
          checkedAt: Date.now()
        });
      }
    } catch (e) {
      // 网络失败时保留上一次状态，避免把已点亮的 VIP 误判成灰
    }
    profileFetching = false;
    updateVipBadge();
    refreshCard();
  }

  function refreshCard() {
    var card = document.getElementById('mz-nc-card');
    var nameEl = document.getElementById('mz-nc-name');
    var stateEl = document.getElementById('mz-nc-state');
    var loginBtn = document.getElementById('mz-nc-login');
    var outBtn = document.getElementById('mz-nc-out');
    if (!nameEl || !stateEl) return;
    var c = getCookie();
    var p = readProfileCache();
    if (card) card.className = 'mz-nc-card' + (c ? ' logged' : '');
    if (c) {
      var nick = (p && p.nickname) || getNick();
      nameEl.innerText = nick ? ('已连上：' + nick) : '已连上网易云';
      if (p && p.loginExpired) {
        stateEl.innerText = '登录已失效，重新扫码后恢复会员歌';
        stateEl.className = 'mz-nc-state';
      } else if (p && p.vip) {
        stateEl.innerText = '黑胶VIP已生效，会员歌都能放';
        stateEl.className = 'mz-nc-state ok';
      } else if (p && p.loggedIn) {
        stateEl.innerText = '账号已连上；会员歌是否可放看账号权限';
        stateEl.className = 'mz-nc-state ok';
      } else {
        stateEl.innerText = '会员歌、你的歌单都能放了';
        stateEl.className = 'mz-nc-state ok';
      }
      if (loginBtn) loginBtn.style.display = 'none';
      if (outBtn) outBtn.style.display = '';
    } else {
      nameEl.innerText = '还没连网易云';
      stateEl.innerText = '很多歌现在放不出来，扫一下码就能连上';
      stateEl.className = 'mz-nc-state';
      if (loginBtn) loginBtn.style.display = '';
      if (outBtn) outBtn.style.display = 'none';
    }
    updateVipBadge();
  }

  function closeMask() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    var m = document.getElementById('mz-nc-mask');
    if (m) m.remove();
  }

  function setStatus(t, cls) {
    var el = document.getElementById('mz-nc-qr-status');
    if (!el) return;
    el.innerText = t;
    el.className = 'mz-nc-qr-status' + (cls ? ' ' + cls : '');
  }

  function drawQR(payload) {
    var box = document.getElementById('mz-nc-qr-box');
    if (!box) return;
    if (typeof window.qrcode !== 'function') {
      box.innerHTML = '<div style="color:#bbb;font-size:12px;padding:20px;text-align:center">二维码组件没加载上<br>刷新一下页面再试</div>';
      return;
    }
    try {
      var qr = window.qrcode(0, 'M');
      qr.addData(payload);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      var svg = box.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.display = 'block';
        svg.removeAttribute('width');
        svg.removeAttribute('height');
      }
    } catch (e) {
      box.innerHTML = '<div style="color:#ff8a8a;font-size:12px;padding:16px">二维码生成失败：' + (e && e.message ? e.message : e) + '</div>';
    }
  }

  async function newKey() {
    setStatus('正在向网易云要二维码…');
    var box = document.getElementById('mz-nc-qr-box');
    if (box) box.innerHTML = '';
    try {
      var r = await fetch('/api/music/qr-key?cb=' + Date.now(), { cache: 'no-store' });
      var d = await r.json().catch(function () { return {}; });
      if (!d || !d.unikey) {
        setStatus('拿不到二维码：' + ((d && d.message) || '接口没返回'), 'bad');
        return;
      }
      currentKey = d.unikey;
      expireAt = Date.now() + 120000;
      drawQR(d.payload);
      setStatus('用网易云音乐 App 扫这个码');
      startPoll();
    } catch (e) {
      setStatus('网络不通：' + (e && e.message ? e.message : e), 'bad');
    }
  }

  function startPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async function () {
      if (!currentKey) return;
      if (Date.now() > expireAt) { closeMask(); return; }
      try {
        var r = await fetch('/api/music/qr-check?key=' + encodeURIComponent(currentKey) + '&cb=' + Date.now(), { cache: 'no-store' });
        var d = await r.json().catch(function () { return {}; });
        var code = d && d.code;
        if (code === 802) {
          setStatus('扫到了，在手机上点一下「确认登录」', 'warn');
        } else if (code === 803) {
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          if (!d.cookie) {
            setStatus('登录了但没拿到登录态，再扫一次', 'bad');
            return;
          }
          try {
            localStorage.setItem(LS_COOKIE, d.cookie);
            if (d.nickname) localStorage.setItem(LS_NICK, d.nickname);
            localStorage.setItem(LS_UID, getUidFromCookie(d.cookie));
          } catch (e) {}
          setStatus('登录成功，正在刷新…', 'ok');
          refreshCard();
          refreshProfile(true);
          setTimeout(function () {
            closeMask();
            if (typeof window.mzToast === 'function') window.mzToast('网易云已连上');
          }, 700);
        } else if (code === 800) {
          setStatus('二维码过期了，换一张…', 'warn');
          newKey();
        } else if (code === 801) {
          setStatus('等着你扫码…');
        }
      } catch (e) {}
    }, 2000);
  }

  window.mzNeteaseOpen = function () {
    closeMask();
    var mask = document.createElement('div');
    mask.id = 'mz-nc-mask';
    mask.className = 'mz-nc-mask';
    mask.innerHTML =
      '<div class="mz-nc-card">' +
      '  <div class="mz-nc-title">登录网易云</div>' +
      '  <div class="mz-nc-sub">用手机上的网易云音乐扫一下，登录态只存这台小手机里</div>' +
      '  <div class="mz-nc-qr-box" id="mz-nc-qr-box"></div>' +
      '  <div class="mz-nc-qr-status" id="mz-nc-qr-status">准备中…</div>' +
      '  <button class="mz-nc-refresh" onclick="mzNeteaseRefreshQR()">换一张码</button>' +
      '  <button class="mz-nc-close" onclick="mzNeteaseClose()">关掉</button>' +
      '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (ev) {
      if (ev.target === mask) closeMask();
    });
    newKey();
  };

  window.mzNeteaseRefreshQR = function () { currentKey = ''; newKey(); };
  window.mzNeteaseClose = closeMask;

  window.mzNeteaseLogout = function () {
    if (!confirm('要断开网易云吗？断开后会员歌又会放不了。')) return;
    try {
      localStorage.removeItem(LS_COOKIE);
      localStorage.removeItem(LS_NICK);
      localStorage.removeItem(LS_UID);
    } catch (e) {}
    clearProfileCache();
    refreshCard();
    if (typeof window.mzToast === 'function') window.mzToast('已断开网易云');
  };

  window.mzNeteaseRefreshVip = function () { refreshProfile(true); };

  window.mzNeteaseInit = function () {
    refreshCard();
    refreshProfile();
    var badge = document.getElementById('mz-mine-vip');
    if (badge && !badge.__mzVipBound) {
      badge.__mzVipBound = true;
      badge.addEventListener('click', function () { refreshProfile(true); });
    }
    // 老版本可能挂在这，从「我的」页定时对一次状态，避免切页后不显示
    setInterval(refreshCard, 3000);
    setInterval(function () { refreshProfile(); }, 5 * 60 * 1000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.mzNeteaseInit);
  } else {
    window.mzNeteaseInit();
  }
})();
