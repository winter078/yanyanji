// ==========================================================================
// 🐱 表情包与贴图系统 (1:1 高保真复刻 · 分组管理 / 颜文字 / 离线保真 / 双向神经常驻)
// ==========================================================================

let currentStickerCategory = '默认';
let currentStickerSubTab = 'stickers'; // 'stickers' | 'kaomoji'
let isStickerManageMode = false;
let selectedStickerIds = new Set();
let currentStickerSearchKw = '';
let editingStickerId = null;
let pendingStickerImageData = '';

const KAOMOJI_LIBRARY = {
  "撒娇卖萌": ["(｡･ω･｡)ﾉ♡", "(っ˘з(˘⌣˘ )", "(⁄ ⁄•⁄ω⁄•⁄ ⁄)", "(,,•́ . •̀,,)", "₍ᐢ..ᐢ₎♡", "(✿◡‿◡)"],
  "委屈心碎": ["(つД\u0060)", "(ノへ￣、)", "(p′︵‵。)", "(｡í _ ì｡)", "(இдஇ; )", "(T_T)"],
  "炸毛咬人": ["ヽ(#\u0060Д´)ﾉ", "( \u0060皿´ )", "(ง •̀_•́)ง", "(╯°Д°)╯︵ ┻━┻", "(｀・ω・´)", "(*｀へ´*)"],
  "亲亲抱抱": ["(づ￣ ³￣)づ", "(*˘︶˘*).｡.:*♡", "(づ｡◕‿‿◕｡)づ", "(´ε｀ )♡", "(つ≧▽≦)つ"],
  "困觉摸鱼": ["(¯﹃¯...)", "( - . - )zzz", "(。-ω-)zzz", "(=￣ω￣=)", "_( :3」∠)_"]
};

// 获取已被user删除的黑名单 ID，防止删了又死灰复燃
function getDeletedStickerIds() {
  try {
    const raw = localStorage.getItem('momo_deleted_sticker_ids');
    if (raw) return new Set(JSON.parse(raw));
  } catch(e){}
  return new Set();
}

function addDeletedStickerId(id) {
  try {
    const deleted = getDeletedStickerIds();
    deleted.add(id);
    localStorage.setItem('momo_deleted_sticker_ids', JSON.stringify(Array.from(deleted)));
  } catch(e){}
}

function getStickerCategories() {
  const defaultCats = ['默认'];
  let cats = defaultCats;
  try {
    const saved = localStorage.getItem('momo_sticker_categories_v6');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) cats = parsed;
    }
  } catch(e){}
  if (!cats.length) cats = ['默认'];
  return cats;
}

function saveStickerCategories(cats) {
  try {
    localStorage.setItem('momo_sticker_categories_v6', JSON.stringify(cats));
  } catch(e){}
}

function isBuiltInStickerId(id) {
  return /^st_[1-4]$/.test(String(id || '')) || /^st_cat_momo_/.test(String(id || ''));
}

