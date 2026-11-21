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

  var state = { mode: 'wall', bookId: '', pageIdx: 0, tab: 'shelf', cat: '', editingId: '' };
  var pressed = { timer: null, moved: false };
  var meQuoteLast = '';
  var cardMode = '';
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
        // v2：多出「自定义本子」「书柜里改过的书名」「我」
        if (!Array.isArray(parsed.books)) parsed.books = [];
        if (!parsed.monthNames || typeof parsed.monthNames !== 'object') parsed.monthNames = {};
        if (!parsed.me || typeof parsed.me !== 'object') parsed.me = {};
        // v3：书柜顶上的分类
        if (!Array.isArray(parsed.cats)) parsed.cats = [];
        if (!parsed.bookCats || typeof parsed.bookCats !== 'object') parsed.bookCats = {};
        parsed.version = 3;
        return parsed;
      }
    } catch (e) {}
    return { version: 3, entries: [], draft: null, books: [], monthNames: {}, me: {}, cats: [], bookCats: {} };
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

  /* ---------------- 书柜：月份书 + 自己开的书 ---------------- */
  var BOOK_TINTS = ['t-brick', 't-olive', 't-clay', 't-indigo', 't-moss', 't-plum'];
var ME_BG = ['paper', 'moss', 'clay', 'indigo', 'ink'];

  function hashOf(s) {
    var h = 7;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003;
    return h;
  }
  function tsOf(e) {
    var t = Date.parse(e && e.created ? e.created : '') || 0;
    if (!t) t = Date.parse(((e && e.date) || '') + 'T00:00:00') || 0;
    return t;
  }
  function sortEntries(list) {
    return list.slice().sort(function (a, b) { return tsOf(a) - tsOf(b); });
  }
  function bookLastAt(b) {
    if (b.entries && b.entries.length) return tsOf(b.entries[b.entries.length - 1]);
    if (!b.custom && b.monthKey) return Date.parse(b.monthKey + '-01T00:00:00') || 0;
    return Date.parse(b.createdAt || '') || 0;
  }

  // 书柜上所有的书：按月自动装订的（含本月这本空书）+ 你自己开的
  function shelfBooks() {
    var byMonth = {}, byCustom = {};
    data.entries.forEach(function (e) {
      if (e.bookId) {
        if (!byCustom[e.bookId]) byCustom[e.bookId] = [];
        byCustom[e.bookId].push(e);
        return;
      }
      var k = bookMonthKey(e);
      if (!k) return;
      if (!byMonth[k]) byMonth[k] = [];
      byMonth[k].push(e);
    });

    var list = [];
    Object.keys(byMonth).forEach(function (k) {
      var m = parseInt(k.slice(5, 7), 10);
      list.push({
        id: 'm-' + k, monthKey: k, year: k.slice(0, 4), month: m,
        title: data.monthNames[k] || monthLabel(m),
        entries: sortEntries(byMonth[k]), custom: false
      });
    });
    var curKey = todayStr().slice(0, 7);
    if (!byMonth[curKey]) {
      var cm = parseInt(curKey.slice(5, 7), 10);
      list.push({
        id: 'm-' + curKey, monthKey: curKey, year: curKey.slice(0, 4), month: cm,
        title: data.monthNames[curKey] || monthLabel(cm),
        entries: [], custom: false
      });
    }

    (data.books || []).forEach(function (b) {
      if (!b || !b.id) return;
      list.push({
        id: b.id, monthKey: '', year: String(b.createdAt || '').slice(0, 4) || todayStr().slice(0, 4),
        month: 0, title: String(b.title || '').trim() || '没名字的本子',
        entries: sortEntries(byCustom[b.id] || []), custom: true,
        createdAt: b.createdAt || '', tint: b.tint || ''
      });
    });

    list.forEach(function (b) { b.lastAt = bookLastAt(b); });
    list.sort(function (a, b) { return (b.lastAt || 0) - (a.lastAt || 0); });

    list.forEach(function (b) {
      var hh = hashOf(b.id);
      b.tint = b.tint || BOOK_TINTS[hh % BOOK_TINTS.length];
      b.h = 168 + (hh % 7) * 7;          // 168–210，一层里高低不齐才像真书架
      b.w = 36 + (hh % 5) * 3;           // 36–48
    });
    return list;
  }
  function bookMonthKey(e) {
    var k = String((e && e.date) || '').slice(0, 7);
    return /^\d{4}-\d{2}$/.test(k) ? k : '';
  }
  function currentBookId() {
    var bs = shelfBooks();
    if (bs.length === 0) return 'm-' + todayStr().slice(0, 7);
    if (state.bookId && bs.some(function (b) { return b.id === state.bookId; })) return state.bookId;
    return bs[0].id;
  }

  /* ---------------- 入口 ---------------- */
  function show(mode) {
    state.mode = mode;
    ['wall', 'me', 'sheet', 'write', 'rec'].forEach(function (m) {
      var el = $('say-' + m);
      if (el) el.style.display = (m === mode ? 'flex' : 'none');
    });
    var stage = document.getElementById('say-stage');
    if (stage) stage.classList.toggle('is-top', mode === 'wall' || mode === 'me');
    var top = $('say-top');
    if (top) top.style.display = (mode === 'wall' || mode === 'me') ? 'flex' : 'none';
  }
  function setTab(t) {
    state.tab = t;
    ['shelf', 'me'].forEach(function (k) {
      var el = $('say-tab-' + k);
      if (el) el.classList.toggle('on', k === t);
    });
  }

  function renderSayApp() {
    initSayFonts();
    if (!state.draft) state.draft = null;
    if (!state.tab) state.tab = 'shelf';
    state.bookId = currentBookId();
    setTab(state.tab);
    if (state.tab === 'me') { show('me'); renderMe(); }
    else { show('wall'); renderCats(); renderShelf(); }
  }
  window.renderSayApp = renderSayApp;

  window.sayTab = function (t) {
    state.tab = t === 'me' ? 'me' : 'shelf';
    setTab(state.tab);
    if (state.tab === 'me') { show('me'); renderMe(); }
    else { show('wall'); renderCats(); renderShelf(); }
  };

  /* ---------------- 书柜顶上的分类 ---------------- */
  function catOfBook(id) { return (data.bookCats || {})[id] || ''; }

  function renderCats() {
    var box = $('say-cats');
    if (!box) return;
    var cur = state.cat || '';
    var html = '<div class="say-cat' + (cur ? '' : ' on') + '" data-id="" onclick="sayPickCat(this)">全部</div>';
    (data.cats || []).forEach(function (c) {
      html += '<div class="say-cat' + (cur === c.id ? ' on' : '') + '" data-id="' + esc(c.id) + '"'
        + ' onclick="sayPickCat(this)"'
        + ' ontouchstart="sayCatPressStart(this)" ontouchend="sayCatPressEnd()" ontouchmove="sayCatPressEnd()"'
        + ' onmousedown="sayCatPressStart(this)" onmouseup="sayCatPressEnd()" onmouseleave="sayCatPressEnd()">'
        + esc(c.name) + '</div>';
    });
    html += '<div class="say-cat add" onclick="sayCatNew()">＋ 分类</div>';
    box.innerHTML = html;
  }

  window.sayPickCat = function (el) {
    if (!el) return;
    if (pressed.moved) { pressed.moved = false; return; }
    state.cat = el.getAttribute('data-id') || '';
    renderCats();
    renderShelf();
  };

  window.sayCatPressStart = function (el) {
    clearTimeout(pressed.timer);
    pressed.moved = false;
    var cid = el && el.getAttribute ? el.getAttribute('data-id') : '';
    if (!cid) return;
    pressed.timer = setTimeout(function () {
      pressed.moved = true;
      sayCatMenu(cid);
    }, 620);
  };
  window.sayCatPressEnd = function () { clearTimeout(pressed.timer); };

  function sayCatMenu(cid) {
    var c = (data.cats || []).filter(function (x) { return x.id === cid; })[0];
    if (!c) return;
    state.cardCatId = cid;
    cardMode = 'catrename';
    cardBody(
      '<div class="sc-t">这一类叫什么</div>'
      + '<div class="sc-sub">名字会挂在书柜顶上。删掉这一类，里面的书会回到「全部」。</div>'
      + '<input class="sc-input" id="say-card-input" maxlength="10" value="' + esc(c.name) + '" placeholder="比如：晚上写的">'
      + '<div class="sc-row">'
      + '<button class="sc-del" onclick="sayDeleteCat()">删了这一类</button>'
      + '<button class="sc-ok" onclick="saySaveCard()">好了</button>'
      + '</div>'
    );
    setTimeout(function () { var inp = $('say-card-input'); if (inp) inp.focus(); }, 260);
  }

  window.sayCatNew = function () {
    cardMode = 'catnew';
    cardBody(
      '<div class="sc-t">加一类</div>'
      + '<div class="sc-sub">分类挂在书柜顶上，点一下只看这一类。书放进哪类，长按书脊挑。</div>'
      + '<input class="sc-input" id="say-card-input" maxlength="10" value="" placeholder="比如：晚上写的">'
      + '<div class="sc-row">'
      + '<button class="sc-cancel" onclick="sayCloseCard()">算了</button>'
      + '<button class="sc-ok" onclick="saySaveCard()">加一类</button>'
      + '</div>'
    );
    setTimeout(function () { var inp = $('say-card-input'); if (inp) inp.focus(); }, 260);
  };

  window.sayDeleteCat = function () {
    var cid = state.cardCatId || '';
    if (!cid) return;
    var c = (data.cats || []).filter(function (x) { return x.id === cid; })[0];
    var n = Object.keys(data.bookCats || {}).filter(function (k) { return data.bookCats[k] === cid; }).length;
    var sure = confirm('删掉「' + (c ? c.name : '这一类') + '」？' + (n ? '里面有 ' + n + ' 本书会回到「全部」。' : ''));
    if (!sure) return;
    data.cats = (data.cats || []).filter(function (x) { return x.id !== cid; });
    Object.keys(data.bookCats || {}).forEach(function (k) {
      if (data.bookCats[k] === cid) delete data.bookCats[k];
    });
    if (state.cat === cid) state.cat = '';
    saveData();
    sayCloseCard();
    renderCats();
    renderShelf();
    sayToast('删掉了');
  };

  /* ---------------- 书柜 ---------------- */
  var PER_DECK = 7;     // 一层最多站七本

  function bookCell(b, curId) {
    var nm = String(b.title || '');
    var short = nm.length > 8 ? nm.slice(0, 8) + '…' : nm;
    var count = b.entries.length;
    var foot = count ? count + '页' : '空的';
    return '<div class="bk ' + esc(b.tint) + (b.id === curId ? ' cur' : '') + '" data-id="' + esc(b.id) + '"'
      + ' style="--bk-h:' + b.h + 'px;--bk-w:' + b.w + 'px;"'
      + ' onclick="sayPickBook(this)"'
      + ' ontouchstart="sayPressStart(this)" ontouchend="sayPressEnd()" ontouchmove="sayPressEnd()"'
      + ' onmousedown="sayPressStart(this)" onmouseup="sayPressEnd()" onmouseleave="sayPressEnd()">'
      + '<div class="bk-name">' + esc(short) + '</div>'
      + '<div class="bk-foot">' + esc(foot) + '</div>'
      + '</div>';
  }

  function renderShelf() {
    var shelf = $('say-shelf');
    if (!shelf) return;
    var all = shelfBooks();
    var cur = state.cat || '';
    var bs = cur ? all.filter(function (b) { return catOfBook(b.id) === cur; }) : all;
    var id = currentBookId();
    state.bookId = id;

    var cells = bs.map(function (b) { return bookCell(b, id); });
    cells.push('<div class="bk add" onclick="sayShelfAdd()"><b>＋</b><span>新一本</span></div>');

    // 至少三层；书多了往下再接一层
    var decks = Math.max(3, Math.ceil(cells.length / PER_DECK));
    var html = '';
    for (var r = 0; r < decks; r++) {
      html += '<div class="deck"><div class="deck-books">'
        + cells.slice(r * PER_DECK, r * PER_DECK + PER_DECK).join('')
        + '</div><div class="deck-plank"></div></div>';
    }
    shelf.innerHTML = html;

    var hint = $('say-hint');
    if (hint) {
      var total = 0;
      bs.forEach(function (b) { total += b.entries.length; });
      if (cur && !bs.length) hint.textContent = '这一类还空着 · ＋新一本会放进这里';
      else if (cur) hint.textContent = '这一类 ' + total + ' 页 · 长按书脊可以换类';
      else hint.textContent = data.entries.length
        ? ('一共 ' + data.entries.length + ' 页 · 长按书脊可以改名')
        : '还没写下第一页';
    }
  }

  // 点一本书：先把它从架上抽出来，再摊成纸页
  window.sayPickBook = function (el) {
    if (!el) return;
    var bid = el.getAttribute('data-id');
    if (!bid) return;
    if (pressed.moved) { pressed.moved = false; return; }   // 刚才是长按，不当作点开
    state.bookId = bid;
    el.classList.add('pulled');
    setTimeout(function () {
      el.classList.remove('pulled');
      var es = entriesOfBook();
      if (!es.length) { sayNewEntry(); return; }
      state.pageIdx = 0;
      show('sheet');
      renderSheet();
      flipAt('say-flip', null, 'back');
    }, 300);
  };

  window.sayOpenBook = function () { window.sayPickBook(document.querySelector('#say-shelf .bk.cur') || document.querySelector('#say-shelf .bk')); };

  /* ---------------- 长按书脊：改名 / 删掉 ---------------- */
  window.sayPressStart = function (el) {
    clearTimeout(pressed.timer);
    pressed.moved = false;
    var bid = el && el.getAttribute ? el.getAttribute('data-id') : '';
    if (!bid) return;
    pressed.timer = setTimeout(function () {
      pressed.moved = true;
      sayBookMenu(bid);
    }, 620);
  };
  window.sayPressEnd = function () { clearTimeout(pressed.timer); };

  function sayBookMenu(bid) {
    var b = shelfBooks().filter(function (x) { return x.id === bid; })[0];
    if (!b) return;
    state.cardBookId = bid;
    sayShelfCard('rename', b);
  }

  /* ---------------- 底部卡片（改名 / 新一本 / 改我） ---------------- */
  function cardBody(html) {
    var box = $('say-card');
    if (!box) return null;
    box.innerHTML = '<div class="sc-mask" onclick="if(event.target===this)sayCloseCard()"></div>'
      + '<div class="sc-body">' + html + '</div>';
    box.classList.add('on');
    box.style.display = 'flex';
    return box;
  }
  window.sayCloseCard = function () {
    var box = $('say-card');
    if (box) { box.classList.remove('on'); box.style.display = 'none'; box.innerHTML = ''; }
    cardMode = '';
  };

  window.sayShelfAdd = function () { sayShelfCard('new', null); };

  function sayShelfCard(mode, book) {
    cardMode = mode;
    var renaming = mode === 'rename';
    if (book) state.cardBookId = book.id;
    var val = renaming ? (book && book.title || '') : '';
    var curCat = book ? catOfBook(book.id) : '';
    var catRow = '';
    if (renaming && (data.cats || []).length) {
      catRow = '<div class="sc-cats">'
        + '<div class="sc-catx' + (curCat ? '' : ' on') + '" data-cid="" onclick="sayBookCat(this)">不分类</div>'
        + (data.cats || []).map(function (c) {
            return '<div class="sc-catx' + (curCat === c.id ? ' on' : '') + '" data-cid="' + esc(c.id) + '" onclick="sayBookCat(this)">' + esc(c.name) + '</div>';
          }).join('')
        + '</div>';
    }
    cardBody(
      '<div class="sc-t">' + (renaming ? '这本书叫什么' : '开一本新的') + '</div>'
      + '<div class="sc-sub">' + (renaming
        ? (book && !book.custom ? '按月自动装订的这本，改名只改书脊上的字，日记还在。' : '名字会写在书脊上，最多十来个字。')
        : '起个名字，比如「碎片」「晚上」「给妈妈的话」。') + '</div>'
      + '<input class="sc-input" id="say-card-input" maxlength="16" value="' + esc(val) + '" placeholder="' + (renaming ? '十一月' : '碎片') + '">'
      + catRow
      + '<div class="sc-row">'
      + (renaming && book && book.custom
        ? '<button class="sc-del" onclick="sayDeleteBook(this)" data-id="' + esc(book.id) + '">删掉这本</button>'
        : '<button class="sc-cancel" onclick="sayCloseCard()">算了</button>')
      + '<button class="sc-ok" onclick="saySaveCard()">' + (renaming ? '好了' : '开一本') + '</button>'
      + '</div>'
    );
    setTimeout(function () {
      var inp = $('say-card-input');
      if (inp) inp.focus();
    }, 260);
  }

  /* 把这本书放进某一类（卡片里那排小签） */
  window.sayBookCat = function (el) {
    var bid = state.cardBookId || '';
    if (!bid || !el) return;
    var cid = el.getAttribute('data-cid') || '';
    data.bookCats = data.bookCats || {};
    if (cid) data.bookCats[bid] = cid; else delete data.bookCats[bid];
    saveData();
    var row = el.parentNode;
    if (row) {
      for (var k = 0; k < row.children.length; k++) row.children[k].classList.toggle('on', row.children[k] === el);
    }
    renderShelf();
  };

  window.saySaveCard = function () {
    var inp = $('say-card-input');
    var v = inp ? String(inp.value || '').trim() : '';
    if (cardMode === 'me') { saveMe(v); return; }
    if (cardMode === 'catnew') {
      var cid = 'c-' + Date.now();
      data.cats = data.cats || [];
      data.cats.push({ id: cid, name: v || '没名字的一类' });
      if (!saveData()) { data.cats.pop(); sayToast('存不下，先清点空间'); return; }
      state.cat = cid;
      sayCloseCard();
      renderCats();
      renderShelf();
      sayToast('加了一类「' + (v || '没名字的一类') + '」');
      return;
    }
    if (cardMode === 'catrename') {
      var cc = (data.cats || []).filter(function (x) { return x.id === state.cardCatId; })[0];
      if (cc && v) cc.name = v;
      saveData();
      sayCloseCard();
      renderCats();
      renderShelf();
      sayToast('改好了');
      return;
    }
    if (cardMode === 'new') {
      var id = 'b-' + Date.now();
      data.books.push({
        id: id,
        title: v || '没名字的本子',
        createdAt: new Date().toISOString(),
        tint: BOOK_TINTS[hashOf(id + v) % BOOK_TINTS.length]
      });
      // 当前开着某个分类，新书就顺手放进去
      if (state.cat) { data.bookCats = data.bookCats || {}; data.bookCats[id] = state.cat; }
      if (!saveData()) { data.books.pop(); sayToast('存不下，先清点空间'); return; }
      state.bookId = id;
      sayCloseCard();
      show('wall');
      renderCats();
      renderShelf();
      sayToast('开了一本「' + (v || '没名字的本子') + '」');
      return;
    }
    var bid = state.cardBookId || '';
    if (bid.indexOf('m-') === 0) {
      var k = bid.slice(2);
      if (v) data.monthNames[k] = v; else delete data.monthNames[k];
    } else {
      var b = (data.books || []).filter(function (x) { return x.id === bid; })[0];
      if (b) b.title = v || '没名字的本子';
    }
    saveData();
    sayCloseCard();
    renderShelf();
    sayToast('改好了');
  };

  window.sayDeleteBook = function (el) {
    var bid = el && el.getAttribute ? el.getAttribute('data-id') : '';
    var b = (data.books || []).filter(function (x) { return x.id === bid; })[0];
    if (!b) return;
    var n = data.entries.filter(function (e) { return e.bookId === bid; }).length;
    var sure = confirm('删掉「' + b.title + '」' + (n ? '和里面的 ' + n + ' 页？' : '？'));
    if (!sure) return;
    data.books = (data.books || []).filter(function (x) { return x.id !== bid; });
    data.entries = data.entries.filter(function (e) { return e.bookId !== bid; });
    saveData();
    sayCloseCard();
    state.bookId = '';
    state.bookId = currentBookId();
    renderShelf();
    sayToast('删掉了');
  };

  /* ---------------- 我 ---------------- */
  function meStat() {
    var es = data.entries;
    var earliest = '';
    es.forEach(function (e) {
      if (!earliest || String(e.date) < earliest) earliest = String(e.date || '');
    });
    var books = shelfBooks().filter(function (b) { return b.entries.length > 0; }).length;
    return { pages: es.length, books: books, earliest: earliest };
  }

  // 随便抽一句旧话：每次进来都换，尽量不连着同一条
  function randomQuote() {
    var es = data.entries.filter(function (e) { return String(e.text || '').trim(); });
    if (!es.length) return null;
    var pick = null;
    for (var t = 0; t < 6; t++) {
      var cand = es[Math.floor(Math.random() * es.length)];
      if (es.length === 1 || cand.id !== meQuoteLast) { pick = cand; break; }
    }
    if (!pick) pick = es[Math.floor(Math.random() * es.length)];
    meQuoteLast = pick.id;
    var lines = String(pick.text).split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var line = lines.length ? lines[Math.floor(Math.random() * lines.length)] : '';
    if (line.length > 62) line = line.slice(0, 62) + '…';
    return { date: dateLabel(pick.date), text: line };
  }

  function recentHtml() {
    var rec = data.entries.slice().sort(function (a, b) { return (tsOf(b) || 0) - (tsOf(a) || 0); }).slice(0, 3);
    if (!rec.length) return '';
    var rows = rec.map(function (e) {
      var line = String(e.text || '').split(/\n+/).filter(function (s) { return s.trim(); })[0] || '';
      if (line.length > 18) line = line.slice(0, 18) + '…';
      var bid = e.bookId || ('m-' + bookMonthKey(e));
      return '<div class="mr-item" onclick="sayOpenRecent(this)" data-id="' + esc(e.id) + '" data-bid="' + esc(bid) + '">'
        + '<span class="mr-d">' + esc(String(e.date || '').slice(5)) + '</span>'
        + '<i>' + esc(line || '（只有声音，还没写字）') + '</i></div>';
    }).join('');
    return '<div class="me-recent"><div class="mr-t">最近写的</div>' + rows + '</div>';
  }

  window.sayOpenRecent = function (el) {
    var id = el ? el.getAttribute('data-id') : '';
    var bid = el ? el.getAttribute('data-bid') : '';
    if (!id) return;
    if (bid) state.bookId = bid;
    var es = entriesOfBook();
    var idx = -1;
    for (var i = 0; i < es.length; i++) { if (es[i].id === id) { idx = i; break; } }
    if (idx < 0) return;
    state.pageIdx = idx;
    show('sheet');
    renderSheet();
  };

  function renderMe() {
    var box = $('say-me');
    if (!box) return;
    var me = data.me || {};
    var nm = String(me.name || '').trim() || '我';
    var line = String(me.line || '').trim();
    var st = meStat();
    var q = randomQuote();
    var initial = nm.slice(0, 1);

    var avatar = me.avatar
      ? '<img src="' + esc(me.avatar) + '" alt="头像">'
      : '<span>' + esc(initial) + '</span>';

    var bg = ME_BG[Number(me.bg) || 0] || 'paper';

    var html = ''
      + '<div class="me-card me-bg-' + bg + '">'
      + '<button class="me-edit" onclick="sayEditMe()">改</button>'
      + '<div class="me-ava" onclick="sayPickAvatar()">' + avatar + '</div>'
      + '<div class="me-name">' + esc(nm) + '</div>'
      + '<div class="me-line">' + (line ? esc(line) : '<i>还没写一句关于自己的话</i>') + '</div>'
      + '</div>'
      + '<div class="me-stats">'
      + '<div><b>' + st.pages + '</b><span>页</span></div>'
      + '<div><b>' + st.books + '</b><span>本</span></div>'
      + '<div><b>' + (st.earliest ? dateLabel(st.earliest).replace('日', '') : '—') + '</b><span>开始写</span></div>'
      + '</div>'
      + recentHtml()
      + (q
        ? '<div class="me-quote"><span class="mq-d">' + esc(q.date) + '</span>'
          + '<div class="mq-t">' + esc(q.text) + '</div></div>'
        : '<div class="me-quote empty"><div class="mq-t">写下第一页以后，这里会随机翻出一句你说过的话。</div></div>')
      + (q ? '<div class="me-foot">每次进来，都会重新翻一句</div>' : '');

    box.innerHTML = html;
  }

  window.sayEditMe = function () {
    cardMode = 'me';
    var me = data.me || {};
    var bg = Number(me.bg) || 0;
    var nm = String(me.name || '').trim();
    var ava = me.avatar
      ? '<img src="' + esc(me.avatar) + '" alt="">'
      : '<span>' + esc(nm.slice(0, 1) || '我') + '</span>';
    var swatches = ME_BG.map(function (name, i) {
      return '<div class="sc-bg sb-' + name + (i === bg ? ' on' : '') + '" data-bg="' + i + '" onclick="sayPickBg(this)"></div>';
    }).join('');
    cardBody(
      '<div class="sc-t">这是我</div>'
      + '<div class="sc-sub">头像点一下就能换；下面五张纸，挑一张。</div>'
      + '<div class="sc-me-top">'
      + '<div class="sc-ava" id="say-card-ava" onclick="sayPickAvatar()">' + ava + '</div>'
      + '<button class="sc-ava-btn" onclick="sayPickAvatar()">换头像</button>'
      + '</div>'
      + '<input class="sc-input" id="say-card-input" maxlength="12" value="' + esc(me.name || '') + '" placeholder="名字">'
      + '<input class="sc-input" id="say-card-line" maxlength="28" value="' + esc(me.line || '') + '" placeholder="一句话，比如记性不好，只好写下来">'
      + '<div class="sc-bgs">' + swatches + '</div>'
      + '<div class="sc-row">'
      + '<button class="sc-cancel" onclick="sayCloseCard()">算了</button>'
      + '<button class="sc-ok" onclick="saySaveCard()">好了</button>'
      + '</div>'
    );
    setTimeout(function () { var inp = $('say-card-input'); if (inp) inp.focus(); }, 260);
  };

  /* 换头像：选图 → 居中裁方 → 压成 240 存进本地 */
  window.sayPickAvatar = function () {
    var inp = $('say-avatar-input');
    if (!inp) return;
    inp.value = '';
    inp.click();
  };

  window.sayHandleAvatar = function (ev) {
    var f = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var S = 240;
          var cv = document.createElement('canvas');
          cv.width = S; cv.height = S;
          var ctx = cv.getContext('2d');
          var side = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
          data.me = data.me || {};
          data.me.avatar = cv.toDataURL('image/jpeg', 0.82);
          if (!saveData()) { sayToast('存不下，换张小一点的图'); return; }
          var box = $('say-card-ava');
          if (box) box.innerHTML = '<img src="' + esc(data.me.avatar) + '" alt="">';
          renderMe();
          sayToast('头像换好了');
        } catch (err) { sayToast('这张图读不了'); }
      };
      img.onerror = function () { sayToast('这张图读不了'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  };

  /* 换名片纸 */
  window.sayPickBg = function (el) {
    var i = Number(el && el.getAttribute ? el.getAttribute('data-bg') : 0) || 0;
    data.me = data.me || {};
    data.me.bg = i;
    saveData();
    var row = el ? el.parentNode : null;
    if (row) {
      for (var k = 0; k < row.children.length; k++) {
        row.children[k].className = 'sc-bg sb-' + ME_BG[k] + (k === i ? ' on' : '');
      }
    }
    renderMe();
  };

  function saveMe(nameVal) {
    var lineEl = $('say-card-line');
    data.me = data.me || {};
    data.me.name = nameVal;
    data.me.line = lineEl ? String(lineEl.value || '').trim() : (data.me.line || '');
    saveData();
    sayCloseCard();
    renderMe();
    sayToast('记下了');
  }

  /* ---------------- 一页纸 ---------------- */
  function entriesOfBook() {
    var bs = shelfBooks();
    var id = currentBookId();
    var b = bs.filter(function (x) { return x.id === id; })[0];
    return b ? b.entries : [];
  }

  window.sayOpenCurrentBook = function () {
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
      var bookName = bookTitleOf(currentBookId());
      footEl.innerHTML = '<span class="sh-bname">' + esc(bookName) + '</span>'
        + '<button class="sh-idx-btn" onclick="sayPageIndex()">第 ' + (state.pageIdx + 1) + ' 页 / ' + es.length + '</button>'
        + '<span class="sh-arrows">'
        + '<button onclick="sayTurnPrev()"' + (state.pageIdx <= 0 ? ' disabled' : '') + '>‹</button>'
        + '<button onclick="sayTurnNext()">' + (state.pageIdx >= es.length - 1 ? '＋' : '›') + '</button>'
        + '</span>';
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
    var reps = repliesOf(e);
    var hint = $('say-page-hint');
    var hasReply = reps.length > 0;
    if (hint) {
      hint.style.display = hasReply ? 'none' : '';
      hint.textContent = (state.pageIdx >= es.length - 1)
        ? (state.pageIdx > 0 ? '最后一页 · 往右拖能翻回去' : '掀一下右下角，开新的一页')
        : '纸往左拖翻下一页 · 往右拖翻回来' + '';
    }

    /* 纸底下那一行：他说的话（最多三行，点开看全部） */
    var repEl = $('say-page-reply');
    if (repEl) {
      if (reps.length) {
        var lastRep = reps[reps.length - 1];
        var showMore = reps.length > 1 || String(lastRep.text || '').length > 48;
        repEl.style.display = '';
        repEl.innerHTML = '<div class="sh-rh">' + esc(lastRep.name || '他') + ' 写在底下'
          + (reps.length > 1 ? '<span class="sh-rc">还有 ' + (reps.length - 1) + ' 句</span>' : '')
          + '</div>'
          + '<div class="sh-rt">' + esc(lastRep.text) + '</div>'
          + (showMore ? '<div class="sh-rm">点开看全文 ›</div>' : '');
      } else {
        repEl.style.display = 'none';
        repEl.innerHTML = '';
      }
    }
    var giveEl = $('say-give');
    if (giveEl) {
      giveEl.disabled = false;
      giveEl.textContent = reps.length ? '再递一次' : '递给他';
    }
  }

  window.sayBackToWall = function () { show('wall'); renderShelf(); };

  function bookTitleOf(id) {
    var bs = shelfBooks();
    var b = bs.filter(function (x) { return x.id === id; })[0];
    return b ? b.title : '';
  }

  /* 把这一页的样子抄一份贴到翻起来的那张纸上：正面是字，背面透一点点 */
  function saySnapPage() {
    var flip = $('say-flip');
    if (!flip) return;
    var src = document.querySelector('#say-sheet .sheet-in');
    var faces = flip.querySelectorAll('.fs-paper');
    for (var i = 0; i < faces.length; i++) {
      faces[i].innerHTML = '';
      if (!src) continue;
      var c = src.cloneNode(true);
      c.removeAttribute('id');
      var ids = c.querySelectorAll('[id]');
      for (var k = 0; k < ids.length; k++) ids[k].removeAttribute('id');
      faces[i].appendChild(c);
    }
  }

  /* 翻页：一页纸贴着右边被卷走。p=0 整页盖着，p=1 卷到底。
     dir='back' = 一张纸从左边展开盖上来（翻上一页 / 打开书 / 回到刚改好的那一页） */
  function sayCurlSet(p, id, w, h) {
    var m = $(id || 'say-flip');
    if (!m) return;
    var page = m.querySelector('.flip-page');
    var roll = m.querySelector('.roll');
    if (!page) return;
    var W = w || page.clientWidth || 1;
    var H = h || page.clientHeight || 1;
    var k = Math.max(0, Math.min(1, p));
    var tilt = H * 0.052;                       // 卷边是斜着卷起来的，不是拿刀切齐
    var cut = (1 - k) * (W + tilt + 60) - 60;   // k=0 整页盖住，k=1 彻底卷走
    page.style.clipPath = 'polygon(-40px -40px, '
      + (cut + tilt / 2).toFixed(1) + 'px -40px, '
      + (cut - tilt / 2).toFixed(1) + 'px ' + (H + 40) + 'px, -40px ' + (H + 40) + 'px)';
    if (roll) {
      var ang = Math.atan2(tilt, H) * 180 / Math.PI;
      roll.style.transform = 'translateX(' + (cut - W + 17).toFixed(1) + 'px) skewX(' + (-ang).toFixed(2) + 'deg)';
      roll.style.opacity = (k <= .01 || k >= .99) ? '0' : '1';
    }
  }
  function sayCurlAnim(id, p0, p1, ms, done) {
    var page = $(id) && $(id).querySelector('.flip-page');
    var W = page ? page.clientWidth : 1;
    var H = page ? page.clientHeight : 1;
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      sayCurlSet(p1, id, W, H);
      if (done) done();
    }
    function step() {
      if (finished) return;
      var tt = (window.performance && performance.now) ? performance.now() : Date.now();
      var k = Math.min(1, (tt - t0) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      sayCurlSet(p0 + (p1 - p0) * e, id, W, H);
      if (k < 1) requestAnimationFrame(step);
      else finish();
    }
    requestAnimationFrame(step);
    setTimeout(finish, ms + 160);   // 兜底：万一这一帧没跑，也别卡在中间
  }
  /* 翻一页：纸（= 现在看到的这一页）贴着右边卷走，底下先换成新的一页，卷开就露出来。
     顺序很关键：拍纸 → 换底页 → 卷走，绝不能在卷完之后才换底页，那样整段都是同一页在动。 */
  function flipAt(id, cb, dir) {
    var m = $(id);
    if (!m || !m.querySelector('.flip-page')) { cb && cb(); return; }
    var page = m.querySelector('.flip-page');
    var W = page.clientWidth || 1, H = page.clientHeight || 1;
    m.classList.add('on');
    if (id === 'say-flip' && dir !== 'back') saySnapPage();   // 纸 = 这一页的样子
    else {
      var faces = m.querySelectorAll('.fs-paper');             // 进入书 / 回来时卷的是一张空白纸
      for (var i = 0; i < faces.length; i++) faces[i].innerHTML = '';
    }
    if (cb) cb();                             // 底页先换成新内容
    sayCurlSet(0, id, W, H);
    sayCurlAnim(id, 0, 1, dir === 'back' ? 290 : 280, function () {
      sayCurlSet(0, id, W, H);
      m.classList.remove('on');
    });
  }
  function flip(cb, dir) { flipAt('say-flip', cb, dir); }

  window.sayTurnNext = function () {
    var es = entriesOfBook();
    if (state.pageIdx >= es.length - 1) {
      // 最后一页 → 掀角 = 翻开一张新的空白纸
      sayNewEntry();
      return;
    }
    flip(function () { state.pageIdx++; renderSheet(); });
  };
  window.sayTurnPrev = function () {
    if (state.pageIdx <= 0) return;
    flip(function () { state.pageIdx--; renderSheet(); });
  };

  /* ---------------- 翻到哪天 ---------------- */
  window.sayPageIndex = function () {
    var es = entriesOfBook();
    if (!es.length) return;
    if (es.length < 2) { sayToast('这一本只有一页'); return; }
    cardMode = 'index';
    var html = '<div class="sc-t">这一本写过的日子</div>'
      + '<div class="sc-sub">点一天，直接翻到那一页。</div>'
      + '<div class="sc-idx">';
    for (var i = es.length - 1; i >= 0; i--) {
      var e = es[i];
      var snip = String(e.text || '').replace(/\s+/g, ' ').trim();
      if (!snip) snip = (e.images && e.images.length) ? '（只有一张图）' : '（这页没写字）';
      if (snip.length > 20) snip = snip.slice(0, 20) + '…';
      html += '<button class="ix-item' + (i === state.pageIdx ? ' on' : '') + '" data-i="' + i + '" onclick="sayGotoPage(this)">'
        + '<span class="ix-d">' + esc(String(e.date || '').slice(5).replace('-', '.')) + '</span>'
        + '<span class="ix-s">' + esc(snip) + '</span>'
        + '<span class="ix-p">' + (i + 1) + '</span>'
        + '</button>';
    }
    html += '</div><div class="sc-row"><button class="sc-cancel" onclick="sayCloseCard()">合上</button></div>';
    cardBody(html);
  };

  window.sayGotoPage = function (el) {
    if (!el) return;
    var i = parseInt(el.getAttribute('data-i'), 10);
    if (isNaN(i)) return;
    sayCloseCard();
    flip(function () { state.pageIdx = i; renderSheet(); });
  };

  /* ---------------- 跨本子翻旧话 ---------------- */
  function hl(text, q) {
    var t = String(text || '');
    var low = t.toLowerCase(), ql = q.toLowerCase();
    if (!ql) return esc(t);
    var out = '', i = 0, p = low.indexOf(ql, 0);
    while (p >= 0) {
      out += esc(t.slice(i, p)) + '<mark>' + esc(t.slice(p, p + ql.length)) + '</mark>';
      i = p + ql.length;
      p = low.indexOf(ql, i);
    }
    out += esc(t.slice(i));
    return out;
  }

  function snipAround(text, q, len) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    var i = t.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return t.slice(0, len) + (t.length > len ? '…' : '');
    var start = Math.max(0, i - 7);
    var s = t.slice(start, start + len);
    return (start > 0 ? '…' : '') + s + (start + len < t.length ? '…' : '');
  }

  function searchEntries(q) {
    var key = String(q || '').trim().toLowerCase();
    if (!key) return [];
    var bs = shelfBooks();
    var hits = [];
    bs.forEach(function (b) {
      (b.entries || []).forEach(function (e, i) {
        var dot = String(e.date || '').slice(5).replace('-', '.');
        var hay = [e.text || '', e.mood || '', b.title || '', e.date || '', dot].join(' ').toLowerCase();
        if (hay.indexOf(key) >= 0) hits.push({ bid: b.id, title: b.title, idx: i, e: e });
      });
    });
    hits.sort(function (a, b) {
      return String(b.e.date || '').localeCompare(String(a.e.date || ''));
    });
    return hits;
  }

  window.saySearchOpen = function () {
    cardMode = 'search';
    cardBody('<div class="sc-t">翻以前写的</div>'
      + '<div class="sc-sub">一个字、一个词都行，跨所有本子找。</div>'
      + '<input class="sc-input" id="say-search-input" placeholder="比如：台灯、下雨、妈妈" autocomplete="off" spellcheck="false" oninput="saySearchRun()">'
      + '<div class="sr-list" id="say-search-res"><div class="sr-empty">打几个字，翻翻以前写过的。</div></div>'
      + '<div class="sc-row"><button class="sc-cancel" onclick="sayCloseCard()">合上</button></div>');
    setTimeout(function () {
      var inp = $('say-search-input');
      if (inp) inp.focus();
    }, 260);
  };

  window.saySearchRun = function () {
    var inp = $('say-search-input');
    var box = $('say-search-res');
    if (!box) return;
    var q = String((inp && inp.value) || '').trim();
    if (!q) {
      box.innerHTML = '<div class="sr-empty">打几个字，翻翻以前写过的。</div>';
      return;
    }
    var hits = searchEntries(q);
    if (!hits.length) {
      box.innerHTML = '<div class="sr-empty">没找到。也许那天用的是别的说法。</div>';
      return;
    }
    var html = '';
    hits.slice(0, 40).forEach(function (h) {
      var snip = snipAround(h.e.text || '', q, 30) || (h.e.images && h.e.images.length ? '（只有一张图）' : '（这页没写字）');
      html += '<button class="sr-item" data-bid="' + esc(h.bid) + '" data-i="' + h.idx + '" onclick="sayOpenHit(this)">'
        + '<span class="sr-d">' + esc(String(h.e.date || '').slice(5).replace('-', '.')) + '</span>'
        + '<span class="sr-x">' + hl(snip, q) + '</span>'
        + '<span class="sr-b">' + esc(h.title || '') + '</span>'
        + '</button>';
    });
    if (hits.length > 40) html += '<div class="sr-empty">还有 ' + (hits.length - 40) + ' 条，再写具体点。</div>';
    box.innerHTML = html;
  };

  window.sayOpenHit = function (el) {
    if (!el) return;
    var bid = el.getAttribute('data-bid') || '';
    var i = parseInt(el.getAttribute('data-i'), 10);
    if (!bid || isNaN(i)) return;
    sayCloseCard();
    state.bookId = bid;
    state.pageIdx = i;
    state.tab = 'shelf';
    setTab('shelf');
    show('sheet');
    renderSheet();
  };

  /* ---------------- 递一页给他 ---------------- */
  function currentEntry() {
    var es = entriesOfBook();
    return es[state.pageIdx] || null;
  }

  function repliesOf(e) {
    if (!e) return [];
    var list = Array.isArray(e.replies) ? e.replies.slice() : [];
    if (!list.length && e.reply && e.reply.text) {
      list = [{ name: e.reply.name, charId: e.reply.charId, text: e.reply.text, at: e.reply.at }];
    }
    return list.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  }

  function pushReply(e, r) {
    if (!e) return;
    if (!Array.isArray(e.replies)) e.replies = [];
    if (e.reply && e.reply.text) { e.replies.push(e.reply); e.reply = null; }
    e.replies.push(r);
    /* 同一个角色最多留最近三条 */
    var mine = e.replies.filter(function (x) { return (x.charId || '') === (r.charId || ''); })
      .slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    while (mine.length > 3) {
      var old = mine.shift();
      e.replies = e.replies.filter(function (x) { return x !== old; });
    }
    e.replies.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  }

  function timeLabel(at) {
    var d = at ? new Date(at) : new Date();
    var hh = ('0' + d.getHours()).slice(-2);
    var mm = ('0' + d.getMinutes()).slice(-2);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
  }

  window.sayOpenReplies = function () {
    var e = currentEntry();
    var reps = repliesOf(e);
    if (!reps.length) return;
    cardMode = 'replies';
    var groups = {};
    reps.forEach(function (r) {
      var k = r.name || '他';
      (groups[k] = groups[k] || []).push(r);
    });
    var html = '<div class="sc-t">他写在这页底下的</div>'
      + '<div class="sc-sub">每位最多留最近三条，再递一次不会盖掉旧的。</div>'
      + '<div class="sc-reps">';
    Object.keys(groups).forEach(function (name) {
      html += '<div class="rp-name">' + esc(name) + '</div>';
      groups[name].slice().reverse().forEach(function (r) {
        html += '<div class="rp-item"><div class="rp-t">' + esc(r.text) + '</div>'
          + '<div class="rp-a">' + esc(timeLabel(r.at)) + '</div></div>';
      });
    });
    html += '</div><div class="sc-row"><button class="sc-cancel" onclick="sayCloseCard()">合上</button></div>';
    cardBody(html);
  };

  function cardTextLines(g, text, maxW, maxLines) {
    var lines = [];
    var paras = String(text || '').split(/\r?\n/);
    var truncated = false;
    for (var p = 0; p < paras.length; p++) {
      if (lines.length >= maxLines) { truncated = true; break; }
      var s = paras[p].replace(/[ \t]+/g, ' ').trim();
      if (!s) {
        if (lines.length) lines.push('');
        continue;
      }
      var line = '';
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        var isTail = '，。、；：！？…）」』”'.indexOf(ch) >= 0;
        var over = g.measureText(line + ch).width > maxW;
        if (over && line && !isTail) {
          lines.push(line);
          line = ch;
          if (lines.length >= maxLines) { truncated = i < s.length - 1; break; }
        } else {
          line += ch;
        }
      }
      if (lines.length >= maxLines) { if (line && lines.length === maxLines) truncated = true; break; }
      if (line) lines.push(line);
    }
    if (lines.length > maxLines) { lines.length = maxLines; truncated = true; }
    if (truncated && lines.length) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/[，。、；：,.\s]+$/, '') + '…';
    }
    return lines;
  }

  function pageCardImg(e) {
    var W = 680, H = 440;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var grd = g.createLinearGradient(30, 0, W - 30, H);
    grd.addColorStop(0, '#FCF8EF');
    grd.addColorStop(0.55, '#F8F1E3');
    grd.addColorStop(1, '#EFE4D1');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.32)';
    g.lineWidth = 1;
    for (var y = 6; y < H; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.restore();

    g.strokeStyle = 'rgba(150,128,96,0.28)';
    g.lineWidth = 1.5;
    g.strokeRect(20, 20, W - 40, H - 40);

    var kai = 'KaiTi, STKaiti, "Kaiti SC", serif';
    var dl = dateLabel(e.date);
    g.font = '20px ' + kai;
    var dlW = g.measureText(dl).width;
    g.fillStyle = 'rgba(120,105,82,0.88)';
    g.fillText(dl, 48, 74);
    g.font = '17px ' + kai;
    g.fillStyle = 'rgba(140,124,98,0.82)';
    g.fillText(weekLabel(e.date) + (e.mood ? ' · ' + e.mood : ''), 48 + dlW + 18, 73);

    g.font = '27px ' + kai;
    var lines = cardTextLines(g, e.text || '这一页只留了一张图。', W - 100, 7);
    var lh = 40;
    var availTop = 112, availBottom = H - 96;
    var blockH = 0;
    lines.forEach(function (l) { blockH += l ? lh : 14; });
    var startY = availTop + Math.max(0, (availBottom - availTop - blockH) / 2) + 26;
    g.fillStyle = '#4A3F2E';
    var yCur = startY;
    lines.forEach(function (l) {
      if (!l) { yCur += 14; return; }
      g.fillText(l, 48, yCur);
      yCur += lh;
    });

    g.font = '18px ' + kai;
    g.fillStyle = 'rgba(150,134,108,0.92)';
    g.fillText(bookTitleOf(currentBookId()) || '我说', 48, H - 46);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(168,152,124,0.72)';
    g.fillText('我说 · 第 ' + (state.pageIdx + 1) + ' 页', W - 48, H - 46);
    g.textAlign = 'left';

    return c.toDataURL('image/jpeg', 0.74);
  }

  window.sayDeliverPage = function () {
    var e = currentEntry();
    if (!e) return;
    if (typeof window.sayDeliverCard !== 'function') { sayToast('聊天那边还没接上'); return; }
    var chars = (typeof window.getCharacters === 'function') ? (window.getCharacters() || []) : [];
    if (!chars.length) { sayToast('还没有可以递给的人'); return; }
    cardMode = 'deliver';
    var faces = chars.map(function (c) {
      var initial = String(c.name || '·').slice(0, 1);
      var inner = c.avatar
        ? '<img src="' + esc(c.avatar) + '" alt="">'
        : esc(initial);
      return '<button class="sc-face" data-id="' + esc(c.id) + '" data-name="' + esc(c.name || '') + '" onclick="sayDeliverTo(this)">'
        + '<i class="sc-fava">' + inner + '</i><b>' + esc(c.name || '他') + '</b></button>';
    }).join('');
    cardBody('<div class="sc-t">递给谁</div>'
      + '<div class="sc-sub">这一页会变成一张纸条，发进你和他的聊天；他回的那句话，会抄到这页纸底下。</div>'
      + '<div class="sc-faces">' + faces + '</div>'
      + '<div class="sc-row"><button class="sc-cancel" onclick="sayCloseCard()">算了</button></div>');
  };

  window.sayDeliverTo = function (el) {
    if (!el) return;
    var cid = el.getAttribute('data-id') || '';
    var cname = el.getAttribute('data-name') || '他';
    var e = currentEntry();
    if (!e || !cid) return;
    var giveEl = $('say-give');
    if (giveEl) { giveEl.disabled = true; giveEl.textContent = '递出去了…'; }
    sayCloseCard();
    sayToast('递给他了，等他说一句');

    var img = '';
    try { img = pageCardImg(e); } catch (err) { img = ''; }
    if (!img) {
      sayToast('这张纸条没画出来');
      if (giveEl) { giveEl.disabled = false; giveEl.textContent = '递给他'; }
      return;
    }

    window.sayDeliverCard({ charId: cid, imgSrc: img, note: '我写了一页，给你看看。' })
      .then(function (res) {
        if (res && res.ok && res.reply) {
          pushReply(e, { name: cname, charId: cid, text: res.reply, at: Date.now() });
          if (!saveData()) sayToast('他说了话，但没存下');
          renderSheet();
          /* 他回完了，如果人还在聊天页、也没在打字，就带回这一页 */
          var chatPage = document.getElementById('page-chat');
          var cInput = document.getElementById('chat-input');
          var onChat = !!(chatPage && chatPage.classList.contains('active'));
          var typing = !!(cInput && String(cInput.value || '').trim());
          if (onChat && !typing) {
            if (typeof window.openPage === 'function') window.openPage('page-say');
            show('sheet');
            renderSheet();
            sayToast(cname + ' 回了一句，抄在这页底下了');
          } else {
            sayToast(cname + ' 回了一句');
          }
        } else {
          if (res && res.error === 'nokey') sayToast('他还没接上线（没填 Key）');
          else sayToast('纸条递出去了，他这回没接话');
          if (giveEl) { giveEl.disabled = false; giveEl.textContent = '递给他'; }
        }
      })
      .catch(function () {
        sayToast('递失败了');
        if (giveEl) { giveEl.disabled = false; giveEl.textContent = '递给他'; }
      });
  };

  /* ---------------- 字体：默认 / 手写 / 宋体 / 圆体 / 娃娃体 / 自己导入 ---------------- */
  var SAY_FONT_KEY = 'momo_say_fonts_v1';
  var SAY_BUILTIN_FONTS = [
    { k: '', n: '默认', d: '现在这样', f: "'Kaiti SC', KaiTi, 'STKaiti', 'Noto Serif CJK SC', serif", ls: '.6px' },
    { k: 'kai', n: '手写体', d: '像拿笔自己写的', f: "'Hannotate SC', 'HanziPen SC', 'Hannotate TC', 'Kaiti SC', STKaiti, KaiTi, 'Noto Serif CJK SC', cursive", ls: '.2px' },
    { k: 'song', n: '宋体', d: '印刷书的味道', f: "'Songti SC', SimSun, 'Noto Serif CJK SC', 'Source Han Serif SC', 'Noto Serif SC', serif", ls: '1.2px' },
    { k: 'yuan', n: '圆体', d: '圆一点，不那么硬', f: "'Yuanti SC', YouYuan, 'MiSans', 'HarmonyOS Sans SC', 'PingFang SC', 'Noto Sans CJK SC', sans-serif", ls: '.8px' },
    { k: 'wawa', n: '娃娃体', d: '自己会写字的那种可爱', f: "'Wawati SC', 'Wawati TC', 'HanziPen SC', 'Hannotate SC', 'Yuanti SC', 'Noto Sans CJK SC', cursive", ls: '1.6px' }
  ];
  var sayUserFonts = [];
  var sayFontsReady = false;

  function fontIndexLoad() {
    try {
      var v = JSON.parse(localStorage.getItem(SAY_FONT_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function fontIndexSave() {
    try { localStorage.setItem(SAY_FONT_KEY, JSON.stringify(sayUserFonts || [])); } catch (e) { }
  }
  function fontStackOf(key) {
    if (!key) return "var(--sy-serif)";
    var b = SAY_BUILTIN_FONTS.filter(function (x) { return x.k === key; })[0];
    if (b) return b.f;
    var u = (sayUserFonts || []).filter(function (x) { return x.k === key; })[0];
    if (u) return "'SayFont_" + key + "', var(--sy-serif)";
    return "var(--sy-serif)";
  }
  function fontNameOf(key) {
    if (!key) return '默认';
    var b = SAY_BUILTIN_FONTS.filter(function (x) { return x.k === key; })[0];
    if (b) return b.n;
    var u = (sayUserFonts || []).filter(function (x) { return x.k === key; })[0];
    return u ? u.n : '默认';
  }
  function fontLsOf(key) {
    var b = SAY_BUILTIN_FONTS.filter(function (x) { return x.k === (key || ''); })[0];
    return b && b.ls ? b.ls : '.6px';
  }
  function applySayFont() {
    var root = document.querySelector('.say-screen');
    if (!root) return;
    var key = (data && data.font) || '';
    root.style.setProperty('--sy-wfont', fontStackOf(key));
    root.style.setProperty('--sy-wls', fontLsOf(key));
  }
  function registerUserFont(it) {
    if (!it || !it.k) return;
    getAudio('sayfont:' + it.k).then(function (blob) {
      if (!blob) return;
      try {
        var url = URL.createObjectURL(blob);
        var ff = new FontFace('SayFont_' + it.k, 'url(' + url + ')');
        document.fonts.add(ff);
        ff.load().then(function () { applySayFont(); }).catch(function () { });
      } catch (e) { console.warn('[say] font register failed', e); }
    });
  }
  function initSayFonts() {
    if (sayFontsReady) { applySayFont(); return; }
    sayFontsReady = true;
    sayUserFonts = fontIndexLoad();
    sayUserFonts.forEach(function (it) { registerUserFont(it); });
    applySayFont();
  }

  window.sayPickFont = function () {
    var box = $('say-fontpick');
    if (!box) return;
    var cur = (data && data.font) || '';
    var html = '<div class="fp-t">这一页的字，用哪种笔迹</div>';
    SAY_BUILTIN_FONTS.forEach(function (f) {
      html += '<button class="fp-item' + (cur === f.k ? ' on' : '') + '" data-k="' + f.k + '" onclick="saySetFont(this.dataset.k)">'
        + '<span class="fp-nm" style="font-family: ' + f.f + '">' + f.n + '</span>'
        + '<span class="fp-sm">' + f.d + '</span>'
        + '</button>';
    });
    sayUserFonts.forEach(function (u) {
      html += '<button class="fp-item' + (cur === u.k ? ' on' : '') + '" data-k="' + esc(u.k) + '" onclick="saySetFont(this.dataset.k)">'
        + '<span class="fp-nm" style="font-family: \'SayFont_' + esc(u.k) + '\'">' + esc(u.n) + '</span>'
        + '<span class="fp-sm">自己导的</span>'
        + '<i class="fp-x" data-k="' + esc(u.k) + '" onclick="sayDelFont(event, this)">✕</i>'
        + '</button>';
    });
    html += '<button class="fp-add" onclick="sayFontFile()">＋ 导入字体文件（ttf / otf / woff）</button>';
    box.innerHTML = html;
    box.classList.add('on');
  };

  window.saySetFont = function (k) {
    if (!data) return;
    data.font = k || '';
    saveData();
    applySayFont();
    var box = $('say-fontpick');
    if (box) box.classList.remove('on');
    sayToast('字换成「' + fontNameOf(data.font) + '」');
  };

  window.sayFontFile = function () {
    var inp = $('say-font-input');
    if (inp) { inp.value = ''; inp.click(); }
  };

  window.sayImportFont = function (ev) {
    var file = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) { sayToast('要 .ttf / .otf / .woff 字体文件'); return; }
    if (file.size > 24 * 1024 * 1024) { sayToast('这个字体太大了：' + Math.round(file.size / 1048576) + 'MB'); return; }
    var nm = String(file.name).replace(/\.[^.]+$/, '').slice(0, 14) || '我的字体';
    var k = 'u' + Date.now().toString(36).slice(-6);
    putAudio('sayfont:' + k, file).then(function (ok) {
      if (!ok) { sayToast('这个字体没存进去，换个小一点的试试'); return; }
      sayUserFonts = sayUserFonts.concat([{ k: k, n: nm }]);
      fontIndexSave();
      registerUserFont({ k: k, n: nm });
      if (data) { data.font = k; saveData(); }
      applySayFont();
      window.sayPickFont();
      sayToast('字导好了：' + nm);
    });
  };

  window.sayDelFont = function (ev, el) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var k = el && el.getAttribute('data-k');
    if (!k) return;
    sayUserFonts = sayUserFonts.filter(function (x) { return x.k !== k; });
    fontIndexSave();
    if (data && data.font === k) { data.font = ''; saveData(); applySayFont(); }
    window.sayPickFont();
    sayToast('删掉了这个字体');
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
    state.editingId = '';
    saveData();
    show('write');
    renderWrite();
    initSayFonts();
    flipAt('say-flip-w', null, 'back');
  };

  function renderWrite() {
    var d = data.draft || (data.draft = newDraft());
    var dateEl = $('say-write-date');
    if (dateEl) dateEl.textContent = (state.editingId ? '改 · ' : '') + dateLabel(d.date);
    var doneEl = document.querySelector('.say-write .wr-done');
    if (doneEl) doneEl.textContent = state.editingId ? '改好了' : '写好了';
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
    var pgn = $('say-write-pgn');
    if (pgn) pgn.textContent = pad(state.editingId ? (state.pageIdx + 1) : (entriesOfBook().length + 1));
    var bkEl = $('say-write-book');
    if (bkEl) bkEl.textContent = bookTitleOf(state.bookId || currentBookId()) || 'say';
    applySayFont();
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

  window.sayEditPage = function () {
    var es = entriesOfBook();
    var e = es[state.pageIdx];
    if (!e) return;
    state.editingId = e.id;
    data.draft = {
      date: e.date || todayStr(),
      text: String(e.text || ''),
      mood: e.mood || '',
      paper: e.paper || '',
      images: (Array.isArray(e.images) ? e.images : []).slice(),
      audio: e.audio || ''
    };
    saveData();
    show('write');
    renderWrite();
    initSayFonts();
    flipAt('say-flip-w', null, 'back');
  };

  window.sayBackFromWrite = function () {
    if (state.editingId) {
      state.editingId = '';
      data.draft = null;
      saveData();
      show('sheet');
      renderSheet();
      flipAt('say-flip', null, 'back');
      return;
    }
    var d = data.draft;
    if (d && String(d.text || '').trim()) {
      // 还没点「写好了」就当草稿留着，下次进来还在
      saveData();
    }
    show('wall');
    renderShelf();
  };

  window.saySaveEntry = function () {
    var d = data.draft;
    if (!d) return;
    var text = String(d.text || '').trim();
    if (!text && !(d.images && d.images.length) && !d.audio) {
      sayToast('这一页还是空的');
      return;
    }

    /* 改的是已经写过的那一页 */
    if (state.editingId) {
      var old = data.entries.filter(function (x) { return x.id === state.editingId; })[0];
      if (!old) {
        state.editingId = '';
        data.draft = null;
        show('sheet');
        renderSheet();
        return;
      }
      var snap = { date: old.date, mood: old.mood, text: old.text, images: old.images, audio: old.audio, paper: old.paper };
      old.date = d.date || old.date;
      old.mood = d.mood || '';
      old.text = text;
      old.images = (d.images || []).slice(0, MAX_IMAGES);
      old.audio = d.audio || '';
      old.paper = d.paper || '';
      state.editingId = '';
      data.draft = null;
      if (!saveData()) {
        old.date = snap.date; old.mood = snap.mood; old.text = snap.text;
        old.images = snap.images; old.audio = snap.audio; old.paper = snap.paper;
        state.editingId = old.id;
        sayToast('空间不够了，先把大图删掉再存');
        return;
      }
      var es2 = entriesOfBook();
      var idx = 0;
      for (var i = 0; i < es2.length; i++) { if (es2[i].id === old.id) idx = i; }
      state.pageIdx = idx;
      show('sheet');
      renderSheet();
      flipAt('say-flip', null, 'back');
      sayToast('改好了');
      return;
    }

    var bid = state.bookId || currentBookId();
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
      bookId: bid.indexOf('m-') === 0 ? '' : bid,
      created: new Date().toISOString()
    };
    data.entries.push(e);
    data.draft = null;
    if (!saveData()) {
      data.entries.pop();
      sayToast('空间不够了，先把大图删掉再存');
      return;
    }
    state.pageIdx = entriesOfBook().length - 1;
    show('sheet');
    renderSheet();
    flipAt('say-flip', null, 'back');
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

  /* ---------------- 手指翻页：右半张纸往左拖 = 卷走这一页，往右拖 = 展开上一页 ---------------- */
  (function () {
    var drag = { on: false, x: 0, y: 0, w: 1, h: 1, p: 0, dir: '', pre: -1 };
    function layer() { return $('say-flip'); }

    function start(e) {
      if (state.mode !== 'sheet' || e.touches.length !== 1) return;
      var t = e.touches[0];
      if (e.target.closest && e.target.closest('button, .sh-turn, a, input, textarea')) return;
      var bg = document.querySelector('#say-sheet .sheet-bg');
      if (!bg) return;
      var r = bg.getBoundingClientRect();
      if (t.clientX < r.left + r.width * 0.5) return;   // 左半边留给阅读
      var page = document.querySelector('#say-flip .flip-page');
      drag.on = true; drag.dir = ''; drag.p = 0; drag.pre = -1;
      drag.x = t.clientX; drag.y = t.clientY;
      drag.w = (page && page.clientWidth) || r.width;
      drag.h = (page && page.clientHeight) || r.height;
    }

    function move(e) {
      if (!drag.on) return;
      var t = e.touches[0];
      var dx = drag.x - t.clientX;          // 往左拖为正
      var dy = Math.abs(drag.y - t.clientY);
      if (!drag.dir) {
        if (Math.abs(dx) < 8 && dy < 8) return;
        if (dy > Math.abs(dx) * 1.2) { drag.on = false; return; }   // 上下滑 → 让给正文滚动
        if (dx > 0) {
          if (state.pageIdx >= entriesOfBook().length - 1) { drag.on = false; return; }
          drag.dir = 'next';
          saySnapPage();                    // 纸 = 正在离开的这一页
          state.pageIdx++;                  // 底下先摆成下一页，卷起来就露它
          renderSheet();
        } else {
          if (state.pageIdx <= 0) { drag.on = false; return; }
          drag.dir = 'prev';
          drag.pre = state.pageIdx;
          saySnapPage();                    // 纸 = 正在离开的这一页
          state.pageIdx = drag.pre - 1;     // 底下换成上一页，卷起来就露它
          renderSheet();
        }
      }
      var k = Math.abs(dx) / (drag.w * 1.05);
      var p = drag.dir === 'next' ? Math.min(1, k) : Math.max(0, 1 - k);
      drag.p = p;
      layer().classList.add('on');
      sayCurlSet(p, 'say-flip', drag.w, drag.h);
      if (e.cancelable) e.preventDefault();
    }

    function end() {
      if (!drag.on) return;
      drag.on = false;
      if (!drag.dir) return;
      var m = layer(), W = drag.w, H = drag.h;
      var done = drag.dir === 'next' ? drag.p > .5 : drag.p < .5;
      var target = drag.dir === 'next' ? (done ? 1 : 0) : (done ? 0 : 1);
      sayCurlAnim('say-flip', drag.p, target, 200, function () {
        if (drag.dir === 'next' && !done) { state.pageIdx--; renderSheet(); }
        if (drag.dir === 'prev' && !done && drag.pre >= 0) { state.pageIdx = drag.pre; renderSheet(); }
        sayCurlSet(0, 'say-flip', W, H);
        m.classList.remove('on');
      });
    }

    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
  })();
  /* ---------------- 书柜手势 ---------------- */
  // 书柜是一排可以左右拖的书；长按改名由书脊自己处理，这里只需要保证滚动时
  // 不会因为手指微动被当成点击（滚动容器本来就吃 pan-x）
  function bindGestures() {
    var shelf = $('say-shelf');
    if (!shelf || shelf.__sayBound) return;
    shelf.__sayBound = true;
    shelf.addEventListener('touchmove', function () {
      clearTimeout(pressed.timer);   // 一开始拖就别等长按了
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
