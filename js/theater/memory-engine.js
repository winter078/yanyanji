// 记忆引擎 v1.1：三层记忆 + 群视角编年史 + 成员片段
// 不接外部向量库；用固定槽位 + 关键词/时间权重 + 本地轻量向量重排召回。
(function () {
  'use strict';

  var LAYERS = { short: 'short', mid: 'mid', core: 'core' };
  var LAYER_LABEL = { short: '短期片段', mid: '中期总结', core: '核心印记' };
  var AI_SELF_RE = /\bAI\b|模型|小手机|(?:我(?:确实|就|真的|其实)?(?:是|不是)\s*(?:AI|人工智能|模型|程序|机器人)|我(?:确实|就|真的|其实)?不是人|AI\s*伴侣|跑在[^\n]{0,16}(?:小)?手机|住在[^\n]{0,8}小手机|系统提示|算力底座|DeepSeek|deepseek|摊牌了)/i;
  var AUTO_EVERY = 24;          // 单聊累计 24 条未总结消息后自动沉淀
  var AUTO_COOLDOWN = 10 * 60 * 1000;
  var MAX_SLICE = 60;
  var PEN_LIMIT = 4;            // 亲笔是最高优先级，每次最多注入 4 条，避免挤爆上下文

  function store() {
    try {
      if (typeof appData !== 'undefined' && appData) {
        if (!Array.isArray(appData.palaceMemories)) appData.palaceMemories = [];
        return appData.palaceMemories;
      }
    } catch (e) {}
    return [];
  }

  function saveStore() {
    try {
      localStorage.setItem('momo_palace_memories', JSON.stringify(store()));
    } catch (e) {}
  }

  function readConfig() {
    try { return JSON.parse(localStorage.getItem('momo_palace_config') || '{}') || {}; }
    catch (e) { return {}; }
  }

  function targetKey(scope, targetId) {
    return 'wechat:' + scope + ':' + (targetId || '');
  }

  function pointerFor(scope, targetId) {
    var cfg = readConfig();
    var rec = (cfg.wechatTargets || {})[targetKey(scope, targetId)] || {};
    return Math.max(0, parseInt(rec.pointer, 10) || 0);
  }

  function autoEveryFor(scope, targetId) {
    var cfg = readConfig();
    var rec = (cfg.wechatTargets || {})[targetKey(scope, targetId)] || {};
    return Math.max(6, Math.min(60, parseInt(rec.autoEvery, 10) || parseInt(cfg.autoEvery, 10) || AUTO_EVERY));
  }

  function lastAutoFor(scope, targetId) {
    var cfg = readConfig();
    var rec = (cfg.wechatTargets || {})[targetKey(scope, targetId)] || {};
    return parseInt(rec.lastAutoAt, 10) || 0;
  }

  function setTargetState(scope, targetId, patch) {
    var cfg = readConfig();
    if (!cfg.wechatTargets || typeof cfg.wechatTargets !== 'object') cfg.wechatTargets = {};
    var key = targetKey(scope, targetId);
    cfg.wechatTargets[key] = Object.assign({}, cfg.wechatTargets[key], patch || {});
    try { localStorage.setItem('momo_palace_config', JSON.stringify(cfg)); } catch (e) {}
    try {
      if (typeof palaceConfig !== 'undefined' && palaceConfig) {
        palaceConfig.wechatTargets = cfg.wechatTargets;
      }
    } catch (e) {}
  }

  function layerOf(card) {
    if (card && card.layer === LAYERS.core) return LAYERS.core;
    if (card && card.layer === LAYERS.mid) return LAYERS.mid;
    if (card && card.layer === LAYERS.short) return LAYERS.short;
    if (card && card.pinned) return LAYERS.core;
    if (card && (parseInt(card.level, 10) || 0) >= 2) return LAYERS.core;
    if (card && (parseInt(card.level, 10) || 0) === 1) return LAYERS.mid;
    return LAYERS.short;
  }

  function inferMemoryAwareness(text) {
    return AI_SELF_RE.test(String(text || '')) ? 'ai' : 'both';
  }

  function sanitizeRpMemoryText(text) {
    return String(text || '').split('\n').map(function (line) {
      if (!line) return '';
      var sentences = line.match(/[^。！？!?]*[。！？!?]|[^。！？!?]+$/g) || [line];
      return sentences.filter(function (s) { return s && !AI_SELF_RE.test(s); }).join('').trim();
    }).filter(Boolean).join('\n').trim();
  }

  function normalizeCard(card) {
    if (!card) return false;
    var changed = false;
    if (!card.layer) { card.layer = layerOf(card); changed = true; }
    if (card.pinned && card.layer !== LAYERS.core) { card.layer = LAYERS.core; changed = true; }
    if (!card.importance) {
      card.importance = card.layer === LAYERS.core ? 5 : (card.layer === LAYERS.mid ? 3 : 2);
      changed = true;
    }
    if (!card.awareness) {
      card.awareness = inferMemoryAwareness(String(card.title || '') + '\n' + String(card.summary || card.content || ''));
      changed = true;
    }
    return changed;
  }

  function normalizeAll() {
    var cards = store();
    var changed = false;
    cards.forEach(function (c) { if (normalizeCard(c)) changed = true; });
    if (changed) saveStore();
    return cards.length;
  }

  function cardsFor(scope, targetId) {
    normalizeAll();
    var cards = store();
    return cards.filter(function (c) {
      if (!c || c.category !== 'wechat') return false;
      if (c.consolidatedInto) return false;
      if (c.status === 'archived') return false;
      var s = c.chatScope || 'single';
      return s === scope && String(c.targetId || '') === String(targetId || '');
    });
  }

  function penCardsFor(scope, targetId) {
    if (!targetId) return [];
    var source = [];
    try {
      if (window.getPenCardsFor) source = window.getPenCardsFor(scope, targetId) || [];
    } catch (e) {}
    if (!source.length) {
      source = store().filter(function (c) {
        return c && c.category === 'pen' &&
          (c.chatScope || 'single') === scope &&
          String(c.targetId || '') === String(targetId || '') &&
          String(c.summary || c.content || '').trim();
      });
    }
    return source.filter(function (c) {
      return c && c.category === 'pen' && String(c.summary || c.content || '').trim();
    }).sort(function (a, b) {
      return (parseInt(b.createdAt, 10) || 0) - (parseInt(a.createdAt, 10) || 0);
    }).slice(0, PEN_LIMIT);
  }

  function chars() {
    try { return (window.getCharacters && window.getCharacters()) || []; } catch (e) { return []; }
  }

  function charName(id) {
    var c = chars().filter(function (x) { return x.id === id; })[0];
    return c ? (c.name || '角色') : '角色';
  }

  function meName() {
    try {
      if (typeof appData !== 'undefined' && appData) {
        return (appData.hero && appData.hero.userName) || appData.userNickname || 'user';
      }
    } catch (e) {}
    return 'user';
  }

  function queryTerms(query) {
    var text = String(query || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').trim();
    if (!text) return [];
    var terms = text.split(/\s+/).filter(function (t) { return t.length >= 2; });
    // 中文没有空格，补 2 字滑动词，避免只能匹配整句
    for (var i = 0; i < text.length - 1; i++) {
      var pair = text.slice(i, i + 2);
      if (/^[\u4e00-\u9fa5]{2}$/.test(pair)) terms.push(pair);
    }
    terms = terms.filter(function (t) { return t && t.length >= 2; });
    return terms.slice(0, 18);
  }

  // 本地轻量向量：不做神经 embedding，只用中文双字/英文词的一袋特征算余弦相似度。
  // 好处是零依赖、零网络、不会拖慢回复；以后接真 embedding 时只需替换这两个函数。
  function textVector(text) {
    var compact = String(text || '').toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]+/g, '');
    var bag = {};
    if (!compact) return bag;
    if (compact.length === 1) {
      bag[compact] = 1;
      return bag;
    }
    for (var i = 0; i < compact.length - 1; i++) {
      var pair = compact.slice(i, i + 2);
      if (/^[\u4e00-\u9fa5]{2}$/.test(pair) || /^[a-z0-9]{2}$/.test(pair)) {
        bag[pair] = (bag[pair] || 0) + 1;
      }
    }
    return bag;
  }

  function cosineSimilarity(a, b) {
    var keys = Object.keys(a);
    if (!keys.length) return 0;
    var dot = 0;
    var normA = 0;
    var normB = 0;
    keys.forEach(function (k) {
      var av = a[k] || 0;
      var bv = b[k] || 0;
      dot += av * bv;
      normA += av * av;
      if (bv) normB += bv * bv;
    });
    Object.keys(b).forEach(function (k) {
      if (!a[k]) normB += b[k] * b[k];
    });
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  function scoreCard(card, query, queryVector) {
    var layer = layerOf(card);
    var score = layer === LAYERS.core ? 80 : (layer === LAYERS.mid ? 45 : 18);
    if (card.pinned) score += 20;
    score += (parseInt(card.importance, 10) || 0) * 4;
    var age = Date.now() - (parseInt(card.createdAt, 10) || 0);
    var days = Math.max(0, age / 86400000);
    score += Math.max(0, 18 - days * 2);
    var terms = queryTerms(query);
    var title = String(card.title || '');
    var summary = String(card.summary || card.content || '');
    var tags = (Array.isArray(card.tags) ? card.tags : []).join(' ');
    terms.forEach(function (t) {
      if (tags.indexOf(t) >= 0) score += 7;
      else if (title.indexOf(t) >= 0) score += 4;
      else if (summary.indexOf(t) >= 0) score += 2;
    });
    if (query) {
      var qv = queryVector || textVector(query);
      var cv = textVector(title + ' ' + summary + ' ' + tags);
      score += cosineSimilarity(qv, cv) * 45;
    }
    return score;
  }

  function pick(pool, n, query, exclude) {
    var seen = exclude || {};
    var queryVector = query ? textVector(query) : {};
    return pool.filter(function (c) { return c && !seen[c.id]; })
      .map(function (c) { return { c: c, s: scoreCard(c, query, queryVector) }; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, Math.max(0, n))
      .map(function (x) { seen[x.c.id] = true; return x.c; });
  }

  function textOf(card, maxChars, mode) {
    var summary = String(card.summary || card.content || '').trim();
    if (mode === 'rp') summary = sanitizeRpMemoryText(summary);
    if (!summary) return '';
    summary = summary.replace(/\s+/g, ' ').trim();
    var max = maxChars || 260;
    if (summary.length > max) summary = summary.slice(0, max) + '…';
    var date = card.dateStr ? ('（' + card.dateStr + '）') : '';
    var tags = (Array.isArray(card.tags) && card.tags.length) ? card.tags.slice(0, 6) : [];
    if (mode === 'rp') tags = tags.filter(function (t) { return !AI_SELF_RE.test(String(t || '')); });
    var tagText = tags.length ? (' [' + tags.join(' / ') + ']') : '';
    return '- ' + summary + date + tagText;
  }

  function section(title, cards, maxChars, mode) {
    if (!cards || !cards.length) return '';
    var lines = cards.map(function (c) {
      var text = textOf(c, maxChars, mode);
      if (!text) return '';
      var owner = c.ownerCharName ? ('·' + c.ownerCharName + '的片段') : '';
      return text + owner;
    }).filter(Boolean);
    if (!lines.length) return '';
    return '【' + title + '】\n' + lines.join('\n');
  }

  function recall(scope, targetId, opts) {
    opts = opts || {};
    var all = cardsFor(scope, targetId);
    if (opts.mode === 'rp') {
      all = all.filter(function (c) {
        return !!sanitizeRpMemoryText(String(c.summary || c.content || '')).trim();
      });
    }
    var query = opts.query || '';
    var speakerId = opts.speakerId || '';
    var budget = scope === 'group'
      ? { core: 2, mid: 2, short: 3, member: 2 }
      : { core: 2, mid: 2, short: 3, member: 0 };
    var totalCap = Math.max(1, parseInt(opts.limit, 10) || 7);
    var used = {};
    var chronicle = all.filter(function (c) { return !c.ownerCharId; });
    var corePool = chronicle.filter(function (c) { return layerOf(c) === LAYERS.core; });
    var midPool = chronicle.filter(function (c) { return layerOf(c) === LAYERS.mid; });
    var shortPool = chronicle.filter(function (c) { return layerOf(c) === LAYERS.short; });

    var core = pick(corePool, budget.core, query, used);
    var mid = pick(midPool, budget.mid, query, used);
    var shortN = Math.max(0, Math.min(budget.short, totalCap - core.length - mid.length - (speakerId ? budget.member : 0)));
    var short = pick(shortPool, shortN, query, used);
    var member = [];
    if (scope === 'group' && speakerId) {
      var memberPool = all.filter(function (c) { return c.ownerCharId === speakerId; });
      member = pick(memberPool, Math.min(budget.member, totalCap - core.length - mid.length - short.length), query, used);
    }
    return { chronicle: { core: core, mid: mid, short: short }, member: member, pen: penCardsFor(scope, targetId), all: all };
  }

  function buildText(scope, targetId, opts) {
    opts = opts || {};
    var mode = opts.mode === 'rp' ? 'rp' : 'ai';
    var r = recall(scope, targetId, opts);
    var sections = [];
    sections.push(section('亲笔记录 · 用户亲手写下的重要设定（最高优先级）', r.pen, 320, mode));
    if (scope === 'group') {
      sections.push(section('群视角编年史 · 核心', r.chronicle.core, 300, mode));
      sections.push(section('群视角编年史 · 中期', r.chronicle.mid, 240, mode));
      sections.push(section('群视角编年史 · 近期', r.chronicle.short, 220, mode));
      if (opts.speakerId) sections.push(section('只属于' + charName(opts.speakerId) + '的片段', r.member, 200, mode));
    } else {
      sections.push(section('核心印记 · 我一直认定的事', r.chronicle.core, 320, mode));
      sections.push(section('中期记忆 · 这段时间的模式', r.chronicle.mid, 260, mode));
      sections.push(section('短期片段 · 最近发生的事', r.chronicle.short, 220, mode));
    }
    var body = sections.filter(Boolean).join('\n\n');
    if (!body) return '';
    return '【记忆引擎 v1 · 以下只属于当前对象，不要串到别人】\n' + body +
      '\n\n【记忆使用规则】\n- 这些都是角色自己记得的事，用第一人称自然带出，不要声称“看过聊天记录”。\n- 想不起来的细节就说想不起来，绝不用模糊记忆编造具体事实。\n- 群聊里只把“群视角编年史”当公共经历；标了“只属于某人的片段”的，只有对应成员自己知道。';
  }

  function getHistoryForChar(charId) {
    if (window.getChatHistoryForChar) {
      try { return window.getChatHistoryForChar(charId) || []; } catch (e) {}
    }
    try { return (appData.chatHistory || []); } catch (e) { return []; }
  }

  function saveChatHistoryAfterSummary() {
    try { if (window.saveChatHistoryNow) window.saveChatHistoryNow(); } catch (e) {}
  }

  function memoryApiConfig() {
    if (window.ApiPresets && typeof window.ApiPresets.resolve === 'function') {
      var routed = window.ApiPresets.resolve('memory');
      if (routed && (routed.baseUrl || routed.apiKey)) {
        return {
          baseUrl: routed.baseUrl || 'https://api.deepseek.com/v1',
          apiKey: routed.apiKey || '',
          model: routed.model || 'deepseek-chat'
        };
      }
    }
    var fallback = window.appData || appData || {};
    return {
      baseUrl: fallback.apiBase || 'https://api.deepseek.com/v1',
      apiKey: fallback.apiKey || '',
      model: fallback.model || 'deepseek-chat'
    };
  }

  function stripModelFence(raw) {
    return String(raw || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  }

  function parseMemoryResult(raw) {
    var text = stripModelFence(raw);
    var obj = null;
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    var jsonText = (start >= 0 && end > start) ? text.slice(start, end + 1) : '';
    if (jsonText) {
      try { obj = JSON.parse(jsonText); } catch (e) {}
    }
    if (!obj) {
      try { obj = JSON.parse(text); } catch (e) {}
    }

    var memory = '';
    if (obj && obj.memory !== undefined && obj.memory !== null) {
      if (Array.isArray(obj.memory)) {
        memory = obj.memory.map(function (s) { return String(s || '').trim(); }).filter(Boolean).join('\n');
      } else {
        memory = String(obj.memory).trim();
      }
    }
    // 兼容 JSON 整体被截断、但 memory 字符串本身已经完整的情况
    if (!memory) {
      var complete = text.match(/"memory"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (complete) memory = complete[1];
    }
    if (!memory) {
      // 纯文本总结可以接受；但 JSON 残片绝不能当总结落库
      if (/\{[\s\S]*"memory"\s*:/.test(text) || (start >= 0 && end > start)) {
        throw new Error('记忆总结 JSON 不完整');
      }
      memory = text;
    }
    memory = memory
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .trim();
    memory = memory.replace(/^(?:\s*["“])|(?:["”]\s*)$/g, '').trim();
    if (!memory) throw new Error('记忆总结为空');

    var keywords = [];
    if (obj && Array.isArray(obj.keywords)) {
      keywords = obj.keywords.map(function (s) { return String(s || '').trim(); }).filter(Boolean);
    } else if (obj && typeof obj.keywords === 'string') {
      keywords = obj.keywords.split(/[,，、\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    var importance = obj && obj.importance !== undefined ? parseInt(obj.importance, 10) : 2;
    if (!(importance >= 1 && importance <= 5)) importance = 2;
    return { memory: memory, keywords: keywords.slice(0, 8), importance: importance };
  }

  async function callMemoryModel(charNameValue, conversationText, pending) {
    var api = memoryApiConfig();
    if (!api.apiKey) throw new Error('缺少 API Key');
    var base = String(api.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    if (!/\/chat\/completions$/.test(base)) base += '/chat/completions';
    var sys = '你是角色「' + charNameValue + '」自己的记忆引擎，不是旁白，也不是聊天记录管理员。' +
      '请只用第一人称「我」记录这段私聊里对角色有意义的事，保留具体动作、物件、约定、情绪变化。' +
      '不要写分析、不要写“用户说/角色说”的第三人称报告，不要堆砌空泛形容词。';
    var user = '以下是最近 ' + pending + ' 条私聊记录。\n\n' + conversationText +
      '\n\n只输出一个完整 JSON 对象，不要解释、不要代码块、不要前后缀：' +
      '{"memory":"3到5句第一人称短记忆，每句不超过45字","keywords":["4到8个具体名词或动作"],"importance":1到5的整数}' +
      '\nimportance 只能是 1-5 的整数：5=关系定义/承诺/禁忌/长期重要，4=重要约定/长期偏好/重大事件，3=值得记住的日常，2=普通日常，1=闲聊。' +
      '\nmemory 必须是字符串，不能是数组；JSON 必须完整闭合。';

    var lastErr = null;
    for (var attempt = 0; attempt < 2; attempt++) {
      var strictHint = attempt ? '\n上次输出不是完整可解析的 JSON。这次务必只输出一个完整 JSON 对象，memory 只写完整句子，不要数组、不要代码块、不要解释。' : '';
      var resp = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api.apiKey },
        body: JSON.stringify({
          model: api.model,
          messages: [{ role: 'system', content: sys + strictHint }, { role: 'user', content: user }],
          temperature: attempt ? 0.2 : 0.5,
          max_tokens: attempt ? 900 : 800
        })
      });
      if (!resp.ok) throw new Error('记忆总结接口异常: ' + (await resp.text()).slice(0, 80));
      var data = await resp.json();
      var choice = (data.choices || [])[0] || {};
      var raw = (choice.message || {}).content || '';
      if (choice.finish_reason === 'length' && attempt === 0) {
        lastErr = new Error('记忆总结被截断');
        continue;
      }
      try {
        return parseMemoryResult(raw);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('记忆总结解析失败');
  }

  function midEveryFor(scope, targetId) {
    var cfg = readConfig();
    var rec = (cfg.wechatTargets || {})[targetKey(scope, targetId)] || {};
    return Math.max(3, Math.min(8, parseInt(rec.midEvery, 10) || parseInt(cfg.midEvery, 10) || 4));
  }

  async function callMemoryMergeModel(charNameValue, shortCards) {
    var api = memoryApiConfig();
    if (!api.apiKey) throw new Error('缺少 API Key');
    var base = String(api.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    if (!/\/chat\/completions$/.test(base)) base += '/chat/completions';
    var sys = '你是角色「' + charNameValue + '」自己的记忆整理官，不是旁白。' +
      '把几段短期记忆融成一段更稳定的中期记忆，只保留具体事件、约定、关系变化和反复出现的偏好。' +
      '不要写分析、不要写第三人称报告、不要堆砌空泛形容词。';
    var user = '以下是同一段关系里连续的短期记忆分卷：\n\n' +
      shortCards.map(function (c, i) {
        return '### 短期片段 ' + (i + 1) + '（' + (c.dateStr || '') + '）\n' +
          String(c.summary || c.content || '') + '\n关键词：' + ((c.tags || []).join('、') || '无');
      }).join('\n\n') +
      '\n\n只输出一个完整 JSON 对象，不要解释、不要代码块、不要前后缀：' +
      '{"memory":"180到320字的第一人称中期记忆，保留具体事件与约定","keywords":["5到8个具体名词或动作"],"importance":3到4的整数}' +
      '\nmemory 必须是字符串，不能是数组；JSON 必须完整闭合。';
    var resp = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api.apiKey },
      body: JSON.stringify({
        model: api.model,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        temperature: 0.3,
        max_tokens: 900
      })
    });
    if (!resp.ok) throw new Error('中期合并接口异常: ' + (await resp.text()).slice(0, 80));
    var data = await resp.json();
    var choice = (data.choices || [])[0] || {};
    var raw = (choice.message || {}).content || '';
    if (choice.finish_reason === 'length') throw new Error('中期合并被截断');
    return parseMemoryResult(raw);
  }

  var midRunning = {};

  async function maybeConsolidateMid(scope, targetId, opts) {
    opts = opts || {};
    if (!targetId) return null;
    // 先只做单聊：群聊的名字/视角不同，等单聊稳定后再接群聊
    if (scope !== 'single') return null;
    var cfg = readConfig();
    if (!opts.force && cfg.autoMid === false) return null;
    var key = targetKey(scope, targetId);
    if (midRunning[key]) return null;
    var all = cardsFor(scope, targetId);
    var shorts = all.filter(function (c) {
      return layerOf(c) === LAYERS.short && !c.consolidatedInto;
    }).sort(function (a, b) {
      return (parseInt(a.createdAt, 10) || 0) - (parseInt(b.createdAt, 10) || 0);
    });
    var every = midEveryFor(scope, targetId);
    if (shorts.length < every) return null;
    var picked = shorts.slice(0, every);
    midRunning[key] = true;
    try {
      var result = await callMemoryMergeModel(charName(targetId), picked);
      var cards = store();
      var sameLayer = cards.filter(function (c) {
        return c && c.category === 'wechat' && (c.chatScope || 'single') === scope &&
          String(c.targetId || '') === String(targetId || '') && layerOf(c) === LAYERS.mid;
      }).length;
      var now = new Date();
      var dateStr = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate() + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      var startIdx = Math.min.apply(null, picked.map(function (c) { return parseInt(c.startIdx, 10) || 0; }));
      var endIdx = Math.max.apply(null, picked.map(function (c) { return parseInt(c.endIdx, 10) || 0; }));
      var mid = {
        id: 'mem_mid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        category: 'wechat',
        chatScope: scope,
        targetId: targetId,
        targetName: charName(targetId),
        level: 1,
        layer: LAYERS.mid,
        pinned: false,
        title: '中期总结 ' + (sameLayer + 1),
        dateStr: dateStr,
        summary: result.memory,
        tags: result.keywords.length ? result.keywords : ['自动中期', '私聊'],
        importance: Math.max(3, parseInt(result.importance, 10) || 3),
        awareness: inferMemoryAwareness(result.memory),
        source: 'auto-mid',
        ownerCharId: '',
        sourceCardIds: picked.map(function (c) { return c.id; }),
        msgRangeStr: '合并 ' + picked.map(function (c) { return c.title; }).join(' / ') +
          ' · 消息 ' + (startIdx + 1) + '-' + endIdx,
        createdAt: Date.now()
      };
      cards.unshift(mid);
      picked.forEach(function (c) {
        c.consolidatedInto = mid.id;
        c.consolidatedAt = Date.now();
      });
      saveStore();
      setTargetState(scope, targetId, { lastMidAt: Date.now() });
      try { if (window.renderPalaceMemories) window.renderPalaceMemories(); } catch (e) {}
      return mid;
    } finally {
      delete midRunning[key];
    }
  }

  function isBrokenMemoryCard(card) {
    if (!card || card.category !== 'wechat') return false;
    var text = String(card.summary || card.content || '').trim();
    return /^\s*(?:\{|```)/.test(text) && /"?memory"?\s*:/.test(text);
  }

  async function repairBrokenCards(scope, targetId, opts) {
    opts = opts || {};
    if (!targetId || scope !== 'single') return { repaired: 0, failed: 0, total: 0 };
    var max = Math.max(1, Math.min(20, parseInt(opts.max, 10) || 10));
    var cards = store().filter(function (c) {
      return c && c.category === 'wechat' &&
        (c.chatScope || 'single') === scope &&
        String(c.targetId || '') === String(targetId || '') &&
        !c.consolidatedInto && isBrokenMemoryCard(c);
    }).slice(0, max);
    if (!cards.length) return { repaired: 0, failed: 0, total: 0 };

    var hist = getHistoryForChar(targetId);
    var cname = charName(targetId);
    var me = meName();
    var repaired = 0;
    var failed = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var slice = [];
      if (card.msgIds && card.msgIds.length) {
        var byId = {};
        hist.forEach(function (m) { if (m && m.id) byId[m.id] = m; });
        slice = card.msgIds.map(function (id) { return byId[id]; }).filter(Boolean);
      }
      if (!slice.length && card.startIdx !== undefined && card.endIdx !== undefined) {
        slice = hist.slice(Math.max(0, parseInt(card.startIdx, 10) || 0), Math.max(0, parseInt(card.endIdx, 10) || 0));
      }
      if (!slice.length) {
        failed++;
        continue;
      }
      var lines = slice.map(function (m) {
        var who = m.role === 'user' ? me : (m.name || cname);
        return who + '：' + String(m.content || '').replace(/\s+/g, ' ');
      }).join('\n');
      try {
        var result = await callMemoryModel(cname, lines, slice.length);
        var layer = result.importance >= 5 ? LAYERS.core : (result.importance >= 4 ? LAYERS.mid : LAYERS.short);
        var sameLayer = store().filter(function (c) {
          return c && c.id !== card.id && c.category === 'wechat' &&
            (c.chatScope || 'single') === scope &&
            String(c.targetId || '') === String(targetId || '') &&
            layerOf(c) === layer;
        }).length;
        var prefix = layer === LAYERS.core ? '核心印记 ' : (layer === LAYERS.mid ? '中期总结 ' : '短期片段 ');
        card.summary = result.memory;
        card.tags = result.keywords.length ? result.keywords : ['自动记忆', '私聊'];
        card.importance = result.importance;
        card.layer = layer;
        card.level = layer === LAYERS.core ? 2 : (layer === LAYERS.mid ? 1 : 0);
        card.pinned = layer === LAYERS.core;
        card.title = prefix + (sameLayer + 1);
        card.source = 'auto-single-repaired';
        card.repairedAt = Date.now();
        repaired++;
      } catch (e) {
        failed++;
      }
    }
    saveStore();
    try { if (window.renderPalaceMemories) window.renderPalaceMemories(); } catch (e) {}
    return { repaired: repaired, failed: failed, total: cards.length };
  }

  async function maybeAutoSummarizeSingle(charId, opts) {
    opts = opts || {};
    if (!charId) return null;
    var api = memoryApiConfig();
    if (!api.apiKey) return null;
    var cfg = readConfig();
    if (!opts.force && cfg.autoSummary === false) return null;
    var hist = getHistoryForChar(charId);
    if (!hist.length) return null;
    var pointer = pointerFor('single', charId);
    var pending = hist.length - pointer;
    var every = Math.max(6, parseInt(opts.every, 10) || autoEveryFor('single', charId));
    if (pending < every) return null;
    var lastAt = lastAutoFor('single', charId);
    if (!opts.force && lastAt && Date.now() - lastAt < AUTO_COOLDOWN) return null;

    var start = pointer;
    var end = Math.min(hist.length, start + MAX_SLICE);
    var slice = hist.slice(start, end);
    if (!slice.length) return null;
    var me = meName();
    var cname = charName(charId);
    var lines = slice.map(function (m) {
      var who = m.role === 'user' ? me : (m.name || cname);
      return who + '：' + String(m.content || '').replace(/\s+/g, ' ');
    }).join('\n');

    var result = await callMemoryModel(cname, lines, slice.length);
    slice.forEach(function (m, i) {
      if (!m.id) m.id = 'msg_' + (m.timestamp || (Date.now() + '_' + (start + i) + '_' + Math.random().toString(36).slice(2, 6)));
    });
    var cards = store();
    var layer = result.importance >= 5 ? LAYERS.core : (result.importance >= 4 ? LAYERS.mid : LAYERS.short);
    var sameLayer = cards.filter(function (c) {
      return c && c.category === 'wechat' && (c.chatScope || 'single') === 'single' &&
        c.targetId === charId && layerOf(c) === layer;
    }).length;
    var titlePrefix = layer === LAYERS.core ? '核心印记 ' : (layer === LAYERS.mid ? '中期总结 ' : '短期片段 ');
    var now = new Date();
    var dateStr = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate() + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var card = {
      id: 'mem_auto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      category: 'wechat',
      chatScope: 'single',
      targetId: charId,
      targetName: cname,
      level: layer === LAYERS.core ? 2 : (layer === LAYERS.mid ? 1 : 0),
      layer: layer,
      pinned: layer === LAYERS.core,
      title: titlePrefix + (sameLayer + 1),
      dateStr: dateStr,
      summary: result.memory,
      tags: result.keywords.length ? result.keywords : ['自动记忆', '私聊'],
      importance: result.importance,
      awareness: inferMemoryAwareness(result.memory),
      source: 'auto-single',
      ownerCharId: '',
      msgRangeStr: '消息 ' + (start + 1) + '-' + end + ' · 共' + slice.length + '条',
      startIdx: start,
      endIdx: end,
      msgIds: slice.map(function (m) { return m.id; }).filter(Boolean),
      createdAt: Date.now()
    };
    cards.unshift(card);
    saveStore();
    setTargetState('single', charId, { pointer: end, lastAutoAt: Date.now() });
    try { if (window.renderPalaceMemories) window.renderPalaceMemories(); } catch (e) {}
    try {
      await maybeConsolidateMid('single', charId);
    } catch (e) {
      console.warn('[MemoryEngine] 自动中期合并失败：', e && e.message ? e.message : e);
    }
    return card;
  }

  function setCore(cardId, on) {
    var card = store().filter(function (c) { return c && c.id === cardId; })[0];
    if (!card) return false;
    var previousLevel = parseInt(card.level, 10) || 0;
    card.pinned = !!on;
    if (on) {
      card.layer = LAYERS.core;
      card.importance = Math.max(5, parseInt(card.importance, 10) || 0);
    } else {
      var demoted = previousLevel >= 1 ? LAYERS.mid : LAYERS.short;
      card.layer = demoted;
      card.level = demoted === LAYERS.mid ? 1 : 0;
    }
    normalizeCard(card);
    saveStore();
    try { if (window.renderPalaceMemories) window.renderPalaceMemories(); } catch (e) {}
    return true;
  }

  function memoryDateStr() {
    var d = new Date();
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function memoryTextKey(text) {
    return String(text || '').toLowerCase().replace(/[\s，。！？,.!?;；:：“”"'‘’（）()【】\[\]]/g, '');
  }

  function findSimilarMemory(scope, targetId, text) {
    var candidates = cardsFor(scope, targetId);
    var key = memoryTextKey(text);
    for (var i = 0; i < candidates.length; i++) {
      var card = candidates[i];
      var oldText = String(card.summary || card.content || '').trim();
      if (!oldText) continue;
      if (memoryTextKey(oldText) === key) return { card: card, score: 1, exact: true };
    }
    var textVec = textVector(text);
    var best = null;
    candidates.forEach(function (card) {
      var oldText = String(card.summary || card.content || '').trim();
      if (!oldText) return;
      var score = cosineSimilarity(textVec, textVector(oldText));
      if (!best || score > best.score) best = { card: card, score: score, exact: false };
    });
    return (best && best.score >= 0.9) ? best : null;
  }

  function remember(opts) {
    var o = opts || {};
    var scope = o.scope === 'group' ? 'group' : 'single';
    var targetId = String(o.targetId || '');
    var text = String(o.text || '').trim().slice(0, 500);
    if (!targetId || !text) return { ok: false, reason: 'empty' };
    var targetName = o.targetName || charName(targetId);
    var similar = findSimilarMemory(scope, targetId, text);
    if (similar) {
      var existing = similar.card;
      if (!similar.exact) {
        var oldText = String(existing.summary || existing.content || '').trim();
        if (text.length > oldText.length && oldText.indexOf(text) < 0) {
          existing.summary = oldText + '；' + text;
        }
      }
      existing.updatedAt = Date.now();
      existing.hitCount = (parseInt(existing.hitCount, 10) || 1) + 1;
      existing.status = 'active';
      existing.tags = Array.from(new Set((existing.tags || []).concat(o.tags || []).filter(Boolean))).slice(0, 12);
      saveStore();
      try { if (window.renderPalaceMemories) window.renderPalaceMemories(); } catch (e) {}
      return { ok: true, action: 'merged', card: existing, score: similar.score };
    }

    var cards = cardsFor(scope, targetId);
    var count = cards.length + 1;
    var card = {
      id: 'mem_manual_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      category: 'wechat',
      chatScope: scope,
      targetId: targetId,
      targetName: targetName,
      level: 0,
      layer: LAYERS.short,
      pinned: false,
      title: '记下来 ' + count,
      dateStr: memoryDateStr(),
      summary: text,
      tags: (o.tags && o.tags.length ? o.tags : ['手动记忆']).slice(0, 12),
      importance: 3,
      awareness: inferMemoryAwareness(text),
      source: 'manual-chat',
      status: 'active',
      visibility: o.visibility || 'private',
      ownerCharId: scope === 'single' ? targetId : '',
      msgRangeStr: '手动记下',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hitCount: 1
    };
    store().unshift(card);
    saveStore();
    try { if (window.renderPalaceMemories) window.renderPalaceMemories(); } catch (e) {}
    return { ok: true, action: 'created', card: card };
  }

  function updateMemory(cardId, patch) {
    var card = store().filter(function (c) { return c && c.id === cardId; })[0];
    if (!card) return false;
    var p = patch || {};
    if (p.summary != null) card.summary = String(p.summary).trim().slice(0, 500);
    if (p.title != null) card.title = String(p.title).trim().slice(0, 60);
    if (Array.isArray(p.tags)) card.tags = p.tags.slice(0, 12);
    if (p.importance != null) card.importance = Math.max(1, Math.min(5, parseInt(p.importance, 10) || 3));
    if (p.pinned != null) return setCore(cardId, !!p.pinned);
    card.updatedAt = Date.now();
    normalizeCard(card);
    saveStore();
    try { if (window.renderPalaceMemories) window.renderPalaceMemories(); } catch (e) {}
    return true;
  }

  function archiveMemory(cardId, reason) {
    var card = store().filter(function (c) { return c && c.id === cardId; })[0];
    if (!card) return false;
    card.status = 'archived';
    card.archivedAt = Date.now();
    card.archiveReason = String(reason || '').slice(0, 80);
    saveStore();
    try { if (window.renderPalaceMemories) window.renderPalaceMemories(); } catch (e) {}
    return true;
  }

  window.MemoryEngine = {
    LAYERS: LAYERS,
    LAYER_LABEL: LAYER_LABEL,
    normalizeAll: normalizeAll,
    normalizeCard: normalizeCard,
    layerOf: layerOf,
    cardsFor: cardsFor,
    recall: recall,
    buildText: buildText,
    sanitizeRpText: sanitizeRpMemoryText,
    inferAwareness: inferMemoryAwareness,
    maybeAutoSummarizeSingle: maybeAutoSummarizeSingle,
    maybeConsolidateMid: maybeConsolidateMid,
    repairBrokenCards: repairBrokenCards,
    isBrokenMemoryCard: isBrokenMemoryCard,
    setCore: setCore,
    remember: remember,
    updateMemory: updateMemory,
    archiveMemory: archiveMemory,
    _debug: { store: store, queryTerms: queryTerms, pointerFor: pointerFor }
  };

  normalizeAll();
})();
