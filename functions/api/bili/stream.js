// /api/bili/stream?u=<B站真实 mp4 地址>
// 把 B 站 mp4 流转发给手机：
//   - 服务端带上 B 站要求的 Referer（页面自己请求会被 403）
//   - 透传 Range，手机才能拖动进度、断点续传
//   - 只允许 B 站自家域名，避免这个口子被拿去当通用代理

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ALLOWED_HOST = /\.(bilivideo\.com|bilivideo\.cn|mountaintoys\.cn|hdslb\.com|bilibili\.com|akamaized\.net)$/i;

function bad(status, message) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function handle(context) {
  const url = new URL(context.request.url);
  const raw = url.searchParams.get('u') || '';

  let target;
  try {
    target = new URL(raw);
  } catch (e) {
    return bad(400, 'bad url');
  }

  if (!/^https?:$/.test(target.protocol) || !ALLOWED_HOST.test(target.hostname)) {
    return bad(403, 'host not allowed');
  }

  const headers = {
    'User-Agent': UA,
    'Referer': 'https://www.bilibili.com/',
    'Origin': 'https://www.bilibili.com'
  };

  const range = context.request.headers.get('range');
  if (range) headers['Range'] = range;

  const upstream = await fetch(target.toString(), { headers });

  const out = new Headers();
  for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(key);
    if (value) out.set(key, value);
  }
  out.set('access-control-allow-origin', '*');
  out.set('cache-control', 'no-store');

  // HEAD 只回头部，不带 body（iOS 播放器会先探一次）
  if (context.request.method === 'HEAD') {
    return new Response(null, { status: upstream.status, headers: out });
  }

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export async function onRequestGet(context) {
  return handle(context);
}

export async function onRequestHead(context) {
  return handle(context);
}
