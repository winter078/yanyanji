// 网易云扫码登录（登录态存在本机 localStorage，不上传服务器）
// 流程：/api/netease/qr/key 取 unikey → 画二维码 → 轮询 /api/netease/qr/check → 803 成功拿到 cookie

(function () {
  'use strict';

  var LS_COOKIE = 'momo_netease_cookie';
  var LS_NICK = 'momo_netease_nick';
  var LS_UID = 'momo_netease_uid';

  var pollTimer = null;
  var currentKey = '';
  var expireAt = 0;

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

  function refreshCard() {
    var card = document.getElementById('mz-nc-card');
    var nameEl = document.getElementById('mz-nc-name');
    var stateEl = document.getElementById('mz-nc-state');
    var loginBtn = document.getElementById('mz-nc-login');
    var outBtn = document.getElementById('mz-nc-out');
    if (!nameEl || !stateEl) return;
    var c = getCookie();
    if (card) card.className = 'mz-nc-card' + (c ? ' logged' : '');
    if (c) {
      var nick = getNick();
      nameEl.innerText = nick ? ('已连上：' + nick) : '已连上网易云';
      stateEl.innerText = '会员歌、你的歌单都能放了';
      stateEl.className = 'mz-nc-state ok';
      if (loginBtn) loginBtn.style.display = 'none';
      if (outBtn) outBtn.style.display = '';
    } else {
      nameEl.innerText = '还没连网易云';
      stateEl.innerText = '很多歌现在放不出来，扫一下码就能连上';
      stateEl.className = 'mz-nc-state';
      if (loginBtn) loginBtn.style.display = '';
      if (outBtn) outBtn.style.display = 'none';
    }
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
      var r = await fetch('/api/netease/qr/key?cb=' + Date.now(), { cache: 'no-store' });
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
        var r = await fetch('/api/netease/qr/check?key=' + encodeURIComponent(currentKey) + '&cb=' + Date.now(), { cache: 'no-store' });
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
    refreshCard();
    if (typeof window.mzToast === 'function') window.mzToast('已断开网易云');
  };

  window.mzNeteaseInit = function () {
    refreshCard();
    // 老版本可能挂在这，从「我的」页定时对一次状态，避免切页后不显示
    setInterval(refreshCard, 3000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.mzNeteaseInit);
  } else {
    window.mzNeteaseInit();
  }
})();
