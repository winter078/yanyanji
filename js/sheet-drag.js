/* 抽屉/半屏面板：拖动顶部小条可以往下甩着收起，不用精准点到某个按钮。 */
(function () {
  if (window.__momSheetDragReady) return;
  window.__momSheetDragReady = true;

  var GRABBERS = '.ios-bottom-sheet-grabber,.moment-sheet-grabber,.modal-sheet-handle,.xianguo-sheet-drag-handle,.ledger-drawer-handle';

  function panelOf(g) {
    return g.closest('.ios-bottom-sheet-card') ||
      g.closest('.moment-modal-card') ||
      g.closest('.xianguo-sheet') ||
      g.closest('.ledger-drawer-panel') ||
      g.parentElement;
  }

  function maskOf(panel) {
    return panel.closest('.ios-bottom-sheet-mask, .ios-actionsheet-mask, .moment-modal-overlay');
  }

  function dismiss(panel) {
    var mask = maskOf(panel);
    panel.style.transition = '';
    panel.style.transform = '';
    panel.style.willChange = '';
    if (panel.classList.contains('moment-modal-card')) {
      if (typeof window.closeCreateMomentModal === 'function') { window.closeCreateMomentModal(); return; }
    }
    if (mask) mask.classList.remove('open');
    else panel.classList.remove('open');
  }

  var drag = null;

  document.addEventListener('pointerdown', function (e) {
    var g = e.target && e.target.closest && e.target.closest(GRABBERS);
    if (!g) return;
    var panel = panelOf(g);
    if (!panel) return;
    var mask = maskOf(panel);
    var visible = mask ? mask.classList.contains('open') : true;
    if (!visible) return;

    drag = { g: g, panel: panel, startY: e.clientY, dy: 0, lastY: e.clientY, lastT: Date.now(), v: 0 };
    g.style.touchAction = 'none';
    panel.style.transition = 'none';
    panel.style.willChange = 'transform';
    try { g.setPointerCapture && g.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dy = e.clientY - drag.startY;
    if (dy < 0) dy = dy * 0.25; // 往上拉给一点阻尼，不真的把面板拽出去
    drag.dy = dy;
    var t = Date.now();
    if (t > drag.lastT) drag.v = (e.clientY - drag.lastY) / (t - drag.lastT);
    drag.lastY = e.clientY;
    drag.lastT = t;
    drag.panel.style.transform = 'translateY(' + dy.toFixed(1) + 'px)';
    e.preventDefault();
  }, { passive: false });

  function end(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    d.g.style.touchAction = '';
    var shouldClose = d.dy > 96 || (d.dy > 34 && d.v > 0.4);
    if (shouldClose) {
      d.panel.style.transform = 'translateY(' + Math.max(d.dy, 140) + 'px)';
      requestAnimationFrame(function () { dismiss(d.panel); });
    } else {
      d.panel.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)';
      d.panel.style.transform = '';
      setTimeout(function () {
        if (d.panel.style.transform === '') d.panel.style.transition = '';
      }, 320);
    }
  }

  document.addEventListener('pointerup', end, { passive: true });
  document.addEventListener('pointercancel', end, { passive: true });
})();