function getAllStickersData() {
  let list = [];
  let isNewVersion = false;
  try {
    const savedV10 = localStorage.getItem('momo_stickers_v10');
    if (savedV10) {
      const parsed = JSON.parse(savedV10);
      if (Array.isArray(parsed)) {
        list = parsed;
        isNewVersion = true;
      }
    }
  } catch(e){}

  const deletedIds = getDeletedStickerIds();

  // 上一版把早期预置表情归档后从可见库移除，误伤了用户的旧库存。
  // 这里只做一次恢复：当前库为空时，把归档的旧表情合并回来；用户后来再删就不会复活。
  if (isNewVersion && list.length === 0 && !localStorage.getItem('momo_stickers_presets_restored_v1')) {
    try {
      let recovered = [];
      const archivedRaw = localStorage.getItem('momo_stickers_presets_archived_v1');
      const archived = archivedRaw ? JSON.parse(archivedRaw) : [];
      if (Array.isArray(archived)) recovered = recovered.concat(archived);
      // 兼容早期只写在 v8/v7/momo_stickers 里的用户导入；只收非内置项。
      ['momo_stickers_v8', 'momo_stickers_v7', 'momo_stickers'].forEach(function (key) {
        try {
          const raw = localStorage.getItem(key);
          const legacy = raw ? JSON.parse(raw) : null;
          if (Array.isArray(legacy)) {
            recovered = recovered.concat(legacy
              .filter(s => s && s.name && s.url && !isBuiltInStickerId(s.id))
              .map((s, i) => Object.assign({}, s, { id: s.id || ('st_recovered_' + key + '_' + i) }))
            );
          }
        } catch (e) {}
      });
      if (recovered.length) {
        list = recovered;
        saveAllStickersData(list);
      }
      localStorage.setItem('momo_stickers_presets_restored_v1', '1');
    } catch(e){}
  }

  // 用户确认后的一次性清理：只移除代码预置 ID（st_1..4 / st_cat_momo_*），
  // 用户自己上传的 st_local_* / st_时间戳_* 不在匹配范围。清完不再恢复。
  if (!localStorage.getItem('momo_stickers_builtin_cleaned_v1')) {
    const builtins = list.filter(s => s && isBuiltInStickerId(s.id));
    if (builtins.length) {
      list = list.filter(s => !(s && isBuiltInStickerId(s.id)));
      saveAllStickersData(list);
    }
    try {
      localStorage.removeItem('momo_stickers_presets_archived_v1');
      localStorage.setItem('momo_stickers_presets_restored_v1', '1');
      localStorage.setItem('momo_stickers_builtin_cleaned_v1', '1');
    } catch(e){}
  }

  if (!isNewVersion) {
    let customList = [];
    try {
      const oldSaved = localStorage.getItem('momo_stickers_v8') || localStorage.getItem('momo_stickers_v7') || localStorage.getItem('momo_stickers');
      if (oldSaved) {
        const oldParsed = JSON.parse(oldSaved);
        if (Array.isArray(oldParsed)) {
          customList = oldParsed.filter(s => s && s.id && s.name && s.url && !isBuiltInStickerId(s.id));
        }
      }
    } catch(e){}

    // 旧版本只迁移用户自己存过的表情，不再把代码里的预设塞回来。
    list = customList;
    saveAllStickersData(list);

    try {
      localStorage.removeItem('momo_stickers_v8');
      localStorage.removeItem('momo_stickers_v7');
    } catch(e){}
  }

  const seenId = new Set();
  const seenName = new Set();
  const deduped = [];
  list.forEach(item => {
    if (!item || !item.id || !item.name || !item.url || deletedIds.has(item.id)) return;
    const name = String(item.name).trim();
    if (!name) return;
    if (!seenId.has(item.id) && !seenName.has(name)) {
      seenId.add(item.id);
      seenName.add(name);
      deduped.push({
        id: String(item.id),
        name: name,
        category: String(item.category || '默认'),
        url: String(item.url),
        note: String(item.note || '').trim()
      });
    }
  });

  return deduped;
}

function saveAllStickersData(list) {
  try {
    localStorage.setItem('momo_stickers_v10', JSON.stringify(list));
  } catch(e){
    console.warn('[Stickers] saveAllStickersData error', e);
  }
}

function findStickerById(id) {
  if (!id) return null;
  return getAllStickersData().find(s => s.id === String(id)) || null;
}

function findStickerByName(name) {
  const clean = String(name || '').replace(/[\[\]]/g, '').trim();
  if (!clean) return null;
  const list = getAllStickersData();
  return list.find(s => s.name === clean) ||
    list.find(s => s.name.includes(clean) || clean.includes(s.name)) ||
    null;
}

function parseStickerContent(content) {
  const raw = String(content || '').trim();
  if (!raw) return null;

  if (raw.startsWith('[STICKER:') && raw.endsWith(']')) {
    const body = raw.slice(9, -1);
    if (body.includes('|')) {
      const parts = body.split('|');
      const byId = findStickerById(parts[0]);
      const byName = findStickerByName(parts.slice(1).join('|'));
      return byId || byName || { name: parts.slice(1).join('|') || '表情包', url: '', category: '' };
    }
    const parts = body.split(':');
    const name = parts[0] || '表情包';
    const maybeUrl = parts.slice(1).join(':');
    const item = findStickerByName(name);
    return item || { name: name, url: maybeUrl || '', category: '' };
  }

  if ((raw.startsWith('[表情包:') || raw.startsWith('[表情:')) && raw.endsWith(']')) {
    const name = raw.replace(/^\[(表情包|表情):\s*/, '').replace(/\]$/, '').trim();
    const item = findStickerByName(name);
    return item || { name: name || '表情包', url: '', category: '' };
  }

  return null;
}

window.getAllStickersData = getAllStickersData;

window.getStickerDisplay = function(content) {
  const parsed = parseStickerContent(content);
  if (!parsed) return null;
  return {
    name: parsed.name || '表情包',
    category: parsed.category || '',
    note: parsed.note || '',
    url: parsed.url || ''
  };
};

