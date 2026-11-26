// =========================================================
// 按角色的聊天外观：我的头像/头像框/气泡 + 对方头像框/气泡
// 每个角色一份配置；头像框素材全局共用，不在每个角色里重复存图。
// =========================================================
(function () {
  var APPEARANCE_KEY = 'momo_chat_appearances_v1';
  var FRAMES_KEY = 'momo_chat_frames_v1';
  var GLOBAL_LOOK_KEY = 'momo_chat_look';
  var AVATAR_VISIBLE_KEY = 'momo_chat_avatar_visible';

  var PRESET_STYLE = {
    plain: { radius: '16px', tail: '5px', pady: '10px', padx: '13px', lh: '1.52', border: '0.5px', shadow: '0 1px 3px rgba(0, 0, 0, 0.18)' },
    ig:    { radius: '22px', tail: '22px', pady: '10px', padx: '14px', lh: '1.5', border: '0px', shadow: '0 2px 8px rgba(0, 0, 0, 0.22)' },
    qq:    { radius: '6px', tail: '4px', pady: '9px', padx: '12px', lh: '1.5', border: '1px', shadow: 'none' },
    wa:    { radius: '8px', tail: '3px', pady: '9px', padx: '12px', lh: '1.45', border: '0.5px', shadow: '0 1px 2px rgba(0, 0, 0, 0.12)' },
    sms:   { radius: '24px', tail: '24px', pady: '11px', padx: '16px', lh: '1.5', border: '0.5px', shadow: '0 8px 26px rgba(0, 0, 0, 0.12)' }
  };

  var BUILTIN_FRAMES = [
    { id: 'builtin_bubble', name: '单侧气泡', type: 'bubble', slots: 1, defaults: ['汪。'], desc: '贴在头像边的一句小话' },
    { id: 'builtin_duo', name: '双侧气泡', type: 'duo', slots: 2, defaults: ['我在', '说没有我就不行。'], desc: '上下各一句，适合黏人的角色' },
    { id: 'builtin_banner', name: '上下横幅', type: 'banner', slots: 2, defaults: ['把你老公删了', '我来当你老公'], desc: '红底白字，最显眼的一款' },
    { id: 'builtin_thin', name: '细描边', type: 'thin', slots: 1, defaults: [''], desc: '只加一圈细边，不抢头像' },
    { id: 'builtin_glow', name: '光晕', type: 'glow', slots: 1, defaults: ['快说需要我。'], desc: '像被一圈光托着' }
  ];

  var uploadedFramesCache = null;
  var currentSide = 'self';
  var pickerSide = 'self';
  var pendingFrameResolve = null;
  var pendingFrameMeta = null;

  function safeParse(raw, fallback) {
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) { return fallback; }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readAvatarVisible() {
    try {
      var saved = localStorage.getItem(AVATAR_VISIBLE_KEY);
      return saved === null ? true : saved === '1';
    } catch (e) {
      return true;
    }
  }

  function saveAvatarVisible(visible) {
    try { localStorage.setItem(AVATAR_VISIBLE_KEY, visible ? '1' : '0'); }
    catch (e) { console.warn('头像显示状态保存失败', e); }
  }

  function appData() { return window.appData || {}; }

  function activeCharId() {
    try {
      if (typeof window.getActiveCharacter === 'function') {
        var c = window.getActiveCharacter();
        if (c && c.id) return c.id;
      }
    } catch (e) {}
    try {
      if (window.WB && typeof window.WB.activeCharId === 'function') {
        var wid = window.WB.activeCharId();
        if (wid) return wid;
      }
    } catch (e2) {}
    return (appData().activeCharId) || localStorage.getItem('momo_active_char') || '';
  }

  function findChar(charId) {
    if (!charId) return null;
    try {
      if (typeof window.findCharacterById === 'function') return window.findCharacterById(charId);
    } catch (e) {}
    return null;
  }

  function charName(charId) {
    var c = findChar(charId);
    if (c && c.name) return c.name;
    if (charId && charId === activeCharId()) return appData().botRemark || appData().currentCharName || '当前角色';
    return '当前角色';
  }

  function readGlobalLook() {
    var base = { preset: 'plain', fontSize: 15, avatarSize: 40, avatarShape: 'circle', avatarMode: 'message', userBg: '', userText: '', botBg: '', botText: '' };
    var saved = safeParse(localStorage.getItem(GLOBAL_LOOK_KEY) || '{}', {});
    if (PRESET_STYLE[saved.preset]) base.preset = saved.preset;
    if (isFinite(saved.fontSize)) base.fontSize = Math.min(30, Math.max(12, Math.round(+saved.fontSize)));
    if (isFinite(saved.avatarSize)) base.avatarSize = Math.min(56, Math.max(24, Math.round(+saved.avatarSize)));
    if (saved.avatarShape === 'square' || saved.avatarShape === 'circle') base.avatarShape = saved.avatarShape;
    if (saved.avatarMode === 'round' || saved.avatarMode === 'message') base.avatarMode = saved.avatarMode;
    ['userBg', 'userText', 'botBg', 'botText'].forEach(function (k) {
      if (typeof saved[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(saved[k])) base[k] = saved[k];
    });
    return base;
  }

  function defaultAppearance(charId) {
    var base = readGlobalLook();
    base.charId = charId || '';
    base.selfAvatar = '';
    base.selfAvatarId = '';
    base.selfFrame = '';
    base.selfFrameText1 = '';
    base.selfFrameText2 = '';
    base.botFrame = '';
    base.botFrameText1 = '';
    base.botFrameText2 = '';
    return base;
  }

  function normalizeAppearance(raw, charId) {
    var base = defaultAppearance(charId);
    if (!raw || typeof raw !== 'object') return base;
    if (PRESET_STYLE[raw.preset]) base.preset = raw.preset;
    if (isFinite(raw.fontSize)) base.fontSize = Math.min(30, Math.max(12, Math.round(+raw.fontSize)));
    if (isFinite(raw.avatarSize)) base.avatarSize = Math.min(56, Math.max(24, Math.round(+raw.avatarSize)));
    if (raw.avatarShape === 'circle' || raw.avatarShape === 'square') base.avatarShape = raw.avatarShape;
    if (raw.avatarMode === 'message' || raw.avatarMode === 'round') base.avatarMode = raw.avatarMode;
    ['userBg', 'userText', 'botBg', 'botText'].forEach(function (k) {
      if (typeof raw[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw[k])) base[k] = raw[k];
    });
    ['selfAvatar', 'selfAvatarId', 'selfFrame', 'selfFrameText1', 'selfFrameText2', 'botFrame', 'botFrameText1', 'botFrameText2'].forEach(function (k) {
      if (typeof raw[k] === 'string') base[k] = raw[k];
    });
    return base;
  }

  function readAppearanceMap() {
    var raw = safeParse(localStorage.getItem(APPEARANCE_KEY) || '{}', {});
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }

  function saveAppearanceMap(map) {
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(map || {})); }
    catch (e) { console.warn('聊天外观保存失败', e); }
  }

  function getChatAppearance(charId) {
    var id = charId || activeCharId();
    var map = readAppearanceMap();
    return normalizeAppearance(map[id], id);
  }

  function ensureChatAppearance(charId) {
    var id = charId || activeCharId();
    if (!id) return getChatAppearance(id);
    var map = readAppearanceMap();
    if (!map[id]) {
      map[id] = defaultAppearance(id);
      saveAppearanceMap(map);
    }
    return normalizeAppearance(map[id], id);
  }

  function saveChatAppearance(ap) {
    var id = (ap && ap.charId) || activeCharId();
    if (!id) return null;
    var map = readAppearanceMap();
    ap.charId = id;
    map[id] = normalizeAppearance(ap, id);
    saveAppearanceMap(map);
    return map[id];
  }

  function updateChatAppearance(field, value) {
    var id = activeCharId();
    if (!id) return null;
    var ap = ensureChatAppearance(id);
    ap[field] = value;
    return saveChatAppearance(ap);
  }

  var detailMemos = {};
  var lastVaultRaw = null;
  var vaultListCache = [];

  function readMomoVaultList() {
    var raw = localStorage.getItem('momo_vault_list_momo_v2') || '[]';
    if (raw !== lastVaultRaw) {
      lastVaultRaw = raw;
      vaultListCache = safeParse(raw, []);
      if (!Array.isArray(vaultListCache)) vaultListCache = [];
    }
    return vaultListCache;
  }

  function getChatSelfAvatar(charId) {
    if (!window.__groupMode && typeof window.getMaskForChar === 'function') {
      try {
        var mask = window.getMaskForChar(charId);
        if (mask && mask.avatar) return mask.avatar;
      } catch (e) {}
    }
    var ap = getChatAppearance(charId);
    if (ap.selfAvatarId) {
      var item = readMomoVaultList().filter(function (it) { return String(it.id) === String(ap.selfAvatarId); })[0];
      if (item && (item.url || item.base64)) return item.url || item.base64;
    }
    return ap.selfAvatar || appData().heroAvatar || localStorage.getItem('momo_hero_avatar') || '';
  }

  function getChatBotAvatar(charId) {
    var c = findChar(charId);
    if (c && c.avatar) return c.avatar;
    if (charId && charId === activeCharId()) return appData().botAvatar || '';
    return '';
  }

  function getImportedFrames() {
    if (uploadedFramesCache) return uploadedFramesCache;
    var raw = safeParse(localStorage.getItem(FRAMES_KEY) || '[]', []);
    uploadedFramesCache = Array.isArray(raw) ? raw.filter(function (f) { return f && f.id && f.url; }) : [];
    return uploadedFramesCache;
  }

  function saveImportedFrames(list) {
    uploadedFramesCache = Array.isArray(list) ? list : [];
    try { localStorage.setItem(FRAMES_KEY, JSON.stringify(uploadedFramesCache)); }
    catch (e) { console.warn('头像框素材保存失败', e); }
  }

  // 启动早期如果只读到 localStorage 的旧头像框，这里让缓存失效并重读。
  window.momoReloadChatFrames = function () {
    uploadedFramesCache = null;
    return getImportedFrames();
  };

  function allChatFrames() {
    return BUILTIN_FRAMES.concat(getImportedFrames());
  }

  function findChatFrame(id) {
    if (!id) return null;
    var all = allChatFrames();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  function findChatFrameByName(name) {
    var q = String(name || '').trim().toLowerCase();
    if (!q) return null;
    var all = allChatFrames();
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].name || '').trim().toLowerCase() === q) return all[i];
    }
    for (var j = 0; j < all.length; j++) {
      if (String(all[j].name || '').toLowerCase().indexOf(q) >= 0) return all[j];
    }
    return null;
  }

  function getFrameDefaultText(frame, slot) {
    if (!frame || !Array.isArray(frame.defaults)) return '';
    return frame.defaults[slot] || '';
  }

  function getChatFramePromptText() {
    var frames = allChatFrames();
    var lines = frames.slice(0, 10).map(function (f) {
      return '- 「' + f.name + '」' + (f.desc ? '：' + f.desc : '');
    });
    return lines.join('\n') + '\n*换框能力*：只有当你这一轮真的想换头像框时，才在正文最后单独一行写 [换头像框: 框名|文案1|文案2]（例如 [换头像框: 上下横幅|坐下听我训|乖狗狗有奖励]）。系统会先在聊天里弹出「我要换头像框」让user选同意或不同意，她同意后才真正换。头像框只在正圆头像时显示，不要每轮都换。';
  }

  function frameSlots(appearance, side) {
    if (side === 'self') return { one: appearance.selfFrameText1, two: appearance.selfFrameText2 };
    return { one: appearance.botFrameText1, two: appearance.botFrameText2 };
  }

  function frameIdForSide(appearance, side) {
    return side === 'self' ? appearance.selfFrame : appearance.botFrame;
  }

  function frameHtml(frame, appearance, side) {
    if (!frame) return '';
    var texts = frameSlots(appearance, side);
    var html = '<div class="caf caf-' + escapeHtml(frame.type || 'bubble') + '">';
    if (frame.type === 'image') {
      html += '<img class="caf-img" src="' + escapeHtml(frame.url) + '" alt="" />';
    }
    if (frame.slots >= 1 && String(texts.one || '').trim()) {
      html += '<span class="caf-text caf-text-one">' + escapeHtml(texts.one) + '</span>';
    }
    if (frame.slots >= 2 && String(texts.two || '').trim()) {
      html += '<span class="caf-text caf-text-two">' + escapeHtml(texts.two) + '</span>';
    }
    html += '</div>';
    return html;
  }

  function avatarBoxHtml(avatarUrl, fallbackText, frame, appearance, side, extraClass) {
    var shape = appearance.avatarShape === 'square' ? 'square' : 'circle';
    var radius = shape === 'square' ? '10px' : '50%';
    var inner = avatarUrl
      ? '<img src="' + escapeHtml(avatarUrl) + '" alt="" />'
      : escapeHtml(fallbackText || '');
    return '<div class="msg-avatar-box ' + (side === 'self' ? 'is-user' : 'is-bot') + ' ' + (extraClass || '') + '" data-avatar-shape="' + shape + '" style="--chat-avatar-radius:' + radius + '">' +
      '<div class="msg-avatar">' + inner + '</div>' +
      frameHtml(frame, appearance, side) +
    '</div>';
  }

  function createChatAvatarBox(avatarEl, side, charId) {
    if (!avatarEl) return null;
    if (avatarEl.parentNode && avatarEl.parentNode.classList && avatarEl.parentNode.classList.contains('msg-avatar-box')) {
      return avatarEl.parentNode;
    }
    var ap = getChatAppearance(charId);
    var frame = findChatFrame(frameIdForSide(ap, side));
    var box = document.createElement('div');
    box.className = 'msg-avatar-box ' + (side === 'self' ? 'is-user' : 'is-bot');
    box.setAttribute('data-avatar-shape', ap.avatarShape === 'square' ? 'square' : 'circle');
    box.style.setProperty('--chat-avatar-radius', ap.avatarShape === 'square' ? '10px' : '50%');
    box.appendChild(avatarEl);
    if (frame) {
      var frameEl = document.createElement('div');
      frameEl.innerHTML = frameHtml(frame, ap, side);
      if (frameEl.firstElementChild) box.appendChild(frameEl.firstElementChild);
    }
    return box;
  }

  function applyChatAppearance(charId) {
    var id = charId || activeCharId();
    var ap = getChatAppearance(id);
    var p = PRESET_STYLE[ap.preset] || PRESET_STYLE.plain;
    var radiusVar = ap.avatarShape === 'square' ? '10px' : '50%';
    var css = '#page-chat {\n' +
      '  --chat-font-size: ' + ap.fontSize + 'px;\n' +
      '  --chat-avatar-size: ' + ap.avatarSize + 'px;\n' +
      '  --chat-avatar-radius: ' + radiusVar + ';\n' +
      '  --chat-line-height: ' + p.lh + ';\n' +
      '  --chat-bubble-radius: ' + p.radius + ';\n' +
      '  --chat-bubble-tail: ' + p.tail + ';\n' +
      '  --chat-bubble-pad-y: ' + p.pady + ';\n' +
      '  --chat-bubble-pad-x: ' + p.padx + ';\n' +
      '  --chat-bubble-border: ' + p.border + ';\n' +
      '  --chat-bubble-shadow: ' + p.shadow + ';\n' +
      '}\n';
    var colorVars = '';
    if (ap.userBg) colorVars += '  --bubble-user: ' + ap.userBg + ';\n';
    if (ap.userText) colorVars += '  --bubble-user-text: ' + ap.userText + ';\n';
    if (ap.botBg) colorVars += '  --bubble-bot: ' + ap.botBg + ';\n';
    if (ap.botText) colorVars += '  --bubble-bot-text: ' + ap.botText + ';\n';
    if (colorVars) css += '#page-chat {\n' + colorVars + '}\n';

    var tag = document.getElementById('chat-appearance-style');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'chat-appearance-style';
    }
    tag.innerHTML = css;
    (document.body || document.documentElement).appendChild(tag);

    var pageChat = document.getElementById('page-chat');
    if (pageChat) {
      pageChat.setAttribute('data-avatar-mode', ap.avatarMode);
      pageChat.setAttribute('data-avatar-shape', ap.avatarShape);
      pageChat.setAttribute('data-chat-preset', ap.preset);
      pageChat.setAttribute('data-avatar-visible', readAvatarVisible() ? 'on' : 'off');
      if (window.__groupMode) pageChat.setAttribute('data-chat-group', 'on');
      else pageChat.removeAttribute('data-chat-group');
      var headAvatar = getChatBotAvatar(id);
      if (headAvatar) pageChat.style.setProperty('--chat-head-avatar', 'url("' + String(headAvatar).replace(/"/g, '%22') + '")');
      else pageChat.style.removeProperty('--chat-head-avatar');
    }
    if (typeof window.scheduleChatBubbleRefit === 'function') {
      try { window.scheduleChatBubbleRefit(); } catch (e) {}
    }
    syncChatAppearanceEntry();
    return ap;
  }

  function syncChatAppearanceEntry() {
    var sub = document.getElementById('ca-entry-sub');
    if (sub) {
      var id = activeCharId();
      sub.textContent = id
        ? ('只对「' + charName(id) + '」生效：头像、头像框、气泡都各存一份')
        : '头像、头像框、气泡都各存一份';
    }
    var btn = document.getElementById('ca-entry-role');
    if (btn) btn.textContent = activeCharId() ? ('当前：' + charName(activeCharId())) : '当前角色';
  }

  function ensureSheet() {
    var mask = document.getElementById('chat-appearance-mask');
    if (mask) return mask;
    mask = document.createElement('div');
    mask.id = 'chat-appearance-mask';
    mask.className = 'ca-mask';
    mask.onclick = function (e) { if (e.target === mask) closeChatAppearanceSheet(); };
    mask.innerHTML =
      '<div class="ca-sheet" onclick="event.stopPropagation()">' +
        '<div class="ca-grab"></div>' +
        '<div class="ca-header">' +
          '<div><div class="ca-title">聊天外观</div><div class="ca-sub" id="ca-sub"></div></div>' +
          '<button type="button" class="ca-close" onclick="closeChatAppearanceSheet()">✕</button>' +
        '</div>' +
        '<div class="ca-tabs">' +
          '<button type="button" class="ca-tab active" data-side="self" onclick="switchChatAppearanceSide(\'self\')">我</button>' +
          '<button type="button" class="ca-tab" data-side="bot" onclick="switchChatAppearanceSide(\'bot\')">对方</button>' +
        '</div>' +
        '<div class="ca-body" id="ca-body"></div>' +
        '<div class="ca-footer"><button type="button" class="ca-done" onclick="closeChatAppearanceSheet()">完成</button></div>' +
      '</div>' +
      '<div class="ca-subpicker" id="ca-avatar-picker" style="display:none;" onclick="event.stopPropagation()">' +
        '<div class="ca-subpicker-head"><span id="ca-avatar-picker-title">选择头像</span><button type="button" onclick="closeChatAvatarPicker()">✕</button></div>' +
        '<div class="ca-avatar-grid" id="ca-avatar-grid"></div>' +
        '<button type="button" class="ca-goto-vault" onclick="openChatAvatarVault()">去头像库上传 / 管理</button>' +
      '</div>';
    document.body.appendChild(mask);
    return mask;
  }

  function openChatAppearanceSheet() {
    var id = activeCharId();
    if (!id) {
      if (typeof window.wxToast === 'function') window.wxToast('先选一个角色再设置聊天外观');
      return;
    }
    ensureChatAppearance(id);
    ensureSheet();
    currentSide = 'self';
    var mask = document.getElementById('chat-appearance-mask');
    if (mask) mask.classList.add('open');
    renderChatAppearanceSheet();
  }

  function closeChatAppearanceSheet() {
    var mask = document.getElementById('chat-appearance-mask');
    if (mask) mask.classList.remove('open');
  }

  function switchChatAppearanceSide(side) {
    currentSide = side === 'bot' ? 'bot' : 'self';
    renderChatAppearanceSheet();
  }

  function charIdForPreview() { return activeCharId(); }

  function previewBubbleText(side) {
    return side === 'self' ? '嗯，我在听。' : ('今晚想听你弹琴。');
  }

  function renderChatAppearanceSheet() {
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    var sub = document.getElementById('ca-sub');
    if (sub) sub.textContent = '只对「' + charName(id) + '」生效，其他角色互不影响';
    var tabs = document.querySelectorAll('.ca-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-side') === currentSide);
    });
    var body = document.getElementById('ca-body');
    if (!body) return;

    var frameId = frameIdForSide(ap, currentSide);
    var frame = findChatFrame(frameId);
    var selfAvatar = getChatSelfAvatar(id);
    var botAvatar = getChatBotAvatar(id);
    var avatarVisible = readAvatarVisible();
    var avatarUrl = currentSide === 'self' ? selfAvatar : botAvatar;
    var avatarFallback = currentSide === 'self'
      ? (window.userRemarkForChar ? window.userRemarkForChar(id) : 'user')
      : charName(id);
    var previewFrame = frameHtml(frame, ap, currentSide);
    var shape = ap.avatarShape;
    var frameDisabled = shape !== 'circle';
    var slots = frame ? (frame.slots || 0) : 0;
    var textOne = currentSide === 'self' ? ap.selfFrameText1 : ap.botFrameText1;
    var textTwo = currentSide === 'self' ? ap.selfFrameText2 : ap.botFrameText2;

    var frameCards = '<button type="button" class="ca-frame-card ' + (!frame ? 'active' : '') + '" onclick="selectChatAppearanceFrame(\'\')">' +
      '<span class="ca-frame-none">无框</span><span class="ca-frame-name">干净头像</span></button>' +
      allChatFrames().map(function (f) {
        var active = frameId === f.id;
        var previewAp = Object.assign({}, ap);
        if (currentSide === 'self') {
          previewAp.selfFrameText1 = getFrameDefaultText(f, 0);
          previewAp.selfFrameText2 = getFrameDefaultText(f, 1);
        } else {
          previewAp.botFrameText1 = getFrameDefaultText(f, 0);
          previewAp.botFrameText2 = getFrameDefaultText(f, 1);
        }
        var preview = avatarBoxHtml(avatarUrl, avatarFallback, f, previewAp, currentSide, 'ca-frame-preview-avatar');
        return '<button type="button" class="ca-frame-card ' + (active ? 'active' : '') + ' ' + (frameDisabled ? 'disabled' : '') + '" ' +
          (frameDisabled ? 'disabled' : '') + ' onclick="selectChatAppearanceFrame(\'' + escapeHtml(f.id) + '\')">' +
          '<span class="ca-frame-thumb">' + preview + '</span>' +
          '<span class="ca-frame-name">' + escapeHtml(f.name) + '</span>' +
        '</button>';
      }).join('');

    var textSlotsHtml = '';
    if (frame && slots > 0) {
      textSlotsHtml += '<div class="ca-text-slots">' +
        '<label class="ca-text-label">框上文案 1' +
          '<input type="text" maxlength="16" value="' + escapeHtml(textOne) + '" placeholder="' + escapeHtml(getFrameDefaultText(frame, 0) || '留空就只显示框') + '" oninput="setChatAppearanceFrameText(1, this.value)" />' +
        '</label>';
      if (slots > 1) {
        textSlotsHtml += '<label class="ca-text-label">框上文案 2' +
          '<input type="text" maxlength="16" value="' + escapeHtml(textTwo) + '" placeholder="' + escapeHtml(getFrameDefaultText(frame, 1) || '留空就只显示框') + '" oninput="setChatAppearanceFrameText(2, this.value)" />' +
        '</label>';
      } else {
        textSlotsHtml += '<div class="ca-text-tip">这款只有一个文案位；清空后只显示框。</div>';
      }
      textSlotsHtml += '</div>';
    }

    var userBg = ap.userBg || '';
    var userText = ap.userText || '';
    var botBg = ap.botBg || '';
    var botText = ap.botText || '';
    var sideBg = currentSide === 'self' ? userBg : botBg;
    var sideText = currentSide === 'self' ? userText : botText;
    var previewAvatarHtml = avatarVisible
      ? avatarBoxHtml(avatarUrl, avatarFallback, frame, ap, currentSide, 'ca-preview-avatar')
      : '';

    body.innerHTML =
      '<div class="ca-preview">' +
        '<div class="ca-preview-row ' + (currentSide === 'self' ? 'is-user' : 'is-bot') + (avatarVisible ? '' : ' is-no-avatar') + '">' +
          previewAvatarHtml +
          '<div class="ca-preview-bubble' + (ap.preset === 'sms' ? ' is-sms' : '') + '">' + escapeHtml(previewBubbleText(currentSide)) + '</div>' +
        '</div>' +
        '<div class="ca-preview-tip">' + (avatarVisible ? (frame ? ('当前：' + escapeHtml(frame.name)) : '当前：无框') : '当前：不显示头像') + (shape === 'square' && avatarVisible ? ' · 圆角方形下头像框自动隐藏' : '') + '</div>' +
      '</div>' +

      '<div class="ca-section">' +
        '<div class="ca-section-title">头像显示</div>' +
        '<div class="ca-seg">' +
          '<button type="button" class="' + (avatarVisible ? 'active' : '') + '" onclick="setChatAvatarVisible(true)">显示头像</button>' +
          '<button type="button" class="' + (!avatarVisible ? 'active' : '') + '" onclick="setChatAvatarVisible(false)">不显示头像</button>' +
        '</div>' +
        '<div class="ca-inline-tip">整个聊天统一生效，不跟角色走；关掉后头像和头像框一起收起。</div>' +
      '</div>' +

      '<div class="ca-section">' +
        '<div class="ca-section-title">头像</div>' +
        '<div class="ca-avatar-row">' +
          '<div class="ca-avatar-current">' + avatarBoxHtml(avatarUrl, avatarFallback, null, ap, currentSide, 'ca-avatar-current-box') + '</div>' +
          '<div class="ca-avatar-info"><div class="ca-avatar-name">' + escapeHtml(currentSide === 'self' ? '我的头像' : (charName(id) + '的头像')) + '</div>' +
            '<div class="ca-avatar-hint">' + (currentSide === 'self' ? '只在这个角色这里换，不会影响别的角色。' : '角色头像从头像库按情绪挑，聊天里也能主动请求换。') + '</div></div>' +
          '<button type="button" class="ca-small-btn" onclick="openChatAvatarPicker(\'' + currentSide + '\')">选择</button>' +
        '</div>' +
      '</div>' +

      '<div class="ca-section">' +
        '<div class="ca-section-title">头像形状</div>' +
        '<div class="ca-seg">' +
          '<button type="button" class="' + (shape === 'circle' ? 'active' : '') + '" onclick="setChatAppearanceShape(\'circle\')">正圆</button>' +
          '<button type="button" class="' + (shape === 'square' ? 'active' : '') + '" onclick="setChatAppearanceShape(\'square\')">圆角方形</button>' +
        '</div>' +
        '<div class="ca-inline-tip">' + (shape === 'circle' ? '头像框只在正圆时显示。' : '已切到圆角方形：头像框全部隐藏，切回正圆会自动恢复。') + '</div>' +
      '</div>' +

      '<div class="ca-section">' +
        '<div class="ca-section-title">头像框</div>' +
        '<div class="ca-frame-grid">' + frameCards + '</div>' +
        (frameDisabled ? '<div class="ca-frame-warn">圆角方形不能用头像框；先切回正圆再选。</div>' : '') +
        textSlotsHtml +
        '<button type="button" class="ca-import-btn" onclick="importChatFrame()">＋ 导入头像框</button>' +
        '<div class="ca-inline-tip">导入的头像框会缓存在本地，之后所有角色都能选；每个角色只记住自己用了哪一款。</div>' +
      '</div>' +

      '<div class="ca-section">' +
        '<div class="ca-section-title">气泡</div>' +
        '<div class="ca-preset-row">' +
          ['plain:素净', 'ig:IG', 'qq:QQ气泡', 'wa:WhatsApp'].map(function (item) {
            var key = item.split(':')[0];
            var label = item.split(':')[1];
            return '<button type="button" class="' + (ap.preset === key ? 'active' : '') + '" onclick="setChatAppearancePreset(\'' + key + '\')">' + label + '</button>';
          }).join('') +
        '</div>' +
        '<div class="ca-slider-row"><span>字号</span><input type="range" min="12" max="30" step="1" value="' + ap.fontSize + '" oninput="setChatAppearanceNumber(\'fontSize\', this.value)" /><b>' + ap.fontSize + 'px</b></div>' +
        '<div class="ca-slider-row"><span>头像</span><input type="range" min="24" max="56" step="2" value="' + ap.avatarSize + '" oninput="setChatAppearanceNumber(\'avatarSize\', this.value)" /><b>' + ap.avatarSize + 'px</b></div>' +
        '<div class="ca-seg ca-rhythm">' +
          '<button type="button" class="' + (ap.avatarMode === 'message' ? 'active' : '') + '" onclick="setChatAppearanceAvatarMode(\'message\')">每条消息</button>' +
          '<button type="button" class="' + (ap.avatarMode === 'round' ? 'active' : '') + '" onclick="setChatAppearanceAvatarMode(\'round\')">每轮消息</button>' +
        '</div>' +
        '<div class="ca-color-row"><span>我的气泡</span><input type="color" value="' + escapeHtml(userBg || '#d8e7ff') + '" oninput="setChatAppearanceColor(\'userBg\', this.value)" /><input type="color" value="' + escapeHtml(userText || '#1b1b1f') + '" oninput="setChatAppearanceColor(\'userText\', this.value)" /><button type="button" onclick="resetChatAppearanceColor(\'self\')">跟随主题</button></div>' +
        '<div class="ca-color-row"><span>对方气泡</span><input type="color" value="' + escapeHtml(botBg || '#ffffff') + '" oninput="setChatAppearanceColor(\'botBg\', this.value)" /><input type="color" value="' + escapeHtml(botText || '#1b1b1f') + '" oninput="setChatAppearanceColor(\'botText\', this.value)" /><button type="button" onclick="resetChatAppearanceColor(\'bot\')">跟随主题</button></div>' +
        '<div class="ca-inline-tip">颜色不选就跟随主题；这里改的只对当前角色生效。</div>' +
      '</div>';
    syncChatAppearanceEntry();
  }

  function setChatAppearanceShape(shape) {
    if (shape !== 'circle' && shape !== 'square') return;
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    ap.avatarShape = shape;
    saveChatAppearance(ap);
    applyChatAppearance(id);
    renderChatAppearanceSheet();
  }

  function setChatAvatarVisible(visible) {
    saveAvatarVisible(!!visible);
    applyChatAppearance(activeCharId());
    renderChatAppearanceSheet();
  }

  function setChatAppearancePreset(key) {
    if (!PRESET_STYLE[key]) return;
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    ap.preset = key;
    saveChatAppearance(ap);
    applyChatAppearance(id);
    renderChatAppearanceSheet();
  }

  function setChatAppearanceNumber(field, value) {
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    var n = Math.round(Number(value));
    if (!isFinite(n)) return;
    if (field === 'fontSize') n = Math.min(30, Math.max(12, n));
    else if (field === 'avatarSize') n = Math.min(56, Math.max(24, n));
    else return;
    ap[field] = n;
    saveChatAppearance(ap);
    applyChatAppearance(id);
    var body = document.getElementById('ca-body');
    if (body) {
      var rows = body.querySelectorAll('.ca-slider-row b');
      if (rows && rows.length >= 2) {
        rows[0].textContent = ap.fontSize + 'px';
        rows[1].textContent = ap.avatarSize + 'px';
      }
    }
  }

  function setChatAppearanceAvatarMode(mode) {
    if (mode !== 'message' && mode !== 'round') return;
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    ap.avatarMode = mode;
    saveChatAppearance(ap);
    applyChatAppearance(id);
    renderChatAppearanceSheet();
  }

  function setChatAppearanceColor(field, value) {
    if (field !== 'userBg' && field !== 'userText' && field !== 'botBg' && field !== 'botText') return;
    if (value && !/^#[0-9a-fA-F]{6}$/.test(value)) return;
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    ap[field] = value;
    saveChatAppearance(ap);
    applyChatAppearance(id);
  }

  function resetChatAppearanceColor(side) {
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    if (side === 'self') {
      ap.userBg = '';
      ap.userText = '';
    } else {
      ap.botBg = '';
      ap.botText = '';
    }
    saveChatAppearance(ap);
    applyChatAppearance(id);
    renderChatAppearanceSheet();
  }

  function selectChatAppearanceFrame(frameId) {
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    if (ap.avatarShape !== 'circle' && frameId) return;
    var frame = findChatFrame(frameId);
    if (currentSide === 'self') {
      ap.selfFrame = frame ? frame.id : '';
      if (frame) {
        if (!String(ap.selfFrameText1 || '').trim()) ap.selfFrameText1 = getFrameDefaultText(frame, 0);
        if (frame.slots > 1 && !String(ap.selfFrameText2 || '').trim()) ap.selfFrameText2 = getFrameDefaultText(frame, 1);
      }
    } else {
      ap.botFrame = frame ? frame.id : '';
      if (frame) {
        if (!String(ap.botFrameText1 || '').trim()) ap.botFrameText1 = getFrameDefaultText(frame, 0);
        if (frame.slots > 1 && !String(ap.botFrameText2 || '').trim()) ap.botFrameText2 = getFrameDefaultText(frame, 1);
      }
    }
    saveChatAppearance(ap);
    applyChatAppearance(id);
    renderChatAppearanceSheet();
  }

  function setChatAppearanceFrameText(slot, value) {
    var id = activeCharId();
    if (!id) return;
    var ap = ensureChatAppearance(id);
    var text = String(value || '').slice(0, 16);
    if (currentSide === 'self') {
      if (slot === 1) ap.selfFrameText1 = text;
      else ap.selfFrameText2 = text;
    } else {
      if (slot === 1) ap.botFrameText1 = text;
      else ap.botFrameText2 = text;
    }
    saveChatAppearance(ap);
    var preview = document.querySelector('.ca-preview-row');
    if (preview) {
      var oldCaf = preview.querySelector('.caf');
      if (oldCaf) oldCaf.remove();
      var frame = findChatFrame(frameIdForSide(ap, currentSide));
      if (frame) {
        var box = preview.querySelector('.msg-avatar-box');
        if (box) {
          var temp = document.createElement('div');
          temp.innerHTML = frameHtml(frame, ap, currentSide);
          if (temp.firstElementChild) box.appendChild(temp.firstElementChild);
        }
      }
    }
  }

  function openChatAvatarPicker(side) {
    pickerSide = side === 'bot' ? 'bot' : 'self';
    var id = activeCharId();
    var title = document.getElementById('ca-avatar-picker-title');
    if (title) title.textContent = pickerSide === 'self' ? '选择我的头像' : ('选择' + charName(id) + '的头像');
    var grid = document.getElementById('ca-avatar-grid');
    if (!grid) return;
    var items = [];
    if (pickerSide === 'self') {
      items = readMomoVaultList();
      var current = getChatSelfAvatar(id);
      if (!items.length && current) items = [{ id: 'current', name: '当前头像', url: current }];
    } else {
      items = (typeof window.loadCharVaultList === 'function') ? (window.loadCharVaultList(id) || []) : [];
      var cur = getChatBotAvatar(id);
      if (!items.length && cur) items = [{ id: 'current', name: '当前头像', url: cur }];
    }
    grid.innerHTML = items.length ? items.map(function (it) {
      var url = it.url || it.base64 || '';
      var label = pickerSide === 'self' ? (it.name || it.emotion || '头像') : (it.emotion || it.tag || it.name || '头像');
      return '<button type="button" class="ca-avatar-choice" onclick="pickChatAvatar(\'' + escapeHtml(it.id || '') + '\',\'' + escapeHtml(url) + '\')">' +
        '<img src="' + escapeHtml(url) + '" alt="" />' +
        '<span>' + escapeHtml(label) + '</span>' +
      '</button>';
    }).join('') : '<div class="ca-picker-empty">头像库还没有这个角色的头像。先去头像库上传一张。</div>';
    var picker = document.getElementById('ca-avatar-picker');
    if (picker) picker.style.display = 'block';
  }

  function closeChatAvatarPicker() {
    var picker = document.getElementById('ca-avatar-picker');
    if (picker) picker.style.display = 'none';
  }

  function pickChatAvatar(itemId, url) {
    if (!url && !itemId) return;
    var id = activeCharId();
    if (pickerSide === 'self') {
      var ap = ensureChatAppearance(id);
      if (itemId && itemId !== 'current') {
        ap.selfAvatarId = itemId;
        ap.selfAvatar = '';
      } else if (url) {
        ap.selfAvatar = url;
      }
      saveChatAppearance(ap);
      applyChatAppearance(id);
    } else if (typeof window.applyCharacterAvatar === 'function') {
      window.applyCharacterAvatar(id, url);
    }
    closeChatAvatarPicker();
    renderChatAppearanceSheet();
  }

  function openChatAvatarVault() {
    closeChatAppearanceSheet();
    if (typeof window.openPage === 'function') window.openPage('page-avatar-vault');
    if (typeof window.switchVaultTab === 'function') {
      setTimeout(function () { window.switchVaultTab(pickerSide === 'self' ? 'momo' : 'xuyan'); }, 120);
    }
  }

  function importChatFrame() {
    var input = document.getElementById('ca-frame-file');
    if (input) {
      input.value = '';
      input.click();
    }
  }

  function handleChatFrameFile(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (evt) {
      var dataUrl = evt.target.result;
      var img = new Image();
      img.onload = function () {
        try {
          var max = 512;
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = Math.min(1, max / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          var ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var out = canvas.toDataURL('image/png');
          addImportedChatFrame(out);
        } catch (e) {
          addImportedChatFrame(dataUrl);
        }
      };
      img.onerror = function () { addImportedChatFrame(dataUrl); };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function addImportedChatFrame(dataUrl) {
    var name = window.prompt('给这个头像框起个名字（会出现在所有角色的框列表里）', '自定义框');
    if (name === null) return;
    name = String(name || '').trim() || ('自定义框 ' + (getImportedFrames().length + 1));
    var baseName = name;
    var n = 2;
    while (findChatFrameByName(name)) {
      name = baseName + ' ' + n;
      n += 1;
    }
    var list = getImportedFrames().slice();
    var id = 'frame_user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    list.push({ id: id, name: name, type: 'image', url: dataUrl, slots: 2, defaults: ['', ''], desc: '用户导入的头像框' });
    saveImportedFrames(list);
    selectChatAppearanceFrame(id);
  }

  function framePreviewHtml(frameId, side, avatarUrl, appearance) {
    var frame = findChatFrame(frameId);
    return avatarBoxHtml(avatarUrl || '', '', frame, appearance || getChatAppearance(activeCharId()), side || 'bot', 'ca-frame-modal-avatar');
  }

  function askChatFrameChange(charId, frame, text1, text2) {
    if (!frame) return Promise.resolve(false);
    if (pendingFrameResolve) {
      var old = pendingFrameResolve;
      pendingFrameResolve = null;
      old(false);
    }
    var ap = getChatAppearance(charId);
    if (ap.avatarShape !== 'circle') return Promise.resolve(false);
    var modal = document.getElementById('chat-frame-change-modal');
    if (!modal) {
      return Promise.resolve(window.confirm('想把头像框换成「' + frame.name + '」，同意吗？'));
    }
    pendingFrameMeta = { charId: charId, frame: frame };
    var newAp = Object.assign({}, ap);
    newAp.botFrameText1 = (text1 !== undefined && String(text1).trim()) ? String(text1).trim() : getFrameDefaultText(frame, 0);
    newAp.botFrameText2 = (text2 !== undefined && String(text2).trim()) ? String(text2).trim() : getFrameDefaultText(frame, 1);
    var nameEl = document.getElementById('chat-frame-change-name');
    var textEl = document.getElementById('chat-frame-change-text');
    var oldEl = document.getElementById('chat-frame-change-old');
    var newEl = document.getElementById('chat-frame-change-new');
    if (nameEl) nameEl.textContent = charName(charId) + '想换头像框';
    if (textEl) textEl.textContent = '换成「' + frame.name + '」';
    if (oldEl) oldEl.innerHTML = framePreviewHtml(ap.botFrame, 'bot', getChatBotAvatar(charId), ap);
    if (newEl) newEl.innerHTML = framePreviewHtml(frame.id, 'bot', getChatBotAvatar(charId), newAp);
    modal.classList.add('open');
    return new Promise(function (resolve) { pendingFrameResolve = resolve; });
  }

  function resolveChatFrameChange(agree) {
    var modal = document.getElementById('chat-frame-change-modal');
    if (modal) modal.classList.remove('open');
    var resolve = pendingFrameResolve;
    pendingFrameResolve = null;
    var meta = pendingFrameMeta;
    pendingFrameMeta = null;
    if (resolve) resolve(!!agree);
  }

  function applyChatFrameToBot(charId, frameId, text1, text2, skipReload) {
    var id = charId || activeCharId();
    var ap = ensureChatAppearance(id);
    var frame = findChatFrame(frameId);
    ap.botFrame = frame ? frame.id : '';
    if (frame) {
      if (text1 !== undefined && String(text1).trim()) ap.botFrameText1 = String(text1).trim();
      else if (!String(ap.botFrameText1 || '').trim()) ap.botFrameText1 = getFrameDefaultText(frame, 0);
      if (text2 !== undefined && String(text2).trim()) ap.botFrameText2 = String(text2).trim();
      else if (frame.slots > 1 && !String(ap.botFrameText2 || '').trim()) ap.botFrameText2 = getFrameDefaultText(frame, 1);
    }
    saveChatAppearance(ap);
    applyChatAppearance(id);
    if (!skipReload && typeof window.loadChatHistory === 'function') window.loadChatHistory();
    return true;
  }

  function parseFrameCommand(value) {
    var parts = String(value || '').split('|').map(function (s) { return s.trim(); });
    return {
      name: parts[0] || '',
      text1: parts[1] || '',
      text2: parts[2] || ''
    };
  }

  // 首屏恢复一次：等其它模块都准备好
  function boot() {
    var id = activeCharId();
    if (id) applyChatAppearance(id);
    syncChatAppearanceEntry();
    var input = document.getElementById('ca-frame-file');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'ca-frame-file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.onchange = handleChatFrameFile;
      document.body.appendChild(input);
    }
  }

  window.getChatAppearance = getChatAppearance;
  window.ensureChatAppearance = ensureChatAppearance;
  window.saveChatAppearance = saveChatAppearance;
  window.updateChatAppearance = updateChatAppearance;
  window.applyChatAppearance = applyChatAppearance;
  window.getChatSelfAvatar = getChatSelfAvatar;
  window.getChatBotAvatar = getChatBotAvatar;
  window.createChatAvatarBox = createChatAvatarBox;
  window.allChatFrames = allChatFrames;
  window.findChatFrame = findChatFrame;
  window.findChatFrameByName = findChatFrameByName;
  window.getChatFramePromptText = getChatFramePromptText;
  window.parseFrameCommand = parseFrameCommand;
  window.openChatAppearanceSheet = openChatAppearanceSheet;
  window.closeChatAppearanceSheet = closeChatAppearanceSheet;
  window.switchChatAppearanceSide = switchChatAppearanceSide;
  window.setChatAppearanceShape = setChatAppearanceShape;
  window.setChatAvatarVisible = setChatAvatarVisible;
  window.setChatAppearancePreset = setChatAppearancePreset;
  window.setChatAppearanceNumber = setChatAppearanceNumber;
  window.setChatAppearanceAvatarMode = setChatAppearanceAvatarMode;
  window.setChatAppearanceColor = setChatAppearanceColor;
  window.resetChatAppearanceColor = resetChatAppearanceColor;
  window.selectChatAppearanceFrame = selectChatAppearanceFrame;
  window.setChatAppearanceFrameText = setChatAppearanceFrameText;
  window.openChatAvatarPicker = openChatAvatarPicker;
  window.closeChatAvatarPicker = closeChatAvatarPicker;
  window.pickChatAvatar = pickChatAvatar;
  window.openChatAvatarVault = openChatAvatarVault;
  window.importChatFrame = importChatFrame;
  window.handleChatFrameFile = handleChatFrameFile;
  window.framePreviewHtml = framePreviewHtml;
  window.askChatFrameChange = askChatFrameChange;
  window.resolveChatFrameChange = resolveChatFrameChange;
  window.applyChatFrameToBot = applyChatFrameToBot;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 60); });
  } else {
    setTimeout(boot, 60);
  }
})();
