// 小红书「站内搜索 + 读正文」：用用户自己的 TikHub Key，按小红书 App 的搜索结果取笔记。
// TikHub 按请求计费（$0.01/次）：一次搜索 + 一次详情，约 $0.02 找一篇。
const TIKHUB_BASE = 'https://api.tikhub.io';
const TIMEOUT_MS = 45000;

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function fetchJson(path, params, apiKey) {
  const qs = new URLSearchParams();
  Object.keys(params || {}).forEach(function (k) {
    const v = params[k];
    if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v));
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(TIKHUB_BASE + path + '?' + qs.toString(), {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        accept: 'application/json'
      },
      signal: controller.signal
    });
    const text = await resp.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text.slice(0, 200) }; }
    return { resp, data };
  } finally {
    clearTimeout(timer);
  }
}

function walk(value, visit, depth) {
  if (!value || depth > 7) return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  visit(value);
  Object.keys(value).forEach(function (k) { walk(value[k], visit, depth + 1); });
}

function firstString(obj, keys) {
  for (const k of keys) {
    const v = obj && obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function collectNotes(data) {
  const out = [];
  const seen = new Set();
  walk(data, function (node) {
    if (node.user_id || node.red_id || node.redId) return;
    if (!node.note_card && !node.noteCard && !node.note_id && !node.noteId && !node.model_type) return;
    const id = firstString(node, ['note_id', 'noteId', 'id']);
    if (!id || !/^[0-9a-f]{24}$/i.test(id) || seen.has(id)) return;
    const card = node.note_card || node.noteCard || node;
    const title = firstString(card, ['display_title', 'displayTitle', 'title', 'desc']);
    if (!title && !node.cover && !card.cover) return;
    const user = card.user || node.user || {};
    const cover = card.cover || node.cover || {};
    const img = firstString(cover, ['url_default', 'urlDefault', 'url_pre', 'urlPre', 'url']);
    const token = firstString(node, ['xsec_token', 'xsecToken']);
    const noteUrl = 'https://www.xiaohongshu.com/explore/' + id + (token ? ('?xsec_token=' + encodeURIComponent(token) + '&xsec_source=pc_search') : '');
    out.push({
      id,
      url: noteUrl,
      title,
      author: firstString(user, ['nickname', 'nick_name', 'name']),
      cover: img
    });
    seen.add(id);
  });
  return out;
}

function normalizeDetail(data, fallback) {
  let detail = null;
  walk(data, function (node) {
    if (!detail && node && typeof node === 'object' && (node.note_id || node.noteId)) {
      const id = firstString(node, ['note_id', 'noteId']);
      if (/^[0-9a-f]{24}$/i.test(id)) detail = node;
    }
  });
  if (!detail) detail = data && data.data ? data.data : {};
  const id = firstString(detail, ['note_id', 'noteId']) || (fallback && fallback.id) || '';
  const title = firstString(detail, ['title', 'display_title', 'displayTitle']) || (fallback && fallback.title) || '小红书笔记';
  const desc = firstString(detail, ['desc', 'description', 'caption', 'content']) || '';
  const user = detail.user || {};
  const images = [];
  const list = detail.image_list || detail.imageList || detail.images || [];
  if (Array.isArray(list)) {
    list.forEach(function (it) {
      const u = typeof it === 'string' ? it : firstString(it || {}, ['url_default', 'urlDefault', 'url_pre', 'urlPre', 'url']);
      if (u) images.push(u);
    });
  }
  const cover = images[0] || firstString(detail.cover || {}, ['url_default', 'url_pre', 'url']) || (fallback && fallback.cover) || '';
  return {
    note_id: id,
    url: 'https://www.xiaohongshu.com/explore/' + id,
    title: String(title).slice(0, 160),
    desc: String(desc).slice(0, 1200),
    author: firstString(user, ['nickname', 'nick_name', 'name']) || (fallback && fallback.author) || '',
    cover,
    images: images.slice(0, 6)
  };
}

async function detailFor(id, apiKey) {
  const paths = [
    '/api/v1/xiaohongshu/app_v2/get_image_note_detail',
    '/api/v1/xiaohongshu/app_v2/get_video_note_detail'
  ];
  let last = null;
  for (const path of paths) {
    const result = await fetchJson(path, { note_id: id }, apiKey);
    const { resp, data } = result;
    if (resp.status === 401 || resp.status === 403) return { error: 'invalid_key', status: 401 };
    if (resp.status === 402) return { error: 'insufficient_balance', status: 402, data };
    if (resp.ok && data && Number(data.code || 200) === 200) {
      const note = normalizeDetail(data, { id });
      if (note.title || note.desc || note.images.length) return { note };
    }
    last = { status: resp.status, data };
  }
  return { error: 'note_unreadable', status: 502, detail: String((last && last.data && (last.data.detail || last.data.message)) || '').slice(0, 160) };
}

async function searchNotes(query, apiKey) {
  const result = await fetchJson('/api/v1/xiaohongshu/app_v2/search_notes', {
    keyword: query,
    page: 1,
    sort_type: 'general',
    note_type: '不限',
    time_filter: '不限',
    source: 'explore_feed',
    ai_mode: 0
  }, apiKey);
  const { resp, data } = result;
  if (resp.status === 401 || resp.status === 403) return { error: 'invalid_key', status: 401 };
  if (resp.status === 402) return { error: 'insufficient_balance', status: 402, data };
  if (resp.status === 429) return { error: 'rate_limited', status: 429 };
  if (!resp.ok) return { error: 'provider_error', status: 502, detail: String(data.message || data.detail || ('http_' + resp.status)).slice(0, 160) };
  return { candidates: collectNotes(data) };
}

async function userLatest(params, apiKey) {
  const result = await fetchJson('/api/v1/xiaohongshu/app_v2/get_user_posted_notes', {
    user_id: params.user_id || '',
    share_text: params.share_text || '',
    cursor: ''
  }, apiKey);
  const { resp, data } = result;
  if (resp.status === 401 || resp.status === 403) return { error: 'invalid_key', status: 401 };
  if (resp.status === 402) return { error: 'insufficient_balance', status: 402, data };
  if (!resp.ok) return { error: 'provider_error', status: 502, detail: String(data.message || data.detail || ('http_' + resp.status)).slice(0, 160) };
  const candidates = collectNotes(data);
  if (!candidates.length) return { error: 'no_notes', status: 404 };
  return { candidates };
}

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (e) { return json(400, { error: 'bad_json' }); }
  const apiKey = String(body.api_key || context.request.headers.get('x-api-key') || '').trim();
  if (!apiKey) return json(503, { error: 'missing_tikhub_key', provider: 'tikhub' });
  if (apiKey.length < 12) return json(400, { error: 'bad_key', provider: 'tikhub' });

  const action = String(body.action || 'search');
  let searched;
  if (action === 'user_latest') {
    searched = await userLatest(body, apiKey);
  } else {
    const query = String(body.query || '').trim().slice(0, 200);
    if (!query) return json(400, { error: 'missing_query', provider: 'tikhub' });
    searched = await searchNotes(query, apiKey);
  }
  if (searched.error) {
    return json(searched.status, {
      error: searched.error,
      provider: 'tikhub',
      detail: searched.detail || ''
    });
  }

  const candidates = (searched.candidates || []).slice(0, Math.max(1, Math.min(5, Number(body.limit) || 3)));
  if (!candidates.length) return json(200, { ok: true, provider: 'tikhub', note: null, results: [] });

  let lastError = null;
  for (const cand of candidates.slice(0, 2)) {
    const read = await detailFor(cand.id, apiKey);
    if (read.note && (read.note.title || read.note.desc || read.note.images.length)) {
      return json(200, { ok: true, provider: 'tikhub', note: read.note, results: candidates });
    }
    if (read.error === 'invalid_key' || read.error === 'insufficient_balance') {
      return json(read.status, { error: read.error, provider: 'tikhub' });
    }
    lastError = read;
  }

  return json(502, {
    error: (lastError && lastError.error) || 'note_unreadable',
    provider: 'tikhub',
    detail: (lastError && lastError.detail) || ''
  });
}
