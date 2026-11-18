(function () {
  // 后台连线：循环播放一段静音 WAV，让 iOS 认为小手机还在活动，
  // 控制中心会显示「言言机 · 后台连线中」，页面也不会那么快被冻结。
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
        navigator.mediaSession.playbackState = 'paused';
      });
      navigator.mediaSession.setActionHandler('play', function () { start(); });
    } catch (e) {}
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
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = 'none'; } catch (e) {}
    }
    updateUi();
  }

  function updateUi() {
    var el = document.getElementById('bg-link-status');
    if (!el) return;
    el.innerHTML = wanted
      ? '<span style="color:#3ddc84;">连线中</span>'
      : '<span style="color:var(--color-text-secondary);">已关闭</span>';
  }

  function enabled() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    if (v === null) return true;
    return v !== '0';
  }

  function armOnFirstGesture() {
    if (wanted) return;
    var kick = function () {
      document.removeEventListener('touchend', kick, true);
      document.removeEventListener('click', kick, true);
      if (enabled()) start();
    };
    document.addEventListener('touchend', kick, true);
    document.addEventListener('click', kick, true);
  }

  function init() {
    if (!enabled()) { updateUi(); return; }
    var a = ensureAudio();
    a.play().then(function () {
      wanted = true; setSession(); updateUi();
    }).catch(function () {
      // 没用户手势时会被拦，等第一次点击再起
      armOnFirstGesture();
      updateUi();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && wanted && audioEl && audioEl.paused) {
        audioEl.play().catch(function () {});
        setSession();
      }
    });
  }

  window.startBackgroundLink = start;
  window.stopBackgroundLink = stop;
  window.toggleBackgroundLink = function (on) { if (on) start(); else stop(); };
  window.isBackgroundLinkOn = function () { return wanted; };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); updateUi(); });
  } else {
    init(); updateUi();
  }
})();
