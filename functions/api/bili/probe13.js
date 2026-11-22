// 临时诊断：oanor / xiaoapi 免费尝试
const urls = [
  ['oanor_search', 'https://api.oanor.com/bilibili-api/v1/search?keyword=%E6%99%B4%E5%A4%A9&page=1'],
  ['oanor_search_kw', 'https://api.oanor.com/bilibili-api/v1/search?kw=%E6%99%B4%E5%A4%A9'],
  ['oanor_video', 'https://api.oanor.com/bilibili-api/v1/video?bvid=BV1BZbSzZEGT'],
  ['xiao_search', 'https://xiaoapi.cn/v1/bilibili_video_api.php?bv=BV1BZbSzZEGT']
];
async function go(name, u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { name, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 200) };
  } catch (e) { return { name, error: e.message }; }
}
export async function onRequestGet() {
  const out = await Promise.all(urls.map(([n, u]) => go(n, u)));
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
