/* ================= 语音通话 · 单聊 =================
   - 没有真实电话；通话记录只存文字
   - 按住说话仍由 voice-input.js 调用 SpeechRecognition，只取文字
   - 用户松手后文字直接进入通话气泡，再走原有单聊生成
   - 角色回复从 chatHistory 取出，渲染成通话气泡；气泡上的朗读键走角色语音 */
(function () {
  'use strict';

  var state = {
    open: false,
    active: false,
    busy: false,
    mode: 'incoming',
    startedAt: 0,
    timer: null,
    clockTimer: null,
    elapsed: 0,
    messages: 0,
    transcript: [],
    recordId: '',
    recordCharId: '',
    recordView: false,
    pendingRecordId: '',
    minimized: false,
    groupId: '',
    groupName: '',
    groupMembers: [],
    groupCall: false,
    groupTurn: 0,
    groupCallerId: '',
    incomingReason: '',
    replyMode: 'text'
  };

  var els = {};
  var pickerGroup = null;
  var pickerSelected = [];
  var callSpeakQueue = [];
  var callSpeakBusy = false;

  function $(id) { return document.getElementById(id); }
  function app() {
    // store.js 的 appData 是全局词法绑定，不一定挂在 window 上。
    try { if (typeof appData !== 'undefined' && appData) return appData; } catch (e) {}
    return window.appData || {};
  }

  function activeChar() {
    try {
      return (typeof window.getActiveCharacter === 'function') ? window.getActiveCharacter() : null;
    } catch (e) { return null; }
  }

  function currentCharId() {
    var c = activeChar();
    if (c && c.id) return String(c.id);
    var a = app();
    return String(a.activeChatCharId || a.currentCharId || 'default');
  }

  function activeGroup() {
    if (state.groupId && typeof window.findGroup === 'function') {
      return window.findGroup(state.groupId);
    }
    return null;
  }

  function groupCardList(g) {
    var ids = (g && g.members) || [];
    var muted = (g && Array.isArray(g.mutedIds)) ? g.mutedIds : [];
    var cards = (typeof window.getCharacters === 'function') ? (window.getCharacters() || []) : [];
    return ids.map(function (id) {
      if (id === 'me') return null;
      return cards.filter(function (c) { return c && c.id === id; })[0] || null;
    }).filter(function (c) { return c && muted.indexOf(c.id) < 0; });
  }

  function groupMemberAvatar(m) {
    return (m && (m.avatar || m.avatarData)) || '';
  }

  function groupSelfAvatar() {
    var a = app();
    return localStorage.getItem('momo_user_avatar') || a.heroAvatar || a.userAvatar || a.momentsAvatar || '';
  }

  function groupSelfName() {
    var a = app();
    return a.userNickname || localStorage.getItem('momo_user_nick') || localStorage.getItem('momo_user_nickname') || '你';
  }

  function makeRecordId() {
    return 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  var CALL_RECORD_KEY = 'momo_call_records_v1';

  function readCallRecords() {
    try {
      var parsed = JSON.parse(localStorage.getItem(CALL_RECORD_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }

  function writeCallRecords(all) {
    try {
      localStorage.setItem(CALL_RECORD_KEY, JSON.stringify(all));
    } catch (e) { console.warn('[Call] 通话记录保存失败：', e); }
  }

  function saveCallRecord(record) {
    if (!record || !record.id || !record.messages || !record.messages.length) return null;
    var all = readCallRecords();
    all[record.id] = record;
    var ids = Object.keys(all).sort(function (a, b) {
      return (all[b].startedAt || 0) - (all[a].startedAt || 0);
    });
    ids.slice(60).forEach(function (id) { delete all[id]; });
    writeCallRecords(all);
    return record;
  }

  function getCallRecord(id) {
    if (!id) return null;
    var all = readCallRecords();
    return all[String(id)] || null;
  }

  function botName() {
    var g = activeGroup();
    if (g) return g.name || '群聊';
    var c = activeChar();
    var a = app();
    return a.botRemark || (a.hero && a.hero.botName) || (c && c.name) || '角色';
  }

  function userName() {
    var a = app();
    return a.userNickname || (a.hero && a.hero.userName) || localStorage.getItem('momo_user_nickname') || localStorage.getItem('momo_user_nick') || '你';
  }

  function botAvatar() {
    var g = activeGroup();
    if (g) {
      var ms = groupCardList(g);
      return ms.length ? groupMemberAvatar(ms[0]) : '';
    }
    var c = activeChar();
    var a = app();
    return a.botAvatar || (a.hero && a.hero.botAvatar) ||
      (c && (c.avatarData || c.avatar)) ||
      localStorage.getItem('momo_bot_avatar') || '';
  }

  function userAvatar() {
    var a = app();
    return localStorage.getItem('momo_user_avatar') ||
      a.userAvatar || (a.hero && a.hero.userAvatar) || '';
  }

  function nowTime() {
    try {
      return (typeof window.getNowStr === 'function') ? window.getNowStr() : '';
    } catch (e) { return ''; }
  }

  function toast(message) {
    try {
      if (typeof window.showToast === 'function') { window.showToast(message); return; }
      var old = document.getElementById('call-toast');
      if (old) old.remove();
      var el = document.createElement('div');
      el.id = 'call-toast';
      el.textContent = message;
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(100px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:420;max-width:min(310px,calc(100vw - 44px));padding:9px 13px;border-radius:12px;background:rgba(24,26,31,.94);border:0.5px solid rgba(255,255,255,.12);color:#f4efec;font-size:12px;line-height:1.45;text-align:center;box-shadow:0 8px 26px rgba(0,0,0,.34);pointer-events:none;';
      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.remove(); }, 2600);
    } catch (e) {}
  }

  function formatTimer(ms) {
    var sec = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = String(text || '');
  }

  function setAvatar(imgEl, fallbackEl, src, name) {
    if (!imgEl || !fallbackEl) return;
    var letter = String(name || '?').trim().slice(0, 1) || '?';
    fallbackEl.textContent = letter;
    imgEl.classList.remove('is-loaded');
    imgEl.onload = function () { imgEl.classList.add('is-loaded'); };
    imgEl.onerror = function () { imgEl.classList.remove('is-loaded'); imgEl.removeAttribute('src'); };
    if (src) {
      imgEl.src = src;
    } else {
      imgEl.removeAttribute('src');
    }
  }

  function syncFloatTimer(ms) {
    if (ms === undefined || ms === null) {
      ms = state.elapsed || (state.startedAt ? (Date.now() - state.startedAt) : 0);
    }
    setText('call-float-timer', formatTimer(ms));
  }

  function syncFloatIdentity() {
    var name = botName();
    setText('call-float-name', name);
    setAvatar($('call-float-avatar-img'), $('call-float-letter'), botAvatar(), name);
    syncFloatTimer();
  }

  function clearFloatBubbles() {
    var box = $('call-float-bubbles');
    if (box) box.innerHTML = '';
  }

  function appendFloatBubble(role, text, speakerName) {
    if (!state.minimized || role !== 'assistant' || !text) return;
    var box = $('call-float-bubbles');
    if (!box) return;
    var name = String(speakerName || botName() || '角色').trim();
    var bubble = document.createElement('div');
    bubble.className = 'call-float-bubble';
    var who = document.createElement('b');
    who.textContent = name + '：';
    bubble.appendChild(who);
    bubble.appendChild(document.createTextNode(String(text)));
    box.appendChild(bubble);
    while (box.children.length > 3) box.removeChild(box.firstElementChild);
  }

  function setFloatVoiceState(mode, payload) {
    var float = els.float || $('call-float');
    if (!float) return;
    float.classList.toggle('is-recording', mode === 'listening' || mode === 'preview');
    float.classList.toggle('is-thinking', mode === 'thinking');
    var hint = $('call-float-hint');
    if (!hint) return;
    if (mode === 'listening') {
      hint.textContent = '松手发送';
    } else if (mode === 'preview') {
      var preview = String(payload || '').replace(/\s+/g, ' ').trim();
      if (preview.length > 10) preview = preview.slice(0, 10) + '…';
      hint.textContent = preview ? '听见了：' + preview : '松手发送';
    } else if (mode === 'transcribing') {
      hint.textContent = '转写中…';
    } else if (mode === 'thinking') {
      hint.textContent = '我在想…';
    } else if (mode === 'error') {
      hint.textContent = '没听清，再按';
    } else {
      hint.textContent = '轻点回 · 长按说';
    }
  }

  function showFloat() {
    var float = els.float || $('call-float');
    if (!float) return;
    clearFloatBubbles();
    syncFloatIdentity();
    float.hidden = false;
    float.setAttribute('aria-hidden', 'false');
    window.__voiceCallMinimized = true;
    setFloatVoiceState(state.busy ? 'thinking' : 'idle');
  }

  function hideFloat() {
    var float = els.float || $('call-float');
    if (float) {
      float.hidden = true;
      float.setAttribute('aria-hidden', 'true');
      float.classList.remove('is-recording', 'is-thinking');
    }
    window.__voiceCallMinimized = false;
    state.minimized = false;
  }

  function minimizeCall() {
    if (!state.open || !state.active || state.minimized || !els.overlay) return;
    state.minimized = true;
    showFloat();
    els.overlay.classList.remove('is-open');
    els.overlay.setAttribute('aria-hidden', 'true');
  }

  function restoreCall() {
    if (!state.open || !state.active || !els.overlay) return;
    hideFloat();
    setStage(false);
    els.overlay.classList.add('is-open');
    els.overlay.setAttribute('aria-hidden', 'false');
  }


  function updateClock() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    setText('call-status-time', hh + ':' + mm);
    setText('call-notify-time', '现在');
    if (state.active) {
      var ms = state.startedAt ? (Date.now() - state.startedAt) : 0;
      state.elapsed = ms;
      setText('call-timer', formatTimer(ms));
      syncFloatTimer(ms);
    }
  }

  function setCallBackground() {
    var bg = els.callBg;
    if (!bg) return;
    var layer = $('chat-wallpaper-bg');
    var image = '';
    if (layer) {
      try { image = getComputedStyle(layer).backgroundImage || ''; } catch (e) {}
      if (!image || image === 'none') image = layer.style.backgroundImage || '';
    }
    if (image && image !== 'none' && image !== 'url("")' && image !== "url('')") {
      bg.style.backgroundImage = image;
    } else {
      bg.style.backgroundImage = 'radial-gradient(120% 80% at 22% 8%, rgba(126, 145, 118, .42), transparent 62%), radial-gradient(110% 70% at 82% 76%, rgba(160, 128, 122, .3), transparent 56%), linear-gradient(145deg, #1c1a20, #0c0c10)';
    }
  }

  function fillIdentity() {
    var bName = botName();
    var uName = userName();
    var bAvatar = botAvatar();
    var uAvatar = userAvatar();

    setText('call-notify-name', bName + ' 来电');
    setText('call-notify-sub', '语音通话 · 来自 ' + bName + ' 的手机');
    setText('call-incoming-name', bName);
    setText('call-incoming-line', '接通以后，我只听你说话。');
    setText('call-incoming-tag', '这是 ' + bName + ' 的来电');
    setText('call-char-name', bName);
    setText('call-user-name', uName);
    setText('call-user-letter', String(uName).slice(0, 1) || '你');

    setAvatar($('call-incoming-avatar'), $('call-incoming-letter'), bAvatar, bName);
    setAvatar($('call-char-avatar'), $('call-char-letter'), bAvatar, bName);
    setAvatar($('call-user-avatar'), $('call-user-letter'), uAvatar, uName);
  }

  function setStage(incoming) {
    if (els.incomingStage) els.incomingStage.hidden = !incoming;
    if (els.activeStage) els.activeStage.hidden = !!incoming;
    var recordStage = $('call-record-stage');
    if (recordStage) recordStage.hidden = true;
  }

  function setMicDisabled(disabled) {
    if (!els.mic) return;
    els.mic.classList.toggle('is-disabled', !!disabled);
    els.mic.disabled = !!disabled;
  }

  function setPill(text, mode) {
    if (!els.pill) return;
    setText('call-status-text', text);
    els.pill.classList.toggle('is-listening', mode === 'listening');
    els.pill.classList.toggle('is-thinking', mode === 'thinking');
  }

  function setWave(active) {
    if (els.wave) els.wave.classList.toggle('is-listening', !!active);
    if (els.mic) els.mic.classList.toggle('is-recording', !!active);
  }

  function setHint(text, live) {
    if (!els.hint) return;
    els.hint.textContent = text;
    els.hint.classList.toggle('is-live', !!live);
  }

  function clearTranscript() {
    if (els.transcriptInner) els.transcriptInner.innerHTML = '';
    state.messages = 0;
    state.transcript = [];
  }

  function scrollTranscript() {
    if (!els.transcript) return;
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function cleanReplyText(raw) {
    var text = String(raw || '');
    // 思维链、心声与指令标记不进电话气泡
    text = text.replace(/<(?:think|thinking|thought)>[\s\S]*?<\/(?:think|thinking|thought)>/gi, '');
    text = text.replace(/<(?:think|thinking|thought)>[\s\S]*$/gi, '');
    text = text.replace(/<\/?(?:think|thinking|thought)>/gi, '');
    text = text.replace(/【心声】[：:]?[\s\S]*?---/g, '');
    text = text.replace(/【思维链】[：:]?[\s\S]*?---/g, '');
    text = text.replace(/【[^】\n]{1,18}】/g, '');
    text = text.replace(/\[\[SEARCHCARD:\d+\]\]/g, '');
    text = text.replace(/\[IMAGE:[^\]]*\]/g, '[图片]');
    text = text.replace(/\*[^*\n]{1,150}\*/g, '');
    text = text.replace(/[（(]\s*[）)]/g, '');
    text = text.split(/\n{3,}/).join('\n\n').trim();
    return text;
  }

  function callActionEnabled() {
    try {
      var s = app().chatSettings || {};
      return s.enableCallActionDesc !== false;
    } catch (e) { return true; }
  }

  function splitAssistantReply(raw) {
    var text = String(raw || '');
    var actions = [];
    if (callActionEnabled()) {
      text = text.replace(/\*([^*\n]{1,220})\*/g, function (_, action) {
        if (action && action.trim()) actions.push(action.trim());
        return '';
      });
    }
    return { text: cleanReplyText(text), action: actions.join('\n') };
  }

  function clearCallSpeechQueue() {
    callSpeakQueue = [];
    callSpeakBusy = false;
  }

  function drainCallSpeech() {
    if (callSpeakBusy || !callSpeakQueue.length) return;
    var job = callSpeakQueue.shift();
    callSpeakBusy = true;
    var finish = function () {
      var wait = Math.max(1200, Math.min(30000, String(job.text || '').length * 220));
      setTimeout(function () {
        callSpeakBusy = false;
        drainCallSpeech();
      }, wait);
    };
    try {
      var p = window.CharVoice.speak(job.text, { charId: job.charId, fallback: false });
      if (p && typeof p.then === 'function') p.then(finish, finish);
      else finish();
    } catch (e) {
      finish();
    }
  }

  function enqueueCallSpeech(text, charId) {
    var clean = String(text || '').trim();
    if (!clean || clean === '……') return;
    if (!window.CharVoice || typeof window.CharVoice.isEnabled !== 'function' || !window.CharVoice.isEnabled()) return;
    callSpeakQueue.push({ text: clean, charId: charId || currentCharId() });
    drainCallSpeech();
  }

  function renderCallReplyMode() {
    var box = $('call-reply-mode');
    if (!box) return;
    var buttons = box.querySelectorAll('[data-reply-mode]');
    for (var i = 0; i < buttons.length; i++) {
      var mode = buttons[i].getAttribute('data-reply-mode');
      buttons[i].classList.toggle('is-active', mode === state.replyMode);
    }
  }

  function setCallReplyMode(mode) {
    var next = String(mode) === 'voice' ? 'voice' : 'text';
    if (state.replyMode === next) return;
    state.replyMode = next;
    if (next === 'text') {
      clearCallSpeechQueue();
      try { if (window.CharVoice && typeof window.CharVoice.stop === 'function') window.CharVoice.stop(); } catch (e) {}
    } else if (!window.CharVoice || typeof window.CharVoice.isEnabled !== 'function' || !window.CharVoice.isEnabled()) {
      toast('语音 Key 还没接通，先显示文字');
    }
    renderCallReplyMode();
  }
  window.setCallReplyMode = setCallReplyMode;

  function appendMessage(role, rawText, meta, speaker) {
    var parsed = role === 'assistant' ? splitAssistantReply(rawText) : { text: String(rawText || '').trim(), action: '' };
    var text = parsed.text;
    var action = parsed.action || '';
    var speakerName = speaker && speaker.name ? String(speaker.name) : '';
    if (!text && !action) return;
    if (action) {
      var actionEl = document.createElement('div');
      actionEl.className = 'call-action-note';
      actionEl.textContent = speakerName ? (speakerName + ' · ' + action) : action;
      els.transcriptInner.appendChild(actionEl);
    }
    if (text) {
      var msg = document.createElement('div');
      msg.className = 'call-msg ' + (role === 'user' ? 'user' : 'assistant');
      if (speakerName && role !== 'user') {
        msg.classList.add('has-speaker');
        var speakerEl = document.createElement('div');
        speakerEl.className = 'call-msg-speaker';
        speakerEl.textContent = speakerName;
        msg.appendChild(speakerEl);
      }
      var bubble = document.createElement('div');
      bubble.className = 'call-bubble';
      bubble.textContent = text;
      msg.appendChild(bubble);
      var voiceMode = (state.replyMode === 'voice' && !state.recordView);
      if (role === 'assistant' && voiceMode && window.CharVoice &&
          typeof window.CharVoice.isEnabled === 'function' && window.CharVoice.isEnabled()) {
        var speakBtn = document.createElement('button');
        speakBtn.type = 'button';
        speakBtn.className = 'call-speak-btn';
        speakBtn.title = '听 TA 说';
        speakBtn.setAttribute('aria-label', '播放这条通话语音');
        speakBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5l-5 4H4z" fill="currentColor"></path><path d="M16.2 8.6a5.2 5.2 0 0 1 0 6.8M18.6 6.2a8.4 8.4 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path></svg>';
        speakBtn.onclick = function (e) {
          e.stopPropagation();
          try {
            window.CharVoice.speak(text, {
              charId: (speaker && speaker.id) || currentCharId(),
              btn: speakBtn
            });
          } catch (err) {}
        };
        bubble.appendChild(speakBtn);
        enqueueCallSpeech(text, (speaker && speaker.id) || currentCharId());
      }
      if (meta) {
        var m = document.createElement('div');
        m.className = 'call-msg-meta';
        m.textContent = meta;
        msg.appendChild(m);
      }
      els.transcriptInner.appendChild(msg);
      appendFloatBubble(role, text, speakerName);
    }
    state.messages += 1;
    state.transcript.push({
      role: role === 'user' ? 'user' : 'assistant',
      text: text,
      meta: String(meta || ''),
      action: action,
      speakerId: speaker && speaker.id ? String(speaker.id) : '',
      speakerName: speakerName,
      speakerAvatar: speaker && speaker.avatar ? String(speaker.avatar) : ''
    });
    scrollTranscript();
  }

  function showTyping() {
    if (!els.transcriptInner) return null;
    var wrap = document.createElement('div');
    wrap.className = 'call-msg assistant';
    wrap.id = 'call-typing-row';
    var typing = document.createElement('div');
    typing.className = 'call-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(typing);
    els.transcriptInner.appendChild(wrap);
    scrollTranscript();
    return wrap;
  }

  function removeTyping() {
    var row = $('call-typing-row');
    if (row) row.remove();
  }

  function startTimer() {
    stopTimer();
    state.startedAt = Date.now();
    state.elapsed = 0;
    setText('call-timer', '0:00');
    state.timer = setInterval(updateClock, 1000);
  }

  function stopTimer() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.startedAt) {
      state.elapsed = Date.now() - state.startedAt;
    }
  }

  function setConnecting(connecting) {
    if (els.incomingStage) els.incomingStage.classList.toggle('is-connecting', !!connecting);
    var btn = $('call-accept-btn');
    if (btn) btn.disabled = !!connecting;
    setText('call-accept-label', connecting ? '接通中' : '接听');
  }

  function setPeopleMode(groupMode) {
    var single = $('call-people-single');
    var groupBox = $('call-people-group');
    if (single) {
      single.hidden = !!groupMode;
      single.style.display = groupMode ? 'none' : 'flex';
    }
    if (groupBox) {
      groupBox.hidden = !groupMode;
      groupBox.style.display = groupMode ? 'flex' : 'none';
    }
  }

  function makeCallPerson(name, avatar, fallback) {
    var person = document.createElement('div');
    person.className = 'call-person';
    var avatarBox = document.createElement('div');
    avatarBox.className = 'call-person-avatar';
    var letter = document.createElement('span');
    letter.className = 'call-avatar-letter';
    letter.textContent = String(fallback || name || '?').trim().slice(0, 1) || '?';
    var img = document.createElement('img');
    img.alt = String(name || '') + '头像';
    img.onload = function () { img.classList.add('is-loaded'); };
    img.onerror = function () { img.classList.remove('is-loaded'); img.removeAttribute('src'); };
    if (avatar) img.src = avatar;
    avatarBox.appendChild(letter);
    avatarBox.appendChild(img);
    var nameEl = document.createElement('span');
    nameEl.className = 'call-person-name';
    nameEl.textContent = String(name || '');
    person.appendChild(avatarBox);
    person.appendChild(nameEl);
    return person;
  }

  function renderGroupPeople(members) {
    var box = $('call-people-group');
    if (!box) return;
    box.innerHTML = '';
    (members || []).forEach(function (m) {
      box.appendChild(makeCallPerson(m.name || '成员', groupMemberAvatar(m), m.name || '成'));
    });
    box.appendChild(makeCallPerson(groupSelfName(), groupSelfAvatar(), '你'));
  }

  function enterActive(replies) {
    state.active = true;
    state.busy = false;
    state.groupCall = false;
    window.__voiceCallMode = true;
    setPeopleMode(false);
    setStage(false);
    clearTranscript();
    startTimer();
    setPill('我在听', 'listening');
    setWave(false);
    setHint('按住话筒说话 · 松手转成文字', false);
    setMicDisabled(false);
    (replies || []).forEach(function (m, i) {
      appendMessage('assistant', m.content, i === 0 ? '接通' : '');
    });
    if (!window.VoiceInput.isSupported) {
      setHint('当前浏览器不支持语音识别，可以点下面打字', false);
      showTextFallback(true);
      toast('这个浏览器不支持语音识别，用文字也能继续通话');
    }
  }

  function enterGroupActive(openings) {
    state.active = true;
    state.busy = false;
    state.groupCall = true;
    window.__voiceCallMode = true;
    setPeopleMode(true);
    setStage(false);
    clearTranscript();
    startTimer();
    setPill((state.groupMembers.length + 1) + ' 人在线', 'listening');
    setWave(false);
    setHint('按住话筒说话 · 群里的人会接着聊', false);
    setMicDisabled(false);
    (openings || []).forEach(function (m, i) {
      appendMessage('assistant', m.content, i === 0 ? '接通' : '', {
        id: m.speakerId || '',
        name: m.speakerName || m.name || '',
        avatar: m.speakerAvatar || ''
      });
    });
    if (!window.VoiceInput.isSupported) {
      setHint('当前浏览器不支持语音识别，可以点下面打字', false);
      showTextFallback(true);
      toast('这个浏览器不支持语音识别，用文字也能继续通话');
    }
  }

  function callSystemPrompt(member) {
    var data = app();
    var isGroup = !!member;
    var g = isGroup ? activeGroup() : null;
    var bName = member ? (member.name || '成员') : botName();
    var uName = userName();
    var c = member || activeChar();
    var sys = '你是' + bName + '，正在和' + uName + '通电话。只写电话里说出口的台词，不要旁白、动作、心声、镜头、括号或表情包。';
    if (isGroup) {
      var others = (state.groupMembers || []).filter(function (m) { return m && member && m.id !== member.id; })
        .map(function (m) { return m.name; }).join('、');
      sys = '你是' + bName + '，正在群聊“' + ((g && g.name) || '群聊') + '”的语音通话里，和' + uName + (others ? '、' + others : '') + '一起通话。只写你自己在电话里说出口的台词；不要替其他成员说话，不要写旁白、心声、镜头或表情包。';
    }
    if (c && (c.persona || c.description || c.desc)) {
      sys += ' 人设参考：' + String(c.persona || c.description || c.desc).slice(0, 900);
    }
    if (!isGroup) {
      try {
        if (typeof window.getFullSystemPrompt === 'function') {
          var fullPrompt = window.getFullSystemPrompt();
          if (typeof fullPrompt === 'string' && fullPrompt.trim()) sys = fullPrompt;
        }
      } catch (e) {}
    }

    var s = (data.chatSettings || {});
    if (s.enableCallActionDesc !== false) {
      var person = s.callActionDescPerson || 'third';
      var length = s.callActionDescLength || 'medium';
      var writing = String(s.callActionDescWriting || '').trim();
      var lines = [
        '',
        '【通话动描（已开启）】：',
        '- 这是电话，不是文字聊天。每次回复时，在台词之外可以用 *动作/环境/神态* 写一小段现场动描，单独成行；界面会把它显示成灰色动描，台词仍走电话气泡。',
        '- 动描写角色此刻的声音、呼吸、手里的动作或周围的环境，不要写心声，不要替 ' + uName + ' 决定动作和内心，也不要用动描复述台词。',
        '- 不需要每句都加动描；只在有画面感的时候加一段，保持电话里的自然节奏。'
      ];
      if (person === 'second') {
        lines.push('- 人称：动描用第二人称称呼 ' + uName + ' 为“你”，写角色眼中的你和现场。');
      } else if (person === 'first') {
        lines.push('- 人称：动描用第一人称“我”，是角色自己的视角和自述。');
      } else {
        lines.push('- 人称：动描用第三人称，' + bName + ' 和 ' + uName + ' 都用名字或他/她；不要在动描里自称“我”。');
      }
      if (writing) {
        lines.push('- 写作要求：' + writing);
      } else if (length === 'short') {
        lines.push('- 写作要求：每段 20–40 字，短促克制，只写一个具体的小动作或一处环境变化。');
      } else if (length === 'long') {
        lines.push('- 写作要求：每段 80–140 字，可以写完整的动作过程、环境层次和角色细微的情绪变化。');
      } else {
        lines.push('- 写作要求：每段 40–80 字，细腻克制：写一个具体的小动作，再带一点声音、呼吸或温度，情绪藏在动作里。');
      }
      if (s.callActionDescContinuePlot) {
        lines.push('- 承接剧情：通话里自然带出环境变化或突发事件，把对话往下推；不要替 ' + uName + ' 决定言行。');
      }
      sys += '\n' + lines.join('\n');
    } else {
      sys += '\n【通话动描（已关闭）】：这次通话只写说出口的台词，不要动作、环境、神态、心声、镜头、括号或表情包，也不要用 *...* 包裹任何内容。';
    }
    if (isGroup) {
      sys += '\n【群聊通话】：只写 ' + bName + ' 自己的一句到两句话；不要连续写多个成员的台词，不要用“名字：”开头。';
    }
    return sys;
  }

  function callContextMessages(includeTranscript) {
    var data = app();
    var history = (data.chatHistory || []).slice(-14).filter(function (m) {
      return m && !m.recalled && !m.hiddenFromAI && !m.callRecordId &&
        (m.role === 'user' || m.role === 'assistant') && m.content;
    }).map(function (m) {
      return { role: m.role, content: String(m.content).replace(/\[IMAGE:[\s\S]*?\]/g, '[图片]').slice(0, 300) };
    });
    var messages = [{ role: 'system', content: callSystemPrompt() }].concat(history);
    if (includeTranscript) {
      state.transcript.forEach(function (m) {
        if (!m || !m.text) return;
        messages.push({ role: m.role, content: String(m.text).slice(0, 300) });
      });
    }
    return messages;
  }

  function groupHistoryContext() {
    var g = activeGroup();
    if (!g) return '';
    var lines = (g.history || []).slice(-12).filter(function (m) {
      return m && !m.recalled && !m.hiddenFromAI && !m.callRecordId && !m.narration &&
        (m.role === 'user' || m.role === 'assistant') && m.content;
    }).map(function (m) {
      var who = m.role === 'user' ? userName() : (m.name || '成员');
      return who + '：' + String(m.content).replace(/\[IMAGE:[\s\S]*?\]/g, '[图片]').slice(0, 220);
    });
    return lines.join('\n');
  }

  function memberContextMessages(member, includeTranscript) {
    var messages = [{ role: 'system', content: callSystemPrompt(member) }];
    var recent = groupHistoryContext();
    if (recent) messages.push({ role: 'system', content: '最近的群聊记录（只作背景，不要逐句复述）：\n' + recent });
    if (includeTranscript) {
      state.transcript.forEach(function (m) {
        if (!m || !m.text) return;
        if (m.role === 'user') {
          messages.push({ role: 'user', content: String(m.text).slice(0, 300) });
        } else {
          messages.push({
            role: 'assistant',
            content: (m.speakerName ? (m.speakerName + '：') : '') + String(m.text).slice(0, 300)
          });
        }
      });
    }
    return messages;
  }

  async function requestMessages(messages, maxTokens) {
    var data = app();
    var base = String(data.apiBase || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    if (!/\/chat\/completions$/i.test(base)) base += '/chat/completions';
    var res = await fetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + data.apiKey
      },
      body: JSON.stringify({
        model: data.model || 'deepseek-chat',
        messages: messages,
        temperature: 0.8,
        max_tokens: maxTokens || 180
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var body = await res.json();
    var content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
    content = cleanReplyText(content || '').trim();
    if (!content) throw new Error('没有收到角色的可用台词');
    return content;
  }

  async function requestMemberReply(member, instruction, includeTranscript) {
    var messages = memberContextMessages(member, includeTranscript);
    if (instruction) messages.push({ role: 'user', content: instruction });
    return requestMessages(messages, 180);
  }

  async function requestGroupOpening(member, members, index) {
    var uName = userName();
    var others = (members || []).filter(function (m) { return m && member && m.id !== member.id; }).map(function (m) { return m.name; });
    var caller = (members || []).filter(function (m) { return m && String(m.id) === String(state.groupCallerId); })[0];
    var callerName = caller ? (caller.name || '成员') : '有人';
    var incomingLead = state.mode === 'incoming'
      ? ('这次是' + callerName + '在群里发起的语音通话' +
        (state.incomingReason ? '，由头是：' + state.incomingReason : '') + '。')
      : '';
    var instruction = (state.mode === 'incoming'
      ? '（' + uName + '刚接起群语音通话，电话接通了。' + incomingLead
      : '（' + uName + '刚把大家拉进群语音通话，电话接通了。') +
      '群里还有' + (others.length ? others.join('、') : '其他人') + '。现在轮到你先开口，只说属于你自己的第一句话；不要替别人说，也不要总结。' +
      (index === 0 ? '你是第一个出声的人。' : '') + '）';
    var content = await requestMemberReply(member, instruction, false);
    return {
      role: 'assistant',
      content: content,
      speakerId: member.id || '',
      speakerName: member.name || '成员',
      speakerAvatar: groupMemberAvatar(member)
    };
  }

  async function requestGroupTurnReply() {
    var members = state.groupMembers || [];
    if (!members.length) return [];
    var take = Math.min(2, members.length);
    var picked = [];
    for (var i = 0; i < take; i++) {
      picked.push(members[(state.groupTurn + i) % members.length]);
    }
    var results = await Promise.all(picked.map(function (member) {
      return requestMemberReply(member, '', true).then(function (content) {
        return { content: content, speakerId: member.id || '', speakerName: member.name || '成员', speakerAvatar: groupMemberAvatar(member) };
      }).catch(function (e) {
        console.warn('[GroupCall] ' + (member.name || '成员') + ' 没接上：', e && e.message ? e.message : e);
        return null;
      });
    }));
    state.groupTurn = (state.groupTurn + take) % members.length;
    return results.filter(Boolean);
  }
  async function requestCallReply(instruction, includeTranscript) {
    var data = app();
    var base = String(data.apiBase || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    if (!/\/chat\/completions$/i.test(base)) base += '/chat/completions';
    var messages = callContextMessages(includeTranscript);
    if (instruction) messages.push({ role: 'user', content: instruction });

    var res = await fetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + data.apiKey
      },
      body: JSON.stringify({
        model: data.model || 'deepseek-chat',
        messages: messages,
        temperature: 0.8,
        max_tokens: 180
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var body = await res.json();
    var content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
    content = cleanReplyText(content || '').trim();
    if (!content) throw new Error('没有收到角色的可用台词');
    return content;
  }

  async function requestOpeningLine(mode) {
    var bName = botName();
    var uName = userName();
    var instruction = mode === 'incoming'
      ? ('（' + uName + '刚按下接听，电话接通了。' +
        (state.incomingReason ? '你拨这通电话时说的是：' + state.incomingReason + '。' : '') +
        '请你先开口，只说第一句话，自然接住这个由头。）')
      : '（' + uName + '主动给你打来电话，你刚接通。请你先开口，只说第一句话。）';
    var content = await requestCallReply(instruction, false);
    return { role: 'assistant', content: content, time: nowTime(), name: bName };
  }

  async function beginFirstLine(mode) {
    if (!state.open || state.active || state.busy) return;
    var data = app();
    if (!data.apiKey) {
      setText('call-incoming-line', '还没填 API Key，电话接不通');
      setText('call-incoming-tag', '未接通');
      toast('还没填 API Key，电话接不通');
      return;
    }

    state.busy = true;
    window.__voiceCallMode = true;
    setConnecting(true);
    if (mode === 'outgoing') {
      setText('call-incoming-line', '正在接通…');
      setText('call-incoming-tag', '接通中');
    }
    try {
      var reply = await Promise.all([
        requestOpeningLine(mode),
        new Promise(function (resolve) { setTimeout(resolve, 900); })
      ]).then(function (list) { return list[0]; });
      if (!reply) throw new Error('没有收到角色的第一句话');
      if (!state.open || state.active || state.mode !== mode) return;
      enterActive([reply]);
    } catch (e) {
      console.warn('[Call] 首次接通生成失败：', e && e.message ? e.message : e);
      setText('call-incoming-line', '电话没接通，再试一次');
      setText('call-incoming-tag', '未接通');
      toast('这通电话没接上，检查一下 API Key 或网络');
    } finally {
      if (!state.active) window.__voiceCallMode = false;
      state.busy = false;
      setConnecting(false);
    }
  }

  async function beginGroupFirstLines(members) {
    if (!state.open || state.active || state.busy || !state.groupId) return;
    var data = app();
    if (!data.apiKey) {
      setText('call-incoming-line', '还没填 API Key，群电话接不通');
      setText('call-incoming-tag', '未接通');
      toast('还没填 API Key，电话接不通');
      return;
    }
    var g = activeGroup();
    state.busy = true;
    setConnecting(true);
    setText('call-incoming-line', '正在接通 ' + members.length + ' 人…');
    setText('call-incoming-tag', '群聊语音通话');
    var openings = [];
    try {
      for (var i = 0; i < members.length; i++) {
        var member = members[i];
        setText('call-incoming-line', '正在等 ' + (member.name || '成员') + ' 开口…（' + (i + 1) + '/' + members.length + '）');
        var line = await requestGroupOpening(member, members, i);
        openings.push(line);
        setText('call-incoming-line', (member.name || '成员') + ' 已接上…（' + (i + 1) + '/' + members.length + '）');
      }
      if (!state.open || state.active || state.groupId !== (g && g.id)) return;
      if (openings.length !== members.length) throw new Error('还有成员没有开口');
      enterGroupActive(openings);
    } catch (e) {
      console.warn('[GroupCall] 首句生成失败：', e && e.message ? e.message : e);
      setText('call-incoming-line', '有人没接上，群电话还没开始');
      setText('call-incoming-tag', '未接通');
      toast('群电话没接通，检查一下 API Key 或网络');
    } finally {
      state.busy = false;
      setConnecting(false);
      if (!state.active) window.__voiceCallMode = false;
    }
  }

  function fillGroupIdentity(g, members, opts) {
    opts = opts || {};
    var groupName = (g && g.name) || '群聊';
    state.groupName = groupName;
    state.groupMembers = members.slice();
    var names = members.map(function (m) { return m.name || '成员'; }).join('、');
    var caller = members.filter(function (m) { return m && String(m.id) === String(state.groupCallerId); })[0] || members[0];
    var callerName = caller ? (caller.name || '成员') : groupName;

    if (state.mode === 'incoming') {
      setText('call-notify-name', groupName + ' · ' + callerName);
      setText('call-notify-sub', '群语音来电 · ' + members.length + ' 人');
      setText('call-incoming-name', groupName);
      setText('call-incoming-line', state.incomingReason || (callerName + ' 在群里发起了语音通话。'));
      setText('call-incoming-tag', callerName + ' 发起的群语音来电');
      setAvatar($('call-incoming-avatar'), $('call-incoming-letter'), caller ? groupMemberAvatar(caller) : '', callerName);
    } else {
      setText('call-notify-name', groupName + ' · ' + members.length + ' 人');
      setText('call-notify-sub', '群聊语音通话 · 正在接通');
      setText('call-incoming-name', groupName);
      setText('call-incoming-line', '正在接通 ' + names + '…');
      setText('call-incoming-tag', '群聊语音通话');
      setAvatar($('call-incoming-avatar'), $('call-incoming-letter'), caller ? groupMemberAvatar(caller) : '', callerName);
    }
    renderGroupPeople(members);
    setPeopleMode(true);
  }

  function updateGroupPicker() {
    var members = pickerGroup ? groupCardList(pickerGroup) : [];
    var countEl = $('group-call-picker-count');
    var startBtn = $('group-call-start-btn');
    if (countEl) countEl.textContent = '已选 ' + pickerSelected.length + ' / ' + members.length + ' 人';
    if (startBtn) {
      startBtn.disabled = !pickerSelected.length;
      startBtn.textContent = pickerSelected.length ? ('开始通话 · ' + pickerSelected.length + ' 人') : '开始通话';
    }
  }

  function renderGroupPicker() {
    var list = $('group-call-picker-list');
    if (!list || !pickerGroup) return;
    list.innerHTML = '';
    var members = groupCardList(pickerGroup);
    members.forEach(function (m) {
      var row = document.createElement('div');
      row.className = 'group-call-picker-person';
      row.setAttribute('role', 'checkbox');
      row.setAttribute('aria-checked', pickerSelected.indexOf(m.id) >= 0 ? 'true' : 'false');
      row.setAttribute('data-member-id', String(m.id || ''));
      var avatar = document.createElement('div');
      avatar.className = 'group-call-picker-avatar';
      var letter = document.createElement('span');
      letter.textContent = String(m.name || '?').trim().slice(0, 1) || '?';
      var img = document.createElement('img');
      img.alt = String(m.name || '') + '头像';
      img.onload = function () { img.classList.add('is-loaded'); };
      img.onerror = function () { img.classList.remove('is-loaded'); img.removeAttribute('src'); };
      if (groupMemberAvatar(m)) img.src = groupMemberAvatar(m);
      avatar.appendChild(letter);
      avatar.appendChild(img);
      var name = document.createElement('div');
      name.className = 'group-call-picker-name';
      name.textContent = String(m.name || '成员');
      var mark = document.createElement('div');
      mark.className = 'group-call-picker-check';
      mark.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';
      row.appendChild(avatar);
      row.appendChild(name);
      row.appendChild(mark);
      row.classList.toggle('is-selected', pickerSelected.indexOf(m.id) >= 0);
      row.onclick = function () {
        var id = row.getAttribute('data-member-id');
        var at = pickerSelected.indexOf(id);
        if (at >= 0) pickerSelected.splice(at, 1);
        else pickerSelected.push(id);
        row.classList.toggle('is-selected', pickerSelected.indexOf(id) >= 0);
        row.setAttribute('aria-checked', pickerSelected.indexOf(id) >= 0 ? 'true' : 'false');
        updateGroupPicker();
      };
      list.appendChild(row);
    });
    updateGroupPicker();
  }

  function openGroupVoiceCall() {
    if (state.open) return;
    if (!window.__groupMode || typeof window.findGroup !== 'function') return;
    var g = window.findGroup(window.__groupMode);
    if (!g) return;
    var members = groupCardList(g);
    if (!members.length) {
      toast('这个群还没有可以通话的成员');
      return;
    }
    pickerGroup = g;
    pickerSelected = members.map(function (m) { return String(m.id); });
    var picker = $('group-call-picker');
    if (!picker) {
      toast('选人面板还没加载好，刷新一下页面');
      return;
    }
    var nameEl = $('group-call-picker-group');
    if (nameEl) nameEl.textContent = (g.name || '群聊');
    renderGroupPicker();
    picker.classList.add('is-open');
    picker.setAttribute('aria-hidden', 'false');
  }

  function closeGroupCallPicker() {
    var picker = $('group-call-picker');
    if (picker) {
      picker.classList.remove('is-open');
      picker.setAttribute('aria-hidden', 'true');
    }
  }

  function startSelectedGroupCall() {
    if (!pickerGroup) return;
    var members = groupCardList(pickerGroup).filter(function (m) { return pickerSelected.indexOf(String(m.id)) >= 0; });
    if (!members.length) {
      toast('至少选一个人通话');
      return;
    }
    var data = app();
    if (!data.apiKey) {
      toast('还没填 API Key，群电话接不通');
      return;
    }
    var g = pickerGroup;
    closeGroupCallPicker();
    openGroupCall(g, members);
  }

  function openGroupCall(g, members, opts) {
    opts = opts || {};
    if (state.open || !els.overlay) return;
    if (!window.VoiceInput) {
      toast('语音识别还没加载好，刷新一下页面');
      return;
    }
    state.open = true;
    state.active = false;
    state.busy = false;
    state.recordView = false;
    state.pendingRecordId = '';
    state.minimized = false;
    hideFloat();
    state.recordId = makeRecordId();
    state.recordCharId = 'group:' + g.id;
    state.groupId = g.id;
    state.groupName = g.name || '群聊';
    state.groupMembers = members.slice();
    state.groupCall = true;
    state.groupTurn = 0;
    state.mode = opts.incoming ? 'incoming' : 'outgoing';
    state.groupCallerId = String(opts.callerId || (members[0] && members[0].id) || '');
    state.incomingReason = String(opts.reason || '').trim();
    state.replyMode = 'text';
    clearCallSpeechQueue();
    renderCallReplyMode();

    fillGroupIdentity(g, members, opts);
    setCallBackground();
    updateClock();
    setStage(true);
    clearTranscript();
    if (els.overlay) els.overlay.classList.remove('is-record');
    var sheet = $('call-record-sheet');
    if (sheet) sheet.hidden = true;
    setPill(state.mode === 'incoming' ? '等待接听' : '等待接通', '');
    setWave(false);
    setHint('', false);
    setMicDisabled(true);
    if (els.incomingStage) {
      els.incomingStage.classList.toggle('is-outgoing', state.mode === 'outgoing');
      els.incomingStage.classList.remove('is-connecting');
    }
    setConnecting(false);
    els.overlay.classList.add('is-open');
    els.overlay.setAttribute('aria-hidden', 'false');
    if (state.clockTimer) { clearInterval(state.clockTimer); state.clockTimer = null; }
    state.clockTimer = setInterval(updateClock, 60 * 1000);
    if (state.mode === 'outgoing') {
      setTimeout(function () { beginGroupFirstLines(state.groupMembers); }, 500);
    }
  }

  function openCall(mode) {
    if (state.open) return;
    if (window.__groupMode) {
      openGroupVoiceCall();
      return;
    }
    if (!els.overlay) return;
    if (!window.VoiceInput) {
      toast('语音识别还没加载好，刷新一下页面');
      return;
    }
    state.open = true;
    state.active = false;
    state.busy = false;
    state.recordView = false;
    state.pendingRecordId = '';
    state.minimized = false;
    hideFloat();
    state.recordId = makeRecordId();
    state.recordCharId = currentCharId();
    state.mode = mode === 'incoming' ? 'incoming' : 'outgoing';
    state.groupId = '';
    state.groupName = '';
    state.groupMembers = [];
    state.groupCall = false;
    state.groupTurn = 0;
    state.groupCallerId = '';
    state.incomingReason = '';
    state.replyMode = 'text';
    clearCallSpeechQueue();
    renderCallReplyMode();
    fillIdentity();
    setPeopleMode(false);
    setCallBackground();
    updateClock();
    setStage(true);
    clearTranscript();
    if (els.overlay) els.overlay.classList.remove('is-record');
    var sheet = $('call-record-sheet');
    if (sheet) sheet.hidden = true;
    setPill('等待接听', '');
    setWave(false);
    setHint('', false);
    setMicDisabled(true);

    if (els.incomingStage) {
      els.incomingStage.classList.toggle('is-outgoing', state.mode === 'outgoing');
      els.incomingStage.classList.remove('is-connecting');
    }
    setConnecting(false);

    if (state.mode === 'outgoing') {
      setText('call-incoming-line', '正在呼叫，等待对方接听…');
      setText('call-incoming-tag', '正在呼叫');
    } else {
      setText('call-incoming-line', '接通以后，我只听你说话。');
      setText('call-incoming-tag', '这是 ' + botName() + ' 的来电');
    }

    els.overlay.classList.add('is-open');
    els.overlay.setAttribute('aria-hidden', 'false');
    if (state.clockTimer) { clearInterval(state.clockTimer); state.clockTimer = null; }
    state.clockTimer = setInterval(updateClock, 60 * 1000);

    // 用户主动拨出时，先显示等待接听；第一句生成回来才进通话页。
    if (state.mode === 'outgoing') {
      setTimeout(function () { beginFirstLine('outgoing'); }, 500);
    }
  }

  function open() { openCall('outgoing'); }

  function close() {
    if (!els.overlay) return;
    stopTimer();
    hideFloat();
    if (state.clockTimer) { clearInterval(state.clockTimer); state.clockTimer = null; }
    state.open = false;
    state.active = false;
    state.busy = false;
    state.recordView = false;
    state.pendingRecordId = '';
    state.minimized = false;
    state.groupId = '';
    state.groupName = '';
    state.groupMembers = [];
    state.groupCall = false;
    state.groupTurn = 0;
    state.groupCallerId = '';
    state.incomingReason = '';
    window.__voiceCallMode = false;
    if (els.incomingStage) els.incomingStage.classList.remove('is-outgoing', 'is-connecting');
    setConnecting(false);
    els.overlay.classList.remove('is-open', 'is-record');
    els.overlay.setAttribute('aria-hidden', 'true');
    var sheet = $('call-record-sheet');
    if (sheet) sheet.hidden = true;
    setStage(true);
    removeTyping();
    showTextFallback(false);
    setWave(false);
    setMicDisabled(true);
  }

  function accept() {
    if (!state.open || state.active || state.busy || state.mode !== 'incoming') return;
    if (state.groupCall) {
      beginGroupFirstLines(state.groupMembers);
      return;
    }
    beginFirstLine('incoming');
  }

  function decline() {
    if (!state.open) return;
    var wasOutgoing = state.mode === 'outgoing';
    close();
    toast(wasOutgoing ? '已取消呼叫' : '已挂断');
  }

  function buildCallNotice(id, duration) {
    return {
      role: 'system',
      content: '通话时长 ' + formatTimer(duration),
      time: nowTime(),
      callRecordId: id,
      hiddenFromAI: true,
      notice: true
    };
  }

  function writeCallSummary(id, duration) {
    if (state.groupId) {
      var g = typeof window.findGroup === 'function' ? window.findGroup(state.groupId) : null;
      if (!g) return;
      if (!Array.isArray(g.history)) g.history = [];
      var alreadyGroup = g.history.some(function (m) { return m && m.callRecordId === id; });
      if (alreadyGroup) return;
      g.history.push({
        role: 'system',
        content: '通话时长 ' + formatTimer(duration),
        time: nowTime(),
        callRecordId: id,
        hiddenFromAI: true,
        notice: true,
        groupCall: true
      });
      g.updatedAt = Date.now();
      try { if (window.persistGroups) window.persistGroups(); } catch (e) {}
      try {
        if (window.__groupMode === g.id && typeof window.renderGroupHistory === 'function') window.renderGroupHistory(g);
      } catch (e) {}
      return;
    }
    var data = app();
    if (!Array.isArray(data.chatHistory)) data.chatHistory = [];
    var already = data.chatHistory.some(function (m) { return m && m.callRecordId === id; });
    if (already) return;
    var notice = buildCallNotice(id, duration);
    data.chatHistory.push(notice);
    try {
      if (typeof window.saveChatHistoryNow === 'function') window.saveChatHistoryNow();
      else if (typeof window.setChatHistoryForChar === 'function') window.setChatHistoryForChar(state.recordCharId || currentCharId(), data.chatHistory);
    } catch (e) {}
    try {
      if (typeof window.renderCallRecordNotice === 'function') window.renderCallRecordNotice(notice);
    } catch (e) {}
  }

  function end() {
    if (!state.open) return;
    if (state.recordView) { closeCallRecord(); return; }
    var wasOutgoing = state.mode === 'outgoing';
    var duration = 0;
    if (state.active && state.startedAt) duration = Date.now() - state.startedAt;

    var messages = (state.transcript || []).map(function (m) {
      return {
        role: m.role,
        text: m.text,
        meta: m.meta || '',
        action: m.action || '',
        speakerId: m.speakerId || '',
        speakerName: m.speakerName || ''
      };
    });
    if (state.active && duration >= 1000 && messages.length) {
      var record = {
        id: state.recordId || makeRecordId(),
        charId: state.recordCharId || currentCharId(),
        charName: state.groupId ? (state.groupName || botName()) : botName(),
        userName: userName(),
        startedAt: state.startedAt || Date.now(),
        endedAt: Date.now(),
        duration: duration,
        messages: messages
      };
      if (state.groupId) {
        record.groupId = state.groupId;
        record.groupName = state.groupName || botName();
        record.memberIds = (state.groupMembers || []).map(function (m) { return m.id; });
      }
      saveCallRecord(record);
      writeCallSummary(record.id, duration);
    }

    clearCallSpeechQueue();
    try { if (window.CharVoice && typeof window.CharVoice.stop === 'function') window.CharVoice.stop(); } catch (e) {}
    close();
    if (duration > 1000) {
      toast('通话结束 · ' + formatTimer(duration));
    } else if (wasOutgoing) {
      toast('已取消呼叫');
    } else {
      toast('已挂断');
    }
  }

  function formatRecordDate(ms) {
    try {
      var d = new Date(ms || Date.now());
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return m + '月' + day + '日 ' + hh + ':' + mm;
    } catch (e) { return ''; }
  }

  function renderRecordMessages(record) {
    var list = $('call-record-list');
    if (!list) return;
    list.innerHTML = '';
    var messages = (record && record.messages) || [];
    if (!messages.length) {
      var empty = document.createElement('div');
      empty.className = 'call-record-empty';
      empty.textContent = '这通电话没有留下转写';
      list.appendChild(empty);
      return;
    }
    messages.forEach(function (m) {
      if (!m || (!m.text && !m.action)) return;
      if (m.action) {
        var action = document.createElement('div');
        action.className = 'call-record-action';
        action.textContent = (m.speakerName ? m.speakerName + ' · ' : '') + String(m.action);
        list.appendChild(action);
      }
      if (!m.text) return;
      var row = document.createElement('div');
      row.className = 'call-record-msg ' + (m.role === 'user' ? 'user' : 'assistant');
      var bubble = document.createElement('div');
      bubble.className = 'call-record-bubble';
      bubble.textContent = String(m.text);
      row.appendChild(bubble);
      var meta = document.createElement('div');
      meta.className = 'call-record-meta';
      meta.textContent = record && record.groupId
        ? (m.speakerName || (m.role === 'user' ? '你' : '对方'))
        : (m.meta || (m.role === 'user' ? '你' : '对方'));
      bubble.appendChild(meta);
      list.appendChild(row);
    });
    list.scrollTop = 0;
  }

  function fillRecordStage(record) {
    var isGroup = !!(record && record.groupId);
    var bName = record.charName || (isGroup ? (record.groupName || '群聊') : botName());
    setText('call-record-duration', formatTimer(record.duration || 0));
    if (isGroup) {
      var count = (record.memberIds || []).length;
      setText('call-record-sub', '群聊语音通话 · ' + count + ' 人 · ' + formatRecordDate(record.startedAt));
    } else {
      setText('call-record-sub', '与 ' + bName + ' 的语音通话 · ' + formatRecordDate(record.startedAt));
    }
    var avatar = $('call-record-avatar');
    if (avatar) avatar.textContent = String(bName || '群').trim().slice(0, 1) || '群';
    renderRecordMessages(record);
  }

  function openCallRecord(id) {
    var record = getCallRecord(id);
    if (!record) {
      toast('这条通话记录已经不在了');
      return;
    }
    if (!els.overlay) return;
    closeCallRecordSheet();
    hideFloat();
    state.open = true;
    state.active = false;
    state.busy = false;
    state.recordView = true;
    state.recordId = record.id;
    state.recordCharId = record.charId || currentCharId();
    window.__voiceCallMode = false;
    setCallBackground();
    if (els.incomingStage) els.incomingStage.hidden = true;
    if (els.activeStage) els.activeStage.hidden = true;
    var stage = $('call-record-stage');
    if (stage) stage.hidden = false;
    els.overlay.classList.add('is-open', 'is-record');
    els.overlay.setAttribute('aria-hidden', 'false');
    fillRecordStage(record);
  }

  function closeCallRecord() {
    if (!state.recordView) return;
    close();
  }

  function closeCallRecordSheet() {
    var sheet = $('call-record-sheet');
    if (sheet) sheet.hidden = true;
    state.pendingRecordId = '';
  }

  function showCallRecordOptions(id) {
    var record = getCallRecord(id);
    if (!record) {
      toast('这条通话记录已经不在了');
      return;
    }
    state.pendingRecordId = record.id;
    var sheet = $('call-record-sheet');
    if (!sheet) { openCallRecord(record.id); return; }
    setText('call-record-sheet-head', '通话时长 ' + formatTimer(record.duration || 0));
    sheet.hidden = false;
  }

  function openCallRecordFromSheet() {
    var id = state.pendingRecordId;
    if (!id) return;
    closeCallRecordSheet();
    openCallRecord(id);
  }

  function showTextFallback(open) {
    if (!els.textRow) return;
    els.textRow.classList.toggle('is-open', !!open);
    if (els.keyboard) {
      els.keyboard.classList.toggle('is-open', !!open);
      els.keyboard.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (open) {
      setTimeout(function () { try { els.textInput.focus(); } catch (e) {} }, 80);
    }
  }

  function toggleCallTextInput() {
    if (!state.active || !els.textRow) return;
    var open = !els.textRow.classList.contains('is-open');
    showTextFallback(open);
    if (open) {
      setHint('键盘打字 · 发送后仍按语音显示', true);
    } else {
      setHint('按住话筒说话 · 松手转成文字', false);
    }
  }

  function setVoiceState(mode, payload) {
    if (!state.active) return;
    setFloatVoiceState(mode, payload);
    if (mode === 'listening') {
      setPill('我在听', 'listening');
      setWave(true);
      setHint('正在听，松开转成文字', true);
    } else if (mode === 'preview') {
      var preview = String(payload || '').replace(/\s+/g, ' ').trim();
      if (preview.length > 22) preview = preview.slice(0, 22) + '…';
      setHint(preview ? '听见了：' + preview : '正在听，松开转成文字', true);
    } else if (mode === 'transcribing') {
      setPill('转写中', '');
      setWave(false);
      setHint('松手了，正在把声音转成文字…', true);
    } else if (mode === 'thinking') {
      setPill('我在想', 'thinking');
      setWave(false);
      setHint('等我说完这一句', false);
    } else if (mode === 'error') {
      setPill('没听清', '');
      setWave(false);
      setHint(String(payload || '再说一次，我这边没接住'), false);
    } else {
      setPill('我在听', 'listening');
      setWave(false);
      var typingOpen = !!(els.textRow && els.textRow.classList.contains('is-open'));
      setHint(typingOpen ? '键盘打字 · 发送后仍按语音显示' : '按住话筒说话 · 松手转成文字', typingOpen);
    }
  }

  async function sendTranscript(rawText, duration) {
    if (!state.active || state.busy) return;
    var text = String(rawText || '').trim();
    if (!text) return;

    var data = app();
    if (!data.apiKey) {
      appendMessage('user', text, duration ? '语音 · ' + Math.max(1, Math.round(duration)) + '″' : '语音');
      toast('还没填 API Key，电话接不通');
      return;
    }

    state.busy = true;
    setMicDisabled(true);
    appendMessage('user', text, duration ? '语音 · ' + Math.max(1, Math.round(duration)) + '″' : '语音');
    setVoiceState('thinking');
    var typing = showTyping();

    try {
      window.__voiceCallMode = true;

      if (state.groupId) {
        var groupReplies = await requestGroupTurnReply();
        if (!groupReplies.length) throw new Error('群里没有成员接话');
        groupReplies.forEach(function (reply) {
          appendMessage('assistant', reply.content, '', {
            id: reply.speakerId,
            name: reply.speakerName,
            avatar: reply.speakerAvatar
          });
        });
      } else {
        var reply = await requestCallReply('', true);
        if (reply) appendMessage('assistant', reply, '');
      }
    } catch (e) {
      console.warn('[Call] 通话回复失败：', e && e.message ? e.message : e);
      toast('这通电话没接上，检查一下 API Key 或网络');
      appendMessage('assistant', '……', '信号断了一下');
    } finally {
      if (!state.active) window.__voiceCallMode = false;
      if (typing && typing.parentNode) typing.remove();
      removeTyping();
      state.busy = false;
      if (state.active) {
        setMicDisabled(false);
        setVoiceState('idle');
      }
    }
  }

  function bindMic() {
    if (!els.mic) return;
    var pointerId = null;
    els.mic.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (!state.active || state.busy) return;
      e.preventDefault();
      pointerId = e.pointerId;
      try { if (els.mic.setPointerCapture) els.mic.setPointerCapture(e.pointerId); } catch (err) {}
      window.VoiceInput.start();
    });
    els.mic.addEventListener('pointerup', function (e) {
      if (!state.active) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;
      pointerId = null;
      window.VoiceInput.stop();
    });
    els.mic.addEventListener('pointercancel', function (e) {
      if (!state.active) return;
      pointerId = null;
      window.VoiceInput.cancel();
      setVoiceState('idle');
    });
    els.mic.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function bindFloat() {
    var tile = $('call-float-tile');
    var endBtn = $('call-float-end');
    if (!tile) return;

    var pointerId = null;
    var holdTimer = null;
    var holding = false;
    var longTriggered = false;

    function resetHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      pointerId = null;
      holding = false;
      longTriggered = false;
    }

    function canTalk() {
      if (!window.VoiceInput) {
        toast('语音识别还没加载好，刷新一下页面');
        return false;
      }
      if (!window.VoiceInput.isSupported) {
        toast('这个浏览器不支持语音识别，回全屏可以打字');
        return false;
      }
      return true;
    }

    tile.addEventListener('pointerdown', function (e) {
      if (!state.minimized || !state.active) return;
      if (endBtn && e.target && endBtn.contains(e.target)) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      pointerId = e.pointerId;
      holding = false;
      longTriggered = false;
      try { if (tile.setPointerCapture) tile.setPointerCapture(e.pointerId); } catch (err) {}
      holdTimer = setTimeout(function () {
        holdTimer = null;
        longTriggered = true;
        if (!state.minimized || !state.active) return;
        if (state.busy) { toast('等我说完这一句'); return; }
        if (!canTalk()) return;
        holding = true;
        setFloatVoiceState('listening');
        window.VoiceInput.start();
      }, 380);
    });

    tile.addEventListener('pointerup', function (e) {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      var wasHolding = holding;
      var wasLong = longTriggered;
      resetHold();
      if (wasHolding) {
        window.VoiceInput.stop();
      } else if (!wasLong) {
        restoreCall();
      }
    });

    tile.addEventListener('pointercancel', function (e) {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      var wasHolding = holding;
      resetHold();
      if (wasHolding) {
        window.VoiceInput.cancel();
        setFloatVoiceState('idle');
      }
    });

    tile.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    tile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        restoreCall();
      }
    });

    if (endBtn) {
      endBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.endVoiceCall();
      });
      endBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    }
  }


  function bindTextFallback() {
    if (!els.textSend || !els.textInput) return;
    function submit() {
      var text = String(els.textInput.value || '').trim();
      if (!text || !state.active || state.busy) return;
      els.textInput.value = '';
      sendTranscript(text, 0);
    }
    els.textSend.addEventListener('click', submit);
    els.textInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  function init() {
    els.overlay = $('call-overlay');
    if (!els.overlay) return;
    els.callBg = $('call-bg');
    els.incomingStage = $('call-incoming');
    els.activeStage = $('call-active');
    els.pill = $('call-status-pill');
    els.wave = $('call-wave');
    els.transcript = $('call-transcript');
    els.transcriptInner = $('call-transcript-inner');
    els.hint = $('call-footer-hint');
    els.mic = $('call-mic-btn');
    els.keyboard = $('call-keyboard-btn');
    els.textRow = $('call-text-fallback');
    els.textInput = $('call-text-input');
    els.textSend = $('call-text-send');
    els.float = $('call-float');

    // 挂到手机根节点，避免被聊天页 overflow / transform 裁切。
    var phoneRoot = $('phone-screen-root');
    if (phoneRoot && els.overlay.parentNode !== phoneRoot) {
      phoneRoot.appendChild(els.overlay);
    }
    if (phoneRoot && els.float && els.float.parentNode !== phoneRoot) {
      phoneRoot.appendChild(els.float);
    }
    var sheet = $('call-record-sheet');
    if (phoneRoot && sheet && sheet.parentNode !== phoneRoot) {
      phoneRoot.appendChild(sheet);
    }
    var picker = $('group-call-picker');
    if (phoneRoot && picker && picker.parentNode !== phoneRoot) {
      phoneRoot.appendChild(picker);
    }

    bindMic();
    bindFloat();
    bindTextFallback();
    fillIdentity();
    setPeopleMode(false);
    updateClock();
    renderCallReplyMode();

    window.VoiceInput && (window.__voiceCallMode = false);
  }

  window.openVoiceCall = function (mode) {
    openCall(mode === 'incoming' ? 'incoming' : 'outgoing');
  };
  window.openChatVoiceCall = function () {
    if (window.__groupMode) { openGroupVoiceCall(); return; }
    openCall('outgoing');
  };
  window.openGroupVoiceCall = openGroupVoiceCall;
  window.closeGroupCallPicker = closeGroupCallPicker;
  window.startSelectedGroupCall = startSelectedGroupCall;
  window.openIncomingVoiceCall = function (options) {
    if (state.open || window.__groupMode) return false;
    var opts = (typeof options === 'string') ? { reason: options } : (options || {});
    openCall('incoming');
    if (!state.open) return false;
    state.incomingReason = String(opts.reason || '').trim();
    if (state.incomingReason) {
      setText('call-incoming-line', state.incomingReason);
      setText('call-incoming-tag', '这是 ' + botName() + ' 的来电');
    }
    return true;
  };
  window.openIncomingGroupVoiceCall = function (options) {
    if (state.open) return false;
    var opts = options || {};
    var gid = String(opts.groupId || window.__groupMode || '');
    if (!window.__groupMode || window.__groupMode !== gid) return false;
    var g = (typeof window.findGroup === 'function') ? window.findGroup(gid) : null;
    if (!g) return false;
    var all = groupCardList(g);
    var ids = (Array.isArray(opts.memberIds) ? opts.memberIds : []).map(function (id) { return String(id); });
    var members = all.filter(function (m) { return ids.indexOf(String(m.id)) >= 0; });
    if (!members.length) return false;
    var callerId = String(opts.callerId || (members[0] && members[0].id) || '');
    if (!members.some(function (m) { return String(m.id) === callerId; })) callerId = String(members[0].id);
    openGroupCall(g, members, {
      incoming: true,
      callerId: callerId,
      reason: String(opts.reason || '').trim()
    });
    return !!(state.open && state.groupCall);
  };

  window.declineVoiceCall = decline;
  window.acceptVoiceCall = accept;
  window.endVoiceCall = end;
  window.minimizeVoiceCall = minimizeCall;
  window.restoreVoiceCall = restoreCall;
  window.openCallRecord = openCallRecord;
  window.closeCallRecord = closeCallRecord;
  window.showCallRecordOptions = showCallRecordOptions;
  window.closeCallRecordSheet = closeCallRecordSheet;
  window.openCallRecordFromSheet = openCallRecordFromSheet;
  window.callVoiceState = setVoiceState;
  window.callHandleVoiceResult = function (text, duration) {
    if (!state.active) return;
    sendTranscript(text, duration);
    return true;
  };
  window.toggleCallTextInput = toggleCallTextInput;
  window.callToggleTextFallback = toggleCallTextInput;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
