// ==========================================================================
// 📱 桌面纯动态解耦引擎 v5.2
// (大组件独立解耦 / 固定槽位保留 / 长按700ms晃动删除 / 悬停400ms金光合并文件夹 / 文件夹Modal展开)
// ==========================================================================

(function() {
  const STORAGE_KEY = 'momo_desktop_layout_v5';
  const ART_STORAGE_KEY = 'momo_widget_art_storage_v5';
  const DOCK_STORAGE_KEY = 'momo_dock_slots_v1';
  const DOCK_SLOT_COUNT = 4;
  // 桌面网格保留四排容量（4 列 × 4 排），浏览态/编辑态共用同一套槽位高度
  const DESKTOP_GRID_COLUMNS = 4;
  const DESKTOP_GRID_ROWS = 4;
  const DESKTOP_GRID_MIN_SLOTS = DESKTOP_GRID_COLUMNS * DESKTOP_GRID_ROWS;
  const EDIT_LONG_PRESS_MS = 700;
  const EDIT_HOLD_MS = 160;
  // 组件拖到屏幕左右边缘并停留时，自动翻到相邻桌面页
  const WIDGET_PAGE_TURN_MS = 450;
  const WIDGET_PAGE_TURN_EDGE = 48;

  // ================= 全量应用池资产注册表 (APP_STORE_REGISTRY) =================
  const APP_STORE_REGISTRY = {
    'app-app-store': {
      id: 'app-app-store',
      type: 'app',
      page: 'page-app-store',
      icon: '🛍️',
      name: '应用商店',
      bg: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
      category: 'tools',
      categoryName: '系统工具',
      desc: '探索与下载全新机能组件，随时扩展小手机'
    },
    'app-plugins': {
      id: 'app-plugins',
      type: 'app',
      page: 'page-plugins',
      icon: '🧩',
      name: '插件中心',
      bg: 'linear-gradient(135deg, #a855f7, #6366f1)',
      category: 'tools',
      categoryName: '扩展插件',
      desc: '管理赛博伴侣神经中枢等高级深度扩展套件'
    },
    'app-world': {
      id: 'app-world',
      type: 'app',
      page: 'page-world',
      icon: '✨',
      name: '世界书',
      bg: 'rgba(220,180,255,0.2)',
      category: 'social',
      categoryName: '角色伴侣',
      desc: '设定两人的羁绊法则、独家记忆与背景规则'
    },
    'app-theme': {
      id: 'app-theme',
      type: 'app',
      page: 'page-theme',
      icon: '🖤',
      name: '外观',
      bg: 'rgba(242,139,130,0.2)',
      category: 'tools',
      categoryName: '系统工具',
      desc: '自定义小手机个性主题、壁纸色彩与质感'
    },
    'app-api': {
      id: 'app-api',
      type: 'app',
      page: 'page-api',
      icon: '⚙️',
      name: '设置',
      bg: 'rgba(255,230,180,0.2)',
      category: 'tools',
      categoryName: '系统设置',
      desc: '配置大模型 API 密钥、端点代理与视觉模型'
    },
    'app-prompt-presets': {
      id: 'app-prompt-presets',
      type: 'app',
      page: 'page-prompt-presets',
      icon: '🎛️',
      name: '预设',
      bg: 'linear-gradient(135deg, #6d5dfc, #0e7490)',
      category: 'social',
      categoryName: '角色伴侣',
      desc: '像酒馆一样管理聊天提示词预设、条目开关与本地存档'
    },
    'app-reader': {
      id: 'app-reader',
      type: 'app',
      page: 'page-reader',
      icon: '📖',
      name: '伴读阅读',
      bg: 'linear-gradient(135deg, #50976a, #3b7e53)',
      category: 'life',
      categoryName: '影音生活',
      desc: '导入电子书或长篇，享受角色专属伴读评论'
    },
    'app-watch': {
      id: 'app-watch',
      type: 'app',
      page: 'page-watch',
      icon: '📺',
      name: '一起看',
      bg: 'linear-gradient(135deg, #c7958b, #9e6d63)',
      category: 'life',
      categoryName: '影音生活',
      desc: '双人同步观影放映室，共享温馨时光'
    },
    'app-xhs': {
      id: 'app-xhs',
      type: 'app',
      page: 'page-xhs',
      icon: '📕',
      name: '小紫书',
      bg: 'linear-gradient(135deg, #d9daf0, #b2b5da)',
      category: 'social',
      categoryName: '社交网络',
      desc: '双列瀑布流笔记、发布与本地相册，单机也能慢慢逛'
    },
    'app-say': {
      id: 'app-say',
      type: 'app',
      page: 'page-say',
      icon: '📖',
      name: '我说',
      bg: 'rgba(214,196,160,0.18)',
      category: 'life',
      categoryName: '记录',
      desc: '一个月一本本子，一页一张纸；写不动的时候，可以按住说'
    },
    'app-palace': {
      id: 'app-palace',
      type: 'app',
      page: 'page-palace',
      icon: '🏛️',
      name: '记忆宫殿',
      bg: 'rgba(253,242,208,0.2)',
      category: 'social',
      categoryName: '记忆沉淀',
      desc: '收纳长篇信件、亲笔便签与深层情感沉淀'
    },
    'app-rp': {
      id: 'app-rp',
      type: 'app',
      page: 'page-rp',
      icon: '🎭',
      name: '此时此刻',
      bg: 'rgba(255,220,230,0.2)',
      category: 'social',
      categoryName: '角色伴侣',
      desc: '沉浸式情境剧场，触发两人的专属临场心跳'
    },
    'app-music': {
      id: 'app-music',
      type: 'app',
      page: 'page-music',
      icon: '🎧',
      name: '一起听',
      bg: 'linear-gradient(135deg, #10b981, #06b6d4)',
      category: 'life',
      categoryName: '影音生活',
      desc: '私享音乐随身听，伴随心声实时播放'
    },
    'app-daysmatter': {
      id: 'app-daysmatter',
      type: 'app',
      page: 'page-daysmatter',
      icon: '📅',
      name: '倒数日',
      bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      category: 'life',
      categoryName: '生活手账',
      desc: '记录初次相遇、重要纪念日与未来的期待节点'
    },
    'app-ledger': {
      id: 'app-ledger',
      type: 'app',
      page: 'page-ledger',
      icon: '📒',
      name: '手账记账',
      bg: 'linear-gradient(135deg, #e0a96d, #c07a68)',
      category: 'life',
      categoryName: '生活手账',
      desc: '温馨的生活日常开销收支流水手账本'
    },
    'app-health': {
      id: 'app-health',
      type: 'app',
      page: 'page-health',
      icon: '💚',
      name: '健康',
      bg: 'linear-gradient(135deg, #4ECDC4, #2C8F86)',
      category: 'life',
      categoryName: '生活手账',
      desc: '经期预测、睡眠与梦、体重步数，一天一眼看完'
    },
    'app-forum': {
      id: 'app-forum',
      type: 'app',
      page: 'page-forum',
      icon: '🪑',
      name: '长椅',
      bg: 'linear-gradient(135deg, #E8B04B, #B9832B)',
      category: 'social',
      categoryName: '公共广场',
      desc: '谁都能坐下说两句：求助、问答、分享，还有一群不认识的邻居'
    },
    'app-yanyan-cat': {
      id: 'app-yanyan-cat',
      type: 'app',
      page: 'page-yanyan-cat',
      icon: '🐱',
      name: '言言喵',
      bg: 'linear-gradient(135deg, #a855f7, #ec4899)',
      category: 'social',
      categoryName: '治愈宠物',
      desc: '桌面的触觉心跳猫咪，一键掐脸、揉肚皮'
    },
    'app-avatar-vault': {
      id: 'app-avatar-vault',
      type: 'app',
      page: 'page-avatar-vault',
      icon: '🖼️',
      name: '头像库',
      bg: 'linear-gradient(135deg, #cbd5e1, #94a3b8)',
      category: 'social',
      categoryName: '视觉相册',
      desc: '给自己和角色换头像，角色还能按情绪主动换'
    },
    'app-wordcards': {
      id: 'app-wordcards',
      type: 'app',
      page: 'page-wordcards',
      icon: '🃏',
      name: '字卡',
      bg: 'linear-gradient(135deg, #f59e0b, #b45309)',
      category: 'social',
      categoryName: '角色伴侣',
      desc: '不接 API 的独立字卡 App，用自己的词库和角色对话，记忆只存里面'
    },
    'app-gallery-photos': {
      id: 'app-gallery-photos',
      type: 'app',
      page: 'page-gallery-photos',
      icon: '📷',
      name: '相册',
      bg: 'linear-gradient(135deg, #38bdf8, #0284c7)',
      category: 'life',
      categoryName: '生活照片',
      desc: '浏览相册原图，并支持在微信中提供给 AI 识图'
    }
  };

  const APP_POOL = APP_STORE_REGISTRY;

  // ===== 桌面图标：一套 24 网格线性图标（按 App id 取，老存档也能吃上）=====
  const DESK_ICONS = {
    'app-app-store': '<path d="M5.6 8.6h12.8l-1.1 10.8H6.7z"/><path d="M9.1 8.6V7a2.9 2.9 0 0 1 5.8 0v1.6"/>',
    'app-plugins': '<rect x="4.2" y="4.2" width="6.2" height="6.2" rx="2"/><rect x="13.6" y="4.2" width="6.2" height="6.2" rx="2"/><rect x="4.2" y="13.6" width="6.2" height="6.2" rx="2"/><rect x="13.6" y="13.6" width="6.2" height="6.2" rx="2"/>',
    'app-world': '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4"/><path d="M12 3.8c2.7 2.5 4.1 5 4.1 8.2s-1.4 5.7-4.1 8.2c-2.7-2.5-4.1-5-4.1-8.2s1.4-5.7 4.1-8.2z"/>',
    'app-theme': '<path d="M4 8.6h16M4 15.4h16"/><circle cx="9" cy="8.6" r="2"/><circle cx="15.4" cy="15.4" r="2"/>',
    'app-api': '<path d="M12 3.9l6.9 4v7.8l-6.9 4-6.9-4V7.9z"/><circle cx="12" cy="11.7" r="3.1"/>',
    'app-prompt-presets': '<path d="M4 6.2h16M4 11.8h16M4 17.4h16"/><circle cx="8.4" cy="6.2" r="1.9"/><circle cx="16" cy="11.8" r="1.9"/><circle cx="10.6" cy="17.4" r="1.9"/>',
    'app-reader': '<path d="M12 6.6c-2.5-1.7-5.4-1.9-7.3-1v13.2c1.9-.9 4.8-.7 7.3 1 2.5-1.7 5.4-1.9 7.3-1V5.6c-1.9-.9-5.2-.7-7.3 1z"/><path d="M12 6.8v13"/>',
    'app-watch': '<rect x="3.4" y="5.2" width="17.2" height="13.6" rx="2.6"/><path d="M8 5.2v13.6M16 5.2v13.6M3.4 9.4h4.6M3.4 14.6h4.6M16 9.4h4.6M16 14.6h4.6"/>',
    'app-xhs': '<rect x="4.2" y="4.8" width="15.6" height="14.4" rx="2.5"/><path d="M7 8.2h10M7 11.6h6.5M7 15h8.5"/>',
    'app-say': '<path d="M6.2 4.2h10.4a1.8 1.8 0 0 1 1.8 1.8v12a1.8 1.8 0 0 1-1.8 1.8H6.2z"/><path d="M6.2 4.2v15.6"/><path d="M9.4 9h6.2M9.4 12.4h6.2M9.4 15.8h3.4"/>',
    'app-palace': '<rect x="3.4" y="6" width="17.2" height="12.6" rx="2.6"/><path d="M4 7.2l8 6 8-6"/>',
    'app-rp': '<path d="M12 4l1.8 5.4L19 11l-5.2 1.6L12 18l-1.8-5.4L5 11l5.2-1.6z"/><path d="M18.4 5l.6 1.6 1.6.6-1.6.6-.6 1.6-1.6-.6z"/>',
    'app-music': '<path d="M9.2 17.4V6.6l8.8-2v10.8"/><circle cx="6.9" cy="17.4" r="2.4"/><circle cx="15.7" cy="15.4" r="2.4"/>',
    'app-daysmatter': '<rect x="4.2" y="5.4" width="15.6" height="14.4" rx="2.5"/><path d="M4.2 10h15.6M8.6 3.6v3.4M15.4 3.6v3.4"/><circle cx="8.6" cy="14.2" r="1.4"/>',
    'app-ledger': '<rect x="4.6" y="4" width="14.8" height="16" rx="2.6"/><path d="M8.2 8.4h7.6M8.2 12h7.6M8.2 15.6h4.8"/>',
    'app-health': '<path d="M19.2 13.6c1.4-1.4 2.6-3 2.6-5.1A5 5 0 0 0 16.8 3.5c-1.7 0-2.9.5-4.3 1.9-1.4-1.4-2.6-1.9-4.3-1.9A5 5 0 0 0 2.9 8.5c0 2.1 1.2 3.7 2.6 5.1l6.6 6.4z"/>',
    'app-forum': '<path d="M5.2 6.4h13.6M5.2 8.8h13.6M3.8 12.6h16.4M6.4 8.8v3.8M17.6 8.8v3.8M6.4 12.6v4.6M17.6 12.6v4.6"/>',
    'app-yanyan-cat': '<circle cx="12" cy="13" r="6.2"/><path d="M6.8 9.4l-1-4.4 4.2 2.2M17.2 9.4l1-4.4-4.2 2.2"/><path d="M9.6 12.4h.01M14.4 12.4h.01M10.4 15.2c1 .9 2.2 .9 3.2 0"/>',
    'app-avatar-vault': '<circle cx="9" cy="8.6" r="3"/><path d="M3.4 19c.9-3 2.9-4.6 5.6-4.6s4.7 1.6 5.6 4.6"/><circle cx="16.6" cy="9.6" r="2.4"/><path d="M15.4 14.6c2.4 0 4.1 1.5 4.9 4"/>',
    'app-wordcards': '<rect x="4.2" y="5.2" width="7" height="13.6" rx="2"/><rect x="12.8" y="5.2" width="7" height="13.6" rx="2"/><path d="M7.7 9.2h.01M7.7 12h.01M7.7 14.8h.01M16.3 9.2h.01M16.3 12h.01M16.3 14.8h.01"/>',
    'app-gallery-photos': '<rect x="3" y="6.5" width="18" height="13" rx="3"/><circle cx="12" cy="13" r="3.2"/><path d="M8 6.5l1-2h6l1 2"/>',
    'dock-wechat': '<path d="M4.4 7.4a3.4 3.4 0 0 1 3.4-3.4h8.4a3.4 3.4 0 0 1 3.4 3.4v3.4a3.4 3.4 0 0 1-3.4 3.4H11l-4.2 3.1v-3.1A3.4 3.4 0 0 1 4.4 10.8z"/><circle cx="9" cy="9" r=".9" fill="currentColor" stroke="none"/><circle cx="12.6" cy="9" r=".9" fill="currentColor" stroke="none"/><circle cx="16.2" cy="9" r=".9" fill="currentColor" stroke="none"/>',
  };

  function deskIconSvg(id) {
    const paths = DESK_ICONS[id];
    if (!paths) return '';
    return '<svg class="ios-line-icon" viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>';
  }

  // 精简版小组件：资料卡、心声私签、相片、音乐与倒数日；其余旧组件在读取旧布局时一并清掉
  const KEPT_WIDGET_TYPES = ['widget-hero', 'widget-note', 'widget-photo', 'widget-music', 'widget-countdown'];

  // 新用户首次加载时的纯净系统默认应用
  const DEFAULT_PAGES_LAYOUT = [
    {
      id: 'page-1',
      name: '主屏',
      widgets: [
        { id: 'widget-hero', type: 'widget-hero' }
      ],
      slots: [
        APP_STORE_REGISTRY['app-app-store'],
        APP_STORE_REGISTRY['app-world'],
        APP_STORE_REGISTRY['app-api'],
        APP_STORE_REGISTRY['app-prompt-presets'],
        APP_STORE_REGISTRY['app-theme'],
        APP_STORE_REGISTRY['app-plugins'],
        APP_STORE_REGISTRY['app-wordcards'],
        APP_STORE_REGISTRY['app-xhs'],
        APP_STORE_REGISTRY['app-say']
      ]
    },
    {
      id: 'page-2',
      name: '组件与应用',
      widgets: [
        { id: 'widget-note-1', type: 'widget-note', title: '心声私签' }
      ],
      slots: []
    }
  ];

  let desktopData = { version: '5.2', pages: DEFAULT_PAGES_LAYOUT };
  let artStorage = { 'art-1': 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=60' };
  let currentTargetPageIndex = 0;
  let activeFolderInfo = null;
  let newFolderSlot = null;

  // iOS 允许把图标单独留在网格空位上，不能把中间的空槽压掉，
  // 否则用户刚拎出来的 App 会在下一次渲染时自动跳回前排。
  // 这里只裁掉页面末尾的空槽，避免尾部空槽把页面撑出多余行。
  function trimTrailingDesktopSlots() {
    let changed = false;
    if (!desktopData || !Array.isArray(desktopData.pages)) return changed;
    desktopData.pages.forEach(function(page) {
      if (!page || !Array.isArray(page.slots)) return;
      let length = page.slots.length;
      while (length > 0 && !page.slots[length - 1]) length--;
      if (length !== page.slots.length) {
        page.slots.length = length;
        changed = true;
      }
    });
    return changed;
  }

  function loadDesktopStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          desktopData = parsed;
        } else {
          desktopData = { version: '5.2', pages: JSON.parse(JSON.stringify(DEFAULT_PAGES_LAYOUT)) };
        }
      } else {
        desktopData = { version: '5.2', pages: JSON.parse(JSON.stringify(DEFAULT_PAGES_LAYOUT)) };
      }
      // 先恢复小画/相片图库，再做任何会回写布局的清理，避免清理写回时用初始图库覆盖用户图片
      // 图片数据已经迁到 IndexedDB；localStorage 里只留旧版数据用于一次性迁移
      if (!artStorageLoaded) {
        const savedArt = localStorage.getItem(ART_STORAGE_KEY);
        if (savedArt) {
          try { artStorage = JSON.parse(savedArt) || artStorage; } catch(e) {}
        }
        artStorageLoaded = true;
      }
      // 小组件精简：旧布局里的言言伴生卡、拍立得、横幅画廊、手账等旧组件移除；保留资料卡、心声私签、相片、音乐与倒数日
      let widgetCleanupChanged = false;
      desktopData.pages.forEach(function(page) {
        if (Array.isArray(page.widgets)) {
          const beforeCount = page.widgets.length;
          page.widgets = page.widgets.filter(function(widget) {
            return widget && KEPT_WIDGET_TYPES.indexOf(widget.type) >= 0;
          });
          page.widgets.forEach(function(widget) {
            if (widget.type === 'widget-note' && (!widget.title || widget.title === '角色私签')) {
              widget.title = '心声私签';
              widgetCleanupChanged = true;
            }
          });
          if (page.widgets.length !== beforeCount) widgetCleanupChanged = true;
        }
        // 兼容早期把小组件塞进 slots 的旧数据
        if (Array.isArray(page.slots)) {
          page.slots = page.slots.map(function(slot) {
            if (slot && typeof slot.type === 'string' && slot.type.indexOf('widget-') === 0 &&
                KEPT_WIDGET_TYPES.indexOf(slot.type) < 0) {
              widgetCleanupChanged = true;
              return null;
            }
            return slot;
          });
        }
      });
      if (widgetCleanupChanged) saveDesktopStorage();

      // 角色人设 App 已并入通讯录；个人名片已并入微信「我」；时间线、随笔日记 App 已下架：把旧桌面里残留的图标清掉
      const REMOVED_DESK_APP_IDS = ['app-gallery', 'app-diary', 'app-weibo', 'app-me', 'app-css-editor', 'app-pomodoro'];
      let removedAppsChanged = false;
      const stripRemovedApps = function(slot) {
        if (!slot) return slot;
        if (slot.type === 'folder' && Array.isArray(slot.items)) {
          const beforeCount = slot.items.length;
          slot.items = slot.items.filter(function(it) { return it && REMOVED_DESK_APP_IDS.indexOf(it.id) < 0; });
          if (slot.items.length !== beforeCount) removedAppsChanged = true;
          if (slot.items.length === 0) return null;
          if (slot.items.length === 1) return slot.items[0];
          return slot;
        }
        if (REMOVED_DESK_APP_IDS.indexOf(slot.id) >= 0) {
          removedAppsChanged = true;
          return null;
        }
        return slot;
      };
      desktopData.pages.forEach(p => {
        if (Array.isArray(p.slots)) {
          p.slots = p.slots.map(s => {
            if (s && s.id === 'app-char-setting') {
              removedAppsChanged = true;
              return null;
            }
            return stripRemovedApps(s);
          });
        }
      });
      if (removedAppsChanged) saveDesktopStorage();

      let xhsMetaChanged = false;
      desktopData.pages.forEach(p => {
        if (!Array.isArray(p.slots)) return;
        p.slots.forEach(function syncXhsName(slot) {
          if (!slot) return;
          if (slot.type === 'folder' && Array.isArray(slot.items)) {
            slot.items.forEach(syncXhsName);
            return;
          }
          if (slot.id === 'app-xhs' && slot.name !== APP_STORE_REGISTRY['app-xhs'].name) {
            slot.name = APP_STORE_REGISTRY['app-xhs'].name;
            xhsMetaChanged = true;
          }
        });
      });
      if (xhsMetaChanged) saveDesktopStorage();
      // 字卡独立 App 首次上线：旧桌面没有这个图标时补一个到主屏，只补一次
      if (!localStorage.getItem('momo_wordcards_desktop_seeded')) {
        const hasWordcards = function(slot) {
          if (!slot) return false;
          if (slot.type === 'folder' && Array.isArray(slot.items)) {
            return slot.items.some(hasWordcards);
          }
          return slot.id === 'app-wordcards';
        };
        const exists = desktopData.pages.some(p => Array.isArray(p.slots) && p.slots.some(hasWordcards));
        if (!exists && desktopData.pages[0] && Array.isArray(desktopData.pages[0].slots)) {
          desktopData.pages[0].slots.push(APP_STORE_REGISTRY['app-wordcards']);
          saveDesktopStorage();
        }
        try { localStorage.setItem('momo_wordcards_desktop_seeded', '1'); } catch (e) {}
      }
      // 小紫书首次上线：旧桌面没有这个图标时补一个到主屏，只补一次
      if (!localStorage.getItem('momo_xhs_desktop_seeded')) {
        const hasXhs = function(slot) {
          if (!slot) return false;
          if (slot.type === 'folder' && Array.isArray(slot.items)) {
            return slot.items.some(hasXhs);
          }
          return slot.id === 'app-xhs';
        };
        const exists = desktopData.pages.some(p => Array.isArray(p.slots) && p.slots.some(hasXhs));
        if (!exists && desktopData.pages[0] && Array.isArray(desktopData.pages[0].slots)) {
          desktopData.pages[0].slots.push(APP_STORE_REGISTRY['app-xhs']);
          saveDesktopStorage();
        }
        try { localStorage.setItem('momo_xhs_desktop_seeded', '1'); } catch (e) {}
      }
      // 我说（日记）首次上线：旧桌面没有这个图标时补一个到主屏，只补一次
      if (!localStorage.getItem('momo_say_desktop_seeded')) {
        const hasSay = function(slot) {
          if (!slot) return false;
          if (slot.type === 'folder' && Array.isArray(slot.items)) {
            return slot.items.some(hasSay);
          }
          return slot.id === 'app-say';
        };
        const exists = desktopData.pages.some(p => Array.isArray(p.slots) && p.slots.some(hasSay));
        if (!exists && desktopData.pages[0] && Array.isArray(desktopData.pages[0].slots)) {
          const slots = desktopData.pages[0].slots;
          const emptyIndex = slots.findIndex(function(slot) { return !slot; });
          if (emptyIndex >= 0) {
            slots[emptyIndex] = APP_STORE_REGISTRY['app-say'];
          } else {
            slots.push(APP_STORE_REGISTRY['app-say']);
          }
          saveDesktopStorage();
        }
        try { localStorage.setItem('momo_say_desktop_seeded', '1'); } catch (e) {}
      }
      // 聊天预设独立 App 首次上线：旧桌面没有这个图标时补一个到主屏，只补一次
      if (!localStorage.getItem('momo_prompt_presets_desktop_seeded')) {
        const hasPromptPresets = function(slot) {
          if (!slot) return false;
          if (slot.type === 'folder' && Array.isArray(slot.items)) {
            return slot.items.some(hasPromptPresets);
          }
          return slot.id === 'app-prompt-presets';
        };
        const exists = desktopData.pages.some(p => Array.isArray(p.slots) && p.slots.some(hasPromptPresets));
        if (!exists && desktopData.pages[0] && Array.isArray(desktopData.pages[0].slots)) {
          const slots = desktopData.pages[0].slots;
          const emptyIndex = slots.findIndex(function(slot) { return !slot; });
          if (emptyIndex >= 0) {
            slots[emptyIndex] = APP_STORE_REGISTRY['app-prompt-presets'];
          } else {
            slots.push(APP_STORE_REGISTRY['app-prompt-presets']);
          }
          saveDesktopStorage();
        }
        try { localStorage.setItem('momo_prompt_presets_desktop_seeded', '1'); } catch (e) {}
      }
      // 相册 App 首次上线：旧桌面没有这个图标时补一个到主屏，只补一次
      if (!localStorage.getItem('momo_album_desktop_seeded')) {
        const hasGallery = function(slot) {
          if (!slot) return false;
          if (slot.type === 'folder' && Array.isArray(slot.items)) {
            return slot.items.some(hasGallery);
          }
          return slot.id === 'app-gallery-photos';
        };
        const exists = desktopData.pages.some(p => Array.isArray(p.slots) && p.slots.some(hasGallery));
        if (!exists && desktopData.pages[0] && Array.isArray(desktopData.pages[0].slots)) {
          const slots = desktopData.pages[0].slots;
          const emptyIndex = slots.findIndex(function(slot) { return !slot; });
          if (emptyIndex >= 0) {
            slots[emptyIndex] = APP_STORE_REGISTRY['app-gallery-photos'];
          } else {
            slots.push(APP_STORE_REGISTRY['app-gallery-photos']);
          }
          saveDesktopStorage();
        }
        try { localStorage.setItem('momo_album_desktop_seeded', '1'); } catch (e) {}
      }
      // 健康 App 首次上线：旧桌面没有这个图标时补一个到主屏，只补一次
      if (!localStorage.getItem('momo_health_desktop_seeded')) {
        const hasHealth = function(slot) {
          if (!slot) return false;
          if (slot.type === 'folder' && Array.isArray(slot.items)) {
            return slot.items.some(hasHealth);
          }
          return slot.id === 'app-health';
        };
        const exists = desktopData.pages.some(p => Array.isArray(p.slots) && p.slots.some(hasHealth));
        if (!exists && desktopData.pages[0] && Array.isArray(desktopData.pages[0].slots)) {
          const slots = desktopData.pages[0].slots;
          const emptyIndex = slots.findIndex(function(slot) { return !slot; });
          if (emptyIndex >= 0) {
            slots[emptyIndex] = APP_STORE_REGISTRY['app-health'];
          } else {
            slots.push(APP_STORE_REGISTRY['app-health']);
          }
          saveDesktopStorage();
        }
        try { localStorage.setItem('momo_health_desktop_seeded', '1'); } catch (e) {}
      }
      // 长椅 App 首次上线：旧桌面没有这个图标时补一个到主屏，只补一次
      if (!localStorage.getItem('momo_forum_desktop_seeded')) {
        const hasForum = function(slot) {
          if (!slot) return false;
          if (slot.type === 'folder' && Array.isArray(slot.items)) {
            return slot.items.some(hasForum);
          }
          return slot.id === 'app-forum';
        };
        const existsForum = desktopData.pages.some(p => Array.isArray(p.slots) && p.slots.some(hasForum));
        if (!existsForum && desktopData.pages[0] && Array.isArray(desktopData.pages[0].slots)) {
          const slotsF = desktopData.pages[0].slots;
          const emptyF = slotsF.findIndex(function(slot) { return !slot; });
          if (emptyF >= 0) {
            slotsF[emptyF] = APP_STORE_REGISTRY['app-forum'];
          } else {
            slotsF.push(APP_STORE_REGISTRY['app-forum']);
          }
          saveDesktopStorage();
        }
        try { localStorage.setItem('momo_forum_desktop_seeded', '1'); } catch (e) {}
      }
      // 只清理页面尾部无意义空槽，中间空位保留，用户可以把 App 单独拎出来放
      if (trimTrailingDesktopSlots()) saveDesktopStorage();
    } catch(e) {
      desktopData = { version: '5.2', pages: JSON.parse(JSON.stringify(DEFAULT_PAGES_LAYOUT)) };
    }
    loadDockStorage();
  }

  function saveDesktopStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(desktopData));
    } catch(e) {}
    flushArtStorage();
  }

  // ================= 组件图片仓库：localStorage -> IndexedDB =================
  // localStorage 只有约 5MB，相片/头像多存几张就会写失败；失败后布局还在，
  // 下次打开组件就只剩“添加照片”。图片改存 IndexedDB，localStorage 只保留布局。
  const ART_DB_NAME = 'momo_widget_art_db_v1';
  const ART_DB_STORE = 'art';
  let artDbPromise = null;
  let artStorageLoaded = false;
  let artLoadStarted = false;
  let artDirty = {};

  function openArtDb() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (artDbPromise) return artDbPromise;
    artDbPromise = new Promise(function(resolve) {
      try {
        const req = window.indexedDB.open(ART_DB_NAME, 1);
        req.onupgradeneeded = function() {
          const db = req.result;
          if (!db.objectStoreNames.contains(ART_DB_STORE)) db.createObjectStore(ART_DB_STORE);
        };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { resolve(null); };
        req.onblocked = function() { resolve(null); };
      } catch(e) { resolve(null); }
    });
    return artDbPromise;
  }

  function dbGetAllArt() {
    return openArtDb().then(function(db) {
      if (!db) return {};
      return new Promise(function(resolve) {
        const out = {};
        try {
          const tx = db.transaction(ART_DB_STORE, 'readonly');
          const req = tx.objectStore(ART_DB_STORE).openCursor();
          req.onsuccess = function() {
            const cursor = req.result;
            if (!cursor) { resolve(out); return; }
            out[cursor.key] = cursor.value;
            cursor.continue();
          };
          req.onerror = function() { resolve(out); };
        } catch(e) { resolve(out); }
      });
    });
  }

  function dbPutArt(key, value) {
    return openArtDb().then(function(db) {
      if (!db) return false;
      return new Promise(function(resolve) {
        try {
          const tx = db.transaction(ART_DB_STORE, 'readwrite');
          tx.objectStore(ART_DB_STORE).put(value, key);
          tx.oncomplete = function() { resolve(true); };
          tx.onerror = function() { resolve(false); };
          tx.onabort = function() { resolve(false); };
        } catch(e) { resolve(false); }
      });
    });
  }

  function setArtStorage(key, value) {
    artStorage[key] = value;
    artDirty[key] = true;
  }

  function flushArtStorage() {
    const keys = Object.keys(artDirty);
    if (!keys.length) return;
    const batch = {};
    keys.forEach(function(key) { batch[key] = artStorage[key] || ''; });
    artDirty = {};
    openArtDb().then(function(db) {
      if (!db) {
        // 极老的浏览器没有 IndexedDB，只能退回旧方式；正常新机不会走到这里
        try { localStorage.setItem(ART_STORAGE_KEY, JSON.stringify(artStorage)); } catch(e) {}
        return;
      }
      try {
        const tx = db.transaction(ART_DB_STORE, 'readwrite');
        const store = tx.objectStore(ART_DB_STORE);
        keys.forEach(function(key) {
          if (batch[key]) store.put(batch[key], key);
          else store.delete(key);
        });
      } catch(e) {}
    });
  }

  function migrateLegacyArt() {
    let legacy = '';
    try { legacy = localStorage.getItem(ART_STORAGE_KEY) || ''; } catch(e) {}
    if (!legacy) return Promise.resolve();
    let parsed = {};
    try { parsed = JSON.parse(legacy) || {}; } catch(e) { return Promise.resolve(); }
    const keys = Object.keys(parsed);
    if (!keys.length) {
      try { localStorage.removeItem(ART_STORAGE_KEY); } catch(e) {}
      return Promise.resolve();
    }
    return openArtDb().then(function(db) {
      if (!db) return;
      return new Promise(function(resolve) {
        try {
          const tx = db.transaction(ART_DB_STORE, 'readwrite');
          const store = tx.objectStore(ART_DB_STORE);
          keys.forEach(function(key) { if (parsed[key]) store.put(parsed[key], key); });
          tx.oncomplete = function() {
            try { localStorage.removeItem(ART_STORAGE_KEY); } catch(e) {}
            resolve();
          };
          tx.onerror = function() { resolve(); };
          tx.onabort = function() { resolve(); };
        } catch(e) { resolve(); }
      });
    });
  }

  function loadArtFromDatabase() {
    if (artLoadStarted) return;
    artLoadStarted = true;
    migrateLegacyArt().then(function() {
      return dbGetAllArt();
    }).then(function(map) {
      if (map) {
        Object.keys(map).forEach(function(key) {
          if (map[key]) artStorage[key] = map[key];
        });
      }
      artStorageLoaded = true;
      try { if (typeof window.renderDynamicPages === 'function') window.renderDynamicPages(); } catch(e) {}
    }).catch(function() {
      artStorageLoaded = true;
    });
  }

  window.loadWidgetArtStorage = loadArtFromDatabase;

  // ================= Dock 数据层：固定 4 槽，可拖动、替换、与桌面互换 =================
  const DOCK_SPECIAL_ITEMS = {
    'dock-wechat': {
      id: 'dock-wechat',
      type: 'app',
      name: '微信',
      action: 'openWechatMain',
      dockOnly: true
    }
  };
  let dockSlots = null;

  function resolveDockItem(item) {
    if (!item) return null;
    if (item === 'app-me') return null;
    if (typeof item === 'object' && item.id === 'app-me') return null;
    if (item === 'app-css-editor') return null;
    if (typeof item === 'object' && item.id === 'app-css-editor') return null;
    if (typeof item === 'string') {
      return DOCK_SPECIAL_ITEMS[item] || APP_STORE_REGISTRY[item] || null;
    }
    if (item.type === 'folder') return null;
    const known = DOCK_SPECIAL_ITEMS[item.id] || APP_STORE_REGISTRY[item.id];
    if (known) return known;
    if (item.id && item.name) return item;
    return null;
  }

  function defaultDockSlots() {
    return [
      DOCK_SPECIAL_ITEMS['dock-wechat'],
      APP_STORE_REGISTRY['app-wordcards'],
      APP_STORE_REGISTRY['app-rp'],
      APP_STORE_REGISTRY['app-palace']
    ];
  }

  function loadDockStorage() {
    try {
      const saved = localStorage.getItem(DOCK_STORAGE_KEY);
      if (!saved) {
        dockSlots = defaultDockSlots();
        return;
      }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        dockSlots = defaultDockSlots();
        return;
      }
      dockSlots = parsed.slice(0, DOCK_SLOT_COUNT).map(resolveDockItem);
      while (dockSlots.length < DOCK_SLOT_COUNT) dockSlots.push(null);
      if (!dockSlots.some(Boolean)) dockSlots = defaultDockSlots();
    } catch (e) {
      dockSlots = defaultDockSlots();
    }
  }

  function saveDockStorage() {
    if (!Array.isArray(dockSlots)) return;
    try {
      localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(dockSlots.slice(0, DOCK_SLOT_COUNT)));
    } catch (e) {}
  }

  function openDockItem(item) {
    if (!item) return;
    if (item.action && typeof window[item.action] === 'function') {
      window[item.action]();
      return;
    }
    if (item.page && typeof window.openPage === 'function') window.openPage(item.page);
  }

  window.renderDock = function() {
    const bar = document.getElementById('home-dock-bar');
    if (!bar) return;
    if (!Array.isArray(dockSlots)) loadDockStorage();

    bar.innerHTML = '';
    for (let i = 0; i < DOCK_SLOT_COUNT; i++) {
      const item = dockSlots[i] || null;
      const el = document.createElement('div');
      el.className = 'dock-app-item' + (item ? '' : ' dock-empty-slot');
      el.setAttribute('data-dock-index', i);
      if (!item) {
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.innerHTML = `
          <div class="dock-icon">${deskIconSvg(item.id) || item.icon || '📱'}</div>
          <div class="dock-label">${item.name || '应用'}</div>
        `;
        el.onclick = function() {
          if (document.body.classList.contains('ios-edit-mode')) return;
          if (el.__dragMoved) return;
          openDockItem(item);
        };
      }
      bar.appendChild(el);
    }
    bindDockDragEngine(bar);
  };

  window.renderDynamicPages = function() {
    loadDesktopStorage();
    trimTrailingDesktopSlots();
    const viewport = document.getElementById('ios-viewport');
    if (!viewport) return;
    viewport.innerHTML = '';

    desktopData.pages.forEach((pageObj, pageIndex) => {
      const slideDiv = document.createElement('div');
      slideDiv.className = 'ios-page-slide dynamic-page-slide';
      slideDiv.id = 'slide-page-' + (pageIndex + 1);
      slideDiv.setAttribute('data-page-index', pageIndex);

      // 编辑操作条不再放进页面流里，改为 page-home 底部悬浮条，避免占顶部高度推动网格
      // 顶部大组件独立挂载容器（英雄卡保持整行；相片组件放进下方 4 列网格，让 App 能补到旁边空位）
      let photoWidgetEntries = [];
      if (Array.isArray(pageObj.widgets) && pageObj.widgets.length > 0) {
        const widgetSection = document.createElement('div');
        widgetSection.className = 'desktop-top-widgets-section';
        widgetSection.style.cssText = 'display: flex; flex-direction: column; gap: 12px; width: 100%; margin-bottom: 4px;';
        
        let splitRow = null;

        pageObj.widgets.forEach((wItem, wIndex) => {
          if (wItem.type === 'widget-hero') {
            const hCard = renderHeroProfileWidget(pageIndex, wIndex);
            widgetSection.appendChild(hCard);
          } else if (wItem.type === 'widget-companion') {
            const cCard = renderHeroCompanionWidget(pageIndex, wIndex);
            widgetSection.appendChild(cCard);
          } else if (wItem.type === 'widget-photo' || wItem.type === 'widget-music' || wItem.type === 'widget-countdown') {
            photoWidgetEntries.push({ item: wItem, wIndex: wIndex });
          } else if (wItem.type === 'widget-polaroid' || wItem.type === 'widget-note') {
            if (!splitRow) {
              splitRow = document.createElement('div');
              splitRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%;';
              widgetSection.appendChild(splitRow);
            }
            if (wItem.type === 'widget-polaroid') {
              splitRow.appendChild(renderPolaroidWidget(wItem, pageIndex, wIndex));
            } else {
              splitRow.appendChild(renderNoteWidget(wItem, pageIndex, wIndex));
            }
          }
        });
        if (widgetSection.childElementCount > 0) slideDiv.appendChild(widgetSection);
      }

      // 下方 4 列自适应动态网格
      const grid = document.createElement('div');
      grid.className = 'ios-dynamic-grid';
      grid.id = 'grid-page-' + (pageIndex + 1);
      grid.setAttribute('data-page-index', pageIndex);

      // 相片 / 音乐 / 倒数日组件和应用共用同一张 4 列网格
      photoWidgetEntries.forEach(function(entry) {
        if (entry.item.type === 'widget-music') {
          grid.appendChild(renderMusicWidget(entry.item, pageIndex, entry.wIndex));
        } else if (entry.item.type === 'widget-countdown') {
          grid.appendChild(renderCountdownWidget(entry.item, pageIndex, entry.wIndex));
        } else {
          grid.appendChild(renderPhotoWidget(entry.item, pageIndex, entry.wIndex));
        }
      });

      const actualSlots = (pageObj.slots || []).length;
      // 只有网格里真的放了相片 / 音乐 / 倒数日组件时，浏览态才不能隐藏整块网格；
      // 资料卡、心声私签等独立组件仍然可以留在无 App 的空页上。
      const hasGridWidgets = photoWidgetEntries.length > 0;
      // 固定补满四排（16 个）用于编辑态拖放；超过四排时按真实数量继续向下排，避免丢 App
      const maxSlots = Math.max(DESKTOP_GRID_MIN_SLOTS, actualSlots);
      if (actualSlots === 0 && !hasGridWidgets) grid.classList.add('is-empty-page-grid');
      for (let sIdx = 0; sIdx < maxSlots; sIdx++) {
        const item = (pageObj.slots && pageObj.slots[sIdx]) ? pageObj.slots[sIdx] : null;
        const itemEl = createSlotItemElement(item, pageIndex, sIdx);
        grid.appendChild(itemEl);
      }
      slideDiv.appendChild(grid);
      viewport.appendChild(slideDiv);
    });

    updatePageDotsIndicators();
    bindDragAndDropEngine();
    if (typeof window.renderHeroTexts === 'function') window.renderHeroTexts();
    if (typeof window.renderAppStore === 'function') window.renderAppStore();
    if (typeof window.renderDock === 'function') window.renderDock();
    if (typeof applyPendingSettle === 'function') applyPendingSettle();
    refreshDesktopMusicWidgets();
    ensureMusicWidgetPolling();
    updateDesktopEditToolbar();
  };

  // 当前正在看的桌面页（底部悬浮编辑条也用它来决定“加组件/删页”的目标）
  window.getDesktopPageIndex = function() {
    const vp = document.getElementById('ios-viewport');
    if (!vp) return 0;
    const pageWidth = vp.clientWidth || 1;
    const idx = Math.round(vp.scrollLeft / pageWidth);
    return Math.min(Math.max(0, idx), Math.max(0, desktopData.pages.length - 1));
  };

  function updateDesktopEditToolbar() {
    const idx = window.getDesktopPageIndex();
    const page = desktopData.pages[idx];
    const title = document.getElementById('desktop-edit-page-title');
    if (title) title.textContent = page && page.name ? page.name : ('桌面第 ' + (idx + 1) + ' 页');
    const del = document.getElementById('desktop-edit-delete-page');
    if (del) del.style.display = desktopData.pages.length > 1 ? '' : 'none';
  }

  window.updateDesktopEditToolbar = updateDesktopEditToolbar;

  function bindDesktopEditToolbar() {
    const vp = document.getElementById('ios-viewport');
    if (!vp || vp.__momoEditToolbarBound) return;
    vp.__momoEditToolbarBound = true;
    vp.addEventListener('scroll', updateDesktopEditToolbar, { passive: true });
    updateDesktopEditToolbar();
  }

  function updateDesktopStatusTime() {
    const el = document.getElementById('desktop-status-time');
    if (!el) return;
    const now = new Date();
    el.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }

  bindDesktopEditToolbar();
  updateDesktopStatusTime();
  setInterval(updateDesktopStatusTime, 60000);

  // 顶部大组件渲染函数
  function renderHeroProfileWidget(pageIndex, wIndex) {
    const card = document.createElement('div');
    card.className = 'widget-card widget-hero-profile';
    card.style.cssText = 'position: relative; border-radius: 28px; overflow: hidden;';
    const h = (typeof getWidgetProfile === 'function')
      ? getWidgetProfile()
      : ((window.appData && (window.appData.widgetProfile || window.appData.hero)) || { userName: 'user', userHandle: '@测试人员', userTag: '用户', locationText: '生活在真实世界中' });
    // 名片背景必须写进模板里：桌面组件是刷新后重新生成的，
    // 只靠 applyThemeAndImages 在启动时给 #hero-card-banner 上色会落空（那时元素还没建出来）
    let banner = (window.appData && window.appData.heroBanner) || '';
    if (!banner) { try { banner = localStorage.getItem('momo_hero_banner') || ''; } catch (e) { banner = ''; } }
    const bannerStyle = banner
      ? "background-image:url('" + banner.replace(/'/g, "\\'") + "'); background-size:cover; background-position:center;"
      : '';
    card.innerHTML = `
      <div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopWidget(${pageIndex}, ${wIndex})" title="移除组件">✕</div>
      <div class="hero-profile-card" style="margin: 0; box-shadow: none; border: none; height: 260px;">
        <div class="hero-card-banner" id="hero-card-banner" style="${bannerStyle}" onclick="triggerPick('heroBanner')" title="更换背景"></div>
        <div class="hero-avatar-wrap" onclick="triggerPick('heroAvatar')" title="更换头像">
          <img id="hero-avatar-img" src="${(window.appData && window.appData.heroAvatar) || localStorage.getItem('momo_hero_avatar') || ''}" alt="头像" />
        </div>
        <div class="hero-info-plate">
          <div class="editable-text-name" onclick="openHeroEditModal('userName')">
            <span id="hero-display-name">${h.userName || 'user'}</span>
            <span class="hero-edit-pen-tag">✎</span>
          </div>
          <div class="editable-text-sub" onclick="openHeroEditModal('userHandle')">
            <span id="hero-display-handle">${h.userHandle || '@测试人员'}</span>
          </div>
          <div class="editable-text-tag" onclick="openHeroEditModal('userTag')">
            <span id="hero-display-tag">${h.userTag || '用户'}</span>
          </div>
          <div class="location-bubble" onclick="openHeroEditModal('locationText')">
            📍 <span id="hero-display-location">${h.locationText || '生活在真实世界中'}</span>
          </div>
        </div>
      </div>
    `;
    return card;
  }

  function renderHeroCompanionWidget(pageIndex, wIndex) {
    const card = document.createElement('div');
    card.className = 'widget-card widget-companion-wrap';
    card.style.cssText = 'position: relative; border-radius: 20px; overflow: hidden;';
    card.innerHTML = `
      <div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopWidget(${pageIndex}, ${wIndex})" title="移除组件">✕</div>
      <div class="hero-companion-widget" id="hero-companion-card" onclick="cycleHeroCompanionQuote()" title="点击切换心语" style="margin: 0; border: none;">
        <div class="companion-avatar-dot"><span class="pulse-ring"></span><span class="companion-icon">🤍</span></div>
        <div class="companion-widget-center">
          <div class="companion-quote-text" id="companion-quote-text">“累了就歇会儿，随时随地都在这里陪着你。”</div>
          <div class="companion-status-row"><span class="companion-tag">伴侣心声</span><span class="companion-sub">· 永远为你待命 · 点击换一句</span></div>
        </div>
        <div class="companion-widget-right">↻</div>
      </div>
    `;
    return card;
  }

  function photoWidgetEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function photoWidgetSrc(item, index) {
    const keys = Array.isArray(item.photoIds) ? item.photoIds : [];
    return artStorage[keys[index]] || '';
  }

  function photoWidgetPencilSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5 17.5 10.5"/></svg>';
  }

  function photoWidgetGridSpan(variant) {
    if (variant === 'wide') return { cols: 4, rows: 1 };
    return { cols: 2, rows: 2 };
  }

  function applyPhotoWidgetGridPlacement(card, item, variant) {
    const span = photoWidgetGridSpan(variant);
    const maxCol = 5 - span.cols;
    if (item && item.gridPos && Number.isFinite(Number(item.gridPos.col)) && Number.isFinite(Number(item.gridPos.row))) {
      const col = Math.min(maxCol, Math.max(1, Math.round(Number(item.gridPos.col))));
      const row = Math.max(1, Math.round(Number(item.gridPos.row)));
      card.style.gridColumn = col + ' / span ' + span.cols;
      card.style.gridRow = row + ' / span ' + span.rows;
    }
    return span;
  }

  // 三种相片组件：2×2 单图 / 1×4 横图 / 2×2 双图+可编辑名称
  function renderPhotoWidget(item, pageIndex, wIndex) {
    const variant = item.variant || 'single';
    const card = document.createElement('div');
    card.className = 'photo-widget pw-' + variant;
    card.setAttribute('data-photo-widget-id', item.id || '');
    const deleteBadge = '<div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopWidget(' + pageIndex + ', ' + wIndex + ')" title="移除组件">✕</div>';
    const span = applyPhotoWidgetGridPlacement(card, item, variant);

    if (variant === 'pair') {
      const name = item.name || '未命名';
      const photoHtml = [0, 1].map(function(index) {
        const src = photoWidgetSrc(item, index);
        return '<div class="pw-pair-photo" onclick="event.stopPropagation(); triggerPickWidgetPhoto(\'' + item.id + '\', ' + index + ')">' +
          (src
            ? '<img src="' + src + '" alt="相片" draggable="false" ondragstart="return false" />'
            : '<div class="pw-empty pw-empty-small"><span class="pw-plus">＋</span><span>添加照片</span></div>') +
        '</div>';
      }).join('');

      card.innerHTML = deleteBadge +
        '<div class="pw-pair-photos">' + photoHtml + '</div>' +
        '<div class="pw-pair-name" onclick="event.stopPropagation(); openPhotoNameModal(\'' + item.id + '\')">' +
          '<span class="pw-name-text">' + photoWidgetEscape(name) + '</span>' +
          '<span class="pw-name-pencil">' + photoWidgetPencilSvg() + '</span>' +
        '</div>';
      bindPhotoWidgetDrag(card, item, pageIndex, wIndex, variant, span);
      return card;
    }

    const src = photoWidgetSrc(item, 0);
    card.innerHTML = deleteBadge +
      '<div class="pw-photo" onclick="event.stopPropagation(); triggerPickWidgetPhoto(\'' + item.id + '\', 0)">' +
        (src
          ? '<img src="' + src + '" alt="相片" draggable="false" ondragstart="return false" />'
          : '<div class="pw-empty"><span class="pw-plus">＋</span><span>添加照片</span></div>') +
        '<div class="pw-edit-chip">换照片</div>' +
      '</div>';
    bindPhotoWidgetDrag(card, item, pageIndex, wIndex, variant, span);
    return card;
  }

  // ================= 音乐 / 倒数日组件 =================
  function musicWidgetLyrics() {
    try {
      if (window.MzLyrics) {
        const p = window.MzLyrics.pair();
        if (p && (p[0] || p[1])) return [p[0] || '', p[1] || ''];
      }
    } catch (e) {}
    return null;
  }

  function musicWidgetState() {
    const audio = window._momoAudio;
    const titleEl = document.getElementById('music-current-title');
    const coverEl = document.getElementById('music-disk-cover');
    const hasTrack = !!(audio && audio.src && String(audio.src).trim());
    const coverAttr = coverEl ? (coverEl.getAttribute('src') || '') : '';
    return {
      hasTrack: hasTrack,
      title: hasTrack && titleEl ? (titleEl.textContent || '').trim() : '',
      cover: hasTrack && coverAttr && coverAttr !== 'undefined' ? coverAttr : '',
      playing: hasTrack && audio ? !audio.paused : false,
      lyrics: hasTrack ? musicWidgetLyrics() : null
    };
  }

  function musicWidgetPauseSvg() {
    return '<svg viewBox="0 0 22 26" aria-hidden="true"><rect x="6" y="3" width="4" height="20" rx="2" fill="currentColor"/><rect x="12" y="3" width="4" height="20" rx="2" fill="currentColor"/></svg>';
  }
  function musicWidgetPlaySvg() {
    return '<svg viewBox="0 0 22 26" aria-hidden="true"><path d="M5 3.5v19l14-9.5z" fill="currentColor"/></svg>';
  }
  function musicWidgetPrevSvg() {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4v12M15 4L5 10l10 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function musicWidgetNextSvg() {
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 4v12M5 4l10 6-10 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function musicWidgetWaveSvg() {
    return '<svg viewBox="0 0 30 30" aria-hidden="true">' +
      '<rect x="3" y="12" width="2" height="6" rx="1" fill="currentColor"></rect>' +
      '<rect x="7" y="8" width="2" height="14" rx="1" fill="currentColor"></rect>' +
      '<rect x="11" y="11" width="2" height="8" rx="1" fill="currentColor"></rect>' +
      '<rect x="15" y="5" width="2" height="20" rx="1" fill="currentColor"></rect>' +
      '<rect x="19" y="10" width="2" height="10" rx="1" fill="currentColor"></rect>' +
      '<rect x="23" y="13" width="2" height="4" rx="1" fill="currentColor"></rect>' +
      '<rect x="27" y="8" width="2" height="14" rx="1" fill="currentColor"></rect>' +
      '</svg>';
  }

  function renderMusicWidget(item, pageIndex, wIndex) {
    const card = document.createElement('div');
    card.className = 'photo-widget pw-music';
    card.setAttribute('data-photo-widget-id', item.id || '');
    card.setAttribute('data-music-widget-id', item.id || '');
    const deleteBadge = '<div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopWidget(' + pageIndex + ', ' + wIndex + ')" title="移除组件">✕</div>';
    applyPhotoWidgetGridPlacement(card, item, 'single');
    const state = musicWidgetState();
    const title = item.title || state.title || '晚风轻轻吹过';
    const fallbackLyrics = Array.isArray(item.lyrics) && item.lyrics.length === 2 ? item.lyrics : ['让晚风替我拥抱你', '在每一个安静的夜里'];
    // 正在放歌且拿到真歌词就用真歌词；拿不到（纯音乐/没登录）保留原来的两行留白文案
    const lyrics = state.lyrics || fallbackLyrics;
    const visualPlaying = state.hasTrack ? state.playing : true;
    const coverHtml = state.cover
      ? '<img class="mw-cover-img" src="' + photoWidgetEscape(state.cover) + '" alt="专辑封面" draggable="false" onerror="this.style.display=\'none\'" />'
      : '';
    card.innerHTML = deleteBadge +
      '<div class="mw-inner">' +
        '<div class="mw-top">' +
          '<div class="mw-cover" onclick="event.stopPropagation(); if(typeof openPage===\'function\') openPage(\'page-music\')" title="打开音乐">' +
            '<div class="mw-cover-art"></div>' + coverHtml +
          '</div>' +
          '<button type="button" class="mw-wave" onclick="event.stopPropagation(); if(typeof openPage===\'function\') openPage(\'page-music\')" title="打开音乐">' + musicWidgetWaveSvg() + '</button>' +
        '</div>' +
        '<div class="mw-title">' + photoWidgetEscape(title) + '</div>' +
        '<div class="mw-lyrics"><span>' + photoWidgetEscape(lyrics[0] || '') + '</span><span>' + photoWidgetEscape(lyrics[1] || '') + '</span></div>' +
        '<div class="mw-controls">' +
          '<button type="button" class="mw-ctrl mw-prev" onclick="event.stopPropagation(); toggleMusicWidget(\'prev\')" title="上一首">' + musicWidgetPrevSvg() + '</button>' +
          '<button type="button" class="mw-ctrl mw-play" data-playing="' + (visualPlaying ? '1' : '0') + '" onclick="event.stopPropagation(); toggleMusicWidget(\'play\')" title="播放 / 暂停">' +
            '<span class="mw-icon-pause">' + musicWidgetPauseSvg() + '</span>' +
            '<span class="mw-icon-play">' + musicWidgetPlaySvg() + '</span>' +
          '</button>' +
          '<button type="button" class="mw-ctrl mw-next" onclick="event.stopPropagation(); toggleMusicWidget(\'next\')" title="下一首">' + musicWidgetNextSvg() + '</button>' +
        '</div>' +
      '</div>';
    bindPhotoWidgetDrag(card, item, pageIndex, wIndex, 'music', photoWidgetGridSpan('single'));
    return card;
  }

  function daysWidgetDefaultItems() {
    return [{ id: 'dm_1', title: '初次相遇', date: '2026-01-01', category: 'love', isPinned: true }];
  }

  function getDaysWidgetItems() {
    try {
      const saved = localStorage.getItem('momo_days_matter_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return daysWidgetDefaultItems();
  }

  function getDaysWidgetInfo(widget) {
    const all = getDaysWidgetItems();
    let selected = null;
    if (widget && widget.daysId) {
      selected = all.find(function(day) { return day && day.id === widget.daysId; }) || null;
    }
    if (!selected) selected = all[0] || null;
    const dateStr = (selected && selected.date) || (widget && widget.date) || '';
    const parsed = dateStr ? String(dateStr).replace(/\//g, '-').split('-') : [];
    const y = parseInt(parsed[0], 10);
    const m = parseInt(parsed[1], 10) - 1;
    const d = parseInt(parsed[2], 10);
    let target = null;
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      target = new Date(y, m, d);
    }
    let dateLabel = '选择日期';
    let weekday = '';
    let daysText = '去选择';
    if (target && !isNaN(target.getTime())) {
      dateLabel = (target.getMonth() + 1) + '月' + target.getDate() + '日';
      weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][target.getDay()];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) daysText = '就是今天';
      else if (diffDays > 0) daysText = '已经 ' + diffDays + ' 天';
      else daysText = '还有 ' + Math.abs(diffDays) + ' 天';
    }
    return {
      item: selected,
      date: dateStr,
      dateLabel: dateLabel,
      weekday: weekday,
      daysText: daysText,
      valid: !!(target && !isNaN(target.getTime()))
    };
  }

  function countdownCalendarSvg() {
    return '<svg viewBox="0 0 18 18" aria-hidden="true"><rect x="2.5" y="3.5" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 7h13M6 2v3M12 2v3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  }
  function countdownChevronSvg() {
    return '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function renderCountdownWidget(item, pageIndex, wIndex) {
    const card = document.createElement('div');
    card.className = 'photo-widget pw-countdown';
    card.setAttribute('data-photo-widget-id', item.id || '');
    card.setAttribute('data-countdown-widget-id', item.id || '');
    const deleteBadge = '<div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopWidget(' + pageIndex + ', ' + wIndex + ')" title="移除组件">✕</div>';
    applyPhotoWidgetGridPlacement(card, item, 'single');
    const info = getDaysWidgetInfo(item);
    const avatarIds = Array.isArray(item.avatarPhotoIds) ? item.avatarPhotoIds : [];
    const avatarHtml = [0, 1].map(function(index) {
      const src = artStorage[avatarIds[index]] || '';
      return '<div class="dw-person">' +
        '<button type="button" class="dw-avatar" onclick="event.stopPropagation(); triggerPickDaysWidgetAvatar(\'' + item.id + '\', ' + index + ')" title="更换头像">' +
          (src
            ? '<img src="' + photoWidgetEscape(src) + '" alt="头像" draggable="false" />'
            : '<span class="dw-avatar-empty">＋</span>') +
          '<span class="dw-avatar-edit">换</span>' +
        '</button>' +
        '<div class="dw-mood">' + (index === 0 ? '(&gt;_&lt;)' : '^ω^') + '</div>' +
      '</div>';
    }).join('');

    card.innerHTML = deleteBadge +
      '<div class="dw-inner">' +
        '<div class="dw-avatar-row">' + avatarHtml + '</div>' +
        '<button type="button" class="dw-date-pill" onclick="event.stopPropagation(); openDaysWidgetDatePicker(\'' + item.id + '\')" title="选择倒数日">' +
          '<span class="dw-calendar">' + countdownCalendarSvg() + '</span>' +
          '<span class="dw-date">' + photoWidgetEscape(info.dateLabel) + '</span>' +
          '<span class="dw-week">' + photoWidgetEscape(info.weekday) + '</span>' +
          '<span class="dw-days">' + photoWidgetEscape(info.daysText) + '</span>' +
          '<span class="dw-chevron">' + countdownChevronSvg() + '</span>' +
        '</button>' +
      '</div>';
    bindPhotoWidgetDrag(card, item, pageIndex, wIndex, 'countdown', photoWidgetGridSpan('single'));
    return card;
  }

  window.toggleMusicWidget = function(action) {
    if (action === 'prev') {
      if (typeof window.prevMusicSong === 'function') window.prevMusicSong();
    } else if (action === 'next') {
      if (typeof window.nextMusicSong === 'function') window.nextMusicSong();
    } else if (typeof window.togglePlayMusic === 'function') {
      window.togglePlayMusic();
    }
    setTimeout(refreshDesktopMusicWidgets, 180);
  };

  function refreshDesktopMusicWidgets() {
    document.querySelectorAll('.photo-widget.pw-music').forEach(function(card) {
      const state = musicWidgetState();
      const playBtn = card.querySelector('.mw-play');
      if (playBtn) playBtn.setAttribute('data-playing', (state.hasTrack ? state.playing : true) ? '1' : '0');
      if (state.hasTrack && state.title) {
        const titleEl = card.querySelector('.mw-title');
        if (titleEl) titleEl.textContent = state.title;
      }
      if (state.cover) {
        let img = card.querySelector('.mw-cover-img');
        if (!img) {
          img = document.createElement('img');
          img.className = 'mw-cover-img';
          img.alt = '专辑封面';
          img.setAttribute('draggable', 'false');
          img.onerror = function() { this.style.display = 'none'; };
          const cover = card.querySelector('.mw-cover');
          if (cover) cover.appendChild(img);
        }
        if (img.getAttribute('src') !== state.cover) img.src = state.cover;
      }
      if (state.lyrics) {
        const lyrEl = card.querySelector('.mw-lyrics');
        if (lyrEl) {
          const spans = lyrEl.querySelectorAll('span');
          if (spans.length >= 2) {
            const a = state.lyrics[0] || '';
            const b = state.lyrics[1] || '';
            if (spans[0].textContent !== a) spans[0].textContent = a;
            if (spans[1].textContent !== b) spans[1].textContent = b;
          }
        }
      }
    });
  }
  window.refreshDesktopMusicWidgets = refreshDesktopMusicWidgets;

  let musicWidgetPollTimer = null;
  function ensureMusicWidgetPolling() {
    if (musicWidgetPollTimer) return;
    musicWidgetPollTimer = setInterval(function() {
      if (!document.querySelector('.photo-widget.pw-music')) return;
      refreshDesktopMusicWidgets();
    }, 1800);
  }


  function renderPolaroidWidget(item, pageIndex, wIndex) {
    const card = document.createElement('div');
    card.className = 'widget-card widget-polaroid';
    card.style.cssText = 'position: relative; border-radius: 20px; height: 145px;';
    const imgSrc = artStorage[item.photoId] || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=60';
    card.innerHTML = `
      <div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopWidget(${pageIndex}, ${wIndex})" title="移除组件">✕</div>
      <div class="polaroid-inner" onclick="openArtPreviewModal('${item.photoId}', '${item.title || '我的画作'}')">
        <div class="polaroid-photo-box" style="height: 98px;">
          <img src="${imgSrc}" class="polaroid-img" alt="小画" />
          <div class="polaroid-edit-overlay" onclick="event.stopPropagation(); triggerPickWidgetArt('${item.photoId}')"><span>📷 换画</span></div>
        </div>
        <div class="polaroid-caption"><span class="polaroid-title">${item.title || '我的画作'}</span><span class="polaroid-tag">展示相框</span></div>
      </div>
    `;
    return card;
  }

  function renderNoteWidget(item, pageIndex, wIndex) {
    const card = document.createElement('div');
    card.className = 'widget-card widget-note-card';
    card.style.cssText = 'position: relative; border-radius: 20px; height: 145px;';
    const quotes = ["“累了就歇会儿，随时随地都在这里陪着你。”", "“今天无论怎样，我都无条件站在你这边。”", "“你的每一个灵感瞬间，我都替你好好珍藏。”", "“安心做你想做的事，身后有我守着。”"];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    card.innerHTML = `
      <div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopWidget(${pageIndex}, ${wIndex})" title="移除组件">✕</div>
      <div class="note-card-inner" onclick="cycleWidgetNote(this)">
        <div class="note-card-header"><span class="note-pin">📌</span><span class="note-author">${item.title || '角色私签'}</span></div>
        <div class="note-card-body">${randomQuote}</div>
        <div class="note-card-footer">戳一下换一句 · 永远在线</div>
      </div>
    `;
    return card;
  }

  // 渲染槽位元素（应用 / 文件夹 / 空位）
  function createSlotItemElement(item, pageIndex, slotIndex) {
    const card = document.createElement('div');
    card.setAttribute('data-page-index', pageIndex);
    card.setAttribute('data-slot-index', slotIndex);

    if (!item) {
      card.className = 'grid-drag-item empty-slot-placeholder item-span-1x1';
      card.style.cssText = 'min-height: 83px; width: 100%; background: transparent; border: none; display: flex; align-items: center; justify-content: center; pointer-events: auto;';
      return card;
    }

    // 文件夹对象渲染
    if (item.type === 'folder') {
      card.className = 'ios-app-card grid-drag-item item-span-1x1 is-folder-item';
      if (newFolderSlot && newFolderSlot.pageIndex === pageIndex && newFolderSlot.slotIndex === slotIndex && Date.now() < newFolderSlot.until) {
        card.classList.add('folder-just-created');
      }
      const itemsList = Array.isArray(item.items) ? item.items : [];
      let miniGridHtml = '';
      for (let i = 0; i < 9; i++) {
        const mini = itemsList[i];
        if (mini) {
          miniGridHtml += `<div class="ios-folder-mini-icon">${deskIconSvg(mini.id) || mini.icon || '📱'}</div>`;
        } else {
          miniGridHtml += `<div class="ios-folder-mini-slot"></div>`;
        }
      }
      card.innerHTML = `
        <div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopItem(${pageIndex}, ${slotIndex})" title="解散文件夹">✕</div>
        <div class="ios-folder-preview-box">
          <div class="ios-folder-preview-grid">${miniGridHtml}</div>
        </div>
        <div class="ios-app-name">${item.name || '文件夹'}</div>
      `;
      card.onclick = function() {
        if (document.body.classList.contains('ios-edit-mode')) return;
        openFolderModal(pageIndex, slotIndex);
      };
      return card;
    }

    // 普通应用渲染
    card.className = 'ios-app-card grid-drag-item item-span-1x1';
    card.innerHTML = `
      <div class="ios-delete-badge" onclick="event.stopPropagation(); removeDesktopItem(${pageIndex}, ${slotIndex})" title="卸载应用">✕</div>
      <div class="ios-app-icon">${deskIconSvg(item.id) || item.icon || '📱'}</div>
      <div class="ios-app-name">${item.name || '未命名'}</div>
    `;
    card.onclick = function() {
      if (document.body.classList.contains('ios-edit-mode')) return;
      if (item.action && typeof window[item.action] === 'function') {
        window[item.action]();
      } else if (item.page && typeof window.openPage === 'function') {
        window.openPage(item.page);
      }
    };
    return card;
  }

  // 文件夹弹窗 Modal 控制
  window.openFolderModal = function(pageIndex, slotIndex) {
    const page = desktopData.pages[pageIndex];
    if (!page || !page.slots[slotIndex]) return;
    const folder = page.slots[slotIndex];
    activeFolderInfo = { pageIndex, slotIndex, folder };

    const mask = document.getElementById('ios-folder-modal-mask');
    const titleInput = document.getElementById('ios-folder-title-input');
    const grid = document.getElementById('ios-folder-modal-grid');
    if (!mask || !grid) return;

    if (titleInput) titleInput.value = folder.name || '文件夹';
    grid.innerHTML = '';

    (folder.items || []).forEach((app, innerIndex) => {
      const appCard = document.createElement('div');
      appCard.className = 'folder-inner-app-card';
      appCard.innerHTML = `
        <div class="folder-inner-remove-badge" onclick="event.stopPropagation(); removeAppFromFolder(${innerIndex})" title="移出文件夹">✕</div>
        <div class="ios-app-icon">${deskIconSvg(app.id) || app.icon || '📱'}</div>
        <div class="ios-app-name">${app.name || '应用'}</div>
      `;
      appCard.onclick = function() {
        if (appCard.__dragMoved) return;
        if (document.body.classList.contains('ios-edit-mode')) return;
        closeFolderModal(true);
        if (app.action && typeof window[app.action] === 'function') {
          window[app.action]();
        } else if (app.page && typeof window.openPage === 'function') {
          window.openPage(app.page);
        }
      };
      bindFolderInnerDrag(appCard, innerIndex, app);
      grid.appendChild(appCard);
    });

    mask.classList.add('active');
    const card = mask.querySelector('.ios-folder-modal-card');
    const tile = document.querySelector('.ios-page-slide[data-page-index="' + pageIndex + '"] .grid-drag-item[data-slot-index="' + slotIndex + '"]');
    if (card && tile && typeof card.animate === 'function') {
      const from = tile.getBoundingClientRect();
      const to = card.getBoundingClientRect();
      if (to.width && to.height) {
        const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
        const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
        const sx = from.width / to.width;
        const sy = from.height / to.height;
        card.animate([
          { offset: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')', borderRadius: '15px', opacity: 0.55, filter: 'blur(5px)' },
          { offset: 1, transform: 'translate(0,0) scale(1,1)', borderRadius: '32px', opacity: 1, filter: 'blur(0)' }
        ], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
    }
  };

  window.closeFolderModal = function(immediate) {
    const mask = document.getElementById('ios-folder-modal-mask');
    if (!mask) {
      activeFolderInfo = null;
      return;
    }
    if (!mask.classList.contains('active')) {
      activeFolderInfo = null;
      return;
    }
    if (immediate || mask.__closing) {
      mask.classList.remove('active');
      mask.classList.remove('closing');
      mask.__closing = false;
      activeFolderInfo = null;
      return;
    }
    const card = mask.querySelector('.ios-folder-modal-card');
    const info = activeFolderInfo;
    const tile = info ? document.querySelector('.ios-page-slide[data-page-index="' + info.pageIndex + '"] .grid-drag-item[data-slot-index="' + info.slotIndex + '"]') : null;
    mask.__closing = true;
    mask.classList.add('closing');
    const finish = function() {
      if (activeFolderInfo === info) {
        mask.classList.remove('active');
        activeFolderInfo = null;
      }
      mask.classList.remove('closing');
      mask.__closing = false;
    };
    if (card && tile && typeof card.animate === 'function') {
      const from = tile.getBoundingClientRect();
      const to = card.getBoundingClientRect();
      const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
      const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      const anim = card.animate([
        { offset: 0, transform: 'translate(0,0) scale(1,1)', borderRadius: '32px', opacity: 1, filter: 'blur(0)' },
        { offset: 1, transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')', borderRadius: '15px', opacity: 0.45, filter: 'blur(5px)' }
      ], { duration: 260, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
      anim.onfinish = finish;
      setTimeout(finish, 300);
    } else {
      setTimeout(finish, 180);
    }
  };

  window.updateCurrentFolderName = function(newName) {
    if (!activeFolderInfo || !activeFolderInfo.folder) return;
    activeFolderInfo.folder.name = newName.trim() || '文件夹';
    saveDesktopStorage();
    renderDynamicPages();
  };

  window.removeAppFromFolder = function(innerIndex) {
    if (!activeFolderInfo || !activeFolderInfo.folder) return;
    const folder = activeFolderInfo.folder;
    if (!Array.isArray(folder.items)) return;
    const removedApp = folder.items.splice(innerIndex, 1)[0];
    if (folder.items.length <= 1) {
      // 文件夹如果只剩 1 个，解散还原为普通应用
      const remainingApp = folder.items[0];
      desktopData.pages[activeFolderInfo.pageIndex].slots[activeFolderInfo.slotIndex] = remainingApp || null;
      closeFolderModal(true);
    } else {
      openFolderModal(activeFolderInfo.pageIndex, activeFolderInfo.slotIndex);
    }
    // 把移出的 App 放到当前桌面的空槽位
    if (removedApp) installAppToDesktop(removedApp);
    saveDesktopStorage();
    renderDynamicPages();
  };

  // 把图标从文件夹里拖回桌面：只剩一个时文件夹自动解散
  window.pullAppOutOfFolder = function(innerIndex) {
    if (!activeFolderInfo || !activeFolderInfo.folder) return;
    const info = activeFolderInfo;
    const folder = info.folder;
    if (!Array.isArray(folder.items) || !folder.items[innerIndex]) return;
    const app = folder.items.splice(innerIndex, 1)[0];
    const page = desktopData.pages[info.pageIndex];
    if (page && Array.isArray(page.slots)) {
      if (folder.items.length <= 1) {
        page.slots[info.slotIndex] = folder.items[0] || null;
      }
    }
    closeFolderModal(true);
    saveDesktopStorage();
    installAppToDesktop(app);
  };

  // 文件夹内图标指针拖拽：移出卡片外即放回桌面
  function bindFolderInnerDrag(appCard, innerIndex, app) {
    let startX = 0;
    let startY = 0;
    let pointerId = null;
    let moved = false;
    let ghost = null;

    function cardBox() {
      const mask = document.getElementById('ios-folder-modal-mask');
      return mask ? mask.querySelector('.ios-folder-modal-card') : null;
    }

    function isOutside(x, y) {
      const box = cardBox();
      if (!box) return false;
      const r = box.getBoundingClientRect();
      return x < r.left - 10 || x > r.right + 10 || y < r.top - 10 || y > r.bottom + 10;
    }

    function cleanup() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }

    function onMove(e) {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.sqrt(dx * dx + dy * dy) > 9) {
        moved = true;
        appCard.__dragMoved = true;
        ghost = document.createElement('div');
        ghost.className = 'folder-drag-ghost';
        ghost.innerHTML = '<div class="ios-app-icon">' + (deskIconSvg(app.id) || app.icon || '📱') + '</div>';
        document.body.appendChild(ghost);
        appCard.classList.add('dragging');
      }
      if (!moved || !ghost) return;
      e.preventDefault();
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
      const box = cardBox();
      if (box) box.classList.toggle('folder-drop-out', isOutside(e.clientX, e.clientY));
    }

    function onUp(e) {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      cleanup();
      const out = moved && isOutside(e.clientX, e.clientY);
      const box = cardBox();
      if (box) box.classList.remove('folder-drop-out');
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
      appCard.classList.remove('dragging');
      if (out) {
        appCard.__dragMoved = false;
        window.pullAppOutOfFolder(innerIndex);
      } else {
        setTimeout(function() { appCard.__dragMoved = false; }, 350);
      }
    }

    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('.folder-inner-remove-badge')) return;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
      moved = false;
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }

    appCard.addEventListener('pointerdown', onDown);
  }

  // 卸载与留空保护规则
  window.removeDesktopItem = function(pageIndex, slotIndex) {
    if (!desktopData.pages[pageIndex] || !Array.isArray(desktopData.pages[pageIndex].slots)) return;
    const item = desktopData.pages[pageIndex].slots[slotIndex];
    const name = item ? (item.name || '此项目') : '项目';
    if (!confirm('确定卸载「' + name + '」吗？卸载后该位置会保留为空位。')) return;
    desktopData.pages[pageIndex].slots[slotIndex] = null;
    saveDesktopStorage();
    renderDynamicPages();
  };

  window.removeDesktopWidget = function(pageIndex, wIndex) {
    if (!desktopData.pages[pageIndex] || !Array.isArray(desktopData.pages[pageIndex].widgets)) return;
    if (!confirm('确定移除该大组件吗？')) return;
    desktopData.pages[pageIndex].widgets.splice(wIndex, 1);
    saveDesktopStorage();
    renderDynamicPages();
  };

  // 安装新 App：优先寻找空槽位，不破坏已有布局
  window.installAppToDesktop = function(appItem) {
    if (!appItem || !appItem.id) return;
    loadDesktopStorage();
    let inserted = false;
    for (let p = 0; p < desktopData.pages.length; p++) {
      const page = desktopData.pages[p];
      if (Array.isArray(page.slots)) {
        const nullIdx = page.slots.indexOf(null);
        if (nullIdx !== -1) {
          page.slots[nullIdx] = appItem;
          inserted = true;
          break;
        }
      }
    }
    if (!inserted) {
      const lastPage = desktopData.pages[desktopData.pages.length - 1];
      if (lastPage && lastPage.slots.length < 24) {
        lastPage.slots.push(appItem);
        inserted = true;
      }
    }
    if (!inserted) {
      const newPageIndex = desktopData.pages.length + 1;
      desktopData.pages.push({
        id: 'page-' + newPageIndex,
        name: '桌面第 ' + newPageIndex + ' 页',
        widgets: [],
        slots: [appItem]
      });
    }
    saveDesktopStorage();
    renderDynamicPages();
  };

  // 分页控制
  window.addNewDesktopPage = function() {
    const nextIdx = desktopData.pages.length + 1;
    desktopData.pages.push({
      id: 'page-' + nextIdx,
      name: '桌面第 ' + nextIdx + ' 页',
      widgets: [],
      slots: []
    });
    saveDesktopStorage();
    renderDynamicPages();
    setTimeout(() => {
      if (typeof window.switchIosSlide === 'function') {
        window.switchIosSlide(desktopData.pages.length - 1);
      }
    }, 100);
  };

  window.deleteDesktopPage = function(pageIndex) {
    if (desktopData.pages.length <= 1) {
      alert('至少保留一页桌面哦');
      return;
    }
    const confirmed = confirm('确定删除「' + (desktopData.pages[pageIndex].name || '此页') + '」吗？里面的图标会自动归拢到前一页。');
    if (!confirmed) return;

    const itemsToMove = (desktopData.pages[pageIndex].slots || []).filter(Boolean);
    desktopData.pages.splice(pageIndex, 1);
    if (desktopData.pages[0]) {
      desktopData.pages[0].slots = [...desktopData.pages[0].slots, ...itemsToMove];
    }
    saveDesktopStorage();
    renderDynamicPages();
  };

  window.openAddWidgetModal = function(pageIndex) {
    currentTargetPageIndex = pageIndex;
    const modal = document.getElementById('widget-add-center-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeAddWidgetModal = function() {
    const modal = document.getElementById('widget-add-center-modal');
    if (modal) modal.style.display = 'none';
  };

  window.insertWidgetToCurrentPage = function(widgetType) {
    if (!desktopData.pages[currentTargetPageIndex]) return;
    const page = desktopData.pages[currentTargetPageIndex];
    if (!Array.isArray(page.widgets)) page.widgets = [];

    const uniqueId = 'widget-' + Date.now();

    if (widgetType === 'hero') {
      const exists = desktopData.pages.some(function(p) {
        return (p.widgets || []).some(function(w) { return w && w.type === 'widget-hero'; });
      }) || (page.slots || []).some(function(s) { return s && s.type === 'widget-hero'; });
      if (exists) {
        alert('桌面上已经有一张「我的小手机」资料卡了，一张就够啦。');
        return;
      }
      page.widgets.push({ id: uniqueId, type: 'widget-hero' });
    } else if (widgetType === 'note') {
      page.widgets.push({ id: uniqueId, type: 'widget-note', title: '心声私签' });
    } else if (widgetType.indexOf('photo-') === 0) {
      const variant = widgetType.replace('photo-', '');
      const count = variant === 'pair' ? 2 : 1;
      const photoIds = [];
      for (let i = 0; i < count; i++) {
        const key = 'photo-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 7);
        setArtStorage(key, '');
        photoIds.push(key);
      }
      page.widgets.push({
        id: uniqueId,
        type: 'widget-photo',
        variant: variant,
        photoIds: photoIds,
        name: variant === 'pair' ? '未命名' : ''
      });
    } else if (widgetType === 'music') {
      page.widgets.push({
        id: uniqueId,
        type: 'widget-music'
      });
    } else if (widgetType === 'countdown') {
      const firstDay = getDaysWidgetItems()[0] || { id: 'dm_1', title: '初次相遇', date: '2026-01-01' };
      const avatarPhotoIds = [];
      for (let i = 0; i < 2; i++) {
        const key = 'days-avatar-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 7);
        setArtStorage(key, '');
        avatarPhotoIds.push(key);
      }
      page.widgets.push({
        id: uniqueId,
        type: 'widget-countdown',
        avatarPhotoIds: avatarPhotoIds,
        daysId: firstDay.id || '',
        date: firstDay.date || '',
        title: firstDay.title || ''
      });
    }

    saveDesktopStorage();
    closeAddWidgetModal();
    renderDynamicPages();
  };

  // ================= 相片组件的选图与名称编辑 =================
  let pendingPhotoTarget = null;
  let pendingPhotoNameWidgetId = null;

  function findPhotoWidgetById(widgetId) {
    for (let p = 0; p < desktopData.pages.length; p++) {
      const widgets = desktopData.pages[p].widgets || [];
      for (let w = 0; w < widgets.length; w++) {
        if (widgets[w] && widgets[w].id === widgetId) return widgets[w];
      }
    }
    return null;
  }

  function compressPhotoWidgetImage(src, maxWidth, quality) {
    maxWidth = maxWidth || 1200;
    quality = quality || 0.9;
    return new Promise(function(resolve) {
      if (!src || typeof src !== 'string') { resolve(''); return; }
      const img = new Image();
      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          resolve(src);
        }
      };
      img.onerror = function() { resolve(src); };
      img.src = src;
    });
  }

  window.triggerPickWidgetPhoto = function(widgetId, photoIndex) {
    const widget = findPhotoWidgetById(widgetId);
    if (!widget) return;
    pendingPhotoTarget = { widgetId: widgetId, photoIndex: photoIndex || 0 };
    const input = document.getElementById('widget-photo-file-input');
    if (!input) return;
    input.value = '';
    input.click();
  };

  window.handleWidgetPhotoFileSelect = function(event) {
    const input = event && event.target;
    const file = input && input.files && input.files[0];
    const target = pendingPhotoTarget;
    pendingPhotoTarget = null;
    if (!file || !target) return;
    if (!/^image\//.test(file.type || '')) {
      alert('请选择图片文件。');
      return;
    }
    const reader = new FileReader();
    reader.onload = function() {
      compressPhotoWidgetImage(reader.result).then(function(compressed) {
        const widget = findPhotoWidgetById(target.widgetId);
        if (!widget) return;
        const keys = Array.isArray(widget.photoIds) ? widget.photoIds : (widget.photoIds = []);
        let key = keys[target.photoIndex];
        if (!key) {
          key = 'photo-' + Date.now() + '-' + target.photoIndex;
          keys[target.photoIndex] = key;
        }
        setArtStorage(key, compressed);
        saveDesktopStorage();
        renderDynamicPages();
      });
    };
    reader.onerror = function() { alert('图片读取失败，请换一张试试。'); };
    reader.readAsDataURL(file);
    input.value = '';
  };

  window.openPhotoNameModal = function(widgetId) {
    const widget = findPhotoWidgetById(widgetId);
    if (!widget) return;
    pendingPhotoNameWidgetId = widgetId;
    const modal = document.getElementById('photo-name-modal');
    const input = document.getElementById('photo-name-input');
    if (!modal || !input) return;
    input.value = widget.name || '';
    modal.style.display = 'flex';
    setTimeout(function() {
      input.focus();
      input.select();
    }, 40);
  };

  window.closePhotoNameModal = function() {
    pendingPhotoNameWidgetId = null;
    const modal = document.getElementById('photo-name-modal');
    if (modal) modal.style.display = 'none';
  };

  window.savePhotoNameModal = function() {
    if (!pendingPhotoNameWidgetId) return;
    const widget = findPhotoWidgetById(pendingPhotoNameWidgetId);
    const input = document.getElementById('photo-name-input');
    if (!widget || !input) return;
    widget.name = input.value.trim() || '未命名';
    pendingPhotoNameWidgetId = null;
    const modal = document.getElementById('photo-name-modal');
    if (modal) modal.style.display = 'none';
    saveDesktopStorage();
    renderDynamicPages();
  };

  // ================= 倒数日组件：双头像换图 + 日期胶囊连接倒数日 =================
  let pendingDaysWidgetAvatar = null;
  let pendingDaysWidgetId = null;

  window.triggerPickDaysWidgetAvatar = function(widgetId, avatarIndex) {
    const widget = findPhotoWidgetById(widgetId);
    if (!widget || !widget.id) return;
    pendingDaysWidgetAvatar = { widgetId: widgetId, avatarIndex: avatarIndex || 0 };
    const input = document.getElementById('widget-days-avatar-file-input');
    if (!input) return;
    input.value = '';
    input.click();
  };

  window.handleDaysWidgetAvatarFileSelect = function(event) {
    const input = event && event.target;
    const file = input && input.files && input.files[0];
    const target = pendingDaysWidgetAvatar;
    pendingDaysWidgetAvatar = null;
    if (!file || !target) return;
    if (!/^image\//.test(file.type || '')) {
      alert('请选择图片文件。');
      return;
    }
    const reader = new FileReader();
    reader.onload = function() {
      compressPhotoWidgetImage(reader.result, 1000, 0.9).then(function(compressed) {
        const widget = findPhotoWidgetById(target.widgetId);
        if (!widget) return;
        const ids = Array.isArray(widget.avatarPhotoIds) ? widget.avatarPhotoIds : (widget.avatarPhotoIds = []);
        let key = ids[target.avatarIndex];
        if (!key) {
          key = 'days-avatar-' + Date.now() + '-' + target.avatarIndex;
          ids[target.avatarIndex] = key;
        }
        setArtStorage(key, compressed);
        saveDesktopStorage();
        renderDynamicPages();
      });
    };
    reader.onerror = function() { alert('图片读取失败，请换一张试试。'); };
    reader.readAsDataURL(file);
    input.value = '';
  };

  function renderDaysWidgetPickerList() {
    const list = document.getElementById('days-widget-picker-list');
    if (!list) return;
    const widget = pendingDaysWidgetId ? findPhotoWidgetById(pendingDaysWidgetId) : null;
    if (!widget) {
      list.innerHTML = '<div class="dw-picker-empty">找不到这个组件，先关掉再试一次。</div>';
      return;
    }
    const all = getDaysWidgetItems();
    list.innerHTML = all.map(function(day) {
      const info = getDaysWidgetInfo({ daysId: day.id, date: day.date });
      const selected = widget.daysId === day.id ? ' is-selected' : '';
      return '<button type="button" class="dw-picker-item' + selected + '" onclick="selectDaysWidgetDate(\'' + photoWidgetEscape(widget.id) + '\', \'' + photoWidgetEscape(day.id) + '\')">' +
        '<span class="dw-picker-main">' +
          '<span class="dw-picker-name">' + photoWidgetEscape(day.title || '未命名倒数日') + '</span>' +
          '<span class="dw-picker-date">' + photoWidgetEscape(info.dateLabel) + ' · ' + photoWidgetEscape(info.weekday) + '</span>' +
        '</span>' +
        '<span class="dw-picker-days">' + photoWidgetEscape(info.daysText) + '</span>' +
        '<span class="dw-picker-check">' + (selected ? '✓' : '') + '</span>' +
      '</button>';
    }).join('');
  }

  window.openDaysWidgetDatePicker = function(widgetId) {
    const widget = findPhotoWidgetById(widgetId);
    if (!widget) return;
    pendingDaysWidgetId = widgetId;
    const modal = document.getElementById('days-widget-picker-modal');
    if (!modal) return;
    renderDaysWidgetPickerList();
    modal.style.display = 'flex';
  };

  window.closeDaysWidgetDatePicker = function() {
    pendingDaysWidgetId = null;
    const modal = document.getElementById('days-widget-picker-modal');
    if (modal) modal.style.display = 'none';
  };

  window.selectDaysWidgetDate = function(widgetId, daysId) {
    const widget = findPhotoWidgetById(widgetId);
    if (!widget) return;
    const day = getDaysWidgetItems().find(function(item) { return item && item.id === daysId; });
    if (!day) return;
    widget.daysId = day.id;
    widget.date = day.date || '';
    widget.title = day.title || '';
    pendingDaysWidgetId = null;
    const modal = document.getElementById('days-widget-picker-modal');
    if (modal) modal.style.display = 'none';
    saveDesktopStorage();
    renderDynamicPages();
  };


  function updatePageDotsIndicators() {
    const dotsContainer = document.getElementById('home-page-dots');
    if (!dotsContainer) return;
    const totalPages = desktopData.pages.length;
    dotsContainer.innerHTML = '';
    for (let i = 0; i < totalPages; i++) {
      const hitbox = document.createElement('div');
      hitbox.className = 'ios-dot-hitbox' + (i === 0 ? ' active' : '');
      hitbox.id = 'dot-hitbox-' + (i + 1);
      hitbox.setAttribute('title', '第 ' + (i + 1) + ' 页');
      hitbox.onclick = function() {
        if (typeof window.switchIosSlide === 'function') window.switchIosSlide(i);
      };
      hitbox.innerHTML = '<div class="ios-dot" id="dot-page-' + (i + 1) + '"></div>';
      dotsContainer.appendChild(hitbox);
    }
  }

  // ================= 拖拽、合并建文件夹与换位核心引擎 =================
  let draggedItemInfo = null;
  let dragGhostEl = null;
  let isDraggingActive = false;
  let mergeHoverTimer = null;
  let currentCandidateEl = null;
  let currentDropTarget = null;
  let previewCards = [];
  let desktopGesture = null;
  let dockGesture = null;
  let pendingSettle = null;
  let lastDragX = 0;
  let lastDragY = 0;
  let widgetDragGesture = null;
  let widgetDragGhostEl = null;
  let widgetDropCellEl = null;

  // 仅用于自动化验证拖拽状态，不影响正常桌面
  window.__momoDragDebug = function() {
    return {
      active: isDraggingActive,
      info: draggedItemInfo ? {
        kind: draggedItemInfo.kind,
        pageIndex: draggedItemInfo.pageIndex,
        slotIndex: draggedItemInfo.slotIndex,
        dockIndex: draggedItemInfo.dockIndex
      } : null,
      target: currentDropTarget ? {
        kind: currentDropTarget.kind,
        pageIndex: currentDropTarget.pageIndex,
        slotIndex: currentDropTarget.slotIndex,
        dockIndex: currentDropTarget.dockIndex
      } : null,
      dockGesture: dockGesture ? {
        hold: dockGesture.hold,
        pointerId: dockGesture.pointerId,
        hasMove: typeof dockGesture.move === 'function',
        hasUp: typeof dockGesture.up === 'function',
        lastX: dockGesture.x,
        lastY: dockGesture.y
      } : null
    };
  };

  function bindDragAndDropEngine() {
    const allItems = document.querySelectorAll('.grid-drag-item');
    allItems.forEach(item => {
      if (!item.classList.contains('empty-slot-placeholder')) {
        bindItemDragEvents(item);
      }
    });
  }

  function bindItemDragEvents(itemEl) {
    let startX = 0, startY = 0, currentX = 0, currentY = 0;
    let longPressTimer = null, isHoldDrag = false, pointerId = null;

    function armDrag() {
      if (isDraggingActive) return;
      startDragging(itemEl, currentX, currentY);
      isHoldDrag = !!draggedItemInfo;
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('.ios-delete-badge') || e.target.closest('button')) return;
      startX = e.clientX; startY = e.clientY;
      currentX = startX; currentY = startY;
      pointerId = e.pointerId;
      isHoldDrag = false;
      clearTimeout(longPressTimer);
      desktopGesture = { move: onPointerMove, up: onPointerUp };

      if (!document.body.classList.contains('ios-edit-mode')) {
        // iOS 手感：长按 700ms 先进入晃动编辑，并在同一根手指上直接拿起图标
        longPressTimer = setTimeout(function() {
          if (typeof window.enterIosEditMode === 'function') window.enterIosEditMode();
          armDrag();
        }, EDIT_LONG_PRESS_MS);
      } else {
        // 已在编辑模式：稍长的 160ms 持握，避免轻点就误拿起
        longPressTimer = setTimeout(armDrag, EDIT_HOLD_MS);
      }
    }

    function onPointerMove(e) {
      if (pointerId !== null && e.pointerId !== undefined && e.pointerId !== pointerId) return;
      currentX = e.clientX; currentY = e.clientY;
      if (!isHoldDrag) {
        if (Math.hypot(currentX - startX, currentY - startY) > 8) clearTimeout(longPressTimer);
        return;
      }
      if (e.cancelable) e.preventDefault();
      updateGhostPosition(currentX, currentY);
      updateDragHover(currentX, currentY);
    }

    function onPointerUp(e) {
      if (pointerId !== null && e.pointerId !== undefined && e.pointerId !== pointerId) return;
      clearTimeout(longPressTimer);
      if (isHoldDrag) {
        isHoldDrag = false;
        finishDropOrMerge(currentX, currentY);
      }
      pointerId = null;
      desktopGesture = null;
    }

    itemEl.addEventListener('pointerdown', onPointerDown);
    itemEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }

  // 全局只注册一次指针监听，避免每次渲染都为每个图标重复挂 window 监听
  if (!window.__momoDesktopPointerBound) {
    window.__momoDesktopPointerBound = true;
    window.addEventListener('pointermove', function(e) {
      if (desktopGesture) desktopGesture.move(e);
    }, { passive: false });
    window.addEventListener('pointerup', function(e) {
      if (desktopGesture) desktopGesture.up(e);
    }, { passive: true });
    window.addEventListener('pointercancel', function(e) {
      if (desktopGesture) desktopGesture.up(e);
    }, { passive: true });
  }

  function startDragging(itemEl, x, y) {
    if (isDraggingActive) return;
    const pageIndex = parseInt(itemEl.getAttribute('data-page-index'), 10);
    const slotIndex = parseInt(itemEl.getAttribute('data-slot-index'), 10);
    if (isNaN(pageIndex) || isNaN(slotIndex)) return;
    if (!desktopData.pages[pageIndex] || !desktopData.pages[pageIndex].slots) return;
    const itemData = desktopData.pages[pageIndex].slots[slotIndex];
    if (!itemData) return;

    isDraggingActive = true;
    window.__momoDragActive = true;
    draggedItemInfo = {
      kind: 'desktop',
      pageIndex: pageIndex,
      slotIndex: slotIndex,
      itemData: itemData,
      sourceEl: itemEl
    };

    if (navigator.vibrate) navigator.vibrate(40);

    const rect = itemEl.getBoundingClientRect();
    dragGhostEl = itemEl.cloneNode(true);
    dragGhostEl.classList.add('grid-drag-ghost');
    dragGhostEl.style.width = rect.width + 'px';
    dragGhostEl.style.height = rect.height + 'px';
    dragGhostEl.style.left = (x - rect.width / 2) + 'px';
    dragGhostEl.style.top = (y - rect.height / 2) + 'px';
    dragGhostEl.style.transform = 'scale(1.12)';
    dragGhostEl.style.transformOrigin = '50% 50%';
    document.body.appendChild(dragGhostEl);
    itemEl.classList.add('grid-item-placeholder');
    document.body.classList.add('desktop-reorder-preview');
    clearDropTarget();
  }

  function updateGhostPosition(x, y) {
    if (!dragGhostEl) return;
    const w = parseFloat(dragGhostEl.style.width) || 68;
    const h = parseFloat(dragGhostEl.style.height) || 68;
    dragGhostEl.style.left = (x - w / 2) + 'px';
    dragGhostEl.style.top = (y - h / 2) + 'px';
  }

  // 边缘翻页控制器与柔和光晕 (基于虚拟手机视口判定，500ms 阈值)
  let edgeFlipTimer = null;
  let lastEdgeDirection = null;
  let isPageFlippingLocked = false;

  function ensureEdgeGlowElements() {
    const root = document.getElementById('phone-screen-root') || document.getElementById('page-home');
    if (!root) return { left: null, right: null };
    let leftGlow = root.querySelector('.desktop-edge-glow-left');
    let rightGlow = root.querySelector('.desktop-edge-glow-right');
    if (!leftGlow) {
      leftGlow = document.createElement('div');
      leftGlow.className = 'desktop-edge-glow desktop-edge-glow-left';
      root.appendChild(leftGlow);
    }
    if (!rightGlow) {
      rightGlow = document.createElement('div');
      rightGlow.className = 'desktop-edge-glow desktop-edge-glow-right';
      root.appendChild(rightGlow);
    }
    return { left: leftGlow, right: rightGlow };
  }

  function setEdgeGlow(direction) {
    const { left, right } = ensureEdgeGlowElements();
    if (left) left.classList.toggle('active', direction === 'left');
    if (right) right.classList.toggle('active', direction === 'right');
  }

  function hideAllEdgeGlow() {
    const { left, right } = ensureEdgeGlowElements();
    if (left) left.classList.remove('active');
    if (right) right.classList.remove('active');
  }

  function checkEdgeFlip(x, y) {
    if (isPageFlippingLocked || !isDraggingActive) {
      clearEdgeFlipTimer();
      hideAllEdgeGlow();
      return;
    }

    const container = document.getElementById('phone-screen-root') || document.getElementById('ios-viewport');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const edgeMargin = 42; // 触达手机边缘 42px 触发区
    let direction = null;

    if (x >= rect.left && x <= rect.left + edgeMargin) {
      direction = 'left';
    } else if (x <= rect.right && x >= rect.right - edgeMargin) {
      direction = 'right';
    }

    if (direction) {
      setEdgeGlow(direction);
      if (lastEdgeDirection !== direction) {
        clearEdgeFlipTimer();
        lastEdgeDirection = direction;
        edgeFlipTimer = setTimeout(() => {
          if (!isDraggingActive || isPageFlippingLocked) return;
          const viewport = document.getElementById('ios-viewport');
          if (!viewport) return;
          const slideWidth = viewport.offsetWidth || rect.width;
          const currentSlide = Math.round(viewport.scrollLeft / slideWidth);

          let targetSlide = currentSlide;
          if (direction === 'left' && currentSlide > 0) {
            targetSlide = currentSlide - 1;
          } else if (direction === 'right' && currentSlide < desktopData.pages.length - 1) {
            targetSlide = currentSlide + 1;
          }

          if (targetSlide !== currentSlide) {
            isPageFlippingLocked = true;
            hideAllEdgeGlow();
            if (typeof window.switchIosSlide === 'function') {
              window.switchIosSlide(targetSlide);
            }
            // 翻页锁保护与坐标实时补偿：350ms 后解锁下一次翻页
            setTimeout(() => {
              isPageFlippingLocked = false;
              if (dragGhostEl && isDraggingActive) {
                updateGhostPosition(lastDragX, lastDragY);
              }
            }, 380);
          }
          lastEdgeDirection = null;
        }, 500);
      }
    } else {
      clearEdgeFlipTimer();
      hideAllEdgeGlow();
    }
  }

  function clearEdgeFlipTimer() {
    if (edgeFlipTimer) {
      clearTimeout(edgeFlipTimer);
      edgeFlipTimer = null;
    }
    lastEdgeDirection = null;
  }
  // 指针落在网格空隙时也要稳定吸附到最近图标，避免跨格移动时反复清空/重建让位预览
  function findNearestDesktopTarget(x, y) {
    const viewport = document.getElementById('ios-viewport');
    const viewportRect = viewport ? viewport.getBoundingClientRect() : null;
    const grids = document.querySelectorAll('#ios-viewport .ios-dynamic-grid');

    let best = null;
    let bestDistance = Infinity;

    for (let gi = 0; gi < grids.length; gi++) {
      const grid = grids[gi];
      const gridRect = grid.getBoundingClientRect();
      if (viewportRect && (gridRect.right <= viewportRect.left + 1 || gridRect.left >= viewportRect.right - 1)) continue;
      if (x < gridRect.left || x > gridRect.right || y < gridRect.top || y > gridRect.bottom) continue;

      const cards = Array.from(grid.querySelectorAll('.grid-drag-item[data-slot-index]'));
      let cellW = 80;
      let cellH = 80;
      if (cards.length) {
        cellW = cards[0].offsetWidth || cellW;
        cellH = cards[0].offsetHeight || cellH;
      }
      const maxDistance = Math.max(cellW * 1.15, cellH * 1.15);

      cards.forEach(function(card) {
        if (!card || card.classList.contains('grid-drag-ghost')) return;
        // 用布局坐标（offsetLeft/offsetTop）而不是 getBoundingClientRect：
        // 让位预览会给卡片加 transform，如果用视觉矩形，指针不动也会吸附到下一格，造成来回闪。
        let offsetX = 0;
        let offsetY = 0;
        let node = card;
        while (node && node !== grid) {
          offsetX += node.offsetLeft || 0;
          offsetY += node.offsetTop || 0;
          node = node.offsetParent;
        }
        if (node !== grid) {
          offsetX = card.offsetLeft || 0;
          offsetY = card.offsetTop || 0;
        }
        const cx = gridRect.left + offsetX + card.offsetWidth / 2;
        const cy = gridRect.top + offsetY + card.offsetHeight / 2;
        const distance = Math.hypot(x - cx, y - cy);
        if (distance > maxDistance || distance >= bestDistance) return;

        const pageIndex = parseInt(card.getAttribute('data-page-index'), 10);
        const slotIndex = parseInt(card.getAttribute('data-slot-index'), 10);
        if (isNaN(pageIndex) || isNaN(slotIndex)) return;
        if (!desktopData.pages[pageIndex] || !desktopData.pages[pageIndex].slots) return;

        bestDistance = distance;
        best = {
          kind: 'desktop',
          pageIndex: pageIndex,
          slotIndex: slotIndex,
          el: card,
          itemData: desktopData.pages[pageIndex].slots[slotIndex] || null
        };
      });
    }
    return best;
  }

  // 悬停超过 400ms 触发金光高亮合并候选；同时驱动 iOS 的“让位”预览
  function resolveDropTarget(x, y) {
    if (dragGhostEl) dragGhostEl.style.display = 'none';
    const hits = document.elementsFromPoint(x, y) || [];
    let dockBar = null;
    let dockEl = null;
    let desktopEl = null;

    for (let el of hits) {
      if (!el || !el.classList) continue;
      if (!dockEl && el.classList.contains('dock-app-item')) dockEl = el;
      if (!dockBar && (el.id === 'home-dock-bar' || el.classList.contains('home-dock-bar'))) dockBar = el;
      if (!desktopEl && el.classList.contains('grid-drag-item') && !el.classList.contains('grid-drag-ghost')) desktopEl = el;
    }

    let target = null;
    if (dockEl || dockBar) {
      if (!dockEl && dockBar) {
        // 指针落在 Dock 空隙时，按横向距离吸附到最近的槽
        const slots = Array.from(dockBar.querySelectorAll('.dock-app-item'));
        let best = null;
        let bestDist = Infinity;
        slots.forEach(function(slot) {
          const r = slot.getBoundingClientRect();
          const d = Math.abs(x - (r.left + r.width / 2));
          if (d < bestDist) { bestDist = d; best = slot; }
        });
        dockEl = best;
      }
      if (dockEl && dockBar && dockBar.contains(dockEl)) {
        const dockIndex = parseInt(dockEl.getAttribute('data-dock-index'), 10);
        if (!isNaN(dockIndex)) target = { kind: 'dock', dockIndex: dockIndex, el: dockEl };
      }
    }

    if (!target && desktopEl) {
      const targetPageIndex = parseInt(desktopEl.getAttribute('data-page-index'), 10);
      const targetSlotIndex = parseInt(desktopEl.getAttribute('data-slot-index'), 10);
      if (!isNaN(targetPageIndex) && !isNaN(targetSlotIndex)) {
        target = {
          kind: 'desktop',
          pageIndex: targetPageIndex,
          slotIndex: targetSlotIndex,
          el: desktopEl,
          itemData: desktopData.pages[targetPageIndex] ? desktopData.pages[targetPageIndex].slots[targetSlotIndex] : null
        };
      }
    }

    // 网格缝隙、图标边缘的留白也吸附最近图标，避免指针跨格时 target 瞬间变空
    if (!target) {
      target = findNearestDesktopTarget(x, y);
    }

    if (dragGhostEl) dragGhostEl.style.display = '';
    return target;
  }

  function dropTargetKey(target) {
    if (!target) return '';
    return target.kind === 'dock'
      ? 'dock:' + target.dockIndex
      : 'desktop:' + target.pageIndex + ':' + target.slotIndex;
  }

  function isSelfDropTarget(target) {
    if (!target || !draggedItemInfo) return false;
    if (target.kind === 'dock') {
      return draggedItemInfo.kind === 'dock' && target.dockIndex === draggedItemInfo.dockIndex;
    }
    return draggedItemInfo.kind === 'desktop' &&
      target.pageIndex === draggedItemInfo.pageIndex &&
      target.slotIndex === draggedItemInfo.slotIndex;
  }

  function setPreviewOffset(card, dx, dy) {
    const next = (dx || dy) ? 'translate3d(' + dx + 'px,' + dy + 'px,0)' : '';
    if (card.__momoPreviewTransform === next) return;
    card.__momoPreviewTransform = next;
    card.style.transition = 'transform 280ms cubic-bezier(.22,.88,.3,1)';
    card.style.transform = next;
    if (next) {
      card.classList.add('reorder-preview-card');
      if (previewCards.indexOf(card) === -1) previewCards.push(card);
    } else {
      card.classList.remove('reorder-preview-card');
    }
  }

  function clearReorderPreview() {
    previewCards.forEach(function(card) {
      card.classList.remove('reorder-preview-card');
      card.style.transition = 'transform 240ms cubic-bezier(.22,.88,.3,1)';
      card.style.transform = '';
      card.__momoPreviewTransform = '';
    });
    previewCards = [];
  }

  function previewDesktopReorder(target) {
    if (!draggedItemInfo || draggedItemInfo.kind !== 'desktop') {
      clearReorderPreview();
      return;
    }
    if (!target || target.kind !== 'desktop' ||
        target.pageIndex !== draggedItemInfo.pageIndex ||
        target.slotIndex === draggedItemInfo.slotIndex ||
        !target.itemData ||
        (target.itemData && target.itemData.type === 'folder')) {
      clearReorderPreview();
      return;
    }

    const grid = document.getElementById('grid-page-' + (target.pageIndex + 1));
    if (!grid) { clearReorderPreview(); return; }
    const cards = Array.from(grid.querySelectorAll('.grid-drag-item[data-slot-index]'));
    if (cards.length < 2) { clearReorderPreview(); return; }

    const firstCard = cards[0];
    const style = window.getComputedStyle(grid);
    const gapX = parseFloat(style.columnGap) || 12;
    const gapY = parseFloat(style.rowGap) || 16;
    const cellW = firstCard.offsetWidth + gapX;
    const cellH = firstCard.offsetHeight + gapY;
    const cols = 4;
    const sourceIndex = draggedItemInfo.slotIndex;
    const targetIndex = target.slotIndex;

    document.body.classList.add('desktop-reorder-preview');

    function cellPos(index) {
      return { x: (index % cols) * cellW, y: Math.floor(index / cols) * cellH };
    }

    // 不重置上一帧的 transform，只更新差值；跨格、跨行时由 CSS transition 连续补间
    cards.forEach(function(card) {
      const idx = parseInt(card.getAttribute('data-slot-index'), 10);
      if (isNaN(idx)) return;
      let shift = 0;
      if (idx !== sourceIndex) {
        if (sourceIndex < targetIndex && idx > sourceIndex && idx <= targetIndex) shift = -1;
        if (sourceIndex > targetIndex && idx >= targetIndex && idx < sourceIndex) shift = 1;
      }
      const from = cellPos(idx);
      const to = shift ? cellPos(idx + shift) : from;
      setPreviewOffset(card, to.x - from.x, to.y - from.y);
    });
  }

  function clearDropTarget() {
    if (currentDropTarget && currentDropTarget.el) {
      currentDropTarget.el.classList.remove('ios-drop-target', 'dock-drop-target');
    }
    currentDropTarget = null;
    clearReorderPreview();
  }

  function updateDragHover(x, y) {
    if (!isDraggingActive || !draggedItemInfo) return;
    lastDragX = x;
    lastDragY = y;
    checkEdgeFlip(x, y);

    const target = resolveDropTarget(x, y);
    if (!target || isSelfDropTarget(target)) {
      clearDropTarget();
      clearCandidate();
      return;
    }

    const key = dropTargetKey(target);
    const currentKey = currentDropTarget ? dropTargetKey(currentDropTarget) : '';
    if (key !== currentKey) {
      // 不调用 clearDropTarget：它会把上一帧的让位 transform 归零，造成“闪一下”
      if (currentDropTarget && currentDropTarget.el) {
        currentDropTarget.el.classList.remove('ios-drop-target', 'dock-drop-target');
      }
      clearCandidate();
      currentDropTarget = target;
      target.el.classList.add(target.kind === 'dock' ? 'dock-drop-target' : 'ios-drop-target');

      if (target.kind === 'desktop') previewDesktopReorder(target);
      else clearReorderPreview();

      // 桌面图标/文件夹悬停 400ms 才进入合并候选
      if (target.kind === 'desktop' && target.itemData && target.itemData.id) {
        mergeHoverTimer = setTimeout(function() {
          if (currentDropTarget && dropTargetKey(currentDropTarget) === key) {
            currentCandidateEl = target.el;
            currentCandidateEl.classList.add('folder-merge-candidate');
          }
        }, 400);
      }
    }
  }

  function clearCandidate() {
    clearTimeout(mergeHoverTimer);
    if (currentCandidateEl) {
      currentCandidateEl.classList.remove('folder-merge-candidate');
      currentCandidateEl = null;
    }
  }

  function ensureSlotLength(page, index) {
    if (!page || !Array.isArray(page.slots)) return;
    while (page.slots.length <= index) page.slots.push(null);
  }

  // iOS 不允许同一个 App 在桌面/Dock 出现两份：搬运前先清掉其它旧位置
  function removeAppEverywhere(appId) {
    if (!appId) return;
    desktopData.pages.forEach(function(page) {
      if (!page || !Array.isArray(page.slots)) return;
      page.slots.forEach(function(item, idx) {
        if (!item) return;
        if (item.id === appId) {
          page.slots[idx] = null;
        } else if (item.type === 'folder' && Array.isArray(item.items)) {
          item.items = item.items.filter(function(child) { return child && child.id !== appId; });
        }
      });
    });
    if (Array.isArray(dockSlots)) {
      dockSlots.forEach(function(item, idx) {
        if (item && item.id === appId) dockSlots[idx] = null;
      });
    }
  }

  function reorderDesktopSamePage(pageIndex, fromIndex, toIndex) {
    const page = desktopData.pages[pageIndex];
    if (!page || !Array.isArray(page.slots)) return false;
    if (fromIndex === toIndex) return false;
    const item = page.slots[fromIndex];
    if (!item) return false;
    page.slots.splice(fromIndex, 1);
    page.slots.splice(toIndex, 0, item);
    return true;
  }

  function mergeIntoFolder(sourceInfo, targetEl, targetPageIndex, targetSlotIndex, targetItem) {
    const sourcePage = desktopData.pages[sourceInfo.pageIndex];
    if (!sourcePage) return false;
    if (targetItem.type === 'folder') {
      targetItem.items = targetItem.items || [];
      targetItem.items.push(sourceInfo.itemData);
    } else {
      const newFolder = {
        id: 'folder-' + Date.now(),
        type: 'folder',
        name: '新建文件夹',
        items: [targetItem, sourceInfo.itemData]
      };
      desktopData.pages[targetPageIndex].slots[targetSlotIndex] = newFolder;
      newFolderSlot = { pageIndex: targetPageIndex, slotIndex: targetSlotIndex, until: Date.now() + 900 };
    }
    if (sourceInfo.kind === 'dock') {
      dockSlots[sourceInfo.dockIndex] = null;
    } else {
      sourcePage.slots[sourceInfo.slotIndex] = null;
    }
    return true;
  }

  function handleDesktopToDesktop(sourceInfo, target) {
    const sourcePage = desktopData.pages[sourceInfo.pageIndex];
    const targetPage = desktopData.pages[target.pageIndex];
    if (!sourcePage || !targetPage) return false;
    ensureSlotLength(sourcePage, sourceInfo.slotIndex);
    ensureSlotLength(targetPage, target.slotIndex);

    const targetItem = targetPage.slots[target.slotIndex] || null;
    const shouldMerge = targetItem && targetItem.id &&
      (target.el.classList.contains('folder-merge-candidate') || currentCandidateEl === target.el);

    if (shouldMerge) {
      removeAppEverywhere(sourceInfo.itemData.id);
      if (targetItem.type !== 'folder' && targetItem.id !== sourceInfo.itemData.id) {
        removeAppEverywhere(targetItem.id);
      }
      return mergeIntoFolder(sourceInfo, target.el, target.pageIndex, target.slotIndex, targetItem);
    }

    if (target.pageIndex === sourceInfo.pageIndex) {
      if (targetItem) {
        return reorderDesktopSamePage(sourceInfo.pageIndex, sourceInfo.slotIndex, target.slotIndex);
      }
      // 同页拖进空槽：直接换位，不能把中间图标整体顺移，否则用户只是填个空也会挤乱后面两排。
      if (!Array.isArray(sourcePage.slots)) return false;
      sourcePage.slots[sourceInfo.slotIndex] = null;
      sourcePage.slots[target.slotIndex] = sourceInfo.itemData;
      return true;
    }

    // 跨页：从来源页移除并闭合空位，再插入目标页；目标页图标整体右移让位。
    // 这样不会像交换那样把目标 App 踢回来源页，也更接近 iOS。
    removeAppEverywhere(sourceInfo.itemData.id);
    if (Array.isArray(sourcePage.slots)) sourcePage.slots.splice(sourceInfo.slotIndex, 1);
    if (!Array.isArray(targetPage.slots)) targetPage.slots = [];
    targetPage.slots.splice(target.slotIndex, 0, sourceInfo.itemData);
    return true;
  }

  function handleDesktopToDock(sourceInfo, dockIndex) {
    if (!sourceInfo.itemData || sourceInfo.itemData.type === 'folder') return false;
    const sourcePage = desktopData.pages[sourceInfo.pageIndex];
    if (!sourcePage || !Array.isArray(sourcePage.slots)) return false;
    const dockItem = dockSlots[dockIndex] || null;
    const sameApp = dockItem && dockItem.id === sourceInfo.itemData.id;
    removeAppEverywhere(sourceInfo.itemData.id);
    if (dockItem && !sameApp) removeAppEverywhere(dockItem.id);
    dockSlots[dockIndex] = sourceInfo.itemData;
    sourcePage.slots[sourceInfo.slotIndex] = sameApp ? null : (dockItem || null);
    return true;
  }

  function handleDockToDesktop(sourceInfo, target) {
    const targetPage = desktopData.pages[target.pageIndex];
    if (!targetPage || !Array.isArray(targetPage.slots)) return false;
    ensureSlotLength(targetPage, target.slotIndex);
    const targetItem = targetPage.slots[target.slotIndex] || null;

    if (targetItem && targetItem.type === 'folder') {
      removeAppEverywhere(sourceInfo.itemData.id);
      targetItem.items = targetItem.items || [];
      targetItem.items.push(sourceInfo.itemData);
      dockSlots[sourceInfo.dockIndex] = null;
      return true;
    }

    const sameApp = targetItem && targetItem.id === sourceInfo.itemData.id;
    removeAppEverywhere(sourceInfo.itemData.id);
    if (targetItem && !sameApp) removeAppEverywhere(targetItem.id);
    targetPage.slots[target.slotIndex] = sourceInfo.itemData;
    dockSlots[sourceInfo.dockIndex] = sameApp ? null : (targetItem || null);
    return true;
  }

  function handleDockToDock(sourceInfo, dockIndex) {
    if (sourceInfo.dockIndex === dockIndex) return false;
    const targetItem = dockSlots[dockIndex] || null;
    const sameApp = targetItem && targetItem.id === sourceInfo.itemData.id;
    removeAppEverywhere(sourceInfo.itemData.id);
    if (targetItem && !sameApp) removeAppEverywhere(targetItem.id);
    dockSlots[dockIndex] = sourceInfo.itemData;
    dockSlots[sourceInfo.dockIndex] = sameApp ? null : (targetItem || null);
    return true;
  }

  function setPendingSettle(target) {
    if (!target) return;
    if (target.kind === 'dock') {
      pendingSettle = { kind: 'dock', dockIndex: target.dockIndex };
    } else {
      pendingSettle = { kind: 'desktop', pageIndex: target.pageIndex, slotIndex: target.slotIndex };
    }
  }

  function applyPendingSettle() {
    if (!pendingSettle) return;
    const settle = pendingSettle;
    pendingSettle = null;
    requestAnimationFrame(function() {
      let el = null;
      if (settle.kind === 'dock') {
        el = document.querySelector('#home-dock-bar .dock-app-item[data-dock-index="' + settle.dockIndex + '"]');
      } else {
        el = document.querySelector('.ios-page-slide[data-page-index="' + settle.pageIndex + '"] .grid-drag-item[data-slot-index="' + settle.slotIndex + '"]');
      }
      if (!el) return;
      el.classList.add('icon-drop-settle');
      setTimeout(function() { el.classList.remove('icon-drop-settle'); }, 420);
    });
  }

  function snapGhostBack() {
    if (!dragGhostEl || !draggedItemInfo || !draggedItemInfo.sourceEl) {
      cleanupGhost();
      return;
    }
    const targetRect = draggedItemInfo.sourceEl.getBoundingClientRect();
    const ghostRect = dragGhostEl.getBoundingClientRect();
    const dx = (targetRect.left + targetRect.width / 2) - (ghostRect.left + ghostRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (ghostRect.top + ghostRect.height / 2);
    dragGhostEl.style.transition = 'transform 260ms cubic-bezier(.2,.9,.25,1), opacity 240ms ease';
    dragGhostEl.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(.86)';
    dragGhostEl.style.opacity = '.35';
    setTimeout(cleanupGhost, 280);
  }

  function finishDropOrMerge(x, y) {
    if (!draggedItemInfo || !draggedItemInfo.itemData) {
      cleanupGhost();
      return;
    }

    // 优先使用最后一次 hover 吸附的目标：松手瞬间图标可能已被让位 transform 移动，
    // 重新按视觉位置解析会把目标跳到下一格。
    const target = (currentDropTarget && Math.hypot(x - lastDragX, y - lastDragY) < 4)
      ? currentDropTarget
      : resolveDropTarget(x, y);
    if (!target || isSelfDropTarget(target)) {
      snapGhostBack();
      return;
    }

    const sourceInfo = draggedItemInfo;
    let changed = false;

    if (target.kind === 'dock') {
      if (sourceInfo.kind === 'dock') changed = handleDockToDock(sourceInfo, target.dockIndex);
      else changed = handleDesktopToDock(sourceInfo, target.dockIndex);
    } else if (sourceInfo.kind === 'dock') {
      changed = handleDockToDesktop(sourceInfo, target);
    } else {
      changed = handleDesktopToDesktop(sourceInfo, target);
    }

    if (!changed) {
      snapGhostBack();
      return;
    }

    saveDesktopStorage();
    saveDockStorage();
    setPendingSettle(target);
    cleanupGhost();
    renderDynamicPages();
  }

  function cleanupGhost() {
    isDraggingActive = false;
    window.__momoDragActive = false;
    window.__momoDragEndedAt = Date.now();
    draggedItemInfo = null;
    clearCandidate();
    clearDropTarget();
    clearEdgeFlipTimer();
    hideAllEdgeGlow();
    document.body.classList.remove('desktop-reorder-preview');
    if (dragGhostEl) {
      dragGhostEl.remove();
      dragGhostEl = null;
    }
    const placeholder = document.querySelector('.grid-item-placeholder');
    if (placeholder) placeholder.classList.remove('grid-item-placeholder');
    const dockPlaceholder = document.querySelector('.dock-item-placeholder');
    if (dockPlaceholder) dockPlaceholder.classList.remove('dock-item-placeholder');
  }

  // ================= Dock 拖拽：从 Dock 拿起可与 Dock/桌面互换 =================
  function bindDockDragEngine(bar) {
    if (bar.__dockDragBound) return;
    bar.__dockDragBound = true;

    bar.addEventListener('pointerdown', function(e) {
      if (e.button !== undefined && e.button !== 0) return;
      const itemEl = e.target.closest('.dock-app-item');
      if (!itemEl || itemEl.classList.contains('dock-empty-slot')) return;
      const dockIndex = parseInt(itemEl.getAttribute('data-dock-index'), 10);
      if (isNaN(dockIndex) || !dockSlots[dockIndex]) return;

      const state = {
        el: itemEl,
        dockIndex: dockIndex,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        hold: false,
        timer: null
      };
      dockGesture = state;

      function begin() {
        if (isDraggingActive || state.hold) return;
        if (!startDockDragging(state.el, dockIndex, state.x, state.y)) return;
        state.hold = true;
      }

      if (!document.body.classList.contains('ios-edit-mode')) {
        state.timer = setTimeout(function() {
          if (typeof window.enterIosEditMode === 'function') window.enterIosEditMode();
          begin();
        }, EDIT_LONG_PRESS_MS);
      } else {
        state.timer = setTimeout(begin, EDIT_HOLD_MS);
      }

      state.move = function(ev) {
        if (state.pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== state.pointerId) return;
        state.x = ev.clientX;
        state.y = ev.clientY;
        if (!state.hold) {
          if (Math.hypot(state.x - state.startX, state.y - state.startY) > 8) clearTimeout(state.timer);
          return;
        }
        if (ev.cancelable) ev.preventDefault();
        updateGhostPosition(state.x, state.y);
        updateDragHover(state.x, state.y);
      };

      state.up = function(ev) {
        if (state.pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== state.pointerId) return;
        clearTimeout(state.timer);
        const didDrag = state.hold;
        if (state.hold) {
          state.hold = false;
          finishDropOrMerge(state.x, state.y);
        }
        // 只有真正拿起/拖动过才屏蔽随后的 click；普通点一下必须让 onclick 正常打开 App
        if (didDrag) {
          state.el.__dragMoved = true;
          setTimeout(function() { state.el.__dragMoved = false; }, 350);
        }
        dockGesture = null;
      };
    });
  }

  function startDockDragging(itemEl, dockIndex, x, y) {
    if (isDraggingActive) return false;
    const itemData = dockSlots[dockIndex];
    if (!itemData) return false;

    isDraggingActive = true;
    window.__momoDragActive = true;
    draggedItemInfo = {
      kind: 'dock',
      dockIndex: dockIndex,
      itemData: itemData,
      sourceEl: itemEl
    };

    if (navigator.vibrate) navigator.vibrate(40);

    const rect = itemEl.getBoundingClientRect();
    dragGhostEl = itemEl.cloneNode(true);
    dragGhostEl.classList.add('grid-drag-ghost', 'dock-drag-ghost');
    dragGhostEl.style.width = rect.width + 'px';
    dragGhostEl.style.height = rect.height + 'px';
    dragGhostEl.style.left = (x - rect.width / 2) + 'px';
    dragGhostEl.style.top = (y - rect.height / 2) + 'px';
    dragGhostEl.style.transform = 'scale(1.16)';
    dragGhostEl.style.transformOrigin = '50% 50%';
    document.body.appendChild(dragGhostEl);
    itemEl.classList.add('dock-item-placeholder');
    clearDropTarget();
    return true;
  }

  if (!window.__momoDockPointerBound) {
    window.__momoDockPointerBound = true;
    window.addEventListener('pointermove', function(e) {
      if (dockGesture && dockGesture.move) dockGesture.move(e);
    }, { passive: false });
    window.addEventListener('pointerup', function(e) {
      if (dockGesture && dockGesture.up) dockGesture.up(e);
    }, { passive: true });
    window.addEventListener('pointercancel', function(e) {
      if (dockGesture && dockGesture.up) dockGesture.up(e);
    }, { passive: true });
  }

  // ================= 相片组件拖拽：在 4 列网格里换格，应用自动 dense 补位 =================
  function bindPhotoWidgetDrag(card, item, pageIndex, wIndex, variant, span) {
    if (card.__photoWidgetDragBound) return;
    card.__photoWidgetDragBound = true;

    card.addEventListener('click', function(e) {
      if (card.__photoDragMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    card.addEventListener('pointerdown', function(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('.ios-delete-badge') || e.target.closest('button')) return;
      if (isDraggingActive || (widgetDragGesture && widgetDragGesture.hold)) return;

      const state = {
        el: card,
        item: item,
        pageIndex: pageIndex,
        startPageIndex: pageIndex,
        wIndex: wIndex,
        variant: variant,
        span: span,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        hold: false,
        moved: false,
        timer: null,
        target: null,
        grid: card.closest('.ios-dynamic-grid'),
        sourceGrid: card.closest('.ios-dynamic-grid'),
        pageTurnDir: 0,
        pageTurnTimer: null,
        pageFlipLocked: false
      };
      widgetDragGesture = state;

      function begin() {
        if (state.hold || isDraggingActive) return;
        if (!startPhotoWidgetDragging(state)) return;
        state.hold = true;
      }

      if (!document.body.classList.contains('ios-edit-mode')) {
        state.timer = setTimeout(function() {
          if (typeof window.enterIosEditMode === 'function') window.enterIosEditMode();
          begin();
        }, EDIT_LONG_PRESS_MS);
      } else {
        state.timer = setTimeout(begin, EDIT_HOLD_MS);
      }

      state.move = function(ev) {
        if (state.pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== state.pointerId) return;
        state.x = ev.clientX;
        state.y = ev.clientY;
        if (!state.hold) {
          if (Math.hypot(state.x - state.startX, state.y - state.startY) > 8) clearTimeout(state.timer);
          return;
        }
        if (ev.cancelable) ev.preventDefault();
        state.moved = true;
        updatePhotoWidgetPageTurn(state);
        updatePhotoWidgetGhost(state.x, state.y);
        updatePhotoWidgetDropTarget(state, state.x, state.y);
      };

      state.up = function(ev) {
        if (state.pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== state.pointerId) return;
        clearTimeout(state.timer);
        clearTimeout(state.pageTurnTimer);
        state.pageTurnTimer = null;
        if (state.hold) {
          state.hold = false;
          finishPhotoWidgetDrag(state);
        }
        widgetDragGesture = null;
      };
    });
  }

  function startPhotoWidgetDragging(state) {
    if (isDraggingActive || !state.grid) return false;
    const rect = state.el.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;

    // 先清掉可能残留的旧替身，避免快速连续拖动时留下半透明图片
    document.querySelectorAll('.photo-widget.widget-drag-ghost').forEach(function(el) {
      el.remove();
    });

    widgetDragGhostEl = state.el.cloneNode(true);
    widgetDragGhostEl.classList.add('grid-drag-ghost', 'widget-drag-ghost');
    widgetDragGhostEl.style.width = rect.width + 'px';
    widgetDragGhostEl.style.height = rect.height + 'px';
    widgetDragGhostEl.style.left = (state.x - rect.width / 2) + 'px';
    widgetDragGhostEl.style.top = (state.y - rect.height / 2) + 'px';
    widgetDragGhostEl.style.transform = 'scale(1.03)';
    widgetDragGhostEl.style.transformOrigin = '50% 50%';
    document.body.appendChild(widgetDragGhostEl);
    state.el.classList.add('widget-item-placeholder');
    document.body.classList.add('desktop-reorder-preview');
    isDraggingActive = true;
    if (navigator.vibrate) navigator.vibrate(35);
    updatePhotoWidgetDropTarget(state, state.x, state.y);
    return true;
  }

  function updatePhotoWidgetGhost(x, y) {
    if (!widgetDragGhostEl) return;
    const w = parseFloat(widgetDragGhostEl.style.width) || 100;
    const h = parseFloat(widgetDragGhostEl.style.height) || 100;
    widgetDragGhostEl.style.left = (x - w / 2) + 'px';
    widgetDragGhostEl.style.top = (y - h / 2) + 'px';
  }

  // 拖到左右边缘停留一会儿就翻到相邻页；翻页后落点重新按新页网格计算。
  function updatePhotoWidgetPageTurn(state) {
    const viewport = document.getElementById('ios-viewport');
    if (!viewport || !state || !state.hold) return;
    if (state.pageFlipLocked) {
      hideAllEdgeGlow();
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const insideVertical = state.y >= viewportRect.top && state.y <= viewportRect.bottom;
    let direction = 0;
    if (insideVertical) {
      if (state.x <= viewportRect.left + WIDGET_PAGE_TURN_EDGE && state.pageIndex > 0) {
        direction = -1;
      } else if (state.x >= viewportRect.right - WIDGET_PAGE_TURN_EDGE &&
                 state.pageIndex < desktopData.pages.length - 1) {
        direction = 1;
      }
    }

    if (direction === state.pageTurnDir) return;
    state.pageTurnDir = direction;
    clearTimeout(state.pageTurnTimer);
    state.pageTurnTimer = null;
    if (!direction) {
      hideAllEdgeGlow();
      return;
    }

    // 进入边缘立刻亮起淡白光，停留够时间再翻页；和 App 跨页保持同一套反馈。
    setEdgeGlow(direction === -1 ? 'left' : 'right');
    state.pageTurnTimer = setTimeout(function() {
      switchPhotoWidgetPage(state, direction);
    }, WIDGET_PAGE_TURN_MS);
  }

  function switchPhotoWidgetPage(state, direction) {
    if (!state || !state.hold) return;
    const nextPageIndex = state.pageIndex + direction;
    if (nextPageIndex < 0 || nextPageIndex >= desktopData.pages.length) {
      state.pageTurnDir = 0;
      state.pageTurnTimer = null;
      hideAllEdgeGlow();
      return;
    }

    state.pageTurnDir = 0;
    state.pageTurnTimer = null;
    state.pageFlipLocked = true;
    state.pageIndex = nextPageIndex;
    hideAllEdgeGlow();
    if (typeof window.switchIosSlide === 'function') {
      window.switchIosSlide(nextPageIndex);
    }
    state.grid = document.getElementById('grid-page-' + (nextPageIndex + 1));
    state.target = null;

    if (widgetDropCellEl) {
      widgetDropCellEl.remove();
      widgetDropCellEl = null;
    }
    if (navigator.vibrate) navigator.vibrate(15);
    updatePhotoWidgetDropTarget(state, state.x, state.y);

    // 平滑翻页期间先锁住下一次翻页，等页面落稳后再重新接受边缘停留。
    setTimeout(function() {
      state.pageFlipLocked = false;
      if (state.hold) updatePhotoWidgetDropTarget(state, state.x, state.y);
    }, 380);
  }

  function updatePhotoWidgetDropTarget(state, x, y) {
    if (!state.grid) return;
    const gridRect = state.grid.getBoundingClientRect();
    const style = getComputedStyle(state.grid);
    const gapX = parseFloat(style.columnGap) || 12;
    const gapY = parseFloat(style.rowGap) || 16;
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const padTop = parseFloat(style.paddingTop) || 0;
    const usableWidth = state.grid.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const colW = (usableWidth - gapX * 3) / 4;
    if (colW <= 0) return;

    // 翻页动画期间目标页还在横向滑动，不能直接用它的视觉位置算落点；
    // 用目标页相对自身 slide 的布局偏移，提前换算出落稳后的网格原点。
    let gridLeft = gridRect.left;
    let gridTop = gridRect.top;
    const viewport = document.getElementById('ios-viewport');
    const slide = state.grid.closest('.ios-page-slide');
    if (viewport && slide) {
      const viewportRect = viewport.getBoundingClientRect();
      const slideRect = slide.getBoundingClientRect();
      const pageWidth = viewport.clientWidth || 1;
      const settledLeft = state.pageIndex * pageWidth;
      const settled = Math.abs(viewport.scrollLeft - settledLeft) <= 2;
      if (!settled) {
        gridLeft = viewportRect.left + (gridRect.left - slideRect.left);
        gridTop = viewportRect.top + (gridRect.top - slideRect.top);
      }
    }

    const sample = state.grid.querySelector('.grid-drag-item.item-span-1x1:not(.empty-slot-placeholder)') ||
      state.grid.querySelector('.grid-drag-item.item-span-1x1');
    const rowH = sample ? sample.getBoundingClientRect().height : 83;
    if (rowH <= 0) return;

    const widgetW = colW * state.span.cols + gapX * (state.span.cols - 1);
    const widgetH = rowH * state.span.rows + gapY * (state.span.rows - 1);
    const maxCol = 5 - state.span.cols;
    const rawCol = Math.round((x - gridLeft - padLeft - widgetW / 2) / (colW + gapX)) + 1;
    const rawRow = Math.round((y - gridTop - padTop - widgetH / 2) / (rowH + gapY)) + 1;
    const col = Math.min(maxCol, Math.max(1, rawCol));
    const row = Math.max(1, rawRow);
    state.target = { col: col, row: row };

    if (!widgetDropCellEl) {
      widgetDropCellEl = document.createElement('div');
      widgetDropCellEl.className = 'widget-drop-cell';
      state.grid.appendChild(widgetDropCellEl);
    }
    widgetDropCellEl.style.left = (padLeft + (col - 1) * (colW + gapX)) + 'px';
    widgetDropCellEl.style.top = (padTop + (row - 1) * (rowH + gapY)) + 'px';
    widgetDropCellEl.style.width = widgetW + 'px';
    widgetDropCellEl.style.height = widgetH + 'px';
  }

  function clearPhotoWidgetDragVisuals() {
    if (widgetDragGhostEl) {
      widgetDragGhostEl.remove();
      widgetDragGhostEl = null;
    }
    // 兜底清掉所有相片组件替身，避免某次抬手事件没走到 finish 时留下“浮空图片”
    document.querySelectorAll('.photo-widget.widget-drag-ghost').forEach(function(el) {
      el.remove();
    });
    if (widgetDropCellEl) {
      widgetDropCellEl.remove();
      widgetDropCellEl = null;
    }
    document.querySelectorAll('.photo-widget.widget-item-placeholder').forEach(function(el) {
      el.classList.remove('widget-item-placeholder');
    });
    hideAllEdgeGlow();
    document.body.classList.remove('desktop-reorder-preview');
    isDraggingActive = false;
  }

  // 松手重排后让 App 和相片组件从旧位置滑到新位置，避免直接闪现
  function captureGridAppRects(grid, excludeWidgetId) {
    const rects = {};
    if (!grid) return rects;
    grid.querySelectorAll('.grid-drag-item[data-slot-index]').forEach(function(el) {
      if (el.classList.contains('empty-slot-placeholder')) return;
      const idx = el.getAttribute('data-slot-index');
      if (!idx) return;
      const rect = el.getBoundingClientRect();
      rects['slot:' + idx] = { left: rect.left, top: rect.top };
    });
    grid.querySelectorAll('.photo-widget[data-photo-widget-id]').forEach(function(el) {
      const wid = el.getAttribute('data-photo-widget-id');
      if (!wid || wid === excludeWidgetId) return;
      const rect = el.getBoundingClientRect();
      rects['photo:' + wid] = { left: rect.left, top: rect.top };
    });
    return rects;
  }

  function animateReflowElement(el, oldRect) {
    if (!oldRect) return;
    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    if (el.__reflowAnim && el.__reflowAnim.cancel) el.__reflowAnim.cancel();
    const anim = el.animate(
      [
        { transform: 'translate(' + dx + 'px, ' + dy + 'px)' },
        { transform: 'translate(0, 0)' }
      ],
      {
        duration: 250,
        easing: 'cubic-bezier(.22,.78,.2,1)',
        fill: 'both'
      }
    );
    el.__reflowAnim = anim;
    anim.onfinish = function() {
      el.__reflowAnim = null;
      if (anim.cancel) anim.cancel();
    };
  }

  function animateGridReflow(pageIndex, oldRects, excludeWidgetId) {
    const grid = document.getElementById('grid-page-' + (pageIndex + 1));
    if (!grid || !oldRects) return;
    grid.querySelectorAll('.grid-drag-item[data-slot-index]').forEach(function(el) {
      if (el.classList.contains('empty-slot-placeholder')) return;
      const idx = el.getAttribute('data-slot-index');
      animateReflowElement(el, idx ? oldRects['slot:' + idx] : null);
    });
    grid.querySelectorAll('.photo-widget[data-photo-widget-id]').forEach(function(el) {
      const wid = el.getAttribute('data-photo-widget-id');
      if (!wid || wid === excludeWidgetId) return;
      animateReflowElement(el, oldRects['photo:' + wid]);
    });
  }

  function finishPhotoWidgetDrag(state) {
    const target = state.target;
    const moved = state.moved;
    clearTimeout(state.pageTurnTimer);
    state.pageTurnTimer = null;
    hideAllEdgeGlow();
    const sourcePageIndex = state.startPageIndex;
    const targetPageIndex = state.pageIndex;
    const sourcePage = desktopData.pages[sourcePageIndex];
    const targetPage = desktopData.pages[targetPageIndex];
    const oldSourceRects = captureGridAppRects(state.sourceGrid, state.item.id);
    const oldTargetRects = targetPageIndex !== sourcePageIndex
      ? captureGridAppRects(state.grid, state.item.id)
      : oldSourceRects;

    clearPhotoWidgetDragVisuals();

    if (moved && target) {
      state.item.gridPos = { col: target.col, row: target.row };

      // 跨页时先把组件从来源页的 widgets 里摘掉，再放进目标页；
      // 同页拖动只更新 gridPos，不移动数据。
      if (targetPageIndex !== sourcePageIndex && sourcePage && targetPage) {
        const sourceWidgets = Array.isArray(sourcePage.widgets) ? sourcePage.widgets : [];
        let sourceIndex = sourceWidgets.findIndex(function(w) { return w === state.item; });
        if (sourceIndex < 0) {
          sourceIndex = sourceWidgets.findIndex(function(w) {
            return w && w.id === state.item.id;
          });
        }
        if (sourceIndex >= 0) sourceWidgets.splice(sourceIndex, 1);
        if (!Array.isArray(targetPage.widgets)) targetPage.widgets = [];
        targetPage.widgets.push(state.item);
      }

      window.__momoWidgetDragEndedAt = Date.now();
      window.__momoPhotoClickGuard = true;
      window.__momoPhotoClickGuardAt = Date.now();
      setTimeout(function() {
        if (window.__momoPhotoClickGuard &&
            Date.now() - window.__momoPhotoClickGuardAt >= 600) {
          window.__momoPhotoClickGuard = false;
        }
      }, 700);
      saveDesktopStorage();
      renderDynamicPages();
      // renderDynamicPages 会重建整个 viewport，重渲染后把视图锁回目标页，
      // 避免跨页松手后画面跳回第一页。
      if (typeof window.switchIosSlide === 'function') {
        window.switchIosSlide(targetPageIndex, 'auto');
      }
      if (typeof window.updateDesktopEditToolbar === 'function') {
        window.updateDesktopEditToolbar();
      }
      animateGridReflow(sourcePageIndex, oldSourceRects, state.item.id);
      if (targetPageIndex !== sourcePageIndex) {
        animateGridReflow(targetPageIndex, oldTargetRects, state.item.id);
      }
    }
  }

  function cancelPhotoWidgetDrag() {
    if (!widgetDragGesture || !widgetDragGesture.hold) return;
    clearTimeout(widgetDragGesture.pageTurnTimer);
    widgetDragGesture.pageTurnTimer = null;
    widgetDragGesture.hold = false;
    widgetDragGesture = null;
    clearPhotoWidgetDragVisuals();
  }

  if (!window.__momoPhotoWidgetPointerBound) {
    window.__momoPhotoWidgetPointerBound = true;

    // 阻止浏览器把相片组件里的 <img> 当成原生图片拖拽，否则会拖出一张方形原图而不是组件
    document.addEventListener('dragstart', function(e) {
      if (e.target && e.target.closest && e.target.closest('.photo-widget')) {
        e.preventDefault();
      }
    }, true);

    window.addEventListener('pointermove', function(e) {
      if (widgetDragGesture && widgetDragGesture.move) widgetDragGesture.move(e);
    }, { passive: false });
    window.addEventListener('pointerup', function(e) {
      if (widgetDragGesture && widgetDragGesture.up) widgetDragGesture.up(e);
    }, { passive: true });
    window.addEventListener('pointercancel', function(e) {
      if (widgetDragGesture && widgetDragGesture.up) widgetDragGesture.up(e);
    }, { passive: true });
    window.addEventListener('blur', cancelPhotoWidgetDrag);
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) cancelPhotoWidgetDrag();
    });
    document.addEventListener('pointerdown', function() {
      // 拖拽抬手后会补一个 click，它没有新的 pointerdown；
      // 只要用户再次按下鼠标/手指，就说明是新操作，立刻解除保护。
      if (window.__momoPhotoClickGuard) window.__momoPhotoClickGuard = false;
    }, true);
    document.addEventListener('click', function(e) {
      if (!window.__momoPhotoClickGuard) return;
      if (Date.now() - window.__momoPhotoClickGuardAt > 500) {
        window.__momoPhotoClickGuard = false;
        return;
      }
      // 只吞桌面网格里因拖拽抬手补出的那一下；Dock、顶栏「完成」永远放行
      if (!e.target.closest || !e.target.closest('.ios-dynamic-grid')) {
        window.__momoPhotoClickGuard = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      window.__momoPhotoClickGuard = false;
    }, true);
  }

  // 启动渲染

  // ================= 检查某应用是否已在桌面 (支持文件夹内嵌套) =================
  window.isAppInstalled = function(appId) {
    if (!desktopData || !Array.isArray(desktopData.pages)) return false;
    if (Array.isArray(dockSlots) && dockSlots.some(function(item) {
      return item && item.id === appId;
    })) return true;
    for (let p of desktopData.pages) {
      if (Array.isArray(p.slots)) {
        for (let item of p.slots) {
          if (!item) continue;
          if (item.id === appId) return true;
          if (item.type === 'folder' && Array.isArray(item.items)) {
            if (item.items.some(sub => sub && sub.id === appId)) return true;
          }
        }
      }
    }
    return false;
  };

  // ================= 从桌面彻底卸载某应用 (清空槽位为 null，保留空位) =================
  window.uninstallAppFromDesktop = function(appId, silent) {
    if (!appId) return;
    const appMeta = APP_STORE_REGISTRY[appId];
    const name = appMeta ? appMeta.name : '该应用';
    if (!silent) {
      if (!confirm('确定从桌面卸载「' + name + '」吗？卸载后可随时在应用商店中重新获取。')) return;
    }

    let uninstalled = false;
    for (let p of desktopData.pages) {
      if (Array.isArray(p.slots)) {
        for (let i = 0; i < p.slots.length; i++) {
          const item = p.slots[i];
          if (!item) continue;
          if (item.id === appId) {
            p.slots[i] = null;
            uninstalled = true;
            break;
          }
          if (item.type === 'folder' && Array.isArray(item.items)) {
            const fIdx = item.items.findIndex(sub => sub && sub.id === appId);
            if (fIdx !== -1) {
              item.items.splice(fIdx, 1);
              if (item.items.length <= 1) {
                p.slots[i] = item.items[0] || null;
              }
              uninstalled = true;
              break;
            }
          }
        }
      }
      if (uninstalled) break;
    }

    if (Array.isArray(dockSlots)) {
      for (let i = 0; i < dockSlots.length; i++) {
        if (dockSlots[i] && dockSlots[i].id === appId) {
          dockSlots[i] = null;
          uninstalled = true;
        }
      }
    }

    if (uninstalled) {
      saveDesktopStorage();
      saveDockStorage();
      renderDynamicPages();
      if (typeof window.renderAppStore === 'function') {
        window.renderAppStore();
      }
    }
  };

  // ================= 商店内一键安装 =================
  window.handleStoreInstall = function(appId) {
    const appItem = APP_STORE_REGISTRY[appId];
    if (!appItem) return;
    if (window.isAppInstalled(appId)) {
      if (appItem.page) openPage(appItem.page);
      else if (appItem.action && typeof window[appItem.action] === 'function') window[appItem.action]();
      return;
    }

    window.installAppToDesktop(appItem);
    if (typeof window.renderAppStore === 'function') {
      window.renderAppStore();
    }
    setTimeout(() => {
      alert('✨「' + appItem.name + '」已成功安装到桌面！');
    }, 50);
  };

  // ================= 渲染应用商店列表 =================
  let currentStoreCategory = 'all';

  window.switchAppStoreCategory = function(cat, el) {
    currentStoreCategory = cat;
    const tabs = document.querySelectorAll('.app-store-cat-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    renderAppStore();
  };

  window.renderAppStore = function() {
    const listEl = document.getElementById('app-store-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const allApps = Object.values(APP_STORE_REGISTRY);
    const filtered = allApps.filter(a => {
      if (currentStoreCategory === 'all') return true;
      return a.category === currentStoreCategory;
    });

    filtered.forEach(app => {
      const installed = window.isAppInstalled(app.id);
      const card = document.createElement('div');
      card.className = 'app-store-card';
      card.innerHTML = `
        <div class="app-store-card-left" onclick="handleStoreAppDetail('${app.id}')">
          <div class="app-store-card-icon" style="background: ${app.bg || 'rgba(255,255,255,0.1)'};">${app.icon || '📱'}</div>
          <div class="app-store-card-info">
            <div class="app-store-card-name">${app.name}</div>
            <div class="app-store-card-category">${app.categoryName || '应用'}</div>
            <div class="app-store-card-desc">${app.desc || '小手机原生扩展'}</div>
          </div>
        </div>
        <div class="app-store-btn-group">
          ${installed ? `
            <button class="app-store-action-btn open" onclick="handleStoreInstall('${app.id}')">打开</button>
            <button class="app-store-action-btn uninstall" onclick="uninstallAppFromDesktop('${app.id}')" title="卸载应用">卸载</button>
          ` : `
            <button class="app-store-action-btn get" onclick="handleStoreInstall('${app.id}')">获取</button>
          `}
        </div>
      `;
      listEl.appendChild(card);
    });
  };

  window.handleStoreAppDetail = function(appId) {
    const app = APP_STORE_REGISTRY[appId];
    if (!app) return;
    const installed = window.isAppInstalled(appId);
    if (installed) {
      if (app.page) openPage(app.page);
      else if (app.action && typeof window[app.action] === 'function') window[app.action]();
    }
  };

  // 供新版 App Store 页读取
  window.MOMO_APP_REGISTRY = APP_STORE_REGISTRY;
  window.momoDeskIconSvg = deskIconSvg;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (window.momoOverflowReady) await window.momoOverflowReady;
    } catch (e) {}
    window.renderDynamicPages();
    try { window.loadWidgetArtStorage && window.loadWidgetArtStorage(); } catch (e) {}
  });
  } else {
    window.renderDynamicPages();
    try { window.loadWidgetArtStorage && window.loadWidgetArtStorage(); } catch (e) {}
  }
})();

/* ===== 修复（2026-11-19）：桌面卡片头像靠别处代码填 src，执行顺序一变就空白。
   这里在卡片生成时直接取存档值，并在回到前台/重新载入后再兜底补一次。 ===== */
(function () {
  function refillHeroAvatar() {
    try {
      var el = document.getElementById('hero-avatar-img');
      if (!el) return;
      var cur = el.getAttribute('src') || '';
      if (cur) return;
      var av = (window.appData && window.appData.heroAvatar) || localStorage.getItem('momo_hero_avatar') || '';
      if (av) el.setAttribute('src', av);
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') setTimeout(refillHeroAvatar, 80);
  });
  window.addEventListener('pageshow', function () { setTimeout(refillHeroAvatar, 80); });
})();