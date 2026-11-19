// /api/music/search?kw=关键词
// 由 Cloudflare Pages Functions 在服务端请求网易云音乐搜索接口，前端不直接跨域访问。
// 搜索不需要登录态；返回歌名/歌手/封面/时长/fee（fee=1 表示需要会员）。

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

async function netease(path, cookie) {
  const resp = await fetch('https://music.163.com' + path, {
    headers: {
      'User-Agent': UA,
      'Referer': 'https://music.163.com/',
      'Cookie': cookie || 'appver=8.9.7; os=pc',
      'Accept': 'application/json, text/plain, */*'
    }
  });
  if (!resp.ok) throw new Error('upstream_' + resp.status);
  return await resp.json();
}

export async function onRequestGet(context) {
  const kw = (new URL(context.request.url).searchParams.get('kw') || '').trim();
  if (!kw) return json({ error: 'empty_query', songs: [] }, 400);

  try {
    const data = await netease('/api/search/get/web?s=' + encodeURIComponent(kw) + '&type=1&offset=0&total=true&limit=8');
    const raw = (data && data.result && data.result.songs) || [];
    if (raw.length === 0) return json({ songs: [] });

    const ids = raw.map(it => it.id).filter(Boolean).slice(0, 8);

    // 搜索接口不返回封面，再用详情接口批量补一次（缺了也不影响搜索）
    let detailMap = {};
    try {
      const detail = await netease('/api/song/detail?ids=[' + ids.join(',') + ']');
      const list = (detail && detail.songs) || [];
      list.forEach(s => {
        detailMap[s.id] = {
          cover: (s.album && s.album.picUrl) || '',
          fee: s.fee,
          duration: s.duration || s.dt || 0
        };
      });
    } catch (e) {}

    const songs = raw.map(it => {
      const d = detailMap[it.id] || {};
      return {
        id: String(it.id),
        name: it.name,
        artist: ((it.artists || []).map(a => a.name).join('/')) || '',
        album: (it.album && it.album.name) || '',
        cover: d.cover || '',
        duration: d.duration || it.duration || 0,
        fee: (d.fee !== undefined ? d.fee : it.fee)
      };
    });

    return json({ songs });
  } catch (e) {
    return json({ error: 'fetch_failed', message: String((e && e.message) || e), songs: [] }, 502);
  }
}
