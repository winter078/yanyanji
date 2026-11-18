(function () {
  'use strict';

  var editingMaskId = '';
  var editingAvatar = '';
  var editingIsNew = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function activeChar() {
    if (typeof window.getActiveCharacter === 'function') {
      try { return window.getActiveCharacter(); } catch (e) {}
    }
    return null;
  }

  function charId() {
    var c = activeChar();
    return c && c.id ? c.id : '';
  }

  function baseName() {
    var a = window.appData || {};
    return (a.hero && a.hero.userName) || a.userNickname || localStorage.getItem('momo_user_nick') || '我';
  }

  function baseAvatar() {
    var a = window.appData || {};
    return a.heroAvatar || localStorage.getItem('momo_hero_avatar') || '';
  }

  function nowStr() {
    if (typeof window.getNowStr === 'function') {
      try { return window.getNowStr(); } catch (e) {}
    }
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function toast(text) {
    if (typeof window.toast === 'function') {
      try { window.toast(text); return; } catch (e) {}
    }
    console.log(text);
  }

  function setMaskTransition(fromName, toName, entering) {
    window.__momoMaskTransition = {
      fromName: String(fromName || ''),
      toName: String(toName || ''),
      entering: !!entering,
      at: Date.now()
    };
  }

  function avatarHtml(src, fallback) {
    if (src) {
      return '<img src="' + esc(src) + '" alt="" />';
    }
    return esc(String(fallback || '我').trim().slice(0, 1) || '我');
  }

  function maskForChar(id) {
    if (typeof window.getMaskForChar !== 'function') return null;
    try { return window.getMaskForChar(id); } catch (e) { return null; }
  }

  function masksForChar(id) {
    if (typeof window.getCharacterMasks !== 'function') return [];
    try { return window.getCharacterMasks(id) || []; } catch (e) { return []; }
  }

  function ensureSheet() {
    var existing = document.getElementById('wx-mask-mask');
    if (existing) return existing;
    var wrap = document.createElement('div');
    wrap.id = 'wx-mask-mask';
    wrap.className = 'ca-mask mask-layer';
    wrap.innerHTML =
      '<div class="ca-sheet mask-sheet" role="dialog" aria-modal="true" aria-label="面具 / 小号">' +
        '<div class="ca-grab"></div>' +
        '<div class="ca-header">' +
          '<div>' +
            '<div class="ca-title" id="wx-mask-title">我的面具</div>' +
            '<div class="ca-sub" id="wx-mask-sub">同一个聊天框，换一个身份让他重新认识你</div>' +
          '</div>' +
          '<button type="button" class="ca-close" id="wx-mask-close" aria-label="关闭">✕</button>' +
        '</div>' +
        '<div class="mask-body" id="wx-mask-body"></div>' +
      '</div>';
    document.body.appendChild(wrap);
    var closeBtn = document.getElementById('wx-mask-close');
    if (closeBtn) closeBtn.onclick = closeMaskSheet;
    wrap.addEventListener('click', function (event) {
      if (event.target === wrap) closeMaskSheet();
    });
    var body = document.getElementById('wx-mask-body');
    if (body) {
      body.addEventListener('click', function (event) {
        var target = event.target;
        while (target && target !== body) {
          if (target.classList && target.classList.contains('mask-row')) {
            var maskId = target.getAttribute('data-mask-id') || '';
            switchMask(maskId);
            return;
          }
          if (target.classList && target.classList.contains('mask-row-action')) {
            var editId = target.getAttribute('data-edit-id') || '';
            var delId = target.getAttribute('data-del-id') || '';
            if (editId) {
              openMaskEditor(editId === '__base__' ? '' : editId);
              return;
            }
            if (delId) {
              deleteMask(delId);
              return;
            }
          }
          target = target.parentNode;
        }
      });
    }
    return wrap;
  }

  function currentMaskSummary() {
    var id = charId();
    var mask = maskForChar(id);
    return {
      name: mask ? mask.name : baseName(),
      avatar: mask ? mask.avatar : baseAvatar(),
      isBase: !mask,
      mask: mask
    };
  }

  function renderMaskList() {
    var body = document.getElementById('wx-mask-body');
    if (!body) return;
    var title = document.getElementById('wx-mask-title');
    var sub = document.getElementById('wx-mask-sub');
    if (title) title.innerText = '我的面具';
    if (sub) sub.innerText = '同一个聊天框，角色眼里可以换一个人；旧记录仍留在聊天里';

    var id = charId();
    if (!id) {
      body.innerHTML = '<div class="mask-tip">先打开一个角色单聊，再来设置面具。</div>';
      return;
    }

    var current = currentMaskSummary();
    var list = masksForChar(id);
    var rows = '';

    rows += '<div class="mask-row' + (current.isBase ? ' is-active' : '') + '" data-mask-id="">' +
      '<div class="mask-avatar">' + avatarHtml(baseAvatar(), baseName()) + '</div>' +
      '<div class="mask-row-main">' +
        '<div class="mask-row-name">' + esc(baseName()) + '</div>' +
        '<div class="mask-row-sub">默认身份 · 全局「我」的档案</div>' +
      '</div>' +
      (current.isBase ? '<span class="mask-current-pill">当前</span>' : '') +
      '<button type="button" class="mask-row-action" data-edit-id="__base__" aria-label="编辑默认身份">编辑</button>' +
    '</div>';

    list.forEach(function (m) {
      var isActive = !current.isBase && current.mask && current.mask.id === m.id;
      rows += '<div class="mask-row' + (isActive ? ' is-active' : '') + '" data-mask-id="' + esc(m.id) + '">' +
        '<div class="mask-avatar">' + avatarHtml(m.avatar, m.name) + '</div>' +
        '<div class="mask-row-main">' +
          '<div class="mask-row-name">' + esc(m.name) + '</div>' +
          '<div class="mask-row-sub">' + esc(m.remark ? '他会叫你「' + m.remark + '」' : (m.profile || '自定义小号身份')) + '</div>' +
        '</div>' +
        (isActive ? '<span class="mask-current-pill">当前</span>' : '') +
        '<button type="button" class="mask-row-action" data-edit-id="' + esc(m.id) + '" aria-label="编辑这个小号">编辑</button>' +
      '</div>';
    });

    body.innerHTML =
      '<div class="mask-hero">' +
        '<div class="mask-avatar is-current">' + avatarHtml(current.avatar, current.name) + '</div>' +
        '<div class="mask-hero-main">' +
          '<div class="mask-hero-label">当前身份</div>' +
          '<div class="mask-hero-name">' + esc(current.name) + '</div>' +
          '<div class="mask-hero-sub">' + (current.isBase ? '角色看到的是全局「我」的档案' : '角色现在只把当前小号之后的消息当成和你聊天') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mask-section-label"><span>切换身份</span><span>' + list.length + ' 个小号</span></div>' +
      '<div class="mask-list">' + rows + '</div>' +
      '<div class="mask-actions">' +
        '<button type="button" class="mask-primary-btn" id="wx-mask-new-btn">＋ 新建小号</button>' +
        '<button type="button" class="mask-secondary-btn" id="wx-mask-edit-current-btn">编辑当前身份</button>' +
      '</div>' +
      '<div class="mask-tip">切换只影响角色当前看到的你：AI 只读取当前小号之后的消息；旧小号的消息仍保留在聊天界面和角色记忆宫殿里，不会进入当前上下文。</div>';

    var newBtn = document.getElementById('wx-mask-new-btn');
    if (newBtn) newBtn.onclick = function () { openMaskEditor(''); };
    var editCurrentBtn = document.getElementById('wx-mask-edit-current-btn');
    if (editCurrentBtn) editCurrentBtn.onclick = function () {
      if (current.isBase) {
        closeMaskSheet();
        if (typeof window.openPage === 'function') window.openPage('page-me');
        return;
      }
      openMaskEditor(current.mask.id);
    };
  }

  function renderMaskEditor() {
    var body = document.getElementById('wx-mask-body');
    if (!body) return;
    var id = charId();
    if (!id) return;
    var mask = editingMaskId ? (masksForChar(id).filter(function (m) { return m.id === editingMaskId; })[0] || null) : null;
    editingAvatar = mask ? (mask.avatar || '') : (editingAvatar || '');
    var title = document.getElementById('wx-mask-title');
    var sub = document.getElementById('wx-mask-sub');
    if (title) title.innerText = editingIsNew ? '新建小号' : '编辑身份';
    if (sub) sub.innerText = editingIsNew ? '角色会把你当成一个刚出现的新人' : '修改这个小号在角色眼里的资料';

    var name = mask ? mask.name : '';
    var remark = mask ? mask.remark : '';
    var appearance = mask ? mask.appearance : '';
    var profile = mask ? mask.profile : '';
    var handle = mask ? mask.handle : '';
    var tag = mask ? mask.tag : '';
    var location = mask ? mask.location : '';

    body.innerHTML =
      '<div class="mask-editor">' +
        '<div class="mask-editor-head">' +
          '<div class="mask-editor-avatar" id="mask-avatar-preview">' + avatarHtml(editingAvatar, name || '新') + '</div>' +
          '<div>' +
            '<button type="button" class="mask-editor-avatar-btn" id="mask-avatar-btn">选择头像</button>' +
            '<div style="font-size:10.5px;color:var(--color-text-secondary,#aaa);margin-top:5px;line-height:1.4;">只影响当前这个角色</div>' +
          '</div>' +
        '</div>' +
        '<div class="mask-field">' +
          '<label class="mask-field-label" for="wx-mask-name">名字（角色看到的你）</label>' +
          '<input class="mask-input" id="wx-mask-name" maxlength="24" value="' + esc(name) + '" placeholder="例：林夏" />' +
        '</div>' +
        '<div class="mask-field">' +
          '<label class="mask-field-label" for="wx-mask-remark">他会怎么叫你（可选）</label>' +
          '<input class="mask-input" id="wx-mask-remark" maxlength="32" value="' + esc(remark) + '" placeholder="不填就用名字" />' +
        '</div>' +
        '<div class="mask-field">' +
          '<label class="mask-field-label" for="wx-mask-appearance">外貌特征（可选）</label>' +
          '<textarea class="mask-textarea" id="wx-mask-appearance" placeholder="例：短发、笑起来有梨涡、常穿灰色卫衣">' + esc(appearance) + '</textarea>' +
        '</div>' +
        '<div class="mask-field">' +
          '<label class="mask-field-label" for="wx-mask-profile">性格 / 习惯 / 和角色的关系（可选）</label>' +
          '<textarea class="mask-textarea" id="wx-mask-profile" placeholder="例：说话慢、不太会撒娇；和他是同事，第一次单独吃饭">' + esc(profile) + '</textarea>' +
        '</div>' +
        '<div class="mask-field">' +
          '<label class="mask-field-label" for="wx-mask-handle">账号昵称（可选）</label>' +
          '<input class="mask-input" id="wx-mask-handle" maxlength="40" value="' + esc(handle) + '" placeholder="例：夏夜汽水" />' +
        '</div>' +
        '<div class="mask-field">' +
          '<label class="mask-field-label" for="wx-mask-tag">签名 / 标签（可选）</label>' +
          '<input class="mask-input" id="wx-mask-tag" maxlength="24" value="' + esc(tag) + '" placeholder="例：不太爱回消息" />' +
        '</div>' +
        '<div class="mask-field">' +
          '<label class="mask-field-label" for="wx-mask-location">居住地 / 签名（可选）</label>' +
          '<input class="mask-input" id="wx-mask-location" maxlength="80" value="' + esc(location) + '" placeholder="例：厦门 · 海边" />' +
        '</div>' +
        '<input type="file" id="mask-avatar-file" accept="image/*" style="display:none;" />' +
        '<div class="mask-editor-actions">' +
          '<button type="button" class="mask-secondary-btn" id="mask-editor-cancel">取消</button>' +
          '<button type="button" class="mask-primary-btn" id="mask-editor-save">保存身份</button>' +
        '</div>' +
        (editingIsNew ? '' : '<button type="button" class="mask-delete-btn" id="mask-editor-delete">删除这个小号</button>') +
      '</div>';

    var avatarBtn = document.getElementById('mask-avatar-btn');
    var avatarFile = document.getElementById('mask-avatar-file');
    if (avatarBtn && avatarFile) {
      avatarBtn.onclick = function () { avatarFile.click(); };
      avatarFile.onchange = handleMaskAvatarChange;
    }
    var cancelBtn = document.getElementById('mask-editor-cancel');
    if (cancelBtn) cancelBtn.onclick = function () { editingMaskId = ''; editingAvatar = ''; editingIsNew = false; renderMaskList(); };
    var saveBtn = document.getElementById('mask-editor-save');
    if (saveBtn) saveBtn.onclick = saveMaskEditor;
    var delBtn = document.getElementById('mask-editor-delete');
    if (delBtn) delBtn.onclick = function () {
      if (editingMaskId) deleteMask(editingMaskId);
    };
  }

  function openMaskSheet() {
    var id = charId();
    if (!id) {
      toast('先打开一个角色单聊，再设置面具');
      return;
    }
    ensureSheet();
    renderMaskList();
    var wrap = document.getElementById('wx-mask-mask');
    if (wrap) wrap.classList.add('open');
  }

  function closeMaskSheet() {
    var wrap = document.getElementById('wx-mask-mask');
    if (wrap) wrap.classList.remove('open');
  }
  window.openMaskSheet = openMaskSheet;
  window.closeMaskSheet = closeMaskSheet;

  function openMaskEditor(maskId) {
    ensureSheet();
    var id = charId();
    if (!id) return;
    editingMaskId = maskId || '';
    editingIsNew = !editingMaskId;
    editingAvatar = '';
    if (editingMaskId) {
      var mask = masksForChar(id).filter(function (m) { return m.id === editingMaskId; })[0];
      editingAvatar = mask ? (mask.avatar || '') : '';
    }
    renderMaskEditor();
    var wrap = document.getElementById('wx-mask-mask');
    if (wrap) wrap.classList.add('open');
  }
  window.openMaskEditor = openMaskEditor;

  function handleMaskAvatarChange(event) {
    var input = event && event.target ? event.target : document.getElementById('mask-avatar-file');
    var file = input && input.files && input.files[0];
    if (!file) return;
    var finish = function (src) {
      if (!src) return;
      editingAvatar = src;
      var preview = document.getElementById('mask-avatar-preview');
      if (preview) preview.innerHTML = '<img src="' + esc(src) + '" alt="" />';
    };
    if (typeof window.compressImageBase64 === 'function') {
      window.compressImageBase64(file, 480, 0.82).then(finish).catch(function () {
        var reader = new FileReader();
        reader.onload = function (e) { finish(e && e.target ? e.target.result : ''); };
        reader.readAsDataURL(file);
      });
    } else {
      var reader = new FileReader();
      reader.onload = function (e) { finish(e && e.target ? e.target.result : ''); };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }
  window.handleMaskAvatarChange = handleMaskAvatarChange;

  function saveMaskEditor() {
    var id = charId();
    if (!id) return;
    var nameEl = document.getElementById('wx-mask-name');
    var name = nameEl ? String(nameEl.value || '').trim() : '';
    if (!name) {
      toast('先给这个小号起个名字');
      if (nameEl) nameEl.focus();
      return;
    }
    var fields = {
      name: name,
      avatar: editingAvatar || '',
      remark: (document.getElementById('wx-mask-remark') || {}).value || '',
      appearance: (document.getElementById('wx-mask-appearance') || {}).value || '',
      profile: (document.getElementById('wx-mask-profile') || {}).value || '',
      handle: (document.getElementById('wx-mask-handle') || {}).value || '',
      tag: (document.getElementById('wx-mask-tag') || {}).value || '',
      location: (document.getElementById('wx-mask-location') || {}).value || ''
    };
    var wasNew = editingIsNew;
    var currentNameBeforeSave = currentMaskSummary().name;
    var saved = typeof window.saveCharacterMask === 'function'
      ? window.saveCharacterMask(id, editingMaskId, fields)
      : null;
    if (!saved) {
      toast('保存失败，角色数据还没准备好');
      return;
    }
    if (wasNew && typeof window.setActiveCharacterMask === 'function') {
      window.setActiveCharacterMask(id, saved.id);
      setMaskTransition(currentNameBeforeSave, saved.name, true);
    }
    editingMaskId = '';
    editingAvatar = '';
    editingIsNew = false;
    renderMaskList();
    toast(wasNew ? '新小号已保存，并切换到「' + saved.name + '」' : '身份已保存');
  }
  window.saveMaskEditor = saveMaskEditor;

  function deleteMask(maskId) {
    if (!maskId) return;
    if (!confirm('删除这个小号？\n聊天记录不会删，只是不再出现在面具列表里。')) return;
    if (typeof window.deleteCharacterMask !== 'function') return;
    window.deleteCharacterMask(charId(), maskId);
    editingMaskId = '';
    editingAvatar = '';
    editingIsNew = false;
    renderMaskList();
    toast('已删除这个小号');
  }
  window.deleteMask = deleteMask;

  function switchMask(maskId) {
    var id = charId();
    if (!id) return;
    var current = maskForChar(id);
    var currentId = current ? current.id : '';
    if (currentId === (maskId || '')) return;
    var currentName = current ? current.name : baseName();
    var nextMask = maskId ? (masksForChar(id).filter(function (m) { return m.id === maskId; })[0] || null) : null;
    var nextName = nextMask ? nextMask.name : baseName();
    var text = nextMask
      ? '你换上了「' + nextName + '」的身份，角色眼里现在是另一个人'
      : '你换回了「' + nextName + '」的默认身份';

    var a = window.appData || {};
    if (typeof window.pushChatSystemNotice === 'function') {
      window.pushChatSystemNotice(null, text);
    } else if (Array.isArray(a.chatHistory)) {
      a.chatHistory.push({ role: 'system', content: text, time: nowStr(), hiddenFromAI: true, maskNotice: true });
    }
    if (typeof window.setActiveCharacterMask === 'function') {
      window.setActiveCharacterMask(id, maskId || '');
    }
    setMaskTransition(currentName, nextName, !!nextMask);
    if (typeof window.saveChatHistoryNow === 'function') {
      try { window.saveChatHistoryNow(); } catch (e) {}
    }
    if (typeof window.loadChatHistory === 'function') {
      try { window.loadChatHistory(); } catch (e) {}
    }
    renderMaskList();
  }
  window.switchMask = switchMask;

  function syncMaskEntry() {
    var nameEl = document.getElementById('mask-entry-name');
    var subEl = document.getElementById('mask-entry-sub');
    if (!nameEl && !subEl) return;
    var current = currentMaskSummary();
    if (nameEl) nameEl.innerText = current.name;
    if (subEl) {
      subEl.innerText = current.isBase
        ? '当前使用「我」的全局档案；切换后旧记录仍留在聊天里'
        : '角色现在把你当成「' + current.name + '」；只读取当前小号之后的消息';
    }
  }
  window.syncMaskEntry = syncMaskEntry;

  function applyMaskToChatUI() {
    syncMaskEntry();
    var id = charId();
    if (id && typeof window.applyChatAppearance === 'function') {
      try { window.applyChatAppearance(id); } catch (e) {}
    }
    if (typeof window.syncWechatMainPreview === 'function') {
      try { window.syncWechatMainPreview(); } catch (e) {}
    }
  }
  window.applyMaskToChatUI = applyMaskToChatUI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      try { syncMaskEntry(); } catch (e) {}
    });
  } else {
    setTimeout(function () {
      try { syncMaskEntry(); } catch (e) {}
    }, 0);
  }
})();
