// 火山豆包语音代理：浏览器不直接跨域请求 openspeech，Key 只在请求内存里转发。
// 走「音频生成」接口，支持声音复刻 / ICL 音色（例如 ICL_uranus_zh_male_cixingnansang_tob）。
const VOLC_TTS_URL = 'https://openspeech.bytedance.com/api/v3/tts/create';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

function upstreamMessage(status, data, raw) {
  const msg = data && (data.message || (data.error && (data.error.message || data.error.code)) || data.error);
  if (msg) return String(msg).slice(0, 180);
  if (status === 401 || status === 403) return '火山 API Key 没权限或已失效';
  if (status === 404) return '火山语音接口地址不对';
  if (status === 429) return '火山语音额度用完或服务太忙';
  if (status >= 500) return '火山语音服务暂时不可用';
  return String(raw || '').trim().slice(0, 180) || ('火山接口返回 ' + status);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export async function onRequestPost({ request }) {
  let body = null;
  try { body = await request.json(); } catch (e) {}
  if (!body || typeof body !== 'object') return jsonResponse({ error: '请求格式不对' }, 400);

  const apiKey = String(body.apiKey || '').trim();
  const voice = String(body.voice || '').trim().slice(0, 160);
  const text = String(body.text || '').trim().slice(0, 3000);
  const speed = Number(body.speed) || 1;
  if (!apiKey) return jsonResponse({ error: '还没填火山 API Key' }, 400);
  if (!voice) return jsonResponse({ error: '这个角色还没填火山音色 ID' }, 400);
  if (!text) return jsonResponse({ error: '没有要读的文字' }, 400);

  const speechRate = Math.max(-50, Math.min(100, Math.round((speed - 1) * 100)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let upstream;
  try {
    upstream = await fetch(VOLC_TTS_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Request-Id': (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      },
      body: JSON.stringify({
        model: 'seed-audio-1.0',
        text_prompt: text,
        references: [{ speaker: voice }],
        audio_config: {
          format: 'mp3',
          sample_rate: 44100,
          speech_rate: speechRate,
          loudness_rate: 0,
          pitch_rate: 0,
        },
        watermark: {},
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e && e.name === 'AbortError' ? '火山语音超时，60 秒没返回' : ('连不上火山语音：' + (e && e.message ? e.message : e));
    return jsonResponse({ error: msg }, 504);
  }
  clearTimeout(timer);

  const raw = await upstream.text().catch(() => '');
  let data = null;
  try { data = JSON.parse(raw); } catch (e) {}
  if (!upstream.ok || !data) {
    return jsonResponse({ error: upstreamMessage(upstream.status, data, raw) }, upstream.status || 502);
  }
  if (!data.audio && !data.url) {
    return jsonResponse({ error: upstreamMessage(upstream.status, data, raw) }, 502);
  }
  return jsonResponse({
    audio: data.audio || '',
    url: data.url || '',
    duration: data.duration || 0,
  });
}
