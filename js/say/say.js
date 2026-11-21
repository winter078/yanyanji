/* ==========================================================================
   我说 · 日记（纸感 / 月度本子 / 一页 / 书写 / 录音）
   结构：本子墙 → 一页纸 → 书写页 → 录音浮层
   存储：localStorage momo_say_v1（正文/心情/纸样/图），IndexedDB momo_say_db（录音）
   ========================================================================== */
(function () {
  var KEY = 'momo_say_v1';
  var DB_NAME = 'momo_say_db';
  var STORE = 'audio';
  var MOODS = ['晴', '多云', '阴', '雨', '风', '雪'];
  var PAPERS = ['', 'paper-b', 'paper-c'];
  var CN = '一二三四五六七八九十';
  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var MAX_IMAGES = 2;

  var state = { mode: 'wall', bookKey: '', pageIdx: 0 };
  var data = loadData();

  /* ---------------- 小工具 ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr(d) {
    var t = d || new Date();
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
  }
  function nowTime() {
    var t = new Date();
    return pad(t.getHours()) + ':' + pad(t.getMinutes());
  }
  function cnNum(n) {
    if (n <= 10) return CN.charAt(n - 1);
    if (n < 20) return '十' + CN.charAt(n - 11);
    var tens = Math.floor(n / 10), ones = n % 10;
    return CN.charAt(tens - 1) + '十' + (ones ? CN.charAt(ones - 1) : '');
  }
  function monthLabel(m) { return cnNum(m) + '月'; }
  function seasonOf(m) {
    if (m === 12 || m <= 2) return '冬';
    if (m <= 5) return '春';
    if (m <= 8) return '夏';
    return '秋';
  }
  function dateLabel(str) {
    var p = String(str || '').split('-');
    if (p.length < 3) return str || '';
    return monthLabel(parseInt(p[1], 10)) + cnNum(parseInt(p[2], 10)) + '日';
  }
  function weekLabel(str) {
    var p = String(str || '').split('-');
    if (p.length < 3) return '';
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return WEEK[d.getDay()] || '';
  }

  /* ---------------- 存储 ---------------- */
  function loadData() {
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        if (!Array.isArray(parsed.entries)) parsed.entries = [];
        return parsed;
      }
    } catch (e) {}
    return { version: 1, entries: [], draft: null };
  }
  function saveData() {
    try {
      // 图片会吃空间，写之前把过大的正文/图挡一道，失败时给出可读提示
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('[say] save failed', e);
      return false;
    }
  }

  /* ---------------- IndexedDB：录音 ---------------- */
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function putAudio(key, blob) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function (e) { console.warn('[say] audio put failed', e); return false; });
  }
  function getAudio(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var g = tx.objectStore(STORE).get(key);
        g.onsuccess = function () { resolve(g.result || null); };
        g.onerror = function () { reject(g.error); };
      });
    }).catch(function () { return null; });
  }

  /* ---------------- 本子 = 按月分组 ---------------- */
  function books() {
    var map = {};
    data.entries.forEach(function (e) {
      var k = String(e.date || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(k)) return;
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    var list = Object.keys(map).map(function (k) {
      var items = map[k].slice().sort(function (a, b) {
        return String(a.created || '').localeCompare(String(b.created || ''));
      });
      var year = k.slice(0, 4), m = parseInt(k.slice(5, 7), 10);
      return { key: k, year: year, month: m, label: monthLabel(m), season: seasonOf(m), entries: items };
    });
    list.sort(function (a, b) { return a.key < b.key ? 1 : -1; }); // 新的在左
    return list;
  }
  function currentBookKey() {
    var bs = books();
    if (bs.length === 0) return todayStr().slice(0, 7);
    if (state.bookKey && bs.some(function (b) { return b.key === state.bookKey; })) return state.bookKey;
    return bs[0].key;
  }

  /* ---------------- 入口 ---------------- */
  function show(mode) {
    state.mode = mode;
    ['wall', 'sheet', 'write', 'rec'].forEach(function (m) {
      var el = $('say-' + m);
      if (el) el.style.display = (m === mode ? 'flex' : 'none');
      // 墙是列布局，纸页/书写/录音也是列（flco）
    });
    var stage = document.getElementById('say-stage');
    if (stage) stage.classList.toggle('is-wall', mode === 'wall');
  }

  function renderSayApp() {
    if (!state.draft) state.draft = null;
    state.bookKey = currentBookKey();
    show('wall');
    renderWall();
  }
  window.renderSayApp = renderSayApp;

  /* ---------------- 本子墙 ---------------- */
  function renderWall() {
    var shelf = $('say-shelf');
    if (!shelf) return;
    var bs = books();
    var key = currentBookKey();
    state.bookKey = key;
    var idx = bs.findIndex ? bs.findIndex(function (b) { return b.key === key; }) : -1;
    var cur = idx >= 0 ? bs[idx] : null;
    var m = parseInt(key.slice(5, 7), 10);
    var year = key.slice(0, 4);
    var count = cur ? cur.entries.length : 0;
    var firstLine = '';
    if (cur && cur.entries.length) {
      firstLine = String(cur.entries[cur.entries.length - 1].text || '').replace(/\s+/g, ' ').slice(0, 9) || '一本本子';
    } else {
      firstLine = '这本还没写';
    }
    var left = idx >= 0 && bs[idx + 1] ? '<div class="bk side l" onclick="sayGoBook(' + (idx + 1) + ')"></div>' : '';
    var right = idx > 0 ? '<div class="bk side r" onclick="sayGoBook(' + (idx - 1) + ')"></div>' : '';
    shelf.innerHTML = left
      + '<div class="bk main" onclick="sayOpenBook()">'
      + '<div class="bk-spine"></div>'
      + '<div class="bk-vert">' + esc(monthLabel(m)) + '</div>'
      + '<div class="bk-moon">' + esc(seasonOf(m)) + '</div>'
      + '<div class="bk-strip"><b>' + esc(firstLine) + '</b><span>' + count + ' 页</span></div>'
      + '<div class="bk-tag">' + esc(year) + '</div>'
      + '</div>'
      + right;

    var hint = $('say-hint');
    if (hint) hint.textContent = bs.length <= 1 ? '点开本子，就是这一页' : '左右滑动，换一本';

    var dots = $('say-dots');
    if (dots) {
      var total = Math.max(bs.length, 1);
      var active = idx >= 0 ? idx : 0;
      var html = '';
      for (var i = 0; i < Math.min(total, 9); i++) {
        html += '<i' + (i === active ? ' class="on"' : '') + '></i>';
      }
      dots.innerHTML = html;
    }
  }
  window.sayGoBook = function (i) {
    var bs = books();
    if (!bs[i]) return;
    state.bookKey = bs[i].key;
    renderWall();
  };
  window.saySlideBook = function (dir) {
    var bs = books();
    if (bs.length <= 1) return;
    var idx = bs.findIndex ? bs.findIndex(function (b) { return b.key === currentBookKey(); }) : -1;
    var next = idx + dir;
    if (next < 0 || next >= bs.length) return;
    state.bookKey = bs[next].key;
    renderWall();
  };

  /* ---------------- 一页纸 ---------------- */
  function entriesOfBook() {
    var bs = books();
    var key = currentBookKey();
    var b = bs.filter(function (x) { return x.key === key; })[0];
    return b ? b.entries : [];
  }

  window.sayOpenBook = function () {
    var es = entriesOfBook();
    if (!es.length) { sayNewEntry(); return; }
    state.pageIdx = es.length - 1;
    show('sheet');
    renderSheet();
  };

  function renderSheet() {
    var es = entriesOfBook();
    var sheet = $('say-sheet');
    if (!sheet) return;
    if (!es.length) { sayBackToWall(); return; }
    if (state.pageIdx < 0) state.pageIdx = 0;
    if (state.pageIdx > es.length - 1) state.pageIdx = es.length - 1;
    var e = es[state.pageIdx];
    var dateEl = $('say-page-date');
    var weekEl = $('say-page-week');
    var bodyEl = $('say-page-body');
    var footEl = $('say-page-foot');
    var stampEl = $('say-stamp');

    if (dateEl) dateEl.textContent = dateLabel(e.date);
    if (weekEl) weekEl.textContent = weekLabel(e.date) + (e.mood ? ' · ' + e.mood : '');
    if (footEl) {
      footEl.innerHTML = '<span>第 ' + (state.pageIdx + 1) + ' 页</span>'
        + '<span class="sh-arrows">'
        + '<button onclick="sayTurnPrev()"' + (state.pageIdx <= 0 ? ' disabled' : '') + '>‹</button>'
        + '<button onclick="sayTurnNext()">›</button>'
        + '</span>'
        + '<span>' + esc(monthLabel(parseInt(String(e.date).slice(5, 7), 10))) + ' · ' + es.length + ' 页</span>';
    }
    if (stampEl) stampEl.style.display = (e.date === todayStr()) ? 'flex' : 'none';

    if (bodyEl) {
      var paras = String(e.text || '').split(/\n+/).filter(function (s) { return s.trim(); });
      var html = '';
      if (!paras.length) html = '<div style="color:var(--sy-ink3);">这一页只留了一张图。</div>';
      paras.forEach(function (p, i) {
        html += '<div class="' + (i === 0 ? 'sh-lead' : '') + '">' + esc(p) + '</div>';
      });
      if (Array.isArray(e.images) && e.images.length) {
        html += '<div class="sh-figs">' + e.images.map(function (src) { return '<img src="' + esc(src) + '" alt="这一天的图">'; }).join('') + '</div>';
      }
      if (e.audio) {
        html += '<div class="sh-audio"><button onclick="sayPlayAudio(\'' + esc(e.audio) + '\')">▶</button><span>那天的声音 · 点一下听听</span></div>';
      }
      bodyEl.innerHTML = html;
      bodyEl.scrollTop = 0;
    }
    var hint = $('say-page-hint');
    if (hint) {
      hint.textContent = (state.pageIdx >= es.length - 1)
        ? '最后一页了，掀一下右下角能开新的一页'
        : '掀一下右下角，翻到下一页';
    }
  }

  window.sayBackToWall = function () { show('wall'); renderWall(); };

  function flip(cb) {
    var m = $('say-flip');
    if (!m) { cb && cb(); return; }
    m.classList.remove('out');
    m.classList.add('on');
    setTimeout(function () { cb && cb(); }, 340);
    setTimeout(function () {
      m.classList.add('out');
      setTimeout(function () { m.classList.remove('on'); m.classList.remove('out'); }, 360);
    }, 420);
  }

  window.sayTurnNext = function () {
    var es = entriesOfBook();
    if (state.pageIdx >= es.length - 1) {
      // 最后一页 → 掀角 = 开一页新的
      flip(function () { sayNewEntry(); });
      return;
    }
    flip(function () { state.pageIdx++; renderSheet(); });
  };
  window.sayTurnPrev = function () {
    if (state.pageIdx <= 0) return;
    flip(function () { state.pageIdx--; renderSheet(); });
  };

  /* ---------------- 书写页 ---------------- */
  function newDraft() {
    return { date: todayStr(), text: '', mood: '', paper: '', images: [], audio: '' };
  }
  window.sayNewEntry = function () {
    var d = data.draft;
    if (!d || d.date !== todayStr()) d = newDraft();
    else {
      if (!Array.isArray(d.images)) d.images = [];
      if (typeof d.text !== 'string') d.text = '';
    }
    data.draft = d;
    saveData();
    show('write');
    renderWrite();
  };

  function renderWrite() {
    var d = data.draft || (data.draft = newDraft());
    var dateEl = $('say-write-date');
    if (dateEl) dateEl.textContent = dateLabel(d.date);
    var area = $('say-write-area');
    if (area && area.value !== d.text) area.value = d.text || '';
    var paper = $('say-write-paper');
    if (paper) {
      paper.classList.remove('paper-b', 'paper-c');
      if (d.paper) paper.classList.add(d.paper);
    }
    var figs = $('say-write-figs');
    if (figs) {
      figs.innerHTML = (d.images || []).map(function (src, i) {
        return '<div class="fig"><img src="' + esc(src) + '" alt="配图"><i onclick="sayRemovePhoto(' + i + ')">✕</i></div>';
      }).join('');
    }
    var bar = $('say-wr-recbar');
    if (bar) {
      if (d.audio) {
        bar.classList.add('on');
        bar.innerHTML = '<button onclick="sayPlayAudio(\'' + esc(d.audio) + '\')">▶</button><span>这一页的声音</span>'
          + '<button onclick="sayDropRec()" style="background:rgba(70,58,40,.14);color:#4A4030;">✕</button>';
      } else {
        bar.classList.remove('on');
        bar.innerHTML = '';
      }
    }
    var tools = document.querySelectorAll('.say-write .wr-tool');
    if (tools && tools.length >= 4) {
      tools[3].classList.toggle('on', !!d.paper);
    }
    var areaEl = $('say-write-area');
    if (areaEl && !areaEl.__sayBound) {
      areaEl.__sayBound = true;
      areaEl.addEventListener('input', function () {
        if (!data.draft) data.draft = newDraft();
        data.draft.text = areaEl.value;
        clearTimeout(areaEl.__t);
        areaEl.__t = setTimeout(saveData, 400);
      });
    }
  }

  window.sayBackFromWrite = function () {
    var d = data.draft;
    if (d && String(d.text || '').trim()) {
      // 还没点「写好了」就当草稿留着，下次进来还在
      saveData();
    }
    show('wall');
    renderWall();
  };

  window.saySaveEntry = function () {
    var d = data.draft;
    if (!d) return;
    var text = String(d.text || '').trim();
    if (!text && !(d.images && d.images.length) && !d.audio) {
      sayToast('这一页还是空的');
      return;
    }
    var e = {
      id: 'e-' + Date.now(),
      date: d.date || todayStr(),
      at: nowTime(),
      weather: '',
      mood: d.mood || '',
      text: text,
      images: (d.images || []).slice(0, MAX_IMAGES),
      audio: d.audio || '',
      paper: d.paper || '',
      created: new Date().toISOString()
    };
    data.entries.push(e);
    data.draft = null;
    if (!saveData()) {
      data.entries.pop();
      sayToast('空间不够了，先把大图删掉再存');
      return;
    }
    state.bookKey = e.date.slice(0, 7);
    state.pageIdx = entriesOfBook().length - 1;
    show('sheet');
    renderSheet();
    sayToast('已经记下');
  };

  /* ---------------- 心情 ---------------- */
  window.sayPickMood = function () {
    var box = $('say-moodpick');
    if (!box) return;
    var cur = (data.draft && data.draft.mood) || '';
    box.innerHTML = '<div class="mp-t">今天是什么天气</div><div class="mp-row">'
      + MOODS.map(function (m) {
        return '<button class="mp-item' + (m === cur ? ' on' : '') + '" onclick="saySetMood(\'' + m + '\')">' + m + '</button>';
      }).join('')
      + '<button class="mp-item" onclick="saySetMood(\'\')">不写</button>'
      + '</div>';
    box.classList.add('on');
  };
  window.saySetMood = function (m) {
    if (!data.draft) data.draft = newDraft();
    data.draft.mood = m || '';
    saveData();
    var box = $('say-moodpick');
    if (box) box.classList.remove('on');
    renderWrite();
  };
  window.sayCloseMoodPick = function () {
    var box = $('say-moodpick');
    if (box) box.classList.remove('on');
  };

  /* ---------------- 纸样 ---------------- */
  window.sayPickPaper = function () {
    if (!data.draft) data.draft = newDraft();
    var i = PAPERS.indexOf(data.draft.paper || '');
    data.draft.paper = PAPERS[(i + 1) % PAPERS.length];
    saveData();
    renderWrite();
    sayToast(['米黄纸', '白纸', '旧绿纸'][(i + 1) % PAPERS.length]);
  };

  /* ---------------- 配图 ---------------- */
  window.sayPickPhoto = function () {
    var d = data.draft || (data.draft = newDraft());
    if ((d.images || []).length >= MAX_IMAGES) { sayToast('一页最多两张图'); return; }
    var inp = $('say-photo-input');
    if (inp) { inp.value = ''; inp.click(); }
  };
  window.sayHandlePhoto = function (ev) {
    var file = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    var d = data.draft || (data.draft = newDraft());
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var max = 760;
          var w = img.width, h = img.height;
          if (w > max || h > max) {
            var r = Math.min(max / w, max / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          var url = cv.toDataURL('image/jpeg', 0.7);
          d.images = (d.images || []).concat([url]).slice(0, MAX_IMAGES);
          if (!saveData()) {
            d.images.pop();
            sayToast('空间不够，这张图先别放');
            return;
          }
          renderWrite();
        } catch (e) { sayToast('这张图读不出来'); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  window.sayRemovePhoto = function (i) {
    if (!data.draft || !data.draft.images) return;
    data.draft.images.splice(i, 1);
    saveData();
    renderWrite();
  };

  /* ---------------- 录音 ---------------- */
  var rec = { mr: null, stream: null, chunks: [], startedAt: 0, timer: null, raf: null, ac: null, analyser: null, playing: null };

  function recSupported() {
    return typeof MediaRecorder !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  }
  function pickMime() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    var list = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }
  function fmtDur(ms) {
    var s = Math.round(ms / 1000);
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  window.sayOpenRecorder = function () {
    var d = data.draft || (data.draft = newDraft());
    var ghost = $('say-rec-ghost');
    if (ghost) {
      ghost.innerHTML = '<b>' + esc(dateLabel(d.date)) + '</b>'
        + (String(d.text || '').trim()
          ? esc(String(d.text).slice(0, 220))
          : '<span style="color:rgba(74,64,46,.24)">这一页还空着，先说，再写。</span>');
    }
    var tEl = $('say-rec-time');
    if (tEl) tEl.textContent = '00:00';
    var wave = $('say-rec-wave');
    if (wave) {
      var bars = '';
      for (var i = 0; i < 52; i++) bars += '<i></i>';
      wave.innerHTML = bars;
    }
    setRecActions(false);
    show('rec');
  };
  window.sayCloseRecorder = function () {
    stopRec(true);
    show('write');
    renderWrite();
  };

  function setRecActions(hasAudio) {
    var box = $('say-rec-actions');
    if (!box) return;
    if (hasAudio) {
      box.innerHTML = '<button class="rec-btn primary" onclick="sayToggleRecPlay()" id="say-rec-play">试听</button>'
        + '<button class="rec-btn ghost" onclick="sayDropRec()">不要了</button>';
    } else {
      box.innerHTML = '<button class="rec-btn ghost" onclick="sayCloseRecorder()">先不录</button>';
    }
  }

  window.sayRecDown = function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (rec.mr) return;
    if (!recSupported()) { sayToast('这台机器录不了音，字还是得自己写'); return; }
    var micEl = $('say-rec-mic');
    if (micEl) micEl.classList.add('recording');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      rec.stream = stream;
      var mime = pickMime();
      try {
        rec.mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (e) {
        rec.stream.getTracks().forEach(function (t) { t.stop(); });
        rec.stream = null;
        sayToast('这台机器录不了音');
        if (micEl) micEl.classList.remove('recording');
        return;
      }
      rec.chunks = [];
      rec.startedAt = Date.now();
      rec.mr.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
      rec.mr.onstop = function () {
        var blob = new Blob(rec.chunks, { type: rec.mr && rec.mr.mimeType ? rec.mr.mimeType : 'audio/webm' });
        var key = 'rec-' + Date.now();
        var durMs = Date.now() - rec.startedAt;
        if (durMs > 600 && blob.size > 800) {
          putAudio(key, blob).then(function (ok) {
            if (ok) {
              data.draft = data.draft || newDraft();
              data.draft.audio = key;
              saveData();
              setRecActions(true);
              sayToast('声音留在这页了');
            }
          });
        } else {
          sayToast('太短了，没留住');
          setRecActions(false);
        }
        rec.mr = null;
        if (rec.stream) { rec.stream.getTracks().forEach(function (t) { t.stop(); }); rec.stream = null; }
        if (micEl) micEl.classList.remove('recording');
        clearInterval(rec.timer);
        cancelAnimationFrame(rec.raf);
        var tEl = $('say-rec-time');
        if (tEl) tEl.textContent = '00:00';
        var wave = $('say-rec-wave');
        if (wave) Array.prototype.forEach.call(wave.children, function (b) { b.style.height = '8px'; });
      };
      rec.mr.start(120);
      tickRec();
      bindAnalyser(stream);
      var tEl = $('say-rec-time');
      if (tEl) tEl.textContent = '00:00';
      setRecActions(false);
    }).catch(function () {
      if (micEl) micEl.classList.remove('recording');
      sayToast('没拿到麦克风权限');
    });
  };

  window.sayRecUp = function () {
    if (rec.mr && rec.mr.state !== 'inactive') {
      try { rec.mr.stop(); } catch (e) {}
    }
  };

  function tickRec() {
    clearInterval(rec.timer);
    rec.timer = setInterval(function () {
      var tEl = $('say-rec-time');
      if (!tEl) return;
      tEl.textContent = fmtDur(Date.now() - rec.startedAt);
    }, 200);
  }

  function bindAnalyser(stream) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return mockWave();
      rec.ac = new Ctx();
      var src = rec.ac.createMediaStreamSource(stream);
      rec.analyser = rec.ac.createAnalyser();
      rec.analyser.fftSize = 128;
      src.connect(rec.analyser);
      var buf = new Uint8Array(rec.analyser.frequencyBinCount);
      var wave = $('say-rec-wave');
      var step = function () {
        if (!rec.analyser) return;
        rec.analyser.getByteFrequencyData(buf);
        if (wave) {
          for (var i = 0; i < wave.children.length; i++) {
            var v = buf[i % buf.length] / 255;
            var h = 6 + v * 62;
            wave.children[i].style.height = h.toFixed(0) + 'px';
          }
        }
        rec.raf = requestAnimationFrame(step);
      };
      step();
    } catch (e) { mockWave(); }
  }
  function mockWave() {
    var wave = $('say-rec-wave');
    var step = function () {
      if (!rec.mr) return;
      if (wave) {
        for (var i = 0; i < wave.children.length; i++) {
          var h = 6 + Math.abs(Math.sin(Date.now() / 300 + i * 0.7)) * 46 + Math.random() * 10;
          wave.children[i].style.height = Math.min(h, 68).toFixed(0) + 'px';
        }
      }
      rec.raf = requestAnimationFrame(step);
    };
    step();
  }

  function stopRec(silent) {
    if (rec.mr && rec.mr.state !== 'inactive') {
      try { rec.mr.stop(); } catch (e) {}
    }
    if (rec.stream) {
      try { rec.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      rec.stream = null;
    }
    clearInterval(rec.timer);
    cancelAnimationFrame(rec.raf);
    if (rec.ac) { try { rec.ac.close(); } catch (e) {} rec.ac = null; rec.analyser = null; }
    var micEl = $('say-rec-mic');
    if (micEl) micEl.classList.remove('recording');
  }

  window.sayToggleRecPlay = function () {
    var key = data.draft && data.draft.audio;
    if (!key) return;
    if (rec.playing) {
      try { rec.playing.pause(); } catch (e) {}
      rec.playing = null;
      var btn = $('say-rec-play');
      if (btn) btn.textContent = '试听';
      return;
    }
    getAudio(key).then(function (blob) {
      if (!blob) { sayToast('这段声音丢了'); return; }
      var url = URL.createObjectURL(blob);
      var a = new Audio(url);
      rec.playing = a;
      var btn = $('say-rec-play');
      if (btn) btn.textContent = '停一下';
      a.onended = function () {
        rec.playing = null;
        URL.revokeObjectURL(url);
        if (btn) btn.textContent = '试听';
      };
      a.play().catch(function () { sayToast('放不出来'); });
    });
  };

  window.sayDropRec = function () {
    if (data.draft) { data.draft.audio = ''; saveData(); }
    setRecActions(false);
    if (state.mode === 'write') renderWrite();
    sayToast('删掉了');
  };

  window.sayPlayAudio = function (key) {
    if (!key) return;
    getAudio(key).then(function (blob) {
      if (!blob) { sayToast('这段声音丢了'); return; }
      var url = URL.createObjectURL(blob);
      var a = new Audio(url);
      a.onended = function () { URL.revokeObjectURL(url); };
      a.play().catch(function () { sayToast('放不出来'); });
    });
  };

  /* ---------------- 轻提示 ---------------- */
  var toastTimer = null;
  function sayToast(msg) {
    var el = $('say-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'say-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:999;'
        + 'max-width:74%;padding:9px 16px;border-radius:999px;background:rgba(30,26,20,.82);'
        + 'color:#F8F3E7;font:12px/1.5 -apple-system,\'PingFang SC\',sans-serif;letter-spacing:1px;'
        + 'opacity:0;transition:opacity .2s ease;pointer-events:none;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.opacity = '0'; }, 1600);
  }

  /* ---------------- 退出 ---------------- */
  window.sayExitApp = function () {
    if (typeof window.openPage === 'function') window.openPage('page-home');
  };

  /* ---------------- 本子墙滑动手势 ---------------- */
  function bindGestures() {
    var shelf = $('say-shelf');
    if (!shelf || shelf.__sayBound) return;
    shelf.__sayBound = true;
    var x0 = 0, y0 = 0, t0 = 0;
    shelf.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    }, { passive: true });
    shelf.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (Date.now() - t0 > 700) return;
      saySlideBook(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* ---------------- 启动 ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    bindGestures();
    // 换行到页面时再绑一次（首次进入 App 时 DOM 可能已就绪）
  });
  setTimeout(bindGestures, 300);
  window.__sayBind = bindGestures;
})();
