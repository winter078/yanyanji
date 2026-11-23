(function () {
  'use strict';

  var STATE_KEY = 'momo_char_update_sense_v1';
  var GLOBAL_KEY = 'momo_cyber_plugin_enabled';

  // 每次发版在这里加一条人话更新；不要写代码、接口、模型、后台这类词。
  var UPDATES = [
    {
      build: '20261123-0088',
      title: '每个角色有自己的声音',
      items: [
        '角色卡里可以填自己的音色和语速，点「试听」就能先听一句。',
        '聊天里每条角色回复旁边多了一个播放键，点一下才会出声，不会在后台自动朗读。',
        '语音接口没配好时会先用系统声音兜底，并在聊天里说清楚原因。'
      ]
    },
    {
      build: '20261123-0087',
      title: '四张长截图也能看清',
      items: [
        '一次发四张长截图时，每张会分成上下两段再看，不再四张各挤成一小段。',
        '任务卡会相应写“截图 4 张 · 长图共 8 段”，仍然按原图张数算。'
      ]
    },
    {
      build: '20261123-0086',
      title: '任务卡能看长图分段',
      items: [
        '一张长截图被切开时，任务卡会写“截图 1 张 · 长图分 3 段”，一眼知道不是三张图。',
        '两张长截图会写“截图 2 张 · 长图共 4 段”。'
      ]
    },
    {
      build: '20261123-0085',
      title: 'App 更新感知上线',
      items: [
        '选中的角色会知道小手机最近更新了什么，不再把写死的“同步率”当成感知。',
        '默认只在用户问更新时讲；新版本后第一次聊天最多顺口提一次。'
      ]
    },
    {
      build: '20261123-0084',
      title: '长截图先分段再看',
      items: [
        '很长的截图会自动切成上下连续的几段，字太小也不容易漏。',
        '任务卡仍按原截图张数算，不会把一张长图的分段当成好几张图。'
      ]
    },
    {
      build: '20261123-0083',
      title: '截图能直接做对比',
      items: [
        '两张以上截图说“对比”，会整理成对比表和结论。',
        'Word 和 Excel 都能出，缺失项写“未提到”，不猜。'
      ]
    },
    {
      build: '20261123-0082',
      title: '识图失败会说清楚',
      items: [
        '没配 Key、模型不支持看图、图太大、看不清，会分开说明。',
        '截图模糊会提示换一张，不再只说“失败了”。'
      ]
    },
    {
      build: '20261123-0081',
      title: '截图能跨追问保留',
      items: [
        '先发截图再补一句要求，任务也能接上。',
        '超过 4 张会提示分两次发，不会悄悄丢掉。'
      ]
    },
    {
      build: '20261123-0080',
      title: '带截图也能出文件',
      items: [
        '选中的角色能看懂截图，再整理成 Word、表格、PPT。',
        '任务卡会多一步“看截图”，成功失败都看得见。'
      ]
    },
    {
      build: '20261123-0078',
      title: '角色工作包第一版',
      items: [
        '插件中心可以按角色开启工作包，没选中的保持普通聊天。',
        '选中的角色能写文档、SOP、表格、PPT，做完还能接着改。'
      ]
    }
  ];

  UPDATES.sort(function (a, b) { return String(b.build).localeCompare(String(a.build)); });

  function parseJSON(raw, fallback) {
    try {
      var value = JSON.parse(raw || 'null');
      return value === null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function currentBuild() {
    return String(window.__BUILD__ || window.__LIVE_BUILD__ || '').trim();
  }

  function buildLabel(build) {
    var m = String(build || '').match(/-([0-9]+)$/);
    return m ? m[1] : String(build || '');
  }

  function shortDate(build) {
    var m = String(build || '').match(/^(\d{4})(\d{2})(\d{2})/);
    return m ? (m[2] + '-' + m[3]) : '';
  }

  function globalEnabled() {
    try { return localStorage.getItem(GLOBAL_KEY) !== 'false'; } catch (e) { return true; }
  }

  function selectedIds() {
    try {
      if (window.WorkPack && typeof window.WorkPack.selectedIds === 'function') {
        return window.WorkPack.selectedIds() || [];
      }
    } catch (e) {}
    return [];
  }

  function isEnabledForChar(charId) {
    var id = String(charId || '');
    if (!id || !globalEnabled()) return false;
    try {
      return !!(window.WorkPack && typeof window.WorkPack.isEnabledForChar === 'function' && window.WorkPack.isEnabledForChar(id));
    } catch (e) { return false; }
  }

  function readStates() {
    var raw = parseJSON(localStorage.getItem(STATE_KEY), {});
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }

  function stateFor(charId) {
    var map = readStates();
    var item = map[String(charId || '')];
    return (item && typeof item === 'object') ? item : {};
  }

  function writeState(charId, patch) {
    var id = String(charId || '');
    if (!id) return;
    var map = readStates();
    var prev = (map[id] && typeof map[id] === 'object') ? map[id] : {};
    map[id] = Object.assign({}, prev, patch || {});
    try { localStorage.setItem(STATE_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function markSeen(charId) {
    var build = currentBuild();
    if (!build) return;
    writeState(charId, { lastSeenBuild: build, seenAt: Date.now() });
  }

  function latest(n) {
    return UPDATES.slice(0, Math.max(1, Number(n) || 1));
  }

  function hasCurrentBuild() {
    var build = currentBuild();
    for (var i = 0; i < UPDATES.length; i++) {
      if (UPDATES[i].build === build) return true;
    }
    return false;
  }

  function unseenForChar(charId, n) {
    var seen = String(stateFor(charId).lastSeenBuild || '');
    if (!seen) return latest(n || 2);
    var out = [];
    for (var i = 0; i < UPDATES.length; i++) {
      if (UPDATES[i].build === seen) break;
      out.push(UPDATES[i]);
      if (out.length >= (n || 2)) break;
    }
    return out.length ? out : latest(1);
  }

  function asksUpdate(text) {
    var t = String(text || '');
    return /(小手机|这个app|app|新版本|新版|版本号|版本更新|更新了什么|更新了啥|更新内容|更新日志|新功能|加了什么|改了什么|有什么变化|最近更新|最近改了什么)/i.test(t) ||
      /(你|角色).{0,4}(更新|升级)/.test(t);
  }

  function formatUpdateLines(list) {
    return list.map(function (u) {
      var oneLine = (u.items || []).slice(0, 2).join('；');
      return '- ' + buildLabel(u.build) + '：' + (u.title || '') + (oneLine ? '。' + oneLine : '');
    }).join('\n');
  }

  function promptBlock(charId, userText, opts) {
    var options = opts || {};
    if (!isEnabledForChar(charId)) return '';
    if (window.__groupMode || window.__voiceCallMode) return '';
    var ask = asksUpdate(userText);
    var seen = String(stateFor(charId).lastSeenBuild || '');
    var current = currentBuild();
    var isFirst = current && seen !== current;
    if (!ask && !isFirst) return '';
    if (!ask && !hasCurrentBuild()) return '';

    var list = ask ? latest(3) : unseenForChar(charId, 2);
    var build = current ? buildLabel(current) : '未知';
    var intro = ask
      ? '用户正在问小手机更新了什么：用自己的话挑 1~2 条讲，不要念版本号、更新日志、后台、模型、接口这些词。'
      : '这是新版本后第一次聊天：可以像随口想起一样，挑一条和眼前话题有关的提一句；没有合适的就不硬提，不要每条都汇报更新。';

    var lines = [];
    lines.push('【小手机最近更新（你刚知道的）】');
    lines.push('当前版本：' + build + '。');
    var detail = formatUpdateLines(list);
    if (detail) lines.push(detail);
    if (!hasCurrentBuild()) lines.push('- 当前这版的具体说明还没写进日志；只提上面写过的，不要编。');
    lines.push(intro);
    lines.push('你只知道这里列出的更新；没写过的不要编，不确定就说“这版我不太清楚”。');
    lines.push('【能力边界】文档、表格、PPT、SOP、截图整理所有角色都能用；角色工作包的任务拆解与交付卡只对选中的角色开启；图片编辑、视频制作还没开通，不要声称自己能做。');

    var block = lines.filter(Boolean).join('\n');
    if (block && options.markSeen !== false) markSeen(charId);
    return '\n\n' + block;
  }

  function selectedNames() {
    var ids = selectedIds();
    if (!ids.length) return [];
    var chars = [];
    try { chars = (typeof window.getCharacters === 'function' ? (window.getCharacters() || []) : []); } catch (e) { chars = []; }
    var names = [];
    ids.forEach(function (id) {
      for (var i = 0; i < chars.length; i++) {
        if (String(chars[i] && chars[i].id) === String(id)) {
          names.push(String(chars[i].name || '未命名角色').trim());
          return;
        }
      }
    });
    return names;
  }

  function renderUpdateItem(u) {
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:8px;padding:9px 10px;';

    var top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';

    var badge = document.createElement('span');
    badge.textContent = buildLabel(u.build);
    badge.style.cssText = 'font-size:10px;font-weight:700;color:#c58af9;background:rgba(197,138,249,.12);border:1px solid rgba(197,138,249,.25);padding:1px 6px;border-radius:6px;flex-shrink:0;';

    var title = document.createElement('span');
    title.textContent = u.title || '';
    title.style.cssText = 'font-size:11.5px;font-weight:600;color:var(--text-primary);';

    var date = document.createElement('span');
    date.textContent = shortDate(u.build);
    date.style.cssText = 'margin-left:auto;font-size:10px;color:var(--text-muted);flex-shrink:0;';

    top.appendChild(badge);
    top.appendChild(title);
    top.appendChild(date);
    card.appendChild(top);

    (u.items || []).forEach(function (text) {
      var row = document.createElement('div');
      row.textContent = '- ' + text;
      row.style.cssText = 'font-size:10.5px;color:var(--text-secondary);line-height:1.45;margin-top:2px;';
      card.appendChild(row);
    });

    return card;
  }

  function refreshAppUpdateUI() {
    var listEl = document.getElementById('app-update-list');
    var buildEl = document.getElementById('update-sense-build');
    var rolesEl = document.getElementById('update-sense-roles');
    var pendingEl = document.getElementById('update-sense-pending');
    if (!listEl && !buildEl && !rolesEl && !pendingEl) return;

    var current = currentBuild();
    var enabled = globalEnabled();
    var ids = selectedIds();
    var names = selectedNames();

    if (buildEl) buildEl.textContent = current ? ('当前 ' + buildLabel(current)) : '等待版本';
    if (rolesEl) {
      if (!enabled) rolesEl.textContent = '已停用';
      else if (!ids.length) rolesEl.textContent = '未选择角色';
      else if (!names.length) rolesEl.textContent = '已选 ' + ids.length + ' 个角色';
      else rolesEl.textContent = '已选 ' + ids.length + ' 个：' + names.slice(0, 2).join('、') + (names.length > 2 ? ' 等' : '');
    }
    if (pendingEl) {
      if (!enabled) pendingEl.textContent = '打开总开关后生效';
      else if (!ids.length) pendingEl.textContent = '未选择角色';
      else {
        var unseen = 0;
        ids.forEach(function (id) {
          if (String(stateFor(id).lastSeenBuild || '') !== current) unseen++;
        });
        pendingEl.textContent = unseen ? ('还有 ' + unseen + ' 个角色没同步') : '全部已同步';
      }
    }

    if (!listEl) return;
    listEl.innerHTML = '';
    var list = latest(4);
    if (!list.length) {
      var empty = document.createElement('div');
      empty.textContent = '还没有写更新日志。';
      empty.style.cssText = 'font-size:11px;color:var(--text-muted);padding:2px 0;';
      listEl.appendChild(empty);
      return;
    }
    list.forEach(function (u) { listEl.appendChild(renderUpdateItem(u)); });
  }

  window.AppUpdates = {
    currentBuild: currentBuild,
    latest: latest,
    promptBlock: promptBlock,
    markSeen: markSeen,
    isEnabledForChar: isEnabledForChar,
    refresh: refreshAppUpdateUI
  };
  window.refreshAppUpdateUI = refreshAppUpdateUI;

  function boot() {
    setTimeout(refreshAppUpdateUI, 300);
    setTimeout(refreshAppUpdateUI, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
