// 临时诊断：cors.lol 其他入口
const T = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9';
const P = ['https://cors.lol/?url=', 'https://www.cors.lol/?url=', 'https://api.cors.lol/?url=', 'https://proxy.cors.lol/?url='];
export async function onRequestGet() {
  const out = [];
  for (const p of P) {
    try {
      const r = await fetch(p + encodeURIComponent(T), { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      out.push({ p, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 80) });
    } catch (e) { out.push({ p, error: e.message }); }
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
