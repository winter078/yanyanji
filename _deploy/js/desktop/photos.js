// ==========================================================================
// 相册 App v2：图库 / 相簿 / 搜索
// 存储交给 album-store.js（IndexedDB），这里只负责展示与交互
// ==========================================================================

const PHOTO_ALBUM_STORAGE_KEY = 'momo_photo_album_v1';
const ALBUM_OWNER_ALL = 'all';
const ALBUM_OWNER_USER = 'user';
const ALBUM_OWNER_SHARED = 'shared';
const ALBUM_OWNER_CHAR_PREFIX = 'char:';
const ALBUM_OWNER_GROUP_PREFIX = 'group:';

let albumView = 'grid'; // grid | albums | search
let albumOwnerFilter = ALBUM_OWNER_ALL;
let albumSearchQuery = '';
let albumSelectMode = false;
let albumSelectedIds = new Set();

function albumCharacters() {
  try {
    return typeof window.getCharacters === 'function' ? (window.getCharacters() || []) : [];
  } catch (e) {
    return [];
  }
}

function albumGroups() {
  try {
    return typeof window.getGroups === 'function' ? (window.getGroups() || []) : [];
  } catch (e) {
    return [];
  }
}

function albumActiveCharacter() {
  try {
    return typeof window.getActiveCharacter === 'function' ? window.getActiveCharacter() : null;
  } catch (e) {
    return null;
  }
}

function albumEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function albumToast(message) {
  if (typeof window.wxToast === 'function') {
    window.wxToast(message);
  } else {
    alert(message);
  }
}

function albumOwnerKeyOf(photo) {
  if (!photo) return ALBUM_OWNER_USER;
  if (photo.ownerType === 'shared') return ALBUM_OWNER_SHARED;
  if (photo.ownerType === 'char') return ALBUM_OWNER_CHAR_PREFIX + (photo.ownerId || '');
  if (photo.ownerType === 'group') return ALBUM_OWNER_GROUP_PREFIX + (photo.ownerId || '');
  return ALBUM_OWNER_USER;
}

function albumParseOwnerKey(key) {
  if (!key || key === ALBUM_OWNER_ALL) return { ownerType: ALBUM_OWNER_ALL, ownerId: '' };
  if (key === ALBUM_OWNER_SHARED) return { ownerType: 'shared', ownerId: 'shared' };
  if (key.indexOf(ALBUM_OWNER_CHAR_PREFIX) === 0) {
    return { ownerType: 'char', ownerId: key.slice(ALBUM_OWNER_CHAR_PREFIX.length) };
  }
  if (key.indexOf(ALBUM_OWNER_GROUP_PREFIX) === 0) {
    return { ownerType: 'group', ownerId: key.slice(ALBUM_OWNER_GROUP_PREFIX.length) };
  }
  return { ownerType: 'user', ownerId: 'user' };
}

function albumOwnerName(photo) {
  if (!photo) return '未归属旧图';
  if (photo.ownerType === 'shared') return '共享相簿';
  if (photo.ownerType === 'char') {
    const chars = albumCharacters();
    const found = chars.find(function (c) { return c.id === photo.ownerId; });
    return (found && found.name) || '角色相簿';
  }
  if (photo.ownerType === 'group') {
    const groups = albumGroups();
    const found = groups.find(function (g) { return g.id === photo.ownerId; });
    return (found && found.name) ? (found.name + ' · 群相簿') : '群相簿';
  }
  return '未归属旧图';
}

function albumCountLabel(count) {
  return count > 0 ? count + ' 张' : '空';
}

function albumNormalizeList(list) {
  return (list || []).slice().sort(function (a, b) {
    return new Date(b.createdAt || b.time || 0).getTime() - new Date(a.createdAt || a.time || 0).getTime();
  });
}

// 只用来判断“这张图是不是已经存过”。不要求密码学强度，只取长度 + 抽样哈希。
function albumImageFingerprint(src) {
  const s = String(src || '');
  if (!s) return '';
  let hash = 0;
  const step = Math.max(1, Math.floor(s.length / 2048));
  for (let i = 0; i < s.length; i += step) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return s.length + ':' + hash;
}
window.albumImageFingerprint = albumImageFingerprint;

