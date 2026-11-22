// 核心主入口：协调各模块初始化与启动
    let bootInitStarted = false;
    async function init() {
      if (bootInitStarted) return;
      bootInitStarted = true;
      // localStorage 满时，聊天记录会转存到 IndexedDB；启动必须先等它读完，
      // 否则新标签页会把“溢出里的最新记录”当成空记录。
      try { if (window.momoOverflowReady) await window.momoOverflowReady; } catch (e) {}
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
    }

    try { bindLongPressHandlers(); } catch (e) { console.error('[mom] bindLongPressHandlers failed:', e); }
    try { openPage("page-home"); } catch (e) { console.error('[mom] openPage home failed:', e); }
    try { init().catch(e => console.error('[mom] init failed:', e)); } catch (e) { console.error('[mom] init failed:', e); }
  



window.addEventListener('DOMContentLoaded', () => {
  if (typeof init === 'function') {
    init();
  }
});
