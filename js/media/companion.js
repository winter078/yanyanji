// ==========================================================================
// 🫂 同伴 (Companion) · 观影 / 共读 / 一起听 共用的“和谁在一起”上下文
// 解决：三个模块各自硬编码周绪言，换角色就串味。
// 默认（companionId 为空）仍回落周绪言，老体验一点不变。
// 另外提供统一的选择弹层 Companion.openPicker()，三个模块共用一套 UI。
// ==========================================================================
(function (window) {
  'use strict';

  var DEFAULT_NAME = '周绪言';

  function appData() {
    return window.appData || {};
  }

  function userName() {
    var d = appData();
    var raw = (d.rpConfig && d.rpConfig.userRole) || d.userName || 'user';
    return String(raw).trim().split(/\s+/)[0] || 'user';
  }

  // 角色库来自微信侧 characters.js
  function all() {
    try {
      var list = (typeof window.getCharacters === 'function' && window.getCharacters()) || [];
      return list.filter(function (c) { return c && c.id && c.name; });
    } catch (e) {
      return [];
    }
  }

  function byId(id) {
    if (!id) return null;
    var list = all();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  // 优先级：显式指定 > 微信当前角色 > 空（回落周绪言）
  function resolve(preferId) {
    var hit = byId(preferId);
    if (hit) return hit;
    try {
      if (typeof window.getActiveCharacter === 'function') {
        var active = window.getActiveCharacter();
        if (active && active.id) return active;
      }
    } catch (e) {}
    return null;
  }

  function isDefault(char) {
    return !char || !char.id;
  }

  function displayName(char) {
    if (isDefault(char)) {
      var d = appData();
      return String(d.botRemark || DEFAULT_NAME).trim().split(/\s+/)[0] || DEFAULT_NAME;
    }
    return String(char.name || '').trim().split(/\s+/)[0] || DEFAULT_NAME;
  }

  function avatarOf(char) {
    if (isDefault(char)) {
      var d = appData();
      return d.botAvatar || '';
    }
    return char.avatar || '';
  }

  // 人设文本：prompt（角色灵魂指令）优先，其次 tag + intro
  function persona(char) {
    if (isDefault(char)) return '';
    var name = displayName(char);
    var u = userName();
    var parts = [];
    var prompt = String(char.prompt || '').trim();
    if (prompt) {
      parts.push(prompt.replace(/\{\{char\}\}/g, name).replace(/\{\{user\}\}/g, u));
    } else {
      var tag = String(char.tag || '').trim();
      var intro = String(char.intro || '').trim();
      if (tag) parts.push('身份：' + tag);
      if (intro) parts.push(intro);
    }
    var direct = String(char.directives || '').trim();
    if (direct) parts.push('【核心指令】' + direct.replace(/\{\{char\}\}/g, name).replace(/\{\{user\}\}/g, u));
    if (!parts.length) parts.push('按角色卡中的名字、性格与关系自然扮演。');
    return parts.join('\n');
  }

  // 关系一句话（拿不到就返回空）
  function relationLine(char) {
    if (isDefault(char) || !char.relations || !char.relations.length) return '';
    try {
      var r = char.relations[0];
      var who = r.name || r.to || '';
      var label = r.label || r.relation || r.type || '';
      if (!who) return '';
      return who + (label ? '（' + label + '）' : '');
    } catch (e) {
      return '';
    }
  }

  // ===== 统一选择弹层 =====
  var pickerEl = null;
  var pickerCb = null;
  var pickerCurrent = '';

  function closePicker() {
    if (pickerEl) pickerEl.style.display = 'none';
  }

  function ensurePicker() {
    if (pickerEl && pickerEl.parentNode) return pickerEl;
    pickerEl = document.createElement('div');
    pickerEl.id = 'companion-picker';
    pickerEl.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);';
    pickerEl.innerHTML = '<div style="width:100%;max-width:460px;max-height:76vh;overflow:auto;background:#1b1b1f;border-radius:20px 20px 0 0;padding:18px 16px 22px;box-shadow:0 -8px 30px rgba(0,0,0,.5);">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
      + '<div id="companion-picker-title" style="color:#f3e6d8;font-size:16px;font-weight:600;">和谁一起</div>'
      + '<button id="companion-picker-close" style="background:none;border:none;color:#9b8f84;font-size:20px;line-height:1;">×</button></div>'
      + '<div id="companion-picker-list"></div>'
      + '</div>';
    document.body.appendChild(pickerEl);
    pickerEl.addEventListener('click', function (e) { if (e.target === pickerEl) closePicker(); });
    var x = document.getElementById('companion-picker-close');
    if (x) x.addEventListener('click', closePicker);
    return pickerEl;
  }

  function renderPicker(opts) {
    var titleEl = document.getElementById('companion-picker-title');
    if (titleEl && opts.title) titleEl.textContent = opts.title;
    var box = document.getElementById('companion-picker-list');
    if (!box) return;

    var rows = [{ id: '', name: opts.defaultName || DEFAULT_NAME, tag: opts.defaultTag || '默认同伴', avatar: opts.defaultAvatar || '' }];
    all().forEach(function (c) {
      rows.push({ id: c.id, name: c.name, tag: c.tag || '', avatar: c.avatar || '' });
    });

    box.innerHTML = '';
    rows.forEach(function (r) {
      var row = document.createElement('div');
      var on = r.id === (pickerCurrent || '');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:12px;cursor:pointer;background:' + (on ? 'rgba(214,177,140,.14)' : 'transparent');
      var avatarHtml;
      if (r.avatar) {
        avatarHtml = '<img src="' + r.avatar + '" style="width:40px;height:40px;object-fit:cover;border-radius:50%;flex:none;">';
      } else {
        avatarHtml = '<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:#e7d9c9;flex:none;">' + (String(r.name).charAt(0) || '伴') + '</div>';
      }
      row.innerHTML = avatarHtml
        + '<div style="flex:1;min-width:0;"><div style="color:#f3e6d8;font-size:14px;">' + r.name + '</div>'
        + '<div style="color:#8d8177;font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (r.tag || '') + '</div></div>'
        + (on ? '<div style="color:#d6b18c;font-size:13px;">当前</div>' : '');
      row.addEventListener('click', function () {
        closePicker();
        if (pickerCb) pickerCb(r.id);
      });
      box.appendChild(row);
    });
  }

  // opts: { title, defaultName, defaultTag, defaultAvatar }
  function openPicker(currentId, onPick, opts) {
    opts = opts || {};
    ensurePicker();
    pickerCurrent = String(currentId || '');
    pickerCb = (typeof onPick === 'function') ? onPick : null;
    renderPicker(opts);
    pickerEl.style.display = 'flex';
  }

  // ===== 卡片接受状态（谁已经答应了这张邀请）=====
  var ACCEPT_KEY = 'momo_card_accept_v1';

  function cardKey(card) {
    if (!card) return '';
    return String(card.kind || '') + '|' + String(card.title || '');
  }

  function readAccepted() {
    try { return JSON.parse(localStorage.getItem(ACCEPT_KEY) || '{}'); } catch (e) { return {}; }
  }

  function markAccepted(card) {
    var k = cardKey(card);
    if (!k) return;
    var map = readAccepted();
    map[k] = Date.now();
    try { localStorage.setItem(ACCEPT_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function isAccepted(card) {
    if (!card || String(card.kind || '').indexOf('_invite') < 0) return false;
    return !!readAccepted()[cardKey(card)];
  }

  window.Companion = {
    DEFAULT_NAME: DEFAULT_NAME,
    list: all,
    byId: byId,
    resolve: resolve,
    isDefault: isDefault,
    displayName: displayName,
    avatarOf: avatarOf,
    persona: persona,
    relationLine: relationLine,
    userName: userName,
    openPicker: openPicker,
    closePicker: closePicker,
    cardKey: cardKey,
    markAccepted: markAccepted,
    isAccepted: isAccepted
  };
})(window);
