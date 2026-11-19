// /api/music/search?kw=关键词
// 由 Cloudflare Pages Functions 在服务端请求网易云搜索接口，前端不直接跨域。
// 用的是 /api/cloudsearch/pc：实测在 Cloudflare 侧返回明文 JSON（还自带封面）。
// 搜索不需要登录态；fee=1 表示需要会员。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const kw = (url.searchParams.get('kw') || '').trim();
  if (!kw) return json({ error: 'empty_query', songs: [] }, 400);

  const upstream = 'https://music.163.com/api/cloudsearch/pc?s=' + encodeURIComponent(kw) + '&type=1&offset=0&limit=8';

  try {
    const resp = await fetch(upstream, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://music.163.com/',
        'Cookie': 'appver=8.9.7; os=pc',
        'Accept': 'application/json, text/plain, */*'
      }
    });
    if (!resp.ok) return json({ error: 'upstream_' + resp.status, songs: [] }, 502);

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return json({ error: 'not_json', songs: [] }, 502);
    }

    const raw = (data && data.result && data.result.songs) || [];
    const songs = raw.map(it => ({
      id: String(it.id),
      name: it.name || '',
      artist: ((it.ar || []).map(a => a.name).join('/')) || '',
      album: (it.al && it.al.name) || '',
      cover: (it.al && (it.al.picUrl || it.al.img1v1Url)) || '',
      duration: it.dt || 0,
      fee: it.fee
    }));

    return json({ songs });
  } catch (e) {
    return json({ error: 'fetch_failed', message: String((e && e.message) || e), songs: [] }, 502);
  }
}
