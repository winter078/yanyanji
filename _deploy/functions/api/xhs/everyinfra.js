// 小红书搜索/正文：走 EveryInfra 统一接口，用用户自己的 Key。
// 只代理小红书（xiaohongshu），避免这把 Key 被拿去调别的平台。
const API_URL = 'https://api.everyinfra.com/api/v1/social';
const TIMEOUT_MS = 45000;
const ACTIONS = new Set(['search', 'note', 'user_posts', 'profile', 'search_users']);

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
  const keys = ['results', 'items', 'list', 'notes', 'data', 'records'];
  for (const root of roots) {
    if (Array.isArray(root)) return root;
    if (!root || typeof root !== 'object') continue;
    for (const key of keys) if (Array.isArray(root[key])) return root[key];
  }
  return [];
}

function objectFrom(payload) {
  const roots = [payload, payload && payload.data, payload && payload.result, payload && payload.data && payload.data.data];
  const keys = ['note', 'result', 'item', 'record', 'data'];
  for (const root of roots) {
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue;
    if (root.id || root.url || root.title) return root;
    for (const key of keys) {
      const v = root[key];
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    }
  }
  return null;
}

function noteIdOf(value) {
  const text = String(value || '');
  const m = text.match(/(?:explore|discovery\/item|note)\/([0-9a-f]{24})/i) || text.match(/^\s*([0-9a-f]{24})\s*$/i);
  return m ? m[1] : '';
}

function normalizeNote(row) {
  if (!row || typeof row !== 'object') return null;
  const url = String(row.url || row.note_url || row.share_url || '').trim();
  const id = noteIdOf(row.id || row.note_id || url);
  if (!id && !url) return null;
  const images = Array.isArray(row.images) ? row.images.filter(function (u) { return typeof u === 'string' && /^https?:/i.test(u); }) : [];
  const author = String(row.author_name || row.nickname || row.author_nickname || '').trim();
  const title = String(row.title || row.desc || '').trim() || '小红书笔记';
  const text = String(row.text || row.desc || row.content || '').trim();
  return {
    id: id,
    url: url || ('https://www.xiaohongshu.com/explore/' + id),
    title: title,
    text: text,
    cover: String(row.image_url || images[0] || '').trim(),
    images: images,
    author: author,
    author_id: String(row.author_id || '').trim(),
    author_url: String(row.author_url || '').trim(),
    like_count: row.like_count == null ? null : Number(row.like_count),
    collect_count: row.collect_count == null ? null : Number(row.collect_count)
  };
}

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (e) { return json(400, { error: 'bad_json' }); }

  const apiKey = String(body.api_key || context.request.headers.get('x-api-key') || '').trim();
  if (!apiKey) return json(503, { error: 'missing_everyinfra_key', requires_user_key: true, provider: 'everyinfra' });
  if (apiKey.length < 8) return json(400, { error: 'bad_key', provider: 'everyinfra' });

  const action = String(body.action || 'search').trim();
  if (!ACTIONS.has(action)) return json(400, { error: 'bad_action', provider: 'everyinfra' });

  let params = body.params && typeof body.params === 'object' ? body.params : {};
  if (action === 'search') {
    const keyword = String(params.keyword || '').trim().slice(0, 120);
    if (!keyword) return json(400, { error: 'missing_keyword', provider: 'everyinfra' });
    params = { keyword: keyword };
  }
  if (action === 'note') {
    const noteId = noteIdOf(params.id || params.url || '');
    if (!params.url && !noteId) return json(400, { error: 'missing_note', provider: 'everyinfra' });
    const url = String(params.url || '').trim() || ('https://www.xiaohongshu.com/explore/' + noteId);
    params = { url: url };
  }
  if (action === 'user_posts' || action === 'profile') {
    const userId = String(params.user_id || '').trim();
    if (!/^[0-9a-f]{20,26}$/i.test(userId)) return json(400, { error: 'bad_user_id', provider: 'everyinfra' });
    params = { user_id: userId };
  }
  if (action === 'search_users') {
    const keyword = String(params.keyword || '').trim().slice(0, 60);
    if (!keyword) return json(400, { error: 'missing_keyword', provider: 'everyinfra' });
    params = { keyword: keyword };
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
      body: JSON.stringify({ platform: 'xiaohongshu', action: action, params: params })
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

  const rows = listFrom(data);
  const note = objectFrom(data);

  if (action === 'search' || action === 'user_posts') {
    const results = rows.map(normalizeNote).filter(Boolean).slice(0, 20);
    return json(200, {
      ok: true,
      provider: 'everyinfra',
      action: action,
      results: results,
      count: results.length,
      next_page_token: String((rows[0] && rows[0].next_page_token) || (data && data.next_page_token) || '')
    });
  }

  if (action === 'note') {
    const normalized = normalizeNote(note);
    if (!normalized) return json(200, { ok: true, provider: 'everyinfra', action: 'note', note: null });
    return json(200, { ok: true, provider: 'everyinfra', action: 'note', note: normalized });
  }

  if (action === 'profile') {
    return json(200, {
      ok: true,
      provider: 'everyinfra',
      action: 'profile',
      profile: note ? {
        user_id: String(note.user_id || note.id || ''),
        nickname: String(note.nickname || note.name || ''),
        red_id: String(note.red_id || ''),
        url: String(note.url || ''),
        avatar_url: String(note.avatar_url || ''),
        follower_count: note.follower_count == null ? null : Number(note.follower_count)
      } : null
    });
  }

  return json(200, { ok: true, provider: 'everyinfra', action: 'search_users', users: rows.slice(0, 20) });
}
