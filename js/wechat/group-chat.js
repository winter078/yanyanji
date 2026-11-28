// 群聊：独立历史 + 独立设定 + 中控选角 + 逐角色各发一次请求
// 数据仍挂在 characters.js 的 groups 上，这里只负责读写与渲染。
(function () {
  const ROUND_MSG_CAP = 3;      // 全群每轮最多 3 条
  const DEFAULT_MIN = 1;
  const DEFAULT_MAX = 2;
  const DEFAULT_SUMMARY = 12;
  const GROUP_TIME_GAP_PLAN_KEY = 'momo_group_time_gap_plans_v1';
  const GROUP_PROACTIVE_KEY = 'momo_group_proactive_settings_v1';
  const GROUP_CALL_COOLDOWN_MS = 6 * 60 * 60 * 1000;
  const GROUP_TIME_GAP_MIN_MS = 48 * 60 * 60 * 1000;
  const GROUP_TIME_GAP_CHUNK_SIZE = 20;
  const GROUP_TIME_GAP_MAX_COUNT = 200;
  const GROUP_IMAGE_MIN_TURNS = 15;
  let groupTimeGapGenerating = false;
  let pendingGroupTimeGapGid = '';
  let groupProactiveRunning = false;
  let groupProactiveDraftMembers = [];
  const groupAutoSavePending = {};
  const FB = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80';

  let memberQuery = '';
  let busy = false;

  function app() { return window.appData || {}; }
  function allGroups() { return (window.getGroups && window.getGroups()) || []; }
  function cards() { return (window.getCharacters && window.getCharacters()) || []; }
  function findGroup(id) { return allGroups().filter(g => g.id === id)[0] || null; }
  function findCard(id) { return cards().filter(c => c.id === id)[0] || null; }
  window.findGroup = findGroup;
  function meName(g) {
    const a = app();
    return a.userNickname || localStorage.getItem('momo_user_nick') || (a.hero && a.hero.userName) || '我';
  }
  function meAvatar() {
    const a = app();
    return a.heroAvatar || a.userAvatar || a.momentsAvatar ||
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80';
  }
  function save() { if (window.persistGroups) window.persistGroups(); }

  // 群管理变化写进群历史，用系统灰胶囊展示；同时给角色提示词保留当前身份与头衔。
  function pushGroupGovNotice(g, text) {
    if (!g || !text) return;
    if (!Array.isArray(g.history)) g.history = [];
    g.history.push({
      role: 'system',
      content: String(text),
      at: Date.now(),
      gov: true
    });
    g.updatedAt = Date.now();
  }
  function refreshGroupAfterGov(g) {
    if (!g) return;
    if (window.__groupMode === g.id && typeof renderGroupHistory === 'function') {
      renderGroupHistory(g);
    }
    if (typeof window.renderWechatSessions === 'function') window.renderWechatSessions();
  }

  function toast(msg) { if (typeof window.wxToast === 'function') window.wxToast(msg); }

  // ---------------- 群相簿：每个群独立，不读全局共享 ----------------
  function groupUserCount(g) {
    return (g.history || []).filter(function (m) { return m && m.role === 'user' && !m.recalled; }).length;
  }

  function groupImageRequest(g) {
    if (typeof window.isExplicitImageRequest !== 'function') return false;
    const list = (g.history || []);
    let lastUser = null;
    let prevUser = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (!m || m.role !== 'user' || m.recalled || m.hiddenFromAI) continue;
      if (!lastUser) { lastUser = m; continue; }
      prevUser = m;
      break;
    }
    if (!lastUser) return false;
    const lastText = messageTextForAi(lastUser);
    if (window.isExplicitImageRequest(lastText)) return true;
    // 只要这轮点名了“群相簿 / 群里的图”，就按索图处理，不再受 15 条门槛限制。
    if (groupAlbumIntent(g) === 'group') return true;
    // 上一轮刚发了自己的照片，这一轮只问“你的呢/那你呢”，也算明确索图。
    if (prevUser && /^\[IMAGE:[\s\S]*\]$/.test(String(prevUser.content || '')) &&
        /(?:你的|你呢|那你呢|到你了|换你了|该你了|给我看看你的|发你的)/.test(String(lastText || ''))) {
      return true;
    }
    return false;
  }

  function canGroupSendImage(g) {
    return groupImageRequest(g) || groupUserCount(g) >= GROUP_IMAGE_MIN_TURNS;
  }

  function lastUserMessageForImage(g) {
    const list = (g && g.history) || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m && m.role === 'user' && !m.recalled && !m.hiddenFromAI) return m;
    }
    return null;
  }

  function groupAlbumIntent(g) {
    const m = lastUserMessageForImage(g);
    if (!m) return 'any';
    const text = messageTextForAi(m);
    if (/(?:群相簿|群相册|群里相簿|群聊[的]?相簿|群聊[的]?相册|群里的图|群里发的图|大家发的图|共享相簿)/.test(text)) return 'group';
    if (/(?:你的|你呢|那你呢|到你了|换你了|该你了|你的相簿|你的相册|你的照片|你的自拍)/.test(text)) return 'char';
    return 'any';
  }

  function groupAlbumList(g, charId, intent) {
    const out = [];
    const want = intent || 'any';
    try {
      const charFn = (typeof window.getAlbumPhotosForCharacterOnly === 'function') ? window.getAlbumPhotosForCharacterOnly
        : (typeof getAlbumPhotosForCharacterOnly === 'function' ? getAlbumPhotosForCharacterOnly : null);
      const groupFn = (typeof window.getAlbumPhotosForGroup === 'function') ? window.getAlbumPhotosForGroup
        : (typeof getAlbumPhotosForGroup === 'function' ? getAlbumPhotosForGroup : null);
      if (charId && charFn && want !== 'group') out.push.apply(out, charFn(charId) || []);
      if (groupFn && want !== 'char') out.push.apply(out, groupFn(g.id) || []);
    } catch (e) {}
    return out.filter(function (p, i) {
      return p && p.src && out.findIndex(function (q) { return q && q.id === p.id; }) === i;
    });
  }

  function canGroupGenerateForChar(card) {
    if (!card || !card.id) return false;
    const enabled = (typeof window.isCharacterImageEnabled === 'function')
      ? window.isCharacterImageEnabled(card.id)
      : true;
    const ready = (typeof window.isCharacterImageConfigured === 'function')
      ? window.isCharacterImageConfigured()
      : false;
    return !!(enabled && ready);
  }

  function groupAlbumPromptText(g, card) {
    if (!g || !card) return '';
    const forced = groupImageRequest(g);
    if (!forced && groupUserCount(g) < GROUP_IMAGE_MIN_TURNS) return '';
    const intent = groupAlbumIntent(g);
    const list = groupAlbumList(g, card.id, intent);
    const canGenerate = canGroupGenerateForChar(card);
    if (!list.length) {
      if (forced && canGenerate) {
        return '\n【user 这轮明确要看图，但你的旧相簿没有照片】你可以用 [生图: 画面描述] 发一张刚拍/刚画的新图，不要把旧图说成新图，也不要假装已经发了。';
      }
      const scope = intent === 'group'
        ? '当前群相簿没有照片'
        : intent === 'char'
          ? '你的角色相簿没有照片'
          : '本群相簿和你的角色相簿都没有照片';
      return forced
        ? '\n【user 这轮明确要看图，但' + scope + '】直接坦白说没有，不要编“我相册里有”，也不要假装发图。'
        : '';
    }
    const lines = list.slice(0, 8).map(function (p) {
      const tags = (p.tags || []).join('/') || '无标签';
      const owner = p.ownerType === 'group' ? '群相簿' : '你的角色相簿';
      return p.id + '｜' + owner + '｜' + tags + '｜' + (p.caption || '无描述') + '｜' + (p.scene || '无场景') + '｜' + String(p.createdAt || '').slice(0, 10);
    }).join('\n');
    let head;
    if (forced && intent === 'group') {
      head = '【user 这轮明确要看群相簿】只从下面标注「群相簿」的图里选 1 张发出去；不要拿你自己的角色相簿图冒充群相簿。把 [发相册图: ph_xxx] 放在你想让图出现的那句话后面：';
    } else if (forced && intent === 'char') {
      head = '【user 这轮明确要看你的相簿】只从下面标注「你的角色相簿」的图里选 1 张发出去；不要把群相簿里用户发的图当成你的。把 [发相册图: ph_xxx] 放在你想让图出现的那句话后面：';
    } else if (forced) {
      head = '【user 这轮明确要看图】不要推脱，也不要说“我没图/我翻不到”。从下面选 1 张发出去；把 [发相册图: ph_xxx] 放在你想让图出现的那句话后面，先有那句话再插图，别把图顶在最前面：';
    } else {
      head = '【本轮主动发图窗口】系统允许你在群里主动发一张相簿图。先看最近对话，挑一张能接住话头的；不搭就跳过，不要只嘴上说“我翻了相册”。想发就把 [发相册图: ph_xxx] 放在想插图的那句话后面，不要堆到末尾：';
    }
    if (canGenerate) {
      head = head.replace(/：$/, '；如果 user 要的是刚拍/现在的新画面，改用 [生图: 画面描述] 发新图，不要拿旧图充数：');
    }
    const scopeText = intent === 'group' ? '只含当前群相簿' : intent === 'char' ? '只含你自己的角色相簿' : '含你自己的角色相簿 + 当前群相簿';
    return '\n\n【你在本群的相簿目录（' + scopeText + '）】\n' + head + '\n' + lines +
      '\n选 1 张，把 [发相册图: ph_xxx] 放在你想插图的位置；系统会把图插在那里。不要翻全局共享相簿，也不要假装发图。';
  }

  async function autoSaveGroupImage(src, owner, source, scene) {
    if (!src || typeof src !== 'string') return null;
    if (!owner || !owner.ownerType || !owner.ownerId) return null;
    const saveFn = (typeof window.savePhotoToAlbum === 'function') ? window.savePhotoToAlbum
      : (typeof savePhotoToAlbum === 'function' ? savePhotoToAlbum : null);
    if (!saveFn) return null;
    const rawKey = owner.ownerType + '|' + owner.ownerId + '|' + src.length + '|' + src.slice(0, 40);
    if (groupAutoSavePending[rawKey]) return null;
    groupAutoSavePending[rawKey] = true;
    try {
      const fp = (typeof window.albumImageFingerprint === 'function') ? window.albumImageFingerprint(src)
        : (typeof albumImageFingerprint === 'function' ? albumImageFingerprint(src) : '');
      const groupFn = (typeof window.getAlbumPhotosForGroup === 'function') ? window.getAlbumPhotosForGroup
        : (typeof getAlbumPhotosForGroup === 'function' ? getAlbumPhotosForGroup : null);
      const charFn = (typeof window.getAlbumPhotosForCharacterOnly === 'function') ? window.getAlbumPhotosForCharacterOnly
        : (typeof getAlbumPhotosForCharacterOnly === 'function' ? getAlbumPhotosForCharacterOnly : null);
      const list = owner.ownerType === 'group'
        ? ((groupFn ? groupFn(owner.ownerId) : []) || [])
        : ((charFn ? charFn(owner.ownerId) : []) || []);
      const exists = list.some(function (p) {
        if (fp && p.fingerprint === fp) return true;
        return String(p.src || '') === src;
      });
      if (exists) return null;
      return await saveFn(src, [], true, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        source: source || 'chat-group',
        scene: scene || '',
        fingerprint: fp || undefined
      });
    } catch (e) {
      return null;
    } finally {
      delete groupAutoSavePending[rawKey];
    }
  }

  function groupResolveAlbumPhoto(g, card, target) {
    const intent = groupAlbumIntent(g);
    const list = groupAlbumList(g, card.id, intent);
    if (!list.length) return null;
    const t = String(target || '').trim();
    if (!t) return groupImageRequest(g) ? list[0] : null;
    const isId = /^ph_/.test(t);
    const matched = list.filter(function (p) {
      if (isId) return p.id === t;
      const hay = [(p.tags || []).join(' '), p.caption || '', p.scene || ''].join(' ').toLowerCase();
      return hay.indexOf(t.toLowerCase()) >= 0 || (Array.isArray(p.tags) && p.tags.indexOf(t) >= 0);
    });
    return matched[0] || (groupImageRequest(g) ? list[0] : null);
  }

  function splitGroupAlbumMessage(g, card, content, options) {
    let text = String(content || '');
    const tagRe = /[【\[]发相册图[：:]([\s\S]*?)[】\]]/;
    const tagMatch = text.match(tagRe);
    let photo = null;
    const canSend = canGroupSendImage(g);
    const intent = groupAlbumIntent(g);
    if (tagMatch && canSend) {
      photo = groupResolveAlbumPhoto(g, card, tagMatch[1]);
      if (photo) {
        text = text.slice(0, tagMatch.index) + '\n[[GALBUMIMG:0]]\n' + text.slice(tagMatch.index + tagMatch[0].length);
      }
    }
    text = text.replace(/[【\[]发相册图[：:][\s\S]*?[】\]]/g, '').trim();

    // 强制索图但模型没写指令：用当前请求对应的相簿里第一张兜底。
    // 如果这轮已经写了 [生图: ...]，说明要发新图，不要再拿旧相簿图兜底。
    if (!photo && canSend && groupImageRequest(g) && !(options && options.skipFallback)) {
      const list = groupAlbumList(g, card.id, intent);
      if (list.length) {
        photo = list[0];
        text = (text ? text + '\n' : '') + '[[GALBUMIMG:0]]';
      }
    }

    const segs = [];
    const pushSpeech = function (s) {
      const v = String(s || '').trim();
      if (v) segs.push({ type: 'speech', text: v });
    };
    if (photo) {
      const tokenRe = /\[\[GALBUMIMG:0\]\]/g;
      let last = 0;
      let m;
      while ((m = tokenRe.exec(text)) !== null) {
        pushSpeech(text.slice(last, m.index));
        segs.push({ type: 'albumimage', src: photo.src, photoId: photo.id });
        last = m.index + m[0].length;
      }
      pushSpeech(text.slice(last));
      if (!segs.some(function (s) { return s.type === 'albumimage'; })) {
        segs.push({ type: 'albumimage', src: photo.src, photoId: photo.id });
      }
      // 正文里说了“就这张/看这张”时，把图挪到那句后面，模拟真人夹图。
      const imgIdx = segs.findIndex(function (s) { return s.type === 'albumimage'; });
      const cueRe = /(就这张|看这张|这张照片|这张图|给你看|喏)/;
      let cueIdx = -1;
      for (let i = 0; i < imgIdx; i++) {
        if (segs[i].type === 'speech' && cueRe.test(segs[i].text)) cueIdx = i;
      }
      if (cueIdx >= 0 && cueIdx !== imgIdx - 1) {
        const img = segs.splice(imgIdx, 1)[0];
        segs.splice(cueIdx + 1, 0, img);
      }
    } else {
      pushSpeech(text);
    }
    return segs.length ? segs : [{ type: 'speech', text: text }];
  }

  function memberList(g) {
    return (g.members || []).map(id => id === 'me'
      ? { id: 'me', name: meName(g), avatar: meAvatar(), isMe: true }
      : findCard(id)).filter(Boolean);
  }
  function charMembers(g) { return memberList(g).filter(m => !m.isMe); }
  function groupOwnerId(g) { return (g && g.ownerId) || 'me'; }
  function groupAdminIds(g) { return (g && Array.isArray(g.adminIds)) ? g.adminIds : []; }
  function groupMutedIds(g) { return (g && Array.isArray(g.mutedIds)) ? g.mutedIds : []; }
  function groupTitles(g) {
    return (g && g.titles && typeof g.titles === 'object') ? g.titles : {};
  }
  function groupTitleOf(g, id) {
    const t = groupTitles(g)[id];
    return (typeof t === 'string') ? t.trim() : '';
  }
  function groupMemberName(g, id) {
    const m = memberList(g).filter(x => x.id === id)[0];
    return m ? (m.isMe ? '我' : (m.name || '成员')) : '成员';
  }
  function groupRoleOf(g, id) {
    if (!g || !id) return '';
    if (id === groupOwnerId(g)) return 'owner';
    return groupAdminIds(g).indexOf(id) >= 0 ? 'admin' : '';
  }
  function groupRoleLabel(g, id) {
    const role = groupRoleOf(g, id);
    return role === 'owner' ? '群主' : (role === 'admin' ? '管理员' : '');
  }
  function groupEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function groupIsMuted(g, id) { return groupMutedIds(g).indexOf(id) >= 0; }
  // 能进入 AI 发言/主动消息/群通话池的成员：排除被禁言的角色。
  function speakableCharMembers(g) {
    return charMembers(g).filter(function (m) { return !groupIsMuted(g, m.id); });
  }

  // ---------------- 群主动消息：每个群独立开关 + 自己选谁冒泡 ----------------
  function readGroupProactiveMap() {
    try {
      const raw = localStorage.getItem(GROUP_PROACTIVE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (e) { return {}; }
  }
  function writeGroupProactiveMap(map) {
    try { localStorage.setItem(GROUP_PROACTIVE_KEY, JSON.stringify(map || {})); } catch (e) {}
  }
  function defaultGroupProactive(g) {
    return {
      bgActive: false,
      bgCall: false,
      lastCallAt: 0,
      msgTendency: 'normal',
      callTendency: 'normal',
      bgIntervalVal: 2,
      bgIntervalUnit: 'hours',
      bgDndEnabled: false,
      bgDndStart: '23:00',
      bgDndEnd: '08:00',
      members: speakableCharMembers(g).map(c => c.id)
    };
  }
  function getGroupProactive(gid) {
    const g = findGroup(gid);
    const map = readGroupProactiveMap();
    if (!g) return defaultGroupProactive(g || {});
    if (!map[gid]) {
      map[gid] = defaultGroupProactive(g);
      writeGroupProactiveMap(map);
    }
    return Object.assign(defaultGroupProactive(g), map[gid]);
  }
  function saveGroupProactive(gid, patch) {
    if (!gid) return;
    const g = findGroup(gid);
    const map = readGroupProactiveMap();
    map[gid] = Object.assign(getGroupProactive(gid), patch || {});
    writeGroupProactiveMap(map);
  }
  function groupProactiveMembers(g, ps) {
    const all = speakableCharMembers(g);
    const ids = (ps && Array.isArray(ps.members) && ps.members.length)
      ? ps.members
      : all.map(c => c.id);
    return all.filter(c => ids.indexOf(c.id) >= 0);
  }
  function groupProactiveIntervalText(ps) {
    const n = Math.max(1, parseInt(ps && ps.bgIntervalVal, 10) || 1);
    return n + (ps && ps.bgIntervalUnit === 'minutes' ? ' 分钟' : ' 小时');
  }
  function isGroupDndNow(ps) {
    if (!ps || !ps.bgDndEnabled) return false;
    const start = String(ps.bgDndStart || '23:00').split(':').map(Number);
    const end = String(ps.bgDndEnd || '08:00').split(':').map(Number);
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const s = (start[0] || 0) * 60 + (start[1] || 0);
    const e = (end[0] || 0) * 60 + (end[1] || 0);
    return s <= e ? (cur >= s && cur < e) : (cur >= s || cur < e);
  }
  function isAnyGroupCallOpen() {
    const overlay = document.getElementById('call-overlay');
    return !!(window.__voiceCallMode || (overlay && overlay.classList.contains('is-open')));
  }
  function groupProactiveLastAt(g) {
    if (!g || !Array.isArray(g.history) || !g.history.length) return Number(g && g.createdAt) || 0;
    for (let i = g.history.length - 1; i >= 0; i--) {
      const m = g.history[i];
      if (!m || m.role === 'system') continue;
      const ts = groupMessageTimestamp(g, m);
      if (ts) return ts;
    }
    return Number(g.updatedAt) || Number(g.createdAt) || 0;
  }
  function limitOf(g, id) {
    const l = (g.settings && g.settings.limits) ? g.settings.limits[id] : null;
    return {
      min: Math.max(1, parseInt(l && l.min, 10) || DEFAULT_MIN),
      max: Math.max(1, parseInt(l && l.max, 10) || DEFAULT_MAX)
    };
  }
  function clamp(n, a, b) { n = parseInt(n, 10); if (isNaN(n)) n = a; return Math.max(a, Math.min(b, n)); }

  // ---------------- 进入群聊 / 渲染群消息 ----------------
  window.enterGroupChat = function (id) {
    const g = findGroup(id);
    if (!g) return;
    window.__groupMode = g.id;
    if (typeof window.exitNarrationMode === 'function') {
      try { window.exitNarrationMode(); } catch (e) {}
    }
    if (typeof window.cancelReplyQuote === 'function') window.cancelReplyQuote();
    var groupChatPage = document.getElementById('page-chat');
    if (groupChatPage) groupChatPage.setAttribute('data-chat-group', 'on');
    openPage('page-chat');
    const title = document.querySelector('#page-chat .wechat-title');
    if (title) title.innerText = g.name;
    const sub = document.getElementById('chat-sync-sub-hint');
    if (sub && !window.__chatSubBackup) window.__chatSubBackup = sub.innerHTML;
    if (sub) sub.innerText = '群聊 · ' + memberList(g).length + ' 人 · 中控选角';
    const strip = document.getElementById('chat-group-members');
    if (strip) { strip.style.display = 'none'; strip.innerHTML = ''; }
    const ph = document.getElementById('chat-input');
    if (ph) ph.placeholder = '在群里说点什么…';
    renderGroupHistory(g);
  };

  function clearContainer() {
    const c = document.getElementById('message-container');
    if (c) c.innerHTML = '';
    return c;
  }

  function divider(text) {
    const c = document.getElementById('message-container');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'wechat-time-divider';
    d.innerHTML = '<span class="wechat-time-pill">' + text + '</span>';
    c.appendChild(d);
  }

  function renderGroupHistory(g) {
    const c = clearContainer();
    if (!c) return;
    if (!g.history.length) {
      divider('群聊已建好 · 说句话，中控会挑人接');
    } else {
      let lastTs = 0;
      g.history.forEach((m, idx) => {
        const isSystemLike = m && (m.role === 'system' || m.recalled);
        if (!isSystemLike) {
          const ts = groupMessageTimestamp(g, m);
          const needDivider = (idx === 0) ||
            (ts && lastTs && (ts - lastTs >= 5 * 60 * 1000 || dateKeyOf(ts) !== dateKeyOf(lastTs)));
          if (needDivider) divider(groupTimeLabel(ts, m));
          if (ts) lastTs = ts;
        }
        renderGroupMessage(m, {}, idx, g.id);
      });
    }
    setTimeout(() => { c.scrollTop = c.scrollHeight; }, 40);
    if (typeof window.scheduleChatBubbleRefit === 'function') window.scheduleChatBubbleRefit();
  }
  window.renderGroupHistory = renderGroupHistory;

  function parseGroupQuoteText(raw) {
    const text = String(raw || '');
    const m = text.match(/^「回复\s*([^：:]+)[：:]([\s\S]*?)」\s*\n?([\s\S]*)$/);
    if (!m) return { body: text, quote: null };
    const q = String(m[2] || '').trim();
    const im = q.match(/^\[IMAGE:([\s\S]*?)\]$/);
    return {
      body: String(m[3] || '').trim(),
      quote: im
        ? { sender: String(m[1] || '').trim(), isImage: true, imgSrc: im[1] }
        : { sender: String(m[1] || '').trim(), isImage: false, text: q }
    };
  }

  function renderGroupMessage(m, opts, idx, groupId) {
    opts = opts || {};
    const c = document.getElementById('message-container');
    if (!c) return null;
    if (m.role === 'system') {
      if (m.callRecordId && typeof window.renderCallRecordNotice === 'function') {
        return window.renderCallRecordNotice(m);
      }
      if (typeof window.renderSystemNotice === 'function') return window.renderSystemNotice(m.content || '');
      divider(m.content || '');
      return null;
    }
    if (m.recalled) {
      if (typeof window.renderSystemNotice === 'function' && typeof window.recallNoticeText === 'function') {
        return window.renderSystemNotice(window.recallNoticeText(m));
      }
      divider((m.name || '成员') + '撤回了一条消息');
      return null;
    }
    const isMe = m.role === 'user';
    const group = document.createElement('div');
    group.className = 'msg-group ' + (isMe ? 'user' : 'bot');
    if (m.narration && !opts.typing) group.classList.add('msg-narration-row');
    if (typeof idx === 'number' && idx >= 0) group.setAttribute('data-msg-idx', String(idx));
    if (typeof idx === 'number' && idx >= 0) {
      group.addEventListener('click', function (e) {
        if (!document.body.classList.contains('chat-multi-mode')) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.toggleSelectMessage === 'function') window.toggleSelectMessage(idx);
      }, true);
    }
    const checkEl = document.createElement('div');
    checkEl.className = 'msg-select-check';
    if (isMe) checkEl.style.order = '9';
    group.appendChild(checkEl);
    if (opts.typing) group.classList.add('is-typing');

    // 头像节奏按“发言人”而不是“角色”判断：群里换人说话也要重新挂头像。
    const senderKey = isMe ? 'me' : (m.speakerId || m.name || '');
    if (senderKey) group.setAttribute('data-speaker-id', senderKey);
    if (!opts.typing && senderKey) {
      const prevEl = c.lastElementChild;
      if (prevEl && prevEl.classList && prevEl.classList.contains('msg-group') &&
          prevEl.getAttribute('data-speaker-id') === senderKey) {
        group.classList.add('msg-continuation');
      }
    }

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    const av = isMe ? meAvatar() : (m.avatar || FB);
    avatar.innerHTML = '<img src="' + av + '" alt="" />';
    // 群里每个角色自己一份头像框；我这边保持群聊原来的头像，不套单人外观
    const avatarBox = (!isMe && !opts.typing && typeof window.createChatAvatarBox === 'function')
      ? window.createChatAvatarBox(avatar, 'bot', m.speakerId || '')
      : avatar;
    group.appendChild(avatarBox);

    const col = document.createElement('div');
    col.className = 'msg-content-col';

    if (!isMe && m.name && !m.narration) {
      const nameEl = document.createElement('div');
      nameEl.className = 'group-msg-name';
      nameEl.innerText = m.name;
      const gForRole = findGroup(groupId);
      const roleText = gForRole ? groupRoleLabel(gForRole, m.speakerId) : '';
      if (roleText) {
        const roleEl = document.createElement('span');
        roleEl.className = 'group-msg-role ' + (roleText === '群主' ? 'is-owner' : 'is-admin');
        roleEl.innerText = roleText;
        nameEl.appendChild(roleEl);
      }
      const titleText = gForRole ? groupTitleOf(gForRole, m.speakerId) : '';
      if (titleText) {
        const titleEl = document.createElement('span');
        titleEl.className = 'group-msg-title';
        titleEl.innerText = titleText;
        nameEl.appendChild(titleEl);
      }
      col.appendChild(nameEl);
    }

    const actionText = String(m.action || '').trim();
    if (actionText && !opts.typing) {
      const actionEl = document.createElement('div');
      actionEl.className = 'narration-action-card group-msg-action';
      actionEl.innerText = actionText;
      col.appendChild(actionEl);
    }

    const wrap = document.createElement('div');
    wrap.className = 'msg-bubble-wrap';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble-wechat';
    let messageEl = bubble;
    let parsedGroup = { body: String(m.content || ''), quote: null };
    if (opts.typing) {
      bubble.classList.add('group-typing-bubble');
      bubble.innerHTML = '<span></span><span></span><span></span>';
    } else if (m.narration && !opts.typing) {
      // 群聊旁白：全宽灰色场景卡，无头像、无名字、无气泡。
      bubble.className = 'narration-action-card narration-user-card';
      bubble.style.cssText = '';
      bubble.innerText = String(m.content || '');
      messageEl = bubble;
    } else if (m.voice && !opts.typing) {
      // 群聊语音：显示波形、时长和转写；点开只展开文字，点小喇叭才合成播放。
      const voiceText = String(m.voice.transcript || m.content || '').trim();
      const shownDuration = Number(m.voice.duration) > 0 ? String(Math.round(Number(m.voice.duration))) : '';
      bubble.classList.add('msg-voice-bubble');
      bubble.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:96px;max-width:240px;padding:10px 12px;cursor:pointer;';
      const voiceRow = document.createElement('div');
      voiceRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
      const wave = document.createElement('div');
      wave.style.cssText = 'display:flex;align-items:center;gap:2px;height:16px;flex:0 0 auto;';
      [3, 7, 11, 9, 5, 10, 6].forEach(function (h) {
        const bar = document.createElement('span');
        bar.style.cssText = 'width:2px;height:' + h + 'px;border-radius:1px;background:currentColor;opacity:.75;';
        wave.appendChild(bar);
      });
      const label = document.createElement('span');
      label.style.cssText = 'font-size:12px;opacity:.85;white-space:nowrap;';
      label.innerText = shownDuration ? (shownDuration + '″') : '语音';
      voiceRow.appendChild(wave);
      voiceRow.appendChild(label);
      // 点语音条只展开转写；点旁边的小喇叭才真正合成播放、才会产生费用。
      if (m.role !== 'user' && voiceText && window.CharVoice) {
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'msg-speak-btn';
        playBtn.title = '听 TA 说';
        playBtn.setAttribute('aria-label', '播放这条语音');
        playBtn.style.margin = '0';
        playBtn.style.flex = '0 0 auto';
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5l-5 4H4z" fill="currentColor"></path><path d="M16.2 8.6a5.2 5.2 0 0 1 0 6.8M18.6 6.2a8.4 8.4 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path></svg>';
        playBtn.onclick = function (e) {
          e.stopPropagation();
          try { window.CharVoice.speak(voiceText, { charId: m.speakerId || '', btn: playBtn }); } catch (err) {}
        };
        voiceRow.appendChild(playBtn);
      }
      const transcript = document.createElement('div');
      transcript.style.cssText = 'display:none;font-size:11px;line-height:1.5;opacity:.68;border-top:1px solid currentColor;padding-top:6px;white-space:normal;word-break:break-word;';
      transcript.innerText = voiceText || '（语音内容）';
      bubble.appendChild(voiceRow);
      bubble.appendChild(transcript);
      bubble.title = voiceText ? ('语音：' + voiceText) : '语音';
      bubble.onclick = function (e) {
        if (document.body.classList.contains('chat-multi-mode')) return;
        e.stopPropagation();
        transcript.style.display = transcript.style.display === 'none' ? 'block' : 'none';
      };
      messageEl = bubble;
    } else {
      parsedGroup = parseGroupQuoteText(m.content || '');
      const bodyText = parsedGroup.body;
      const imageMatch = /^\[IMAGE:([\s\S]*?)\]$/.exec(bodyText);
      const sticker = (typeof window.getStickerDisplay === 'function') ? window.getStickerDisplay(bodyText) : null;
      if (imageMatch) {
        const imageBubble = document.createElement('div');
        imageBubble.className = 'msg-image-bubble';
        imageBubble.style.cssText = 'max-width: 190px; background: transparent; padding: 0; box-shadow: none; cursor: zoom-in; display: inline-block;';
        const img = document.createElement('img');
        img.src = imageMatch[1];
        img.alt = '图片';
        img.style.cssText = 'width: 100%; height: auto; max-height: 240px; object-fit: cover; display: block; border-radius: 8px;';
        img.onclick = function () {
          if (typeof window.openFullImageModal === 'function') window.openFullImageModal(imageMatch[1]);
        };
        imageBubble.appendChild(img);
        messageEl = imageBubble;
      } else if (sticker && sticker.url) {
        const stickerBubble = document.createElement('div');
        stickerBubble.className = 'msg-sticker-bubble';
        stickerBubble.style.cssText = 'max-width: 140px; max-height: 140px; background: transparent; padding: 0; box-shadow: none; cursor: pointer; display: inline-block;';
        const img = document.createElement('img');
        img.src = sticker.url;
        img.alt = sticker.name;
        img.title = sticker.name;
        img.setAttribute('referrerpolicy', 'no-referrer');
        img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 8px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));';
        img.onclick = function() {
          if (typeof window.openFullImageModal === 'function') window.openFullImageModal(sticker.url);
        };
        stickerBubble.appendChild(img);
        messageEl = stickerBubble;
      } else {
        bubble.innerText = bodyText;
      }
    }
    wrap.appendChild(messageEl);

    if (!opts.typing && parsedGroup.quote) {
      const quoteBar = document.createElement('div');
      quoteBar.className = 'wechat-quote-bar';
      const quoteGroup = document.createElement('div');
      quoteGroup.className = 'quote-content-group';
      const senderTag = document.createElement('span');
      senderTag.className = 'quote-sender-tag';
      senderTag.textContent = parsedGroup.quote.sender + ':';
      quoteGroup.appendChild(senderTag);
      if (parsedGroup.quote.isImage) {
        const thumb = document.createElement('img');
        thumb.className = 'quote-thumb-img';
        thumb.src = parsedGroup.quote.imgSrc;
        thumb.alt = '引用缩略图';
        thumb.onclick = function (e) {
          e.stopPropagation();
          if (typeof window.openFullImageModal === 'function') window.openFullImageModal(parsedGroup.quote.imgSrc);
        };
        quoteBar.appendChild(quoteGroup);
        quoteBar.appendChild(thumb);
      } else {
        const snip = document.createElement('span');
        snip.className = 'quote-text-snip';
        snip.textContent = parsedGroup.quote.text;
        quoteGroup.appendChild(snip);
        quoteBar.appendChild(quoteGroup);
      }
      wrap.appendChild(quoteBar);
    }

    if (!opts.typing && typeof idx === 'number' && idx >= 0) {
      group.setAttribute('data-group-msg-idx', String(idx));
      if (typeof window.buildReactionRow === 'function') {
        const row = window.buildReactionRow(m);
        if (row) wrap.appendChild(row);
      }
      if (typeof window.bindBubbleLongPress === 'function') {
        window.bindBubbleLongPress(group, idx, groupId);
      }
    }

    if (actionText && !String(m.content || '').trim() && !parsedGroup.quote) {
      wrap.style.display = 'none';
    }

    col.appendChild(wrap);
    group.appendChild(col);
    c.appendChild(group);
    if (!opts.typing && typeof window.scheduleChatBubbleRefit === 'function') window.scheduleChatBubbleRefit();
    if (!opts.typing) setTimeout(() => { c.scrollTop = c.scrollHeight; }, 20);
    return group;
  }

  // ---------------- API ----------------
  function apiEndpoint() {
    const a = app();
    const key = (a.apiKey || '').trim();
    if (!key) throw new Error('还没填 API Key：先到「设置 · API」里填好再聊群');
    let base = (a.apiBase || '').trim().replace(/\/+$/, '');
    if (!base) throw new Error('还没填 API 地址：先到「设置 · API」里填好再聊群');
    if (!/\/chat\/completions$/.test(base)) base += '/chat/completions';
    return { url: base, key: key, model: a.model || 'deepseek-chat' };
  }

  async function callModel(messages, maxTokens, temperature) {
    const ep = apiEndpoint();
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ep.key },
      body: JSON.stringify({
        model: ep.model,
        messages: messages,
        max_tokens: maxTokens || 600,
        temperature: (typeof temperature === 'number') ? temperature : 0.85
      })
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 160); } catch (e) {}
      throw new Error('接口返回 ' + res.status + (detail ? '：' + detail : ''));
    }
    const data = await res.json();
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    let text = msg ? (msg.content || '') : '';
    if (Array.isArray(text)) text = text.map(x => x.text || '').join('');
    if (!String(text).trim()) throw new Error('接口返回空内容');
    return String(text).trim();
  }

  function parseLoose(raw) {
    if (!raw) return null;
    const cleaned = String(raw).replace(/```json/gi, '```').replace(/```/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) {}
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }

  function wbEnabled(g, b) {
    const cfg = g.settings && g.settings.wb;
    if (!cfg || cfg.custom === false) return b.scope !== 'single';
    const rec = cfg.books ? cfg.books[b.id] : null;
    return rec ? rec.enabled !== false : true;
  }

  function worldText(g) {
    if (window.WB && typeof window.WB.buildText === 'function') {
      const ids = (g.members || []).filter(id => id !== 'me');
      return window.WB.buildText({
        mode: 'group',
        charIds: ids,
        text: recentLines(g, 14),
        bookFilter: function (b) { return wbEnabled(g, b); }
      });
    }
    const books = (app().worldBooks || []).filter(b => b.scope !== 'single' && wbEnabled(g, b));
    const lines = books.flatMap(b => (b.entries || []).map(e => '[' + b.title + ' · ' + e.title + '] ' + e.content));
    return lines.join('\n');
  }

  function memoryText(g, speakerId) {
    try {
      if (window.MemoryEngine && typeof window.MemoryEngine.buildText === 'function') {
        const scoped = window.MemoryEngine.buildText('group', g.id, {
          speakerId: speakerId,
          query: lastUserText(g) || '',
          limit: 9
        });
        if (scoped) return scoped;
      }
      if (window.getPalaceMemoryTextFor) {
        const scoped = window.getPalaceMemoryTextFor('group', g.id, 8);
        if (scoped) return scoped;
      }
    } catch (e) {}
    const mem = (g.settings.memory || []).slice(-8);
    return mem.map(m => '- ' + m.text).join('\n');
  }

  function relationText(g, speakerId) {
    const rels = (g.settings.relations || []).filter(r => r.a === speakerId || r.b === speakerId);
    return rels.map(r => {
      const other = r.a === speakerId ? r.b : r.a;
      const otherName = other === 'me' ? meName(g) : ((findCard(other) || {}).name || '成员');
      return '- 你与' + otherName + '：' + r.label;
    }).join('\n');
  }

  function messageTextForAi(m) {
    const raw = String((m && m.content) || '');
    if (/^\[IMAGE:[\s\S]*\]$/.test(raw)) return '[图片]';
    const base = (typeof window.stickerContentToAiText === 'function')
      ? window.stickerContentToAiText(raw)
      : raw;
    const action = String((m && m.action) || '').trim();
    return base + (action ? '\n*' + action + '*' : '');
  }

  function recentLines(g, n) {
    return g.history.filter(m => m && m.role !== 'system' && !m.recalled && !m.hiddenFromAI).slice(-(n || 16)).map(m =>
      (m.role === 'user' ? meName(g) : (m.name || '成员')) + '：' + messageTextForAi(m).replace(/\n/g, ' ')
    ).join('\n');
  }

  // ---------------- 中控选角 ----------------
  async function pickSpeakers(g, userText) {
    const chars = speakableCharMembers(g);
    if (!chars.length) throw new Error('群里还没有能发言的角色卡，先去群设定里加人');
    const cap = clamp((parseInt(g.settings.roundCap, 10) || ROUND_MSG_CAP), 1, 6);
    const info = chars.map(c => c.id + '=' + c.name + '｜' + (c.tag || '角色') + (c.intro ? '｜' + c.intro : '')).join('\n');
    const rels = (g.settings.relations || []).map(r => {
      const an = r.a === 'me' ? meName(g) : ((findCard(r.a) || {}).name || '成员');
      const bn = r.b === 'me' ? meName(g) : ((findCard(r.b) || {}).name || '成员');
      return an + ' — ' + r.label + ' — ' + bn;
    }).join('\n');
    const prompt = [
      '群名：' + g.name,
      '群成员（id=名字｜身份）：',
      info,
      '用户：' + meName(g),
      '群故事背景：' + (g.settings.story || '（未填写）'),
      '人物关系：' + (rels || '（未填写）'),
      '最近群聊记录：',
      recentLines(g, 14) || '（还没聊过）',
      'user刚发：' + (userText || '（没说话，只是想让群里继续）'),
      '',
      '任务：只决定这一轮谁发言、各自发几条，不写任何台词。',
      '规则：',
      '1. 只能从上面的角色里选，绝不能选“我”。',
      '2. 选 1-2 个角色（最多 3 个），合计条数不超过 ' + cap + ' 条。',
      '3. 每人的条数必须在该角色的上下限内（见下）。',
      '4. user点名或 @ 了谁，就让谁接话。',
      '5. 上一句刚说完的角色没有特别理由别连续抢话。',
      '角色条数上下限：',
      chars.map(c => { const l = limitOf(g, c.id); return c.name + ' ' + l.min + '-' + l.max + ' 条'; }).join('；'),
      '',
      '只输出 JSON，不要解释：{"speakers":[{"id":"角色id","count":1}]}'
    ].join('\n');

    let raw = '';
    try {
      raw = await callModel([
        { role: 'system', content: '你是微信群聊的中控调度器。只输出严格 JSON，不写台词、不解释。' },
        { role: 'user', content: prompt }
      ], 240, 0.35);
    } catch (e) {
      return fallbackPick(g, userText, e.message);
    }

    const obj = parseLoose(raw);
    let picks = (obj && Array.isArray(obj.speakers)) ? obj.speakers : [];
    picks = picks.map(p => {
      let id = String((p && (p.id || p.character || p.name)) || '').trim();
      if (!findCard(id)) {
        const byName = chars.filter(c => c.name === id)[0];
        if (byName) id = byName.id;
      }
      return { id: id, count: clamp(p && p.count, 1, cap) };
    }).filter(p => p.id && !!findCard(p.id));

    if (!picks.length) return fallbackPick(g, userText, '中控没给出合法 JSON');

    // 去重 + 按每人上下限收紧 + 全群上限 3
    const merged = {};
    picks.forEach(p => { merged[p.id] = (merged[p.id] || 0) + p.count; });
    let list = Object.keys(merged).slice(0, 3).map(id => {
      const l = limitOf(g, id);
      return { id: id, count: clamp(merged[id], l.min, l.max) };
    });
    let total = list.reduce((s, x) => s + x.count, 0);
    while (total > cap && list.length) {
      const last = list[list.length - 1];
      const l = limitOf(g, last.id);
      if (last.count > l.min) { last.count--; total--; }
      else if (list.length > 1) { list.pop(); total = list.reduce((s, x) => s + x.count, 0); }
      else break;
    }
    return { picks: list, note: '' };
  }

  function fallbackPick(g, userText, note) {
    const chars = speakableCharMembers(g);
    const named = chars.filter(c => userText && (userText.indexOf('@' + c.name) >= 0 || userText.indexOf(c.name) >= 0));
    let target = named[0];
    if (!target) {
      const last = g.history.slice(-1)[0];
      const pool = chars.filter(c => !last || c.id !== last.speakerId);
      target = (pool.length ? pool : chars)[Math.floor(Math.random() * (pool.length ? pool.length : chars.length))];
    }
    if (!target) return { picks: [], note: '群里没有角色' };
    return { picks: [{ id: target.id, count: limitOf(g, target.id).min }], note: note || '' };
  }

  function groupActionDescPromptText() {
    const s = app().chatSettings || {};
    if (!s.enableActionDesc) return '';
    const person = s.actionDescPerson || 'third';
    const length = s.actionDescLength || 'medium';
    const customWriting = String(s.actionDescWriting || '').trim();
    const lines = [
      '【角色旁白（已开启）】',
      '- 台词之外可以写具体、克制的动作、神态或环境，用 *...* 包住，单独成行；旁白会渲染成灰色卡片。',
      '- 旁白只写你自己此刻在做什么、周围的光线/声音/温度；不要写成台词，不要替别人决定动作和内心。'
    ];
    if (person === 'second') lines.push('- 人称：旁白用第二人称称呼用户为“你”。');
    else if (person === 'first') lines.push('- 人称：旁白用第一人称“我”，是你自己的视角。');
    else lines.push('- 人称：旁白用第三人称，角色和用户都用名字或他/她；不要在旁白里自称“我”。');
    if (customWriting) lines.push('- 写作要求：' + customWriting);
    else if (length === 'short') lines.push('- 写作要求：每条 20–40 字，只写一个具体小动作或一处环境变化。');
    else if (length === 'long') lines.push('- 写作要求：每条 80–140 字，可以写完整动作过程和环境层次。');
    else lines.push('- 写作要求：每条 40–80 字，写一个具体小动作，再带一点光线、声音或温度。');
    if (s.actionDescContinuePlot) lines.push('- 承接剧情：可以自然带出身边 NPC 或突发事件，但不要替用户决定言行。');
    if (s.actionDescOffline) lines.push('- 线下模式：大家就在同一个地方面对面，台词是说出口的话，不要提手机或微信。');
    return lines.join('\n');
  }

  // ---------------- 单角色请求 ----------------
  function buildCharPrompt(g, card, count) {
    const myRemark = (typeof window.userRemarkForChar === 'function')
      ? window.userRemarkForChar(card.id)
      : meName(g);
    const members = memberList(g).map(function (m) {
      let label = m.isMe ? (myRemark + '（用户本人）') : (m.name || '成员');
      if (m.tag) label += '（' + m.tag + '）';
      const role = groupRoleLabel(g, m.id);
      const title = groupTitleOf(g, m.id);
      if (role) label += '〔' + role + '〕';
      if (title) label += '〔群头衔：' + title + '〕';
      return label;
    }).join('、');
    const govText = (Array.isArray(g.history) ? g.history : [])
      .filter(m => m && m.role === 'system' && m.gov)
      .slice(-4)
      .map(m => '- ' + String(m.content || ''))
      .join('\n');
    const memText = memoryText(g, card.id);
    const avatarList = (typeof window.loadCharVaultList === 'function') ? window.loadCharVaultList(card.id) : [];
    const avatarLines = avatarList.slice(0, 6).map(it =>
      '- 情绪「' + (it.emotion || it.tag || '日常') + '」→ ' + (it.name || '未命名')
    );
    const avatarText = avatarList.length
      ? ('【你的头像库】\n你当前头像：' + (card.avatar ? '已设置' : '未设置') + '\n可换：\n' + avatarLines.join('\n') +
         '\n想换头像时，在最末一条消息里写 [换头像: 情绪]；系统会先弹「我要换头像」让' + myRemark + '选同意或不同意，同意后才换上。')
      : '【你的头像库】\n空库，暂时不能换头像。';
    const stickerText = (typeof window.getStickerSummaryForAi === 'function') ? window.getStickerSummaryForAi() : '';
    const stickerBlock = (stickerText && stickerText !== '暂无自定义表情包。')
      ? ('【表情包库（所有角色共用的用户表情库）】\n' + stickerText +
         '\n你只认每个表情的名字、分类和说明，不需要也不要去描述图片本身。想发时，把其中一条消息整条写成 [表情包: 名称]，只能选上面清单里存在的名字；系统会自动渲染成图片。上下文里的【表情包记录：名称】只是系统阅读标注，绝对不要照抄成台词，也不要写成「表情包：名称」或把标签塞进句子里。')
      : '';
    const frameBlock = (typeof window.getChatFramePromptText === 'function')
      ? ('【你的头像框】\n' + window.getChatFramePromptText())
      : '';
    const albumBlock = groupAlbumPromptText(g, card);
    const canGenerateImage = canGroupGenerateForChar(card);
    const charImageBlock = !canGenerateImage ? '' : (
      '【角色生图能力（群聊）】\n' +
      '你可以把“自己刚拍的 / 刚画的 / 眼前正在发生”的画面发到群里，不是旧相簿图。\n' +
      '- 发新图：先写一句自然的话，再单独一行写 [生图: 画面描述]。\n' +
      '- 系统会补上你的锁脸特征和画风，生成后存进你自己的角色相簿，并把图接在这句话后面。\n' +
      '- 画面描述只写镜头里看得见的东西：场景、动作、表情、光线、构图；不要写文字、水印、logo、二维码。\n' +
      '- 旧图用 [发相册图: ph_xxx]；刚拍/刚画/突然想分享才用 [生图]。不要每轮都发，一轮最多一次；两个二选一，一轮最多发一张图。'
    );
    const actionOn = !!(app().chatSettings && app().chatSettings.enableActionDesc);
    const actionBlock = groupActionDescPromptText();
    const parts = [
      '你现在在微信群「' + g.name + '」里说话。',
      '你的身份：' + card.name + (card.tag ? '（' + card.tag + '）' : '') + '。',
      card.prompt || card.intro || '按你的角色性格自然发言。',
      card.directives ? '【行为准则】\n' + card.directives : '',
      '群成员：' + members + '。',
      '你对她的专属备注：' + myRemark + '（可以这样叫她，但不必每句都叫）。',
      g.settings.story ? '【群故事背景】\n' + g.settings.story : '',
      govText ? '【最近的群管理变化】\n' + govText : '',
      relationText(g, card.id) ? '【你和他们的关系】\n' + relationText(g, card.id) : '',
      memText ? '【群记忆 · 群视角编年史 + 只属于你的片段】\n' + memText : '',
      worldText(g) ? worldText(g) : '',
      stickerBlock,
      avatarText,
      frameBlock,
      albumBlock,
      charImageBlock,
      actionBlock,
      '【群聊规矩】',
      '- 你就是' + card.name + '，只写自己会说的话，不要写“' + card.name + '：”前缀，不要替别人说话。' +
        (actionOn ? '旁白只能用 *...* 包住，单独成行。' : '不要旁白。'),
      '- 这一次发 ' + count + ' 条消息。每条独立成段、像微信短消息，不要合并成一大段。',
      '- 口语、有活人感；可以接梗、可以只回一句，不要客服腔。',
      '- 想给' + myRemark + '的消息贴反应：在最末一条消息里写 [REACTION:一个 emoji]，只能从 ❤️ 😆 😨 😢 🤔 👍 🔥 里选，不要每条都贴。',
      '- 想撤回你上一条群消息：在最末一条消息里写 [RECALL]。',
      '- 想改你给' + myRemark + '的备注：在最末一条消息里写 [REMARK:新备注]（2-8 个字，不要改你自己的名字）。',
      '- 想换头像：在最末一条消息里写 [换头像: 情绪]，只能写上面头像库里存在的情绪。',
      stickerBlock ? '- 想发表情包：把其中一条消息整条写成 [表情包: 名称]，只能写上面表情库里存在的名字；不要自己编名字，也不要描述图片；上下文里的【表情包记录：名称】是系统标注，禁止照抄。' : '',
      albumBlock ? '- 想发相簿图：把 [发相册图: ph_xxx] 放在你想让图片出现的那条消息后面；不要放到整段末尾，也不要写目录外的 id。' : '',
      '- 动作指令每轮最多一个（换头像 / 贴反应 / 撤回 / 备注任选其一），写在正文后面单独一行，不要解释指令本身。',
      '- 输出 JSON，不要解释：{"messages":["第一条","第二条"]}'
    ];
    const sys = parts.filter(Boolean).join('\n\n');
    if (window.PromptPresets && typeof window.PromptPresets.apply === 'function') {
      try {
        return window.PromptPresets.apply(sys, {
          scope: 'chat',
          targetKind: 'group',
          targetId: g.id,
          charName: card.name,
          userName: meName(g),
          userRemark: myRemark
        });
      } catch (e) {}
    }
    return sys;
  }

  async function askCharacter(g, card, count) {
    const sys = buildCharPrompt(g, card, count);
    const meLabel = (typeof window.userRemarkForChar === 'function')
      ? window.userRemarkForChar(card.id)
      : meName(g);
    const hist = g.history.filter(m => m && m.role !== 'system' && !m.recalled && !m.hiddenFromAI).slice(-18).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: (m.role === 'user' ? meLabel : (m.name || '成员')) + '：' + messageTextForAi(m)
    }));
    const raw = await callModel([{ role: 'system', content: sys }].concat(hist), 520, 0.9);
    const obj = parseLoose(raw);
    let msgs = (obj && Array.isArray(obj.messages)) ? obj.messages : null;
    if (!msgs) {
      msgs = raw.split(/\n+/).map(s => s.replace(/^["'“]|["'”]$/g, '').trim()).filter(Boolean);
    }
    msgs = msgs.map(s => String(s).replace(/^["'“]|["'”]$/g, '').trim())
      .filter(s => s && !/^\{|^\}/.test(s));
    return msgs.slice(0, count);
  }

  // ---------------- 一轮群聊 ----------------
  function lastUserText(g) {
    for (let i = g.history.length - 1; i >= 0; i--) {
      const m = g.history[i];
      if (!m || m.role === 'system') continue;
      return m.role === 'user' ? messageTextForAi(m) : '';
    }
    return '';
  }

  function attachGroupReaction(g, emoji, speakerId) {
    const valid = ['❤️', '😆', '😨', '😢', '🤔', '👍', '🔥'];
    if (valid.indexOf(emoji) < 0) return -1;
    for (let i = g.history.length - 1; i >= 0; i--) {
      const m = g.history[i];
      if (!m || m.role !== 'user' || m.recalled || m.hiddenFromAI) continue;
      const raw = Array.isArray(m.reactions) ? m.reactions : [];
      const others = raw.filter(r => !(r && r.by === 'char' && r.charId === speakerId));
      m.reactions = others.concat([{ emoji: emoji, by: 'char', charId: speakerId, at: Date.now() }]);
      save();
      return i;
    }
    return -1;
  }

  function recallLastGroupMessage(g, speakerId) {
    for (let i = g.history.length - 1; i >= 0; i--) {
      const m = g.history[i];
      if (!m || m.role !== 'assistant' || m.recalled || m.hiddenFromAI) continue;
      if (speakerId && m.speakerId !== speakerId) continue;
      m.recalled = true;
      m.recalledAt = nowStr();
      m.hiddenFromAI = true;
      save();
      return true;
    }
    return false;
  }

  function pushGroupNotice(g, text) {
    if (!text) return;
    g.history.push({
      role: 'system',
      content: String(text),
      time: nowStr(),
      timestamp: Date.now(),
      hiddenFromAI: true,
      notice: true
    });
    g.updatedAt = Date.now();
    save();
  }

  function splitGroupActionText(raw) {
    let text = String(raw || '');
    const allow = !!(app().chatSettings && app().chatSettings.enableActionDesc);
    if (!allow) {
      text = text.replace(/\*[^*]+\*/g, '').replace(/（[^）]{3,}）/g, '').replace(/\([^)\n]{3,}\)/g, '').trim();
      return { text: text, action: '' };
    }
    const actions = [];
    text = text.replace(/\*([^*]+)\*/g, function (_, inner) {
      const a = String(inner || '').trim();
      if (a) actions.push(a);
      return '';
    }).replace(/\n{3,}/g, '\n\n').trim();
    return { text: text, action: actions.join('\n') };
  }

  function pushGroupReplySegment(g, card, seg) {
    if (!seg) return null;
    const isAlbumImage = seg.type === 'albumimage';
    let content = isAlbumImage ? ('[IMAGE:' + seg.src + ']') : String(seg.text || '').trim();
    let action = '';
    if (!isAlbumImage && content) {
      const split = splitGroupActionText(content);
      content = split.text;
      action = split.action;
    }
    if (!content && !action) return null;
    const m = {
      role: 'assistant',
      speakerId: card.id,
      name: card.name,
      avatar: card.avatar || '',
      content: content,
      time: nowStr(),
      timestamp: Date.now()
    };
    if (action) m.action = action;
    if (isAlbumImage) {
      m.albumPhotoId = seg.photoId || '';
      m.fromAlbum = true;
    }
    g.history.push(m);
    g.updatedAt = Date.now();
    renderGroupMessage(m, {}, g.history.length - 1, g.id);
    save();
    if (!isAlbumImage && /^\[IMAGE:[\s\S]*\]$/.test(content)) {
      autoSaveGroupImage(content.slice(7, -1), { ownerType: 'char', ownerId: card.id }, 'chat-group-bot', '群聊 · ' + (g.name || ''));
    }
    return m;
  }

  function appendGroupGeneratedImage(g, card, src, photoId) {
    if (!g || !card || !src) return null;
    const m = {
      role: 'assistant',
      speakerId: card.id,
      name: card.name,
      avatar: card.avatar || '',
      content: '[IMAGE:' + src + ']',
      time: nowStr(),
      timestamp: Date.now(),
      fromAlbum: true,
      fromGenerated: true,
      albumPhotoId: photoId || ''
    };
    g.history.push(m);
    g.updatedAt = Date.now();
    renderGroupMessage(m, {}, g.history.length - 1, g.id);
    save();
    return m;
  }

  async function runTurn(g) {
    if (busy) { toast('等他们回完再发…'); return; }
    if (groupTimeGapGenerating) { toast('正在补写这几天…'); return; }
    const userText = lastUserText(g);
    busy = true;
    setBusyUi(true);
    try {
      const picked = await pickSpeakers(g, userText);
      const picks = picked.picks || [];
      if (!picks.length) { toast('这一轮没人接话，换个说法试试'); return; }

      for (let i = 0; i < picks.length; i++) {
        const p = picks[i];
        const card = findCard(p.id);
        if (!card) continue;
        const typing = renderGroupMessage({ role: 'assistant', name: card.name, avatar: card.avatar, content: '' }, { typing: true });
        const typingStartedAt = Date.now();
        let msgs = [];
        try {
          msgs = await askCharacter(g, card, p.count);
        } catch (e) {
          if (typing) typing.remove();
          divider('「' + card.name + '」没接上：' + e.message);
          continue;
        }
        if (typing) {
          const typingHold = 520 - (Date.now() - typingStartedAt);
          if (typingHold > 0) await sleep(typingHold);
          typing.remove();
        }
        if (!msgs.length) continue;
        let needsRerender = false;
        const pendingGeneratedImages = [];
        for (let k = 0; k < msgs.length; k++) {
          const cmd = (typeof window.extractChatTrailingCommands === 'function')
            ? window.extractChatTrailingCommands(msgs[k])
            : { text: msgs[k], reaction: '', remark: '', recall: false };
          let content = String(cmd.text || '').trim();
          let generatedPrompt = '';
          const genMatch = content.match(/[【\[]生图[：:]([\s\S]*?)[】\]]/);
          if (genMatch) {
            generatedPrompt = String(genMatch[1] || '').trim();
            content = content.replace(/[【\[]生图[：:][\s\S]*?[】\]]/g, '').trim();
          }
          if (generatedPrompt && !pendingGeneratedImages.length) {
            const imageCard = card;
            const imagePromise = (async function () {
              try {
                if (typeof window.generateCharacterImage !== 'function') {
                  throw new Error('生图模块还没加载');
                }
                return await window.generateCharacterImage(generatedPrompt, {
                  charId: imageCard.id,
                  saveToAlbum: true,
                  sendToChat: false
                });
              } catch (e) {
                return { error: (e && e.message) || '未知错误' };
              }
            })();
            pendingGeneratedImages.push({ card: imageCard, promise: imagePromise });
          }
          let notice = '';
          if (cmd.remark && typeof window.applyChatUserRemark === 'function') {
            const nextNick = window.applyChatUserRemark(cmd.remark, card.id, g);
            if (nextNick) {
              notice = card.name + '把你的备注改成了「' + nextNick + '」';
            }
          }
          if (cmd.recall) {
            recallLastGroupMessage(g, card.id);
            needsRerender = true;
          }
          // 角色想在群里换头像：先弹窗，user同意后再把这条消息连同新头像一起发出来
          if (cmd.avatar && typeof window.findAvatarForEmotion === 'function') {
            const targetAvatar = window.findAvatarForEmotion(card.id, cmd.avatar);
            if (targetAvatar && typeof window.askAvatarChange === 'function') {
              const allowed = await window.askAvatarChange(card.id, targetAvatar);
              if (allowed && typeof window.applyCharacterAvatar === 'function') {
                window.applyCharacterAvatar(card.id, targetAvatar.url);
                card.avatar = targetAvatar.url;
                needsRerender = true;
              }
            }
          }
          // 群里也可以请求换头像框；同意后只改这个角色自己的那一份
          if (cmd.frame && typeof window.findChatFrameByName === 'function') {
            const frameParts = (typeof window.parseFrameCommand === 'function')
              ? window.parseFrameCommand(cmd.frame)
              : { name: cmd.frame, text1: '', text2: '' };
            const targetFrame = window.findChatFrameByName(frameParts.name);
            if (targetFrame && typeof window.askChatFrameChange === 'function') {
              const allowedFrame = await window.askChatFrameChange(card.id, targetFrame, frameParts.text1, frameParts.text2);
              if (allowedFrame && typeof window.applyChatFrameToBot === 'function') {
                window.applyChatFrameToBot(card.id, targetFrame.id, frameParts.text1, frameParts.text2, true);
                needsRerender = true;
              }
            }
          }
          const segs = splitGroupAlbumMessage(g, card, content, { skipFallback: !!generatedPrompt });
          for (let si = 0; si < segs.length; si++) {
            pushGroupReplySegment(g, card, segs[si]);
            if (si < segs.length - 1) await sleep(260);
          }
          if (cmd.reaction) {
            const reactionIdx = attachGroupReaction(g, cmd.reaction, card.id);
            if (reactionIdx >= 0 && typeof window.refreshReactionRow === 'function') {
              window.refreshReactionRow(reactionIdx, g.id);
            }
          }
          if (notice) {
            pushGroupNotice(g, notice);
            needsRerender = true;
          }
          if (k < msgs.length - 1) await sleep(420);
        }
        if (needsRerender) {
          renderGroupHistory(g);
          save();
        }
        for (let pi = 0; pi < pendingGeneratedImages.length; pi++) {
          const pending = pendingGeneratedImages[pi];
          const generated = await pending.promise;
          if (generated && generated.src) {
            appendGroupGeneratedImage(g, pending.card, generated.src, generated.photo && generated.photo.id);
          } else if (generated && generated.error) {
            pushGroupNotice(g, '「' + pending.card.name + '」的照片没生成出来：' + generated.error);
          }
        }
        if (typeof window.showReplyArrivalToast === 'function') {
          for (let j = g.history.length - 1; j >= 0; j--) {
            const last = g.history[j];
            if (last && last.role === 'assistant' && last.content && !last.recalled && !/^\[IMAGE:/.test(last.content)) {
              window.showReplyArrivalToast(last.content, { groupId: g.id, senderName: card.name, avatarUrl: card.avatar || '' });
              break;
            }
          }
        }
        if (i < picks.length - 1) await sleep(520);
      }

      g.roundCount = (parseInt(g.roundCount, 10) || 0) + 1;
      save();
      const every = parseInt(g.settings.summaryEvery, 10) || DEFAULT_SUMMARY;
      let autoOn = true;
      let autoEvery = 24;
      try {
        const pc = JSON.parse(localStorage.getItem('momo_palace_config') || '{}');
        autoOn = pc.autoSummary !== false;
        const rec = (pc.wechatTargets || {})['wechat:group:' + g.id] || {};
        autoEvery = Math.max(6, Math.min(60, parseInt(rec.autoEvery, 10) || parseInt(pc.autoEvery, 10) || 24));
      } catch (e) {}
      const cursor = parseInt(g.settings.summaryCursor, 10) || 0;
      const pendingMsgs = g.history.length - cursor;
      const hitRound = every > 0 && g.roundCount % every === 0;
      const hitMessages = autoEvery > 0 && pendingMsgs >= autoEvery;
      if (autoOn && (hitRound || hitMessages)) {
        summarizeGroup(g, false).catch(() => {});
      }
    } catch (e) {
      divider('群聊出错了：' + e.message);
    } finally {
      busy = false;
      setBusyUi(false);
      if (window.__groupMode === g.id && document.getElementById('page-group-setting') &&
          document.getElementById('page-group-setting').classList.contains('active')) {
        renderMemory(g);
      }
    }
  }

  function setBusyUi(on) {
    ['send-btn', 'gen-btn'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.disabled = !!on;
    });
    const sub = document.getElementById('chat-sync-sub-hint');
    if (sub) {
      const g = findGroup(window.__groupMode);
      if (g) sub.innerText = on ? '群聊 · 正在挑人接话…' : ('群聊 · ' + memberList(g).length + ' 人 · 中控选角');
    }
  }

  function nowStr() {
    const d = new Date();
    const p = n => (n < 10 ? '0' + n : '' + n);
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  window.groupHandleSend = function (kind) {
    const g = findGroup(window.__groupMode);
    if (!g) return;
    if (busy || groupTimeGapGenerating) { toast(groupTimeGapGenerating ? '正在补写这几天…' : '等他们回完再发…'); return; }
    const input = document.getElementById('chat-input');
    let text = input ? (input.value || '').trim() : '';
    const quote = window.currentQuoteData || null;
    if (text && quote) {
      if (quote.isImage && quote.imgSrc) {
        text = '「回复 ' + quote.sender + '：[IMAGE:' + quote.imgSrc + ']」\n' + text;
      } else {
        const cleanSnippet = String(quote.text || '')
          .replace(/^「回复[\s\S]*?」\s*\n?/, '')
          .replace(/^回复\s*[^：:]+[：:][^\n]+\n?/, '')
          .trim();
        text = '「回复 ' + quote.sender + '：“' + cleanSnippet.slice(0, 35) + (cleanSnippet.length > 35 ? '...' : '') + '”」\n' + text;
      }
    }
    if (text) {
      const narration = !!window.__chatNarrationMode;
      const m = { role: 'user', speakerId: 'me', name: meName(g), content: text, time: nowStr(), timestamp: Date.now() };
      if (narration) m.narration = true;
      g.history.push(m);
      g.updatedAt = Date.now();
      if (input) { input.value = ''; input.style.height = 'auto'; }
      renderGroupMessage(m, {}, g.history.length - 1, g.id);
      save();
      if (quote) {
        if (typeof window.cancelReplyQuote === 'function') window.cancelReplyQuote();
        else window.currentQuoteData = null;
      }
      // 旁白只落场景卡，不触发角色接话；和单聊保持一致。
      if (narration) {
        if (typeof window.scrollChatToBottom === 'function') window.scrollChatToBottom();
        return;
      }
    } else if (kind !== 'generate') {
      return;
    }
    if (!lastUserText(g)) return;
    // 群聊发送只落消息；要角色接话必须点“生成”，和单聊保持一致。
    if (kind !== 'send') runTurn(g);
  };

  // 群聊“重新生成”：只重跑最后一轮群回复，不要跳去单聊。
  window.regenerateGroupReply = function (gid) {
    const g = findGroup(gid || window.__groupMode);
    if (!g) return;
    if (busy || groupTimeGapGenerating) { toast(groupTimeGapGenerating ? '正在补写这几天…' : '等他们回完再发…'); return; }
    let removed = 0;
    while (g.history.length && g.history[g.history.length - 1] && g.history[g.history.length - 1].role === 'assistant') {
      g.history.pop();
      removed++;
    }
    if (!removed) { toast('还没有可重新生成的群回复'); return; }
    const cursor = parseInt(g.settings && g.settings.summaryCursor, 10) || 0;
    if (cursor > g.history.length) g.settings.summaryCursor = g.history.length;
    g.updatedAt = Date.now();
    save();
    renderGroupHistory(g);
    return runTurn(g);
  };

  // 群聊“继续回应”：在群里再触发一轮，不跳到单聊。
  window.continueGroupReply = function (gid) {
    const g = findGroup(gid || window.__groupMode);
    if (!g) return;
    if (busy || groupTimeGapGenerating) { toast(groupTimeGapGenerating ? '正在补写这几天…' : '等他们回完再发…'); return; }
    if (!lastUserText(g)) { toast('群里还没有可接的话'); return; }
    return runTurn(g);
  };

  window.groupHandleVoiceMessage = function (voice) {
    const g = findGroup(window.__groupMode);
    if (!g || !voice) return false;
    if (busy || groupTimeGapGenerating) {
      toast(groupTimeGapGenerating ? '正在补写这几天…' : '等他们回完再发…');
      return false;
    }
    const text = String(voice.transcript || '').trim();
    if (!text) return false;
    if (typeof window.cancelReplyQuote === 'function') window.cancelReplyQuote();
    else window.currentQuoteData = null;
    const m = {
      role: 'user',
      speakerId: 'me',
      name: meName(g),
      content: text,
      time: nowStr(),
      timestamp: Date.now(),
      voice: {
        duration: Math.max(1, Math.round(Number(voice.duration) || 1)),
        transcript: text,
        confirmed: true
      }
    };
    g.history.push(m);
    g.updatedAt = Date.now();
    const input = document.getElementById('chat-input');
    if (input) { input.value = ''; input.style.height = 'auto'; }
    renderGroupMessage(m, {}, g.history.length - 1, g.id);
    save();
    return true;
  };

  window.groupSendStickerMessage = function (sticker) {
    const g = findGroup(window.__groupMode);
    if (!g || !sticker) return false;
    if (busy || groupTimeGapGenerating) { toast(groupTimeGapGenerating ? '正在补写这几天…' : '等他们回完再发…'); return false; }
    const m = {
      role: 'user',
      speakerId: 'me',
      name: meName(g),
      content: '[STICKER:' + sticker.id + '|' + sticker.name + ']',
      time: nowStr(),
      timestamp: Date.now()
    };
    g.history.push(m);
    g.updatedAt = Date.now();
    renderGroupMessage(m, {}, g.history.length - 1, g.id);
    save();
    return true;
  };

  // 群聊里用户发图：消息进群历史，图片进“当前群相簿”，不碰全局共享。
  window.groupHandleSendPicture = async function (event) {
    const g = findGroup(window.__groupMode);
    const input = event && event.target;
    const file = input && input.files && input.files[0];
    if (input) input.value = '';
    if (!g || !file) return;
    if (busy || groupTimeGapGenerating) { toast(groupTimeGapGenerating ? '正在补写这几天…' : '等他们回完再发…'); return; }
    let src = '';
    try {
      if (typeof window.compressImageBase64 === 'function') src = await window.compressImageBase64(file, 800, 0.78);
      else if (typeof compressImageBase64 === 'function') src = await compressImageBase64(file, 800, 0.78);
    } catch (e) {}
    if (!src) {
      src = await new Promise(function (resolve) {
        const reader = new FileReader();
        reader.onload = function (e) { resolve(e.target.result); };
        reader.onerror = function () { resolve(''); };
        reader.readAsDataURL(file);
      });
    }
    if (!src) { toast('图片读取失败'); return; }
    const m = {
      role: 'user',
      speakerId: 'me',
      name: meName(g),
      content: '[IMAGE:' + src + ']',
      time: nowStr(),
      timestamp: Date.now()
    };
    g.history.push(m);
    g.updatedAt = Date.now();
    renderGroupMessage(m, {}, g.history.length - 1, g.id);
    save();
    autoSaveGroupImage(src, { ownerType: 'group', ownerId: g.id }, 'chat-group-user', '群聊 · ' + (g.name || ''));
    return true;
  };

  // ---------------- 群设定页 ----------------
  function settingsGroup() {
    return findGroup(window.__groupSettingsId || window.__groupMode);
  }

  function syncGroupOutputSettingsUI() {
    const s = app().chatSettings || {};
    const action = document.getElementById('toggle-group-action-desc');
    const callAction = document.getElementById('toggle-group-call-action-desc');
    if (action) action.classList.toggle('active', !!s.enableActionDesc);
    if (callAction) callAction.classList.toggle('active', s.enableCallActionDesc !== false);
  }

  window.toggleGroupOutputSetting = function (type) {
    if (typeof window.toggleIosSwitch === 'function') {
      window.toggleIosSwitch(type === 'callActionDesc' ? 'callActionDesc' : 'actionDesc');
    }
    syncGroupOutputSettingsUI();
  };

  window.openGroupSettings = function () {
    const g = findGroup(window.__groupMode);
    if (!g) return;
    window.__groupSettingsId = g.id;
    memberQuery = '';
    fillSettings(g);
    renderGroupPinUI(g);
    if (typeof window.renderChatPresetBindings === 'function') window.renderChatPresetBindings();
    openPage('page-group-setting');
  };

  window.closeGroupSettings = function () {
    const gid = window.__groupSettingsId || window.__groupMode;
    if (typeof window.saveGroupSettings === 'function') window.saveGroupSettings();
    window.__groupSettingsId = '';
    if (gid && findGroup(gid) && typeof window.enterGroupChat === 'function') {
      window.enterGroupChat(gid);
    } else {
      openPage('page-chat');
    }
  };

  window.renderGroupPinUI = function (g) {
    const group = g || settingsGroup();
    const toggle = document.getElementById('toggle-pin-group');
    const sub = document.getElementById('pin-group-sub');
    if (!group) {
      if (toggle) toggle.classList.remove('active');
      if (sub) sub.innerText = '先创建一个群聊';
      return;
    }
    const on = (typeof window.isConversationPinned === 'function')
      ? window.isConversationPinned(group.id)
      : false;
    if (toggle) toggle.classList.toggle('active', on);
    if (sub) sub.innerText = on
      ? '已置顶，会固定在会话列表最上面'
      : '置顶后固定在会话列表最上面';
  };

  window.togglePinGroup = function () {
    const g = settingsGroup();
    if (!g) return;
    const on = (typeof window.toggleConversationPin === 'function')
      ? window.toggleConversationPin(g.id)
      : false;
    renderGroupPinUI(g);
    toast(on ? '已置顶「' + (g.name || '群聊') + '」' : '已取消置顶「' + (g.name || '群聊') + '」');
  };

  // ---------------- 群主动消息设定 UI ----------------
  function renderGroupProactiveUI(g) {
    const group = g || settingsGroup();
    if (!group) return;
    const ps = getGroupProactive(group.id);
    const toggle = document.getElementById('toggle-group-proactive');
    const callToggle = document.getElementById('toggle-group-proactive-call');
    const dndToggle = document.getElementById('toggle-group-proactive-dnd');
    const input = document.getElementById('input-group-proactive-interval');
    const unit = document.getElementById('select-group-proactive-unit');
    const dndRow = document.getElementById('row-group-proactive-dnd-range');
    const dndStart = document.getElementById('input-group-proactive-dnd-start');
    const dndEnd = document.getElementById('input-group-proactive-dnd-end');
    const memberSummary = document.getElementById('group-proactive-member-summary');
    const status = document.getElementById('label-group-proactive-status');
    const detail = document.getElementById('label-group-proactive-detail');

    if (toggle) toggle.classList.toggle('active', !!ps.bgActive);
    if (callToggle) callToggle.classList.toggle('active', !!ps.bgCall);
    if (dndToggle) dndToggle.classList.toggle('active', !!ps.bgDndEnabled);
    if (input) input.value = Math.max(1, parseInt(ps.bgIntervalVal, 10) || 1);
    if (unit) unit.value = ps.bgIntervalUnit === 'minutes' ? 'minutes' : 'hours';
    if (dndRow) dndRow.style.display = ps.bgDndEnabled ? 'flex' : 'none';
    if (dndStart) dndStart.value = ps.bgDndStart || '23:00';
    if (dndEnd) dndEnd.value = ps.bgDndEnd || '08:00';

    const curVal = Math.max(1, parseInt(ps.bgIntervalVal, 10) || 1);
    const curUnit = ps.bgIntervalUnit === 'minutes' ? 'minutes' : 'hours';
    document.querySelectorAll('#group-proactive-presets .group-proactive-chip').forEach(btn => {
      const val = parseInt(btn.getAttribute('data-bg-interval'), 10);
      const u = btn.getAttribute('data-bg-unit');
      btn.classList.toggle('active', val === curVal && u === curUnit);
    });
    const msgTendency = ps.msgTendency === 'low' || ps.msgTendency === 'high' ? ps.msgTendency : 'normal';
    const callTendency = ps.callTendency === 'low' || ps.callTendency === 'high' ? ps.callTendency : 'normal';
    document.querySelectorAll('#group-proactive-msg-tendency .bg-interval-chip').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tendency') === msgTendency);
    });
    document.querySelectorAll('#group-proactive-call-tendency .bg-interval-chip').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tendency') === callTendency);
    });

    const chosen = groupProactiveMembers(group, ps);
    if (memberSummary) {
      memberSummary.innerText = chosen.length
        ? '会冒泡：' + chosen.map(c => c.name).join('、')
        : '还没选成员，先选至少一个。';
    }
    if (status) {
      if (!ps.bgActive) {
        status.innerText = '这个群未开启';
        status.style.color = 'var(--text-muted)';
      } else {
        status.innerText = '已开启 · 每 ' + groupProactiveIntervalText(ps) + '有人冒泡';
        status.style.color = 'var(--success-primary)';
      }
    }
    if (detail) {
      if (!ps.bgActive) {
        detail.innerText = '只影响当前这个群。打开后，到了间隔会有成员主动在群里说话；其他群不受影响。';
      } else if (isGroupDndNow(ps)) {
        detail.innerText = '当前处于勿扰区间（' + (ps.bgDndStart || '23:00') + ' - ' + (ps.bgDndEnd || '08:00') + '），这个群暂时不冒泡。';
      } else {
        const last = groupProactiveLastAt(group) || Date.now();
        const elapsed = Math.max(0, Date.now() - last);
        const intervalMs = curUnit === 'minutes' ? curVal * 60 * 1000 : curVal * 3600 * 1000;
        const remain = Math.max(0, intervalMs - elapsed);
        const lastCall = Number(ps.lastCallAt) || 0;
        const callCool = Math.max(0, GROUP_CALL_COOLDOWN_MS - (Date.now() - lastCall));
        const msgLabel = ({ low: '克制', high: '主动', normal: '正常' })[msgTendency] || '正常';
        const callLabel = ({ low: '少', high: '多', normal: '正常' })[callTendency] || '正常';
        const callText = ps.bgCall
          ? (callCool > 0 ? '来电倾向 ' + callLabel + ' · 冷却约 ' + Math.ceil(callCool / (60 * 60 * 1000)) + ' 小时' : '来电倾向 ' + callLabel + ' · 随时可能打来')
          : '群电话关闭';
        detail.innerText = (remain <= 0
          ? '间隔已到，下次心跳会安排成员冒泡。'
          : '距下次冒泡约 ' + Math.ceil(remain / (60 * 1000)) + ' 分钟。') + '\n消息倾向 ' + msgLabel + ' · ' + callText;
      }
    }
  }

  window.toggleGroupProactive = function () {
    const g = settingsGroup();
    if (!g) return;
    const ps = getGroupProactive(g.id);
    saveGroupProactive(g.id, { bgActive: !ps.bgActive });
    renderGroupProactiveUI(g);
  };

  window.updateGroupProactiveInterval = function (val) {
    const g = settingsGroup();
    if (!g) return;
    const v = Math.max(1, parseInt(val, 10) || 1);
    saveGroupProactive(g.id, { bgIntervalVal: v });
    renderGroupProactiveUI(g);
  };

  window.updateGroupProactiveUnit = function (unit) {
    const g = settingsGroup();
    if (!g) return;
    saveGroupProactive(g.id, { bgIntervalUnit: unit === 'minutes' ? 'minutes' : 'hours' });
    renderGroupProactiveUI(g);
  };

  window.applyGroupProactivePreset = function (val, unit) {
    const g = settingsGroup();
    if (!g) return;
    saveGroupProactive(g.id, {
      bgIntervalVal: Math.max(1, parseInt(val, 10) || 1),
      bgIntervalUnit: unit === 'minutes' ? 'minutes' : 'hours'
    });
    renderGroupProactiveUI(g);
  };

  window.toggleGroupProactiveDnd = function () {
    const g = settingsGroup();
    if (!g) return;
    const ps = getGroupProactive(g.id);
    saveGroupProactive(g.id, { bgDndEnabled: !ps.bgDndEnabled });
    renderGroupProactiveUI(g);
  };

  window.updateGroupProactiveDndTime = function () {
    const g = settingsGroup();
    if (!g) return;
    const start = document.getElementById('input-group-proactive-dnd-start');
    const end = document.getElementById('input-group-proactive-dnd-end');
    saveGroupProactive(g.id, {
      bgDndStart: start ? (start.value || '23:00') : '23:00',
      bgDndEnd: end ? (end.value || '08:00') : '08:00'
    });
  };

  function renderGroupProactiveMemberList(g) {
    const list = document.getElementById('group-proactive-member-list');
    if (!list) return;
    const members = speakableCharMembers(g);
    const checked = groupProactiveDraftMembers;
    list.innerHTML = members.length ? members.map(m => {
      const on = checked.indexOf(m.id) >= 0;
      return '<label style="display:flex; align-items:center; gap:10px; padding:11px 2px; border-bottom:1px solid var(--border-default); cursor:pointer;">' +
        '<input type="checkbox" class="group-proactive-member-check" value="' + m.id + '"' + (on ? ' checked' : '') + ' style="width:18px; height:18px; flex:none; margin:0; accent-color:#a855f7;" />' +
        '<img src="' + (m.avatar || FB) + '" alt="" style="width:34px; height:34px; border-radius:9px; object-fit:cover; flex:none;" />' +
        '<span style="min-width:0; display:flex; flex-direction:column; gap:2px;">' +
          '<span style="font-size:13.5px; font-weight:600; color:var(--text-primary);">' + (m.name || '成员') + '</span>' +
          '<span style="font-size:10.5px; color:var(--text-muted);">' + (m.tag || '角色') + '</span>' +
        '</span>' +
      '</label>';
    }).join('') : '<div style="padding:18px 2px; font-size:12px; color:var(--text-muted);">群里还没有角色，先去群成员里加人。</div>';
  }

  window.openGroupProactiveMembers = function () {
    const g = settingsGroup();
    if (!g) return;
    const ps = getGroupProactive(g.id);
    const selected = groupProactiveMembers(g, ps).map(c => c.id);
    groupProactiveDraftMembers = selected.length ? selected.slice() : speakableCharMembers(g).map(c => c.id);
    renderGroupProactiveMemberList(g);
    const status = document.getElementById('group-proactive-members-status');
    if (status) { status.style.display = 'none'; status.innerText = ''; }
    const modal = document.getElementById('group-proactive-members-modal');
    if (modal) modal.classList.add('open');
  };

  window.closeGroupProactiveMembers = function () {
    const modal = document.getElementById('group-proactive-members-modal');
    if (modal) modal.classList.remove('open');
  };

  window.selectAllGroupProactiveMembers = function () {
    const g = settingsGroup();
    if (!g) return;
    groupProactiveDraftMembers = speakableCharMembers(g).map(c => c.id);
    renderGroupProactiveMemberList(g);
  };

  window.saveGroupProactiveMembers = function () {
    const g = settingsGroup();
    if (!g) return;
    const checks = document.querySelectorAll('.group-proactive-member-check:checked');
    const ids = Array.prototype.slice.call(checks).map(el => el.value).filter(id => !!findCard(id));
    if (!ids.length) {
      const status = document.getElementById('group-proactive-members-status');
      if (status) {
        status.style.display = 'block';
        status.innerText = '至少选一个成员，不然没人会在群里冒泡。';
      }
      return;
    }
    saveGroupProactive(g.id, { members: ids });
    closeGroupProactiveMembers();
    renderGroupProactiveUI(g);
  };

  window.triggerGroupProactiveNow = function () {
    const g = settingsGroup();
    if (!g) return;
    performGroupProactiveSend(g.id, { isManualTest: true });
  };

  window.toggleGroupProactiveCall = function () {
    const g = settingsGroup();
    if (!g) return;
    const ps = getGroupProactive(g.id);
    saveGroupProactive(g.id, { bgCall: !ps.bgCall });
    renderGroupProactiveUI(g);
  };

  window.setGroupProactiveMsgTendency = function (value) {
    const g = settingsGroup();
    if (!g) return;
    const v = value === 'low' || value === 'high' ? value : 'normal';
    saveGroupProactive(g.id, { msgTendency: v });
    renderGroupProactiveUI(g);
  };

  window.setGroupProactiveCallTendency = function (value) {
    const g = settingsGroup();
    if (!g) return;
    const v = value === 'low' || value === 'high' ? value : 'normal';
    saveGroupProactive(g.id, { callTendency: v });
    renderGroupProactiveUI(g);
  };

  window.testGroupIncomingCall = function () {
    const g = settingsGroup();
    if (!g) return;
    if (isAnyGroupCallOpen()) {
      toast('已经有一通电话在进行了');
      return;
    }
    const ps = getGroupProactive(g.id);
    const members = groupProactiveMembers(g, ps);
    if (members.length < 2) {
      toast('群语音来电至少要选两个成员，先在“谁可以冒泡”里加人');
      return;
    }
    const picked = members.slice(0, Math.min(3, members.length));
    const opened = typeof window.openIncomingGroupVoiceCall === 'function'
      ? window.openIncomingGroupVoiceCall({
          groupId: g.id,
          callerId: picked[0].id,
          memberIds: picked.map(c => c.id),
          reason: '群里聊到一半，突然想一起听听你的声音。'
        })
      : false;
    if (opened === false) toast('群来电页面还没准备好，刷新一下再试');
  };

  window.clearGroupChatHistory = function () {
    const g = settingsGroup();
    if (!g) return;
    const name = g.name || '这个群';
    if (!confirm('清空「' + name + '」的群聊记录？\n\n只清空聊天记录，不会删除群、群成员或记忆；这一步不能撤销。')) return;
    if (!confirm('再确认一次：群聊记录清空后不可恢复。\n\n确定继续吗？')) return;
    try {
      localStorage.setItem('momo_group_history_backup_' + g.id, JSON.stringify({
        name: name,
        savedAt: new Date().toISOString(),
        history: g.history || []
      }));
    } catch (e) {}
    g.history = [];
    if (g.settings) g.settings.summaryCursor = 0;
    save();
    clearContainer();
    if (typeof window.renderWechatSessions === 'function') window.renderWechatSessions();
    if (typeof window.renderContacts === 'function') window.renderContacts();
    toast('已清空「' + name + '」的群聊记录，群和记忆都还在');
  };

  function fillSettings(g) {
    const name = document.getElementById('group-name-field');
    if (name) name.value = g.name || '';
    const story = document.getElementById('group-story-field');
    if (story) story.value = g.settings.story || '';
    const every = document.getElementById('group-summary-every');
    if (every) every.value = g.settings.summaryEvery || DEFAULT_SUMMARY;
    renderMemberGrid(g);
    renderGroupRoles(g);
    renderRelations(g);
    renderLimits(g);
    renderWorldBooks(g);
    renderMemory(g);
    renderGroupTimeGapUI(g);
    renderGroupProactiveUI(g);
    syncGroupOutputSettingsUI();
  }

  window.saveGroupSettings = function () {
    const g = settingsGroup();
    if (!g) return;
    const name = document.getElementById('group-name-field');
    if (name && name.value.trim()) g.name = name.value.trim();
    const story = document.getElementById('group-story-field');
    if (story) g.settings.story = story.value.trim();
    const every = document.getElementById('group-summary-every');
    if (every) g.settings.summaryEvery = clamp(every.value, 2, 100);
    g.settings.relations = readGroupRelations();
    save();
    if (window.renderWechatSessions) window.renderWechatSessions();
    const title = document.querySelector('#page-chat .wechat-title');
    if (title && window.__groupMode === g.id) title.innerText = g.name;
  };

  // ---------------- 群聊时间检测 ----------------
  function readGroupTimeGapPlans() {
    try {
      const raw = localStorage.getItem(GROUP_TIME_GAP_PLAN_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
  }
  function writeGroupTimeGapPlans(all) {
    try { localStorage.setItem(GROUP_TIME_GAP_PLAN_KEY, JSON.stringify(all || {})); } catch (e) {}
  }
  function getGroupTimeGapPlan(gid) {
    if (!gid) return null;
    return readGroupTimeGapPlans()[gid] || null;
  }
  function saveGroupTimeGapPlan(gid, plan) {
    if (!gid || !plan) return;
    const all = readGroupTimeGapPlans();
    plan.groupId = gid;
    plan.updatedAt = Date.now();
    all[gid] = plan;
    writeGroupTimeGapPlans(all);
  }
  function dateKeyOf(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function groupMessageTimestamp(g, m) {
    if (!m) return 0;
    const own = Number(m.timestamp);
    if (own > 0) return own;
    const raw = String(m.time || '');
    const md = raw.match(/(\d{1,2})月(\d{1,2})日[\s]*(\d{1,2}):(\d{1,2})/);
    if (md) {
      const d = new Date(new Date().getFullYear(), parseInt(md[1], 10) - 1, parseInt(md[2], 10), parseInt(md[3], 10), parseInt(md[4], 10));
      return d.getTime();
    }
    const hm = raw.match(/(\d{1,2}):(\d{1,2})/);
    if (hm) {
      const base = (g && Number(g.createdAt) > 0) ? new Date(g.createdAt) : new Date();
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), parseInt(hm[1], 10), parseInt(hm[2], 10));
      if (d.getTime() > Date.now() + 5 * 60 * 1000) d.setDate(d.getDate() - 1);
      return d.getTime();
    }
    return 0;
  }
  function groupLastTimestamp(g) {
    if (!g || !Array.isArray(g.history) || !g.history.length) return 0;
    for (let i = g.history.length - 1; i >= 0; i--) {
      const ts = groupMessageTimestamp(g, g.history[i]);
      if (ts) return ts;
    }
    return Number(g.updatedAt) || 0;
  }
  function groupTimeLabel(ts, m) {
    if (!ts) return (m && m.time) || '群聊';
    const d = new Date(ts);
    const isToday = dateKeyOf(ts) === dateKeyOf(Date.now());
    return (isToday ? '' : (d.getMonth() + 1) + '月' + d.getDate() + '日 ') + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function formatGroupGapStamp(ts) {
    const d = new Date(Number(ts) || 0);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function formatGroupGapAge(ms) {
    const h = Math.max(0, Math.floor(ms / (60 * 60 * 1000)));
    if (h < 1) return '不到 1 小时';
    if (h < 24) return h + ' 小时前';
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return d + ' 天' + (rh ? ' ' + rh + ' 小时' : '') + '前';
  }
  function sanitizeGroupTimeGapCount(raw) {
    let n = parseInt(raw, 10);
    if (isNaN(n)) n = 5;
    return Math.max(1, Math.min(GROUP_TIME_GAP_MAX_COUNT, n));
  }
  function setGroupTimeGapStatus(text, isError) {
    const el = document.getElementById('group-time-gap-status');
    if (!el) return;
    if (!text) { el.style.display = 'none'; el.innerText = ''; return; }
    el.style.display = 'block';
    el.style.color = isError ? 'var(--danger-primary)' : 'var(--text-muted)';
    el.innerText = text;
  }
  function setGroupTimeGapModalStatus(text) {
    const el = document.getElementById('group-time-gap-modal-status');
    if (!el) return;
    if (!text) { el.style.display = 'none'; el.innerText = ''; return; }
    el.style.display = 'block';
    el.innerText = text;
  }
  function setGroupTimeGapMembersStatus(text) {
    const el = document.getElementById('group-time-gap-members-status');
    if (!el) return;
    if (!text) { el.style.display = 'none'; el.innerText = ''; return; }
    el.style.display = 'block';
    el.innerText = text;
  }
  function paintGroupTimeGapBadge(text, tone) {
    const el = document.getElementById('group-time-gap-badge');
    if (!el) return;
    el.innerText = text || '—';
    if (tone === 'ready') {
      el.style.color = '#f0c880';
      el.style.borderColor = 'rgba(240,200,128,.42)';
      el.style.background = 'rgba(240,200,128,.10)';
    } else if (tone === 'done') {
      el.style.color = '#7bd88f';
      el.style.borderColor = 'rgba(123,216,143,.38)';
      el.style.background = 'rgba(123,216,143,.08)';
    } else {
      el.style.color = 'var(--text-muted)';
      el.style.borderColor = 'var(--border-default)';
      el.style.background = 'transparent';
    }
  }
  function groupBatchLastIndex(g, batchId) {
    let last = -1;
    if (!g || !batchId) return last;
    (g.history || []).forEach((m, i) => { if (m && m.gapBatchId === batchId) last = i; });
    return last;
  }
  function groupBatchLocked(g, plan) {
    if (!g || !plan || !plan.batchId) return false;
    const last = groupBatchLastIndex(g, plan.batchId);
    if (last < 0) return false;
    for (let i = last + 1; i < g.history.length; i++) {
      if (g.history[i] && g.history[i].role === 'user') return true;
    }
    return false;
  }

  function renderGroupTimeGapUI(g) {
    const group = g || settingsGroup();
    const badge = document.getElementById('group-time-gap-badge');
    if (!badge) return;
    const summary = document.getElementById('group-time-gap-summary');
    const actionRow = document.getElementById('group-time-gap-action-row');
    const btn = document.getElementById('btn-group-time-gap-check');
    const hint = document.getElementById('group-time-gap-hint');
    const regenRow = document.getElementById('group-time-gap-regen-row');
    const regenCount = document.getElementById('group-time-gap-regen-count');
    const lockNote = document.getElementById('group-time-gap-lock-note');
    const memberSummary = document.getElementById('group-time-gap-member-summary');
    setGroupTimeGapStatus('');
    if (!group) {
      paintGroupTimeGapBadge('—');
      if (summary) summary.innerText = '先创建一个群聊。';
      if (actionRow) actionRow.style.display = 'none';
      if (regenRow) regenRow.style.display = 'none';
      if (lockNote) lockNote.style.display = 'none';
      if (memberSummary) memberSummary.style.display = 'none';
      return;
    }
    const lastTs = groupLastTimestamp(group);
    const plan = getGroupTimeGapPlan(group.id);
    const hasBatch = !!(plan && plan.mode === 'lost' && plan.batchId && (group.history || []).some(m => m && m.gapBatchId === plan.batchId));
    if (!lastTs) {
      paintGroupTimeGapBadge('无记录');
      if (summary) summary.innerText = '还没有群聊时间记录，先在群里说几句。';
      if (actionRow) actionRow.style.display = 'flex';
      if (btn) { btn.disabled = true; btn.style.opacity = '.5'; btn.style.cursor = 'default'; }
      if (hint) hint.innerText = '有聊天记录后才能检测时间断层。';
      if (regenRow) regenRow.style.display = 'none';
      if (lockNote) lockNote.style.display = 'none';
      if (memberSummary) memberSummary.style.display = 'none';
      return;
    }
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'; }
    const gapMs = Math.max(0, Date.now() - lastTs);

    if (hasBatch) {
      const locked = groupBatchLocked(group, plan);
      const memberNames = (plan.selectedIds || []).map(id => (findCard(id) || {}).name).filter(Boolean);
      paintGroupTimeGapBadge(locked ? '已锁定' : '已补写', locked ? 'done' : 'ready');
      if (summary) {
        summary.innerText = '上次补写：' + (plan.count || 0) + ' 条（' +
          formatGroupGapStamp(plan.batchStart || plan.gapStart) + ' — ' +
          formatGroupGapStamp(plan.batchEnd || plan.gapEnd) + '）';
      }
      if (actionRow) actionRow.style.display = 'none';
      if (regenRow) regenRow.style.display = locked ? 'none' : 'flex';
      if (regenCount) regenCount.value = plan.count || 5;
      if (lockNote) lockNote.style.display = locked ? 'block' : 'none';
      if (memberSummary) {
        memberSummary.style.display = memberNames.length ? 'block' : 'none';
        memberSummary.innerText = memberNames.length ? ('上次发言：' + memberNames.join('、')) : '';
      }
      if (plan.status === 'failed' && plan.error) setGroupTimeGapStatus('上次补写失败：' + plan.error, true);
      return;
    }

    if (plan && plan.status === 'generating') {
      paintGroupTimeGapBadge('补写中', 'ready');
      if (summary) summary.innerText = '正在补写这几天群里的消息…';
      if (actionRow) actionRow.style.display = 'none';
      if (regenRow) regenRow.style.display = 'none';
      if (lockNote) lockNote.style.display = 'none';
      if (memberSummary) memberSummary.style.display = 'none';
      return;
    }

    const dailyDone = !!(plan && plan.mode === 'daily' && Number(plan.detectedAt) > lastTs);
    const ready = gapMs >= GROUP_TIME_GAP_MIN_MS;
    paintGroupTimeGapBadge(dailyDone ? '已按日常' : (ready ? '可接续' : '还不用接'), dailyDone ? 'done' : (ready ? 'ready' : ''));
    if (summary) summary.innerText = '上次群聊：' + formatGroupGapAge(gapMs) + '（' + formatGroupGapStamp(lastTs) + '）';
    if (actionRow) actionRow.style.display = 'flex';
    if (btn) btn.innerText = dailyDone ? '重新检测' : '检测一下';
    if (hint) {
      hint.innerText = dailyDone
        ? '已经按普通日子接上，不会追问这几天去哪了。'
        : (ready ? '超过 48 小时，可以选算日常或让 TA 发现。' : '还不用接；超过 48 小时才会出现选择。');
    }
    if (regenRow) regenRow.style.display = 'none';
    if (lockNote) lockNote.style.display = 'none';
    if (memberSummary) memberSummary.style.display = 'none';
    if (plan && plan.status === 'failed' && plan.error) setGroupTimeGapStatus('上次补写失败：' + plan.error, true);
  }

  function checkGroupTimeGap() {
    const g = settingsGroup();
    if (!g) return;
    if (groupTimeGapGenerating) { toast('正在补写这几天…'); return; }
    const lastTs = groupLastTimestamp(g);
    if (!lastTs) { setGroupTimeGapStatus('还没有群聊时间记录，先在群里说几句。', true); return; }
    const gapMs = Math.max(0, Date.now() - lastTs);
    if (gapMs < GROUP_TIME_GAP_MIN_MS) {
      paintGroupTimeGapBadge('还不用接');
      const summary = document.getElementById('group-time-gap-summary');
      if (summary) summary.innerText = '上次群聊：' + formatGroupGapAge(gapMs) + '（' + formatGroupGapStamp(lastTs) + '）';
      const hint = document.getElementById('group-time-gap-hint');
      if (hint) hint.innerText = '还不用接；超过 48 小时才会出现选择。';
      setGroupTimeGapStatus('还没到 48 小时，不用补。', false);
      return;
    }
    const old = getGroupTimeGapPlan(g.id) || {};
    const plan = {
      groupId: g.id,
      mode: 'pending',
      status: 'detected',
      gapStart: lastTs,
      gapEnd: Date.now(),
      detectedAt: Date.now(),
      count: old.count || 5,
      selectedIds: [],
      batchId: '',
      batchStart: 0,
      batchEnd: 0,
      locked: false,
      error: ''
    };
    saveGroupTimeGapPlan(g.id, plan);
    pendingGroupTimeGapGid = g.id;
    const days = Math.max(1, Math.round(gapMs / (24 * 60 * 60 * 1000)));
    const title = document.getElementById('group-time-gap-modal-title');
    const sub = document.getElementById('group-time-gap-modal-sub');
    if (title) title.innerText = '这 ' + days + ' 天怎么算？';
    if (sub) sub.innerText = '上次群聊：' + formatGroupGapStamp(lastTs) + '（' + formatGroupGapAge(gapMs) + '）｜只影响当前这个群。';
    setGroupTimeGapModalStatus('');
    const modal = document.getElementById('group-time-gap-modal');
    if (modal) modal.classList.add('open');
  }

  function closeGroupTimeGapModal() {
    const modal = document.getElementById('group-time-gap-modal');
    if (modal) modal.classList.remove('open');
  }
  function closeGroupTimeGapMembers() {
    const modal = document.getElementById('group-time-gap-members-modal');
    if (modal) modal.classList.remove('open');
  }

  function openGroupTimeGapMembers() {
    const g = findGroup(pendingGroupTimeGapGid) || settingsGroup();
    if (!g) return;
    const plan = getGroupTimeGapPlan(g.id);
    if (!plan) return;
    pendingGroupTimeGapGid = g.id;
    const members = speakableCharMembers(g);
    const list = document.getElementById('group-time-gap-member-list');
    const oldSelected = (Array.isArray(plan.selectedIds) ? plan.selectedIds : []).filter(id => members.some(m => m.id === id));
    const checked = oldSelected.length ? oldSelected : members.slice(0, 2).map(m => m.id);
    if (list) {
      list.innerHTML = members.length ? members.map(m => {
        const on = checked.indexOf(m.id) >= 0 ? ' checked' : '';
        return '<label style="display:flex; align-items:center; gap:10px; padding:11px 2px; border-bottom:1px solid var(--border-default); cursor:pointer;">' +
          '<input type="checkbox" class="group-time-gap-member-check" value="' + m.id + '"' + on + ' style="width:18px; height:18px; flex:none; margin:0; accent-color:#f0c880;" />' +
          '<img src="' + (m.avatar || FB) + '" alt="" style="width:34px; height:34px; border-radius:9px; object-fit:cover; flex:none;" />' +
          '<span style="min-width:0; display:flex; flex-direction:column; gap:2px;">' +
            '<span style="font-size:13.5px; font-weight:600; color:var(--text-primary);">' + (m.name || '成员') + '</span>' +
            '<span style="font-size:10.5px; color:var(--text-muted);">' + (m.tag || '角色') + '</span>' +
          '</span>' +
        '</label>';
      }).join('') : '<div style="padding:18px 2px; font-size:12px; color:var(--text-muted);">群里还没有角色，先去群成员里加人。</div>';
    }
    const count = document.getElementById('group-time-gap-count');
    if (count) count.value = plan.count || 5;
    setGroupTimeGapMembersStatus('');
    closeGroupTimeGapModal();
    const modal = document.getElementById('group-time-gap-members-modal');
    if (modal) modal.classList.add('open');
  }

  function applyGroupTimeGapMode(mode) {
    if (mode === 'lost') { openGroupTimeGapMembers(); return; }
    const g = findGroup(pendingGroupTimeGapGid) || settingsGroup();
    if (!g) return;
    const plan = getGroupTimeGapPlan(g.id);
    if (!plan) return;
    plan.mode = 'daily';
    plan.status = 'done';
    plan.error = '';
    saveGroupTimeGapPlan(g.id, plan);
    closeGroupTimeGapModal();
    closeGroupTimeGapMembers();
    toast('这个群按普通日子接上了');
    if (typeof window.closeGroupSettings === 'function') window.closeGroupSettings();
    else if (typeof window.enterGroupChat === 'function') window.enterGroupChat(g.id);
  }

  function applyGroupTimeGapLost() {
    const g = findGroup(pendingGroupTimeGapGid) || settingsGroup();
    if (!g) return;
    const plan = getGroupTimeGapPlan(g.id);
    if (!plan) return;
    const checks = document.querySelectorAll('.group-time-gap-member-check:checked');
    const ids = Array.prototype.slice.call(checks).map(el => el.value).filter(id => !!findCard(id));
    if (!ids.length) { setGroupTimeGapMembersStatus('至少选一个成员，不然没人会说话。'); return; }
    const countInput = document.getElementById('group-time-gap-count');
    const count = sanitizeGroupTimeGapCount(countInput ? countInput.value : 5);
    plan.mode = 'lost';
    plan.status = 'generating';
    plan.count = count;
    plan.selectedIds = ids;
    plan.batchId = '';
    plan.batchStart = 0;
    plan.batchEnd = 0;
    plan.locked = false;
    plan.error = '';
    saveGroupTimeGapPlan(g.id, plan);
    closeGroupTimeGapMembers();
    closeGroupTimeGapModal();
    pendingGroupTimeGapGid = g.id;
    if (typeof window.closeGroupSettings === 'function') window.closeGroupSettings();
    else if (typeof window.enterGroupChat === 'function') window.enterGroupChat(g.id);
    setTimeout(function () { runGroupTimeGapGeneration(plan, false); }, 140);
  }

  function regenerateGroupTimeGapBatch() {
    const g = settingsGroup();
    if (!g) return;
    if (groupTimeGapGenerating) { toast('正在补写这几天…'); return; }
    const plan = getGroupTimeGapPlan(g.id);
    if (!plan || plan.mode !== 'lost' || !plan.batchId) {
      setGroupTimeGapStatus('还没有可以重新生成的补写。', true);
      return;
    }
    if (groupBatchLocked(g, plan)) {
      setGroupTimeGapStatus('你已经接话，这批补写已锁定，不能再重新生成。', true);
      return;
    }
    const countInput = document.getElementById('group-time-gap-regen-count');
    const count = sanitizeGroupTimeGapCount(countInput ? countInput.value : plan.count);
    plan.count = count;
    plan.status = 'generating';
    plan.error = '';
    saveGroupTimeGapPlan(g.id, plan);
    pendingGroupTimeGapGid = g.id;
    if (typeof window.closeGroupSettings === 'function') window.closeGroupSettings();
    else if (typeof window.enterGroupChat === 'function') window.enterGroupChat(g.id);
    setTimeout(function () { runGroupTimeGapGeneration(plan, true); }, 140);
  }

  function showGroupTimeGapLoading(text) {
    hideGroupTimeGapLoading();
    const c = document.getElementById('message-container');
    if (!c) return;
    const d = document.createElement('div');
    d.id = 'group-time-gap-loading';
    d.className = 'wechat-time-divider';
    d.innerHTML = '<span class="wechat-time-pill">' + (text || '正在补写…') + '</span>';
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }
  function hideGroupTimeGapLoading() {
    const el = document.getElementById('group-time-gap-loading');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  async function runGroupTimeGapGeneration(plan, isRegenerate) {
    if (groupTimeGapGenerating) return;
    const g = findGroup(plan && plan.groupId) || findGroup(pendingGroupTimeGapGid) || settingsGroup();
    if (!g || !plan) return;
    pendingGroupTimeGapGid = g.id;
    const isActive = window.__groupMode === g.id;
    groupTimeGapGenerating = true;
    if (isActive) showGroupTimeGapLoading('正在补写这几天的群消息…');
    try {
      const batchId = 'gtg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      const msgs = await buildGroupGapMessages(g, plan, batchId);
      if (!msgs.length) throw new Error('模型没有写出群消息');
      const oldBatchId = plan.batchId || '';
      let nextHistory = (g.history || []).slice();
      if (isRegenerate && oldBatchId) nextHistory = nextHistory.filter(m => !(m && m.gapBatchId === oldBatchId));
      const gapStart = Number(plan.gapStart) || 0;
      let insertAt = -1;
      for (let i = 0; i < nextHistory.length; i++) {
        const ts = groupMessageTimestamp(g, nextHistory[i]);
        if (ts && ts > gapStart + 1000) { insertAt = i; break; }
      }
      if (insertAt < 0) insertAt = nextHistory.length;
      nextHistory.splice.apply(nextHistory, [insertAt, 0].concat(msgs));
      g.history = nextHistory;
      g.updatedAt = Date.now();
      save();
      const locked = groupBatchLocked(g, { batchId: batchId });
      const nextPlan = Object.assign({}, plan, {
        mode: 'lost',
        status: 'generated',
        batchId: batchId,
        batchStart: msgs[0].timestamp,
        batchEnd: msgs[msgs.length - 1].timestamp,
        count: msgs.length,
        selectedIds: plan.selectedIds || [],
        locked: locked,
        error: ''
      });
      saveGroupTimeGapPlan(g.id, nextPlan);
      if (isActive) renderGroupHistory(g);
      renderGroupTimeGapUI(g);
      toast('已补上 ' + msgs.length + ' 条群消息');
    } catch (e) {
      const failed = Object.assign({}, plan, { status: 'failed', error: String(e && e.message || e) });
      saveGroupTimeGapPlan(g.id, failed);
      if (isActive) {
        hideGroupTimeGapLoading();
        if (typeof window.renderSystemNotice === 'function') {
          window.renderSystemNotice('补写没有成功：' + (e.message || e) + '。回到群设定可以再试。');
        } else {
          toast('补写没有成功：' + (e.message || e));
        }
      }
      renderGroupTimeGapUI(g);
    } finally {
      groupTimeGapGenerating = false;
      hideGroupTimeGapLoading();
    }
  }

  async function buildGroupGapMessages(g, plan, batchId) {
    const members = speakableCharMembers(g);
    let selected = (plan.selectedIds || []).map(id => findCard(id)).filter(c => !!c && members.some(m => m.id === c.id));
    if (!selected.length) selected = members.slice(0, 2);
    if (!selected.length) throw new Error('群里还没有角色，先去群成员里加人');
    const total = sanitizeGroupTimeGapCount(plan.count);
    const contents = [];
    const chunks = Math.max(1, Math.ceil(total / GROUP_TIME_GAP_CHUNK_SIZE));
    const gapStart = Number(plan.gapStart) || (Date.now() - GROUP_TIME_GAP_MIN_MS);
    const gapEnd = Number(plan.gapEnd) || Date.now();
    for (let ci = 0; ci < chunks; ci++) {
      const take = Math.min(GROUP_TIME_GAP_CHUNK_SIZE, total - contents.length);
      if (take <= 0) break;
      const partStart = gapStart + (gapEnd - gapStart) * (ci / chunks);
      const partEnd = gapStart + (gapEnd - gapStart) * ((ci + 1) / chunks);
      const part = await requestGroupGapContents(g, {
        selected: selected,
        total: take,
        gapStart: partStart,
        gapEnd: partEnd,
        chunkIndex: ci + 1,
        chunkCount: chunks
      });
      part.slice(0, take).forEach(item => contents.push(item));
    }
    const finalContents = contents.slice(0, total);
    if (!finalContents.length) throw new Error('模型没有写出群消息');
    const stamps = buildGroupGapTimestamps(gapStart, gapEnd, finalContents.length);
    return finalContents.map((item, i) => {
      const card = findCard(item.memberId) || selected[i % selected.length];
      return {
        role: 'assistant',
        speakerId: card.id,
        name: card.name,
        avatar: card.avatar || '',
        content: item.content,
        time: formatGroupGapStamp(stamps[i]),
        timestamp: stamps[i],
        gapBatchId: batchId
      };
    });
  }

  async function requestGroupGapContents(g, opt) {
    const selected = opt.selected || [];
    const info = selected.map(c => c.id + '=' + c.name + '｜' + (c.tag || '角色') + (c.intro ? '｜' + c.intro : '')).join('\n');
    const members = memberList(g).map(m => m.isMe ? meName(g) + '（用户本人）' : m.name + (m.tag ? '（' + m.tag + '）' : '')).join('、');
    const rels = (g.settings.relations || []).map(r => {
      const an = r.a === 'me' ? meName(g) : ((findCard(r.a) || {}).name || '成员');
      const bn = r.b === 'me' ? meName(g) : ((findCard(r.b) || {}).name || '成员');
      return an + ' — ' + r.label + ' — ' + bn;
    }).join('\n');
    const recent = recentLines(g, 12) || '（还没聊过）';
    const world = String(worldText(g) || '').slice(0, 2200);
    const sys = [
      '你现在在微信群「' + g.name + '」里，替群成员补写过去几天的群消息。',
      '群成员：' + members + '。',
      '用户：' + meName(g) + '。',
      g.settings.story ? '群故事背景：' + g.settings.story : '',
      rels ? '人物关系：\n' + rels : '',
      world ? '世界书：\n' + world : '',
      '最近群聊记录：\n' + recent,
      '',
      '只让下面这些成员发言：',
      info,
      '',
      '输出要求：',
      '1. 这些消息发生在过去，不是现在；用户那几天没有打开群，也没有回你们。',
      '2. 合计 ' + opt.total + ' 条，按时间顺序。',
      '3. 只写上面列出的成员，不能写用户，不能写旁白。',
      '4. 如果条数够，每个选中成员至少 1 条；尽量均匀，不要一个人刷屏。',
      '5. 每条 1-2 句短微信，口语、有活人感，可以各说各的，不要客服腔。',
      '6. 不要提“你终于回来了 / 好久不见 / 这几天去哪了 / 你是不是消失了”。',
      '7. 不要提补写、生成、系统、AI、时间断层。',
      '8. 最后一条自然留一个钩子，让用户回来时有话可以接。',
      '',
      '只输出严格 JSON 数组，不要解释：',
      '[{"memberId":"角色id","content":"第一条"},{"memberId":"角色id","content":"第二条"}]'
    ].filter(Boolean).join('\n');
    const user = '时间范围：' + formatGroupGapStamp(opt.gapStart) + ' — ' + formatGroupGapStamp(opt.gapEnd) +
      '（第 ' + opt.chunkIndex + '/' + opt.chunkCount + ' 段）。只写这一段的 ' + opt.total + ' 条。';
    const raw = await callModel([
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ], Math.max(600, opt.total * 90), 0.9);
    return parseGroupGapContents(raw, selected, opt.total);
  }

  function parseGroupGapContents(raw, selected, expected) {
    let text = String(raw || '').replace(/```json/gi, '```').replace(/```/g, '').trim();
    if (!text) return [];
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    if (!data) {
      const arr = text.match(/\[[\s\S]*\]/);
      if (arr) { try { data = JSON.parse(arr[0]); } catch (e) {} }
    }
    if (!data) {
      const obj = text.match(/\{[\s\S]*\}/);
      if (obj) { try { data = JSON.parse(obj[0]); } catch (e) {} }
    }
    let list = [];
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.messages)) list = data.messages;
    else if (data && Array.isArray(data.items)) list = data.items;
    if (!list.length) {
      list = text.split(/\n+/).map(s => s.replace(/^[-*"'“]|["'”]$/g, '').trim()).filter(Boolean);
    }
    const selectedIds = selected.map(c => c.id);
    const byName = {};
    selected.forEach(c => { byName[c.name] = c.id; });
    return list.map((item, i) => {
      let content = '';
      let memberId = '';
      if (typeof item === 'string') {
        content = item;
      } else if (item && typeof item === 'object') {
        content = String(item.content || item.text || item.message || '').trim();
        memberId = String(item.memberId || item.id || item.speakerId || item.charId || '').trim();
        const nm = String(item.name || item.speaker || '').trim();
        if (!memberId && nm && byName[nm]) memberId = byName[nm];
      }
      content = content.replace(/^["'“]|["'”]$/g, '').trim();
      if (!content) return null;
      if (selectedIds.indexOf(memberId) < 0) {
        const byNm = selected.filter(c => c.name === memberId)[0];
        memberId = byNm ? byNm.id : selected[i % selected.length].id;
      }
      return { memberId: memberId, content: content };
    }).filter(Boolean).slice(0, expected);
  }

  function buildGroupGapTimestamps(start, end, n) {
    const s = Number(start) || (Date.now() - GROUP_TIME_GAP_MIN_MS);
    const e = Number(end) || Date.now();
    const span = Math.max(0, e - s);
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = n <= 1 ? 0.86 : 0.12 + 0.76 * (i / (n - 1));
      out.push(Math.round(s + span * p));
    }
    return out;
  }

  // ---------------- 群主动消息：到点让成员自己冒泡 ----------------
  async function performGroupProactiveSend(gid, opts) {
    opts = opts || {};
    const g = findGroup(gid);
    if (!g) return false;
    const ps = getGroupProactive(gid);
    if (!ps.bgActive && !opts.isManualTest) return false;
    if (isGroupDndNow(ps) && !opts.isManualTest) return false;
    if (busy || groupTimeGapGenerating) return false;

    const selected = groupProactiveMembers(g, ps);
    if (!selected.length) return false;

    const activeGroup = window.__groupMode === g.id;
    const callEligible = !!(ps.bgCall && activeGroup && selected.length >= 2 &&
      !isAnyGroupCallOpen() &&
      (!!opts.isManualTest ||
        (Date.now() - (Number(ps.lastCallAt) || 0) >= GROUP_CALL_COOLDOWN_MS)));
    const user = meName(g);
    const plan = getGroupTimeGapPlan(g.id);
    const gapDailyMode = !!(plan && plan.mode === 'daily');
    const membersInfo = selected.map(c =>
      '- id=' + c.id + '｜' + c.name + (c.tag ? '（' + c.tag + '）' : '') + '：' +
      String(c.prompt || c.intro || '按角色性格自然说话').replace(/\s+/g, ' ').slice(0, 260)
    ).join('\n');
    const imageMembers = selected.filter(c => canGroupGenerateForChar(c));
    const msgTendencyText = ({
      low: '整体克制：优先让最自然的 1-2 人开口，不要为了完成条数硬让所有人说话；安静的角色这次可以不冒泡。',
      high: '整体主动：不要因为角色人设闷就完全不开口，至少让一个成员主动起话头，安静角色也可以用短句或小动作参与；但不要全员轮流刷屏。',
      normal: '整体自然：按性格和当前气氛决定谁开口、说几条，安静角色可以少说，但不要永远沉默。'
    })[ps.msgTendency || 'normal'] || '整体自然：按性格和当前气氛决定谁开口、说几条。';
    const callTendencyText = ({
      low: '来电少：除非最近对话明显适合打电话，否则优先发消息。',
      high: '来电多：如果最近群聊有想继续聊、想听声音、话没说完的迹象，优先考虑打电话；不要因为角色闷就完全排除来电，但必须有具体由头。',
      normal: '来电正常：有合适由头才打，不要为了打电话而打电话。'
    })[ps.callTendency || 'normal'] || '来电正常：有合适由头才打。';
    const proactiveImageBlock = imageMembers.length ? [
      '',
      '【这些成员这轮可以发新图】' + imageMembers.map(c => c.name + '（' + c.id + '）').join('、'),
      '想发刚拍 / 刚画 / 眼前正在发生的新画面时，把该成员的一条 content 写成：先一句自然的话，换行再写 [生图: 画面描述]。',
      '系统会补锁脸和画风，生成后存进该成员自己的角色相簿，并把图接在这条消息后面。',
      '每人这轮最多发一张新图；不要用 [发相册图]，不要写文字/水印/logo/二维码。'
    ].join('\n') : '';
    const rels = (g.settings.relations || []).map(r => {
      const a = r.a === 'me' ? user : ((findCard(r.a) || {}).name || '成员');
      const b = r.b === 'me' ? user : ((findCard(r.b) || {}).name || '成员');
      return '- ' + a + ' 与 ' + b + '：' + r.label;
    }).join('\n');
    const memoryLines = (g.settings.memory || []).slice(-8).map(m => '- ' + m.text).join('\n');
    const recent = recentLines(g, 14);
    const silenceLine = gapDailyMode
      ? '你们的时间是连续的，' + user + '只是暂时没看群，不存在断联；绝对不要提“好久不见 / 这几天去哪了 / 你终于回来了”。'
      : user + '已经 ' + groupProactiveIntervalText(ps) + ' 没在群里说话了。';

    const prompt = [
      '群名：' + g.name,
      '用户：' + user,
      '现在群里安静了：' + silenceLine,
      '群故事背景：' + (g.settings.story || '（未填写）'),
      '人物关系：' + (rels || '（未填写）'),
      '群记忆：' + (memoryLines || '（暂无）'),
      '最近群聊记录：',
      recent || '（还没聊过）',
      '',
      '这次可以冒泡的成员（只能从里面选，不能选用户）：',
      membersInfo,
      '这次的整体主动倾向：' + msgTendencyText,
      proactiveImageBlock,
      callEligible ? [
        '',
        '【这次也可以打电话】',
        '除了在群里冒泡，也可以让其中 2-4 个成员发起一次群语音通话。先决定这一次是消息还是电话。',
        '这次来电倾向：' + callTendencyText,
        '选电话时不要输出 messages，只输出：',
        '{"action":"call","callerId":"角色id","memberIds":["角色id","角色id"],"reason":"一句自然的来电理由"}',
        'callerId 必须在 memberIds 里；成员只能从上面的列表里选，绝不能选用户；reason 20 字左右，接住最近群聊里的具体细节，不要模板句。'
      ].join('\n') : '',
      '',
      callEligible
        ? '任务：先决定这次是让成员冒泡，还是发起群语音电话。冒泡就写 1-4 条群消息；打电话就只输出上面的 call JSON。'
        : '任务：写 1-4 条群消息，让成员自然地在群里冒泡。',
      '规则：',
      '1. 只能从上面列出的成员里选 speakerId，绝不能选用户。',
      '2. 选 1-3 个成员，合计 1-4 条消息；不要每个人都轮流说一句。',
      '3. 每人 1-2 条，短、口语、有活人感，不要客服腔。',
      '4. 不要旁白、不要写“名字：”前缀、不要替别人说话。',
      '5. 不要解释你是 AI、系统或模型；不要提“主动消息 / 生成 / 补写”。',
      '6. 如果设定里他们是虚拟或屏幕里的存在，就保持这个认知；不要虚构现实世界肉身线下活动。',
      '7. 不要连续刷屏；可以只让一个人先开口。',
      '',
      callEligible
        ? '只输出 JSON，不要解释：{"action":"messages","messages":[{"speakerId":"角色id","content":"消息内容"}]}，或者 {"action":"call","callerId":"角色id","memberIds":["角色id"],"reason":"理由"}'
        : '只输出 JSON，不要解释：{"messages":[{"speakerId":"角色id","content":"消息内容"}]}'
    ].join('\n');

    if (!app().apiKey || !app().apiBase) {
      if (opts.isManualTest) toast('先配置 API Key 和接口地址');
      return false;
    }

    let raw = '';
    try {
      raw = await callModel([
        { role: 'system', content: '你是微信群聊的主动消息导演。只输出严格 JSON，不写解释、不写旁白。' },
        { role: 'user', content: prompt }
      ], 520, 0.88);
    } catch (e) {
      if (opts.isManualTest) toast('群主动消息失败：' + e.message);
      return false;
    }

    const obj = parseLoose(raw);
    if (callEligible && obj && (String(obj.action || '').toLowerCase() === 'call' ||
        (!obj.messages && (obj.callerId || obj.memberIds)))) {
      const rawIds = Array.isArray(obj.memberIds) ? obj.memberIds : [];
      const memberIds = rawIds.map(id => String(id)).filter(id => selected.some(c => c.id === id));
      const callerId = String(obj.callerId || memberIds[0] || '');
      const caller = selected.filter(c => c.id === callerId)[0];
      if (!caller || memberIds.length < 2 || memberIds.length > 4) return false;
      if (memberIds.indexOf(caller.id) < 0) return false;
      const reason = String(obj.reason || '').replace(/[“”"「」]/g, '').trim().slice(0, 80)
        || (caller.name + ' 在群里发起了语音通话。');
      const opened = (typeof window.openIncomingGroupVoiceCall === 'function')
        ? window.openIncomingGroupVoiceCall({
            groupId: g.id,
            callerId: caller.id,
            memberIds: memberIds,
            reason: reason
          })
        : false;
      if (opened === false) return false;
      if (!opts.isManualTest) saveGroupProactive(g.id, { lastCallAt: Date.now() });
      if (opts.isManualTest) toast('📞 ' + caller.name + ' 发起了群语音通话，请接听');
      return true;
    }
    let items = (obj && Array.isArray(obj.messages)) ? obj.messages : [];
    items = items.map(item => {
      if (typeof item === 'string') {
        const text = String(item).trim();
        const named = selected.filter(c => text.indexOf(c.name + '：') === 0 || text.indexOf(c.name + ':') === 0)[0];
        return {
          speakerId: (named || selected[0]).id,
          content: named ? text.slice(named.name.length + 1).trim() : text
        };
      }
      let sid = String((item && (item.speakerId || item.id || item.character || item.name)) || '').trim();
      let card = selected.filter(c => c.id === sid)[0] || selected.filter(c => c.name === sid)[0];
      let content = String((item && (item.content || item.text || item.message)) || '').trim();
      content = content.replace(/^["'“]|["'”]$/g, '').trim();
      const named = selected.filter(c => content.indexOf(c.name + '：') === 0 || content.indexOf(c.name + ':') === 0)[0];
      if (named) {
        card = named;
        content = content.slice(named.name.length + 1).trim();
      }
      if (!card) card = selected[0];
      return { speakerId: card.id, content: content };
    }).filter(x => x.content);

    if (!items.length) {
      const lines = String(raw || '').split(/\n+/).map(s => s.replace(/^["'“]|["'”]$/g, '').trim())
        .filter(s => s && !/^\{|^\}|^\[|^\]/.test(s));
      items = lines.slice(0, 4).map((line, i) => ({
        speakerId: selected[i % selected.length].id,
        content: line.replace(/^[^：:]{1,12}[：:]\s*/, '')
      })).filter(x => x.content);
    }
    if (!items.length) {
      if (opts.isManualTest) toast('模型没有返回可用的群消息');
      return false;
    }
    items = items.slice(0, 5);

    const baseTs = Date.now();
    const t = nowStr();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const card = selected.filter(c => c.id === item.speakerId)[0] || selected[0];
      if (!card) continue;
      let content = String(item.content || '').trim();
      const genMatch = content.match(/[【\[]生图[：:]([\s\S]*?)[】\]]/);
      const generatedPrompt = genMatch ? String(genMatch[1] || '').trim() : '';
      if (genMatch) content = content.replace(/[【\[]生图[：:]([\s\S]*?)[】\]]/g, '').trim();
      if (content) {
        g.history.push({
          role: 'assistant',
          speakerId: card.id,
          name: card.name,
          avatar: card.avatar || '',
          content: content,
          time: t,
          timestamp: baseTs + i * 1000
        });
      }
      if (generatedPrompt && canGroupGenerateForChar(card)) {
        try {
          const generated = await window.generateCharacterImage(generatedPrompt, {
            charId: card.id,
            saveToAlbum: true,
            sendToChat: false
          });
          if (generated && generated.src) {
            g.history.push({
              role: 'assistant',
              speakerId: card.id,
              name: card.name,
              avatar: card.avatar || '',
              content: '[IMAGE:' + generated.src + ']',
              time: t,
              timestamp: baseTs + i * 1000 + 600,
              fromAlbum: true,
              fromGenerated: true,
              albumPhotoId: generated.photo && generated.photo.id || ''
            });
          }
        } catch (e) {
          console.warn('[GroupProactive] 生图失败：', card.name, e);
        }
      }
    }
    g.updatedAt = Date.now();
    save();

    if (activeGroup) {
      if (typeof renderGroupHistory === 'function') renderGroupHistory(g);
    } else if (typeof window.renderWechatSessions === 'function') {
      window.renderWechatSessions();
    }
    if (typeof window.showReplyArrivalToast === 'function') {
      const last = items[items.length - 1];
      const card = selected.filter(c => c.id === last.speakerId)[0] || selected[0];
      if (card) {
        window.showReplyArrivalToast(last.content, { groupId: g.id, senderName: card.name, avatarUrl: card.avatar || '' });
      }
    }
    if (typeof window.onGroupProactiveMessageSent === 'function') {
      try {
        window.onGroupProactiveMessageSent({
          groupId: g.id,
          name: g.name,
          count: items.length,
          preview: items[0] ? items[0].content : ''
        });
      } catch (e) {}
    }
    if (opts.isManualTest) toast('「' + (g.name || '群聊') + '」已经有人冒泡了，回群里看');
    console.log('[GroupProactive] ' + (g.name || g.id) + ' 生成 ' + items.length + ' 条');
    return true;
  }

  async function runGroupProactiveSweep(reason) {
    if (groupProactiveRunning || busy || groupTimeGapGenerating) return;
    if (!app().apiKey || !app().apiBase) return;
    const groups = allGroups();
    const now = Date.now();
    const candidates = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const ps = getGroupProactive(g.id);
      if (!ps.bgActive) continue;
      // 正在看的群不插“主动冒泡”，避免和用户刚发的消息撞在一起。
      if (window.__groupMode === g.id) continue;
      if (isGroupDndNow(ps)) continue;
      if (!groupProactiveMembers(g, ps).length) continue;
      const plan = getGroupTimeGapPlan(g.id);
      const gapGuard = (plan && plan.mode === 'lost' && plan.batchId)
        ? (Number(plan.updatedAt) || Number(plan.detectedAt) || 0)
        : 0;
      const effectiveAt = Math.max(groupProactiveLastAt(g), gapGuard);
      const intervalMs = ps.bgIntervalUnit === 'minutes'
        ? (Math.max(1, parseInt(ps.bgIntervalVal, 10) || 1) * 60 * 1000)
        : (Math.max(1, parseInt(ps.bgIntervalVal, 10) || 1) * 3600 * 1000);
      if (now - effectiveAt >= intervalMs) candidates.push({ id: g.id, at: effectiveAt, name: g.name || g.id });
    }
    if (!candidates.length) return;

    candidates.sort((a, b) => a.at - b.at);
    console.log('[GroupProactive] 到点群聊:', candidates.map(c => c.name + '(' + c.id + ')').join('、'));
    groupProactiveRunning = true;
    try {
      for (let i = 0; i < candidates.length; i++) {
        try {
          await performGroupProactiveSend(candidates[i].id, { isManualTest: false });
        } catch (e) {
          console.warn('[GroupProactive] ' + candidates[i].name + ' 发送失败:', e);
        }
        if (busy || groupTimeGapGenerating) break;
      }
    } finally {
      groupProactiveRunning = false;
      const g = settingsGroup();
      if (g) renderGroupProactiveUI(g);
    }
  }

  window.checkGroupProactive = function () {
    return runGroupProactiveSweep('heartbeat');
  };
  window.runGroupProactiveSweep = runGroupProactiveSweep;
  window.renderGroupProactiveUI = renderGroupProactiveUI;

  setInterval(runGroupProactiveSweep, 60 * 1000);
  setTimeout(function () { runGroupProactiveSweep('startup'); }, 1600);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') runGroupProactiveSweep('visible');
  });
  window.addEventListener('focus', function () { runGroupProactiveSweep('focus'); });

  window.checkGroupTimeGap = checkGroupTimeGap;
  window.closeGroupTimeGapModal = closeGroupTimeGapModal;
  window.openGroupTimeGapMembers = openGroupTimeGapMembers;
  window.closeGroupTimeGapMembers = closeGroupTimeGapMembers;
  window.applyGroupTimeGapMode = applyGroupTimeGapMode;
  window.applyGroupTimeGapLost = applyGroupTimeGapLost;
  window.regenerateGroupTimeGapBatch = regenerateGroupTimeGapBatch;
  window.renderGroupTimeGapUI = renderGroupTimeGapUI;

  // ----- 成员网格 -----
  window.filterGroupMembers = function (q) {
    memberQuery = (q || '').trim();
    const g = settingsGroup();
    if (g) renderMemberGrid(g);
  };

  function memberTile(m, g) {
    const isMe = m.isMe;
    const role = groupRoleOf(g, m.id);
    const muted = !isMe && groupIsMuted(g, m.id);
    const title = groupTitleOf(g, m.id);
    const roleBadge = role
      ? '<span class="wx-member-role-badge is-' + role + '">' + (role === 'owner' ? '群主' : '管理员') + '</span>'
      : '';
    const muteBadge = muted ? '<span class="wx-member-mute-badge">禁言</span>' : '';
    const titleBadge = title ? '<span class="wx-member-title">' + groupEsc(title) + '</span>' : '';
    const minus = isMe ? '' :
      '<button type="button" class="wx-member-minus" title="移出群聊" onclick="event.stopPropagation();removeGroupMember(\'' + m.id + '\')">−</button>';
    return '<div class="wx-member-tile' + (muted ? ' is-muted' : '') + '">' +
      '<div class="wx-member-avatar-wrap">' +
        '<img src="' + (m.avatar || FB) + '" alt="" onclick="' + (isMe ? '' : 'openCharacterEditor(\'' + m.id + '\')') + '" />' +
        roleBadge + muteBadge + minus +
      '</div>' +
      '<span class="wx-member-name">' + (isMe ? '我' : m.name) + '</span>' +
      titleBadge +
    '</div>';
  }

  function renderGroupRoles(g) {
    const box = document.getElementById('wx-group-role-list');
    if (!box) return;
    const ms = memberList(g);
    const owner = ms.filter(m => m.id === groupOwnerId(g))[0];
    const summary = document.getElementById('wx-group-role-summary');
    if (summary) summary.innerText = '群主：' + ((owner && (owner.isMe ? '我' : owner.name)) || '我');
    box.innerHTML = ms.map(function (m) {
      const isMe = m.isMe;
      const isOwner = m.id === groupOwnerId(g);
      const isAdmin = groupAdminIds(g).indexOf(m.id) >= 0;
      const muted = !isMe && groupIsMuted(g, m.id);
      const title = groupTitleOf(g, m.id);
      const roleText = isOwner ? '群主' : (isAdmin ? '管理员' : (isMe ? '我' : '普通成员'));
      let actions = '<button type="button" class="wx-role-btn' + (title ? ' is-on' : '') + '" onclick="openGroupTitleEditor(\'' + m.id + '\')">' + (title ? '改头衔' : '头衔') + '</button>';
      if (!isOwner) {
        if (!isMe) {
          actions += '<button type="button" class="wx-role-btn" onclick="setGroupOwner(\'' + m.id + '\')">设群主</button>';
          actions += '<button type="button" class="wx-role-btn' + (isAdmin ? ' is-on' : '') + '" onclick="toggleGroupAdmin(\'' + m.id + '\')">' + (isAdmin ? '撤管理员' : '管理员') + '</button>';
          actions += '<button type="button" class="wx-role-btn' + (muted ? ' is-danger' : '') + '" onclick="toggleGroupMute(\'' + m.id + '\')">' + (muted ? '解除禁言' : '禁言') + '</button>';
        } else {
          actions += '<button type="button" class="wx-role-btn" onclick="setGroupOwner(\'' + m.id + '\')">设群主</button>';
        }
      }
      return '<div class="wx-group-role-row' + (muted ? ' is-muted' : '') + '">' +
        '<img src="' + (m.avatar || FB) + '" alt="" class="wx-group-role-avatar" />' +
        '<div class="wx-group-role-main">' +
          '<div class="wx-group-role-name">' + (isMe ? '我' : (m.name || '成员')) +
            (isOwner ? '<span class="wx-role-pill is-owner">群主</span>' : '') +
            (isAdmin ? '<span class="wx-role-pill is-admin">管理员</span>' : '') +
            (muted ? '<span class="wx-role-pill is-muted">禁言</span>' : '') +
            (title ? '<span class="wx-role-pill is-title">' + groupEsc(title) + '</span>' : '') +
          '</div>' +
          '<div class="wx-group-role-sub">' + roleText + (m.tag ? ' · ' + m.tag : '') + '</div>' +
        '</div>' +
        '<div class="wx-group-role-actions">' + actions + '</div>' +
      '</div>';
    }).join('') || '<div class="wx-rel-empty">群里还没成员。</div>';
  }

  window.openGroupTitleEditor = function (id) {
    const g = settingsGroup();
    if (!g || g.members.indexOf(id) < 0) return;
    const modal = document.getElementById('wx-group-title-modal');
    const input = document.getElementById('wx-group-title-input');
    const target = document.getElementById('wx-group-title-target');
    if (!modal || !input) {
      toast('头衔面板还没加载好，刷新一下页面');
      return;
    }
    window.__groupTitleTargetId = id;
    if (target) target.innerText = '给「' + groupMemberName(g, id) + '」设一个群头衔';
    input.value = groupTitleOf(g, id);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      try { input.focus(); input.select(); } catch (e) {}
    }, 80);
  };

  window.closeGroupTitleEditor = function () {
    const modal = document.getElementById('wx-group-title-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    window.__groupTitleTargetId = '';
  };

  window.clearGroupTitle = function () {
    const g = settingsGroup();
    const id = window.__groupTitleTargetId;
    if (!g || !id || !groupTitleOf(g, id)) {
      window.closeGroupTitleEditor();
      return;
    }
    if (g.titles && typeof g.titles === 'object') delete g.titles[id];
    pushGroupGovNotice(g, '「' + groupMemberName(g, id) + '」的群头衔已清除');
    save();
    renderGroupRoles(g);
    renderMemberGrid(g);
    refreshGroupAfterGov(g);
    window.closeGroupTitleEditor();
    toast('已清除群头衔');
  };

  window.saveGroupTitle = function () {
    const g = settingsGroup();
    const id = window.__groupTitleTargetId;
    const input = document.getElementById('wx-group-title-input');
    if (!g || !id || !input) return;
    const next = String(input.value || '').trim().slice(0, 12);
    const old = groupTitleOf(g, id);
    if (next === old) {
      window.closeGroupTitleEditor();
      return;
    }
    if (!g.titles || typeof g.titles !== 'object') g.titles = {};
    if (next) g.titles[id] = next;
    else delete g.titles[id];
    pushGroupGovNotice(g, next
      ? '「' + groupMemberName(g, id) + '」的群头衔改为「' + next + '」'
      : '「' + groupMemberName(g, id) + '」的群头衔已清除');
    save();
    renderGroupRoles(g);
    renderMemberGrid(g);
    refreshGroupAfterGov(g);
    window.closeGroupTitleEditor();
    toast(next ? '群头衔已更新' : '群头衔已清除');
  };

  window.setGroupOwner = function (id) {
    const g = settingsGroup();
    if (!g || g.members.indexOf(id) < 0) return;
    const old = groupOwnerId(g);
    if (old === id) return;
    const newName = groupMemberName(g, id);
    g.ownerId = id;
    g.adminIds = groupAdminIds(g).filter(x => x !== id);
    g.mutedIds = groupMutedIds(g).filter(x => x !== id);
    pushGroupGovNotice(g, '「' + newName + '」成为新群主');
    save();
    renderGroupRoles(g);
    renderMemberGrid(g);
    refreshGroupAfterGov(g);
    toast('群主已转给' + newName);
  };

  window.toggleGroupAdmin = function (id) {
    const g = settingsGroup();
    if (!g || id === 'me' || id === groupOwnerId(g) || g.members.indexOf(id) < 0) return;
    const list = groupAdminIds(g);
    const name = groupMemberName(g, id);
    if (list.indexOf(id) >= 0) {
      g.adminIds = list.filter(x => x !== id);
      pushGroupGovNotice(g, '「' + name + '」被取消管理员');
    } else {
      g.adminIds = list.concat([id]);
      g.mutedIds = groupMutedIds(g).filter(x => x !== id);
      pushGroupGovNotice(g, '「' + name + '」被设为本群管理员');
    }
    save();
    renderGroupRoles(g);
    renderMemberGrid(g);
    refreshGroupAfterGov(g);
  };

  window.toggleGroupMute = function (id) {
    const g = settingsGroup();
    if (!g || id === 'me' || id === groupOwnerId(g) || g.members.indexOf(id) < 0) {
      toast('群主不能被禁言');
      return;
    }
    const list = groupMutedIds(g);
    if (list.indexOf(id) >= 0) g.mutedIds = list.filter(x => x !== id);
    else g.mutedIds = list.concat([id]);
    save();
    renderGroupRoles(g);
    renderMemberGrid(g);
    const target = memberList(g).filter(m => m.id === id)[0];
    toast((g.mutedIds.indexOf(id) >= 0 ? '已禁言' : '已解除禁言') + ((target && target.name) || '该成员'));
  };

  function renderMemberGrid(g) {
    const grid = document.getElementById('wx-group-member-grid');
    if (!grid) return;
    const ms = memberList(g);
    const shown = memberQuery ? ms.filter(m => (m.name || '').indexOf(memberQuery) >= 0) : ms;
    const add = '<button type="button" class="wx-member-tile wx-member-add" onclick="openGroupMemberPicker()">' +
      '<span class="wx-member-add-box"><i>＋</i></span><span class="wx-member-name">添加</span></button>';
    grid.innerHTML = shown.map(m => memberTile(m, g)).join('') + add;
    const cnt = document.getElementById('group-member-count');
    if (cnt) cnt.innerText = ms.length + ' 人（含我）';
  }

  window.openGroupMemberPicker = function () {
    const g = settingsGroup();
    if (!g) return;
    const list = document.getElementById('wx-group-member-picker-list');
    const mask = document.getElementById('wx-group-member-picker');
    if (!list || !mask) return;
    const cand = cards().filter(c => g.members.indexOf(c.id) < 0);
    list.innerHTML = cand.length ? cand.map(c =>
      '<button type="button" class="wx-picker-row" onclick="addGroupMember(\'' + c.id + '\')">' +
        '<img src="' + (c.avatar || FB) + '" alt="" />' +
        '<span class="wx-picker-main"><b>' + c.name + '</b><i>' + (c.tag || '角色') + (c.intro ? ' · ' + c.intro : '') + '</i></span>' +
        '<span class="wx-picker-act">拉进群</span>' +
      '</button>').join('') :
      '<div class="wx-picker-empty">通讯录里的卡都在群里了。先去通讯录加新角色。</div>';
    mask.classList.add('show');
  };

  window.closeGroupMemberPicker = function () {
    const mask = document.getElementById('wx-group-member-picker');
    if (mask) mask.classList.remove('show');
  };

  window.addGroupMember = function (id) {
    const g = settingsGroup();
    const c = findCard(id);
    if (!g || !c) return;
    if (g.members.indexOf(id) >= 0) { toast('已经在群里了'); return; }
    g.members.push(id);
    if (!g.settings.limits[id]) g.settings.limits[id] = { min: DEFAULT_MIN, max: DEFAULT_MAX };
    save();
    closeGroupMemberPicker();
    renderMemberGrid(g);
    renderGroupRoles(g);
    renderLimits(g);
    toast('已把「' + c.name + '」拉进群');
  };

  window.removeGroupMember = function (id) {
    const g = settingsGroup();
    const c = findCard(id);
    if (!g || !c) return;
    if (charMembers(g).length <= 2) { toast('群至少留两张角色卡，再移就没人接话了'); return; }
    if (!confirm('把「' + c.name + '」移出这个群？\n群里已有的聊天记录不会删。')) return;
    g.members = g.members.filter(x => x !== id);
    g.adminIds = groupAdminIds(g).filter(x => x !== id);
    g.mutedIds = groupMutedIds(g).filter(x => x !== id);
    if (g.titles && typeof g.titles === 'object') delete g.titles[id];
    if (groupOwnerId(g) === id) g.ownerId = 'me';
    delete g.settings.limits[id];
    save();
    renderMemberGrid(g);
    renderGroupRoles(g);
    renderLimits(g);
    toast('已移出「' + c.name + '」');
  };

  // ----- 人物关系 -----
  function relRowHtml(g, r) {
    const opts = o => memberList(g).map(m =>
      '<option value="' + m.id + '"' + ((r && ((o === 'a' ? r.a : r.b) === m.id)) ? ' selected' : '') + '>' + (m.isMe ? '我' : m.name) + '</option>').join('');
    return '<div class="wx-rel-row">' +
      '<select class="wx-rel-select wx-grel-a">' + opts('a') + '</select>' +
      '<input class="wx-rel-label" type="text" maxlength="12" placeholder="关系，如 情侣 / 死对头" value="' + ((r && r.label) || '').replace(/"/g, '&quot;') + '" />' +
      '<select class="wx-rel-select wx-grel-b">' + opts('b') + '</select>' +
      '<button type="button" class="wx-rel-del" onclick="this.parentNode.remove()">×</button>' +
    '</div>';
  }

  function renderRelations(g) {
    const box = document.getElementById('wx-group-rel-rows');
    if (!box) return;
    const rows = g.settings.relations || [];
    box.innerHTML = rows.length ? rows.map(r => relRowHtml(g, r)).join('') :
      '<div class="wx-rel-empty">还没写群里的关系。点下面「加一条」。</div>';
  }

  window.addGroupRelationRow = function () {
    const g = settingsGroup();
    const box = document.getElementById('wx-group-rel-rows');
    if (!g || !box) return;
    if (box.querySelector('.wx-rel-empty')) box.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = relRowHtml(g, { a: g.members[0], b: g.members[1] || 'me', label: '' });
    box.appendChild(wrap.firstChild);
  };

  function readGroupRelations() {
    const rows = Array.prototype.slice.call(document.querySelectorAll('#wx-group-rel-rows .wx-rel-row'));
    const out = [];
    rows.forEach(r => {
      const a = r.querySelector('.wx-grel-a');
      const b = r.querySelector('.wx-grel-b');
      const label = r.querySelector('.wx-rel-label');
      const av = a ? a.value : '';
      const bv = b ? b.value : '';
      const lv = label ? label.value.trim() : '';
      if (av && bv && av !== bv && lv) out.push({ a: av, b: bv, label: lv });
    });
    return out;
  }

  // ----- 每人条数上下限 -----
  function renderLimits(g) {
    const box = document.getElementById('wx-group-limits');
    if (!box) return;
    const members = charMembers(g);
    box.innerHTML = members.length ? members.map(m => {
      const l = limitOf(g, m.id);
      return '<div class="wx-limit-row">' +
        '<img src="' + (m.avatar || FB) + '" alt="" />' +
        '<span class="wx-limit-name">' + m.name + '</span>' +
        '<input type="number" class="wx-limit-input" min="1" max="6" value="' + l.min + '" onchange="setGroupLimit(\'' + m.id + '\',\'min\',this.value)" />' +
        '<span class="wx-limit-dash">–</span>' +
        '<input type="number" class="wx-limit-input" min="1" max="6" value="' + l.max + '" onchange="setGroupLimit(\'' + m.id + '\',\'max\',this.value)" />' +
        '<span class="wx-limit-unit">条/轮</span>' +
      '</div>';
    }).join('') : '<div class="wx-rel-empty">群里还没角色。</div>';
    const cap = document.getElementById('group-round-cap-input');
    if (cap) cap.value = clamp((parseInt(g.settings.roundCap, 10) || ROUND_MSG_CAP), 1, 6);
  }

  window.setGroupRoundCap = function (value) {
    const g = settingsGroup();
    if (!g) return;
    g.settings.roundCap = clamp(value, 1, 6);
    save();
    renderLimits(g);
  };

  window.setGroupLimit = function (id, which, value) {
    const g = settingsGroup();
    if (!g || !findCard(id)) return;
    if (!g.settings.limits[id]) g.settings.limits[id] = { min: DEFAULT_MIN, max: DEFAULT_MAX };
    const l = g.settings.limits[id];
    const n = clamp(value, 1, 6);
    if (which === 'min') {
      l.min = n;
      if (l.max < n) l.max = n;
    } else {
      l.max = n;
      if (l.min > n) l.min = n;
    }
    save();
    renderLimits(g);
  };

  window.setGroupSummaryEvery = function (value) {
    const g = settingsGroup();
    if (!g) return;
    g.settings.summaryEvery = clamp(value, 2, 100);
    save();
    const el = document.getElementById('group-summary-every');
    if (el) el.value = g.settings.summaryEvery;
  };

  // ----- 世界书 -----
  function renderWorldBooks(g) {
    const box = document.getElementById('wx-group-worldbooks');
    if (!box) return;
    const books = app().worldBooks || [];
    box.innerHTML = books.length ? books.map(b => {
      const rec = (g.settings.wb.books || {})[b.id];
      const on = rec ? rec.enabled !== false : true;
      const scope = b.scope || 'all';
      const hidden = scope === 'single';
      return '<div class="wx-gwb-row' + (hidden ? ' is-off-scope' : '') + '">' +
        '<div class="wx-gwb-main">' +
          '<span class="wx-gwb-title">' + (b.title || '未命名世界书') + '</span>' +
          '<span class="wx-gwb-sub">' + ((b.entries || []).length) + ' 条 · ' + (window.WB ? window.WB.recipientLabel(b) + ' · ' : '') + (hidden ? '仅单人聊天生效' : (scope === 'group' ? '仅群聊生效' : '单聊 / 群聊都生效')) + '</span>' +
        '</div>' +
        '<select class="wx-gwb-scope" onchange="setGroupWbScope(\'' + b.id + '\',this.value)">' +
          '<option value="all"' + (scope === 'all' ? ' selected' : '') + '>都生效</option>' +
          '<option value="single"' + (scope === 'single' ? ' selected' : '') + '>仅单人</option>' +
          '<option value="group"' + (scope === 'group' ? ' selected' : '') + '>仅群聊</option>' +
        '</select>' +
        '<div class="ios-toggle-switch' + (on ? ' active' : '') + '" onclick="toggleGroupWb(\'' + b.id + '\')"><div class="ios-toggle-thumb"></div></div>' +
      '</div>';
    }).join('') : '<div class="wx-rel-empty">还没有世界书。去聊天设定里的「世界书开关」建一本。</div>';
  }

  window.toggleGroupWb = function (id) {
    const g = settingsGroup();
    if (!g) return;
    if (!g.settings.wb.books) g.settings.wb.books = {};
    if (!g.settings.wb.books[id]) g.settings.wb.books[id] = { enabled: true };
    g.settings.wb.books[id].enabled = !(g.settings.wb.books[id].enabled !== false);
    save();
    renderWorldBooks(g);
  };

  window.setGroupWbScope = function (id, scope) {
    const books = app().worldBooks || [];
    const b = books.filter(x => x.id === id)[0];
    if (!b) return;
    b.scope = scope === 'single' || scope === 'group' ? scope : 'all';
    try { localStorage.setItem('momo_world_books', JSON.stringify(books)); } catch (e) {}
    const g = settingsGroup();
    if (g) renderWorldBooks(g);
    toast('世界书作用域已改成：' + (b.scope === 'single' ? '仅单人' : (b.scope === 'group' ? '仅群聊' : '都生效')));
  };

  // ----- 记忆卡片（群设定与记忆宫殿共用同一批卡） -----
  function renderMemory(g) {
    const box = document.getElementById('wx-group-memory-list');
    if (!box) return;
    let cards = [];
    try {
      if (window.getPalaceCardsFor) cards = window.getPalaceCardsFor('group', g.id) || [];
    } catch (e) {}
    if (!cards.length) {
      cards = (g.settings.memory || []).map(m => ({
        id: m.id,
        summary: m.text,
        dateStr: m.date,
        source: m.source === 'ai' ? 'group-ai' : 'group-user',
        level: 0
      }));
    }
    cards = cards.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    box.innerHTML = cards.length ? cards.map(c => {
      const isUser = c.source === 'group-user';
      const layer = (window.MemoryEngine && window.MemoryEngine.layerOf)
        ? window.MemoryEngine.layerOf(c)
        : ((c.level || 0) >= 2 ? 'core' : ((c.level || 0) === 1 ? 'mid' : 'short'));
      let tagText;
      if (c.ownerCharName) tagText = c.ownerCharName + '的片段';
      else if (layer === 'core') tagText = '核心印记';
      else if (layer === 'mid') tagText = '中期总结';
      else tagText = isUser ? '我写的' : '群编年史';
      const tagClass = isUser ? 'is-user' : 'is-ai';
      return '<div class="wx-memory-item">' +
        '<div class="wx-memory-meta">' +
          '<span class="wx-memory-tag ' + tagClass + '">' + String(tagText).replace(/</g, '&lt;') + '</span>' +
          (c.title ? '<span class="wx-memory-date">' + String(c.title).replace(/</g, '&lt;') + '</span>' : '') +
          '<span class="wx-memory-date">' + String(c.dateStr || '').replace(/</g, '&lt;') + '</span>' +
          '<button type="button" class="wx-memory-del" onclick="deleteGroupMemory(\'' + c.id + '\')">×</button>' +
        '</div>' +
        '<div class="wx-memory-text">' + String(c.summary || c.content || '').replace(/</g, '&lt;') + '</div>' +
      '</div>';
    }).join('') : '<div class="wx-rel-empty">还没有记忆。可以自己写一条，或者聊够轮数让 AI 总结。</div>';
    const count = document.getElementById('group-round-count');
    if (count) count.innerText = (g.roundCount || 0) + ' 轮';
  }

  window.addGroupMemory = function () {
    const g = settingsGroup();
    const input = document.getElementById('group-memory-input');
    if (!g || !input) return;
    const text = (input.value || '').trim();
    if (!text) return;
    if (window.palaceAddGroupCard) {
      window.palaceAddGroupCard(g, text, 'user');
    } else {
      g.settings.memory.push({ id: 'gm-' + Date.now().toString(36), source: 'user', text: text, date: todayStr() });
      save();
    }
    input.value = '';
    renderMemory(g);
    toast('记下了');
  };

  window.deleteGroupMemory = function (id) {
    const g = settingsGroup();
    if (!g) return;
    if (window.palaceRemoveCard) {
      window.palaceRemoveCard(id);
    }
    g.settings.memory = (g.settings.memory || []).filter(m => m.id !== id);
    save();
    renderMemory(g);
    if (typeof window.renderPalaceMemories === 'function') {
      try { window.renderPalaceMemories(); } catch (e) {}
    }
  };

  window.groupSummarizeNow = async function () {
    const g = settingsGroup();
    if (!g) return;
    try {
      await summarizeGroup(g, true);
      renderMemory(g);
    } catch (e) {
      toast('总结失败：' + e.message);
    }
  };

  async function summarizeGroup(g, manual) {
    if (!g.history.length) { if (manual) toast('还没聊天，没什么可总结的'); return; }
    let start = Math.max(0, g.history.length - 60);
    const cursor = parseInt(g.settings.summaryCursor, 10) || 0;
    if (!manual && cursor > 0 && cursor < g.history.length) start = Math.max(start, cursor);
    if (start >= g.history.length) return;
    const slice = g.history.slice(start);
    const text = slice.map(m =>
      (m.role === 'user' ? meName(g) : (m.name || '成员')) + '：' + messageTextForAi(m)).join('\n');
    const speakers = [];
    slice.forEach(m => {
      if (m.role === 'assistant' && m.name && speakers.indexOf(m.name) < 0) speakers.push(m.name);
    });
    const memberNames = memberList(g).map(m => m.isMe ? meName(g) : m.name);
    const raw = await callModel([
      { role: 'system', content: '你是群聊的记忆引擎。你要同时产出两样东西：一份“群视角编年史”，以及每个在场成员“自己视角下只与他有关的片段”。不要写成客服总结，不要编造聊天里没有的事。只输出 JSON，不要解释。' },
      { role: 'user', content: '群名：' + g.name + '\n成员：' + memberNames.join('、') + '\n本次发言的成员：' + (speakers.join('、') || '无') + '\n\n聊天记录：\n' + text + '\n\n严格输出：{"chronicle":"群视角编年史，写清谁说了什么、谁对谁有反应、关系和约定怎么变化，3到5句，不超过180字","importance":3,"members":[{"name":"成员名","fragment":"从这个成员自己的视角，只写他参与/看见/感受到的事，以及他对某人的新认知，1到2句，不超过70字","importance":3}]}\nimportance 用 1 到 5：5 是会影响很久的核心变化，4 是这段时间的模式，3 以下只是近期小事。members 只包含本次真正发言的成员；没有发言的成员不要出现。' }
    ], 700, 0.35);
    const cleanRaw = String(raw || '').replace(/```json/gi, '```').replace(/```/g, '').trim();
    const parsed = parseLoose(raw);
    const chronicle = (parsed && parsed.chronicle ? String(parsed.chronicle) : cleanRaw).trim();
    if (!chronicle) return;
    const layerFor = n => (n >= 5 ? 'core' : (n >= 4 ? 'mid' : 'short'));
    const gImportance = (parsed && parseInt(parsed.importance, 10)) || 3;
    g.settings.summaryCursor = g.history.length;
    const added = [];
    if (window.palaceAddGroupCard) {
      window.palaceAddGroupCard(g, chronicle.slice(0, 900), 'ai', { layer: layerFor(gImportance), source: 'auto-group' });
      const members = (parsed && Array.isArray(parsed.members)) ? parsed.members : [];
      members.forEach(item => {
        if (!item || !item.name || !item.fragment) return;
        const name = String(item.name).trim();
        const card = memberList(g).find(m => !m.isMe && m.name === name) ||
          memberList(g).find(m => !m.isMe && (m.name.indexOf(name) >= 0 || name.indexOf(m.name) >= 0));
        if (!card) return;
        window.palaceAddGroupCard(g, String(item.fragment).slice(0, 260), 'ai', {
          ownerCharId: card.id,
          ownerCharName: card.name,
          layer: layerFor(parseInt(item.importance, 10) || 3),
          source: 'auto-group-member'
        });
        added.push(card.name);
      });
    } else {
      g.settings.memory.push({
        id: 'gm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        source: 'ai',
        text: chronicle.slice(0, 900),
        date: todayStr()
      });
    }
    save();
    if (manual) {
      toast('已总结进记忆宫殿' + (added.length ? '（含 ' + added.join('、') + ' 的个人片段）' : ''));
      if (typeof window.renderPalaceMemories === 'function') {
        try { window.renderPalaceMemories(); } catch (e) {}
      }
    }
  }

  function todayStr() {
    const d = new Date();
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  // 聊天页头部：群聊进群设定，单聊保持原行为
  window.openChatHeaderPanel = function () {
    if (window.__groupMode) { window.openGroupSettings(); return; }
    if (typeof window.getActiveCharacter === 'function') {
      const c = window.getActiveCharacter();
      if (c) { openCharacterEditor(c.id); return; }
    }
    openPage('page-char-setting');
  };
  window.openChatMore = function () {
    if (window.__groupMode) { window.openGroupSettings(); return; }
    openPage('page-chat-setting');
  };

  // 群会话行的最后一条消息预览
  window.groupPreview = function (g) {
    const last = (g.history || []).slice(-1)[0];
    if (!last) return '群聊已建好 · 点开看成员';
    const who = last.role === 'user' ? '我' : (last.name || '成员');
    return who + '：' + String(last.content || '').replace(/\n/g, ' ').slice(0, 18);
  };

  // 本文件晚于 characters.js 加载：补一次会话列表，让群行显示最后一条消息
  if (typeof window.renderWechatSessions === 'function') window.renderWechatSessions();
})();
