/* ============================================================
   歌词服务 · MzLyrics
   一个很小的东西，只干四件事：
     1) 拿当前歌的网易云 id，去 /api/music/lyric 取 LRC
     2) 把 LRC 解析成 [{t, text}]，元信息行（作词/作曲）扔掉
     3) 跟着 window._momoAudio.currentTime 算出"现在这两句"
     4) 变化了就通知订阅者（一起听页面、桌面小组件都订阅它）

   刻意不做的事：整屏滚动歌词、逐字高亮、翻译行叠排。
   两行就够，页面上没有地方放更多。
   ============================================================ */
(function () {
  'use strict';

  var memoryCache = {};          // neId -> { lines, trans }
  var MAX_CACHE = 40;
  var cacheCount = 0;

  var state = {
    key: '',
    neId: '',
    title: '',
    lines: [],
    trans: [],
    loading: false,
    failed: false,
    finished: false
  };

  var listeners = [];
  var lastPair = ['', ''];
  var lastIndex = -999;
  var audioBound = false;

  /* ---------- LRC 解析 ---------- */
  // 常见形式：[00:12.34]词  [00:12.340]词  也有 [00:12]词
  var TIME_RE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

  function toSeconds(m, s, frac) {
    var sec = parseInt(m, 10) * 60 + parseInt(s, 10);
    if (frac) {
      var f = String(frac);
      sec += f.length === 3 ? parseInt(f, 10) / 1000 : parseInt(f, 10) / 100;
    }
    return sec;
  }

  // 这些行是歌词文件的元信息，不该出现在画面上
  var META_RE = /^(作词|作曲|编曲|制作人|出品|监制|混音|母带|和声|录音|吉他|贝斯|鼓|弦乐|OP|SP|发行|统筹|策划|词|曲)\s*[:：]/;

  function parseLRC(text) {
    var out = [];
    if (!text || typeof text !== 'string') return out;
    var raw = text.split(/\r?\n/);
    for (var i = 0; i < raw.length; i++) {
      var line = raw[i];
      if (!line) continue;
      var times = [];
      TIME_RE.lastIndex = 0;
      var m;
      while ((m = TIME_RE.exec(line)) !== null) {
        times.push(toSeconds(m[1], m[2], m[3]));
      }
      if (!times.length) continue;
      var words = line.replace(/\[[^\]]*\]/g, '').trim();
      if (!words) continue;
      if (META_RE.test(words)) continue;
      for (var k = 0; k < times.length; k++) {
        out.push({ t: times[k], text: words });
      }
    }
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  /* ---------- 取歌的网易云 id ---------- */
  function neIdOf(song) {
    if (!song) return '';
    if (song.neId) return String(song.neId).trim();
    var id = String(song.id || '').trim();
    if (id.indexOf('ne-') === 0) id = id.slice(3);
    return /^\d+$/.test(id) ? id : '';
  }

  function cookieHeader() {
    try {
      if (typeof window.__mzNeteaseCookie === 'function') {
        return window.__mzNeteaseCookie() || '';
      }
    } catch (e) {}
    return '';
  }

  /* ---------- 订阅与广播 ---------- */
  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state, currentPair()); } catch (e) {}
    }
  }

  function indexAt(t) {
    var lines = state.lines;
    if (!lines.length) return -1;
    var lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (lines[mid].t <= t + 0.05) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }

  function currentPair() {
    var lines = state.lines;
    if (!lines.length) return ['', ''];
    var audio = window._momoAudio;
    var t = audio && !audio.paused ? (audio.currentTime || 0) : (window._mzLastKnownTime || 0);
    var idx = indexAt(t);
    if (idx < 0) return [lines[0].text, lines[1] ? lines[1].text : ''];
    return [lines[idx].text, lines[idx + 1] ? lines[idx + 1].text : ''];
  }

  /* ---------- 时间驱动 ---------- */
  function tick() {
    var audio = window._momoAudio;
    if (audio && typeof audio.currentTime === 'number') {
      window._mzLastKnownTime = audio.currentTime;
    }
    var pair = currentPair();
    var changed = pair[0] !== lastPair[0] || pair[1] !== lastPair[1];
    lastPair = pair;
    if (changed) emit();
  }

  function bindAudio() {
    if (audioBound) return;
    var audio = window._momoAudio;
    if (!audio) return;
    audioBound = true;
    audio.addEventListener('timeupdate', tick);
    audio.addEventListener('seeked', tick);
    audio.addEventListener('play', tick);
    audio.addEventListener('pause', tick);
    audio.addEventListener('ended', function () { state.finished = true; emit(); });
  }

  // 有些页面 _momoAudio 是后建的，这里补一次绑定
  var bindTimer = setInterval(function () {
    if (audioBound) { clearInterval(bindTimer); return; }
    bindAudio();
  }, 800);

  /* ---------- 载入 ---------- */
  function applyCache(entry, key, neId, title) {
    state.key = key;
    state.neId = neId;
    state.title = title;
    state.lines = entry.lines || [];
    state.trans = entry.trans || [];
    state.loading = false;
    state.failed = !state.lines.length;
    lastIndex = -999;
    lastPair = ['', ''];
    emit();
  }

  function clearAll() {
    state.key = '';
    state.neId = '';
    state.title = '';
    state.lines = [];
    state.trans = [];
    state.loading = false;
    state.failed = false;
    lastPair = ['', ''];
    emit();
  }

  function load(song) {
    if (!song) { clearAll(); return; }
    var neId = neIdOf(song);
    var title = String(song.title || '').trim();
    // 本地歌/没有网易云 id 的歌：没有歌词可取，直接清空
    if (!neId) { clearAll(); return; }

    state.title = title;
    if (memoryCache[neId]) { applyCache(memoryCache[neId], neId, neId, title); return; }
    if (state.key === neId && (state.loading || state.lines.length)) return;

    state.key = neId;
    state.neId = neId;
    state.lines = [];
    state.trans = [];
    state.loading = true;
    state.failed = false;
    lastPair = ['', ''];
    emit();

    var headers = {};
    var ck = cookieHeader();
    if (ck) headers['x-netease-cookie'] = ck;

    fetch('/api/music/lyric?id=' + encodeURIComponent(neId), { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (state.key !== neId) return;   // 已经切歌了，丢弃这次结果
        var lines = parseLRC(d && d.lyric);
        var trans = parseLRC(d && d.trans);
        var entry = { lines: lines, trans: trans };
        if (cacheCount >= MAX_CACHE) { memoryCache = {}; cacheCount = 0; }
        memoryCache[neId] = entry;
        cacheCount++;
        applyCache(entry, neId, neId, title);
      })
      .catch(function () {
        if (state.key !== neId) return;
        state.loading = false;
        state.failed = true;
        emit();
      });
  }

  window.MzLyrics = {
    load: load,
    // 页面重新打开时补一次（可能 song 已经变了但没走 playSong）
    refresh: function () {
      bindAudio();
      tick();
    },
    pair: currentPair,
    state: function () {
      return {
        neId: state.neId,
        title: state.title,
        loading: state.loading,
        failed: state.failed,
        hasLyric: state.lines.length > 0,
        count: state.lines.length
      };
    },
    onUpdate: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    _parse: parseLRC
  };
})();
