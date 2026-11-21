// 小手机 · 锁屏通知（PWA Web Push）
// 只在这一台设备上生效：必须「添加到主屏幕」并用那个图标打开过，才能在 iOS 上收到推送。
(function () {
  var VAPID_PUBLIC = 'BEOh8D6wP17ABKyAHtTTpTnn74rwJe32H1ZCBBJFPQrEbKO0NHhQB91LyCzu9nQk6JuVH8w9mH0GyFNVYtGh0no';
  var SW_PATH = '/sw.js';

  function apiBase() {
    var host = (location.hostname || '').toLowerCase();
    if (host === '127.0.0.1' || host === 'localhost' || host === '') {
      // 本地调试时，订阅与测试都打到线上同一份服务（数据在 Cloudflare KV 里）
      return 'https://momo-phone.pages.dev/api/push';
    }
    return '/api/push';
  }

  function b64uToBytes(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isStandalone() {
    if (navigator.standalone) return true;
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  }

  function supported() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window) && window.isSecureContext;
  }

  function post(path, body) {
    return fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.text().then(function (text) {
        if (!text) throw new Error('服务器没回话（HTTP ' + res.status + '）');
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error('服务器返回看不懂的内容（HTTP ' + res.status + '）');
        }
      });
    });
  }

  function getSubscription() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) return null;
      return reg.pushManager.getSubscription();
    });
  }

  function ensureRegistration() {
    return navigator.serviceWorker.register(SW_PATH, { scope: '/' }).then(function (reg) {
      return navigator.serviceWorker.ready.then(function () { return reg; });
    });
  }

  function baseRecord(subscription) {
    return {
      subscription: subscription.toJSON ? subscription.toJSON() : subscription,
      name: '小手机',
      charName: localStorage.getItem('momo_push_display_name') || 'TA',
      remindEnabled: localStorage.getItem('momo_push_remind_on') !== '0',
      remindHour: Number(localStorage.getItem('momo_push_remind_hour') || 20),
      tzOffset: -new Date().getTimezoneOffset() / 60
    };
  }

  function syncToServer(subscription) {
    if (!subscription) return Promise.resolve({ ok: false, error: 'no_subscription' });
    return post('/subscribe', baseRecord(subscription));
  }

  function statusText() {
    var el = document.getElementById('push-status');
    if (!el) return;
    if (!supported()) {
      el.innerHTML = '<span style="color:#f87171;">这个浏览器不支持 Web Push。</span>' +
        (isIos() && !isStandalone() ? ' iOS 上必须先用 Safari 打开页面 → 分享 → 添加到主屏幕，再从主屏幕图标打开。' : '');
      return;
    }

    var perm = Notification.permission;
    if (perm === 'denied') {
      el.innerHTML = '<span style="color:#f87171;">通知权限被拒绝了。</span> 去 设置 → 通知 → 小手机 里打开，或者在 Safari 的网站设置里允许通知。';
      return;
    }

    getSubscription().then(function (sub) {
      var standalone = isStandalone();
      var parts = [];
      parts.push(perm === 'granted'
        ? '<span style="color:#3ddc84;">权限已开启</span>'
        : '<span style="color:#fbbf24;">还没开权限</span>');
      parts.push(sub ? '<span style="color:#3ddc84;">已订阅</span>' : '<span style="color:#fbbf24;">未订阅</span>');
      if (isIos()) parts.push(standalone ? '主屏幕模式' : '<span style="color:#fbbf24;">现在是 Safari 里，收不到锁屏</span>');
      el.innerHTML = parts.join(' · ');

      var diagEl = document.getElementById('push-diag');
      if (diagEl) {
        var ep = '无';
        if (sub) {
          ep = sub.endpoint.indexOf('apple') >= 0 ? 'apple' : sub.endpoint.replace(/^https:\/\//, '').split('/')[0];
        }
        diagEl.textContent = '方式:' + (standalone ? '主屏幕' : 'Safari') +
          ' 权限:' + perm +
          ' 订阅:' + (sub ? '有/' + ep : '无') +
          ' 屏:' + screen.width + 'x' + screen.height +
          ' 视口:' + (window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight);
      }
    });
  }

  function showResult(text, ok) {
    var el = document.getElementById('push-result');
    if (!el) return;
    el.style.display = 'block';
    el.style.color = ok ? '#3ddc84' : '#f87171';
    el.textContent = text;
  }

  function enablePush() {
    if (!supported()) {
      showResult('当前浏览器不支持推送。iOS 需要 16.4 以上，并且必须添加到主屏幕后从图标打开。', false);
      return;
    }
    if (isIos() && !isStandalone()) {
      showResult('先把这一页「添加到主屏幕」，然后从桌面上的小手机图标打开，再点这个按钮。', false);
      return;
    }

    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') {
        showResult('权限没给到。去 设置 → 通知 → 小手机 里打开再回来。', false);
        return;
      }
      return ensureRegistration().then(function (reg) {
        return reg.pushManager.getSubscription().then(function (existing) {
          if (existing) return existing;
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: b64uToBytes(VAPID_PUBLIC)
          });
        });
      }).then(function (sub) {
        localStorage.setItem('momo_push_enabled', '1');
        return syncToServer(sub).then(function (res) {
          if (res && res.ok) showResult('已经订阅上了。点「发送测试通知」看锁屏会不会响。', true);
          else showResult('订阅成功，但上报失败：' + ((res && res.error) || '未知错误'), false);
          statusText();
        });
      });
    }).catch(function (err) {
      showResult('开启失败：' + (err && err.message ? err.message : err), false);
    });
  }

  function testPush() {
    getSubscription().then(function (sub) {
      if (!sub) {
        showResult('还没有订阅，先点「开启通知」。', false);
        return;
      }
      showResult('10 秒后发出——现在马上按 Home 回桌面或锁屏，别停在这个页面。', true);
      return post('/test', {
        subscription: sub.toJSON ? sub.toJSON() : sub,
        title: localStorage.getItem('momo_push_display_name') || 'TA',
        body: '这条是测试，看到就说明锁屏通道通了。',
        delay: 10
      }).then(function (res) {
        if (res && res.ok) {
          showResult('发出去了。回到桌面或锁屏看，几秒内会弹。', true);
          return;
        }
        var st = res && res.result && res.result.status;
        if (st === 404 || st === 410) {
          showResult('这台设备的订阅已经过期了，点「关闭」再点「开启通知」重新订一次。', false);
        } else if (st) {
          showResult('苹果拒收了（HTTP ' + st + '）。多半是订阅失效，关掉再开一次试试。', false);
        } else {
          showResult('发送失败：' + ((res && res.error) || '没拿到结果'), false);
        }
      });
    }).catch(function (err) {
      showResult('发送失败：' + (err && err.message ? err.message : err), false);
    });
  }

  function disablePush() {
    getSubscription().then(function (sub) {
      if (!sub) {
        showResult('本来就没有订阅。', true);
        return;
      }
      var endpoint = sub.endpoint;
      localStorage.setItem('momo_push_enabled', '0');
      return post('/unsubscribe', { endpoint: endpoint }).then(function () {
        return sub.unsubscribe();
      }).then(function () {
        showResult('已经关掉了，这台设备不会再收到推送。', true);
        statusText();
      });
    }).catch(function (err) {
      showResult('关闭失败：' + (err && err.message ? err.message : err), false);
    });
  }

  function saveReminder() {
    var hourEl = document.getElementById('push-remind-hour');
    var nameEl = document.getElementById('push-display-name');
    var onEl = document.getElementById('push-remind-on');
    if (hourEl) localStorage.setItem('momo_push_remind_hour', String(hourEl.value));
    if (nameEl) localStorage.setItem('momo_push_display_name', nameEl.value.trim() || 'TA');
    if (onEl) localStorage.setItem('momo_push_remind_on', onEl.checked ? '1' : '0');
    getSubscription().then(function (sub) {
      if (!sub) return;
      return syncToServer(sub).then(function (res) {
        showResult(res && res.ok ? '提醒设置已保存。' : '保存失败：' + ((res && res.error) || ''), !!(res && res.ok));
      });
    });
  }

  function fillControls() {
    var hourEl = document.getElementById('push-remind-hour');
    var nameEl = document.getElementById('push-display-name');
    var onEl = document.getElementById('push-remind-on');
    if (hourEl && !hourEl.dataset.filled) {
      if (!hourEl.options.length) {
        for (var h = 8; h <= 23; h++) {
          var opt = document.createElement('option');
          opt.value = String(h);
          opt.textContent = (h < 10 ? '0' + h : String(h)) + ':00';
          hourEl.appendChild(opt);
        }
      }
      hourEl.value = String(Number(localStorage.getItem('momo_push_remind_hour') || 20));
      hourEl.dataset.filled = '1';
    }
    if (nameEl && !nameEl.dataset.filled) {
      nameEl.value = localStorage.getItem('momo_push_display_name') || 'TA';
      nameEl.dataset.filled = '1';
    }
    if (onEl && !onEl.dataset.filled) {
      onEl.checked = localStorage.getItem('momo_push_remind_on') !== '0';
      onEl.dataset.filled = '1';
    }
  }

  function openChatFromPush() {
    try {
      if (typeof window.openWechatMain === 'function') {
        window.openWechatMain('chats');
        return true;
      }
    } catch (e) {}
    return false;
  }

  function handleUrlIntent() {
    var params = new URLSearchParams(location.search || '');
    if (!params.get('open')) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (openChatFromPush()) {
        clearInterval(timer);
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      } else if (tries >= 12) {
        clearInterval(timer);
      }
    }, 500);
  }

  function init() {
    if (!supported()) {
      statusText();
      return;
    }

    // 启动时：把已存在的订阅同步一次（提醒时间/显示名可能在别的设备上改过）
    getSubscription().then(function (sub) {
      if (sub) syncToServer(sub);
      statusText();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'momo-open-chat') openChatFromPush();
      });
    }

    handleUrlIntent();

    window.addEventListener('focus', function () { statusText(); });

    var card = document.getElementById('push-card');
    if (card && window.IntersectionObserver) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            fillControls();
            statusText();
          }
        });
      }, { threshold: 0.08 });
      observer.observe(card);
    }
  }

  window.enablePushNotifications = enablePush;
  window.testPushNotification = testPush;
  window.disablePushNotifications = disablePush;
  window.savePushReminder = saveReminder;
  window.refreshPushStatus = function () { fillControls(); statusText(); };
  // 给聊天模块用：判断是否开了锁屏通知、拿当前订阅
  window.__momPushEnabled = function () {
    try {
      if (localStorage.getItem('momo_push_enabled') !== '1') return false;
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return false;
      return supported();
    } catch (e) { return false; }
  };
  window.__momGetPushSub = function () {
    return getSubscription().then(function (sub) {
      if (!sub) return null;
      try { return sub.toJSON ? sub.toJSON() : sub; } catch (e) { return null; }
    }).catch(function () { return null; });
  };
  window.tryLocalNotification = function () {
    if (!('Notification' in window) || !navigator.serviceWorker) {
      showResult('这个环境不支持主动弹通知。', false);
      return;
    }
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.showNotification('言言机', {
        body: '本地通知测试：看到这条，说明系统允许我们自己弹',
        icon: '/icons/icon-192.png',
        tag: 'momo-local-test'
      });
    }).then(function () {
      showResult('已经让系统弹了。看到就是通的。', true);
    }).catch(function (err) {
      showResult('本地弹窗失败：' + ((err && err.message) || err), false);
    });
  };
  window.copyPushDiag = function () {
    var el = document.getElementById('push-diag');
    var text = (el ? el.textContent : '') + '\nUA:' + navigator.userAgent;
    try {
      navigator.clipboard.writeText(text);
      showResult('诊断信息已复制，粘给我就行。', true);
    } catch (e) {
      showResult(text, true);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