window.getStickerSummaryForAi = function() {
  const list = getAllStickersData();
  if (!list || list.length === 0) return '暂无自定义表情包。';
  const catMap = {};
  list.forEach(s => {
    if (!catMap[s.category]) catMap[s.category] = [];
    catMap[s.category].push(s.note ? (s.name + '（' + s.note + '）') : s.name);
  });
  const lines = [];
  for (const cat in catMap) {
    lines.push('- 【' + cat + '组】: ' + catMap[cat].join('、 '));
  }
  return lines.join('\n');
};

window.findStickerUrlByName = function(name) {
  const item = findStickerByName(name);
  return item ? item.url : null;
};

// 聊天上下文里只送文字：名称 / 分类 / 说明，绝不把 base64 或图片 URL 喂给模型。
window.stickerContentToAiText = function(content) {
  const raw = String(content || '');
  if (!raw) return raw;

  return raw
    .replace(/\[STICKER:([^\]]*)\]/g, function(_, body) {
      let name = body;
      let url = '';
      if (body.includes('|')) {
        const parts = body.split('|');
        name = parts.slice(1).join('|');
        const item = findStickerById(parts[0]) || findStickerByName(name);
        if (item) return '「表情包：' + item.name + '（' + item.category + '）' + (item.note ? '｜' + item.note : '') + '」';
        return '「表情包：' + (name || '未知表情') + '」';
      }
      if (body.includes(':') && /^(https?:|data:image)/.test(body.split(':').slice(1).join(':'))) {
        name = body.split(':')[0];
        url = body.split(':').slice(1).join(':');
      }
      const item = findStickerByName(name) || (url ? { name: name, category: '', note: '' } : null);
      if (!item) return '「表情包：' + (name || '未知表情') + '」';
      return '「表情包：' + item.name + (item.category ? '（' + item.category + '）' : '') + (item.note ? '｜' + item.note : '') + '」';
    })
    .replace(/\[(?:表情包|表情):([^\]]*)\]/g, function(_, name) {
      const item = findStickerByName(name);
      if (!item) return '「表情包：' + (name || '未知表情') + '」';
      return '「表情包：' + item.name + (item.category ? '（' + item.category + '）' : '') + (item.note ? '｜' + item.note : '') + '」';
    });
};

// ================= 抽屉与分类 Tab =================

window.toggleStickerDrawer = function() {
  const drawer = document.getElementById('sticker-drawer');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    if (isStickerManageMode) window.toggleStickerManageMode();
  } else {
    const plusD = document.getElementById('plus-drawer');
    if (plusD) plusD.classList.remove('open');

    // 抽屉只负责「挑一张发出去」，管理相关的入口都在「微信-我-表情包库」
    currentStickerSearchKw = '';
    const searchBox = document.getElementById('sticker-search-input');
    if (searchBox) searchBox.value = '';

    drawer.classList.add('open');
    window.initStickerCategoryTabs();
    window.renderStickers();
  }
};

// 「微信-我-表情包库」整页：导入 / 新建分类 / 管理 / 编辑 / 删除都在这里
window.renderStickerPage = function() {
  currentStickerSearchKw = '';
  const box = document.getElementById('sk-search');
  if (box) box.value = '';
  window.initStickerCategoryTabs();
  window.renderStickers();
};

function paintCatTabs(barId, allowCreate) {
  const tabsBar = document.getElementById(barId);
  if (!tabsBar) return;
  tabsBar.innerHTML = '';

  const cats = getStickerCategories();
  if (!cats.includes(currentStickerCategory)) {
    currentStickerCategory = cats[0] || '默认';
  }

  cats.forEach(cat => {
    const tab = document.createElement('button');
    tab.type = 'button';
    const isAct = (cat === currentStickerCategory);
    tab.style.cssText = 'background: none; border: none; font-size: 14px; font-weight: ' + (isAct ? '800' : '500') + '; color: ' + (isAct ? 'var(--stickers-accent)' : 'var(--text-secondary)') + '; padding: 6px 4px 8px; cursor: pointer; white-space: nowrap; position: relative; transition: all 0.15s ease; flex-shrink: 0;';
    tab.innerText = cat;

    if (isAct) {
      const underline = document.createElement('div');
      underline.style.cssText = 'position: absolute; bottom: 0; left: 10%; width: 80%; height: 2.5px; background: var(--stickers-accent); border-radius: 2px;';
      tab.appendChild(underline);
    }

    tab.onclick = () => {
      currentStickerCategory = cat;
      window.initStickerCategoryTabs();
      window.renderStickers();
    };
    tabsBar.appendChild(tab);
  });

  if (!allowCreate) return;

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-default); width: 26px; height: 26px; border-radius: 8px; color: var(--stickers-accent); font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 4px;';
  addBtn.innerText = '+';
  addBtn.title = '新建分类';
  addBtn.onclick = () => window.openStickerNewCatModal();
  tabsBar.appendChild(addBtn);
}