// 同一个画面被重新压缩、重新发一次，字节会变；按 16x16 灰度均值做内容指纹，
// 用来拦住“同一张图发第二遍又存一张”。
function albumPerceptualFingerprint(src) {
  return new Promise(function (resolve) {
    if (!src || typeof src !== 'string') return resolve('');
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var size = 8;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        var data = ctx.getImageData(0, 0, size, size).data;
        var gray = [];
        var sum = 0;
        for (var i = 0; i < data.length; i += 4) {
          var g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          gray.push(g);
          sum += g;
        }
        var avg = sum / gray.length;
        var hex = '';
        var nibble = 0;
        var bits = 0;
        for (var j = 0; j < gray.length; j++) {
          nibble = (nibble << 1) | (gray[j] >= avg ? 1 : 0);
          bits++;
          if (bits === 4) {
            hex += nibble.toString(16);
            nibble = 0;
            bits = 0;
          }
        }
        resolve('p:' + hex);
      } catch (e) {
        resolve('r:' + albumImageFingerprint(src));
      }
    };
    img.onerror = function () { resolve('r:' + albumImageFingerprint(src)); };
    img.src = src;
  });
}
window.albumPerceptualFingerprint = albumPerceptualFingerprint;

// p: 指纹按 8x8 灰度均值生成，重新压缩会让极少数 bit 翻转；用 Hamming 距离兜住。
function albumPerceptualDistance(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (!a || !b || a.charAt(0) !== 'p' || b.charAt(0) !== 'p' || a.length !== b.length) return 999;
  var bitCount = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
  var dist = 0;
  for (var i = 2; i < a.length; i++) {
    var x = parseInt(a.charAt(i), 16);
    var y = parseInt(b.charAt(i), 16);
    if (isNaN(x) || isNaN(y)) return 999;
    dist += bitCount[x ^ y];
  }
  return dist;
}
window.albumPerceptualDistance = albumPerceptualDistance;

function getAlbumPhotos() {
  if (window.AlbumStore) {
    const cached = window.AlbumStore.getCached();
    if (cached) return albumNormalizeList(cached);
    return albumNormalizeList(window.AlbumStore.readLegacy());
  }
  try {
    const raw = localStorage.getItem(PHOTO_ALBUM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return albumNormalizeList(parsed.map(function (item) {
          return Object.assign({}, item, {
            tags: Array.isArray(item.tags) ? item.tags : [],
            ownerType: item.ownerType || 'user',
            ownerId: item.ownerId || 'user',
            createdAt: item.createdAt || item.time || new Date().toISOString(),
            caption: item.caption || '',
            scene: item.scene || ''
          });
        }));
      }
    }
  } catch (e) {}
  return [];
}

function getAlbumPhotosForCharacter(charId) {
  const list = getAlbumPhotos();
  return list.filter(function (p) {
    if (p.ownerType === 'shared') return true;
    return p.ownerType === 'char' && p.ownerId === charId;
  });
}

// 群聊用：只看角色自己的相簿，不掺全局共享，避免跨群串图。
function getAlbumPhotosForCharacterOnly(charId) {
  return getAlbumPhotos().filter(function (p) {
    return p.ownerType === 'char' && p.ownerId === charId;
  });
}

function getAlbumPhotosForGroup(groupId) {
  if (!groupId) return [];
  return getAlbumPhotos().filter(function (p) {
    return p.ownerType === 'group' && p.ownerId === groupId;
  });
}

function getAlbumCatalogForCharacter(charId, limit) {
  const list = getAlbumPhotosForCharacter(charId).slice(0, limit || 12);
  return list.map(function (p) {
    return {
      id: p.id,
      tags: p.tags || [],
      caption: p.caption || '',
      scene: p.scene || '',
      createdAt: p.createdAt || p.time || ''
    };
  });
}

function albumFilteredPhotos() {
  const list = getAlbumPhotos();
  const owner = albumParseOwnerKey(albumOwnerFilter);
  let result = list;
  if (owner.ownerType !== ALBUM_OWNER_ALL) {
    result = result.filter(function (p) {
      if (p.ownerType !== owner.ownerType) return false;
      if (!owner.ownerId) return true;
      return p.ownerId === owner.ownerId;
    });
  }
  const query = String(albumSearchQuery || '').trim().toLowerCase();
  if (query) {
    result = result.filter(function (p) {
      const haystack = [
        p.caption || '',
        p.scene || '',
        (p.tags || []).join(' '),
        albumOwnerName(p),
        p.createdAt || p.time || ''
      ].join(' ').toLowerCase();
      return haystack.indexOf(query) >= 0;
    });
  }
  return result;
}

