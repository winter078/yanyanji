// 临时诊断：多试几个 CORS 代理
const TARGET = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9';
const PROXIES = [
  'https://thingproxy.freeboard.io/fetch/',
  'https://cors.eu.org/',
  'https://cors-anywhere.herokuapp.com/',
  'https://api.codetabs.com/v1/proxy/?quest=',
  'https://proxy.corsfix.com/?',
  'https://cors.isomorphic-git.org/',
  'https://yacdn.org/proxy/',
  'https://api.allorigins.win/raw?url=',
  'https://crossorigin.me/',
  'https://cors-proxy.htmldriven.com/?url='
];
async function one(p) {
  const u = p.includes('=') ? p + encodeURIComponent(TARGET) : p + TARGET;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { p, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 100) };
  } catch (e) { return { p, error: e.message }; }
}
export async function onRequestGet() {
  const out = await Promise.all(PROXIES.map(one));
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
