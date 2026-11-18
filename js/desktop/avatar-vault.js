// =========================================================
// 头像库核心逻辑 (js/desktop/avatar-vault.js)
// 两栏：我的头像 / 角色头像（按通讯录角色独立保存）
// 角色头像带「情绪」字段，角色聊天中可按情绪请求换上
// =========================================================

const VAULT_KEY_MOMO = 'momo_vault_list_momo_v2';
const VAULT_KEY_XUYAN_LEGACY = 'momo_vault_list_xuyan_v2';
const VAULT_CHAR_KEY_PREFIX = 'momo_vault_char_';
const VAULT_CURRENT_TAB = 'momo_vault_active_tab_v2';
const VAULT_CURRENT_CHAR = 'momo_vault_current_char_v1';

let currentVaultTab = 'momo'; // 'momo' | 'xuyan'
let currentVaultCharId = '';
let tempUploadedBase64 = null;
let pendingAvatarChangeResolve = null;

const DEFAULT_MOMO_AVATARS = [
  {
    id: 'av_momo_1',
    name: '软萌紫发 · 画画日常',
    tag: '日常',
    emotion: '日常',
    tagClass: '',
    note: '安静专注的日常瞬间。',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_momo_2',
    name: '微卷长发 · 温柔侧颜',
    tag: '约会',
    emotion: '约会',
    tagClass: 'badge-happy',
    note: '温和柔润的侧颜光影。',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_momo_3',
    name: '搞怪小猫 · 贴贴脸',
    tag: '撒娇专用',
    emotion: '撒娇',
    tagClass: 'badge-couple',
    note: '活泼搞怪的小表情。',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_momo_4',
    name: '慵懒冬日 · 暖绒围巾',
    tag: '冬日手帖',
    emotion: '冬日',
    tagClass: '',
    note: '冬日里温暖柔和的围巾装扮。',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=80'
  }
];

// 仅用于「周绪言」这个角色的首次迁移，不会套到其他角色身上
const DEFAULT_XUYAN_AVATARS = [
  {
    id: 'av_xuyan_1',
    name: '清爽黑发 · 白衬衫日常',
    tag: '日常温润',
    emotion: '日常温润',
    tagClass: '',
    note: '安静温和的日常衬衫形象。',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_xuyan_2',
    name: '金丝眼镜 · 斯文正装',
    tag: '清冷教授',
    emotion: '清冷教授',
    tagClass: '',
    note: '专注认真、斯文清俊的姿态。',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_xuyan_3',
    name: '别过头去 · 黑白大衣背影',
    tag: '生闷气/吃醋专用',
    emotion: '生闷气/吃醋',
    tagClass: 'badge-angry',
    note: '略带清冷的大衣背影。',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_xuyan_4',
    name: '雨天灰蓝 · 围巾埋着下巴',
    tag: '委屈/求关注',
    emotion: '委屈/求关注',
    tagClass: 'badge-angry',
    note: '雨天灰蓝调的安静氛围。',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_xuyan_5',
    name: '微扬唇角 · 逆光侧颜',
    tag: '被夸偷乐',
    emotion: '被夸偷乐',
    tagClass: 'badge-happy',
    note: '微扬唇角、柔和清澈的侧颜。',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_xuyan_6',
    name: '纯黑高定西装 · 挺拔正装',
    tag: '正装护妻',
    emotion: '正装护妻',
    tagClass: 'badge-couple',
    note: '沉稳可靠、修身挺拔的正装。',
    url: 'https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=400&auto=format&fit=crop&q=80'
  }
];

function vaultSafeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function vaultCharacters() {
  try {
    return (typeof window.getCharacters === 'function' && window.getCharacters()) || [];
  } catch (e) {
    return [];
  }
}

function vaultFindChar(id) {
  if (!id) return null;
  const list = vaultCharacters();
  return list.find(function (c) { return c && c.id === id; }) || null;
}

function vaultActiveCharId() {
  try {
    return localStorage.getItem('momo_active_char') || '';
  } catch (e) {
    return '';
  }
}

