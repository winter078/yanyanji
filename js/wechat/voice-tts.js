/* ================= 角色语音 · 每个角色一套声音 =================
   两种出声方式：
   - 配了语音接口：走 OpenAI 兼容 /audio/speech，按角色的音色 ID 合成；
   - 没配或接口失败：退回浏览器系统声音，并按角色做不同语速 / 音高。
   只有用户点播放或试听时才出声，不在后台自动朗读。 */
(function () {
  'use strict';

  var VOLC_DEFAULT_VOICE = 'ICL_uranus_zh_male_cixingnansang_tob';
  var CONFIG_KEY = 'momo_tts_config_v1';
  var MAX_CACHE = 10;
  var currentAudio = null;
  var currentButton = null;
  var speakSeq = 0;
  var cache = new Map();

  function safeParse(raw, fallback) {
    try {
      var v = JSON.parse(raw || 'null');
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = 1;
    return Math.max(min, Math.min(max, n));
  }

  function normalizeConfig(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    return {
      provider: raw.provider === 'openai' ? 'openai' : 'volc',
      enabled: !!raw.enabled,
      baseUrl: String(raw.baseUrl || '').trim().replace(/\/+$/, ''),
      apiKey: String(raw.apiKey || '').trim(),
      volcKey: String(raw.volcKey || '').trim(),
      model: String(raw.model || 'gpt-4o-mini-tts').trim(),
      defaultVoice: String(raw.defaultVoice || '').trim()
    };
  }

  var config = normalizeConfig(safeParse(localStorage.getItem(CONFIG_KEY), {}));

  function getConfig() {
    return {
      provider: config.provider,
      enabled: config.enabled,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      volcKey: config.volcKey,
      model: config.model,
      defaultVoice: config.defaultVoice
    };
  }

  function saveConfig(patch) {
    config = normalizeConfig(Object.assign({}, config, patch || {}));
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch (e) {}
    renderSettings();
    return getConfig();
  }

  function isEnabled() {
    if (config.provider === 'volc') return !!(config.enabled && config.volcKey);
    return !!(config.enabled && config.baseUrl);
  }

  function toast(message) {
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(message);
        return;
      }
      var old = document.getElementById('char-voice-toast');
      if (old) old.remove();
      var el = document.createElement('div');
      el.id = 'char-voice-toast';
      el.textContent = message;
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:420;max-width:min(330px,calc(100vw - 44px));padding:9px 13px;border-radius:12px;background:rgba(24,26,31,.95);border:0.5px solid rgba(255,255,255,.12);color:#f4efec;font-size:12px;line-height:1.45;text-align:center;box-shadow:0 8px 26px rgba(0,0,0,.34);pointer-events:none;';
      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.remove(); }, 3200);
    } catch (e) {}
  }

  function charInfo(charId) {
    try {
      if (charId && typeof window.findCharacterById === 'function') return window.findCharacterById(charId) || {};
    } catch (e) {}
    return {};
  }

  function voiceForChar(charId, override) {
    override = override || {};
    var c = charInfo(charId);
    var fallbackVoice = config.provider === 'volc' ? VOLC_DEFAULT_VOICE : 'alloy';
    var defaultVoice = config.defaultVoice || fallbackVoice;
    if (config.provider === 'volc' && defaultVoice === 'alloy') defaultVoice = fallbackVoice;
    if (config.provider === 'openai' && /^ICL_/i.test(defaultVoice)) defaultVoice = 'alloy';
    var charVoice = String(override.voiceId || c.voiceId || '').trim();
    if (config.provider === 'volc' && /^(alloy|ash|ballad|cedar|coral|echo|fable|marin|nova|onyx|sage|shimmer|verse)$/i.test(charVoice)) charVoice = '';
    if (config.provider === 'openai' && /^ICL_/i.test(charVoice)) charVoice = '';
    var voiceId = String(charVoice || defaultVoice).trim();
    var rate = clamp(override.rate || c.voiceRate || 1, 0.6, 1.6);
    return { voiceId: voiceId, rate: rate, charName: String(c.name || '角色') };
  }

  function ttsEndpoint(base) {
    base = String(base || '').trim().replace(/\/+$/, '');
    if (!base) return '';
    return /\/audio\/speech$/i.test(base) ? base : base + '/audio/speech';
  }

  function audioHeader(key) {
    var h = { 'Content-Type': 'application/json' };
    if (key) h.Authorization = 'Bearer ' + key;
    return h;
  }

  function responseError(status, text) {
    var msg = '';
    try {
      var j = JSON.parse(text);
      msg = (j.error && (j.error.message || j.error.code)) || (typeof j.error === 'string' ? j.error : '') || j.message || j.msg || '';
    } catch (e) { msg = String(text || '').trim().slice(0, 120); }
    if (msg) {
      if (status === 401) return 'Key 无效或已失效：' + msg;
      if (status === 403) return 'Key 没权限，或「音频生成 1.0」还没开通：' + msg;
      return msg;
    }
    if (status === 401 || status === 403) return 'Key 没权限或已失效';
    if (status === 404) return '接口地址里找不到 /audio/speech 或模型名不对';
    if (status === 413) return '要读的文字太长';
    if (status === 429) return '额度用完或服务太忙';
    if (status >= 500) return '语音服务暂时不可用';
    return '接口返回 ' + status;
  }

  function base64ToBlob(b64, mime) {
    b64 = String(b64 || '').replace(/^data:audio\/[^;]+;base64,/, '').trim();
    if (!b64) return null;
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'audio/mpeg' });
  }

  async function requestTts(text, voice, rate) {
    if (!isEnabled()) throw new Error('还没配置角色语音接口');
    if (config.provider === 'volc') return requestVolcTts(text, voice, rate);
    var url = ttsEndpoint(config.baseUrl);
    if (!url) throw new Error('语音接口地址是空的');
    var body = {
      model: config.model || 'gpt-4o-mini-tts',
      voice: voice || config.defaultVoice || 'alloy',
      input: String(text || '').slice(0, 4096),
      response_format: 'mp3',
      speed: clamp(rate || 1, 0.6, 1.6)
    };
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 35000);
    var resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: audioHeader(config.apiKey),
        body: JSON.stringify(body)
      });
    } catch (e) {
      if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))) {
        throw new Error('语音接口超时，35 秒没返回');
      }
      throw new Error('连不上语音接口：' + (e && e.message ? e.message : e));
    } finally {
      clearTimeout(timer);
    }

    var ct = String(resp.headers.get('content-type') || '').toLowerCase();
    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch (e) {}
      throw new Error(responseError(resp.status, errText));
    }
    if (/audio\//.test(ct) || /octet-stream/.test(ct) || /mpeg|mp3/.test(ct)) {
      var blob = await resp.blob();
      if (!blob || !blob.size) throw new Error('语音接口返回了空音频');
      return URL.createObjectURL(blob);
    }

    // 有些兼容接口会返回 JSON：{ url } / { audio_url } / { data: { audio } }。
    var raw = '';
    try { raw = await resp.text(); } catch (e) {}
    var data = safeParse(raw, null);
    if (!data) throw new Error('语音接口没有返回音频');
    var nested = data.data && typeof data.data === 'object' ? data.data : {};
    var src = data.audio_url || data.url || data.audioUrl || data.audio || data.audio_base64 ||
      nested.audio_url || nested.url || nested.audio || nested.audio_base64 || '';
    if (typeof src === 'string' && /^(https?:|blob:|data:audio\/)/i.test(src)) return src;
    if (typeof src === 'string' && src.length > 32) {
      var b64blob = base64ToBlob(src, 'audio/mpeg');
      if (b64blob) return URL.createObjectURL(b64blob);
    }
    throw new Error('语音接口返回的内容不是音频；确认地址是 /audio/speech');
  }

  async function requestVolcTts(text, voice, rate) {
    if (!config.volcKey) throw new Error('还没填火山 API Key');
    if (!voice) throw new Error('这个角色还没填火山音色 ID');
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 60000);
    var resp;
    try {
      resp = await fetch('/api/tts/volc', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: config.volcKey,
          voice: voice,
          text: String(text || '').slice(0, 3000),
          speed: clamp(rate || 1, 0.6, 1.6)
        })
      });
    } catch (e) {
      if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))) {
        throw new Error('火山语音超时，60 秒没返回');
      }
      throw new Error('连不上火山语音：' + (e && e.message ? e.message : e));
    } finally {
      clearTimeout(timer);
    }
    var raw = '';
    try { raw = await resp.text(); } catch (e) {}
    var data = safeParse(raw, null);
    if (!resp.ok) throw new Error(responseError(resp.status, raw) || ('火山语音返回 ' + resp.status));
    if (!data) throw new Error('火山语音返回的内容不是 JSON');
    if (typeof data.url === 'string' && data.url) return data.url;
    var b64 = data.audio || data.audio_base64 || (data.data && (data.data.audio || data.data.audio_base64));
    if (typeof b64 === 'string' && b64.length > 32) {
      var blob = base64ToBlob(b64, 'audio/mpeg');
      if (blob) return URL.createObjectURL(blob);
    }
    throw new Error('火山语音没有返回音频');
  }

  function rememberAudio(key, src) {
    if (cache.has(key)) {
      var old = cache.get(key);
      if (old && old.indexOf('blob:') === 0) { /* 保留复用的同一个 blob */ }
      cache.delete(key);
    }
    cache.set(key, src);
    while (cache.size > MAX_CACHE) {
      var firstKey = cache.keys().next().value;
      var firstSrc = cache.get(firstKey);
      cache.delete(firstKey);
      try { if (firstSrc && firstSrc.indexOf('blob:') === 0) URL.revokeObjectURL(firstSrc); } catch (e) {}
    }
  }

  function setPlaying(btn, playing) {
    if (!btn || !btn.classList) return;
    btn.classList.toggle('is-playing', !!playing);
  }

  function stop() {
    speakSeq++;
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) {}
      currentAudio = null;
    }
    setPlaying(currentButton, false);
    currentButton = null;
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  }

  async function playUrl(src, btn) {
    var audio = new Audio(src);
    currentAudio = audio;
    currentButton = btn || null;
    setPlaying(btn, true);
    var finish = function () {
      if (currentAudio === audio) {
        currentAudio = null;
        setPlaying(btn, false);
        currentButton = null;
      }
    };
    audio.onended = finish;
    audio.onerror = finish;
    try {
      await audio.play();
    } catch (e) {
      finish();
      throw new Error('浏览器没让自动播放，再点一下播放键');
    }
  }

  function hashStr(s) {
    var h = 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function systemSpeak(text, info) {
    var synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') {
      throw new Error('这个浏览器不支持系统语音，需要配语音接口');
    }
    var utter = new window.SpeechSynthesisUtterance(String(text || '').slice(0, 1200));
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (e) {}
    var v = null;
    if (info.voiceId) {
      v = voices.find(function (x) {
        return String(x.name || '').toLowerCase() === info.voiceId.toLowerCase() ||
          String(x.voiceURI || '').toLowerCase() === info.voiceId.toLowerCase();
      }) || null;
    }
    if (!v) {
      var zh = voices.filter(function (x) { return /zh|cmn|Chinese/i.test(String(x.lang || '') + ' ' + String(x.name || '')); });
      if (zh.length) v = zh[hashStr(info.charName || info.voiceId || '') % zh.length];
    }
    if (v) utter.voice = v;
    utter.lang = (v && v.lang) || 'zh-CN';
    utter.rate = info.rate;
    utter.pitch = 0.9 + (hashStr(info.charName || '') % 11) / 55;
    synth.cancel();
    synth.speak(utter);
    return utter;
  }

  async function speak(text, options) {
    options = options || {};
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    var info = voiceForChar(options.charId, options);
    stop();
    var seq = ++speakSeq;
    if (options.btn) setPlaying(options.btn, true);
    try {
      if (isEnabled()) {
        var key = [info.voiceId, info.rate, text].join('|');
        var src = cache.get(key);
        if (!src) {
          src = await requestTts(text, info.voiceId, info.rate);
          rememberAudio(key, src);
        }
        if (seq !== speakSeq) return;
        await playUrl(src, options.btn);
      } else {
        systemSpeak(text, info);
        if (seq !== speakSeq) return;
        if (options.btn) {
          var clear = function () { setPlaying(options.btn, false); };
          setTimeout(clear, Math.max(1800, Math.min(9000, text.length * 180)));
        }
        if (options.onFallback) options.onFallback('系统语音');
      }
    } catch (e) {
      if (seq !== speakSeq) return;
      setPlaying(options.btn, false);
      var msg = e && e.message ? e.message : String(e);
      // 音频已经拿到了，只是浏览器拦了第一次自动播放：不要退回系统声音，缓存住等用户再点一次。
      if (/浏览器没让自动播放/.test(msg)) {
        toast(msg);
        return;
      }
      if (options.fallback !== false) {
        toast('语音接口没成功：' + msg + '；先用系统声音');
        try {
          systemSpeak(text, info);
          if (options.onFallback) options.onFallback('系统语音');
        } catch (e2) {
          toast(String(e2 && e2.message || e2));
        }
      } else {
        throw e;
      }
    }
  }

  function preview(options) {
    options = options || {};
    var charId = options.charId || window.__editingCharId || '';
    var info = voiceForChar(charId, options);
    var text = options.text || ('你好，我是' + info.charName + '。今天想和你说句话。');
    return speak(text, {
      charId: charId,
      voiceId: options.voiceId,
      rate: options.rate,
      btn: options.btn,
      fallback: options.fallback,
      onFallback: options.onFallback
    });
  }

  function setStatus(text, ok) {
    var el = document.getElementById('tts-status');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = ok ? '#07c160' : 'var(--color-text-secondary)';
  }

  function updateProviderFields() {
    var providerEl = document.getElementById('tts-provider-input');
    var provider = providerEl ? providerEl.value : config.provider;
    var openai = document.getElementById('tts-openai-fields');
    var volc = document.getElementById('tts-volc-fields');
    var voice = document.getElementById('tts-default-voice-input');
    if (openai) openai.style.display = provider === 'openai' ? '' : 'none';
    if (volc) volc.style.display = provider === 'volc' ? '' : 'none';
    if (voice) {
      var current = String(voice.value || '').trim();
      if (provider === 'volc' && (!current || current === 'alloy')) voice.value = VOLC_DEFAULT_VOICE;
      if (provider === 'openai' && /^ICL_/i.test(current)) voice.value = 'alloy';
    }
  }
  window.updateTtsProviderFields = updateProviderFields;

  function renderSettings() {
    var provider = document.getElementById('tts-provider-input');
    var on = document.getElementById('tts-enabled-toggle');
    var base = document.getElementById('tts-base-input');
    var key = document.getElementById('tts-key-input');
    var volcKey = document.getElementById('tts-volc-key-input');
    var model = document.getElementById('tts-model-input');
    var voice = document.getElementById('tts-default-voice-input');
    if (provider) provider.value = config.provider;
    if (on) on.checked = !!config.enabled;
    if (base) base.value = config.baseUrl || '';
    if (key) key.value = config.apiKey || '';
    if (volcKey) volcKey.value = config.volcKey || '';
    if (model) model.value = config.model || '';
    if (voice) voice.value = config.defaultVoice || '';
    updateProviderFields();
    if (!config.enabled) setStatus('还没启用。选好接口、填好 Key 后打开开关，角色才能出声。', false);
    else if (config.provider === 'volc' && !config.volcKey) setStatus('启用了，但火山 API Key 还是空的。', false);
    else if (config.provider === 'openai' && !config.baseUrl) setStatus('启用了，但 OpenAI 兼容地址还是空的。', false);
    else if (config.provider === 'volc') setStatus('已启用：火山豆包 · 角色卡里填音色 ID', true);
    else setStatus('已启用：' + (config.model || '默认模型') + ' · 默认音色 ' + (config.defaultVoice || 'alloy'), true);
  }

  function saveFromSettings() {
    updateProviderFields();
    var provider = document.getElementById('tts-provider-input');
    var on = document.getElementById('tts-enabled-toggle');
    var base = document.getElementById('tts-base-input');
    var key = document.getElementById('tts-key-input');
    var volcKey = document.getElementById('tts-volc-key-input');
    var model = document.getElementById('tts-model-input');
    var voice = document.getElementById('tts-default-voice-input');
    var saved = saveConfig({
      provider: provider ? provider.value : config.provider,
      enabled: !!(on && on.checked),
      baseUrl: base ? base.value : '',
      apiKey: key ? key.value : '',
      volcKey: volcKey ? volcKey.value : '',
      model: model ? model.value : '',
      defaultVoice: voice ? voice.value : ''
    });
    if (saved.provider === 'volc') {
      setStatus(saved.enabled ? '已保存：火山豆包；角色卡里填音色 ID' : '已保存，但语音开关关着。', saved.enabled);
    } else {
      setStatus(saved.enabled ? ('已保存：' + (saved.model || '默认模型') + ' · ' + (saved.defaultVoice || 'alloy')) : '已保存，但语音开关关着。', saved.enabled);
    }
    toast(saved.enabled ? '语音设置已保存' : '语音设置已保存，开关仍是关的');
    return saved;
  }

  async function testFromSettings() {
    var saved = saveFromSettings();
    if (!saved.enabled) {
      setStatus('先打开「启用角色语音」再试听。', false);
      return;
    }
    var btn = document.getElementById('tts-test-btn');
    setStatus('正在请求语音接口…', false);
    try {
      await speak('你好，我是小手机里的角色。听到这句话，就说明语音接通了。', {
        charId: '',
        voiceId: saved.defaultVoice,
        rate: 1,
        btn: btn,
        fallback: false
      });
      setStatus('试听成功：接口返回了音频。', true);
    } catch (e) {
      setStatus('试听失败：' + (e && e.message ? e.message : e), false);
      toast('试听失败：' + (e && e.message ? e.message : e));
    }
  }

  window.CharVoice = {
    getConfig: getConfig,
    saveConfig: saveConfig,
    voiceForChar: voiceForChar,
    isEnabled: isEnabled,
    speak: speak,
    preview: preview,
    stop: stop,
    renderSettings: renderSettings,
    saveFromSettings: saveFromSettings,
    testFromSettings: testFromSettings
  };
  window.saveTtsSettings = saveFromSettings;
  window.testTtsApi = testFromSettings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { renderSettings(); });
  } else {
    renderSettings();
  }
})();
