/* ================= 按住说话 · 语音转文字确认 =================
   只使用浏览器 SpeechRecognition 取文字：
   - 不创建 MediaRecorder，不保存音频，不播放音频
   - 松手后必须经过确认页，用户改完再发送
   - 发送后消息带 voice 元数据，渲染成只读语音条 */
(function () {
  'use strict';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var supported = typeof SR === 'function';
  var MAX_HOLD_MS = 60 * 1000;
  var CANCEL_DISTANCE = 58;

  var state = {
    active: false,
    finishing: false,
    canceled: false,
    willCancel: false,
    startedAt: 0,
    duration: 0,
    finalText: '',
    interimText: '',
    error: '',
    pointerId: null,
    startY: 0,
    recognition: null,
    timer: null,
    finishTimer: null,
    confirmOpen: false,
    session: 0,
    recEnded: false
  };

  var els = {};
  var lastFocused = null;

  function $(id) { return document.getElementById(id); }

  function toast(message) {
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(message);
        return;
      }
      var old = document.getElementById('voice-input-toast');
      if (old) old.remove();
      var el = document.createElement('div');
      el.id = 'voice-input-toast';
      el.textContent = message;
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:400;max-width:min(320px,calc(100vw - 48px));padding:9px 13px;border-radius:12px;background:rgba(24,26,31,.94);border:0.5px solid rgba(255,255,255,.12);color:#f4efec;font-size:12px;line-height:1.45;text-align:center;box-shadow:0 8px 26px rgba(0,0,0,.34);pointer-events:none;';
      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.remove(); }, 2600);
    } catch (e) {}
  }

  function setRecordingUI(open) {
    // 通话模式不弹消息式“松开发送”悬浮卡，只把状态交给通话页。
    if (window.__voiceCallMode) {
      if (typeof window.callVoiceState === 'function') {
        window.callVoiceState(open ? 'listening' : 'idle');
      }
      return;
    }
    if (els.holdOverlay) {
      els.holdOverlay.classList.toggle('is-open', !!open);
      els.holdOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (els.holdBtn) els.holdBtn.classList.toggle('is-recording', !!open);
    if (els.holdCard) els.holdCard.classList.remove('is-cancel');
    if (els.holdTitle) els.holdTitle.textContent = '松开发送';
    if (els.holdSub) els.holdSub.textContent = '正在听，说完松开';
    if (els.holdCancel) els.holdCancel.textContent = '上滑取消';
  }

  function formatTimer(ms) {
    var sec = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function formatDuration(sec) {
    var n = Math.max(1, Math.round(Number(sec) || 0));
    if (n < 60) return n + '″';
    return Math.floor(n / 60) + '′' + (n % 60 ? (n % 60) + '″' : '');
  }

  function setLivePreview(text) {
    var preview = String(text || '').replace(/\s+/g, ' ').trim();
    if (window.__voiceCallMode) {
      if (preview.length > 22) preview = preview.slice(0, 22) + '…';
      if (typeof window.callVoiceState === 'function') {
        window.callVoiceState('preview', preview || '正在听，松开转成文字');
      }
      return;
    }
    if (!els.holdSub) return;
    if (preview.length > 18) preview = preview.slice(0, 18) + '…';
    els.holdSub.textContent = preview || '正在听，说完松开';
  }

  function syncSendDisabled() {
    if (!els.confirmText || !els.confirmSend) return;
    els.confirmSend.disabled = !String(els.confirmText.value || '').trim();
  }

  function openConfirm(text, duration) {
    if (!els.confirmOverlay || !els.confirmText) return;
    state.confirmOpen = true;
    state.duration = Number(duration) || 0;
    lastFocused = document.activeElement;
    els.confirmText.value = String(text || '');
    if (els.confirmDuration) els.confirmDuration.textContent = formatDuration(duration);
    if (els.confirmHint) {
      els.confirmHint.textContent = String(text || '').trim()
        ? '识别结果可能不准，改完再发'
        : '没有听清，可以重录或直接输入';
    }
    syncSendDisabled();
    els.confirmOverlay.classList.add('is-open');
    els.confirmOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      try {
        els.confirmText.focus();
        var len = els.confirmText.value.length;
        els.confirmText.setSelectionRange(len, len);
      } catch (e) {}
    }, 80);
  }

  function closeConfirm() {
    if (!els.confirmOverlay) return;
    state.confirmOpen = false;
    els.confirmOverlay.classList.remove('is-open');
    els.confirmOverlay.setAttribute('aria-hidden', 'true');
    try {
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    } catch (e) {}
  }

  function cancelRecognition() {
    state.canceled = true;
    state.active = false;
    state.finishing = true;
    state.session += 1;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.finishTimer) { clearTimeout(state.finishTimer); state.finishTimer = null; }
    try {
      if (state.recognition) state.recognition.abort();
    } catch (e) {}
    state.recognition = null;
    setRecordingUI(false);
  }

  function cleanupRecognition() {
    if (state.finishTimer) { clearTimeout(state.finishTimer); state.finishTimer = null; }
    var rec = state.recognition;
    state.recognition = null;
    try {
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.onstart = null;
        try { rec.abort(); } catch (e) {}
      }
    } catch (e) {}
  }

  function finishRecognition() {
    if (state.finishing || state.active) return;
    state.finishing = true;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.finishTimer) { clearTimeout(state.finishTimer); state.finishTimer = null; }
    setRecordingUI(false);
    var text = String(state.finalText || state.interimText || '').trim();
    if (!state.canceled) {
      if (!text) {
        var msg = '没听清，再按住说一次';
        if (state.error === 'not-allowed' || state.error === 'service-not-allowed') {
          msg = '麦克风权限被拒绝了，允许后再按住说话';
        } else if (state.error === 'audio-capture') {
          msg = '没有找到可用麦克风，检查一下系统输入设备';
        }
        if (window.__voiceCallMode && typeof window.callVoiceState === 'function') {
          window.callVoiceState('error', msg);
        } else {
          toast(msg);
        }
        cleanupRecognition();
        return;
      }
      if (window.__voiceCallMode && typeof window.callHandleVoiceResult === 'function') {
        // 通话不做确认页，识别完直接交给通话页。
        window.callHandleVoiceResult(text, state.duration);
        cleanupRecognition();
        return;
      }
      openConfirm(text, state.duration);
    }
    cleanupRecognition();
  }

  function stopRecognition() {
    if (!state.active) return;
    state.active = false;
    state.duration = (Date.now() - state.startedAt) / 1000 || 0;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (window.__voiceCallMode) {
      if (typeof window.callVoiceState === 'function') window.callVoiceState('transcribing');
    } else {
      if (els.holdTitle) els.holdTitle.textContent = '识别中';
      if (els.holdSub) els.holdSub.textContent = '松手了，正在转成文字…';
    }
    if (state.recEnded) {
      finishRecognition();
      return;
    }
    try {
      if (state.recognition) state.recognition.stop();
    } catch (e) {
      finishRecognition();
      return;
    }
    // 某些浏览器 onend 来得慢或不来；这里兜底收尾。
    if (state.finishTimer) clearTimeout(state.finishTimer);
    state.finishTimer = setTimeout(function () {
      if (!state.finishing && !state.active) finishRecognition();
    }, 1200);
  }

  function startRecognition() {
    if (!supported) {
      toast('当前浏览器不支持语音识别，请用 Chrome 或 Edge 打开');
      return;
    }
    if (state.active || state.confirmOpen) return;

    // 每次开始都是独立会话，旧实例的回调不会再影响这一次。
    cleanupRecognition();
    state.session += 1;
    var session = state.session;
    state.active = true;
    state.finishing = false;
    state.canceled = false;
    state.willCancel = false;
    state.recEnded = false;
    state.duration = 0;
    state.finalText = '';
    state.interimText = '';
    state.error = '';
    state.startedAt = Date.now();

    setRecordingUI(true);
    if (els.holdTimer) els.holdTimer.textContent = formatTimer(0);
    state.timer = setInterval(function () {
      if (!state.active) return;
      var ms = Date.now() - state.startedAt;
      if (els.holdTimer) els.holdTimer.textContent = formatTimer(ms);
      if (ms >= MAX_HOLD_MS) stopRecognition();
    }, 120);

    var rec = new SR();
    state.recognition = rec;
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = function () {
      if (session !== state.session) return;
      if (els.holdSub) els.holdSub.textContent = '正在听，说完松开';
    };

    rec.onresult = function (event) {
      if (session !== state.session) return;
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var result = event.results[i];
        var transcript = result && result[0] ? result[0].transcript : '';
        if (!transcript) continue;
        if (result.isFinal) {
          state.finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      state.interimText = interim;
      setLivePreview(state.finalText + interim);
    };

    rec.onerror = function (event) {
      if (session !== state.session) return;
      state.error = event && event.error ? event.error : 'unknown';
      if (state.error === 'aborted') return;
      if (state.active) {
        // 权限/设备错误通常不会再有结果，直接结束并提示。
        if (state.error === 'not-allowed' || state.error === 'audio-capture' || state.error === 'service-not-allowed') {
          state.active = false;
          state.duration = (Date.now() - state.startedAt) / 1000 || 0;
          if (state.timer) { clearInterval(state.timer); state.timer = null; }
          finishRecognition();
        }
      }
    };

    rec.onend = function () {
      if (session !== state.session) return;
      // 浏览器可能因为静音自动结束识别。用户还按着时先不要弹确认页，
      // 只记住“已结束”，等松手后再走确认，避免下一次按住瞬间跳出编辑页。
      if (state.active) {
        state.recEnded = true;
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
        if (els.holdTitle) els.holdTitle.textContent = '已结束';
        if (els.holdSub) els.holdSub.textContent = state.finalText || state.interimText ? '松开后确认文字' : '松开后可重录';
        return;
      }
      finishRecognition();
    };

    try {
      rec.start();
    } catch (e) {
      state.error = 'start-failed';
      state.active = false;
      setRecordingUI(false);
      toast('麦克风启动失败，再试一次');
      cleanupRecognition();
    }
  }

  function onHoldPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    state.pointerId = e.pointerId;
    state.startY = e.clientY;
    try {
      const captureEl = e.currentTarget || els.holdBtn;
      if (captureEl && captureEl.setPointerCapture) {
        captureEl.setPointerCapture(e.pointerId);
      }
    } catch (err) {}
    startRecognition();
  }

  function onHoldPointerMove(e) {
    if (!state.active || e.pointerId !== state.pointerId) return;
    var movedUp = state.startY - e.clientY;
    var cancel = movedUp > CANCEL_DISTANCE;
    if (cancel === state.willCancel) return;
    state.willCancel = cancel;
    if (els.holdCard) els.holdCard.classList.toggle('is-cancel', cancel);
    if (els.holdTitle) els.holdTitle.textContent = cancel ? '松开取消' : '松开发送';
    if (els.holdCancel) els.holdCancel.textContent = cancel ? '已取消，松开返回' : '上滑取消';
  }

  function onHoldPointerUp(e) {
    if (!state.active || (state.pointerId !== null && e.pointerId !== state.pointerId)) return;
    if (state.willCancel) {
      cancelRecognition();
      toast('已取消');
      return;
    }
    stopRecognition();
  }

  function onHoldPointerCancel(e) {
    if (!state.active || (state.pointerId !== null && e.pointerId !== state.pointerId)) return;
    cancelRecognition();
  }

  function sendConfirmed() {
    if (!els.confirmText) return;
    var text = String(els.confirmText.value || '').trim();
    if (!text) return;
    var duration = Math.max(1, Math.round(state.duration || 1));
    closeConfirm();

    try {
      if (window.__groupMode) {
        if (typeof window.groupHandleVoiceMessage !== 'function') {
          throw new Error('群聊发送入口不可用');
        }
        // 群聊直接落消息，不触发中控选角；用户在群里点“生成”再让角色接。
        window.groupHandleVoiceMessage({ duration: duration, transcript: text, confirmed: true });
        return;
      }

      // 单人聊天交给统一发送入口；发送后消息带 voice 元数据，角色只读到确认后的文字。
      window.__pendingVoiceMessage = {
        duration: duration,
        transcript: text,
        confirmed: true
      };
      var input = $('chat-input');
      if (input) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (typeof window.handleSendOnly === 'function') {
        window.handleSendOnly();
      } else if (typeof handleSendOnly === 'function') {
        handleSendOnly();
      } else {
        throw new Error('发送入口不可用');
      }
    } catch (e) {
      window.__pendingVoiceMessage = null;
      toast('发送失败：' + (e && e.message ? e.message : '未知错误'));
    }
  }

  function bind() {
    els.holdBtn = $('chat-voice-hold-btn');
    els.holdOverlay = $('voice-hold-overlay');
    els.holdCard = els.holdOverlay ? els.holdOverlay.querySelector('.voice-hold-card') : null;
    els.holdTitle = $('voice-hold-title');
    els.holdSub = $('voice-hold-sub');
    els.holdTimer = $('voice-hold-timer');
    els.holdCancel = $('voice-hold-cancel');
    els.confirmOverlay = $('voice-confirm-overlay');
    els.confirmText = $('voice-confirm-text');
    els.confirmDuration = $('voice-confirm-duration');
    els.confirmHint = $('voice-confirm-hint');
    els.confirmSend = $('voice-send-btn');
    els.confirmClose = $('voice-confirm-close');
    els.confirmCancel = $('voice-cancel-btn');
    els.confirmRerecord = $('voice-rerecord-btn');

    // 放到手机屏幕根节点：避免被聊天页的 transform/overflow 裁掉，也不再受消息层 z-index 影响。
    var phoneRoot = $('phone-screen-root');
    if (phoneRoot) {
      if (els.holdOverlay) phoneRoot.appendChild(els.holdOverlay);
      if (els.confirmOverlay) phoneRoot.appendChild(els.confirmOverlay);
    }

    if (els.holdBtn) {
      els.holdBtns = [els.holdBtn, document.querySelector('.wechat-inline-mic')].filter(Boolean);
      els.holdBtns.forEach(function (btn) {
        btn.addEventListener('pointerdown', onHoldPointerDown);
        btn.addEventListener('pointermove', onHoldPointerMove);
        btn.addEventListener('pointerup', onHoldPointerUp);
        btn.addEventListener('pointercancel', onHoldPointerCancel);
        btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      });
    }

    if (els.confirmText) {
      els.confirmText.addEventListener('input', syncSendDisabled);
    }
    if (els.confirmSend) {
      els.confirmSend.addEventListener('click', sendConfirmed);
    }
    if (els.confirmClose) els.confirmClose.addEventListener('click', closeConfirm);
    if (els.confirmCancel) els.confirmCancel.addEventListener('click', closeConfirm);
    if (els.confirmRerecord) {
      els.confirmRerecord.addEventListener('click', function () {
        closeConfirm();
        toast('按住麦克风再说一次');
      });
    }
    if (els.confirmOverlay) {
      els.confirmOverlay.addEventListener('click', function (e) {
        if (e.target === els.confirmOverlay) closeConfirm();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.confirmOpen) closeConfirm();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  // 给调试 / 后续语音通话复用的最小入口，不暴露内部录音对象。
  window.VoiceInput = {
    isSupported: supported,
    openConfirm: openConfirm,
    closeConfirm: closeConfirm,
    start: startRecognition,
    stop: stopRecognition,
    cancel: cancelRecognition
  };
})();
