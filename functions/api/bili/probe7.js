// 临时诊断：jina reader 拉 B站搜索
const TARGET = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9';
export async function onRequestGet() {
  const forms = [
    'https://r.jina.ai/' + TARGET,
    'https://r.jina.ai/http://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9'
    ];
  const out = [];
  for (const u of forms) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      out.push({ u, status: r.status, len: t.length, code: j && j.code, head: t.slice(0, 200) });
    } catch (e) { out.push({ u, error: e.message }); }
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