function albumDayKey(iso) {
  const d = new Date(iso || 0);
  if (isNaN(d.getTime())) return 'unknown';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function albumDayLabel(iso) {
  const d = new Date(iso || 0);
  if (isNaN(d.getTime())) return '未知日期';
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((start.getTime() - target.getTime()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
}

function albumGroupByDay(list) {
  const groups = [];
  const map = new Map();
  (list || []).forEach(function (item) {
    const key = albumDayKey(item.createdAt || item.time);
    if (!map.has(key)) {
      const group = { key: key, label: albumDayLabel(item.createdAt || item.time), items: [] };
      map.set(key, group);
      groups.push(group);
    }
    map.get(key).items.push(item);
  });
  return groups;
}

function albumTileHtml(photo) {
  const selected = albumSelectedIds.has(photo.id);
  const check = selected ? '<span class="album-tile-check">✓</span>' : '';
  return '<button type="button" class="album-tile' + (selected ? ' is-selected' : '') + '" data-photo-id="' + albumEscape(photo.id) + '">' +
    '<img loading="lazy" src="' + albumEscape(photo.thumb || photo.src) + '" alt="">' +
    check +
    '</button>';
}

function albumPhotoGridHtml(list, ownerDetail) {
  const groups = albumGroupByDay(list);
  if (!groups.length) {
    const emptyAction = ownerDetail
      ? ''
      : '<button type="button" class="album-empty-btn" onclick="setAlbumTab(\'albums\')">去相簿添加</button>';
    const emptySub = ownerDetail
      ? '这本相簿还是空的，点上方“添加图片”加给这个角色。'
      : '还没有照片。去相簿，点开具体角色或群相簿再添加。';
    return '<div class="album-empty"><div class="album-empty-title">还没有照片</div><div class="album-empty-sub">' + emptySub + '</div>' + emptyAction + '</div>';
  }
  return groups.map(function (group) {
    return '<div class="album-date">' + albumEscape(group.label) + '</div>' +
      '<div class="album-grid">' + group.items.map(albumTileHtml).join('') + '</div>';
  }).join('');
}

function albumBindTiles(container) {
  container.querySelectorAll('.album-tile').forEach(function (el) {
    el.addEventListener('click', function () {
      handleAlbumTileClick(el.getAttribute('data-photo-id'));
    });
  });
}

function albumUpdateChrome() {
  const titleEl = document.getElementById('album-page-title');
  if (titleEl) {
    if (albumView === 'albums') {
      titleEl.innerText = '相簿';
    } else if (albumView === 'search') {
      titleEl.innerText = '搜索';
    } else if (albumOwnerFilter.indexOf(ALBUM_OWNER_CHAR_PREFIX) === 0) {
      const owner = albumParseOwnerKey(albumOwnerFilter);
      const found = albumCharacters().find(function (c) { return c.id === owner.ownerId; });
      titleEl.innerText = (found && found.name) || '相簿';
    } else if (albumOwnerFilter === ALBUM_OWNER_SHARED) {
      titleEl.innerText = '共享相簿';
    } else {
      titleEl.innerText = '相册';
    }
  }

  document.querySelectorAll('#album-filter [data-owner-filter]').forEach(function (el) {
    const key = el.getAttribute('data-owner-filter');
    let active = false;
    if (key === 'char') active = albumOwnerFilter.indexOf(ALBUM_OWNER_CHAR_PREFIX) === 0 || albumOwnerFilter === 'char';
    else if (key === 'all') active = albumOwnerFilter === ALBUM_OWNER_ALL;
    else active = albumOwnerFilter === key;
    el.classList.toggle('is-active', active);
  });

  document.querySelectorAll('.album-tab[data-album-tab]').forEach(function (el) {
    el.classList.toggle('is-active', el.getAttribute('data-album-tab') === albumView);
  });

  const filterEl = document.getElementById('album-filter');
  if (filterEl) filterEl.style.display = albumView === 'grid' ? 'flex' : 'none';

  const selectBtn = document.getElementById('album-select-btn');
  if (selectBtn) selectBtn.innerText = albumSelectMode ? '取消' : '选择';

  const tabbar = document.getElementById('album-tabbar');
  if (tabbar) tabbar.classList.toggle('is-selecting', albumSelectMode);
}

function albumUpdateSelectBar() {
  const bar = document.getElementById('album-selectbar');
  const count = document.getElementById('album-selected-count');
  if (bar) bar.classList.toggle('is-visible', albumSelectMode);
  if (count) count.innerText = '已选 ' + albumSelectedIds.size + ' 张';
}

async function renderPhotos() {
  const container = document.getElementById('album-content');
  if (!container) return;

  if (window.AlbumStore) {
    try {
      await window.AlbumStore.init();
    } catch (e) {
      console.warn('Album store init failed:', e);
    }
  }

  albumUpdateChrome();
  albumUpdateSelectBar();

  if (albumView === 'albums') {
    renderAlbumAlbums(container);
    return;
  }
  if (albumView === 'search') {
    renderAlbumSearch(container);
    return;
  }

  const list = albumFilteredPhotos();
  const ownerDetail = albumOwnerFilter.indexOf(ALBUM_OWNER_CHAR_PREFIX) === 0 || albumOwnerFilter.indexOf(ALBUM_OWNER_GROUP_PREFIX) === 0 || albumOwnerFilter === ALBUM_OWNER_SHARED;
  const ownerMeta = ownerDetail
    ? (albumOwnerFilter === ALBUM_OWNER_SHARED ? '所有角色可用' : albumOwnerFilter.indexOf(ALBUM_OWNER_GROUP_PREFIX) === 0 ? '仅本群可见' : '仅本人可见')
    : '全部照片';
  const addBtn = ownerDetail ? '<button type="button" class="album-owner-add" onclick="albumTriggerImport()">＋ 添加图片</button>' : '';
  container.innerHTML = '<div class="album-toolbar"><span>共 ' + list.length + ' 张</span><div class="album-toolbar-right"><span>' + ownerMeta + '</span>' + addBtn + '</div></div>' +
    albumPhotoGridHtml(list, ownerDetail);
  albumBindTiles(container);
}

function renderAlbumAlbums(container) {
  const list = getAlbumPhotos();
  const chars = albumCharacters();
  const groups = [];
  chars.forEach(function (c) {
    groups.push({ key: ALBUM_OWNER_CHAR_PREFIX + c.id, name: c.name || '未命名角色', ownerType: 'char', ownerId: c.id, avatar: c.avatar || '' });
  });
  albumGroups().forEach(function (g) {
    if (!g || !g.id) return;
    groups.push({ key: ALBUM_OWNER_GROUP_PREFIX + g.id, name: g.name || '未命名群聊', ownerType: 'group', ownerId: g.id, avatar: g.avatar || '' });
  });
  groups.push({ key: ALBUM_OWNER_SHARED, name: '共享相簿', ownerType: 'shared', ownerId: 'shared' });

  const html = '<div class="album-section-title">相簿</div><div class="album-albums">' + groups.map(function (group) {
    const photos = list.filter(function (p) {
      return p.ownerType === group.ownerType && (group.ownerId === 'shared' || p.ownerId === group.ownerId);
    });
    const cover = photos.slice(0, 4);
    let coverHtml = '';
    for (let i = 0; i < 4; i++) {
      const p = cover[i];
      coverHtml += p
        ? '<div class="album-cover-cell"><img loading="lazy" src="' + albumEscape(p.thumb || p.src) + '" alt=""></div>'
        : '<div class="album-cover-cell album-cover-empty"></div>';
    }
    return '<button type="button" class="album-card" data-album-owner="' + albumEscape(group.key) + '">' +
      '<div class="album-card-cover">' + coverHtml + '</div>' +
      '<div class="album-card-name">' + albumEscape(group.name) + '</div>' +
      '<div class="album-card-count">' + albumCountLabel(photos.length) + (group.ownerType === 'char' ? ' · 角色相簿' : group.ownerType === 'group' ? ' · 群相簿' : group.ownerType === 'shared' ? ' · 所有角色可用' : '') + '</div>' +
      '</button>';
  }).join('') + '</div>';

  container.innerHTML = html;
  container.querySelectorAll('[data-album-owner]').forEach(function (el) {
    el.addEventListener('click', function () {
      openAlbumOwner(el.getAttribute('data-album-owner'));
    });
  });
}

function renderAlbumSearch(container) {
  const tags = [];
  getAlbumPhotos().forEach(function (p) {
    (p.tags || []).forEach(function (t) {
      if (tags.indexOf(t) < 0) tags.push(t);
    });
  });
  const tagHtml = tags.slice(0, 12).map(function (tag) {
    return '<button type="button" class="album-tag-chip" data-search-tag="' + albumEscape(tag) + '">' + albumEscape(tag) + '</button>';
  }).join('');

  container.innerHTML =
    '<div class="album-search-wrap">' +
      '<input id="album-search-input" class="album-search-input" type="search" placeholder="搜索照片、标签、角色" value="' + albumEscape(albumSearchQuery) + '">' +
    '</div>' +
    (tagHtml ? '<div class="album-tag-row">' + tagHtml + '</div>' : '') +
    '<div id="album-search-results"></div>';

  const input = document.getElementById('album-search-input');
  if (input) {
    input.addEventListener('input', function () {
      albumSearchQuery = input.value;
      renderAlbumSearchResults();
    });
    setTimeout(function () { if (albumView === 'search') input.focus(); }, 60);
  }
  container.querySelectorAll('[data-search-tag]').forEach(function (el) {
    el.addEventListener('click', function () {
      albumSearchQuery = el.getAttribute('data-search-tag') || '';
      const inputEl = document.getElementById('album-search-input');
      if (inputEl) inputEl.value = albumSearchQuery;
      renderAlbumSearchResults();
    });
  });
  renderAlbumSearchResults();
}

function renderAlbumSearchResults() {
  const target = document.getElementById('album-search-results');
  if (!target) return;
  const list = albumFilteredPhotos();
  target.innerHTML = list.length
    ? albumPhotoGridHtml(list)
    : '<div class="album-empty"><div class="album-empty-title">没有找到</div><div class="album-empty-sub">换个标签，或者去图库里翻翻。</div></div>';
  albumBindTiles(target);
}

function setAlbumTab(tab) {
  if (tab !== 'grid' && tab !== 'albums' && tab !== 'search') return;
  albumView = tab;
  albumSelectMode = false;
  albumSelectedIds.clear();
  if (tab === 'albums' || tab === 'search') {
    albumSearchQuery = '';
  }
  renderPhotos();
}

function setAlbumOwnerFilter(key) {
  if (key === 'char') {
    albumOwnerFilter = 'char';
  } else {
    albumOwnerFilter = key || ALBUM_OWNER_ALL;
  }
  albumSelectMode = false;
  albumSelectedIds.clear();
  renderPhotos();
}

function openAlbumOwner(key) {
  albumView = 'grid';
  albumOwnerFilter = key || ALBUM_OWNER_ALL;
  albumSelectMode = false;
  albumSelectedIds.clear();
  renderPhotos();
  backfillAlbumVision(albumOwnerFilter, 3);
  const scroll = document.getElementById('album-content');
  if (scroll) scroll.scrollTop = 0;
}

function handleAlbumTileClick(photoId) {
  const photo = getAlbumPhotos().find(function (p) { return p.id === photoId; });
  if (!photo) return;

  if (albumSelectMode) {
    if (albumSelectedIds.has(photoId)) albumSelectedIds.delete(photoId);
    else albumSelectedIds.add(photoId);
    const tile = document.querySelector('.album-tile[data-photo-id="' + photoId + '"]');
    if (tile) {
      tile.classList.toggle('is-selected', albumSelectedIds.has(photoId));
      const oldCheck = tile.querySelector('.album-tile-check');
      if (oldCheck) oldCheck.remove();
      if (albumSelectedIds.has(photoId)) {
        const check = document.createElement('span');
        check.className = 'album-tile-check';
        check.innerText = '✓';
        tile.appendChild(check);
      }
    }
    albumUpdateSelectBar();
    return;
  }

  if (typeof openFullImageModal === 'function') {
    openFullImageModal(photo.src, {
      source: 'album',
      photoId: photo.id,
      tags: photo.tags || [],
      caption: photo.caption || '',
      ownerName: albumOwnerName(photo),
      ownerType: photo.ownerType || 'user'
    });
  }
}

function toggleAlbumSelectMode() {
  albumSelectMode = !albumSelectMode;
  albumSelectedIds.clear();
  renderPhotos();
}

function albumTriggerImport() {
  const input = document.getElementById('album-import-input');
  if (input) input.click();
}

function albumImportTargetOwner() {
  const owner = albumParseOwnerKey(albumOwnerFilter);
  if (owner.ownerType === 'char') {
    if (owner.ownerId) return { ownerType: 'char', ownerId: owner.ownerId };
    // 停在“角色”筛选页但还没点开具体角色时，默认进当前角色相簿
    const active = typeof window.getActiveCharacter === 'function' ? window.getActiveCharacter() : null;
    if (active && active.id) return { ownerType: 'char', ownerId: active.id };
  }
  if (owner.ownerType === 'shared') {
    return { ownerType: 'shared', ownerId: 'shared' };
  }
  if (owner.ownerType === 'group') {
    if (owner.ownerId) return { ownerType: 'group', ownerId: owner.ownerId };
  }
  // “全部”页导入进当前角色；没有当前角色就进共享。相册只服务角色，不再有“我的”落点
  const active = typeof window.getActiveCharacter === 'function' ? window.getActiveCharacter() : null;
  if (active && active.id) return { ownerType: 'char', ownerId: active.id };
  return { ownerType: 'shared', ownerId: 'shared' };
}

function albumReadFileAsDataURL(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onerror = function () { reject(new Error('读取图片失败')); };
    reader.onload = function (evt) { resolve(evt.target.result); };
    reader.readAsDataURL(file);
  });
}

async function importAlbumFiles(event) {
  const input = event && event.target;
  const files = Array.from((input && input.files) || []);
  if (input) input.value = '';
  if (!files.length) return;

  const target = albumImportTargetOwner();
  let ok = 0;
  for (const file of files) {
    try {
      const src = await albumReadFileAsDataURL(file);
      await savePhotoToAlbum(src, [], true, {
        ownerType: target.ownerType,
        ownerId: target.ownerId,
        source: 'import'
      });
      ok++;
    } catch (e) {
      console.warn('Album import failed:', e);
    }
  }
  if (ok > 0) {
    if (target.ownerType === 'shared') albumToast('已导入 ' + ok + ' 张到共享相簿');
    else if (target.ownerType === 'group') albumToast('已导入 ' + ok + ' 张到「' + albumOwnerName({ ownerType: 'group', ownerId: target.ownerId }) + '」');
    else albumToast('已导入 ' + ok + ' 张到「' + albumOwnerName({ ownerType: 'char', ownerId: target.ownerId }) + '」的角色相簿');
  }
  renderPhotos();
}

async function albumJoinMoment() {
  const selected = getAlbumPhotos().filter(function (p) { return albumSelectedIds.has(p.id); });
  if (!selected.length) return;
  if (typeof window.openMomentComposerWithPhotos === 'function') {
    window.openMomentComposerWithPhotos(selected.map(function (p) { return p.src; }));
    albumSelectMode = false;
    albumSelectedIds.clear();
    renderPhotos();
  } else {
    albumToast('朋友圈编辑器还没接上，先记着这 ' + selected.length + ' 张。');
  }
}

async function albumDeleteSelected() {
  const ids = Array.from(albumSelectedIds);
  if (!ids.length) return;
  if (!confirm('确定删除选中的 ' + ids.length + ' 张照片吗？')) return;
  for (const id of ids) {
    try {
      await deletePhotoFromAlbum(id);
    } catch (e) {}
  }
  albumSelectedIds.clear();
  albumSelectMode = false;
  renderPhotos();
}

function albumAssignSelected() {
  const ids = Array.from(albumSelectedIds);
  if (!ids.length) return;
  const chars = albumCharacters();
  const targets = [
    { key: ALBUM_OWNER_SHARED, name: '共享相簿' }
  ].concat(chars.map(function (c) {
    return { key: ALBUM_OWNER_CHAR_PREFIX + c.id, name: c.name || '未命名角色' };
  }));

  const old = document.getElementById('album-owner-picker');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'album-owner-picker';
  modal.className = 'album-picker-mask';
  modal.innerHTML =
    '<div class="album-picker-card" role="dialog" aria-label="移动到相簿">' +
      '<div class="album-picker-title">把选中的 ' + ids.length + ' 张移到</div>' +
      '<div class="album-picker-list">' + targets.map(function (t) {
        return '<button type="button" class="album-picker-item" data-assign-owner="' + albumEscape(t.key) + '">' + albumEscape(t.name) + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="album-picker-cancel" onclick="closeAlbumOwnerPicker()">取消</button>' +
    '</div>';
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeAlbumOwnerPicker();
  });
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-assign-owner]').forEach(function (el) {
    el.addEventListener('click', function () {
      confirmAlbumAssign(el.getAttribute('data-assign-owner'));
    });
  });
}

