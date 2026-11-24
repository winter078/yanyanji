/* ==========================================================================
   搜索聊天记录 · 当前角色
   关键字 + 消息时间（时分）筛选，结果按聊天顺序倒序
   ========================================================================== */
(function (window) {
  'use strict';

  var state = {
    keyword: '',
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

  function messageTime(m) {
    var t = String((m && m.time) || '');
    if (/^\d{1,2}:\d{2}$/.test(t)) return t;
    var clock = t.match(/(\d{1,2}):(\d{2})/);
    if (clock) return clock[1] + ':' + clock[2];
    if (m && m.timestamp) {
      var d = new Date(Number(m.timestamp));
      if (!isNaN(d.getTime())) {
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }
    }
    return '';
  }

  function messageTimeLabel(m) {
    if (m && m.timestamp) {
      var d = new Date(Number(m.timestamp));
      if (!isNaN(d.getTime())) {
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      }
    }
    return String((m && m.time) || '时间未知');
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
    var records = [];

    list.forEach(function (m, index) {
      if (!m || m.role === 'system') return;
      var text = displayText(m);
      if (!text) return;
      if (!inRange(messageTime(m))) return;

      var haystack = text.toLowerCase();
      if (listTerms.length && !listTerms.every(function (term) { return haystack.indexOf(term) >= 0; })) return;

      records.push({
        index: index,
        msg: m,
        text: text,
        clock: messageTime(m),
        timeLabel: messageTimeLabel(m),
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
    var hasTime = state.range !== 'all';
    if (!hasQuery && !hasTime) {
      results.innerHTML = '<div class="cs-empty"><div class="cs-empty-icon">⌕</div><div class="cs-empty-title">输入关键字，或选一个时间段</div><div class="cs-empty-text">只搜当前角色的聊天记录，不会串到别的角色。</div></div>';
      summary.textContent = '关键字 + 时间';
      return;
    }

    var records = collect();
    var total = records.length;
    summary.textContent = '找到 ' + total + ' 条' + (hasTime ? ' · ' + rangeLabel() : '');

    if (!total) {
      results.innerHTML = '<div class="cs-empty"><div class="cs-empty-icon">⌕</div><div class="cs-empty-title">没有找到</div><div class="cs-empty-text">换个关键字，或把时间范围放宽一点。</div></div>';
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

    Array.prototype.forEach.call(document.querySelectorAll('.cs-chip'), function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-range') === state.range);
    });
    var custom = document.getElementById('chat-search-custom-time');
    if (custom) custom.style.display = state.range === 'custom' ? 'flex' : 'none';

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
    state.range = 'all';
    state.start = '00:00';
    state.end = '23:59';
    state.sort = 'desc';
    state.openId = '';
    var startInput = document.getElementById('chat-search-time-start');
    var endInput = document.getElementById('chat-search-time-end');
    if (startInput) startInput.value = state.start;
    if (endInput) endInput.value = state.end;
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
    Array.prototype.forEach.call(document.querySelectorAll('.cs-chip'), function (btn) {
      btn.addEventListener('click', function () {
        var range = btn.getAttribute('data-range') || 'all';
        update({ range: range });
      });
    });
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
