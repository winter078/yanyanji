// 存储中心：本地占用可视化 + 持久化保护 + 备份入口
(function() {
  const CATEGORY_META = {
    chat:      { label: '聊天记录', color: '#07c160' },
    characters:{ label: '角色与记忆', color: '#a78bfa' },
    moments:   { label: '朋友圈', color: '#60a5fa' },
    music:     { label: '音乐', color: '#f59e0b' },
    reading:   { label: '阅读', color: '#f472b6' },
    desktop:   { label: '桌面与外观', color: '#22d3ee' },
    other:     { label: '其他设置', color: '#94a3b8' }
  };

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 1024 * 100 ? 1 : 0) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function bytesOf(value) {
    if (value == null) return 0;
    if (typeof value === 'string') {
      try { return new Blob([value]).size; } catch (e) { return value.length * 2; }
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size || 0;
    if (value instanceof ArrayBuffer) return value.byteLength || 0;
    if (ArrayBuffer.isView(value)) return value.byteLength || 0;
    if (Array.isArray(value)) return value.reduce(function(sum, item) { return sum + bytesOf(item); }, 0);
    if (typeof value === 'object') {
      let total = 0;
      Object.keys(value).forEach(function(key) { total += bytesOf(key) + bytesOf(value[key]); });
      return total;
    }
    return 0;
  }

  function categoryForKey(key, value) {
    const k = String(key || '');
    if (k.indexOf('momo_widget_art') === 0 || k.indexOf('momo_desktop') === 0 || k.indexOf('momo_dock') === 0 ||
        k.indexOf('momo_wallpaper') === 0 || k.indexOf('momo_bg') === 0 || k.indexOf('momo_global_bg') === 0 ||
        k.indexOf('momo_chat_bg') === 0 || k.indexOf('momo_hero_banner') === 0 || k.indexOf('momo_theme') === 0 ||
        k.indexOf('momo_skin') === 0 || k.indexOf('momo_sticker') === 0) return 'desktop';
    if (k.indexOf('momo_moments') === 0) return 'moments';
    if (k.indexOf('momo_music') === 0 || k.indexOf('momo_song') === 0 || k.indexOf('momo_playlist') === 0) return 'music';
    if (k.indexOf('momo_novel') === 0 || k.indexOf('momo_xianguo') === 0 || k.indexOf('momo_read') === 0 || k.indexOf('momo_book') === 0) return 'reading';
    if (k.indexOf('momo_character') === 0 || k.indexOf('momo_active_char') === 0 || k.indexOf('momo_hero') === 0 ||
        k.indexOf('momo_bot_avatar') === 0 || k.indexOf('momo_vault') === 0 || k.indexOf('momo_world_book') === 0 ||
        k.indexOf('momo_palace') === 0 || k.indexOf('momo_thought') === 0) return 'characters';
    if (k.indexOf('momo_chat') === 0 || k.indexOf('momo_wechat') === 0 || k.indexOf('momo_contact') === 0 ||
        k.indexOf('momo_group') === 0 || k.indexOf('momo_message') === 0 || k.indexOf('momo_session') === 0) return 'chat';
    return 'other';
  }

  function addCategory(target, category, bytes) {
    if (!target[category]) target[category] = 0;
    target[category] += Number(bytes) || 0;
  }

  function estimateLocalStorage(categories) {
    const keys = [];
    const overflowKeys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
    } catch (e) {}
    try {
      if (window.momoGetStorageOverflowKeys) {
        window.momoGetStorageOverflowKeys().forEach(function(key) {
          if (overflowKeys.indexOf(key) === -1) overflowKeys.push(key);
          if (keys.indexOf(key) === -1) keys.push(key);
        });
      }
    } catch (e) {}
    keys.forEach(function(key) {
      if (key === 'momo_last_backup_at') return;
      // 溢出键实际存放在 MomoOverflowDB 里，避免 localStorage 与 IndexedDB 重复计算。
      if (overflowKeys.indexOf(key) !== -1) return;
      let value = null;
      try { value = localStorage.getItem(key); } catch (e) {}
      addCategory(categories, categoryForKey(key, value), bytesOf(value) + bytesOf(key));
    });
  }

  function listDatabaseNames() {
    const known = ['MomoMusicDB', 'MomoNovelStoreDB', 'MomoMomentsDB', 'MomoOverflowDB'];
    if (window.indexedDB && indexedDB.databases) {
      return indexedDB.databases().then(function(list) {
        const names = (list || []).map(function(item) { return item && item.name; }).filter(Boolean);
        known.forEach(function(name) { if (names.indexOf(name) === -1) names.push(name); });
        return names;
      }).catch(function() { return known; });
    }
    return Promise.resolve(known);
  }

  function openDatabase(name) {
    return new Promise(function(resolve, reject) {
      const req = indexedDB.open(name);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error || new Error('无法读取数据库')); };
      req.onupgradeneeded = function() {
        // 数据库不存在时不要创建空库，否则可能破坏后续按版本初始化的表结构。
        try { req.transaction.abort(); } catch (e) {}
        reject(new Error('数据库不存在'));
      };
    });
  }

  function readDatabaseBytes(name) {
    return openDatabase(name).then(function(db) {
      return new Promise(function(resolve, reject) {
        const storeNames = Array.prototype.slice.call(db.objectStoreNames || []);
        if (!storeNames.length) { db.close(); resolve([]); return; }
        const tx = db.transaction(storeNames, 'readonly');
        const result = [];
        storeNames.forEach(function(storeName) {
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = function() {
            const rows = req.result || [];
            rows.forEach(function(row) {
              const rowKey = row && (row.key || row.id || row.name || '');
              const category = name === 'MomoMusicDB' ? 'music'
                : name === 'MomoNovelStoreDB' ? 'reading'
                : name === 'MomoMomentsDB' ? 'moments'
                : name === 'MomoOverflowDB' ? categoryForKey(rowKey, row && row.value) : 'other';
              result.push({ category: category, bytes: bytesOf(row) });
            });
          };
          req.onerror = function() {};
        });
        tx.oncomplete = function() { db.close(); resolve(result); };
        tx.onerror = function() { db.close(); reject(tx.error || new Error('读取数据库失败')); };
        tx.onabort = function() { db.close(); reject(tx.error || new Error('读取数据库被中止')); };
      });
    }).catch(function() { return []; });
  }

  async function collectCategories() {
    const categories = {};
    estimateLocalStorage(categories);
    const names = await listDatabaseNames();
    for (const name of names) {
      const rows = await readDatabaseBytes(name);
      rows.forEach(function(row) { addCategory(categories, row.category, row.bytes); });
    }
    return categories;
  }

  function renderCategories(categories, total) {
    const list = document.getElementById('storage-category-list');
    if (!list) return;
    const grandTotal = Object.keys(categories).reduce(function(sum, key) { return sum + (categories[key] || 0); }, 0);
    const max = Math.max.apply(null, Object.keys(CATEGORY_META).map(function(key) { return categories[key] || 0; }).concat([1]));
    const keys = Object.keys(CATEGORY_META).filter(function(key) { return (categories[key] || 0) > 0; });
    if (!keys.length) {
      list.innerHTML = '<div style="font-size: 12px; color: var(--color-text-secondary); padding: 8px 0;">暂无本地数据</div>';
      return;
    }
    list.innerHTML = keys.map(function(key) {
      const meta = CATEGORY_META[key];
      const bytes = categories[key] || 0;
      const width = Math.max(4, Math.round((bytes / max) * 100));
      const percent = grandTotal ? Math.round((bytes / grandTotal) * 100) : 0;
      return '<div style="margin-bottom: 11px;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 5px;">' +
          '<span style="font-size: 12px; font-weight: 600; color: var(--color-text-primary);">' + meta.label + '</span>' +
          '<span style="font-size: 11px; color: var(--color-text-secondary);">' + formatBytes(bytes) + ' · ' + percent + '%</span>' +
        '</div>' +
        '<div style="height: 6px; border-radius: 999px; background: rgba(148,163,184,0.16); overflow: hidden;">' +
          '<div style="height: 6px; width: ' + width + '%; border-radius: 999px; background: ' + meta.color + ';"></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function refreshStorageCenter() {
    const usageEl = document.getElementById('storage-total-usage');
    const quotaEl = document.getElementById('storage-quota');
    const persistBadge = document.getElementById('storage-persist-badge');
    const persistText = document.getElementById('storage-persist-text');
    const persistBtn = document.getElementById('storage-persist-btn');
    const backupTime = document.getElementById('storage-last-backup');
    if (!usageEl) return;

    usageEl.textContent = '读取中…';
    quotaEl.textContent = '读取中…';

    let usage = null;
    let quota = null;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        usage = estimate.usage;
        quota = estimate.quota;
      }
    } catch (e) {}

    const categories = await collectCategories();
    const categoryTotal = Object.keys(categories).reduce(function(sum, key) { return sum + (categories[key] || 0); }, 0);
    usageEl.textContent = formatBytes(Math.max(categoryTotal, Number(usage) || 0));
    quotaEl.textContent = formatBytes(quota != null ? quota : 0);
    renderCategories(categories, usage);

    try {
      backupTime.textContent = localStorage.getItem('momo_last_backup_at')
        ? formatStamp(localStorage.getItem('momo_last_backup_at'))
        : '还没有导出过备份';
    } catch (e) { backupTime.textContent = '还没有导出过备份'; }

    const importEl = document.getElementById('storage-last-import');
    if (importEl) {
      try {
        importEl.textContent = localStorage.getItem('momo_last_import_at')
          ? formatStamp(localStorage.getItem('momo_last_import_at'))
          : '还没有导入过备份';
      } catch (e) { importEl.textContent = '还没有导入过备份'; }
    }

    const daysEl = document.getElementById('storage-remind-days');
    if (daysEl) daysEl.value = String(getRemindDays());

    let persisted = false;
    let supported = !!(navigator.storage && navigator.storage.persisted);
    if (supported) {
      try { persisted = await navigator.storage.persisted(); } catch (e) {}
    }
    if (!supported) {
      persistBadge.textContent = '不支持';
      persistBadge.style.color = 'var(--color-text-secondary)';
      persistBadge.style.background = 'rgba(148,163,184,0.12)';
      persistText.textContent = '当前浏览器不支持持久化接口；请定期导出完整备份。';
      persistBtn.style.display = 'none';
    } else if (persisted) {
      persistBadge.textContent = '已保护';
      persistBadge.style.color = '#34d399';
      persistBadge.style.background = 'rgba(52,211,153,0.12)';
      persistText.textContent = '浏览器已授予防清理保护，聊天和图片数据不会轻易被自动清除。';
      persistBtn.style.display = 'none';
    } else {
      persistBadge.textContent = '未开启';
      persistBadge.style.color = '#fbbf24';
      persistBadge.style.background = 'rgba(251,191,36,0.12)';
      persistText.textContent = '开启后浏览器不会自动清理本站数据；仍需定期导出备份。';
      persistBtn.style.display = '';
    }
  }

  async function enablePersistentStorage() {
    const btn = document.getElementById('storage-persist-btn');
    if (!navigator.storage || !navigator.storage.persist) {
      alert('当前浏览器不支持持久化保护，请定期导出完整备份。');
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '申请中…'; }
    let granted = false;
    try { granted = await navigator.storage.persist(); } catch (e) {}
    if (btn) { btn.disabled = false; btn.textContent = '开启持久化保护'; }
    if (!granted) {
      alert('浏览器没有授予持久化保护。\n可以先把小手机添加到主屏幕/收藏，或定期导出备份。');
    }
    refreshStorageCenter();
  }

  // ===== 备份时间与到期提醒 =====
  const BACKUP_STAMP_KEY = 'momo_last_backup_at';
  const IMPORT_STAMP_KEY = 'momo_last_import_at';
  const REMIND_DAYS_KEY = 'momo_backup_remind_days';
  const REMIND_SNOOZE_KEY = 'momo_backup_remind_snooze_until';
  const DEFAULT_REMIND_DAYS = 3;

  function formatStamp(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  function getRemindDays() {
    const raw = Number(localStorage.getItem(REMIND_DAYS_KEY));
    if (!isFinite(raw) || raw <= 0) return DEFAULT_REMIND_DAYS;
    return Math.min(60, Math.max(1, Math.round(raw)));
  }

  window.saveBackupRemindDays = function(value) {
    const raw = Number(value);
    const days = (!isFinite(raw) || raw <= 0) ? DEFAULT_REMIND_DAYS : Math.min(60, Math.max(1, Math.round(raw)));
    try { localStorage.setItem(REMIND_DAYS_KEY, String(days)); } catch (e) {}
    try { localStorage.removeItem(REMIND_SNOOZE_KEY); } catch (e) {}
    const el = document.getElementById('storage-remind-days');
    if (el) el.value = String(days);
    return days;
  };

  function lastStampedTime() {
    let backup = 0;
    let importAt = 0;
    try {
      backup = Date.parse(localStorage.getItem(BACKUP_STAMP_KEY) || '') || 0;
      importAt = Date.parse(localStorage.getItem(IMPORT_STAMP_KEY) || '') || 0;
    } catch (e) {}
    // 从没导出过时用导入时间兜底，避免永远不提醒
    return backup || importAt || 0;
  }

  function snoozeReminder(days) {
    const until = Date.now() + (days || 1) * 24 * 60 * 60 * 1000;
    try { localStorage.setItem(REMIND_SNOOZE_KEY, String(until)); } catch (e) {}
  }

  function isReminderDue() {
    const last = lastStampedTime();
    if (!last) return false;
    let snoozeUntil = 0;
    try { snoozeUntil = Number(localStorage.getItem(REMIND_SNOOZE_KEY)) || 0; } catch (e) {}
    if (snoozeUntil && Date.now() < snoozeUntil) return false;
    return (Date.now() - last) >= getRemindDays() * 24 * 60 * 60 * 1000;
  }

  function closeReminderOverlay() {
    const el = document.getElementById('momo-backup-remind-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showBackupReminder() {
    if (document.getElementById('momo-backup-remind-overlay')) return;
    const days = getRemindDays();
    const last = lastStampedTime();

    const overlay = document.createElement('div');
    overlay.id = 'momo-backup-remind-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.52);display:flex;align-items:center;justify-content:center;padding:22px;';

    const card = document.createElement('div');
    card.style.cssText = 'width:100%;max-width:320px;border-radius:18px;padding:18px 16px 14px;background:var(--bg-surface,#1c1c1e);border:1px solid var(--color-border,rgba(255,255,255,0.14));box-shadow:0 18px 46px rgba(0,0,0,0.42);color:var(--color-text-primary,#fff);';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:15px;font-weight:800;margin-bottom:8px;';
    title.textContent = '备份提醒';

    const elapsedDays = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
    const body = document.createElement('div');
    body.style.cssText = 'font-size:12.5px;line-height:1.6;color:var(--color-text-secondary,#a1a1aa);';
    body.textContent = '上次导出是 ' + formatStamp(new Date(last).toISOString()) + '，已经 ' + elapsedDays + ' 天（你设的是 ' + days + ' 天提醒一次）。需要现在备份吗？';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;';

    const laterBtn = document.createElement('button');
    laterBtn.type = 'button';
    laterBtn.style.cssText = 'flex:1;padding:9px;border-radius:11px;border:1px solid var(--color-border,rgba(255,255,255,0.14));background:var(--bg-elevated,rgba(255,255,255,0.08));color:var(--color-text-secondary,#a1a1aa);font-size:12.5px;font-weight:600;cursor:pointer;';
    laterBtn.textContent = '稍后提醒';
    laterBtn.onclick = function() {
      snoozeReminder(1);
      closeReminderOverlay();
    };

    const nowBtn = document.createElement('button');
    nowBtn.type = 'button';
    nowBtn.style.cssText = 'flex:1;padding:9px;border-radius:11px;border:none;background:linear-gradient(135deg,#07c160 0%,#05a050 100%);color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;';
    nowBtn.textContent = '现在导出';
    nowBtn.onclick = function() {
      closeReminderOverlay();
      if (typeof window.exportFullBackup === 'function') window.exportFullBackup();
    };

    btnRow.appendChild(laterBtn);
    btnRow.appendChild(nowBtn);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  window.maybeShowBackupReminder = function() {
    try {
      if (isReminderDue()) showBackupReminder();
    } catch (e) {}
  };

  function bootReminder() {
    setTimeout(function() { window.maybeShowBackupReminder(); }, 2000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootReminder);
  } else {
    bootReminder();
  }

  window.refreshStorageCenter = refreshStorageCenter;
  window.enablePersistentStorage = enablePersistentStorage;
})();
