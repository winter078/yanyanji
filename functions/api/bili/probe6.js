// 临时诊断：corsfix 原始 URL
const TARGET = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9';
export async function onRequestGet() {
  const out = [];
  const forms = [
    'https://proxy.corsfix.com/?' + TARGET,
    'https://proxy.corsfix.com/?url=' + TARGET,
    'https://proxy.corsfix.com/?' + encodeURIComponent(TARGET)
  ];
  for (const u of forms) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://momo-phone.pages.dev', 'Referer': 'https://momo-phone.pages.dev/' } });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      out.push({ u, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 120) });
    } catch (e) { out.push({ u, error: e.message }); }
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