function vaultResolveCharId() {
  if (currentVaultCharId && vaultFindChar(currentVaultCharId)) return currentVaultCharId;
  const stored = (function () {
    try { return localStorage.getItem(VAULT_CURRENT_CHAR) || ''; } catch (e) { return ''; }
  })();
  if (stored && vaultFindChar(stored)) {
    currentVaultCharId = stored;
    return stored;
  }
  const active = vaultActiveCharId();
  if (active && vaultFindChar(active)) {
    currentVaultCharId = active;
    return active;
  }
  const first = vaultCharacters()[0];
  currentVaultCharId = (first && first.id) || '';
  return currentVaultCharId;
}

function vaultCharStorageKey(charId) {
  return VAULT_CHAR_KEY_PREFIX + String(charId || '') + '_v1';
}

function normalizeVaultAvatar(item) {
  const out = Object.assign({}, item || {});
  out.emotion = String(out.emotion || out.tag || '').trim();
  out.tag = String(out.tag || out.emotion || '日常').trim();
  out.tagClass = out.tagClass || '';
  out.note = out.note || '';
  return out;
}

function loadMomoList() {
  let list = [];
  try {
    const raw = localStorage.getItem(VAULT_KEY_MOMO);
    if (raw) list = vaultSafeParse(raw, DEFAULT_MOMO_AVATARS);
  } catch (e) {}
  if (!list.length) {
    list = DEFAULT_MOMO_AVATARS.slice();
    saveMomoList(list);
  }
  return list.map(normalizeVaultAvatar);
}

function saveMomoList(list) {
  try {
    localStorage.setItem(VAULT_KEY_MOMO, JSON.stringify(list || []));
  } catch (e) {
    console.error('保存我的头像库失败', e);
  }
}

function loadCharVaultList(charId) {
  if (!charId) return [];
  const key = vaultCharStorageKey(charId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) return vaultSafeParse(raw, []).map(normalizeVaultAvatar);
  } catch (e) {}

  const char = vaultFindChar(charId);
  // 老「角色专用」库只迁给名字里带“绪言”的角色，其他角色从空库开始
  if (char && /绪言/.test(char.name || '')) {
    let legacy = [];
    try {
      const rawLegacy = localStorage.getItem(VAULT_KEY_XUYAN_LEGACY);
      if (rawLegacy) legacy = vaultSafeParse(rawLegacy, []);
    } catch (e) {}
    if (!legacy.length) legacy = DEFAULT_XUYAN_AVATARS.slice();
    legacy = legacy.map(normalizeVaultAvatar);
    saveCharVaultList(charId, legacy);
    return legacy;
  }
  return [];
}

function saveCharVaultList(charId, list) {
  if (!charId) return;
  try {
    localStorage.setItem(vaultCharStorageKey(charId), JSON.stringify(list || []));
  } catch (e) {
    console.error('保存角色头像库失败', e);
  }
}

function loadVaultList(who) {
  if (who === 'momo') return loadMomoList();
  return loadCharVaultList(vaultResolveCharId());
}

function saveVaultList(who, list) {
  if (who === 'momo') saveMomoList(list);
  else saveCharVaultList(vaultResolveCharId(), list);
}

function initVaultState() {
  try {
    const storedTab = localStorage.getItem(VAULT_CURRENT_TAB);
    currentVaultTab = (storedTab === 'xuyan') ? 'xuyan' : 'momo';
  } catch (e) {
    currentVaultTab = 'momo';
  }
  vaultResolveCharId();
}

function switchVaultTab(tab) {
  if (tab !== 'momo' && tab !== 'xuyan') tab = 'momo';
  currentVaultTab = tab;
  try { localStorage.setItem(VAULT_CURRENT_TAB, tab); } catch (e) {}
  const btnMomo = document.getElementById('vault-tab-momo');
  const btnXuyan = document.getElementById('vault-tab-xuyan');
  if (btnMomo) btnMomo.classList.toggle('active', tab === 'momo');
  if (btnXuyan) btnXuyan.classList.toggle('active', tab === 'xuyan');
  renderVaultView();
}

function vaultCurrentAvatarUrl() {
  if (currentVaultTab === 'momo') {
    return (window.appData && window.appData.heroAvatar) || '';
  }
  const char = vaultFindChar(vaultResolveCharId());
  if (char && char.avatar) return char.avatar;
  if (window.appData && window.appData.botAvatar) return window.appData.botAvatar;
  return '';
}

