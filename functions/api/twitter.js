// X (Twitter) 公开帖子搜索/读取：和 search-tools.js 共用浏览器里的 EveryInfra Key。
// 只开放搜索、单帖、评论、主页帖子这几个读动作，不做登录、发帖或私信。
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
  const keys = ['results', 'items', 'list', 'posts', 'tweets', 'comments', 'replies', 'data', 'records'];
  for (const root of roots) {
    if (Array.isArray(root)) return root;
    if (!root || typeof root !== 'object') continue;
    for (const key of keys) if (Array.isArray(root[key])) return root[key];
  }
  return [];
}

function objectFrom(payload) {
  const roots = [payload, payload && payload.data, payload && payload.result, payload && payload.data && payload.data.data];
  const keys = ['post', 'tweet', 'result', 'item', 'record', 'data'];
  for (const root of roots) {
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue;
    if (root.id || root.url || root.text) return root;
    for (const key of keys) {
      const v = root[key];
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    }
  }
  return null;
}

function tweetIdOf(value) {
  const text = String(value || '').trim();
  let m = text.match(/(?:x\.com|twitter\.com)\/(?:[^/?#]+)\/status(?:es)?\/(\d{10,25})/i);
  if (m) return m[1];
  m = text.match(/status(?:es)?\/(\d{10,25})/i);
  if (m) return m[1];
  m = text.match(/^\s*(\d{10,25})\s*$/);
  return m ? m[1] : '';
}

function mediaList(value) {
  if (!value) return [];
  const rows = Array.isArray(value) ? value : [value];
  const urls = [];
  for (const row of rows) {
    if (typeof row === 'string' && /^https?:/i.test(row)) { urls.push(row); continue; }
    if (!row || typeof row !== 'object') continue;
    const url = String(row.url || row.media_url_https || row.preview_image_url || row.preview_image || row.thumbnail || '').trim();
    if (url) urls.push(url);
  }
  return urls.filter(Boolean).slice(0, 4);
}

function normalizePost(row) {
  if (!row || typeof row !== 'object') return null;
  const id = tweetIdOf(row.id || row.tweet_id || row.url || '');
  const text = String(row.text || row.full_text || row.content || '').trim();
  const author = String(row.author_username || row.username || '').trim();
  if (!id && !text) return null;
  const images = mediaList(row.media || row.media_urls || row.images || row.photos);
  return {
    id: id,
    url: String(row.url || '').trim() || (id ? ('https://x.com/' + (author || 'i') + '/status/' + id) : ''),
    text: text,
    title: text.slice(0, 90) || 'X 帖子',
    author_username: author,
    author_name: String(row.author_name || row.name || '').trim(),
    author_url: String(row.author_url || '').trim() || (author ? ('https://x.com/' + author) : ''),
    author_avatar: String(row.author_avatar_url || row.avatar_url || '').trim(),
    author_follower_count: row.author_follower_count == null ? null : Number(row.author_follower_count),
    author_is_verified: row.author_is_verified === true,
    like_count: row.like_count == null ? null : Number(row.like_count),
    retweet_count: row.retweet_count == null ? null : Number(row.retweet_count),
    reply_count: row.reply_count == null ? null : Number(row.reply_count),
    quote_count: row.quote_count == null ? null : Number(row.quote_count),
    view_count: row.view_count == null ? null : Number(row.view_count),
    posted_at: String(row.posted_at || row.created_at || '').trim(),
    language: String(row.language || row.lang || '').trim(),
    conversation_id: String(row.conversation_id || '').trim(),
    is_reply: row.is_reply === true,
    is_quote: row.is_quote === true,
    is_repost: row.is_repost === true,
    reply_to: String(row.reply_to || '').trim(),
    media: images,
    cover: images[0] || ''
  };
}

function normalizeComment(row) {
  if (!row || typeof row !== 'object') return null;
  const text = String(row.text || row.full_text || row.content || '').trim();
  if (!text) return null;
  return {
    id: String(row.id || row.tweet_id || '').trim(),
    url: String(row.url || '').trim(),
    text: text,
    author_username: String(row.author_username || row.username || '').trim(),
    author_name: String(row.author_name || row.name || '').trim(),
    author_follower_count: row.author_follower_count == null ? null : Number(row.author_follower_count),
    like_count: row.like_count == null ? null : Number(row.like_count),
    reply_count: row.reply_count == null ? null : Number(row.reply_count),
    posted_at: String(row.posted_at || row.created_at || '').trim()
  };
}

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (e) { return json(400, { error: 'bad_json' }); }

  const apiKey = String(body.api_key || context.request.headers.get('x-api-key') || '').trim();
  if (!apiKey) return json(503, { error: 'missing_everyinfra_key', requires_user_key: true, provider: 'everyinfra' });
  if (apiKey.length < 8) return json(400, { error: 'bad_key', provider: 'everyinfra' });

  const action = String(body.action || 'search').trim();
  if (!['search', 'post', 'comments', 'user_posts', 'profile'].includes(action)) {
    return json(400, { error: 'bad_action', provider: 'everyinfra' });
  }

  let params = body.params && typeof body.params === 'object' ? body.params : {};

  if (action === 'search') {
    const keyword = String(params.keyword || params.query || '').trim().slice(0, 180);
    if (!keyword) return json(400, { error: 'missing_keyword', provider: 'everyinfra' });
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
    params = { keyword: keyword, limit: limit };
  }

  if (action === 'post' || action === 'comments') {
    const id = tweetIdOf(params.id || params.tweet_id || params.url || '');
    if (!id) return json(400, { error: 'missing_tweet', provider: 'everyinfra' });
    params = { id: id };
    if (action === 'comments') params.limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
  }

  if (action === 'user_posts' || action === 'profile') {
    const username = String(params.username || '').trim().replace(/^@/, '').slice(0, 60);
    if (!username) return json(400, { error: 'missing_username', provider: 'everyinfra' });
    params = { username: username };
    if (action === 'user_posts') params.limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
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
      body: JSON.stringify({ platform: 'twitter', action: action, params: params })
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

  if (action === 'search' || action === 'user_posts') {
    const rows = listFrom(data);
    const posts = rows.map(normalizePost).filter(Boolean).slice(0, 25);
    return json(200, {
      ok: true,
      provider: 'everyinfra',
      action: action,
      posts: posts,
      count: posts.length,
      next_page_token: String((rows[0] && rows[0].next_page_token) || (data && data.next_page_token) || '')
    });
  }

  if (action === 'comments') {
    const rows = listFrom(data);
    const comments = rows.map(normalizeComment).filter(Boolean).slice(0, 20);
    return json(200, {
      ok: true,
      provider: 'everyinfra',
      action: 'comments',
      comments: comments,
      count: comments.length,
      next_page_token: String((rows[0] && rows[0].next_page_token) || (data && data.next_page_token) || '')
    });
  }

  if (action === 'profile') {
    const row = objectFrom(data) || listFrom(data)[0] || null;
    const p = row && typeof row === 'object' ? {
      username: String(row.username || '').trim(),
      display_name: String(row.display_name || row.name || '').trim(),
      bio: String(row.bio || row.description || '').trim(),
      follower_count: row.follower_count == null ? null : Number(row.follower_count),
      following_count: row.following_count == null ? null : Number(row.following_count),
      post_count: row.post_count == null ? null : Number(row.post_count),
      is_verified: row.is_verified === true
    } : null;
    return json(200, { ok: true, provider: 'everyinfra', action: 'profile', profile: p });
  }

  const post = normalizePost(objectFrom(data) || listFrom(data)[0] || null);
  return json(200, { ok: true, provider: 'everyinfra', action: 'post', post: post });
}
