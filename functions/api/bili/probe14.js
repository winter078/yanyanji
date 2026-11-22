// 临时诊断：HTTP 和指定 IP
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
export async function onRequestGet() {
  const out = [];
  const u = 'http://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9';
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' } });
    const t = await r.text();
    out.push({ name: 'http', status: r.status, len: t.length, head: t.slice(0, 120) });
  } catch (e) { out.push({ name: 'http', error: e.message }); }
  for (const ip of ['36.158.237.15', '183.232.239.22', '120.240.224.20']) {
    try {
      const r = await fetch('https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9', { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' }, cf: { resolveOverride: ip } });
      const t = await r.text();
      out.push({ name: 'ip-' + ip, status: r.status, len: t.length, head: t.slice(0, 120) });
    } catch (e) { out.push({ name: 'ip-' + ip, error: e.message }); }
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
