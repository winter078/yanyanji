// 临时诊断：不带 Origin，带指纹，单发请求
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
async function fp() {
  try {
    const r = await fetch('https://api.bilibili.com/x/frontend/finger/spi', { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' } });
    const j = await r.json();
    return j && j.code === 0 ? 'buvid3=' + j.data.b_3 + '; buvid4=' + (j.data.b_4 || '') : '';
  } catch (e) { return ''; }
}
export async function onRequestGet() {
  const cookie = await fp();
  const h = { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'zh-CN,zh;q=0.9' };
  if (cookie) h.Cookie = cookie;
  const u = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9';
  try {
    const r = await fetch(u, { headers: h });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    return new Response(JSON.stringify({ fp: !!cookie, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 200) }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
}