function renderVaultView() {
  const container = document.getElementById('vault-grid-container');
  if (!container) return;

  if (currentVaultTab !== 'xuyan') currentVaultTab = 'momo';
  renderVaultCurrentHero();

  const isMomo = (currentVaultTab === 'momo');
  const currentAvatarUrl = vaultCurrentAvatarUrl();
  const list = isMomo ? loadMomoList() : loadCharVaultList(vaultResolveCharId());

  if (!isMomo && !vaultResolveCharId()) {
    container.innerHTML =
      '<div class="vault-empty-state">' +
        '<div class="vault-empty-icon">🎭</div>' +
        '<div class="vault-empty-title">通讯录里还没有角色</div>' +
        '<div class="vault-empty-sub">先去通讯录添加一个角色，再回来给 TA 建头像库。</div>' +
      '</div>';
    return;
  }

  if (list.length === 0) {
    container.innerHTML =
      '<div class="vault-empty-state">' +
        '<div class="vault-empty-icon">🖼️</div>' +
        '<div class="vault-empty-title">' + (isMomo ? '还没有存过我的头像' : '这个角色还没有头像') + '</div>' +
        '<div class="vault-empty-sub">' + (isMomo ? '点击下方按钮，挑一张自己的头像入库。' : '给 TA 上传头像时记得写清「情绪」，聊天里才换得上。') + '</div>' +
      '</div>';
    return;
  }

  let html = '';
  list.forEach(function (item) {
    const isCurrent = !!(currentAvatarUrl && String(currentAvatarUrl).trim() === String(item.url || '').trim());
    const currentMark = isCurrent ? '<div class="vault-active-mark">✓</div>' : '';
    const badgeClass = item.tagClass || '';
    const emotionText = item.emotion || item.tag || '情绪';
    const actionLabel = isCurrent ? '使用中' : (isMomo ? '设为我的头像' : '设为 TA 的头像');
    const deleteType = isMomo ? 'momo' : 'xuyan';

    html +=
      '<div class="vault-photo-card ' + (isCurrent ? 'is-current' : '') + '">' +
        '<div class="vault-photo-delete-btn" onclick="event.stopPropagation(); deleteVaultItem(\'' + deleteType + '\', \'' + item.id + '\')" title="删除这张头像">✕</div>' +
        '<div class="vault-photo-img-wrap" onclick="previewVaultAvatar(\'' + String(item.url || '').replace(/'/g, "\\'") + '\')">' +
          '<img src="' + item.url + '" alt="' + escapeVaultHtml(item.name) + '" onerror="this.src=\'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400\'" />' +
          '<div class="vault-photo-badge ' + badgeClass + '">' + escapeVaultHtml(emotionText) + '</div>' +
          currentMark +
        '</div>' +
        '<div class="vault-photo-meta">' +
          '<div class="vault-photo-name">' + escapeVaultHtml(item.name) + '</div>' +
          '<div class="vault-photo-note">' + escapeVaultHtml(item.note || '') + '</div>' +
        '</div>' +
        '<div class="vault-photo-actions">' +
          '<button type="button" class="vault-action-btn vault-btn-apply" onclick="applyVaultAvatar(\'' + deleteType + '\', \'' + item.id + '\')">' +
            '<span>✨</span> <span>' + actionLabel + '</span>' +
          '</button>' +
        '</div>' +
      '</div>';
  });

  container.innerHTML = html;
}

function renderVaultCurrentHero() {
  const img = document.getElementById('vault-current-img');
  const nameEl = document.getElementById('vault-current-name');
  const tagEl = document.getElementById('vault-current-tag');
  const switchBtn = document.getElementById('vault-switch-char-btn');

  if (currentVaultTab === 'momo') {
    const currentMomo = (window.appData && window.appData.heroAvatar) ||
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160';
    if (img) img.src = currentMomo;
    if (nameEl) nameEl.innerText = '我的当前头像';
    if (tagEl) tagEl.innerText = '微信 / 主页 / 朋友圈同步中';
    if (switchBtn) switchBtn.style.display = 'none';
    return;
  }

  const char = vaultFindChar(vaultResolveCharId());
  const currentUrl = (char && char.avatar) || (window.appData && window.appData.botAvatar) ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160';
  if (img) img.src = currentUrl;
  if (nameEl) nameEl.innerText = char ? (char.name + '的当前头像') : '角色当前头像';

  let emotion = '';
  if (char) {
    const list = loadCharVaultList(char.id);
    const hit = list.find(function (it) { return String(it.url || '').trim() === String(currentUrl).trim(); });
    if (hit) emotion = hit.emotion || hit.tag || '';
  }
  if (tagEl) tagEl.innerText = emotion ? ('当前情绪：' + emotion + ' · 对话 / 名片同步中') : '对话 / 名片同步中';
  if (switchBtn) switchBtn.style.display = 'flex';
}

function syncAllMomoAvatarsInDOM(url) {
  const ids = [
    'hero-avatar-img',
    'me-page-avatar-preview',
    'moments-user-avatar',
    'wechat-me-avatar',
    'watch-bar-avatar-momo',
    'music-avatar-user',
    'gallery-creator-avatar-img'
  ];
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.src = url;
  });
  if (typeof loadChatHistory === 'function') loadChatHistory();
}

