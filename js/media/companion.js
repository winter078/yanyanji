// ==========================================================================
// 🫂 同伴 (Companion) · 观影 / 共读 / 一起听 共用的“和谁在一起”上下文
// 解决：三个模块各自硬编码周绪言，换角色就串味。
// 默认（companionId 为空）仍回落周绪言，老体验一点不变。
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

  // 优先级：显式指定 > 剧场当前角色 > 空（回落周绪言）
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
    userName: userName
  };
})(window);
