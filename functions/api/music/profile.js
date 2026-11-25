// /api/music/profile
// 用前端带上来的网易云登录态读取真实账号资料，判断当前是否是黑胶 VIP。
// 只返回昵称、头像、VIP 状态，不返回 cookie，也不缓存。
// 登录态失效时返回 loggedIn:false，由前端显示灰色 VIP。

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

function normalizeCookie(raw) {
  let cookie = String(raw || '').trim();
  if (cookie.length > 4000) cookie = cookie.slice(0, 4000);
  if (cookie && !/appver=/.test(cookie)) cookie = 'appver=8.9.7; os=pc; ' + cookie;
  return cookie;
}

function isActiveRight(right) {
  if (!right || typeof right !== 'object') return false;
  const code = Number(right.vipCode || right.vipType || 0);
  const expire = Number(right.expireTime || right.expire || 0);
  if (code <= 0) return false;
  if (expire > 0 && expire < Date.now()) return false;
  return true;
}

function readVip(account, profile) {
  const vipType = Number((profile && profile.vipType) || (account && account.vipType) || 0);
  const rights = (profile && profile.vipRights) || {};
  const keys = ['redVip', 'musicVip', 'svip', 'vip'];
  let right = null;
  let expire = 0;

  for (let i = 0; i < keys.length; i++) {
    const item = rights[keys[i]];
    if (!item || typeof item !== 'object') continue;
    const itemExpire = Number(item.expireTime || item.expire || 0);
    if (itemExpire > 0) expire = Math.max(expire, itemExpire);
    if (!right && isActiveRight(item)) right = item;
  }

  const activeByType = vipType > 0 && (!expire || expire > Date.now());
  const vip = activeByType || !!right;
  const vipName = (right && (right.vipName || right.name)) || (vip ? '黑胶VIP' : '');

  return { vip, vipType, vipName };
}

export async function onRequestGet(context) {
  const cookie = normalizeCookie(context.request.headers.get('x-netease-cookie'));

  if (!cookie) {
    return json({ loggedIn: false, vip: false, vipType: 0, vipName: '' });
  }

  try {
    const resp = await fetch('https://music.163.com/api/nuser/account/get', {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://music.163.com/',
        'Cookie': cookie,
        'Accept': 'application/json, text/plain, */*'
      }
    });
    const text = await resp.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}

    if (!resp.ok) {
      return json({ error: 'upstream_' + resp.status, message: '网易云没有返回账号资料' }, 502);
    }

    const account = data && data.account;
    const profile = data && data.profile;
    if (!account || !profile) {
      return json({
        loggedIn: false,
        loginExpired: true,
        vip: false,
        vipType: 0,
        vipName: ''
      });
    }

    const vipInfo = readVip(account, profile);

    return json({
      loggedIn: true,
      uid: String(profile.userId || account.id || ''),
      nickname: String(profile.nickname || account.userName || ''),
      avatarUrl: String(profile.avatarUrl || ''),
      vip: vipInfo.vip,
      vipType: vipInfo.vipType,
      vipName: vipInfo.vipName,
      checkedAt: Date.now()
    });
  } catch (e) {
    return json({ error: 'network', message: String((e && e.message) || e) }, 502);
  }
}