function applySelfAvatar(url) {
  if (window.appData) window.appData.heroAvatar = url;
  try {
    localStorage.setItem('momo_hero_avatar', url);
    const hero = JSON.parse(localStorage.getItem('momo_hero_data') || '{}');
    hero.userAvatar = url;
    localStorage.setItem('momo_hero_data', JSON.stringify(hero));
  } catch (e) {}
  syncAllMomoAvatarsInDOM(url);
}

function applyCharacterAvatar(charId, url) {
  if (!charId || !url) return false;
  if (typeof window.updateCharacterAvatar === 'function') {
    return window.updateCharacterAvatar(charId, url);
  }

  // 兜底：characters.js 不在时直接写角色卡
  const chars = vaultCharacters();
  const c = chars.find(function (it) { return it && it.id === charId; });
  if (!c) return false;
  c.avatar = url;
  try {
    localStorage.setItem('momo_characters', JSON.stringify(chars));
    localStorage.setItem('momo_bot_avatar', url);
  } catch (e) {}
  if (window.appData) window.appData.botAvatar = url;
  if (typeof window.renderContacts === 'function') window.renderContacts();
  if (typeof window.renderWechatSessions === 'function') window.renderWechatSessions();
  if (typeof loadChatHistory === 'function') loadChatHistory();
  return true;
}

function applyVaultAvatar(who, avatarId) {
  const isMomo = (who === 'momo');
  const list = isMomo ? loadMomoList() : loadCharVaultList(vaultResolveCharId());
  const target = list.find(function (item) { return item.id === avatarId; });
  if (!target) return;

  if (isMomo) {
    applySelfAvatar(target.url);
  } else {
    const charId = vaultResolveCharId();
    if (!charId) {
      alert('通讯录里还没有角色，先添加一个角色吧。');
      return;
    }
    applyCharacterAvatar(charId, target.url);
  }
  renderVaultView();
}

function deleteVaultItem(who, id) {
  if (!confirm('确定要从头像库删除这张头像吗？')) return;
  let list = (who === 'momo') ? loadMomoList() : loadCharVaultList(vaultResolveCharId());
  list = list.filter(function (item) { return item.id !== id; });
  if (who === 'momo') saveMomoList(list);
  else saveCharVaultList(vaultResolveCharId(), list);
  renderVaultView();
}

function openVaultCharDrawer() {
  const mask = document.getElementById('vault-char-drawer');
  if (!mask) return;
  renderVaultCharDrawer();
  mask.classList.add('open');
}

function closeVaultCharDrawer() {
  const mask = document.getElementById('vault-char-drawer');
  if (mask) mask.classList.remove('open');
}

function renderVaultCharDrawer() {
  const box = document.getElementById('vault-char-list');
  if (!box) return;
  const chars = vaultCharacters();
  const selectedId = vaultResolveCharId();

  if (!chars.length) {
    box.innerHTML =
      '<div class="vault-char-empty">通讯录里还没有角色。<br>先去通讯录添加角色，再回来建头像库。</div>';
    return;
  }

  box.innerHTML = chars.map(function (c) {
    const avatar = c.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160';
    const isSelected = c.id === selectedId;
    return '<button type="button" class="vault-char-row ' + (isSelected ? 'is-selected' : '') + '" onclick="selectVaultCharacter(\'' + c.id + '\')">' +
      '<img src="' + avatar + '" alt="" />' +
      '<div class="vault-char-row-info">' +
        '<div class="vault-char-row-name">' + escapeVaultHtml(c.name || '未命名角色') + '</div>' +
        '<div class="vault-char-row-sub">' + escapeVaultHtml(c.tag || c.intro || '通讯录角色') + '</div>' +
      '</div>' +
      '<div class="vault-char-row-check">' + (isSelected ? '✓' : '') + '</div>' +
    '</button>';
  }).join('');
}

