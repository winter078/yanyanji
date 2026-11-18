const TAVILY_URL = 'https://api.tavily.com/search';
const DEFAULT_MONTHLY_LIMIT = 900;
const DEFAULT_DAILY_LIMIT = 3;
const CACHE_TTL_SECONDS = 3600;
const CACHE_MAX = 300;

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function envNumber(env, name, fallback) {
  const value = Number(env && env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function dateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function monthKey() {
  return dateKey().slice(0, 7);
}

function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

async function kvGet(env, key) {
  if (!env || !env.SEARCH_KV) return null;
  try {
    return await env.SEARCH_KV.get(key);
  } catch (e) {
    return null;
  }
}

async function kvPut(env, key, value, ttl) {
  if (!env || !env.SEARCH_KV) return;
  try {
    await env.SEARCH_KV.put(key, String(value), { expirationTtl: ttl });
  } catch (e) {}
}

function limits(env) {
  return {
    monthly: envNumber(env, 'SEARCH_MONTHLY_LIMIT', DEFAULT_MONTHLY_LIMIT),
    daily: envNumber(env, 'SEARCH_DAILY_LIMIT', DEFAULT_DAILY_LIMIT)
  };
}

async function usageTotal(env) {
  return parseInt((await kvGet(env, `usage:month:${monthKey()}`)) || '0', 10) || 0;
}

async function usageForIp(env, ip) {
  return parseInt((await kvGet(env, `usage:day:${dateKey()}:${ip}`)) || '0', 10) || 0;
}

async function checkAndReserve(env, ip) {
  const { monthly, daily } = limits(env);
  const total = await usageTotal(env);
  if (total >= monthly) return { ok: false, reason: 'month_limit', total, monthly, daily };
  const ipCount = await usageForIp(env, ip);
  if (ipCount >= daily) return { ok: false, reason: 'daily_limit', total, monthly, daily, ip_count: ipCount };
  return { ok: true, total, monthly, daily };
}

async function commitUsage(env, ip) {
  if (!env || !env.SEARCH_KV) return;
  const total = await usageTotal(env);
  await kvPut(env, `usage:month:${monthKey()}`, total + 1, 40 * 24 * 60 * 60);
  const ipCount = await usageForIp(env, ip);
  await kvPut(env, `usage:day:${dateKey()}:${ip}`, ipCount + 1, 2 * 24 * 60 * 60);
}

async function tavilySearch(query, key) {
  const payload = JSON.stringify({
    query,
    search_depth: 'basic',
    max_results: 5,
    include_answer: false,
    include_raw_content: false
  });
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const resp = await fetch(TAVILY_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: payload,
        signal: controller.signal
      });
      const text = await resp.text();
      if (!resp.ok) {
        lastError = new Error(`tavily_http_${resp.status}: ${text.slice(0, 180)}`);
        if (resp.status < 500 || attempt === 1) throw lastError;
      } else {
        return JSON.parse(text);
      }
    } catch (e) {
      lastError = e;
      if (attempt === 1) throw e;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw lastError || new Error('tavily_error: unknown');
}

function trimResults(data, query) {
  const results = [];
  for (const item of (data.results || []).slice(0, 5)) {
    const content = String(item.content || '').trim();
    results.push({
      title: String(item.title || '').trim().slice(0, 160),
      url: String(item.url || '').trim(),
      content: content.slice(0, 700),
      score: item.score
    });
  }
  return { query, results };
}

function cacheRequest(query) {
  return new Request(`https://momo-search-cache.local/${encodeURIComponent(query.trim().toLowerCase())}`, {
    method: 'GET'
  });
}

async function cacheGet(query) {
  try {
    const cached = await caches.default.match(cacheRequest(query));
    if (!cached) return null;
    return await cached.json();
  } catch (e) {
    return null;
  }
}

async function cacheSet(query, value) {
  try {
    const body = JSON.stringify(value);
    const response = new Response(body, {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `max-age=${CACHE_TTL_SECONDS}` }
    });
    await caches.default.put(cacheRequest(query), response);
  } catch (e) {}
}

export async function handleSearch(context) {
  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { error: 'bad_json' });
  }
  const query = String(body.query || '').trim();
  const apiKey = String(body.api_key || '').trim();
  if (!query || query.length > 500) return json(400, { error: 'bad_query' });
  // 搜索 Key 由每个用户在前端填写，云端不再使用共享 Key。
  if (!apiKey) return json(503, { error: 'missing_key' });

  const cached = await cacheGet(query);
  if (cached) return json(200, { ...cached, cached: true });

  let data;
  try {
    data = await tavilySearch(query, apiKey);
  } catch (e) {
    return json(502, { error: 'search_failed', detail: String(e.message || e).slice(0, 160) });
  }

  const result = trimResults(data, query);
  await cacheSet(query, result);
  return json(200, { ...result, cached: false });
}

export async function handleStatus(context) {
  const { env } = context;
  const { monthly, daily } = limits(env);
  const total = await usageTotal(env);
  return json(200, {
    enabled: false,
    requires_user_key: true,
    service: 'tavily',
    month: monthKey(),
    total,
    monthly_limit: monthly,
    daily_limit: daily
  });
}
