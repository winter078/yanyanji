// 抖音搜索/视频详情：和 search-tools.js 共用浏览器里的 EveryInfra Key。
// 只开放抖音的两个动作，不把 Key 变成通用代理。
const API_URL = 'https://api.everyinfra.com/api/v1/social';
const TIMEOUT_MS = 45000;

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function fetchJson(options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(API_URL, { ...options, signal: controller.signal });
    const text = await resp.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text.slice(0, 400) }; }
    return { resp, data };
  } finally {
    clearTimeout(timer);
  }
}

function messageOf(data) {
  if (!data || typeof data !== 'object') return '';
  const err = data.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') return String(err.message || err.code || '');
  return String(data.message || data.detail || data.msg || data.raw || '').slice(0, 240);
}

function listFrom(payload) {
  const roots = [payload, payload && payload.data, payload && payload.result, payload && payload.data && payload.data.data];
  const keys = ['results', 'items', 'list', 'videos', 'data', 'records'];
  for (const root of roots) {
    if (Array.isArray(root)) return root;
    if (!root || typeof root !== 'object') continue;
    for (const key of keys) if (Array.isArray(root[key])) return root[key];
  }
  return [];
}

function objectFrom(payload) {
  const roots = [payload, payload && payload.data, payload && payload.result, payload && payload.data && payload.data.data];
  const keys = ['video', 'note', 'result', 'item', 'record', 'data'];
  for (const root of roots) {
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue;
    if (root.id || root.url || root.title || root.desc) return root;
    for (const key of keys) {
      const v = root[key];
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    }
  }
  return null;
}

function videoIdOf(value) {
  const text = String(value || '');
  const m = text.match(/(?:video|note)\/(\d{15,25})/i) || text.match(/(?:modal_id|aweme_id)=(\d{15,25})/i) || text.match(/^\s*(\d{15,25})\s*$/);
  return m ? m[1] : '';
}

function normalizeVideo(row) {
  if (!row || typeof row !== 'object') return null;
  const url = String(row.url || row.share_url || '').trim();
  const id = videoIdOf(row.id || row.aweme_id || row.video_id || url);
  if (!id && !url) return null;
  const images = Array.isArray(row.images) ? row.images.filter(function (u) { return typeof u === 'string' && /^https?:/i.test(u); }) : [];
  const text = String(row.text || row.desc || row.content || '').trim();
  const author = String(row.author_name || row.nickname || row.author || '').trim();
  const title = String(row.title || '').trim() || text.slice(0, 60) || '抖音视频';
  return {
    id: id,
    url: url || ('https://www.douyin.com/video/' + id),
    title: title,
    text: text,
    cover: String(row.image_url || row.cover || images[0] || '').trim(),
    images: images,
    author: author,
    author_id: String(row.author_id || row.sec_uid || '').trim(),
    duration_sec: row.duration_sec == null ? null : Number(row.duration_sec),
    like_count: row.like_count == null ? null : Number(row.like_count),
    comment_count: row.comment_count == null ? null : Number(row.comment_count)
  };
}

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (e) { return json(400, { error: 'bad_json' }); }

  const apiKey = String(body.api_key || context.request.headers.get('x-api-key') || '').trim();
  if (!apiKey) return json(503, { error: 'missing_everyinfra_key', requires_user_key: true, provider: 'everyinfra' });
  if (apiKey.length < 8) return json(400, { error: 'bad_key', provider: 'everyinfra' });

  const action = String(body.action || 'search').trim();
  if (action !== 'search' && action !== 'video') return json(400, { error: 'bad_action', provider: 'everyinfra' });

  let params = body.params && typeof body.params === 'object' ? body.params : {};
  if (action === 'search') {
    const keyword = String(params.keyword || '').trim().slice(0, 120);
    if (!keyword) return json(400, { error: 'missing_keyword', provider: 'everyinfra' });
    params = { keyword: keyword };
  }
  if (action === 'video') {
    const id = videoIdOf(params.id || params.url || '');
    if (!params.url && !id) return json(400, { error: 'missing_video', provider: 'everyinfra' });
    params = { url: String(params.url || '').trim() || ('https://www.douyin.com/video/' + id) };
  }

  let result;
  try {
    result = await fetchJson({
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({ platform: 'douyin', action: action, params: params })
    });
  } catch (err) {
    if (/aborted|AbortError|timeout/i.test(String(err && err.message))) {
      return json(504, { error: 'provider_timeout', provider: 'everyinfra' });
    }
    return json(502, { error: 'provider_error', provider: 'everyinfra', detail: String(err && err.message || '').slice(0, 200) });
  }

  const { resp, data } = result;
  if (resp.status === 401 || resp.status === 403) {
    return json(401, { error: 'invalid_key', provider: 'everyinfra', detail: messageOf(data) });
  }
  if (resp.status === 402) {
    return json(402, { error: 'insufficient_balance', provider: 'everyinfra', detail: messageOf(data) });
  }
  if (resp.status === 429) return json(429, { error: 'rate_limited', provider: 'everyinfra', detail: messageOf(data) });
  if (!resp.ok) {
    return json(502, {
      error: 'provider_error',
      provider: 'everyinfra',
      status: resp.status,
      detail: messageOf(data) || ('http_' + resp.status)
    });
  }

  if (action === 'search') {
    const rows = listFrom(data);
    const results = rows.map(normalizeVideo).filter(Boolean).slice(0, 20);
    return json(200, {
      ok: true,
      provider: 'everyinfra',
      action: 'search',
      results: results,
      count: results.length,
      next_page_token: String((rows[0] && rows[0].next_page_token) || (data && data.next_page_token) || '')
    });
  }

  const video = normalizeVideo(objectFrom(data) || (listFrom(data)[0] || null));
  return json(200, { ok: true, provider: 'everyinfra', action: 'video', video: video });
}
