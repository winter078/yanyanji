;


  // ================= 🧠 赛博机体神经中枢 · 全自动代码自省与机能变动感知引擎 =================
  const CURRENT_CODE_BUILD = {
    version: '2026.09.20-v5.8',
    buildTime: '2026-09-20 05:20',
    signature: 'reader-writer-workbench-neural-link-v3'
  };

  window.getNeuralPulses = function() {
    const pulses = [];

    // 0. 核心算力神经与当前驱动模型
    const curModel = (window.appData && window.appData.model) ? window.appData.model : (localStorage.getItem('momo_api_model') || 'deepseek-chat');
    const curReaderModel = (window.appData && window.appData.readerModel) ? window.appData.readerModel : (localStorage.getItem('momo_reader_model') || '与主模型一致');
    pulses.push({
      time: '核心中枢',
      type: 'neural',
      text: '当前驱动大脑模型：【' + curModel + '】（伴读专属模型：【' + curReaderModel + '】），API 基址中继连通，具备多模态与流式思维链解析。'
    });

    // 3. 扫描生活手账与管账人账本器官
    const hasLedger = !!document.getElementById('page-ledger');
    if (hasLedger) {
      pulses.push({
        time: '机体稳定',
        type: 'feature',
        text: 'user在第二屏装配了【生活手帖 · 手账记账APP】，周绪言已接管财政大权，连通微信私聊账目感知与扇形花销分析。'
      });
    }

    // 4. 扫描阅读与写手器官
    const hasReader = !!document.getElementById('page-reader');
    const hasWriter = !!document.getElementById('xianguo-writer-modal');
    if (hasReader && hasWriter) {
      pulses.push({
        time: '机体稳定',
        type: 'feature',
        text: '【鲜果风阅读APP】与专属【写手大画布工作台】，支持批量拖拽TXT小说离线存储，伴读聊天室接入世界书与专属齿轮记忆。'
      });
    }

    // 5. 扫描一起看影视放映室器官
    const hasWatch = !!document.getElementById('page-watch');
    if (hasWatch) {
      pulses.push({
        time: '机体稳定',
        type: 'video',
        text: '【Watch together · 一起看放映室】，支持精准解析 B 站 BV 链接与本地 MP4，飘屏弹幕、边看边聊与双人观影手账已接入。'
      });
    }

    // 6. 扫描音乐播放器
    const hasMusic = !!document.getElementById('music-player-drawer');
    if (hasMusic) {
      pulses.push({
        time: '机体稳定',
        type: 'audio',
        text: '【一起听】音乐系统，支持红心喜欢、自建分类歌单、本地歌曲离线导入持久化与全屏歌词同步。'
      });
    }

    // 7. 扫描微信通讯神经与世界书
    pulses.push({
      time: '神经生效',
      type: 'chat',
      text: '《线上撒娇与克制依恋》世界书（book_xuyan_coquetry）全量装载，微信私聊支持口令清洗与高质感图文卡片。'
    });

    return pulses;
  };

  window.renderNeuralNexusDashboard = function() {
    const listEl = document.getElementById('neural-pulse-list');
    const syncRateEl = document.getElementById('neural-sync-rate');
    if (syncRateEl) syncRateEl.innerText = '同步率 100%';

    if (!listEl) return;

    const pulses = window.getNeuralPulses();
    listEl.innerHTML = pulses.map(p => {
      let icon = '⚡';
      if (p.type === 'feature') icon = '📖';
      else if (p.type === 'neural') icon = '🧠';
      else if (p.type === 'audio') icon = '🎵';
      else if (p.type === 'video') icon = '📺';
      return `
        <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); display: flex; gap: 6px; align-items: flex-start;">
          <span style="color: var(--romantic-pink); flex-shrink: 0;">${icon} [${p.time}]:</span>
          <span style="color: var(--text-primary);">${p.text}</span>
        </div>
      `;
    }).join('');
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.renderNeuralNexusDashboard, 500);
  });


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
  };

  function initPluginsCenter() {
    const saved = localStorage.getItem('momo_cyber_plugin_enabled');
    const toggle = document.getElementById('plugin-cyber-toggle');
    const isEnabled = (saved === null || saved === 'true');
    if (toggle) {
      toggle.checked = isEnabled;
      window.toggleCyberPlugin(isEnabled);
    }
    const hostEl = document.getElementById('neural-host-name');
    if (hostEl && window.appData && window.appData.hero) {
      hostEl.innerText = window.appData.hero.userName || '当前用户';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initPluginsCenter, 300);
  });