window.initStickerCategoryTabs = function() {
  paintCatTabs('sticker-category-tabs-bar', false);
  paintCatTabs('sk-cat-tabs', true);
};

// ================= 表情卡片列表 =================

function renderGridInto(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const manageHere = !!(opts && opts.manage && isStickerManageMode);
  const allList = getAllStickersData();
  let filtered = allList.filter(s => s.category === currentStickerCategory);

  if (currentStickerSearchKw) {
    const kw = currentStickerSearchKw.toLowerCase();
    filtered = allList.filter(s => s.name.toLowerCase().includes(kw));
  }

  // 首格：+ 上传 卡片（只有「表情包库」页里出现）
  if (opts && opts.upload && !manageHere && !currentStickerSearchKw) {
    const uploadCard = document.createElement('div');
    uploadCard.style.cssText = 'aspect-ratio: 1; background: var(--bg-surface); border: 1px dashed var(--border-default); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; transition: all 0.15s ease;';
    uploadCard.innerHTML = '<span style="font-size: 24px; color: var(--stickers-accent); font-weight: 300;">+</span><span style="font-size: 11.5px; color: var(--text-secondary); font-weight: 600;">上传</span>';
    uploadCard.onclick = () => window.openStickerEditor();
    container.appendChild(uploadCard);
  }

  if (filtered.length === 0) {
    const emptyTip = document.createElement('div');
    emptyTip.style.cssText = 'grid-column: span 4; text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 13px; line-height: 1.7;';
    emptyTip.innerText = (opts && opts.upload)
      ? '这个分类下还没有表情。点「+ 上传」，给它选一张图，再写一个名字就行。'
      : '这个分类下还没有表情。去「微信 - 我 - 表情包库」加一张。';
    container.appendChild(emptyTip);
    return;
  }

  filtered.forEach(s => {
    const card = document.createElement('div');
    card.style.cssText = 'aspect-ratio: 1; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; position: relative; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';

    const img = document.createElement('img');
    img.src = s.url;
    img.alt = s.name;
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; padding: 4px; box-sizing: border-box; display: block;';
    img.onerror = () => {
      img.onerror = null;
      img.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'font-size: 26px; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; height: 100%;';
      placeholder.innerText = '🐱';
      card.appendChild(placeholder);
    };
    card.appendChild(img);

    const badge = document.createElement('div');
    badge.style.cssText = 'position: absolute; bottom: 4px; left: 4px; right: 4px; background: rgba(0,0,0,0.72); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border-radius: 6px; padding: 2px 4px; font-size: 10px; color: #ffffff; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none;';
    badge.innerText = s.name;
    card.appendChild(badge);

    if (manageHere) {
      const isSelected = selectedStickerIds.has(s.id);
      const checkCircle = document.createElement('div');
      checkCircle.style.cssText = 'position: absolute; top: 5px; right: 5px; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid ' + (isSelected ? 'var(--stickers-accent)' : 'var(--border-default)') + '; background: ' + (isSelected ? 'var(--stickers-accent)' : 'rgba(0,0,0,0.5)') + '; color: #ffffff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; z-index: 10;';
      checkCircle.innerText = isSelected ? '✓' : '';
      card.appendChild(checkCircle);

      if (isSelected) {
        card.style.borderColor = 'var(--stickers-accent)';
        card.style.background = 'var(--stickers-accent-soft)';
      }

      card.onclick = (e) => {
        e.stopPropagation();
        if (selectedStickerIds.has(s.id)) selectedStickerIds.delete(s.id);
        else selectedStickerIds.add(s.id);
        updateManageToolbarUI();
        window.renderStickers();
      };
    } else {
      if (opts && opts.edit) {
        // 编辑入口：只改用户写的名称、分类和说明，不动图片。
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.style.cssText = 'position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.65); border: 1px solid var(--border-default); color: var(--stickers-accent); font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; opacity: 0.75;';
        editBtn.innerText = '✎';
        editBtn.title = '编辑名称 / 分类 / 说明';
        editBtn.onclick = (e) => {
          e.stopPropagation();
          window.openStickerEditor(s.id);
        };
        card.appendChild(editBtn);

        // 快捷一键删除叉叉
        const quickDelBtn = document.createElement('button');
        quickDelBtn.type = 'button';
        quickDelBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.65); border: 1px solid var(--border-default); color: var(--danger-primary); font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; opacity: 0.7;';
        quickDelBtn.innerText = '✕';
        quickDelBtn.title = '删除此表情包';
        quickDelBtn.onclick = (e) => {
          e.stopPropagation();
          window.deleteSingleSticker(s.id, s.name);
        };
        card.appendChild(quickDelBtn);
      }

      if (opts && opts.send) card.onclick = () => window.sendStickerMessage(s);
      else if (opts && opts.edit) card.onclick = () => window.openStickerEditor(s.id);
    }

    container.appendChild(card);
  });
}

