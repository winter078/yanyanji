// /api/bili/search?kw=晴天
// 用 B 站公开搜索找歌曲投稿；只返回视频元信息，播放仍走 /api/bili/play + /api/bili/stream。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BILI_HEADERS = {
  'User-Agent': UA,
  'Referer': 'https://www.bilibili.com/',
  'Origin': 'https://www.bilibili.com',
  'Accept': 'application/json, text/plain, */*'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

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

  const fp = await ensureCookie();
  const headers = Object.assign({}, BILI_HEADERS);
  if (fp) headers['Cookie'] = fp;

  const api = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=' + encodeURIComponent(kw);

  let data = null;
  try {
    const r = await fetch(api, { headers });
    data = await r.json();
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
