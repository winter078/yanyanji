const NOTE_HOSTS = new Set(['www.xiaohongshu.com', 'xiaohongshu.com', 'xhslink.com', 'www.xhslink.com']);
const XHS_HEADERS = {
  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9'
};
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};
const DIGEST_API = 'https://linkdigest.dev/api/v1/digest';
const DIGEST_TIMEOUT_MS = 30000;
const DIGEST_MAX_POLLS = 4;

function json(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function decodeJsonString(raw) {
  try {
    return JSON.parse('"' + raw + '"');
  } catch (e) {
    return raw;
  }
}

function grabString(source, key) {
  const re = new RegExp('"' + key + '":"((?:[^"\\\\]|\\\\.)*)"');
  const match = source.match(re);
  return match ? decodeJsonString(match[1]).trim() : '';
}

function grabImages(source) {
  const urls = [];
  const re = /"url":"((?:[^"\\]|\\.)*!h5_1080jpg)"/g;
  let match;
  while ((match = re.exec(source)) && urls.length < 12) {
    const url = decodeJsonString(match[1]);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function grabObjectAfter(source, key) {
  const marker = '"' + key + '":';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return '';
  const start = source.indexOf('{', markerIndex + marker.length);
  if (start < 0) return '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return '';
}

function parseComments(source) {
  const raw = grabObjectAfter(source, 'commentData');
  if (!raw) return { comments: [], commentCount: 0 };
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    try {
      data = JSON.parse(raw.replace(/\bundefined\b/g, 'null'));
    } catch (e2) {
      return { comments: [], commentCount: 0 };
    }
  }
  const comments = [];
  for (const item of (data.comments || []).slice(0, 20)) {
    if (!item || !item.content) continue;
    const replies = [];
    for (const sub of (item.subComments || []).slice(0, 3)) {
      if (!sub || !sub.content) continue;
      replies.push({
        author: String((sub.user && sub.user.nickname) || '').slice(0, 80),
        content: String(sub.content).slice(0, 600)
      });
    }
    comments.push({
      author: String((item.user && item.user.nickname) || '').slice(0, 80),
      content: String(item.content).slice(0, 800),
      likes: Number(item.likeCount || item.likeViewCount || 0) || 0,
      replies
    });
  }
  return {
    comments,
    commentCount: Number(data.commentCount || comments.length) || comments.length
  };
}

export function parseNote(html) {
  const marker = html.indexOf('__INITIAL_STATE__=');
  const source = marker >= 0 ? html.slice(marker) : html;
  const title = grabString(source, 'title');
  const desc = grabString(source, 'desc');
  const author = grabString(source, 'nickName') || grabString(source, 'nickname');
  const images = grabImages(source);
  const commentData = parseComments(source);
  if (!title && !desc) return null;
  return {
    title: title.slice(0, 300),
    author: author.slice(0, 120),
    desc: desc.slice(0, 5000),
    images,
    comments: commentData.comments,
    commentCount: commentData.commentCount
  };
}

function isAllowedUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && NOTE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch (e) {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || DIGEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonSafe(resp) {
  const text = await resp.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return { raw: text.slice(0, 200) };
  }
}

function providerFailure(status, payload) {
  const message = String(
    (payload && (payload.offer_zh || payload.message || payload.error || payload.detail)) || ''
  ).slice(0, 300);
  const error = new Error(message || 'provider_error');
  error.status = status;
  error.payload = payload || {};
  return error;
}

async function digestWithProvider(url, apiKey) {
  const headers = {
    Authorization: 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
    accept: 'application/json'
  };
  let resp = await fetchWithTimeout(DIGEST_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, format: 'json' })
  }, DIGEST_TIMEOUT_MS);
  let data = await readJsonSafe(resp);

  if (resp.status === 202 && data && data.jobId) {
    for (let attempt = 0; attempt < DIGEST_MAX_POLLS; attempt++) {
      await sleep(1200);
      resp = await fetchWithTimeout(
        DIGEST_API + '/' + encodeURIComponent(data.jobId) + '?format=json&wait=20',
        { method: 'GET', headers },
        DIGEST_TIMEOUT_MS
      );
      data = await readJsonSafe(resp);
      if (resp.status !== 202) break;
    }
  }

  if (resp.status === 202) throw providerFailure(504, { error: 'provider_timeout' });
  if (!resp.ok) throw providerFailure(resp.status, data);
  if (!data || typeof data !== 'object') throw providerFailure(502, { error: 'empty_provider_response' });
  return data;
}

