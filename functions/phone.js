// /phone：在返回 phone.html 时补上 iOS 全屏状态栏声明。
// 只改这一层响应头/HTML，不动静态 phone.html，避免每次改一行都要推整份 600KB 文件。
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/phone.html', url);
  assetUrl.search = url.search;
  const res = await context.env.ASSETS.fetch(new Request(assetUrl.toString(), context.request));
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) return res;

  let html = await res.text();
  if (!html.includes('apple-mobile-web-app-status-bar-style')) {
    html = html.replace('</head>', '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n</head>');
  }

  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('Cache-Control', 'no-store, must-revalidate');
  return new Response(html, { status: res.status, headers });
}