window.renderStickers = function() {
  // 聊天抽屉：只能挑一张发出去
  renderGridInto('sticker-list-container', { upload: false, edit: false, send: true, manage: false });
  // 微信-我-表情包库：上传 / 编辑 / 删除 / 多选管理
  renderGridInto('sk-grid', { upload: true, edit: true, send: false, manage: true });
};

// 一键删除单个表情
window.deleteSingleSticker = function(stickerId, name) {
  if (!confirm('确定删除表情包「' + name + '」吗？')) return;
  addDeletedStickerId(stickerId);
  let list = getAllStickersData();
  list = list.filter(s => s.id !== stickerId);
  saveAllStickersData(list);
  window.renderStickers();
};

// 发送表情包：历史里只存 id + 名称，不存图片本体；全局库所有角色都能解析。
window.sendStickerMessage = function(sticker) {
  if (window.__groupMode && typeof window.groupSendStickerMessage === 'function') {
    window.groupSendStickerMessage(sticker);
    window.toggleStickerDrawer();
    return;
  }
  const content = '[STICKER:' + sticker.id + '|' + sticker.name + ']';
  renderMessageBubble('user', content);
  appData.chatHistory.push({
    role: 'user',
    content: content,
    time: getNowStr()
  });
  safeSaveChatHistory();
  window.toggleStickerDrawer();

  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.focus();
};

// ================= 管理模式 =================

window.toggleStickerManageMode = function() {
  isStickerManageMode = !isStickerManageMode;
  selectedStickerIds.clear();

  const manageBtn = document.getElementById('sk-manage-btn');
  const toolbar = document.getElementById('sk-manage-toolbar');

  if (isStickerManageMode) {
    if (manageBtn) {
      manageBtn.innerText = '完成';
      manageBtn.style.color = 'var(--danger-primary)';
    }
    if (toolbar) toolbar.style.display = 'flex';
  } else {
    if (manageBtn) {
      manageBtn.innerText = '管理';
      manageBtn.style.color = 'var(--text-secondary)';
    }
    if (toolbar) toolbar.style.display = 'none';
  }

  updateManageToolbarUI();
  window.renderStickers();
};

function updateManageToolbarUI() {
  const countLabel = document.getElementById('sk-sel-count');
  if (countLabel) countLabel.innerText = selectedStickerIds.size + ' 条';
}

window.toggleSelectAllStickers = function() {
  const allList = getAllStickersData();
  const currentList = allList.filter(s => s.category === currentStickerCategory);

  if (selectedStickerIds.size >= currentList.length) {
    selectedStickerIds.clear();
  } else {
    currentList.forEach(s => selectedStickerIds.add(s.id));
  }
  updateManageToolbarUI();
  window.renderStickers();
};

window.deleteSelectedStickers = function() {
  if (selectedStickerIds.size === 0) {
    alert('请先点击卡片勾选要删除的表情包哦。');
    return;
  }
  const deleteCount = selectedStickerIds.size;
  if (!confirm('确定删除选中的 ' + deleteCount + ' 个表情吗？')) return;

  selectedStickerIds.forEach(id => addDeletedStickerId(id));
  let list = getAllStickersData();
  list = list.filter(s => !selectedStickerIds.has(s.id));
  saveAllStickersData(list);
  selectedStickerIds.clear();
  updateManageToolbarUI();
  window.renderStickers();
  alert('✨ 已成功删除 ' + deleteCount + ' 个表情包！');
};

window.clearAllCurrentCategoryStickers = function() {
  if (!confirm('确定清空「' + currentStickerCategory + '」分类下的所有表情包吗？')) return;
  let list = getAllStickersData();
  const currentItems = list.filter(s => s.category === currentStickerCategory);
  currentItems.forEach(item => addDeletedStickerId(item.id));
  list = list.filter(s => s.category !== currentStickerCategory);
  saveAllStickersData(list);
  selectedStickerIds.clear();
  updateManageToolbarUI();
  window.renderStickers();
  alert('✨ 已清空「' + currentStickerCategory + '」分类下的所有表情！');
};

