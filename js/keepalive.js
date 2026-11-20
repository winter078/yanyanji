(function () {
  // 后台连线：循环播放一段静音 WAV，让 iOS 认为小手机还在活动，
  // 控制中心会显示「言言机 · 后台连线中」，页面也不那么快被冻结。
  //
  // 代价（重要）：iOS 网页播放音频时走的是 playback 音频会话，网页端改不了这个类别。
  // 只要在播——哪怕这段 WAV 完全没声音——系统就认定「小手机正在出声」，
  // 你切去看抖音/小红书的视频，会因为音频被打断而自动暂停。
  // 所以这里默认关闭，只在需要挂机等角色说话时手动打开。
  var KEY = 'momo_bg_link';
  var audioEl = null;
  var objectUrl = null;
  var wanted = false;

  function makeSilentWav(seconds) {
    var rate = 8000;
    var n = Math.floor(seconds * rate);
    var buf = new ArrayBuffer(44 + n);
    var v = new DataView(buf);
    var i;
    function str(o, s) { for (var k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true);
    for (i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return new Blob([buf], { type: 'audio/wav' });
  }

  function ensureAudio() {
    if (audioEl) return audioEl;
    objectUrl = URL.createObjectURL(makeSilentWav(3));
    audioEl = new Audio(objectUrl);
    audioEl.loop = true;
    audioEl.preload = 'auto';
    audioEl.playsInline = true;
    audioEl.setAttribute('playsinline', '');
    audioEl.setAttribute('webkit-playsinline', '');
    return audioEl;
  }

  function setSession() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: '后台连线中',
        artist: '言言机',
        album: '小手机',
        artwork: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch (e) {}
    try {
      navigator.mediaSession.setActionHandler('pause', function () {
        if (audioEl) audioEl.pause();
        wanted = false;
        try { localStorage.setItem(KEY, '0'); } catch (e) {}
        clearSession();
        updateUi();
      });
      navigator.mediaSession.setActionHandler('play', function () { start(); });
    } catch (e) {}
  }

  function clearSession() {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.metadata = null; } catch (e) {}
    try { navigator.mediaSession.playbackState = 'none'; } catch (e) {}
  }

  function start() {
    var a = ensureAudio();
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
    setSession();
    wanted = true;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    updateUi();
  }

  function stop() {
    wanted = false;
    try { localStorage.setItem(KEY, '0'); } catch (e) {}
    if (audioEl) {
      try { audioEl.pause(); } catch (e) {}
    }
    clearSession();
    updateUi();
  }

  function updateUi() {
    var el = document.getElementById('bg-link-status');
    if (el) {
      el.innerHTML = wanted
        ? '<span style="color:#3ddc84;">连线中</span>'
        : '<span style="color:var(--color-text-secondary);">已关闭</span>';
    }
    var t = document.getElementById('bg-link-toggle');
    if (t) t.checked = wanted;
  }

  // 默认关闭：localStorage 里没有值就当没开。
  // 以前是无值当开启，等于每次打开小手机都占着音频通道。
  function enabled() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    return v === '1';
  }

  function armOnFirstGesture() {
    var kick = function () {
      document.removeEventListener('touchend', kick, true);
      document.removeEventListener('click', kick, true);
      if (wanted) start();
    };
    document.addEventListener('touchend', kick, true);
    document.addEventListener('click', kick, true);
  }

  function init() {
    wanted = enabled();
    updateUi();
    if (!wanted) return;
    // 曾经开着的人：不在这里静默起播，等一次真实点击再续上（iOS 要求手势）。
    armOnFirstGesture();
  }

  window.startBackgroundLink = start;
  window.stopBackgroundLink = stop;
  window.toggleBackgroundLink = function (on) { if (on) start(); else stop(); };
  window.isBackgroundLinkOn = function () { return wanted; };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
