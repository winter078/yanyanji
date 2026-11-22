// /api/music/song?ids=123,456
// 批量取网易云歌曲详情：曲库被旧版本截断后，用红心里留下的 ne-<id> 把歌补回来。
// 只补元信息，不取播放地址，不会自动播放。

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
  const raw = (url.searchParams.get('ids') || '').trim();
  if (!raw) return json({ error: 'empty_ids', songs: [] }, 400);

  const ids = raw.split(',')
    .map(s => s.trim())
    .filter(s => /^\d+$/.test(s))
    .slice(0, 50);
  if (!ids.length) return json({ error: 'bad_ids', songs: [] }, 400);

  const upstream = 'https://music.163.com/api/song/detail?ids=[' + ids.join(',') + ']';

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

    const rawSongs = (data && data.songs) || [];
    const songs = rawSongs.map(it => ({
      id: String(it.id),
      name: it.name || '',
      artist: ((it.ar || it.artists || []).map(a => a.name).filter(Boolean).join('/')) || '',
      album: ((it.al && it.al.name) || (it.album && it.album.name) || ''),
      cover: String(
        (it.al && (it.al.picUrl || it.al.img1v1Url))
        || (it.album && (it.album.picUrl || it.album.blurPicUrl))
        || ''
      ).replace(/^http:/, 'https:'),
      duration: it.dt || it.duration || 0,
      fee: it.fee
    }));

    return json({ songs });
  } catch (e) {
    return json({ error: 'fetch_failed', message: String((e && e.message) || e), songs: [] }, 502);
  }
}
