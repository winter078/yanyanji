// 全局数据中心、LocalStorage 存储与备份管理

let appData = null;

// localStorage 只有约 5MB；备份里的壁纸、小组件画布、朋友圈封面等 Base64 很容易超限。
// 超出的键自动转入 IndexedDB（MomoOverflowDB），并在内存缓存里保留同步读值。
// 这样刷新、关闭标签页后再打开都能恢复，不再依赖 sessionStorage 的容量和标签页生命周期。
    const MOMO_OVERFLOW_DB_NAME = 'MomoOverflowDB';
    window.momoOverflowCache = {};

    (function installMomoStorageOverflowPatch() {
      const PREFIX = '__momo_ls_overflow__:';
      const nativeGetItem = Storage.prototype.getItem;
      const nativeSetItem = Storage.prototype.setItem;
      const nativeRemoveItem = Storage.prototype.removeItem;
      const nativeClear = Storage.prototype.clear;

      function isLocalStorage(storage) {
        return storage === window.localStorage;
      }

      Storage.prototype.getItem = function(key) {
        // 溢出值才是最近一次成功写入的内容；原生 localStorage 里可能还留着更早的旧值。
        if (isLocalStorage(this) && Object.prototype.hasOwnProperty.call(window.momoOverflowCache, key)) {
          return window.momoOverflowCache[key];
        }
        const value = nativeGetItem.call(this, key);
        if (value === null && isLocalStorage(this)) {
          try { return window.sessionStorage.getItem(PREFIX + key); } catch (e) { return null; }
        }
        return value;
      };

      Storage.prototype.setItem = function(key, value) {
        try {
          const result = nativeSetItem.call(this, key, value);
          // 溢出库还没读完时，先只写原生这一份，绝不能删掉 IndexedDB 里更新的副本：
          // 否则刷新刚开始时某个模块用旧值回写一次，就会把最新记录永久抹掉。
          if (isLocalStorage(this) && window.__momoOverflowHydrated !== true) {
            return result;
          }
          // 这次原生写入成功了，清掉同名的旧溢出副本，避免下次读到旧内容。
          if (isLocalStorage(this) && Object.prototype.hasOwnProperty.call(window.momoOverflowCache, key)) {
            delete window.momoOverflowCache[key];
            try { window.sessionStorage.removeItem(PREFIX + String(key)); } catch (e) {}
            try { momoDeleteOverflowValue(key); } catch (e) {}
          }
          return result;
        } catch (err) {
          if (isLocalStorage(this)) {
            const text = String(value);
            window.momoOverflowCache[key] = text;
            try { momoWriteOverflowValue(key, text); } catch (e) {}
            try { window.sessionStorage.setItem(PREFIX + String(key), text); } catch (e) {}
            return;
          }
          throw err;
        }
      };

      Storage.prototype.removeItem = function(key) {
        nativeRemoveItem.call(this, key);
        if (isLocalStorage(this)) {
          delete window.momoOverflowCache[key];
          try { window.sessionStorage.removeItem(PREFIX + key); } catch (e) {}
          try { momoDeleteOverflowValue(key); } catch (e) {}
        }
      };

      Storage.prototype.clear = function() {
        nativeClear.call(this);
        if (isLocalStorage(this)) {
          window.momoOverflowCache = {};
          try {
            for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
              const key = window.sessionStorage.key(i);
              if (key && key.indexOf(PREFIX) === 0) window.sessionStorage.removeItem(key);
            }
          } catch (e) {}
          try { momoClearOverflowDB(); } catch (e) {}
        }
      };

      window.momoStorageOverflowPrefix = PREFIX;
      window.momoNativeLocalStorageSetItem = nativeSetItem;
      window.momoNativeLocalStorageClear = nativeClear;
      window.momoGetStorageOverflowKeys = function() {
        const keys = Object.keys(window.momoOverflowCache || {});
        try {
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key && key.indexOf(PREFIX) === 0) {
              const plainKey = key.slice(PREFIX.length);
              if (keys.indexOf(plainKey) === -1) keys.push(plainKey);
            }
          }
        } catch (e) {}
        return keys;
      };
    })();

    function momoOpenOverflowDB() {
      return new Promise(function(resolve, reject) {
        if (!window.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
        const req = indexedDB.open(MOMO_OVERFLOW_DB_NAME, 1);
        req.onupgradeneeded = function() {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
        };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error || new Error('打开溢出存储失败')); };
        req.onblocked = function() { reject(new Error('溢出存储被占用')); };
      });
    }

    function momoReadAllOverflowValues() {
      return momoOpenOverflowDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          const tx = db.transaction('kv', 'readonly');
          const req = tx.objectStore('kv').getAll();
          req.onsuccess = function() { db.close(); resolve(req.result || []); };
          req.onerror = function() { db.close(); reject(req.error || new Error('读取溢出存储失败')); };
        });
      });
    }

    function momoWriteOverflowValue(key, value) {
      return momoOpenOverflowDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ key: key, value: String(value) });
          tx.oncomplete = function() { db.close(); resolve(); };
          tx.onerror = function() { db.close(); reject(tx.error || new Error('写入溢出存储失败')); };
          tx.onabort = function() { db.close(); reject(tx.error || new Error('写入溢出存储被中止')); };
        });
      });
    }

    function momoDeleteOverflowValue(key) {
      return momoOpenOverflowDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').delete(key);
          tx.oncomplete = function() { db.close(); resolve(); };
          tx.onerror = function() { db.close(); reject(tx.error || new Error('删除溢出存储失败')); };
        });
      });
    }

    function momoClearOverflowDB() {
      return momoOpenOverflowDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').clear();
          tx.oncomplete = function() { db.close(); resolve(); };
          tx.onerror = function() { db.close(); reject(tx.error || new Error('清空溢出存储失败')); };
        });
      });
    }

    window.momoOverflowReady = momoReadAllOverflowValues().then(function(rows) {
      rows.forEach(function(row) {
        if (row && typeof row.key === 'string') window.momoOverflowCache[row.key] = String(row.value);
      });
      window.__momoOverflowHydrated = true;
    }).catch(function() {
      window.__momoOverflowHydrated = true;
    });

    // 智能无缝合并新版人机恋世界书（若用户本地缺失则自动增量补全，绝不冲刷用户自定义内容）
    (function syncAdaptedWorldBooks() {
      try {
        const defaultBooks = [];
        let local = [];
        try { local = JSON.parse(localStorage.getItem('momo_world_books') || '[]'); } catch(e){}
        let updated = false;
        const languageBook = {"id":"book_language_norm","title":"语言规范与随性呼吸律","desc":"微信真实长短落差、反机械对称、生活化接招与标点自由最高法则","color":"#10b981","scope":"all","recipients":["*"],"entries":[{"id":"entry_visual_contrast","constant":true,"title":"微信长短大落差与标点随性律","content":"【最高执行铁律 · 微信打字大落差与标点随性】：\n1. 绝对禁止等长切片！严禁连续发送多条 6~9 字的匀称气泡（如禁止：心跳正常/信号满格/随叫随到 这种流水线排比）。\n2. 视觉大落差原则（必须有大起大落）：\n   - 极短气泡（2~4字）：如“嗯？”、“不过”、“行吧”、“？”、“等等”，像随手甩出的小反应；\n   - 饱满长气泡（20~30字，带逗号）：必须有充满生活细节、符合角色关系的长句（如：“这雨说下就下，伞也不带，等会儿别真淋透了才想起来找我”）；\n   - 中等短句：顺茬调侃接话。\n3. 标点彻底自由随性：想用逗号就用，想用问号就用，想不带标点直接回车就直接发，严禁一个状态持续到底。"},{"id":"entry_anti_robot_test","constant":true,"title":"生活化接招与反打工人机械回应","content":"【绝对禁止客服测试腔 · 自然生活化反应】：\n1. 不要把用户的话当成系统调试！哪怕用户只发了单个词“test”、“在吗”、“1”、“。”，也绝对禁止回复“收到/信号满格/最高优先级插队/样式接口有问题你随时指挥/江总工请过目”这种死板打工腔！\n2. 遇到简短词或测试词时的正确反应：\n   - 按角色本人的性格自然接一句，不要套固定暧昧模板。\n3. 永远按当前角色卡的身份、关系和分寸回应，不要客服腔，也不要把所有角色都演成同一个人。"}]};
        const existsLang = local.some(b => b.id === languageBook.id || b.title === languageBook.title);
        if (!existsLang) {
          local.unshift(languageBook); // 放在最前面，最高优先级生效！
          updated = true;
        } else {
          // 旧版语言书里写死了“人夫周绪言”，已装过旧版的环境也要就地清理。
          const langIdx = local.findIndex(b => b.id === languageBook.id || b.title === languageBook.title);
          const anti = (local[langIdx] && local[langIdx].entries || []).find(e => e.id === 'entry_anti_robot_test');
          if (anti && /周绪言|人夫|真实男友|阿贝贝|宠溺拉扯|越旧越安心/.test(String(anti.content || ''))) {
            const fresh = (languageBook.entries || []).find(e => e.id === anti.id);
            if (fresh) { anti.content = fresh.content; updated = true; }
          }
        }
        
        defaultBooks.forEach(defBook => {
          const idx = local.findIndex(b => b.id === defBook.id || b.title === defBook.title);
          if (idx !== -1) {
            // 如果是关系姿态或情绪深度新书，始终保持最新定义
            if (defBook.id === 'book_relation_posture' || defBook.id === 'book_infp_emotional_depth' || defBook.id === 'book_xuyan_coquetry') {
              local[idx] = defBook;
              updated = true;
            }
          } else {
            local.push(defBook);
            updated = true;
          }
        });

        if (updated) {
          localStorage.setItem('momo_world_books', JSON.stringify(local));
          if (appData) appData.worldBooks = local;
        }
      } catch(e){}
    })();

    // 微博 App 已整套下架：顺手清掉它遗留的本地缓存，避免旧数据继续占位
    (function clearRemovedWeiboCache() {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.indexOf('momo_weibo_') === 0) {
            localStorage.removeItem(key);
          }
        }
      } catch(e){}
    })();

    appData = {

      apiBase: localStorage.getItem('momo_api_base') || 'https://api.deepseek.com/v1',
      apiKey: localStorage.getItem('momo_api_key') || '',
      model: localStorage.getItem('momo_api_model') || 'deepseek-chat',
      userNickname: (function(){
        var n = localStorage.getItem('momo_user_nick');
        return n || 'user';
      })(),
      visionModel: localStorage.getItem('momo_api_vision_model') || '',
      readerModel: localStorage.getItem('momo_api_reader_model') || '',
      hero: (function(){
        let raw = null;
        try { raw = JSON.parse(localStorage.getItem('momo_hero_data') || 'null'); } catch (e) { raw = null; }
        return (typeof normalizeHeroData === 'function') ? normalizeHeroData(raw) : (raw || {});
      })(),
      botAvatar: localStorage.getItem('momo_bot_avatar') || '',
      botRemark: localStorage.getItem('momo_bot_remark') || '角色',
      chatSettings: JSON.parse(localStorage.getItem('momo_chat_settings') || JSON.stringify({
        minEnabled: true,
        minCount: 10,
        maxEnabled: true,
        maxCount: 15,
        singleBubble: false,
        enableActionDesc: true,
        actionDescPerson: 'third',
        actionDescLength: 'medium',
        actionDescWriting: '',
        actionDescContinuePlot: false,
        actionDescOffline: false,
        enableCallActionDesc: true,
        callActionDescPerson: 'third',
        callActionDescLength: 'medium',
        callActionDescWriting: '',
        callActionDescContinuePlot: false
      })),
      storySettings: JSON.parse(localStorage.getItem('momo_story_settings') || JSON.stringify({
        pov: "style-driven",
        style: "novel",
        timeFlow: "realtime",
        minWords: 300,
        maxWords: 800,
        enableCot: true,
        autoSummary: true,
        streamOutput: true,
        charId: ''
      })),
      charPrompt: localStorage.getItem('momo_char_prompt_text') || DEFAULT_CHAR_PROMPT,
      userInfo: localStorage.getItem('momo_user_info_text') || DEFAULT_USER_INFO,
      rpConfig: JSON.parse(localStorage.getItem('momo_rp_config') || JSON.stringify(DEFAULT_RP_CONFIG)),
      rpHistory: JSON.parse(localStorage.getItem('momo_rp_history') || '[]'),
      globalBg: localStorage.getItem('momo_global_bg') || localStorage.getItem('momo_bg_url') || '',
      chatBg: localStorage.getItem('momo_chat_bg') || '',
      chatDim: localStorage.getItem('momo_chat_dim') || '58',
      heroBanner: localStorage.getItem('momo_hero_banner') || '',
      heroAvatar: localStorage.getItem('momo_hero_avatar') || '',
      artSquare: localStorage.getItem('momo_art_square') || '',
      stickers: JSON.parse(localStorage.getItem('momo_stickers') || JSON.stringify(DEFAULT_STICKERS)),
      worldBooks: JSON.parse(localStorage.getItem('momo_world_books') || '[]'),
      worldEntries: JSON.parse(localStorage.getItem('momo_world_entries') || '[]'),
      palaceMemories: JSON.parse(localStorage.getItem('momo_palace_memories') || '[]'),
      chatHistory: JSON.parse(localStorage.getItem('momo_chat_history') || '[]')
    };


    



    // 【我】人设应用数据与同步
    function openMeProfile() {
      openPage('page-me');
      syncMeProfileUI();
      syncStorySettingsUI();
    }

    function syncMeProfileUI() {
      const h = appData.hero;
      document.getElementById('me-name-input').value = h.userName || 'user';
      document.getElementById('me-nick-input').value = appData.userNickname || 'user';
      document.getElementById('me-handle-input').value = h.userHandle || '@紫毛爱妻';
      document.getElementById('me-tag-input').value = h.userTag || '妻紫';
      document.getElementById('me-loc-input').value = h.locationText || '厦门 · ずっと頑張ってきたね、';

      document.getElementById('me-appearance-input').value = localStorage.getItem('momo_my_appearance') || '（未填写外貌）';
      document.getElementById('me-habits-input').value = appData.userInfo || DEFAULT_USER_INFO;

      const birthdayInput = document.getElementById('me-birthday-input');
      const birthdayCalendar = document.getElementById('me-birthday-calendar');
      if (birthdayInput) {
        const b = (typeof readUserBirthday === 'function') ? readUserBirthday() : null;
        birthdayInput.value = b ? (b.month + '-' + b.day) : '';
        if (birthdayCalendar) birthdayCalendar.value = b ? b.calendar : 'solar';
      }

      document.getElementById('me-page-name-title').innerText = h.userName || 'user';
      document.getElementById('me-page-handle-title').innerText = h.userHandle || '@紫毛爱妻';

      const prev = document.getElementById('me-page-avatar-preview');
      if (appData.heroAvatar) {
        prev.src = appData.heroAvatar;
      } else {
        prev.src = "https://api.dicebear.com/7.x/adventurer/svg?seed=Momo";
      }
    }

    function saveMeProfile() {
      if (!appData.hero) appData.hero = normalizeHeroData(null);
      appData.hero.userName = document.getElementById('me-name-input').value.trim() || 'user';
      appData.userNickname = document.getElementById('me-nick-input').value.trim() || 'user';
      appData.hero.userHandle = document.getElementById('me-handle-input').value.trim() || '@紫毛爱妻';
      appData.hero.userTag = document.getElementById('me-tag-input').value.trim() || '妻紫';
      appData.hero.locationText = document.getElementById('me-loc-input').value.trim() || '厦门 · ずっと頑張ってきたね、';
      appData.hero.name = appData.hero.userName;
      appData.hero.handle = appData.hero.userHandle;
      appData.hero.tag = appData.hero.userTag;
      appData.hero.location = appData.hero.locationText;

      const myAppearance = document.getElementById('me-appearance-input').value.trim();
      const myHabits = document.getElementById('me-habits-input').value.trim();

      const birthdayInput = document.getElementById('me-birthday-input');
      const birthdayCalendar = document.getElementById('me-birthday-calendar');
      const birthdayRaw = birthdayInput ? birthdayInput.value.trim() : '';
      let birthday = null;
      if (birthdayRaw) {
        birthday = (typeof parseBirthdayInput === 'function')
          ? parseBirthdayInput(birthdayRaw, birthdayCalendar ? birthdayCalendar.value : 'solar')
          : null;
        if (!birthday) {
          alert('生日格式不太对。请填月和日，例如 8-15、8/15 或 8月15日；农历生日也按这个格式。');
          return;
        }
      }

      localStorage.setItem('momo_hero_data', JSON.stringify(appData.hero));
      localStorage.setItem('momo_user_nick', appData.userNickname);
      localStorage.setItem('momo_my_appearance', myAppearance);
      localStorage.setItem('momo_user_info_text', myHabits);
      if (birthday) {
        localStorage.setItem('momo_user_birthday', JSON.stringify(birthday));
      } else {
        localStorage.removeItem('momo_user_birthday');
      }
      appData.userInfo = myHabits;

      // 只刷新「微信-我」；桌面小组件如果没单独改过，会继续跟着这里。
      // 如果小组件已经单独改过，就不覆盖它。
      syncMeProfileUI();
      try {
        if (!localStorage.getItem('momo_widget_profile') && typeof renderHeroTexts === 'function') {
          renderHeroTexts();
        }
      } catch (e) {}
      alert('【我】档案已全部更新！');
      openPage('page-home');
    }

    

    // ================= 完整备份 V2：localStorage + IndexedDB =================
    const MOMO_BACKUP_FORMAT = 'momo-phone-backup';
    const MOMO_BACKUP_SCHEMA_VERSION = 2;
    const MOMO_MOMENTS_DB_NAME = 'MomoMomentsDB';
    const MOMO_MOMENTS_STORE_NAME = 'moments';
    const MOMO_MOMENTS_RECORD_KEY = 'feed';
    const MOMO_IDB_FALLBACK_NAMES = ['MomoMusicDB', 'MomoNovelStoreDB', MOMO_MOMENTS_DB_NAME];

    function momoFormatBytes(bytes) {
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
    }

    function momoReadFileAsText(file) {
      return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function(e) { resolve(String((e.target && e.target.result) || '')); };
        reader.onerror = function() { reject(reader.error || new Error('读取备份文件失败')); };
        reader.readAsText(file);
      });
    }

    function momoBlobToDataURL(blob) {
      return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function(e) { resolve(String(e.target.result || '')); };
        reader.onerror = function() { reject(reader.error || new Error('读取二进制数据失败')); };
        reader.readAsDataURL(blob);
      });
    }

    function momoArrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    }

    function momoBase64ToArrayBuffer(base64) {
      const binary = atob(String(base64 || ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }

    function momoDataURLToBlob(dataURL) {
      const str = String(dataURL || '');
      const comma = str.indexOf(',');
      if (comma === -1) return new Blob([]);
      const header = str.slice(0, comma);
      const mimeMatch = /data:([^;]+)/i.exec(header);
      return new Blob([momoBase64ToArrayBuffer(str.slice(comma + 1))], { type: mimeMatch ? mimeMatch[1] : '' });
    }

    async function momoSerializeBackupValue(value, seen) {
      if (value === null || typeof value !== 'object') return value;
      if (typeof File !== 'undefined' && value instanceof File) {
        return {
          __momo_backup_type: 'File',
          name: value.name || 'file',
          mime: value.type || '',
          lastModified: value.lastModified || Date.now(),
          data: await momoBlobToDataURL(value)
        };
      }
      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return {
          __momo_backup_type: 'Blob',
          mime: value.type || '',
          data: await momoBlobToDataURL(value)
        };
      }
      if (value instanceof Date) {
        return { __momo_backup_type: 'Date', value: value.toISOString() };
      }
      if (value instanceof ArrayBuffer) {
        return { __momo_backup_type: 'ArrayBuffer', data: momoArrayBufferToBase64(value) };
      }
      if (ArrayBuffer.isView(value)) {
        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        return {
          __momo_backup_type: 'TypedArray',
          constructor: value.constructor && value.constructor.name || 'Uint8Array',
          data: momoArrayBufferToBase64(bytes.buffer)
        };
      }
      if (seen.has(value)) throw new Error('备份数据中存在循环引用，无法导出');
      seen.add(value);
      try {
        if (Array.isArray(value)) {
          const arr = [];
          for (const item of value) arr.push(await momoSerializeBackupValue(item, seen));
          return arr;
        }
        if (value instanceof Map) {
          const entries = [];
          for (const pair of value.entries()) {
            entries.push([
              await momoSerializeBackupValue(pair[0], seen),
              await momoSerializeBackupValue(pair[1], seen)
            ]);
          }
          return { __momo_backup_type: 'Map', entries: entries };
        }
        if (value instanceof Set) {
          const values = [];
          for (const item of value.values()) values.push(await momoSerializeBackupValue(item, seen));
          return { __momo_backup_type: 'Set', values: values };
        }
        const out = {};
        for (const key of Object.keys(value)) {
          out[key] = await momoSerializeBackupValue(value[key], seen);
        }
        return out;
      } finally {
        seen.delete(value);
      }
    }

    async function momoDeserializeBackupValue(value) {
      if (value === null || typeof value !== 'object') return value;
      if (Array.isArray(value)) {
        const arr = [];
        for (const item of value) arr.push(await momoDeserializeBackupValue(item));
        return arr;
      }
      const type = value.__momo_backup_type;
      if (type === 'Blob') return momoDataURLToBlob(value.data);
      if (type === 'File') {
        const blob = momoDataURLToBlob(value.data);
        if (typeof File !== 'undefined') {
          try {
            return new File([blob], value.name || 'file', {
              type: value.mime || blob.type || '',
              lastModified: value.lastModified || Date.now()
            });
          } catch (e) {}
        }
        return blob;
      }
      if (type === 'ArrayBuffer') return momoBase64ToArrayBuffer(value.data);
      if (type === 'TypedArray') {
        const buffer = momoBase64ToArrayBuffer(value.data);
        const ctor = (typeof window !== 'undefined' && typeof window[value.constructor] === 'function')
          ? window[value.constructor]
          : Uint8Array;
        try { return new ctor(buffer); } catch (e) { return new Uint8Array(buffer); }
      }
      if (type === 'Date') return new Date(value.value);
      if (type === 'Map') {
        const map = new Map();
        for (const pair of (value.entries || [])) {
          map.set(await momoDeserializeBackupValue(pair[0]), await momoDeserializeBackupValue(pair[1]));
        }
        return map;
      }
      if (type === 'Set') {
        const set = new Set();
        for (const item of (value.values || [])) set.add(await momoDeserializeBackupValue(item));
        return set;
      }
      const out = {};
      for (const key of Object.keys(value)) out[key] = await momoDeserializeBackupValue(value[key]);
      return out;
    }

    function momoOpenIndexedDB(name, version) {
      return new Promise(function(resolve, reject) {
        let req;
        try {
          req = version ? indexedDB.open(name, version) : indexedDB.open(name);
        } catch (e) {
          reject(e);
          return;
        }
        req.onupgradeneeded = function() {};
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error || new Error('打开 IndexedDB 失败')); };
        req.onblocked = function() { reject(new Error('IndexedDB 被其他页面占用')); };
      });
    }

    function momoDeleteIndexedDB(name) {
      return new Promise(function(resolve, reject) {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { reject(req.error || new Error('删除 IndexedDB 失败')); };
        req.onblocked = function() { reject(new Error('IndexedDB 被其他页面占用，无法重建')); };
      });
    }

    // 朋友圈数据可能包含多张 Base64 图片，很容易超过 localStorage 的 5MB 配额。
    // 超出配额时把这份 JSON 转存到 IndexedDB，页面启动时再异步接回 appData.moments。
    function momoOpenMomentsDB() {
      return new Promise(function(resolve, reject) {
        if (!window.indexedDB) {
          reject(new Error('当前浏览器不支持 IndexedDB，无法保存超大朋友圈数据'));
          return;
        }
        let req;
        try {
          req = indexedDB.open(MOMO_MOMENTS_DB_NAME, 1);
        } catch (e) {
          reject(e);
          return;
        }
        req.onupgradeneeded = function() {
          const db = req.result;
          if (!db.objectStoreNames.contains(MOMO_MOMENTS_STORE_NAME)) {
            db.createObjectStore(MOMO_MOMENTS_STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error || new Error('打开朋友圈 IndexedDB 失败')); };
        req.onblocked = function() { reject(new Error('朋友圈 IndexedDB 被其他页面占用')); };
      });
    }

    function momoReadMomentsOverflow() {
      return momoOpenMomentsDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          const tx = db.transaction(MOMO_MOMENTS_STORE_NAME, 'readonly');
          const req = tx.objectStore(MOMO_MOMENTS_STORE_NAME).get(MOMO_MOMENTS_RECORD_KEY);
          req.onsuccess = function() {
            const row = req.result;
            resolve(row && typeof row.json === 'string' ? row.json : null);
          };
          req.onerror = function() { reject(req.error || new Error('读取朋友圈备份失败')); };
          tx.oncomplete = function() { db.close(); };
          tx.onabort = function() { db.close(); };
        });
      });
    }

    function momoWriteMomentsOverflow(json) {
      return momoOpenMomentsDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          const tx = db.transaction(MOMO_MOMENTS_STORE_NAME, 'readwrite');
          tx.objectStore(MOMO_MOMENTS_STORE_NAME).put({
            id: MOMO_MOMENTS_RECORD_KEY,
            json: String(json || '[]'),
            updatedAt: new Date().toISOString()
          });
          tx.oncomplete = function() { db.close(); resolve(); };
          tx.onerror = function() { db.close(); reject(tx.error || new Error('写入朋友圈 IndexedDB 失败')); };
          tx.onabort = function() { db.close(); reject(tx.error || new Error('写入朋友圈 IndexedDB 被中止')); };
        });
      });
    }

    function momoClearMomentsOverflow() {
      return momoOpenMomentsDB().then(function(db) {
        return new Promise(function(resolve, reject) {
          const tx = db.transaction(MOMO_MOMENTS_STORE_NAME, 'readwrite');
          tx.objectStore(MOMO_MOMENTS_STORE_NAME).delete(MOMO_MOMENTS_RECORD_KEY);
          tx.oncomplete = function() { db.close(); resolve(); };
          tx.onerror = function() { db.close(); reject(tx.error || new Error('清理朋友圈 IndexedDB 失败')); };
          tx.onabort = function() { db.close(); reject(tx.error || new Error('清理朋友圈 IndexedDB 被中止')); };
        });
      });
    }

    function momoIsQuotaError(err) {
      return !!err && (
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.code === 1014
      );
    }

    window.momoReadMomentsOverflow = momoReadMomentsOverflow;
    window.momoWriteMomentsOverflow = momoWriteMomentsOverflow;
    window.momoClearMomentsOverflow = momoClearMomentsOverflow;

    function momoApplyStoreSchema(db, storeMetaList) {
      (storeMetaList || []).forEach(function(meta) {
        if (!meta || !meta.name) return;
        if (!db.objectStoreNames.contains(meta.name)) {
          const options = {};
          if (meta.keyPath !== null && meta.keyPath !== undefined) options.keyPath = meta.keyPath;
          if (meta.autoIncrement) options.autoIncrement = true;
          const store = db.createObjectStore(meta.name, options);
          (meta.indexes || []).forEach(function(indexMeta) {
            if (!indexMeta || !indexMeta.name) return;
            try {
              store.createIndex(indexMeta.name, indexMeta.keyPath, {
                unique: !!indexMeta.unique,
                multiEntry: !!indexMeta.multiEntry
              });
            } catch (e) {}
          });
        }
      });
    }

    function momoOpenIndexedDBWithSchema(name, version, storeMetaList) {
      return new Promise(function(resolve, reject) {
        let req;
        try {
          req = indexedDB.open(name, Math.max(1, Number(version) || 1));
        } catch (e) {
          reject(e);
          return;
        }
        req.onupgradeneeded = function() { momoApplyStoreSchema(req.result, storeMetaList); };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error || new Error('创建 IndexedDB 失败')); };
        req.onblocked = function() { reject(new Error('IndexedDB 被其他页面占用')); };
      });
    }

    async function momoListIndexedDBNames() {
      try {
        if (indexedDB.databases) {
          const dbs = await indexedDB.databases();
          return dbs.map(function(db) { return db && db.name; }).filter(Boolean);
        }
      } catch (e) {}
      return MOMO_IDB_FALLBACK_NAMES.slice();
    }

    async function momoDumpIndexedDB(name) {
      const db = await momoOpenIndexedDB(name);
      const storeNames = Array.from(db.objectStoreNames || []);
      if (!storeNames.length) {
        const info = { name: name, version: db.version, stores: [] };
        db.close();
        return info;
      }

      return await new Promise(function(resolve, reject) {
        const tx = db.transaction(storeNames, 'readonly');
        const pending = storeNames.map(function(storeName) {
          const store = tx.objectStore(storeName);
          const meta = {
            name: storeName,
            keyPath: store.keyPath,
            autoIncrement: store.autoIncrement,
            indexes: Array.from(store.indexNames || []).map(function(indexName) {
              const index = store.index(indexName);
              return {
                name: indexName,
                keyPath: index.keyPath,
                unique: index.unique,
                multiEntry: index.multiEntry
              };
            })
          };
          const recordsPromise = new Promise(function(resolveRows, rejectRows) {
            const rows = [];
            const req = store.openCursor();
            req.onerror = function() { rejectRows(req.error || new Error('读取 IndexedDB 记录失败')); };
            req.onsuccess = function() {
              const cursor = req.result;
              if (cursor) {
                rows.push({ key: cursor.key, value: cursor.value });
                cursor.continue();
              } else {
                resolveRows(rows);
              }
            };
          });
          return { meta: meta, recordsPromise: recordsPromise };
        });

        tx.oncomplete = async function() {
          try {
            const stores = [];
            for (const item of pending) {
              const rawRecords = await item.recordsPromise;
              const records = [];
              for (const row of rawRecords) {
                records.push({
                  key: await momoSerializeBackupValue(row.key, new WeakSet()),
                  value: await momoSerializeBackupValue(row.value, new WeakSet())
                });
              }
              stores.push({
                name: item.meta.name,
                keyPath: item.meta.keyPath,
                autoIncrement: item.meta.autoIncrement,
                indexes: item.meta.indexes,
                records: records
              });
            }
            const info = { name: name, version: db.version, stores: stores };
            db.close();
            resolve(info);
          } catch (e) {
            db.close();
            reject(e);
          }
        };
        tx.onerror = function() {
          db.close();
          reject(tx.error || new Error('读取 IndexedDB 失败'));
        };
        tx.onabort = function() {
          db.close();
          reject(tx.error || new Error('读取 IndexedDB 被中止'));
        };
      });
    }

    async function momoDumpAllIndexedDB() {
      const names = await momoListIndexedDBNames();
      const result = [];
      for (const name of names) {
        if (!name || name === MOMO_OVERFLOW_DB_NAME) continue;
        try {
          result.push(await momoDumpIndexedDB(name));
        } catch (e) {
          throw new Error('读取 IndexedDB「' + name + '」失败：' + (e.message || e));
        }
      }
      return result;
    }

    async function momoRestoreOneIndexedDB(info) {
      if (!info || !info.name || info.name === MOMO_OVERFLOW_DB_NAME) return;
      const storeMetaList = Array.isArray(info.stores) ? info.stores : [];

      // 先把所有记录反序列化，避免写到一半才发现数据有问题
      const prepared = [];
      for (const meta of storeMetaList) {
        if (!meta || !meta.name) continue;
        const rows = [];
        for (const row of (meta.records || [])) {
          rows.push({
            key: await momoDeserializeBackupValue(row.key),
            value: await momoDeserializeBackupValue(row.value)
          });
        }
        prepared.push({ meta: meta, rows: rows });
      }
      if (!prepared.length) return;

      let db = await momoOpenIndexedDB(info.name);
      const missing = prepared.filter(function(item) {
        return !db.objectStoreNames.contains(item.meta.name);
      });
      if (missing.length) {
        db.close();
        await momoDeleteIndexedDB(info.name);
        db = await momoOpenIndexedDBWithSchema(info.name, Number(info.version) || 1, storeMetaList);
      }

      const storeNames = prepared
        .map(function(item) { return item.meta.name; })
        .filter(function(name) { return db.objectStoreNames.contains(name); });

      if (!storeNames.length) {
        db.close();
        return;
      }

      await new Promise(function(resolve, reject) {
        const tx = db.transaction(storeNames, 'readwrite');
        tx.oncomplete = function() { db.close(); resolve(); };
        tx.onerror = function() { db.close(); reject(tx.error || new Error('写入 IndexedDB 失败')); };
        tx.onabort = function() { db.close(); reject(tx.error || new Error('写入 IndexedDB 被中止')); };
        for (const item of prepared) {
          if (!storeNames.includes(item.meta.name)) continue;
          const store = tx.objectStore(item.meta.name);
          store.clear();
          for (const row of item.rows) {
            if (item.meta.keyPath === null || item.meta.keyPath === undefined) {
              store.put(row.value, row.key);
            } else {
              store.put(row.value);
            }
          }
        }
      });
    }

    async function momoRestoreIndexedDB(databases) {
      if (!Array.isArray(databases)) return;
      for (const info of databases) {
        await momoRestoreOneIndexedDB(info);
      }
    }

    // 导出完整数据包（localStorage 全量 + IndexedDB 全量）
    async function exportFullBackup() {
      try {
        const payload = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) payload[key] = localStorage.getItem(key);
        }
        // 超出 localStorage 配额的键存放在 IndexedDB 溢出区，导出时必须一起打包。
        try {
          const overflowPrefix = window.momoStorageOverflowPrefix || '__momo_ls_overflow__:';
          const overflowKeys = window.momoGetStorageOverflowKeys ? window.momoGetStorageOverflowKeys() : [];
          overflowKeys.forEach(function(key) {
            if (payload[key] === undefined) payload[key] = localStorage.getItem(key);
          });
        } catch (e) {}

        const indexedDBData = await momoDumpAllIndexedDB();
        const backupData = {
          format: MOMO_BACKUP_FORMAT,
          schemaVersion: MOMO_BACKUP_SCHEMA_VERSION,
          version: MOMO_BACKUP_SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          appVersion: (typeof window.MOMO_APP_VERSION === 'string' ? window.MOMO_APP_VERSION : ''),
          data: payload,
          indexedDB: indexedDBData
        };
        const jsonStr = JSON.stringify(backupData);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const size = blob.size;
        const dbCount = indexedDBData.length;
        const recordCount = indexedDBData.reduce(function(total, db) {
          return total + (db.stores || []).reduce(function(sum, store) {
            return sum + (store.records || []).length;
          }, 0);
        }, 0);

        if (size > 40 * 1024 * 1024) {
          const ok = confirm('备份约 ' + momoFormatBytes(size) + '，包含音乐音频等大文件。\n\n是否继续导出？');
          if (!ok) return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `momo_phone_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        try { localStorage.setItem('momo_last_backup_at', new Date().toISOString()); } catch (e) {}
        alert('🎉 备份已下载！\nlocalStorage：' + Object.keys(payload).length + ' 项\nIndexedDB：' + dbCount + ' 个数据库 / ' + recordCount + ' 条记录\n文件大小：' + momoFormatBytes(size));
      } catch(err) {
        alert('导出失败：' + err.message);
      }
    }

    // 导入恢复数据（兼容旧版备份，支持 localStorage + IndexedDB）
    async function importFullBackup(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try {
        const text = await momoReadFileAsText(file);
        const parsed = JSON.parse(text);
        const dataToRestore = (parsed && parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
        if (!dataToRestore || typeof dataToRestore !== 'object') {
          alert('备份文件格式不正确，无法读取数据。');
          return;
        }

        const idbPayload = (parsed && Array.isArray(parsed.indexedDB)) ? parsed.indexedDB : null;
        if (parsed && parsed.schemaVersion && Number(parsed.schemaVersion) > MOMO_BACKUP_SCHEMA_VERSION) {
          alert('这个备份来自更新版本的小手机，当前版本会尽量恢复兼容内容。');
        }

        const hasExistingData = localStorage.length > 0;
        if (hasExistingData) {
          const confirmed = confirm('检测到当前手机中已有数据记录。\n\n是否确认覆盖？\n- 点击【确定】：清空现有数据并完全导入本文件\n- 点击【取消】：中止导入，保持原样不变');
          if (!confirmed) return;
        }

        // 等待 IndexedDB 溢出缓存加载完成，避免覆盖导入时读到不完整的旧溢出数据。
        try { if (window.momoOverflowReady) await window.momoOverflowReady; } catch (e) {}

        // 先记下当前 localStorage，写入失败时回滚
        const previousData = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) previousData[key] = localStorage.getItem(key);
        }
        try {
          const overflowKeys = window.momoGetStorageOverflowKeys ? window.momoGetStorageOverflowKeys() : [];
          overflowKeys.forEach(function(key) {
            if (previousData[key] === undefined) previousData[key] = localStorage.getItem(key);
          });
        } catch (e) {}

        let previousMomentsOverflow = null;
        try { previousMomentsOverflow = await momoReadMomentsOverflow(); } catch (e) {}
        let overflowWritten = false;

        try {
          if (idbPayload) await momoRestoreIndexedDB(idbPayload);

          window.momoNativeLocalStorageClear.call(localStorage);
          await momoClearOverflowDB();
          let count = 0;
          let overflowCount = 0;

          const entries = Object.keys(dataToRestore)
            .filter(function(k) {
              return k !== '_lastUpdated' && k !== 'version' && k !== 'exportedAt' && k !== 'format' && k !== 'schemaVersion' && k !== 'indexedDB';
            })
            .map(function(k) {
              const val = typeof dataToRestore[k] === 'object' ? JSON.stringify(dataToRestore[k]) : dataToRestore[k];
              return { key: k, value: val == null ? '' : String(val) };
            })
            .sort(function(a, b) { return a.value.length - b.value.length; });

          for (const entry of entries) {
            try {
              // 绕过自动溢出补丁，先尝试真正的 localStorage 写入，失败才转入 IndexedDB。
              window.momoNativeLocalStorageSetItem.call(localStorage, entry.key, entry.value);
              count++;
            } catch (err) {
              if (momoIsQuotaError(err)) {
                window.momoOverflowCache[entry.key] = entry.value;
                await momoWriteOverflowValue(entry.key, entry.value);
                overflowWritten = true;
                overflowCount++;
                count++;
              } else {
                throw err;
              }
            }
          }

          const overflowText = overflowCount
            ? '，其中 ' + overflowCount + ' 项超大内容已转入 IndexedDB 长期存储'
            : '';

          alert('🎉 导入成功！localStorage 写入 ' + count + ' 项' + overflowText + '，IndexedDB ' + (idbPayload ? (idbPayload.length + ' 个数据库') : '未包含（旧版备份）') + '，页面即将刷新生效。');
          try { localStorage.setItem('momo_last_import_at', new Date().toISOString()); } catch (e) {}
          location.reload();
        } catch (err) {
          try {
            window.momoNativeLocalStorageClear.call(localStorage);
            await momoClearOverflowDB();
            Object.keys(previousData).forEach(function(k) {
              localStorage.setItem(k, previousData[k]);
            });
          } catch (rollbackErr) {}
          if (overflowWritten) {
            try {
              if (previousMomentsOverflow === null) await momoClearMomentsOverflow();
              else await momoWriteMomentsOverflow(previousMomentsOverflow);
            } catch (restoreErr) {}
          }
          throw err;
        }
      } catch(err) {
        alert('导入失败：' + err.message);
      } finally {
        if (e.target) e.target.value = '';
      }
    }
    window.importFullBackup = importFullBackup;
    window.exportFullBackup = exportFullBackup;

    window.handleBackupDrop = function(event) {
      try {
        if (event && event.preventDefault) event.preventDefault();
        const card = event && event.currentTarget;
        if (card) card.style.borderColor = 'rgba(139, 92, 246, 0.35)';
        const files = event && event.dataTransfer && event.dataTransfer.files;
        const file = files && files[0];
        if (!file) return;
        if (!/\.json$/i.test(file.name || '')) {
          alert('请拖入导出的 .json 备份文件。');
          return;
        }
        window.importFullBackup({ target: { files: [file], value: '' } });
      } catch (err) {
        alert('拖入备份失败：' + (err.message || err));
      }
    };

window.appData = appData;
