// 返回当前线上部署的版本标识，供页面自查“是否已换新版”。
// 未取到标识时返回空对象，前端不会弹提示（失败静默）。
export async function onRequestGet({ env }) {
  const v = env.CF_PAGES_COMMIT_SHA || '';
  const body = v ? { v } : {};
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
