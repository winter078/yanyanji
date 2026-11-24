/* ==========================================================================
   搜索聊天记录 · 当前角色
   关键字 + 消息时间（时分）筛选，结果按聊天顺序倒序
   ========================================================================== */
(function (window) {
  'use strict';

  var state = {
    keyword: '',
    dateMode: 'all',
    date: '',
    range: 'all',
    start: '00:00',
    end: '23:59',
    sort: 'desc',
    openId: ''
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
    try {
      if (window.WB && typeof window.WB.activeCharId === 'function') {
        var id = window.WB.activeCharId();
        if (id) return String(id);
      }
    } catch (e) {}
    var c = activeCharacter();
    if (c && c.id) return String(c.id);
    return String(localStorage.getItem('momo_active_char') || app().activeChatCharId || '');
  }

  function currentCharName() {
    var c = activeCharacter();
    if (c) return String(c.remark || c.name || '当前角色');
    return String(app().botRemark || '当前角色');
  }

  function currentUserLabel() {
    return String(app().userNickname || '你');
  }

  function loadMessages() {
    var id = currentCharId();
    var list = [];
    try {
      if (id && typeof window.getChatHistoryForChar === 'function') {
        list = window.getChatHistoryForChar(id) || [];
      }
    } catch (e) {}
    if ((!list || !list.length) && Array.isArray(app().chatHistory)) {
      list = app().chatHistory;
    }
    return Array.isArray(list) ? list : [];
  }

  function rawContent(m) {
    return String((m && m.content) || '');
  }

  function jsonInside(raw, prefix) {
    var re = new RegExp('^\\[' + prefix + ':([\\s\\S]*?)\\]');
    var match = raw.match(re);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch (e) { return null; }
  }

  function displayText(m) {
    var raw = rawContent(m);
    if (!raw) return m && m.media ? '图片' : '';
    if (raw.indexOf('[SYSTEMHINT:') === 0) return '';
    if (m.media || /^\[IMAGE(?::|\])/.test(raw)) return '图片';
    if (/^\[STICKER:|^\[表情包?:/.test(raw)) return '表情包';

    var file = jsonInside(raw, 'FILECARD');
    if (file) return '文件 · ' + String(file.name || '未命名文件');
    var share = jsonInside(raw, 'SHARECARD') || jsonInside(raw, 'TEXTCARD');
    if (share) {
      return String(share.title || share.name || share.text || '分享卡片');
    }
    if (/^\[VOICE/.test(raw)) return '语音';

    return raw
      .replace(/\[FILECARD:[\s\S]*?\]/g, '文件')
      .replace(/\[SHARECARD:[\s\S]*?\]/g, '分享卡片')
      .replace(/\[TEXTCARD:[\s\S]*?\]/g, '便签')
      .replace(/\[IMAGE:[^\]]*\]/g, '图片')
      .replace(/\[STICKER:[^\]]*\]/g, '表情包')
      .replace(/\[REACTION:[^\]]*\]/g, '')
      .replace(/\[RECALL\]/g, '')
      .replace(/\[REMARK:[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function timestampOf(m) {
    if (!m) return 0;
    var raw = m.timestamp;
    if (raw == null) raw = m.ts;
    if (raw == null) raw = m.createdAt;
    if (raw == null) raw = m.created_at;
    if (raw == null || raw === '') return 0;
    if (typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw)) raw = Number(raw);
    if (typeof raw === 'number' && isFinite(raw) && raw > 0) {
      return raw < 100000000000 ? raw * 1000 : raw;
    }
    var parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function localDateKey(value) {
    var d = typeof value === 'number' ? new Date(value) : new Date(String(value));
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayDateKey() {
    return localDateKey(Date.now());
  }

  function addDays(dateKey, delta) {
    var parts = String(dateKey || '').split('-');
    if (parts.length !== 3) return dateKey;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + Number(delta || 0));
    return localDateKey(d.getTime());
  }

  function dateKeyFromText(value) {
    if (!value) return '';
    var text = String(value).trim();
    if (!text) return '';
    var full = text.match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
    if (full) {
      return full[1] + '-' + pad2(Number(full[2])) + '-' + pad2(Number(full[3]));
    }
    var monthDay = text.match(/(\d{1,2})月(\d{1,2})日/);
    if (!monthDay) monthDay = text.match(/(\d{1,2})\/(\d{1,2})(?:\s|$)/);
    if (monthDay) {
      var year = new Date().getFullYear();
      var key = year + '-' + pad2(Number(monthDay[1])) + '-' + pad2(Number(monthDay[2]));
      if (key > todayDateKey()) key = (year - 1) + '-' + pad2(Number(monthDay[1])) + '-' + pad2(Number(monthDay[2]));
      return key;
    }
    return '';
  }

  function messageDateKey(m) {
    if (!m) return '';
    var ts = timestampOf(m);
    if (ts) return localDateKey(ts);
    var fields = [m.dateKey, m.date, m.day, m.time];
    for (var i = 0; i < fields.length; i++) {
      var key = dateKeyFromText(fields[i]);
      if (key) return key;
    }
    return '';
  }

  function messageTime(m) {
    var t = String((m && m.time) || '');
    if (/^\d{1,2}:\d{2}$/.test(t)) return t;
    var clock = t.match(/(\d{1,2}):(\d{2})/);
    if (clock) return clock[1] + ':' + clock[2];
    var ts = timestampOf(m);
    if (ts) {
      var d = new Date(ts);
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    return '';
  }

  function shortDateLabel(dateKey) {
    if (!dateKey) return '';
    if (dateKey === todayDateKey()) return '今天';
    if (dateKey === addDays(todayDateKey(), -1)) return '昨天';
    if (dateKey === addDays(todayDateKey(), -2)) return '前天';
    var parts = dateKey.split('-');
    return Number(parts[1]) + '/' + Number(parts[2]);
  }

  function messageTimeLabel(m, dateKey) {
    var clock = messageTime(m);
    if (dateKey) return shortDateLabel(dateKey) + (clock ? ' ' + clock : '');
    if (m && m.time) return String(m.time);
    return '时间未知';
  }

  function buildDateKeys(list) {
    var keys = new Array(list.length);
    var clocks = new Array(list.length);
    var hasExplicit = false;
    var i;

    for (i = 0; i < list.length; i++) {
      var m = list[i];
      keys[i] = messageDateKey(m);
      clocks[i] = messageTime(m);
      if (keys[i]) hasExplicit = true;
    }

    if (!hasExplicit) {
      var base = todayDateKey();
      var nextClock = null;
      for (i = list.length - 1; i >= 0; i--) {
        var clock = minutes(clocks[i]);
        if (nextClock !== null && clock !== null && clock > nextClock) base = addDays(base, -1);
        keys[i] = base;
        if (clock !== null) nextClock = clock;
      }
      return keys;
    }

    var lastKey = '';
    var lastClock = null;
    for (i = 0; i < list.length; i++) {
      if (keys[i]) {
        lastKey = keys[i];
        lastClock = minutes(clocks[i]);
        continue;
      }
      if (!lastKey) continue;
      var currentClock = minutes(clocks[i]);
      if (currentClock !== null && lastClock !== null && currentClock < lastClock) {
        lastKey = addDays(lastKey, 1);
      }
      keys[i] = lastKey;
      if (currentClock !== null) lastClock = currentClock;
    }

    var nextKey = '';
    var nextMaxClock = null;
    for (i = list.length - 1; i >= 0; i--) {
      if (keys[i]) {
        nextKey = keys[i];
        nextMaxClock = minutes(clocks[i]);
        continue;
      }
      if (!nextKey) continue;
      var earlierClock = minutes(clocks[i]);
      if (earlierClock !== null && nextMaxClock !== null && earlierClock > nextMaxClock) {
        nextKey = addDays(nextKey, -1);
      }
      keys[i] = nextKey;
      if (earlierClock !== null) nextMaxClock = earlierClock;
    }

    for (i = 0; i < list.length; i++) {
      if (!keys[i]) keys[i] = todayDateKey();
    }
    return keys;
  }

  function hasDateFilter() {
    return state.dateMode !== 'all' && !(state.dateMode === 'custom' && !state.date);
  }

  function inDateRange(dateKey) {
    if (!hasDateFilter()) return true;
    if (!dateKey) return false;
    if (state.dateMode === 'today') return dateKey === todayDateKey();
    if (state.dateMode === 'yesterday') return dateKey === addDays(todayDateKey(), -1);
    if (state.dateMode === 'week') {
      return dateKey >= addDays(todayDateKey(), -6) && dateKey <= todayDateKey();
    }
    if (state.dateMode === 'custom') return dateKey === state.date;
    return true;
  }

  function dateRangeLabel() {
    if (state.dateMode === 'today') return '今天';
    if (state.dateMode === 'yesterday') return '昨天';
    if (state.dateMode === 'week') return '近 7 天';
    if (state.dateMode === 'custom' && state.date) return shortDateLabel(state.date);
    return '';
  }


  function minutes(value) {
    var match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function inRange(clock) {
    var value = minutes(clock);
    if (value === null) return state.range === 'all';
    if (state.range === 'all') return true;
    if (state.range === 'night') return value >= 0 && value < 360;
    if (state.range === 'morning') return value >= 360 && value < 720;
    if (state.range === 'afternoon') return value >= 720 && value < 1080;
    if (state.range === 'evening') return value >= 1080 && value < 1440;
    if (state.range === 'custom') {
      var start = minutes(state.start);
      var end = minutes(state.end);
      if (start === null || end === null) return true;
      if (start <= end) return value >= start && value <= end;
      return value >= start || value <= end;
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function terms() {
    return state.keyword.toLowerCase().split(/\s+/).filter(Boolean);
  }

  function snippet(text, list) {
    if (!text) return '';
    if (!list.length || text.length <= 220) return text;
    var lower = text.toLowerCase();
    var first = -1;
    list.forEach(function (term) {
      var at = lower.indexOf(term);
      if (at >= 0 && (first < 0 || at < first)) first = at;
    });
    if (first < 0) return text.slice(0, 220) + '…';
    var start = Math.max(0, first - 60);
    var end = Math.min(text.length, start + 220);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function highlight(text, list) {
    var safe = escapeHtml(text);
    if (!list.length) return safe;
    var pattern = list.map(escapeRegExp).join('|');
    if (!pattern) return safe;
    return safe.replace(new RegExp('(' + pattern + ')', 'gi'), '<mark>$1</mark>');
  }

  function collect() {
    var list = loadMessages();
    var listTerms = terms();
    var dateKeys = buildDateKeys(list);
    var records = [];

    list.forEach(function (m, index) {
      if (!m || m.role === 'system') return;
      var text = displayText(m);
      if (!text) return;
      var dateKey = dateKeys[index] || '';
      if (!inDateRange(dateKey)) return;
      if (!inRange(messageTime(m))) return;

      var haystack = text.toLowerCase();
      if (listTerms.length && !listTerms.every(function (term) { return haystack.indexOf(term) >= 0; })) return;

      records.push({
        index: index,
        msg: m,
        text: text,
        clock: messageTime(m),
        dateKey: dateKey,
        timeLabel: messageTimeLabel(m, dateKey),
        isUser: m.role === 'user',
        isNarration: !!m.narration
      });
    });

    records.sort(function (a, b) {
      return state.sort === 'asc' ? a.index - b.index : b.index - a.index;
    });
    return records;
  }

  function roleName(record) {
    return record.isUser ? currentUserLabel() : currentCharName();
  }

  function render() {
    var results = document.getElementById('chat-search-results');
    var summary = document.getElementById('chat-search-summary');
    var scope = document.getElementById('chat-search-scope');
    if (!results || !summary) return;

    var all = loadMessages().filter(function (m) { return m && m.role !== 'system' && displayText(m); });
    if (scope) {
      var name = currentCharName();
      var scopeName = (name && name !== '当前角色' && name !== '角色') ? ' · ' + name : '';
      scope.textContent = '当前角色' + scopeName + ' · 共 ' + all.length + ' 条可搜消息';
    }

    var listTerms = terms();
    var hasQuery = !!state.keyword.trim();
    var hasDate = hasDateFilter();
    var hasTime = state.range !== 'all';
    if (!hasQuery && !hasTime && !hasDate) {
      results.innerHTML = '<div class="cs-empty"><div class="cs-empty-icon">⌕</div><div class="cs-empty-title">输入关键字，或选一个日期/时间段</div><div class="cs-empty-text">只搜当前角色的聊天记录，不会串到别的角色。</div></div>';
      summary.textContent = '关键字 / 日期 / 时间';
      return;
    }

    var records = collect();
    var total = records.length;
    summary.textContent = '找到 ' + total + ' 条' +
      (hasDate ? ' · ' + dateRangeLabel() : '') +
      (hasTime ? ' · ' + rangeLabel() : '');

    if (!total) {
      results.innerHTML = '<div class="cs-empty"><div class="cs-empty-icon">⌕</div><div class="cs-empty-title">没有找到</div><div class="cs-empty-text">换个关键字，或把日期、时间范围放宽一点。</div></div>';
      return;
    }

    var html = '';
    records.slice(0, 200).forEach(function (r) {
      var open = state.openId === String(r.index);
      var text = open ? r.text : snippet(r.text, listTerms);
      html += '<div class="cs-result' + (open ? ' is-open' : '') + '" data-index="' + r.index + '">' +
        '<div class="cs-result-head">' +
          '<span class="cs-avatar">' + escapeHtml(roleName(r).slice(0, 1)) + '</span>' +
          '<span class="cs-name">' + escapeHtml(roleName(r)) + '</span>' +
          (r.isNarration ? '<span class="cs-tag">旁白</span>' : '') +
          '<span class="cs-time">' + escapeHtml(r.timeLabel) + '</span>' +
        '</div>' +
        '<div class="cs-result-text">' + highlight(text, listTerms) + '</div>' +
      '</div>';
    });
    if (total > 200) {
      html += '<div class="cs-more">只显示前 200 条，再输入关键字缩小范围</div>';
    }
    results.innerHTML = html;
  }

  function rangeLabel() {
    if (state.range === 'night') return '凌晨 00:00–05:59';
    if (state.range === 'morning') return '上午 06:00–11:59';
    if (state.range === 'afternoon') return '下午 12:00–17:59';
    if (state.range === 'evening') return '晚上 18:00–23:59';
    if (state.range === 'custom') return state.start + '–' + state.end;
    return '全部时间';
  }

  function syncControls() {
    var input = document.getElementById('chat-search-input');
    var clear = document.getElementById('chat-search-clear');
    if (input) input.value = state.keyword;
    if (clear) clear.style.display = state.keyword ? 'flex' : 'none';

    Array.prototype.forEach.call(document.querySelectorAll('.cs-chip[data-range]'), function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-range') === state.range);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.cs-chip[data-date]'), function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-date') === state.dateMode);
    });
    var custom = document.getElementById('chat-search-custom-time');
    if (custom) custom.style.display = state.range === 'custom' ? 'flex' : 'none';
    var customDate = document.getElementById('chat-search-custom-date');
    if (customDate) customDate.style.display = state.dateMode === 'custom' ? 'flex' : 'none';
    var dateInput = document.getElementById('chat-search-date');
    if (dateInput && dateInput.value !== state.date) dateInput.value = state.date;
    var dateClear = document.getElementById('chat-search-date-clear');
    if (dateClear) dateClear.style.display = state.date ? 'flex' : 'none';

    var sort = document.getElementById('chat-search-sort');
    if (sort) sort.textContent = state.sort === 'desc' ? '最新在前' : '最早在前';
  }

  function update(patch) {
    Object.keys(patch).forEach(function (key) { state[key] = patch[key]; });
    syncControls();
    render();
  }

  function openChatSearchPage() {
    state.keyword = '';
    state.dateMode = 'all';
    state.date = '';
    state.range = 'all';
    state.start = '00:00';
    state.end = '23:59';
    state.sort = 'desc';
    state.openId = '';
    var startInput = document.getElementById('chat-search-time-start');
    var endInput = document.getElementById('chat-search-time-end');
    var dateInput = document.getElementById('chat-search-date');
    if (startInput) startInput.value = state.start;
    if (endInput) endInput.value = state.end;
    if (dateInput) {
      dateInput.value = '';
      dateInput.max = todayDateKey();
    }
    syncControls();
    render();
    if (typeof window.openPage === 'function') window.openPage('page-chat-search');
    var screen = document.querySelector('.chat-search-screen');
    if (screen) screen.scrollTop = 0;
    setTimeout(function () {
      var input = document.getElementById('chat-search-input');
      if (input) input.focus({ preventScroll: true });
    }, 320);
  }

  function closeChatSearchPage() {
    if (typeof window.openPage === 'function') window.openPage('page-chat-setting');
  }

  function init() {
    var input = document.getElementById('chat-search-input');
    var clear = document.getElementById('chat-search-clear');
    var customStart = document.getElementById('chat-search-time-start');
    var customEnd = document.getElementById('chat-search-time-end');
    var dateInput = document.getElementById('chat-search-date');
    var dateClear = document.getElementById('chat-search-date-clear');
    var sort = document.getElementById('chat-search-sort');
    var results = document.getElementById('chat-search-results');

    if (input) {
      input.addEventListener('input', function () {
        state.keyword = this.value || '';
        update({ keyword: state.keyword });
      });
    }
    if (clear) {
      clear.addEventListener('click', function () {
        state.keyword = '';
        update({ keyword: '' });
        if (input) input.focus();
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.cs-chip[data-range]'), function (btn) {
      btn.addEventListener('click', function () {
        var range = btn.getAttribute('data-range') || 'all';
        update({ range: range });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.cs-chip[data-date]'), function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-date') || 'all';
        update({ dateMode: mode });
        if (mode === 'custom' && dateInput) {
          setTimeout(function () { dateInput.focus({ preventScroll: true }); }, 30);
        }
      });
    });
    if (dateInput) {
      dateInput.max = todayDateKey();
      dateInput.addEventListener('change', function () {
        var value = this.value || '';
        update({ date: value, dateMode: value ? 'custom' : 'all' });
      });
    }
    if (dateClear) {
      dateClear.addEventListener('click', function () {
        update({ date: '', dateMode: 'all' });
      });
    }
    if (customStart) {
      customStart.addEventListener('change', function () {
        state.start = this.value || '00:00';
        update({ start: state.start, range: 'custom' });
      });
    }
    if (customEnd) {
      customEnd.addEventListener('change', function () {
        state.end = this.value || '23:59';
        update({ end: state.end, range: 'custom' });
      });
    }
    if (sort) {
      sort.addEventListener('click', function () {
        update({ sort: state.sort === 'desc' ? 'asc' : 'desc' });
      });
    }
    if (results) {
      results.addEventListener('click', function (e) {
        var card = e.target.closest('.cs-result');
        if (!card) return;
        var index = card.getAttribute('data-index');
        state.openId = state.openId === index ? '' : index;
        render();
      });
    }
  }

  window.openChatSearchPage = openChatSearchPage;
  window.closeChatSearchPage = closeChatSearchPage;
  window.ChatSearch = {
    open: openChatSearchPage,
    close: closeChatSearchPage,
    refresh: render,
    state: state
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
