
function openMottoEditSheet() {
  const current = appData.wechatMotto || '能永遠糾纏在一起嗎 頭髮 命運 你和我';
  openQuickTextModal('修改微信状态个性签名', '签名文案', current, (val) => {
    appData.wechatMotto = val.trim();
    localStorage.setItem('momo_wechat_motto', appData.wechatMotto);
    const el = document.getElementById('wechat-status-motto');
    if (el) el.innerText = appData.wechatMotto;
  });
}

// 微信朋友圈生态、聊天中约 25 条检查发圈与绪言秒赞秒评
    // ================= 微信四大底栏与朋友圈核心逻辑 =================
    let currentWechatTab = 'chats';
    let momentsDeleteMode = false;
    let pendingCommentMomentId = null;
    let newMomentPhotos = [];
    const MOMENT_MAX_PHOTOS = 9;

    // 初始化朋友圈默认数据
    const DEFAULT_MOMENTS = [];

    if (!appData.moments) {
      appData.moments = [];
      let hasLocalMoments = false;
      try {
        const localRaw = localStorage.getItem('momo_moments_data');
        if (localRaw !== null) {
          hasLocalMoments = true;
          let loadedMoments = JSON.parse(localRaw || '[]');
          if (!Array.isArray(loadedMoments) || loadedMoments.some(m => m.id === 'moment_bot_1' || m.id === 'moment_user_1')) {
            loadedMoments = [];
            try { localStorage.setItem('momo_moments_data', JSON.stringify([])); } catch(e){}
          }
          if (Array.isArray(loadedMoments)) appData.moments = loadedMoments;
        }
      } catch (e) {
        hasLocalMoments = false;
        appData.moments = DEFAULT_MOMENTS;
      }

      // 朋友圈图片超出 localStorage 配额时，备份导入会把数据放到 IndexedDB。
      // 这里异步接回，避免首次打开看到空朋友圈。
      if (!hasLocalMoments && typeof window.momoReadMomentsOverflow === 'function') {
        window.momoReadMomentsOverflow().then(function(raw) {
          if (!raw || (Array.isArray(appData.moments) && appData.moments.length)) return;
          try {
            const loadedMoments = JSON.parse(raw);
            if (Array.isArray(loadedMoments)) {
              appData.moments = loadedMoments;
              if (typeof renderMomentsFeed === 'function') renderMomentsFeed();
            }
          } catch (e) {}
        }).catch(function() {});
      }
    }
    if (!appData.momentsCover) {
      appData.momentsCover = localStorage.getItem('momo_moments_cover') || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&auto=format&fit=crop&q=80';
    }
    if (!appData.wechatMotto) {
      appData.wechatMotto = localStorage.getItem('momo_wechat_motto') || '能永遠糾纏在一起嗎 頭髮 命運 你和我';
    }
    // 聊天计步器：聊天中每约 25 条检查一次，一场聊天最多发一条
    let chatMessageTurnCounter = parseInt(localStorage.getItem('momo_chat_turn_counter') || '0', 10);
    const MOMENT_TURN_STATE_KEY = 'momo_moment_turn_state_v1';
    const MOMENT_AUTO_CHECK_EVERY = 25;
    // 同一角色两次动态之间至少间隔 2 小时
    const MOMENT_MIN_GAP_MS = 2 * 60 * 60 * 1000;
    let momentChatSession = { charId: '', sessionId: '', count: 0, posted: false };

    function readMomentTurnStateMap() {
      try {
        const raw = localStorage.getItem(MOMENT_TURN_STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
      } catch (e) {
        return {};
      }
    }

    function writeMomentTurnStateMap(map) {
      try { localStorage.setItem(MOMENT_TURN_STATE_KEY, JSON.stringify(map || {})); } catch (e) {}
    }

    function getMomentCharState(charId) {
      const map = readMomentTurnStateMap();
      const key = charId || 'default';
      return Object.assign({ lastType: '', lastMomentAt: 0 }, map[key] || {});
    }

    function setMomentCharState(charId, patch) {
      const map = readMomentTurnStateMap();
      const key = charId || 'default';
      map[key] = Object.assign({ lastType: '', lastMomentAt: 0 }, map[key] || {}, patch || {});
      writeMomentTurnStateMap(map);
    }

    function resetMomentChatSession(charId) {
      const key = charId || 'default';
      momentChatSession = {
        charId: key,
        sessionId: 'ms_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        count: 0,
        posted: false
      };
    }

    function momentLatestForChar(charId, charName) {
      let latest = 0;
      (appData.moments || []).forEach(function (m) {
        if (!m || m.authorRole !== 'bot') return;
        const same = (m.authorId && charId && m.authorId === charId) ||
          (!m.authorId && charName && m.authorName === charName);
        if (!same) return;
        const ts = Number(m.timestamp) || (m.createdAt ? Date.parse(m.createdAt) : 0) || 0;
        if (ts > latest) latest = ts;
      });
      return latest;
    }

    function momentHasRecentTopic() {
      const recent = (appData.chatHistory || []).filter(function (m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
      }).slice(-6);
      return recent.filter(function (m) {
        return m.role === 'user' && m.content.replace(/\[IMAGE:[\s\S]*?\]/g, '').trim().length >= 4;
      }).length >= 2;
    }

    function openWechatMain(initialTab) {
      openPage('page-wechat-main');
      switchWechatTab(initialTab || currentWechatTab || 'chats');
      syncWechatMainPreview();
    }

    function switchWechatTab(tabKey) {
      if (tabKey === 'discover') {
        openMomentsPage();
        return;
      }
      currentWechatTab = tabKey;
      document.body.setAttribute('data-wx-tab', tabKey);
      const dd = document.getElementById('wechat-plus-dropdown');
      if (dd) dd.style.display = 'none';
      const tabs = ['chats', 'contacts', 'discover', 'me'];
      tabs.forEach(t => {
        const btn = document.getElementById('btn-tab-' + t);
        const pane = document.getElementById('tab-pane-' + t);
        if (btn) btn.classList.toggle('active', t === tabKey);
        if (pane) pane.classList.toggle('active', t === tabKey);
      });

      const titleEl = document.getElementById('wechat-main-title-text');
      const searchWrap = document.getElementById('wechat-search-wrap');
      if (tabKey === 'chats') {
        if (titleEl) titleEl.innerText = '微信';
        if (searchWrap) searchWrap.style.display = 'block';
        syncWechatMainPreview();
      } else if (tabKey === 'contacts') {
        if (titleEl) titleEl.innerText = '通讯录';
        if (searchWrap) searchWrap.style.display = 'block';
        if (typeof renderContacts === 'function') renderContacts();
        if (typeof syncWechatContacts === 'function') syncWechatContacts();
      } else if (tabKey === 'discover') {
        if (titleEl) titleEl.innerText = '发现';
        if (searchWrap) searchWrap.style.display = 'none';
        syncWechatDiscover();
      } else if (tabKey === 'me') {
        if (titleEl) titleEl.innerText = '我';
        if (searchWrap) searchWrap.style.display = 'none';
        syncWechatMeTab();
      }
    }

    function toggleWechatPlusMenu() {
      const drop = document.getElementById('wechat-plus-dropdown');
      if (drop) {
        if (typeof window.syncWechatPlusMenu === 'function') window.syncWechatPlusMenu();
        drop.style.display = (drop.style.display === 'none' || !drop.style.display) ? 'block' : 'none';
      }
    }

    // 搜索会话
    function filterChatList(query) {
      const q = (query || '').toLowerCase().trim();
      if (typeof currentWechatTab !== 'undefined' && currentWechatTab === 'contacts') {
        document.querySelectorAll('#wx-contacts-list .wx-card').forEach(card => {
          const name = (card.querySelector('.contact-name') || {}).innerText || '';
          card.style.display = (!q || name.toLowerCase().includes(q)) ? 'flex' : 'none';
        });
        return;
      }
      const item = document.getElementById('wechat-active-session');
      if (item) {
        const remarkEl = document.getElementById('wechat-list-remark');
        const lastMsgEl = document.getElementById('wechat-list-lastmsg');
        const name = (remarkEl && remarkEl.innerText || '').toLowerCase();
        const snippet = (lastMsgEl && lastMsgEl.innerText || '').toLowerCase();
        if (!q || name.includes(q) || snippet.includes(q)) {
          if (appData.chatHistory && appData.chatHistory.length > 0) {
            item.style.display = 'flex';
          }
        } else {
          item.style.display = 'none';
        }
      }
    }

    function promptChangeMotto() {
      const current = appData.wechatMotto || '能永遠糾纏在一起嗎 頭髮 命運 你和我';
      const nextMotto = prompt('修改你的微信个性状态签名：', current);
      if (nextMotto !== null && nextMotto.trim()) {
        appData.wechatMotto = nextMotto.trim();
        localStorage.setItem('momo_wechat_motto', appData.wechatMotto);
        const el = document.getElementById('wechat-status-motto');
        if (el) el.innerText = appData.wechatMotto;
      }
    }

    // 同步会话列表预览
    function syncWechatMainPreview() {
      const remarkEl = document.getElementById('wechat-list-remark');
      const avatarEl = document.getElementById('wechat-list-avatar');
      const timeEl = document.getElementById('wechat-list-time');
      const lastMsgEl = document.getElementById('wechat-list-lastmsg');
      const mottoEl = document.getElementById('wechat-status-motto');
      const emptyHint = document.getElementById('wechat-empty-hint');
      const activeSession = document.getElementById('wechat-active-session');

      if (remarkEl) remarkEl.innerText = appData.botRemark || '角色';
      if (avatarEl) {
        avatarEl.src = appData.botAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80';
      }
      if (mottoEl) mottoEl.innerText = appData.wechatMotto || '生活明朗，万物可爱';

      const history = appData.chatHistory || [];
      if (history.length > 0) {
        if (emptyHint) emptyHint.style.display = 'none';
        if (activeSession) activeSession.style.display = 'flex';
        // 列表预览只认真正的聊天气泡：身份切换提示这类系统胶囊不占预览位。
        let last = history[history.length - 1];
        let taskPreview = '';
        for (let i = history.length - 1; i >= 0; i--) {
          const m = history[i];
          if (m && m.workTask && !taskPreview) {
            const liveTask = (window.WorkPack && typeof window.WorkPack.getTask === 'function')
              ? (window.WorkPack.getTask(m.workTask.id) || m.workTask)
              : m.workTask;
            const st = liveTask.status === 'done' ? '已完成'
              : (liveTask.status === 'error' ? '失败'
              : (liveTask.status === 'interrupted' ? '已中断'
              : (liveTask.status === 'superseded' ? '已转新任务' : '进行中')));
            taskPreview = '工作包 · ' + (liveTask.title || '任务') + ' · ' + st;
          }
          if (!m || m.hiddenFromView || m.role === 'system') continue;
          last = m;
          break;
        }
        if (timeEl) timeEl.innerText = last.time || getNowStr();
        if (lastMsgEl) {
          let rawTxt = last.content || '';
          if (rawTxt.includes('【心声】') || rawTxt.includes('【绪言心声】')) {
            const delimMatch = rawTxt.match(/(?:---|[*]{3}|===)/);
            if (delimMatch) {
              rawTxt = rawTxt.split(delimMatch[0]).slice(1).join(' ').trim();
            } else {
              rawTxt = rawTxt.replace(/^[【[](?:绪言)?心声[】]][\s\S]*?\n\n/i, '').trim();
            }
          }
          let cleanTxt = rawTxt
            .replace(/<[^>]+>/g, '')
            .replace(/[*（(][^*）)]+[*）)]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          lastMsgEl.innerText = cleanTxt || taskPreview || '【图片/表情】';
        }
      } else {
        if (emptyHint) emptyHint.style.display = 'none';
        // 清空聊天记录后对话框仍留在列表里；只是没有最后一条消息
        if (activeSession) activeSession.style.display = 'flex';
        if (timeEl) timeEl.innerText = '';
        if (lastMsgEl) lastMsgEl.innerText = '还没有消息 · 点开开始聊天';
      }
    }

    function syncWechatContacts() {
      const nameEl = document.getElementById('contact-name-text');
      const avatarEl = document.getElementById('contact-avatar-img');
      if (nameEl) nameEl.innerText = appData.botRemark || '角色';
      if (avatarEl) {
        avatarEl.src = appData.botAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80';
      }
    }

    function syncWechatDiscover() {
      const previewAvatar = document.getElementById('moments-preview-avatar');
      if (previewAvatar) {
        const botPost = (appData.moments || []).find(m => m.authorRole === 'bot');
        previewAvatar.src = (botPost && botPost.authorAvatar) || appData.botAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80';
      }
      syncMomentsUnread();
    }

    // ---------- 朋友圈红点：只有角色发了新动态才亮，进朋友圈即已读 ----------
    const MOMENTS_SEEN_KEY = 'momo_moments_seen_ids';

    function readSeenMomentIds() {
      try {
        const raw = localStorage.getItem(MOMENTS_SEEN_KEY);
        if (!raw) return null;
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : null;
      } catch (e) {
        return null;
      }
    }

    function writeSeenMomentIds(ids) {
      try { localStorage.setItem(MOMENTS_SEEN_KEY, JSON.stringify(ids || [])); } catch (e) {}
    }

    function setMomentsUnreadUI(count) {
      const dot = document.getElementById('discover-tab-dot');
      if (dot) dot.style.display = count > 0 ? 'block' : 'none';
      const badge = document.getElementById('moments-unread-badge');
      if (badge) {
        badge.style.display = '';
        const red = badge.querySelector('.discover-red-dot');
        if (red) red.style.display = count > 0 ? 'block' : 'none';
      }
      const main = document.getElementById('page-wechat-main');
      if (main) main.setAttribute('data-moments-unread', count > 0 ? '1' : '0');
    }

    function syncMomentsUnread() {
      const botIds = (appData.moments || [])
        .filter(m => m && m.authorRole === 'bot')
        .map(m => m.id);
      let seen = readSeenMomentIds();
      // 第一次运行没有基线：把当前已有的角色动态视为已读，避免一进来就永远红点。
      if (!seen) {
        seen = botIds.slice();
        writeSeenMomentIds(seen);
      }
      const unseen = botIds.filter(id => seen.indexOf(id) < 0).length;
      setMomentsUnreadUI(unseen);
      return unseen;
    }

    function markMomentsSeen() {
      const botIds = (appData.moments || [])
        .filter(m => m && m.authorRole === 'bot')
        .map(m => m.id);
      writeSeenMomentIds(botIds);
      setMomentsUnreadUI(0);
    }

    function syncWechatMeTab() {
      const avatar = document.getElementById('wechat-me-avatar');
      const name = document.getElementById('wechat-me-name');
      const tag = document.getElementById('wechat-me-tag');
      if (avatar) {
        avatar.src = appData.heroAvatar || localStorage.getItem('momo_hero_avatar') || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80';
      }
      if (name) name.innerText = appData.hero.userName || 'user';
      if (tag) tag.innerText = (appData.hero.userHandle || '@紫毛爱妻') + ' · ' + (appData.hero.userTag || '妻紫');
    }

    // ================= 朋友圈页面完整渲染与交互 =================
    function openMomentsPage() {
      openPage('page-moments');
      markMomentsSeen();
      renderMomentsFeed();
    }

    // ================= 朋友圈更换封面：iOS 原生相册与外链动作面板 =================
    function promptChangeMomentsCover() {
      const sheet = document.getElementById('moments-cover-sheet');
      if (sheet) sheet.classList.add('open');
    }

    function closeMomentsCoverSheet() {
      const sheet = document.getElementById('moments-cover-sheet');
      if (sheet) sheet.classList.remove('open');
    }

    // 从手机/电脑相册选择照片
    function triggerMomentsCoverAlbum() {
      closeMomentsCoverSheet();
      const inputEl = document.getElementById('input-moments-cover');
      if (inputEl) inputEl.click();
    }

    // 本地相册图片上传处理 (转为 Base64 并持久化存储)
    function handleMomentsCoverFileUpload(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        const base64Url = e.target.result;
        appData.momentsCover = base64Url;
        try {
          localStorage.setItem('momo_moments_cover', base64Url);
        } catch (err) {
          console.warn('LocalStorage limit:', err);
        }
        const coverEl = document.getElementById('moments-cover-image');
        if (coverEl) coverEl.style.backgroundImage = 'url("' + base64Url + '")';
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }

    // 输入网络外链
    function promptMomentsCoverUrl() {
      closeMomentsCoverSheet();
      setTimeout(() => {
        const current = appData.momentsCover || '';
        const url = prompt('输入新朋友圈封面背景图片链接：', current);
        if (url !== null && url.trim()) {
          appData.momentsCover = url.trim();
          try {
            localStorage.setItem('momo_moments_cover', appData.momentsCover);
          } catch(e){}
          const coverEl = document.getElementById('moments-cover-image');
          if (coverEl) coverEl.style.backgroundImage = 'url("' + appData.momentsCover + '")';
        }
      }, 100);
    }

    function toggleMomentsDeleteMode() {
      momentsDeleteMode = !momentsDeleteMode;
      const btn = document.getElementById('btn-moments-del-mode');
      if (btn) btn.classList.toggle('del-active', momentsDeleteMode);
      renderMomentsFeed();
    }

    function getMomentPhotos(moment) {
      if (!moment) return [];
      if (Array.isArray(moment.photos) && moment.photos.length) return moment.photos.filter(Boolean).slice(0, MOMENT_MAX_PHOTOS);
      if (Array.isArray(moment.media) && moment.media.length) return moment.media.filter(Boolean).slice(0, MOMENT_MAX_PHOTOS);
      if (typeof moment.media === 'string' && moment.media) return [moment.media];
      return [];
    }

    function renderMomentsFeed() {
      const container = document.getElementById('moments-feed-container');
      if (!container) return;

      const coverEl = document.getElementById('moments-cover-image');
      if (coverEl && appData.momentsCover) {
        coverEl.style.backgroundImage = 'url("' + appData.momentsCover + '")';
      }

      const userAvatarEl = document.getElementById('moments-user-avatar');
      const userNameEl = document.getElementById('moments-user-nickname');
      if (userAvatarEl) {
        userAvatarEl.src = appData.heroAvatar || localStorage.getItem('momo_hero_avatar') || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80';
      }
      if (userNameEl) userNameEl.innerText = appData.hero.userName || 'user';

      const list = appData.moments || [];
      if (list.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px 0; font-size: 14px;">No moments yet.<br><span style="font-size: 12px; opacity: 0.7;">右上角点击相机或书本，发第一条动态吧</span></div>';
        return;
      }

      let html = '';
      list.forEach((m, idx) => {
        const isBot = m.authorRole === 'bot';
        const authorName = isBot
          ? (m.authorName || appData.botRemark || '角色')
          : (m.authorName || appData.hero.userName || 'user');
        const authorAvatar = isBot
          ? (m.authorAvatar || appData.botAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80')
          : (m.authorAvatar || appData.heroAvatar || localStorage.getItem('momo_hero_avatar') || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80');

        const hasLikes = m.likes && m.likes.length > 0;
        const hasComments = m.comments && m.comments.length > 0;
        const photos = getMomentPhotos(m);
        const mediaHtml = photos.length === 1
          ? `<img class="moment-media-preview" src="${escapeHtml(photos[0])}" onclick="previewMomentMedia(this.src)" alt="动态配图" />`
          : photos.length > 1
            ? `<div class="moment-feed-photo-grid">${photos.map(src => `<img class="moment-feed-photo" src="${escapeHtml(src)}" onclick="previewMomentMedia(this.src)" alt="动态配图" />`).join('')}</div>`
            : '';

        html += `
          <div class="moment-card" id="moment-card-${m.id}">
            <img class="moment-author-avatar" src="${authorAvatar}" alt="${authorName}" />
            <div class="moment-card-body">
              <div class="moment-card-author ${isBot ? 'bot-name' : ''}">
                <span>${escapeHtml(authorName)}</span>
                ${momentsDeleteMode ? `<button class="moment-del-btn" onclick="deleteMoment('${m.id}')">删除</button>` : ''}
              </div>
              <div class="moment-text-content">${escapeHtml(m.content)}</div>
              ${mediaHtml}
              
              <div class="moment-footer-row">
                <span class="moment-time-label">${escapeHtml(m.time || '刚刚')}</span>
                <div class="moment-actions-trigger" onclick="toggleMomentActionPill('${m.id}')" title="点赞或评论">
                  <span class="actions-dot"></span>
                  <span class="actions-dot"></span>
                </div>

                <!-- 浮动小药丸操作栏 -->
                <div class="moment-action-pill" id="action-pill-${m.id}" style="display: none;">
                  <button class="pill-btn" onclick="toggleMomentLike('${m.id}')">
                    <span class="pill-heart">❤️</span>
                    <span>${(m.likes || []).includes(appData.hero.userName || 'user') ? '取消' : '赞'}</span>
                  </button>
                  <div class="pill-divider"></div>
                  <button class="pill-btn" onclick="openMomentCommentInput('${m.id}')">
                    <span>💬</span>
                    <span>评论</span>
                  </button>
                  <div class="pill-divider"></div>
                  <button class="pill-btn" onclick="openMomentCharCommentPicker('${m.id}')">
                    <span>👥</span>
                    <span>角色</span>
                  </button>
                </div>
              </div>

              ${(hasLikes || hasComments) ? `
                <div class="moment-interaction-box">
                  ${hasLikes ? `
                    <div class="moment-likes-list">
                      <span class="like-heart-icon">❤️</span>
                      <span>${m.likes.map(l => escapeHtml(l)).join('，')}</span>
                    </div>
                  ` : ''}
                  ${hasComments ? `
                    <div class="moment-comments-list">
                      ${m.comments.map(c => `
                        <div class="moment-comment-item">
                          <span class="comment-user-name">${escapeHtml(c.from)}</span>
                          <span class="comment-colon">:</span>
                          <span class="comment-text">${escapeHtml(c.text)}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function previewMomentMedia(src) {
      window.open(src, '_blank');
    }

    function toggleMomentActionPill(id) {
      const allPills = document.querySelectorAll('.moment-action-pill');
      allPills.forEach(p => {
        if (p.id !== 'action-pill-' + id) p.style.display = 'none';
      });
      const pill = document.getElementById('action-pill-' + id);
      if (pill) {
        pill.style.display = pill.style.display === 'none' ? 'flex' : 'none';
      }
    }

    function toggleMomentLike(id) {
      const m = (appData.moments || []).find(item => item.id === id);
      if (!m) return;
      if (!m.likes) m.likes = [];
      const myName = appData.hero.userName || 'user';
      const idx = m.likes.indexOf(myName);
      if (idx !== -1) {
        m.likes.splice(idx, 1);
      } else {
        m.likes.push(myName);
      }
      saveMoments();
      renderMomentsFeed();
    }

    function openMomentCommentInput(id) {
      toggleMomentActionPill(id); // 关闭药丸
      pendingCommentMomentId = id;
      const modal = document.getElementById('moment-comment-modal');
      const input = document.getElementById('moment-comment-input');
      if (modal && input) {
        input.value = '';
        modal.classList.add('open');
        input.focus();
      }
    }

    function closeMomentCommentModal() {
      const modal = document.getElementById('moment-comment-modal');
      if (modal) modal.classList.remove('open');
      pendingCommentMomentId = null;
    }

    function submitMomentComment() {
      if (!pendingCommentMomentId) return;
      const input = document.getElementById('moment-comment-input');
      const txt = (input ? input.value : '').trim();
      if (!txt) return;

      const m = (appData.moments || []).find(item => item.id === pendingCommentMomentId);
      if (m) {
        if (!m.comments) m.comments = [];
        m.comments.push({ from: appData.hero.userName || 'user', text: txt });
        saveMoments();
        renderMomentsFeed();
      }
      closeMomentCommentModal();
    }

    function deleteMoment(id) {
      if (confirm('确定删除这条动态？')) {
        appData.moments = (appData.moments || []).filter(item => item.id !== id);
        saveMoments();
        renderMomentsFeed();
      }
    }

    function saveMoments() {
      const json = JSON.stringify(appData.moments || []);
      try {
        localStorage.setItem('momo_moments_data', json);
        if (typeof window.momoClearMomentsOverflow === 'function') {
          window.momoClearMomentsOverflow().catch(function() {});
        }
      } catch (err) {
        // localStorage 放不下时改用 IndexedDB，避免朋友圈保存失败
        try { localStorage.removeItem('momo_moments_data'); } catch (e) {}
        if (typeof window.momoWriteMomentsOverflow === 'function') {
          window.momoWriteMomentsOverflow(json).catch(function(writeErr) {
            console.warn('朋友圈 IndexedDB 保存失败:', writeErr);
          });
        } else {
          console.warn('朋友圈数据过大，当前环境无法保存:', err);
        }
      }
    }

    // ================= 发动态弹窗操作 =================
    function ensureMomentModalMounted() {
      const modal = document.getElementById('moment-create-modal');
      const phoneRoot = document.getElementById('phone-screen-root');
      if (modal && phoneRoot && modal.parentElement !== phoneRoot) {
        phoneRoot.appendChild(modal);
      }
    }

    function setMomentSheetBackdrop() {
      const backdrop = document.getElementById('moment-sheet-backdrop');
      if (!backdrop) return;
      const cover = (appData && (appData.momentsCover || appData.heroBanner)) || '';
      if (cover) {
        const safeCover = String(cover).replace(/["\\\n\r]/g, '');
        const theme = String(document.documentElement.getAttribute('data-theme') || document.body.getAttribute('data-theme') || 'light').toLowerCase();
        const isDark = theme === 'dark';
        const topShade = isDark ? 'rgba(10, 10, 14, 0.28)' : 'rgba(255, 255, 255, 0.2)';
        const bottomShade = isDark ? 'rgba(10, 10, 14, 0.7)' : 'rgba(255, 255, 255, 0.62)';
        backdrop.style.backgroundImage = 'linear-gradient(180deg, ' + topShade + ' 0%, ' + bottomShade + ' 100%), url("' + safeCover + '")';
      } else {
        backdrop.style.backgroundImage = '';
      }
    }

    function renderMomentPhotoGrid() {
      const grid = document.getElementById('moment-media-grid');
      const add = document.getElementById('moment-photo-add');
      if (!grid || !add) return;

      grid.querySelectorAll('.moment-photo-tile').forEach(function(el) { el.remove(); });

      newMomentPhotos.forEach(function(src, index) {
        const tile = document.createElement('div');
        tile.className = 'moment-photo-tile';

        const img = document.createElement('img');
        img.className = 'moment-img-preview-box';
        img.alt = '配图 ' + (index + 1);
        img.src = src;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'moment-photo-remove';
        remove.setAttribute('aria-label', '移除第 ' + (index + 1) + ' 张配图');
        remove.innerText = '✕';
        remove.addEventListener('click', function(event) {
          event.preventDefault();
          event.stopPropagation();
          removeMomentPhoto(index);
        });

        tile.appendChild(img);
        tile.appendChild(remove);
        grid.insertBefore(tile, add);
      });

      add.style.display = newMomentPhotos.length >= MOMENT_MAX_PHOTOS ? 'none' : 'flex';
    }

    function openCreateMomentModal() {
      ensureMomentModalMounted();
      newMomentPhotos = [];
      renderMomentPhotoGrid();
      const modal = document.getElementById('moment-create-modal');
      const txt = document.getElementById('moment-text-input');
      if (txt) txt.value = '';

      const hero = (appData && appData.hero) || {};
      const nameEl = document.getElementById('moment-author-name');
      const tagEl = document.getElementById('moment-author-tag');
      const avatarEl = document.getElementById('moment-author-avatar');
      if (nameEl) nameEl.innerText = hero.userName || 'user';
      if (tagEl) {
        const tag = [hero.userHandle, hero.userTag].filter(Boolean).join(' · ');
        tagEl.innerText = tag || '记录这一刻的心情';
      }
      if (avatarEl) {
        const savedAvatar = (typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_avatar') : '') || '';
        avatarEl.src = savedAvatar || hero.userAvatar || appData.heroAvatar || avatarEl.src;
      }

      setMomentSheetBackdrop();
      const fileInput = document.getElementById('moment-photo-file-input');
      if (fileInput) fileInput.value = '';
      if (modal) modal.classList.add('open');
    }

    function closeCreateMomentModal() {
      const modal = document.getElementById('moment-create-modal');
      if (modal) modal.classList.remove('open');
    }

    // 从相册多选进入发动态：复用现有编辑器，图片直接带进去
    function openMomentComposerWithPhotos(photos) {
      openCreateMomentModal();
      newMomentPhotos = (Array.isArray(photos) ? photos : [])
        .filter(Boolean)
        .slice(0, MOMENT_MAX_PHOTOS);
      renderMomentPhotoGrid();
    }
    window.openMomentComposerWithPhotos = openMomentComposerWithPhotos;

    function readMomentPhotoFile(file) {
      return new Promise(function(resolve) {
        const reader = new FileReader();
        reader.onerror = function() { resolve(''); };
        reader.onload = function(evt) {
          const raw = evt.target.result;
          const img = new Image();
          img.onerror = function() { resolve(raw); };
          img.onload = function() {
            try {
              const maxSide = 1200;
              const w = img.naturalWidth || img.width;
              const h = img.naturalHeight || img.height;
              if (w <= maxSide && h <= maxSide && file.size <= 450000) {
                resolve(raw);
                return;
              }
              const scale = Math.min(1, maxSide / Math.max(w, h));
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(w * scale));
              canvas.height = Math.max(1, Math.round(h * scale));
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.82));
            } catch (err) {
              resolve(raw);
            }
          };
          img.src = raw;
        };
        reader.readAsDataURL(file);
      });
    }

    async function handleMomentPhotoUpload(e) {
      const input = e.target;
      const files = Array.prototype.slice.call(input.files || []);
      input.value = '';
      if (!files.length) return;

      const room = MOMENT_MAX_PHOTOS - newMomentPhotos.length;
      if (room <= 0) {
        alert('最多只能添加 ' + MOMENT_MAX_PHOTOS + ' 张配图。');
        return;
      }

      const selected = files.slice(0, room);
      if (files.length > room) {
        alert('最多只能添加 ' + MOMENT_MAX_PHOTOS + ' 张配图，已保留前 ' + room + ' 张。');
      }

      const results = await Promise.all(selected.map(readMomentPhotoFile));
      results.forEach(function(src) {
        if (src && newMomentPhotos.length < MOMENT_MAX_PHOTOS && newMomentPhotos.indexOf(src) === -1) {
          newMomentPhotos.push(src);
        }
      });
      renderMomentPhotoGrid();
    }

    function promptMomentPhotoUrl() {
      if (newMomentPhotos.length >= MOMENT_MAX_PHOTOS) {
        alert('最多只能添加 ' + MOMENT_MAX_PHOTOS + ' 张配图。');
        return;
      }
      const url = prompt('输入配图网络 URL（最多 ' + MOMENT_MAX_PHOTOS + ' 张）：');
      if (url && url.trim()) {
        newMomentPhotos.push(url.trim());
        renderMomentPhotoGrid();
      }
    }

    function removeMomentPhoto(index) {
      if (index < 0 || index >= newMomentPhotos.length) return;
      newMomentPhotos.splice(index, 1);
      renderMomentPhotoGrid();
    }

    function clearMomentPhoto() {
      newMomentPhotos = [];
      renderMomentPhotoGrid();
      const fileInput = document.getElementById('moment-photo-file-input');
      if (fileInput) fileInput.value = '';
    }

    function focusMomentText() {
      const txt = document.getElementById('moment-text-input');
      if (!txt) return;
      txt.focus();
      txt.setSelectionRange(txt.value.length, txt.value.length);
    }

    function insertMomentMention() {
      const txt = document.getElementById('moment-text-input');
      if (!txt) return;
      const name = prompt('提及谁？（输入名字）', '');
      if (!name || !name.trim()) return;
      txt.focus();
      const mention = '@' + name.trim();
      const start = typeof txt.selectionStart === 'number' ? txt.selectionStart : txt.value.length;
      const end = typeof txt.selectionEnd === 'number' ? txt.selectionEnd : start;
      txt.value = txt.value.slice(0, start) + mention + txt.value.slice(end);
      const caret = start + mention.length;
      txt.setSelectionRange(caret, caret);
    }

    function promptMomentLocation() {
      const txt = document.getElementById('moment-text-input');
      if (!txt) return;
      const location = prompt('添加位置：', '');
      if (!location || !location.trim()) return;
      const suffix = (txt.value.trim() ? '\n' : '') + '📍 ' + location.trim();
      txt.value += suffix;
      txt.focus();
      txt.setSelectionRange(txt.value.length, txt.value.length);
    }

    function showMomentPublicTip() {
      if (typeof window.wxToast === 'function') {
        window.wxToast('发布后这条动态会出现在朋友圈，默认公开。');
      } else {
        alert('发布后这条动态会出现在朋友圈，默认公开。');
      }
    }

    async function submitCreateMoment() {
      const txt = document.getElementById('moment-text-input').value.trim();
      const photos = newMomentPhotos.slice(0, MOMENT_MAX_PHOTOS);
      if (!txt && photos.length === 0) {
        alert((appData.hero && appData.hero.userName || 'user') + '，说点什么或者带几张图再发吧。');
        return;
      }

      const newMoment = {
        id: 'moment_' + Date.now(),
        authorRole: 'user',
        authorName: appData.hero.userName || 'user',
        authorAvatar: appData.heroAvatar || '',
        content: txt,
        media: photos[0] || '',
        photos: photos,
        time: getNowStr(),
        likes: [],
        comments: []
      };

      if (!appData.moments) appData.moments = [];
      appData.moments.unshift(newMoment);
      saveMoments();
      closeCreateMomentModal();
      renderMomentsFeed();

      // 灵魂触发：user发了动态后，绪言异步“秒赞与秒评”
      triggerCharReactionToUserMoment(newMoment);
    }

    // 绪言对user朋友圈的秒赞与秒评（人设专属反应）
    async function triggerCharReactionToUserMoment(userMoment) {
      if (!appData.apiKey) {
        console.warn('No API key, skipping instant moment reaction.');
        return;
      }

      try {
        let cleanBase = (appData.apiBase || '').trim().replace(/\/+$/, '');
        if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';

        const activeChar = (typeof window.getActiveCharacter === 'function') ? window.getActiveCharacter() : null;
        const charName = (activeChar && activeChar.name) || appData.botRemark || '角色';
        const charTag = (activeChar && activeChar.tag) || '';
        const charIntro = (activeChar && activeChar.intro) || '';
        const charPrompt = (activeChar && activeChar.prompt) || appData.charPrompt || '';
        const userName = (appData.hero && appData.hero.userName) || 'user';
        const userRemark = appData.userNickname || userName;
        const prompt = `你是${charName}${charTag ? '（' + charTag + '）' : ''}。
【角色设定】：${charIntro || '未设置'}
${charPrompt ? '【角色口吻参考】：' + String(charPrompt).slice(0, 300) : ''}
${userRemark}（${userName}）刚刚在朋友圈发了一条新动态：
【${userRemark}的动态正文】："${userMoment.content}"
${userMoment.media ? '【配图描述】：包含图片分享' : ''}

【任务要求】：
1. 你会给这条动态点赞。
2. 按当前角色卡与${userRemark}的关系、性格和说话方式，留一条自然的评论；不要套用固定人夫/恋人模板。
- 如果对方熬夜：按关系分寸关心，不要强行爹系查岗。
- 如果对方发自拍或日常：用角色本人的方式回应，不要固定成同一种暧昧口吻。
- 如果对方吐槽或委屈：先接住情绪，再按角色卡的关系安慰。
3. 评论必须极其简短（15-40字以内），纯台词，绝不要任何多余前缀，不要包含引号。`;

        const resp = await fetch(cleanBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + appData.apiKey },
          body: JSON.stringify({
            model: appData.model || 'deepseek-chat',
            messages: [{ role: 'system', content: prompt }],
            temperature: 0.8
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          let commentText = data.choices[0].message.content.trim().replace(/^["“]+|["”]+$/g, '');
          
          // 给动态点赞并留言
          const m = (appData.moments || []).find(item => item.id === userMoment.id);
          if (m) {
            const botName = appData.botRemark || '角色';
            if (!m.likes.includes(botName)) m.likes.push(botName);
            m.comments.push({ from: botName, text: commentText });
            saveMoments();
            renderMomentsFeed();
          }
        }
      } catch (err) {
        console.error('Bot moment reaction error:', err);
      }
    }

    // ===== 角色之间的朋友圈互评：不设白名单，每个评论者单独一次请求 =====
    function momentChars() {
      try {
        return (typeof window.getCharacters === 'function' ? window.getCharacters() : []) || [];
      } catch (e) {
        return [];
      }
    }

    function momentCharById(id, name) {
      const chars = momentChars();
      return chars.find(function (c) { return id && c && c.id === id; }) ||
        chars.find(function (c) { return name && c && c.name === name; }) || null;
    }

    function momentPairRelation(author, commenter) {
      if (!author || !commenter) return '';
      const out = (author.relations || []).find(function (r) { return r && r.to === commenter.id; });
      if (out && out.label) return out.label;
      const back = (commenter.relations || []).find(function (r) { return r && r.to === author.id; });
      return (back && back.label) || '';
    }

    function cleanMomentComment(raw, commenterName) {
      let text = String(raw || '').trim()
        .replace(/^```[\s\S]*?```$/g, '')
        .replace(/^["“]+|["”]+$/g, '')
        .trim();
      if (commenterName) {
        text = text.replace(new RegExp('^' + commenterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[：:]\\s*'), '');
      }
      text = text.replace(/<[^>]*>/g, '').trim();
      return text.slice(0, 60);
    }

    async function postCharacterCommentToMoment(momentId, commenterId) {
      const m = (appData.moments || []).find(function (item) { return item && item.id === momentId; });
      const commenter = momentCharById(commenterId);
      if (!m || !commenter || !appData.apiKey) return;
      if ((m.comments || []).some(function (c) { return c && c.fromId === commenter.id; })) return;

      const author = momentCharById(m.authorId, m.authorName) || {
        id: m.authorId || '',
        name: m.authorName || '角色',
        tag: '',
        intro: ''
      };
      const rel = momentPairRelation(author, commenter);
      const charTag = commenter.tag ? '（' + commenter.tag + '）' : '';
      const charIntro = String(commenter.intro || '').slice(0, 240);
      const charPrompt = String(commenter.prompt || '').slice(0, 360);
      const charDirectives = String(commenter.directives || '').slice(0, 260);
      const authorIntro = String(author.intro || '').slice(0, 180);
      const photoCount = (m.photos || []).filter(Boolean).length || (m.media ? 1 : 0);

      const prompt = `你是${commenter.name}${charTag}，现在只以${commenter.name}的身份，去评论${author.name}发的朋友圈。
【你的人设】：${charIntro || '按角色名自然说话'}
${charPrompt ? '【你的口吻和性格】：' + charPrompt : ''}
${charDirectives ? '【你的表达习惯】：' + charDirectives : ''}
【对方】：${author.name}${authorIntro ? '，' + authorIntro : ''}
【你与对方的关系】：${rel || '未写明，按普通熟人/朋友的自然分寸，不要突然暧昧'}
【这条动态】：${String(m.content || '').trim() || '只发了一张图'}
${photoCount ? '【配图】：' + photoCount + ' 张图片' : ''}

【任务】：写一条微信朋友圈评论。
- 15-35字，纯台词，像真人随手评论。
- 必须贴合你的人设、你和对方的关系，不要夸成客服，也不要套恋爱模板。
- 不要扮演对方，不要写旁白、分析、括号动作，不要加名字前缀、引号、@或表情包说明。
- 只输出评论正文。`;

      try {
        let cleanBase = String(appData.apiBase || '').trim().replace(/\/+$/, '');
        if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';
        const resp = await fetch(cleanBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + appData.apiKey },
          body: JSON.stringify({
            model: appData.model || 'deepseek-chat',
            messages: [{ role: 'system', content: prompt }],
            temperature: 0.85,
            max_tokens: 120
          })
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        const text = cleanMomentComment(raw, commenter.name);
        if (!text) return;

        const current = (appData.moments || []).find(function (item) { return item && item.id === momentId; });
        if (!current) return;
        if (!current.comments) current.comments = [];
        if (current.comments.some(function (c) { return c && c.fromId === commenter.id; })) return;
        current.comments.push({ from: commenter.name, fromId: commenter.id, text: text, at: Date.now() });
        if (!current.likes) current.likes = [];
        if (current.likes.indexOf(commenter.name) < 0) current.likes.push(commenter.name);
        if (typeof saveMoments === 'function') saveMoments();
        if (typeof renderMomentsFeed === 'function') renderMomentsFeed();
      } catch (err) {
        console.warn('Character moment comment failed:', err && err.message ? err.message : err);
      }
    }

    let momentCharCommentMomentId = null;

    function momentCharCommentHint(text) {
      if (typeof window.wxToast === 'function') window.wxToast(text);
      else alert(text);
    }

    function openMomentCharCommentPicker(momentId) {
      const m = (appData.moments || []).find(function (item) { return item && item.id === momentId; });
      if (!m) return;
      if (!appData.apiKey) {
        momentCharCommentHint('先去设置里填 API Key，角色才能评论。');
        return;
      }
      momentCharCommentMomentId = momentId;
      toggleMomentActionPill(momentId);
      renderMomentCharCommentPicker();
      const modal = document.getElementById('moment-char-comment-modal');
      if (modal) modal.classList.add('open');
    }

    function closeMomentCharCommentModal() {
      const modal = document.getElementById('moment-char-comment-modal');
      if (modal) modal.classList.remove('open');
      momentCharCommentMomentId = null;
    }

    function renderMomentCharCommentPicker() {
      const box = document.getElementById('moment-char-comment-list');
      if (!box) return;
      const m = (appData.moments || []).find(function (item) { return item && item.id === momentCharCommentMomentId; });
      if (!m) { box.innerHTML = ''; return; }
      const author = momentCharById(m.authorId, m.authorName);
      const doneIds = (m.comments || []).map(function (c) { return c && c.fromId; }).filter(Boolean);
      const chars = momentChars().filter(function (c) {
        if (!c || !c.id) return false;
        if (author && c.id === author.id) return false;
        if (!author && c.name === m.authorName) return false;
        return true;
      });
      if (!chars.length) {
        box.innerHTML = '<div class="moment-char-comment-empty">还没有别的角色。先去通讯录加几个角色，再回来。</div>';
        return;
      }
      box.innerHTML = chars.map(function (c) {
        const done = doneIds.indexOf(c.id) >= 0;
        const avatar = c.avatar
          ? '<img class="moment-char-comment-avatar" src="' + escapeHtml(c.avatar) + '" alt="" />'
          : '<span class="moment-char-comment-avatar is-letter">' + escapeHtml((c.name || '?').slice(0, 1)) + '</span>';
        return '<label class="moment-char-comment-row' + (done ? ' is-done' : '') + '">' +
          '<input type="checkbox" class="moment-char-comment-check" value="' + escapeHtml(c.id) + '"' + (done ? ' disabled checked' : '') + ' />' +
          avatar +
          '<span class="moment-char-comment-copy"><b>' + escapeHtml(c.name || '角色') + '</b>' +
          (c.tag ? '<i>' + escapeHtml(c.tag) + '</i>' : '') + '</span>' +
          (done ? '<span class="moment-char-comment-done">已评论</span>' : '') +
          '</label>';
      }).join('');
    }

    function toggleAllMomentCharComments(on) {
      const box = document.getElementById('moment-char-comment-list');
      if (!box) return;
      box.querySelectorAll('.moment-char-comment-check:not(:disabled)').forEach(function (el) {
        el.checked = !!on;
      });
    }

    async function submitMomentCharComments() {
      const momentId = momentCharCommentMomentId;
      const box = document.getElementById('moment-char-comment-list');
      if (!momentId || !box) return;
      const ids = Array.prototype.slice.call(box.querySelectorAll('.moment-char-comment-check:checked:not(:disabled)'))
        .map(function (el) { return el.value; })
        .filter(Boolean);
      if (!ids.length) {
        momentCharCommentHint('先勾选至少一个角色。');
        return;
      }
      closeMomentCharCommentModal();
      momentCharCommentHint('正在让 ' + ids.length + ' 位角色来评论，稍等…');
      for (let i = 0; i < ids.length; i++) {
        await postCharacterCommentToMoment(momentId, ids[i]);
      }
    }

    function parseMomentPayload(raw) {
      let text = String(raw || '').trim();
      text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      let content = text;
      let photoIds = [];
      try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
          const obj = JSON.parse(text.slice(start, end + 1));
          content = String(obj.content || obj.text || '').trim();
          if (Array.isArray(obj.photoIds)) photoIds = obj.photoIds.filter(Boolean);
          else if (typeof obj.photoId === 'string' && obj.photoId) photoIds = [obj.photoId];
        }
      } catch (e) {}
      content = content.replace(/^["“]+|["”]+$/g, '').trim();
      if (!content) content = text;
      return { content: content.slice(0, 220), photoIds: photoIds.slice(0, 3) };
    }

    function momentPhotoCatalogText(charId) {
      let list = [];
      try {
        if (typeof getAlbumCatalogForCharacter === 'function') {
          list = getAlbumCatalogForCharacter(charId, 10) || [];
        } else if (typeof getAlbumPhotosForCharacter === 'function') {
          list = (getAlbumPhotosForCharacter(charId) || []).slice(0, 10).map(function (p) {
            return { id: p.id, caption: p.caption || '', scene: p.scene || '', tags: p.tags || [], createdAt: p.createdAt || p.time || '' };
          });
        }
      } catch (e) {}
      if (!list.length) return '';
      return list.map(function (p) {
        return p.id + '｜' + (p.caption || '无描述') + '｜' + (p.scene || '无场景') + '｜' +
          ((p.tags || []).join('/') || '无标签') + '｜' + String(p.createdAt || '').slice(0, 10);
      }).join('\n');
    }

    function momentPickPhotos(charId, photoIds) {
      if (!Array.isArray(photoIds) || !photoIds.length) return [];
      let all = [];
      try {
        if (typeof getAlbumPhotosForCharacter === 'function') all = getAlbumPhotosForCharacter(charId) || [];
      } catch (e) {}
      const picked = [];
      photoIds.forEach(function (id) {
        const p = all.find(function (item) { return item.id === id; });
        if (p && p.src && picked.indexOf(p.src) < 0) picked.push(p.src);
      });
      return picked.slice(0, 3);
    }

    function showMomentChatToast(charName) {
      const chatPage = document.getElementById('page-chat');
      if (!chatPage || !chatPage.classList.contains('active')) return;
      const old = document.getElementById('moment-chat-toast');
      if (old) old.remove();
      const el = document.createElement('div');
      el.id = 'moment-chat-toast';
      el.className = 'moment-chat-toast';
      el.innerHTML = '<span class="moment-chat-toast-text">' + escapeHtml(charName) + ' 发了条朋友圈</span>' +
        '<span class="moment-chat-toast-go">去看看</span>';
      el.addEventListener('click', function () {
        el.remove();
        if (typeof openMomentsPage === 'function') openMomentsPage();
      });
      chatPage.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('is-show'); });
      setTimeout(function () { el.classList.remove('is-show'); }, 5600);
      setTimeout(function () { if (el.parentNode) el.remove(); }, 6000);
    }

    async function triggerCharPostMoment(options) {
      options = options || {};
      const isAuto = options.auto === true;

      if (!appData.apiKey) {
        if (!isAuto) alert('去设置里配置 API Key，当前角色才能把心事写成朋友圈。');
        return;
      }

      const btn = document.getElementById('btn-moments-char-post');
      if (btn) btn.style.opacity = '0.5';

      try {
        let cleanBase = (appData.apiBase || '').trim().replace(/\/+$/, '');
        if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';

        const activeChar = (typeof window.getActiveCharacter === 'function') ? window.getActiveCharacter() : null;
        const charId = (activeChar && activeChar.id) || '';
        const charName = (activeChar && activeChar.name) || appData.botRemark || '角色';
        const charTag = (activeChar && activeChar.tag) || '';
        const charIntro = (activeChar && activeChar.intro) || '';
        const charPrompt = (activeChar && activeChar.prompt) || appData.charPrompt || '';
        const charDirectives = (activeChar && activeChar.directives) || '';
        const userName = (appData.hero && appData.hero.userName) || 'user';
        const userRemark = appData.userNickname || userName;
        const st = getMomentCharState(charId);
        // 自动发动态时，上一条带过图，这一条就不再配图；避免每条都硬塞相册图。
        const skipPhoto = options.noPhoto === true || (isAuto && st.lastHadPhotos === true);

        let postType = options.type;
        if (!postType) postType = (st.lastType === 'topic') ? 'self' : 'topic';
        if (postType === 'topic' && !momentHasRecentTopic()) postType = 'self';

        const recentChat = (appData.chatHistory || [])
          .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; })
          .slice(-6)
          .map(function (m) {
            const text = m.content.replace(/\[IMAGE:[\s\S]*?\]/g, '[图片]').replace(/\[SYSTEMHINT:[\s\S]*?\]/g, '').trim();
            return (m.role === 'user' ? userRemark : charName) + '：' + text.slice(0, 120);
          }).join('\n');

        let memoryText = '';
        try {
          if (typeof window.getPalaceMemoryTextFor === 'function' && charId) {
            memoryText = window.getPalaceMemoryTextFor('single', charId, 7) || '';
          }
        } catch (e) {}
        if (!memoryText) memoryText = '（没有额外记忆卡片，按角色设定来）';

        const nowText = new Date().toLocaleString('zh-CN', { hour12: false });
        const catalogText = momentPhotoCatalogText(charId);
        const typeLine = postType === 'topic'
          ? '这次发【话题型】：从下面的最近聊天里挑一个具体话题、物件、地点或一句话，围绕它写角色自己的感受或联想。它是你刷到/想到的一件事，不是给用户的回复。不要出现“你刚才说”“你”开头的句子，不要提问，不要解释你在回应聊天。'
          : '这次发【自发型】：完全不看最近聊天，也不提用户。按角色人设、记忆卡片、当前时间，写角色自己此刻的一个小片段：正在做的事、手边的物件、看到的场景、身体感受、突然想起的一段记忆。';

        const recentBlock = postType === 'topic'
          ? (recentChat || '（最近没有新的聊天素材）')
          : '（这次是自发型，不需要参考最近聊天）';

        const photoRule = skipPhoto
          ? '【这次配图规则】这次不要配图，photoIds 必须为空数组。'
          : '【配图规则】配图不是必须的。只有相册里确实有和正文高度对得上的图，才选 1-2 张；没有合适的就空数组，禁止为了配图硬选。';

        const prompt = `你是${charName}${charTag ? '（' + charTag + '）' : ''}。
【角色设定】：${charIntro || '未设置'}
【角色口吻 / 行为参考】：${String(charPrompt).slice(0, 500) || '未设置'}
${charDirectives ? '【角色额外指令】：' + String(charDirectives).slice(0, 300) : ''}
【现在时间】：${nowText}
【关于${charName}的记忆】：${String(memoryText).slice(0, 900)}
【最近聊天记录：只是素材，不是让你逐句回复】
${recentBlock}

${typeLine}

${photoRule}

【相册目录】（格式：photoId｜图片描述｜场景｜标签｜日期）
${catalogText || '（角色相簿和共享相簿里暂时没有图片，photoIds 必须为空数组）'}

【硬性要求】
1. 第一人称，像真实活人发朋友圈，不要写成小说旁白，不要写“我站在窗前，思绪万千”这种空泛抒情。
2. 正文 30-90 字，至少有一个具体动作、物件或场景。不要空话套话，不要“今天也要加油呀”“生活总有希望”这类模板。
3. 如果角色是虚拟设定，不要硬编线下肉身、上班通勤、现实工作这些不属于角色的经历；用角色世界观里合理的场景。
4. 不要每句都提到用户，不要写成聊天回复，不要带“回复”“消息”这类词。
5. 配图不是必须的；只有相册里有和正文对得上的图才选 1-2 张，没有合适的就空数组，不要为了配图硬选。
6. 只输出 JSON，不要解释、不要 markdown 代码块。格式：
{"content":"动态正文","photoIds":["ph_xxx"]}`;

        const resp = await fetch(cleanBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + appData.apiKey },
          body: JSON.stringify({
            model: appData.model || 'deepseek-chat',
            messages: [{ role: 'system', content: prompt }],
            temperature: 0.9
          })
        });

        if (!resp.ok) {
          throw new Error('API 连接异常: ' + resp.status);
        }

        const data = await resp.json();
        const payload = parseMomentPayload(data.choices[0].message.content);
        if (!payload.content) throw new Error('动态正文为空');

        const photos = skipPhoto ? [] : momentPickPhotos(charId, payload.photoIds);
        const newMoment = {
          id: 'moment_bot_' + Date.now(),
          authorRole: 'bot',
          authorId: charId,
          authorName: charName,
          authorAvatar: (activeChar && activeChar.avatar) || appData.botAvatar || '',
          content: payload.content,
          media: photos[0] || '',
          photos: photos,
          createdAt: new Date().toISOString(),
          timestamp: Date.now(),
          time: getNowStr(),
          likes: [],
          comments: []
        };

        if (!appData.moments) appData.moments = [];
        appData.moments.unshift(newMoment);
        saveMoments();
        setMomentCharState(charId, { lastType: postType, lastMomentAt: Date.now(), lastHadPhotos: photos.length > 0 });
        renderMomentsFeed();

        var momentsPage = document.getElementById('page-moments');
        if (momentsPage && momentsPage.classList.contains('active')) {
          markMomentsSeen();
        } else {
          syncWechatDiscover();
          if (isAuto) showMomentChatToast(charName);
        }

        if (!isAuto) alert('✨ ' + charName + ' 刚刚发了一条朋友圈！');
      } catch (err) {
        console.error('Char moment post error:', err);
        if (!isAuto) alert('发送失败：' + err.message);
      } finally {
        if (btn) btn.style.opacity = '1';
      }
    }

    // 聊天中每约 25 条检查一次：有话题发话题型，没有就发自发型；一场聊天最多一条
    function checkAndTriggerMomentOnChat() {
      const activeChar = (typeof window.getActiveCharacter === 'function') ? window.getActiveCharacter() : null;
      const charId = (activeChar && activeChar.id) || 'default';
      if (!momentChatSession.sessionId || momentChatSession.charId !== charId) {
        resetMomentChatSession(charId);
      }

      momentChatSession.count++;
      if (momentChatSession.posted) return;
      if (momentChatSession.count < MOMENT_AUTO_CHECK_EVERY) return;

      momentChatSession.count = 0;
      const st = getMomentCharState(charId);
      const latest = Math.max(Number(st.lastMomentAt) || 0, momentLatestForChar(charId, (activeChar && activeChar.name) || ''));
      if (Date.now() - latest < MOMENT_MIN_GAP_MS) return;

      const hasTopic = momentHasRecentTopic();
      let type = (st.lastType === 'topic') ? 'self' : 'topic';
      if (type === 'topic' && !hasTopic) type = 'self';

      momentChatSession.posted = true;
      triggerCharPostMoment({ auto: true, type: type });
    }

    // 兼容旧调用名
    function checkAndTrigger30MessageMoment() {
      checkAndTriggerMomentOnChat();
    }

    window.resetMomentChatSession = resetMomentChatSession;


