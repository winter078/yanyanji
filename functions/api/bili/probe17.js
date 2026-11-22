// 临时诊断：Bing 搜 B站视频
const u = 'https://www.bing.com/search?q=' + encodeURIComponent('site:bilibili.com/video 晴天') + '&count=20&setlang=zh-CN';
export async function onRequestGet() {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept-Language': 'zh-CN,zh;q=0.9' } });
    const t = await r.text();
    const hits = [...t.matchAll(/https:\/\/www\.bilibili\.com\/video\/(BV[0-9A-Za-z]+)/g)].map(m => m[1]);
    const uniq = [...new Set(hits)];
    return new Response(JSON.stringify({ status: r.status, len: t.length, count: uniq.length, bvids: uniq.slice(0, 10), head: t.slice(0, 100) }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
}
