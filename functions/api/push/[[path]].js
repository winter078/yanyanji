// 小手机 PWA 推送服务（Cloudflare Pages Functions）
// 路由：/api/push/*
//   GET  /api/push/health
//   GET  /api/push/vapid-public
//   POST /api/push/subscribe
//   POST /api/push/test
//   POST /api/push/unsubscribe
//   GET  /api/push/stats
//
// 定时提醒由独立的 Worker（momo-push）每分钟/每小时 cron 读取同一个 KV 发送。

const ALLOWED_ORIGINS = [
  'https://momo-phone.pages.dev',
  'http://127.0.0.1:8811',
  'http://localhost:8811'
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders(request))
  });
}

function bytesToB64u(bytes) {
  const arr = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64uToBytes(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function utf8(str) {
  return new Uint8Array(new TextEncoder().encode(str));
}

function concatBytes() {
  const parts = Array.prototype.slice.call(arguments).filter(Boolean);
  let total = 0;
  parts.forEach(function(p) { total += p.length; });
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach(function(p) { out.set(p, offset); offset += p.length; });
  return out;
}

function mergeBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function hmacSha256(keyBytes, dataBytes) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, dataBytes));
}

async function encryptPayload(uaPublicB64u, authB64u, payloadText) {
  const uaPublic = b64uToBytes(uaPublicB64u);
  const authSecret = b64uToBytes(authB64u);

  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8291 §3.3 - 3.4：认证密钥先参与一次 HKDF，再和随机 salt 做第二次
  const prkKey = await hmacSha256(authSecret, shared);
  const keyInfo = concatBytes(utf8('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([1])));
  const prk = await hmacSha256(salt, ikm);

  const cek = (await hmacSha256(prk, concatBytes(utf8('Content-Encoding: aes128gcm'), new Uint8Array([0, 1])))).slice(0, 16);
  const nonce = (await hmacSha256(prk, concatBytes(utf8('Content-Encoding: nonce'), new Uint8Array([0, 1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const plaintext = concatBytes(utf8(payloadText), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext
  ));

  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]);
  const idLen = new Uint8Array([asPublic.length]);

  return concatBytes(salt, rs, idLen, asPublic, ciphertext);
}

async function buildVapidHeaders(endpoint, env) {
  const audience = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256', k: env.VAPID_PUBLIC };
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:admin@example.com'
  };
  const unsigned = bytesToB64u(utf8(JSON.stringify(header))) + '.' + bytesToB64u(utf8(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    'jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(unsigned));
  const jwt = unsigned + '.' + bytesToB64u(new Uint8Array(sig));
  return 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC;
}

async function sendPush(subscription, payload, env, ttl) {
  const endpoint = subscription.endpoint;
  const keys = subscription.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) throw new Error('subscription 不完整');

  const body = await encryptPayload(keys.p256dh, keys.auth, JSON.stringify(payload));
  const authorization = await buildVapidHeaders(endpoint, env);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': String(ttl || 86400),
      'Urgency': 'normal'
    },
    body: body
  });
  return { status: res.status, text: (await res.text() || '').slice(0, 200) };
}

function subIdFor(endpoint) {
  return endpoint.replace(/[^a-zA-Z0-9]/g, '').slice(-40);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '';
  const suffix = path.replace(/^\/api\/push/, '') || '/';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    if (suffix === '/health') {
      return json({ ok: true, time: Date.now() }, 200, request);
    }

    if (suffix === '/vapid-public') {
      return json({ ok: true, key: env.VAPID_PUBLIC }, 200, request);
    }

    if (suffix === '/subscribe' && request.method === 'POST') {
      const body = await request.json();
      const subscription = body && body.subscription;
      if (!subscription || !subscription.endpoint) {
        return json({ ok: false, error: 'missing_subscription' }, 400, request);
      }
      const id = subIdFor(subscription.endpoint);
      const record = {
        subscription: subscription,
        name: String(body.name || '小手机').slice(0, 24),
        charName: String(body.charName || '').slice(0, 24),
        remindEnabled: body.remindEnabled !== false,
        remindHour: Math.min(23, Math.max(0, Number(body.remindHour) || 20)),
        tzOffset: Math.min(14, Math.max(-12, Number(body.tzOffset) || 8)),
        updatedAt: Date.now(),
        lastSentDay: ''
      };
      const existingRaw = await env.PUSH_SUBS.get('sub:' + id);
      if (existingRaw) {
        try {
          const old = JSON.parse(existingRaw);
          record.lastSentDay = old.lastSentDay || '';
        } catch (e) {}
      }
      await env.PUSH_SUBS.put('sub:' + id, JSON.stringify(record));
      return json({ ok: true, id: id }, 200, request);
    }

    if (suffix === '/test' && request.method === 'POST') {
      const body = await request.json();
      const subscription = body && body.subscription;
      if (!subscription || !subscription.endpoint) {
        return json({ ok: false, error: 'missing_subscription' }, 400, request);
      }
      const payload = {
        title: String(body.title || '小手机'),
        body: String(body.body || '这是一条测试通知，说明通道已经通了。'),
        url: String(body.url || '/index.html?open=chat'),
        tag: 'momo-test'
      };
      const delay = Math.min(30, Math.max(0, Number(body.delay) || 0));
      if (delay) await new Promise(function (r) { setTimeout(r, delay * 1000); });
      const result = await sendPush(subscription, payload, env, 300);
      return json({ ok: result.status >= 200 && result.status < 300, result: result }, 200, request);
    }

    if (suffix === '/unsubscribe' && request.method === 'POST') {
      const body = await request.json();
      const endpoint = body && body.endpoint;
      if (!endpoint) return json({ ok: false, error: 'missing_endpoint' }, 400, request);
      await env.PUSH_SUBS.delete('sub:' + subIdFor(endpoint));
      return json({ ok: true }, 200, request);
    }

    if (suffix === '/stats') {
      const list = await env.PUSH_SUBS.list({ prefix: 'sub:' });
      return json({ ok: true, count: list.keys.length }, 200, request);
    }

    return json({ ok: false, error: 'not_found', suffix: suffix }, 404, request);
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) }, 500, request);
  }
}
