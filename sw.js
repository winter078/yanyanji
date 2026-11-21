// 小手机 Service Worker：只负责推送与点击跳转，不缓存任何页面资源（避免把旧版本钉死）

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    try { payload = { body: event.data ? event.data.text() : '' }; } catch (e2) {}
  }

  var title = payload.title || '小手机';
  var options = {
    body: payload.body || 'TA 发来一条消息',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'momo-message',
    renotify: true,
    data: { url: payload.url || '/index.html?open=chat' }
  };

  // 小手机正在前台时不要弹锁屏通知（人就在看着屏幕），只把内容转给页面
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      var visible = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].visibilityState === 'visible') visible = true;
        try { list[i].postMessage({ type: 'momo-push', payload: payload }); } catch (e) {}
      }
      if (visible) return;
      return self.registration.showNotification(title, options);
    }).catch(function () {
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/index.html?open=chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if ('focus' in client) {
          try { client.postMessage({ type: 'momo-open-chat' }); } catch (e) {}
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
