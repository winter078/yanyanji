// 核心主入口：协调各模块初始化与启动
    let bootInitStarted = false;
    async function init() {
      if (bootInitStarted) return;
      bootInitStarted = true;
      // localStorage 满时，聊天记录会转存到 IndexedDB；启动必须先等它读完，
      // 否则新标签页会把“溢出里的最新记录”当成空记录。
      try {
        if (window.momoBootReady) await window.momoBootReady;
        else if (window.momoOverflowReady) await window.momoOverflowReady;
      } catch (e) {}
      // 不止聊天记录：主题、预设、壁纸、世界书等整套设置都可能在 IndexedDB 里。
      // 读完主存储后统一重读一遍，再重画界面，避免刷新后全部回到旧值。
      try { if (typeof window.momoReloadAppDataFromStorage === 'function') window.momoReloadAppDataFromStorage(); } catch (e) {}
      try { if (typeof window.momoSyncAdaptedWorldBooks === 'function') window.momoSyncAdaptedWorldBooks(); } catch (e) {}
      try { if (typeof window.WB !== 'undefined' && typeof window.WB.reload === 'function') window.WB.reload(); } catch (e) {}
      try {
        if (window.ApiPresets && typeof window.ApiPresets.reloadFromStorage === 'function') window.ApiPresets.reloadFromStorage();
      } catch (e) {}
      try {
        if (window.PromptPresets && typeof window.PromptPresets.reloadFromStorage === 'function') window.PromptPresets.reloadFromStorage();
      } catch (e) {}
      try {
        if (window.ImagePresets && typeof window.ImagePresets.reloadFromStorage === 'function') window.ImagePresets.reloadFromStorage();
      } catch (e) {}
      try {
        if (typeof window.setThemeMode === 'function') {
          window.setThemeMode(localStorage.getItem('momo_theme_mode') || 'dark');
        }
      } catch (e) {}
      try {
        if (typeof window.momoReloadChatLook === 'function') window.momoReloadChatLook();
        else if (typeof window.applyChatLook === 'function') window.applyChatLook(false);
      } catch (e) {}
      try { if (typeof window.renderRegionSkins === 'function') window.renderRegionSkins(); } catch (e) {}
      try { if (typeof window.renderThemePresetsUI === 'function') window.renderThemePresetsUI(); } catch (e) {}
      try { if (typeof window.applyChatWall === 'function') window.applyChatWall(); } catch (e) {}
      try { if (typeof window.applyChatDim === 'function') window.applyChatDim(); } catch (e) {}
      try { if (typeof window.renderChatPhotos === 'function') window.renderChatPhotos(); } catch (e) {}
      try { if (typeof window.renderChatColors === 'function') window.renderChatColors(); } catch (e) {}
      try { if (typeof window.renderChatBubbleCss === 'function') window.renderChatBubbleCss(); } catch (e) {}
      try { if (typeof window.syncSkinPackUI === 'function') window.syncSkinPackUI(); } catch (e) {}
      try { if (typeof window.momoReloadChatFrames === 'function') window.momoReloadChatFrames(); } catch (e) {}
      try { if (typeof window.applyChatAppearance === 'function') window.applyChatAppearance(); } catch (e) {}
      // 角色表/群聊也可能被转进 IndexedDB；读完后再校正一次，避免刷新时只用了旧表。
      try {
        if (typeof window.momoReloadCharactersFromStorage === 'function') {
          window.momoReloadCharactersFromStorage();
        }
      } catch (e) {}
      // appData 在 store.js 里是同步初始化的，溢出键可能当时还没读回来；
      // 这里补读一次记忆宫殿，避免刷新后把已有记忆卡当成空列表。
      try {
        const savedPalace = localStorage.getItem('momo_palace_memories');
        if (savedPalace) appData.palaceMemories = JSON.parse(savedPalace);
      } catch (e) {}
      // CSS 装修功能已移除；清掉旧版本可能遗留的自定义样式，避免继续影响界面。
      try { localStorage.removeItem('momo_custom_css'); } catch (e) {}
      try {
        var activeCharId = localStorage.getItem('momo_active_char') || '';
        if (activeCharId && typeof window.getChatHistoryForChar === 'function') {
          appData.chatHistory = window.getChatHistoryForChar(activeCharId);
          console.log('[聊天记录] 按角色加载完成，角色:', activeCharId, '条数:', appData.chatHistory.length);
        } else {
          var rawChat = localStorage.getItem('momo_chat_history');
          if (rawChat && rawChat !== '[]') {
            appData.chatHistory = JSON.parse(rawChat);
            console.log('[聊天记录] 兼容模式加载，条数:', appData.chatHistory.length);
          }
        }
      } catch(e) {}
      renderHeroTexts();
      applyThemeAndImages();
      loadChatHistory();
      renderRpStream();
      updateBotRemarkUI();
      renderChatSettingsUI();
      if (typeof renderNeuralNexusPanel === 'function') renderNeuralNexusPanel();

      document.getElementById('char-prompt-field').value = appData.charPrompt;
      document.getElementById('user-info-field').value = appData.userInfo;

      document.getElementById('api-base-input').value = appData.apiBase;
      document.getElementById('api-key-input').value = appData.apiKey;
      document.getElementById('api-model-input').value = appData.model;
      const visionInput = document.getElementById('api-vision-model-input');
      if (visionInput) visionInput.value = appData.visionModel || '';
      const readerInput = document.getElementById('api-reader-model-input');
      if (readerInput) readerInput.value = appData.readerModel || '';
      if (window.ApiPresets && window.ApiPresets.renderSettings) {
        window.ApiPresets.renderSettings();
      }
      if (window.ImagePresets && window.ImagePresets.renderSettings) {
        window.ImagePresets.renderSettings();
      }
      if (window.PromptPresets && window.PromptPresets.renderSettings) {
        window.PromptPresets.renderSettings();
      }
      if (window.CharVoice && window.CharVoice.renderSettings) {
        window.CharVoice.renderSettings();
      }
    }

    try { bindLongPressHandlers(); } catch (e) { console.error('[mom] bindLongPressHandlers failed:', e); }
    try { openPage("page-home"); } catch (e) { console.error('[mom] openPage home failed:', e); }
    try { init().catch(e => console.error('[mom] init failed:', e)); } catch (e) { console.error('[mom] init failed:', e); }
  



window.addEventListener('DOMContentLoaded', () => {
  if (typeof init === 'function') {
    init();
  }
});
