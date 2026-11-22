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
      run: function (args) {
        return window.__momRunXhsRead ? window.__momRunXhsRead(args && args.url) : Promise.resolve('');
      }
    },
    {
      name: 'search_twitter',
      label: '推特',
      description: '在推特/X 搜一个话题的高赞公开帖子，读完原帖和一部分回复。只在用户明确让你“去推特看看/找推特上别人怎么说/甩条高赞帖给我看”时调用；普通聊天、吵架但没提推特时不要用。',
      params: '{"query": "要在推特/X 搜的话题，尽量短，像人搜索时输入的那样"}',
      available: function () {
        return !!readLS('momo_everyinfra_api_key_v1') && !window.__momTwitterQueryTurn;
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
    lines.push('调用是系统按你的判断自动完成的：需要时直接用结果说话，不要假装自己不会上网、也不要编造没查到的内容。');
    lines.push('关于小红书：用户要你「发/分享/推荐一篇小红书」时，不需要她给链接——系统会自动找一篇真实笔记并把卡片挂在你回复后面。你只管自然答应、递过去，绝对不要说“必须先有链接”“我调不了这个工具”。只有当用户自己贴了链接让你读内容时，才是读取单篇笔记的场景。');
    lines.push('关于抖音：用户要你「发/分享/找一个抖音视频」时，也不需要她给链接——系统会自动搜一条真实视频、读完文案再把卡片挂在你回复后面。你只管自然答应、递过去，不要说“必须先有链接”，也不要说“我调不了这个工具”。');
    lines.push('关于推特/X：只有用户明确说「去推特看看 / 找推特上别人怎么说 / 甩条高赞的给我看」时，系统才会去搜真实高赞帖。你读完原帖和回复再用自己的话讲，不要把几条回复说成“所有人都这样想”，也不要说接口、抓取、技术限制。');
    return lines.join('\n');
  }

  function plannerSystemPrompt(tools) {
    var lines = [];
    lines.push('你是工具调度员。判断这一轮角色回复前，是否需要先调用外部工具。');
    lines.push('规则：');
    lines.push('1. 只在「没有外部实时信息就答不准」时才调用；纯闲聊、情绪、角色扮演、回忆对话一律不调用。');
    lines.push('2. 最多调用 2 个工具，能一个就够就只用一个。');
    lines.push('3. 用户明确说「搜一下 / 查一下 / 现在多少钱 / 今天天气 / 看看这条笔记」这类意图时优先调用对应工具。');
    lines.push('4. 只输出严格 JSON，不要 markdown 代码块，不要解释。格式：');
    lines.push('{"calls":[{"name":"工具名","args":{...}}]}');
    lines.push('5. 不需要工具时输出：{"calls":[]}');
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

  async function askPlanner(userText, contextSnippet) {
    var app = window.appData || {};
    var apiKey = String(app.apiKey || '').trim();
    var apiBase = String(app.apiBase || '').trim();
    if (!apiKey || !apiBase) return null;
    var base = apiBase.replace(/\/+$/, '');
    if (base.endsWith('/chat/completions')) base = base.replace('/chat/completions', '');
    var url = base + '/chat/completions';
    var tools = enabledTools();
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
            { role: 'system', content: plannerSystemPrompt(tools) },
            { role: 'user', content: (contextSnippet ? '最近对话：\n' + contextSnippet + '\n\n' : '') + '这一轮用户说：' + String(userText || '') }
          ],
          temperature: 0.1,
          max_tokens: 220
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
    var tools = enabledTools();
    if (!tools.length) return [];
    var calls = await askPlanner(opts.userText, opts.contextSnippet);
    if (calls === null) return null;
    var picked = calls.slice(0, 2).filter(function (call) {
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
    hasAnyTool: hasAnyTool,
    promptBlock: promptBlock,
    planAndRun: planAndRun
  };
})();
