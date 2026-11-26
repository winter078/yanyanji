/* 桌面全屏模式热修：默认拆手机壳，外观页保留“显示手机壳”开关。
   正式的 phone.html / base.css 改动落到线上后，本文件会自动跳过。 */
(function () {
  if (window.__deskFullLoaded) return;
  window.__deskFullLoaded = true;
  if (document.getElementById('toggle-desktop-shell')) return;

  var KEY = 'momo_desktop_shell_v1';
  var root = document.documentElement;

  function isOn() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  function syncClass() {
    root.classList.toggle('desk-full', !isOn());
  }

  function installStyle() {
    if (document.getElementById('desk-full-style')) return;
    var style = document.createElement('style');
    style.id = 'desk-full-style';
    style.textContent = [
      '@media (min-width: 601px) {',
      'html.desk-full body { min-height: 100vh; overflow: hidden; background: var(--theme-global-bg, var(--bg-base)); }',
      'html.desk-full .device-wrapper { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border-radius: 0; background: transparent; box-shadow: none; transform: none; overflow: hidden; }',
      'html.desk-full .phone-screen { width: 100%; height: 100%; max-width: none; border-radius: 0; box-shadow: none; }',
      'html.desk-full .view-container { width: 100%; max-width: 430px; margin-left: auto; margin-right: auto; }',
      'html.desk-full .dynamic-island { display: none; }',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function installUI() {
    if (document.getElementById('toggle-desktop-shell')) return;
    var theme = document.getElementById('page-theme');
    if (!theme) return;
    var card = document.createElement('div');
    card.className = 'form-group-card';
    card.id = 'desktop-shell-setting-card';
    card.innerHTML =
      '<div class="form-label-title">🖥️ 桌面显示</div>' +
      '<div class="ios-cell-row" style="padding-left:0; padding-right:0;">' +
        '<div class="ios-cell-left">' +
          '<span class="ios-cell-main">桌面显示手机壳 <span style="font-size:10.5px; font-weight:500; color:var(--color-text-muted);">仅电脑端</span></span>' +
          '<span class="ios-cell-sub" id="desktop-shell-state">当前：全屏</span>' +
          '<span class="ios-cell-sub">关闭时整块铺满浏览器；打开后恢复 430×860 手机壳。手机端始终全屏。</span>' +
        '</div>' +
        '<div class="ios-toggle-switch" id="toggle-desktop-shell" role="switch" aria-label="桌面显示手机壳">' +
          '<div class="ios-toggle-thumb"></div>' +
        '</div>' +
      '</div>';
    var anchor = theme.querySelector('#region-skin-card');
    if (anchor) theme.insertBefore(card, anchor); else theme.appendChild(card);
    card.querySelector('#toggle-desktop-shell').addEventListener('click', function () {
      try { localStorage.setItem(KEY, isOn() ? '0' : '1'); } catch (e) {}
      syncUI();
    });
    syncUI();
  }

  function syncUI() {
    syncClass();
    var t = document.getElementById('toggle-desktop-shell');
    if (t) t.classList.toggle('active', isOn());
    var s = document.getElementById('desktop-shell-state');
    if (s) s.textContent = isOn() ? '当前：手机壳' : '当前：全屏';
  }

  installStyle();
  syncClass();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installUI);
  } else {
    installUI();
  }
})();
