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
    '.photo-name-modal-mask'
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
    el.style.pointerEvents = 'none';
    setTimeout(function () {
      el.__momCollapsing = false;
      el.style.pointerEvents = prevPE || '';
      if (!el.classList.contains('open')) el.style.display = 'none';
    }, 300);
  }

  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.attributeName !== 'class') continue;
      var el = m.target;
      if (!el.matches || !el.matches(SEL)) continue;
      var before = m.oldValue || '';
      var after = el.className || '';
      if (/\bopen\b/.test(before) && !/\bopen\b/.test(after)) collapse(el);
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
})();