function closeAlbumOwnerPicker() {
  const modal = document.getElementById('album-owner-picker');
  if (modal) modal.remove();
}

async function confirmAlbumAssign(ownerKey) {
  const ids = Array.from(albumSelectedIds);
  if (!ids.length) return;
  const owner = albumParseOwnerKey(ownerKey);
  for (const id of ids) {
    try {
      const updated = await window.AlbumStore.update(id, { ownerType: owner.ownerType, ownerId: owner.ownerId });
      if (updated && owner.ownerType !== 'user') enqueueAlbumVision(updated);
    } catch (e) {}
  }
  closeAlbumOwnerPicker();
  albumSelectedIds.clear();
  albumSelectMode = false;
  renderPhotos();
}

function compressSrcToAlbum(src, maxWidth, quality) {
  maxWidth = maxWidth || 720;
  quality = quality || 0.78;
  return new Promise(function (resolve) {
    if (!src || typeof src !== 'string') return resolve('');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        resolve(src);
      }
    };
    img.onerror = function () { resolve(src); };
    img.src = src;
  });
}

async function makeAlbumImage(src) {
  const full = await compressSrcToAlbum(src, 1080, 0.82);
  const thumb = await compressSrcToAlbum(full, 360, 0.72);
  return { src: full, thumb: thumb || full };
}

