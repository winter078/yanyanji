/* ==========================================================================
   归档 · 每个角色一份
   语音通话读 momo_call_records_v1（按 charId 隔离，群聊不进这里）
   一起听写 momo_listen_records_v1（music.js 在播放/暂停时调用）
   ========================================================================== */
(function (window) {
  'use strict';

  var CALL_KEY = 'momo_call_records_v1';
  var LISTEN_KEY = 'momo_listen_records_v1';
  var LISTEN_CURRENT_KEY = 'momo_listen_current_v1';
  var MAX_LISTEN = 80;
  var MIN_LISTEN_MS = 15000;

  var state = { tab: 'voice' };

  var TAB_META = {
    video: {
      icon: '📹',
      emptyTitle: '还没有视频通话',
      emptyText: '还没有视频通话记录。打完电话之后会出现在这里。'
    },
    voice: {
      icon: '📞',
      emptyTitle: '还没有语音通话',
      emptyText: '还没有语音通话记录。打完电话之后会出现在这里。'
    },
    listen: {
      icon: '🎧',
      emptyTitle: '还没有一起听',
      emptyText: '还没有一起听记录。和角色听一首歌之后会出现在这里。'
    }
  };

  function app() {
    return window.appData || {};
  }

  function activeCharacter() {
    try {
      if (typeof window.getActiveCharacter === 'function') return window.getActiveCharacter();
    } catch (e) {}
    return null;
  }

  function currentCharId() {
    var c = activeCharacter();
    if (c && c.id) return String(c.id);
    var a = app();
    return String(a.activeChatCharId || a.currentCharId || 'default');
  }

  function currentCharName() {
    var c = activeCharacter();
    if (c && (c.name || c.remark)) return String(c.remark || c.name);
    return '当前角色';
  }

  function charById(id) {
    try {
      var list = (typeof window.getCharacters === 'function' && window.getCharacters()) || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && String(list[i].id) === String(id)) return list[i];
      }
    } catch (e) {}
    return null;
  }

  function charAvatar(id) {
    var c = charById(id);
    return (c && (c.avatarData || c.avatar)) || '';
  }

  function readObject(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }

  function writeObject(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    try { if (window.SupabaseSync && window.SupabaseSync.schedule) window.SupabaseSync.schedule(); } catch (e) {}
  }

  function readListen() {
    try {
      var v = JSON.parse(localStorage.getItem(LISTEN_KEY) || '[]');
      if (Array.isArray(v)) return v.filter(function (r) { return r && r.id; });
      if (v && typeof v === 'object') {
        return Object.keys(v).map(function (k) { return v[k]; }).filter(function (r) { return r && r.id; });
      }
    } catch (e) {}
    return [];
  }

  function writeListen(list) {
    list.sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
    if (list.length > MAX_LISTEN) list = list.slice(0, MAX_LISTEN);
    try { localStorage.setItem(LISTEN_KEY, JSON.stringify(list)); } catch (e) {}
    try { if (window.SupabaseSync && window.SupabaseSync.schedule) window.SupabaseSync.schedule(); } catch (e) {}
  }

  function readCurrentListen() {
    try {
      var v = JSON.parse(localStorage.getItem(LISTEN_CURRENT_KEY) || 'null');
      return v && v.id ? v : null;
    } catch (e) { return null; }
  }

  function clearCurrentListen() {
    try { localStorage.removeItem(LISTEN_CURRENT_KEY); } catch (e) {}
  }

  function callRecordKind(record) {
    return record && record.kind === 'video' ? 'video' : 'voice';
  }

  function getCallRecords(charId) {
    var all = readObject(CALL_KEY);
    var list = Object.keys(all).map(function (k) { return all[k]; }).filter(Boolean);
    return list.filter(function (r) {
      if (!r || r.groupId) return false;
      return String(r.charId || '') === String(charId);
    }).sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
  }

  function getListenRecords(charId) {
    var current = readCurrentListen();
    var list = readListen();
    if (current && String(current.charId || '') !== String(charId)) current = null;
    list = list.filter(function (r) {
      if (!r || String(r.charId || '') !== String(charId)) return false;
      var isActive = !!current && current.id === r.id && !r.endedAt;
      if (!r.endedAt && !isActive) {
        var stale = Date.now() - (r.startedAt || Date.now());
        if (stale > 6 * 60 * 60 * 1000) {
          r.endedAt = (r.startedAt || Date.now());
          r.duration = 0;
          return false;
        }
      }
      if (!isActive && (r.duration || 0) < MIN_LISTEN_MS) return false;
      return true;
    });
    return list.sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
  }

  function formatDate(ms) {
    try {
      var d = new Date(ms || Date.now());
      var now = new Date();
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      if (d.getFullYear() === now.getFullYear()) {
        return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
      }
      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
    } catch (e) { return ''; }
  }

  function formatDuration(ms) {
    var total = Math.max(0, Math.round((ms || 0) / 1000));
    if (total < 60) return total + '秒';
    var m = Math.floor(total / 60);
    var s = total % 60;
    if (m < 60) return m + '分' + (s ? String(s).padStart(2, '0') + '秒' : '');
    var h = Math.floor(m / 60);
    return h + '小时' + String(m % 60).padStart(2, '0') + '分';
    }

  function formatClock(ms) {
    var total = Math.max(0, Math.round((ms || 0) / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    if (m >= 60) {
      return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function avatarMarkup(id, name, emojiClass, emoji) {
    var src = charAvatar(id);
    if (src) {
      return '<span class="archive-row-icon ' + emojiClass + '"><img src="' + escapeHtml(src) + '" alt=""></span>';
    }
    var letter = (name || '').trim().charAt(0);
    if (letter) return '<span class="archive-row-icon ' + emojiClass + '">' + escapeHtml(letter) + '</span>';
    return '<span class="archive-row-icon ' + emojiClass + '">' + emoji + '</span>';
  }

  function emptyMarkup(tab) {
    var meta = TAB_META[tab] || TAB_META.voice;
    return '<div class="archive-empty">' +
      '<div class="archive-empty-icon">' + meta.icon + '</div>' +
      '<div class="archive-empty-title">' + meta.emptyTitle + '</div>' +
      '<div class="archive-empty-text">' + meta.emptyText + '</div>' +
      '</div>';
  }

  function renderTabs(voiceList, videoList, listenList) {
    var counts = { video: videoList.length, voice: voiceList.length, listen: listenList.length };
    var tabs = document.querySelectorAll('#archive-tabs .archive-tab');
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      var kind = tab.getAttribute('data-archive-tab');
      tab.classList.toggle('active', kind === state.tab);
      var countEl = tab.querySelector('.archive-tab-count');
      if (countEl) countEl.textContent = String(counts[kind] || 0);
    }
  }

  function voiceRows(list) {
    return list.map(function (r) {
      var name = String(r.charName || currentCharName());
      var isVideo = callRecordKind(r) === 'video';
      var title = '与 ' + name + ' 的' + (isVideo ? '视频通话' : '语音通话');
      var kindClass = isVideo ? 'video' : '';
      var emoji = isVideo ? '📹' : '📞';
      return '<button type="button" class="archive-row" data-record-kind="' + (isVideo ? 'video' : 'voice') + '" data-record-id="' + escapeHtml(r.id) + '">' +
        avatarMarkup(r.charId, name, kindClass, emoji) +
        '<span class="archive-row-main">' +
          '<span class="archive-row-title">' + escapeHtml(title) + '</span>' +
          '<span class="archive-row-sub">' + escapeHtml(formatDate(r.startedAt)) + ' · ' + (r.messages ? r.messages.length : 0) + ' 句话</span>' +
        '</span>' +
        '<span class="archive-row-side"><b>' + escapeHtml(formatClock(r.duration)) + '</b><span class="archive-row-chevron">›</span></span>' +
      '</button>';
    }).join('');
  }

  function listenRows(list) {
    var current = readCurrentListen();
    return list.map(function (r) {
      var active = !!current && current.id === r.id && !r.endedAt;
      var dur = active ? Math.max(0, Date.now() - (r.startedAt || Date.now())) : (r.duration || 0);
      var title = String(r.songTitle || '一起听');
      var sub = '和 ' + String(r.charName || currentCharName()) + ' · ' + formatDate(r.startedAt);
      var cover = r.cover ? '<span class="archive-row-icon listen"><img src="' + escapeHtml(r.cover) + '" alt=""></span>' : '<span class="archive-row-icon listen">🎧</span>';
      return '<button type="button" class="archive-row" data-record-kind="listen" data-record-id="' + escapeHtml(r.id) + '">' +
        cover +
        '<span class="archive-row-main">' +
          '<span class="archive-row-title">' + escapeHtml(title) + '</span>' +
          '<span class="archive-row-sub">' + escapeHtml(sub) + '</span>' +
        '</span>' +
        '<span class="archive-row-side"><b>' + (active ? '正在听' : escapeHtml(formatClock(dur))) + '</b><span class="archive-row-chevron">›</span></span>' +
      '</button>';
    }).join('');
  }

  function getSnapshot() {
    var cid = currentCharId();
    var calls = getCallRecords(cid);
    var voiceList = calls.filter(function (r) { return callRecordKind(r) !== 'video'; });
    var videoList = calls.filter(function (r) { return callRecordKind(r) === 'video'; });
    var listenList = getListenRecords(cid);
    return { cid: cid, name: currentCharName(), voice: voiceList, video: videoList, listen: listenList };
  }

  function render() {
    var snap = getSnapshot();
    var scope = document.getElementById('archive-scope');
    if (scope) scope.textContent = '只显示与「' + snap.name + '」的记录，不会和别人的混在一起';
    renderTabs(snap.voice, snap.video, snap.listen);

    var host = document.getElementById('archive-list');
    if (!host) return;
    var list = state.tab === 'video' ? snap.video : (state.tab === 'listen' ? snap.listen : snap.voice);
    if (!list.length) {
      host.innerHTML = emptyMarkup(state.tab);
      return;
    }
    host.innerHTML = '<div class="archive-group">' +
      (state.tab === 'listen' ? listenRows(list) : voiceRows(list)) +
      '</div>';
  }

  function ensureListDelegate() {
    var host = document.getElementById('archive-list');
    if (!host || host.__archiveBound) return;
    host.__archiveBound = true;
    host.addEventListener('click', function (ev) {
      var row = ev.target && ev.target.closest ? ev.target.closest('.archive-row') : null;
      if (!row) return;
      var kind = row.getAttribute('data-record-kind');
      var id = row.getAttribute('data-record-id');
      if (!id) return;
      if (kind === 'listen') openListenDetail(id);
      else if (typeof window.openCallRecord === 'function') window.openCallRecord(id);
    });
  }

  function ensureDetail() {
    var page = document.getElementById('page-archive');
    var mask = document.getElementById('archive-detail-mask');
    if (mask) return mask;
    if (!page) return null;
    mask = document.createElement('div');
    mask.id = 'archive-detail-mask';
    mask.className = 'archive-detail-mask';
    mask.style.display = 'none';
    mask.innerHTML = '<div class="archive-detail-card" role="dialog" aria-modal="true">' +
      '<div class="archive-detail-handle"></div>' +
      '<div class="archive-detail-top">' +
        '<div class="archive-detail-cover" id="archive-detail-cover">🎧</div>' +
        '<div class="archive-detail-info">' +
          '<div class="archive-detail-title" id="archive-detail-title"></div>' +
          '<div class="archive-detail-sub" id="archive-detail-sub"></div>' +
        '</div>' +
      '</div>' +
      '<div class="archive-detail-stats">' +
        '<div class="archive-detail-stat"><span>和谁</span><b id="archive-detail-who"></b></div>' +
        '<div class="archive-detail-stat"><span>听了多久</span><b id="archive-detail-length"></b></div>' +
      '</div>' +
      '<button type="button" class="archive-detail-close" id="archive-detail-close">关闭</button>' +
    '</div>';
    page.appendChild(mask);
    mask.addEventListener('click', function (ev) {
      if (ev.target === mask) closeListenDetail();
    });
    var close = mask.querySelector('#archive-detail-close');
    if (close) close.addEventListener('click', closeListenDetail);
    return mask;
  }

  function openListenDetail(id) {
    var snap = getSnapshot();
    var record = null;
    for (var i = 0; i < snap.listen.length; i++) {
      if (String(snap.listen[i].id) === String(id)) { record = snap.listen[i]; break; }
    }
    if (!record) return;
    var mask = ensureDetail();
    if (!mask) return;
    var current = readCurrentListen();
    var active = !!current && current.id === record.id && !record.endedAt;
    var dur = active ? Math.max(0, Date.now() - (record.startedAt || Date.now())) : (record.duration || 0);

    var titleEl = mask.querySelector('#archive-detail-title');
    var subEl = mask.querySelector('#archive-detail-sub');
    var coverEl = mask.querySelector('#archive-detail-cover');
    var whoEl = mask.querySelector('#archive-detail-who');
    var lenEl = mask.querySelector('#archive-detail-length');

    if (titleEl) titleEl.textContent = String(record.songTitle || '一起听');
    if (subEl) subEl.textContent = String(record.artist || '未署名') + ' · ' + formatDate(record.startedAt) + (active ? ' · 正在一起听' : '');
    if (whoEl) whoEl.textContent = String(record.charName || currentCharName());
    if (lenEl) lenEl.textContent = formatDuration(dur);
    if (coverEl) {
      coverEl.innerHTML = '';
      if (record.cover) {
        var img = document.createElement('img');
        img.src = record.cover;
        img.alt = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:13px;';
        coverEl.appendChild(img);
      } else {
        coverEl.textContent = '🎧';
      }
    }
    mask.style.display = 'flex';
  }

  function closeListenDetail() {
    var mask = document.getElementById('archive-detail-mask');
    if (mask) mask.style.display = 'none';
  }

  function switchTab(tab) {
    if (!TAB_META[tab]) return;
    state.tab = tab;
    render();
    var screen = document.getElementById('archive-screen');
    if (screen) screen.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openArchivePage(tab) {
    state.tab = TAB_META[tab] ? tab : 'voice';
    ensureListDelegate();
    render();
    if (typeof window.openPage === 'function') window.openPage('page-archive');
  }

  function closeArchivePage() {
    if (typeof window.openPage === 'function') window.openPage('page-chat-setting');
  }

  /* ---------------- 一起听记录：由 music.js 调用 ---------------- */
  function noteListen(song) {
    if (!song || !song.title) return;
    var cid = currentCharId();
    var current = readCurrentListen();
    if (current && String(current.charId) === String(cid) && String(current.songTitle) === String(song.title)) {
      current.artist = song.artist || current.artist || '';
      current.cover = song.cover || current.cover || '';
      writeObject(LISTEN_CURRENT_KEY, current);
      return;
    }
    endListen();

    var now = Date.now();
    var record = {
      id: 'listen_' + now + '_' + Math.random().toString(36).slice(2, 7),
      charId: cid,
      charName: currentCharName(),
      songTitle: String(song.title || ''),
      artist: String(song.artist || ''),
      cover: String(song.cover || ''),
      startedAt: now,
      endedAt: 0,
      duration: 0
    };
    var list = readListen();
    list.push(record);
    writeListen(list);
    writeObject(LISTEN_CURRENT_KEY, {
      id: record.id,
      charId: cid,
      songTitle: record.songTitle,
      artist: record.artist,
      cover: record.cover,
      startedAt: now
    });
  }

  function endListen() {
    var current = readCurrentListen();
    if (!current || !current.id) return;
    var list = readListen();
    var record = null;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(current.id)) { record = list[i]; break; }
    }
    if (record && !record.endedAt) {
      var now = Date.now();
      var dur = Math.max(0, now - (record.startedAt || now));
      record.endedAt = now;
      record.duration = dur;
      list = list.filter(function (r) {
        if (r.id === record.id) return dur >= MIN_LISTEN_MS;
        return true;
      });
      writeListen(list);
    }
    clearCurrentListen();
  }

  function resumeListen() {
    if (readCurrentListen()) return;
    var song = null;
    try {
      if (window.mzBridge && typeof window.mzBridge.current === 'function') song = window.mzBridge.current();
    } catch (e) {}
    if (song) noteListen(song);
  }

  window.Archive = {
    open: openArchivePage,
    render: render,
    switchTab: switchTab,
    noteListen: noteListen,
    endListen: endListen,
    resumeListen: resumeListen
  };
  window.openArchivePage = openArchivePage;
  window.closeArchivePage = closeArchivePage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { ensureListDelegate(); }, { once: true });
  } else {
    ensureListDelegate();
  }
})(window);