window.exportSelectedStickers = function() {
  const allList = getAllStickersData();
  let exportItems = [];
  if (selectedStickerIds.size > 0) {
    exportItems = allList.filter(s => selectedStickerIds.has(s.id));
  } else {
    exportItems = allList.filter(s => s.category === currentStickerCategory);
  }

  const jsonStr = JSON.stringify(exportItems, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '绪言与user表情包_' + currentStickerCategory + '_' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(url);
};

window.openMoveStickersModal = function() {
  if (selectedStickerIds.size === 0) {
    alert('请先勾选要移动的表情包。');
    return;
  }
  const selectEl = document.getElementById('select-move-sticker-cat');
  if (selectEl) {
    selectEl.innerHTML = '';
    const cats = getStickerCategories();
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.innerText = c;
      if (c === currentStickerCategory) opt.disabled = true;
      selectEl.appendChild(opt);
    });
  }

  const tip = document.getElementById('sticker-move-count-tip');
  if (tip) tip.innerText = '将选中的 ' + selectedStickerIds.size + ' 条表情移动到：';

  const modal = document.getElementById('modal-sticker-move');
  if (modal) modal.style.display = 'flex';
};

window.closeStickerMoveModal = function() {
  const modal = document.getElementById('modal-sticker-move');
  if (modal) modal.style.display = 'none';
};

window.submitMoveSelectedStickers = function() {
  const targetCat = document.getElementById('select-move-sticker-cat').value;
  if (!targetCat) return;

  const list = getAllStickersData();
  list.forEach(s => {
    if (selectedStickerIds.has(s.id)) {
      s.category = targetCat;
    }
  });
  saveAllStickersData(list);
  window.closeStickerMoveModal();
  selectedStickerIds.clear();
  updateManageToolbarUI();
  window.renderStickers();
  alert('✨ 已成功移动到「' + targetCat + '」！');
};

window.openStickerNewCatModal = function() {
  const input = document.getElementById('input-new-cat-name');
  if (input) input.value = '';
  const modal = document.getElementById('modal-sticker-new-cat');
  const editor = document.getElementById('modal-sticker-editor');
  if (modal) {
    modal.style.zIndex = (editor && editor.style.display === 'flex') ? '700' : '';
    modal.style.display = 'flex';
  }
};

window.closeStickerNewCatModal = function() {
  const modal = document.getElementById('modal-sticker-new-cat');
  if (modal) {
    modal.style.display = 'none';
    modal.style.zIndex = '';
  }
};

window.submitAddNewStickerCategory = function() {
  const input = document.getElementById('input-new-cat-name');
  const catName = input ? input.value.trim() : '';
  if (!catName) {
    alert('分类名称不能为空哦。');
    return;
  }
  const cats = getStickerCategories();
  if (cats.includes(catName)) {
    alert('该分类已经存在啦。');
    return;
  }
  cats.push(catName);
  saveStickerCategories(cats);
  currentStickerCategory = catName;
  window.closeStickerNewCatModal();
  window.initStickerCategoryTabs();
  const editor = document.getElementById('modal-sticker-editor');
  if (editor && editor.style.display === 'flex') fillStickerEditorCategories(catName);
  window.renderStickers();
};

window.openStickerImportModal = function() {
  const select = document.getElementById('select-import-sticker-cat');
  if (select) {
    select.innerHTML = '';
    const cats = getStickerCategories();
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.innerText = c;
      if (c === currentStickerCategory) opt.selected = true;
      select.appendChild(opt);
    });
  }
  document.getElementById('input-import-sticker-name').value = '';
  document.getElementById('input-import-sticker-urls').value = '';

  const modal = document.getElementById('modal-sticker-import');
  if (modal) modal.style.display = 'flex';
};

window.closeStickerImportModal = function() {
  const modal = document.getElementById('modal-sticker-import');
  if (modal) modal.style.display = 'none';
};

function fillStickerEditorCategories(selectedCat) {
  const select = document.getElementById('select-editor-sticker-cat');
  if (!select) return;
  select.innerHTML = '';
  const cats = getStickerCategories();
  if (selectedCat && !cats.includes(selectedCat)) cats.push(selectedCat);
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.innerText = c;
    if (c === (selectedCat || currentStickerCategory)) opt.selected = true;
    select.appendChild(opt);
  });
}

function setStickerEditorPreview(dataUrl) {
  const preview = document.getElementById('sticker-editor-preview');
  const empty = document.getElementById('sticker-editor-empty');
  if (!preview || !empty) return;
  if (dataUrl) {
    preview.src = dataUrl;
    preview.style.display = 'block';
    empty.style.display = 'none';
  } else {
    preview.removeAttribute('src');
    preview.style.display = 'none';
    empty.style.display = 'flex';
  }
}