// 存进角色 / 共享相簿时识一次图，把结果写成 caption / scene / 补充标签。
// 聊天和发动态只读这些文字，不再每轮把图片塞给模型。
const albumVisionQueue = [];
let albumVisionRunning = false;
const albumVisionPending = new Set();

function albumVisionApi() {
  const app = window.appData || {};
  const key = String(app.apiKey || '').trim();
  const base = String(app.apiBase || '').trim();
  // 和聊天看图同一套路由：优先识图专属模型；主模型是 DeepSeek 时不拿它识图
  let model = String(app.visionModel || '').trim();
  if (!model) {
    model = '[AG]gemini-3.8-flash-tiered';
    if (app.model && !/deepseek|r1/i.test(String(app.model))) model = String(app.model).trim();
  }
  if (!key || !base || !model) return null;
  let url = base.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) url += '/chat/completions';
  return { key: key, url: url, model: model };
}

function parseAlbumVisionReply(text) {
  let s = String(text || '').trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(s.slice(start, end + 1));
    const caption = String(obj.caption || '').trim().slice(0, 160);
    const scene = String(obj.scene || '').trim().slice(0, 80);
    let tags = obj.tags;
    if (typeof tags === 'string') tags = tags.split(/[,，、\s]+/);
    tags = Array.isArray(tags) ? tags.map(function (t) { return String(t || '').trim(); }).filter(Boolean).slice(0, 6) : [];
    if (!caption && !tags.length) return null;
    return { caption: caption, scene: scene, tags: tags };
  } catch (e) { return null; }
}

