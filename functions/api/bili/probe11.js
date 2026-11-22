// 临时诊断：Google 翻译代理
const urls = [
  ['tr_search', 'https://api-bilibili-com.translate.goog/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9&_x_tr_sl=auto&_x_tr_tl=zh-CN&_x_tr_hl=zh-CN'],
  ['tr_view', 'https://api-bilibili-com.translate.goog/x/web-interface/view?bvid=BV1BZbSzZEGT&_x_tr_sl=auto&_x_tr_tl=zh-CN&_x_tr_hl=zh-CN'],
  ['tr_page', 'https://www-bilibili-com.translate.goog/video/BV1BZbSzZEGT?_x_tr_sl=auto&_x_tr_tl=zh-CN&_x_tr_hl=zh-CN']
];
async function go(name, u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' } });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { name, status: r.status, len: t.length, code: j && j.code, head: t.slice(0, 200) };
  } catch (e) { return { name, error: e.message }; }
}
export async function onRequestGet() {
  const out = await Promise.all(urls.map(([n, u]) => go(n, u)));
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
