// /phone：在返回 phone.html 时补上 iOS 全屏状态栏声明。
export async function onRequestGet(context) {
  const res = await context.next();
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
