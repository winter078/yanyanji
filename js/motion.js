/* 收起动效（collapse）：弹层/遮罩原来移除 open 类是瞬间消失，
   这里拦一下，让它按原来的过渡把高度/透明度收回去，再真正隐藏。 */
(function () {
  if (window.__momCollapseReady) return;
  window.__momCollapseReady = true;

  var SEL = [
    '.ios-bottom-sheet-mask',
    '.ios-actionsheet-mask',
    '.wc-modal-mask',
    '.bubble-menu-mask',
    '.bubble-edit-modal-mask',
    '.hero-modal-mask',
    '.cot-modal-mask',
    '.widget-art-modal-mask',
    '.ios-folder-modal-mask',
    '.photo-name-modal-mask',
    '.moment-modal-overlay'
  ].join(',');

  function collapse(el) {
    if (el.__momCollapsing) return;
    el.__momCollapsing = true;
    var prevPE = el.style.pointerEvents;
    // 先把它按打开态锁住，让浏览器认下"正在显示"这个起点
    el.style.display = 'flex';
    el.classList.add('open');
    void el.offsetWidth;
    // 再正常关掉，过渡就从这个起点播出去
    el.classList.remove('open');
    el.classList.add('mom-collapse');
    el.style.pointerEvents = 'none';
    el.__momCollapseTimer = setTimeout(function () {
      el.__momCollapseTimer = 0;
      el.__momCollapsing = false;
      el.style.pointerEvents = prevPE || '';
      el.classList.remove('mom-collapse');
      // 不能留 inline display:none，否则下一次 classList.add('open') 会被内联样式压住，
      // 弹层就变成“只能打开一次”。清回空值，让 .open 的 CSS display:flex 重新生效。
      el.style.display = '';
    }, 300);
  }

  function cancelCollapse(el) {
    if (el.__momCollapseTimer) {
      clearTimeout(el.__momCollapseTimer);
      el.__momCollapseTimer = 0;
    }
    el.__momCollapsing = false;
    el.classList.remove('mom-collapse');
    el.style.display = '';
    el.style.pointerEvents = '';
  }

  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.attributeName !== 'class') continue;
      var el = m.target;
      if (!el.matches || !el.matches(SEL)) continue;
      var before = m.oldValue || '';
      var after = el.className || '';
      var wasOpen = /\bopen\b/.test(before);
      var isOpen = /\bopen\b/.test(after);
      if (!wasOpen && isOpen) {
        // 如果在收起动画的 300ms 内又打开了，取消上一次的收尾，避免它把 display 锁死。
        cancelCollapse(el);
      } else if (wasOpen && !isOpen) {
        collapse(el);
      }
    }
  });

  function start() {
    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
      subtree: true
    });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  // 切页/回桌面时，把顶层弹层、抽屉、遮罩一并收掉，免得有东西卡在桌面上
  var OVERLAYS = [
    '.ledger-drawer-mask',
    '.vault-char-drawer-mask',
    '.ios-bottom-sheet-mask',
    '.ios-actionsheet-mask',
    '.wc-modal-mask',
    '.bubble-menu-mask',
    '.bubble-edit-modal-mask',
    '.hero-modal-mask',
    '.cot-modal-mask',
    '.widget-art-modal-mask',
    '.ios-folder-modal-mask',
    '.photo-name-modal-mask',
    '.moment-modal-overlay',
    '.wechat-plus-dropdown',
    '.plus-action-drawer-v3'
  ].join(',');

  window.__momCloseOverlays = function () {
    var nodes;
    try { nodes = document.querySelectorAll(OVERLAYS); } catch (e) { return; }
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.classList.contains('open')) el.classList.remove('open');
      el.classList.remove('mom-collapse');
      // 清掉键盘避让可能留下的内联样式（否则会只剩一个按钮露在桌面上）
      el.style.paddingBottom = '';
      el.style.boxSizing = '';
      el.style.opacity = '';
      el.style.transform = '';
      el.style.pointerEvents = '';
      if (el.style.display) el.style.display = '';
      var kids = el.querySelectorAll('div, .ios-bottom-sheet-card, .ledger-drawer-card, .moment-modal-card');
      for (var k = 0; k < kids.length; k++) {
        var kid = kids[k];
        if (kid.style.maxHeight === '100%') kid.style.maxHeight = '';
        if (kid.style.minHeight === '0px') kid.style.minHeight = '';
      }
    }
  };
})();
