// 临时诊断：看 Cloudflare 出站能不能拿到 B站网页 HTML
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', 'Accept': 'text/html,application/xhtml+xml' };

async function probe(url) {
  try {
    const r = await fetch(url, { headers: H });
    const t = await r.text();
    return { url, status: r.status, len: t.length, head: t.slice(0, 200), hasCid: /"cid":(\d+)/.test(t), cid: (t.match(/"cid":(\d+)/) || [])[1] || '' };
  } catch (e) {
    return { url, error: e.message };
  }
}

export async function onRequestGet() {
  const out = await Promise.all([
    probe('https://www.bilibili.com/video/BV1BZbSzZEGT/'),
    probe('https://search.bilibili.com/all?keyword=%E6%99%B4%E5%A4%A9')
  ]);
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
