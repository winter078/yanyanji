// ==========================================================================
// 🛍️ 应用商店 · App Store 版（今天 / 应用 / 搜索 + 详情页）
// 依赖 drag-grid.js 暴露的 MOMO_APP_REGISTRY 与 momoDeskIconSvg
// ==========================================================================

(function () {
  const reg = () => window.MOMO_APP_REGISTRY || {};
  const svgOf = (id) => (window.momoDeskIconSvg ? window.momoDeskIconSvg(id) : '');
  const installed = (id) => (window.isAppInstalled ? window.isAppInstalled(id) : false);
  // 商店自己不上架
  const apps = () => Object.values(reg()).filter(a => a.id !== 'app-app-store');

  const FEATURED = ['app-rp', 'app-xhs', 'app-music', 'app-yanyan-cat'];
  const PICKS = ['app-reader', 'app-ledger', 'app-daysmatter', 'app-avatar-vault'];
  const SECTIONS = [
    { cat: 'social', title: '陪着她' },
    { cat: 'life', title: '日子里' },
    { cat: 'tools', title: '修手机' }
  ];

  const el = (id) => document.getElementById(id);
  let curTab = 'today';
  let curCat = 'all';
  let curQuery = '';

  function dateText() {
    const d = new Date();
    const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + w;
  }

  function iconTile(app, cls) {
    return '<div class="asa-ico-tile ' + (cls || '') + '">' + (svgOf(app.id) || '') + '</div>';
  }

  function getBtn(app, extra) {
    const on = installed(app.id);
    return '<button class="asa-get' + (on ? ' is-open' : '') + '" data-act="' + (on ? 'open' : 'install') +
      '" data-id="' + app.id + '"' + (extra || '') + '>' + (on ? '打开' : '获取') + '</button>';
  }

  // ---------- 今天 ----------
  function renderToday() {
    const list = apps();
    const hero = reg()['app-rp'] || list[0];
    if (!hero) return;

    const featured = FEATURED.map(id => reg()[id]).filter(Boolean);
    const picks = PICKS.map(id => reg()[id]).filter(Boolean);

    el('asa-today-body').innerHTML =
      '<div class="asa-hero" data-act="detail" data-id="' + hero.id + '">' +
        '<div class="asa-hero-art">' +
          featured.map(a => '<span class="asa-hero-chip">' + (svgOf(a.id) || '') + '</span>').join('') +
        '</div>' +
        '<div class="asa-hero-label">小手机精选</div>' +
        '<div class="asa-hero-title">给你的桌面<br>换一套新零件</div>' +
        '<div class="asa-hero-desc">' + (hero.desc || '') + '</div>' +
        '<div class="asa-hero-foot">' + getBtn(hero) + '<span class="asa-hero-hint">今天推荐 · 不用装一整屏</span></div>' +
      '</div>' +

      '<div class="asa-sec-head"><span>编辑推荐</span><span class="asa-sec-more" data-act="tab" data-tab="apps">全部 ›</span></div>' +
      '<div class="asa-grid">' +
        featured.map(a => '<div class="asa-card">' +
          '<div class="asa-card-top">' + iconTile(a) + getBtn(a) + '</div>' +
          '<div class="asa-card-name">' + a.name + '</div>' +
          '<div class="asa-card-cat">' + (a.categoryName || '应用') + '</div>' +
          '<div class="asa-card-desc">' + (a.desc || '') + '</div>' +
        '</div>').join('') +
      '</div>' +

      '<div class="asa-sec-head"><span>今天值得一试</span></div>' +
      '<div class="asa-rows">' + picks.map(a => rowHtml(a)).join('') + '</div>';
  }

  function rowHtml(a) {
    return '<div class="asa-row">' +
      '<div class="asa-row-main" data-act="detail" data-id="' + a.id + '">' +
        iconTile(a) +
        '<div class="asa-row-txt">' +
          '<div class="asa-row-name">' + a.name + '</div>' +
          '<div class="asa-row-sub">' + (a.categoryName || '') + ' · ' + (a.desc || '') + '</div>' +
        '</div>' +
      '</div>' +
      getBtn(a) +
    '</div>';
  }

  // ---------- 应用 ----------
  function renderApps() {
    const all = apps();
    const cats = [['all', '全部'], ['social', '陪伴'], ['life', '生活'], ['tools', '工具']];
    el('asa-chips').innerHTML = cats.map(([k, n]) =>
      '<button class="asa-chip' + (curCat === k ? ' on' : '') + '" data-act="cat" data-cat="' + k + '">' + n + '</button>'
    ).join('');

    const groups = curCat === 'all'
      ? SECTIONS.map(s => ({ title: s.title, apps: all.filter(a => a.category === s.cat) }))
      : [{ title: (cats.find(c => c[0] === curCat) || ['', ''])[1], apps: all.filter(a => a.category === curCat) }];

    el('asa-apps-body').innerHTML = groups.map(g =>
      '<div class="asa-sec-head"><span>' + g.title + '</span><span class="asa-sec-count">' + g.apps.length + ' 件</span></div>' +
      '<div class="asa-rows">' + g.apps.map(rowHtml).join('') + '</div>'
    ).join('');
  }

  // ---------- 搜索 ----------
  function renderSearch() {
    const all = apps();
    const q = curQuery.trim().toLowerCase();
    const hit = q ? all.filter(a => (a.name + a.desc + (a.categoryName || '')).toLowerCase().indexOf(q) >= 0) : all;

    el('asa-search-body').innerHTML =
      (q ? '<div class="asa-sec-head"><span>结果</span><span class="asa-sec-count">' + hit.length + ' 件</span></div>'
         : '<div class="asa-sec-head"><span>随便逛逛</span></div>') +
      '<div class="asa-rows">' + hit.map(rowHtml).join('') + '</div>' +
      (hit.length ? '' : '<div class="asa-empty">没找到，换个词试试</div>');
  }

  // ---------- 详情 ----------
  function openDetail(id) {
    const a = reg()[id];
   if (!a) return;
    const shots = [0, 1, 2].map(() =>
      '<div class="asa-shot">' +
        '<div class="asa-shot-frame">' +
          '<span class="asa-shot-bar"></span>' +
          '<span class="asa-shot-bar short"></span>' +
          '<span class="asa-shot-block"></span>' +
          '<span class="asa-shot-bar"></span>' +
        '</div>' +
        '<span class="asa-shot-cap">界面示意 · ' + a.name + '</span>' +
      '</div>').join('');

    el('asa-detail-body').innerHTML =
      '<div class="asa-detail-top"><button class="asa-detail-close" data-act="close">完成</button></div>' +
      '<div class="asa-detail-head">' + iconTile(a, 'asa-ico-lg') +
        '<div class="asa-detail-titlebox">' +
          '<div class="asa-detail-name">' + a.name + '</div>' +
          '<div class="asa-detail-sub">' + (a.categoryName || '应用') + '</div>' +
          '<div class="asa-detail-by">MOMO 小手机 · 原生应用</div>' +
        '</div></div>' +
      '<div class="asa-detail-actions">' + getBtn(a, ' style="min-width:92px"') +
        (installed(a.id) ? '<button class="asa-ghost" data-act="uninstall" data-id="' + a.id + '">卸载</button>' : '') +
      '</div>' +
      '<div class="asa-stats">' +
        '<div class="asa-stat"><b>4.8</b><span>评分</span></div>' +
        '<div class="asa-stat"><b>12+</b><span>年龄</span></div>' +
        '<div class="asa-stat"><b>2.6 M</b><span>大小</span></div>' +
        '<div class="asa-stat"><b>中文</b><span>语言</span></div>' +
      '</div>' +
      '<div class="asa-shots">' + shots + '</div>' +
      '<div class="asa-detail-desc">' + (a.desc || '小手机原生扩展应用。') +
        '<br><br>它是小手机里的一件原生零件，装好之后直接躺在桌面上，点开就能用。数据都存在你自己的设备里，不会上传。' +
        '<br><br>不需要的时候，在商店详情里点「卸载」，桌面格子会一起收回去。' +
      '</div>' +
      '<div class="asa-info">' +
        '<div class="asa-info-row"><span>提供者</span><span>MOMO 工作室</span></div>' +
        '<div class="asa-info-row"><span>类别</span><span>' + (a.categoryName || '应用') + '</span></div>' +
        '<div class="asa-info-row"><span>兼容性</span><span>小手机 · 全部版本</span></div>' +
        '<div class="asa-info-row"><span>安装位置</span><span>桌面格子</span></div>' +
      '</div>';
    el('asa-detail').classList.add('show');
  }

  function closeDetail() {
    el('asa-detail').classList.remove('show');
  }

  // ---------- 动作 ----------
  function act(id, mode) {
    const a = reg()[id];
    if (!a) return;
    if (mode === 'open' || installed(id)) {
      closeDetail();
      if (a.action && typeof window[a.action] === 'function') window[a.action]();
      else if (a.page && window.openPage) window.openPage(a.page);
      return;
    }
    if (window.installAppToDesktop) window.installAppToDesktop(a);
    toast('「' + a.name + '」已加到桌面');
    refresh();
    if (el('asa-detail').classList.contains('show')) openDetail(id);
  }

  let toastTimer = null;
  function toast(msg) {
    let t = el('asa-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'asa-toast';
      t.className = 'asa-toast';
      (el('page-app-store') || document.body).appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  // ---------- 切换 ----------
  window.asaTab = function (tab) {
    curTab = tab;
    ['today', 'apps', 'search'].forEach(k => {
      const pane = el('asa-pane-' + k);
      if (pane) pane.style.display = (k === tab) ? '' : 'none';
    });
    document.querySelectorAll('.asa-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    const sc = el('asa-scroll');
    if (sc) sc.scrollTop = 0;
    refresh();
  };

  function refresh() {
    if (curTab === 'today') renderToday();
    else if (curTab === 'apps') renderApps();
    else renderSearch();
  }

  function init() {
    if (!el('page-app-store')) return;
    const d = el('asa-date');
    if (d) d.textContent = dateText();

    el('page-app-store').addEventListener('click', function (e) {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const a = t.getAttribute('data-act');
      if (a === 'detail') openDetail(t.getAttribute('data-id'));
      else if (a === 'install' || a === 'open') act(t.getAttribute('data-id'), a);
      else if (a === 'close') closeDetail();
      else if (a === 'cat') { curCat = t.getAttribute('data-cat'); renderApps(); }
      else if (a === 'tab') { window.asaTab(t.getAttribute('data-tab')); }
      else if (a === 'uninstall') {
        const id = t.getAttribute('data-id');
        if (window.uninstallAppFromDesktop) window.uninstallAppFromDesktop(id);
        toast('「' + (reg()[id] ? reg()[id].name : '') + '」已从桌面移除');
        refresh();
        openDetail(id);
      }
    });

    const input = el('asa-search-input');
    if (input) input.addEventListener('input', function () { curQuery = this.value; renderSearch(); });

    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.asaRefresh = refresh;
})();
