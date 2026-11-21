/* 小按钮热区补偿：宽度/高度不足 44px 的按钮，用伪元素把可点范围撑到 44px。
   视觉尺寸不变，只让手指更容易点到。新增的按钮也会自动被补上。 */
(function () {
  if (window.__momTouchReady) return;
  window.__momTouchReady = true;

  var MIN = 44;
  var MAX_GROW = 12; // 最多往外撑 12px，太多会误点到旁边的按钮

  var SELECTOR = 'button, [role="button"], .icon-btn, .chat-circle-btn, .moments-action-btn, .moments-back-btn, a.ios-app-item';

  function patch(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.__momPatched) return;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (cs.pointerEvents === 'none') return;
    // 祖先里只要有一个不吃点击（已关闭但还 display:flex 的遮罩），就不要给它扩热区
    var up = el.parentElement;
    var depth = 0;
    while (up && up !== document.body && depth < 8) {
      try {
        if (getComputedStyle(up).pointerEvents === 'none') return;
      } catch (e) {}
      up = up.parentElement;
      depth++;
    }
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.width >= MIN && r.height >= MIN) return;

    el.__momPatched = true;
    el.classList.add('mom-tap-hit');
    if (r.height < MIN) {
      var h = MIN;
      if (h > r.height + MAX_GROW) h = r.height + MAX_GROW;
      el.style.setProperty('--mom-hit-h', h + 'px');
    }
    if (r.width < MIN) {
      var w = MIN;
      if (w > r.width + MAX_GROW) w = r.width + MAX_GROW;
      el.style.setProperty('--mom-hit-w', w + 'px');
    }
  }

  function scan(root) {
    try {
      (root || document).querySelectorAll(SELECTOR).forEach(patch);
    } catch (e) {}
  }

  var timer = null;
  function queue() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; scan(document); }, 160);
  }

  function boot() {
    scan(document);
    // 新增的弹层/按钮：观察 DOM 增量
    try {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].addedNodes && list[i].addedNodes.length) { queue(); return; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    window.addEventListener('resize', queue, { passive: true });
    window.addEventListener('orientationchange', queue, { passive: true });
    // 打开页面/弹层后尺寸可能才稳定，补两轮
    setTimeout(function () { scan(document); }, 900);
    setTimeout(function () { scan(document); }, 2200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
