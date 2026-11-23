// 聊天预设：类似酒馆的预设切换 + 提示词条目开关，全部保存在本地
(function() {
  const K_PRESETS = 'momo_prompt_presets_v1';
  const K_ACTIVE = 'momo_prompt_active_preset_v1';
  const K_SCENE = 'momo_prompt_scene_v1';

  const SCENES = {
    chat: { label: '线上聊天', short: '聊天', note: '线上读取 24 条微信底座 + 自定义板块；从酒馆预设导入时只提取文风，不整包吞舞台设定。' },
    theater: { label: '线下剧场', short: '剧场', note: '线下读取舞台、角色、叙事、输出、连续性、配角、边界 7 条剧场底座 + 自定义板块；酒馆预设默认完整导入这里。' },
    forum: { label: '长椅', short: '长椅', note: '长椅读取角色卡、记忆与最近聊天，8 条广场内置决定帖子的语体、边界、长短和回帖姿势。酒馆预设的演出控制在这里用不上，建议单独建一套。' }
  };
  const SCENE_ORDER = ['chat', 'theater', 'forum'];

  function normalizeScope(value) {
    if (value === 'theater') return 'theater';
    if (value === 'forum') return 'forum';
    return 'chat';
  }

  function scopeDefaultName(value) {
    const scope = normalizeScope(value);
    if (scope === 'theater') return '剧场模式';
    if (scope === 'forum') return '长椅模式';
    return '新预设';
  }

  function presetScopeDefaultName(value) {
    const scope = normalizeScope(value);
    return scope === 'theater' ? '剧场模式' : '长椅模式';
  }

  const ENTRY_ROLES = {
    system: { label: '系统', short: 'system' },
    user: { label: '用户', short: 'user' },
    assistant: { label: '角色', short: 'assistant' }
  };
  const ENTRY_POSITIONS = {
    head: { label: '头部' },
    tail: { label: '底部' },
    depth: { label: '注入深度' },
    message: { label: '消息级' }
  };

  function normalizeEntryRole(value) {
    return value === 'user' || value === 'assistant' ? value : 'system';
  }

  function normalizeEntryPosition(value) {
    if (value === 'prepend' || value === 'head') return 'head';
    if (value === 'append' || value === 'tail') return 'tail';
    if (value === 'depth') return 'depth';
    if (value === 'message') return 'message';
    return 'tail';
  }

  function normalizeEntryDepth(value) {
    const n = parseInt(value, 10);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(50, n));
  }

  function entryRole(entry) {
    return normalizeEntryRole(entry && entry.role);
  }

  function entryPosition(entry) {
    return normalizeEntryPosition(entry && entry.position);
  }

  function entryDepth(entry) {
    return normalizeEntryDepth(entry && entry.depth);
  }

  function normalizeInjectionOrder(value) {
    const n = parseInt(value, 10);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(10000, n));
  }

  function importedInjection(raw) {
    raw = raw || {};
    // 酒馆的 system_prompt 条目属于主系统提示，不跟随 relative depth 下沉。
    if (raw.system_prompt === true || raw.system_prompt === 'true' || raw.systemPrompt === true) {
      return { position: 'head', depth: 0 };
    }
    const injection = raw.injection && typeof raw.injection === 'object' ? raw.injection : {};
    let position = injection.position;
    let depth = injection.depth;
    if (depth == null) depth = raw.depth;
    if (depth == null) depth = raw.injection_depth;
    if (position == null) position = raw.position;
    if (position == null) position = raw.injection_position;
    if (typeof position === 'number') position = position === 1 ? 'absolute' : 'relative';
    if (position === 'absolute') {
      return { position: 'head', depth: 0 };
    }
    if (position === 'relative') {
      const n = normalizeEntryDepth(depth);
      return { position: n > 0 ? 'depth' : 'tail', depth: n };
    }
    return {
      position: normalizeEntryPosition(position),
      depth: normalizeEntryDepth(depth)
    };
  }

  const GROUPS = {
    foundation: { label: '人设与关系', color: '#a78bfa' },
    stage: { label: '舞台与角色', color: '#fbbf24' },
    narrative: { label: '叙事与输出', color: '#38bdf8' },
    world: { label: '世界与记忆', color: '#34d399' },
    interaction: { label: '互动能力', color: '#38bdf8' },
    life: { label: '生活记录', color: '#f59e0b' },
    style: { label: '说话方式', color: '#f472b6' },
    rules: { label: '规则与底线', color: '#fb7185' },
    directing: { label: '导演与边界', color: '#f97316' },
    custom: { label: '自定义条目', color: '#c084fc' }
  };
  const GROUP_ORDER = ['foundation', 'stage', 'narrative', 'world', 'interaction', 'life', 'style', 'rules', 'directing', 'custom'];

  const CHAT_BUILTINS = [
    { id: 'character_setting', title: '角色设定', group: 'foundation', hint: '角色卡里的性格、身份与说话方式' },
    { id: 'time', title: '时间与日子感知', group: 'world', hint: '现实时间、作息、生日节日与节前节后' },
    { id: 'relationship', title: '关系边界', group: 'foundation', hint: '按角色卡决定亲近程度，不擅自越界' },
    { id: 'user_profile', title: '用户资料', group: 'foundation', hint: '姓名、称呼、生日、外貌、习惯与签名' },
    { id: 'share_links', title: '分享链接感知', group: 'world', hint: '读懂 user 分享的图文链接' },
    { id: 'honesty', title: '诚实铁律', group: 'rules', hint: '看不到就说看不到，不脑补' },
    { id: 'share_cards', title: '外部链接卡片', group: 'world', hint: '对分享过的卡片保持记忆' },
    { id: 'moments', title: '朋友圈感知', group: 'world', hint: '朋友圈动态与评论互动' },
    { id: 'stickers', title: '表情包库', group: 'interaction', hint: '可用的自定义表情与发送规则' },
    { id: 'empathy', title: '共情姿态', group: 'interaction', hint: '先接住情绪，不做理中客' },
    { id: 'avatars', title: '头像库', group: 'interaction', hint: '角色主动换头像的能力' },
    { id: 'frames', title: '头像框', group: 'interaction', hint: '头像框与框上短文案' },
    { id: 'ledger', title: '生活手账', group: 'life', hint: '共同账目与开销感知' },
    { id: 'days', title: '倒数日', group: 'life', hint: '纪念日、倒数日与专属备注' },
    { id: 'memory', title: '记忆卡片', group: 'world', hint: '当前角色的早期记忆与总结' },
    { id: 'album', title: '相册能力', group: 'interaction', hint: '自主存图与发相册图' },
    { id: 'reactions', title: '微信小动作', group: 'interaction', hint: '贴表情、撤回、改备注' },
    { id: 'worldbook', title: '世界书', group: 'world', hint: '当前角色相关的世界书规则' },
    { id: 'phone', title: '小手机设定', group: 'world', hint: '模型、神经脉冲与设备认知' },
    { id: 'tone', title: '对话质感', group: 'style', hint: '生活化、松弛、不客服腔' },
    { id: 'taboos', title: '人设禁区', group: 'rules', hint: '禁止保姆式查户口与虚空表演' },
    { id: 'rhythm', title: '微信节奏', group: 'style', hint: '短句连发、标点与长短落差' },
    { id: 'heart', title: '心声系统', group: 'style', hint: '回复开头输出【心声】' },
    { id: 'core', title: '最高行为准则', group: 'rules', hint: 'user 亲笔设定的灵魂法则' }
  ];
  const THEATER_BUILTINS = [
    { id: 'theater_stage', title: '舞台情境', group: 'stage', hint: '地点、时间、光线、环境与当前场景' },
    { id: 'theater_role', title: '角色扮演', group: 'stage', hint: '角色身份、关系、秘密与说话方式' },
    { id: 'theater_narrative', title: '叙事人称与文风', group: 'narrative', hint: '人称、文风、字数与叙述节奏' },
    { id: 'theater_output', title: '输出规范', group: 'narrative', hint: '动作、台词、旁白与段落的写法' },
    { id: 'theater_continuity', title: '场景连续性', group: 'directing', hint: '记住上一幕，不跳场、不重置关系' },
    { id: 'theater_npc', title: '配角与旁白', group: 'directing', hint: '控制配角和环境，不替用户行动' },
    { id: 'theater_boundary', title: '剧场边界', group: 'rules', hint: '不替用户决定，不突然出戏' }
  ];
  const FORUM_BUILTINS = [
    { id: 'forum_who', title: '你是谁', group: 'foundation', hint: '角色卡里的性格、身份与说话方式' },
    { id: 'forum_now', title: '现在与记得的事', group: 'world', hint: '现实时间感知 + 记忆卡片摘要' },
    { id: 'forum_material', title: '最近的聊天（只作素材）', group: 'world', hint: '只当素材，不许写成回复' },
    { id: 'forum_square', title: '广场规矩', group: 'rules', hint: '公开场合的语体与隐私边界' },
    { id: 'forum_kind', title: '这次发什么', group: 'narrative', hint: '求助 / 问答 / 分享三类写法' },
    { id: 'forum_length', title: '篇幅', group: 'narrative', hint: '一句 / 几行 / 一段，每次随机落一档' },
    { id: 'forum_output', title: '输出格式', group: 'narrative', hint: 'JSON：title / body / tags' },
    { id: 'forum_reply', title: '回帖姿势', group: 'interaction', hint: '角色在别人帖子下面怎么回应' }
  ];
  const BUILTINS_BY_SCOPE = { chat: CHAT_BUILTINS, theater: THEATER_BUILTINS, forum: FORUM_BUILTINS };
  const BUILTIN_MAPS = { chat: {}, theater: {}, forum: {} };
  CHAT_BUILTINS.forEach(function(item) { BUILTIN_MAPS.chat[item.id] = item; });
  THEATER_BUILTINS.forEach(function(item) { BUILTIN_MAPS.theater[item.id] = item; });
  FORUM_BUILTINS.forEach(function(item) { BUILTIN_MAPS.forum[item.id] = item; });
  const BUILTIN_MAP = BUILTIN_MAPS.chat;

  function builtinCatalog(scope) {
    return BUILTINS_BY_SCOPE[normalizeScope(scope)] || CHAT_BUILTINS;
  }

  function builtinMap(scope) {
    return BUILTIN_MAPS[normalizeScope(scope)] || BUILTIN_MAPS.chat;
  }

  function builtinForScope(id, scope) {
    return builtinMap(scope)[id] || null;
  }

  // 用标题边界切分现有系统提示词；关闭条目时只移除对应区段，不改其他内容。
  const SECTION_BOUNDS = {
    character_setting: ['【角色设定】：', '【现实世界时间流与真实作息感知'],
    time: ['【现实世界时间流与真实作息感知', '【你与用户的关系】'],
    relationship: ['【你与用户的关系】', '【用户资料】：'],
    user_profile: ['【用户资料】：', '分享给你的图文链接动态'],
    share_links: ['分享给你的图文链接动态', '【绝对诚实铁律'],
    honesty: ['【绝对诚实铁律', '【外部链接卡片感知'],
    share_cards: ['【外部链接卡片感知', '【朋友圈与跨场景动态感知'],
    moments: ['【朋友圈与跨场景动态感知', '【表情包与贴图库'],
    stickers: ['【表情包与贴图库', '【共情与相处姿态】'],
    empathy: ['【共情与相处姿态】', '【头像库与情绪换头像'],
    avatars: ['【头像库与情绪换头像', '【头像框与框上短文案'],
    frames: ['【头像框与框上短文案', '【生活手账与管账人账目感知'],
    ledger: ['【生活手账与管账人账目感知', '【倒数日 Days Matter'],
    days: ['【倒数日 Days Matter', '【记忆卡片与过往经历金字塔'],
    memory: ['【记忆卡片与过往经历金字塔', '【小手机相册能力】'],
    album: ['【小手机相册能力】', '【贴表情能力】'],
    reactions: ['【贴表情能力】', '【世界书羁绊与规则约束】'],
    worldbook: ['【世界书羁绊与规则约束】', '【关于这台小手机】'],
    phone: ['【关于这台小手机】', '【对话质感】'],
    tone: ['【对话质感】', '【严禁触犯的死板人设禁区】'],
    taboos: ['【严禁触犯的死板人设禁区】', '【微信消息气泡与打字节奏死命令'],
    rhythm: ['【微信消息气泡与打字节奏死命令', '【心声系统'],
    heart: ['【心声系统', '【微信原生引用规范】'],
    core: ['【最高行为准则', null]
  };

  function safeParse(raw, fallback) {
    try {
      const value = JSON.parse(raw || 'null');
      return value === null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function uid(prefix) {
    return (prefix || 'entry') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizeTagList(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(/[,，;；]/);
    const tags = [];
    source.forEach(function(item) {
      const tag = String(item || '').trim().slice(0, 18);
      if (tag && tags.indexOf(tag) === -1 && tags.length < 12) tags.push(tag);
    });
    return tags;
  }

  function defaultEntries(scope) {
    return builtinCatalog(scope).map(function(item) {
      return { id: item.id, kind: 'builtin', title: item.title, group: item.group, enabled: true };
    });
  }

  function makePreset(name, scope) {
    scope = normalizeScope(scope);
    const now = Date.now();
    return {
      id: uid('preset'),
      name: name || scopeDefaultName(scope),
      scope: scope,
      author: '',
      version: '1.0',
      description: '',
      source: 'manual',
      tags: [],
      entries: defaultEntries(scope),
      createdAt: now,
      updatedAt: now
    };
  }

  function normalizeEntry(entry, scope) {
    if (!entry) return null;
    const map = builtinMap(scope);
    if (entry.kind === 'builtin' || (entry.id && map[entry.id])) {
      const builtin = map[entry.id];
      if (!builtin) return null;
      return {
        id: builtin.id,
        kind: 'builtin',
        title: builtin.title,
        group: builtin.group,
        hint: builtin.hint,
        enabled: entry.enabled !== false
      };
    }
    return {
      id: entry.id || uid('entry'),
      kind: 'custom',
      title: entry.title || '自定义条目',
      hint: typeof entry.hint === 'string' ? entry.hint : '',
      content: typeof entry.content === 'string' ? entry.content : '',
      group: GROUPS[entry.group] ? entry.group : 'custom',
      role: normalizeEntryRole(entry.role),
      position: normalizeEntryPosition(entry.position),
      depth: normalizeEntryDepth(entry.depth),
      injectionOrder: normalizeInjectionOrder(entry.injectionOrder),
      exclusiveGroup: typeof entry.exclusiveGroup === 'string' ? entry.exclusiveGroup.trim() : '',
      enabled: entry.enabled !== false,
      updatedAt: entry.updatedAt || Date.now()
    };
  }

  function normalizePreset(preset, scope) {
    preset = preset || {};
    const presetScope = normalizeScope(scope || preset.scope);
    const existing = Array.isArray(preset.entries) ? preset.entries : [];
    const map = builtinMap(presetScope);
    const normalized = existing.map(function(entry) { return normalizeEntry(entry, presetScope); }).filter(function(entry) {
      return entry && (entry.kind === 'custom' || !!map[entry.id]);
    });
    // 保留用户已经排好的顺序；只把老版本缺失的内置条目补在末尾。
    const entries = [];
    const seenBuiltins = {};
    normalized.forEach(function(entry) {
      if (entry.kind === 'builtin') {
        if (seenBuiltins[entry.id]) return;
        seenBuiltins[entry.id] = true;
      }
      entries.push(entry);
    });
    builtinCatalog(presetScope).forEach(function(builtin) {
      if (seenBuiltins[builtin.id]) return;
      seenBuiltins[builtin.id] = true;
      entries.push({
        id: builtin.id,
        kind: 'builtin',
        title: builtin.title,
        group: builtin.group,
        hint: builtin.hint,
        enabled: true
      });
    });
    return {
      id: preset.id || uid('preset'),
      name: preset.name || (presetScope === 'theater' ? '剧场模式' : presetScope === 'forum' ? '长椅模式' : '未命名预设'),
      scope: presetScope,
      author: typeof preset.author === 'string' ? preset.author.trim().slice(0, 40) : '',
      version: preset.version == null ? '' : String(preset.version).trim().slice(0, 20),
      description: typeof preset.description === 'string' ? preset.description.trim().slice(0, 240) : '',
      source: typeof preset.source === 'string' && preset.source ? preset.source : 'manual',
      tags: normalizeTagList(preset.tags),
      entries: entries,
      createdAt: Number(preset.createdAt) || Number(preset.updatedAt) || Date.now(),
      updatedAt: Number(preset.updatedAt) || Date.now()
    };
  }

  let presets = safeParse(localStorage.getItem(K_PRESETS), null);
  if (!Array.isArray(presets) || !presets.length) {
    presets = [makePreset('日常模式', 'chat')];
    localStorage.setItem(K_PRESETS, JSON.stringify(presets));
  } else {
    presets = presets.map(function(p) { return normalizePreset(p, p.scope); });
  }

  function readActiveIds() {
    const raw = localStorage.getItem(K_ACTIVE);
    if (!raw) return { chat: '', theater: '', forum: '' };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { chat: String(parsed.chat || ''), theater: String(parsed.theater || ''), forum: String(parsed.forum || '') };
      }
    } catch (e) {}
    return { chat: String(raw || ''), theater: '', forum: '' };
  }

  let activeIds = readActiveIds();
  let currentScene = normalizeScope(localStorage.getItem(K_SCENE) || 'chat');
  let editingEntryId = '';
  let searchQuery = '';
  let sortMode = false;
  let multiSelect = false;
  let selectedIds = {};
  let draggedEntryId = '';
  let cachedPromptChars = null;
  let metaExpanded = false;
  let lastImportInfo = { scope: 'chat', styleOnly: false, autoRouted: false, sillyTavern: false };

  function ensureScenePreset(scope) {
    scope = normalizeScope(scope);
    const found = presets.find(function(p) { return p.id === activeIds[scope] && p.scope === scope; });
    if (found) return found;
    let fallback = presets.find(function(p) { return p.scope === scope; });
    if (!fallback) {
      fallback = makePreset(scope === 'chat' ? '日常模式' : presetScopeDefaultName(scope), scope);
      presets.push(fallback);
      localStorage.setItem(K_PRESETS, JSON.stringify(presets));
    }
    activeIds[scope] = fallback.id;
    localStorage.setItem(K_ACTIVE, JSON.stringify(activeIds));
    return fallback;
  }

  ensureScenePreset('chat');
  ensureScenePreset('theater');
  ensureScenePreset('forum');

  function entryGroup(entry) {
    if (!entry) return 'custom';
    const builtin = entry.kind === 'builtin' ? builtinForScope(entry.id, currentScene) : null;
    if (builtin) return builtin.group;
    return GROUPS[entry.group] ? entry.group : 'custom';
  }

  function entryHint(entry) {
    if (!entry) return '';
    const builtin = entry.kind === 'builtin' ? builtinForScope(entry.id, currentScene) : null;
    if (builtin) return builtin.hint;
    if (entry.hint) return entry.hint;
    const content = String(entry.content || '').replace(/\s+/g, ' ').trim();
    if (!content) return '空条目';
    return content.slice(0, 52) + (content.length > 52 ? '…' : '');
  }

  function matchesSearch(entry) {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const preset = activePreset();
    const meta = preset ? [preset.author, preset.version, preset.description, (preset.tags || []).join(' '), sourceLabel(preset.source)].join('\n') : '';
    const haystack = [entry.title, entryHint(entry), entry.content || '', meta].join('\n').toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  function estimateEnabledChars() {
    if (cachedPromptChars !== null) return cachedPromptChars;
    const preset = activePreset();
    if (!preset) return 0;
    if (currentScene === 'theater') {
      try {
        if (typeof window.getTheaterSystemPrompt === 'function') {
          const base = window.getTheaterSystemPrompt({ skipPreset: true });
          const applied = apply(base, { scope: 'theater', charName: '角色', userName: 'user', userRemark: 'user' });
          const extras = entryInjection({ scope: 'theater', charName: '角色', userName: 'user', userRemark: 'user' });
          const extraChars = extras.head.concat(extras.tail).reduce(function(sum, msg) { return sum + String(msg.content || '').length; }, 0)
            + extras.depth.reduce(function(sum, item) { return sum + String(item.message.content || '').length; }, 0);
          cachedPromptChars = applied.length + extraChars;
          return cachedPromptChars;
        }
      } catch (e) {}
      let theaterChars = 0;
      preset.entries.forEach(function(entry) {
        if (entry.enabled === false) return;
        if (entry.kind === 'custom') theaterChars += String(entry.content || '').length;
        else {
          const builtin = builtinForScope(entry.id, 'theater');
          if (builtin) theaterChars += builtin.hint.length * 6;
        }
      });
      cachedPromptChars = theaterChars;
      return cachedPromptChars;
    }
    try {
      if (typeof window.getFullSystemPrompt === 'function') {
        const base = window.getFullSystemPrompt({ skipPreset: true, skipWorld: true });
        const applied = apply(base, { scope: 'chat', charName: '角色', userName: 'user', userRemark: 'user' });
        const extras = entryInjection({ scope: 'chat', charName: '角色', userName: 'user', userRemark: 'user' });
        const extraChars = extras.head.concat(extras.tail).reduce(function(sum, msg) { return sum + String(msg.content || '').length; }, 0)
          + extras.depth.reduce(function(sum, item) { return sum + String(item.message.content || '').length; }, 0);
        cachedPromptChars = applied.length + extraChars;
        return cachedPromptChars;
      }
    } catch (e) {}
    let chars = 0;
    preset.entries.forEach(function(entry) {
      if (entry.enabled === false) return;
      if (entry.kind === 'custom') chars += String(entry.content || '').length;
      else if (BUILTIN_MAP[entry.id]) chars += BUILTIN_MAP[entry.id].hint.length * 6;
    });
    cachedPromptChars = chars;
    return cachedPromptChars;
  }

  function persist() {
    const active = activePreset();
    if (active) active.updatedAt = Date.now();
    cachedPromptChars = null;
    localStorage.setItem(K_PRESETS, JSON.stringify(presets));
    localStorage.setItem(K_ACTIVE, JSON.stringify(activeIds));
    localStorage.setItem(K_SCENE, currentScene);
  }

  function getPreset(id) {
    return presets.find(function(p) { return p.id === id; }) || null;
  }

  function activePreset(scope) {
    const scene = normalizeScope(scope || currentScene);
    const found = presets.find(function(p) { return p.id === activeIds[scene] && p.scope === scene; });
    return found || presets.find(function(p) { return p.scope === scene; }) || null;
  }

  function findEntry(id, scope) {
    const preset = activePreset(scope);
    if (!preset) return null;
    return preset.entries.find(function(e) { return e.id === id; }) || null;
  }

  function isEnabled(id, scope) {
    const entry = findEntry(id, scope || 'chat');
    // 老版本预设没有这条内置条目时，默认保持开启，避免升级后突然丢设定。
    return entry ? entry.enabled !== false : true;
  }

  function stripDisabledSections(text, scope) {
    const scene = normalizeScope(scope || 'chat');
    function headingStart(marker) {
      let index = text.indexOf(marker);
      if (index < 0) return -1;
      if (marker.charAt(0) === '【') return index;
      const open = text.lastIndexOf('【', index);
      if (open >= 0 && open > text.lastIndexOf('\n', index)) return open;
      return index;
    }
    function headingEnd(marker, from) {
      let index = text.indexOf(marker, from);
      if (index < 0) return -1;
      if (marker.charAt(0) === '【') return index;
      const open = text.lastIndexOf('【', index);
      if (open >= from && open > text.lastIndexOf('\n', index)) return open;
      return index;
    }
    const ranges = [];
    CHAT_BUILTINS.forEach(function(builtin) {
      if (isEnabled(builtin.id, scene)) return;
      const bounds = SECTION_BOUNDS[builtin.id];
      if (!bounds) return;
      const start = headingStart(bounds[0]);
      if (start < 0) return;
      const end = bounds[1] ? headingEnd(bounds[1], start) : -1;
      ranges.push({ start: start, end: end >= 0 ? end : text.length });
    });
    ranges.sort(function(a, b) { return b.start - a.start; });
    let result = text;
    ranges.forEach(function(range) {
      result = result.slice(0, range.start) + result.slice(range.end);
    });
    return result;
  }

  // 把基底提示词拆成区段，才能按预设列表顺序真正重排。
  // 线上区段用【标题】；剧场底座用 ### 标题。
  function parseSystemSections(text, scope) {
    const source = String(text || '');
    if (!source) return null;
    if (normalizeScope(scope) === 'theater') {
      const chunks = source.split(/\n{2,}(?=###\s)/);
      if (chunks.length < 2) return null;
      const preamble = chunks.shift().trim();
      const sections = {};
      const tails = [];
      chunks.forEach(function(chunk) {
        const headingMatch = chunk.match(/^###\s*([^\n：:]+)/);
        const heading = headingMatch ? headingMatch[1].trim() : '';
        let id = '';
        if (/^舞台情境/.test(heading)) id = 'theater_stage';
        else if (/^扮演角色/.test(heading)) id = 'theater_role';
        else if (/^叙事人称与文风约束/.test(heading)) id = 'theater_narrative';
        else if (/^输出规范/.test(heading)) id = 'theater_output';
        else if (/^场景连续性/.test(heading)) id = 'theater_continuity';
        else if (/^配角与旁白/.test(heading)) id = 'theater_npc';
        else if (/^剧场边界/.test(heading)) id = 'theater_boundary';
        if (id) sections[id] = chunk.trim();
        else tails.push(chunk.trim());
      });
      if (!Object.keys(sections).length) return null;
      return { preamble: preamble, sections: sections, tail: tails.join('\n\n') };
    }
    if (normalizeScope(scope) === 'forum') {
      const chunks = source.split(/\n{2,}(?=###\s)/);
      if (chunks.length < 2) return null;
      const preamble = chunks.shift().trim();
      const sections = {};
      const tails = [];
      chunks.forEach(function(chunk) {
        const headingMatch = chunk.match(/^###\s*([^\n]*)/);
        const heading = headingMatch ? headingMatch[1].trim() : '';
        let id = '';
        if (/^你是谁/.test(heading)) id = 'forum_who';
        else if (/^现在与记得的事/.test(heading)) id = 'forum_now';
        else if (/^最近的聊天/.test(heading)) id = 'forum_material';
        else if (/^广场规矩/.test(heading)) id = 'forum_square';
        else if (/^这次发什么/.test(heading)) id = 'forum_kind';
        else if (/^篇幅/.test(heading)) id = 'forum_length';
        else if (/^输出格式/.test(heading)) id = 'forum_output';
        else if (/^回帖姿势/.test(heading)) id = 'forum_reply';
        if (id) sections[id] = chunk.trim();
        else tails.push(chunk.trim());
      });
      if (!Object.keys(sections).length) return null;
      return { preamble: preamble, sections: sections, tail: tails.join('\n\n') };
    }
    const starts = [];
    CHAT_BUILTINS.forEach(function(builtin) {
      const bounds = SECTION_BOUNDS[builtin.id];
      if (!bounds) return;
      const start = sectionStart(source, bounds[0]);
      if (start >= 0) starts.push({ id: builtin.id, start: start });
    });
    if (!starts.length) return null;
    starts.sort(function(a, b) { return a.start - b.start; });
    const preamble = source.slice(0, starts[0].start).trim();
    const sections = {};
    starts.forEach(function(item, index) {
      const end = index + 1 < starts.length ? starts[index + 1].start : source.length;
      sections[item.id] = source.slice(item.start, end).trim();
    });
    return { preamble: preamble, sections: sections, tail: '' };
  }

  function orderedBuiltinIds(scope, preset) {
    const catalog = builtinCatalog(scope);
    const catalogIds = catalog.map(function(item) { return item.id; });
    const present = {};
    const ordered = [];
    ((preset && preset.entries) || []).forEach(function(entry) {
      if (entry.kind !== 'builtin') return;
      if (catalogIds.indexOf(entry.id) === -1) return;
      if (present[entry.id]) return;
      present[entry.id] = true;
      ordered.push(entry.id);
    });
    catalogIds.forEach(function(id) {
      if (!present[id]) {
        present[id] = true;
        ordered.push(id);
      }
    });
    return ordered;
  }

  function reorderBuiltinSections(text, scope, preset) {
    const parsed = parseSystemSections(text, scope);
    if (!parsed) return stripDisabledSections(text, scope);
    const scene = normalizeScope(scope);
    const body = orderedBuiltinIds(scene, preset).filter(function(id) {
      return isEnabled(id, scene) && parsed.sections[id];
    }).map(function(id) {
      return parsed.sections[id];
    }).filter(Boolean).join('\n\n');
    return [parsed.preamble, body, parsed.tail].filter(Boolean).join('\n\n');
  }

  function buildCustomText(entries) {
    return entries.filter(function(entry) {
      return entry.kind === 'custom' && entry.enabled !== false && String(entry.content || '').trim();
    }).map(function(entry) {
      return '【预设 · ' + (entry.title || '自定义条目') + '】\n' + String(entry.content || '').trim();
    });
  }

  function interpolateEntryText(entry, context) {
    const ctx = context || {};
    return String(entry && entry.content || '').trim()
      .replace(/\{\{char\}\}/g, ctx.charName || '角色')
      .replace(/\{\{user\}\}/g, ctx.userRemark || ctx.userName || 'user')
      .replace(/\{\{user_name\}\}/g, ctx.userName || 'user')
      .replace(/\{\{lastUserMessage\}\}/g, ctx.lastUserMessage || '');
  }

  function extraEntryMessage(entry, context) {
    return {
      role: entryRole(entry),
      content: '【预设 · ' + (entry.title || '自定义条目') + '】\n' + interpolateEntryText(entry, context)
    };
  }

  function entryInjection(context) {
    const ctx = context || {};
    const scope = normalizeScope(ctx.scope || 'chat');
    const preset = activePreset(scope);
    if (!preset) return { head: [], depth: [], tail: [] };
    const entries = (preset.entries || []).filter(function(entry) {
      return entry.kind === 'custom' && entry.enabled !== false && String(entry.content || '').trim();
    });
    const result = { head: [], depth: [], tail: [] };
    entries.forEach(function(entry, index) {
      const role = entryRole(entry);
      const position = entryPosition(entry);
      if (role === 'system' && (position === 'head' || position === 'tail')) return;
      const message = extraEntryMessage(entry, ctx);
      if (position === 'head') result.head.push(message);
      else if (position === 'depth') result.depth.push({
        message: message,
        depth: entryDepth(entry),
        order: normalizeInjectionOrder(entry.injectionOrder),
        seq: index
      });
      else result.tail.push(message);
    });
    return result;
  }

  function injectMessages(messages, context) {
    const list = Array.isArray(messages) ? messages.slice() : [];
    const extras = entryInjection(context);
    if (extras.head.length) list.unshift.apply(list, extras.head);
    if (extras.depth.length) {
      const originalLength = list.length;
      const groups = {};
      extras.depth.forEach(function(item, seq) {
        const index = Math.max(0, originalLength - item.depth);
        if (!groups[index]) groups[index] = [];
        groups[index].push({
          message: item.message,
          order: Number(item.order) || 0,
          seq: Number(item.seq) || seq
        });
      });
      Object.keys(groups).map(Number).sort(function(a, b) { return b - a; }).forEach(function(index) {
        const group = groups[index].slice().sort(function(a, b) {
          if (a.order !== b.order) return a.order - b.order;
          return a.seq - b.seq;
        });
        const merged = [];
        let systemBlock = null;
        group.forEach(function(item) {
          if (item.message.role === 'system') {
            if (systemBlock) systemBlock.content += '\n\n' + item.message.content;
            else {
              systemBlock = { role: 'system', content: item.message.content };
              merged.push(systemBlock);
            }
          } else {
            merged.push(item.message);
            systemBlock = null;
          }
        });
        list.splice.apply(list, [index, 0].concat(merged));
      });
    }
    if (extras.tail.length) list.push.apply(list, extras.tail);
    return list;
  }

  function apply(base, context) {
    const ctx = context || {};
    const scope = normalizeScope(ctx.scope || 'chat');
    const preset = activePreset(scope);
    if (!preset) return base;
    const text = reorderBuiltinSections(String(base || ''), scope, preset);
    const custom = (preset.entries || []).filter(function(entry) {
      return entry.kind === 'custom' && entryRole(entry) === 'system' &&
        (entryPosition(entry) === 'head' || entryPosition(entry) === 'tail');
    });
    const before = buildCustomText(custom.filter(function(e) { return entryPosition(e) === 'head'; }));
    const after = buildCustomText(custom.filter(function(e) { return entryPosition(e) !== 'head'; }));
    let result = [before.join('\n\n'), text, after.join('\n\n')].filter(Boolean).join('\n\n');
    result = result
      .replace(/\{\{char\}\}/g, ctx.charName || '角色')
      .replace(/\{\{user\}\}/g, ctx.userRemark || ctx.userName || 'user')
      .replace(/\{\{user_name\}\}/g, ctx.userName || 'user')
      .replace(/\{\{lastUserMessage\}\}/g, ctx.lastUserMessage || '');
    return result;
  }

  function renderSelect() {
    const sel = document.getElementById('prompt-preset-select');
    if (!sel) return;
    const scenePresets = presets.filter(function(p) { return p.scope === currentScene; });
    sel.innerHTML = scenePresets.map(function(p) {
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name || '未命名预设') + '</option>';
    }).join('');
    const active = activePreset();
    if (active) sel.value = active.id;
  }

  function renderSceneTabs() {
    SCENE_ORDER.forEach(function(scene) {
      const btn = document.getElementById('prompt-scene-' + scene);
      if (!btn) return;
      const active = scene === currentScene;
      btn.style.color = active ? '#07c160' : 'var(--color-text-secondary)';
      btn.style.background = active ? 'rgba(7,193,96,0.12)' : 'transparent';
      btn.style.borderColor = active ? 'rgba(7,193,96,0.42)' : 'transparent';
      btn.style.fontWeight = active ? '800' : '600';
    });
    const note = document.getElementById('prompt-scene-note');
    if (note) note.textContent = SCENES[currentScene].note;
    const builtinNote = document.getElementById('prompt-builtin-note');
    if (builtinNote) {
      builtinNote.style.display = '';
      const tips = {
        chat: '内置条目对应现有系统提示词区段；关掉只影响这套预设，不会删角色卡或聊天记录。自定义条目可以用 <span style="color: #22d3ee;">{{char}}</span> 和 <span style="color: #22d3ee;">{{user}}</span> 占位。',
        theater: '剧场内置是运行时从故事设定生成的底座，锁定不能编辑；关掉只影响这套剧场预设，不会删角色卡或聊天记录。自定义条目可以用 <span style="color: #22d3ee;">{{char}}</span> 和 <span style="color: #22d3ee;">{{user}}</span> 占位。',
        forum: '长椅内置是运行时从角色卡、记忆和聊天素材拼出来的段落，锁定不能编辑；关掉只影响这套长椅预设。自定义条目按你选的角色和位置注入。'
      };
      builtinNote.innerHTML = tips[currentScene] || tips.chat;
    }
    const builtinOrderNote = document.getElementById('prompt-builtin-order-note');
    if (builtinOrderNote) {
      builtinOrderNote.style.display = '';
      const orderTips = {
        chat: '内置区段会按列表顺序真正重排；拖动会改变实际系统提示词的区段顺序，不只是列表显示。',
        theater: '剧场 7 条底座会按列表顺序真正重排；自定义条目仍按角色/位置注入。',
        forum: '长椅 8 条内置会按列表顺序真正重排；自定义条目仍按角色/位置注入。'
      };
      builtinOrderNote.textContent = orderTips[currentScene] || orderTips.chat;
    }
    const importBtn = document.getElementById('prompt-import-button');
    if (importBtn) {
      const importTips = {
        chat: { text: '导入（酒馆仅文风）', title: '支持糯叽机、酒馆和本 App 预设；糯叽机按预设模式完整导入，线上酒馆只提取文风、口癖、句长和分段' },
        theater: { text: '导入预设', title: '支持糯叽机、酒馆和本 App 预设；酒馆完整读取 prompts 与 prompt_order' },
        forum: { text: '导入预设', title: '支持糯叽机、酒馆和本 App 预设；长椅更建议手写一套广场预设' }
      };
      const tip = importTips[currentScene] || importTips.chat;
      importBtn.textContent = tip.text;
      importBtn.title = tip.title;
    }
  }

  function renderEntries() {
    const list = document.getElementById('prompt-entry-list');
    const status = document.getElementById('prompt-preset-status');
    const preset = activePreset();
    if (!list || !preset) return;
    const searchEl = document.getElementById('prompt-preset-search');
    if (searchEl) searchQuery = searchEl.value.trim();
    const enabledCount = preset.entries.filter(function(e) { return e.enabled !== false; }).length;
    const promptChars = estimateEnabledChars();
    const approxTokens = Math.max(1, Math.ceil(promptChars / 1.5));
    if (status) {
      const prefix = currentScene === 'theater' ? '剧场提示词约 ' : '生效提示词约 ';
      status.textContent = '共 ' + preset.entries.length + ' 条 · 已启用 ' + enabledCount + ' 条 · ' + prefix
        + promptChars.toLocaleString() + ' 字 / 粗估 ' + approxTokens.toLocaleString() + ' tokens（按 1 字≈0.67 token 粗估，不是精确计数）';
    }
    const previousScrollTop = list.scrollTop;
    const visible = preset.entries.filter(matchesSearch);
    let html = '';
    if (!visible.length) {
      const msg = !preset.entries.length
        ? (currentScene === 'theater'
          ? '这套剧场预设还没有板块。导入酒馆预设，或点右上角“＋ 自定义”添加。'
          : '这套聊天预设还没有板块，点右上角“＋ 自定义”添加。')
        : '没有找到匹配的条目';
      html = '<div style="padding: 18px 4px; text-align: center; font-size: 11px; color: var(--color-text-secondary);">' + msg + '</div>';
    } else {
      GROUP_ORDER.forEach(function(groupId) {
        const group = GROUPS[groupId];
        const items = visible.filter(function(entry) { return entryGroup(entry) === groupId; });
        if (!items.length) return;
        const enabledInGroup = items.filter(function(e) { return e.enabled !== false; }).length;
        const groupState = enabledInGroup === 0 ? 'off' : (enabledInGroup === items.length ? 'on' : 'mixed');
        const stateText = groupState === 'on' ? '全部开' : (groupState === 'off' ? '全部关' : '部分');
        const stateColor = groupState === 'on' ? '#07c160' : (groupState === 'off' ? 'var(--color-text-secondary)' : '#fbbf24');
        const stateIcon = groupState === 'on' ? '✓' : (groupState === 'off' ? '○' : '−');
        html += '<button type="button" onclick="togglePromptGroup(\'' + groupId + '\')" title="点击整组开/关；搜索时只作用于当前筛选结果" aria-label="' + escapeHtml(group.label + '，' + stateText + '，点击整组切换') + '" style="display: flex; width: 100%; align-items: center; gap: 6px; margin: 10px 2px 2px; padding: 5px 0 4px; position: sticky; top: 0; z-index: 2; background: var(--bg-elevated); border: 0; color: inherit; cursor: pointer; text-align: left; touch-action: manipulation;">' +
          '<span style="width: 7px; height: 7px; border-radius: 50%; background: ' + group.color + '; flex-shrink: 0;"></span>' +
          '<span style="font-size: 11px; font-weight: 800; color: var(--color-text-primary);">' + escapeHtml(group.label) + '</span>' +
          '<span style="font-size: 9.5px; color: var(--color-text-secondary);">' + enabledInGroup + '/' + items.length + '</span>' +
          '<span style="font-size: 9px; font-weight: 700; color: ' + stateColor + '; background: rgba(127,127,127,0.08); border: 0.5px solid var(--color-border); border-radius: 4px; padding: 1px 4px; flex-shrink: 0;">' + stateIcon + ' ' + stateText + '</span>' +
          '<span style="flex: 1; height: 0.5px; background: var(--color-border);"></span>' +
          '<span style="font-size: 9px; color: var(--color-text-secondary); flex-shrink: 0;">整组</span>' +
        '</button>';
        items.forEach(function(entry) {
          const builtin = entry.kind === 'builtin' ? builtinForScope(entry.id, currentScene) : null;
          const hint = entryHint(entry);
          const isSelected = !!selectedIds[entry.id];
          const canCopyBuiltin = !!builtin && currentScene === 'chat';
          const role = entryRole(entry);
          const pos = entryPosition(entry);
          const depth = entryDepth(entry);
          const modeBits = [];
          if (role !== 'system') modeBits.push(role === 'user' ? '用户' : '角色');
          if (pos === 'head') modeBits.push('头部');
          else if (pos === 'depth') modeBits.push('深度 ' + depth);
          else if (pos === 'message') modeBits.push('消息级');
          else if (modeBits.length) modeBits.push('底部');
          const modeBadge = modeBits.length
            ? '<span style="font-size: 9px; color: #38bdf8; background: rgba(56,189,248,0.1); border-radius: 4px; padding: 1px 4px; flex-shrink: 0;">' + escapeHtml(modeBits.join(' · ')) + '</span>'
            : '';
          html += '<div draggable="true" data-entry-id="' + escapeHtml(entry.id) + '" ' +
            'ondragstart="promptEntryDragStart(event, \'' + escapeHtml(entry.id) + '\')" ' +
            'ondragover="promptEntryDragOver(event)" ' +
            'ondrop="promptEntryDrop(event, \'' + escapeHtml(entry.id) + '\')" ' +
            'ondragend="promptEntryDragEnd(event)" ' +
            'style="display: flex; gap: 6px; align-items: flex-start; padding: 9px 0; border-top: 0.5px solid var(--color-border); cursor: grab;">' +
            '<span title="拖动排序" style="flex-shrink: 0; font-size: 12px; line-height: 1.6; color: var(--color-text-secondary); cursor: grab; user-select: none; opacity: 0.75;">⠿</span>' +
            (multiSelect
              ? '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onchange="togglePromptSelection(\'' + escapeHtml(entry.id) + '\', this.checked)" style="flex-shrink: 0; width: 15px; height: 15px; margin: 2px 0 0; accent-color: var(--info-primary); cursor: pointer;" />'
              : '') +
            '<div style="flex: 1; min-width: 0;">' +
              '<div style="display: flex; align-items: center; gap: 5px; min-width: 0;">' +
                '<span style="font-size: 12px; font-weight: 700; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + escapeHtml(entry.title) + '</span>' +
                '<span style="font-size: 9px; color: ' + (entry.kind === 'builtin' ? '#22d3ee' : '#a78bfa') + '; background: ' + (entry.kind === 'builtin' ? 'rgba(34,211,238,0.1)' : 'rgba(167,139,250,0.1)') + '; border-radius: 4px; padding: 1px 4px; flex-shrink: 0;">' + (entry.kind === 'builtin' ? '内置' : '自定义') + '</span>' +
                (builtin ? '<span style="font-size: 9px; color: #fbbf24; background: rgba(251,191,36,0.1); border: 0.5px solid rgba(251,191,36,0.24); border-radius: 4px; padding: 1px 4px; flex-shrink: 0;">锁定</span>' : '') +
                (entry.exclusiveGroup ? '<span style="font-size: 9px; color: #f472b6; background: rgba(244,114,182,0.1); border-radius: 4px; padding: 1px 4px; flex-shrink: 0;">互斥·' + escapeHtml(entry.exclusiveGroup) + '</span>' : '') +
                modeBadge +
              '</div>' +
              '<div style="font-size: 10px; color: var(--color-text-secondary); line-height: 1.4; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + escapeHtml(hint) + '</div>' +
            '</div>' +
            '<div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">' +
              (canCopyBuiltin
                ? '<button type="button" onclick="copyPromptBuiltinEntry(\'' + escapeHtml(entry.id) + '\')" title="复制内置原文为可编辑的自定义条目" style="padding: 3px 6px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--bg-elevated); color: var(--color-text-secondary); font-size: 9.5px; cursor: pointer;">复制</button>'
                : entry.kind === 'builtin'
                  ? ''
                  : '<button type="button" onclick="openPromptEntryEditor(\'' + escapeHtml(entry.id) + '\')" style="padding: 3px 6px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--bg-elevated); color: var(--color-text-secondary); font-size: 9.5px; cursor: pointer;">编辑</button>' +
                    '<button type="button" onclick="deletePromptEntry(\'' + escapeHtml(entry.id) + '\')" style="padding: 3px 6px; border-radius: 6px; border: 1px solid rgba(244,63,94,0.25); background: var(--bg-elevated); color: #fb7185; font-size: 9.5px; cursor: pointer;">删</button>') +
              (sortMode
                ? '<button type="button" onclick="movePromptEntry(\'' + escapeHtml(entry.id) + '\', -1)" title="上移" style="padding: 3px 5px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--bg-elevated); color: var(--color-text-secondary); font-size: 10px; cursor: pointer;">↑</button>' +
                  '<button type="button" onclick="movePromptEntry(\'' + escapeHtml(entry.id) + '\', 1)" title="下移" style="padding: 3px 5px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--bg-elevated); color: var(--color-text-secondary); font-size: 10px; cursor: pointer;">↓</button>'
                : '') +
              '<button type="button" role="switch" aria-checked="' + (entry.enabled !== false) + '" aria-label="启用 ' + escapeHtml(entry.title) + '" onclick="togglePromptEntry(\'' + escapeHtml(entry.id) + '\', ' + (entry.enabled !== false ? 'false' : 'true') + ')" style="flex-shrink: 0; width: 38px; height: 22px; padding: 0; border: 0; background: transparent; cursor: pointer; touch-action: manipulation;">' +
                '<span style="display: block; width: 38px; height: 22px; border-radius: 999px; background: ' + (entry.enabled !== false ? 'rgba(7,193,96,0.92)' : 'rgba(127,127,127,0.34)') + '; box-shadow: ' + (entry.enabled !== false ? '0 0 0 1px rgba(7,193,96,0.45)' : 'inset 0 0 0 1px var(--color-border)') + '; position: relative; transition: background 0.16s ease, box-shadow 0.16s ease;">' +
                  '<span style="position: absolute; top: 3px; left: ' + (entry.enabled !== false ? '19px' : '3px') + '; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.28); transition: left 0.16s ease;"></span>' +
                '</span>' +
              '</button>' +
            '</div>' +
          '</div>';
        });
      });
    }
    list.innerHTML = html;
    list.scrollTop = previousScrollTop;
    updatePresetToolbar();
  }

  function updatePresetToolbar() {
    const sortBtn = document.getElementById('prompt-sort-toggle');
    const multiBtn = document.getElementById('prompt-multi-toggle');
    const batchBar = document.getElementById('prompt-batch-bar');
    const batchCount = document.getElementById('prompt-batch-count');
    if (sortBtn) {
      sortBtn.style.color = sortMode ? '#07c160' : 'var(--color-text-secondary)';
      sortBtn.style.borderColor = sortMode ? 'rgba(7,193,96,0.38)' : 'var(--color-border)';
    }
    if (multiBtn) {
      multiBtn.style.color = multiSelect ? '#07c160' : 'var(--color-text-secondary)';
      multiBtn.style.borderColor = multiSelect ? 'rgba(7,193,96,0.38)' : 'var(--color-border)';
    }
    if (batchBar) batchBar.style.display = multiSelect ? 'flex' : 'none';
    if (batchCount) {
      const selected = Object.keys(selectedIds).filter(function(id) { return !!selectedIds[id]; });
      batchCount.textContent = '已选 ' + selected.length + ' 条';
    }
  }

  function sourceLabel(source) {
    const labels = { manual: '手动创建', sillytavern: '酒馆导入', momo: '本机预设', nuojiji: '糯叽机导入', builtin: '内置' };
    return labels[source] || String(source || '手动创建');
  }

  function formatMetaDate(value) {
    const date = new Date(Number(value) || Date.now());
    if (isNaN(date.getTime())) return '未知';
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function presetMetaSummary(preset) {
    if (!preset) return '未命名';
    const author = preset.author || '未署名';
    const version = preset.version ? ('v' + preset.version) : '无版本';
    return author + ' · ' + version + ' · ' + sourceLabel(preset.source);
  }

  function renderPresetMeta() {
    const preset = activePreset();
    const meta = document.getElementById('prompt-preset-meta');
    if (!preset || !meta) return;
    const authorEl = document.getElementById('prompt-meta-author');
    const versionEl = document.getElementById('prompt-meta-version');
    const descEl = document.getElementById('prompt-meta-description');
    const tagsEl = document.getElementById('prompt-meta-tags');
    const sourceEl = document.getElementById('prompt-meta-source');
    const updatedEl = document.getElementById('prompt-meta-updated');
    const summaryEl = document.getElementById('prompt-meta-summary');
    const toggleEl = document.getElementById('prompt-meta-toggle');
    const fieldsEl = document.getElementById('prompt-meta-fields');
    if (authorEl) authorEl.value = preset.author || '';
    if (versionEl) versionEl.value = preset.version || '';
    if (descEl) descEl.value = preset.description || '';
    if (tagsEl) tagsEl.value = (preset.tags || []).join('，');
    if (sourceEl) sourceEl.textContent = '来源：' + sourceLabel(preset.source);
    if (updatedEl) updatedEl.textContent = '最近修改：' + formatMetaDate(preset.updatedAt);
    if (summaryEl) summaryEl.textContent = presetMetaSummary(preset);
    if (toggleEl) toggleEl.textContent = metaExpanded ? '收起' : '展开';
    if (fieldsEl) fieldsEl.style.display = metaExpanded ? '' : 'none';
  }

  function togglePromptMeta() {
    metaExpanded = !metaExpanded;
    renderPresetMeta();
  }

  function previewPromptMeta() {
    const summaryEl = document.getElementById('prompt-meta-summary');
    if (!summaryEl) return;
    const authorEl = document.getElementById('prompt-meta-author');
    const versionEl = document.getElementById('prompt-meta-version');
    const sourceEl = document.getElementById('prompt-meta-source');
    const author = (authorEl && authorEl.value.trim()) || '未署名';
    const version = versionEl && versionEl.value.trim() ? ('v' + versionEl.value.trim()) : '无版本';
    const source = sourceEl ? sourceEl.textContent.replace(/^来源：/, '') : '手动创建';
    summaryEl.textContent = author + ' · ' + version + ' · ' + source;
  }

  function previewPromptInjection() {
    const modal = document.getElementById('prompt-injection-modal');
    const body = document.getElementById('prompt-injection-body');
    const title = document.getElementById('prompt-injection-title');
    if (!modal || !body) return;
    const preset = activePreset();
    if (!preset) return;
    const scope = normalizeScope(currentScene);
    const ctx = { scope: scope, charName: '角色', userName: '用户', userRemark: '用户', lastUserMessage: '用户刚发的一条消息' };
    const extras = entryInjection(ctx);
    const custom = preset.entries.filter(function(entry) {
      return entry.kind === 'custom' && entry.enabled !== false && String(entry.content || '').trim();
    });
    const systemHead = custom.filter(function(entry) { return entryRole(entry) === 'system' && entryPosition(entry) === 'head'; });
    const systemTail = custom.filter(function(entry) { return entryRole(entry) === 'system' && entryPosition(entry) === 'tail'; });
    const sample = [
      { role: 'user', content: '用户上一条消息' },
      { role: 'assistant', content: '角色上一条回复' },
      { role: 'user', content: '用户刚发的一条消息' }
    ];
    const injected = injectMessages(sample, ctx);
    const lines = [];
    lines.push('场景：' + (SCENES[scope] ? SCENES[scope].label : scope) + ' · 预设：' + (preset.name || '未命名'));
    lines.push('');
    lines.push('系统提示词（messages[0]，role=system）');
    lines.push('  头部条目：' + (systemHead.length ? systemHead.map(function(e) { return e.title; }).join(' / ') : '无'));
    lines.push('  底部条目：' + (systemTail.length ? systemTail.map(function(e) { return e.title; }).join(' / ') : '无'));
    lines.push('  这些条目不会单独出现在消息数组里，而是拼进系统提示词。');
    lines.push('');
    lines.push('实际消息数组（示例历史 3 条）');
    lines.push('[0] system | 系统提示词（含上面的头部/底部条目）');
    injected.forEach(function(message, index) {
      lines.push('[' + (index + 1) + '] ' + message.role + ' | ' + oneLine(message.content, 64));
    });
    if (extras.head.length) {
      lines.push('');
      lines.push('头部消息（role 不是 system 时，会排在历史前面）：');
      extras.head.forEach(function(message) { lines.push('  ' + message.role + ' | ' + oneLine(message.content, 56)); });
    }
    if (extras.depth.length) {
      lines.push('');
      lines.push('深度插入（数字表示从对话末尾倒数第几条之前插入；同深度 system 会合并成一段）：');
      const systemDepthCount = extras.depth.filter(function(item) { return item.message.role === 'system'; }).length;
      if (systemDepthCount > 1) lines.push('  本次有 ' + systemDepthCount + ' 条 system 深度条目，会合并；中间夹 assistant 时会分成多段。');
      extras.depth.slice().sort(function(a, b) { return a.depth - b.depth; }).forEach(function(item) {
        lines.push('  深度 ' + item.depth + ' · ' + item.message.role + ' | ' + oneLine(item.message.content, 56));
      });
    }
    if (extras.tail.length) {
      lines.push('');
      lines.push('尾部消息（消息级或非 system 的底部条目，会排在历史后面）：');
      extras.tail.forEach(function(message) { lines.push('  ' + message.role + ' | ' + oneLine(message.content, 56)); });
    }
    if (title) title.textContent = '本轮注入预览 · ' + (SCENES[scope] ? SCENES[scope].short : scope);
    body.textContent = lines.join('\n');
    modal.style.display = 'flex';
  }

  function auditTheaterPreset() {
    const modal = document.getElementById('prompt-injection-modal');
    const body = document.getElementById('prompt-injection-body');
    const title = document.getElementById('prompt-injection-title');
    if (!modal || !body) return;
    const preset = activePreset('theater');
    if (!preset) return;
    const ctx = { scope: 'theater', charName: '角色', userName: '用户', userRemark: '用户', lastUserMessage: '用户刚发的一条消息' };
    const custom = (preset.entries || []).filter(function(entry) {
      return entry.kind === 'custom' && entry.enabled !== false && String(entry.content || '').trim();
    });
    const customSystem = custom.filter(function(entry) {
      return entryRole(entry) === 'system' && (entryPosition(entry) === 'head' || entryPosition(entry) === 'tail');
    });
    const extras = entryInjection(ctx);
    const builtinTotal = THEATER_BUILTINS.length;
    const builtinEnabled = THEATER_BUILTINS.filter(function(item) { return isEnabled(item.id, 'theater'); }).length;
    const lines = [];
    lines.push('预设：' + (preset.name || '未命名') + '  [' + (preset.scope || 'theater') + ']');
    lines.push('作者：' + (preset.author || '未署名') + ' · 版本：' + (preset.version || '无') + ' · 来源：' + sourceLabel(preset.source));
    lines.push('');
    lines.push('启用条目：自定义 ' + custom.length + ' 条 / 内置 ' + builtinEnabled + ' 条（内置共 ' + builtinTotal + ' 条）');
    if (customSystem.length) {
      lines.push('');
      lines.push('系统提示词里的自定义条目：');
      customSystem.slice(0, 12).forEach(function(entry) {
        lines.push('  · [' + entryPosition(entry) + '] ' + (entry.title || '未命名'));
      });
      if (customSystem.length > 12) lines.push('  · …还有 ' + (customSystem.length - 12) + ' 条');
    }
    lines.push('');
    lines.push('消息级注入：头部 ' + extras.head.length + ' 条 · 深度 ' + extras.depth.length + ' 条 · 尾部 ' + extras.tail.length + ' 条');
    extras.depth.slice().sort(function(a, b) { return a.depth - b.depth; }).slice(0, 8).forEach(function(item) {
      lines.push('  · 深度 ' + item.depth + ' · ' + item.message.role + ' · ' + oneLine(item.message.content.replace(/^【预设 · ([^】]+)】.*$/s, '$1'), 36));
    });
    lines.push('');
    const getter = typeof window.getTheaterSystemPrompt === 'function';
    if (!getter) {
      lines.push('结论：⚠️ theater.js 未加载，暂时拿不到剧场系统提示。');
    } else {
      let base = '';
      let applied = '';
      try {
        base = window.getTheaterSystemPrompt({ skipPreset: true }) || '';
        applied = window.getTheaterSystemPrompt() || '';
      } catch (e) {
        lines.push('结论：⚠️ 读取剧场系统提示失败：' + (e && e.message ? e.message : e));
      }
      if (base || applied) {
        lines.push('系统提示词：基底 ' + base.length + ' 字 → 带预设 ' + applied.length + ' 字（净增 ' + (applied.length - base.length) + ' 字）');
        const hit = customSystem.filter(function(entry) {
          return applied.indexOf('【预设 · ' + (entry.title || '自定义条目') + '】') !== -1;
        }).length;
        lines.push('自定义 system 条目命中：' + hit + ' / ' + customSystem.length);
        const missing = customSystem.filter(function(entry) {
          return applied.indexOf('【预设 · ' + (entry.title || '自定义条目') + '】') === -1;
        });
        if (missing.length) {
          lines.push('未命中：' + missing.slice(0, 6).map(function(entry) { return entry.title || '未命名'; }).join(' / '));
        }
        lines.push('');
        if (applied !== base) {
          lines.push('结论：✅ 预设已进入剧场系统提示。下一轮剧场请求会按上面的条目和注入位置发送。');
        } else {
          lines.push('结论：⚠️ 带预设和基底完全一样，当前预设没有实际生效。');
          lines.push('先确认预设页的「线下剧场」标签当前激活的是这份预设，而不是线上聊天那份。');
        }
        if (customSystem.length && hit === 0) {
          lines.push('注意：有自定义 system 条目但一个都没命中，检查条目位置/角色，或导入时是否被分流到线上聊天。');
        }
      }
    }
    if (title) title.textContent = '剧场预设体检 · ' + (preset.name || '未命名');
    body.textContent = lines.join('\n');
    modal.style.display = 'flex';
  }

  function closePromptInjectionPreview() {
    const modal = document.getElementById('prompt-injection-modal');
    if (modal) modal.style.display = 'none';
  }

  function oneLine(text, max) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max || 60);
  }

  function checkPromptCompatibility() {
    const modal = document.getElementById('prompt-compat-modal');
    const body = document.getElementById('prompt-compat-body');
    const title = document.getElementById('prompt-compat-title');
    if (!modal || !body) return;
    const preset = activePreset();
    if (!preset) return;
    const entries = (preset.entries || []).filter(function(entry) {
      return entry.enabled !== false && String(entry.content || '').trim();
    });
    const skipped = (preset.entries || []).length - entries.length;
    const hits = { voice: [], sticker: [], thinking: [], macro: [], regex: [], worldbook: [], cot: [] };
    const add = function(bucket, entry, text) {
      if (text) hits[bucket].push((entry.title || '未命名') + '：' + oneLine(text, 46));
    };
    entries.forEach(function(entry) {
      const content = String(entry.content || '');
      const voice = content.match(/\[语音[：:][^\]]*\]/g);
      if (voice) voice.forEach(function(item) { add('voice', entry, item); });
      const sticker = content.match(/\[(?:STICKER|表情包|表情)[：:][^\]]*\]/g);
      if (sticker) sticker.forEach(function(item) { add('sticker', entry, item); });
      const thinking = content.match(/<\/?(?:think|thinking|thought)>/g);
      if (thinking) thinking.forEach(function(item) { add('thinking', entry, item); });
      const macros = content.match(/\{\{[^{}]+\}\}/g) || [];
      macros.forEach(function(item) {
        const name = item.replace(/\{\{|\}\}/g, '').trim();
        if (!/^(char|user|user_name|lastUserMessage)$/.test(name)) add('macro', entry, item);
      });
      if (/(?:正则表达式|酒馆正则|regexp?|regex)/i.test(content)) add('regex', entry, '含正则/正则说明');
      if (/(?:世界书|worldbook|world book)/i.test(content)) add('worldbook', entry, '含世界书说明');
      if (/(?:思维链|chain of thought|chain-of-thought)/i.test(content)) add('cot', entry, '含思维链说明');
    });

    const lines = [];
    lines.push('场景：' + (SCENES[preset.scope] ? SCENES[preset.scope].label : preset.scope) + ' · 预设：' + (preset.name || '未命名'));
    lines.push('扫描：' + entries.length + ' 条启用条目' + (skipped ? '（跳过 ' + skipped + ' 条停用/空条目）' : ''));
    lines.push('');
    const compatible = [];
    if (hits.voice.length) compatible.push('语音标签 ' + hits.voice.length + ' 处：会显示成一条语音条，点开看文字，不播放音频');
    if (hits.sticker.length) compatible.push('表情包标签 ' + hits.sticker.length + ' 处：本地没有对应表情时自动隐藏，不伪造图片');
    if (hits.thinking.length) compatible.push('thinking 标签 ' + hits.thinking.length + ' 处：不会出现在气泡里');
    if (compatible.length) {
      lines.push('已兼容：');
      compatible.forEach(function(text) { lines.push('  ✓ ' + text); });
    } else {
      lines.push('已兼容：没有发现语音/表情包/thinking 标签。');
    }
    const warnings = [];
    if (hits.macro.length) warnings.push('未识别宏 ' + hits.macro.length + ' 处：当前只替换 {{char}} / {{user}} / {{user_name}} / {{lastUserMessage}}');
    if (hits.regex.length) warnings.push('正则说明 ' + hits.regex.length + ' 处：小手机还没执行酒馆正则');
    if (hits.worldbook.length) warnings.push('世界书说明 ' + hits.worldbook.length + ' 处：还没关联本地世界书');
    if (hits.cot.length) warnings.push('思维链说明 ' + hits.cot.length + ' 处：还没真正执行，模型可能把规则复读出来');
    if (warnings.length) {
      lines.push('');
      lines.push('仍需注意：');
      warnings.forEach(function(text) { lines.push('  ! ' + text); });
    } else {
      lines.push('');
      lines.push('仍需注意：没有发现明显不兼容的写法。');
    }
    const examples = [];
    ['macro', 'regex', 'worldbook', 'cot'].forEach(function(key) {
      if (hits[key].length) examples.push(hits[key][0]);
    });
    if (examples.length) {
      lines.push('');
      lines.push('示例位置：');
      examples.slice(0, 4).forEach(function(text) { lines.push('  · ' + text); });
    }
    if (title) title.textContent = '预设兼容检查 · ' + (preset.name || '未命名');
    body.textContent = lines.join('\n');
    modal.style.display = 'flex';
  }

  function closePromptCompatibility() {
    const modal = document.getElementById('prompt-compat-modal');
    if (modal) modal.style.display = 'none';
  }

  function togglePromptGroup(groupId) {
    if (!GROUPS[groupId]) return;
    const preset = activePreset();
    if (!preset) return;
    const targets = preset.entries.filter(function(entry) {
      if (entryGroup(entry) !== groupId) return false;
      return !searchQuery || matchesSearch(entry);
    });
    if (!targets.length) return;
    const allEnabled = targets.every(function(entry) { return entry.enabled !== false; });
    const nextEnabled = !allEnabled;
    targets.forEach(function(entry) { entry.enabled = nextEnabled; });
    if (nextEnabled) enforceExclusiveGroups();
    persist();
    renderEntries();
  }

  function setSearchQuery(value) {
    searchQuery = String(value || '').trim();
    renderEntries();
  }

  function toggleSortMode() {
    sortMode = !sortMode;
    renderEntries();
  }

  function toggleMultiSelect() {
    multiSelect = !multiSelect;
    selectedIds = {};
    renderEntries();
  }

  function toggleSelection(id, checked) {
    if (!findEntry(id)) return;
    selectedIds[id] = !!checked;
    updatePresetToolbar();
  }

  function selectAllEntries() {
    const preset = activePreset();
    if (!preset) return;
    preset.entries.filter(matchesSearch).forEach(function(entry) { selectedIds[entry.id] = true; });
    renderEntries();
  }

  function clearSelection() {
    selectedIds = {};
    renderEntries();
  }

  function batchSetEnabled(enabled) {
    const preset = activePreset();
    if (!preset) return;
    preset.entries.forEach(function(entry) {
      if (selectedIds[entry.id]) entry.enabled = !!enabled;
    });
    if (enabled) enforceExclusiveGroups();
    persist();
    renderEntries();
  }

  function enforceExclusiveGroups() {
    const preset = activePreset();
    if (!preset) return;
    const seen = {};
    preset.entries.forEach(function(entry) {
      if (entry.enabled === false || !entry.exclusiveGroup) return;
      if (seen[entry.exclusiveGroup]) entry.enabled = false;
      else seen[entry.exclusiveGroup] = true;
    });
  }

  function moveEntry(id, direction) {
    const preset = activePreset();
    const entry = findEntry(id);
    if (!preset || !entry) return;
    const group = entryGroup(entry);
    const index = preset.entries.indexOf(entry);
    const step = direction < 0 ? -1 : 1;
    let targetIndex = -1;
    for (let i = index + step; i >= 0 && i < preset.entries.length; i += step) {
      if (entryGroup(preset.entries[i]) === group) { targetIndex = i; break; }
    }
    if (targetIndex < 0) return;
    preset.entries.splice(index, 1);
    preset.entries.splice(targetIndex, 0, entry);
    persist();
    renderEntries();
  }

  function promptEntryDragStart(event, id) {
    draggedEntryId = id;
    try {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    } catch (e) {}
  }

  function promptEntryDragOver(event) {
    event.preventDefault();
    try { event.dataTransfer.dropEffect = 'move'; } catch (e) {}
  }

  function promptEntryDrop(event, targetId) {
    event.preventDefault();
    const preset = activePreset();
    const sourceId = draggedEntryId || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
    const source = findEntry(sourceId);
    const target = findEntry(targetId);
    if (!preset || !source || !target || source.id === target.id) return;
    if (entryGroup(source) !== entryGroup(target)) return;
    const from = preset.entries.indexOf(source);
    const to = preset.entries.indexOf(target);
    if (from < 0 || to < 0) return;
    preset.entries.splice(from, 1);
    preset.entries.splice(to, 0, source);
    persist();
    renderEntries();
  }

  function promptEntryDragEnd() {
    draggedEntryId = '';
  }

  function sectionStart(text, marker) {
    let index = text.indexOf(marker);
    if (index < 0) return -1;
    if (marker.charAt(0) === '【') return index;
    const open = text.lastIndexOf('【', index);
    if (open >= 0 && open > text.lastIndexOf('\n', index)) return open;
    return index;
  }

  function sectionEnd(text, marker, from) {
    let index = text.indexOf(marker, from);
    if (index < 0) return -1;
    if (marker.charAt(0) === '【') return index;
    const open = text.lastIndexOf('【', index);
    if (open >= from && open > text.lastIndexOf('\n', index)) return open;
    return index;
  }

  function builtinSectionText(id) {
    const bounds = SECTION_BOUNDS[id];
    if (!bounds) return '';
    let full = '';
    try {
      if (typeof window.getFullSystemPrompt === 'function') {
        full = window.getFullSystemPrompt({ skipPreset: true, skipWorld: true });
      }
    } catch (e) {}
    if (!full) return '';
    const start = sectionStart(full, bounds[0]);
    if (start < 0) return '';
    const end = bounds[1] ? sectionEnd(full, bounds[1], start) : full.length;
    let body = full.slice(start, end >= 0 ? end : full.length).trim();
    // 自定义条目的标题会自己生成，去掉原区段的第一行标题，避免重复。
    body = body.replace(/^【[^\n]*】[：:]?\s*/, '').trim();
    return body;
  }

  function copyBuiltinEntry(id) {
    if (currentScene !== 'chat') {
      alert('剧场底座是运行时从故事设定生成的，不能直接复制；请点“＋ 自定义”另写一条。');
      return;
    }
    const builtin = BUILTIN_MAP[id];
    if (!builtin) return;
    const content = builtinSectionText(id);
    if (!content) {
      alert('还没拿到这段内置原文。请确认聊天脚本已加载后再试，或直接在聊天页打开预设。');
      return;
    }
    const preset = activePreset();
    if (!preset) return;
    preset.entries.push({
      id: uid('entry'),
      kind: 'custom',
      title: builtin.title + '（副本）',
      hint: builtin.hint,
      content: content,
      group: builtin.group,
      role: 'system',
      position: 'tail',
      depth: 0,
      exclusiveGroup: '',
      enabled: true,
      updatedAt: Date.now()
    });
    persist();
    renderEntries();
    alert('已复制「' + builtin.title + '」为自定义条目，可以编辑它；原内置条目仍然锁定。');
  }


  function renderSettings() {
    const nameEl = document.getElementById('prompt-preset-name-input');
    const searchEl = document.getElementById('prompt-preset-search');
    ensureScenePreset(currentScene);
    const preset = activePreset();
    cachedPromptChars = null;
    if (nameEl && preset) nameEl.value = preset.name || '';
    if (searchEl) searchEl.value = '';
    searchQuery = '';
    renderSceneTabs();
    renderSelect();
    renderEntries();
    renderPresetMeta();
  }

  function captureForm() {
    const preset = activePreset();
    if (!preset) return null;
    const nameEl = document.getElementById('prompt-preset-name-input');
    if (nameEl && nameEl.value.trim()) preset.name = nameEl.value.trim();
    const authorEl = document.getElementById('prompt-meta-author');
    const versionEl = document.getElementById('prompt-meta-version');
    const descEl = document.getElementById('prompt-meta-description');
    const tagsEl = document.getElementById('prompt-meta-tags');
    if (authorEl) preset.author = authorEl.value.trim().slice(0, 40);
    if (versionEl) preset.version = versionEl.value.trim().slice(0, 20);
    if (descEl) preset.description = descEl.value.trim().slice(0, 240);
    if (tagsEl) preset.tags = normalizeTagList(tagsEl.value);
    persist();
    return preset;
  }

  function switchTo(id) {
    const preset = getPreset(id);
    if (!preset) return;
    try { captureForm(); } catch (e) {}
    currentScene = normalizeScope(preset.scope);
    activeIds[currentScene] = id;
    persist();
    renderSettings();
  }

  function switchScene(scene) {
    scene = normalizeScope(scene);
    if (scene === currentScene) return;
    try { captureForm(); } catch (e) {}
    currentScene = scene;
    cachedPromptChars = null;
    ensureScenePreset(scene);
    localStorage.setItem(K_SCENE, scene);
    renderSettings();
  }

  function createPreset() {
    try { captureForm(); } catch (e) {}
    const sceneCount = presets.filter(function(p) { return p.scope === currentScene; }).length;
    const newPreset = makePreset('新预设 ' + (sceneCount + 1), currentScene);
    presets.push(newPreset);
    activeIds[currentScene] = newPreset.id;
    persist();
    renderSettings();
    const nameEl = document.getElementById('prompt-preset-name-input');
    if (nameEl) { nameEl.focus(); try { nameEl.select(); } catch (e) {} }
  }

  function savePreset() {
    const preset = activePreset();
    if (!preset) return;
    const nameEl = document.getElementById('prompt-preset-name-input');
    const nextName = nameEl && nameEl.value.trim() ? nameEl.value.trim() : (preset.name || '未命名预设');
    if (!confirm('保存会覆盖当前' + SCENES[currentScene].short + '预设「' + nextName + '」的条目、开关和预设信息。\n\n继续保存？')) return;
    const saved = captureForm();
    if (!saved) return;
    renderSettings();
    alert('已保存' + SCENES[currentScene].short + '预设：' + (saved.name || '未命名预设'));
  }

  function deletePreset() {
    const scenePresets = presets.filter(function(p) { return p.scope === currentScene; });
    if (scenePresets.length <= 1) { alert('至少保留一套' + SCENES[currentScene].short + '预设。'); return; }
    const preset = activePreset();
    if (!preset) return;
    if (!confirm('删除' + SCENES[currentScene].short + '预设「' + preset.name + '」？\n\n只会删除这套预设的条目和开关状态，不会删除聊天记录。')) return;
    presets = presets.filter(function(p) { return p.id !== preset.id; });
    const fallback = presets.find(function(p) { return p.scope === currentScene; }) || null;
    if (fallback) activeIds[currentScene] = fallback.id;
    persist();
    renderSettings();
  }

  function toggleEntry(id, enabled) {
    const entry = findEntry(id);
    if (!entry) return;
    entry.enabled = !!enabled;
    if (entry.enabled && entry.exclusiveGroup) {
      const preset = activePreset();
      if (preset) {
        preset.entries.forEach(function(other) {
          if (other.id !== entry.id && other.exclusiveGroup === entry.exclusiveGroup) other.enabled = false;
        });
      }
    }
    persist();
    renderEntries();
  }

  function openEntryEditor(id) {
    const modal = document.getElementById('prompt-entry-modal');
    if (!modal) return;
    editingEntryId = id || '';
    const entry = id ? findEntry(id) : null;
    const titleEl = document.getElementById('prompt-entry-title');
    const hintEl = document.getElementById('prompt-entry-hint');
    const contentEl = document.getElementById('prompt-entry-content');
    const positionEl = document.getElementById('prompt-entry-position');
    const roleEl = document.getElementById('prompt-entry-role');
    const depthEl = document.getElementById('prompt-entry-depth');
    const groupEl = document.getElementById('prompt-entry-group');
    const exclusiveEl = document.getElementById('prompt-entry-exclusive');
    const modalTitle = document.getElementById('prompt-entry-modal-title');
    if (titleEl) titleEl.value = entry ? entry.title : '';
    if (hintEl) hintEl.value = entry ? entry.hint || '' : '';
    if (contentEl) contentEl.value = entry ? entry.content || '' : '';
    if (positionEl) positionEl.value = entry ? entryPosition(entry) : 'tail';
    if (roleEl) roleEl.value = entry ? entryRole(entry) : 'system';
    if (depthEl) depthEl.value = entry ? String(entryDepth(entry)) : '0';
    if (groupEl) groupEl.value = entry && GROUPS[entry.group] ? entry.group : 'custom';
    if (exclusiveEl) exclusiveEl.value = entry ? entry.exclusiveGroup || '' : '';
    if (modalTitle) modalTitle.textContent = entry ? '编辑预设条目' : '新增预设条目';
    modal.style.display = 'flex';
    setTimeout(function() { if (titleEl) titleEl.focus(); }, 120);
  }

  function closeEntryEditor() {
    const modal = document.getElementById('prompt-entry-modal');
    if (modal) modal.style.display = 'none';
    editingEntryId = '';
  }

  function saveEntry() {
    const preset = activePreset();
    if (!preset) return;
    const titleEl = document.getElementById('prompt-entry-title');
    const hintEl = document.getElementById('prompt-entry-hint');
    const contentEl = document.getElementById('prompt-entry-content');
    const positionEl = document.getElementById('prompt-entry-position');
    const roleEl = document.getElementById('prompt-entry-role');
    const depthEl = document.getElementById('prompt-entry-depth');
    const groupEl = document.getElementById('prompt-entry-group');
    const exclusiveEl = document.getElementById('prompt-entry-exclusive');
    const title = titleEl ? titleEl.value.trim() : '';
    if (!title) { alert('给这个条目起一个名字。'); return; }
    const current = editingEntryId ? findEntry(editingEntryId) : null;
    const data = {
      kind: 'custom',
      title: title,
      hint: hintEl ? hintEl.value.trim() : '',
      content: contentEl ? contentEl.value : '',
      group: groupEl && GROUPS[groupEl.value] ? groupEl.value : 'custom',
      role: normalizeEntryRole(roleEl ? roleEl.value : 'system'),
      position: normalizeEntryPosition(positionEl ? positionEl.value : 'tail'),
      depth: normalizeEntryDepth(depthEl ? depthEl.value : 0),
      exclusiveGroup: exclusiveEl ? exclusiveEl.value.trim() : '',
      enabled: current ? current.enabled !== false : true,
      updatedAt: Date.now()
    };
    let target = null;
    if (editingEntryId) {
      const entry = findEntry(editingEntryId);
      if (entry) { Object.assign(entry, data); target = entry; }
    } else {
      target = Object.assign({ id: uid('entry') }, data);
      preset.entries.push(target);
    }
    if (target && target.enabled && target.exclusiveGroup) {
      preset.entries.forEach(function(other) {
        if (other.id !== target.id && other.exclusiveGroup === target.exclusiveGroup) other.enabled = false;
      });
    }
    persist();
    renderEntries();
    closeEntryEditor();
  }

  function deleteEntry(id) {
    const entry = findEntry(id);
    if (!entry || entry.kind !== 'custom') return;
    if (!confirm('删除条目「' + entry.title + '」？')) return;
    const preset = activePreset();
    preset.entries = preset.entries.filter(function(e) { return e.id !== id; });
    persist();
    renderEntries();
  }

  function uniquePresetName(name, fallbackName) {
    const base = String(name || fallbackName || '导入预设').trim() || '导入预设';
    if (!presets.some(function(p) { return p.name === base; })) return base;
    let suffix = 2;
    let candidate = base + ' · 导入';
    while (presets.some(function(p) { return p.name === candidate; })) {
      suffix += 1;
      candidate = base + ' · 导入 ' + suffix;
    }
    return candidate;
  }

  function importedCustomEntry(raw, index, fallbackName) {
    if (!raw) return null;
    const content = typeof raw.content === 'string' ? raw.content : (typeof raw.text === 'string' ? raw.text : '');
    if (!content.trim()) return null;
    const title = String(raw.title || raw.name || raw.identifier || (fallbackName + ' 条目 ' + (index + 1))).trim().slice(0, 60);
    const injection = importedInjection(raw);
    return {
      id: uid('entry'),
      kind: 'custom',
      title: title || ('导入条目 ' + (index + 1)),
      hint: typeof raw.hint === 'string' ? raw.hint : '',
      content: content.trim(),
      group: GROUPS[raw.group] ? raw.group : 'custom',
      role: normalizeEntryRole(raw.role),
      position: injection.position,
      depth: injection.depth,
      injectionOrder: normalizeInjectionOrder(raw.injection_order != null ? raw.injection_order : raw.injectionOrder),
      exclusiveGroup: typeof raw.exclusiveGroup === 'string' ? raw.exclusiveGroup.trim() : '',
      enabled: raw.enabled !== false,
      updatedAt: Date.now()
    };
  }

  function sillyTavernOrder(raw) {
    if (!raw || !Array.isArray(raw.prompt_order)) return null;
    let chosen = null;
    raw.prompt_order.forEach(function(item) {
      if (!item || !Array.isArray(item.order)) return;
      if (!chosen) chosen = item;
      if (item.character_id === 100001) chosen = item;
    });
    return chosen ? chosen.order : null;
  }

  function isSillyTavernRaw(raw) {
    return !!raw && Array.isArray(raw.prompts);
  }

  const ST_STYLE_TITLE_WORDS = [
    '文风', '风格', '语气', '口癖', '措辞', '用词', '短句', '长句', '分段', '标点',
    '语言', '表达', '节奏', '描写', '行文', '人称', '叙述', '字数', '排版', '对话风格'
  ];
  const ST_STYLE_BODY_WORDS = [
    '文风', '口癖', '短句', '长句', '分段', '标点', '措辞', '用词', '语言风格',
    '行文', '叙事人称', '说话方式', '表达习惯', '对话节奏'
  ];

  function isSillyTavernStyleEntry(row) {
    const item = row && row.item ? row.item : {};
    const title = String(item.title || item.name || item.identifier || '').toLowerCase();
    const body = String(item.content || item.text || '').slice(0, 180).toLowerCase();
    if (ST_STYLE_TITLE_WORDS.some(function(word) { return title.indexOf(word) !== -1; })) return true;
    return ST_STYLE_BODY_WORDS.some(function(word) { return body.indexOf(word) !== -1; });
  }

  function importedSillyTavernPreset(raw, fallbackName, options) {
    options = options || {};
    const targetScope = normalizeScope(options.scope);
    const styleOnly = options.styleOnly === true;
    const baseName = raw.name || fallbackName;
    const preset = normalizePreset({
      name: styleOnly ? (baseName + ' · 线上文风') : baseName,
      entries: []
    }, targetScope);
    // 酒馆预设自带 system/main/jailbreak；线上保留小手机身份、关系、时间、记忆和底线底座，只默认关掉容易抢文风的内置。
    const KEEP_BUILTINS = {
      character_setting: true,
      relationship: true,
      user_profile: true,
      time: true,
      memory: true,
      honesty: true,
      taboos: true,
      core: true
    };
    preset.entries.forEach(function(entry) {
      if (entry.kind === 'builtin' && targetScope === 'chat') entry.enabled = KEEP_BUILTINS[entry.id] === true;
    });
    const order = sillyTavernOrder(raw);
    const orderMap = {};
    const orderIndex = {};
    if (order) {
      order.forEach(function(item, index) {
        if (!item || !item.identifier) return;
        orderMap[item.identifier] = item.enabled !== false;
        orderIndex[item.identifier] = index;
      });
    }
    const rows = [];
    raw.prompts.forEach(function(item, index) {
      if (!item || item.marker === true) return;
      rows.push({ item: item, index: index, key: item.identifier || item.name || '' });
    });
    rows.sort(function(a, b) {
      const ai = orderIndex[a.key];
      const bi = orderIndex[b.key];
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.index - b.index;
    });
    let importedCount = 0;
    rows.forEach(function(row) {
      if (styleOnly && !isSillyTavernStyleEntry(row)) return;
      const entry = importedCustomEntry(row.item, row.index, fallbackName);
      if (!entry) return;
      if (order) entry.enabled = orderMap[row.key] === true;
      if (styleOnly) entry.hint = '从酒馆预设提取的文风条目';
      preset.entries.push(entry);
      importedCount += 1;
    });
    if (!importedCount) {
      throw new Error(styleOnly
        ? '这个酒馆预设里没有识别到可提取的文风条目。完整版请切到「线下剧场」再导入。'
        : '这个酒馆预设里没有可导入的正文条目（prompts 可能全是占位标记）。');
    }
    preset.source = 'sillytavern';
    preset.author = String(raw.author || raw.creator || '').trim().slice(0, 40);
    preset.version = raw.version == null ? '' : String(raw.version).trim().slice(0, 20);
    preset.description = String(raw.description || raw.comment || '').trim().slice(0, 240);
    preset.tags = normalizeTagList(styleOnly ? ['酒馆文风'] : ['酒馆导入']);
    return preset;
  }

  function isNuojijiRaw(raw) {
    return !!raw && raw.__nuojijiChatPreset === true && Array.isArray(raw.blocks);
  }

  function importedNuojijiPreset(raw, fallbackName, options) {
    options = options || {};
    const targetScope = normalizeScope(options.scope);
    const baseName = String(raw.name || fallbackName || '糯叽机预设').trim();
    const preset = normalizePreset({ name: baseName, entries: [] }, targetScope);
    let importedCount = 0;
    raw.blocks.forEach(function(block, index) {
      if (!block || block.type === 'marker') return;
      const content = typeof block.content === 'string' ? block.content.trim() : '';
      if (!content) return;
      const title = String(block.name || block.key || (fallbackName + ' 板块 ' + (index + 1))).trim().slice(0, 60);
      const injection = importedInjection(block);
      preset.entries.push({
        id: uid('entry'),
        kind: 'custom',
        title: title || ('糯叽机板块 ' + (index + 1)),
        hint: '糯叽机预设 · ' + (raw.mode || 'online'),
        content: content,
        group: 'custom',
        role: normalizeEntryRole(block.role),
        position: injection.position,
        depth: injection.depth,
        enabled: block.enabled !== false,
        updatedAt: Date.now()
      });
      importedCount += 1;
    });
    if (!importedCount) throw new Error('这个糯叽机预设里没有可导入的正文板块。');
    preset.source = 'nuojiji';
    preset.author = String(raw.author || '').trim().slice(0, 40);
    preset.version = raw.version == null ? '' : String(raw.version).trim().slice(0, 20);
    preset.description = '糯叽机 ' + (raw.mode || 'online') + ' 预设 · ' + importedCount + ' 个板块';
    preset.tags = normalizeTagList(['糯叽机', raw.mode || 'online']);
    return preset;
  }

  // 支持五种格式：本 App 导出的预设、裸预设对象/数组、SillyTavern prompts + prompt_order、糯叽机 blocks。
  function presetFromImported(raw, fallbackName, options) {
    raw = raw || {};
    options = options || {};
    if (isNuojijiRaw(raw)) {
      return importedNuojijiPreset(raw, fallbackName, options);
    }
    if (isSillyTavernRaw(raw)) {
      return importedSillyTavernPreset(raw, fallbackName, options);
    }
    let entries = Array.isArray(raw.entries) ? raw.entries : null;
    if (!entries) {
      const single = importedCustomEntry(raw, 0, fallbackName);
      entries = single ? [single] : [];
    }
    const merged = {};
    Object.keys(raw).forEach(function(key) { merged[key] = raw[key]; });
    merged.name = raw.name || fallbackName;
    merged.entries = entries;
    return normalizePreset(merged, options.scope);
  }

  function collectImportedPresets(data, fileName, scope, options) {
    const targetScope = normalizeScope(scope);
    options = options || {};
    const fallbackName = String(fileName || '导入预设').replace(/\.[^.]+$/, '').trim() || '导入预设';
    let items = [];
    if (Array.isArray(data)) items = data;
    else if (isNuojijiRaw(data)) items = [data];
    else if (data && data.format === 'momo-prompt-preset' && data.preset) items = [data.preset];
    else if (data && Array.isArray(data.presets)) items = data.presets;
    else if (data && (Array.isArray(data.entries) || Array.isArray(data.prompts) || typeof data.content === 'string' || typeof data.text === 'string')) items = [data];
    if (!items.length) throw new Error('这个文件不像聊天预设：缺少 entries / prompts 字段。');
    return items.map(function(raw, index) {
      const imported = presetFromImported(raw, fallbackName + (items.length > 1 ? ' ' + (index + 1) : ''), {
        scope: targetScope,
        styleOnly: options.styleOnly === true && isSillyTavernRaw(raw)
      });
      const normalized = normalizePreset(imported, targetScope);
      normalized.id = uid('preset');
      normalized.scope = targetScope;
      if (data && data.format === 'momo-prompt-preset' && normalized.source === 'manual') normalized.source = 'momo';
      normalized.name = uniquePresetName(normalized.name, fallbackName + (items.length > 1 ? ' ' + (index + 1) : ''));
      return normalized;
    });
  }

  function importPreviewMessage(data, imported, targetScope, styleOnly) {
    const sceneName = SCENES[targetScope].short;
    const first = imported[0] || {};
    const names = imported.map(function(item) { return item.name || '未命名预设'; });
    const nameText = names.length > 5 ? names.slice(0, 5).join('、') + ' 等 ' + names.length + ' 套' : names.join('、');
    const lines = ['将导入 ' + imported.length + ' 套' + sceneName + '预设：' + nameText];
    const customCount = first.entries ? first.entries.filter(function(entry) { return entry.kind === 'custom'; }).length : 0;
    if (isNuojijiRaw(data)) {
      const total = data.blocks.length;
      const markers = data.blocks.filter(function(block) { return block && block.type === 'marker'; }).length;
      const empty = data.blocks.filter(function(block) {
        return block && block.type !== 'marker' && !String(block.content || '').trim();
      }).length;
      lines.push('正文板块：' + customCount + ' 条');
      lines.push('跳过：' + markers + ' 个 marker、' + empty + ' 个空占位');
      lines.push('来源：糯叽机导入');
    } else if (isSillyTavernRaw(data)) {
      const total = data.prompts.length;
      const markers = data.prompts.filter(function(item) { return item && item.marker === true; }).length;
      const empty = data.prompts.filter(function(item) {
        return item && item.marker !== true && !String(item.content || item.text || '').trim();
      }).length;
      lines.push('导入：' + customCount + ' 条');
      if (styleOnly) lines.push('当前是线上模式：只保留文风、口癖、句长和分段，舞台设定不导入');
      lines.push('跳过：' + Math.max(0, total - customCount) + ' 条（marker ' + markers + ' 个 / 空占位 ' + empty + ' 个' + (styleOnly ? ' / 非文风' : '') + '）');
      lines.push('来源：酒馆导入');
    } else {
      lines.push('条目：' + customCount + ' 条（含内置底座）');
      lines.push('来源：' + sourceLabel(first.source));
    }
    lines.push('导入后会新增预设并切换到它，不会覆盖现有预设。');
    lines.push('继续导入？');
    return lines.join('\n');
  }

  function prepareImport(text, fileName, scope) {
    const targetScope = normalizeScope(scope || currentScene);
    const raw = String(text || '');
    if (!raw.trim()) throw new Error('文件是空的。');
    if (raw.length > 2000000) throw new Error('文件太大，请只导入预设本身。');
    let data = null;
    let parseFailed = false;
    try { data = JSON.parse(raw); } catch (e) { parseFailed = true; }
    const isSillyTavern = !parseFailed && isSillyTavernRaw(data);
    const isNuojiji = !parseFailed && isNuojijiRaw(data);
    const styleOnly = isSillyTavern && targetScope === 'chat';
    lastImportInfo = {
      scope: targetScope,
      styleOnly: styleOnly,
      autoRouted: false,
      sillyTavern: isSillyTavern,
      nuojiji: isNuojiji
    };
    let imported = [];
    if (parseFailed) {
      const displayName = String(fileName || '导入预设').replace(/\.(json|txt)$/i, '').trim() || '导入预设';
      const custom = importedCustomEntry({ title: displayName, content: raw }, 0, displayName);
      const preset = normalizePreset({ name: displayName, entries: [] }, targetScope);
      if (custom) preset.entries.push(custom);
      preset.id = uid('preset');
      preset.scope = targetScope;
      preset.name = uniquePresetName(preset.name, displayName);
      imported = [preset];
      data = null;
    } else {
      imported = collectImportedPresets(data, fileName, targetScope, { styleOnly: styleOnly });
    }
    return {
      imported: imported,
      targetScope: targetScope,
      styleOnly: styleOnly,
      data: data,
      message: importPreviewMessage(data, imported, targetScope, styleOnly)
    };
  }

  function commitImport(prepared) {
    try { captureForm(); } catch (e) {}
    presets = presets.concat(prepared.imported);
    currentScene = prepared.targetScope;
    activeIds[prepared.targetScope] = prepared.imported[0].id;
    persist();
    renderSettings();
    return prepared.imported.length;
  }

  function importFromText(text, fileName, scope, options) {
    options = options || {};
    const prepared = prepareImport(text, fileName, scope);
    if (options.previewOnly) return prepared;
    if (!options.skipConfirm && !confirm(prepared.message)) return 0;
    return commitImport(prepared);
  }

  function exportPreset() {
    const preset = captureForm();
    if (!preset) return false;
    const payload = {
      format: 'momo-prompt-preset',
      version: 2,
      app: 'momo-phone',
      exportedAt: new Date().toISOString(),
      preset: {
        name: preset.name,
        scope: preset.scope,
        author: preset.author || '',
        version: preset.version || '',
        description: preset.description || '',
        source: preset.source || 'manual',
        tags: preset.tags || [],
        createdAt: preset.createdAt || Date.now(),
        updatedAt: preset.updatedAt || Date.now(),
        entries: preset.entries
      }
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = String(preset.name || (SCENES[currentScene].short + '预设')).replace(/[\\/:*?"<>|]/g, '_').slice(0, 48) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1200);
    return true;
  }

  function importFile(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(file.name || '')) {
      alert('这是角色卡图片，不是酒馆预设 JSON。请让作者发预设的 .json 文件，或先在酒馆里导出预设 JSON。');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function() {
      try {
        const prepared = prepareImport(reader.result, file.name, currentScene);
        if (!confirm(prepared.message)) return;
        const count = commitImport(prepared);
        if (lastImportInfo.styleOnly) {
          alert('检测到酒馆预设：已提取 ' + count + ' 个文风板块到线上聊天。\n完整舞台设定请切到「线下剧场」再导入。');
        } else if (lastImportInfo.sillyTavern && lastImportInfo.scope === 'theater') {
          alert('检测到酒馆预设：已完整导入 ' + count + ' 套到线下剧场，并自动切换到新预设。');
        } else if (lastImportInfo.nuojiji) {
          alert('检测到糯叽机预设：已导入 ' + count + ' 套到' + SCENES[currentScene].short + '，并自动切换到新预设。');
        } else {
          alert('已导入 ' + count + ' 套' + SCENES[currentScene].short + '预设，已自动切换到新预设。');
        }
      } catch (e) {
        alert('导入失败：' + (e && e.message ? e.message : '文件格式不支持'));
      } finally {
        input.value = '';
      }
    };
    reader.onerror = function() {
      alert('导入失败：读不到这个文件。');
      input.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  window.PromptPresets = {
    list: function() { return JSON.parse(JSON.stringify(presets)); },
    active: function(scope) { const p = activePreset(scope); return p ? JSON.parse(JSON.stringify(p)) : null; },
    activeId: function(scope) { const scene = normalizeScope(scope || currentScene); return activeIds[scene] || ''; },
    isEnabled: isEnabled,
    apply: apply,
    injectMessages: injectMessages,
    entryInjection: entryInjection,
    renderSettings: renderSettings,
    captureForm: captureForm,
    switchTo: switchTo,
    switchScene: switchScene,
    toggleGroup: togglePromptGroup,
    create: createPreset,
    save: savePreset,
    remove: deletePreset,
    importText: importFromText,
    exportFile: exportPreset
  };

  window.switchPromptPreset = function(id) { switchTo(id); };
  window.switchPromptPresetScene = function(scene) { switchScene(scene); };
  window.createPromptPreset = function() { createPreset(); };
  window.savePromptPreset = function() { savePreset(); };
  window.deletePromptPreset = function() { deletePreset(); };
  window.importPromptPresetFile = function(input) { importFile(input); };
  window.exportPromptPreset = function() { exportPreset(); };
  window.togglePromptGroup = function(groupId) { togglePromptGroup(groupId); };
  window.togglePromptMeta = function() { togglePromptMeta(); };
  window.previewPromptMeta = function() { previewPromptMeta(); };
  window.previewPromptInjection = function() { previewPromptInjection(); };
  window.auditTheaterPreset = function() { auditTheaterPreset(); };
  window.closePromptInjectionPreview = function() { closePromptInjectionPreview(); };
  window.checkPromptCompatibility = function() { checkPromptCompatibility(); };
  window.closePromptCompatibility = function() { closePromptCompatibility(); };
  window.togglePromptEntry = function(id, enabled) { toggleEntry(id, enabled); };
  window.openPromptEntryEditor = function(id) { openEntryEditor(id); };
  window.closePromptEntryEditor = function() { closeEntryEditor(); };
  window.savePromptEntry = function() { saveEntry(); };
  window.deletePromptEntry = function(id) { deleteEntry(id); };
  window.promptPresetSearch = function(value) { setSearchQuery(value); };
  window.togglePromptSortMode = function() { toggleSortMode(); };
  window.togglePromptMultiSelect = function() { toggleMultiSelect(); };
  window.togglePromptSelection = function(id, checked) { toggleSelection(id, checked); };
  window.selectAllPromptEntries = function() { selectAllEntries(); };
  window.clearPromptSelection = function() { clearSelection(); };
  window.batchSetPromptEntries = function(enabled) { batchSetEnabled(enabled); };
  window.movePromptEntry = function(id, direction) { moveEntry(id, direction); };
  window.promptEntryDragStart = function(event, id) { promptEntryDragStart(event, id); };
  window.promptEntryDragOver = function(event) { promptEntryDragOver(event); };
  window.promptEntryDrop = function(event, id) { promptEntryDrop(event, id); };
  window.promptEntryDragEnd = function(event) { promptEntryDragEnd(event); };
  window.copyPromptBuiltinEntry = function(id) { copyBuiltinEntry(id); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSettings);
  } else {
    renderSettings();
  }
})();
