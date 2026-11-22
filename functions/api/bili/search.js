// /api/bili/search?kw=晴天
// 用 B 站公开搜索找歌曲投稿；只返回视频元信息，播放仍走 /api/bili/play + /api/bili/stream。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BILI_HEADERS = {
  'User-Agent': UA,
  'Referer': 'https://www.bilibili.com/',
  'Accept': 'application/json, text/plain, */*'
};

// Cloudflare 的出口 IP 会被 B站判 -412；直连失败时走一次公共中转。
const PROXY = 'https://api.cors.lol/?url=';

async function biliJson(url) {
  try {
    const r = await fetch(url, { headers: BILI_HEADERS });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    if (r.status === 200 && data && data.code === 0) return data;
  } catch (e) {}

  try {
    const r = await fetch(PROXY + encodeURIComponent(url));
    const text = await r.text();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function cleanText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function durationSeconds(text) {
  const m = /^(\d+):(\d{2})$/.exec(String(text || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const kw = (url.searchParams.get('kw') || '').trim();
  if (!kw) return json({ songs: [], error: 'empty_kw' }, 400);

  const api = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=' + encodeURIComponent(kw);

  let data = null;
  try {
    data = await biliJson(api);
  } catch (e) {
    return json({ songs: [], error: 'bili_unreachable', message: e.message });
  }

  if (!data || data.code !== 0) {
    return json({
      songs: [],
      error: 'bili_search_failed',
      code: (data && data.code) || 0,
      message: (data && data.message) || 'B站搜索没有返回可用结果'
    });
  }

  const list = (data.data && data.data.result) || [];
  const songs = [];
  for (const item of list) {
    if (!item || item.type !== 'video' || !item.bvid) continue;
    const sec = durationSeconds(item.duration);
    // 太短的切片、太长的合集都不像“一首歌”，先挡掉，避免点开是广告或合辑
    if (sec && (sec < 45 || sec > 1800)) continue;
    const cover = item.pic ? (String(item.pic).indexOf('//') === 0 ? 'https:' + item.pic : String(item.pic)) : '';
    songs.push({
      bvid: item.bvid,
      aid: Number(item.aid) || 0,
      title: cleanText(item.title) || 'B站视频',
      author: cleanText(item.author) || 'B站',
      cover,
      duration: sec,
      durationText: cleanText(item.duration),
      play: Number(item.play) || 0,
      pubdate: Number(item.pubdate) || 0
    });
    if (songs.length >= 10) break;
  }

  return json({ songs, keyword: kw });
}
