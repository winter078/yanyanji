// /api/music/lyric?id=网易云歌曲id
// 去向网易云要歌词（LRC 文本），顺便带上翻译歌词（如果有）。
// 歌词不需要登录态，也不需要音频地址，所以这里比 url.js 简单：
//   1) 主接口 song/lyric（lv=-1 拿原文，tv=-1 拿译文）
//   2) 兜底 lyric?id=（老接口）
// 前端拿到后自己解析时间轴，这里只负责把文本递过去。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=86400'
    }
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id || !/^\d+$/.test(id)) return json({ error: 'bad_id', message: '歌曲 id 不合法' }, 400);

  const headerCookie = (context.request.headers.get('x-netease-cookie') || '').trim();
  const envCookie = (context.env && context.env.NETEASE_COOKIE) || '';
  let cookie = headerCookie || envCookie;
  if (cookie.length > 4000) cookie = cookie.slice(0, 4000);
  if (cookie && !/appver=/.test(cookie)) cookie = 'appver=8.9.7; os=pc; ' + cookie;

  const headers = {
    'User-Agent': UA,
    'Referer': 'https://music.163.com/',
    'Cookie': cookie || 'appver=8.9.7; os=pc',
    'Accept': 'application/json, text/plain, */*'
  };

  // 接口一：song/lyric（新）
  try {
    const r = await fetch(
      'https://music.163.com/api/song/lyric?id=' + id + '&lv=-1&kv=-1&tv=-1',
      { headers }
    );
    if (r.ok) {
      const d = await r.json();
      const lrc = (d && d.lrc && d.lrc.lyric) || '';
      const tlrc = (d && d.tlyric && d.tlyric.lyric) || '';
      if (lrc && lrc.trim()) {
        return json({ ok: true, id, lyric: lrc, trans: tlrc, source: 'song/lyric' });
      }
    }
  } catch (e) {}

  // 接口二：lyric（老）
  try {
    const r2 = await fetch('https://music.163.com/api/lyric?id=' + id + '&lv=-1&kv=-1&tv=-1', { headers });
    if (r2.ok) {
      const d2 = await r2.json();
      const lrc2 = (d2 && d2.lrc && d2.lrc.lyric) || '';
      const tlrc2 = (d2 && d2.tlyric && d2.tlyric.lyric) || '';
      if (lrc2 && lrc2.trim()) {
        return json({ ok: true, id, lyric: lrc2, trans: tlrc2, source: 'lyric' });
      }
    }
  } catch (e) {}

  // 没有歌词是常态（纯音乐、版权限制），不当成错误
  return json({ ok: false, id, lyric: '', trans: '', message: '这首歌没有歌词' });
}
