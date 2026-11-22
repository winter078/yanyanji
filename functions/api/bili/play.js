// /api/bili/play?bvid=BV...&cid=...
// 去向 B 站要一个能直接播的 mp4 地址。
// 为什么不能让浏览器直接要：
//   1) api.bilibili.com 没有 Access-Control-Allow-Origin，浏览器 fetch 一律失败
//   2) B 站 mp4 直链认 Referer，页面自己的域名会被 403
// 所以这一步必须在服务端做（这里就是 Cloudflare Pages Functions），
// 并且返回的播放地址指向 /api/bili/stream（同源转发，手机才播得动）。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BILI_HEADERS = {
  'User-Agent': UA,
  'Referer': 'https://www.bilibili.com/',
  'Accept': 'application/json, text/plain, */*'
};

// Cloudflare 的出口 IP 会被 B站判 -412；直连失败时走一次公共中转。
const PROXY = 'https://api.cors.lol/?url=';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

// B 站对匿名请求要做指纹校验，缺 buvid3 会被判 "request was banned"。
// 先取一次指纹，30 分钟内复用（Worker 实例内缓存）。
let cachedCookie = '';
let cookieExpireAt = 0;

async function ensureCookie() {
  if (cachedCookie && Date.now() < cookieExpireAt) return cachedCookie;
  try {
    const r = await fetch('https://api.bilibili.com/x/frontend/finger/spi', { headers: BILI_HEADERS });
    const j = await r.json();
    if (j && j.code === 0 && j.data && j.data.b_3) {
      cachedCookie = 'buvid3=' + j.data.b_3 + '; buvid4=' + (j.data.b_4 || '');
      cookieExpireAt = Date.now() + 30 * 60 * 1000;
      return cachedCookie;
    }
  } catch (e) {}
  return '';
}

async function biliApi(url, cookie) {
  const headers = Object.assign({}, BILI_HEADERS);
  if (cookie) headers['Cookie'] = cookie;
  try {
    const r = await fetch(url, { headers });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    if (r.ok && data && data.code === 0) return { ok: true, status: r.status, data };
  } catch (e) {}

  // 直连被风控时，换公共中转再要一次。
  try {
    const r = await fetch(PROXY + encodeURIComponent(url));
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.message };
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const bvid = (url.searchParams.get('bvid') || '').trim();
  let cid = (url.searchParams.get('cid') || '').trim();
  const aid = (url.searchParams.get('aid') || '').trim();

  if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) {
    return json({ error: 'bad_bvid', message: 'BV 号格式不对' }, 400);
  }

  // 0. 指纹（B站匿名请求的风控门槛）
  const fp = await ensureCookie();
  const loginCookie = ((context.env && context.env.BILI_COOKIE) || '').trim();
  const cookie = loginCookie
    ? (fp ? fp + '; ' + loginCookie : loginCookie)
    : fp;

  // 1. 有 cid 就直接要流；没有 cid 先试轻量的 pagelist（比 view 少风控），
  //    最后才回退到 view 取完整元信息。
  let meta = null;
  if (!cid && aid) {
    const pages = await biliApi('https://api.bilibili.com/x/player/pagelist?aid=' + encodeURIComponent(aid), cookie);
    const first = pages.data && pages.data.code === 0 && pages.data.data && pages.data.data[0];
    if (first && first.cid) cid = String(first.cid);
  }
  if (!cid) {
    const view = await biliApi('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, cookie);
    meta = view.data && view.data.code === 0 ? view.data.data : null;

    if (!meta) {
      const code = (view.data && view.data.code) || 0;
      const message = (view.data && view.data.message) || 'B站接口没有返回可用信息';
      return json({
        error: 'bili_unavailable',
        code,
        message,
        // 稿件被删/私密/限外链时，前端应该回退到官方内嵌播放器
        unavailable: code === 62002 || code === -404 || code === 404
      });
    }

    cid = String(meta.cid || '');
  }
  if (!cid) return json({ error: 'no_cid', message: '这个视频拿不到 cid' });

  // 2. 要播放地址。匿名最高一般 720P，登录态（环境变量 BILI_COOKIE）可以更高
  const qualityOrder = loginCookie ? [80, 74, 64, 32, 16] : [64, 32, 16];
  let picked = null;

  for (const qn of qualityOrder) {
    const p = await biliApi(
      'https://api.bilibili.com/x/player/playurl?bvid=' + bvid +
      '&cid=' + cid + '&qn=' + qn + '&fnval=0&fnver=0&fourk=1',
      cookie
    );
    const d = p.data && p.data.code === 0 ? p.data.data : null;
    const durl = d && d.durl && d.durl[0];
    if (durl && durl.url) {
      picked = {
        direct: durl.url,
        quality: d.quality || qn,
        accept: d.accept_quality || [],
        durationMs: d.timelength || 0,
        size: durl.size || 0
      };
      break;
    }
  }

  if (!picked) {
    return json({
      error: 'no_stream',
      message: '这个视频没有可播的流（可能需要登录，或 UP 主限制了外链）',
      unavailable: true
    });
  }

  return json({
    // 手机播这个地址：同源、带 Referer 转发、支持拖动
    url: '/api/bili/stream?u=' + encodeURIComponent(picked.direct),
    quality: picked.quality,
    accept: picked.accept,
    durationSeconds: Math.round(picked.durationMs / 1000),
    sizeBytes: picked.size,
    title: (meta && meta.title) || '',
    author: (meta && meta.owner && meta.owner.name) || '',
    cid: cid,
    login: !!cookie
  });
}
