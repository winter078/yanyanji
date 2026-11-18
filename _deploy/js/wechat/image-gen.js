// 单人聊天生图：调用 OpenAI 兼容的 /images/generations，生成后自动进当前角色相簿。
// 群聊不需要单独接口：角色相簿本来就在群聊的相簿目录里。
(function () {
  function activeChar() {
    try {
      return (typeof window.getActiveCharacter === 'function') ? window.getActiveCharacter() : null;
    } catch (e) {
      return null;
    }
  }

  function nowStr() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function imageEndpoint(baseUrl) {
    let base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return '';
    if (/\/images\/generations$/i.test(base)) return base;
    if (/\/images\/edits$/i.test(base)) return base.replace(/\/images\/edits$/i, '/images/generations');
    return base + '/images/generations';
  }

  function imageEditsEndpoint(baseUrl) {
    let base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return '';
    if (/\/images\/edits$/i.test(base)) return base;
    if (/\/images\/generations$/i.test(base)) return base.replace(/\/images\/generations$/i, '/images/edits');
    return base + '/images/edits';
  }

  function dataUrlToBlob(dataUrl) {
    const str = String(dataUrl || '');
    const match = str.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!match) return null;
    const mime = match[1] || 'image/jpeg';
    const isBase64 = !!match[2];
    const body = isBase64 ? atob(match[3]) : decodeURIComponent(match[3]);
    const bytes = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function parseImageResult(res, data) {
    const item = data && data.data && data.data[0];
    if (!item) throw new Error('生图接口没有返回图片数据。');
    if (item.b64_json) {
      return String(item.b64_json).indexOf('data:') === 0
        ? item.b64_json
        : 'data:image/png;base64,' + item.b64_json;
    }
    if (item.url) return item.url;
    throw new Error('生图接口返回了无法识别的图片字段。');
  }

  function imageRouteConfig() {
    if (window.ImagePresets && typeof window.ImagePresets.resolve === 'function') {
      return window.ImagePresets.resolve();
    }
    const cfg = (window.ApiPresets && typeof window.ApiPresets.resolve === 'function')
      ? window.ApiPresets.resolve('image')
      : null;
    return cfg || null;
  }

  const CHAR_IMAGE_SETTINGS_KEY = 'momo_char_image_settings_v1';
  let charImageSaveTimer = null;

  function readCharImageSettingsMap() {
    try {
      const raw = localStorage.getItem(CHAR_IMAGE_SETTINGS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (e) { return {}; }
  }

  function writeCharImageSettingsMap(map) {
    try {
      localStorage.setItem(CHAR_IMAGE_SETTINGS_KEY, JSON.stringify(map || {}));
      return true;
    } catch (e) {
      console.warn('[ImageGen] 角色生图设置保存失败：', e);
      return false;
    }
  }

  function defaultCharImageSettings() {
    return { enabled: true, lockPrompt: '', styleTags: '', negativePrompt: '', refImage: '' };
  }

  function getCharacterImageSettings(charId) {
    const id = charId || (activeChar() && activeChar().id);
    const map = readCharImageSettingsMap();
    if (!id) return defaultCharImageSettings();
    if (!map[id]) {
      map[id] = defaultCharImageSettings();
      writeCharImageSettingsMap(map);
    }
    return Object.assign(defaultCharImageSettings(), map[id]);
  }

  function saveCharacterImageSettings(charId, patch) {
    const id = charId || (activeChar() && activeChar().id);
    if (!id) return null;
    const map = readCharImageSettingsMap();
    map[id] = Object.assign(getCharacterImageSettings(id), patch || {});
    if (!writeCharImageSettingsMap(map)) return null;
    return map[id];
  }

  function isCharacterImageConfigured() {
    const cfg = imageRouteConfig();
    return !!(cfg && cfg.baseUrl && cfg.apiKey && cfg.model);
  }

  function isCharacterImageEnabled(charId) {
    return !!getCharacterImageSettings(charId).enabled;
  }

  function renderCharacterImageSettingsUI() {
    const char = activeChar();
    const s = getCharacterImageSettings(char && char.id);
    const toggle = document.getElementById('toggle-char-image-enabled');
    const lock = document.getElementById('char-image-lock-prompt');
    const style = document.getElementById('char-image-style-tags');
    const negative = document.getElementById('char-image-negative');
    const status = document.getElementById('char-image-settings-status');
    const refWrap = document.getElementById('char-image-ref-preview-wrap');
    const refImg = document.getElementById('char-image-ref-preview');
    const refStatus = document.getElementById('char-image-ref-status');
    if (toggle) toggle.classList.toggle('active', !!s.enabled);
    if (lock) lock.value = s.lockPrompt || '';
    if (style) style.value = s.styleTags || '';
    if (negative) negative.value = s.negativePrompt || '';
    if (refWrap) refWrap.style.display = 'flex';
    if (refImg) {
      refImg.style.display = s.refImage ? 'block' : 'none';
      refImg.src = s.refImage || '';
    }
    if (refStatus) {
      refStatus.innerText = s.refImage
        ? '已设置参考图 · 生成时走 /images/edits 硬锁'
        : '未设置参考图 · 目前只靠文本锁脸';
      refStatus.style.color = s.refImage ? '#07c160' : 'var(--color-text-secondary)';
    }
    if (status) {
      const cfg = imageRouteConfig();
      const routeText = (cfg && cfg.model)
        ? '全局线路：' + (cfg.name || cfg.model) + ' · ' + cfg.model
        : '全局线路还没配生图模型';
      status.innerText = routeText + '。锁脸/画风只存当前角色。';
    }
  }

  function scheduleCharacterImageSettingsSave() {
    if (charImageSaveTimer) clearTimeout(charImageSaveTimer);
    const char = activeChar();
    const charId = char && char.id;
    if (!charId) return;
    charImageSaveTimer = setTimeout(function () {
      saveCharacterImageSettings(charId, {
        lockPrompt: (document.getElementById('char-image-lock-prompt') || {}).value || '',
        styleTags: (document.getElementById('char-image-style-tags') || {}).value || '',
        negativePrompt: (document.getElementById('char-image-negative') || {}).value || ''
      });
      const status = document.getElementById('char-image-settings-status');
      if (status) status.innerText = '已保存到「' + (char.name || '当前角色') + '」的生图设定。';
    }, 500);
  }

  window.getCharacterImageSettings = getCharacterImageSettings;
  window.saveCharacterImageSettings = saveCharacterImageSettings;
  window.isCharacterImageEnabled = isCharacterImageEnabled;
  window.isCharacterImageConfigured = isCharacterImageConfigured;
  window.renderCharacterImageSettingsUI = renderCharacterImageSettingsUI;
  window.scheduleCharacterImageSettingsSave = scheduleCharacterImageSettingsSave;
  window.toggleCharacterImageEnabled = function () {
    const char = activeChar();
    if (!char || !char.id) {
      alert('先打开一个角色的单聊，再生图。');
      return;
    }
    const s = getCharacterImageSettings(char.id);
    saveCharacterImageSettings(char.id, { enabled: !s.enabled });
    renderCharacterImageSettingsUI();
  };

  function buildImagePrompt(userPrompt, char, settings) {
    settings = settings || getCharacterImageSettings(char && char.id);
    const name = (char && char.name) || (window.appData && window.appData.botRemark) || '角色';
    const setting = (char && (char.prompt || char.charPrompt)) || (window.appData && window.appData.charPrompt) || '';
    const shortSetting = String(setting).replace(/\s+/g, ' ').slice(0, 260);
    let prompt = '';
    if (settings.styleTags) prompt += '画风：' + String(settings.styleTags).trim() + '。';
    if (settings.lockPrompt) prompt += '角色固定外观（锁脸）：' + String(settings.lockPrompt).trim() + '。';
    prompt += '以「' + name + '」为主角生成一张图。' + String(userPrompt || '').trim();
    if (shortSetting) prompt += ' 角色设定参考：' + shortSetting + '。';
    prompt += ' 保持人物外观与身份一致，画面自然，有真实光影和质感；不要生成任何文字、水印、logo、二维码。';
    if (settings.refImage) prompt += ' 参考图是同一角色的外貌参考，请保持同一张脸、发型和体态。';
    if (settings.negativePrompt) prompt += ' 不要出现：' + String(settings.negativePrompt).trim() + '。';
    return prompt;
  }

  async function requestImage(srcPrompt, size, cfg) {
    const endpoint = imageEndpoint(cfg.baseUrl);
    if (!endpoint) throw new Error('生图地址为空，请先在设置里选一条预设。');
    if (!cfg.apiKey) throw new Error('生图 Key 为空，请先在设置里填 API Key。');
    if (!cfg.model) throw new Error('生图模型为空，请先在「设置 → 功能路由 → 生图」填模型名。');

    const controller = new AbortController();
    const timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, 120000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + String(cfg.apiKey).trim()
        },
        body: JSON.stringify({
          model: cfg.model,
          prompt: srcPrompt,
          n: 1,
          size: size || '1024x1024'
        }),
        signal: controller.signal
      });

      let data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) {
        const apiMsg = data && (data.error && (data.error.message || data.error.code) || data.message || data.msg);
        throw new Error('生图接口返回 ' + res.status + (apiMsg ? '：' + apiMsg : ''));
      }
      const item = data && data.data && data.data[0];
      if (!item) throw new Error('生图接口没有返回图片数据。');
      if (item.b64_json) {
        return String(item.b64_json).indexOf('data:') === 0
          ? item.b64_json
          : 'data:image/png;base64,' + item.b64_json;
      }
      if (item.url) return item.url;
      throw new Error('生图接口返回了无法识别的图片字段。');
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('生图超时（120 秒），请换线路或重试。');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function requestImageEdit(srcPrompt, size, cfg, refImage) {
    const endpoint = imageEditsEndpoint(cfg.baseUrl);
    if (!endpoint) throw new Error('生图地址为空，请先在设置里选一条生图预设。');
    if (!cfg.apiKey) throw new Error('生图 Key 为空，请先在设置里填 API Key。');
    if (!cfg.model) throw new Error('生图模型为空，请先在设置里填生图模型。');
    const blob = dataUrlToBlob(refImage);
    if (!blob) throw new Error('参考图数据无法读取，请重新上传。');

    const form = new FormData();
    form.append('model', cfg.model);
    form.append('prompt', srcPrompt);
    form.append('n', '1');
    form.append('size', size || '1024x1024');
    form.append('image', blob, 'reference.' + (blob.type === 'image/png' ? 'png' : 'jpg'));

    const controller = new AbortController();
    const timer = setTimeout(function () { try { controller.abort(); } catch (e) {} }, 120000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + String(cfg.apiKey).trim() },
        body: form,
        signal: controller.signal
      });
      let data = null;
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) {
        const apiMsg = data && (data.error && (data.error.message || data.error.code) || data.message || data.msg);
        throw new Error('参考图生图接口返回 ' + res.status + (apiMsg ? '：' + apiMsg : ''));
      }
      return parseImageResult(res, data);
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('参考图生图超时（120 秒），请换线路或重试。');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function addGeneratedImageToChat(src, photoId) {
    try {
      if (!window.appData) return;
      if (!Array.isArray(window.appData.chatHistory)) window.appData.chatHistory = [];
      const content = '[IMAGE:' + src + ']';
      const historyItem = {
        role: 'assistant',
        content: content,
        time: nowStr(),
        fromAlbum: true,
        fromGenerated: true
      };
      if (photoId) historyItem.albumPhotoId = photoId;
      window.appData.chatHistory.push(historyItem);
      const idx = window.appData.chatHistory.length - 1;
      if (typeof window.renderMessageBubble === 'function') {
        window.renderMessageBubble('assistant', content, nowStr(), '', idx);
      }
      if (typeof window.safeSaveChatHistory === 'function') window.safeSaveChatHistory();
      if (typeof window.scrollChatToBottom === 'function') window.scrollChatToBottom();
      if (typeof window.noteChatImageSent === 'function') window.noteChatImageSent();
      if (typeof window.renderWechatSessions === 'function') window.renderWechatSessions();
    } catch (e) {
      console.warn('[ImageGen] 发到聊天失败：', e);
    }
  }

  async function generateCharacterImage(userPrompt, options) {
    options = options || {};
    const char = options.charId && typeof window.findCharacterById === 'function'
      ? window.findCharacterById(options.charId)
      : activeChar();
    if (!char || !char.id) throw new Error('先打开一个角色的单聊，再生图。');
    const settings = getCharacterImageSettings(char.id);
    if (!settings.enabled) throw new Error('这个角色关闭了「角色生图」，请先去聊天设定打开。');
    const prompt = buildImagePrompt(userPrompt, char, settings);
    const cfg = imageRouteConfig();
    let src;
    if (settings.refImage) {
      try {
        src = await requestImageEdit(prompt, options.size || '1024x1024', cfg || {}, settings.refImage);
      } catch (e) {
        throw new Error('参考图模式失败：' + ((e && e.message) || '接口不支持 /images/edits') + '。可移除参考图改用文本锁脸。');
      }
    } else {
      src = await requestImage(prompt, options.size || '1024x1024', cfg || {});
    }

    let photo = null;
    let finalSrc = src;
    if (options.saveToAlbum !== false) {
      const saver = (typeof window.savePhotoToAlbum === 'function')
        ? window.savePhotoToAlbum
        : (typeof savePhotoToAlbum === 'function' ? savePhotoToAlbum : null);
      if (saver) {
        photo = await saver(src, ['AI生成'], true, {
          ownerType: 'char',
          ownerId: char.id,
          source: 'generated',
          caption: String(userPrompt || '').trim().slice(0, 120)
        });
        if (photo && photo.src) finalSrc = photo.src;
      }
    }

    if (options.sendToChat !== false) {
      addGeneratedImageToChat(finalSrc, photo && photo.id);
    }

    return { src: finalSrc, photo: photo, charId: char.id, charName: char.name || '' };
  }

  function setStatus(text, color) {
    const el = document.getElementById('image-gen-status');
    if (!el) return;
    el.style.display = text ? 'block' : 'none';
    el.innerText = text || '';
    el.style.color = color || 'var(--color-text-secondary)';
  }

  function compressReferenceImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//i.test(file.type || '')) {
        reject(new Error('请选择一张图片。'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取图片失败。')); };
      reader.onload = function () {
        const img = new Image();
        img.onerror = function () { reject(new Error('图片格式无法识别。')); };
        img.onload = function () {
          try {
            const max = 1024;
            const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
            const w = Math.max(1, Math.round((img.width || 1) * scale));
            const h = Math.max(1, Math.round((img.height || 1) * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            let data = canvas.toDataURL('image/jpeg', 0.86);
            if (data.length > 1100000) data = canvas.toDataURL('image/jpeg', 0.72);
            resolve(data);
          } catch (e) { reject(new Error('参考图压缩失败：' + e.message)); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.uploadCharacterImageRef = function (input) {
    const char = activeChar();
    if (!char || !char.id) {
      alert('先打开一个角色的单聊，再设置参考图。');
      return;
    }
    const file = input && input.files && input.files[0];
    if (!file) return;
    compressReferenceImage(file).then(function (dataUrl) {
      const saved = saveCharacterImageSettings(char.id, { refImage: dataUrl });
      if (!saved) throw new Error('参考图太大，本地存储放不下。请换一张更小的图。');
      renderCharacterImageSettingsUI();
      const refStatus = document.getElementById('char-image-ref-status');
      if (refStatus) refStatus.innerText = '已设置参考图 · 生成时走 /images/edits 硬锁';
    }).catch(function (err) {
      alert((err && err.message) || '参考图处理失败。');
    }).finally(function () {
      try { input.value = ''; } catch (e) {}
    });
  };

  window.clearCharacterImageRef = function () {
    const char = activeChar();
    if (!char || !char.id) return;
    saveCharacterImageSettings(char.id, { refImage: '' });
    renderCharacterImageSettingsUI();
  };

  window.generateCharacterImage = generateCharacterImage;
  window.appendGeneratedImageToChat = addGeneratedImageToChat;
  window.openCharacterImageGen = function () {
    const char = activeChar();
    if (!char || !char.id) {
      alert('先打开一个角色的单聊，再生图。');
      return;
    }
    const s = getCharacterImageSettings(char.id);
    if (!s.enabled) {
      alert('这个角色关闭了「角色生图」。去「聊天设定 → 角色生图」打开后再试。');
      return;
    }
    const modal = document.getElementById('image-gen-modal');
    if (!modal) return;
    const plusD = document.getElementById('plus-drawer');
    if (plusD) plusD.classList.remove('open');
    const stickerD = document.getElementById('sticker-drawer');
    if (stickerD) stickerD.classList.remove('open');
    const charLine = document.getElementById('image-gen-character');
    if (charLine) charLine.innerText = '当前角色：' + (char.name || '未命名角色') + ' · 生成后会存入 TA 的角色相簿';
    const input = document.getElementById('image-gen-prompt');
    if (input && !input.value) {
      const chatInput = document.getElementById('chat-input');
      const draft = chatInput && chatInput.value.trim();
      if (draft) input.value = draft;
    }
    const result = document.getElementById('image-gen-result');
    if (result) result.style.display = 'none';
    setStatus('');
    modal.classList.add('open');
    if (input) { try { input.focus(); } catch (e) {} }
  };

  window.closeCharacterImageGen = function () {
    const modal = document.getElementById('image-gen-modal');
    if (modal) modal.classList.remove('open');
  };

  window.testImageApi = async function () {
    const btn = document.getElementById('api-image-test-btn');
    const status = document.getElementById('api-image-test-status');
    const wrap = document.getElementById('api-image-test-wrap');
    const img = document.getElementById('api-image-test-img');
    const note = document.getElementById('api-image-test-note');

    if (window.ImagePresets && typeof window.ImagePresets.captureForm === 'function') {
      try { window.ImagePresets.captureForm(); } catch (e) {}
    }
    const cfg = imageRouteConfig();
    if (!cfg || !cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      if (status) {
        status.style.display = 'block';
        status.style.color = 'var(--danger-primary)';
        status.innerText = '先补全 Base URL、API Key 和生图模型，再点测试。';
      }
      return;
    }

    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; btn.innerText = '测试中…'; }
    if (wrap) wrap.style.display = 'none';
    if (img) img.removeAttribute('src');
    if (status) {
      status.style.display = 'block';
      status.style.color = 'var(--color-text-secondary)';
      status.innerText = '正在用固定提示词请求生图，不带任何角色设定…';
    }

    const testPrompt = '一张简洁的测试图：纯白背景中央放一颗红色苹果，柔和自然光，写实摄影质感，画面干净；不要任何文字、水印、logo、二维码。';
    try {
      const src = await requestImage(testPrompt, '1024x1024', cfg);
      if (img) img.src = src;
      if (wrap) wrap.style.display = 'block';
      if (note) note.innerText = '固定测试提示词：一颗红苹果，纯白背景。没有使用任何角色锁脸、画风、参考图或聊天上下文。';
      if (status) {
        status.style.color = '#07c160';
        status.innerText = '测试成功：接口返回了图片，当前地址 / Key / 模型可用。';
      }
    } catch (err) {
      const msg = (err && err.message) ? err.message : '测试失败';
      if (status) {
        status.style.color = 'var(--danger-primary)';
        status.innerText = '测试失败：' + msg;
      }
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = '测试'; }
    }
  };

  window.runCharacterImageGen = function () {
    const input = document.getElementById('image-gen-prompt');
    const promptText = input ? input.value.trim() : '';
    if (!promptText) {
      setStatus('先写一句想画什么。', 'var(--danger-primary)');
      if (input) input.focus();
      return;
    }
    const sizeEl = document.getElementById('image-gen-size');
    const sendEl = document.getElementById('image-gen-send-chat');
    const btn = document.getElementById('image-gen-run');
    const result = document.getElementById('image-gen-result');
    const preview = document.getElementById('image-gen-preview');
    const saved = document.getElementById('image-gen-saved');

    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; btn.innerText = '正在生成…'; }
    if (result) result.style.display = 'none';
    setStatus('正在调生图接口，通常需要 10–60 秒…', 'var(--color-text-secondary)');

    generateCharacterImage(promptText, {
      size: sizeEl ? sizeEl.value : '1024x1024',
      sendToChat: sendEl ? sendEl.checked : true,
      saveToAlbum: true
    }).then(function (out) {
      if (preview) preview.src = out.src;
      if (result) result.style.display = 'block';
      if (saved) {
        if (out.photo) {
          saved.style.color = '#07c160';
          saved.innerText = '已存入「' + (out.charName || '当前角色') + '」的角色相簿' +
            (sendEl && sendEl.checked ? '，并已发到聊天。' : '。');
        } else {
          saved.style.color = 'var(--danger-primary)';
          saved.innerText = '图已生成，但存入角色相簿失败；' +
            (sendEl && sendEl.checked ? '已先发到聊天。' : '没有发到聊天。');
        }
      }
      setStatus('生成完成。');
    }).catch(function (err) {
      const msg = (err && err.message) ? err.message : '生成失败';
      setStatus(msg, 'var(--danger-primary)');
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = '开始生成'; }
    });
  };
})();
