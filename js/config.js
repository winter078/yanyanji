;


  // ================= 🛰️ App 更新感知 =================
  // 角色能知道什么，统一由 js/app-changelog.js 管；这里不再维护写死的同步率和功能脉冲。


// 周绪言 & user 专属全局人设与初始默认数据

    // 全局防死锁与防御性变量初始化 (提前至第一行，彻底杜绝 TDZ ReferenceError)
    var currentBubbleIdx = -1;
    var currentBubbleEditType = 'text';
    var currentQuoteData = null;
    var selectedMsgIndices = new Set();
    var bubbleLongPressTimer = null;
    var bubbleTouchHasMoved = false;
    window.currentQuoteData = null;

    const DEFAULT_HERO_DATA = {
      userName: "user",
      userHandle: "@测试人员",
      userTag: "用户",
      locationText: "生活在真实世界中",
      name: "user",
      handle: "@测试人员",
      tag: "用户",
      location: "生活在真实世界中"
    };

    function normalizeHeroData(raw) {
      const d = raw || {};
      const rawName = d.userName || d.name || '';
      const name = rawName || 'user';
      const handle = d.userHandle || d.handle || "@测试人员";
      const tag = d.userTag || d.tag || "用户";
      const loc = d.locationText || d.location || "生活在真实世界中";
      return {
        userName: name,
        userHandle: handle,
        userTag: tag,
        locationText: loc,
        name: name,
        handle: handle,
        tag: tag,
        location: loc
      };
    }

    // 桌面小组件是独立的一张名片：默认跟着「微信-我」，
    // 一旦在小组件上单独改过，就只改小组件，不再影响微信资料。
    function normalizeWidgetData(raw, fallback) {
      const d = raw || {};
      const f = fallback || {};
      const name = d.userName || d.name || f.userName || f.name || 'user';
      const handle = d.userHandle || d.handle || f.userHandle || f.handle || '@测试人员';
      const tag = d.userTag || d.tag || f.userTag || f.tag || '用户';
      const loc = d.locationText || d.location || f.locationText || f.location || '生活在真实世界中';
      return {
        userName: name,
        userHandle: handle,
        userTag: tag,
        locationText: loc,
        name: name,
        handle: handle,
        tag: tag,
        location: loc
      };
    }

    function getWidgetProfile() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem('momo_widget_profile') || 'null'); } catch (e) { raw = null; }
      const fallback = (window.appData && window.appData.hero) ? window.appData.hero : DEFAULT_HERO_DATA;
      const profile = normalizeWidgetData(raw, fallback);
      if (window.appData) window.appData.widgetProfile = profile;
      return profile;
    }

    window.normalizeWidgetData = normalizeWidgetData;
    window.getWidgetProfile = getWidgetProfile;

    const DEFAULT_CHAR_PROMPT = `你是一个AI伴侣。请严格遵守用户接下来为你设定的所有身份和性格，不要出戏。`;

    const DEFAULT_USER_INFO = '';

    const DEFAULT_RP_CONFIG = {
      scenario: "温暖舒适的室内，阳光洒在桌前，微风轻拂。两人坐在一起，享受着难得的安适片刻...",
      userRole: "用户",
      charRole: "AI",
      style: "采用沉浸式对话描写。对神态、动作进行细腻叙述，对话用“”，动作与内心描写用星号包裹。"
    };

    const DEFAULT_STICKERS = [
      { name: "(海豹) 呆呆...", tag: "dog", url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=160&auto=format&fit=crop&q=60" },
      { name: "泪眼婆娑", tag: "dog", url: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=160&auto=format&fit=crop&q=60" },
      { name: "看着你", tag: "cat", url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=160&auto=format&fit=crop&q=60" },
      { name: "我啥都不知道", tag: "cat", url: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=160&auto=format&fit=crop&q=60" },
      { name: "小女子乃合欢...", tag: "cat", url: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=160&auto=format&fit=crop&q=60" },
      { name: "休要坏我道心", tag: "cat", url: "https://images.unsplash.com/photo-1561948955-570b270e7c36?w=160&auto=format&fit=crop&q=60" },
      { name: "你成功扰乱我...", tag: "cat", url: "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=160&auto=format&fit=crop&q=60" },
      { name: "我想你", tag: "mine", url: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=160&auto=format&fit=crop&q=60" },
      { name: "严肃", tag: "mine", url: "https://images.unsplash.com/photo-1518796745738-41048802f99a?w=160&auto=format&fit=crop&q=60" },
      { name: "有一点想你", tag: "mine", url: "https://images.unsplash.com/photo-1591382386627-349b692688ff?w=160&auto=format&fit=crop&q=60" }
    ];



  window.toggleCyberPlugin = function(enabled) {
    const content = document.getElementById('plugin-cyber-content');
    const text = document.getElementById('plugin-cyber-status-text');
    if (content) content.style.display = enabled ? 'block' : 'none';
    if (text) {
      text.innerText = enabled ? '已启用' : '已停用';
      text.style.color = enabled ? 'var(--success-primary)' : 'var(--text-muted)';
    }
    try {
      localStorage.setItem('momo_cyber_plugin_enabled', enabled ? 'true' : 'false');
    } catch(e){}
    try { if (window.refreshAppUpdateUI) window.refreshAppUpdateUI(); } catch (e) {}
  };

  function setToolboxStatus(el, state, text) {
    if (!el) return;
    if (typeof state === 'boolean') state = state ? 'ready' : 'off';
    if (!text) {
      text = state === 'ready' ? '可用' : (state === 'partial' ? '部分' : '未配置');
    }
    el.innerText = text;
    el.classList.toggle('ready', state === 'ready');
    el.classList.toggle('warn', state === 'partial');
    el.classList.toggle('off', state === 'off' || !state);
  }

  function renderToolboxItem(cap) {
    if (!cap || !cap.key) return;
    var status = document.getElementById('toolbox-' + cap.key + '-status');
    var desc = document.getElementById('toolbox-' + cap.key + '-desc');
    if (status) {
      setToolboxStatus(status, cap.state, cap.badge);
      status.title = cap.reason || cap.detail || '';
    }
    if (desc && cap.detail) desc.textContent = cap.detail;
  }

  window.renderToolboxStatus = function() {
    var snap = null;
    try {
      snap = (window.MomSelf && typeof window.MomSelf.snapshot === 'function') ? window.MomSelf.snapshot() : null;
    } catch (e) { snap = null; }

    var context = document.getElementById('toolbox-context');
    if (snap) {
      if (context) context.textContent = snap.context || '';
      (snap.capabilities || []).forEach(renderToolboxItem);
      return;
    }

    // 运行事实层没加载时，保留最粗的兜底，不把旧的四格状态直接清空。
    if (context) context.textContent = '运行状态还没加载完，先看旧的基础检查。';
    var app = window.appData || {};
    var docReady = !!(String(app.apiKey || '').trim() && String(app.apiBase || '').trim());
    setToolboxStatus(document.getElementById('toolbox-docs-status'), docReady);
    setToolboxStatus(document.getElementById('toolbox-sop-status'), docReady);
    setToolboxStatus(document.getElementById('toolbox-search-status'), false);
    setToolboxStatus(document.getElementById('toolbox-image-status'), false);
    setToolboxStatus(document.getElementById('toolbox-voice-status'), false);
    setToolboxStatus(document.getElementById('toolbox-music-status'), false);
    setToolboxStatus(document.getElementById('toolbox-memory-status'), false);
    setToolboxStatus(document.getElementById('toolbox-local-status'), false);
  };

  function initPluginsCenter() {
    const saved = localStorage.getItem('momo_cyber_plugin_enabled');
    const toggle = document.getElementById('plugin-cyber-toggle');
    const isEnabled = (saved === null || saved === 'true');
    if (toggle) {
      toggle.checked = isEnabled;
      window.toggleCyberPlugin(isEnabled);
    }
    try { window.renderToolboxStatus(); } catch (e) {}
    try { if (window.refreshWorkPackUI) window.refreshWorkPackUI(); } catch (e) {}
    try { if (window.refreshAppUpdateUI) window.refreshAppUpdateUI(); } catch (e) {}

    // 从其他页面回到插件中心时，重新检查工具配置状态
    if (typeof window.openPage === 'function' && !window.openPage.__toolboxStatusWrapped) {
      const prevOpenPage = window.openPage;
      const wrappedOpenPage = function(pageId) {
        const result = prevOpenPage.apply(this, arguments);
        if (pageId === 'page-plugins') {
          setTimeout(function() {
            try { window.renderToolboxStatus(); } catch (e) {}
            try { if (window.refreshWorkPackUI) window.refreshWorkPackUI(); } catch (e) {}
            try { if (window.refreshAppUpdateUI) window.refreshAppUpdateUI(); } catch (e) {}
          }, 80);
        }
        return result;
      };
      wrappedOpenPage.__toolboxStatusWrapped = true;
      window.openPage = wrappedOpenPage;
    }
  }

  function bootPluginsCenter() {
    setTimeout(initPluginsCenter, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPluginsCenter, { once: true });
  } else {
    bootPluginsCenter();
  }
