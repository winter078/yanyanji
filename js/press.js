/* 按压反馈：按下的那一刻，把缩放原点设在手指落点上，看起来像被手指按进去，而不是整块从中心缩。
   顺便记下点的是哪个图标，供打开 App 的"从图标长出来"动效使用。 */
(function () {
  if (window.__momPressReady) return;
  window.__momPressReady = true;

  var SEL = 'button, [role="button"], .mom-tap-hit, .wechat-back-btn, .ios-app-card, .dock-app-item';
  var cur = null;

  function onDown(e) {
    var el = e.target && e.target.closest && e.target.closest(SEL);
    if (!el) return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;

    var ox = ((e.clientX - r.left) / r.width) * 100;
    var oy = ((e.clientY - r.top) / r.height) * 100;
    ox = Math.max(0, Math.min(100, ox));
    oy = Math.max(0, Math.min(100, oy));
    el.style.transformOrigin = ox.toFixed(1) + '% ' + oy.toFixed(1) + '%';
    el.classList.add('mom-pressing');

    if (cur && cur !== el) cur.classList.remove('mom-pressing');
    cur = el;

    var icon = e.target.closest('.ios-app-card') || e.target.closest('.dock-app-item');
    if (icon) {
      var ir = icon.getBoundingClientRect();
      window.__momLastIconRect = { left: ir.left, top: ir.top, width: ir.width, height: ir.height };
    }
  }

  function onUp() {
    if (!cur) return;
    cur.classList.remove('mom-pressing');
    cur = null;
  }

  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', onUp, true);
  document.addEventListener('click', function () { setTimeout(onUp, 0); }, true);
})();
