// 小手机 · 全局键盘避让
// iOS 弹键盘时可视区被顶掉一截，页面本身不动，底部输入框就压在键盘底下。
// 这里统一处理：任何页面、任何输入框（含以后新加的 App），只要键盘挡住它，
// 就把最近的可滚动区域留出键盘高度的空白并把它滚到可视范围内。
// 聊天页例外：聊天页的输入栏由 css/wechat.css 里的 --mom-kb-h 专门抬升。
(function () {
  var vv = window.visualViewport;
  if (!vv) return;

  var touched = [];
  var timer = null;
  var last = { kb: -1, el: null };

  function kbHeight() {
    var raw = '';
    try { raw = getComputedStyle(document.documentElement).getPropertyValue('--mom-kb-h') || ''; } catch (e) {}
    var n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) return n;
    var ih = window.innerHeight || 0;
    var overlap = ih - vv.height;
    return overlap > 120 ? Math.round(overlap) : 0;
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      return !/^(button|checkbox|radio|submit|reset|file|range|color|image|hidden)$/i.test(el.type || 'text');
    }
    return !!el.isContentEditable;
  }

  function setProp(el, prop, value) {
    var rec = null;
    for (var i = 0; i < touched.length; i++) {
      if (touched[i].el === el && touched[i].prop === prop) { rec = touched[i]; break; }
    }
    if (!rec) {
      touched.push({ el: el, prop: prop, prev: el.style[prop] || '' });
    }
    el.style[prop] = value;
  }

  function clearAll() {
    for (var i = 0; i < touched.length; i++) {
      try { touched[i].el.style[touched[i].prop] = touched[i].prev; } catch (e) {}
    }
    touched = [];
  }

  function findScrollable(el) {
    var n = el.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      var cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
      n = n.parentElement;
    }
    return null;
  }

  function findPanel(el) {
    var n = el.parentElement;
    while (n && n !== document.body) {
      var cs = getComputedStyle(n);
      if (cs.position === 'fixed' || cs.position === 'absolute') return n;
      n = n.parentElement;
    }
    return null;
  }

  function apply() {
    var kb = kbHeight();
    var el = document.activeElement;

    if (kb < 60 || !isEditable(el)) {
      if (touched.length) clearAll();
      last = { kb: -1, el: null };
      return;
    }

    // 聊天页自己抬输入栏，不在这里重复处理
    try { if (el.closest && el.closest('#page-chat')) { last = { kb: kb, el: el }; return; } } catch (e) {}

    if (kb === last.kb && el === last.el && touched.length) return;
    last = { kb: kb, el: el };

    var sc = findScrollable(el);
    if (!sc) {
      var panel = findPanel(el);
      if (panel) {
        setProp(panel, 'overflowY', 'auto');
        setProp(panel, 'webkitOverflowScrolling', 'touch');
        sc = panel;
      }
    }
    if (!sc) return;

    setProp(sc, 'paddingBottom', (kb + 28) + 'px');
    setProp(sc, 'scrollPaddingBottom', (kb + 28) + 'px');

    setTimeout(function () {
      try { el.scrollIntoView({ block: 'nearest' }); }
      catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
    }, 90);
  }

  function schedule(delay) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      try { apply(); } catch (e) {}
    }, delay || 140);
  }

  window.__momKbAvoid = apply;

  vv.addEventListener('resize', function () { schedule(160); });
  vv.addEventListener('scroll', function () { schedule(120); });
  window.addEventListener('resize', function () { schedule(160); });
  window.addEventListener('orientationchange', function () { schedule(340); });
  document.addEventListener('focusin', function () { schedule(230); });
  document.addEventListener('focusout', function () { schedule(320); });
  document.addEventListener('click', function () { schedule(200); }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { schedule(0); });
  } else {
    schedule(0);
  }
})();
