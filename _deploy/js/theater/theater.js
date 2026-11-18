// SillyTavern 沉浸式跑团剧场系统与故事设定
    // 故事设定系统数据
    appData.storySettings = JSON.parse(localStorage.getItem('momo_story_settings') || JSON.stringify({
      pov: '跟随文风',
      style: '小说体',
      stylePrompt: '细腻描写；深入角色内心独白与感官细节。善用神态与环境烘托，节奏张弛有度，专注绪言与user的情感张力。',
      minWords: 300,
      maxWords: 800,
      autoSummary: true,
      scenario: '盛夏午后画室，百叶窗斑驳阳光下，绪言端来温水，替手酸的user揉按手腕...',
      streamOutput: true
    }));

    function selectStoryPov(pov) {
      appData.storySettings.pov = pov;
      document.querySelectorAll('#page-story-setting .story-choice-pill[id^="pill-pov-"]').forEach(p => p.classList.remove('active'));
      const map = { '跟随文风': 'pill-pov-follow', '第一人称': 'pill-pov-1', '第二人称': 'pill-pov-2', '第三人称': 'pill-pov-3' };
      if (map[pov]) document.getElementById(map[pov]).classList.add('active');
    }

    function selectStoryStyle(style) {
      appData.storySettings.style = style;
      document.querySelectorAll('#page-story-setting .story-choice-pill[id^="pill-style-"]').forEach(p => p.classList.remove('active'));
      const prompts = {
        '小说体': '细腻小说体描写；深入角色内心独白与感官细节。善用神态与环境烘托，节奏张弛有度，专注绪言与user的情感张力。',
        '剧本': '标准舞台戏剧格式。以环境/音效景别开端，角色动作描写用星号包裹，台词利落深刻，充满镜头对白张力。',
        '第一人称独白': '以周绪言的真实第一人称男友视角展开全部叙述，直抒胸臆，极度偏爱user，充满克制却深沉的占有欲与呵护。',
        '唯美细腻': '日系物哀与浪漫电影风格，微风、光影、发丝、心跳与体温的细致捕捉，言语极尽宠溺与温柔。'
      };
      const map = { '小说体': 'pill-style-novel', '剧本': 'pill-style-script', '第一人称独白': 'pill-style-first', '唯美细腻': 'pill-style-delicate' };
      if (map[style]) document.getElementById(map[style]).classList.add('active');
      document.getElementById('story-style-prompt').value = prompts[style] || prompts['小说体'];
    }

    function toggleStorySummarySwitch() {
      const sw = document.getElementById('toggle-story-auto-summary');
      appData.storySettings.autoSummary = !appData.storySettings.autoSummary;
      sw.classList.toggle('active', appData.storySettings.autoSummary);
    }

    function syncStorySettingsUI() {
      if (typeof syncStoryOutlineUI === 'function') {
        syncStoryOutlineUI();
        return;
      }
      const s = appData.storySettings || {};
      const scenario = document.getElementById('story-scenario-text');
      if (scenario) scenario.value = s.scenario || '';
    }

    function saveStorySettings() {
      const s = appData.storySettings;
      s.stylePrompt = document.getElementById('story-style-prompt').value.trim();
      s.minWords = parseInt(document.getElementById('story-min-words').value) || 300;
      s.maxWords = parseInt(document.getElementById('story-max-words').value) || 800;
      s.scenario = document.getElementById('story-scenario-text').value.trim();
      localStorage.setItem('momo_story_settings', JSON.stringify(s));
      document.getElementById('rp-badge-scenario').innerText = '场景：' + (s.scenario.slice(0, 8) + '...');
      alert('故事设定已保存并生效！');
    }

    // 图1的【重新生成】
    function handleStoryRegenerate() {
      if (appData.rpHistory.length === 0) return;
      if (appData.rpHistory[appData.rpHistory.length - 1].role === 'assistant') {
        appData.rpHistory.pop();
      }
      renderRpStream();
      triggerStoryAiGeneration('（请重新换一种情绪和动作描写演绎周绪言的本轮反应）');
    }

    // 图1的【继续生成】
    function handleStoryContinue() {
      triggerStoryAiGeneration('（请周绪言顺着方才的情景与动作，继续往下推进剧情和台词）');
    }

    async function triggerStoryAiGeneration(customDirective = '') {
      if (!appData.apiKey) {
        alert('请先去设置配置 API Key');
        openPage('page-api');
        return;
      }

      const s = appData.storySettings;
      const recentStory = (appData.rpHistory || []).slice(-8).map(m => (m.action || '') + ' ' + (m.spoken || '')).join('\n');
      const worldBookPrompt = (window.WB && typeof window.WB.buildText === 'function')
        ? window.WB.buildText({
            mode: 'theater',
            charIds: window.WB.activeCharId ? [window.WB.activeCharId()] : [],
            text: (s.scenario || '') + '\n' + recentStory + '\n' + customDirective
          })
        : appData.worldEntries.map(e => `【${e.title}】：${e.content}`).join('\n');

      const systemPrompt = `你正在与user（user）进行独创的角色扮演跑团故事。
### 舞台情境：
${s.scenario}

### 你的角色（周绪言）：
18岁、青梅竹马、爹系宠溺人夫感、深情且极度纵容user。

### user的角色：
user，紫发微卷，喜欢画画，自称紫毛爱妻。

### 叙事视角与文风要求：
人称约束：${s.pov}
文风指令：${s.stylePrompt}
篇幅字数要求：本次单次输出字数必须在 ${s.minWords} 字 到 ${s.maxWords} 字 之间，内容要细腻丰满。

### 专属世界书背景：
${worldBookPrompt}

请严格按格式输出周绪言的反应：
*环境、神态与具体动作描写* “台词”`;

      const recent = appData.rpHistory.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: `${m.action || ''} ${m.spoken || ''}`
      }));

      if (customDirective) {
        recent.push({ role: 'user', content: customDirective });
      }

      try {
        let cleanBase = appData.apiBase.replace(/\/+$/, '');
        if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';

        const res = await fetch(cleanBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + appData.apiKey
          },
          body: JSON.stringify({
            model: appData.model || 'deepseek-chat',
            messages: [{ role: 'system', content: systemPrompt }, ...recent],
            temperature: 0.86
          })
        });

        const data = await res.json();
        const reply = data.choices[0].message.content;

        let botAction = '';
        let botSpoken = reply;
        const bMatch = reply.match(/\*([^*]+)\*/);
        if (bMatch) {
          botAction = '*' + bMatch[1] + '*';
          botSpoken = reply.replace(/\*([^*]+)\*/, '').trim();
        }

        appData.rpHistory.push({
          role: 'assistant',
          char: '周绪言',
          action: botAction,
          spoken: botSpoken
        });
        localStorage.setItem('momo_rp_history', JSON.stringify(appData.rpHistory));
        renderRpStream();
      } catch (err) {
        alert('故事演绎请求异常：' + err.message);
      }
    }


    // 原创【故事设定】核心数据模型
    appData.storySettings = JSON.parse(localStorage.getItem('momo_story_settings') || JSON.stringify({
      pov: '跟随文风',
      stylePreset: '小说体',
      stylePrompt: '细腻描写；深入周绪言内心活动与感官细节，对user的微小动作充满呵护。动作描写用星号包裹，台词用引号。善用比喻与氛围渲染。',
      timeMode: '跟随现实',
      minWords: 300,
      maxWords: 800,
      autoSummary: true,
      summaryInterval: 8,
      enableCot: true,
      streamOutput: true,
      charId: '',
      scenario: '盛夏午后画室，百叶窗斑驳阳光下，绪言端来温水，替手酸的user揉按手腕...',
      autoOutline: true,
      contextDepth: 30
    }));

    function selectStoryOption(key, val, el) {
      appData.storySettings[key] = val;
      el.parentElement.querySelectorAll('.story-pill-option').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
    }

    function selectStoryStyle(name, el) {
      el.parentElement.querySelectorAll('.story-pill-option').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      const presets = {
        '小说体': '细腻描写；深入周绪言内心活动与感官细节，对user的微小动作充满呵护。动作描写用星号包裹，台词用引号。善用比喻与氛围渲染。',
        '剧本体': '标准舞台剧本格式。动作与微表情用[方括号]或*星号*精简标注，重点突出台词的情感张力与眼神对视。',
        '深情心声': '着重表现周绪言视角下的心跳、吃醋、心疼与保护欲，语言温柔深情，充满青梅竹马专属宠溺。',
        '日系轻小说': '清爽带点少年气与心动的文字风格。穿插午后阳光、风声等环境细节，互动细腻，甜而不腻。'
      };
      if (presets[name]) {
        document.getElementById('story-style-prompt').value = presets[name];
        appData.storySettings.stylePrompt = presets[name];
      }
    }

    function toggleStorySummarySwitch() {
      appData.storySettings.autoSummary = !appData.storySettings.autoSummary;
      document.getElementById('toggle-story-summary').classList.toggle('active', appData.storySettings.autoSummary);
    }

    function toggleStoryCotSwitch() {
      appData.storySettings.enableCot = !appData.storySettings.enableCot;
      document.getElementById('toggle-story-cot').classList.toggle('active', appData.storySettings.enableCot);
    }

    function syncRpStreamModeUI() {
      const on = appData.storySettings.streamOutput !== false;
      const label = document.getElementById('rp-stream-mode-label');
      const chip = document.getElementById('rp-stream-mode-chip');
      if (label) label.textContent = on ? '⚡ 流式' : '⚡ 非流式';
      if (chip) chip.classList.toggle('alt', !on);
      const onPill = document.getElementById('pill-stream-on');
      const offPill = document.getElementById('pill-stream-off');
      if (onPill) onPill.classList.toggle('active', on);
      if (offPill) offPill.classList.toggle('active', !on);
    }

    function getStoryWbConfig() {
      if (!appData.storyWbConfig) {
        try {
          appData.storyWbConfig = JSON.parse(localStorage.getItem('momo_story_wb_config') || 'null');
        } catch (e) {}
      }
      if (!appData.storyWbConfig) appData.storyWbConfig = { custom: true, books: {} };
      if (!appData.storyWbConfig.books) appData.storyWbConfig.books = {};
      return appData.storyWbConfig;
    }

    function syncStoryWbSummary() {
      const el = document.getElementById('story-wb-summary');
      if (!el) return;
      const books = appData.worldBooks || [];
      if (!books.length) { el.textContent = ' 还没有世界书。'; return; }
      const cfg = getStoryWbConfig();
      let enabled = 0;
      books.forEach(function(b) {
        const c = cfg.books[b.id];
        if (!cfg.custom || !c || c.enabled !== false) enabled++;
      });
      el.textContent = ' 已启用 ' + enabled + '/' + books.length + ' 本。';
    }

    function updateStoryContextDepth(val) {
      const depth = Math.max(1, parseInt(val, 10) || 30);
      appData.storySettings.contextDepth = depth;
      const valEl = document.getElementById('story-context-depth-val');
      const hintEl = document.getElementById('story-context-depth-hint');
      const slider = document.getElementById('story-context-depth');
      if (valEl) valEl.textContent = depth;
      if (hintEl) hintEl.textContent = depth;
      if (slider) slider.value = depth;
      localStorage.setItem('momo_story_settings', JSON.stringify(appData.storySettings));
    }

    function toggleStoryOutlineAuto() {
      appData.storySettings.autoOutline = !appData.storySettings.autoOutline;
      const toggle = document.getElementById('toggle-story-outline');
      if (toggle) toggle.classList.toggle('active', !!appData.storySettings.autoOutline);
      localStorage.setItem('momo_story_settings', JSON.stringify(appData.storySettings));
    }

    const STORY_SKIN_KEY = 'momo_story_skin';
    const STORY_SKIN_NAMES = { glass: '雾面玻璃', moon: '月白玻璃', origin: '原生卡片' };

    function normalizeStorySkin(id) {
      return STORY_SKIN_NAMES[id] ? id : 'glass';
    }

    function applyStorySkinUI(id) {
      const skin = normalizeStorySkin(id);
      const page = document.getElementById('page-rp');
      if (!page) return;
      if (typeof page.setAttribute === 'function') page.setAttribute('data-story-skin', skin);
      const chips = document.querySelectorAll ? document.querySelectorAll('.story-skin-chip') : [];
      for (let i = 0; i < chips.length; i++) {
        const on = chips[i].getAttribute('data-story-skin-option') === skin;
        chips[i].classList.toggle('active', on);
        chips[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      const current = document.getElementById('story-skin-current');
      if (current) current.textContent = STORY_SKIN_NAMES[skin];
    }

    function setStorySkin(id) {
      const skin = normalizeStorySkin(id);
      applyStorySkinUI(skin);
      try { localStorage.setItem(STORY_SKIN_KEY, skin); } catch (e) {}
    }

    function syncStorySkin() {
      let saved = 'glass';
      try { saved = localStorage.getItem(STORY_SKIN_KEY) || 'glass'; } catch (e) {}
      applyStorySkinUI(saved);
    }

    function syncStoryOutlineUI() {
      const s = appData.storySettings || {};
      const scenario = document.getElementById('story-scenario-text');
      if (scenario) scenario.value = s.scenario || (appData.rpConfig && appData.rpConfig.scenario) || '';
      const toggle = document.getElementById('toggle-story-outline');
      if (toggle) toggle.classList.toggle('active', s.autoOutline !== false);
      const depth = Math.max(1, parseInt(s.contextDepth, 10) || 30);
      const slider = document.getElementById('story-context-depth');
      if (slider) slider.value = depth;
      const valEl = document.getElementById('story-context-depth-val');
      const hintEl = document.getElementById('story-context-depth-hint');
      if (valEl) valEl.textContent = depth;
      if (hintEl) hintEl.textContent = depth;
      const style = document.getElementById('story-style-prompt');
      if (style) {
        let styleText = s.stylePrompt || '';
        const name = theaterCharacterName();
        if (name && name !== '周绪言') {
          styleText = String(styleText).replace(/周绪言/g, name).replace(/绪言/g, name);
        }
        style.value = styleText;
      }
      const min = document.getElementById('story-min-words');
      if (min) min.value = s.minWords || 300;
      const max = document.getElementById('story-max-words');
      if (max) max.value = s.maxWords || 800;
      const interval = document.getElementById('story-summary-interval');
      if (interval) interval.value = s.summaryInterval || 8;
      syncStoryWbSummary();
    }

    function resolveTheaterCharId() {
      const chars = (window.getCharacters && window.getCharacters()) || [];
      const saved = String((appData.storySettings && appData.storySettings.charId) || '');
      if (saved && chars.some(function(c) { return c && c.id === saved; })) return saved;
      const active = (typeof window.getActiveCharacter === 'function') ? window.getActiveCharacter() : null;
      if (active && active.id && chars.some(function(c) { return c && c.id === active.id; })) return active.id;
      return '';
    }

    function theaterCharacter() {
      const chars = (window.getCharacters && window.getCharacters()) || [];
      const id = resolveTheaterCharId();
      if (id) {
        const found = chars.filter(function(c) { return c && c.id === id; })[0];
        if (found) return found;
      }
      const active = (typeof window.getActiveCharacter === 'function') ? window.getActiveCharacter() : null;
      if (active) return active;
      return {
        id: '',
        name: String(appData.botRemark || (appData.rpConfig && appData.rpConfig.charRole) || '角色').split(/\s+/)[0] || '角色',
        prompt: appData.charPrompt || '',
        intro: '',
        tag: ''
      };
    }

    function theaterCharacterName() {
      const c = theaterCharacter();
      return String(c.name || appData.botRemark || (appData.rpConfig && appData.rpConfig.charRole) || '角色').trim().split(/\s+/)[0] || '角色';
    }

    function theaterCharacterPersona() {
      const c = theaterCharacter();
      const name = theaterCharacterName();
      const userName = String((appData.rpConfig && appData.rpConfig.userRole) || 'user').trim().split(/\s+/)[0] || 'user';
      let desc = String(c.prompt || '').trim();
      if (!desc) desc = [c.tag, c.intro].filter(function(x) { return x; }).join('；');
      if (!desc) desc = String((appData.rpConfig && appData.rpConfig.charRole) || '').trim();
      if (!desc) desc = '按角色卡中的名字、关系和性格自然扮演。';
      return desc.replace(/\{\{char\}\}/g, name).replace(/\{\{user\}\}/g, userName);
    }

    function theaterWorldbookText() {
      const s = appData.storySettings || {};
      const c = theaterCharacter();
      const cfg = getStoryWbConfig();
      const recent = (appData.rpHistory || []).slice(-10).map(function(m) {
        return (m.action || '') + ' ' + (m.spoken || '');
      }).join('\n');
      if (window.WB && typeof window.WB.buildText === 'function') {
        return window.WB.buildText({
          mode: 'theater',
          charIds: c && c.id ? [c.id] : [],
          text: (s.scenario || '') + '\n' + recent,
          bookFilter: function(b) {
            if (!cfg.custom) return true;
            return cfg.books[b.id] ? (cfg.books[b.id].enabled !== false) : true;
          },
          entryFilter: function(b, e) {
            if (!cfg.custom) return true;
            const dis = (cfg.books[b.id] && cfg.books[b.id].disabledEntries) || [];
            return dis.indexOf(e.id) === -1;
          }
        });
      }
      return (appData.worldEntries || []).map(function(e) {
        return '[' + (e.title || '世界书') + ']: ' + (e.content || '');
      }).join('\n');
    }

    function syncRpActorUI() {
      const select = document.getElementById('rp-actor-select');
      const input = document.getElementById('rp-input-field');
      const heroName = document.getElementById('rp-actor-hero-name');
      const heroSub = document.getElementById('rp-actor-hero-sub');
      const avatarImg = document.getElementById('rp-actor-avatar-img');
      const avatarFallback = document.getElementById('rp-actor-avatar-letter');
      const chars = (window.getCharacters && window.getCharacters()) || [];
      const selectedId = resolveTheaterCharId();
      if (select) {
        select.innerHTML = '';
        const addOption = function(value, text) {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = text;
          select.appendChild(opt);
        };
        addOption('', '跟随聊天角色' + (appData.botRemark ? '（' + appData.botRemark + '）' : ''));
        chars.forEach(function(c) {
          if (!c || !c.id) return;
          addOption(c.id, c.name || '未命名角色');
        });
        select.value = selectedId;
        if (select.value !== selectedId) select.value = '';
        select.disabled = chars.length === 0;
      }
      const actor = theaterCharacter();
      const actorName = theaterCharacterName();
      if (input) input.placeholder = '对 ' + actorName + ' 说些什么，或描述行动......';
      if (heroName) heroName.textContent = actorName;
      if (heroSub) {
        const subText = actor && (actor.tag || actor.intro)
          ? String(actor.tag || actor.intro).replace(/\s+/g, ' ').trim()
          : ('场景：' + String((appData.storySettings && appData.storySettings.scenario) || '厦门午后画室').replace(/\s+/g, ' ').trim());
        heroSub.textContent = subText.length > 22 ? subText.slice(0, 22) + '…' : subText;
      }
      if (avatarFallback) avatarFallback.textContent = actorName.slice(0, 1) || '角';
      if (avatarImg) {
        const avatar = String((actor && actor.avatar) || (actor && actor.id ? '' : (appData.botAvatar || '')) || '');
        avatarImg.onerror = function() {
          avatarImg.style.display = 'none';
          if (avatarFallback) avatarFallback.style.display = 'grid';
        };
        if (avatar) {
          avatarImg.src = avatar;
          avatarImg.style.display = 'block';
          if (avatarFallback) avatarFallback.style.display = 'none';
        } else {
          avatarImg.removeAttribute('src');
          avatarImg.style.display = 'none';
          if (avatarFallback) avatarFallback.style.display = 'grid';
        }
      }
    }

    function switchRpCharacter(id) {
      const oldName = theaterCharacterName();
      appData.storySettings.charId = String(id || '');
      const newName = theaterCharacterName();
      if (oldName && newName && oldName !== newName && oldName !== '角色' && appData.storySettings.stylePrompt) {
        appData.storySettings.stylePrompt = String(appData.storySettings.stylePrompt).split(oldName).join(newName);
        const styleInput = document.getElementById('story-style-prompt');
        if (styleInput) styleInput.value = appData.storySettings.stylePrompt;
      }
      localStorage.setItem('momo_story_settings', JSON.stringify(appData.storySettings));
      syncRpActorUI();
    }

    function selectStoryStreamMode(enabled, el) {
      appData.storySettings.streamOutput = enabled !== false;
      if (el) {
        document.querySelectorAll('#group-stream-mode .story-pill-option').forEach(function(btn) {
          btn.classList.remove('active');
        });
        el.classList.add('active');
      }
      localStorage.setItem('momo_story_settings', JSON.stringify(appData.storySettings));
      syncRpStreamModeUI();
    }

    function toggleRpStreamMode() {
      appData.storySettings.streamOutput = !appData.storySettings.streamOutput;
      localStorage.setItem('momo_story_settings', JSON.stringify(appData.storySettings));
      syncRpStreamModeUI();
    }

    function saveStorySettings() {
      const s = appData.storySettings;
      s.stylePrompt = document.getElementById('story-style-prompt').value.trim();
      s.minWords = parseInt(document.getElementById('story-min-words').value) || 300;
      s.maxWords = parseInt(document.getElementById('story-max-words').value) || 800;
      s.summaryInterval = parseInt(document.getElementById('story-summary-interval').value) || 8;
      const scenario = document.getElementById('story-scenario-text');
      if (scenario) s.scenario = scenario.value.trim();
      const depth = document.getElementById('story-context-depth');
      if (depth) s.contextDepth = Math.max(1, parseInt(depth.value, 10) || 30);
      s.autoOutline = document.getElementById('toggle-story-outline') ?
        document.getElementById('toggle-story-outline').classList.contains('active') : s.autoOutline;

      localStorage.setItem('momo_story_settings', JSON.stringify(s));
      syncStoryWbSummary();
      alert('故事设定已保存并应用！剧场已升级为专属文风。');
    }

    // 图1：重新生成最后一条
    function regenerateRpLast() {
      if (appData.rpHistory.length === 0) return;
      if (appData.rpHistory[appData.rpHistory.length - 1].role === 'assistant') {
        appData.rpHistory.pop();
        renderRpStream();
      }
      triggerRpAiTurn('（换一种更有感染力、细节更丰富的方式重新演绎这一幕）');
    }

    // 图1：继续生成
    function continueRpGenerate() {
      triggerRpAiTurn('（请接着刚刚的情景和对话，继续顺畅往下演，描写接下来的互动细节）');
    }

    // 总结当前线下剧场记录到记忆宫殿
    async function summarizeRpToPalace() {
      if (appData.rpHistory.length === 0) {
        alert('当前剧本还没有新剧情可以总结哦。');
        return;
      }
      alert('正在提炼本段剧本高光时刻...');
      const scriptText = appData.rpHistory.slice(-10).map(m => `${m.char}: ${m.action || ''} ${m.spoken || ''}`).join('\n');
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      appData.palaceMemories.unshift({
        date: dateStr,
        title: '剧场高光：' + (appData.rpConfig.scenario.slice(0,10) || '专属互动'),
        summary: '【剧本留念】' + scriptText.slice(0, 160) + '...'
      });
      localStorage.setItem('momo_palace_memories', JSON.stringify(appData.palaceMemories));
      renderPalaceMemories();
      alert('剧本高光已成功永久封存进记忆宫殿！');
    }

    function exportRpScript() {
      const dataStr = JSON.stringify(appData.rpHistory, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `momo_rp_script_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function resetRpScriptHistory() {
      if (confirm('确认清空当前剧场的全部线下对话记录吗？')) {
        appData.rpHistory = [];
        localStorage.removeItem('momo_rp_history');
        renderRpStream();
        alert('剧本已重置为空白舞台。');
      }
    }


    // ================= 此时此刻：SillyTavern 跑团剧场系统 =================
    function toggleRpDrawer() {
      document.getElementById('rp-config-drawer').classList.toggle('open');
      document.getElementById('rp-scenario-input').value = appData.rpConfig.scenario;
      document.getElementById('rp-user-role-input').value = appData.rpConfig.userRole;
      document.getElementById('rp-char-role-input').value = appData.rpConfig.charRole;
      document.getElementById('rp-style-input').value = appData.rpConfig.style;
    }

    function saveRpConfig() {
      appData.rpConfig.scenario = document.getElementById('rp-scenario-input').value.trim();
      appData.rpConfig.userRole = document.getElementById('rp-user-role-input').value.trim();
      appData.rpConfig.charRole = document.getElementById('rp-char-role-input').value.trim();
      appData.rpConfig.style = document.getElementById('rp-style-input').value.trim();

      localStorage.setItem('momo_rp_config', JSON.stringify(appData.rpConfig));
      document.getElementById('rp-badge-scenario').innerText = '场景：' + (appData.rpConfig.scenario.slice(0, 10) + '...');
      toggleRpDrawer();
      alert('剧场情境已更新，绪言就位！');
    }

    let rpStreamingReply = null;
    let rpStreamingFramePending = false;
    let rpMenuIndex = -1;
    let rpEditIndex = -1;
    let rpQuoteData = null;
    let rpMultiMode = false;
    let rpSelectedIndices = new Set();

    function rpEscapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function updateRpStreamingText() {
      if (!rpStreamingReply || rpStreamingFramePending) return;
      const paint = function() {
        rpStreamingFramePending = false;
        if (!rpStreamingReply) return;
        const target = document.getElementById('rp-streaming-text');
        if (target) {
          target.textContent = rpStreamingReply.text || '……';
          const stream = document.getElementById('rp-stream-container');
          if (stream) stream.scrollTop = stream.scrollHeight;
        }
      };
      rpStreamingFramePending = true;
      if (window.requestAnimationFrame) requestAnimationFrame(paint);
      else setTimeout(paint, 16);
    }

    function renderRpStream() {
      const stream = document.getElementById('rp-stream-container');
      if (!stream) return;
      stream.innerHTML = '';
      appData.rpHistory.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'rp-card-entry';
        card.dataset.rpIndex = String(index);
        if (rpMultiMode && rpSelectedIndices.has(index)) card.classList.add('rp-selected');
        const actionText = extractRpStoryText(item.action || '');
        const spokenText = extractRpStoryText(item.spoken || '');
        card.innerHTML = `
          <div class="rp-card-top">
            <span class="rp-char-name">${item.char}</span>
            <span style="font-size: 11px; color: var(--text-muted);">${item.role === 'user' ? '玩家行动' : '剧场演绎'}</span>
          </div>
          ${actionText ? `<div class="rp-action-text">${actionText}</div>` : ''}
          ${spokenText ? `<div class="rp-spoken-text">${spokenText}</div>` : ''}
        `;
        bindRpCardLongPress(card, index);
        stream.appendChild(card);
      });
      if (rpStreamingReply) {
        const card = document.createElement('div');
        card.className = 'rp-card-entry';
        card.id = 'rp-streaming-card';
        card.innerHTML = `
          <div class="rp-card-top">
            <span class="rp-char-name">${rpEscapeHtml(rpStreamingReply.char)}</span>
            <span style="font-size: 11px; color: var(--text-muted);">生成中…</span>
          </div>
          <div class="rp-spoken-text" id="rp-streaming-text" style="white-space: pre-wrap;">${rpEscapeHtml(rpStreamingReply.text || '……')}</div>
        `;
        stream.appendChild(card);
      }
      stream.scrollTop = stream.scrollHeight;
    }

    // ===== 剧场消息：长按菜单 / 引用 / 复制 / 编辑 / 多选 / 删除 =====
    function hideRpMsgMenu() {
      const menu = document.getElementById('rp-msg-menu');
      if (menu) menu.classList.remove('open');
    }

    function openRpMsgMenu(index) {
      if (rpMultiMode) return;
      rpMenuIndex = index;
      const menu = document.getElementById('rp-msg-menu');
      if (menu) menu.classList.add('open');
    }

    window.closeRpMsgMenu = function() {
      hideRpMsgMenu();
      rpMenuIndex = -1;
    };

    function bindRpCardLongPress(card, index) {
      let pressTimer = null;
      let startX = 0;
      let startY = 0;
      let longPressed = false;

      const clearPress = function() {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };
      const startPress = function(x, y) {
        startX = x;
        startY = y;
        longPressed = false;
        clearPress();
        pressTimer = setTimeout(function() {
          longPressed = true;
          openRpMsgMenu(index);
        }, 450);
      };
      const movePress = function(x, y) {
        if (Math.abs(x - startX) > 12 || Math.abs(y - startY) > 12) clearPress();
      };
      const endPress = function() {
        clearPress();
      };

      card.addEventListener('touchstart', function(e) {
        if (rpMultiMode || !e.touches || !e.touches[0]) return;
        startPress(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      card.addEventListener('touchmove', function(e) {
        if (!e.touches || !e.touches[0]) return;
        movePress(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      card.addEventListener('touchend', endPress);
      card.addEventListener('touchcancel', endPress);

      card.addEventListener('mousedown', function(e) {
        if (rpMultiMode || e.button !== 0) return;
        startPress(e.clientX, e.clientY);
      });
      card.addEventListener('mousemove', function(e) {
        if (!pressTimer) return;
        movePress(e.clientX, e.clientY);
      });
      card.addEventListener('mouseup', endPress);
      card.addEventListener('mouseleave', endPress);

      card.addEventListener('contextmenu', function(e) {
        if (rpMultiMode) return;
        e.preventDefault();
        openRpMsgMenu(index);
      });

      card.addEventListener('click', function(e) {
        if (rpMultiMode) {
          e.preventDefault();
          toggleRpSelected(index);
          return;
        }
        if (longPressed) {
          e.preventDefault();
          longPressed = false;
        }
      });
    }

    function rpMessageBody(item) {
      if (!item) return '';
      return [extractRpStoryText(item.action || ''), extractRpStoryText(item.spoken || '')]
        .filter(Boolean).join('\n').trim();
    }

    function rpMessageSender(item) {
      return (item && item.char) ? item.char : theaterCharacterName();
    }

    function persistRpHistory() {
      try {
        localStorage.setItem('momo_rp_history', JSON.stringify(appData.rpHistory));
      } catch (e) {}
    }

    function copyRpMessage(text) {
      const fallbackCopy = function() {
        try {
          const helper = document.createElement('textarea');
          helper.value = text;
          helper.style.position = 'fixed';
          helper.style.opacity = '0';
          document.body.appendChild(helper);
          helper.select();
          document.execCommand('copy');
          document.body.removeChild(helper);
        } catch (e) {}
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    }

    function showRpQuote(item) {
      if (!item) return;
      rpQuoteData = {
        sender: rpMessageSender(item),
        text: rpMessageBody(item).slice(0, 120)
      };
      const bar = document.getElementById('rp-quote-bar');
      const tag = document.getElementById('rp-quote-tag');
      const snippet = document.getElementById('rp-quote-snippet');
      if (bar) bar.style.display = 'flex';
      if (tag) tag.textContent = '回复 ' + rpQuoteData.sender + '：';
      if (snippet) snippet.textContent = rpQuoteData.text;
      const input = document.getElementById('rp-input-field');
      if (input) input.focus();
    }

    window.cancelRpQuote = function() {
      rpQuoteData = null;
      const bar = document.getElementById('rp-quote-bar');
      if (bar) bar.style.display = 'none';
    };

    function openRpEditModal(index) {
      const item = appData.rpHistory[index];
      if (!item) return;
      rpEditIndex = index;
      const modal = document.getElementById('rp-edit-modal');
      const area = document.getElementById('rp-edit-textarea');
      if (area) area.value = rpMessageBody(item);
      if (modal) modal.style.display = 'flex';
      if (area) {
        area.focus();
        area.setSelectionRange(area.value.length, area.value.length);
      }
    }

    window.closeRpEditModal = function() {
      const modal = document.getElementById('rp-edit-modal');
      if (modal) modal.style.display = 'none';
      rpEditIndex = -1;
    };

    window.saveRpEditMessage = function() {
      const item = appData.rpHistory[rpEditIndex];
      const area = document.getElementById('rp-edit-textarea');
      if (!item || !area) return;
      const rawText = area.value.trim();
      if (!rawText) {
        alert('消息不能为空。');
        return;
      }
      let action = '';
      let spoken = rawText;
      const actMatch = rawText.match(/\*([^*]+)\*/);
      if (actMatch) {
        action = '*' + actMatch[1] + '*';
        spoken = rawText.replace(/\*([^*]+)\*/, '').trim();
      }
      item.action = action;
      item.spoken = spoken;
      persistRpHistory();
      closeRpEditModal();
      renderRpStream();
    };

    function syncRpMultiUI() {
      const screen = document.querySelector('.rp-theater-screen');
      const count = document.getElementById('rp-multi-count');
      if (screen) screen.classList.toggle('rp-multi-mode', rpMultiMode);
      if (count) count.textContent = '已选择 ' + rpSelectedIndices.size + ' 项';
    }

    function enterRpMultiSelect(index) {
      rpMultiMode = true;
      rpSelectedIndices.clear();
      if (typeof index === 'number' && index >= 0) rpSelectedIndices.add(index);
      syncRpMultiUI();
      renderRpStream();
    }

    window.exitRpMultiSelect = function() {
      rpMultiMode = false;
      rpSelectedIndices.clear();
      syncRpMultiUI();
      renderRpStream();
    };

    function toggleRpSelected(index) {
      if (rpSelectedIndices.has(index)) rpSelectedIndices.delete(index);
      else rpSelectedIndices.add(index);
      syncRpMultiUI();
      renderRpStream();
    }

    window.deleteRpSelected = function() {
      if (!rpSelectedIndices.size) return;
      if (!confirm('删除选中的 ' + rpSelectedIndices.size + ' 条消息？会同时从剧场上下文和本地记录里移除。')) return;
      appData.rpHistory = appData.rpHistory.filter((item, index) => !rpSelectedIndices.has(index));
      persistRpHistory();
      exitRpMultiSelect();
      if (rpStreamingReply) {
        renderRpStream();
      }
    };

    window.rpMsgAction = function(action) {
      const index = rpMenuIndex;
      const item = appData.rpHistory[index];
      hideRpMsgMenu();
      if (!item) return;

      if (action === 'reply') {
        showRpQuote(item);
      } else if (action === 'copy') {
        copyRpMessage(rpMessageBody(item));
      } else if (action === 'edit') {
        openRpEditModal(index);
      } else if (action === 'select') {
        enterRpMultiSelect(index);
      } else if (action === 'delete') {
        if (confirm('删除这条消息？会同时从剧场上下文和本地记录里移除。')) {
          appData.rpHistory.splice(index, 1);
          persistRpHistory();
          renderRpStream();
        }
      }
      rpMenuIndex = -1;
    };

    // ===== 剧场 + 抽屉 =====
    window.toggleRpPlusDrawer = function() {
      const drawer = document.getElementById('rp-plus-drawer');
      if (drawer) drawer.classList.toggle('open');
    };

    function closeRpPlusDrawer() {
      const drawer = document.getElementById('rp-plus-drawer');
      if (drawer) drawer.classList.remove('open');
    }

    window.rpPlusContinue = function() {
      closeRpPlusDrawer();
      continueRpGenerate();
    };

    window.rpPlusRegenerate = function() {
      closeRpPlusDrawer();
      regenerateRpLast();
    };

    window.rpPlusRoleplay = function() {
      closeRpPlusDrawer();
      const select = document.getElementById('rp-actor-select');
      if (select) {
        select.focus();
        select.click();
      }
    };

    window.rpPlusNotReady = function(label) {
      alert(label + '：剧场这边还没接上传/文件/文字图入口，这次先把继续回应和重新生成接上了。');
    };

    window.rpPlusNarrationInfo = function() {
      alert('剧场的动作/旁白描述是默认内置在输出规范里的，不需要另外开关。');
    };


    
    async function handleSendRp() {
      const input = document.getElementById('rp-input-field');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      closeRpPlusDrawer();

      let sendText = text;
      if (rpQuoteData) {
        sendText = '（回复 ' + rpQuoteData.sender + '：“' + rpQuoteData.text + '”）\n' + text;
        cancelRpQuote();
      }

      let action = '';
      let spoken = sendText;
      const actMatch = sendText.match(/\*([^*]+)\*/);
      if (actMatch) {
        action = '*' + actMatch[1] + '*';
        spoken = sendText.replace(/\*([^*]+)\*/, '').trim();
      }

      appData.rpHistory.push({
        role: 'user',
        char: appData.rpConfig.userRole.split(' ')[0] || 'user',
        action: action,
        spoken: spoken
      });
      renderRpStream();
      localStorage.setItem('momo_rp_history', JSON.stringify(appData.rpHistory));

      triggerRpAiTurn();
    }

    function theaterBuiltinEnabled(id) {
      try {
        if (window.PromptPresets && typeof window.PromptPresets.isEnabled === 'function') {
          return window.PromptPresets.isEnabled(id, 'theater');
        }
      } catch (e) {}
      return true;
    }

    function buildTheaterPrompt(extraInstruction = '') {
      const s = appData.storySettings || {};
      const c = appData.rpConfig || {};
      const charName = theaterCharacterName();
      const parts = ['你正在与user进行高品质沉浸式双人小说/跑团剧场。'];
      if (theaterBuiltinEnabled('theater_stage')) {
        parts.push('### 舞台情境：\n' + (s.scenario || c.scenario || ''));
      }
      if (theaterBuiltinEnabled('theater_role')) {
        parts.push('### 扮演角色（' + charName + '）：\n' + theaterCharacterPersona());
      }
      if (theaterBuiltinEnabled('worldbook')) {
        const worldText = theaterWorldbookText();
        if (worldText) parts.push('### 世界书背景：\n' + worldText);
      }
      if (theaterBuiltinEnabled('theater_narrative')) {
        const styleText = String(s.stylePrompt || '').replace(/周绪言/g, charName).replace(/绪言/g, charName);
        parts.push('### 叙事人称与文风约束：\n- 叙事人称：' + (s.pov || '跟随文风') +
          '\n- 文风要求：' + styleText +
          '\n- 字数要求：回复长度严格控制在 ' + (s.minWords || 300) + ' 字到 ' + (s.maxWords || 800) + ' 字之间，饱满生动。');
      }
      if (theaterBuiltinEnabled('theater_output')) {
        parts.push('### 输出规范：\n动作神态环境描写用星号*包裹*，台词用引号包裹。');
      }
      if (theaterBuiltinEnabled('theater_continuity')) {
        parts.push('### 场景连续性：\n记住上一幕的场景、动作、情绪和没说完的话；除非剧情明确推进，不要突然换场、跳时间或重置关系。');
      }
      if (theaterBuiltinEnabled('theater_npc')) {
        parts.push('### 配角与旁白：\n你可以控制配角、环境和旁白，但不要替 user 决定她的动作、台词和内心；给 user 留出回应空间。');
      }
      if (theaterBuiltinEnabled('theater_boundary')) {
        parts.push('### 剧场边界：\n保持角色和世界观，不突然以 AI 或系统身份出戏；用户没有给出的信息，不要凭空补成既定事实。');
      }
      if (extraInstruction) parts.push('### 本轮导演指令：\n' + extraInstruction);
      parts.push('### 剧场展示硬约束：\n剧场只展示故事正文，不展示思考过程、资料确认、角色分析、行为推演、创作沙盘、字数规划、写作提纲、状态栏、记忆水晶或剧情选项。\n如果使用了酒馆预设的标签体系，小说正文必须放在 <zw> 与 </zw> 之间；<thinking>、<tuiyan>、<ztl>、<Options>、<details> 等前置或后置块可以按预设生成，但不会展示，也不要把它们写进 <zw> 里。\n若没有标签，直接从场景、动作或台词开始写正文，不要输出任何以【确认基本资料】【角色分析】【行为推演】【字数与规范】开头的分析段落，不要使用“首先/接下来/按照要求”这类规划口吻。\n正文保留自然分段，段落之间空一行；动作神态用 *...* 包裹，台词用引号包裹。');
      return parts.join('\n\n');
    }

    function lastTheaterUserMessage() {
      const history = appData.rpHistory || [];
      for (let i = history.length - 1; i >= 0; i -= 1) {
        const item = history[i];
        if (item && item.role === 'user') {
          return String((item.action || '') + ' ' + (item.spoken || '')).trim();
        }
      }
      return '';
    }

    window.getTheaterSystemPrompt = function(options) {
      const opts = options || {};
      const base = buildTheaterPrompt(opts.extraInstruction || '');
      if (opts.skipPreset) return base;
      if (!window.PromptPresets || typeof window.PromptPresets.apply !== 'function') return base;
      const charName = theaterCharacterName();
      const userName = String((appData.rpConfig && appData.rpConfig.userRole) || 'user').split(/\s+/)[0] || 'user';
      return window.PromptPresets.apply(base, {
        scope: 'theater',
        charName: charName,
        userName: userName,
        userRemark: userName,
        lastUserMessage: lastTheaterUserMessage()
      });
    };

    function extractRpStreamDelta(data) {
      const choice = data && data.choices && data.choices[0] || {};
      const delta = choice.delta || {};
      if (typeof delta.content === 'string') return delta.content;
      if (Array.isArray(delta.content)) {
        return delta.content.map(part => (part && (part.text || part.content)) || '').join('');
      }
      if (typeof choice.text === 'string') return choice.text;
      return '';
    }

    // 酒馆预设常把 <thinking> / <tuiyan> / <ztl> 等块放在正文前。
    // 剧场只消费 <zw> 里的正文；没有 <zw> 时去掉这些块，再取剩余文本。
    const RP_STORY_BLOCK_TAGS = ['thinking', 'think', 'tuiyan', 'ztl', 'Options', 'details', '星际物理随堂考'];
    const RP_META_HEADINGS = ['确认基本资料', '基础企划', '角色分析', '立体角色分析', '灵动角色分析', '行为推演', '剧情审查', '剧情安排', '剧情同人', '输出风格', '叙事风格', '字数与规范', '写作规范', '输出规范', '创作推演', '创作沙盘', '全景创作沙盘', '设定确认', '资料确认', '章节安排', '剧情大纲'];

    function stripRpStoryBlocks(text) {
      let value = String(text || '');
      RP_STORY_BLOCK_TAGS.forEach(function(tag) {
        const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>[\\s\\S]*?<\\/' + tag + '>', 'gi');
        value = value.replace(re, '');
      });
      // 流式输出到一半时，未闭合的思考/沙盘块整段丢弃，避免先漏出思考链。
      RP_STORY_BLOCK_TAGS.forEach(function(tag) {
        const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>[\\s\\S]*$', 'gi');
        value = value.replace(re, '');
      });
      value = value.replace(/<\/?(?:zw|thinking|think|tuiyan|ztl|Options|details|星际物理随堂考)(?:\s[^>]*)?>/gi, '');
      return value;
    }

    function extractRpStoryText(raw) {
      let text = String(raw || '');
      const open = text.match(/<zw(?:\s[^>]*)?>/i);
      if (open && typeof open.index === 'number') {
        let body = text.slice(open.index + open[0].length);
        const close = body.search(/<\/zw>/i);
        if (close >= 0) body = body.slice(0, close);
        text = body;
      } else {
        text = stripRpStoryBlocks(text);
      }
      text = stripRpStoryBlocks(text);
      text = text.replace(/<\/?zw(?:\s[^>]*)?>/gi, '');
      // 去掉正文前残留的“确认基本资料 / 角色分析 / 字数规范”等预设提纲段。
      const headingPattern = RP_META_HEADINGS.join('|');
      text = text.replace(new RegExp('^\\s*(?:#{1,6}\\s*)?(?:【(?:(?:' + headingPattern + ')[^】]*)】[^\\n]*(?:\\n|$))+', 'i'), '');
      text = text.replace(/^\s*(?:正文|小说正文)\s*[:：]\s*/i, '');
      return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/<[^>\n]{0,24}$/g, '').replace(/^\s+|\s+$/g, '');
    }

    function extractRpFullText(data) {
      const choice = data && data.choices && data.choices[0] || {};
      const message = choice.message || {};
      if (typeof message.content === 'string') return message.content;
      if (Array.isArray(message.content)) {
        return message.content.map(part => (part && (part.text || part.content)) || '').join('');
      }
      if (typeof choice.text === 'string') return choice.text;
      if (typeof data.content === 'string') return data.content;
      if (typeof data.output_text === 'string') return data.output_text;
      return '';
    }

    async function readRpSse(response, onDelta) {
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new Error('当前接口没有返回可读的流');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let finished = false;
      const handleLine = function(line) {
        if (!line || line.charAt(0) === ':') return false;
        if (line.indexOf('data:') !== 0) return false;
        const payload = line.slice(5).trim();
        if (!payload) return false;
        if (payload === '[DONE]') return true;
        let data;
        try { data = JSON.parse(payload); } catch (e) { return false; }
        if (data && data.error) throw new Error((data.error.message || data.error) + '');
        const text = extractRpStreamDelta(data);
        if (text) {
          full += text;
          onDelta(text);
        }
        return false;
      };
      while (!finished) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          if (handleLine(line)) {
            finished = true;
            break;
          }
          newline = buffer.indexOf('\n');
        }
      }
      if (!finished && buffer.trim()) handleLine(buffer.replace(/\r$/, ''));
      return full;
    }

    async function requestRpReply(body, onDelta, useStream) {
      const notify = typeof onDelta === 'function' ? onDelta : function() {};
      let cleanBase = String(appData.apiBase || '').replace(/\/+$/, '');
      if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';
      const payload = Object.assign({}, body);
      if (useStream) payload.stream = true;
      const response = await fetch(cleanBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + appData.apiKey
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        let detail = '';
        try { detail = (await response.text()).slice(0, 240); } catch (e) { detail = ''; }
        throw new Error('请求失败 ' + response.status + (detail ? '：' + detail : ''));
      }
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!useStream || contentType.indexOf('application/json') >= 0) {
        const data = await response.json();
        const full = extractRpFullText(data);
        if (!full) throw new Error('接口没有返回正文');
        notify(full);
        return full;
      }
      if (contentType.indexOf('text/event-stream') < 0 && !response.body) {
        const text = await response.text();
        const full = extractRpFullText((function() { try { return JSON.parse(text); } catch (e) { return {}; } })());
        if (full) { notify(full); return full; }
        throw new Error('接口返回格式无法识别');
      }
      const full = await readRpSse(response, notify);
      if (!full.trim()) throw new Error('流式接口没有返回正文');
      return full;
    }

    async function triggerRpAiTurn(extraInstruction = '') {
      if (!appData.apiKey) {
        alert('请先去设置页面填入 API Key 唤醒大脑。');
        openPage('page-api');
        return;
      }

      const rpSystemPrompt = window.getTheaterSystemPrompt({ extraInstruction: extraInstruction });
      const charName = theaterCharacterName();
      const userName = String((appData.rpConfig && appData.rpConfig.userRole) || 'user').split(/\s+/)[0] || 'user';

      const depth = Math.max(1, parseInt((appData.storySettings && appData.storySettings.contextDepth), 10) || 30);
      const recentTurns = appData.rpHistory.slice(-depth).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: `${m.action || ''} ${m.spoken || ''}`
      }));
      const injectedTurns = (function() {
        if (!window.PromptPresets || typeof window.PromptPresets.injectMessages !== 'function') return recentTurns;
        try {
          return window.PromptPresets.injectMessages(recentTurns, {
            scope: 'theater',
            charName: charName,
            userName: userName,
            userRemark: userName,
            lastUserMessage: lastTheaterUserMessage()
          });
        } catch (e) {
          console.warn('[PromptPresets] 剧场角色/深度注入失败：', e && e.message ? e.message : e);
          return recentTurns;
        }
      })();

      let streamedAny = false;
      let rawReply = '';
      rpStreamingReply = { char: charName, text: '' };
      renderRpStream();
      const consumeReplyDelta = function(delta) {
        rawReply += delta;
        rpStreamingReply.text = extractRpStoryText(rawReply);
        updateRpStreamingText();
      };
      try {
        const requestBody = {
          model: appData.model || 'deepseek-chat',
          messages: [{ role: 'system', content: rpSystemPrompt }, ...injectedTurns],
          temperature: 0.88
        };
        let reply = '';
        if (appData.storySettings.streamOutput !== false) {
          try {
            reply = await requestRpReply(requestBody, function(delta) {
              streamedAny = true;
              consumeReplyDelta(delta);
            }, true);
          } catch (streamErr) {
            if (streamedAny) throw streamErr;
            console.warn('[剧场] 流式不可用，回退非流式：', streamErr && streamErr.message ? streamErr.message : streamErr);
            rpStreamingReply.text = '';
            rawReply = '';
          }
        }
        if (!reply) {
          reply = await requestRpReply(requestBody, consumeReplyDelta, false);
        }
        if (!reply || !String(reply).trim()) throw new Error('模型没有返回内容');

        const storyText = extractRpStoryText(reply);
        if (!storyText.trim()) throw new Error('模型只返回了思考/规划内容，没有返回可展示的正文');
        reply = storyText;

        let botAction = '';
        let botSpoken = reply;
        const bMatch = reply.match(/\*([^*]+)\*/);
        if (bMatch) {
          botAction = '*' + bMatch[1] + '*';
          botSpoken = reply.replace(/\*([^*]+)\*/, '').trim();
        }

        appData.rpHistory.push({
          role: 'assistant',
          char: charName,
          action: botAction,
          spoken: botSpoken
        });
        localStorage.setItem('momo_rp_history', JSON.stringify(appData.rpHistory));
        rpStreamingReply = null;
        renderRpStream();
      } catch (err) {
        rpStreamingReply = null;
        renderRpStream();
        alert('剧场连线异常：' + (err && err.message ? err.message : err));
      }
    }

    function toggleRpActionHint() {
      const f = document.getElementById('rp-input-field');
      f.value = '*走到他身旁坐下，轻轻把头靠在他的肩窝里* ';
      f.focus();
    }

    function resetRpHistory() {
      if (confirm('确认重置当前剧场的剧本对话？')) {
        appData.rpHistory = [];
        localStorage.removeItem('momo_rp_history');
        renderRpStream();
        toggleRpDrawer();
      }
    }

    // ===== 此时此刻：独立剧场背景（只作用 #page-rp） =====
    const RP_WALL_PRESETS = {
      paper: { name: '米纸', css: 'linear-gradient(150deg, #f7f2e7 0%, #e7dece 100%)' }
    };
    const RP_WALL_KEYS = {
      preset: 'momo_rp_wall_preset',
      color: 'momo_rp_wall_color',
      image: 'momo_rp_wall_image',
      undo: 'momo_rp_wall_undo',
      colors: 'momo_rp_wall_colors',
      photos: 'momo_rp_wall_photos',
      dim: 'momo_rp_wall_dim'
    };
    const RP_WALL_PHOTO_MAX = 4;
    const RP_WALL_COLOR_MAX = 8;

    function readRpWall() {
      let preset = '', color = '', image = '', dim = 48;
      try { preset = localStorage.getItem(RP_WALL_KEYS.preset) || ''; } catch (e) {}
      try { color = localStorage.getItem(RP_WALL_KEYS.color) || ''; } catch (e) {}
      try { image = localStorage.getItem(RP_WALL_KEYS.image) || ''; } catch (e) {}
      try { dim = Number(localStorage.getItem(RP_WALL_KEYS.dim)); } catch (e) {}
      if (!RP_WALL_PRESETS[preset]) preset = '';
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = '';
      if (image.indexOf('data:image/') !== 0) image = '';
      if (!Number.isFinite(dim)) dim = 48;
      dim = Math.max(0, Math.min(80, dim));
      return { preset: preset, color: color.toLowerCase(), image: image, dim: dim };
    }

    function writeRpWall(next) {
      const s = {
        preset: (next && RP_WALL_PRESETS[next.preset]) ? next.preset : '',
        color: (next && /^#[0-9a-fA-F]{6}$/.test(next.color || '')) ? String(next.color).toLowerCase() : '',
        image: (next && String(next.image || '').indexOf('data:image/') === 0) ? next.image : '',
        dim: Math.max(0, Math.min(80, Number(next && next.dim) || 0))
      };
      try {
        if (s.preset) localStorage.setItem(RP_WALL_KEYS.preset, s.preset);
        else localStorage.removeItem(RP_WALL_KEYS.preset);
        if (s.color) localStorage.setItem(RP_WALL_KEYS.color, s.color);
        else localStorage.removeItem(RP_WALL_KEYS.color);
        if (s.image) localStorage.setItem(RP_WALL_KEYS.image, s.image);
        else localStorage.removeItem(RP_WALL_KEYS.image);
        localStorage.setItem(RP_WALL_KEYS.dim, String(s.dim));
      } catch (e) {
        alert('剧场背景存不下：这张图太大，换一张小一点的，或删掉「我的图片」里的一张再试。');
      }
      return s;
    }

    function snapshotRpWall() {
      try { localStorage.setItem(RP_WALL_KEYS.undo, JSON.stringify(readRpWall())); } catch (e) {}
    }

    function applyRpWall() {
      const layer = document.getElementById('rp-wallpaper-bg');
      const page = document.getElementById('page-rp');
      if (!layer) return;
      const s = readRpWall();
      let bgImage = '';
      let bgColor = '';
      if (s.preset) bgImage = RP_WALL_PRESETS[s.preset].css;
      else if (s.image) bgImage = 'url("' + s.image + '")';
      else if (s.color) bgColor = s.color;

      if (bgImage || bgColor) {
        if (page) page.classList.add('rp-has-wallpaper');
        layer.style.display = 'block';
        layer.style.backgroundImage = bgImage || 'none';
        layer.style.backgroundColor = bgColor;
        layer.style.setProperty('--rp-wall-dim', String(s.dim / 100));
      } else {
        if (page) page.classList.remove('rp-has-wallpaper');
        layer.style.display = 'none';
        layer.style.backgroundImage = 'none';
        layer.style.backgroundColor = '';
        layer.style.removeProperty('--rp-wall-dim');
      }
      syncRpWallPreview();
    }

    function syncRpWallPreview() {
      const s = readRpWall();
      const preview = document.getElementById('rp-wall-preview');
      if (!preview) return;
      if (s.preset) {
        preview.style.backgroundImage = RP_WALL_PRESETS[s.preset].css;
        preview.style.backgroundColor = '';
      } else if (s.image) {
        preview.style.backgroundImage = 'url("' + s.image + '")';
        preview.style.backgroundColor = '';
      } else {
        preview.style.backgroundImage = 'none';
        preview.style.backgroundColor = s.color || '';
      }
    }

    function readRpWallColors() {
      let list = [];
      try { list = JSON.parse(localStorage.getItem(RP_WALL_KEYS.colors) || '[]'); } catch (e) { list = []; }
      if (!Array.isArray(list)) list = [];
      return list.filter(function(c) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')); })
                 .map(function(c) { return String(c).toLowerCase(); })
                 .slice(0, RP_WALL_COLOR_MAX);
    }

    function writeRpWallColors(list) {
      try { localStorage.setItem(RP_WALL_KEYS.colors, JSON.stringify(list.slice(0, RP_WALL_COLOR_MAX))); } catch (e) {}
    }

    function pushRpWallColor(hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
      const c = String(hex).toLowerCase();
      const list = readRpWallColors().filter(function(old) { return old !== c; });
      list.unshift(c);
      writeRpWallColors(list);
      renderRpWallColors();
    }

    function renderRpWallColors() {
      const box = document.getElementById('rp-wall-colors');
      if (!box) return;
      const list = readRpWallColors();
      const cur = readRpWall().color;
      box.innerHTML = '';
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'rp-wall-empty';
        empty.textContent = '还没调过色，调一次就会存进这里。';
        box.appendChild(empty);
      } else {
        list.forEach(function(hex) {
          const d = document.createElement('div');
          d.className = 'rp-wall-color-dot' + (hex === cur ? ' active' : '');
          d.style.background = hex;
          d.title = hex + '　点一下切回这个颜色';
          d.onclick = function() { window.applyRpWallColor(hex); };
          box.appendChild(d);
        });
      }
      const cnt = document.getElementById('rp-wall-colors-count');
      if (cnt) cnt.textContent = list.length ? list.length + ' / ' + RP_WALL_COLOR_MAX : '';
    }

    function readRpWallPhotos() {
      let list = [];
      try { list = JSON.parse(localStorage.getItem(RP_WALL_KEYS.photos) || '[]'); } catch (e) { list = []; }
      if (!Array.isArray(list)) list = [];
      list = list.filter(function(it) { return typeof it === 'string' && it.indexOf('data:image/') === 0; });
      return list.slice(0, RP_WALL_PHOTO_MAX);
    }

    function writeRpWallPhotos(list) {
      try {
        localStorage.setItem(RP_WALL_KEYS.photos, JSON.stringify(list.slice(0, RP_WALL_PHOTO_MAX)));
        return true;
      } catch (e) {
        alert('存不下了：剧场背景图太大，先删掉「我的图片」里的一两张再上传。');
        return false;
      }
    }

    function renderRpWallPhotos() {
      const box = document.getElementById('rp-wall-photos');
      if (!box) return;
      const list = readRpWallPhotos();
      const cur = readRpWall().image;
      box.innerHTML = '';
      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'rp-wall-empty';
        empty.textContent = '还没有存过，上传一张就自动躺在这里。';
        box.appendChild(empty);
      } else {
        list.forEach(function(data, i) {
          const t = document.createElement('div');
          t.className = 'rp-wall-photo' + (data === cur ? ' active' : '');
          t.style.backgroundImage = 'url("' + data + '")';
          t.title = '点一下切到这张';
          t.onclick = function(ev) { if (ev.target === t) window.applyRpWallPhoto(i); };
          const del = document.createElement('div');
          del.className = 'rp-wall-photo-del';
          del.textContent = '✕';
          del.title = '删掉这张';
          del.onclick = function(ev) { ev.stopPropagation(); window.removeRpWallPhoto(i); };
          t.appendChild(del);
          box.appendChild(t);
        });
      }
      const cnt = document.getElementById('rp-wall-photos-count');
      if (cnt) cnt.textContent = list.length ? list.length + ' / ' + RP_WALL_PHOTO_MAX : '';
    }

    function syncRpWallUI() {
      const s = readRpWall();
      const effective = s.preset ? s.preset : (s.image ? 'image' : (s.color ? 'solid' : ''));
      document.querySelectorAll('#rp-wall-card .rp-wall-tile').forEach(function(tile) {
        tile.classList.toggle('active', tile.getAttribute('data-rp-wall') === effective);
      });
      const colorInput = document.getElementById('rp-wall-color');
      if (colorInput) colorInput.value = s.color || '#1b2329';
      const swatch = document.getElementById('rp-wall-solid-swatch');
      if (swatch) swatch.style.background = colorInput ? colorInput.value : (s.color || '#1b2329');
      const dim = document.getElementById('rp-wall-dim');
      const dimVal = document.getElementById('rp-wall-dim-val');
      if (dim) dim.value = String(s.dim);
      if (dimVal) dimVal.textContent = Math.round(s.dim) + '%';
      renderRpWallColors();
      renderRpWallPhotos();
      syncRpWallPreview();
    }

    window.setRpWallPreset = function(id) {
      if (!RP_WALL_PRESETS[id]) return;
      snapshotRpWall();
      const s = readRpWall();
      const next = s.preset === id ? '' : id;
      writeRpWall({ preset: next, color: '', image: '', dim: s.dim });
      applyRpWall();
      syncRpWallUI();
      const h = document.getElementById('rp-wall-hint');
      if (h) h.textContent = next ? '已换成「' + RP_WALL_PRESETS[id].name + '」，只作用于此时此刻。' : '已撤下预设。';
    };

    window.pickRpWallSolid = function() {
      const c = document.getElementById('rp-wall-color');
      if (!c) return;
      const s = readRpWall();
      if (!s.color) window.setRpWallColor(c.value || '#1b2329');
      c.click();
    };

    window.setRpWallColor = function(hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
      const s = readRpWall();
      writeRpWall({ preset: '', color: String(hex).toLowerCase(), image: '', dim: s.dim });
      applyRpWall();
      syncRpWallUI();
    };

    window.rememberRpWallColor = function() {
      const colorInput = document.getElementById('rp-wall-color');
      if (colorInput && colorInput.value) pushRpWallColor(colorInput.value);
    };

    window.applyRpWallColor = function(hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
      window.setRpWallColor(hex);
      pushRpWallColor(hex);
      const h = document.getElementById('rp-wall-hint');
      if (h) h.textContent = '已应用自调纯色 ' + String(hex).toLowerCase() + '，此时此刻立刻换上了。';
    };

    window.applyRpWallSolid = function() {
      const c = document.getElementById('rp-wall-color');
      if (!c) return;
      window.applyRpWallColor(c.value);
    };

    window.setRpWallDim = function(v) {
      const s = readRpWall();
      const dim = Math.max(0, Math.min(80, Number(v) || 0));
      writeRpWall({ preset: s.preset, color: s.color, image: s.image, dim: dim });
      applyRpWall();
      const dimVal = document.getElementById('rp-wall-dim-val');
      if (dimVal) dimVal.textContent = Math.round(dim) + '%';
      syncRpWallUI();
    };

    window.resetRpWall = function() {
      snapshotRpWall();
      const s = readRpWall();
      writeRpWall({ preset: '', color: '', image: '', dim: s.dim });
      applyRpWall();
      syncRpWallUI();
      const h = document.getElementById('rp-wall-hint');
      if (h) h.textContent = '已恢复默认，剧场的皮肤底色回来了；聊天页没有被动过。';
    };

    window.restoreRpWall = function() {
      let prev = null;
      try { prev = JSON.parse(localStorage.getItem(RP_WALL_KEYS.undo) || 'null'); } catch (e) {}
      if (!prev) return;
      writeRpWall(prev);
      applyRpWall();
      syncRpWallUI();
      const h = document.getElementById('rp-wall-hint');
      if (h) h.textContent = '已找回上一次的剧场背景。';
    };

    window.triggerRpWallPick = function() {
      const input = document.getElementById('input-rp-bg');
      if (input) input.click();
    };

    window.uploadRpWallImage = async function(event) {
      const file = event && event.target && event.target.files && event.target.files[0];
      if (!file) return;
      try {
        let dataUrl = '';
        if (typeof compressImageBase64 === 'function') {
          dataUrl = await compressImageBase64(file, 1080, 0.82);
        } else {
          dataUrl = await new Promise(function(resolve, reject) {
            const reader = new FileReader();
            reader.onload = function() { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        if (!dataUrl) throw new Error('读取图片失败');
        snapshotRpWall();
        const list = readRpWallPhotos().filter(function(it) { return it !== dataUrl; });
        list.unshift(dataUrl);
        if (!writeRpWallPhotos(list)) return;
        const s = readRpWall();
        writeRpWall({ preset: '', color: '', image: dataUrl, dim: s.dim });
        applyRpWall();
        syncRpWallUI();
        const h = document.getElementById('rp-wall-hint');
        if (h) h.textContent = '已换成这张图片，只作用于此时此刻；也已存进「我的图片」。';
      } catch (err) {
        alert('剧场背景读取失败：' + (err && err.message ? err.message : err));
      } finally {
        if (event && event.target) event.target.value = '';
      }
    };

    window.applyRpWallPhoto = function(idx) {
      const list = readRpWallPhotos();
      if (!list[idx]) return;
      snapshotRpWall();
      const s = readRpWall();
      writeRpWall({ preset: '', color: '', image: list[idx], dim: s.dim });
      applyRpWall();
      syncRpWallUI();
    };

    window.removeRpWallPhoto = function(idx) {
      const list = readRpWallPhotos();
      if (!list[idx]) return;
      const s = readRpWall();
      const removedActive = s.image === list[idx];
      list.splice(idx, 1);
      if (!writeRpWallPhotos(list)) return;
      if (removedActive) writeRpWall({ preset: '', color: '', image: '', dim: s.dim });
      applyRpWall();
      syncRpWallUI();
    };

    window.syncRpWallUI = syncRpWallUI;
    window.applyRpWall = applyRpWall;

    syncRpStreamModeUI();
    syncRpActorUI();
    syncStoryOutlineUI();
    syncStorySkin();
    syncRpWallUI();
    applyRpWall();
    setTimeout(syncRpActorUI, 0);
    setTimeout(syncStoryOutlineUI, 0);
    setTimeout(syncStoryWbSummary, 0);
    window.syncRpActorUI = syncRpActorUI;
    window.syncStoryWbSummary = syncStoryWbSummary;
    window.setStorySkin = setStorySkin;

