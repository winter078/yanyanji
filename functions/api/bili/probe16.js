// 临时诊断：不同 UA
const UAS = [
  ['chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'],
  ['iphone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'],
  ['bilidroid', 'Mozilla/5.0 BiliDroid/7.38.0 (bbcallen@gmail.com) os/3.4.0;'],
  ['android', 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'],
  ['empty', '']
];
export async function onRequestGet() {
  const out = [];
  for (const [name, ua] of UAS) {
    const h = { 'Referer': 'https://www.bilibili.com/', 'Accept': 'application/json, text/plain, */*' };
    if (ua) h['User-Agent'] = ua;
    try {
      const r = await fetch('https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=%E6%99%B4%E5%A4%A9', { headers: h });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      out.push({ name, status: r.status, len: t.length, code: j && j.code, message: j && j.message });
    } catch (e) { out.push({ name, error: e.message }); }
    await new Promise(r => setTimeout(r, 500));
  }
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
