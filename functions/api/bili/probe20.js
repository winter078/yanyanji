// 临时诊断：atri.ink 带 cookie
const C = 'buvid3=10048680-69F7-EFF0-898D-10E697AFE7C725924infoc; buvid4=43FA754B-18B4-5FCE-7AFD-C2E7FAA3F36F25924-026112302-v9DOjlfaCfHCJcC0LCy8pw==';
const urls = [
  ['search', 'https://atri.ink/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9'],
  ['view', 'https://atri.ink/x/web-interface/view?bvid=BV1BZbSzZEGT'],
  ['pages', 'https://atri.ink/x/player/pagelist?bvid=BV1BZbSzZEGT']
];
export async function onRequestGet() {
  const out = [];
  for (const [n, u] of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': C, 'Referer': 'https://www.bilibili.com/' } });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      out.push({ n, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 100) });
    } catch (e) { out.push({ n, error: e.message }); }
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