async function requestAlbumVision(photo) {
  const api = albumVisionApi();
  if (!api) return null;
  const image = photo.thumb || photo.src;
  if (!image || !/^data:image\//.test(image)) return null;
  const prompt = '你是手机相簿整理助手。看这张图，用中文输出严格 JSON：\n' +
    '{"caption":"一句具体描述：谁/什么 + 动作 + 场景 + 画面风格，不要“这张图”这种空话","scene":"适合在聊天里什么时候发，20字内","tags":["3-6个具体标签"]}\n' +
    '只输出 JSON，不要 markdown，不要解释。不要把图中人物认成现实中的真人，不要猜姓名。';
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 30000);
  try {
    const res = await fetch(api.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + api.key
      },
      body: JSON.stringify({
        model: api.model,
        stream: false,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          { role: 'system', content: '你只负责客观描述图片内容，输出 JSON。' },
          { role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } }
          ] }
        ]
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    let content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (Array.isArray(content)) content = content.map(function (c) { return c && c.text ? c.text : ''; }).join('');
    return parseAlbumVisionReply(content);
  } catch (e) {
    console.warn('[相簿识图] 失败，保留原标签:', e && e.message ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function enrichAlbumPhoto(photo, force) {
  if (!photo || !photo.id || photo.ownerType === 'user') return null;
  if (albumVisionPending.has(photo.id)) return null;
  albumVisionPending.add(photo.id);
  try {
    const current = getAlbumPhotos().find(function (p) { return p.id === photo.id; }) || photo;
    if (current.caption && current.scene && !force) return current;
    const parsed = await requestAlbumVision(current);
    if (!parsed) return null;
    const oldTags = Array.isArray(current.tags) ? current.tags : [];
    const tags = oldTags.concat(parsed.tags).map(function (t) { return String(t || '').trim(); }).filter(Boolean);
    const uniq = tags.filter(function (t, i) { return tags.indexOf(t) === i; }).slice(0, 12);
    const next = Object.assign({}, current, {
      caption: parsed.caption || current.caption || '',
      scene: parsed.scene || current.scene || '',
      tags: uniq,
      visionAt: new Date().toISOString()
    });
    if (window.AlbumStore && typeof window.AlbumStore.update === 'function') {
      await window.AlbumStore.update(photo.id, next);
    } else {
      const list = getAlbumPhotos().map(function (p) { return p.id === photo.id ? next : p; });
      localStorage.setItem(PHOTO_ALBUM_STORAGE_KEY, JSON.stringify(list));
    }
    renderPhotos();
    return next;
  } finally {
    albumVisionPending.delete(photo.id);
  }
}

function enqueueAlbumVision(photo) {
  if (!photo || !photo.id || photo.ownerType === 'user') return;
  albumVisionQueue.push(photo);
  runAlbumVisionQueue();
}

window.enrichAlbumPhotoById = function (id, force) {
  const photo = getAlbumPhotos().find(function (p) { return p.id === id; });
  if (!photo || photo.ownerType === 'user') return Promise.resolve(null);
  return enrichAlbumPhoto(photo, !!force);
};

async function runAlbumVisionQueue() {
  if (albumVisionRunning) return;
  albumVisionRunning = true;
  try {
    while (albumVisionQueue.length) {
      const photo = albumVisionQueue.shift();
      await enrichAlbumPhoto(photo);
    }
  } finally {
    albumVisionRunning = false;
  }
}

function backfillAlbumVision(ownerKey, limit) {
  const owner = albumParseOwnerKey(ownerKey);
  if (owner.ownerType !== 'char' && owner.ownerType !== 'shared' && owner.ownerType !== 'group') return;
  const list = getAlbumPhotos().filter(function (p) {
    if (owner.ownerType === 'shared') return p.ownerType === 'shared' && !p.caption;
    if (owner.ownerType === 'group') return p.ownerType === 'group' && p.ownerId === owner.ownerId && !p.caption;
    return p.ownerType === 'char' && p.ownerId === owner.ownerId && !p.caption;
  }).slice(0, limit || 3);
  list.forEach(enqueueAlbumVision);
}

async function savePhotoToAlbum(src, tags, silent, options) {
  tags = Array.isArray(tags) ? tags : [];
  options = options || {};
  try {
    if (!src) return null;
    const prepared = await makeAlbumImage(src);
    const ownerType = options.ownerType || 'user';
    const ownerId = options.ownerId || (ownerType === 'shared' ? 'shared' : ownerType === 'char' ? (options.characterId || 'unknown') : 'user');
    const item = {
      id: 'ph_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      src: prepared.src,
      thumb: prepared.thumb,
      tags: tags,
      caption: options.caption || '',
      scene: options.scene || '',
      ownerType: ownerType,
      ownerId: ownerId,
      source: options.source || 'chat',
      fingerprint: options.fingerprint || albumImageFingerprint(src),
      createdAt: new Date().toISOString(),
      time: new Date().toISOString()
    };

    if (window.AlbumStore) {
      await window.AlbumStore.add(item);
    } else {
      const list = getAlbumPhotos();
      list.unshift(item);
      localStorage.setItem(PHOTO_ALBUM_STORAGE_KEY, JSON.stringify(list));
    }

    if (!silent) albumToast('已保存到相簿');
    renderPhotos();
    if (ownerType !== 'user' && !options.skipVision) enqueueAlbumVision(item);
    return item;
  } catch (err) {
    console.error('Save photo failed:', err);
    if (!silent) albumToast('保存失败：' + (err && err.message ? err.message : '未知错误'));
    return null;
  }
}

async function updatePhotoTags(photoId, tags) {
  try {
    const current = getAlbumPhotos().find(function (p) { return p.id === photoId; });
    if (!current) return null;
    const next = Object.assign({}, current, { tags: Array.isArray(tags) ? tags : [] });
    if (window.AlbumStore && typeof window.AlbumStore.update === 'function') {
      await window.AlbumStore.update(photoId, next);
    } else {
      const list = getAlbumPhotos().map(function (p) { return p.id === photoId ? next : p; });
      localStorage.setItem(PHOTO_ALBUM_STORAGE_KEY, JSON.stringify(list));
    }
    renderPhotos();
    return next;
  } catch (err) {
    console.error('Update photo tags failed:', err);
    return null;
  }
}

async function deletePhotoFromAlbum(photoId) {
  try {
    if (window.AlbumStore) {
      await window.AlbumStore.remove(photoId);
    } else {
      const list = getAlbumPhotos().filter(function (p) { return p.id !== photoId; });
      localStorage.setItem(PHOTO_ALBUM_STORAGE_KEY, JSON.stringify(list));
    }
    const modal = document.getElementById('full-image-preview-modal');
    if (modal) modal.style.display = 'none';
    renderPhotos();
  } catch (err) {
    console.error('Delete photo failed:', err);
    albumToast('删除失败：' + (err && err.message ? err.message : '未知错误'));
  }
}
