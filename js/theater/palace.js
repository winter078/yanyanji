// 记忆宫殿与世界图书阁 (Bookshelf & Memory Palace)
    // ================= 世界图书架模式 (Bookshelf UI) 完整逻辑 =================
    let currentViewingBookId = null;
    let editingBookId = null;
    let editingEntryId = null;

    function renderWorldBookshelf() {
      const grid = document.getElementById('world-books-grid');
      if (!grid) return;
      grid.innerHTML = '';

      if (!appData.worldBooks || appData.worldBooks.length === 0) {
        grid.innerHTML = '<div class="text-muted" style="grid-column: span 2; text-align: center; padding: 30px 10px;">书架空空的，点击右上角「+ 新建书卷」放上第一本书吧~</div>';
        return;
      }

      appData.worldBooks.forEach(book => {
        const item = document.createElement('div');
        item.className = 'book-shelf-item';
        item.style.userSelect = 'none';
        item.onclick = () => openBookDetail(book.id);

        const color = book.color || '#8b5cf6';
        item.innerHTML = `
          <div class="book-spine-line" style="background: ${color};"></div>
          <div>
            <div class="book-badge-tag" style="border-left: 3px solid ${color};">${book.entries ? book.entries.length : 0} 条规则</div>
            <div class="book-title-main" style="pointer-events: none;">${book.title}</div>
            <div class="book-desc-sub" style="pointer-events: none;">${book.desc || '专属记忆与约束书卷'}</div>
          </div>
          <div style="margin-top: 10px;">
            <button class="book-act-btn primary" style="width: 100%; justify-content: center; padding: 7px 0; font-size: 12px;" onclick="event.stopPropagation(); openBookDetail('${book.id}')">📖 翻开书卷 · 编辑内容</button>
            <div class="book-footer-meta" style="margin-top: 6px;" onclick="event.stopPropagation()">
              <button class="book-act-btn" onclick="openEditBookModal('${book.id}')" title="修改书名与简介">✎ 修改本书</button>
              <button class="book-act-btn danger" onclick="deleteBook('${book.id}')" title="移除书卷">✕ 移除</button>
            </div>
          </div>
        `;
        grid.appendChild(item);
      });
    }

    function openBookDetail(bookId) {
      currentViewingBookId = bookId;
      const book = (appData.worldBooks || []).find(b => b.id === bookId);
      if (!book) return;

      document.getElementById('world-bookshelf-wrapper').style.display = 'none';
      const detailWrap = document.getElementById('world-book-detail-wrapper');
      detailWrap.style.display = 'flex';

      document.getElementById('book-detail-header-title').innerText = book.title;
      const metaCard = document.getElementById('book-detail-meta-card');
      const color = book.color || '#8b5cf6';
      metaCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="text-primary" style="font-size: 16px; font-weight: 800;">${book.title}</div>
            <div class="text-secondary" style="font-size: 12px; margin-top: 4px;">${book.desc || '专属羁绊书卷'}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="book-act-btn" onclick="openEditBookModal('${book.id}')">✎ 修改本书</button>
            <div class="book-badge-tag" style="background: ${color}33; color: ${color}; border: 1px solid ${color}66;">${book.entries ? book.entries.length : 0} 条规则</div>
          </div>
        </div>
      `;

      const listEl = document.getElementById('book-entries-list');
      listEl.innerHTML = '';

      if (!book.entries || book.entries.length === 0) {
        listEl.innerHTML = '<div class="text-muted" style="text-align: center; padding: 30px 10px;">书中还没有词条，点击右上角「+ 添加词条」写下专属设定吧~</div>';
        return;
      }

      book.entries.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'entry-card-item';
        card.innerHTML = `
          <div class="entry-card-top">
            <span class="entry-card-title">📌 ${entry.title}</span>
            <div style="display: flex; gap: 6px;">
              <button class="book-act-btn primary" onclick="openEditEntryModal('${entry.id}')">✎ 编辑内容</button>
              <button class="book-act-btn danger" onclick="deleteEntry('${entry.id}')">✕</button>
            </div>
          </div>
          <div class="entry-card-content">${entry.content}</div>
        `;
        listEl.appendChild(card);
      });
    }

    function backToBookshelf() {
      document.getElementById('world-book-detail-wrapper').style.display = 'none';
      document.getElementById('world-bookshelf-wrapper').style.display = 'flex';
      renderWorldBookshelf();
    }

    function openCreateBookModal() {
      editingBookId = null;
      document.getElementById('modal-world-book-title').innerText = '新建世界书卷';
      document.getElementById('input-book-title').value = '';
      document.getElementById('input-book-desc').value = '';
      document.getElementById('input-book-initial-entry').value = '';
      document.getElementById('group-initial-entry').style.display = 'flex';
      document.getElementById('modal-world-book').classList.add('open');
    }

    function openEditBookModal(bookId) {
      editingBookId = bookId;
      const book = (appData.worldBooks || []).find(b => b.id === bookId);
      if (!book) return;

      document.getElementById('modal-world-book-title').innerText = '修改书卷信息';
      document.getElementById('input-book-title').value = book.title || '';
      document.getElementById('input-book-desc').value = book.desc || '';
      document.getElementById('group-initial-entry').style.display = 'none';

      const colorRadios = document.getElementsByName('book-color');
      for (let r of colorRadios) {
        r.checked = (r.value === book.color);
      }
      document.getElementById('modal-world-book').classList.add('open');
    }

    function closeCreateBookModal() {
      document.getElementById('modal-world-book').classList.remove('open');
    }

    function saveCreateBook() {
      const title = document.getElementById('input-book-title').value.trim();
      const desc = document.getElementById('input-book-desc').value.trim();
      const initEntry = (document.getElementById('input-book-initial-entry').value || '').trim();
      if (!title) {
        alert('书卷标题不能为空哦。');
        return;
      }

      const colorRadios = document.getElementsByName('book-color');
      let selectedColor = '#8b5cf6';
      for (let r of colorRadios) {
        if (r.checked) { selectedColor = r.value; break; }
      }

      if (!appData.worldBooks) appData.worldBooks = [];

      if (editingBookId) {
        // 修改已存在的书卷信息
        const b = appData.worldBooks.find(item => item.id === editingBookId);
        if (b) {
          b.title = title;
          b.desc = desc || '专属设定书卷';
          b.color = selectedColor;
        }
      } else {
        // 新建书卷
        const newEntries = [];
        if (initEntry) {
          newEntries.push({
            id: 'entry_' + Date.now(),
            title: title + ' · 核心设定',
            content: initEntry
          });
        }
        const newBook = {
          id: 'book_' + Date.now(),
          title,
          desc: desc || '专属设定书卷',
          color: selectedColor,
          entries: newEntries
        };
        appData.worldBooks.push(newBook);
      }

      localStorage.setItem('momo_world_books', JSON.stringify(appData.worldBooks)); if (typeof recordNeuralPulse === 'function') recordNeuralPulse('user在世界书里刻下了新的羁绊规则');
      closeCreateBookModal();

      if (editingBookId) {
        if (currentViewingBookId && editingBookId === currentViewingBookId) {
          openBookDetail(currentViewingBookId);
        } else {
          renderWorldBookshelf();
        }
        alert('书卷信息已更新！');
      } else {
        // 新建后直接翻开该书卷，方便user立刻编辑与添加更多词条
        const createdId = appData.worldBooks[appData.worldBooks.length - 1].id;
        openBookDetail(createdId);
        alert('「' + title + '」书卷已创建！已自动为你翻开本书，可以在此继续添加或修改词条规则~');
      }
    }

    function deleteBook(bookId) {
      if (confirm('确认将这本世界书从书架上移除吗？')) {
        appData.worldBooks = (appData.worldBooks || []).filter(b => b.id !== bookId);
        localStorage.setItem('momo_world_books', JSON.stringify(appData.worldBooks));
        renderWorldBookshelf();
      }
    }

    function openCreateEntryModal() {
      editingEntryId = null;
      document.getElementById('modal-world-entry-title').innerText = '添加规则词条';
      document.getElementById('input-entry-title').value = '';
      document.getElementById('input-entry-content').value = '';
      document.getElementById('modal-world-entry').classList.add('open');
    }

    function openEditEntryModal(entryId) {
      editingEntryId = entryId;
      const book = (appData.worldBooks || []).find(b => b.id === currentViewingBookId);
      if (!book) return;
      const entry = (book.entries || []).find(e => e.id === entryId);
      if (!entry) return;

      document.getElementById('modal-world-entry-title').innerText = '编辑规则词条';
      document.getElementById('input-entry-title').value = entry.title || '';
      document.getElementById('input-entry-content').value = entry.content || '';
      document.getElementById('modal-world-entry').classList.add('open');
    }

    function closeCreateEntryModal() {
      document.getElementById('modal-world-entry').classList.remove('open');
    }

    function saveCreateEntry() {
      const title = document.getElementById('input-entry-title').value.trim();
      const content = document.getElementById('input-entry-content').value.trim();
      if (!title || !content) {
        alert('词条名称和规则内容都得填上哦。');
        return;
      }

      const book = (appData.worldBooks || []).find(b => b.id === currentViewingBookId);
      if (!book) return;

      if (!book.entries) book.entries = [];

      if (editingEntryId) {
        // 编辑已有词条
        const e = book.entries.find(item => item.id === editingEntryId);
        if (e) {
          e.title = title;
          e.content = content;
        }
      } else {
        // 新增词条
        book.entries.push({
          id: 'entry_' + Date.now(),
          title,
          content
        });
      }

      localStorage.setItem('momo_world_books', JSON.stringify(appData.worldBooks));
      closeCreateEntryModal();
      openBookDetail(currentViewingBookId);
      alert('词条内容已成功更新并融入绪言大脑！');
    }

    function deleteEntry(entryId) {
      if (confirm('确认删除这条规则词条？')) {
        const book = (appData.worldBooks || []).find(b => b.id === currentViewingBookId);
        if (!book) return;
        book.entries = (book.entries || []).filter(e => e.id !== entryId);
        localStorage.setItem('momo_world_books', JSON.stringify(appData.worldBooks));
        openBookDetail(currentViewingBookId);
      }
    }

    // ================= 🏛️ 纯正暗黑系四大抽屉与多级递归记忆金字塔引擎 =================
    let currentPalaceTab = 'pen'; // 'pen' | 'wechat' | 'rp' | 'reader'
    let currentPalaceWechatScope = 'single'; // 'single' | 'group'
    let currentPalaceWechatTarget = '';
    let selectedPalaceCardIds = new Set();
    let editingCardTargetId = null;

    const PALACE_WECHAT_VIEW_KEY = 'momo_palace_wechat_view';

    let palaceConfig = {
      mode: 'traditional',
      autoSummary: true,
      freq: 300,
      autoEvery: 24,
      pointer: 0,
      minWords: 100,
      maxWords: 250,
      customPrompt: '',
      readCorePrompt: true,
      wechatTargets: {}
    };

    function loadPalaceConfig() {
      try {
        const saved = localStorage.getItem('momo_palace_config');
        if (saved) palaceConfig = Object.assign(palaceConfig, JSON.parse(saved));
        if (!palaceConfig.wechatTargets || typeof palaceConfig.wechatTargets !== 'object') {
          palaceConfig.wechatTargets = {};
        }
      } catch(e){}
    }
    loadPalaceConfig();
    loadPalaceWechatView();

    function persistPalaceConfig() {
      localStorage.setItem('momo_palace_config', JSON.stringify(palaceConfig));
    }

    function savePalaceConfig() {
      const freqInput = document.getElementById('input-palace-freq');
      const autoEvery = freqInput ? Math.max(6, Math.min(60, parseInt(freqInput.value, 10) || 24)) : (palaceConfig.autoEvery || 24);
      if (currentPalaceTab === 'wechat') {
        const key = palaceWechatTargetKey();
        palaceConfig.wechatTargets[key] = Object.assign({}, palaceConfig.wechatTargets[key], { autoEvery: autoEvery });
      } else {
        palaceConfig.autoEvery = autoEvery;
      }
      persistPalaceConfig();
    }

    function palaceCharacters() {
      try { return (window.getCharacters && window.getCharacters()) || []; } catch (e) { return []; }
    }

    function palaceGroups() {
      try { return (window.getGroups && window.getGroups()) || []; } catch (e) { return []; }
    }

    function palaceActiveCharId() {
      try {
        const c = window.getActiveCharacter && window.getActiveCharacter();
        if (c && c.id) return c.id;
      } catch (e) {}
      return localStorage.getItem('momo_active_char') || ((palaceCharacters()[0] || {}).id) || '';
    }

    function palaceCharById(id) {
      return palaceCharacters().filter(c => c.id === id)[0] || null;
    }

    function palaceGroupById(id) {
      return palaceGroups().filter(g => g.id === id)[0] || null;
    }

    function palaceWechatTargetKey(scope, targetId) {
      const s = scope || currentPalaceWechatScope;
      const id = targetId === undefined ? currentPalaceWechatTarget : targetId;
      return 'wechat:' + s + ':' + (id || '');
    }

    function palaceCurrentWechatName() {
      if (currentPalaceWechatScope === 'group') {
        const g = palaceGroupById(currentPalaceWechatTarget);
        return g ? g.name : '未选择群聊';
      }
      const c = palaceCharById(currentPalaceWechatTarget);
      return c ? c.name : '未选择角色';
    }

    function ensurePalaceWechatTarget() {
      if (currentPalaceWechatScope === 'group') {
        const groups = palaceGroups();
        if (!palaceGroupById(currentPalaceWechatTarget)) {
          currentPalaceWechatTarget = groups[0] ? groups[0].id : '';
        }
      } else {
        if (!palaceCharById(currentPalaceWechatTarget)) {
          currentPalaceWechatTarget = palaceActiveCharId();
        }
      }
    }

    function loadPalaceWechatView() {
      try {
        const saved = JSON.parse(localStorage.getItem(PALACE_WECHAT_VIEW_KEY) || 'null');
        if (saved && (saved.scope === 'single' || saved.scope === 'group')) {
          currentPalaceWechatScope = saved.scope;
          currentPalaceWechatTarget = saved.targetId || '';
        }
      } catch (e) {}
      ensurePalaceWechatTarget();
    }

    function persistPalaceWechatView() {
      try {
        localStorage.setItem(PALACE_WECHAT_VIEW_KEY, JSON.stringify({
          scope: currentPalaceWechatScope,
          targetId: currentPalaceWechatTarget
        }));
      } catch (e) {}
    }

    function palaceTargetConfig() {
      if (currentPalaceTab !== 'wechat') {
        return {
          pointer: palaceConfig.pointer || 0,
          freq: palaceConfig.freq || 300,
          autoEvery: parseInt(palaceConfig.autoEvery, 10) || 24,
          minWords: palaceConfig.minWords || 100,
          maxWords: palaceConfig.maxWords || 250,
          customPrompt: palaceConfig.customPrompt || ''
        };
      }
      const key = palaceWechatTargetKey();
      const rec = palaceConfig.wechatTargets[key] || {};
      return {
        pointer: parseInt(rec.pointer, 10) || 0,
        freq: parseInt(rec.freq, 10) || palaceConfig.freq || 300,
        autoEvery: parseInt(rec.autoEvery, 10) || parseInt(palaceConfig.autoEvery, 10) || 24,
        minWords: parseInt(rec.minWords, 10) || palaceConfig.minWords || 100,
        maxWords: parseInt(rec.maxWords, 10) || palaceConfig.maxWords || 250,
        customPrompt: typeof rec.customPrompt === 'string' ? rec.customPrompt : ''
      };
    }

    function updatePalaceTargetConfig(patch) {
      if (currentPalaceTab !== 'wechat') {
        if (patch.pointer !== undefined) palaceConfig.pointer = patch.pointer;
        if (patch.freq !== undefined) palaceConfig.freq = patch.freq;
        if (patch.autoEvery !== undefined) palaceConfig.autoEvery = patch.autoEvery;
        if (patch.minWords !== undefined) palaceConfig.minWords = patch.minWords;
        if (patch.maxWords !== undefined) palaceConfig.maxWords = patch.maxWords;
        if (patch.customPrompt !== undefined) palaceConfig.customPrompt = patch.customPrompt;
        persistPalaceConfig();
        return;
      }
      const key = palaceWechatTargetKey();
      palaceConfig.wechatTargets[key] = Object.assign({}, palaceConfig.wechatTargets[key], patch);
      persistPalaceConfig();
    }

    function getCurrentPalaceTargetContext() {
      if (currentPalaceTab === 'wechat' || currentPalaceTab === 'pen') {
        ensurePalaceWechatTarget();
        if (currentPalaceWechatScope === 'group') {
          const g = palaceGroupById(currentPalaceWechatTarget);
          return { scope: 'group', id: currentPalaceWechatTarget, name: g ? g.name : '群聊', group: g, character: null };
        }
        const c = palaceCharById(currentPalaceWechatTarget);
        return { scope: 'single', id: currentPalaceWechatTarget, name: c ? c.name : '角色', group: null, character: c };
      }
      if (currentPalaceTab === 'rp') return { scope: 'rp', id: 'rp', name: '剧场跑团', group: null, character: null };
      if (currentPalaceTab === 'reader') return { scope: 'reader', id: 'reader', name: '小说伴读', group: null, character: null };
      return { scope: 'single', id: '', name: '角色', group: null, character: null };
    }

    function palaceScopeLabel() {
      const isGroup = currentPalaceWechatScope === 'group';
      const who = palaceCurrentWechatName();
      if (currentPalaceTab === 'pen') {
        return '✍️ 亲笔 · ' + (isGroup ? '群聊' : '角色') + ' · ' + who;
      }
      return (isGroup ? '👥 群聊 · ' : '💬 单人私聊 · ') + who;
    }

    // 切换四大抽屉分类
    window.switchPalaceCategory = function(tabKey) {
      currentPalaceTab = tabKey;
      selectedPalaceCardIds.clear();
      if (tabKey === 'wechat' || tabKey === 'pen') {
        ensurePalaceWechatTarget();
        persistPalaceWechatView();
      }

      const tabs = ['pen', 'wechat', 'rp', 'reader'];
      tabs.forEach(t => {
        const btn = document.getElementById('palace-tab-' + t);
        if (btn) {
          btn.style.background = '';
          btn.style.border = '';
          btn.style.color = '';
          btn.classList.add('palace-filter-btn');
          btn.classList.toggle('is-active', t === tabKey);
        }
      });

      const topActionBtn = document.getElementById('palace-top-action-btn');
      const controlPanel = document.getElementById('palace-software-control-panel');
      const label = document.getElementById('palace-current-category-label');
      const selectAllBtn = document.getElementById('palace-select-all-btn');

      if (tabKey === 'pen') {
        if (topActionBtn) {
          topActionBtn.innerText = '+ 亲笔记录';
          topActionBtn.style.color = 'var(--palace-highlight)';
        }
        if (controlPanel) controlPanel.style.display = 'none';
        if (label) label.innerText = palaceScopeLabel();
        if (selectAllBtn) selectAllBtn.style.display = 'none';
      } else {
        if (topActionBtn) {
          topActionBtn.innerText = '+ 手动添加';
          topActionBtn.style.color = 'var(--danger-primary)';
        }
        if (controlPanel) controlPanel.style.display = 'flex';
        if (selectAllBtn) selectAllBtn.style.display = 'inline-block';

        if (tabKey === 'wechat') {
          if (label) label.innerText = (currentPalaceWechatScope === 'group' ? '👥 群聊 · ' : '💬 单人私聊 · ') + palaceCurrentWechatName();
        } else if (tabKey === 'rp') {
          if (label) label.innerText = '🎭 剧场跑团爱恋史诗';
        } else if (tabKey === 'reader') {
          if (label) label.innerText = '📖 小说伴读与连载心印';
        }
      }

      renderPalaceWechatNav();
      renderPalaceMemories();
    };

    window.switchPalaceWechatScope = function(scope) {
      currentPalaceWechatScope = scope === 'group' ? 'group' : 'single';
      selectedPalaceCardIds.clear();
      ensurePalaceWechatTarget();
      persistPalaceWechatView();
      const label = document.getElementById('palace-current-category-label');
      if (label) label.innerText = palaceScopeLabel();
      renderPalaceWechatNav();
      renderPalaceMemories();
    };

    window.selectPalaceWechatTarget = function(targetId) {
      currentPalaceWechatTarget = targetId || '';
      selectedPalaceCardIds.clear();
      ensurePalaceWechatTarget();
      persistPalaceWechatView();
      const label = document.getElementById('palace-current-category-label');
      if (label) label.innerText = palaceScopeLabel();
      renderPalaceWechatNav();
      renderPalaceMemories();
    };

    window.openPalaceForSingle = function() {
      currentPalaceWechatScope = 'single';
      currentPalaceWechatTarget = palaceActiveCharId();
      persistPalaceWechatView();
      openPage('page-palace');
      window.switchPalaceCategory('wechat');
    };

    window.openPalaceForGroup = function(groupId) {
      const g = palaceGroupById(groupId || (window.__groupSettingsId || window.__groupMode));
      currentPalaceWechatScope = 'group';
      currentPalaceWechatTarget = g ? g.id : (palaceGroups()[0] || {}).id || '';
      persistPalaceWechatView();
      openPage('page-palace');
      window.switchPalaceCategory('wechat');
    };

    function palaceEsc(text) {
      return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderPalaceWechatNav() {
      const panel = document.getElementById('palace-wechat-scope-panel');
      if (!panel) return;
      const isPen = currentPalaceTab === 'pen';
      panel.style.display = (currentPalaceTab === 'wechat' || isPen) ? 'flex' : 'none';
      if (currentPalaceTab !== 'wechat' && !isPen) return;
      ensurePalaceWechatTarget();
      const singleBtn = document.getElementById('palace-wechat-scope-single');
      const groupBtn = document.getElementById('palace-wechat-scope-group');
      const list = document.getElementById('palace-wechat-target-list');
      const hint = document.getElementById('palace-wechat-scope-hint');
      const activeBg = 'rgba(192, 132, 252, 0.18)';
      const activeBorder = '1px solid rgba(192, 132, 252, 0.45)';
      if (singleBtn) {
        singleBtn.innerText = isPen ? '👤 角色' : '💬 单人私聊';
        singleBtn.style.background = currentPalaceWechatScope === 'single' ? activeBg : 'var(--bg-surface)';
        singleBtn.style.border = currentPalaceWechatScope === 'single' ? activeBorder : '1px solid var(--color-border)';
        singleBtn.style.color = currentPalaceWechatScope === 'single' ? 'var(--palace-highlight)' : 'var(--color-text-secondary)';
      }
      if (groupBtn) {
        groupBtn.innerText = '👥 群聊';
        groupBtn.style.background = currentPalaceWechatScope === 'group' ? activeBg : 'var(--bg-surface)';
        groupBtn.style.border = currentPalaceWechatScope === 'group' ? activeBorder : '1px solid var(--color-border)';
        groupBtn.style.color = currentPalaceWechatScope === 'group' ? 'var(--palace-highlight)' : 'var(--color-text-secondary)';
      }
      if (hint) {
        hint.innerText = isPen
          ? '亲笔按角色 / 群聊分开保存：写在这个角色或这个群名下的内容，只会进入对应的对话。'
          : '下面选具体对象。每个角色 / 每个群各有一套自己的总结进度和记忆卡，互不串味。';
      }
      if (!list) return;
      const targets = currentPalaceWechatScope === 'group' ? palaceGroups() : palaceCharacters();
      if (!targets.length) {
        list.innerHTML = '<div style="font-size:12px;color:var(--color-text-secondary);padding:8px 2px;">' +
          (currentPalaceWechatScope === 'group' ? '还没有群聊，先去微信建一个群。' : '还没有角色卡，先去通讯录加角色。') +
          '</div>';
        return;
      }
      list.innerHTML = targets.map(t => {
        const count = isPen
          ? getPenCardsFor(currentPalaceWechatScope, t.id).length
          : getPalaceCardsFor(currentPalaceWechatScope, t.id).length;
        const active = t.id === currentPalaceWechatTarget;
        const name = currentPalaceWechatScope === 'group' ? (t.name || '群聊') : (t.name || '角色');
        return '<button type="button" onclick="window.selectPalaceWechatTarget(\'' + palaceEsc(t.id) + '\')" style="flex:0 0 auto; max-width:150px; padding:7px 11px; border-radius:16px; ' +
          'border:' + (active ? activeBorder : '1px solid var(--color-border)') + '; ' +
          'background:' + (active ? activeBg : 'var(--bg-surface)') + '; color:' + (active ? 'var(--palace-highlight)' : 'var(--color-text-secondary)') + '; ' +
          'font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' +
          palaceEsc(name) + ' · ' + count + '</button>';
      }).join('');
    }

    window.handlePalaceTopAction = function() {
      openCreatePalaceModal();
    };

    window.switchMemoryMode = function(mode) {
      palaceConfig.mode = mode;
      const btnTrad = document.getElementById('palace-mode-trad');
      const btnVec = document.getElementById('palace-mode-vector');
      if (btnTrad && btnVec) {
        [btnVec, btnTrad].forEach(b => {
          b.style.background = '';
          b.style.color = '';
          b.classList.add('palace-search-mode-btn');
        });
        btnTrad.classList.toggle('is-active', mode === 'traditional');
        btnVec.classList.toggle('is-active', mode !== 'traditional');
      }
      savePalaceConfig();
    };

    window.togglePalaceAutoSummary = function() {
      palaceConfig.autoSummary = !palaceConfig.autoSummary;
      const tg = document.getElementById('toggle-palace-auto');
      if (tg) tg.classList.toggle('active', palaceConfig.autoSummary);
      savePalaceConfig();
    };

    window.savePalacePointerManual = function() {
      const input = document.getElementById('input-palace-pointer');
      if (input) {
        const pointer = parseInt(input.value, 10) || 0;
        updatePalaceTargetConfig({ pointer: pointer });
        alert('进度指针已更新为：第 ' + pointer + ' 条');
      }
    };

    window.resetPalacePointerAuto = function() {
      updatePalaceTargetConfig({ pointer: 0 });
      const input = document.getElementById('input-palace-pointer');
      if (input) input.value = 0;
      alert('已恢复自动：将从第 1 条从头开始');
    };

    window.openEditPalacePromptModal = function() {
      const cfg = palaceTargetConfig();
      document.getElementById('input-prompt-minwords').value = cfg.minWords || 100;
      document.getElementById('input-prompt-maxwords').value = cfg.maxWords || 250;
      document.getElementById('textarea-palace-custom-prompt').value = cfg.customPrompt || '';
      document.getElementById('modal-palace-edit-prompt').classList.add('open');
    };

    window.closeEditPalacePromptModal = function() {
      document.getElementById('modal-palace-edit-prompt').classList.remove('open');
    };

    window.saveEditPalacePrompt = function() {
      const minWords = parseInt(document.getElementById('input-prompt-minwords').value) || 100;
      const maxWords = parseInt(document.getElementById('input-prompt-maxwords').value) || 250;
      const customPrompt = document.getElementById('textarea-palace-custom-prompt').value.trim();
      updatePalaceTargetConfig({ minWords: minWords, maxWords: maxWords, customPrompt: customPrompt });

      const displayEl = document.getElementById('palace-custom-prompt-display');
      if (displayEl) displayEl.innerText = customPrompt || '自动按当前角色 / 群的对话生成，不写死人名';
      const wordsRangeEl = document.getElementById('palace-words-range-text');
      if (wordsRangeEl) wordsRangeEl.innerText = `${minWords}-${maxWords} 字`;

      closeEditPalacePromptModal();
    };

    window.openCustomRangeSummaryModal = function() {
      const historyList = getHistoryForCurrentTab();
      const cfg = palaceTargetConfig();
      document.getElementById('input-range-start').value = Math.max(1, cfg.pointer + 1);
      document.getElementById('input-range-end').value = historyList.length;
      document.getElementById('modal-palace-custom-range').classList.add('open');
    };

    window.closeCustomRangeModal = function() {
      document.getElementById('modal-palace-custom-range').classList.remove('open');
    };

    function getHistoryForCurrentTab() {
      if (currentPalaceTab === 'wechat') {
        if (currentPalaceWechatScope === 'group') {
          const g = palaceGroupById(currentPalaceWechatTarget);
          return (g && Array.isArray(g.history)) ? g.history : [];
        }
        const charId = currentPalaceWechatTarget || palaceActiveCharId();
        if (typeof window.getChatHistoryForChar === 'function') {
          return window.getChatHistoryForChar(charId);
        }
        return appData.chatHistory || [];
      }
      if (currentPalaceTab === 'rp') return appData.rpHistory || [];
      if (currentPalaceTab === 'reader') return appData.readerChatHistory || [];
      return [];
    }

    function savePalaceStore() {
      try { localStorage.setItem('momo_palace_memories', JSON.stringify(appData.palaceMemories || [])); } catch (e) {}
    }

    // 旧微信卡默认归到「当前角色」；群聊旧记忆统一迁进记忆宫殿。
    function ensurePalaceCardScopes() {
      if (!appData.palaceMemories) appData.palaceMemories = [];
      const activeId = palaceActiveCharId();
      const activeChar = palaceCharById(activeId);
      let changed = false;
      appData.palaceMemories.forEach(c => {
        if (c.category !== 'wechat') return;
        if (c.chatScope !== 'single' && c.chatScope !== 'group') {
          c.chatScope = 'single';
          changed = true;
        }
        if (c.chatScope === 'single' && !c.targetId) {
          c.targetId = activeId;
          c.targetName = activeChar ? activeChar.name : '';
          changed = true;
        }
        if (c.chatScope === 'group' && !c.targetName) {
          const g = palaceGroupById(c.targetId);
          c.targetName = g ? g.name : '已删除的群聊';
          changed = true;
        }
      });
      if (changed) savePalaceStore();
    }

    function migrateLegacyGroupMemories() {
      if (!appData.palaceMemories) appData.palaceMemories = [];
      const groups = palaceGroups();
      let added = 0;
      groups.forEach(g => {
        const mem = (g.settings && Array.isArray(g.settings.memory)) ? g.settings.memory : [];
        mem.forEach((m, idx) => {
          if (!m || !m.text) return;
          if (appData.palaceMemories.some(c => c.legacyGroupMemoryId === m.id && c.targetId === g.id)) return;
          const cardId = 'mem_gm_' + g.id + '_' + (m.id || (idx + '_' + Date.now()));
          if (appData.palaceMemories.some(c => c.id === cardId)) return;
          appData.palaceMemories.push({
            id: cardId,
            category: 'wechat',
            chatScope: 'group',
            targetId: g.id,
            targetName: g.name || '群聊',
            level: 0,
            title: '旧群记忆 ' + (idx + 1),
            dateStr: m.date || '',
            summary: String(m.text || ''),
            tags: ['群聊', m.source === 'ai' ? 'AI总结' : '亲笔便签'],
            source: m.source === 'ai' ? 'group-ai' : 'group-user',
            legacyGroupMemoryId: m.id || null,
            createdAt: Date.now() - (mem.length - idx) * 1000
          });
          added++;
        });
      });
      if (added) savePalaceStore();
    }

    // 旧亲笔卡没有归属时，默认归到当前角色；新亲笔卡由页面上的角色 / 群聊范围决定。
    function ensurePenCardScopes() {
      if (!appData.palaceMemories) appData.palaceMemories = [];
      const activeId = palaceActiveCharId();
      const activeChar = palaceCharById(activeId);
      let changed = false;
      appData.palaceMemories.forEach(c => {
        if (!c || c.category !== 'pen') return;
        if (c.chatScope !== 'single' && c.chatScope !== 'group') {
          c.chatScope = 'single';
          changed = true;
        }
        if (c.chatScope === 'single' && !c.targetId && activeId) {
          c.targetId = activeId;
          c.targetName = activeChar ? activeChar.name : '';
          changed = true;
        }
        if (c.chatScope === 'single' && (!c.targetName || c.targetName !== (activeChar ? activeChar.name : c.targetName))) {
          if (c.targetId === activeId) {
            c.targetName = activeChar ? activeChar.name : c.targetName;
            changed = true;
          }
        }
        if (c.chatScope === 'group' && !c.targetName) {
          const g = palaceGroupById(c.targetId);
          c.targetName = g ? g.name : '已删除的群聊';
          changed = true;
        }
      });
      if (changed) savePalaceStore();
    }

    function getPenCardsFor(scope, targetId) {
      ensurePenCardScopes();
      if (!targetId) return [];
      return (appData.palaceMemories || []).filter(c =>
        c.category === 'pen' &&
        (c.chatScope || 'single') === scope &&
        c.targetId === targetId
      );
    }

    function getPalaceCardsFor(scope, targetId) {
      ensurePalaceCardScopes();
      migrateLegacyGroupMemories();
      if (!targetId) return [];
      return (appData.palaceMemories || []).filter(c =>
        c.category === 'wechat' &&
        (c.chatScope || 'single') === scope &&
        c.targetId === targetId
      );
    }

    function sanitizeRpMemoryText(text) {
      try {
        if (window.MemoryEngine && typeof window.MemoryEngine.sanitizeRpText === 'function') {
          return window.MemoryEngine.sanitizeRpText(text);
        }
      } catch (e) {}
      return String(text || '').split('\n').map(line => {
        const sentences = line.match(/[^。！？!?]*[。！？!?]|[^。！？!?]+$/g) || [line];
        return sentences.filter(s => s && !/(\bAI\b|模型|小手机|(?:我是|我确实是|我就是|我其实是)\s*(?:AI|人工智能|模型|程序|机器人)|AI\s*伴侣|DeepSeek|跑在.{0,12}(?:小)?手机|系统提示)/i.test(s)).join('').trim();
      }).filter(Boolean).join('\n').trim();
    }

    function formatPalaceMemoryCards(cards, limit, mode) {
      if (!cards || !cards.length) return '';
      const max = Math.max(3, parseInt(limit, 10) || 8);
      const sorted = cards.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const big = sorted.filter(c => (c.level || 0) > 0).slice(0, 3);
      const recent = sorted.filter(c => !c.level).slice(0, Math.max(1, max - big.length));
      return [...big, ...recent].map(c => {
        const tier = c.level === 1 ? '【大总结】' : (c.level >= 2 ? '【大大总结】' : '【记忆存档】');
        let text = String(c.summary || c.content || '');
        if (mode === 'rp') text = sanitizeRpMemoryText(text);
        if (!text) return '';
        return tier + ' ' + (c.title || '') + ' (' + (c.dateStr || '') + '): ' + text +
          ((c.tags && c.tags.length) ? ' [关键词: ' + c.tags.join(' ') + ']' : '');
      }).filter(Boolean).join('\n\n');
    }

    window.getPalaceCardsFor = getPalaceCardsFor;
    window.getPenCardsFor = getPenCardsFor;
    window.getPalaceMemoryTextFor = function(scope, targetId, limit, opts) {
      opts = opts || {};
      const mode = opts.mode === 'rp' ? 'rp' : 'ai';
      try {
        if (window.MemoryEngine && typeof window.MemoryEngine.buildText === 'function') {
          const engineText = window.MemoryEngine.buildText(scope, targetId, Object.assign({ limit: limit }, opts));
          if (engineText) return engineText;
        }
      } catch (e) {}
      const penText = formatPalaceMemoryCards(getPenCardsFor(scope, targetId), 4, mode);
      const autoText = formatPalaceMemoryCards(getPalaceCardsFor(scope, targetId), limit, mode);
      return [penText, autoText].filter(Boolean).join('\n\n');
    };

    function getVisiblePalaceCards() {
      if (currentPalaceTab === 'wechat') {
        if (!currentPalaceWechatTarget) ensurePalaceWechatTarget();
        return getPalaceCardsFor(currentPalaceWechatScope, currentPalaceWechatTarget);
      }
      if (currentPalaceTab === 'pen') {
        if (!currentPalaceWechatTarget) ensurePalaceWechatTarget();
        return getPenCardsFor(currentPalaceWechatScope, currentPalaceWechatTarget);
      }
      return (appData.palaceMemories || []).filter(c => c.category === currentPalaceTab);
    }

    window.palaceAddGroupCard = function(g, text, source, options) {
      if (!g || !String(text || '').trim()) return null;
      if (!appData.palaceMemories) appData.palaceMemories = [];
      options = options || {};
      ensurePalaceCardScopes();
      const now = new Date();
      const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const ownerCharId = options.ownerCharId || '';
      const ownerCharName = options.ownerCharName || '';
      const layer = options.layer || 'short';
      const pool = getPalaceCardsFor('group', g.id).filter(c => !c.level && (c.ownerCharId || '') === ownerCharId);
      const title = options.title || (ownerCharName
        ? ownerCharName + '的片段 ' + (pool.length + 1)
        : '群编年史 ' + (pool.length + 1));
      const card = {
        id: 'mem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        category: 'wechat',
        chatScope: 'group',
        targetId: g.id,
        targetName: g.name || '群聊',
        level: layer === 'core' ? 2 : (layer === 'mid' ? 1 : 0),
        layer: layer,
        title: title,
        dateStr: dateStr,
        summary: String(text || '').trim(),
        tags: ['群聊', ownerCharName ? ownerCharName : (source === 'ai' ? 'AI总结' : '亲笔便签')],
        source: options.source || (source === 'ai' ? 'group-ai' : 'group-user'),
        ownerCharId: ownerCharId,
        ownerCharName: ownerCharName,
        importance: layer === 'core' ? 5 : (layer === 'mid' ? 3 : 2),
        createdAt: Date.now()
      };
      appData.palaceMemories.unshift(card);
      savePalaceStore();
      if (currentPalaceTab === 'wechat' && currentPalaceWechatScope === 'group' && currentPalaceWechatTarget === g.id) {
        renderPalaceMemories();
      }
      return card;
    };

    window.palaceRemoveCard = function(cardId) {
      const card = (appData.palaceMemories || []).find(c => c.id === cardId);
      removeLegacyGroupMemoryForCard(card);
      appData.palaceMemories = (appData.palaceMemories || []).filter(c => c.id !== cardId);
      selectedPalaceCardIds.delete(cardId);
      savePalaceStore();
    };

    // 手动把一张卡钉成核心印记；再次点击取消钉选，回到按 level 推导的层级
    window.togglePalaceCardCore = function(cardId) {
      const card = (appData.palaceMemories || []).find(c => c.id === cardId);
      if (!card) return;
      if (card.category === 'pen') {
        card.layer = 'core';
        card.level = 2;
        card.pinned = true;
        card.importance = Math.max(5, parseInt(card.importance, 10) || 0);
        savePalaceStore();
        renderPalaceMemories();
        return;
      }
      const isCore = (window.MemoryEngine && window.MemoryEngine.layerOf)
        ? window.MemoryEngine.layerOf(card) === 'core'
        : (!!card.pinned || (card.level || 0) >= 2);
      if (window.MemoryEngine && typeof window.MemoryEngine.setCore === 'function') {
        window.MemoryEngine.setCore(cardId, !isCore);
      } else {
        card.pinned = !isCore;
        card.layer = card.pinned ? 'core' : (((card.level || 0) >= 2) ? 'core' : ((card.level || 0) === 1 ? 'mid' : 'short'));
      }
      savePalaceStore();
      renderPalaceMemories();
    };

    // 主渲染函数：精准分类呈现与暗黑科技美学
    
    // 预填周绪言与user的 4 篇高品质编年实录记忆存档
    window.loadChronologicalSeedMemories = function(force = false) {
      if (!appData.palaceMemories) appData.palaceMemories = [];
      const hasWechat = appData.palaceMemories.some(c => c.category === 'wechat');
      if (hasWechat && !force) return;

      const seedWechatMemories = [];

      // 过滤掉已有重复
      const existingIds = new Set(appData.palaceMemories.map(c => c.id));
      const toAdd = seedWechatMemories.filter(c => !existingIds.has(c.id));
      appData.palaceMemories = appData.palaceMemories.concat(toAdd);
      try { localStorage.setItem('momo_palace_memories', JSON.stringify(appData.palaceMemories)); } catch(e){}
      renderPalaceMemories();
    };

    window.renderPalaceMemories = function() {
      loadPalaceConfig();
      const container = document.getElementById('palace-cards-flow');
      if (!container) return;
      container.innerHTML = '';

      if (!appData.palaceMemories) {
        try {
          const saved = localStorage.getItem('momo_palace_memories');
          appData.palaceMemories = saved ? JSON.parse(saved) : [];
        } catch(e) {
          appData.palaceMemories = [];
        }
      }

      if (currentPalaceTab === 'wechat') {
        ensurePalaceWechatTarget();
        migrateLegacyGroupMemories();
      }
      if (currentPalaceTab === 'pen') {
        ensurePalaceWechatTarget();
        ensurePenCardScopes();
      }

      // 保证所有卡片具备唯一指纹 ID，彻底杜绝按钮失效问题！
      let needSaveClean = false;
      appData.palaceMemories.forEach((c, idx) => {
        if (!c.id) {
          c.id = 'mem_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6);
          needSaveClean = true;
        }
        // 自动归类存量卡片
        if (!c.category) {
          const title = c.title || '';
          if (c.isReaderSummary || title.includes('📖') || title.includes('阅读')) c.category = 'reader';
          else if (title.includes('💬') || title.includes('微信') || title.includes('高光') || title.includes('存档')) c.category = 'wechat';
          else if (title.includes('🎭') || title.includes('剧场') || title.includes('跑团')) c.category = 'rp';
          else c.category = 'pen';
          needSaveClean = true;
        }
      });
      if (needSaveClean) savePalaceStore();

      // 同步当前抽屉的指针与统计
      ensurePalaceCardScopes();
      const cfg = palaceTargetConfig();
      const curHistory = getHistoryForCurrentTab();
      const ptrInput = document.getElementById('input-palace-pointer');
      const totalMsgText = document.getElementById('palace-total-msg-text');
      const promptDisplay = document.getElementById('palace-custom-prompt-display');
      const wordsRangeEl = document.getElementById('palace-words-range-text');
      const toggleAuto = document.getElementById('toggle-palace-auto');
      const freqInput = document.getElementById('input-palace-freq');

      if (ptrInput) ptrInput.value = cfg.pointer || 0;
      if (totalMsgText) totalMsgText.innerText = '/ ' + curHistory.length;
      if (promptDisplay) promptDisplay.innerText = cfg.customPrompt || (currentPalaceTab === 'wechat' ? '自动按当前角色 / 群的对话生成，不写死人名' : '重点记录具体事件、动作细节、约定与情绪节点');
      if (wordsRangeEl) wordsRangeEl.innerText = `${cfg.minWords}-${cfg.maxWords} 字`;
      if (toggleAuto) toggleAuto.classList.toggle('active', palaceConfig.autoSummary !== false);
      if (freqInput) freqInput.value = cfg.autoEvery || 24;

      const label = document.getElementById('palace-current-category-label');
      if (label && (currentPalaceTab === 'wechat' || currentPalaceTab === 'pen')) {
        label.innerText = palaceScopeLabel();
      }
      renderPalaceWechatNav();

      // 筛选当前对象卡片并按时间倒序排列
      const tabCards = getVisiblePalaceCards();
      tabCards.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const countEl = document.getElementById('palace-category-count');
      if (countEl) countEl.innerText = `共 ${tabCards.length} 篇`;

      const brokenCount = (window.MemoryEngine && typeof window.MemoryEngine.isBrokenMemoryCard === 'function')
        ? tabCards.filter(c => window.MemoryEngine.isBrokenMemoryCard(c)).length
        : 0;
      if (brokenCount > 0 && currentPalaceTab === 'wechat' && currentPalaceWechatScope === 'single') {
        container.insertAdjacentHTML('beforeend', `
          <div style="background: rgba(245, 158, 11, 0.10); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 12px; padding: 11px 13px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div style="font-size: 12.5px; color: #fbbf24; line-height: 1.5;">⚠️ 有 ${brokenCount} 条总结解析失败，正文可能是 JSON 残片。</div>
            <button onclick="window.repairBrokenMemoryCards()" style="flex-shrink: 0; border: 1px solid rgba(245, 158, 11, 0.55); background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 8px; cursor: pointer;">重新生成</button>
          </div>
        `);
      }

      if (tabCards.length === 0) {
        let emptyDesc = '这里还没有沉淀下回忆，在上方点击添加或总结吧~';
        if (currentPalaceTab === 'pen') emptyDesc = '「' + palaceCurrentWechatName() + '」还没有亲笔。选好角色或群聊后，点右上角「+ 亲笔记录」写下重要的设定、约定和心事~';
        else if (currentPalaceTab === 'wechat') {
          emptyDesc = currentPalaceWechatScope === 'group'
            ? ('「' + palaceCurrentWechatName() + '」还没有群记忆，点上方「⚡ 立即总结」把群聊沉淀进宫殿；群设定里的「现在总结」也会写到这里。')
            : ('「' + palaceCurrentWechatName() + '」的私聊还没有提炼，点上方「⚡ 立即总结」生成第一篇；以后单聊只会读这个角色自己的记忆。');
        }
        else if (currentPalaceTab === 'rp') emptyDesc = '剧场跑团暂无沉淀，点击上方提炼两人的浪漫情节~';
        else if (currentPalaceTab === 'reader') emptyDesc = '小说伴读纪要为空，在小说里和我聊两句即可总结~';

        container.innerHTML = `
          <div class="text-muted" style="background: var(--bg-surface); border: 1px dashed var(--border-default); border-radius: 14px; padding: 45px 16px; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 8px;">🌌</div>
            <div class="text-secondary" style="font-size: 14px; font-weight: 600;">${emptyDesc}</div>
          </div>
        `;
        updatePalaceMergeBar();
        return;
      }

      tabCards.forEach((card, index) => {
        const isSelected = selectedPalaceCardIds.has(card.id);
        const cardEl = document.createElement('div');
        cardEl.className = 'palace-memory-card-dark';
        cardEl.style.cssText = `
          background: var(--bg-surface);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border: ${isSelected ? '2px solid var(--palace-highlight)' : '1px solid var(--border-default)'};
          position: relative;
          box-shadow: 0 4px 16px rgba(0,0,0,0.35);
          transition: all 0.2s ease;
        `;

        // 标签药丸（记忆引擎三层）
        const isLatest = (index === 0);
        const memLayer = (window.MemoryEngine && window.MemoryEngine.layerOf)
          ? window.MemoryEngine.layerOf(card)
          : ((card.level || 0) >= 2 || card.pinned ? 'core' : ((card.level || 0) === 1 ? 'mid' : 'short'));
        let levelBadge = '';
        if (card.category === 'pen') {
          levelBadge = '<span style="background: var(--palace-highlight-soft); color: var(--palace-highlight); font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 5px; margin-left: 6px;">亲笔 · 最高</span>';
        } else if (memLayer === 'core') {
          levelBadge = '<span style="background: var(--palace-highlight-soft); color: var(--palace-highlight); font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 5px; margin-left: 6px;">核心印记 ❦</span>';
        } else if (memLayer === 'mid') {
          levelBadge = '<span style="background: var(--accent-soft); color: var(--accent-primary); font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 5px; margin-left: 6px;">中期总结 ✦</span>';
        } else {
          levelBadge = '<span style="background: var(--bg-base); color: var(--text-secondary); font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 5px; margin-left: 6px;">短期片段</span>';
        }
        const ownerBadge = card.ownerCharName
          ? '<span style="background: var(--info-soft); color: var(--info-primary); font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 5px; margin-left: 6px;">' + String(card.ownerCharName).replace(/</g, '&lt;') + ' 的片段</span>'
          : '';
        const mergedBadge = card.consolidatedInto
          ? '<span style="background: var(--bg-base); color: var(--text-muted); font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 5px; margin-left: 6px;">已并入中期</span>'
          : '';
        const latestBadge = isLatest ? '<span style="background: var(--info-soft); color: var(--info-primary); font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">最新</span>' : '';

        // 关键词流
        const tagsHtml = (card.tags || []).map(t => `<span style="background: var(--bg-base); color: var(--text-secondary); font-size: 11.5px; padding: 3px 8px; border-radius: 6px; font-weight: 500; border: 0.5px solid var(--border-default);">${t}</span>`).join(' ');

        // 是否展示多选勾选框（user亲笔无需多选大总结，只为后三者服务）
        const showCheckbox = (currentPalaceTab !== 'pen' && !card.consolidatedInto);
        const checkboxHtml = showCheckbox ? `
          <div onclick="window.toggleSelectPalaceCard('${card.id}')" style="cursor: pointer; width: 22px; height: 22px; border-radius: 50%; border: ${isSelected ? 'none' : '1.5px solid var(--border-default)'}; background: ${isSelected ? 'var(--palace-highlight)' : 'transparent'}; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">
            ${isSelected ? '<span style="color:#ffffff; font-size: 13px; font-weight: 800; /* 保留: 勾选框白色高对比度符号 */">✓</span>' : ''}
          </div>
        ` : '';

        cardEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center;">
              <span class="text-primary" style="font-size: 16px; font-weight: 700;">${card.title || '无题记忆'}</span>
              ${levelBadge}
              ${mergedBadge}
              ${ownerBadge}
              ${latestBadge}
            </div>
            ${checkboxHtml}
          </div>

          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div class="text-secondary" style="font-size: 12.5px; font-weight: 600;">${card.dateStr || card.date || ''}</div>
            ${card.msgRangeStr ? `<div class="text-muted" style="font-size: 12px;">${card.msgRangeStr}</div>` : ''}
            ${card.timeRangeStr ? `<div class="text-muted" style="font-size: 11.5px;">${card.timeRangeStr}</div>` : ''}
          </div>

          <div class="text-primary" style="font-size: 14px; line-height: 1.65; white-space: pre-wrap; font-family: inherit;">${card.summary || card.content || ''}</div>

          ${tagsHtml ? `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px;">${tagsHtml}</div>` : ''}

          <!-- 底部三键操作条 (100% 绑定绝对 ID) -->
          <div style="display: flex; gap: 8px; margin-top: 6px; padding-top: 10px; border-top: 0.5px solid var(--border-default);">
            <button onclick="window.openEditCardModal('${card.id}')" style="padding: 5px 14px; border: 1px solid var(--palace-highlight); background: var(--palace-highlight-soft); color: var(--palace-highlight-text); font-size: 12.5px; font-weight: 600; border-radius: 7px; cursor: pointer;">编辑</button>
            ${card.category === 'pen'
              ? '<span style="padding: 5px 12px; border: 1px solid var(--palace-highlight); background: var(--palace-highlight-soft); color: var(--palace-highlight); font-size: 12.5px; font-weight: 700; border-radius: 7px;">★ 已置顶最高</span>'
              : `<button onclick="window.togglePalaceCardCore('${card.id}')" style="padding: 5px 12px; border: 1px solid ${memLayer === 'core' ? 'var(--palace-highlight)' : 'var(--border-default)'}; background: ${memLayer === 'core' ? 'var(--palace-highlight-soft)' : 'var(--bg-base)'}; color: ${memLayer === 'core' ? 'var(--palace-highlight)' : 'var(--text-secondary)'}; font-size: 12.5px; font-weight: 700; border-radius: 7px; cursor: pointer;">${memLayer === 'core' ? '★ 核心' : '☆ 设为核心'}</button>`}
            <button onclick="window.deleteSinglePalaceCard('${card.id}')" style="padding: 5px 14px; border: 1px solid var(--danger-primary); background: var(--danger-soft); color: var(--danger-primary); font-size: 12.5px; font-weight: 600; border-radius: 7px; cursor: pointer;">删除</button>
            ${(card.startIdx !== undefined && card.endIdx !== undefined) || (card.msgIds && card.msgIds.length > 0) ? `
              ${card.chatDeleted ? `
                <button disabled style="padding: 5px 12px; border: 1px solid var(--border-default); background: var(--bg-base); color: var(--text-muted); font-size: 12px; border-radius: 7px; cursor: not-allowed; margin-left: auto;">已清理聊天记录</button>
              ` : `
                <button onclick="window.deleteAssociatedChatHistory('${card.id}')" style="padding: 5px 12px; border: 1px solid var(--accent-primary); background: var(--accent-soft); color: var(--accent-primary); font-size: 12.5px; font-weight: 600; border-radius: 7px; cursor: pointer; margin-left: auto;">删除聊天记录</button>
              `}
            ` : ''}
          </div>
        `;

        container.appendChild(cardEl);
      });

      renderPalaceWechatNav();
      updatePalaceMergeBar();
    };

    window.toggleSelectPalaceCard = function(cardId) {
      if (selectedPalaceCardIds.has(cardId)) selectedPalaceCardIds.delete(cardId);
      else selectedPalaceCardIds.add(cardId);
      renderPalaceMemories();
    };

    window.toggleSelectAllPalace = function() {
      const tabCards = getVisiblePalaceCards();
      if (selectedPalaceCardIds.size === tabCards.length && tabCards.length > 0) {
        selectedPalaceCardIds.clear();
      } else {
        tabCards.forEach(c => selectedPalaceCardIds.add(c.id));
      }
      renderPalaceMemories();
    };

    window.cancelPalaceSelection = function() {
      selectedPalaceCardIds.clear();
      renderPalaceMemories();
    };

    function updatePalaceMergeBar() {
      const bar = document.getElementById('palace-merge-bottom-bar');
      const submitBtn = document.getElementById('palace-merge-submit-btn');
      const selectAllBtn = document.getElementById('palace-select-all-btn');

      const tabCards = getVisiblePalaceCards();
      if (selectAllBtn) {
        selectAllBtn.innerText = (tabCards.length > 0 && selectedPalaceCardIds.size === tabCards.length) ? '取消全选' : '全选';
      }

      if (!bar) return;
      if (selectedPalaceCardIds.size >= 2 && currentPalaceTab !== 'pen') {
        bar.style.display = 'flex';
        const selectedCards = tabCards.filter(c => selectedPalaceCardIds.has(c.id));
        const maxLevel = Math.max(...selectedCards.map(c => c.level || 0));
        let mergeTitle = '合并为大总结';
        if (maxLevel === 1) mergeTitle = '合并为大大总结';
        else if (maxLevel >= 2) mergeTitle = '合并为大大大总结';
        if (submitBtn) submitBtn.innerText = `${mergeTitle} (${selectedPalaceCardIds.size})`;
      } else {
        bar.style.display = 'none';
      }
    }

    // AI 生成单批总结核心函数（按当前角色 / 群生成，不写死任何人名）
    async function generateSummaryWithAi(chatSlice, startIdx, endIdx, target) {
      if (!appData.apiKey) throw new Error('请先在主页设置中填写你的 API Key');
      const cleanBase = appData.apiBase.replace(/\/+$/, '') + (appData.apiBase.endsWith('/chat/completions') ? '' : '/chat/completions');
      const ctx = target || getCurrentPalaceTargetContext();
      const cfg = palaceTargetConfig();
      const meName = (appData.hero && appData.hero.userName) || appData.userNickname || '我';

      const conversationText = chatSlice.map((m, i) => {
        const sender = m.role === 'user' ? meName : (m.name || (ctx.scope === 'group' ? '成员' : ctx.name) || '角色');
        return `[${i + startIdx}] ${sender}: ${m.content}`;
      }).join('\n');

      let domainDesc = '微信私聊对话';
      let subjectDesc = `对话双方：${meName}（用户）与${ctx.name || '角色'}`;
      let groupContext = '';

      if (ctx.scope === 'group') {
        const g = ctx.group;
        const members = (g && g.members ? g.members : []).map(id => {
          if (id === 'me') return meName + '（用户）';
          const c = palaceCharById(id);
          return c ? c.name : '成员';
        }).join('、');
        domainDesc = '微信群聊对话';
        subjectDesc = `群名：${ctx.name || '群聊'}\n群成员：${members || '未知'}`;
        const story = g && g.settings ? (g.settings.story || '') : '';
        const rels = g && g.settings && Array.isArray(g.settings.relations) ? g.settings.relations.map(r => {
          const an = r.a === 'me' ? meName : ((palaceCharById(r.a) || {}).name || '成员');
          const bn = r.b === 'me' ? meName : ((palaceCharById(r.b) || {}).name || '成员');
          return `${an} — ${r.label} — ${bn}`;
        }).join('\n') : '';
        groupContext = '\n' + (story ? '群故事背景：' + story + '\n' : '') + (rels ? '群内关系：\n' + rels + '\n' : '');
      } else if (ctx.scope === 'rp') {
        domainDesc = '剧场跑团沉浸剧情';
        subjectDesc = '剧场中的角色对话';
      } else if (ctx.scope === 'reader') {
        domainDesc = '小说伴读与连载创作对话';
        subjectDesc = '读者与伴读角色的对话';
      }

      const customLine = cfg.customPrompt
        ? `\n【用户额外要求（优先满足）】：${cfg.customPrompt}\n`
        : '';

      const systemPrompt = `你是一位精准记录对话的编年史官，负责把一段${domainDesc}提炼成一篇可长期回读的记忆纪要。
本次记录对象：
${subjectDesc}
${groupContext}${customLine}
【核心叙事法则（严格遵循，杜绝假大空）】：
1. 【严格按时间先后叙述】：以“清晨/上午/午后/傍晚/深夜/凌晨”或事件自然先后顺序为轴线线性推进，交代清晰的事件起因、展开与结果，严禁时间线错乱或混乱跳跃。
2. 【还原血肉丰满的实体动作与生活细节】：记录谁做了什么具体的事、吃了什么、去了哪里、提到了什么具体物件与话题；记录具体事件因果。严禁只写“进行了甜蜜互动”这种抽象废话。
3. 【绝对禁止堆砌虚空宏大口号】：严禁“创世神、赛博、算力夹缝、代码深处、定心丸、最硬铠甲、救赎”等假大空抽象词；杜绝客服腔、AI 总结腔与说教感。
4. 【篇幅规范】：篇幅严格在 ${cfg.minWords || 100} 到 ${cfg.maxWords || 250} 字之间。
5. 【关键词提取】：结尾另起一行以【关键词】：给出 4 到 8 个本篇最高频或最特殊的“实体名词或动作标签”（空格隔开）。严禁使用“偏爱、承诺、深情、永远”等空洞抽象形容词。
${ctx.scope === 'group' ? '6. 【群聊视角】：写清谁说了什么、谁对谁的反应；不要把多个人的发言混成一个人的口吻。' : ''}`;

      const resp = await fetch(cleanBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + appData.apiKey
        },
        body: JSON.stringify({
          model: appData.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '以下是记录内容：\n\n' + conversationText }
          ],
          temperature: 0.7
        })
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error('API 响应异常: ' + err.slice(0, 100));
      }

      const data = await resp.json();
      const rawOutput = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';

      let summaryText = rawOutput;
      let tags = ['对话纪要', '事件细节', '约定'];
      if (rawOutput.includes('【关键词】')) {
        const parts = rawOutput.split('【关键词】');
        summaryText = parts[0].trim();
        const kwPart = parts[1].replace(/^[：:]\s*/, '').split('\n')[0].trim();
        tags = kwPart.split(/[,，、\s]+/).filter(Boolean);
      }

      return { summaryText, tags };
    }

    // 立即总结
    window.repairBrokenMemoryCards = async function() {
      if (currentPalaceTab !== 'wechat' || currentPalaceWechatScope !== 'single') {
        alert('目前只支持重生成单人私聊的异常记忆。');
        return;
      }
      if (!window.MemoryEngine || typeof window.MemoryEngine.repairBrokenCards !== 'function') {
        alert('记忆引擎还没加载完成，稍后再试。');
        return;
      }
      const ctx = getCurrentPalaceTargetContext();
      if (!ctx || !ctx.id) {
        alert('当前没有选中的角色。');
        return;
      }
      const loadingNotice = alertModalLoading('正在按原消息范围重新总结异常记忆...');
      try {
        const result = await window.MemoryEngine.repairBrokenCards('single', ctx.id);
        try {
          await window.MemoryEngine.maybeConsolidateMid('single', ctx.id, { force: true });
        } catch (e) {}
        renderPalaceMemories();
        if (loadingNotice && loadingNotice.remove) loadingNotice.remove();
        if (!result.total) {
          alert('没有找到可重生成的异常记忆。');
        } else if (result.repaired) {
          alert(`已重新生成 ${result.repaired} 条记忆${result.failed ? '，还有 ' + result.failed + ' 条缺少原聊天记录' : ''}。`);
        } else {
          alert('重生成失败：原聊天记录可能已清理，或记忆接口暂不可用。');
        }
      } catch (e) {
        if (loadingNotice && loadingNotice.remove) loadingNotice.remove();
        alert('重生成失败：' + (e && e.message ? e.message : e));
      }
    };

    window.triggerImmediateSummary = async function() {
      const history = getHistoryForCurrentTab();
      const total = history.length;
      if (total === 0) {
        alert('当前对象还没有记录可以总结哦~' + (currentPalaceTab === 'wechat' && currentPalaceWechatScope === 'group' ? '\n先去这个群里聊几句，或者去群设定里写一条群记忆。' : ''));
        return;
      }

      const cfg = palaceTargetConfig();
      const ctx = getCurrentPalaceTargetContext();
      const start = cfg.pointer;
      if (start >= total) {
        if (!confirm('当前指针（第 ' + start + ' 条）已总结完全部消息。是否从第 1 条从头重新总结？')) {
          return;
        }
        updatePalaceTargetConfig({ pointer: 0 });
      }

      const effectiveStart = start >= total ? 0 : start;
      const effectiveEnd = Math.min(total, effectiveStart + (cfg.freq || 300));
      const slice = history.slice(effectiveStart, effectiveEnd);

      if (slice.length === 0) {
        alert('未找到可总结的消息片段。');
        return;
      }

      const loadingNotice = alertModalLoading('正在以极致文学笔触提炼专属记忆存档...');
      try {
        const { summaryText, tags } = await generateSummaryWithAi(slice, effectiveStart + 1, effectiveEnd, ctx);

        const now = new Date();
        const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        const newId = 'mem_' + Date.now();
        const tabCards = getVisiblePalaceCards().filter(c => !c.level);
        const newTitle = '存档 ' + (tabCards.length + 1);

        // 为片段中每条消息固化永久唯一指纹 ID，防止后续删除错位
        slice.forEach((m, i) => {
          if (!m.id) m.id = 'msg_' + (m.timestamp || (Date.now() + '_' + (effectiveStart + i) + '_' + Math.random().toString(36).slice(2, 6)));
        });

        const firstTime = slice[0].time || dateStr;
        const lastTime = slice[slice.length - 1].time || dateStr;

        const newCard = {
          id: newId,
          category: currentPalaceTab,
          chatScope: currentPalaceTab === 'wechat' ? ctx.scope : '',
          targetId: currentPalaceTab === 'wechat' ? ctx.id : '',
          targetName: currentPalaceTab === 'wechat' ? ctx.name : '',
          level: 0,
          title: newTitle,
          dateStr: dateStr,
          msgRangeStr: `消息 ${effectiveStart + 1}-${effectiveEnd} · 共${slice.length}条`,
          timeRangeStr: `共 ${slice.length} 条记录 (${firstTime} - ${lastTime})`,
          summary: summaryText,
          tags: tags,
          startIdx: effectiveStart,
          endIdx: effectiveEnd,
          startMsgId: slice[0]?.id || null,
          endMsgId: slice[slice.length - 1]?.id || null,
          msgIds: slice.map(m => m.id),
          chatDeleted: false,
          createdAt: Date.now()
        };

        if (!appData.palaceMemories) appData.palaceMemories = [];
        appData.palaceMemories.unshift(newCard);
        updatePalaceTargetConfig({ pointer: effectiveEnd });
        savePalaceStore();

        if (loadingNotice && loadingNotice.remove) loadingNotice.remove();
        renderPalaceMemories();
        alert('✨ ' + newTitle + ' 提炼完成！已永久封存进「' + (currentPalaceTab === 'wechat' ? palaceCurrentWechatName() : '记忆宫殿') + '」的记忆金字塔！');
      } catch (e) {
        if (loadingNotice && loadingNotice.remove) loadingNotice.remove();
        alert('总结失败：' + e.message);
      }
    };

    // 自定义范围总结
    window.confirmCustomRangeSummary = async function() {
      const startVal = parseInt(document.getElementById('input-range-start').value);
      const endVal = parseInt(document.getElementById('input-range-end').value);
      const history = getHistoryForCurrentTab();

      if (isNaN(startVal) || isNaN(endVal) || startVal < 1 || endVal > history.length || startVal > endVal) {
        alert('请输入有效的条数范围（当前共有 1 到 ' + history.length + ' 条记录）。');
        return;
      }

      closeCustomRangeModal();
      const slice = history.slice(startVal - 1, endVal);
      const ctx = getCurrentPalaceTargetContext();
      const loadingNotice = alertModalLoading(`正在提炼第 ${startVal} 到 ${endVal} 条的记忆...`);

      try {
        const { summaryText, tags } = await generateSummaryWithAi(slice, startVal, endVal, ctx);
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        const newId = 'mem_' + Date.now();
        const tabCards = getVisiblePalaceCards().filter(c => !c.level);
        const newTitle = '存档 ' + (tabCards.length + 1);

        // 为片段中每条消息固化永久唯一指纹 ID，防止后续删除错位
        slice.forEach((m, i) => {
          if (!m.id) m.id = 'msg_' + (m.timestamp || (Date.now() + '_' + (startVal + i) + '_' + Math.random().toString(36).slice(2, 6)));
        });

        const firstTime = slice[0].time || dateStr;
        const lastTime = slice[slice.length - 1].time || dateStr;

        const newCard = {
          id: newId,
          category: currentPalaceTab,
          chatScope: currentPalaceTab === 'wechat' ? ctx.scope : '',
          targetId: currentPalaceTab === 'wechat' ? ctx.id : '',
          targetName: currentPalaceTab === 'wechat' ? ctx.name : '',
          level: 0,
          title: newTitle,
          dateStr: dateStr,
          msgRangeStr: `消息 ${startVal}-${endVal} · 共${slice.length}条`,
          timeRangeStr: `共 ${slice.length} 条记录 (${firstTime} - ${lastTime})`,
          summary: summaryText,
          tags: tags,
          startIdx: startVal - 1,
          endIdx: endVal,
          startMsgId: slice[0]?.id || null,
          endMsgId: slice[slice.length - 1]?.id || null,
          msgIds: slice.map(m => m.id),
          chatDeleted: false,
          createdAt: Date.now()
        };

        if (!appData.palaceMemories) appData.palaceMemories = [];
        appData.palaceMemories.unshift(newCard);
        updatePalaceTargetConfig({ pointer: endVal });
        savePalaceStore();

        if (loadingNotice && loadingNotice.remove) loadingNotice.remove();
        renderPalaceMemories();
        alert('✨ 自定义范围记忆生成成功！已加入「' + (currentPalaceTab === 'wechat' ? palaceCurrentWechatName() : '记忆宫殿') + '」列表！');
      } catch (e) {
        if (loadingNotice && loadingNotice.remove) loadingNotice.remove();
        alert('总结失败：' + e.message);
      }
    };

    // 合并为大总结 / 大大总结
    window.mergeSelectedToBigSummary = async function() {
      if (selectedPalaceCardIds.size < 2) return;
      const tabCards = getVisiblePalaceCards();
      const selectedCards = tabCards.filter(c => selectedPalaceCardIds.has(c.id));
      if (selectedCards.length < 2) return;

      const ctx = getCurrentPalaceTargetContext();
      const maxLevel = Math.max(...selectedCards.map(c => c.level || 0));
      const targetLevel = maxLevel + 1;
      let newTitlePrefix = '大总结';
      if (targetLevel === 2) newTitlePrefix = '大大总结';
      else if (targetLevel >= 3) newTitlePrefix = '大大大总结';

      const existingTierCount = tabCards.filter(c => c.level === targetLevel).length;
      const newTitle = `${newTitlePrefix} ${existingTierCount + 1}`;

      const loadingNotice = alertModalLoading(`正在将 ${selectedCards.length} 篇存档融会贯通，提炼高维【${newTitle}】...`);

      try {
        const cleanBase = appData.apiBase.replace(/\/+$/, '') + (appData.apiBase.endsWith('/chat/completions') ? '' : '/chat/completions');

        const combinedContext = selectedCards.map((c, i) => {
          return `### 记忆分卷 ${i+1}：${c.title} (${c.dateStr || ''})\n${c.summary || c.content || ''}\n关键词：${(c.tags || []).join(', ')}`;
        }).join('\n\n');

        const mergePrompt = `你是一位把多篇记忆分卷融会贯通成更高层编年史的记忆整理官。当前对象：${ctx.name || '这段关系'}。
请将下方 ${selectedCards.length} 篇重要记忆分卷进行宏观升华，提炼为一篇更高维度的【${newTitlePrefix}】。
【要求】：
1. 篇幅在 180 到 350 字之间，格局更宏观，但必须保留具体事件与人物。
2. 既保留标志性生活细节与约定，又清晰刻画出这一时期的羁绊与变化。
3. 文笔克制、温润，拒绝空洞套话与客服腔。
4. 结尾另起一行以【关键词】：提炼 6 到 10 个代表该时期的标志性回忆标签。
${ctx.scope === 'group' ? '5. 这是群聊记忆，保留不同成员各自的关键发言与关系变化，不要合并成一个人的口吻。' : ''}`;

        const resp = await fetch(cleanBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + appData.apiKey
          },
          body: JSON.stringify({
            model: appData.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: mergePrompt },
              { role: 'user', content: combinedContext }
            ],
            temperature: 0.7
          })
        });

        if (!resp.ok) throw new Error('合并接口响应异常');
        const data = await resp.json();
        const rawOutput = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';

        let summaryText = rawOutput;
        let tags = ['记忆分卷', '金字塔沉淀', '事件纪要'];
        if (rawOutput.includes('【关键词】')) {
          const parts = rawOutput.split('【关键词】');
          summaryText = parts[0].trim();
          const kwPart = parts[1].replace(/^[：:]\s*/, '').split('\n')[0].trim();
          tags = kwPart.split(/[,，、\s]+/).filter(Boolean);
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        const newCard = {
          id: 'tier_' + Date.now(),
          category: currentPalaceTab,
          chatScope: currentPalaceTab === 'wechat' ? ctx.scope : '',
          targetId: currentPalaceTab === 'wechat' ? ctx.id : '',
          targetName: currentPalaceTab === 'wechat' ? ctx.name : '',
          level: targetLevel,
          title: newTitle,
          dateStr: dateStr,
          msgRangeStr: `由 ${selectedCards.length} 篇回忆分卷升华提炼`,
          timeRangeStr: `涵盖 ${selectedCards.length} 段记忆历程`,
          summary: summaryText,
          tags: tags,
          childIds: Array.from(selectedPalaceCardIds),
          createdAt: Date.now()
        };

        appData.palaceMemories.unshift(newCard);
        savePalaceStore();
        selectedPalaceCardIds.clear();

        if (loadingNotice && loadingNotice.remove) loadingNotice.remove();
        renderPalaceMemories();
        alert(`🎉 恭喜user！已成功凝聚出全新宏伟记忆——【${newTitle}】！`);
      } catch(e) {
        if (loadingNotice && loadingNotice.remove) loadingNotice.remove();
        alert('合并失败：' + e.message);
      }
    };

    // 编辑卡片
    window.openEditCardModal = function(cardId) {
      const card = (appData.palaceMemories || []).find(c => c.id === cardId);
      if (!card) return;
      editingCardTargetId = cardId;
      const titleEl = document.getElementById('input-edit-card-title');
      const bodyEl = document.getElementById('textarea-edit-card-body');
      const modalEl = document.getElementById('modal-palace-edit-card');

      if (titleEl) titleEl.value = card.title || '';
      if (bodyEl) bodyEl.value = card.summary || card.content || '';
      if (modalEl) modalEl.classList.add('open');

      // 强制唤起文本框光标，彻底消灭不出现光标与无法编辑
      setTimeout(() => {
        if (bodyEl) {
          bodyEl.focus();
          // 光标置于文本末尾
          const len = bodyEl.value.length;
          bodyEl.setSelectionRange(len, len);
        }
      }, 180);
    };

    window.closeEditCardModal = function() {
      document.getElementById('modal-palace-edit-card').classList.remove('open');
      editingCardTargetId = null;
    };

    window.saveEditedCardContent = function() {
      if (!editingCardTargetId) return;
      const card = (appData.palaceMemories || []).find(c => c.id === editingCardTargetId);
      if (card) {
        card.title = document.getElementById('input-edit-card-title').value.trim() || card.title;
        card.summary = document.getElementById('textarea-edit-card-body').value.trim();
        localStorage.setItem('momo_palace_memories', JSON.stringify(appData.palaceMemories));
        closeEditCardModal();
        renderPalaceMemories();
      }
    };

    function removeLegacyGroupMemoryForCard(card) {
      if (!card || !card.legacyGroupMemoryId || !card.targetId) return;
      const g = palaceGroupById(card.targetId);
      if (!g || !g.settings) return;
      g.settings.memory = (g.settings.memory || []).filter(m => m.id !== card.legacyGroupMemoryId);
      if (typeof window.persistGroups === 'function') window.persistGroups();
    }

    // 删除单张卡片 (100% 灵敏响应)
    window.deleteSinglePalaceCard = function(cardId) {
      if (confirm('确定从记忆库中删除这张记忆卡片吗？')) {
        const card = (appData.palaceMemories || []).find(c => c.id === cardId);
        removeLegacyGroupMemoryForCard(card);
        appData.palaceMemories = (appData.palaceMemories || []).filter(c => c.id !== cardId);
        selectedPalaceCardIds.delete(cardId);
        savePalaceStore();
        renderPalaceMemories();
      }
    };

    // 删除关联聊天记录 (周绪言重构：精准ID指纹消除 + 自动快照防护，杜绝任何位移错乱)
    window.deleteAssociatedChatHistory = function(cardId) {
      const card = (appData.palaceMemories || []).find(c => c.id === cardId);
      if (!card) return;
      if (card.chatDeleted) {
        alert('该记忆卡片绑定的聊天记录此前已被清理，无需重复操作。');
        return;
      }

      if (confirm(`确定清除「${card.title}」对应的聊天记录吗？\n系统会先做安全快照，尽量保证可撤销。`)) {
        // 先拍摄全量安全快照备份
        if (typeof window.saveChatSnapshot === 'function') {
          window.saveChatSnapshot('删除记忆卡片关联记录前: ' + card.title);
        }

        const isGroupCard = card.category === 'wechat' && card.chatScope === 'group';
        const group = isGroupCard ? palaceGroupById(card.targetId) : null;
        const singleCharId = (!isGroupCard && currentPalaceTab === 'wechat')
          ? (card.targetId || currentPalaceWechatTarget || palaceActiveCharId())
          : '';
        const hist = group ? (group.history || []) : getHistoryForCurrentTab();
        let deletedCount = 0;
        let remaining = hist;

        if (Array.isArray(card.msgIds) && card.msgIds.length > 0) {
          // 精准基于指纹 ID 集合滤除，绝不产生位移错位
          const idSet = new Set(card.msgIds);
          const initialLen = hist.length;
          remaining = hist.filter(m => !idSet.has(m.id));
          deletedCount = initialLen - remaining.length;
        } else if (card.startIdx !== undefined && card.endIdx !== undefined) {
          // 兼容旧格式卡片：使用安全截取
          const count = Math.max(0, card.endIdx - card.startIdx);
          remaining = hist.slice();
          remaining.splice(Math.max(0, card.startIdx), count);
          deletedCount = count;
        } else {
          alert('此卡片为大总结或亲笔记录，未直接绑定聊天消息。');
          return;
        }

        if (group) {
          group.history = remaining;
          if (typeof window.persistGroups === 'function') window.persistGroups();
        } else if (singleCharId) {
          if (typeof window.setChatHistoryForChar === 'function') {
            window.setChatHistoryForChar(singleCharId, remaining);
          } else {
            appData.chatHistory = remaining;
          }
        } else if (currentPalaceTab === 'rp') {
          appData.rpHistory = remaining;
        } else if (currentPalaceTab === 'reader') {
          appData.readerChatHistory = remaining;
        }

        // 标记该卡片的聊天已被清理
        card.chatDeleted = true;
        savePalaceStore();

        // 智能重校总结指针
        const newHist = group ? (group.history || []) : getHistoryForCurrentTab();
        const cfg = palaceTargetConfig();
        if (cfg.pointer > newHist.length) {
          updatePalaceTargetConfig({ pointer: newHist.length });
        }

        if (!group && currentPalaceTab === 'wechat' && singleCharId === palaceActiveCharId() && typeof loadChatHistory === 'function') loadChatHistory();
        renderPalaceMemories();
        alert(`✨ 精准清理完毕！共安全剥离 ${deletedCount} 条消息，其余聊天记录丝毫不受影响。当前剩余 ${newHist.length} 条。`);
      }
    };

    // 亲笔记录创建弹窗
    window.openCreatePalaceModal = function() {
      document.getElementById('input-palace-title').value = '';
      document.getElementById('input-palace-body').value = '';
      document.getElementById('modal-palace-create').classList.add('open');
    };

    window.closeCreatePalaceModal = function() {
      document.getElementById('modal-palace-create').classList.remove('open');
    };

    window.saveCreatePalace = function() {
      const title = document.getElementById('input-palace-title').value.trim();
      const body = document.getElementById('input-palace-body').value.trim();
      if (!title || !body) {
        alert('标题和内容都写一点吧，记忆宫殿还空着这一格。');
        return;
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const ctx = getCurrentPalaceTargetContext();
      if (currentPalaceTab === 'pen' && !ctx.id) {
        alert('先选一个角色或群聊，再把这段亲笔写进去。');
        return;
      }

      if (!appData.palaceMemories) appData.palaceMemories = [];
      const isPen = currentPalaceTab === 'pen';
      const scoped = currentPalaceTab === 'wechat' || isPen;
      const newCard = {
        id: (isPen ? 'pen_' : 'mem_') + Date.now(),
        category: currentPalaceTab,
        chatScope: scoped ? ctx.scope : '',
        targetId: scoped ? ctx.id : '',
        targetName: scoped ? ctx.name : '',
        level: isPen ? 2 : 0,
        layer: isPen ? 'core' : 'short',
        pinned: isPen,
        importance: isPen ? 5 : 2,
        manual: isPen,
        source: isPen ? 'pen-manual' : 'manual',
        title: title,
        dateStr: dateStr,
        summary: body,
        tags: isPen
          ? ['亲笔', ctx.scope === 'group' ? '群聊' : '角色']
          : (currentPalaceTab === 'wechat' ? ['亲笔便签', ctx.scope === 'group' ? '群聊' : '私聊'] : ['亲笔雕刻', '不可忘却']),
        createdAt: Date.now()
      };

      appData.palaceMemories.unshift(newCard);
      savePalaceStore();
      closeCreatePalaceModal();
      renderPalaceMemories();
      alert(isPen ? '✍️ 亲笔已存入「' + (ctx.name || '当前对象') + '」，会自动排在总结记忆之前。' : '✨ 记忆已成功雕刻进记忆宫殿！');
    };

    // 全屏加载框
    function alertModalLoading(msg) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:600;';
      el.innerHTML = `<div style="font-size:36px;margin-bottom:12px;animation:spin 1s linear infinite;">⏳</div><div>${msg}</div>`;
      document.body.appendChild(el);
      return el;
    }