window.openStickerEditor = function(id) {
  editingStickerId = id || null;
  const item = id ? findStickerById(id) : null;
  pendingStickerImageData = item ? item.url : '';

  const title = document.getElementById('sticker-editor-title');
  const saveBtn = document.getElementById('btn-save-sticker');
  if (title) title.innerText = item ? '编辑表情包' : '新增表情包';
  if (saveBtn) saveBtn.innerText = item ? '保存修改' : '存进表情库';

  fillStickerEditorCategories(item ? item.category : currentStickerCategory);
  const nameInput = document.getElementById('input-editor-sticker-name');
  const noteInput = document.getElementById('input-editor-sticker-note');
  if (nameInput) nameInput.value = item ? item.name : '';
  if (noteInput) noteInput.value = item ? (item.note || '') : '';
  setStickerEditorPreview(pendingStickerImageData);

  const modal = document.getElementById('modal-sticker-editor');
  if (modal) modal.style.display = 'flex';
  const sheet = modal && modal.querySelector('.hero-modal-sheet');
  if (sheet) sheet.scrollTop = 0;
};

window.closeStickerEditor = function() {
  const modal = document.getElementById('modal-sticker-editor');
  if (modal) modal.style.display = 'none';
  editingStickerId = null;
  pendingStickerImageData = '';
};

window.handleImportSticker = function(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];

  const apply = function(dataUrl) {
    pendingStickerImageData = dataUrl;
    setStickerEditorPreview(dataUrl);
  };

  const reader = new FileReader();
  reader.onload = function(evt) {
    const raw = evt.target.result;
    // GIF 保留动图；普通图缩到 360px，避免 base64 把 localStorage 撑爆。
    if (file.type === 'image/gif' || !file.type || file.type.indexOf('image/') !== 0) {
      apply(raw);
      return;
    }
    const img = new Image();
    img.onload = function() {
      try {
        const max = 360;
        const ratio = Math.min(1, max / Math.max(img.width || max, img.height || max));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.width || max) * ratio));
        canvas.height = Math.max(1, Math.round((img.height || max) * ratio));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        apply(canvas.toDataURL('image/png'));
      } catch (err) {
        apply(raw);
      }
    };
    img.onerror = function() { apply(raw); };
    img.src = raw;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
};

window.submitStickerEditor = function() {
  const nameInput = document.getElementById('input-editor-sticker-name');
  const noteInput = document.getElementById('input-editor-sticker-note');
  const catSelect = document.getElementById('select-editor-sticker-cat');
  const name = nameInput ? nameInput.value.trim() : '';
  const note = noteInput ? noteInput.value.trim() : '';
  const category = (catSelect && catSelect.value) || currentStickerCategory || '默认';

  if (!name) {
    alert('请给这个表情包写一个名称。角色在聊天里只认这行字。');
    if (nameInput) nameInput.focus();
    return;
  }
  if (!pendingStickerImageData) {
    alert('请先选一张图片，再给它写名称。');
    return;
  }

  const list = getAllStickersData();
  const duplicate = list.find(s => s.name === name && s.id !== editingStickerId);
  if (duplicate) {
    alert('已经有一个叫「' + name + '」的表情包了，换个名字吧。');
    return;
  }

  const cats = getStickerCategories();
  if (!cats.includes(category)) {
    cats.push(category);
    saveStickerCategories(cats);
  }

  if (editingStickerId) {
    const item = list.find(s => s.id === editingStickerId);
    if (!item) {
      alert('这个表情包已经不在库里了。');
      return;
    }
    item.name = name;
    item.category = category;
    item.note = note;
    item.url = pendingStickerImageData;
  } else {
    list.unshift({
      id: 'st_local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: name,
      category: category,
      note: note,
      url: pendingStickerImageData
    });
  }

  saveAllStickersData(list);
  currentStickerCategory = category;
  window.closeStickerEditor();
  window.initStickerCategoryTabs();
  window.renderStickers();
};

