// 临时诊断：BiliRoaming 公共解析服务器
const HOSTS = ['https://bili.takami.ink', 'https://bili.tuturu.top', 'https://atri.ink', 'https://bili.ayaka.ink', 'https://api.bilibili.sb', 'https://bili.baba.plus', 'https://bili.api.acfun.win', 'https://bilibili.lianju.ren'];
const PATH = '/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9';
export async function onRequestGet() {
  const out = [];
  for (const h of HOSTS) {
    try {
      const r = await fetch(h + PATH, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      out.push({ h, status: r.status, len: t.length, code: j && j.code, head: t.slice(0, 100) });
    } catch (e) { out.push({ h, error: e.message }); }
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
