// 临时诊断：换 B站域名/旧接口
const urls = [
  ['app_type', 'https://app.bilibili.com/x/v2/search/type?search_type=video&keyword=%E6%99%B4%E5%A4%A9&pn=1&ps=20'],
  ['app_search', 'https://app.bilibili.com/x/v2/search?keyword=%E6%99%B4%E5%A4%A9&pn=1&ps=20'],
  ['api_v2_type', 'https://api.bilibili.com/x/v2/search/type?search_type=video&keyword=%E6%99%B4%E5%A4%A9&pn=1&ps=20'],
  ['api_all', 'https://api.bilibili.com/x/web-interface/search/all/v2?keyword=%E6%99%B4%E5%A4%A9'],
  ['m_view', 'https://m.bilibili.com/video/BV1BZbSzZEGT'],
  ['api_view', 'https://api.bilibili.com/x/web-interface/view?bvid=BV1BZbSzZEGT']
];
async function go(name, u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36', 'Referer': 'https://www.bilibili.com/' } });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { name, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 100) };
  } catch (e) { return { name, error: e.message }; }
}
export async function onRequestGet() {
  const out = await Promise.all(urls.map(([n, u]) => go(n, u)));
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
