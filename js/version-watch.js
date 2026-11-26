/* 新版本提示：页面开着时，比对"我自己这版"和"线上那版"，不一样就弹一行“点我刷新”。不自动刷新，不打断播放。
   旧做法是拿第一次请求到的线上版本当基线，于是旧页面永远以为自己是最新的 —— 所以从来没弹过。
   现在改成：页面里写死 window.__BUILD__，线上 /js/build.txt 是当前发布版本，两者一比就知道自己是不是旧的。 */
(function () {
  var mine = (typeof window.__BUILD__ === 'string' && window.__BUILD__ !== '__BUILD_SHA__') ? window.__BUILD__ : null;
  var shown = false;
  var box = null;

  function makeBox() {
    if (box) return box;
    box = document.createElement('div');
    box.id = 'mz-version-toast';
    box.style.cssText = [
      'position:fixed',
      'left:50%',
      'transform:translateX(-50%)',
      'bottom:calc(112px + env(safe-area-inset-bottom))',
      'z-index:2147483000',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:9px 14px',
      'border-radius:999px',
      'background:rgba(255,255,255,.94)',
      'color:#111',
      'font-size:12.5px',
      'font-weight:500',
      'box-shadow:0 8px 26px rgba(0,0,0,.28)',
      'backdrop-filter:blur(12px)',
      '-webkit-backdrop-filter:blur(12px)',
      'white-space:nowrap',
      'cursor:pointer'
    ].join(';');
    box.innerHTML = '新版已经好了 <b style="font-weight:700">· 点我刷新</b>';
    box.addEventListener('click', function () { location.reload(); });
    return box;
  }

  function show() {
    if (shown) return;
    shown = true;
    if (document.body) document.body.appendChild(makeBox());
  }

  var TOAST_KEY = 'mz_version_toast_v1';

  function seenLive() {
    try { return localStorage.getItem(TOAST_KEY) || ''; } catch (e) { return ''; }
  }

  function rememberLive(v) {
    try { localStorage.setItem(TOAST_KEY, v); } catch (e) {}
  }

  function check() {
    if (document.hidden) return;
    if (!mine) return;
    fetch('/js/build.js?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (txt) {
        if (!txt) return;
        var m = /__LIVE_BUILD__\s*=\s*"([^"]+)"/.exec(txt);
        var live = m ? m[1] : null;
        if (!live || live === mine) return;
        // 同一个线上版本只提示一次：用户刷新后仍弹，多半是页面版本号没同步，别再骚扰
        if (seenLive() === live) return;
        rememberLive(live);
        show();
      })
      .catch(function () {});
  }

  if (window.addEventListener) {
    window.addEventListener('load', function () { setTimeout(check, 1500); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  }
  setInterval(check, 60000);
})();

/* 桌面全屏热修加载器：等 phone.html / base.css 的正式改动上线后会自动跳过。 */
(function () {
  if (window.__deskFullLoaded) return;
  var s = document.createElement('script');
  s.src = 'js/desk-full.js?v=20261127-0047b';
  s.async = false;
  (document.head || document.documentElement).appendChild(s);
})();
