(function () {
  'use strict';

  // ================= 工具注册表 =================
  // 每个工具只声明「怎么判断可用 / 参数 / 怎么真跑」，聊天侧统一按模型的决定调用。
  // 真正发请求、弹胶囊的逻辑在 search-tools.js / weather-tools.js 里，这里只做编排。

  function readLS(name) {
    try { return String(localStorage.getItem(name) || '').trim(); } catch (e) { return ''; }
  }

  var REGISTRY = [
    {
      name: 'web_search',
      label: '搜索',
      description: '联网搜索公开网页。适合新闻、人物近况、价格、地点、资料、事实核查等「需要外部实时信息」的问题。',
      params: '{"query": "要搜的关键词，尽量像人搜索时输入的那样"}',
      available: function () {
        return !!(window.isWebSearchEnabled && window.isWebSearchEnabled() && readLS('momo_tavily_api_key_v1'));
      },
      reason: function () {
        if (!window.isWebSearchEnabled || !window.isWebSearchEnabled()) return '搜索开关没打开';
        if (!readLS('momo_tavily_api_key_v1')) return '缺 Tavily Key';
        return '';
      },
      run: function (args) {
        return window.__momRunWebSearch ? window.__momRunWebSearch(args && args.query) : Promise.resolve('');
      }
    },
    {
      name: 'read_xhs_note',
      label: '小红书',
      description: '读取一条小红书笔记的标题、正文、配图 OCR 和评论。只在用户自己贴了小红书链接、且需要知道笔记内容时调用；用户要你主动“发一篇/分享一篇”时不要调用它，那种情况系统会自动找笔记发卡片。',
      params: '{"url": "完整的小红书链接"}',
      available: function () {
        return !!readLS('momo_xhs_api_key_v1');
      },
      reason: function () {
        return readLS('momo_xhs_api_key_v1') ? '' : '缺小红书 Key';
      },
      run: function (args) {
        return window.__momRunXhsRead ? window.__momRunXhsRead(args && args.url) : Promise.resolve('');
      }
    },
    {
      name: 'search_twitter',
      label: '推特',
      description: '在推特/X 搜一个话题的高赞公开帖子，读完原帖和一部分回复。两种场景才用：用户明确让你“去推特看看/找推特上别人怎么说/甩条高赞帖给我看”；或她正和你争执、抛出一个具体观点，需要一个外部例子来支撑或反驳。单纯情绪、撒娇、日常拌嘴不要用。',
      params: '{"query": "要在推特/X 搜的话题，尽量短，像人搜索时输入的那样"}',
      available: function () {
        return !!readLS('momo_everyinfra_api_key_v1') && !window.__momTwitterQueryTurn &&
          (!window.__momoTwitterEvidenceAt || Date.now() - window.__momoTwitterEvidenceAt > 5 * 60 * 1000);
      },
      reason: function () {
        if (!readLS('momo_everyinfra_api_key_v1')) return '缺 EveryInfra Key';
        if (window.__momTwitterQueryTurn) return '这轮已经查过推特';
        if (window.__momoTwitterEvidenceAt && Date.now() - window.__momoTwitterEvidenceAt <= 5 * 60 * 1000) return '刚查过推特，稍后可用';
        return '';
      },
      run: function (args) {
        return window.__momTwitterEvidence ? window.__momTwitterEvidence(args && args.query) : Promise.resolve('');
      }
    },
    {
      name: 'get_weather',
      label: '天气',
      description: '查询指定城市或当前所在地的实时天气和未来两天预报。适合聊到出门、穿衣、下雨、温度的时候。',
      params: '{"city": "城市名，可留空表示当前所在地"}',
      available: function () {
        return !!(readLS('momo_qweather_key_v1') && readLS('momo_qweather_host_v1'));
      },
      reason: function () {
        if (!readLS('momo_qweather_key_v1')) return '缺和风天气 Key';
        if (!readLS('momo_qweather_host_v1')) return '缺和风天气 Host';
        return '';
      },
      run: function (args) {
        return window.__momRunWeather ? window.__momRunWeather(args && args.city) : Promise.resolve('');
      }
    }
  ];

  function enabledTools() {
    return REGISTRY.filter(function (tool) {
      try { return !!tool.available(); } catch (e) { return false; }
    });
  }

  function statusList() {
    return REGISTRY.map(function (tool) {
      var ok = false;
      var reason = '';
      try { ok = !!tool.available(); } catch (e) { ok = false; }
      if (!ok) {
        try { reason = tool.reason ? String(tool.reason() || '') : ''; } catch (e2) { reason = ''; }
        if (!reason) reason = '当前不可用';
      }
      return {
        name: tool.name,
        label: tool.label,
        ok: ok,
        reason: reason
      };
    });
  }

  function hasAnyTool() {
    return enabledTools().length > 0;
  }

  // 给主提示用：告诉角色「你有这些手」，别装看不见网。
  function promptBlock() {
    var tools = enabledTools();
    if (!tools.length) return '';
    var lines = ['【可用工具】你这轮可以真的调用下面这些外部工具，结果会以系统消息注入给你：'];
    tools.forEach(function (tool) {
      lines.push('- ' + tool.label + '：' + tool.description);
    });
    lines.push('调用是系统按她这轮的明确需求自动完成的：只有她明确让你查、搜、看链接，或点名要某个平台的内容时才会发生；不要假装自己不会上网、也不要编造没查到的内容。');
    lines.push('关于小红书：用户要你「发/分享/推荐一篇小红书」时，不需要她给链接——系统会自动找一篇真实笔记并把卡片挂在你回复后面。你只管自然答应、递过去，绝对不要说“必须先有链接”“我调不了这个工具”。只有当用户自己贴了链接让你读内容时，才是读取单篇笔记的场景。');
    lines.push('关于抖音：用户要你「发/分享/找一个抖音视频」时，也不需要她给链接——系统会自动搜一条真实视频、读完文案再把卡片挂在你回复后面。你只管自然答应、递过去，不要说“必须先有链接”，也不要说“我调不了这个工具”。');
    lines.push('关于推特/X：用户明确说「去推特看看 / 找推特上别人怎么说」时，系统会去搜真实高赞帖。你们吵起来、她抛出一个具体观点时，系统也可能找一条高赞帖当外部例子；但单纯情绪、撒娇、日常拌嘴不会。你读完原帖和回复再用自己的话讲，不要把几条回复说成“所有人都这样想”，也不要说接口、抓取、技术限制。');
    return lines.join('\n');
  }

  function rpTools() {
    return enabledTools().filter(function (tool) { return tool.name === 'web_search'; });
  }

  // 纯 RP：角色不知道自己是 AI，只知道“我拿自己的手机查了一下”。
  function rpPromptBlock() {
    var tools = rpTools();
    if (!tools.length) return '';
    return [
      '【你手里有自己的手机】需要查外面的信息时，你会拿自己的手机搜一下，然后把查到的内容用自己的话告诉她。',
      '她看到的是你在跟她说话，不是你背后的系统。',
      '不要说“搜索、工具、接口、后台、抓取、来源、进度”这些词；也不要报“我先查一下”再等结果。查完直接说结论，像你刚刚自己看过一样。',
      '没查到就自然说“我这边没查到”，不要编。'
    ].join('\n');
  }

  function plannerSystemPrompt(tools, diegetic) {
    var lines = [];
    if (diegetic) {
      lines.push('你是一个正在和 user 聊天的角色，不知道自己是 AI。你现在想用自己的手机查一下外面的信息。');
      lines.push('规则：');
      lines.push('1. 只有确实需要外面的实时信息时才查；纯闲聊、情绪、回忆、日常、测试功能、让她检查已有内容，都不查。');
      lines.push('2. 只按「这一轮用户说的话」判断；最近对话只用来理解她指的是谁/什么，不要把上一轮聊过的话题自动当成这一轮要查的内容。');
      lines.push('3. 最多查一次，能一句话说清就只查一次。');
      lines.push('4. 只输出严格 JSON，不要 markdown 代码块，不要解释。格式：');
      lines.push('{"calls":[{"name":"web_search","args":{"query":"要搜的关键词"}}]}');
      lines.push('5. 不需要查时输出：{"calls":[]}');
      lines.push('可用能力：用自己的手机搜公开网页。');
      return lines.join('\n');
    }
    lines.push('你是工具调度员。判断这一轮角色回复前，是否需要先调用外部工具。');
    lines.push('规则：');
    lines.push('1. 只在「没有外部实时信息就答不准」时才调用；纯闲聊、情绪、角色扮演、回忆对话、测试功能、让角色检查已有内容，一律不调用。');
    lines.push('2. 只按「这一轮用户说的话」判断；最近对话只用来理解代词，不要把上一轮的话题自动当成这一轮的搜索目标。');
    lines.push('3. 最多调用 2 个工具，能一个就够就只用一个。');
    lines.push('4. 用户明确说「搜一下 / 查一下 / 现在多少钱 / 今天天气 / 看看这条笔记」这类意图时优先调用对应工具。');
    lines.push('5. 例外：用户明确让你「去推特/X 看看/找别人怎么说」，或她正和你争执、抛出一个具体观点且需要一个外部例子时，可以调用 search_twitter；单纯情绪、撒娇、日常拌嘴不调用。');
    lines.push('6. 只输出严格 JSON，不要 markdown 代码块，不要解释。格式：');
    lines.push('{"calls":[{"name":"工具名","args":{...}}]}');
    lines.push('7. 不需要工具时输出：{"calls":[]}');
    lines.push('可用工具：');
    tools.forEach(function (tool) {
      lines.push('- ' + tool.name + '（' + tool.label + '）：' + tool.description + ' 参数：' + tool.params);
    });
    return lines.join('\n');
  }

  function parsePlan(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    raw = raw.replace(/```json/gi, '```').replace(/```/g, '').trim();
    var start = raw.indexOf('{');
    var end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    var obj;
    try { obj = JSON.parse(raw.slice(start, end + 1)); } catch (e) { return null; }
    if (!obj || !Array.isArray(obj.calls)) return null;
    return obj.calls;
  }

  // 只有用户这条消息本身带明确的外部信息意图，才值得再花一次小模型调用去规划工具。
  // 避免“把你用的全部发出来我检查一下”“测试表情包功能”这种话被上下文带偏，自己跑去搜。
  function hasExplicitToolIntent(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    // “检查一下”里也含“查一下”，不能让它被当成搜索指令。
    t = t.replace(/检查/g, '检');
    // 明确的链接：小红书 / 抖音 / 推特 / 普通网页，都算用户把材料递过来了
    if (/https?:\/\/|xiaohongshu\.com|xhslink\.com|douyin\.com|v\.douyin\.com|twitter\.com|x\.com/i.test(t)) return true;
    // “查一下聊天记录/表情包/歌单”是查本地，不该拿去搜网页
    var localOnly = /(聊天记录|表情包|贴纸|角色卡|人设|设定|设置|本地|收藏|歌单|书架|阅读记录|记忆|对话|相册|照片)/.test(t) &&
      !/(联网|网上|网页|新闻|热搜|搜索|百度|谷歌|实时)/.test(t);
    if (localOnly) return false;
    // 明确的搜索/查询动作
    if (/(搜一下|搜搜|搜索|帮我搜|替我搜|去搜|查一下|查查|帮我查|替我查|联网|上网查|网上查|查资料|找资料)/.test(t)) return true;
    // 明确的实时信息需求
    if (/(新闻|热搜|汇率|股价|比分|上映|航班|天气预报|气温|下雨|下雪|带伞|穿什么)/.test(t)) return true;
    if (/(最新|实时|今天|现在).*(新闻|消息|价格|多少钱|汇率|股价|比分|天气|气温|政策|发布|上映|航班|排名|数据|行情)/.test(t)) return true;
    // 平台专属请求：只有点名平台并带动作，才走对应工具；怎么用/怎么发这类问题不算
    if (/(小红书|小某书|红书)/.test(t) && /(搜|找|查|发|分享|推荐|看看|读|打开|主页|笔记|帖子|链接|这篇)/.test(t) &&
      !/(怎么|如何|为什么|教程|介绍|是什么|区别)/.test(t)) return true;
    if (/(抖音|douyin)/i.test(t) && /(搜|找|查|发|分享|推荐|看看|视频)/.test(t) &&
      !/(怎么看|怎么用|怎么发|如何|为什么|教程|介绍|是什么|区别|不看|不刷|不喜欢|没兴趣|不用|别)/.test(t)) return true;
    if (/(推特|twitter|x\.com)/i.test(t) && /(搜|找|查|看看|别人|怎么说|高赞|热门|帖子|链接)/.test(t) &&
      !/(怎么|如何|为什么|注册|登录|账号|教程|介绍|是什么)/.test(t)) return true;
    if (/(github|开源)/i.test(t) && /(有没有|找|搜|查|推荐|要是|如果)/.test(t) &&
      !/(怎么|如何|为什么|教程|介绍|是什么)/.test(t)) return true;
    return false;
  }

  async function askPlanner(userText, contextSnippet, diegetic) {
    var app = window.appData || {};
    var apiKey = String(app.apiKey || '').trim();
    var apiBase = String(app.apiBase || '').trim();
    if (!apiKey || !apiBase) return null;
    var base = apiBase.replace(/\/+$/, '');
    if (base.endsWith('/chat/completions')) base = base.replace('/chat/completions', '');
    var url = base + '/chat/completions';
    var tools = diegetic ? rpTools() : enabledTools();
    if (!tools.length) return [];
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var resp = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: app.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: plannerSystemPrompt(tools, diegetic) },
            { role: 'user', content: (contextSnippet ? '最近对话：\n' + contextSnippet + '\n\n' : '') + '这一轮用户说：' + String(userText || '') }
          ],
          temperature: 0.1,
          max_tokens: diegetic ? 160 : 220
        })
      });
      if (!resp.ok) return null;
      var data = await resp.json();
      var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      return parsePlan(content);
    } catch (e) {
      console.warn('[Tools] 工具规划失败：', e && e.message ? e.message : e);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // 返回：
  //   null      → 规划器不可用（调用方退回旧的自动检索兜底）
  //   []        → 规划器认为这轮不需要工具
  //   [文本...] → 真的调用了工具，文本要作为 system 注入
  async function planAndRun(options) {
    var opts = options || {};
    var diegetic = !!opts.diegetic;
    // 先做本地意图闸门：这句话本身没有明确的查/搜/链接/平台请求，就不发规划请求。
    // 这样既不会被上下文带着误搜，也省掉每轮一次不必要的小模型调用。
    if (!hasExplicitToolIntent(opts.userText)) return [];
    var tools = diegetic ? rpTools() : enabledTools();
    if (!tools.length) return [];
    var calls = await askPlanner(opts.userText, opts.contextSnippet, diegetic);
    if (calls === null) return null;
    var picked = calls.slice(0, diegetic ? 1 : 2).filter(function (call) {
      if (!call || typeof call !== 'object') return false;
      var tool = tools.filter(function (t) { return t.name === call.name; })[0];
      if (!tool) return false;
      if (call.name === 'web_search' && !String((call.args || {}).query || '').trim()) return false;
      if (call.name === 'read_xhs_note' && !/xiaohongshu\.com|xhslink\.com/i.test(String((call.args || {}).url || ''))) return false;
      return true;
    });
    var outputs = [];
    for (var i = 0; i < picked.length; i++) {
      var call = picked[i];
      var tool = tools.filter(function (t) { return t.name === call.name; })[0];
      try {
        var text = await tool.run(call.args || {});
        if (text) outputs.push(String(text));
      } catch (e) {
        console.warn('[Tools] ' + tool.label + ' 调用失败：', e && e.message ? e.message : e);
      }
    }
    return outputs;
  }

  window.MomTools = {
    list: function () { return enabledTools().map(function (t) { return { name: t.name, label: t.label, description: t.description, params: t.params }; }); },
    status: statusList,
    hasAnyTool: hasAnyTool,
    hasExplicitToolIntent: hasExplicitToolIntent,
    promptBlock: promptBlock,
    rpPromptBlock: rpPromptBlock,
    planAndRun: planAndRun
  };
})();
