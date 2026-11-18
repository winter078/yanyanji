// 用量控制台：拦截所有大模型请求，统计调用次数 / token / 失败 / 耗时，并提供接口探测
(function() {
  if (window.__momoTokenMonitorInstalled) return;
  window.__momoTokenMonitorInstalled = true;
  window.__momoTokenMonitorVersion = '2026111672';

  const LOG_KEY = 'momo_token_log_v1';
  const AGG_KEY = 'momo_token_agg_v1';
  const MAX_LOG = 200;
  const KEEP_DAYS = 60;

  function todayKey(ts) {
    const d = new Date(ts || Date.now());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function emptyBucket() {
    return { calls: 0, pt: 0, ct: 0, tt: 0, fail: 0, ms: 0, exact: 0 };
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) { return fallback; }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function loadAgg() {
    const agg = loadJSON(AGG_KEY, null);
    if (!agg || !agg.total) return { total: emptyBucket(), byDay: {}, byModel: {} };
    agg.byDay = agg.byDay || {};
    agg.byModel = agg.byModel || {};
    return agg;
  }

  function bump(bucket, item) {
    bucket.calls += 1;
    bucket.ms += item.ms || 0;
    if (!item.ok) bucket.fail += 1;
    if (item.pt || item.ct || item.tt) {
      bucket.exact += 1;
      bucket.pt += item.pt || 0;
      bucket.ct += item.ct || 0;
      bucket.tt += item.tt || (item.pt || 0) + (item.ct || 0);
    }
  }

  function record(item) {
    const agg = loadAgg();
    bump(agg.total, item);
    const day = todayKey(item.ts);
    agg.byDay[day] = agg.byDay[day] || emptyBucket();
    bump(agg.byDay[day], item);
    const model = item.model || '未知模型';
    agg.byModel[model] = agg.byModel[model] || emptyBucket();
    bump(agg.byModel[model], item);
    const keys = Object.keys(agg.byDay).sort();
    while (keys.length > KEEP_DAYS) {
      delete agg.byDay[keys.shift()];
    }
    saveJSON(AGG_KEY, agg);

    let log = loadJSON(LOG_KEY, []);
    if (!Array.isArray(log)) log = [];
    log.unshift(item);
    if (log.length > MAX_LOG) log = log.slice(0, MAX_LOG);
    saveJSON(LOG_KEY, log);
    if (window.__momoTokenConsoleVisible) refreshTokenConsole();
  }

  function parseUsage(json) {
    const usage = json && (json.usage || (json.response && json.response.usage));
    if (!usage || typeof usage !== 'object') return null;
    const pt = Number(usage.prompt_tokens || usage.input_tokens || 0) || 0;
    const ct = Number(usage.completion_tokens || usage.output_tokens || 0) || 0;
    const tt = Number(usage.total_tokens || 0) || (pt + ct);
    if (!pt && !ct && !tt) return null;
    return { pt: pt, ct: ct, tt: tt };
  }

  function extractUsageFromText(text) {
    if (!text) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      if (trimmed.charAt(0) === '{') return parseUsage(JSON.parse(trimmed));
    } catch (e) {}
    // SSE 兜底：从 data 行里找最后一个带 usage 的对象
    let found = null;
    trimmed.split('\n').forEach(function(line) {
      const body = line.trim().replace(/^data:\s*/, '');
      if (!body || body === '[DONE]' || body.charAt(0) !== '{') return;
      try {
        const parsed = parseUsage(JSON.parse(body));
        if (parsed) found = parsed;
      } catch (e) {}
    });
    return found;
  }

  const LLM_URL_RE = /\/chat\/completions|\/responses$|\/completions$/i;

  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = (typeof input === 'string') ? input : ((input && input.url) || '');
    if (!LLM_URL_RE.test(url)) return originalFetch.apply(this, arguments);

    let model = '';
    try {
      const body = init && init.body;
      if (typeof body === 'string') model = JSON.parse(body).model || '';
    } catch (e) {}
    if (!model) {
      try { model = (window.appData && window.appData.model) || ''; } catch (e) {}
    }

    const startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
    const requestPromise = originalFetch.apply(this, arguments);

    return requestPromise.then(async function(response) {
      const ms = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - startedAt);
      let usage = null;
      try {
        const text = await response.clone().text();
        usage = extractUsageFromText(text);
      } catch (e) {}
      const item = {
        ts: Date.now(),
        at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        model: model || '未知模型',
        status: response.status,
        ok: !!response.ok,
        ms: ms,
        pt: usage ? usage.pt : 0,
        ct: usage ? usage.ct : 0,
        tt: usage ? usage.tt : 0,
        host: (function() { try { return new URL(url, location.href).host; } catch (e) { return ''; } })()
      };
      record(item);
      return response;
    }, function(error) {
      const ms = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - startedAt);
      record({ ts: Date.now(), at: new Date().toLocaleTimeString('zh-CN', { hour12: false }), model: model || '未知模型', status: 0, ok: false, ms: ms, pt: 0, ct: 0, tt: 0, host: '' });
      throw error;
    });
  };

  // ===== 展示 =====
  function fmtNum(n) {
    const v = Number(n) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
    if (v >= 10000) return (v / 10000).toFixed(2) + '万';
    return String(v);
  }

  function fmtTime(ts) {
    try {
      const d = new Date(ts);
      return (String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
    } catch (e) { return ''; }
  }

  function textOf(id) { const el = document.getElementById(id); return el; }

  function renderBucket(model, bucket, maxTokens) {
    const pct = maxTokens > 0 ? Math.max(2, Math.round((bucket.tt / maxTokens) * 100)) : 2;
    return '<div style="margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--color-text-primary);margin-bottom:4px;gap:8px;">' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + model + '</span>' +
        '<span style="color:var(--color-text-secondary);flex-shrink:0;">' + bucket.calls + ' 次 · ' + fmtNum(bucket.tt) + ' tokens' + (bucket.fail ? ' · ' + bucket.fail + ' 失败' : '') + '</span>' +
      '</div>' +
      '<div style="height:5px;border-radius:999px;background:rgba(148,163,184,0.16);overflow:hidden;">' +
        '<div style="height:5px;width:' + pct + '%;border-radius:999px;background:#a78bfa;"></div>' +
      '</div>' +
    '</div>';
  }

  window.refreshTokenConsole = function() {
    const card = document.getElementById('token-console-card');
    if (!card) return;
    window.__momoTokenConsoleVisible = true;

    const agg = loadAgg();
    const today = agg.byDay[todayKey()] || emptyBucket();
    const callsEl = textOf('token-today-calls');
    const tokensEl = textOf('token-today-tokens');
    const failEl = textOf('token-today-fail');
    const avgEl = textOf('token-today-avg');
    if (callsEl) callsEl.textContent = fmtNum(today.calls);
    if (tokensEl) tokensEl.textContent = today.exact ? fmtNum(today.tt) : (today.calls ? '未返回' : '0');
    if (failEl) failEl.textContent = fmtNum(today.fail);
    if (avgEl) avgEl.textContent = today.calls ? Math.round(today.ms / today.calls) + 'ms' : '—';

    const totalEl = textOf('token-total-summary');
    if (totalEl) {
      totalEl.textContent = '累计 ' + fmtNum(agg.total.calls) + ' 次调用 · ' + fmtNum(agg.total.tt) + ' tokens · ' +
        (agg.total.calls ? Math.round(agg.total.ms / agg.total.calls) + 'ms 平均' : '暂无数据');
    }

    const modelList = textOf('token-model-list');
    if (modelList) {
      const models = Object.keys(agg.byModel).sort(function(a, b) { return (agg.byModel[b].tt || 0) - (agg.byModel[a].tt || 0); });
      if (!models.length) {
        modelList.innerHTML = '<div style="font-size:11.5px;color:var(--color-text-secondary);padding:4px 0;">还没有调用记录。</div>';
      } else {
        const maxTokens = Math.max.apply(null, models.map(function(m) { return agg.byModel[m].tt || 0; }).concat([1]));
        modelList.innerHTML = models.slice(0, 6).map(function(m) { return renderBucket(m, agg.byModel[m], maxTokens); }).join('');
      }
    }

    const recentList = textOf('token-recent-list');
    if (recentList) {
      let log = loadJSON(LOG_KEY, []);
      if (!Array.isArray(log)) log = [];
      if (!log.length) {
        recentList.innerHTML = '<div style="font-size:11.5px;color:var(--color-text-secondary);padding:4px 0;">还没有调用记录。</div>';
      } else {
        recentList.innerHTML = log.slice(0, 8).map(function(item) {
          const stateColor = item.ok ? '#34d399' : '#f87171';
          const stateText = item.ok ? '成功' : (item.status === 0 ? '失败' : 'HTTP ' + item.status);
          return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,0.10);">' +
            '<span style="color:var(--color-text-secondary);flex-shrink:0;">' + fmtTime(item.ts) + '</span>' +
            '<span style="color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (item.model || '未知模型') + '</span>' +
            '<span style="color:var(--color-text-secondary);flex-shrink:0;">' + (item.ms || 0) + 'ms</span>' +
            '<span style="color:' + stateColor + ';flex-shrink:0;">' + stateText + '</span>' +
          '</div>';
        }).join('');
      }
    }
  };

  window.clearTokenStats = function() {
    if (!confirm('确定清空用量统计吗？只删除统计数字，不影响任何聊天和数据。')) return;
    try { localStorage.removeItem(LOG_KEY); localStorage.removeItem(AGG_KEY); } catch (e) {}
    window.refreshTokenConsole();
  };

  // ===== 接口探测 =====
  function setProbeState(text, color) {
    const el = document.getElementById('token-probe-status');
    if (!el) return;
    el.style.display = '';
    el.style.color = color || 'var(--color-text-secondary)';
    el.textContent = text;
  }

  window.probeMainModel = async function() {
    const data = window.appData || {};
    const base = String(data.apiBase || '').trim().replace(/\/+$/, '');
    const key = String(data.apiKey || '').trim();
    const model = String(data.model || '').trim();
    if (!base || !key) { setProbeState('还没有填写 Base URL 或 API Key，先去上面填。', '#fbbf24'); return; }
    setProbeState('正在探测主模型…', 'var(--color-text-secondary)');
    const btn = document.getElementById('token-probe-btn');
    if (btn) { btn.disabled = true; btn.textContent = '探测中…'; }
    const started = Date.now();
    let ok = false;
    let detail = '';
    try {
      const res = await window.fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, temperature: 0 })
      });
      const ms = Date.now() - started;
      ok = res.ok;
      if (res.ok) {
        detail = '主模型「' + model + '」可用 · HTTP ' + res.status + ' · ' + ms + 'ms';
      } else {
        let body = '';
        try { body = (await res.text()).slice(0, 160); } catch (e) {}
        detail = '主模型返回 HTTP ' + res.status + ' · ' + ms + 'ms' + (body ? ' · ' + body : '');
      }
    } catch (err) {
      detail = '连不上 ' + base + '：' + (err && err.message ? err.message : err);
    }
    if (btn) { btn.disabled = false; btn.textContent = '测主模型'; }
    setProbeState(detail, ok ? '#34d399' : '#f87171');
  };

  window.probeLocalService = async function() {
    setProbeState('正在探测本机服务 3010…', 'var(--color-text-secondary)');
    const started = Date.now();
    try {
      const res = await originalFetch('http://127.0.0.1:3010/api/search/status', { method: 'GET' });
      const ms = Date.now() - started;
      let summary = 'HTTP ' + res.status;
      try {
        const json = await res.json();
        if (json && (json.ready === false || json.ok === false)) summary += ' · 未就绪';
        else summary += ' · 在线';
      } catch (e) {}
      setProbeState('本机服务 ' + summary + ' · ' + ms + 'ms', res.ok ? '#34d399' : '#f87171');
    } catch (err) {
      setProbeState('本机服务 3010 没响应（浏览器控制台 / 搜索 / 天气会不可用）：' + (err && err.message ? err.message : err), '#f87171');
    }
  };

  window.__momoTokenConsoleVisible = false;

  // 卡片进入视口时自动刷新一次，离开则停止实时刷新
  function watchVisibility() {
    const card = document.getElementById('token-console-card');
    if (!card) return false;
    if (window.IntersectionObserver) {
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          window.__momoTokenConsoleVisible = !!entry.isIntersecting;
          if (entry.isIntersecting) window.refreshTokenConsole();
        });
      }, { threshold: 0.08 });
      observer.observe(card);
    }
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchVisibility);
  } else {
    watchVisibility();
  }
})();
