// ==========================================================================
// 相册存储层 v2：IndexedDB 为主，localStorage 兜底
// - 不再有 40 张上限
// - 老 momo_photo_album_v1 自动迁移，不删除旧键，保留备份
// - 所有图片带 ownerType / ownerId，角色相册与共享相册分开
// ==========================================================================
(function () {
  'use strict';

  const DB_NAME = 'momo_album_db_v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'photos';
  const LEGACY_KEY = 'momo_photo_album_v1';
  const FALLBACK_KEY = 'momo_album_v2_fallback';
  const MIGRATION_FLAG = 'momo_album_migrated_v1';

  let dbPromise = null;
  let initPromise = null;
  let cache = null;
  let useFallback = false;

  function nowISO() {
    return new Date().toISOString();
  }

  function makeId() {
    return 'ph_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function normalize(item) {
    item = item || {};
    const ownerType = item.ownerType || 'user';
    const ownerId = item.ownerId || (ownerType === 'shared' ? 'shared' : ownerType === 'char' ? 'unknown' : 'user');
    return {
      id: item.id || makeId(),
      src: item.src || '',
      thumb: item.thumb || item.src || '',
      tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : [],
      caption: String(item.caption || ''),
      scene: String(item.scene || ''),
      ownerType: ownerType,
      ownerId: ownerId,
      source: item.source || 'legacy',
      fingerprint: String(item.fingerprint || ''),
      createdAt: item.createdAt || item.time || nowISO(),
      time: item.time || item.createdAt || nowISO()
    };
  }

  function sortPhotos(list) {
    return (list || []).slice().sort(function (a, b) {
      return new Date(b.createdAt || b.time || 0).getTime() - new Date(a.createdAt || a.time || 0).getTime();
    });
  }

  function readLegacy() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(function (item) {
        return normalize({
          id: item.id,
          src: item.src,
          thumb: item.src,
          tags: item.tags,
          createdAt: item.time,
          source: 'legacy',
          ownerType: 'user',
          ownerId: 'user'
        });
      });
    } catch (e) {
      return [];
    }
  }

  function readFallback() {
    try {
      const raw = localStorage.getItem(FALLBACK_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalize) : [];
    } catch (e) {
      return [];
    }
  }

  function writeFallback(list) {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(sortPhotos(list)));
      return true;
    } catch (e) {
      console.warn('Album fallback write failed:', e);
      return false;
    }
  }

  function openDB() {
    if (useFallback) return Promise.reject(new Error('IndexedDB fallback active'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        useFallback = true;
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('ownerType', 'ownerType', { unique: false });
          store.createIndex('ownerId', 'ownerId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error || new Error('IndexedDB open failed'));
      };
    }).catch(function (err) {
      useFallback = true;
      throw err;
    });
    return dbPromise;
  }

  function dbGetAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = function () {
          resolve((req.result || []).map(normalize));
        };
        req.onerror = function () {
          reject(req.error || new Error('IndexedDB read failed'));
        };
      });
    });
  }

  function dbPut(item) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = function () { resolve(item); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB write failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB write aborted')); };
      });
    });
  }

  function dbDelete(id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB delete failed')); };
      });
    });
  }

  async function readAll() {
    if (useFallback) return sortPhotos(readFallback());
    try {
      return sortPhotos(await dbGetAll());
    } catch (e) {
      useFallback = true;
      return sortPhotos(readFallback());
    }
  }

  async function putOne(item) {
    const normalized = normalize(item);
    if (useFallback) {
      const list = readFallback();
      const index = list.findIndex(function (p) { return p.id === normalized.id; });
      if (index >= 0) list[index] = normalized;
      else list.unshift(normalized);
      writeFallback(list);
      return normalized;
    }
    try {
      await dbPut(normalized);
      return normalized;
    } catch (e) {
      useFallback = true;
      return putOne(normalized);
    }
  }

  async function deleteOne(id) {
    if (useFallback) {
      const list = readFallback().filter(function (p) { return p.id !== id; });
      writeFallback(list);
      return;
    }
    try {
      await dbDelete(id);
    } catch (e) {
      useFallback = true;
      const list = readFallback().filter(function (p) { return p.id !== id; });
      writeFallback(list);
    }
  }

  async function migrateLegacyOnce() {
    try {
      if (localStorage.getItem(MIGRATION_FLAG) === '1') return;
      const legacy = readLegacy();
      for (const item of legacy) {
        await putOne(item);
      }
      localStorage.setItem(MIGRATION_FLAG, '1');
    } catch (e) {
      console.warn('Album legacy migration failed:', e);
    }
  }

  function init() {
    if (initPromise) return initPromise;
    initPromise = (async function () {
      try {
        await openDB();
      } catch (e) {
        useFallback = true;
      }
      await migrateLegacyOnce();
      cache = await readAll();
      return cache;
    })();
    return initPromise;
  }

  async function getAll() {
    await init();
    return cache.slice();
  }

  function getCached() {
    return cache ? cache.slice() : null;
  }

  async function add(item) {
    await init();
    const normalized = await putOne(item);
    if (cache) {
      const index = cache.findIndex(function (p) { return p.id === normalized.id; });
      if (index >= 0) cache[index] = normalized;
      else cache.unshift(normalized);
      cache = sortPhotos(cache);
    }
    return normalized;
  }

  async function update(id, patch) {
    await init();
    const current = (cache || []).find(function (p) { return p.id === id; });
    if (!current) return null;
    const next = normalize(Object.assign({}, current, patch, { id: id }));
    await putOne(next);
    if (cache) {
      const index = cache.findIndex(function (p) { return p.id === id; });
      if (index >= 0) cache[index] = next;
    }
    return next;
  }

  async function remove(id) {
    await init();
    await deleteOne(id);
    if (cache) cache = cache.filter(function (p) { return p.id !== id; });
  }

  function filterByOwner(list, ownerType, ownerId) {
    return (list || []).filter(function (p) {
      if (!ownerType || ownerType === 'all') return true;
      if (p.ownerType !== ownerType) return false;
      if (!ownerId) return true;
      return p.ownerId === ownerId;
    });
  }

  function listForOwner(ownerType, ownerId) {
    return filterByOwner(cache || readLegacy(), ownerType, ownerId);
  }

  window.AlbumStore = {
    init: init,
    getAll: getAll,
    getCached: getCached,
    add: add,
    update: update,
    remove: remove,
    listForOwner: listForOwner,
    readLegacy: readLegacy,
    filterByOwner: filterByOwner
  };

  // 启动即初始化：让没打开过相册页的聊天也能读到 IndexedDB 缓存
  init().catch(function () {});
})();
