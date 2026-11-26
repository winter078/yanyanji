// 世界书 · 私人信箱
// 一本书 = 一个信封；收件人 = 适用角色。书是主体，角色页只是按收件人筛出来的书单。
(function () {
  'use strict';

  var K_BOOKS = 'momo_world_books';
  var K_BOX_NAME = 'momo_world_box_name';
  var ALL = '*';
  var PALETTE = ['#7d8fae', '#7d927f', '#b08086', '#a493c9', '#64827e', '#8d7b62'];
  var MAX_WORLD_CHARS = 30000;

  var books = [];
  var state = { filter: 'all', person: '', listOpen: false };
  var currentBookId = '';
  var editingBookId = '';
  var editingEntryId = '';
  var recipientDraft = [ALL];
  var colorDraft = PALETTE[0];

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function br(s) { return esc(s).replace(/\n/g, '<br>'); }

  function toast(msg) {
    if (window.wxToast) return window.wxToast(msg);
    if (window.showToast) return window.showToast(msg);
    // 不再使用“融入绪言大脑”这类出戏文案
    try { console.log('[世界书]', msg); } catch (e) {}
  }

  function app() { return window.appData || {}; }

  function chars() {
    try {
      if (typeof window.getCharacters === 'function') {
        var list = window.getCharacters();
        if (Array.isArray(list) && list.length) return list;
      }
    } catch (e) {}
    try {
      var saved = JSON.parse(localStorage.getItem('momo_characters') || '[]');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (e) {}
    return [{ id: 'c-xuyan', name: (app().botRemark || '周绪言'), avatar: '' }];
  }

  function activeCharId() {
    var saved = '';
    try { saved = localStorage.getItem('momo_active_char') || ''; } catch (e) {}
    var list = chars();
    if (saved && list.some(function (c) { return c.id === saved; })) return saved;
    return list[0] ? list[0].id : 'c-xuyan';
  }

  function charName(id) {
    if (!id || id === ALL) return '所有角色';
    var c = null;
    try {
      if (typeof window.findCharacterById === 'function') c = window.findCharacterById(id);
    } catch (e) {}
    if (!c) c = chars().filter(function (x) { return x.id === id; })[0] || null;
    return c ? (c.name || '未命名角色') : '未命名角色';
  }

  function charAvatar(id) {
    var c = chars().filter(function (x) { return x.id === id; })[0];
    return (c && c.avatar) || '';
  }

  function initialOf(name) {
    var s = String(name || '书').trim();
    return s ? s.slice(0, 1) : '书';
  }

  function shade(hex, pct) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) h = '7d8fae';
    var num = parseInt(h, 16);
    var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    var f = function (v) {
      var nv = Math.round(v + (pct > 0 ? (255 - v) * pct : v * pct));
      return Math.max(0, Math.min(255, nv));
    };
    return '#' + [f(r), f(g), f(b)].map(function (v) {
      return ('0' + v.toString(16)).slice(-2);
    }).join('');
  }

  function normKeywords(v) {
    if (Array.isArray(v)) {
      return v.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    }
    return String(v || '').split(/[,，、;；\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function normalizeEntry(e) {
    var out = {};
    var hadKeywords = Array.isArray(e.keywords);
    out.id = e.id || ('entry_' + Date.now() + Math.random().toString(36).slice(2, 5));
    out.title = e.title || '未命名条目';
    out.content = e.content || '';
    out.keywords = normKeywords(e.keywords);
    out.constant = !!e.constant;
    out.private = !!e.private;
    out.enabled = e.enabled !== false;
    out.createdAt = e.createdAt || Date.now();
    // 旧条目没有 keywords 字段：保持原来“永远注入”的行为，不因升级悄悄失效
    if (!hadKeywords && !out.constant) out.constant = true;
    return out;
  }

  function isGlobal(b) {
    return !b || !Array.isArray(b.recipients) || !b.recipients.length || b.recipients.indexOf(ALL) !== -1;
  }

  function recipientIds(b) {
    return isGlobal(b) ? [] : b.recipients.slice();
  }

  function normalizeBook(b, index) {
    var out = {};
    out.id = b.id || ('book_' + Date.now() + Math.random().toString(36).slice(2, 5));
    out.title = b.title || '未命名书';
    out.desc = b.desc || '';
    out.color = b.color || PALETTE[index % PALETTE.length];
    out.scope = b.scope || 'all';
    out.note = b.note || '';
    out.enabled = b.enabled !== false;
    out.updatedAt = b.updatedAt || 0;

    if (Array.isArray(b.recipients)) {
      out.recipients = b.recipients.length ? b.recipients.slice() : [ALL];
    } else if (b.id === 'book_language_norm') {
      out.recipients = [ALL];
    } else if (b.scope === 'single') {
      out.recipients = [activeCharId()];
    } else {
      out.recipients = [ALL];
    }

    out.entries = (Array.isArray(b.entries) ? b.entries : []).map(normalizeEntry);
    return out;
  }

  function loadBooks() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(K_BOOKS) || 'null'); } catch (e) {}
    if (!Array.isArray(raw)) raw = Array.isArray(app().worldBooks) ? app().worldBooks : [];
    if (!raw.length && Array.isArray(app().worldEntries) && app().worldEntries.length) {
      // 旧版只有扁平条目：合成一本，别让剧场 / 伴读突然空白
      raw = [{
        id: 'book_legacy_flat',
        title: '旧版条目',
        desc: '从旧版世界书迁移过来的条目。',
        color: PALETTE[0],
        recipients: [ALL],
        scope: 'all',
        entries: app().worldEntries.map(function (e) {
          return { id: e.id || ('entry_' + Date.now()), title: e.title || '旧条目', content: e.content || '', constant: true };
        })
      }];
    }
    books = raw.map(normalizeBook);
    app().worldBooks = books;
    try { localStorage.setItem(K_BOOKS, JSON.stringify(books)); } catch (e) {}
  }

  function saveBooks() {
    app().worldBooks = books;
    try { localStorage.setItem(K_BOOKS, JSON.stringify(books)); } catch (e) {}
    if (typeof window.syncWechatMainPreview === 'function' && document.getElementById('page-wechat-main')) {
      window.syncWechatMainPreview();
    }
  }

  function findBook(id) {
    return books.filter(function (b) { return b.id === id; })[0] || null;
  }

  function filteredBooks() {
    if (state.filter === 'global') {
      return books.filter(isGlobal);
    }
    if (state.filter === 'character') {
      if (state.person) return books.filter(function (b) { return isGlobal(b) || recipientIds(b).indexOf(state.person) !== -1; });
      return books.filter(function (b) { return !isGlobal(b); });
    }
    return books.slice();
  }

  function sortBooks(list) {
    return list.slice().sort(function (a, b) {
      if (state.person) {
        var sa = isGlobal(a) ? 1 : 0;
        var sb = isGlobal(b) ? 1 : 0;
        if (sa !== sb) return sa - sb;
      }
      var ta = a.updatedAt || 0;
      var tb = b.updatedAt || 0;
      if (ta !== tb) return tb - ta;
      return String(a.title).localeCompare(String(b.title), 'zh');
    });
  }

  function globalCount(list) {
    return (list || books).filter(isGlobal).length;
  }

  function namedCount(list) {
    return (list || books).filter(function (b) { return !isGlobal(b); }).length;
  }

  function personCount(id) {
    return books.filter(function (b) { return isGlobal(b) || recipientIds(b).indexOf(id) !== -1; }).length;
  }

  function recipientLabel(b) {
    if (isGlobal(b)) return '所有角色';
    var names = recipientIds(b).map(charName);
    if (names.length <= 3) return names.join(' + ');
    return names.slice(0, 2).join(' + ') + ' +' + (names.length - 2);
  }

  function recipientNames(b) {
    return isGlobal(b) ? ['所有角色'] : recipientIds(b).map(charName);
  }

  function constCount(b) {
    return (b.entries || []).filter(function (e) { return e.constant; }).length;
  }

  function privateCount(b) {
    return (b.entries || []).filter(function (e) { return e.private; }).length;
  }

  function fmtDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function colorVars(b) {
    var c1 = b.color || PALETTE[0];
    return '--c1:' + c1 + ';--c2:' + shade(c1, -0.24) + ';--bc1:' + c1 + ';--bc2:' + shade(c1, -0.24) + ';--bl:' + c1 + ';';
  }

  function bookCard(book) {
    var c = colorVars(book);
    var tag = isGlobal(book) ? 'GLOBAL · 所有角色' : (recipientIds(book).length > 1 ? '共享 ' + recipientIds(book).length + ' 人' : '指定给 ' + charName(recipientIds(book)[0]));
    var meta = (book.entries || []).length + ' 条 · ' + constCount(book) + ' 常驻';
    var priv = privateCount(book);
    if (priv) meta += ' · ' + priv + ' 私密';
    var desc = book.desc || '还没有写简介。';
    var safeTitle = esc(book.title || '未命名');
    return '<div class="wb-env card" style="' + c + '" data-book-id="' + esc(book.id) + '" onclick="openBookDetail(\'' + esc(book.id) + '\')" title="' + safeTitle + ' · ' + esc(recipientLabel(book)) + '">'
      + '<div class="wb-stamp">' + esc(initialOf(book.title)) + '</div>'
      + '<div class="wb-env-title">' + safeTitle + '</div>'
      + '<div class="wb-env-to">收件人 <b>' + esc(recipientLabel(book)) + '</b></div>'
      + '<div class="wb-env-desc">' + br(desc) + '</div>'
      + '<div class="wb-env-tag">' + esc(tag) + '</div>'
      + '<div class="wb-env-meta">' + esc(meta) + '</div>'
      + '<div class="wb-env-open" aria-hidden="true">›</div>'
      + '</div>';
  }

  function renderStack(list) {
    var tray = $('world-book-stack');
    if (!tray) return;
    if (!list.length) {
      tray.__wbListKey = '';
      tray.innerHTML = '<div class="wb-empty"><div class="stamp-big">✉</div><div>书箱还是空的。<br>新建一本，先寄给一个角色。</div></div>';
      return;
    }
    var listKey = list.map(function (b) { return b.id; }).join('|');
    var keepScroll = tray.__wbListKey === listKey ? tray.scrollLeft : 0;
    tray.__wbListKey = listKey;
    tray.innerHTML = list.map(bookCard).join('');
    if (!tray.__wbSwipeBound) {
      tray.__wbSwipeBound = true;
      var startX = 0, startY = 0, moved = false;
      tray.addEventListener('touchstart', function (e) {
        var t = e.touches && e.touches[0];
        startX = t ? t.clientX : 0;
        startY = t ? t.clientY : 0;
        moved = false;
      }, { passive: true });
      tray.addEventListener('touchmove', function (e) {
        var t = e.touches && e.touches[0];
        if (!t) return;
        if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) moved = true;
      }, { passive: true });
      tray.addEventListener('click', function (e) {
        if (!moved) return;
        moved = false;
        e.preventDefault();
        e.stopPropagation();
      }, true);
    }
    try { tray.scrollLeft = keepScroll; } catch (e) {}
  }

  function renderFilters() {
    var row = $('world-filter-row');
    if (!row) return;
    var counts = {
      all: books.length,
      global: globalCount(),
      character: namedCount()
    };
    var defs = [
      ['all', '全部', counts.all],
      ['global', '全局', counts.global],
      ['character', '角色', counts.character]
    ];
    row.innerHTML = defs.map(function (d) {
      return '<button class="wb-chip ' + (state.filter === d[0] ? 'active' : '') + '" onclick="setWorldFilter(\'' + d[0] + '\')">' + d[1] + '<strong>' + d[2] + '</strong></button>';
    }).join('');
  }

  function personChip(id, name, count, active, all) {
    var av = all ? '全' : initialOf(name);
    return '<button class="wb-person ' + (all ? 'all ' : '') + (active ? 'active' : '') + '" onclick="' + (all ? 'setWorldPerson(\'\')' : 'setWorldPerson(\'' + esc(id) + '\')') + '">'
      + '<span class="av">' + esc(av) + '</span>' + esc(name) + '<strong>' + count + '</strong></button>';
  }

  function renderPeople() {
    var row = $('world-people-row');
    if (!row) return;
    var list = chars();
    var html = personChip('', '所有角色', books.length, state.filter === 'character' && !state.person, true);
    list.forEach(function (c) {
      html += personChip(c.id, c.name || '未命名角色', personCount(c.id), state.person === c.id, false);
    });
    row.innerHTML = html;
  }

  function renderShareNote(list) {
    var note = $('world-share-note');
    if (!note) return;
    if (!books.length) {
      note.innerHTML = '还没有书。新建一本，收件人可以选“所有角色”，也可以选一个具体角色。';
      return;
    }
    if (state.person) {
      var p = charName(state.person);
      note.innerHTML = esc(p) + ' 的书单 · ' + list.length + ' 本。全局书也在，指定给他的书排前面。';
      return;
    }
    var multi = books.filter(function (b) { return !isGlobal(b) && recipientIds(b).length > 1; })[0];
    if (state.filter === 'global') {
      note.innerHTML = '这些书的收件人都是“所有角色”，所有书单里都能看到。';
    } else if (multi) {
      note.innerHTML = '《' + esc(multi.title) + '》同时寄给 ' + esc(recipientLabel(multi)) + '；换一个角色页，它还会在。';
    } else {
      note.innerHTML = '同一本书可以寄给多个角色；点人物胶囊，书单会按收件人变窄。';
    }
  }

  function renderAllList(list) {
    var box = $('world-all-list');
    var btn = $('world-all-toggle');
    if (!box || !btn) return;
    if (list.length <= 4) {
      state.listOpen = false;
      btn.style.display = 'none';
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    btn.style.display = 'block';
    btn.innerHTML = state.listOpen ? '收起全部书' : ('查看全部 ' + list.length + ' 本');
    box.style.display = state.listOpen ? 'flex' : 'none';
    if (!state.listOpen) return;
    box.innerHTML = list.map(function (b) {
      var c = b.color || PALETTE[0];
      return '<button class="wb-all-row" onclick="openBookDetail(\'' + esc(b.id) + '\')">'
        + '<span class="stamp" style="background:' + c + '">' + esc(initialOf(b.title)) + '</span>'
        + '<span class="copy"><span class="name">' + esc(b.title) + '</span><span class="meta">' + esc(recipientLabel(b)) + ' · ' + (b.entries || []).length + ' 条</span></span>'
        + '<span class="arrow">›</span></button>';
    }).join('');
  }

  function renderRecent() {
    var box = $('world-recent');
    if (!box) return;
    var latest = books.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })[0];
    if (!latest) { box.innerHTML = ''; return; }
    var c = latest.color || PALETTE[0];
    box.innerHTML = '<div class="wb-recent-head">最近放进书箱</div>'
      + '<div class="wb-recent-row" onclick="openBookDetail(\'' + esc(latest.id) + '\')">'
      + '<span class="stamp" style="background:' + c + '">' + esc(initialOf(latest.title)) + '</span>'
      + '<span class="copy"><b>' + esc(latest.title) + '</b><span>' + esc(recipientLabel(latest)) + ' · ' + (latest.entries || []).length + ' 条</span></span>'
      + '<span class="arrow">›</span></div>';
  }

  // ---------- 书箱名字 ----------
  function boxName() {
    var saved = '';
    try { saved = localStorage.getItem(K_BOX_NAME) || ''; } catch (e) {}
    return saved.trim() || '我的书箱';
  }

  function openWorldBoxNameModal() {
    var modal = $('modal-world-box');
    var input = $('input-world-box-name');
    if (!modal || !input) return;
    input.value = boxName();
    modal.style.display = 'flex';
    setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 120);
  }

  function closeWorldBoxNameModal() {
    var modal = $('modal-world-box');
    if (modal) modal.style.display = 'none';
  }

  function saveWorldBoxName() {
    var input = $('input-world-box-name');
    var name = (input && input.value || '').trim().slice(0, 14) || '我的书箱';
    try { localStorage.setItem(K_BOX_NAME, name); } catch (e) {}
    closeWorldBoxNameModal();
    var title = $('world-lid-title');
    if (title) title.textContent = name;
    toast('书箱名字已改好');
  }

  function renderWorldBookshelf() {
    if (!books.length) loadBooks();
    var boxTitle = $('world-lid-title');
    if (boxTitle) boxTitle.textContent = boxName();
    var list = sortBooks(filteredBooks());
    var sub = $('world-top-sub');
    if (sub) sub.textContent = '世界书 · ' + books.length + ' 本';

    var meta = $('world-lid-meta');
    if (meta) {
      if (state.person) meta.textContent = charName(state.person) + ' · ' + list.length + ' 本';
      else if (state.filter === 'global') meta.textContent = 'GLOBAL · ' + list.length + ' 本';
      else if (state.filter === 'character') meta.textContent = '角色书单 · ' + list.length + ' 本';
      else meta.textContent = 'WORLD BOOK · ' + list.length + ' 本';
    }

    var addr = $('world-lid-address');
    if (addr) {
      var g = globalCount(list);
      var named = list.length - g;
      if (state.person) {
        addr.innerHTML = '<b>共 ' + list.length + ' 本</b><span class="sep"></span><span>全局 ' + g + ' 本</span><span class="sep"></span><span>指定 ' + named + ' 本</span>';
      } else {
        addr.innerHTML = '<b>共 ' + list.length + ' 本</b><span class="sep"></span><span>全局 ' + g + ' 本</span><span class="sep"></span><span>角色 ' + named + ' 本</span>';
      }
    }

    renderStack(list);
    renderFilters();
    renderPeople();
    renderShareNote(list);
    renderAllList(list);
    renderRecent();
  }

  // ---------- 筛选 ----------
  function setWorldFilter(filter) {
    state.filter = (filter === 'global' || filter === 'character') ? filter : 'all';
    if (state.filter === 'all' || state.filter === 'global') state.person = '';
    state.listOpen = false;
    renderWorldBookshelf();
  }

  function setWorldPerson(id) {
    state.filter = 'character';
    state.person = id || '';
    state.listOpen = false;
    renderWorldBookshelf();
  }

  function toggleWorldBookList() {
    state.listOpen = !state.listOpen;
    renderWorldBookshelf();
  }

  // ---------- 书详情 ----------
  function openBookDetail(id) {
    var b = findBook(id);
    if (!b) return;
    currentBookId = id;
    var shell = $('world-bookshelf-wrapper');
    var detail = $('world-book-detail-wrapper');
    if (shell) shell.style.display = 'none';
    if (detail) detail.style.display = 'flex';
    renderBookDetail(b);
    switchBookTab('entries');
  }

  function backToBookshelf() {
    currentBookId = '';
    var shell = $('world-bookshelf-wrapper');
    var detail = $('world-book-detail-wrapper');
    if (detail) detail.style.display = 'none';
    if (shell) shell.style.display = 'flex';
    renderWorldBookshelf();
  }

  function renderBookDetail(b) {
    var index = books.indexOf(b) + 1;
    var c = colorVars(b);
    var title = $('book-detail-header-title');
    if (title) title.textContent = b.title;
    var sub = $('book-detail-sub');
    if (sub) sub.textContent = '世界书 · 第 ' + index + ' 本';

    var env = $('book-envelope-back');
    if (env) {
      env.setAttribute('style', c);
      env.style.display = 'block';
    }
    var bname = $('book-back-name');
    if (bname) bname.innerHTML = esc(b.title) + '<span>WORLD BOOK · ' + (b.entries || []).length + ' ENTRIES</span>';
    var stamp = $('book-back-stamp');
    if (stamp) stamp.textContent = initialOf(b.title);
    var from = $('book-back-from');
    if (from) from.textContent = 'FROM ' + recipientLabel(b) + (b.desc ? ' · ' + b.desc : '');

    var lt = $('book-letter-title');
    if (lt) lt.textContent = b.title;
    var kick = $('book-letter-kicker');
    if (kick) kick.textContent = 'WORLD BOOK · ' + recipientLabel(b);
    var no = $('book-letter-no');
    if (no) {
      no.innerHTML = 'NO. ' + ('0' + index).slice(-2) + '<br>' + (fmtDate(b.updatedAt) || '—');
    }

    renderRecipientsInDetail(b);

    var count = $('book-tab-count');
    if (count) count.textContent = (b.entries || []).length;

    renderEntries(b);
    renderSettings(b);

    var foot = $('book-letter-foot');
    if (foot) {
      var names = recipientNames(b);
      var text = isGlobal(b) ? '所有角色都能拆开这封信。' : (names.length > 1 ? '同一本书，也会出现在 ' + names.join(' / ') + ' 的书单里。' : '这本书只寄给 ' + names[0] + '。');
      foot.innerHTML = '<span>' + esc(text) + '</span><span class="sign">user</span>';
    }
  }

  function renderRecipientsInDetail(b) {
    var box = $('book-recipients');
    if (!box) return;
    var html = '<span class="label">收件人</span>';
    if (isGlobal(b)) {
      html += '<span class="wb-recipient"><span class="av">全</span>所有角色</span>';
      html += '<span class="wb-recipient-count">全局书 · 每个书单都能看到</span>';
    } else {
      var ids = recipientIds(b);
      ids.forEach(function (id) {
        html += '<span class="wb-recipient"><span class="av">' + esc(initialOf(charName(id))) + '</span>' + esc(charName(id)) + '</span>';
      });
      html += '<button class="wb-recipient-add" onclick="openEditBookModal(\'' + esc(b.id) + '\')" aria-label="修改收件人">＋</button>';
      html += '<span class="wb-recipient-count">同时出现在 ' + ids.length + ' 个角色页</span>';
    }
    box.innerHTML = html;
  }

  function renderEntries(b) {
    var list = $('book-entries-list');
    if (!list) return;
    var entries = b.entries || [];
    if (!entries.length) {
      list.innerHTML = '<div class="wb-empty-entries">这本还没有词条。<br>先写一条常驻，给角色一个底色。</div>';
      return;
    }
    list.innerHTML = entries.map(function (e) {
      var keys = (e.keywords || []).map(function (k) { return '<span class="wb-key">' + esc(k) + '</span>'; }).join('');
      var seal = e.private ? '<span class="wb-seal private">私</span>' : (recipientIds(b).length > 1 ? '<span class="wb-seal">共</span>' : '<span class="wb-entry-dot"></span>');
      return '<div class="wb-entry">'
        + '<div class="wb-entry-top"><div class="wb-entry-title">' + esc(e.title) + '</div>' + seal + '</div>'
        + '<div class="wb-entry-text">' + br(e.content) + '</div>'
        + '<div class="wb-entry-meta">' + (e.constant ? '<span class="wb-mini">常驻</span>' : '') + keys + '</div>'
        + '<div class="wb-entry-actions"><button onclick="openEditEntryModal(\'' + esc(e.id) + '\')">编辑</button><button onclick="deleteEntry(\'' + esc(e.id) + '\')">删除</button></div>'
        + '</div>';
    }).join('');
  }

  function renderSettings(b) {
    var panel = $('book-settings-panel');
    if (!panel) return;
    var swatches = PALETTE.map(function (c) {
      return '<span class="wb-swatch" style="background:' + c + (c === b.color ? ';outline:2px solid rgba(255,255,255,.7);outline-offset:1px' : '') + '"></span>';
    }).join('');
    panel.innerHTML = ''
      + '<div class="wb-setting-row"><span class="k">收件人</span><span class="v"><b>' + esc(recipientLabel(b)) + '</b></span></div>'
      + '<div class="wb-setting-row"><span class="k">主题色</span><span class="v"><span class="wb-swatch-row">' + swatches + '</span></span></div>'
      + '<div class="wb-setting-row"><span class="k">默认启用</span><span class="v"><b>' + (b.enabled !== false ? '已启用' : '已停用') + '</b></span></div>'
      + '<div class="wb-setting-row"><span class="k">生效场景</span><span class="v">由收件人和条目“私密”决定；群聊不注入私密条目。</span></div>'
      + '<div class="wb-setting-row"><span class="k">备注</span><span class="v">' + (b.note ? esc(b.note) : '未填写；备注只给自己看，不进提示词。') + '</span></div>'
      + '<button class="wb-edit-book" onclick="openEditBookModal(\'' + esc(b.id) + '\')">修改这本书</button>'
      + '<button class="wb-edit-book" onclick="deleteBook(\'' + esc(b.id) + '\')" style="color:#9b555d;">删除这本书</button>';
  }

  function switchBookTab(tab) {
    var entriesTab = $('book-tab-entries');
    var settingsTab = $('book-tab-settings');
    var entries = $('book-entries-list');
    var panel = $('book-settings-panel');
    var isSettings = tab === 'settings';
    if (entriesTab) entriesTab.classList.toggle('active', !isSettings);
    if (settingsTab) settingsTab.classList.toggle('active', isSettings);
    if (entries) entries.style.display = isSettings ? 'none' : 'block';
    if (panel) panel.style.display = isSettings ? 'block' : 'none';
    var add = document.querySelector('#world-book-detail-wrapper .wb-add-entry');
    if (add) add.style.display = isSettings ? 'none' : 'block';
  }

  // ---------- 新建 / 编辑书 ----------
  function renderRecipientPicker() {
    var box = $('book-recipient-picker');
    if (!box) return;
    var html = '<button class="wb-pick-chip all ' + (recipientDraft.indexOf(ALL) !== -1 ? 'active' : '') + '" onclick="toggleRecipient(\'' + ALL + '\')">所有角色</button>';
    chars().forEach(function (c) {
      html += '<button class="wb-pick-chip ' + (recipientDraft.indexOf(c.id) !== -1 ? 'active' : '') + '" onclick="toggleRecipient(\'' + esc(c.id) + '\')">' + esc(c.name || '未命名角色') + '</button>';
    });
    box.innerHTML = html;
  }

  function renderColorPicker() {
    var box = $('book-color-picker');
    if (!box) return;
    box.innerHTML = PALETTE.map(function (c) {
      return '<button class="wb-color-dot ' + (c === colorDraft ? 'active' : '') + '" style="background:' + c + '" onclick="selectBookColor(\'' + c + '\')" aria-label="' + c + '"></button>';
    }).join('');
  }

  function toggleRecipient(id) {
    if (id === ALL) {
      recipientDraft = [ALL];
    } else {
      recipientDraft = recipientDraft.filter(function (x) { return x !== ALL; });
      var idx = recipientDraft.indexOf(id);
      if (idx === -1) recipientDraft.push(id);
      else recipientDraft.splice(idx, 1);
      if (!recipientDraft.length) recipientDraft = [ALL];
    }
    renderRecipientPicker();
  }

  function selectBookColor(c) {
    colorDraft = c;
    renderColorPicker();
  }

  function openCreateBookModal() {
    editingBookId = '';
    var modal = $('modal-world-book');
    if (!modal) return;
    var title = $('modal-world-book-title');
    if (title) title.textContent = '新建一本书';
    ['input-book-title', 'input-book-desc', 'input-book-note', 'input-book-initial-entry'].forEach(function (id) {
      var el = $(id); if (el) el.value = '';
    });
    recipientDraft = [ALL];
    colorDraft = PALETTE[books.length % PALETTE.length];
    renderRecipientPicker();
    renderColorPicker();
    var init = $('group-initial-entry');
    if (init) init.style.display = 'block';
    modal.style.display = 'flex';
  }

  function openEditBookModal(id) {
    var b = findBook(id);
    if (!b) return;
    editingBookId = id;
    var modal = $('modal-world-book');
    if (!modal) return;
    var title = $('modal-world-book-title');
    if (title) title.textContent = '修改这本书';
    var bt = $('input-book-title'); if (bt) bt.value = b.title || '';
    var bd = $('input-book-desc'); if (bd) bd.value = b.desc || '';
    var bn = $('input-book-note'); if (bn) bn.value = b.note || '';
    recipientDraft = isGlobal(b) ? [ALL] : recipientIds(b).slice();
    if (!recipientDraft.length) recipientDraft = [ALL];
    colorDraft = b.color || PALETTE[0];
    renderRecipientPicker();
    renderColorPicker();
    var init = $('group-initial-entry');
    if (init) init.style.display = 'none';
    modal.style.display = 'flex';
  }

  function closeCreateBookModal() {
    var modal = $('modal-world-book');
    if (modal) modal.style.display = 'none';
  }

  function saveCreateBook() {
    var title = ($('input-book-title') && $('input-book-title').value || '').trim();
    if (!title) { toast('先给这本书起个名字'); return; }
    var desc = ($('input-book-desc') && $('input-book-desc').value || '').trim();
    var note = ($('input-book-note') && $('input-book-note').value || '').trim();
    var initial = ($('input-book-initial-entry') && $('input-book-initial-entry').value || '').trim();
    var recipients = recipientDraft.slice();
    if (!recipients.length) recipients = [ALL];
    var now = Date.now();

    if (editingBookId) {
      var b = findBook(editingBookId);
      if (!b) return;
      b.title = title;
      b.desc = desc;
      b.note = note;
      b.recipients = recipients;
      b.color = colorDraft;
      b.updatedAt = now;
      closeCreateBookModal();
      saveBooks();
      if (currentBookId === b.id) renderBookDetail(b);
      renderWorldBookshelf();
      toast('这本已经改好');
      return;
    }

    var book = normalizeBook({
      id: 'book_' + now + Math.random().toString(36).slice(2, 5),
      title: title,
      desc: desc,
      note: note,
      color: colorDraft,
      recipients: recipients,
      scope: 'all',
      enabled: true,
      updatedAt: now,
      entries: initial ? [{ id: 'entry_' + now + Math.random().toString(36).slice(2, 5), title: initial.slice(0, 18), content: initial, constant: true }] : []
    }, books.length);
    books.push(book);
    saveBooks();
    closeCreateBookModal();
    renderWorldBookshelf();
    openBookDetail(book.id);
    toast('已放进书箱');
  }

  function deleteBook(id) {
    var b = findBook(id);
    if (!b) return;
    if (!window.confirm('删除《' + b.title + '》？里面的词条也会一起删掉。')) return;
    books = books.filter(function (x) { return x.id !== id; });
    saveBooks();
    if (currentBookId === id) backToBookshelf();
    else renderWorldBookshelf();
  }

  function deleteCurrentBook() {
    if (!currentBookId) {
      toast('先打开一本书');
      return;
    }
    deleteBook(currentBookId);
  }

  // ---------- 条目 ----------
  function openCreateEntryModal() {
    if (!currentBookId) { toast('先打开一本书'); return; }
    editingEntryId = '';
    var modal = $('modal-world-entry');
    if (!modal) return;
    var title = $('modal-world-entry-title');
    if (title) title.textContent = '添加一条';
    ['input-entry-title', 'input-entry-keywords', 'input-entry-content'].forEach(function (id) {
      var el = $(id); if (el) el.value = '';
    });
    var constant = $('input-entry-constant'); if (constant) constant.checked = false;
    var priv = $('input-entry-private'); if (priv) priv.checked = false;
    modal.style.display = 'flex';
  }

  function openEditEntryModal(id) {
    var b = findBook(currentBookId);
    if (!b) return;
    var e = (b.entries || []).filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    editingEntryId = id;
    var modal = $('modal-world-entry');
    if (!modal) return;
    var title = $('modal-world-entry-title');
    if (title) title.textContent = '修改这条';
    var et = $('input-entry-title'); if (et) et.value = e.title || '';
    var ek = $('input-entry-keywords'); if (ek) ek.value = (e.keywords || []).join(', ');
    var ec = $('input-entry-content'); if (ec) ec.value = e.content || '';
    var constant = $('input-entry-constant'); if (constant) constant.checked = !!e.constant;
    var priv = $('input-entry-private'); if (priv) priv.checked = !!e.private;
    modal.style.display = 'flex';
  }

  function closeCreateEntryModal() {
    var modal = $('modal-world-entry');
    if (modal) modal.style.display = 'none';
  }

  function saveCreateEntry() {
    var b = findBook(currentBookId);
    if (!b) return;
    var title = ($('input-entry-title') && $('input-entry-title').value || '').trim();
    var content = ($('input-entry-content') && $('input-entry-content').value || '').trim();
    var keywords = normKeywords($('input-entry-keywords') && $('input-entry-keywords').value || '');
    var constant = !!($('input-entry-constant') && $('input-entry-constant').checked);
    var priv = !!($('input-entry-private') && $('input-entry-private').checked);
    if (!title) { toast('给这条起个名字'); return; }
    if (!content) { toast('正文还没写'); return; }

    var now = Date.now();
    if (editingEntryId) {
      var e = (b.entries || []).filter(function (x) { return x.id === editingEntryId; })[0];
      if (!e) return;
      e.title = title;
      e.content = content;
      e.keywords = keywords;
      e.constant = constant;
      e.private = priv;
    } else {
      b.entries = b.entries || [];
      b.entries.push({
        id: 'entry_' + now + Math.random().toString(36).slice(2, 5),
        title: title,
        content: content,
        keywords: keywords,
        constant: constant,
        private: priv,
        enabled: true,
        createdAt: now
      });
    }
    b.updatedAt = now;
    closeCreateEntryModal();
    saveBooks();
    renderBookDetail(b);
    renderWorldBookshelf();
    toast('这条已放进《' + b.title + '》');
  }

  function deleteEntry(id) {
    var b = findBook(currentBookId);
    if (!b) return;
    var e = (b.entries || []).filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    if (!window.confirm('删除“' + e.title + '”？')) return;
    b.entries = (b.entries || []).filter(function (x) { return x.id !== id; });
    b.updatedAt = Date.now();
    saveBooks();
    renderBookDetail(b);
    renderWorldBookshelf();
  }

  function toggleBookEnabled(id) {
    var b = findBook(id);
    if (!b) return;
    b.enabled = b.enabled === false;
    b.updatedAt = Date.now();
    saveBooks();
    if (currentBookId === id) renderBookDetail(b);
    renderWorldBookshelf();
  }

  // ---------- 注入：按书选、按条触发 ----------
  function modeAllowsBook(b, mode) {
    if (!b || b.enabled === false) return false;
    if (mode === 'group' && b.scope === 'single') return false;
    if (mode !== 'group' && b.scope === 'group') return false;
    return true;
  }

  function recipientsMatch(b, ids) {
    if (isGlobal(b)) return true;
    if (!ids || !ids.length) return false;
    return recipientIds(b).some(function (id) { return ids.indexOf(id) !== -1; });
  }

  function keywordHit(keys, text) {
    if (!keys || !keys.length) return true;
    var low = String(text || '').toLowerCase();
    if (!low) return false;
    return keys.some(function (k) {
      var kk = String(k || '').toLowerCase().trim();
      return kk && low.indexOf(kk) !== -1;
    });
  }

  function buildText(opts) {
    opts = opts || {};
    var mode = opts.mode || 'single';
    var ids = opts.charIds || [];
    var text = opts.text || '';
    var out = [];
    var seen = 0;

    var list = books.slice().sort(function (a, b) {
      var ga = isGlobal(a) ? 1 : 0;
      var gb = isGlobal(b) ? 1 : 0;
      if (ga !== gb) return ga - gb; // 角色书优先，预算不足先砍全局
      return (a.updatedAt || 0) - (b.updatedAt || 0);
    });

    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!modeAllowsBook(b, mode)) continue;
      if (!recipientsMatch(b, ids)) continue;
      if (typeof opts.bookFilter === 'function' && !opts.bookFilter(b)) continue;
      var entries = b.entries || [];
      // 常驻优先
      entries = entries.slice().sort(function (a, c) { return (c.constant ? 1 : 0) - (a.constant ? 1 : 0); });
      for (var j = 0; j < entries.length; j++) {
        var e = entries[j];
        if (e.enabled === false) continue;
        if (e.private && mode === 'group') continue;
        if (typeof opts.entryFilter === 'function' && !opts.entryFilter(b, e)) continue;
        var line = '[' + b.title + ' · ' + e.title + ']: ' + (e.content || '');
        if (seen + line.length > MAX_WORLD_CHARS) {
          out.push('（世界书超过 3 万字，后面的条目已省略；可在世界书里关掉不需要的条目）');
          return out.length ? '【世界书 · 全量】\n' + out.join('\n') : '';
        }
        out.push(line);
        seen += line.length + 1;
      }
    }
    return out.length ? '【世界书 · 全量】\n' + out.join('\n') : '';
  }

  // 兼容旧地方读扁平数组：把老 worldEntries 映射成一本合成书，别让剧场突然空白
  function legacyFlatText() {
    var legacy = app().worldEntries || [];
    if (!legacy.length) return '';
    return '【世界书 · 旧版条目】\n' + legacy.map(function (e) {
      return '[' + (e.title || '旧条目') + ']: ' + (e.content || '');
    }).join('\n');
  }

  // ---------- 导入：兼容本 App / SillyTavern / 角色卡 character_book ----------
  function importId(prefix) {
    return prefix + Date.now() + Math.random().toString(36).slice(2, 5);
  }

  function importFileName(fileName) {
    var s = String(fileName || '').replace(/^.*[\\\/]/, '').replace(/\.(json|json5|txt|md|docx)$/i, '').trim();
    return s || '导入世界书';
  }

  function isEntryObject(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x);
  }

  function looksLikeBook(x) {
    return isEntryObject(x) && (Array.isArray(x.entries) || isEntryObject(x.entries) || x.character_book || x.worldBook);
  }

  function importKeywords(entry) {
    var keys = [];
    var primary = entry.keywords || entry.keys || entry.key || entry.keywordsArray || entry.triggers || '';
    var secondary = entry.keysecondary || entry.keySecondary || entry.secondary_keys || entry.secondaryKeys || '';
    keys = keys.concat(normKeywords(primary));
    if (entry.selective !== false) keys = keys.concat(normKeywords(secondary));
    var seen = {};
    return keys.filter(function (k) {
      var low = String(k || '').toLowerCase();
      if (!low || seen[low]) return false;
      seen[low] = true;
      return true;
    });
  }

  function importEntry(entry, index) {
    if (!isEntryObject(entry)) return null;
    var content = entry.content != null ? entry.content : (entry.text != null ? entry.text : (entry.value != null ? entry.value : ''));
    content = String(content || '').trim();
    if (!content) return null;
    var keys = importKeywords(entry);
    var title = String(entry.title || entry.comment || entry.name || (keys[0] || ('条目 ' + (index + 1)))).trim();
    if (!title) title = '条目 ' + (index + 1);
    var constant = entry.constant === true || entry.always === true || entry.force === true;
    if (!keys.length) constant = true;
    var enabled = entry.enabled !== false && entry.disable !== true && entry.disabled !== true;
    return normalizeEntry({
      id: importId('entry_'),
      title: title.slice(0, 60),
      content: content,
      keywords: keys,
      constant: constant,
      private: entry.private === true,
      enabled: enabled,
      createdAt: Date.now()
    });
  }

  function receiverIdsForImport(raw) {
    if (!Array.isArray(raw.recipients) || !raw.recipients.length) return [ALL];
    var valid = {};
    chars().forEach(function (c) { valid[c.id] = true; });
    var kept = raw.recipients.filter(function (id) {
      return id === ALL || valid[id];
    });
    if (!kept.length) return [ALL];
    return kept.indexOf(ALL) !== -1 ? [ALL] : kept;
  }

  function importBook(raw, index, fileName, total) {
    if (!isEntryObject(raw)) return null;
    var rawEntries = raw.entries;
    if (isEntryObject(rawEntries)) {
      rawEntries = Object.keys(rawEntries).map(function (k) { return rawEntries[k]; });
    }
    if (!Array.isArray(rawEntries)) rawEntries = [];
    var entries = rawEntries.map(importEntry).filter(Boolean);

    var title = String(raw.title || raw.name || raw.bookName || raw.book_name || '').trim();
    if (!title) title = importFileName(fileName) + (total > 1 ? ' ' + (index + 1) : '');
    var desc = String(raw.desc || raw.description || raw.summary || '从外部世界书导入').trim();
    var scope = raw.scope === 'single' || raw.scope === 'group' ? raw.scope : 'all';
    var color = /^#[0-9a-f]{6}$/i.test(String(raw.color || '')) ? raw.color : PALETTE[(books.length + index) % PALETTE.length];

    return normalizeBook({
      id: importId('book_'),
      title: title.slice(0, 40),
      desc: desc.slice(0, 200),
      color: color,
      scope: scope,
      note: '导入自 ' + fileName,
      enabled: raw.enabled !== false,
      recipients: receiverIdsForImport(raw),
      updatedAt: Date.now(),
      entries: entries
    }, books.length + index);
  }

  function unwrapImport(raw, fileName) {
    if (Array.isArray(raw)) {
      if (!raw.length) return [];
      if (raw.every(looksLikeBook)) return raw;
      return [{ title: importFileName(fileName), entries: raw }];
    }
    if (!isEntryObject(raw)) return [];
    if (raw.data && raw.data.character_book) {
      var cb = raw.data.character_book;
      if (!isEntryObject(cb)) return [];
      if (!cb.title) cb.title = raw.data.name || raw.data.character_name || importFileName(fileName);
      return [cb];
    }
    if (raw.character_book) {
      var cb2 = raw.character_book;
      if (!isEntryObject(cb2)) return [];
      if (!cb2.title) cb2.title = cb2.name || importFileName(fileName);
      return [cb2];
    }
    if (raw.worldBook && isEntryObject(raw.worldBook)) return [raw.worldBook];
    if (raw.world_book && isEntryObject(raw.world_book)) return [raw.world_book];
    if (raw.book && isEntryObject(raw.book)) return [raw.book];
    if (Array.isArray(raw.worldBooks)) return raw.worldBooks;
    if (Array.isArray(raw.worldbooks)) return raw.worldbooks;
    if (Array.isArray(raw.world_books)) return raw.world_books;
    if (Array.isArray(raw.books)) return raw.books;
    if (raw.world_info && isEntryObject(raw.world_info)) return [raw.world_info];
    if (raw.worldInfo && isEntryObject(raw.worldInfo)) return [raw.worldInfo];
    if (raw.entries) {
      if (Array.isArray(raw.entries) && raw.entries.length && raw.entries.every(looksLikeBook)) return raw.entries;
      return [raw];
    }
    if (raw.key || raw.keys || raw.keywords || raw.content || raw.text) return [{ title: importFileName(fileName), entries: [raw] }];
    return [];
  }

  function parseWorldBookText(text, fileName) {
    var clean = String(text || '').replace(/^\uFEFF/, '');
    var raw;
    try {
      raw = JSON.parse(clean);
    } catch (e) {
      if (!/^\s*[\{\[]/.test(clean)) {
        return parsePlainDocWorldBook(clean, fileName);
      }
      throw e;
    }
    var list = unwrapImport(raw, fileName || '导入世界书');
    var out = list.map(function (b, i) {
      return importBook(b, i, fileName || '导入世界书', list.length);
    }).filter(function (b) { return b && b.entries && b.entries.length; });
    if (!out.length) throw new Error('没认出这本书的条目。世界书需要 entries / worldBooks；如果是 .nuopreset 或带 blocks / prompts 的聊天预设，请去「聊天设定 → 提示词预设」导入');
    return out;
  }

  // ---------- Word 文档（.docx）读取：标题 / 表格 / 关键词行 / 空行分条 ----------
  function docxLocalName(node) {
    return String((node && (node.localName || node.nodeName)) || '').replace(/^.*:/, '').toLowerCase();
  }

  function docxParagraphText(p) {
    var out = '';
    (function walk(node) {
      if (!node) return;
      for (var i = 0; i < node.childNodes.length; i++) {
        var ch = node.childNodes[i];
        if (ch.nodeType !== 1) continue;
        var name = docxLocalName(ch);
        if (name === 't') out += ch.textContent || '';
        else if (name === 'tab') out += '\t';
        else if (name === 'br' || name === 'cr') out += '\n';
        else if (name !== 'ppr' && name !== 'rpr' && name !== 'deltext') walk(ch);
      }
    })(p);
    return out.replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function docxParagraphLevel(p) {
    var pPr = p.getElementsByTagName('w:pPr')[0];
    if (!pPr) return 0;
    var style = pPr.getElementsByTagName('w:pStyle')[0];
    var val = style ? String(style.getAttribute('w:val') || style.getAttribute('val') || '') : '';
    var levelMatch = val.match(/(?:heading|标题|head)(?:\s|_)*([1-6])/i) || val.match(/^([1-6])$/);
    if (levelMatch) return parseInt(levelMatch[1], 10);
    if (/^(title|标题)$/i.test(val)) return 1;
    var outline = pPr.getElementsByTagName('w:outlineLvl')[0];
    var outlineVal = outline ? parseInt(outline.getAttribute('w:val') || outline.getAttribute('val'), 10) : NaN;
    if (!isNaN(outlineVal) && outlineVal >= 0 && outlineVal < 6) return outlineVal + 1;
    return 0;
  }

  function docxTableRows(tbl) {
    var rows = [];
    var trs = tbl.getElementsByTagName('w:tr');
    for (var i = 0; i < trs.length; i++) {
      var cells = [];
      var tcs = trs[i].getElementsByTagName('w:tc');
      for (var j = 0; j < tcs.length; j++) {
        var texts = [];
        var ps = tcs[j].getElementsByTagName('w:p');
        for (var k = 0; k < ps.length; k++) {
          var t = docxParagraphText(ps[k]);
          if (t) texts.push(t);
        }
        cells.push(texts.join('\n').trim());
      }
      rows.push(cells);
    }
    return rows;
  }

  function docxXmlToBlocks(xml) {
    var dom = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
    if (dom.getElementsByTagName('parsererror')[0]) throw new Error('Word 文档结构读不出来');
    var body = dom.getElementsByTagName('w:body')[0] || dom.documentElement;
    var blocks = [];
    for (var i = 0; i < body.childNodes.length; i++) {
      var node = body.childNodes[i];
      if (!node || node.nodeType !== 1) continue;
      var name = docxLocalName(node);
      if (name === 'p') {
        var text = docxParagraphText(node);
        if (text) blocks.push({ type: 'p', text: text, level: docxParagraphLevel(node) });
        else blocks.push({ type: 'blank' });
      } else if (name === 'tbl') {
        var rows = docxTableRows(node);
        if (rows.length) blocks.push({ type: 'table', rows: rows });
      }
    }
    return blocks;
  }

  function cleanDocxTitle(text) {
    return String(text || '')
      .replace(/^#+\s*/, '')
      .replace(/^【\s*/, '')
      .replace(/】\s*$/, '')
      .replace(/[《》]/g, '')
      .replace(/^\s*\d+\s*[.、．]\s*/, '')
      .trim();
  }

  function splitDocxKeys(text) {
    var raw = String(text || '').replace(/^(?:关键词|关键字|触发词|键词|keys?|triggers?)\s*[:：]\s*/i, '');
    return raw.split(/[\n,，、;；|]+/).map(function (s) {
      return s.trim().replace(/^[-*·\s]+|[-*·\s]+$/g, '').replace(/^["“”']+|["“”']+$/g, '');
    }).filter(function (s) { return s && s.length <= 40; });
  }

  function docxTitleLine(text) {
    var t = String(text || '').trim();
    var m = t.match(/^【\s*([^】]{1,60})\s*】$/);
    if (m) return cleanDocxTitle(m[1]);
    m = t.match(/^(?:标题|条目|词条|条目名|名称|人物名|地名|组织名|物品名|事件名)\s*[:：]\s*(\S.{0,79})$/);
    if (m) return cleanDocxTitle(m[1]);
    m = t.match(/^第[一二三四五六七八九十百\d]+[条章]\s*[:：、]\s*(\S.{0,79})$/);
    if (m) return cleanDocxTitle(m[1]);
    return '';
  }

  function docxBookTitle(blocks, fileName) {
    var explicitTitle = '';
    var h1Texts = [];
    var h2Count = 0;
    blocks.forEach(function (b) {
      if (b.type !== 'p') return;
      var text = String(b.text || '').trim();
      if (!text) return;
      var m = text.match(/^(?:世界书|书名|世界书名|book)\s*[:：]\s*(.+)$/i);
      if (m && !explicitTitle) explicitTitle = cleanDocxTitle(m[1]);
      if (b.level === 1) h1Texts.push(cleanDocxTitle(text));
      if (b.level >= 2) h2Count++;
    });
    if (explicitTitle) return explicitTitle.slice(0, 40);
    if (h1Texts.length && h2Count > 0) return h1Texts[0].slice(0, 40);
    return importFileName(fileName);
  }

  function docxEntriesFromTables(blocks) {
    var entries = [];
    blocks.forEach(function (block) {
      if (block.type !== 'table') return;
      var rows = block.rows.filter(function (row) {
        return row && row.some(function (cell) { return String(cell || '').trim(); });
      });
      if (!rows.length) return;
      var header = rows[0].map(function (cell) {
        return String(cell || '').replace(/\s+/g, '').toLowerCase();
      });
      var titleIdx = -1, keyIdx = -1, contentIdx = -1;
      header.forEach(function (cell, i) {
        if (contentIdx < 0 && /内容|正文|描述|设定|解释|content|text|description|setting/.test(cell)) contentIdx = i;
        else if (keyIdx < 0 && /关键词|关键字|触发词|键词|key|trigger/.test(cell)) keyIdx = i;
        else if (titleIdx < 0 && /标题|名称|词条|条目|title|name/.test(cell)) titleIdx = i;
      });
      var hasHeader = contentIdx >= 0 && (titleIdx >= 0 || keyIdx >= 0);
      if (!hasHeader) {
        if (rows[0].length >= 3) { titleIdx = 0; keyIdx = 1; contentIdx = 2; }
        else if (rows[0].length === 2) { titleIdx = 0; contentIdx = 1; }
        else return;
      }
      for (var i = hasHeader ? 1 : 0; i < rows.length; i++) {
        var row = rows[i] || [];
        var title = titleIdx >= 0 ? String(row[titleIdx] || '') : '';
        var keys = keyIdx >= 0 ? splitDocxKeys(row[keyIdx] || '') : [];
        var content = contentIdx >= 0 ? String(row[contentIdx] || '') : '';
        if (!content.trim()) {
          var rest = [];
          for (var j = 0; j < row.length; j++) {
            if (j !== titleIdx && j !== keyIdx) rest.push(row[j]);
          }
          content = rest.join('\n');
        }
        content = content.trim();
        if (!content) continue;
        title = cleanDocxTitle(title);
        if (!title || /^\d+$/.test(title)) {
          title = cleanDocxTitle(content.split('\n')[0]).slice(0, 40) || ('条目 ' + (entries.length + 1));
        }
        entries.push({
          title: title.slice(0, 60),
          keywords: keys,
          content: content,
          constant: keys.length ? false : true
        });
      }
    });
    return entries;
  }

  function docxEntriesFromParagraphs(blocks, bookTitle) {
    var entries = [];
    var current = null;
    var pendingTitle = '';
    function flush() {
      if (!current) return;
      var content = current.lines.join('\n').trim();
      if (content) {
        entries.push({
          title: (current.title || content.split('\n')[0]).slice(0, 60),
          keywords: current.keys,
          content: content
        });
      }
      current = null;
    }
    blocks.forEach(function (b) {
      if (b.type !== 'p') return;
      var text = String(b.text || '').trim();
      if (!text) return;
      var level = b.level || 0;
      if (level > 0) {
        var heading = cleanDocxTitle(text);
        if (!heading) return;
        if (level === 1 && bookTitle && !current && !entries.length &&
            heading === cleanDocxTitle(bookTitle)) return;
        flush();
        pendingTitle = '';
        current = { title: heading, keys: [], lines: [] };
        return;
      }
      if (!current && /^(?:世界书|书名|世界书名|book)\s*[:：]/i.test(text)) return;
      var titleLine = docxTitleLine(text);
      if (titleLine) {
        flush();
        pendingTitle = '';
        current = { title: titleLine, keys: [], lines: [] };
        return;
      }
      var keyMatch = text.match(/^(?:关键词|关键字|触发词|键词|keys?|triggers?)\s*[:：]\s*(.+)$/i);
      if (keyMatch) {
        if (!current && pendingTitle) {
          current = { title: pendingTitle, keys: [], lines: [] };
          pendingTitle = '';
        }
        if (current) current.keys = splitDocxKeys(keyMatch[1]);
        return;
      }
      var contentMatch = text.match(/^(?:内容|正文|描述|设定|词条内容|详细设定)\s*[:：]\s*([\s\S]*)$/);
      if (contentMatch) {
        if (!current && pendingTitle) {
          current = { title: pendingTitle, keys: [], lines: [] };
          pendingTitle = '';
        }
        if (current && contentMatch[1].trim()) current.lines.push(contentMatch[1].trim());
        return;
      }
      if (current) {
        current.lines.push(text);
        return;
      }
      // 有些文档不用标题样式，只在一行短名字后面接「关键词 / 内容」。
      if (text.length <= 80 && !/[。！？!?；;]$/.test(text)) pendingTitle = cleanDocxTitle(text);
    });
    flush();
    return entries;
  }

  function docxEntriesFromBlankBlocks(blocks) {
    var groups = [];
    var group = [];
    function flush() {
      if (group.length) { groups.push(group); group = []; }
    }
    blocks.forEach(function (b) {
      if (b.type === 'table' || b.type === 'blank') flush();
      else if (b.type === 'p' && String(b.text || '').trim()) group.push(String(b.text).trim());
    });
    flush();

    var entries = [];
    groups.forEach(function (groupLines) {
      var lines = groupLines.join('\n').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!lines.length) return;
      var title = '';
      var keys = [];
      var contentLines = [];
      lines.forEach(function (line, i) {
        var keyMatch = line.match(/^(?:关键词|关键字|触发词|键词|keys?|triggers?)\s*[:：]\s*(.+)$/i);
        if (keyMatch) { keys = splitDocxKeys(keyMatch[1]); return; }
        var contentMatch = line.match(/^(?:内容|正文|描述|设定|词条内容|详细设定)\s*[:：]\s*([\s\S]*)$/);
        if (contentMatch) { if (contentMatch[1].trim()) contentLines.push(contentMatch[1].trim()); return; }
        if (i === 0 && !title) { title = cleanDocxTitle(line); return; }
        contentLines.push(line);
      });
      if (!contentLines.length) contentLines = [lines[0]];
      if (!title) title = cleanDocxTitle(lines[0]).slice(0, 40);
      var content = contentLines.join('\n').trim();
      if (!content) return;
      entries.push({ title: title.slice(0, 60), keywords: keys, content: content });
    });
    return entries;
  }

  function buildWorldBookFromBlocks(blocks, fileName, desc, label) {
    var bookTitle = docxBookTitle(blocks, fileName);
    var entries = docxEntriesFromParagraphs(blocks, bookTitle);
    var tableEntries = docxEntriesFromTables(blocks);
    // 同一份文档可能既用标题分条、又在后面补表格：两边都收，按标题+正文去重。
    var merged = [];
    var seen = {};
    entries.concat(tableEntries).forEach(function (entry) {
      var key = String(entry.title || '') + '|' + String(entry.content || '').slice(0, 80).replace(/\s+/g, '');
      if (seen[key]) return;
      seen[key] = true;
      merged.push(entry);
    });
    entries = merged;
    if (!entries.length) entries = docxEntriesFromBlankBlocks(blocks);
    if (!entries.length) {
      var all = blocks.filter(function (b) { return b.type === 'p'; })
        .map(function (b) { return b.text; }).join('\n\n').trim();
      if (all) entries = [{ title: bookTitle, keywords: [], content: all }];
    }
    if (!entries.length) throw new Error('这个' + (label || '文档') + '里没认出词条。可以按「标题 / 关键词： / 内容」分条，或用表格分列');
    var book = importBook({
      title: bookTitle,
      desc: desc,
      entries: entries
    }, 0, fileName || '导入世界书', 1);
    if (!book || !book.entries || !book.entries.length) throw new Error('这个' + (label || '文档') + '里没有可用的词条内容');
    return book;
  }

  function parseDocxWorldBook(xml, fileName) {
    return [buildWorldBookFromBlocks(docxXmlToBlocks(xml), fileName, '从 Word 文档导入', 'Word 文档')];
  }

  function plainTextToBlocks(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var blocks = [];
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) { blocks.push({ type: 'blank' }); return; }
      var heading = t.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        blocks.push({ type: 'p', text: heading[2], level: heading[1].length });
      } else {
        blocks.push({ type: 'p', text: t, level: 0 });
      }
    });
    return blocks;
  }

  function parsePlainDocWorldBook(text, fileName) {
    return [buildWorldBookFromBlocks(plainTextToBlocks(text), fileName, '从文本文档导入', '文档')];
  }

  function ensureDocxZip() {
    if (window.JSZip && typeof window.JSZip.loadAsync === 'function') {
      return Promise.resolve(window.JSZip);
    }
    return new Promise(function (resolve, reject) {
      var old = document.getElementById('docx-zip-loader');
      if (old) old.parentNode.removeChild(old);
      var script = document.createElement('script');
      script.id = 'docx-zip-loader';
      script.src = 'js/vendor/jszip.min.js?v=20261126-0046a';
      script.onload = function () {
        if (window.JSZip && typeof window.JSZip.loadAsync === 'function') resolve(window.JSZip);
        else reject(new Error('Word 解析组件没初始化成功'));
      };
      script.onerror = function () { reject(new Error('Word 解析组件加载失败，检查网络后重试')); };
      document.head.appendChild(script);
    });
  }

  function importDocxWorldBook(file, input) {
    toast('正在读取 Word 文档…');
    ensureDocxZip().then(function (JSZip) {
      return JSZip.loadAsync(file);
    }).then(function (zip) {
      var docFile = zip.file('word/document.xml');
      if (!docFile) {
        var found = zip.file(/word\/document\.xml$/i);
        docFile = found && found[0];
      }
      if (!docFile) throw new Error('这个 docx 里没找到正文');
      return docFile.async('string');
    }).then(function (xml) {
      if (String(xml || '').length > 16 * 1024 * 1024) throw new Error('Word 正文太大，先删掉图片或精简一下再导');
      finishWorldBookImport(parseDocxWorldBook(xml, file.name), file, input);
    }).catch(function (e) {
      toast('Word 导入失败：' + ((e && e.message) || '文件读不出来'));
      if (input) input.value = '';
    });
  }

  function finishWorldBookImport(imported, file, input) {
    try {
      if (!imported || !imported.length) throw new Error('没有可导入的词条');
      var total = imported.reduce(function (sum, b) { return sum + ((b.entries && b.entries.length) || 0); }, 0);
      var names = imported.map(function (b) { return '《' + b.title + '》'; }).join('、');
      if (!window.confirm('识别到 ' + imported.length + ' 本世界书：' + names + '\n共 ' + total + ' 条词条。\n\n导入后会追加到你的书箱，收件人默认所有角色，之后可以自己改。')) return;
      loadBooks();
      imported.forEach(function (b) { books.push(b); });
      saveBooks();
      renderWorldBookshelf();
      if (imported.length === 1) openBookDetail(imported[0].id);
      toast('已导入 ' + imported.length + ' 本世界书，共 ' + total + ' 条词条');
    } catch (e) {
      toast('导入失败：' + ((e && e.message) || '文件格式不对'));
    } finally {
      if (input) input.value = '';
    }
  }

  function chatPresetKind(raw) {
    if (!isEntryObject(raw)) return '';
    if (raw.__nuojijiChatPreset === true && Array.isArray(raw.blocks)) return 'nuojiji';
    if (Array.isArray(raw.blocks) && (raw.mode || raw.params || raw.regexRules)) return 'nuojiji';
    if (Array.isArray(raw.prompts)) return 'sillytavern';
    return '';
  }

  function routeChatPresetImport(text, fileName, kind) {
    var label = kind === 'sillytavern' ? '酒馆聊天预设' : '糯叽机聊天预设';
    if (!window.PromptPresets || typeof window.PromptPresets.importText !== 'function') {
      toast('这是' + label + '，不是世界书。去「聊天设定 → 提示词预设 → 导入」就能用');
      return true;
    }
    if (!window.confirm('这个文件是' + label + '，不是世界书。\n\n世界书只认 entries / worldBooks，所以刚才会导入失败。\n\n点「确定」按聊天预设导入到「线上聊天」；点「取消」先不导入。')) return true;
    try {
      var count = window.PromptPresets.importText(text, fileName, 'chat', { skipConfirm: true });
      if (count) toast('已按聊天预设导入 ' + count + ' 套到线上聊天');
    } catch (e) {
      toast('聊天预设导入失败：' + ((e && e.message) || '文件格式不对'));
    }
    return true;
  }

  function openWorldBookImport() {
    var input = $('world-book-import-input');
    if (!input) { toast('导入入口没找到，刷新一下页面'); return; }
    input.click();
  }

  function handleWorldBookImportFile(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    var isDocx = /\.docx$/i.test(file.name) || /wordprocessingml/i.test(String(file.type || ''));
    var maxBytes = (isDocx ? 20 : 8) * 1024 * 1024;
    if (file.size > maxBytes) {
      toast('这个文件超过 ' + (maxBytes / 1024 / 1024) + 'MB，先精简一下再导');
      input.value = '';
      return;
    }
    if (isDocx) {
      importDocxWorldBook(file, input);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result || '');
        var raw = null;
        try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) {}
        var presetKind = chatPresetKind(raw);
        if (presetKind) {
          routeChatPresetImport(text, file.name, presetKind);
          input.value = '';
          return;
        }
        finishWorldBookImport(parseWorldBookText(text, file.name), file, input);
      } catch (e) {
        toast('导入失败：' + ((e && e.message) || '文件格式不对'));
        input.value = '';
      }
    };
    reader.onerror = function () {
      toast('文件读取失败');
      input.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  // ---------- 暴露 ----------
  loadBooks();

  window.WB = {
    books: function () { return books; },
    reload: loadBooks,
    isGlobal: isGlobal,
    recipientIds: recipientIds,
    recipientLabel: recipientLabel,
    recipientNames: recipientNames,
    activeCharId: activeCharId,
    buildText: buildText,
    legacyFlatText: legacyFlatText,
    openBookDetail: openBookDetail,
    render: renderWorldBookshelf,
    parseImportText: parseWorldBookText
  };

  window.renderWorldBookshelf = renderWorldBookshelf;
  window.openBookDetail = openBookDetail;
  window.openWorldBookImport = openWorldBookImport;
  window.handleWorldBookImportFile = handleWorldBookImportFile;
  window.backToBookshelf = backToBookshelf;
  window.openCreateBookModal = openCreateBookModal;
  window.openEditBookModal = openEditBookModal;
  window.closeCreateBookModal = closeCreateBookModal;
  window.saveCreateBook = saveCreateBook;
  window.deleteBook = deleteBook;
  window.deleteCurrentBook = deleteCurrentBook;
  window.openCreateEntryModal = openCreateEntryModal;
  window.openEditEntryModal = openEditEntryModal;
  window.closeCreateEntryModal = closeCreateEntryModal;
  window.saveCreateEntry = saveCreateEntry;
  window.deleteEntry = deleteEntry;
  window.toggleBookEnabled = toggleBookEnabled;
  window.switchBookTab = switchBookTab;
  window.setWorldFilter = setWorldFilter;
  window.setWorldPerson = setWorldPerson;
  window.toggleWorldBookList = toggleWorldBookList;
  window.toggleRecipient = toggleRecipient;
  window.selectBookColor = selectBookColor;
  window.openWorldBoxNameModal = openWorldBoxNameModal;
  window.closeWorldBoxNameModal = closeWorldBoxNameModal;
  window.saveWorldBoxName = saveWorldBoxName;
})();
