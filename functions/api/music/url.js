// /api/music/url?id=网易云歌曲id
// 去向网易云要真实音频地址：
//   1) 免费歌曲：多数情况下不需要登录态也能拿到（实测 Cloudflare 出口可用）
//   2) 会员/版权歌：需要 Cloudflare 环境变量 NETEASE_COOKIE 里放你自己的登录态
// 地址带有效期，所以每次播放都重新取，不缓存。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

// http:// 的音频在 https 页面里会被隐私内容拦截，统一转成 https
function toHttps(u) {
  return String(u || '').replace(/^http:/, 'https:');
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id || !/^\d+$/.test(id)) return json({ error: 'bad_id', message: '歌曲 id 不合法' }, 400);

  const cookie = (context.env && context.env.NETEASE_COOKIE) || '';
  const hasLogin = !!cookie;

  const headers = {
    'User-Agent': UA,
    'Referer': 'https://music.163.com/',
    'Cookie': hasLogin ? cookie : 'appver=8.9.7; os=pc',
    'Accept': 'application/json, text/plain, */*'
  };

  // 接口一：player/url
  try {
    const r = await fetch('https://music.163.com/api/song/enhance/player/url?ids=[' + id + ']&br=320000', { headers });
    const text = await r.text();
    if (r.ok) {
      let d = null;
      try { d = JSON.parse(text); } catch (e) {}
      const item = d && d.data && d.data[0];
      if (item && item.url) {
        return json({
          url: toHttps(item.url),
          br: item.br || 0,
          type: item.type || '',
          login: hasLogin,
          code: item.code
        });
      }
    }
  } catch (e) {}

  // 接口二：player/url/v1
  try {
    const r2 = await fetch('https://music.163.com/api/song/enhance/player/url/v1?ids=[' + id + ']&level=standard&encodeType=aac', { headers });
    const text2 = await r2.text();
    if (r2.ok) {
      let d2 = null;
      try { d2 = JSON.parse(text2); } catch (e) {}
      const item2 = d2 && d2.data && d2.data[0];
      if (item2 && item2.url) {
        return json({
          url: toHttps(item2.url),
          br: item2.br || 0,
          type: item2.type || '',
          login: hasLogin,
          code: item2.code
        });
      }
      return json({
        error: 'no_audio',
        message: hasLogin
          ? '这首没有可播地址（可能无版权或需要会员）'
          : '这首需要网易云登录态才能取到音频（NETEASE_COOKIE 还没配）',
        needs_login: !hasLogin,
        code: (item2 && item2.code) || 0,
        fee: (item2 && item2.fee) || 0
      });
    }
  } catch (e) {}

  return json({ error: 'upstream_failed', message: '网易云接口没有返回可用地址' }, 502);
}
