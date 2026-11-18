/* 字卡独立 App：本地词库对话，不接 API，也不写进微信聊天 */
(function () {
  'use strict';

  var GLOBAL_KEY = 'momo_wordcards_global_v1';
  var CHAR_KEY_PREFIX = 'momo_wordcards_char_v1_';
  var SETTINGS_KEY_PREFIX = 'momo_wordcards_settings_v1_';
  var MEMORY_KEY_PREFIX = 'momo_wordcards_memory_v1_';
  var HISTORY_KEY_PREFIX = 'momo_wordcards_history_v1_';
  var RECENT_LIMIT = 12;

  var wcState = {
    charId: '',
    view: 'chat',
    tab: 'char',
    modalType: '',
    editingGroupId: '',
    editingCardId: ''
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function attr(value) {
    return esc(value).replace(/\n/g, '&#10;');
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[WordCards] 写入失败:', e);
    }
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function nowLabel() {
    try {
      return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function toast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function getCharacters() {
    try {
      if (window.appData && Array.isArray(window.appData.characters) && window.appData.characters.length) {
        return window.appData.characters;
      }
    } catch (e) {}
    var raw = readJson('momo_characters', []);
    return Array.isArray(raw) ? raw : [];
  }

  function findChar(charId) {
    try {
      if (typeof window.findCharacterById === 'function') {
        var found = window.findCharacterById(charId);
        if (found) return found;
      }
    } catch (e) {}
    var list = getCharacters();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i] && list[i].id) === String(charId)) return list[i];
    }
    return null;
  }

  function activeCharId() {
    try {
      if (typeof window.activeChatCharId === 'function') {
        var id = window.activeChatCharId();
        if (id) return String(id);
      }
    } catch (e) {}
    var saved = localStorage.getItem('momo_active_char') || '';
    if (saved) return saved;
    var list = getCharacters();
    return list.length ? String(list[0].id || '') : '';
  }

  function charLabel(charId) {
    var c = findChar(charId);
    return (c && c.name) || '当前角色';
  }

  function charAvatar(charId) {
    var c = findChar(charId);
    return (c && c.avatar) || '';
  }

  function selfAvatar() {
    try {
      if (typeof window.getChatSelfAvatar === 'function') {
        var av = window.getChatSelfAvatar(wcState.charId);
        if (av) return av;
      }
    } catch (e) {}
    try {
      if (window.appData && window.appData.heroAvatar) return window.appData.heroAvatar;
    } catch (e) {}
    return localStorage.getItem('momo_hero_avatar') || '';
  }

  function makeCard(id, text, keywords, fallback) {
    return {
      id: id,
      text: text,
      keywords: keywords || [],
      weight: 1,
      enabled: true,
      fallback: !!fallback
    };
  }

  function defaultGlobalDeck() {
    return {
      version: 1,
      groups: [
        {
          id: 'g_greet',
          name: '日常',
          cards: [
            makeCard('wc_g_here', '我在。', ['在吗', '在不在', '人呢', '理我'], true),
            makeCard('wc_g_listen', '嗯，我在听。', ['听我说', '我跟你说', '想和你说', '你有空吗'], true),
            makeCard('wc_g_any', '想说什么都可以，我在。', ['想说', '聊聊', '陪我'], true)
          ]
        },
        {
          id: 'g_care',
          name: '关心',
          cards: [
            makeCard('wc_g_day', '今天还好吗？', ['今天', '怎么样', '还好吗'], false),
            makeCard('wc_g_tired', '辛苦了。', ['累', '加班', '忙', '辛苦'], false),
            makeCard('wc_g_rest', '先歇一会儿，别硬撑。', ['累', '困', '熬夜', '撑不住'], false),
            makeCard('wc_g_alone', '别一个人扛着。', ['难过', '烦', '哭', '压力'], false),
            makeCard('wc_g_slow', '慢慢说，不着急。', ['急', '慌', '怎么办', '来不及'], false)
          ]
        },
        {
          id: 'g_night',
          name: '晚安',
          cards: [
            makeCard('wc_g_sleep', '早点睡，明天再说。', ['晚安', '睡了', '熬夜'], false),
            makeCard('wc_g_dream', '晚安，做个好梦。', ['晚安', '好梦', '睡了'], false)
          ]
        }
      ]
    };
  }

  function defaultCharDeck() {
    return {
      version: 1,
      groups: [
        { id: 'g_char_default', name: '专属语气', cards: [] }
      ]
    };
  }

  function normalizeDeck(raw, isGlobal) {
    var source = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : (isGlobal ? defaultGlobalDeck() : defaultCharDeck());
    var groups = Array.isArray(source.groups) ? source.groups : [];
    var out = { version: 1, groups: [] };

    groups.forEach(function (group, gi) {
      if (!group || typeof group !== 'object') return;
      var cards = Array.isArray(group.cards) ? group.cards : [];
      var outCards = [];
      cards.forEach(function (card, ci) {
        if (!card || typeof card !== 'object') return;
        var text = String(card.text || '').trim();
        if (!text) return;
        outCards.push({
          id: String(card.id || ('wc_' + (isGlobal ? 'g' : 'c') + '_' + gi + '_' + ci)),
          text: text,
          keywords: Array.isArray(card.keywords)
            ? card.keywords.map(function (k) { return String(k).trim(); }).filter(Boolean)
            : [],
          weight: Number(card.weight) > 0 ? Number(card.weight) : 1,
          enabled: card.enabled !== false,
          fallback: card.fallback === true
        });
      });
      out.groups.push({
        id: String(group.id || ('g_' + gi)),
        name: String(group.name || '未命名分组'),
        cards: outCards
      });
    });

    return out;
  }

  function deckKey(kind, charId) {
    return kind === 'global' ? GLOBAL_KEY : (CHAR_KEY_PREFIX + (charId || 'default'));
  }

  function getDeck(kind, charId) {
    var key = deckKey(kind, charId);
    var raw = readJson(key, null);
    var isGlobal = kind === 'global';
    if (!raw || typeof raw !== 'object') {
      raw = isGlobal ? defaultGlobalDeck() : defaultCharDeck();
      writeJson(key, raw);
    }
    return normalizeDeck(raw, isGlobal);
  }

  function saveDeck(kind, charId, deck) {
    writeJson(deckKey(kind, charId), normalizeDeck(deck, kind === 'global'));
  }

  function settingsKey(charId) {
    return SETTINGS_KEY_PREFIX + (charId || 'default');
  }

  function getSettings(charId) {
    var raw = readJson(settingsKey(charId), null);
    var out = (raw && typeof raw === 'object') ? raw : {};
    if (!Array.isArray(out.recent)) out.recent = [];
    return out;
  }

  function saveSettings(charId, settings) {
    writeJson(settingsKey(charId), settings);
  }

  function getMemory(charId) {
    try {
      return localStorage.getItem(MEMORY_KEY_PREFIX + (charId || 'default')) || '';
    } catch (e) {
      return '';
    }
  }

  function setMemory(charId, text) {
    try {
      if (String(text || '').length) {
        localStorage.setItem(MEMORY_KEY_PREFIX + (charId || 'default'), text);
      } else {
        localStorage.removeItem(MEMORY_KEY_PREFIX + (charId || 'default'));
      }
    } catch (e) {}
  }

  function getHistory(charId) {
    var raw = readJson(HISTORY_KEY_PREFIX + (charId || 'default'), []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (m) {
      return m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim();
    }).slice(-200);
  }

  function saveHistory(charId, list) {
    writeJson(HISTORY_KEY_PREFIX + (charId || 'default'), list.slice(-200));
  }

  function appendHistory(charId, role, text, extra) {
    var list = getHistory(charId);
    var msg = { role: role, content: String(text || ''), time: nowLabel() };
    if (extra && typeof extra === 'object') {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) msg[key] = extra[key];
      }
    }
    list.push(msg);
    saveHistory(charId, list);
  }

  function countCards(deck) {
    if (!deck || !Array.isArray(deck.groups)) return 0;
    return deck.groups.reduce(function (sum, group) {
      return sum + (Array.isArray(group.cards) ? group.cards.length : 0);
    }, 0);
  }

  function currentDeckKind() {
    return wcState.tab === 'global' ? 'global' : 'char';
  }

  function currentDeck() {
    return getDeck(currentDeckKind(), wcState.charId);
  }

  function saveCurrentDeck(deck) {
    saveDeck(currentDeckKind(), wcState.charId, deck);
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/[\s，。！？、,.!?~～…—\-]+/g, '');
  }

  function matchCards(deck, text) {
    var normalized = normalizeText(text);
    var matched = [];
    if (!normalized || !deck || !Array.isArray(deck.groups)) return matched;
    deck.groups.forEach(function (group) {
      (group.cards || []).forEach(function (card) {
        if (!card.enabled || !Array.isArray(card.keywords) || !card.keywords.length) return;
        var hit = card.keywords.some(function (keyword) {
          var key = normalizeText(keyword);
          return key && normalized.indexOf(key) !== -1;
        });
        if (hit) matched.push(card);
      });
    });
    return matched;
  }

  function allEnabled(deck) {
    var list = [];
    if (!deck || !Array.isArray(deck.groups)) return list;
    deck.groups.forEach(function (group) {
      (group.cards || []).forEach(function (card) {
        if (card.enabled) list.push(card);
      });
    });
    return list;
  }

  function weightedPick(cards) {
    if (!cards.length) return null;
    var total = cards.reduce(function (sum, card) {
      return sum + Math.max(0.1, Number(card.weight) || 1);
    }, 0);
    var roll = Math.random() * total;
    for (var i = 0; i < cards.length; i++) {
      roll -= Math.max(0.1, Number(cards[i].weight) || 1);
      if (roll <= 0) return cards[i];
    }
    return cards[cards.length - 1];
  }

  function pickWordCard(text, options) {
    var opts = options || {};
    var charId = opts.charId || wcState.charId || activeCharId();
    var charDeck = getDeck('char', charId);
    var globalDeck = getDeck('global', '');
    var settings = getSettings(charId);
    var candidates = [];
    var source = '';

    if (opts.manual) {
      candidates = allEnabled(charDeck).concat(allEnabled(globalDeck));
      source = 'manual';
    } else {
      var charMatched = matchCards(charDeck, text);
      if (charMatched.length) {
        candidates = charMatched;
        source = 'char';
      } else {
        var globalMatched = matchCards(globalDeck, text);
        if (globalMatched.length) {
          candidates = globalMatched;
          source = 'global';
        } else {
          var fallback = allEnabled(globalDeck).filter(function (card) { return card.fallback; });
          if (!fallback.length) fallback = allEnabled(globalDeck);
          candidates = fallback;
          source = 'fallback';
        }
      }
    }

    if (!candidates.length) return null;

    var recent = settings.recent || [];
    var pool = candidates.filter(function (card) { return recent.indexOf(card.id) === -1; });
    if (!pool.length) pool = candidates;

    var picked = weightedPick(pool);
    if (!picked) return null;

    settings.recent = [picked.id].concat(settings.recent.filter(function (id) { return id !== picked.id; })).slice(0, RECENT_LIMIT);
    saveSettings(charId, settings);

    return {
      card: picked,
      source: source,
      charId: charId
    };
  }

  function avatarHtml(src, name) {
    if (src) {
      return '<img class="wc-msg-avatar" src="' + attr(src) + '" alt="' + attr(name || '') + '">';
    }
    return '<div class="wc-msg-avatar wc-msg-avatar-fallback">' + esc(String(name || '?').slice(0, 1)) + '</div>';
  }

  function renderChatMsg(msg) {
    var isUser = msg.role === 'user';
    var avatar = isUser ? selfAvatar() : charAvatar(wcState.charId);
    var name = isUser ? '我' : charLabel(wcState.charId);
    return '' +
      '<div class="wc-msg ' + (isUser ? 'user' : 'bot') + '">' +
        avatarHtml(avatar, name) +
        '<div class="wc-msg-bubble">' + esc(msg.content) + '</div>' +
      '</div>';
  }

  function renderChatView() {
    var list = getHistory(wcState.charId);
    var empty = '' +
      '<div class="wc-chat-empty">' +
        '<div class="wc-chat-empty-title">这里不接 API</div>' +
        '<div class="wc-chat-empty-desc">你发一句，它从你写的字卡里挑一句回你。不喜欢字卡的人，可以完全不开这个 App。</div>' +
      '</div>';
    return '' +
      '<div class="wc-chat-view">' +
        '<div class="wc-chat-scroll" id="wc-chat-scroll">' +
          (list.length ? list.map(renderChatMsg).join('') : empty) +
        '</div>' +
        '<div class="wc-chat-inputbar">' +
          '<button type="button" class="wc-chat-draw-btn" onclick="wcDrawCard()">抽一张</button>' +
          '<input id="wc-chat-input" class="wc-chat-input" type="text" maxlength="200" placeholder="和 ' + esc(charLabel(wcState.charId)) + ' 说点什么..." onkeydown="wcChatKeydown(event)">' +
          '<button type="button" class="wc-chat-send-btn" onclick="wcSendText()">发送</button>' +
        '</div>' +
      '</div>';
  }

  function renderGroupHtml(group) {
    var cards = Array.isArray(group.cards) ? group.cards : [];
    var cardsHtml = cards.length ? cards.map(function (card) {
      return '' +
        '<div class="wc-card ' + (card.enabled ? '' : 'is-off') + '">' +
          '<div class="wc-card-main">' +
            '<div class="wc-card-text">' + esc(card.text) + '</div>' +
            '<div class="wc-card-meta">' +
              (card.keywords.length ? '关键词：' + esc(card.keywords.join(' / ')) : '无关键词 · 只在手动抽卡出现') +
            '</div>' +
          '</div>' +
          '<div class="wc-card-actions">' +
            '<button type="button" class="wc-mini-btn" onclick="wcToggleCard(\'' + attr(group.id) + '\',\'' + attr(card.id) + '\')">' + (card.enabled ? '停用' : '启用') + '</button>' +
            '<button type="button" class="wc-mini-btn" onclick="wcOpenCardEditor(\'' + attr(group.id) + '\',\'' + attr(card.id) + '\')">编辑</button>' +
            '<button type="button" class="wc-mini-btn danger" onclick="wcDeleteCard(\'' + attr(group.id) + '\',\'' + attr(card.id) + '\')">删除</button>' +
          '</div>' +
        '</div>';
    }).join('') : '<div class="wc-empty-line">还没有卡，点「＋ 字卡」写一句。</div>';

    return '' +
      '<div class="wc-group">' +
        '<div class="wc-group-head">' +
          '<div class="wc-group-title-wrap">' +
            '<div class="wc-group-name">' + esc(group.name) + '</div>' +
            '<div class="wc-group-count">' + cards.length + ' 张</div>' +
          '</div>' +
          '<div class="wc-group-actions">' +
            '<button type="button" class="wc-mini-btn" onclick="wcOpenGroupEditor(\'' + attr(group.id) + '\')">改名</button>' +
            '<button type="button" class="wc-mini-btn accent" onclick="wcOpenCardEditor(\'' + attr(group.id) + '\',\'\')">＋ 字卡</button>' +
            '<button type="button" class="wc-mini-btn danger" onclick="wcDeleteGroup(\'' + attr(group.id) + '\')">删组</button>' +
          '</div>' +
        '</div>' +
        cardsHtml +
      '</div>';
  }

  function renderLibraryView() {
    var charDeck = getDeck('char', wcState.charId);
    var globalDeck = getDeck('global', '');
    var deck = wcState.tab === 'global' ? globalDeck : charDeck;

    return '' +
      '<div class="wc-library-scroll">' +
        '<div class="wc-app-intro">' +
          '<div class="wc-app-intro-title">字卡只在这里用</div>' +
          '<div class="wc-app-intro-desc">它不接管微信聊天，也不走 API。你喜欢就打开这个 App，不喜欢就完全不用它。每个角色一份库，另有通用库。一个角色先写 30–50 张再开始聊，不然几天就会重复。</div>' +
        '</div>' +
        '<div class="wc-tabs">' +
          '<button type="button" class="wc-tab ' + (wcState.tab === 'char' ? 'active' : '') + '" onclick="wcSwitchTab(\'char\')">角色库 <span>' + countCards(charDeck) + '</span></button>' +
          '<button type="button" class="wc-tab ' + (wcState.tab === 'global' ? 'active' : '') + '" onclick="wcSwitchTab(\'global\')">通用库 <span>' + countCards(globalDeck) + '</span></button>' +
        '</div>' +
        '<div class="wc-toolbar">' +
          '<button type="button" class="wc-tool-btn" onclick="wcOpenGroupEditor()">＋ 新建分组</button>' +
          '<button type="button" class="wc-tool-btn accent" onclick="wcOpenCardEditor(\'\',\'\')">＋ 新建字卡</button>' +
        '</div>' +
        '<div class="wc-groups">' +
          (deck.groups.length ? deck.groups.map(renderGroupHtml).join('') : (
            '<div class="wc-empty-state">' +
              '<div class="wc-empty-title">这个库还是空的</div>' +
              '<div class="wc-empty-desc">先建一个分组，再写几张这个角色会说的话。</div>' +
              '<button type="button" class="wc-primary-btn" onclick="wcOpenGroupEditor()">新建第一组</button>' +
            '</div>'
          )) +
        '</div>' +
        '<div class="wc-memory-entry" onclick="wcSwitchView(\'memory\')">' +
          '<div class="wc-memory-entry-main">' +
            '<div class="wc-memory-entry-title">记忆总结</div>' +
            '<div class="wc-memory-entry-desc">只存在字卡里；想给 API 对话用，可以复制过去自己粘贴。</div>' +
          '</div>' +
          '<span class="wc-memory-entry-arrow">›</span>' +
        '</div>' +
      '</div>';
  }

  function renderMemoryView() {
    var memory = getMemory(wcState.charId);
    return '' +
      '<div class="wc-memory-scroll">' +
        '<div class="wc-memory-head">' +
          '<div class="wc-memory-title">记忆总结 · ' + esc(charLabel(wcState.charId)) + '</div>' +
          '<div class="wc-memory-desc">这块只存在字卡 App 里，不会自动写进微信 / API 聊天的总结。想给 API 对话用，点「复制」，再去那边自己粘贴。也可以什么都不写，只让字卡自己记着。</div>' +
        '</div>' +
        '<textarea id="wc-memory-textarea" class="wc-memory-textarea" maxlength="4000" placeholder="写这个角色和你的重要记忆、关系变化、不能忘的约定..." oninput="wcSaveMemory(true)">' + esc(memory) + '</textarea>' +
        '<div class="wc-memory-actions">' +
          '<button type="button" class="wc-memory-btn primary" onclick="wcSaveMemory(false)">保存</button>' +
          '<button type="button" class="wc-memory-btn" onclick="wcCopyMemory()">复制</button>' +
          '<button type="button" class="wc-memory-btn danger" onclick="wcClearMemory()">清空</button>' +
        '</div>' +
        '<div class="wc-memory-status" id="wc-memory-status">' + (memory ? '已保存在本机' : '还没有记忆总结') + '</div>' +
        '<div class="wc-memory-foot">只保存在本机 · 不参与字卡匹配 · 不会自动同步到 API 聊天</div>' +
      '</div>';
  }

  function updateCharSelect() {
    var select = document.getElementById('wc-char-select');
    if (!select) return;
    var chars = getCharacters();
    if (!chars.length) {
      select.innerHTML = '<option value="">当前角色</option>';
      select.value = '';
      return;
    }
    select.innerHTML = chars.map(function (c) {
      var id = String(c.id || '');
      var name = c.name || '未命名角色';
      return '<option value="' + attr(id) + '">' + esc(name) + '</option>';
    }).join('');
    if (!wcState.charId || !chars.some(function (c) { return String(c.id || '') === String(wcState.charId); })) {
      wcState.charId = String(chars[0].id || '');
    }
    select.value = wcState.charId;
  }

  function syncViewTabs() {
    var map = { chat: 'wc-tab-chat', library: 'wc-tab-library', memory: 'wc-tab-memory' };
    Object.keys(map).forEach(function (view) {
      var el = document.getElementById(map[view]);
      if (el) el.classList.toggle('active', wcState.view === view);
    });
  }

  function renderApp() {
    var body = document.getElementById('wc-app-body');
    if (!body) return;

    var title = document.getElementById('wc-nav-title');
    if (title) title.textContent = '字卡';

    updateCharSelect();
    syncViewTabs();

    if (wcState.view === 'library') {
      body.innerHTML = renderLibraryView();
    } else if (wcState.view === 'memory') {
      body.innerHTML = renderMemoryView();
    } else {
      body.innerHTML = renderChatView();
      setTimeout(function () {
        var scroll = document.getElementById('wc-chat-scroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
      }, 0);
    }
  }

  function ensureGroup(deck) {
    if (deck.groups.length) return deck.groups[0];
    var group = {
      id: uid('g'),
      name: wcState.tab === 'global' ? '通用' : '专属语气',
      cards: []
    };
    deck.groups.push(group);
    saveCurrentDeck(deck);
    return group;
  }

  function openWcModal() {
    var modal = document.getElementById('wordcard-modal');
    if (modal) modal.classList.add('open');
  }

  window.closeWordCardModal = function () {
    var modal = document.getElementById('wordcard-modal');
    if (modal) modal.classList.remove('open');
  };

  window.openWordCardApp = function (view, charId) {
    wcState.charId = String(charId || wcState.charId || activeCharId() || '');
    wcState.view = (view === 'library' || view === 'memory') ? view : 'chat';
    wcState.tab = 'char';
    renderApp();
    if (typeof window.openPage === 'function') window.openPage('page-wordcards');
  };

  window.openWordCardLibrary = function () {
    window.openWordCardApp('library');
  };

  window.wcSwitchView = function (view) {
    wcState.view = (view === 'library' || view === 'memory') ? view : 'chat';
    renderApp();
  };

  window.wcSwitchChar = function (charId) {
    wcState.charId = String(charId || '');
    wcState.tab = 'char';
    renderApp();
  };

  window.wcSwitchTab = function (tab) {
    wcState.tab = tab === 'global' ? 'global' : 'char';
    renderApp();
  };

  window.wcQuickAdd = function () {
    if (wcState.view !== 'library') {
      wcState.view = 'library';
      wcState.tab = 'char';
      renderApp();
    }
    window.wcOpenCardEditor('', '');
  };

  window.wcChatKeydown = function (event) {
    if (!event) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      window.wcSendText();
    }
  };

  window.wcSendText = function () {
    var input = document.getElementById('wc-chat-input');
    var text = input ? String(input.value || '').trim() : '';
    if (!text) return;

    appendHistory(wcState.charId, 'user', text);
    var result = pickWordCard(text, { charId: wcState.charId, manual: false });
    if (!result || !result.card) {
      renderApp();
      toast('这个角色还没有字卡，去「字卡库」写几张。');
      return;
    }
    appendHistory(wcState.charId, 'assistant', result.card.text, { wordcard: true });
    renderApp();
  };

  window.wcDrawCard = function () {
    var result = pickWordCard('', { charId: wcState.charId, manual: true });
    if (!result || !result.card) {
      toast('字卡库还是空的，去「字卡库」写几张。');
      return;
    }
    appendHistory(wcState.charId, 'assistant', result.card.text, { wordcard: true, manual: true });
    renderApp();
  };

  window.wcSaveMemory = function (silent) {
    var ta = document.getElementById('wc-memory-textarea');
    if (!ta) return;
    setMemory(wcState.charId, String(ta.value || ''));
    var status = document.getElementById('wc-memory-status');
    if (status) status.textContent = String(ta.value || '').trim() ? '已保存在本机' : '还没有记忆总结';
    if (!silent) toast('记忆总结已保存在字卡里');
  };

  window.wcCopyMemory = function () {
    var text = getMemory(wcState.charId);
    if (!text.trim()) {
      toast('还没有记忆总结，先写一点');
      return;
    }

    function done() {
      toast('已复制：去 API 对话的总结里自己粘贴');
    }

    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) {
        toast('复制失败，可以长按手动复制');
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
  };

  window.wcClearMemory = function () {
    if (!confirm('清空这个角色的记忆总结？只清字卡里的这一份，不影响 API 聊天。')) return;
    setMemory(wcState.charId, '');
    var ta = document.getElementById('wc-memory-textarea');
    if (ta) ta.value = '';
    var status = document.getElementById('wc-memory-status');
    if (status) status.textContent = '还没有记忆总结';
    toast('已清空');
  };

  window.wcOpenGroupEditor = function (groupId) {
    var deck = currentDeck();
    var group = groupId ? deck.groups.filter(function (g) { return g.id === groupId; })[0] : null;
    wcState.modalType = 'group';
    wcState.editingGroupId = group ? group.id : '';
    wcState.editingCardId = '';

    var title = document.getElementById('wc-modal-title');
    if (title) title.textContent = group ? '改分组名' : '新建分组';
    var body = document.getElementById('wc-modal-body');
    if (body) {
      body.innerHTML = '' +
        '<label class="wc-label">分组名</label>' +
        '<input id="wc-group-name" class="wc-input" maxlength="20" value="' + attr(group ? group.name : '') + '" placeholder="例如：日常 / 关心 / 吃醋">' +
        '<div class="wc-hint">分组只是给你自己看的，不影响匹配；关键词才决定什么时候回。</div>';
    }
    openWcModal();
  };

  window.wcOpenCardEditor = function (groupId, cardId) {
    var deck = currentDeck();
    var group = groupId ? deck.groups.filter(function (g) { return g.id === groupId; })[0] : null;
    if (!group) group = ensureGroup(deck);
    var card = cardId ? (group.cards || []).filter(function (c) { return c.id === cardId; })[0] : null;

    wcState.modalType = 'card';
    wcState.editingGroupId = group.id;
    wcState.editingCardId = card ? card.id : '';

    var title = document.getElementById('wc-modal-title');
    if (title) title.textContent = card ? '编辑字卡' : '新建字卡';
    var body = document.getElementById('wc-modal-body');
    if (body) {
      var groupOptions = deck.groups.map(function (g) {
        return '<option value="' + attr(g.id) + '"' + (g.id === group.id ? ' selected' : '') + '>' + esc(g.name) + '</option>';
      }).join('');

      body.innerHTML = '' +
        '<label class="wc-label">字卡内容</label>' +
        '<textarea id="wc-card-text" class="wc-textarea" rows="4" maxlength="300" placeholder="写一句这个角色真的会说的话">' + esc(card ? card.text : '') + '</textarea>' +
        '<label class="wc-label">关键词（逗号分隔）</label>' +
        '<input id="wc-card-keywords" class="wc-input" value="' + attr(card && card.keywords ? card.keywords.join('，') : '') + '" placeholder="例如：累，困，晚安">' +
        '<div class="wc-hint">你发的话里包含任意一个关键词，就优先从这些卡里抽；不填关键词就只在「抽一张」时出现。</div>' +
        '<label class="wc-label">放在分组</label>' +
        '<select id="wc-card-group" class="wc-select">' + groupOptions + '</select>' +
        '<label class="wc-check-row"><input type="checkbox" id="wc-card-enabled"' + (!card || card.enabled !== false ? ' checked' : '') + '> 启用这张卡</label>';
    }
    openWcModal();
  };

  window.saveWordCardModal = function () {
    var deck = currentDeck();

    if (wcState.modalType === 'group') {
      var nameEl = document.getElementById('wc-group-name');
      var name = nameEl ? String(nameEl.value || '').trim() : '';
      if (!name) {
        toast('分组名不能为空');
        return;
      }
      if (wcState.editingGroupId) {
        var editGroup = deck.groups.filter(function (g) { return g.id === wcState.editingGroupId; })[0];
        if (editGroup) editGroup.name = name;
      } else {
        deck.groups.push({ id: uid('g'), name: name, cards: [] });
      }
      saveCurrentDeck(deck);
      window.closeWordCardModal();
      renderApp();
      toast('分组已保存');
      return;
    }

    if (wcState.modalType !== 'card') return;

    var textEl = document.getElementById('wc-card-text');
    var text = textEl ? String(textEl.value || '').trim() : '';
    if (!text) {
      toast('字卡内容不能为空');
      return;
    }

    var keywordsEl = document.getElementById('wc-card-keywords');
    var keywords = keywordsEl ? String(keywordsEl.value || '').split(/[,，\n]+/).map(function (k) { return k.trim(); }).filter(Boolean) : [];
    var groupEl = document.getElementById('wc-card-group');
    var targetGroupId = groupEl ? groupEl.value : wcState.editingGroupId;
    var enabledEl = document.getElementById('wc-card-enabled');
    var enabled = enabledEl ? !!enabledEl.checked : true;

    var group = deck.groups.filter(function (g) { return g.id === targetGroupId; })[0];
    if (!group) group = ensureGroup(deck);

    if (wcState.editingCardId) {
      var sourceGroup = null;
      var sourceIndex = -1;
      for (var gi = 0; gi < deck.groups.length; gi++) {
        var cardsInGroup = deck.groups[gi].cards || [];
        for (var ci = 0; ci < cardsInGroup.length; ci++) {
          if (cardsInGroup[ci].id === wcState.editingCardId) {
            sourceGroup = deck.groups[gi];
            sourceIndex = ci;
            break;
          }
        }
        if (sourceGroup) break;
      }
      if (sourceGroup) {
        var editCard = sourceGroup.cards[sourceIndex];
        if (sourceGroup !== group) {
          sourceGroup.cards.splice(sourceIndex, 1);
          group.cards = group.cards || [];
          group.cards.push(editCard);
        }
        editCard.text = text;
        editCard.keywords = keywords;
        editCard.enabled = enabled;
      }
    } else {
      group.cards = group.cards || [];
      group.cards.push({
        id: uid('wc'),
        text: text,
        keywords: keywords,
        weight: 1,
        enabled: enabled,
        fallback: false
      });
    }

    saveCurrentDeck(deck);
    window.closeWordCardModal();
    renderApp();
    toast('字卡已保存');
  };

  window.wcDeleteGroup = function (groupId) {
    var deck = currentDeck();
    var group = deck.groups.filter(function (g) { return g.id === groupId; })[0];
    if (!group) return;
    if (!confirm('删除分组「' + group.name + '」和里面的 ' + (group.cards || []).length + ' 张卡？')) return;
    deck.groups = deck.groups.filter(function (g) { return g.id !== groupId; });
    saveCurrentDeck(deck);
    renderApp();
  };

  window.wcDeleteCard = function (groupId, cardId) {
    var deck = currentDeck();
    var group = deck.groups.filter(function (g) { return g.id === groupId; })[0];
    if (!group) return;
    var card = (group.cards || []).filter(function (c) { return c.id === cardId; })[0];
    if (!card) return;
    if (!confirm('删除这张字卡？\n\n' + card.text)) return;
    group.cards = (group.cards || []).filter(function (c) { return c.id !== cardId; });
    saveCurrentDeck(deck);
    renderApp();
  };

  window.wcToggleCard = function (groupId, cardId) {
    var deck = currentDeck();
    var group = deck.groups.filter(function (g) { return g.id === groupId; })[0];
    if (!group) return;
    var card = (group.cards || []).filter(function (c) { return c.id === cardId; })[0];
    if (!card) return;
    card.enabled = !card.enabled;
    saveCurrentDeck(deck);
    renderApp();
  };

  window.WordCards = {
    GLOBAL_KEY: GLOBAL_KEY,
    CHAR_KEY_PREFIX: CHAR_KEY_PREFIX,
    SETTINGS_KEY_PREFIX: SETTINGS_KEY_PREFIX,
    MEMORY_KEY_PREFIX: MEMORY_KEY_PREFIX,
    HISTORY_KEY_PREFIX: HISTORY_KEY_PREFIX,
    getDeck: getDeck,
    saveDeck: saveDeck,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getMemory: getMemory,
    setMemory: setMemory,
    getHistory: getHistory,
    saveHistory: saveHistory,
    pickWordCard: pickWordCard,
    activeCharId: activeCharId,
    countCards: countCards,
    normalizeDeck: normalizeDeck
  };
})();
