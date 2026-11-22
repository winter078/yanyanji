// 临时诊断：带本机取到的 buvid 指纹
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const COOKIE = 'buvid3=10048680-69F7-EFF0-898D-10E697AFE7C725924infoc; buvid4=43FA754B-18B4-5FCE-7AFD-C2E7FAA3F36F25924-026112302-v9DOjlfaCfHCJcC0LCy8pw==';
export async function onRequestGet() {
  const out = [];
  for (const withCookie of [true, false]) {
    const h = { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'zh-CN,zh;q=0.9' };
    if (withCookie) h.Cookie = COOKIE;
    try {
      const r = await fetch('https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9', { headers: h });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      out.push({ cookie: withCookie, status: r.status, len: t.length, code: j && j.code, message: j && j.message, head: t.slice(0, 120) });
    } catch (e) { out.push({ cookie: withCookie, error: e.message }); }
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
