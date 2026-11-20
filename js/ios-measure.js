// 一次性真机测量：只在主屏独立模式（standalone）跑一次，截图交差后自动永久关闭
// 目的：拿到每个 App 页头的真实 top / height，以及外层的 padding、机身高度
// 拿到数字后本文件会从仓库删除

(function () {
  'use strict';
  var KEY = 'momMeasureDone_v1';
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) {}

  function close() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    var p = document.getElementById('__measurePanel');
    if (p) p.remove();
  }

  function rows() {
    var out = [];
    var vv = window.visualViewport || {};
    out.push('class=' + (document.documentElement.className || '(空)') +
      '  standalone=' + (navigator.standalone === true ? 1 : 0));
    out.push('视口 ' + window.innerWidth + 'x' + window.innerHeight +
      '  screen ' + screen.width + 'x' + screen.height +
      '  vv ' + (vv.height ? Math.round(vv.height) : '-'));

    var ps = document.getElementById('phone-screen-root');
    if (ps) {
      var pr = ps.getBoundingClientRect(), pcs = getComputedStyle(ps);
      out.push('机身 top' + Math.round(pr.top) + ' h' + Math.round(pr.height) +
        '  padding-top=' + pcs.paddingTop + ' bottom=' + pcs.paddingBottom);
    }
    var vc = document.querySelector('.view-container');
    if (vc) {
      var vr = vc.getBoundingClientRect();
      out.push('容器 top' + Math.round(vr.top) + ' h' + Math.round(vr.height));
    }

    var pages = document.querySelectorAll('.view-container [id^="page-"]');
    var i;
    for (i = 0; i < pages.length; i++) {
      var el = pages[i];
      var oldCls = el.className, oldStyle = el.getAttribute('style');
      el.className = oldCls + ' active';
      el.style.animation = 'none';
      el.style.display = 'flex';
      var r = el.getBoundingClientRect();
      var head = null;
      for (var j = 0; j < el.children.length; j++) {
        var k = el.children[j], kr = k.getBoundingClientRect();
        if (kr.height < 20) continue;
        var cs = getComputedStyle(k);
        head = (String(k.className || '').trim().split(/\s+/)[0] || k.tagName) +
          ' top' + Math.round(kr.top - r.top) + ' h' + Math.round(kr.height) +
          ' pt' + cs.paddingTop;
        break;
      }
      out.push(el.id.replace('page-', '') + ': page top' + Math.round(r.top) + ' h' + Math.round(r.height) +
        ' | ' + (head || '(无头部层)'));
      el.className = oldCls;
      if (oldStyle === null) el.removeAttribute('style'); else el.setAttribute('style', oldStyle);
    }
    return out;
  }

  function show() {
    if (document.getElementById('__measurePanel')) return;
    var p = document.createElement('div');
    p.id = '__measurePanel';
    p.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;z-index:2147483647;' +
      'background:#0b0b0d;color:#8ef0ff;font:11px/1.5 ui-monospace,Menlo,monospace;' +
      'padding:44px 10px 10px;overflow:auto;-webkit-overflow-scrolling:touch;';
    var txt = rows().join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    p.innerHTML =
      '<div style="color:#fff;font-size:14px;margin-bottom:8px">量一次真机，截图给豆包，然后点下面关掉</div>' +
      '<pre style="margin:0;white-space:pre-wrap">' + txt + '</pre>' +
      '<button id="__measureClose" style="margin-top:14px;width:100%;padding:12px;border-radius:12px;' +
      'border:none;background:#2b2f36;color:#fff;font-size:14px">已截图，关掉</button>';
    document.body.appendChild(p);
    var btn = document.getElementById('__measureClose');
    if (btn) btn.onclick = close;
  }

  setTimeout(show, 900);
})();
