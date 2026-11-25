(function () {
  'use strict';

  // 运行事实层：只读当前 app 的真实状态，不写死“我会什么”。
  // 插件中心用它渲染状态栏，聊天用它生成一段给角色看的运行事实。

  function readLS(name) {
    try { return String(localStorage.getItem(name) || '').trim(); } catch (e) { return ''; }
  }

  function text(value) {
    return value == null ? '' : String(value).trim();
  }

  function has(value) {
    return !!text(value);
  }

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function app() {
    return window.appData || {};
  }

  function activeChar() {
    return safe(function () {
      return (typeof window.getActiveCharacter === 'function') ? window.getActiveCharacter() : null;
    }, null);
  }

  function activeMask() {
    return safe(function () {
      return (typeof window.getActiveMask === 'function') ? window.getActiveMask() : null;
    }, null);
  }

  function charId() {
    var c = activeChar();
    return c && c.id ? String(c.id) : '';
  }

  function charName() {
    var c = activeChar();
    return c && c.name ? String(c.name) : '';
  }

  function sceneMode() {
    if (window.__groupMode) return '群聊';
    if (window.__voiceCallMode) return '通话';
    return '单聊';
  }

  function currentPage() {
    var page = document.querySelector('.view-page.active');
    return page && page.id ? page.id : '';
  }

  function hostOf(url) {
    var raw = text(url);
    if (!raw) return '';
    try { return new URL(raw).host; } catch (e) {}
    var m = raw.match(/^https?:\/\/([^\/?#]+)/i);
    return m ? m[1] : '';
  }

  function modelInfo() {
    var a = app();
    var base = text(a.apiBase);
    var key = text(a.apiKey);
    return {
      chat: {
        model: text(a.model) || 'deepseek-chat',
        baseHost: hostOf(base),
        configured: !!(base && key)
      },
      vision: {
        model: text(a.visionModel),
        configured: !!text(a.visionModel)
      },
      reader: {
        model: text(a.readerModel),
        configured: !!text(a.readerModel)
      }
    };
  }

  function toolRows() {
    if (window.MomTools && typeof window.MomTools.status === 'function') {
      return safe(function () { return window.MomTools.status() || []; }, []);
    }
    var list = safe(function () {
      return (window.MomTools && typeof window.MomTools.list === 'function') ? (window.MomTools.list() || []) : [];
    }, []);
    return list.map(function (t) {
      return { name: t.name, label: t.label, ok: true, reason: '' };
    });
  }

  function makeCap(key, label, badge, state, detail, reason, group) {
    return {
      key: key,
      label: label,
      badge: badge,
      state: state,
      detail: detail || '',
      reason: reason || '',
      group: group || 'companion'
    };
  }

  function workPackInfo() {
    var cid = charId();
    var selected = [];
    if (window.WorkPack && typeof window.WorkPack.selectedIds === 'function') {
      selected = safe(function () { return window.WorkPack.selectedIds() || []; }, []);
    }
    return {
      on: !!(cid && window.WorkPack && safe(function () {
        return window.WorkPack.isEnabledForChar(cid);
      }, false)),
      selectedCount: Array.isArray(selected) ? selected.length : 0
    };
  }

  function buildCapabilities() {
    var a = app();
    var model = modelInfo();
    var cid = charId();
    var tools = toolRows();
    var okTools = tools.filter(function (t) { return !!t.ok; });
    var badTools = tools.filter(function (t) { return !t.ok; });

    var workPack = workPackInfo();
    var workPackOn = workPack.on;
    var artifactsReady = !!(window.MomArtifacts && typeof window.MomArtifacts.wantsFile === 'function');
    var docsReady = !!(model.chat.configured && workPackOn && artifactsReady);
    var docsReason = '';
    if (!model.chat.configured) docsReason = '主模型还没配好';
    else if (!cid) docsReason = '还没选角色';
    else if (!window.WorkPack) docsReason = '工作包模块没加载';
    else if (!workPackOn) docsReason = '当前角色没开工作包';
    else if (!artifactsReady) docsReason = '文件模块没加载';

    var searchDetail = '';
    if (!tools.length) {
      searchDetail = '工具注册表还没加载';
    } else if (!okTools.length) {
      searchDetail = '搜索 / 小红书 / 推特 / 天气都还没配';
    } else {
      searchDetail = '可用：' + okTools.map(function (t) { return t.label; }).join(' / ');
      if (badTools.length) searchDetail += '；缺：' + badTools.map(function (t) { return t.label; }).join(' / ');
    }
    var searchState = okTools.length ? (badTools.length ? 'partial' : 'ready') : 'off';
    var searchBadge = searchState === 'ready' ? '可用' : (searchState === 'partial' ? '部分' : '未配置');
    var searchReason = badTools.map(function (t) {
      return t.label + '：' + (t.reason || '当前不可用');
    }).join('；');

    var imageConfigured = !!safe(function () { return window.isCharacterImageConfigured(); }, false);
    var imageEnabled = !!(cid && safe(function () { return window.isCharacterImageEnabled(cid); }, false));
    var imageState = (imageConfigured && imageEnabled) ? 'ready' : 'off';
    var imageBadge = imageState === 'ready' ? '可用' : (!imageConfigured ? '未配置' : '本角色未开');
    var imageReason = !imageConfigured ? '生图线路还没配' : (!imageEnabled ? '当前角色没开生图' : '');

    var voiceOn = !!safe(function () { return window.CharVoice && window.CharVoice.isEnabled(); }, false);
    var voiceCfg = safe(function () {
      return (window.CharVoice && typeof window.CharVoice.getConfig === 'function') ? window.CharVoice.getConfig() : {};
    }, {});
    var voiceConfigured = !!(voiceCfg && ((voiceCfg.provider === 'volc' && voiceCfg.volcKey) || (voiceCfg.provider !== 'volc' && voiceCfg.baseUrl)));
    var voiceState = voiceOn ? 'ready' : 'off';
    var voiceBadge = voiceOn ? '已开' : (voiceCfg && voiceCfg.enabled ? '未配置' : '未开启');
    var voiceReason = voiceOn ? '' : (voiceCfg && voiceCfg.enabled ? '语音线路没配好' : '角色语音没开启');

    var musicModule = !!(window.searchMusicOnline || window.initMusicPlayer);
    var musicCookie = readLS('momo_netease_cookie');
    var musicNick = readLS('momo_netease_nick');
    var musicState = !musicModule ? 'off' : (musicCookie ? 'ready' : 'partial');
    var musicBadge = !musicModule ? '未加载' : (musicCookie ? '已登录' : '未登录');
    var musicDetail = musicCookie && musicNick ? ('网易云 · ' + musicNick) : '网易云 · 搜索 / 播放';
    var musicReason = musicCookie ? '' : '未登录网易云，会员歌不能播';

    var memoryModule = !!window.MemoryEngine;
    var memoryCount = Array.isArray(a.palaceMemories) ? a.palaceMemories.length : 0;
    var historyCount = Array.isArray(a.chatHistory) ? a.chatHistory.length : 0;
    var depth = (a.chatSettings && a.chatSettings.contextDepth) ? parseInt(a.chatSettings.contextDepth, 10) : 30;
    if (!depth || depth < 1) depth = 30;

    return [
      makeCap('docs', '文档', docsReady ? '可用' : '未配置', docsReady ? 'ready' : 'off',
        docsReady ? 'Word / Excel / PPT' : (docsReason || 'Word / Excel / PPT'), docsReason, 'work'),
      makeCap('sop', 'SOP / 周报', docsReady ? '可用' : '未配置', docsReady ? 'ready' : 'off',
        docsReady ? '流程 / 复盘 / 会议纪要' : (docsReason || '流程 / 复盘 / 会议纪要'), docsReason, 'work'),
      makeCap('search', '联网查资料', searchBadge, searchState,
        searchDetail, searchReason, 'utility'),
      makeCap('image', '角色生图', imageBadge, imageState,
        '文生图 / 参考图锁脸', imageReason, 'companion'),
      makeCap('voice', '角色语音', voiceBadge, voiceState,
        voiceOn ? '语音合成已开' : (voiceReason || '语音合成'), voiceReason, 'companion'),
      makeCap('music', '音乐', musicBadge, musicState,
        musicDetail, musicReason, 'companion'),
      makeCap('memory', '记忆 / 上下文', memoryModule ? '可用' : '未加载', memoryModule ? 'ready' : 'off',
        '记忆 ' + memoryCount + ' 张 · 上下文 ' + depth + ' 条', memoryModule ? '' : '记忆模块没加载', 'companion'),
      makeCap('local', '本地文件 / 终端', '未接入', 'off',
        '本地文件 / 终端 / 浏览器自动化', '需要本地桥接，当前没接入', 'utility')
    ];
  }

  function snapshot() {
    var model = modelInfo();
    var cid = charId();
    var name = charName();
    var mask = activeMask();
    var mode = sceneMode();
    var tools = toolRows();
    var capabilities = buildCapabilities();
    var workPack = workPackInfo();
    var user = text(app().userNickname) || text(app().hero && app().hero.userName) || 'user';
    var build = text(window.__BUILD__) || text(window.__LIVE_BUILD__) || '20261125-0028';
    var context = '当前：' + (name || '还没选角色') +
      (mask && mask.name ? ' / ' + mask.name : '') +
      ' · ' + mode +
      ' · ' + (workPack.on ? '接活已开（工作包 ' + workPack.selectedCount + ' 个角色）' : '接活未开') +
      '｜模型：' + model.chat.model + (model.chat.configured ? '（已配）' : '（未配）') +
      '｜版本 ' + build;

    return {
      version: '1',
      build: build,
      checkedAt: Date.now(),
      instance: {
        page: currentPage(),
        online: (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true
      },
      identity: {
        charId: cid,
        charName: name || '',
        userName: user,
        maskName: mask && mask.name ? String(mask.name) : '',
        mode: mode
      },
      model: model,
      workPack: workPack,
      tools: tools,
      capabilities: capabilities,
      limits: [
        '不能直接读写本地文件',
        '不能执行终端命令',
        '不能控制浏览器',
        '任务只在页面打开时执行'
      ],
      context: context
    };
  }

  function promptBlock() {
    var s = snapshot();
    var c = s.capabilities || [];
    var ready = c.filter(function (x) { return x.state === 'ready'; }).map(function (x) { return x.label; });
    var partial = c.filter(function (x) { return x.state === 'partial'; }).map(function (x) {
      return x.label + (x.reason ? '（' + x.reason + '）' : '');
    });
    var blocked = c.filter(function (x) { return x.state === 'off'; }).map(function (x) {
      return x.label + (x.reason ? '（' + x.reason + '）' : '');
    });
    var name = s.identity.charName || '当前角色';
    var lines = [];
    lines.push('【运行事实】这是程序刚读到的真实状态，只用来判断能不能做；不要向 user 复述技术字段，也不要用“系统/接口/模型”解释。');
    lines.push('现在是 ' + name + (s.identity.maskName ? '（小号：' + s.identity.maskName + '）' : '') + '，' + s.identity.mode + '。');
    lines.push('主模型：' + s.model.chat.model + (s.model.chat.configured ? '，线路已配置' : '，还没配好') + '。');
    lines.push('接活资格：' + (s.workPack && s.workPack.on
      ? ('当前角色已加入工作包（共选 ' + s.workPack.selectedCount + ' 个角色），可以接文档 / SOP 任务')
      : '当前角色不在工作包里，不能接文档 / SOP 任务；普通聊天、恋爱、语音、生图这些陪伴能力不受影响') + '。');
    lines.push('能做：' + (ready.length ? ready.join('、') : '暂时没有可用的外部能力') +
      (partial.length ? '；部分可用：' + partial.join('、') : '') + '。');
    lines.push('不能做：' + (blocked.length ? blocked.join('；') : '没有额外限制') + '。');
    lines.push('本机边界：不能直接读写本地文件，不能执行终端命令，不能控制浏览器；任务只在页面打开时执行。');
    lines.push('能做的就做，不能做的直接说，不要假装。');
    return lines.join('\n');
  }

  window.MomSelf = {
    snapshot: snapshot,
    promptBlock: promptBlock,
    refresh: snapshot,
    build: '20261125-0028'
  };
})();
