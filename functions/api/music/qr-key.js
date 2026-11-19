// /api/netease/qr/key
// 生成网易云扫码登录的 unikey，前端拿它画二维码。
// 二维码里编码的是 https://music.163.com/login?codekey=<unikey>，用网易云 App 扫码即可。

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

async function handle() {
  try {
    const r = await fetch('https://music.163.com/api/login/qrcode/unikey?type=1', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Referer': 'https://music.163.com/',
        'Cookie': BASE_COOKIE
      }
    });
    const d = await r.json().catch(() => null);
    if (!d || d.code !== 200 || !d.unikey) {
      return json({ error: 'unikey_failed', message: '网易云没有返回 unikey', raw: d }, 502);
    }
    return json({
      unikey: d.unikey,
      payload: 'https://music.163.com/login?codekey=' + d.unikey
    });
  } catch (e) {
    return json({ error: 'network', message: String((e && e.message) || e) }, 500);
  }
}

export const onRequestGet = handle;
export const onRequestPost = handle;
