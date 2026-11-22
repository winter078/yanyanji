// 临时诊断：试几个公共代理能不能取到 B站搜索 API
const TARGET = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9';
const PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://corsproxy.io/?url=',
  'https://api.cors.lol/?url='
];

async function tryOne(prefix) {
  const url = prefix + encodeURIComponent(TARGET);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { prefix, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 120) };
  } catch (e) {
    return { prefix, error: e.message };
  }
}

export async function onRequestGet() {
  const out = await Promise.all(PROXIES.map(tryOne));
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
