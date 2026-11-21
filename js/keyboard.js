// 小手机 · 全局键盘避让
// iOS 弹键盘时可视区被顶掉一截，页面本身不动，底部输入框就压在键盘底下。
// 两种情况分别处理：
// 1) 输入框在底部弹层里（发布动态、评论面板等）：把整个弹层抬到键盘上方，弹层内部自己滚；
// 2) 输入框在普通页面里：给最近的可滚动区域在底部留出键盘高度，并把它滚进可视区。
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
    if (!rec) touched.push({ el: el, prop: prop, prev: el.style[prop] || '' });
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

  // 找底部弹层：从输入框往上，最近的、贴着屏幕底部的定位容器
  function findSheet(el) {
    var n = el.parentElement;
    var inner = 0;
    while (n && n !== document.body && n !== document.documentElement) {
      inner++;
      if (inner > 8) break;
      var cs = getComputedStyle(n);
      var r = n.getBoundingClientRect();
      if ((cs.position === 'fixed' || cs.position === 'absolute') &&
          r.height > 120 && r.bottom >= (window.innerHeight - 60)) {
        return n;
      }
      n = n.parentElement;
    }
    return null;
  }

  function biggestChild(sheet) {
    var card = null;
    var best = 0;
    var kids = sheet.children || [];
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      var cs = getComputedStyle(c);
      if (cs.position === 'absolute' && /inset|0px/.test(c.style.inset || '')) continue;
      var h = c.getBoundingClientRect().height;
      if (h > best) { best = h; card = c; }
    }
    return card;
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

    var sheet = findSheet(el);
    if (sheet) {
      // 弹层整块抬到键盘上方，内部自己滚
      setProp(sheet, 'paddingBottom', kb + 'px');
      setProp(sheet, 'boxSizing', 'border-box');
      var card = biggestChild(sheet);
      if (card) {
        setProp(card, 'maxHeight', '100%');
        setProp(card, 'minHeight', '0px');
      }
      setTimeout(function () {
        try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
      }, 120);
      return;
    }

    // 普通页面：给可滚动区域留出键盘高度
    var sc = findScrollable(el);
    if (sc) {
      setProp(sc, 'paddingBottom', (kb + 28) + 'px');
      setProp(sc, 'scrollPaddingBottom', (kb + 28) + 'px');
      setTimeout(function () {
        try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
      }, 100);
    }
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
