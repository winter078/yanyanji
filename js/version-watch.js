/* 新版本提示：页面开着时，发现线上已换版本就弹一行“点我刷新”。不自动刷新，不打断播放。 */
(function () {
  var baseline = null;
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

  function check() {
    if (document.hidden) return;
    fetch('/api/version?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.v) return;
        if (!baseline) { baseline = d.v; return; }
        if (d.v !== baseline) show();
      })
      .catch(function () {});
  }

  if (window.addEventListener) {
    window.addEventListener('load', function () { setTimeout(check, 2500); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  }
  setInterval(check, 60000);
})();