window.submitImportStickerUrls = function() {
  const targetCat = document.getElementById('select-import-sticker-cat').value || '默认';
  const defaultCustomName = document.getElementById('input-import-sticker-name').value.trim();
  const urlsText = document.getElementById('input-import-sticker-urls').value.trim();

  if (!urlsText) {
    alert('请粘贴图片 URL 链接或“名称 链接”文本哦。');
    return;
  }

  const rawLines = urlsText.split('\n').map(l => l.trim()).filter(Boolean);
  const parsedItems = [];

  for (let line of rawLines) {
    const urlMatch = line.match(/(https?:\/\/[^\s\"\'\<\>]+|data:image\/[^\s\"\'\<\>]+)/);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      let name = line.replace(url, '').replace(/[，,：:\t]/g, ' ').trim();
      if (!name) {
        name = defaultCustomName ? (rawLines.length === 1 ? defaultCustomName : (defaultCustomName + '_' + (parsedItems.length + 1))) : ('贴图_' + (parsedItems.length + 1));
      }
      parsedItems.push({ name, url });
    }
  }

  if (parsedItems.length === 0) {
    alert('未能识别到有效的图片链接，请检查文本。');
    return;
  }

  const cats = getStickerCategories();
  if (!cats.includes(targetCat)) {
    cats.push(targetCat);
    saveStickerCategories(cats);
  }

  const list = getAllStickersData();
  parsedItems.forEach((item, idx) => {
    list.unshift({
      id: 'st_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6),
      name: item.name,
      category: targetCat,
      note: '',
      url: item.url
    });
  });

  saveAllStickersData(list);
  currentStickerCategory = targetCat;
  window.closeStickerImportModal();
  window.initStickerCategoryTabs();
  window.renderStickers();
  alert('🎉 成功批量导入 ' + parsedItems.length + ' 个表情包到「' + targetCat + '」！');
};

window.handleSearchSticker = function(kw) {
  currentStickerSearchKw = kw.trim();
  window.renderStickers();
};

window.switchStickerSubTab = function(tabKey) {
  currentStickerSubTab = tabKey;
  const btnStickers = document.getElementById('btn-subtab-stickers');
  const btnKaomoji = document.getElementById('btn-subtab-kaomoji');
  const viewStickers = document.getElementById('sticker-tab-content-stickers');
  const viewKaomoji = document.getElementById('sticker-tab-content-kaomoji');

  if (tabKey === 'stickers') {
    if (btnStickers) btnStickers.style.color = 'var(--stickers-accent)';
    if (btnKaomoji) btnKaomoji.style.color = 'var(--text-secondary)';
    if (viewStickers) viewStickers.style.display = 'block';
    if (viewKaomoji) viewKaomoji.style.display = 'none';
  } else {
    if (btnStickers) btnStickers.style.color = 'var(--text-secondary)';
    if (btnKaomoji) btnKaomoji.style.color = 'var(--stickers-accent)';
    if (viewStickers) viewStickers.style.display = 'none';
    if (viewKaomoji) viewKaomoji.style.display = 'block';
    renderKaomojiView();
  }
};

function renderKaomojiView() {
  const chips = document.getElementById('kaomoji-category-chips');
  const grid = document.getElementById('kaomoji-grid-container');
  if (!chips || !grid) return;

  chips.innerHTML = '';
  grid.innerHTML = '';

  const catNames = Object.keys(KAOMOJI_LIBRARY);
  let activeCat = chips.getAttribute('data-active-cat') || catNames[0];

  catNames.forEach(name => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isAct = (name === activeCat);
    chip.style.cssText = 'padding: 5px 12px; border-radius: 14px; font-size: 12px; font-weight: ' + (isAct ? '700' : '500') + '; background: ' + (isAct ? 'var(--stickers-accent-soft)' : 'var(--bg-surface)') + '; border: 1px solid ' + (isAct ? 'var(--stickers-accent-border)' : 'var(--border-default)') + '; color: ' + (isAct ? 'var(--stickers-accent)' : 'var(--text-secondary)') + '; cursor: pointer; white-space: nowrap;';
    chip.innerText = name;
    chip.onclick = () => {
      chips.setAttribute('data-active-cat', name);
      renderKaomojiView();
    };
    chips.appendChild(chip);
  });

  const list = KAOMOJI_LIBRARY[activeCat] || [];
  list.forEach(k => {
    const item = document.createElement('div');
    item.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 10px; padding: 12px 6px; text-align: center; font-size: 13.5px; color: var(--text-primary); cursor: pointer; transition: all 0.15s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.25);';
    item.innerText = k;
    item.onclick = () => {
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        chatInput.value = (chatInput.value ? chatInput.value + ' ' : '') + k;
        chatInput.focus();
      }
      window.toggleStickerDrawer();
    };
    grid.appendChild(item);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  // 启动时归一化一次：迁移旧键、清走早期代码塞进来的预置表情（归档不删）。
  try { getAllStickersData(); } catch (e) { console.warn('[Stickers] init normalize error', e); }
  window.initStickerCategoryTabs();
});
