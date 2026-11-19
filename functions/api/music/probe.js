// 临时探测：判断 Cloudflare 侧请求网易云是否只能拿到加密结果
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function onRequestGet(context) {
  const kw = '晴天';
  const out = {};

  async function probe(name, url, extraHeaders) {
    try {
      const headers = Object.assign({
        'User-Agent': UA,
        'Referer': 'https://music.163.com/',
        'Cookie': 'appver=8.9.7; os=pc',
        'Accept': 'application/json, text/plain, */*'
      }, extraHeaders || {});
      const resp = await fetch(url, { headers });
      const text = await resp.text();
      out[name] = {
        status: resp.status,
        head: text.slice(0, 120),
        len: text.length,
        looksEncrypted: /^\{"result":"[0-9a-f]{64,}"\}$/.test(text.trim())
      };
    } catch (e) {
      out[name] = { error: String((e && e.message) || e) };
    }
  }

  const q = encodeURIComponent(kw);
  await probe('search_plain', 'https://music.163.com/api/search/get/web?s=' + q + '&type=1&offset=0&total=true&limit=3');
  await probe('search_realip', 'https://music.163.com/api/search/get/web?s=' + q + '&type=1&offset=0&total=true&limit=3', { 'X-Real-IP': '116.25.146.177', 'X-Forwarded-For': '116.25.146.177' });
  await probe('detail', 'https://music.163.com/api/song/detail?ids=[186016]');
  await probe('search_v1', 'https://music.163.com/api/cloudsearch/pc?s=' + q + '&type=1&limit=3');

  return new Response(JSON.stringify(out, null, 1), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
