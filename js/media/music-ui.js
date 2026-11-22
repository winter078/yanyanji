/* ============================================================
   music-ui.js —— 音乐模块新版布局的交互层
   只负责：四个 tab 切换、一起听播放页开合、底部迷你条、列表渲染、
   我的/角色的唱片墙。播放内核仍然全部由 music.js 负责，不重复实现。
   回滚：删掉 phone.html 对本文件的 <script>，页面只剩骨架、逻辑回旧版。
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TABS = ['home', 'lib', 'search', 'mine'];
  let activeTab = 'home';
  let lastCover = '';
  let lastTitle = '';

  function songs() {
    try { return (window.mzBridge && window.mzBridge.songs()) || []; } catch (e) { return []; }
  }
  function current() {
    try { return window.mzBridge ? window.mzBridge.current() : null; } catch (e) { return null; }
  }
  function isPlaying() {
    try { return !!(window.mzBridge && window.mzBridge.playing()); } catch (e) { return false; }
  }
  /* ---------------- 自定义封面（纯本机存储） ---------------- */
  const COVER_PREFIX = 'mz_cover_';
  const COVER_INDEX = 'mz_cover_index';
  const COVER_BUDGET = 3.2 * 1024 * 1024;   // 自定义封面总占用上限
  const COVER_SIDE = 400;                   // 压到 400×400 jpg

  function coverKey(id) { return COVER_PREFIX + String(id); }

  function customCover(id) {
    if (id === undefined || id === null) return '';
    try { return localStorage.getItem(coverKey(id)) || ''; } catch (e) { return ''; }
  }

  function coverIndex() {
    try { return JSON.parse(localStorage.getItem(COVER_INDEX) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveCoverIndex(o) { try { localStorage.setItem(COVER_INDEX, JSON.stringify(o)); } catch (e) {} }
  function coverTotal(o) {
    return Object.keys(o).reduce(function (n, k) { return n + (o[k].s || 0); }, 0);
  }

  function saveCover(id, dataUrl) {
    const key = String(id);
    const idx = coverIndex();
    idx[key] = { t: Date.now(), s: dataUrl.length };
    let total = coverTotal(idx);
    while (total > COVER_BUDGET) {
      const oldest = Object.keys(idx)
        .filter(function (k) { return k !== key; })
        .sort(function (a, b) { return idx[a].t - idx[b].t; })[0];
      if (!oldest) break;
      try { localStorage.removeItem(coverKey(oldest)); } catch (e) {}
      total -= idx[oldest].s || 0;
      delete idx[oldest];
    }
    try {
      localStorage.setItem(coverKey(key), dataUrl);
    } catch (e) {
      return false;
    }
    saveCoverIndex(idx);
    return true;
  }

  function dropCover(id) {
    const key = String(id);
    const idx = coverIndex();
    try { localStorage.removeItem(coverKey(key)); } catch (e) {}
    if (idx[key]) { delete idx[key]; saveCoverIndex(idx); }
  }

  function fixRowCovers() {
    const list = $('music-playlist-list');
    if (!list) return;
    const rows = list.querySelectorAll('.playlist-song-item');
    for (let i = 0; i < rows.length; i++) {
      const id = rowSongId(rows[i]);
      if (!id) continue;
      const img = rows[i].querySelector('.playlist-song-cover');
      if (!img) continue;
      const want = safeCover(songById(id));
      if (want && img.getAttribute('src') !== want) img.src = want;
    }
  }

  function refreshCovers() {
    lastCover = '';
    syncPlayerView();
    renderHome();
    renderMine();
    injectRowWallButtons();
    fixRowCovers();
  }

  window.mzPickCover = function (ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (!current()) return;
    const inp = $('mz-cover-input');
    if (inp) { inp.value = ''; inp.click(); }
  };

  window.mzOnCoverFile = function (ev) {
    const file = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    const s = current();
    if (!s) return;
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        const cv = document.createElement('canvas');
        cv.width = COVER_SIDE;
        cv.height = COVER_SIDE;
        const ctx = cv.getContext('2d');
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, COVER_SIDE, COVER_SIDE);
        let url = cv.toDataURL('image/jpeg', 0.82);
        if (url.length > 240 * 1024) url = cv.toDataURL('image/jpeg', 0.64);
        if (!saveCover(s.id, url)) {
          alert('本机存储快满了，先在别的歌里恢复几张原封面再试');
          return;
        }
        refreshCovers();
      };
      img.onerror = function () { alert('这张图片读不出来，换一张试试'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  window.mzResetCover = function () {
    const s = current();
    if (!s) return;
    dropCover(s.id);
    refreshCovers();
  };

  function origCover(song) {
    const c = (song && song.cover) || '';
    return c ? String(c).replace(/^http:/, 'https:') : '';
  }

  function safeCover(song) {
    const custom = song ? customCover(song.id) : '';
    return custom || origCover(song);
  }
  // 给别处（小紫书的笔记配乐）复用同一套封面优先级：用户自传 > 歌曲自带 > 空
  window.mzSongCover = safeCover;
  function isVip(song) {
    return !!(song && song.source === 'netease' && song.fee && Number(song.fee) > 0);
  }

  /* ---------------- 子页面切换 ---------------- */
  window.mzTab = function (name) {
    if (!TABS.includes(name)) return;
    activeTab = name;
    TABS.forEach((t) => {
      const page = $('mz-page-' + t);
      const btn = $('mz-tab-' + t);
      if (page) page.classList.toggle('active', t === name);
      if (btn) btn.classList.toggle('active', t === name);
    });
    window.mzClosePlayer();
    if (name === 'home') renderHome();
    if (name === 'mine') renderMine();
    if (name === 'search') renderSearchResults();
  };

  /* ---------------- 一起听播放页 ---------------- */
  window.mzOpenPlayer = function () {
    const p = $('mz-player');
    if (p) p.classList.add('open');
    if (window.refreshMusicUserUI) window.refreshMusicUserUI();
    if (window.refreshMusicCompanionUI) window.refreshMusicCompanionUI();
    bindLyric();
    syncPlayerView();
    if (window.MzLyrics) window.MzLyrics.refresh();
  };
  /* ---------------- 一起听：歌词两行 ---------------- */
  let lyricBound = false;

  function renderLyric(pair) {
    const box = $('music-lyric-box');
    const cur = $('music-lyric-cur');
    const next = $('music-lyric-next');
    if (!box || !cur || !next) return;
    const a = (pair && pair[0]) || '';
    const b = (pair && pair[1]) || '';
    // 取不到歌词（纯音乐 / 还没返回 / 没有网易云 id）就整块淡出，不要弹"暂无歌词"去打扰
    if (!a && !b) {
      box.classList.remove('show');
      if (cur.textContent) cur.textContent = '';
      if (next.textContent) next.textContent = '';
      return;
    }
    if (cur.textContent !== a) cur.textContent = a;
    if (next.textContent !== b) next.textContent = b;
    box.classList.add('show');
  }

  function bindLyric() {
    if (lyricBound) return;
    if (typeof window.MzLyrics === 'undefined') return;
    lyricBound = true;
    window.MzLyrics.onUpdate(function (st, pair) { renderLyric(pair); });
    renderLyric(window.MzLyrics.pair());
  }

  window.mzClosePlayer = function () {
    const p = $('mz-player');
    if (p) p.classList.remove('open');
  };

  function syncPlayerView() {
    const s = current();
    const miniCover = $('mz-mini-cover');
    const miniTitle = $('mz-mini-title');
    const miniArtist = $('mz-mini-artist');
    const miniPlay = $('mz-mini-play');
    const bg = $('mz-player-bg');
    const headTitle = $('mz-player-head-title');
    const playBtn = $('music-play-btn');

    if (s) {
      const cover = safeCover(s);
      if (miniTitle) miniTitle.textContent = s.title || '未命名';
      if (miniArtist) miniArtist.textContent = s.artist || '';
      if (miniCover && cover && miniCover.getAttribute('data-src') !== cover) {
        miniCover.src = cover;
        miniCover.setAttribute('data-src', cover);
      }
      if (bg && cover && cover !== lastCover) {
        bg.style.backgroundImage = 'url("' + cover + '")';
        lastCover = cover;
      }
      if (headTitle) headTitle.textContent = '一起听';
      if (s.title && s.title !== lastTitle) lastTitle = s.title;

      const diskImg = $('music-disk-cover');
      if (diskImg) {
        const cc = customCover(s.id);
        const nowSrc = diskImg.getAttribute('src') || '';
        if (cc && nowSrc !== cc) diskImg.src = cc;
        else if (!cc && nowSrc.indexOf('data:') === 0) {
          const o = origCover(s);
          if (o) diskImg.src = o;
        }
      }
    } else {
      if (miniTitle) miniTitle.textContent = '还没在听';
      if (miniArtist) miniArtist.textContent = '点一首歌开始';
      if (bg) bg.style.backgroundImage = '';
    }
    if (miniPlay) miniPlay.textContent = isPlaying() ? '⏸' : '▶';
    if (playBtn) playBtn.textContent = isPlaying() ? '⏸' : '▶';
    const editBtn = $('mz-cover-edit');
    if (editBtn) editBtn.style.display = s ? 'flex' : 'none';
    updateWallButtons();
  }

  window.mzMiniToggle = function () {
    const s = current();
    if (!s) { window.mzTab('home'); return; }
    window.togglePlayMusic && window.togglePlayMusic();
    setTimeout(syncPlayerView, 120);
  };

  window.mzPlayRandom = function () {
    const list = songs();
    if (!list.length) { window.mzTab('search'); return; }
    const pick = list[Math.floor(Math.random() * list.length)];
    playSongObj(pick);
  };

  function playSongObj(song) {
    if (!song) return;
    window.mzOpenPlayer();
    try {
      const q = songs();
      window.mzBridge.play(song, q.length ? q : null);
    } catch (e) { console.warn('mz play failed', e); }
    setTimeout(syncPlayerView, 300);
  }

  /* ---------------- 列表渲染 ---------------- */
  function makeRow(song, onClick) {
    const row = document.createElement('button');
    row.className = 'mz-row';
    row.type = 'button';

    const cover = document.createElement('div');
    cover.className = 'mz-row-cover';
    const c = safeCover(song);
    if (c) cover.style.backgroundImage = 'url("' + c + '")';

    const txt = document.createElement('div');
    txt.className = 'mz-row-txt';

    const name = document.createElement('div');
    name.className = 'mz-row-name';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = song.title || '未命名';
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    name.appendChild(nameSpan);
    if (isVip(song)) {
      const vip = document.createElement('span');
      vip.className = 'mz-row-vip';
      vip.textContent = '会员';
      name.appendChild(vip);
    }

    const artist = document.createElement('div');
    artist.className = 'mz-row-artist';
    artist.textContent = song.artist || '';

    txt.appendChild(name);
    txt.appendChild(artist);

    const play = document.createElement('span');
    play.className = 'mz-row-play';
    play.textContent = '▶';

    row.appendChild(cover);
    row.appendChild(txt);
    row.appendChild(play);

    row.addEventListener('click', function () { onClick(song); });
    return row;
  }

  function makeTile(song, onClick) {
    const tile = document.createElement('button');
    tile.className = 'mz-tile';
    tile.type = 'button';

    const cover = document.createElement('div');
    cover.className = 'mz-tile-cover';
    const c = safeCover(song);
    if (c) cover.style.backgroundImage = 'url("' + c + '")';
    if (isVip(song)) {
      const b = document.createElement('span');
      b.className = 'mz-tile-badge';
      b.textContent = '会员';
      cover.appendChild(b);
    }

    const name = document.createElement('div');
    name.className = 'mz-tile-name';
    name.textContent = song.title || '未命名';

    const artist = document.createElement('div');
    artist.className = 'mz-tile-artist';
    artist.textContent = song.artist || '';

    tile.appendChild(cover);
    tile.appendChild(name);
    tile.appendChild(artist);
    tile.addEventListener('click', function () { onClick(song); });
    return tile;
  }

  function fillEmpty(el, text) {
    if (!el) return;
    el.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'mz-empty';
    p.textContent = text;
    el.appendChild(p);
  }

  function renderHome() {
    const list = songs();

    const cardCover1 = $('mz-card-cover-1');
    const cardCover2 = $('mz-card-cover-2');
    if (cardCover1) {
      const c1 = safeCover(list[0]);
      cardCover1.style.backgroundImage = c1 ? 'url("' + c1 + '")' : '';
    }
    if (cardCover2) {
      const c2 = safeCover(list[1] || list[0]);
      cardCover2.style.backgroundImage = c2 ? 'url("' + c2 + '")' : '';
    }

    const recent = $('mz-home-recent');
    if (recent) {
      recent.innerHTML = '';
      if (!list.length) {
        fillEmpty(recent, '曲库还是空的，去搜索一首吧');
      } else {
        list.slice(0, 10).forEach(function (s) {
          recent.appendChild(makeTile(s, playSongObj));
        });
      }
    }

    const listEl = $('mz-home-songs');
    if (listEl) {
      listEl.innerHTML = '';
      if (!list.length) {
        fillEmpty(listEl, '这里会显示你的歌曲');
      } else {
        list.slice(0, 20).forEach(function (s) {
          listEl.appendChild(makeRow(s, playSongObj));
        });
      }
    }
  }

  function renderSearchResults() {
    const el = $('mz-search-results');
    if (!el) return;
    const list = songs().filter(function (s) { return s.source === 'netease' || s.source === 'bili'; });
    el.innerHTML = '';
    if (!list.length) {
      fillEmpty(el, '还没有搜索结果，输入歌名点搜索');
      return;
    }
    list.slice(0, 10).forEach(function (s) {
      el.appendChild(makeRow(s, playSongObj));
    });
  }

  /* ---------------- 我的 / 角色的 ---------------- */
  let shelfOwner = 'user';

  const WALL_KEY = { user: 'mz_shelf_user', bot: 'mz_shelf_bot' };

  function wallIds(owner) {
    try {
      const raw = localStorage.getItem(WALL_KEY[owner]);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch (e) { return []; }
  }
  function saveWall(owner, ids) {
    try { localStorage.setItem(WALL_KEY[owner], JSON.stringify(ids.slice(0, 90))); } catch (e) {}
  }

  function wallText(owner, on) {
    if (owner === 'user') return on ? '已在我的唱片墙 · 点此取下' : '摆到我的唱片墙';
    return on ? '已在角色唱片墙 · 点此取下' : '摆到角色的唱片墙';
  }

  function updateWallButtons() {
    const s = current();
    ['user', 'bot'].forEach(function (owner) {
      const b = $('mz-wall-' + owner);
      if (!b) return;
      const on = !!(s && wallIds(owner).indexOf(String(s.id)) >= 0);
      const txt = wallText(owner, on);
      if (b.textContent !== txt) b.textContent = txt;
      b.classList.toggle('on', on);
    });
  }

  window.mzShelfToggle = function (owner) {
    const s = current();
    if (!s) { window.mzTab('search'); return; }
    const ids = wallIds(owner);
    const key = String(s.id);
    const i = ids.indexOf(key);
    if (i >= 0) ids.splice(i, 1);
    else ids.unshift(key);
    saveWall(owner, ids);
    shelfOwner = owner;
    renderMine();
    updateWallButtons();
  };

  function renderWall(owner) {
    const wrap = $(owner === 'user' ? 'mz-shelf-user' : 'mz-shelf-bot');
    if (!wrap) return;
    wrap.innerHTML = '';
    const list = songs();
    const picked = wallIds(owner)
      .map(function (id) { return list.find(function (s) { return String(s.id) === id; }); })
      .filter(Boolean);

    if (!picked.length) {
      fillEmpty(wrap, owner === 'user'
        ? '还没有唱片。播放页右上角 ⋯ → “摆到我的唱片墙”'
        : '角色的唱片墙空着。播放页 ⋯ → “摆到角色的唱片墙”');
      return;
    }
    for (let i = 0; i < picked.length; i += 3) {
      const row = document.createElement('div');
      row.className = 'mz-shelf';
      picked.slice(i, i + 3).forEach(function (s) {
        const d = document.createElement('div');
        d.className = 'mz-disc';
        const c = safeCover(s);
        if (c) d.style.backgroundImage = 'url("' + c + '")';
        row.appendChild(d);
      });
      wrap.appendChild(row);
    }
  }

  window.mzSwitchShelf = function (owner) {
    shelfOwner = owner === 'bot' ? 'bot' : 'user';
    const u = $('mz-shelf-user');
    const b = $('mz-shelf-bot');
    const bu = $('mz-seg-user');
    const bb = $('mz-seg-bot');
    if (u) u.style.display = shelfOwner === 'user' ? 'flex' : 'none';
    if (b) b.style.display = shelfOwner === 'bot' ? 'flex' : 'none';
    if (bu) bu.classList.toggle('active', shelfOwner === 'user');
    if (bb) bb.classList.toggle('active', shelfOwner === 'bot');
  };

  /* ---------------- 资料库：行内“摆到唱片墙” ---------------- */
  let pickSongId = null;

  function rowSongId(row) {
    const oc = row.getAttribute('onclick') || '';
    const m = oc.match(/playSongById\('([^']+)'\)/);
    return m ? m[1] : null;
  }

  function songById(id) {
    return songs().find(function (s) { return String(s.id) === String(id); }) || null;
  }

  function onAnyWall(id) {
    return wallIds('user').indexOf(String(id)) >= 0 || wallIds('bot').indexOf(String(id)) >= 0;
  }

  function injectRowWallButtons() {
    const list = $('music-playlist-list');
    if (!list) return;
    const rows = list.querySelectorAll('.playlist-song-item');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const id = rowSongId(row);
      if (!id) continue;
      const acts = row.querySelector('.playlist-song-actions');
      if (!acts) continue;
      let btn = acts.querySelector('.mz-row-wall');
      if (!btn) {
        btn = document.createElement('button');
        btn.className = 'song-action-btn mz-row-wall';
        btn.title = '摆到唱片墙';
        btn.textContent = '💿';
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          window.mzOpenWallPicker(id);
        });
        acts.insertBefore(btn, acts.firstChild);
      }
      btn.classList.toggle('on', onAnyWall(id));
      btn.title = onAnyWall(id) ? '已上墙，点击可取下' : '摆到唱片墙';
    }
    fixRowCovers();
  }

  function refreshPickLabels() {
    ['user', 'bot'].forEach(function (o) {
      const b = $('mz-pick-' + o);
      if (!b) return;
      const on = pickSongId ? wallIds(o).indexOf(pickSongId) >= 0 : false;
      const base = o === 'user' ? '我的唱片墙' : '角色的唱片墙';
      const txt = base + (on ? ' · 已上墙，点此取下' : ' · 点此摆上');
      if (b.textContent !== txt) b.textContent = txt;
      b.classList.toggle('on', on);
    });
  }

  window.mzOpenWallPicker = function (songId) {
    pickSongId = String(songId);
    const s = songById(pickSongId);
    const t = $('mz-wall-picker-title');
    if (t) t.textContent = (s && s.title ? '《' + s.title + '》' : '这首歌') + '，摆到哪面墙？';
    refreshPickLabels();
    const m = $('mz-wall-picker');
    if (m) m.classList.add('open');
  };

  window.mzCloseWallPicker = function () {
    const m = $('mz-wall-picker');
    if (m) m.classList.remove('open');
  };

  window.mzPickWall = function (owner) {
    if (!pickSongId) return;
    const ids = wallIds(owner);
    const i = ids.indexOf(pickSongId);
    if (i >= 0) ids.splice(i, 1);
    else ids.unshift(pickSongId);
    saveWall(owner, ids);
    shelfOwner = owner;
    renderMine();
    refreshPickLabels();
    injectRowWallButtons();
  };

  function watchLibList() {
    injectRowWallButtons();
    const list = $('music-playlist-list');
    if (!list || !window.MutationObserver) return;
    new MutationObserver(function () { injectRowWallButtons(); })
      .observe(list, { childList: true, subtree: true });
  }

  function renderMine() {
    const list = songs();
    const avatar = $('mz-mine-avatar');
    const nameEl = $('mz-mine-name');
    const statEl = $('mz-mine-stat');

    if (avatar && !avatar.getAttribute('data-done')) {
      let src = '';
      try {
        src = (window.appData && (window.appData.heroAvatar || window.appData.userAvatar)) || '';
      } catch (e) {}
      if (!src) {
        try { src = localStorage.getItem('momo_hero_avatar') || ''; } catch (e) {}
      }
      if (src) { avatar.src = src; avatar.setAttribute('data-done', '1'); }
    }
    if (nameEl && (!nameEl.textContent || nameEl.textContent === '我')) {
      let n = '';
      try { n = (window.appData && window.appData.userName) || ''; } catch (e) {}
      if (n) nameEl.textContent = n;
    }
    if (statEl) statEl.textContent = '一起听过 ' + list.length + ' 首';

    renderWall('user');
    renderWall('bot');
    window.mzSwitchShelf(shelfOwner);
  }

  /* ---------------- 更多 sheet ---------------- */
  window.mzOpenMoreSheet = function () {
    const m = $('mz-more-sheet');
    updateWallButtons();
    if (m) m.classList.add('open');
  };
  window.mzCloseMoreSheet = function (ev) {
    const m = $('mz-more-sheet');
    if (!m) return;
    if (ev && ev.target !== m) return;
    m.classList.remove('open');
  };

  /* ---------------- 搜索联动 ---------------- */
  function hookSearch() {
    const orig = window.searchMusicOnline;
    if (typeof orig !== 'function' || orig.__mzWrapped) return;
    const wrapped = function () {
      const r = orig.apply(this, arguments);
      setTimeout(renderSearchResults, 400);
      setTimeout(renderSearchResults, 1500);
      setTimeout(renderSearchResults, 3200);
      setTimeout(function () { renderHome(); syncPlayerView(); }, 3600);
      return r;
    };
    wrapped.__mzWrapped = true;
    window.searchMusicOnline = wrapped;
  }

  /* ---------------- 定时同步（只做显示，不做播放逻辑） ---------------- */
  let tick = 0;
  setInterval(function () {
    tick++;
    syncPlayerView();
    if (tick % 20 === 0) {
      if (activeTab === 'home') renderHome();
      else if (activeTab === 'search') renderSearchResults();
      else if (activeTab === 'mine') renderMine();
    }
  }, 700);

  function boot() {
    hookSearch();
    renderHome();
    renderMine();
    syncPlayerView();
    watchLibList();
    setTimeout(watchLibList, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  } else {
    setTimeout(boot, 500);
  }
})();
