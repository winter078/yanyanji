// 生图 API 预设：和聊天 API 一样支持多套线路切换；聊天与生图可以各用各的 Key。
(function () {
  const K_PRESETS = 'momo_image_presets_v1';
  const K_ACTIVE = 'momo_image_active_preset';

  function safeParse(raw, fallback) {
    try {
      const value = JSON.parse(raw || 'null');
      return value === null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function uid() {
    return 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function chatPreset() {
    try {
      return (window.ApiPresets && window.ApiPresets.active) ? window.ApiPresets.active() : null;
    } catch (e) { return null; }
  }

  function oldImageRoute() {
    try {
      const routes = window.ApiPresets && window.ApiPresets.getRoutes ? window.ApiPresets.getRoutes() : {};
      return (routes && routes.image) || {};
    } catch (e) { return {}; }
  }

  function defaultPreset() {
    const active = chatPreset();
    const route = oldImageRoute();
    const routePreset = route.presetId && window.ApiPresets && window.ApiPresets.list
      ? (window.ApiPresets.list() || []).find(function (p) { return p.id === route.presetId; })
      : null;
    const source = routePreset || active || {};
    return {
      id: 'img_default',
      name: '默认生图线路',
      baseUrl: source.baseUrl || '',
      apiKey: source.apiKey || '',
      model: route.model || ''
    };
  }

  function normalizePreset(p) {
    p = p || {};
    return {
      id: p.id || uid(),
      name: p.name || '未命名生图线路',
      baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
      apiKey: p.apiKey || '',
      model: typeof p.model === 'string' ? p.model : ''
    };
  }

  let presets = safeParse(localStorage.getItem(K_PRESETS), null);
  if (!Array.isArray(presets) || !presets.length) {
    presets = [defaultPreset()];
    localStorage.setItem(K_PRESETS, JSON.stringify(presets));
  } else {
    presets = presets.map(normalizePreset);
  }

  let activeId = localStorage.getItem(K_ACTIVE) || '';
  if (!presets.some(function (p) { return p.id === activeId; })) {
    activeId = presets[0].id;
    localStorage.setItem(K_ACTIVE, activeId);
  }

  function persist() {
    localStorage.setItem(K_PRESETS, JSON.stringify(presets));
    localStorage.setItem(K_ACTIVE, activeId);
  }

  function getPreset(id) {
    return presets.find(function (p) { return p.id === id; }) || null;
  }

  function activePreset() {
    return getPreset(activeId) || presets[0] || null;
  }

  function renderSelect() {
    const sel = document.getElementById('api-image-preset-select');
    if (!sel) return;
    sel.innerHTML = presets.map(function (p) {
      return '<option value="' + p.id + '">' + (p.name || '未命名生图线路') + '</option>';
    }).join('');
    sel.value = activeId;
  }

  function clearTestResult() {
    const status = document.getElementById('api-image-test-status');
    const wrap = document.getElementById('api-image-test-wrap');
    const img = document.getElementById('api-image-test-img');
    if (status) { status.style.display = 'none'; status.innerText = ''; }
    if (wrap) wrap.style.display = 'none';
    if (img) img.removeAttribute('src');
  }

  function fillForm(id) {
    const p = getPreset(id) || activePreset();
    if (!p) return;
    clearTestResult();
    const nameEl = document.getElementById('api-image-preset-name-input');
    const baseEl = document.getElementById('api-image-base-input');
    const keyEl = document.getElementById('api-image-key-input');
    const modelEl = document.getElementById('api-image-model-input');
    if (nameEl) nameEl.value = p.name || '';
    if (baseEl) baseEl.value = p.baseUrl || '';
    if (keyEl) keyEl.value = p.apiKey || '';
    if (modelEl) modelEl.value = p.model || '';
    renderStatus();
  }

  function renderStatus() {
    const status = document.getElementById('api-image-preset-status');
    if (!status) return;
    const p = activePreset();
    if (!p) {
      status.innerText = '还没有生图线路。';
      status.style.color = 'var(--color-text-secondary)';
      return;
    }
    if (!p.baseUrl || !p.apiKey || !p.model) {
      status.innerText = '待补全：地址 / Key / 生图模型。';
      status.style.color = 'var(--color-text-secondary)';
      return;
    }
    status.innerText = '已配置 · ' + p.name + ' · ' + p.model;
    status.style.color = '#07c160';
  }

  function captureForm() {
    const p = activePreset();
    if (!p) return null;
    const nameEl = document.getElementById('api-image-preset-name-input');
    const baseEl = document.getElementById('api-image-base-input');
    const keyEl = document.getElementById('api-image-key-input');
    const modelEl = document.getElementById('api-image-model-input');
    p.name = (nameEl && nameEl.value.trim()) || p.name || '未命名生图线路';
    p.baseUrl = baseEl ? baseEl.value.trim() : '';
    p.apiKey = keyEl ? keyEl.value.trim() : '';
    p.model = modelEl ? modelEl.value.trim() : '';
    persist();
    renderSelect();
    renderStatus();
    return p;
  }

  function switchTo(id) {
    if (!getPreset(id)) return;
    try { captureForm(); } catch (e) {}
    activeId = id;
    persist();
    fillForm(activeId);
  }

  function createPreset() {
    try { captureForm(); } catch (e) {}
    const p = normalizePreset({
      id: uid(),
      name: '生图线路 ' + (presets.length + 1),
      baseUrl: '',
      apiKey: '',
      model: ''
    });
    presets.push(p);
    activeId = p.id;
    persist();
    renderSelect();
    fillForm(activeId);
    const nameEl = document.getElementById('api-image-preset-name-input');
    if (nameEl) {
      nameEl.focus();
      try { nameEl.select(); } catch (e) {}
    }
  }

  function saveCurrent() {
    const p = captureForm();
    if (!p) return;
    renderStatus();
  }

  function removePreset() {
    if (presets.length <= 1) {
      alert('至少保留一套生图预设。');
      return;
    }
    const p = activePreset();
    if (!p) return;
    if (!confirm('删除生图预设「' + p.name + '」？\n\n聊天预设和聊天记录不会受影响。')) return;
    presets = presets.filter(function (item) { return item.id !== p.id; });
    activeId = presets[0].id;
    persist();
    renderSelect();
    fillForm(activeId);
    renderStatus();
  }

  function resolve() {
    const p = activePreset();
    if (!p) {
      return { presetId: '', name: '', baseUrl: '', apiKey: '', model: '', feature: 'image', source: 'missing' };
    }
    return {
      presetId: p.id,
      name: p.name,
      baseUrl: p.baseUrl || '',
      apiKey: p.apiKey || '',
      model: p.model || '',
      feature: 'image',
      source: 'image-preset'
    };
  }

  // 溢出库读完后再读一次，避免启动早期只拿到 localStorage 的旧生图预设。
  function reloadFromStorage() {
    const loaded = safeParse(localStorage.getItem(K_PRESETS), null);
    if (Array.isArray(loaded) && loaded.length) presets = loaded.map(normalizePreset);
    activeId = localStorage.getItem(K_ACTIVE) || activeId;
    if (!presets.some(function (p) { return p.id === activeId; })) {
      activeId = presets[0] ? presets[0].id : '';
    }
    renderSettings();
  }

  function renderSettings() {
    renderSelect();
    fillForm(activeId);
  }

  window.ImagePresets = {
    list: function () { return presets.map(function (p) { return Object.assign({}, p); }); },
    active: function () { const p = activePreset(); return p ? Object.assign({}, p) : null; },
    activeId: function () { return activeId; },
    resolve: resolve,
    reloadFromStorage: reloadFromStorage,
    renderSettings: renderSettings,
    captureForm: captureForm,
    switchTo: switchTo,
    create: createPreset,
    saveCurrent: saveCurrent,
    remove: removePreset
  };

  window.switchImagePreset = function (id) { switchTo(id); };
  window.createImagePreset = function () { createPreset(); };
  window.saveImagePreset = function () { saveCurrent(); };
  window.deleteImagePreset = function () { removePreset(); };
})();
