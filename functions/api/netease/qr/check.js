// /api/netease/qr/check?key=<unikey>
// 轮询扫码状态：
//   800 过期 / 801 等待扫码 / 802 已扫码待确认 / 803 登录成功（此时返回 cookie）
// 登录成功后把 cookie 交给前端存到本机 localStorage，之后请求音频时带回来。

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_COOKIE = 'appver=8.9.7; os=pc';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function readSetCookie(res) {
  let list = [];
  if (typeof res.headers.getSetCookie === 'function') {
    list = res.headers.getSetCookie();
  } else {
    const raw = res.headers.get('set-cookie') || '';
    list = raw ? [raw] : [];
  }
  return list
    .map((c) => String(c).split(';')[0].trim())
    .filter((c) => c && c.indexOf('=') > 0);
}

async function handle(context) {
  const url = new URL(context.request.url);
  const key = (url.searchParams.get('key') || '').trim();
  if (!key) return json({ error: 'no_key', message: '缺少 key' }, 400);

  try {
    const r = await fetch(
      'https://music.163.com/api/login/qrcode/client/login?key=' + encodeURIComponent(key) + '&type=1',
      {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Referer': 'https://music.163.com/',
          'Cookie': BASE_COOKIE
        }
      }
    );
    const text = await r.text();
    let d = null;
    try { d = JSON.parse(text); } catch (e) {}

    const code = d && d.code;
    let cookie = '';
    let nickname = '';

    if (code === 803) {
      const parts = readSetCookie(r);
      if (parts.length) {
        cookie = ('appver=8.9.7; os=pc; ' + parts.join('; ')).replace(/^appver=8\.9\.7; os=pc; appver=8\.9\.7; os=pc; /, 'appver=8.9.7; os=pc; ');
      }
      nickname = (d && (d.nickname || (d.account && d.account.userName))) || '';
    }

    return json({
      code: code || 0,
      message: (d && d.message) || '',
      cookie,
      nickname,
      raw: d,
      set_cookie_count: readSetCookie(r).length
    });
  } catch (e) {
    return json({ error: 'network', message: String((e && e.message) || e) }, 500);
  }
}

export const onRequestGet = handle;
export const onRequestPost = handle;
