// 小红书「按主题搜帖子」：复用用户自己的 LinkDigest Key，只返回能打开的笔记链接。
// 一次搜索 4 credits；解析单篇仍走现有 /api/xhs，同一个 Key。
const SEARCH_API = 'https://linkdigest.dev/api/v1/search';
const TIMEOUT_MS = 45000;

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const text = await resp.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text.slice(0, 200) }; }
    return { resp, data };
  } finally {
    clearTimeout(timer);
  }
}

function noteUrl(value) {
  try {
    const u = new URL(String(value || ''));
    if (!/^(www\.)?xiaohongshu\.com$/i.test(u.hostname)) return '';
    if (!/^\/(explore|discovery\/item)\/[0-9a-f]{24}/i.test(u.pathname)) return '';
    return u.toString();
  } catch (e) {
    return '';
  }
}

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (e) { return json(400, { error: 'bad_json' }); }
  const query = String(body.query || '').trim().slice(0, 200);
  const limit = Math.max(1, Math.min(10, Number(body.limit) || 5));
  if (!query) return json(400, { error: 'missing_query' });

  const apiKey = String(body.api_key || context.request.headers.get('x-api-key') || '').trim();
  if (!apiKey) return json(503, { error: 'missing_xhs_key', requires_user_key: true, provider: 'linkdigest' });
  if (apiKey.length < 12) return json(400, { error: 'bad_key' });

  let result;
  try {
    result = await fetchJson(SEARCH_API, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({ query, platform: 'xiaohongshu', limit })
    });
  } catch (err) {
    if (/^provider_timeout|aborted|AbortError/i.test(String(err && err.message))) {
      return json(504, { error: 'provider_timeout', provider: 'linkdigest' });
    }
    return json(502, { error: 'provider_error', provider: 'linkdigest', detail: String(err && err.message || '').slice(0, 180) });
  }

  const { resp, data } = result;
  if (resp.status === 401 || resp.status === 403) return json(401, { error: 'invalid_key', provider: 'linkdigest' });
  if (resp.status === 402) {
    return json(402, {
      error: 'insufficient_balance',
      provider: 'linkdigest',
      offer_zh: String(data.offer_zh || '').slice(0, 300),
      buy_url: String(data.buy_url || '').slice(0, 500)
    });
  }
  if (resp.status === 429) return json(429, { error: 'rate_limited', provider: 'linkdigest' });
  if (!resp.ok) {
    return json(502, {
      error: 'provider_error',
      provider: 'linkdigest',
      detail: String(data.error || data.detail || data.message || ('http_' + resp.status)).slice(0, 200)
    });
  }

  const rows = Array.isArray(data.results) ? data.results : [];
  const results = rows.map(function (item) {
    const url = noteUrl(item && item.url);
    if (!url) return null;
    return {
      url,
      title: String((item && (item.title || item.snippet)) || '小红书笔记').slice(0, 160),
      snippet: String((item && item.snippet) || '').slice(0, 300)
    };
  }).filter(Boolean).slice(0, limit);

  return json(200, {
    ok: true,
    provider: 'linkdigest',
    query,
    credits: Number(data.credits || 0) || 0,
    results
  });
}
