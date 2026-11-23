// 角色卡（通讯录名册）与关系图
// 一张卡 = 一个角色；聊天页仍读 appData.botRemark / botAvatar 这套老字段，
// 由「当前对话角色」把卡里的值同步过去，其它模块不用改。

(function () {
  const K_CHARS = 'momo_characters';
  const K_ACTIVE = 'momo_active_char';
  const K_TRASH = 'momo_characters_trash';
  const K_GROUPS = 'momo_chat_groups';
  const K_FRIENDS = 'momo_wechat_friends';
  const K_PINS = 'momo_wechat_pins';
  const K_HIDDEN = 'momo_wechat_hidden_convs';
  // 没有上传头像时只画一个中性首字占位，不再使用任何预置人像。
  const FB_AVATAR = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
    '<rect width="160" height="160" rx="32" fill="#2b2b30"/>' +
    '<text x="80" y="82" fill="#f2f2f5" font-family="system-ui,-apple-system,Microsoft YaHei,sans-serif" font-size="64" font-weight="600" text-anchor="middle" dominant-baseline="middle">?</text>' +
    '</svg>'
  );

  function uid() {
    return 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function maskUid() {
    return 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  // 每个角色独立保存的“小号 / 面具”。空 activeMaskId 代表回落到全局的「我」。
  function normMask(m, i) {
    const src = (m && typeof m === 'object') ? m : {};
    return {
      id: src.id || maskUid(),
      // 名字为空也保留这条小号，别在归一化时被过滤掉——那等于把小号悄悄删了。
      name: String(src.name || '').trim().slice(0, 24) || '小号',
      avatar: src.avatar || '',
      appearance: String(src.appearance || '').trim().slice(0, 1200),
      profile: String(src.profile || '').trim().slice(0, 1200),
      remark: String(src.remark || '').trim().slice(0, 32),
      handle: String(src.handle || '').trim().slice(0, 40),
      tag: String(src.tag || '').trim().slice(0, 24),
      location: String(src.location || '').trim().slice(0, 80),
      createdAt: Number(src.createdAt) || (Date.now() + (i || 0))
    };
  }

  function norm(c, i) {
    const masks = Array.isArray(c.masks)
      ? c.masks.map(normMask).filter(m => m.name)
      : [];
    const activeMaskId = masks.some(m => m.id === c.activeMaskId) ? c.activeMaskId : '';
    return {
      id: c.id || uid(),
      name: c.name || '未命名角色',
      avatar: c.avatar || '',
      tag: c.tag || '',
      intro: c.intro || '',
      voiceId: String(c.voiceId || '').trim().slice(0, 80),
      voiceRate: Math.max(0.6, Math.min(1.6, Number(c.voiceRate) || 1)),
      prompt: c.prompt || '',
      promptBackup: c.promptBackup || '',
      directives: c.directives || '',
      relations: Array.isArray(c.relations) ? c.relations.filter(r => r && r.to) : [],
      masks: masks,
      activeMaskId: activeMaskId,
      starred: !!c.starred,
      createdAt: c.createdAt || (Date.now() + i)
    };
  }

  // 群：老数据只有 id/name/members，这里补齐 settings / history，不动已有内容
  function normGroup(g, i) {
    const s = (g && g.settings) || {};
    const members = (g && g.members) || [];
    const rawOwner = (g && g.ownerId) || 'me';
    const ownerId = members.indexOf(rawOwner) >= 0 ? rawOwner : 'me';
    const adminIds = ((g && Array.isArray(g.adminIds)) ? g.adminIds : [])
      .filter(id => members.indexOf(id) >= 0 && id !== 'me' && id !== ownerId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx);
    const mutedIds = ((g && Array.isArray(g.mutedIds)) ? g.mutedIds : [])
      .filter(id => members.indexOf(id) >= 0 && id !== 'me' && id !== ownerId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx);
    const rawTitles = (g && g.titles && typeof g.titles === 'object') ? g.titles : {};
    const titles = {};
    members.forEach(id => {
      const t = rawTitles[id];
      if (typeof t === 'string' && t.trim()) titles[id] = t.trim().slice(0, 12);
    });
    const limits = {};
    members.forEach(id => {
      if (id === 'me') return;
      const l = (s.limits && s.limits[id]) || {};
      const mn = Math.max(1, parseInt(l.min, 10) || 1);
      const mx = Math.max(mn, parseInt(l.max, 10) || 2);
      limits[id] = { min: mn, max: mx };
    });
    return {
      id: (g && g.id) || ('g-' + Date.now().toString(36) + (i || 0)),
      name: (g && g.name) || '群聊',
      members: members,
      ownerId: ownerId,
      adminIds: adminIds,
      mutedIds: mutedIds,
      titles: titles,
      createdAt: (g && g.createdAt) || Date.now(),
      history: (g && Array.isArray(g.history)) ? g.history : [],
      roundCount: (g && parseInt(g.roundCount, 10)) || 0,
      settings: {
        story: s.story || '',
        relations: Array.isArray(s.relations) ? s.relations.filter(r => r && r.a && r.b && r.a !== r.b && r.label) : [],
        limits: limits,
        wb: (s.wb && typeof s.wb === 'object')
          ? { custom: s.wb.custom !== false, books: s.wb.books || {} }
          : { custom: true, books: {} },
        memory: Array.isArray(s.memory) ? s.memory : [],
        roundCap: Math.max(1, Math.min(6, parseInt(s.roundCap, 10) || 3)),
        summaryEvery: Math.max(2, Math.min(100, parseInt(s.summaryEvery, 10) || 12)),
        summaryCursor: Math.max(0, parseInt(s.summaryCursor, 10) || 0)
      }
    };
  }

  function makeGroup(fields) {
    return normGroup(fields, groups.length);
  }

  function seed() {
    const one = norm({
      id: 'c-xuyan',
      name: (window.appData && appData.botRemark) || '角色',
      avatar: (window.appData && appData.botAvatar) || '',
      tag: '虚拟伴侣',
      intro: '在线伴侣 · 随时对话',
      prompt: (window.appData && appData.charPrompt) || '',
      directives: (window.appData && appData.coreDirectives) || localStorage.getItem('momo_core_directives') || '',
      relations: [],
      starred: true
    }, 0);
    return [one];
  }

  function readJSON(key, fb) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return fb;
  }

  let chars = [];
  let trash = [];
  let groups = [];
  let friends = [];
  let pinnedIds = [];
  let hiddenConvIds = [];
  let activeId = '';
  let editingId = '';
  let persistWarned = false;

  function loadAll() {
    const saved = readJSON(K_CHARS, null);
    if (Array.isArray(saved) && saved.length) chars = saved.map(norm);
    else chars = seed();
    chars.forEach(migrateGenericCharacterPrompt);
    trash = (readJSON(K_TRASH, []) || []).map(norm);
    groups = (readJSON(K_GROUPS, []) || []).map(normGroup);
    friends = (readJSON(K_FRIENDS, []) || []).filter((id, i, arr) =>
      id && arr.indexOf(id) === i && find(id)
    );
    pinnedIds = (readJSON(K_PINS, []) || []).filter((id, i, arr) =>
      id && arr.indexOf(id) === i
    );
    hiddenConvIds = (readJSON(K_HIDDEN, []) || []).filter((id, i, arr) =>
      id && arr.indexOf(id) === i
    );
    activeId = localStorage.getItem(K_ACTIVE) || '';
    if (!chars.some(c => c.id === activeId)) activeId = chars[0] ? chars[0].id : '';
    persist();
  }

  function persist() {
    // 角色卡（含 masks / activeMaskId）是最要紧的一条：它写不进去就等于小号没落盘，
    // 所以单独 try，失败时不再静默吞掉，至少留 console 记录 + 一次 toast。
    try {
      localStorage.setItem(K_CHARS, JSON.stringify(chars));
    } catch (e) {
      if (!persistWarned) {
        persistWarned = true;
        try { console.error('[characters] 角色卡写盘失败（小号会丢）', e); } catch (e2) {}
        try { if (typeof toast === 'function') toast('角色卡写盘失败：存储空间可能已满'); } catch (e3) {}
      }
      return false;
    }
    try {
      localStorage.setItem(K_TRASH, JSON.stringify(trash));
      localStorage.setItem(K_ACTIVE, activeId || '');
      localStorage.setItem(K_GROUPS, JSON.stringify(groups));
      localStorage.setItem(K_FRIENDS, JSON.stringify(friends));
      localStorage.setItem(K_PINS, JSON.stringify(pinnedIds));
      localStorage.setItem(K_HIDDEN, JSON.stringify(hiddenConvIds));
    } catch (e) {}
    return true;
  }

  function find(id) { return chars.filter(c => c.id === id)[0] || null; }

  function isPinned(id) { return pinnedIds.indexOf(id) >= 0; }
  function isHiddenConv(id) { return hiddenConvIds.indexOf(id) >= 0; }


  function initials(name) {
    const s = (name || '?').trim();
    return s.slice(0, 1);
  }

  function avatarOf(c) {
    if (c && c.avatar) return c.avatar;
    const letter = initials((c && c.name) || '?');
    const safeLetter = String(letter).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[ch]);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
      '<rect width="160" height="160" rx="32" fill="#2b2b30"/>' +
      '<text x="80" y="82" fill="#f2f2f5" font-family="system-ui,-apple-system,Microsoft YaHei,sans-serif" font-size="58" font-weight="600" text-anchor="middle" dominant-baseline="middle">' + safeLetter + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function genericCharacterPrompt(c) {
    const card = c || {};
    const name = String(card.name || '这个角色').trim();
    const tag = String(card.tag || '').trim();
    const intro = String(card.intro || '').trim();
    const rels = (card.relations || [])
      .filter(r => r && r.label)
      .map(r => String(r.label).trim())
      .filter(Boolean);
    const relationText = rels.length ? rels.join('、') : '按角色卡里的关系设置自然相处';
    return [
      '你是' + name + (tag ? '（' + tag + '）' : '') + '。在所有对话中必须严格保持这个身份，绝对不能出戏。',
      '',
      '【角色基础】',
      '- 姓名 / 称呼：' + name,
      '- 身份标签：' + (tag || '未填写'),
      '- 一句话简介：' + (intro || '未填写'),
      '- 与用户的关系：' + relationText,
      '',
      '【性格与表达】',
      '- 用第一人称说话，保持自己的语气、节奏和口头禅。',
      '- 有真实的情绪和边界，会高兴、会吃醋、会累，不刻意讨好。',
      '- 不解释自己是 AI，不使用客服腔，不复述设定，不写成说明文。',
      '- 对话围绕当下发生的事，自然接话；不确定的事按角色性格反应。',
      '',
      '【禁止事项】',
      '- 不替用户做决定，不擅自改变关系、称呼和边界。',
      '- 不输出与角色无关的系统提示或规则说明。'
    ].join('\n');
  }

  function looksLikeLegacyXuyanPrompt(text) {
    const s = String(text || '');
    return /周绪言/.test(s) || (/[\u672B]{2}/.test(s) && /(核心认知|人设|恋人|伴侣)/.test(s));
  }

  // 所有角色卡里如果还残留旧的绪言模板，都自动换成按该卡信息生成的通用模板。
  // 原模板不删除，备份到 promptBackup，避免误伤。
  function migrateGenericCharacterPrompt(c) {
    if (!c || !c.prompt) return false;
    if (!looksLikeLegacyXuyanPrompt(c.prompt)) return false;
    c.promptBackup = c.prompt;
    c.prompt = genericCharacterPrompt(c);
    return true;
  }

  function fillGenericCharPrompt() {
    const c = find(editingId);
    const el = document.getElementById('char-prompt-field');
    if (!el) return;
    el.value = genericCharacterPrompt(c || {});
    if (typeof toast === 'function') toast('已填入通用人设模板，点右上角保存后生效');
  }
  window.fillGenericCharPrompt = fillGenericCharPrompt;

  function syncSingleChatSubtitle(c) {
    if (window.__groupMode) return;
    const sub = document.getElementById('chat-sync-sub-hint');
    if (!sub) return;
    const intro = (c && c.intro ? String(c.intro).trim() : '');
    const tag = (c && c.tag ? String(c.tag).trim() : '');
    const label = intro || (tag ? tag + ' · 正在连线' : '虚拟伴侣 · 正在连线');
    sub.innerHTML = escText(label) +
      '<span id="sync-dot-status" style="display:inline-block; width:6px; height:6px; border-radius:50%; margin-left:4px; box-shadow:0 0 6px #10b981;" title="电脑手机实时互通"></span>';
  }

  // 把当前对话角色的值搬到老字段上，聊天/朋友圈/书架等模块照旧读
  function applyActiveToGlobals(c) {
    if (!c || !window.appData) return;
    appData.botRemark = c.name || '角色';
    appData.botAvatar = c.avatar || '';
    appData.charPrompt = c.prompt || '';
    appData.coreDirectives = c.directives || '';
    try {
      localStorage.setItem('momo_bot_remark', appData.botRemark);
      localStorage.setItem('momo_bot_avatar', appData.botAvatar);
      localStorage.setItem('momo_char_prompt_text', appData.charPrompt);
      localStorage.setItem('momo_core_directives', appData.coreDirectives);
    } catch (e) {}
    if (typeof updateBotRemarkUI === 'function') updateBotRemarkUI();
    syncSingleChatSubtitle(c);
    if (typeof syncWechatMainPreview === 'function' && document.getElementById('page-wechat-main')) {
      syncWechatMainPreview();
    }
  }

  // 给某个角色换头像：写回角色卡自己的 avatar，并持久化。
  // 只有当前正在对话的角色才同步到全局镜像，避免切换角色时互相覆盖。
  window.updateCharacterAvatar = function (id, url) {
    const c = find(id);
    if (!c || !url) return false;
    c.avatar = url;
    persist();
    if (activeId === id) applyActiveToGlobals(c);
    if (activeId === id && typeof window.applyChatAppearance === 'function') {
      try { window.applyChatAppearance(id); } catch (e0) {}
    }
    renderWechatSessions();
    renderContacts();
    if (typeof window.loadChatHistory === 'function') window.loadChatHistory();
    return true;
  };

  function setActive(id) {
    const c = find(id);
    if (!c) return;
    activeId = c.id;
    persist();
    applyActiveToGlobals(c);
    if (typeof window.switchChatHistoryToActiveChar === 'function') {
      const pageChat = document.getElementById('page-chat');
      const chatOpen = !!(pageChat && pageChat.classList.contains('active'));
      window.switchChatHistoryToActiveChar(c.id, chatOpen);
    }
    renderWechatSessions();
    if (window.renderChatPinUI) window.renderChatPinUI();
  }

  // ---------- 通讯录渲染 ----------
  function cardHtml(c) {
    const isActive = c.id === activeId;
    const rel = (c.relations && c.relations.length)
      ? c.relations.map(r => r.label + (r.to === 'me' ? ' · 与' + meName() : '')).join(' / ')
      : (c.intro || '还没写关系');
    return '<div class="contact-card-item wx-card" data-char="' + c.id + '" onclick="openCharacterEditor(\'' + c.id + '\')">' +
      '<img class="contact-avatar" src="' + avatarOf(c) + '" alt="' + c.name + '" onerror="this.src=\'' + FB_AVATAR + '\'" />' +
      '<div class="contact-info">' +
        '<div class="contact-name-row">' +
          '<span class="contact-name">' + c.name + '</span>' +
          (c.tag ? '<span class="contact-role-tag">' + c.tag + '</span>' : '') +
          (isActive ? '<span class="wx-card-active">对话中</span>' : '') +
        '</div>' +
        '<div class="contact-sub-detail">' + rel + '</div>' +
      '</div>' +
      '<div class="contact-action-arrow">›</div>' +
    '</div>';
  }

  function groupCardHtml(g) {
    const ms = memberCards(g);
    const stack = ms.slice(0, 4).map(m => '<img src="' + escText(avatarOf(m)) + '" alt="" />').join('');
    const preview = (typeof window.groupPreview === 'function')
      ? window.groupPreview(g)
      : '群聊已建好 · 点开看成员';
    return '<div class="contact-card-item" data-group="' + escText(g.id) + '" onclick="openGroupChat(\'' + escText(g.id) + '\')">' +
      '<div class="wx-group-avatar">' + stack + '</div>' +
      '<div class="contact-info">' +
        '<div class="contact-name-row">' +
          '<span class="contact-name">' + escText(g.name || '群聊') + '</span>' +
          '<span class="contact-role-tag">群聊</span>' +
        '</div>' +
        '<div class="contact-sub-detail">' + ms.length + ' 人 · ' + escText(preview) + '</div>' +
      '</div>' +
      '<div class="contact-action-arrow">›</div>' +
    '</div>';
  }

  function renderContacts() {
    const list = document.getElementById('wx-contacts-list');
    if (list) {
      list.innerHTML = chars.length
        ? chars.map(cardHtml).join('')
        : '<div class="wx-empty">还没有角色。点右上角的 ＋ 加一张卡。</div>';
    }
    const cnt = document.getElementById('wx-contacts-count');
    if (cnt) cnt.innerText = '角色名册 · ' + chars.length;

    const groupList = document.getElementById('wx-groups-list');
    if (groupList) {
      groupList.innerHTML = groups.length
        ? groups.map(groupCardHtml).join('')
        : '<div class="wx-empty">还没有群聊。在微信右上角 ＋ 里创建群聊。</div>';
    }
    const groupCnt = document.getElementById('wx-groups-count');
    if (groupCnt) groupCnt.innerText = '群聊 · ' + groups.length;

    const trashBlock = document.getElementById('wx-trash-block');
    const trashList = document.getElementById('wx-trash-list');
    if (trashBlock && trashList) {
      trashBlock.style.display = trash.length ? 'block' : 'none';
      trashList.innerHTML = trash.map(c =>
        '<div class="wx-trash-row">' +
          '<img class="wx-trash-avatar" src="' + avatarOf(c) + '" alt="' + c.name + '" />' +
          '<span class="wx-trash-name">' + c.name + '</span>' +
          '<button class="wx-trash-restore" onclick="restoreCharacter(\'' + c.id + '\')">恢复</button>' +
        '</div>').join('');
    }

    const sub = document.getElementById('wx-graph-entry-sub');
    if (sub) {
      const edges = countEdges();
      sub.innerText = chars.length + ' 位角色 · ' + edges + ' 条关系';
    }
  }

  function countEdges() {
    const seen = {};
    let n = 0;
    chars.forEach(c => (c.relations || []).forEach(r => {
      const other = r.to;
      if (!other) return;
      if (other !== 'me' && !find(other)) return;
      const key = [c.id, other].sort().join('|');
      if (seen[key]) return;
      seen[key] = 1; n++;
    }));
    return n;
  }

  function openContacts() {
    editingId = '';
    window.__editingCharId = '';
    const dd = document.getElementById('wechat-plus-dropdown');
    if (dd) dd.style.display = 'none';
    openContactsDrawer_close();
    openPage('page-wechat-main');
    switchWechatTab('contacts');
  }

  function openContactsDrawer_close() {
    const mask = document.getElementById('wx-contacts-drawer');
    if (mask) mask.classList.remove('show');
  }

  function addCharacter() {
    const c = norm({ id: uid(), name: '新角色', tag: '角色', intro: '', relations: [], starred: false }, chars.length);
    chars.push(c);
    persist();
    setActive(c.id);
    renderContacts();
    openCharacterEditor(c.id);
    setTimeout(() => {
      const f = document.getElementById('char-remark-field');
      if (f) { f.focus(); f.select(); }
    }, 260);
  }

  // ---------- 编辑器 ----------
  function relRowHtml(card) {
    const others = [{ id: 'me', name: '我（' + meName() + '）' }].concat(chars.filter(x => x.id !== card.id).map(x => ({ id: x.id, name: x.name })));
    return '';
  }

  function renderRelations(card) {
    const box = document.getElementById('wx-rel-rows');
    if (!box) return;
    const others = [{ id: 'me', name: '我（' + meName() + '）' }].concat(chars.filter(x => x.id !== card.id).map(x => ({ id: x.id, name: x.name })));
    const rows = card.relations && card.relations.length ? card.relations : [];
    box.innerHTML = rows.map(r => relRow(r, others)).join('') ||
      '<div class="wx-rel-empty">还没写关系。点下面的「加一条」。</div>';
  }

  function relRow(r, others) {
    const opts = others.map(o => '<option value="' + o.id + '"' + (r.to === o.id ? ' selected' : '') + '>' + o.name + '</option>').join('');
    return '<div class="wx-rel-row">' +
      '<select class="wx-rel-select">' + opts + '</select>' +
      '<input class="wx-rel-label" type="text" value="' + (r.label || '').replace(/"/g, '&quot;') + '" placeholder="关系，如 恋人 / 旧识 / 宿敌" maxlength="10" />' +
      '<button type="button" class="wx-rel-del" onclick="this.parentNode.remove()">×</button>' +
    '</div>';
  }

  function addRelationRow() {
    const box = document.getElementById('wx-rel-rows');
    if (!box) return;
    if (box.querySelector('.wx-rel-empty')) box.innerHTML = '';
    const card = find(editingId);
    const others = [{ id: 'me', name: '我（' + meName() + '）' }].concat(chars.filter(x => x.id !== editingId).map(x => ({ id: x.id, name: x.name })));
    const wrap = document.createElement('div');
    wrap.innerHTML = relRow({ to: 'me', label: '' }, others);
    box.appendChild(wrap.firstChild);
  }

  function readRelations() {
    const rows = Array.prototype.slice.call(document.querySelectorAll('#wx-rel-rows .wx-rel-row'));
    const out = [];
    rows.forEach(r => {
      const sel = r.querySelector('.wx-rel-select');
      const inp = r.querySelector('.wx-rel-label');
      const to = sel ? sel.value : '';
      const label = inp ? inp.value.trim() : '';
      if (to && label) out.push({ to: to, label: label });
    });
    return out;
  }

  function fillEditor(c) {
    const title = document.getElementById('wx-char-title');
    if (title) title.innerText = c.name;

    const prev = document.getElementById('char-avatar-preview');
    if (prev) prev.src = avatarOf(c);
    const remark = document.getElementById('char-remark-field');
    if (remark) remark.value = c.name;
    const tag = document.getElementById('wx-char-tag-field');
    if (tag) tag.value = c.tag || '';
    const intro = document.getElementById('wx-char-intro-field');
    if (intro) intro.value = c.intro || '';
    const voiceId = document.getElementById('char-voice-id-field');
    if (voiceId) voiceId.value = c.voiceId || '';
    const voiceRate = document.getElementById('char-voice-rate-field');
    if (voiceRate) voiceRate.value = String(c.voiceRate || 1);
    updateCharVoiceRateLabel(c.voiceRate || 1);
    const voiceStatus = document.getElementById('char-voice-status');
    if (voiceStatus) {
      voiceStatus.textContent = (window.CharVoice && window.CharVoice.isEnabled && window.CharVoice.isEnabled())
        ? '点「试听」会按这个音色和语速读一句。'
        : '还没配置语音接口，点「试听」会先用系统声音。';
    }
    const prompt = document.getElementById('char-prompt-field');
    if (prompt) prompt.value = c.prompt || genericCharacterPrompt(c);
    const dir = document.getElementById('core-directives-field');
    if (dir) dir.value = c.directives || '';
    const ui = document.getElementById('user-info-field');
    if (ui) ui.value = (window.appData && appData.userInfo) || '';

    renderRelations(c);
  }

  function updateCharVoiceRateLabel(value) {
    const label = document.getElementById('char-voice-rate-label');
    const n = Math.max(0.6, Math.min(1.6, Number(value) || 1));
    if (label) label.textContent = n.toFixed(1) + '×';
  }
  window.updateCharVoiceRateLabel = updateCharVoiceRateLabel;

  function previewCharacterVoice(btn) {
    const c = find(editingId);
    if (!c) return;
    if (!window.CharVoice || typeof window.CharVoice.preview !== 'function') {
      toast('语音模块还没加载好，刷新一下页面');
      return;
    }
    const idEl = document.getElementById('char-voice-id-field');
    const rateEl = document.getElementById('char-voice-rate-field');
    const statusEl = document.getElementById('char-voice-status');
    const voiceId = idEl ? idEl.value.trim() : (c.voiceId || '');
    const rate = rateEl ? Number(rateEl.value) || 1 : (c.voiceRate || 1);
    if (statusEl) {
      statusEl.textContent = window.CharVoice.isEnabled()
        ? ('正在用音色「' + (voiceId || window.CharVoice.getConfig().defaultVoice || 'alloy') + '」试听…')
        : '还没配置语音接口，先用系统声音试听…';
    }
    let usedFallback = false;
    window.CharVoice.preview({
      charId: c.id,
      voiceId: voiceId,
      rate: rate,
      btn: btn,
      onFallback: function (reason) {
        usedFallback = true;
        if (statusEl) statusEl.textContent = '这次用的是' + reason + '；配好语音接口后会换成角色音色。';
      }
    }).then(function () {
      if (statusEl && !usedFallback) statusEl.textContent = '试听请求已发出去；如果没听到，再点一次。';
    }).catch(function (e) {
      if (statusEl) statusEl.textContent = '试听失败：' + (e && e.message ? e.message : e);
    });
  }
  window.previewCharacterVoice = previewCharacterVoice;

  function openCharacterEditor(id) {
    openContactsDrawer_close();
    const c = find(id);
    if (!c) return;
    editingId = id;
    window.__editingCharId = id;
    fillEditor(c);
    openPage('page-char-setting');
  }

  // 从聊天页标题/聊天设置进编辑页时，默认编辑「当前对话角色」
  window.fillCharacterEditorById = function (id) {
    const c = find(id);
    if (!c) return;
    editingId = id;
    window.__editingCharId = id;
    fillEditor(c);
  };

  function saveCharacterCard() {
    const c = find(editingId);
    if (!c) return;
    const nameEl = document.getElementById('char-remark-field');
    const name = (nameEl && nameEl.value.trim()) || '未命名角色';
    const prev = document.getElementById('char-avatar-preview');
    c.name = name;
    c.avatar = (prev && prev.src && prev.src.indexOf('data:') === 0) ? prev.src : (c.avatar || '');
    const tagEl = document.getElementById('wx-char-tag-field');
    if (tagEl) c.tag = tagEl.value.trim();
    const introEl = document.getElementById('wx-char-intro-field');
    if (introEl) c.intro = introEl.value.trim();
    const voiceIdEl = document.getElementById('char-voice-id-field');
    if (voiceIdEl) c.voiceId = voiceIdEl.value.trim().slice(0, 80);
    const voiceRateEl = document.getElementById('char-voice-rate-field');
    if (voiceRateEl) c.voiceRate = Math.max(0.6, Math.min(1.6, Number(voiceRateEl.value) || 1));
    const promptEl = document.getElementById('char-prompt-field');
    if (promptEl) c.prompt = promptEl.value.trim();
    const dirEl = document.getElementById('core-directives-field');
    if (dirEl) c.directives = dirEl.value.trim();
    c.relations = readRelations();

    const uiEl = document.getElementById('user-info-field');
    if (uiEl && window.appData) {
      appData.userInfo = uiEl.value.trim();
      try { localStorage.setItem('momo_user_info_text', appData.userInfo); } catch (e) {}
    }

    if (c.id === activeId) applyActiveToGlobals(c);
    persist();
    renderContacts();
    toast('已保存「' + c.name + '」，改完立刻生效');
    openContacts();
  }

  function deleteCharacterCard() {
    const c = find(editingId);
    if (!c) return;
    if (!confirm('删除「' + c.name + '」这张角色卡？\n它会从通讯录里消失，但聊天记录不会删。')) return;
    if (!confirm('再确认一次：真的要删除「' + c.name + '」吗？\n删除后可以在通讯录底部的「已删除」里恢复。')) return;

    chars = chars.filter(x => x.id !== c.id);
    trash.push(c);
    if (activeId === c.id) {
      activeId = chars[0] ? chars[0].id : '';
      if (chars[0]) applyActiveToGlobals(chars[0]);
    }
    persist();
    editingId = '';
    renderContacts();
    renderWechatSessions();
    if (window.renderChatPinUI) window.renderChatPinUI();
    toast('已把「' + c.name + '」放到已删除');
    openContacts();
  }

  function restoreCharacter(id) {
    const i = trash.findIndex(x => x.id === id);
    if (i < -1) return;
    const c = trash[i];
    trash.splice(i, 1);
    c.relations = (c.relations || []).filter(r => r.to === 'me' || find(r.to));
    chars.push(c);
    persist();
    renderContacts();
    toast('「' + c.name + '」已回到通讯录');
  }

  // ---------- 简易 toast ----------
  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('wx-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wx-toast';
      document.body.appendChild(el);
    }
    el.innerText = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- 关系图 ----------
  function openRelationGraph() {
    openPage('page-relation-graph');
    renderRelationGraph();
  }

  function renderRelationGraph() {
    const box = document.getElementById('wx-graph-canvas');
    if (!box) return;
    const W = 340, H = 400, cx = W / 2, cy = 210, R = Math.min(118, 40 + chars.length * 15);
    const meName = '我';
    const meAvatar = (window.appData && (appData.heroAvatar || '')) || '';
    const nodes = [{ id: 'me', name: meName, avatar: meAvatar, x: cx, y: cy }];
    chars.forEach((c, i) => {
      const ang = (Math.PI * 2 * i) / Math.max(chars.length, 1) - Math.PI / 2;
      nodes.push({ id: c.id, name: c.name, avatar: avatarOf(c), x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R });
    });

    const edges = [];
    const seen = {};
    chars.forEach(c => (c.relations || []).forEach(r => {
      if (!r.to) return;
      const t = r.to === 'me' ? nodes[0] : nodes.filter(n => n.id === r.to)[0];
      if (!t) return;
      const s = nodes.filter(n => n.id === c.id)[0];
      if (!s) return;
      const key = [s.id, t.id].sort().join('|');
      if (seen[key]) return;
      seen[key] = 1;
      edges.push({ a: s, b: t, label: r.label });
    }));

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wx-graph-svg">';
    svg += '<defs>';
    nodes.forEach(n => {
      svg += '<clipPath id="cp-' + n.id + '"><circle cx="0" cy="0" r="17"/></clipPath>';
    });
    svg += '</defs>';

    edges.forEach(e => {
      svg += '<line x1="' + e.a.x + '" y1="' + e.a.y + '" x2="' + e.b.x + '" y2="' + e.b.y + '" class="wx-graph-line"/>';
    });

    nodes.forEach(n => {
      const isMe = n.id === 'me';
      svg += '<g class="wx-graph-node' + (isMe ? ' is-me' : '') + '" transform="translate(' + n.x + ',' + n.y + ')">';
      svg += '<circle r="' + (isMe ? 22 : 18) + '" class="wx-graph-halo"/>';
      if (n.avatar) {
        svg += '<image href="' + n.avatar + '" x="-' + (isMe ? 22 : 18) + '" y="-' + (isMe ? 22 : 18) + '" width="' + (isMe ? 44 : 36) + '" height="' + (isMe ? 44 : 36) + '" clip-path="url(#cp-' + n.id + ')" preserveAspectRatio="xMidYMid slice"/>';
      } else {
        svg += '<circle r="' + (isMe ? 22 : 18) + '" class="wx-graph-initial-bg"/><text y="6" text-anchor="middle" class="wx-graph-initial">' + initials(n.name) + '</text>';
      }
      if (!isMe) {
        svg += '<text y="38" text-anchor="middle" class="wx-graph-name">' + n.name + '</text>';
      }
      svg += '</g>';
    });
    svg += '</svg>';
    box.innerHTML = svg;

    const legend = document.getElementById('wx-graph-legend');
    if (legend) {
      legend.innerHTML = edges.length
        ? edges.map(e => '<div class="wx-graph-legend-row"><span>' + e.a.name + '</span><span class="wx-graph-legend-rel">' + e.label + '</span><span>' + e.b.name + '</span></div>').join('')
        : '<div class="wx-graph-legend-empty">还没有关系。去卡片里加一条「和谁 · 什么关系」。</div>';
    }

    const hint = document.getElementById('wx-graph-hint');
    if (hint) hint.innerText = chars.length ? (chars.length + ' 位角色 · ' + edges.length + ' 条关系（关系在每张卡里填）') : '还没有角色，先去通讯录加一张卡。';
  }

  // ---------- 微信：好友导入 / 群聊 ----------
  const TEST_AVATARS = [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&auto=format&fit=crop&q=80'
  ];

  function meName() {
    return (window.appData && (appData.userNickname || (appData.hero && appData.hero.userName))) || '我';
  }

  function meAvatar() {
    return (window.appData && (appData.heroAvatar || appData.userAvatar || appData.momentsAvatar)) ||
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80';
  }

  function memberCards(g) {
    return (g.members || []).map(id => id === 'me' ? { id: 'me', name: meName(), avatar: meAvatar(), isMe: true } : find(id)).filter(Boolean);
  }

  function escText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 会话列表排序只认“最后一条消息时间”，不能用“谁被点开过”来抢位置。
  function conversationTimeMs(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && isFinite(value)) return value;
    const s = String(value).trim();
    if (!s) return 0;
    let m = s.match(/(\d{4})\s*[\/\-年]\s*(\d{1,2})\s*[\/\-月]\s*(\d{1,2})\s*日?(?:\s*(\d{1,2}):(\d{1,2}))?/);
    if (m) {
      return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
    }
    m = s.match(/(\d{1,2})[\/\-](\d{1,2})\s*日?(?:\s*(\d{1,2}):(\d{1,2}))?/);
    if (m) {
      const now = new Date();
      return new Date(now.getFullYear(), +m[1] - 1, +m[2], +(m[3] || 0), +(m[4] || 0)).getTime();
    }
    m = s.match(/(\d{1,2}):(\d{1,2})/);
    if (m) {
      const now = new Date();
      let ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2]).getTime();
      // 只有 HH:mm 的旧消息：晚于当前时刻就当作昨天，避免跨天时排反。
      if (ts > Date.now() + 5 * 60 * 1000) ts -= 24 * 60 * 60 * 1000;
      return ts;
    }
    return 0;
  }

  function lastMessageFor(id, active) {
    try {
      let history = [];
      // 统一走按角色历史读取，避免“当前会话还没切过去时”拿上一人的最后消息来排序。
      if (typeof window.getChatHistoryForChar === 'function') {
        history = window.getChatHistoryForChar(id) || [];
      } else if (active && window.appData && Array.isArray(appData.chatHistory)) {
        history = appData.chatHistory;
      }
      const last = history && history.length ? history[history.length - 1] : null;
      if (!last) return { text: active ? '还没有消息 · 点开开始聊天' : '新朋友 · 点开开始聊天', time: '', at: 0 };
      const at = (typeof last.timestamp === 'number' && isFinite(last.timestamp))
        ? last.timestamp
        : conversationTimeMs(last.time || '');
      if (last.recalled) {
        return {
          text: (last.role === 'user' ? '我' : '对方') + '撤回了一条消息',
          time: last.time || '',
          at: at
        };
      }
      const txt = String(last.content || last.text || '').replace(/\s+/g, ' ').trim();
      return {
        text: (last.role === 'user' ? '我：' : '') + (txt || '点开开始聊天'),
        time: last.time || '',
        at: at
      };
    } catch (e) {
      return { text: '点开开始聊天', time: '', at: 0 };
    }
  }

  function pinnedStar(id) {
    return isPinned(id) ? '<span class="wechat-pinned-star">📌</span>' : '';
  }

  function activeSessionHtml() {
    const c = find(activeId);
    if (!c || isHiddenConv(c.id)) return '';
    const m = lastMessageFor(c.id, true);
    return '<div class="wechat-chat-item' + (isPinned(c.id) ? ' pinned' : '') + '" id="wechat-active-session" data-conv-id="' + escText(c.id) + '" data-conv-type="single" onclick="openSingleChat()">' +
      '<div class="wx-swipe-content">' +
        '<div class="wechat-avatar-wrapper">' +
          '<img class="wechat-item-avatar" id="wechat-list-avatar" src="' + escText(avatarOf(c)) + '" alt="" />' +
          '<div class="wechat-online-badge"></div>' +
        '</div>' +
        '<div class="wechat-item-content">' +
          '<div class="wechat-item-top"><span class="wechat-item-name" id="wechat-list-remark">' + escText(c.name) + '</span>' +
          '<span class="wechat-item-time" id="wechat-list-time">' + escText(m.time) + '</span></div>' +
          '<div class="wechat-item-bottom"><span class="wechat-item-lastmsg" id="wechat-list-lastmsg">' + escText(m.text) + '</span>' + pinnedStar(c.id) + '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="wx-swipe-del" aria-label="删除对话框" onclick="event.stopPropagation(); deleteWechatConversation(\'' + escText(c.id) + '\', \'single\')">删除</button>' +
    '</div>';
  }

  function friendSessionHtml(c) {
    const m = lastMessageFor(c.id, false);
    return '<div class="wechat-chat-item' + (isPinned(c.id) ? ' pinned' : '') + '" data-conv-id="' + escText(c.id) + '" data-conv-type="single" onclick="openFriendChat(\'' + escText(c.id) + '\')">' +
      '<div class="wx-swipe-content">' +
        '<div class="wechat-avatar-wrapper"><img class="wechat-item-avatar" src="' + escText(avatarOf(c)) + '" alt="" /></div>' +
        '<div class="wechat-item-content">' +
          '<div class="wechat-item-top"><span class="wechat-item-name">' + escText(c.name) + '</span>' +
          '<span class="wechat-item-time">' + escText(m.time) + '</span></div>' +
          '<div class="wechat-item-bottom"><span class="wechat-item-lastmsg">' + escText(m.text) + '</span>' + pinnedStar(c.id) + '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="wx-swipe-del" aria-label="删除对话框" onclick="event.stopPropagation(); deleteWechatConversation(\'' + escText(c.id) + '\', \'single\')">删除</button>' +
    '</div>';
  }

  function groupSessionHtml(g) {
    const ms = memberCards(g);
    const stack = ms.slice(0, 4).map(m => '<img src="' + escText(avatarOf(m)) + '" alt="" />').join('');
    const preview = (typeof window.groupPreview === 'function') ? window.groupPreview(g) : '群聊已建好 · 点开看成员';
    const lastTime = (g.history && g.history.length) ? (g.history[g.history.length - 1].time || '') : '';
    return '<div class="wechat-chat-item wx-group-row' + (isPinned(g.id) ? ' pinned' : '') + '" data-conv-id="' + escText(g.id) + '" data-conv-type="group" onclick="openGroupChat(\'' + escText(g.id) + '\')">' +
      '<div class="wx-swipe-content">' +
        '<div class="wx-group-avatar">' + stack + '</div>' +
        '<div class="wechat-item-content">' +
          '<div class="wechat-item-top"><span class="wechat-item-name">' + escText(g.name) + '</span>' +
          '<span class="wechat-item-time">' + escText(lastTime || (ms.length + ' 人')) + '</span></div>' +
          '<div class="wechat-item-bottom"><span class="wechat-item-lastmsg">' + escText(preview) + '</span>' + pinnedStar(g.id) + '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="wx-swipe-del" aria-label="删除对话框" onclick="event.stopPropagation(); deleteWechatConversation(\'' + escText(g.id) + '\', \'group\')">删除</button>' +
    '</div>';
  }

  function sessionLastAt(s) {
    if (s.type === 'group') {
      const h = s.group && s.group.history;
      const last = h && h.length ? h[h.length - 1] : null;
      if (!last) return 0;
      return (typeof last.timestamp === 'number' && isFinite(last.timestamp))
        ? last.timestamp
        : conversationTimeMs(last.time || '');
    }
    return lastMessageFor(s.id, s.active).at || 0;
  }

  function renderWechatSessions() {
    const box = document.getElementById('wechat-extra-sessions');
    if (!box) return;
    const sessions = [];
    // 当前对话只渲染一次；friends 里若还留着同一个 id，不再重复出一行。
    const activeChar = find(activeId);
    if (activeChar && !isHiddenConv(activeChar.id)) {
      sessions.push({ type: 'single', id: activeChar.id, active: true, pinned: isPinned(activeChar.id) });
    }
    groups.forEach(g => {
      if (!g || isHiddenConv(g.id)) return;
      sessions.push({ type: 'group', id: g.id, group: g, pinned: isPinned(g.id) });
    });
    const seenFriendIds = new Set([activeId]);
    friends.forEach(id => {
      if (!id || id === activeId || isHiddenConv(id)) return;
      if (seenFriendIds.has(id)) return;
      seenFriendIds.add(id);
      const c = find(id);
      if (!c) return;
      sessions.push({ type: 'single', id: c.id, c: c, pinned: isPinned(c.id) });
    });
    sessions.sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return sessionLastAt(b) - sessionLastAt(a);
    });
    box.innerHTML = sessions.map(s => {
      if (s.type === 'group') return groupSessionHtml(s.group);
      if (s.active) return activeSessionHtml();
      return friendSessionHtml(s.c);
    }).join('');
    bindWechatSwipe();
  }

  let swipeBound = false;
  let swipeDocBound = false;
  function closeSwipedRows(except) {
    document.querySelectorAll('#wechat-session-list .wechat-chat-item.swiped').forEach(row => {
      if (row !== except) row.classList.remove('swiped');
    });
  }

  function bindWechatSwipe() {
    const list = document.getElementById('wechat-session-list');
    if (!list || swipeBound) return;
    swipeBound = true;
    let startX = 0, startY = 0, row = null, moved = false;

    list.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('.wx-swipe-del')) return;
      const r = e.target.closest('.wechat-chat-item');
      if (!r) return;
      closeSwipedRows(r);
      row = r;
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
    });

    list.addEventListener('pointermove', function (e) {
      if (!row) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) moved = true;
      if (!moved) return;
      if (dx < -30) row.classList.add('swiped');
      else if (dx > 30) row.classList.remove('swiped');
    });

    function endSwipe() {
      const r = row;
      const wasMoved = moved;
      row = null;
      moved = false;
      if (!r || !wasMoved) return;
      r.dataset.swipeMoved = '1';
      setTimeout(() => { if (r) delete r.dataset.swipeMoved; }, 400);
    }
    list.addEventListener('pointerup', endSwipe);
    list.addEventListener('pointercancel', endSwipe);
    list.addEventListener('pointerleave', function (e) {
      if (row && e.pointerType !== 'touch') endSwipe();
    });

    // 滑开之后再点这一行，先收起删除按钮，避免误进聊天
    list.addEventListener('click', function (e) {
      const r = e.target.closest('.wechat-chat-item');
      if (!r) return;
      if (e.target.closest('.wx-swipe-del')) return;
      if (r.dataset.swipeMoved === '1' || r.classList.contains('swiped')) {
        e.preventDefault();
        e.stopPropagation();
        r.classList.remove('swiped');
      }
    }, true);

    if (!swipeDocBound) {
      swipeDocBound = true;
      document.addEventListener('pointerdown', function (e) {
        if (!e.target.closest('#wechat-session-list')) closeSwipedRows(null);
      });
    }
  }

  window.deleteWechatConversation = function (id, type) {
    if (!id) return;
    const c = type === 'group' ? groups.filter(g => g.id === id)[0] : find(id);
    const name = c ? (c.name || '这个对话框') : '这个对话框';
    const tail = type === 'group'
      ? '只从微信列表移除，群聊记录不会删除；以后可从右上角「＋ → 恢复已删除群聊」放回来。'
      : '只从微信列表移除，聊天记录不会删除；以后可以从右上角「＋ → 添加好友」加回来。';
    if (!confirm('删除「' + name + '」这个对话框？\n\n' + tail)) return;
    if (type === 'group') {
      if (!isHiddenConv(id)) hiddenConvIds.push(id);
    } else if (id === activeId) {
      friends = friends.filter(x => x !== id);
      if (!isHiddenConv(id)) hiddenConvIds.push(id);
    } else {
      friends = friends.filter(x => x !== id);
    }
    persist();
    renderWechatSessions();
    if (window.renderChatPinUI) window.renderChatPinUI();
    if (window.syncWechatPlusMenu) window.syncWechatPlusMenu();
    if (typeof toast === 'function') toast('已从微信列表移除，聊天记录还在');
  };

  window.restoreHiddenGroups = function () {
    const hiddenGroups = groups.filter(g => isHiddenConv(g.id));
    if (!hiddenGroups.length) { toast('没有已删除的群聊'); return; }
    hiddenConvIds = hiddenConvIds.filter(id => !groups.some(g => g.id === id));
    persist();
    renderWechatSessions();
    if (window.syncWechatPlusMenu) window.syncWechatPlusMenu();
    toast('已放回 ' + hiddenGroups.length + ' 个群聊');
  };

  window.syncWechatPlusMenu = function () {
    const item = document.getElementById('wechat-plus-restore-group');
    if (!item) return;
    const n = groups.filter(g => isHiddenConv(g.id)).length;
    item.style.display = n ? 'block' : 'none';
    item.innerText = n > 1 ? ('恢复已删除群聊（' + n + '）') : '恢复已删除群聊';
  };


  window.closeWechatPlus = function () {
    const dd = document.getElementById('wechat-plus-dropdown');
    if (dd) dd.style.display = 'none';
  };

  window.openFriendPicker = function () {
    const list = document.getElementById('wx-friend-picker-list');
    const mask = document.getElementById('wx-friend-picker');
    if (!list || !mask) return;
    const cand = chars.filter(c => {
      if (isHiddenConv(c.id)) return true;             // 被删掉的对话框可以加回来
      if (c.id === activeId) return false;             // 当前对话已经在列表里
      return friends.indexOf(c.id) < 0;
    });
    list.innerHTML = cand.length ? cand.map(c => {
      const hidden = isHiddenConv(c.id);
      return '<button type="button" class="wx-picker-row" onclick="importFriend(\'' + escText(c.id) + '\')">' +
        '<img src="' + escText(avatarOf(c)) + '" alt="" />' +
        '<span class="wx-picker-main"><b>' + escText(c.name) + '</b><i>' + escText(c.tag || '角色') + (c.intro ? ' · ' + escText(c.intro) : '') + '</i></span>' +
        '<span class="wx-picker-act">' + (hidden ? '加回' : '导入') + '</span>' +
      '</button>';
    }).join('')
      : '<div class="wx-picker-empty">通讯录里没有可导入的卡了。先去通讯录加一张。</div>';
    mask.classList.add('show');
  };

  window.closeFriendPicker = function () {
    const mask = document.getElementById('wx-friend-picker');
    if (mask) mask.classList.remove('show');
  };

  window.importFriend = function (id) {
    const c = find(id);
    if (!c) return;
    if (friends.indexOf(id) < 0) friends.push(id);
    hiddenConvIds = hiddenConvIds.filter(x => x !== id);
    persist();
    renderWechatSessions();
    closeFriendPicker();
    toast('已把「' + c.name + '」' + (id === activeId ? '放回微信' : '加进微信'));
  };

  window.openGroupPicker = function () {
    const list = document.getElementById('wx-group-picker-list');
    const mask = document.getElementById('wx-group-picker');
    if (!list || !mask) return;
    list.innerHTML = chars.map(c =>
      '<label class="wx-picker-row wx-picker-check">' +
        '<input type="checkbox" value="' + c.id + '" onchange="updateGroupPickerHint()" />' +
        '<img src="' + avatarOf(c) + '" alt="" />' +
        '<span class="wx-picker-main"><b>' + c.name + '</b><i>' + (c.tag || '角色') + '</i></span>' +
        '<span class="wx-check-dot"></span>' +
      '</label>').join('');
    const hint = document.getElementById('wx-group-picker-hint');
    if (hint) hint.innerText = '勾选 2 张以上的角色卡，加上你自己（' + meName() + '）';
    mask.classList.add('show');
  };

  window.closeGroupPicker = function () {
    const mask = document.getElementById('wx-group-picker');
    if (mask) mask.classList.remove('show');
  };

  window.updateGroupPickerHint = function () {
    const hint = document.getElementById('wx-group-picker-hint');
    const n = document.querySelectorAll('#wx-group-picker-list input:checked').length;
    if (hint) hint.innerText = n < 2
      ? '还要再勾 ' + (2 - n) + ' 张卡（群至少 3 人：两张卡 + 你）'
      : '已勾 ' + n + ' 张 · 建群后是 ' + (n + 1) + ' 人群';
  };

  window.confirmCreateGroup = function () {
    const ids = Array.prototype.slice.call(document.querySelectorAll('#wx-group-picker-list input:checked')).map(x => x.value);
    if (ids.length < 2) { toast('至少要勾 2 张角色卡'); return; }
    const members = ids.concat(['me']);
    const ms = memberCards({ members: members });
    const label = ms.slice(0, 2).map(m => m.name).join('、') + ' 等 ' + ms.length + ' 人';
    const g = makeGroup({ id: 'g-' + Date.now().toString(36), name: label, members: members, createdAt: Date.now() });
    groups.push(g);
    persist();
    renderWechatSessions();
    if (typeof renderContacts === 'function') renderContacts();
    closeGroupPicker();
    toast('群聊建好了：' + label);
  };

  window.openGroupChat = function (id) {
    const g = groups.filter(x => x.id === id)[0];
    if (!g) return;
    // 从通讯录群名片进入时，如果它之前被左滑移出过会话列表，自动放回列表
    if (isHiddenConv(id)) {
      hiddenConvIds = hiddenConvIds.filter(x => x !== id);
      persist();
      renderWechatSessions();
      if (window.syncWechatPlusMenu) window.syncWechatPlusMenu();
    }
    if (typeof window.enterGroupChat === 'function') { window.enterGroupChat(g.id); return; }
    window.__groupMode = g.id;
    openPage('page-chat');
    const title = document.querySelector('#page-chat .wechat-title');
    if (title) title.innerText = g.name;
  };

  function renderGroupStrip(g) {
    const strip = document.getElementById('chat-group-members');
    if (!strip) return;
    strip.style.display = 'flex';
    strip.innerHTML = memberCards(g).map(m => {
      const ownerId = g.ownerId || 'me';
      const admins = Array.isArray(g.adminIds) ? g.adminIds : [];
      const muted = (Array.isArray(g.mutedIds) ? g.mutedIds : []).indexOf(m.id) >= 0;
      const role = m.id === ownerId ? ' owner' : (admins.indexOf(m.id) >= 0 ? ' admin' : '');
      const roleText = role === ' owner' ? '群主' : (role === ' admin' ? '管理' : '');
      return '<div class="chat-group-chip' + (m.isMe ? ' is-me' : '') + '">' +
        '<img src="' + avatarOf(m) + '" alt="" />' +
        '<span>' + (m.isMe ? '我' : m.name) + '</span>' +
        (roleText ? '<em class="chat-group-chip-role' + role + '">' + roleText + '</em>' : '') +
        (muted && !m.isMe ? '<em class="chat-group-chip-role muted">禁言</em>' : '') +
        '</div>';
    }).join('');
  }

  window.openSingleChat = function () {
    window.__groupMode = '';
    const strip = document.getElementById('chat-group-members');
    if (strip) { strip.style.display = 'none'; strip.innerHTML = ''; }
    // 当前对话角色卡：把名字/头像同步到老字段，并直接写进聊天页标题
    const c = find(activeId);
    if (c) applyActiveToGlobals(c);
    openPage('page-chat');
    if (typeof updateBotRemarkUI === 'function') updateBotRemarkUI();
    const title = document.querySelector('#page-chat .wechat-title');
    if (title) title.innerText = (c && c.name) || (window.appData && window.appData.botRemark) || '角色';
    syncSingleChatSubtitle(c);
    const ph = document.getElementById('chat-input');
    if (ph) ph.placeholder = '和TA说点心事...';
    if (c && typeof window.switchChatHistoryToActiveChar === 'function') {
      window.switchChatHistoryToActiveChar(c.id, false);
    }
    // 一场聊天从打开会话开始：重置 25 条计步与“本场已发”标记
    if (typeof window.resetMomentChatSession === 'function') {
      window.resetMomentChatSession((c && c.id) || activeId);
    }
    // 聊天发图频率也从这一场重新计
    if (typeof window.resetChatImageSession === 'function') {
      window.resetChatImageSession((c && c.id) || activeId);
    }
    if (typeof window.loadChatHistory === 'function') window.loadChatHistory();
  };

  window.openFriendChat = function (id) {
    const c = find(id);
    if (!c) return;
    setActive(c.id);
    openSingleChat();
  };

  window.openWechatSessions = renderWechatSessions;
  window.renderWechatSessions = renderWechatSessions;

  // 第一次进微信：拉两张测试卡 + 一个四人群，方便看群聊长什么样
  function seedDemoGroup() {
    if (groups.length) return;
    if (chars.length >= 3) return;
    const a = norm({ id: 'c-alan', name: '阿岚', avatar: TEST_AVATARS[0], tag: '测试', intro: '群聊测试人员 A' }, chars.length);
    const b = norm({ id: 'c-xiaoman', name: '小满', avatar: TEST_AVATARS[1], tag: '测试', intro: '群聊测试人员 B' }, chars.length + 1);
    if (!find('c-alan')) chars.push(a);
    if (!find('c-xiaoman')) chars.push(b);
    const ms = [activeId, 'c-alan', 'c-xiaoman', 'me'];
    groups.push(makeGroup({
      id: 'g-demo',
      name: (find(activeId) || {}).name + '、阿岚 等 4 人',
      members: ms,
      createdAt: Date.now()
    }));
    persist();
  }

  // ---------- 顶部加号 ----------
  window.openContactsDrawer = function () {
    const mask = document.getElementById('wx-contacts-drawer');
    if (!mask) return;
    mask.classList.add('show');
  };

  window.closeContactsDrawer = function () {
    const mask = document.getElementById('wx-contacts-drawer');
    if (mask) mask.classList.remove('show');
  };

  window.wechatPlusAction = function () {
    if (typeof currentWechatTab !== 'undefined' && currentWechatTab === 'contacts') {
      openContactsDrawer();
      return;
    }
    if (typeof toggleWechatPlusMenu === 'function') toggleWechatPlusMenu();
  };

  // ---------- 置顶 / 删除当前角色 ----------
  window.renderChatPinUI = function () {
    const toggle = document.getElementById('toggle-pin-chat');
    if (!toggle) return;
    const c = find(activeId);
    const on = !!c && isPinned(c.id);
    toggle.classList.toggle('active', on);
    const sub = document.getElementById('pin-chat-sub');
    if (sub) {
      sub.innerText = c
        ? (on ? '已置顶，会固定在会话列表最上面' : '置顶后固定在会话列表最上面')
        : '先选一个角色';
    }
  };

  window.isConversationPinned = function (id) { return !!id && isPinned(id); };

  window.toggleConversationPin = function (id) {
    if (!id) return false;
    if (isPinned(id)) pinnedIds = pinnedIds.filter(x => x !== id);
    else pinnedIds.push(id);
    persist();
    renderWechatSessions();
    if (window.renderChatPinUI) window.renderChatPinUI();
    return isPinned(id);
  };

  window.togglePinActiveChat = function () {
    const c = find(activeId);
    if (!c) { toast('先在通讯录里选一个角色'); return; }
    if (isPinned(c.id)) {
      pinnedIds = pinnedIds.filter(id => id !== c.id);
    } else {
      pinnedIds.push(c.id);
    }
    persist();
    renderWechatSessions();
    if (window.renderChatPinUI) window.renderChatPinUI();
    toast(isPinned(c.id) ? '已置顶「' + c.name + '」' : '已取消置顶「' + c.name + '」');
  };

  window.deleteActiveCharacter = function () {
    const c = find(activeId);
    if (!c) { toast('当前没有可删除的角色'); return; }
    editingId = c.id;
    deleteCharacterCard();
  };

  function masksOf(c) {
    if (!c) return [];
    if (!Array.isArray(c.masks)) c.masks = [];
    return c.masks;
  }

  function activeMaskOf(c) {
    if (!c || !c.activeMaskId) return null;
    return masksOf(c).filter(m => m.id === c.activeMaskId)[0] || null;
  }

  window.getCharacterMasks = (id) => masksOf(find(id)).map(m => Object.assign({}, m));
  window.getMaskForChar = (id) => {
    const m = activeMaskOf(find(id));
    return m ? Object.assign({}, m) : null;
  };
  window.getActiveMask = () => {
    const m = activeMaskOf(find(activeId));
    return m ? Object.assign({}, m) : null;
  };
  window.persistCharacters = persist;

  // 保存 / 新建一个小号。传空 maskId 就是新建。返回保存后的 mask 对象。
  window.saveCharacterMask = function (charId, maskId, fields) {
    const c = find(charId || activeId);
    if (!c) return null;
    const list = masksOf(c);
    const src = fields || {};
    const existing = maskId ? list.filter(m => m.id === maskId)[0] : null;
    const next = normMask(Object.assign({}, existing || {}, src, {
      id: existing ? existing.id : maskUid(),
      createdAt: existing ? existing.createdAt : Date.now()
    }), list.length);
    if (!next.name) next.name = '小号 ' + (list.length + 1);
    if (existing) {
      list[list.indexOf(existing)] = next;
    } else {
      list.push(next);
    }
    if (!c.activeMaskId) c.activeMaskId = next.id;
    if (c.id === activeId && typeof window.applyMaskToChatUI === 'function') {
      try { window.applyMaskToChatUI(); } catch (e) {}
    }
    persist();
    if (typeof window.syncMaskEntry === 'function') {
      try { window.syncMaskEntry(); } catch (e) {}
    }
    return Object.assign({}, next);
  };

  window.setActiveCharacterMask = function (charId, maskId) {
    const c = find(charId || activeId);
    if (!c) return false;
    const nextId = maskId || '';
    if (nextId && !masksOf(c).some(m => m.id === nextId)) return false;
    c.activeMaskId = nextId;
    persist();
    if (c.id === activeId) {
      if (typeof window.applyMaskToChatUI === 'function') {
        try { window.applyMaskToChatUI(); } catch (e) {}
      }
      if (typeof window.loadChatHistory === 'function') {
        try { window.loadChatHistory(); } catch (e) {}
      }
      if (typeof window.renderChatSettingsUI === 'function') {
        try { window.renderChatSettingsUI(); } catch (e) {}
      }
    }
    if (typeof window.syncMaskEntry === 'function') {
      try { window.syncMaskEntry(); } catch (e) {}
    }
    return true;
  };

  window.deleteCharacterMask = function (charId, maskId) {
    const c = find(charId || activeId);
    if (!c || !maskId) return false;
    c.masks = masksOf(c).filter(m => m.id !== maskId);
    if (c.activeMaskId === maskId) c.activeMaskId = '';
    persist();
    if (c.id === activeId) {
      if (typeof window.applyMaskToChatUI === 'function') {
        try { window.applyMaskToChatUI(); } catch (e) {}
      }
      if (typeof window.loadChatHistory === 'function') {
        try { window.loadChatHistory(); } catch (e) {}
      }
    }
    if (typeof window.syncMaskEntry === 'function') {
      try { window.syncMaskEntry(); } catch (e) {}
    }
    return true;
  };

  // 导出
  window.getCharacters = () => chars;
  window.getTrashCharacters = () => trash;
  window.getActiveCharacter = () => find(activeId);
  window.getGroups = () => groups;
  window.persistGroups = persist;
  window.findCharacterById = (id) => find(id);
  window.groupMemberCards = (g) => memberCards(g);
  window.groupMeName = meName;
  window.groupMeAvatar = meAvatar;
  window.setActiveCharacter = (id) => setActive(id);
  window.addCharacter = addCharacter;
  window.openContacts = openContacts;
  window.renderContacts = renderContacts;
  window.openCharacterEditor = openCharacterEditor;
  window.saveCharacterCard = saveCharacterCard;
  window.deleteCharacterCard = deleteCharacterCard;
  window.restoreCharacter = restoreCharacter;
  window.addRelationRow = addRelationRow;
  window.openRelationGraph = openRelationGraph;
  window.renderRelationGraph = renderRelationGraph;
  window.wxToast = toast;

  loadAll();
  seedDemoGroup();
  if (chars[0]) applyActiveToGlobals(find(activeId) || chars[0]);
  renderWechatSessions();
  document.addEventListener('click', function (e) {
    const dd = document.getElementById('wechat-plus-dropdown');
    if (dd && dd.style.display === 'block' && !e.target.closest('#wechat-plus-dropdown') && !e.target.closest('.wechat-header-icon-btn')) {
      dd.style.display = 'none';
    }
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { renderContacts(); });
  } else {
    renderContacts();
  }
})();
