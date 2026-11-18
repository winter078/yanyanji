// API 预设与功能路由：预设只存聊天 API 的供应商配置，功能路由单独决定其他能力用哪套预设
(function() {
  const K_PRESETS = 'momo_api_presets_v1';
  const K_ROUTES = 'momo_api_routes_v1';
  const K_ACTIVE = 'momo_api_active_preset';
  const ROUTE_KEYS = ['memory', 'image', 'tts', 'asr', 'search'];

  function safeParse(raw, fallback) {
    try {
      const value = JSON.parse(raw || 'null');
      return value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function uid() {
    return 'preset_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function legacyValues() {
    const a = window.appData || {};
    return {
      baseUrl: a.apiBase || localStorage.getItem('momo_api_base') || 'https://api.deepseek.com/v1',
      apiKey: a.apiKey || localStorage.getItem('momo_api_key') || '',
      defaultModel: a.model || localStorage.getItem('momo_api_model') || 'deepseek-chat',
      visionModel: a.visionModel || localStorage.getItem('momo_api_vision_model') || '',
      readerModel: a.readerModel || localStorage.getItem('momo_api_reader_model') || ''
    };
  }

  function normalizePreset(p) {
    const fallback = legacyValues();
    p = p || {};
    return {
      id: p.id || uid(),
      name: p.name || '未命名线路',
      // 预设只负责聊天 API：地址、Key、主聊天模型。
      // 显式保存为空时保留空值，只有旧数据缺字段才回填默认值。
      baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : fallback.baseUrl,
      apiKey: p.apiKey || '',
      defaultModel: typeof p.defaultModel === 'string' ? p.defaultModel : fallback.defaultModel,
      visionModel: typeof p.visionModel === 'string' ? p.visionModel : '',
      readerModel: typeof p.readerModel === 'string' ? p.readerModel : ''
    };
  }

  function makeDefaultPreset() {
    const v = legacyValues();
    return {
      id: 'preset_default',
      name: '默认线路',
      baseUrl: v.baseUrl,
      apiKey: v.apiKey,
      defaultModel: v.defaultModel,
      visionModel: v.visionModel,
      readerModel: v.readerModel
    };
  }

  let presets = safeParse(localStorage.getItem(K_PRESETS), null);
  if (!Array.isArray(presets) || !presets.length) {
    presets = [makeDefaultPreset()];
    localStorage.setItem(K_PRESETS, JSON.stringify(presets));
  } else {
    presets = presets.map(normalizePreset);
  }

  let activeId = localStorage.getItem(K_ACTIVE) || '';
  if (!presets.some(p => p.id === activeId)) {
    activeId = presets[0].id;
    localStorage.setItem(K_ACTIVE, activeId);
  }

  let routes = safeParse(localStorage.getItem(K_ROUTES), null);
  if (!routes || typeof routes !== 'object') routes = {};
  if (!routes.memory || typeof routes.memory !== 'object') {
    routes.memory = { presetId: '', model: '', enabled: true };
  }
  ROUTE_KEYS.forEach(key => {
    if (!routes[key] || typeof routes[key] !== 'object') {
      routes[key] = { presetId: '', model: '', enabled: key === 'memory' };
    }
  });
  if (routes.memory.enabled === false) routes.memory.enabled = true;

  function persistPresets() {
    localStorage.setItem(K_PRESETS, JSON.stringify(presets));
    localStorage.setItem(K_ACTIVE, activeId);
  }

  function persistRoutes() {
    localStorage.setItem(K_ROUTES, JSON.stringify(routes));
  }

  function getPreset(id) {
    return presets.find(p => p.id === id) || null;
  }

  function activePreset() {
    return getPreset(activeId) || presets[0] || null;
  }

  function fillSettingsForm(id) {
    const p = getPreset(id) || activePreset();
    if (!p) return;
    const nameEl = document.getElementById('api-preset-name-input');
    if (nameEl) nameEl.value = p.name || '';
    const baseEl = document.getElementById('api-base-input');
    if (baseEl) baseEl.value = p.baseUrl || '';
    const keyEl = document.getElementById('api-key-input');
    if (keyEl) keyEl.value = p.apiKey || '';
    const modelEl = document.getElementById('api-model-input');
    if (modelEl) modelEl.value = p.defaultModel || '';
    // 识图模型、阅读伴读模型不归预设管理，切换时保持原值。
  }

  function syncLegacy() {
    const p = activePreset();
    if (!p) return;
    const chatBase = p.baseUrl || 'https://api.deepseek.com/v1';
    const chatModel = p.defaultModel || 'deepseek-chat';
    if (window.appData) {
      window.appData.apiBase = chatBase;
      window.appData.apiKey = p.apiKey || '';
      window.appData.model = chatModel;
    }
    // 只同步聊天 API；识图 / 阅读伴读模型由各自输入框独立保存。
    localStorage.setItem('momo_api_base', chatBase);
    localStorage.setItem('momo_api_key', p.apiKey || '');
    localStorage.setItem('momo_api_model', chatModel);
  }

  function renderPresetSelect() {
    const sel = document.getElementById('api-preset-select');
    if (!sel) return;
    sel.innerHTML = presets.map(p =>
      '<option value="' + p.id + '">' + (p.name || '未命名线路') + '</option>'
    ).join('');
    sel.value = activeId;
  }

  function renderRoutes() {
    const routeSel = document.getElementById('api-route-memory-preset');
    if (routeSel) {
      routeSel.innerHTML = '<option value="">跟随当前预设</option>' +
        presets.map(p => '<option value="' + p.id + '">' + (p.name || '未命名线路') + '</option>').join('');
      routeSel.value = routes.memory.presetId || '';
    }
    const routeModel = document.getElementById('api-route-memory-model');
    if (routeModel) routeModel.value = routes.memory.model || '';

    const imageSel = document.getElementById('api-route-image-preset');
    if (imageSel) {
      imageSel.innerHTML = '<option value="">跟随当前预设</option>' +
        presets.map(p => '<option value="' + p.id + '">' + (p.name || '未命名线路') + '</option>').join('');
      imageSel.value = routes.image.presetId || '';
    }
    const imageModel = document.getElementById('api-route-image-model');
    if (imageModel) imageModel.value = routes.image.model || '';
    const imageStatus = document.getElementById('api-route-image-status');
    if (imageStatus) {
      const model = (routes.image.model || '').trim();
      imageStatus.innerText = model ? '已配置' : '待填生图模型';
      imageStatus.style.color = model ? '#07c160' : 'var(--color-text-secondary)';
    }
  }

  function renderSettings() {
    renderPresetSelect();
    fillSettingsForm(activeId);
    renderRoutes();
    syncLegacy();
  }

  function captureChatForm() {
    const p = activePreset();
    if (!p) return null;
    const nameEl = document.getElementById('api-preset-name-input');
    const baseEl = document.getElementById('api-base-input');
    const keyEl = document.getElementById('api-key-input');
    const modelEl = document.getElementById('api-model-input');
    p.name = (nameEl && nameEl.value.trim()) || p.name || '未命名线路';
    p.baseUrl = baseEl ? baseEl.value.trim() : '';
    p.apiKey = keyEl ? keyEl.value.trim() : '';
    p.defaultModel = modelEl ? modelEl.value.trim() : '';

    // 只保存聊天 API。识图 / 阅读伴读模型和功能路由不随预设切换。
    persistPresets();
    return p;
  }

  function captureForm() {
    const p = captureChatForm();
    if (!p) return null;

    const routeSel = document.getElementById('api-route-memory-preset');
    const routeModel = document.getElementById('api-route-memory-model');
    routes.memory = {
      presetId: routeSel ? routeSel.value : (routes.memory.presetId || ''),
      model: routeModel ? routeModel.value.trim() : (routes.memory.model || ''),
      enabled: true
    };

    const imageSel = document.getElementById('api-route-image-preset');
    const imageModel = document.getElementById('api-route-image-model');
    routes.image = {
      presetId: imageSel ? imageSel.value : (routes.image.presetId || ''),
      model: imageModel ? imageModel.value.trim() : (routes.image.model || ''),
      enabled: true
    };

    persistRoutes();
    renderRoutes();
    return p;
  }

  function switchTo(id) {
    if (!getPreset(id)) return;
    // 切换前只写回当前聊天配置，不触碰识图、阅读模型和功能路由。
    try { captureChatForm(); } catch (e) {}
    activeId = id;
    persistPresets();
    fillSettingsForm(activeId);
    syncLegacy();
    const sel = document.getElementById('api-preset-select');
    if (sel) sel.value = activeId;
  }

  function createPreset() {
    try { captureChatForm(); } catch (e) {}
    // 新建即清空聊天 API 字段，方便直接填一套新线路。
    const p = normalizePreset({
      id: uid(),
      name: '新线路 ' + (presets.length + 1),
      baseUrl: '',
      apiKey: '',
      defaultModel: '',
      visionModel: '',
      readerModel: ''
    });
    presets.push(p);
    activeId = p.id;
    persistPresets();
    syncLegacy();
    renderPresetSelect();
    fillSettingsForm(activeId);
    // 只把新线路补进功能路由的下拉，不重置当前路由选择和模型输入。
    const routeSel = document.getElementById('api-route-memory-preset');
    if (routeSel) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || '未命名线路';
      routeSel.appendChild(opt);
    }
    const imageSel = document.getElementById('api-route-image-preset');
    if (imageSel) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || '未命名线路';
      imageSel.appendChild(opt);
    }
    const nameEl = document.getElementById('api-preset-name-input');
    if (nameEl) {
      nameEl.focus();
      try { nameEl.select(); } catch (e) {}
    }
  }

  function saveCurrentPreset() {
    const p = captureChatForm();
    if (!p) return;
    syncLegacy();
    renderPresetSelect();
    alert('已保存当前聊天预设：' + (p.name || '未命名线路'));
  }

  function deletePreset() {
    if (presets.length <= 1) {
      alert('至少保留一套 API 预设。');
      return;
    }
    const p = activePreset();
    if (!p) return;
    if (!confirm('删除预设「' + p.name + '」？\n\n不会删除聊天记录，但这个预设的地址和 Key 会被移除。')) return;
    presets = presets.filter(item => item.id !== p.id);
    if (routes.memory.presetId === p.id) routes.memory.presetId = '';
    if (routes.image.presetId === p.id) routes.image.presetId = '';
    activeId = presets[0].id;
    persistPresets();
    persistRoutes();
    syncLegacy();
    renderSettings();
  }

  function resolve(feature) {
    // 生图有独立的多套生图预设；没有加载独立模块时再退回旧的功能路由。
    if (feature === 'image' && window.ImagePresets && typeof window.ImagePresets.resolve === 'function') {
      return window.ImagePresets.resolve();
    }
    const route = routes[feature] || {};
    const routePreset = route.presetId ? getPreset(route.presetId) : null;
    const preset = routePreset || activePreset();
    if (!preset) {
      return { presetId: '', name: '', baseUrl: '', apiKey: '', model: '', feature: feature, source: 'missing' };
    }
    return {
      presetId: preset.id,
      name: preset.name,
      baseUrl: preset.baseUrl || '',
      apiKey: preset.apiKey || '',
      model: (route.model && route.model.trim()) || (feature === 'image' ? '' : (preset.defaultModel || 'deepseek-chat')),
      feature: feature,
      source: routePreset ? 'route' : 'active'
    };
  }

  window.ApiPresets = {
    list: () => presets.map(p => Object.assign({}, p)),
    active: () => {
      const p = activePreset();
      return p ? Object.assign({}, p) : null;
    },
    activeId: () => activeId,
    getRoutes: () => JSON.parse(JSON.stringify(routes)),
    resolve: resolve,
    renderSettings: renderSettings,
    fillSettingsForm: fillSettingsForm,
    captureForm: captureForm,
    captureChatForm: captureChatForm,
    syncLegacy: syncLegacy,
    switchTo: switchTo,
    create: createPreset,
    saveCurrent: saveCurrentPreset,
    remove: deletePreset
  };

  window.switchApiPreset = function(id) { switchTo(id); };
  window.createApiPreset = function() { createPreset(); };
  window.saveApiPreset = function() { saveCurrentPreset(); };
  window.deleteApiPreset = function() { deletePreset(); };
})();
