// 小红书主页轻量信息：只取昵称，拿到就够卡片用；拿不到就返回空，不影响绑定。
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function cleanTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1]
    .replace(/\s*-\s*小红书\s*$/i, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

export async function onRequestGet(context) {
  const target = String(new URL(context.request.url).searchParams.get('url') || '').trim();
  let parsed = null;
  try { parsed = new URL(target); } catch (e) { return json(400, { error: 'bad_url' }); }
  if (!/^(www\.)?xiaohongshu\.com$/i.test(parsed.hostname) || !/\/user\/profile\/[0-9a-f]{20,26}/i.test(parsed.pathname)) {
    return json(400, { error: 'bad_url' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(parsed.toString(), {
      headers: { 'user-agent': UA, 'accept': 'text/html,application/xhtml+xml', 'accept-language': 'zh-CN,zh;q=0.9' },
      redirect: 'follow',
      signal: controller.signal
    });
    const html = await resp.text();
    let nickname = cleanTitle(html);
    if (!nickname) {
      const m = html.match(/"nickname"\s*:\s*"([^"]{1,40})"/);
      if (m) nickname = m[1].replace(/\\u[0-9a-f]{4}/gi, '').trim();
    }
    return json(200, { ok: !!nickname, reachable: resp.ok, status: resp.status, nickname });
  } catch (e) {
    return json(200, { ok: false, reachable: false, status: 0, nickname: '' });
  } finally {
    clearTimeout(timer);
  }
}