function normalizeProviderNote(data, url) {
  const title = String(data.title || '').trim().slice(0, 300);
  const author = String(data.author || '').trim().slice(0, 120);
  const desc = String(data.caption || data.desc || '').trim().slice(0, 5000);
  const rawImages = Array.isArray(data.images) ? data.images : [];
  const imageUrls = rawImages
    .map((img) => String((img && (img.url || img.urlDefault || img.url_default)) || '').trim())
    .filter(Boolean)
    .slice(0, 12);
  const imageTexts = rawImages
    .map((img, index) => {
      const text = String((img && (img.ocr || img.text)) || '').trim();
      return text ? { index: index + 1, text: text.slice(0, 1200) } : null;
    })
    .filter(Boolean)
    .slice(0, 20);
  const comments = (Array.isArray(data.comments) ? data.comments : [])
    .map((comment) => {
      const content = String((comment && (comment.text || comment.content)) || '').trim();
      if (!content) return null;
      const replyTexts = Array.isArray(comment.reply_texts) ? comment.reply_texts : [];
      const replies = replyTexts
        .map((text) => String(text || '').trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((text) => ({ author: '', content: text.slice(0, 600) }));
      return {
        author: String((comment && (comment.author || comment.nickname)) || '').slice(0, 80),
        content: content.slice(0, 800),
        likes: Number(comment && comment.likes) || 0,
        replies
      };
    })
    .filter(Boolean)
    .slice(0, 20);
  const rawCount = data && data.stats ? data.stats.comments : null;
  const commentCount = Number(rawCount != null ? rawCount : (data.commentCount || comments.length)) || comments.length;

  return {
    ok: true,
    source: 'linkdigest',
    url,
    title,
    author,
    desc,
    images: imageUrls,
    imageCount: Number(data.image_count || rawImages.length || 0) || 0,
    imageTexts,
    comments,
    commentCount,
    credits: Number(data.credits || 0) || 0,
    cached: Boolean(data.cached)
  };
}

export async function handleXhs(context) {
  const { request } = context;
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { error: 'bad_json' });
  }
  const url = String(body.url || '').trim();
  if (!url || url.length > 1200 || !isAllowedUrl(url)) return json(400, { error: 'bad_url' });

  // Key 由每个用户自己填写，云端不使用共享 Key。
  const apiKey = String(body.api_key || request.headers.get('x-api-key') || '').trim();
  if (!apiKey) return json(503, { error: 'missing_xhs_key', requires_user_key: true, provider: 'linkdigest' });
  if (apiKey.length < 12) return json(400, { error: 'bad_key' });

  let data;
  try {
    data = await digestWithProvider(url, apiKey);
  } catch (err) {
    const status = Number(err && err.status) || 502;
    const payload = (err && err.payload) || {};
    if (status === 401 || status === 403) return json(401, { error: 'invalid_key', provider: 'linkdigest' });
    if (status === 402) {
      return json(402, {
        error: 'insufficient_balance',
        provider: 'linkdigest',
        offer_zh: String(payload.offer_zh || '').slice(0, 300),
        buy_url: String(payload.buy_url || '').slice(0, 500)
      });
    }
    if (status === 422) return json(422, { error: 'note_unreadable', provider: 'linkdigest' });
    if (status === 429) return json(429, { error: 'rate_limited', provider: 'linkdigest' });
    if (/^provider_timeout|aborted|AbortError/i.test(String(err && err.message))) {
      return json(504, { error: 'provider_timeout', provider: 'linkdigest' });
    }
    return json(502, {
      error: 'provider_error',
      provider: 'linkdigest',
      detail: String((err && err.message) || 'unknown').slice(0, 180)
    });
  }

  return json(200, normalizeProviderNote(data, url));
}

export async function handleXhsOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization, x-api-key',
      'access-control-allow-methods': 'POST, OPTIONS'
    }
  });
}