function selectVaultCharacter(id) {
  const char = vaultFindChar(id);
  if (!char) return;
  currentVaultCharId = id;
  try { localStorage.setItem(VAULT_CURRENT_CHAR, id); } catch (e) {}
  closeVaultCharDrawer();
  renderVaultView();
}

function openVaultUploadDrawer() {
  const drawer = document.getElementById('vault-upload-drawer');
  const whoText = document.getElementById('vault-upload-who-label');
  const emotionWrap = document.getElementById('vault-upload-emotion-wrap');
  const emotionLabel = document.getElementById('vault-upload-emotion-label');
  const emotionInput = document.getElementById('vault-upload-emotion');

  if (whoText) {
    if (currentVaultTab === 'momo') {
      whoText.innerText = '我的头像';
    } else {
      const char = vaultFindChar(vaultResolveCharId());
      whoText.innerText = char ? (char.name + '的角色头像') : '角色头像';
    }
  }

  if (emotionWrap) emotionWrap.style.display = 'block';
  if (emotionLabel) {
    emotionLabel.innerText = currentVaultTab === 'momo'
      ? '情绪 / 场景（可选）'
      : '情绪（必填，角色会在这个情绪下换上）';
  }
  if (emotionInput) {
    emotionInput.value = '';
    emotionInput.placeholder = currentVaultTab === 'momo'
      ? '如：日常、约会、开心'
      : '如：开心、吃醋、委屈、被夸偷乐';
  }

  const nameInput = document.getElementById('vault-upload-name');
  const noteInput = document.getElementById('vault-upload-note');
  const previewImg = document.getElementById('vault-upload-preview');
  if (nameInput) nameInput.value = '';
  if (noteInput) noteInput.value = '';
  if (previewImg) {
    previewImg.src = '';
    previewImg.style.display = 'none';
  }
  tempUploadedBase64 = null;

  if (drawer) drawer.classList.add('open');
}

function closeVaultUploadDrawer() {
  const drawer = document.getElementById('vault-upload-drawer');
  if (drawer) drawer.classList.remove('open');
}

function handleVaultFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      const max = 500;
      if (w > max || h > max) {
        if (w > h) {
          h = Math.round((h * max) / w);
          w = max;
        } else {
          w = Math.round((w * max) / h);
          h = max;
        }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      tempUploadedBase64 = canvas.toDataURL('image/jpeg', 0.86);

      const preview = document.getElementById('vault-upload-preview');
      if (preview) {
        preview.src = tempUploadedBase64;
        preview.style.display = 'block';
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function vaultTagClassFor(emotion) {
  const text = String(emotion || '');
  if (text.includes('生闷气') || text.includes('吃醋') || text.includes('委屈')) return 'badge-angry';
  if (text.includes('开心') || text.includes('约会') || text.includes('被夸')) return 'badge-happy';
  if (text.includes('撒娇') || text.includes('情侣')) return 'badge-couple';
  return '';
}

function submitVaultNewAvatar() {
  if (!tempUploadedBase64) {
    alert('请先选择一张图片哦。');
    return;
  }

  const isMomo = (currentVaultTab === 'momo');
  const nameInput = document.getElementById('vault-upload-name');
  const emotionInput = document.getElementById('vault-upload-emotion');
  const noteInput = document.getElementById('vault-upload-note');

  const emotion = (emotionInput && emotionInput.value.trim()) || '';
  if (!isMomo && !emotion) {
    alert('给角色头像入库前，请写清这张头像代表什么情绪。');
    if (emotionInput) emotionInput.focus();
    return;
  }

  const name = (nameInput && nameInput.value.trim()) ||
    (isMomo ? '我的新头像' : ('情绪：' + emotion));
  const tag = emotion || '日常';
  const note = (noteInput && noteInput.value.trim()) || '';

  const newAvatar = {
    id: 'av_user_' + Date.now(),
    name: name,
    tag: tag,
    emotion: tag,
    tagClass: vaultTagClassFor(tag),
    note: note,
    url: tempUploadedBase64
  };

  if (isMomo) {
    const list = loadMomoList();
    list.unshift(newAvatar);
    saveMomoList(list);
  } else {
    const charId = vaultResolveCharId();
    if (!charId) {
      alert('通讯录里还没有角色，先添加一个角色吧。');
      return;
    }
    const list = loadCharVaultList(charId);
    list.unshift(newAvatar);
    saveCharVaultList(charId, list);
  }

  closeVaultUploadDrawer();
  renderVaultView();
}

function previewVaultAvatar(url) {
  if (typeof openFullImageModal === 'function') openFullImageModal(url);
}

function findAvatarForEmotion(charId, emotion) {
  const q = String(emotion || '').replace(/[「」""'']/g, '').trim().toLowerCase();
  if (!charId || !q) return null;
  const list = loadCharVaultList(charId);
  let hit = list.find(function (item) {
    const emo = String(item.emotion || '').trim().toLowerCase();
    const tag = String(item.tag || '').trim().toLowerCase();
    const nm = String(item.name || '').trim().toLowerCase();
    return emo === q || tag === q || nm === q;
  });
  if (hit) return hit;
  hit = list.find(function (item) {
    const emo = String(item.emotion || item.tag || '').toLowerCase();
    const nm = String(item.name || '').toLowerCase();
    return (emo && (emo.includes(q) || q.includes(emo))) || nm.includes(q);
  });
  return hit || null;
}

function renderAvatarChangeModal(char, item) {
  const nameEl = document.getElementById('avatar-change-char-name');
  const emotionEl = document.getElementById('avatar-change-emotion');
  const curImg = document.getElementById('avatar-change-current-img');
  const newImg = document.getElementById('avatar-change-new-img');
  const mask = document.getElementById('avatar-change-modal');

  if (nameEl) nameEl.innerText = char ? (char.name || '角色') : '角色';
  if (emotionEl) {
    const emotion = item && (item.emotion || item.tag) ? (item.emotion || item.tag) : '新头像';
    emotionEl.innerText = '想换成「' + emotion + '」这张头像';
  }
  if (curImg) curImg.src = (char && char.avatar) || (window.appData && window.appData.botAvatar) ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160';
  if (newImg) newImg.src = (item && item.url) || '';
  if (mask) mask.classList.add('open');
}

function askAvatarChange(charId, item) {
  if (!item) return Promise.resolve(false);
  const char = vaultFindChar(charId);
  if (!char) return Promise.resolve(false);

  if (pendingAvatarChangeResolve) {
    const old = pendingAvatarChangeResolve;
    pendingAvatarChangeResolve = null;
    old(false);
  }

  const mask = document.getElementById('avatar-change-modal');
  if (!mask) {
    return Promise.resolve(confirm((char.name || '角色') + '想换成「' + (item.emotion || item.tag || '新头像') + '」头像，同意吗？'));
  }

  renderAvatarChangeModal(char, item);
  return new Promise(function (resolve) {
    pendingAvatarChangeResolve = resolve;
  });
}

function resolveAvatarChange(agree) {
  const mask = document.getElementById('avatar-change-modal');
  if (mask) mask.classList.remove('open');
  const resolve = pendingAvatarChangeResolve;
  pendingAvatarChangeResolve = null;
  if (resolve) resolve(!!agree);
}

function escapeVaultHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

initVaultState();

window.renderVaultView = renderVaultView;
window.switchVaultTab = switchVaultTab;
window.applyVaultAvatar = applyVaultAvatar;
window.deleteVaultItem = deleteVaultItem;
window.openVaultUploadDrawer = openVaultUploadDrawer;
window.closeVaultUploadDrawer = closeVaultUploadDrawer;
window.handleVaultFileSelect = handleVaultFileSelect;
window.submitVaultNewAvatar = submitVaultNewAvatar;
window.previewVaultAvatar = previewVaultAvatar;
window.openVaultCharDrawer = openVaultCharDrawer;
window.closeVaultCharDrawer = closeVaultCharDrawer;
window.renderVaultCharDrawer = renderVaultCharDrawer;
window.selectVaultCharacter = selectVaultCharacter;
window.getVaultCharacters = vaultCharacters;
window.loadCharVaultList = loadCharVaultList;
window.findAvatarForEmotion = findAvatarForEmotion;
window.askAvatarChange = askAvatarChange;
window.resolveAvatarChange = resolveAvatarChange;
window.applyCharacterAvatar = applyCharacterAvatar;
