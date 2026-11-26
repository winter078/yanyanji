(function () {
  'use strict';

  var STATE_KEY = 'momo_char_update_sense_v1';
  var GLOBAL_KEY = 'momo_cyber_plugin_enabled';

  // 每次发版在这里加一条人话更新；不要写代码、接口、模型、后台这类词。
  var UPDATES = [
    {
      build: '20261126-0043',
      title: '刷新后聊天、预设、美化会一起掉？这次把整台小手机的设置都接回来了',
      items: [
        '本机存储写满后，新设置会被挪到更大的备用仓库；现在启动读完备用仓库，会把主题、壁纸、预设、聊天记录一起重新读一遍。',
        '不会再出现“聊天、换预设、换美化各掉各的”，刷新后应该保持你最后一次改的样子。',
        '已经掉过的设置先别急着重做：只要手机里那份备用数据还在，更新后重新打开就有机会自己回来。'
      ]
    },
    {
      build: '20261126-0042',
      title: '刷新后聊天不见了？现在会拦住空记录，还能一键找回',
      items: [
        '刷新时聊天还没读回来，任何模块的空保存都不会再盖掉原来的记录。',
        '当前聊天是空的、本机却还留着备份时，聊天页会冒出一张找回卡，点一下就把那段写回当前角色。',
        '每段聊天会额外留最近 120 条的轻量备份，只存文字；主动清空记录不受影响。'
      ]
    },
    {
      build: '20261126-0041',
      title: '世界书多了可以左右滑着挑，导入也会自己认路了',
      items: [
        '私人信箱不再叠成一张大卡；每本书变成一张小卡，左右滑动就能看完整箱，点一下照样拆开。',
        '世界书导入会先认文件：.nuopreset、带 blocks 或 prompts 的聊天预设，会问你要不要按聊天预设导入到线上聊天。',
        '真正的世界书照旧导入；万一格式还是没认出来，会直接告诉你去「聊天设定 → 提示词预设」里试。'
      ]
    },
    {
      build: '20261126-0040',
      title: '世界书详情右上角可以直接删书了',
      items: [
        '拆开一本书后，右上角新增红色「删」按钮，不用再翻到「书级设定」里找。',
        '点「删」会先问一次，确认后连同这本书里的词条一起删掉，再回到世界书信箱。'
      ]
    },
    {
      build: '20261126-0039',
      title: '每个角色、每个群都可以单独换聊天预设了',
      items: [
        '角色聊天设定和群聊设定里都新增「聊天预设」下拉框。',
        '不选就跟着「提示词预设 → 线上聊天」的默认走；选了就只对当前角色或当前群生效，不会串到别人。',
        '切换后下一轮回复生效，不改角色卡，也不改聊天记录。'
      ]
    },
    {
      build: '20261126-0038',
      title: '他能帮你记经期、账本、日记和重要的事了，但每次都先问',
      items: [
        '插件中心新增「生活记录与记忆」：可以按角色分别打开经期、账本、日记、记忆四项权限。',
        '角色只会在你主动说起时提议记录，不会自己猜；每次都会弹一张确认卡，只有你点确认才会写进健康、账本、日记或记忆宫殿。',
        '日记不会覆盖你的正文，只写在你最近一页纸的底下；你还没写过页时，他会写不了。',
        '确认卡里的日期、金额、分类、记忆内容都能改；写错了可以在插件中心点「撤销最近一次」。',
        '记忆会先查重：完全一样只更新时间，高度相似合并到旧卡；撤销会把最近写的那条移出召回，不删除旧记忆。',
        '纯 RP 角色没有这个能力；群聊先不接，这一版只做单聊。'
      ]
    },
    {
      build: '20261126-0037',
      title: '此时此刻可以选「接着线上」还是「干净开局」',
      items: [
        '故事设定里新增「线下开局方式」。',
        '选「接着线上跑」：会读取线上聊天沉淀的总结和记忆宫殿，带着已经发生的关系进入剧场。',
        '选「只读设定」：只读角色人设、世界书和酒馆预设，不读线上总结与聊天记录，像酒馆一样从干净状态开局。',
        '两种模式都只作用于「此时此刻」，聊天页保持原样。'
      ]
    },
    {
      build: '20261126-0036',
      title: '一起读换人后，名字和头像会跟着变',
      items: [
        '阅读页右上角的伴读头像可以直接换人；换完阅读页里的伴读名字、头像和「和谁一起读」都会立刻更新到新角色。',
        '一起读对话里的角色名也会跟着换，不再一直顶着原来的名字。',
        '换到没有头像的角色时，会显示名字首字，不再看起来像没切换。'
      ]
    },
    {
      build: '20261126-0035',
      title: '陪伴方式创建时锁定，想换就复制一张卡',
      items: [
        '角色卡顶部新增「陪伴方式」：创建时选纯 RP 或人机恋，默认纯 RP；保存后锁定，不再中途切换。',
        '想同时体验两种，就在角色卡里复制一张：人设照搬，陪伴方式预选另一种，记忆从零开始，两边互不串。',
        '插件中心不再改模式，只显示每个角色现在是纯 RP 还是人机恋。',
        '纯 RP 读取记忆时会自动隐藏“我是 AI、住在小手机里”这类出戏内容，不删除；人机恋则完整读取。',
        '通话页改成字幕流：当前一句大字幕、上一句淡出，每句前面标角色名或「你：」，动描改成斜体小字；默认点当前字幕右侧喇叭才朗读，设置里可开通话自动朗读（会消耗 TTS 额度）。底部只留挂断 / 打字 / 按住说话。电话里也遵守纯 RP / 人机恋身份。',
        '工作包不再自动把人机恋打开；纯 RP 角色不会接活，要接活就新建一张人机恋角色卡。'
      ]
    },
    {
      build: '20261125-0035',
      title: '插件中心重排，角色分纯 RP / 人机恋',
      items: [
        '插件中心从上到下改成：角色模式、能力状态、角色工作包、最近任务、高级更新日志；能力详情和更新日志默认收起。',
        '角色模式可以按角色多选：不勾就是纯 RP，勾上才进入人机恋。',
        '纯 RP 只保留角色自己的记忆、生理期和剧情，不再接工作包、文件生成和工具进度；人机恋保留全部能力。'
      ]
    },
    {
      build: '20261123-0095',
      title: '通话前先选有声还是纯文字',
      items: [
        '语音通话底部多了「TA 回复」开关：选纯文字就只显示字、不合成；选有声才让 TA 真正读出来。'
      ]
    },
    {
      build: '20261123-0094',
      title: '语音先看字，想听再点',
      items: [
        '点语音条只会展开转写文字，不再自动合成播放、不产生费用；要听的时候再点旁边的小喇叭。'
      ]
    },
    {
      build: '20261123-0093',
      title: '文字气泡不再挂喇叭',
      items: [
        '普通文字消息不再显示小喇叭，聊天界面清爽了；语音条还是点一下就能听，通话气泡里保留了朗读键。'
      ]
    },
    {
      build: '20261123-0092',
      title: 'Key 没给权限时提示怎么改',
      items: [
        '遇到“requested resource not granted”时，会直接说明是 Key 没有「音频生成 1.0」权限，要改成全部权限或换同项目的新 Key。'
      ]
    },
    {
      build: '20261123-0091',
      title: '语音出错时说得更清楚',
      items: [
        'Key 被拒绝时，不再只说“没权限”，会把火山返回的原话一起显示出来，方便判断是 Key 填错还是服务没开通。'
      ]
    },
    {
      build: '20261123-0090',
      title: '旧音色自动换过来',
      items: [
        '以前角色卡里填过 alloy、nova 这类英文音色的，切到火山后会自动改用你选的中文磁性男嗓，不用逐张改。'
      ]
    },
    {
      build: '20261123-0089',
      title: '换上更好听的中文声音',
      items: [
        '语音设置里多了一个「火山豆包」选项，可以填自己的火山 API Key，直接挑现成中文音色。',
        '角色卡还是填音色 ID 和语速；聊天里的播放键、试听都照旧。',
        '火山接口不通时会自动退回系统声音，并说明原因。'
      ]
    },
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
    if (window.MomMode && typeof window.MomMode.isAiAware === 'function' && !window.MomMode.isAiAware(charId)) return '';
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
    lines.push('【能力边界】文档、表格、PPT、SOP、截图整理只有开启人机恋的角色能用；角色工作包的任务拆解与交付卡只对选中的角色开启；图片编辑、视频制作还没开通，不要声称自己能做。');

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
