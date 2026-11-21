/* 布局过渡（FLIP）：列表重排时，让已有的条目平滑滑到新位置，而不是瞬移。
   用法：window.__momFlip(容器, 重新渲染的函数) */
(function () {
  if (window.__momFlip) return;

  window.__momFlip = function (container, render) {
    if (!container || typeof render !== 'function') {
      if (typeof render === 'function') render();
      return;
    }
    var before = [];
    var kids = container.children;
    for (var i = 0; i < kids.length; i++) {
      before.push({ el: kids[i], top: kids[i].getBoundingClientRect().top });
    }

    render();

    var after = container.children;
    for (var j = 0; j < after.length; j++) {
      var rec = null;
      for (var k = 0; k < before.length; k++) {
        if (before[k].el === after[j]) { rec = before[k]; break; }
      }
      if (!rec) continue;
      var dy = rec.top - after[j].getBoundingClientRect().top;
      if (!dy || Math.abs(dy) < 2) continue;
      try {
        after[j].animate(
          [{ transform: 'translateY(' + dy.toFixed(1) + 'px)' }, { transform: 'translateY(0)' }],
          { duration: 240, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }
        );
      } catch (e) {}
    }
  };
})();
