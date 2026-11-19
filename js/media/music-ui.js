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
  function safeCover(song) {
    const c = (song && song.cover) || '';
    return c ? String(c).replace(/^http:/, 'https:') : '';
  }
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
    syncPlayerView();
  };
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
    } else {
      if (miniTitle) miniTitle.textContent = '还没在听';
      if (miniArtist) miniArtist.textContent = '点一首歌开始';
      if (bg) bg.style.backgroundImage = '';
    }
    if (miniPlay) miniPlay.textContent = isPlaying() ? '⏸' : '▶';
    if (playBtn) playBtn.textContent = isPlaying() ? '⏸' : '▶';
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
    const list = songs().filter(function (s) { return s.source === 'netease'; });
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

    const u = $('mz-shelf-user');
    if (u) {
      u.innerHTML = '';
      if (!list.length) fillEmpty(u, '还没有唱片，去搜一首吧');
      else list.slice(0, 9).forEach(function (s) {
        const d = document.createElement('div');
        d.className = 'mz-disc';
        const c = safeCover(s);
        if (c) d.style.backgroundImage = 'url("' + c + '")';
        u.appendChild(d);
      });
    }

    const b = $('mz-shelf-bot');
    if (b) {
      b.innerHTML = '';
      fillEmpty(b, '角色的唱片墙还没开张（下一步做）');
    }
    window.mzSwitchShelf(shelfOwner);
  }

  /* ---------------- 更多 sheet ---------------- */
  window.mzOpenMoreSheet = function () {
    const m = $('mz-more-sheet');
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 500); });
  } else {
    setTimeout(boot, 500);
  }
})();
