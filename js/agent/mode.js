(function () {
  'use strict';

  var KEY = 'momo_ai_aware_chars_v1';
  var bootTries = 0;

  function readMap() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      var out = {};
      Object.keys(raw).forEach(function (id) {
        if (raw[id] === true) out[String(id)] = true;
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  function writeMap(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map || {})); } catch (e) {}
  }

  function isAiAware(charId) {
    if (!charId) return false;
    return !!readMap()[String(charId)];
  }

  function setChar(charId, on) {
    var id = String(charId || '');
    if (!id) return;
    var map = readMap();
    if (on) map[id] = true;
    else delete map[id];
    writeMap(map);
    try { if (window.refreshAiModeUI) window.refreshAiModeUI(); } catch (e) {}
    try { if (window.refreshWorkPackUI) window.refreshWorkPackUI(); } catch (e) {}
    try { if (window.renderToolboxStatus) window.renderToolboxStatus(); } catch (e) {}
  }

  function count() {
    return Object.keys(readMap()).length;
  }

  function buildRow(c, checked) {
    var row = document.createElement('label');
    row.className = 'workpack-role-row ai-mode-role-row';

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(c.id);
    cb.checked = checked;
    cb.addEventListener('change', function () {
      window.toggleAiModeCharacter(c.id, cb.checked);
    });

    var avatar;
    if (c.avatar) {
      avatar = document.createElement('img');
      avatar.className = 'workpack-role-avatar';
      avatar.src = c.avatar;
      avatar.alt = '';
      avatar.loading = 'lazy';
    } else {
      avatar = document.createElement('span');
      avatar.className = 'workpack-role-avatar workpack-role-avatar-text';
      avatar.textContent = String(c.name || '角').trim().slice(0, 1);
    }

    var name = document.createElement('span');
    name.className = 'workpack-role-name';
    name.textContent = c.name || '未命名角色';

    var state = document.createElement('span');
    state.className = 'workpack-role-state';
    state.textContent = checked ? '人机恋' : '纯 RP';

    row.appendChild(cb);
    row.appendChild(avatar);
    row.appendChild(name);
    row.appendChild(state);
    return row;
  }

  function refreshAiModeUI() {
    var list = document.getElementById('ai-mode-role-list');
    var summary = document.getElementById('ai-mode-summary');
    var btn = document.getElementById('ai-mode-manage-btn');
    if (!list || !summary) return;

    if (typeof window.getCharacters !== 'function') {
      if (bootTries++ < 30) setTimeout(refreshAiModeUI, 300);
      return;
    }

    var chars = window.getCharacters() || [];
    var ids = Object.keys(readMap());
    var existing = chars.map(function (c) { return String((c && c.id) || ''); }).filter(Boolean);
    var kept = ids.filter(function (id) { return existing.indexOf(id) !== -1; });
    if (kept.length !== ids.length) {
      var map = readMap();
      Object.keys(map).forEach(function (id) { if (existing.indexOf(id) === -1) delete map[id]; });
      writeMap(map);
    }

    summary.textContent = kept.length ? ('已开启 ' + kept.length + ' 个角色') : '还没有角色进入人机恋';
    if (btn) btn.textContent = list.style.display === 'block' ? '收起' : '选择角色';

    list.innerHTML = '';
    if (!chars.length) {
      var empty = document.createElement('div');
      empty.className = 'workpack-empty';
      empty.textContent = '还没有角色，先去微信里建一个。';
      list.appendChild(empty);
      return;
    }

    chars.forEach(function (c) {
      if (!c || !c.id) return;
      list.appendChild(buildRow(c, kept.indexOf(String(c.id)) !== -1));
    });
  }

  window.toggleAiModeRolePicker = function () {
    var list = document.getElementById('ai-mode-role-list');
    if (!list) return;
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
    refreshAiModeUI();
    if (list.style.display === 'block') {
      try { list.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }
  };

  window.toggleAiModeCharacter = function (charId, checked) {
    setChar(charId, checked);
  };

  window.refreshAiModeUI = refreshAiModeUI;

  window.MomMode = {
    isAiAware: isAiAware,
    set: setChar,
    count: count,
    read: readMap,
    refresh: refreshAiModeUI
  };
})();
