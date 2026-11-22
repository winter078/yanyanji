// 轻量探针：不做正文解析、不需要用户 Key，只判断这条小红书笔记现在还能不能看。
// 用于“角色主动分享笔记”前筛掉已删除/仅自己可见的旧链接。
const NOTE_HOSTS = new Set(['www.xiaohongshu.com', 'xiaohongshu.com', 'xhslink.com', 'www.xhslink.com']);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function allowed(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return NOTE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch (e) {
    return false;
  }
}

export async function onRequestGet(context) {
  const target = String(new URL(context.request.url).searchParams.get('url') || '').trim();
  if (!target || target.length > 1200 || !allowed(target)) return json(400, { error: 'bad_url' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(target, {
      headers: { 'user-agent': UA, 'accept': 'text/html,application/xhtml+xml', 'accept-language': 'zh-CN,zh;q=0.9' },
      redirect: 'follow',
      signal: controller.signal
    });
    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    const gone = /因权限|已被删除|无法查看|笔记不存在|内容不存在|not found|页面不存在/i.test(html);
    return json(200, { ok: !gone, reachable: resp.ok, status: resp.status, title });
  } catch (e) {
    // 抓不到不代表笔记没了（可能被反爬挡），交给调用方按“未知”处理
    return json(200, { ok: null, reachable: false, status: 0, title: '' });
  } finally {
    clearTimeout(timer);
  }
}
