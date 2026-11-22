// 临时诊断：用 cors.lol 代理取 view / pagelist / playurl
const P = 'https://api.cors.lol/?url=';
const H = { 'User-Agent': 'Mozilla/5.0' };
const urls = {
  view: 'https://api.bilibili.com/x/web-interface/view?bvid=BV1BZbSzZEGT',
  pages: 'https://api.bilibili.com/x/player/pagelist?aid=114912554719208',
  play: 'https://api.bilibili.com/x/player/playurl?bvid=BV1BZbSzZEGT&cid=31268997329&qn=64&fnval=0&fnver=0&fourk=1'
};
async function go(name, target) {
  try {
    const r = await fetch(P + encodeURIComponent(target), { headers: H });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    return { name, status: r.status, len: t.length, code: j && j.code, message: j && j.message, cid: j && j.data && j.data.cid, durl: !!(j && j.data && j.data.durl && j.data.durl[0]), head: t.slice(0, 100) };
  } catch (e) { return { name, error: e.message }; }
}
export async function onRequestGet() {
  const out = [];
  for (const [k, v] of Object.entries(urls)) out.push(await go(k, v));
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
