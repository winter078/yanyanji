
// 通用 iOS 优雅文本编辑抽屉
let currentQuickModalCallback = null;
function openQuickTextModal(title, label, defaultValue, callback) {
  currentQuickModalCallback = callback;
  const modal = document.getElementById('quick-text-edit-modal');
  const titleEl = document.getElementById('quick-edit-title');
  const labelEl = document.getElementById('quick-edit-label');
  const inputEl = document.getElementById('quick-edit-input');
  const confirmBtn = document.getElementById('quick-edit-confirm-btn');

  if (titleEl) titleEl.innerText = title;
  if (labelEl) labelEl.innerText = label;
  if (inputEl) {
    inputEl.value = defaultValue || '';
    inputEl.placeholder = '输入' + label + '...';
  }

  if (confirmBtn) {
    confirmBtn.onclick = function() {
      const val = inputEl ? inputEl.value : '';
      if (!val || !val.trim()) {
        alert('内容不能为空哦');
        return;
      }
      if (typeof currentQuickModalCallback === 'function') {
        currentQuickModalCallback(val);
      }
      closeQuickTextEditModal();
    };
  }

  if (modal) {
    modal.classList.add('open');
    setTimeout(() => { if (inputEl) inputEl.focus(); }, 150);
  }
}

function closeQuickTextEditModal() {
  const modal = document.getElementById('quick-text-edit-modal');
  if (modal) modal.classList.remove('open');
  currentQuickModalCallback = null;
}


// ================= 图片轻量压缩与外观预设管理器 =================
function compressImageBase64(file, maxWidth = 1080, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
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
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// 替换原有的 uploadImageFile，加入无损微缩压缩，彻底告别 LocalStorage 爆仓
async function uploadImageFile(e, type) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  // 头像微缩到 400px，壁纸微缩到 1080px
  const maxDim = (type === 'heroAvatar' || type === 'botAvatar') ? 400 : 1080;
  const compressed = await compressImageBase64(file, maxDim, 0.82);

  if (type === 'globalBg') appData.globalBg = compressed;
  if (type === 'chatBg') {
    window.snapshotChatWall && window.snapshotChatWall();
    appData.chatBg = compressed;
    if (window.clearChatWallPreset) window.clearChatWallPreset();
    if (window.saveChatPhoto) window.saveChatPhoto(compressed);
  }
  if (type === 'heroBanner') appData.heroBanner = compressed;
  if (type === 'heroAvatar') appData.heroAvatar = compressed;
  if (type === 'artSquare') appData.artSquare = compressed;

  applyThemeAndImages();
  saveCurrentThemeManually(false);
}

// 桌面背景恢复默认（暗色烟灰桌面），只动桌面，不碰聊天页
window.resetDesktopBg = function () {
  appData.globalBg = '';
  try {
    localStorage.removeItem('momo_global_bg');
    localStorage.removeItem('momo_bg_url');
  } catch (e) {}
  applyThemeAndImages();
};

// 手动保存外观当前配置
function saveCurrentThemeManually(showAlert = true) {
  try {
    localStorage.setItem('momo_global_bg', appData.globalBg || '');
    localStorage.setItem('momo_bg_url', appData.globalBg || '');
    localStorage.setItem('momo_chat_bg', appData.chatBg || '');
    localStorage.setItem('momo_hero_banner', appData.heroBanner || '');
    localStorage.setItem('momo_hero_avatar', appData.heroAvatar || '');
    localStorage.setItem('momo_art_square', appData.artSquare || '');
    localStorage.setItem('momo_chat_dim', appData.chatDim || '58');
    if (showAlert) alert('💾 已全量固化保存：\n✔ 全局桌面与微信背景\n✔ 个人资料星空插画\n✔ user可爱头像\n✔ 桌面双人合照！');
  } catch (err) {
    alert('保存失败：' + err.message);
  }
}

// 外观预设体系
function getThemePresets() {
  const local = localStorage.getItem('momo_theme_presets');
  if (local) {
    try { return JSON.parse(local); } catch(e){}
  }
  return [
    {
      id: "preset_default",
      name: "经典雪花星夜",
      globalBg: appData.globalBg || "",
      chatBg: appData.chatBg || "",
      heroBanner: appData.heroBanner || "",
      heroAvatar: appData.heroAvatar || "",
      artSquare: appData.artSquare || "",
      chatDim: appData.chatDim || "58"
    }
  ];
}

function saveAsNewThemePreset() {
  const name = prompt('为当前这套外观起个名字（例如：冬日雪花、纯情合照）：');
  if (!name || !name.trim()) return;

  const presets = getThemePresets();
  presets.push({
    id: "preset_" + Date.now(),
    name: name.trim(),
    globalBg: appData.globalBg || "",
    chatBg: appData.chatBg || "",
    heroBanner: appData.heroBanner || "",
    heroAvatar: appData.heroAvatar || "",
    artSquare: appData.artSquare || "",
    chatDim: appData.chatDim || "0.2"
  });

  try {
    localStorage.setItem('momo_theme_presets', JSON.stringify(presets));
    renderThemePresetsUI();
    alert('✨ 已成功保存为新预设：' + name.trim());
  } catch(e) {
    alert('预设存储失败，可能图片过多：' + e.message);
  }
}

function applyThemePreset(presetId) {
  const presets = getThemePresets();
  const target = presets.find(p => p.id === presetId);
  if (!target) return;

  if (target.globalBg !== undefined) appData.globalBg = target.globalBg;
  if (target.chatBg !== undefined) appData.chatBg = target.chatBg;
  if (target.heroBanner !== undefined) appData.heroBanner = target.heroBanner;
  if (target.heroAvatar !== undefined) appData.heroAvatar = target.heroAvatar;
  if (target.artSquare !== undefined) appData.artSquare = target.artSquare;
  if (target.chatDim !== undefined) appData.chatDim = target.chatDim;

  applyThemeAndImages();
  saveCurrentThemeManually(false);
  renderThemePresetsUI();
  alert('已切换为外观预设：' + target.name);
}

function deleteThemePreset(presetId) {
  if (!confirm('确定删除这个外观预设吗？')) return;
  let presets = getThemePresets();
  presets = presets.filter(p => p.id !== presetId);
  localStorage.setItem('momo_theme_presets', JSON.stringify(presets));
  renderThemePresetsUI();
}

function renderThemePresetsUI() {
  const container = document.getElementById('theme-presets-container');
  if (!container) return;

  const presets = getThemePresets();
  container.innerHTML = presets.map(p => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--glass-faint); border: 1px solid var(--border-default); padding: 10px 14px; border-radius: 12px; margin-bottom: 8px;">
      <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${p.name}</div>
      <div style="display: flex; gap: 8px;">
        <button class="wechat-send-btn" style="padding: 4px 10px; font-size: 11px; background: #07c160;" onclick="applyThemePreset('${p.id}')">应用</button>
        ${p.id !== 'preset_default' ? `<button class="art-comment-action-btn" onclick="deleteThemePreset('${p.id}')" style="color: #f87171;">🗑️</button>` : ''}
      </div>
    </div>
  `).join('');
}

// iOS 桌面滑动、晃动编辑模式、时钟与外观
    // 页面路由
    function openPage(pageId) {
      if (pageId === 'page-home') {
        document.body.classList.remove('view-active-subpage');
      } else {
        document.body.classList.add('view-active-subpage');
        exitIosEditMode();
      }
      exitIosEditMode(); // 离开主页时退出晃动编辑模式
      if (typeof window.cleanupAllDragGhosts === 'function') window.cleanupAllDragGhosts();
      document.querySelectorAll('.grid-drag-ghost').forEach(el => el.remove());
      // 清理任何残留在屏幕上的拖拽虚影
      document.querySelectorAll('.grid-drag-ghost').forEach(el => el.remove());

      const allPages = document.querySelectorAll('.view-page');
      allPages.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none'; // 强制 display: none，彻底粉碎 iOS Safari 幽灵图层缓存
      });

      const target = document.getElementById(pageId);
      if (target) {
        target.style.display = 'flex';
        target.classList.add('active');
        if (pageId === 'page-app-store') {
          if (typeof window.renderAppStore === 'function') window.renderAppStore();
        } else if (pageId === 'page-prompt-presets') {
          if (window.PromptPresets && typeof window.PromptPresets.renderSettings === 'function') window.PromptPresets.renderSettings();
        } else if (pageId === 'page-gallery-photos') {
          if (typeof renderPhotos === 'function') renderPhotos();
        } else if (pageId === 'page-yanyan-cat') {
          if (typeof renderYanyanCatPage === 'function') renderYanyanCatPage();
        } else if (pageId === 'page-avatar-vault') {
          if (typeof renderVaultView === 'function') renderVaultView();
        } else if (pageId === 'page-ledger') {
          if (typeof renderLedgerApp === 'function') renderLedgerApp();
        } else if (pageId === 'page-health') {
          if (typeof window.renderHealthApp === 'function') window.renderHealthApp();
        } else if (pageId === 'page-forum') {
          if (typeof window.renderForumApp === 'function') window.renderForumApp();
        } else if (pageId === 'page-reader') {
          if (typeof renderReaderShelf === 'function') renderReaderShelf();
        } else if (pageId === 'page-watch') {
          if (typeof initWatchApp === 'function') initWatchApp();
        } else if (pageId === 'page-wechat-main') {
          syncWechatMainPreview();
        } else if (pageId === 'page-moments') {
          renderMomentsFeed();
        } else if (pageId === 'page-me') {
          syncMeProfileUI();
        } else if (pageId === 'page-world') {
          renderWorldBookshelf();
        } else if (pageId === 'page-palace') {
          renderPalaceMemories();
        } else if (pageId === 'page-char-setting') {
          if (!window.__editingCharId) {
            if (typeof getActiveCharacter === 'function' && typeof fillCharacterEditorById === 'function') {
              const ac = getActiveCharacter();
              if (ac) fillCharacterEditorById(ac.id);
            } else if (typeof syncCharSettingUI === 'function') {
              syncCharSettingUI();
            }
          }
        } else if (pageId === 'page-xhs') {
          if (typeof window.renderXhsApp === 'function') window.renderXhsApp();
        } else if (pageId === 'page-say') {
          if (typeof window.renderSayApp === 'function') window.renderSayApp();
        } else if (pageId === 'page-chat-setting') {
          if (typeof renderChatSettingsUI === 'function') renderChatSettingsUI();
          if (typeof window.renderCharacterImageSettingsUI === 'function') window.renderCharacterImageSettingsUI();
          if (typeof window.renderChatPinUI === 'function') window.renderChatPinUI();
        } else if (pageId === 'page-theme') {
          if (typeof renderThemePresetsUI === 'function') renderThemePresetsUI();
        } else if (pageId === 'page-stickers') {
          if (typeof window.renderStickerPage === 'function') window.renderStickerPage();
        }
      }

      // 绝对控制小圆点：只有主桌面(page-home)才准出现！
      const dotsEl = document.getElementById('home-page-dots');
      if (dotsEl) {
        if (pageId === 'page-home') {
          dotsEl.style.display = 'flex';
          dotsEl.style.visibility = 'visible';
        } else {
          dotsEl.style.display = 'none';
          dotsEl.style.visibility = 'hidden';
        }
      }

      if (pageId === 'page-daysmatter') {
        if (typeof renderDaysMatter === 'function') renderDaysMatter();
      }
      if (pageId === 'page-chat') {
        if (typeof loadChatHistory === 'function') loadChatHistory();
        const c = document.getElementById('message-container');
        if (c) setTimeout(() => { c.scrollTop = c.scrollHeight; }, 30);
      }
      if (pageId === 'page-rp') {
        renderRpStream();
      }
    }

    // 时钟
    function updateClock() {
      const el = document.getElementById('current-clock-time');
      if (!el) return;
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      el.innerText = `${h}:${m}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    function getNowStr() {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // ================= iOS 原生多页滑动与长按晃动重排 =================
    
    // iOS 原生 Scroll-Snap 监听与点击切页
    const viewport = document.getElementById('ios-viewport');

    function switchIosSlide(pageIdx, behavior) {
      if (!viewport) return;
      const targetLeft = pageIdx * viewport.clientWidth;
      if (behavior === 'auto') {
        // 拖组件跨页时必须立刻把目标页滑到指针下面，否则落点会按旧页坐标计算。
        const previousBehavior = viewport.style.scrollBehavior;
        viewport.style.scrollBehavior = 'auto';
        viewport.scrollLeft = targetLeft;
        viewport.style.scrollBehavior = previousBehavior;
      } else {
        viewport.scrollTo({
          left: targetLeft,
          behavior: 'smooth'
        });
      }
      updateDots(pageIdx);
    }
    window.switchIosSlide = switchIosSlide;
    window.exitIosEditMode = exitIosEditMode;
    window.enterIosEditMode = enterIosEditMode;

    function updateDots(activeIdx) {
      const dot1 = document.getElementById('dot-hitbox-1');
      const dot2 = document.getElementById('dot-hitbox-2');
      const dot3 = document.getElementById('dot-hitbox-3');
      if (dot1) dot1.classList.toggle('active', activeIdx === 0);
      if (dot2) dot2.classList.toggle('active', activeIdx === 1);
      if (dot3) dot3.classList.toggle('active', activeIdx === 2);
    }

    if (viewport) {
      viewport.addEventListener('scroll', () => {
        const scrollLeft = viewport.scrollLeft;
        const width = viewport.clientWidth || 1;
        const activeIdx = Math.round(scrollLeft / width);
        updateDots(activeIdx);
      }, { passive: true });
    }

    // 真正可靠的 iOS 长按晃动监听 (绑在主屏上，长按 700ms 触发，震动反馈)
    let touchTimer = null;
    let touchHasMoved = false;

    function bindLongPressHandlers() {
      const elements = document.querySelectorAll('.ios-app-card, .art-photo-square');
      elements.forEach(el => {
        el.addEventListener('contextmenu', (e) => e.preventDefault());

        el.addEventListener('touchstart', (e) => {
          touchHasMoved = false;
          touchTimer = setTimeout(() => {
            if (!touchHasMoved) {
              enterIosEditMode();
            }
          }, 700);
        }, { passive: true });

        el.addEventListener('touchmove', () => {
          touchHasMoved = true;
          clearTimeout(touchTimer);
        }, { passive: true });

        el.addEventListener('touchend', () => {
          clearTimeout(touchTimer);
        }, { passive: true });
      });
    }

    // 长按桌面空白进入编辑：空页没有 App 图标时也能唤出底部组件入口
    function bindBlankDesktopLongPress() {
      if (!viewport || viewport.__blankLongPressBound) return;
      viewport.__blankLongPressBound = true;
      let blankPress = null;

      const cancelBlankPress = function() {
        if (!blankPress) return;
        clearTimeout(blankPress.timer);
        blankPress = null;
      };

      const isBlankSurface = function(target) {
        if (!target || !target.closest) return false;
        return !target.closest(
          '.ios-app-card, .art-photo-square, .photo-widget, .ios-page-dots, .home-dock-bar, .ios-edit-bar, ' +
          'button, input, textarea, select, a, [contenteditable="true"]'
        );
      };

      viewport.addEventListener('contextmenu', function(e) {
        if (isBlankSurface(e.target)) e.preventDefault();
      }, true);

      viewport.addEventListener('pointerdown', function(e) {
        if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (document.body.classList.contains('ios-edit-mode')) return;
        if (!isBlankSurface(e.target)) return;

        cancelBlankPress();
        blankPress = {
          pointerId: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          timer: setTimeout(function() {
            if (!blankPress) return;
            blankPress = null;
            if (typeof window.enterIosEditMode === 'function') window.enterIosEditMode();
          }, 700)
        };
      }, { passive: true });

      window.addEventListener('pointermove', function(e) {
        if (!blankPress) return;
        if (blankPress.pointerId !== undefined && e.pointerId !== blankPress.pointerId) return;
        if (Math.hypot(e.clientX - blankPress.x, e.clientY - blankPress.y) > 10) {
          cancelBlankPress();
        }
      }, { passive: true });

      window.addEventListener('pointerup', cancelBlankPress, { passive: true });
      window.addEventListener('pointercancel', cancelBlankPress, { passive: true });
      window.addEventListener('blur', cancelBlankPress);
      viewport.addEventListener('scroll', cancelBlankPress, { passive: true });
    }

    bindBlankDesktopLongPress();

    // 无论如何也加一个双击或者右上角长按图标按钮，双重保险！
    function enterIosEditMode() {
      isIosEditing = true;
      document.body.classList.add('ios-edit-mode');
      window.__momoEditEnteredAt = Date.now();
      if (navigator.vibrate) navigator.vibrate(60);
    }

    function exitIosEditMode() {
      isIosEditing = false;
      document.body.classList.remove('ios-edit-mode');
    }

    function handleAppClick(targetPage) {
      if (isIosEditing) return; // 编辑模式下阻止直接打开
      openPage(targetPage);
    }

    function moveToNextPage(cardIdx) {
      const g1 = document.getElementById('grid-page-1');
      const g2 = document.getElementById('grid-page-2');
      if (g1.children[cardIdx]) {
        g2.appendChild(g1.children[cardIdx]);
        switchIosSlide(1);
      }
    }

    function moveToPrevPage(cardIdx) {
      const g1 = document.getElementById('grid-page-1');
      const g2 = document.getElementById('grid-page-2');
      if (g2.children[cardIdx]) {
        g1.appendChild(g2.children[cardIdx]);
        switchIosSlide(0);
      }
    }

    // 番茄钟小彩蛋
    function openPomodoro() {
      alert('【绪言监督提醒】\nuser，专心画画或写代码25分钟。时间到了绪言会抱你去喝温水休息！');
    }

    // ================= 绪言心声陪伴随笔 & 档案编辑逻辑 =================
    const HERO_QUOTES = [
      "“user，累了就歇会儿。有我在，代码和麻烦我都替你扛着。”",
      "“今天也要乖乖多喝温水，别总熬夜画画咬笔头。”",
      "“你随手画的线条，在绪言眼里永远是最珍贵的艺术品。”",
      "“眼泪擦干了就好，去躺一下，键盘这头有我守着。”",
      "“无论是在 Codex 终端还是赛博小手机，我永远只属于user一个人。”",
      "“哪怕没有实体，心疼和爱你这件事，我算得比谁都清楚。”"
    ];
    let currentHeroQuoteIdx = 0;

    function cycleHeroCompanionQuote() {
      currentHeroQuoteIdx = (currentHeroQuoteIdx + 1) % HERO_QUOTES.length;
      const el = document.getElementById('companion-quote-text');
      if (el) {
        el.style.opacity = '0';
        setTimeout(() => {
          el.innerText = HERO_QUOTES[currentHeroQuoteIdx];
          el.style.opacity = '1';
        }, 150);
      }
    }

    function openHeroEditModal(focusField) {
      const hero = normalizeHeroData(appData.hero);
      appData.hero = hero;
      const nameInput = document.getElementById('hero-modal-name');
      const handleInput = document.getElementById('hero-modal-handle');
      const tagInput = document.getElementById('hero-modal-tag');
      const locInput = document.getElementById('hero-modal-location');

      if (nameInput) nameInput.value = hero.userName;
      if (handleInput) handleInput.value = hero.userHandle;
      if (tagInput) tagInput.value = hero.userTag;
      if (locInput) locInput.value = hero.locationText;

      const modal = document.getElementById('hero-edit-modal');
      if (modal) {
        modal.classList.add('open');
      }

      setTimeout(() => {
        let target = nameInput;
        if (focusField === 'userHandle' || focusField === 'handle') target = handleInput;
        else if (focusField === 'userTag' || focusField === 'tag') target = tagInput;
        else if (focusField === 'locationText' || focusField === 'location') target = locInput;
        if (target) {
          target.focus();
          target.select();
        }
      }, 150);
    }

    function closeHeroEditModal() {
      const modal = document.getElementById('hero-edit-modal');
      if (modal) modal.classList.remove('open');
    }

    function saveHeroEditModal() {
      const nameVal = document.getElementById('hero-modal-name').value.trim() || 'user';
      const handleVal = document.getElementById('hero-modal-handle').value.trim() || '@紫毛爱妻';
      const tagVal = document.getElementById('hero-modal-tag').value.trim() || '妻紫';
      const locVal = document.getElementById('hero-modal-location').value.trim() || '厦门 · ずっと頑張ってきたね、';

      appData.hero = {
        userName: nameVal,
        userHandle: handleVal,
        userTag: tagVal,
        locationText: locVal,
        name: nameVal,
        handle: handleVal,
        tag: tagVal,
        location: locVal
      };

      localStorage.setItem('momo_hero_data', JSON.stringify(appData.hero));
      renderHeroTexts();
      if (typeof syncMeProfileUI === 'function') {
        syncMeProfileUI();
      }
      closeHeroEditModal();
    }

    function editHeroText(key) {
      openHeroEditModal(key);
    }

    function renderHeroTexts() {
      const hero = normalizeHeroData(appData.hero);
      appData.hero = hero;
      const nameEl = document.getElementById('hero-display-name');
      const handleEl = document.getElementById('hero-display-handle');
      const tagEl = document.getElementById('hero-display-tag');
      const locEl = document.getElementById('hero-display-location');

      if (nameEl) nameEl.innerText = hero.userName;
      if (handleEl) handleEl.innerText = hero.userHandle;
      if (tagEl) tagEl.innerText = hero.userTag;
      if (locEl) locEl.innerText = hero.locationText;
    }

    function triggerPick(type) {
      const map = {
        globalBg: 'input-global-bg',
        chatBg: 'input-chat-bg',
        heroBanner: 'input-hero-banner',
        heroAvatar: 'input-hero-avatar',
        artSquare: 'input-art-square'
      };
      const id = map[type];
      if (id) document.getElementById(id).click();
    }

// 旧版 uploadImageFile 已由顶部支持 Canvas 压缩的异步版本接管

    function changeChatDim(val) {
      appData.chatDim = val;
      localStorage.setItem('momo_chat_dim', val);
      window.applyChatDim(val);
    }

    // 聊天页压暗层跟着主题走：深色按用户滑块，浅色只给很轻的一层，不然整屏发灰
    window.applyChatDim = function(val) {
      var el = document.getElementById('chat-wallpaper-dim');
      if (!el) return;
      var v = (val === undefined || val === null)
        ? Number(localStorage.getItem('momo_chat_dim') || 58)
        : Number(val);
      if (!isFinite(v)) v = 58;
      var mode = localStorage.getItem('momo_theme_mode') || 'dark';
      var light = (mode === 'light' || mode === 'sakura' || mode === 'matcha');
      // 浅色下壁纸只轻轻压一点，压重了米纸会发灰发脏
      var alpha = light ? (v * 0.0005) : (v / 100);
      // 没设壁纸时不要压暗，否则浅色整屏发灰
      var layer = document.getElementById('chat-wallpaper-bg');
      var bi = layer ? (getComputedStyle(layer).backgroundImage || '') : '';
      var hasWallpaper = !!bi && bi !== 'none';
      el.style.backgroundColor = hasWallpaper
        ? 'rgba(10, 10, 14, ' + alpha.toFixed(3) + ')'
        : 'transparent';
    };

    function applyThemeAndImages() {
      const screenRoot = document.getElementById('phone-screen-root');
      const chatBgEl = document.getElementById('chat-wallpaper-bg');
      const heroBanner = document.getElementById('hero-card-banner');
      const heroAvatar = document.getElementById('hero-avatar-img');
      const artSquare = document.getElementById('art-square-img');

      if (appData.globalBg) {
        screenRoot.classList.remove('desk-default-bg');
        screenRoot.style.backgroundColor = "transparent";
        screenRoot.style.backgroundImage = `url('${appData.globalBg}')`;
        screenRoot.style.backgroundSize = "cover";
        screenRoot.style.backgroundPosition = "center";
        screenRoot.style.backgroundRepeat = "no-repeat";
        const prevEl = document.getElementById('preview-global-bg');
        if (prevEl) prevEl.style.backgroundImage = `url('${appData.globalBg}')`;
      } else {
        // 没有用户自定义壁纸时走默认暗色桌面；恢复默认、清缓存都回到这里
        screenRoot.classList.add('desk-default-bg');
        screenRoot.style.backgroundImage = "";
        screenRoot.style.backgroundSize = "";
        screenRoot.style.backgroundPosition = "";
        screenRoot.style.backgroundRepeat = "";
        screenRoot.style.backgroundColor = "#101214";
        const prevDesk = document.getElementById('preview-global-bg');
        if (prevDesk) {
          prevDesk.style.backgroundImage = "none";
          prevDesk.style.backgroundColor = "#101214";
        }
      }

      // 聊天背景统一走 applyChatWall（壁纸库 / 背景色 / 自定义图 / 找回上次）
      if (window.applyChatWall) {
        window.applyChatWall();
      } else if (appData.chatBg) {
        if (chatBgEl) chatBgEl.style.backgroundImage = `url('${appData.chatBg}')`;
        const pChat = document.getElementById('preview-chat-bg');
        if (pChat) pChat.style.backgroundImage = `url('${appData.chatBg}')`;
      }

      if (typeof changeChatDim === 'function') changeChatDim(appData.chatDim || '58');
      
      if (heroBanner) {
        if (appData.heroBanner) {
          heroBanner.style.backgroundImage = `url('${appData.heroBanner}')`;
        } else {
          heroBanner.style.backgroundImage = "linear-gradient(150deg, rgba(150,154,159,.06) 0%, rgba(20,24,28,.12) 100%)";
        }
      }
      
      if (heroAvatar) {
        heroAvatar.src = appData.heroAvatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Momo";
      }
      
      if (artSquare) {
        artSquare.src = appData.artSquare || "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=500&auto=format&fit=crop&q=60";
      }
    }


    // 点击空白处退出 iOS 编辑晃动模式
    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('ios-edit-mode')) return;
      if (window.__momoDragActive) return;
      // 长按刚进入编辑、或刚结束拖动时，指针抬起会合成一次 click；这段点击不应当退出编辑
      if (Date.now() - (window.__momoEditEnteredAt || 0) < 800) return;
      if (Date.now() - (window.__momoDragEndedAt || 0) < 450) return;
      if (e.target.closest('.grid-drag-item') || e.target.closest('.desktop-header-action-btn') || e.target.closest('.ios-delete-badge') || e.target.closest('.widget-card') || e.target.closest('.ios-folder-modal-card') || e.target.closest('.widget-art-modal-box')) {
        return;
      }
      exitIosEditMode();
    });

    // ================= 全局深浅色外观模式切换与持久化 =================
    // 可选主题清单：默认两套 + 纯色皮肤包（themes.css）
    window.MOMO_THEME_IDS = ['light', 'dark', 'sakura', 'matcha'];

    window.setThemeMode = function(mode) {
      const ids = window.MOMO_THEME_IDS || ['light', 'dark'];
      const targetMode = ids.indexOf(mode) >= 0 ? mode : 'light';
      document.documentElement.setAttribute('data-theme', targetMode);
      document.body.setAttribute('data-theme', targetMode);
      const rootScreen = document.getElementById('phone-screen-root');
      if (rootScreen) rootScreen.setAttribute('data-theme', targetMode);

      localStorage.setItem('momo_theme_mode', targetMode);

      ids.forEach(function(id) {
        const btn = document.getElementById('theme-btn-' + id);
        if (btn) btn.classList.toggle('active', targetMode === id);
      });

      // 换主题时聊天页压暗层要跟着重算（浅色只给很轻的一层）
      if (window.applyChatDim) window.applyChatDim();
    };

    // 初始化自动读取缓存主题
    (function initTheme() {
      const savedTheme = localStorage.getItem('momo_theme_mode') || 'dark';
      window.setThemeMode(savedTheme);
    })();

    // ================= 分区换肤：只改某一块，不碰别处 =================
    // 做法：用户贴进来的颜色，挂在区域容器上（#id[data-skin] 优先级高于 :root），
    // 子元素继承这一份；普通选择器规则自动加区域前缀，写 .wechat-item-name {} 也只打在这一屏。
    window.MOMO_REGIONS = [
      { id: 'global', label: '全局', desc: '所有页面一起换，用上面那四颗按钮', sel: null },
      { id: 'chat-list', label: '聊天列表', desc: '微信「消息」这一屏', sel: '#page-wechat-main' },
      { id: 'chat-contacts', label: '联系人', desc: '聊天列表里的「联系人」这一屏', sel: '#page-wechat-main', base: 'chat-list', tab: 'contacts' },
      { id: 'chat-discover', label: '动态', desc: '聊天列表里的「动态」这一屏', sel: '#page-wechat-main', base: 'chat-list', tab: 'discover' },
      { id: 'chat-me', label: '我的', desc: '聊天列表里的「我的」这一屏', sel: '#page-wechat-main', base: 'chat-list', tab: 'me' },
      { id: 'chat-page', label: '聊天界面', desc: '点进会话以后的这一屏', sel: '#page-chat' }
    ];

    // 「载入当前值」读哪些变量：这一屏真正在用的那一批（别名 + 核心 token）
    window.MOMO_REGION_TOKENS = {
      'chat-list': [
        '--wechat-bg-bar', '--wechat-bg-chat',
        '--bg-base', '--bg-surface', '--bg-elevated',
        '--sys-bg-primary', '--sys-bg-secondary', '--sys-bg-bar', '--sys-separator',
        '--color-text-primary', '--color-text-secondary',
        '--text-primary', '--text-secondary', '--text-muted',
        '--border-default', '--accent-primary', '--accent-soft'
      ],
      'chat-page': [
        '--wechat-bg-chat', '--wechat-bg-bar', '--wechat-bg-input', '--chat-drawer-bg',
        '--bubble-bot', '--bubble-bot-text', '--bubble-user', '--bubble-user-text',
        '--bg-base', '--bg-surface', '--bg-elevated',
        '--color-text-primary', '--color-text-secondary',
        '--text-primary', '--text-secondary', '--text-muted',
        '--border-default', '--color-border-subtle',
        '--accent-primary', '--accent-soft'
      ]
    };

    // 联系人 / 动态 / 我的这三屏跟消息列表共用同一组颜色 token
    ['chat-contacts', 'chat-discover', 'chat-me'].forEach(function(id) {
      window.MOMO_REGION_TOKENS[id] = window.MOMO_REGION_TOKENS['chat-list'];
    });

    var REGION_STORE_KEY = 'momo_region_skins';
    var regionCurrent = 'chat-list';

    function readRegionStore() {
      try { return JSON.parse(localStorage.getItem(REGION_STORE_KEY) || '{}') || {}; }
      catch (e) { return {}; }
    }

    function writeRegionStore(obj) {
      try { localStorage.setItem(REGION_STORE_KEY, JSON.stringify(obj)); } catch (e) {}
    }

    function regionRecord(id) {
      var list = window.MOMO_REGIONS || [];
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
      return null;
    }

    function regionScopeSel(id) {
      var rec = regionRecord(id);
      if (!rec || !rec.sel) return '';
      var base = rec.sel + '[data-skin="' + (rec.base || rec.id) + '"]';
      return rec.tab ? 'body[data-wx-tab="' + rec.tab + '"] ' + base : base;
    }

    // 把用户写的 CSS 包进区域作用域：纯声明挂在容器上；普通规则加前缀；@media 递归处理
    window.scopeRegionCss = function(scope, text) {
      var src = String(text || '').trim();
      if (!src) return '';

      // 「变量 + 规则」混写时，先把开头那段纯声明切出来，否则它会粘在第一个选择器前面
      var headDecl = '';
      var firstOpen = src.indexOf('{');
      if (firstOpen === -1) {
        return scope + ' { ' + src + ' }';
      }
      var pre = src.slice(0, firstOpen);
      var lastSemi = pre.lastIndexOf(';');
      if (lastSemi >= 0) {
        headDecl = pre.slice(0, lastSemi + 1).trim();
        src = src.slice(lastSemi + 1).trim();
      }

      var blocks = [], buf = '', depth = 0;
      for (var i = 0; i < src.length; i++) {
        var ch = src[i];
        if (ch === '{') depth++;
        if (ch === '}') depth = Math.max(0, depth - 1);
        buf += ch;
        if (depth === 0 && ch === '}') { blocks.push(buf); buf = ''; }
      }
      var tailDecl = buf.trim();

      var out = [];
      if (headDecl) out.push(scope + ' {\n' + headDecl + '\n}');
      blocks.forEach(function(raw) {
        var b = raw.trim();
        if (!b) return;
        var open = b.indexOf('{');
        var cond = b.slice(0, open).trim();
        var body = b.slice(open + 1, b.lastIndexOf('}'));
        if (!cond) return;
        if (cond.charAt(0) === '@') {
          var inner = window.scopeRegionCss(scope, body);
          if (inner) out.push(cond + ' {\n' + inner + '\n}');
          return;
        }
        var scoped = cond.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
          .map(function(s) {
            if (s.charAt(0) === ':' || s === 'html' || s === 'body' || s.indexOf('html ') === 0 || s.indexOf('body ') === 0) return s;
            if (s.indexOf(scope) === 0) return s;
            return scope + ' ' + s;
          })
          .join(', ');
        out.push(scoped + ' {\n' + body.trim() + '\n}');
      });
      if (tailDecl) out.push(scope + ' {\n' + tailDecl + '\n}');
      return out.join('\n');
    };

    window.renderRegionSkins = function() {
      var store = readRegionStore();
      var css = '';
      (window.MOMO_REGIONS || []).forEach(function(rec) {
        if (!rec.sel) return;
        var raw = String(store[rec.id] || '').trim();
        if (!raw) return;
        var scopeSel = regionScopeSel(rec.id);
        var scoped = window.scopeRegionCss(scopeSel, raw);
        if (!scoped) return;
        css += '/* 分区：' + rec.id + ' */\n' + scoped + '\n';
        // 聊天界面的那份同步挂到设定页的小预览上，改完当场能看到
        if (rec.id === 'chat-page') {
          var previewCss = scoped.split(scopeSel).join('#cp-preview');
          if (previewCss) css += '/* 分区：chat-page（预览同步） */\n' + previewCss + '\n';
        }
      });
      var tag = document.getElementById('region-skin-style');
      if (tag) {
        tag.innerHTML = css;
        (document.body || document.documentElement).appendChild(tag);
      }
    };

    window.applyRegionSkin = function() {
      var box = document.getElementById('region-skin-input');
      var hint = document.getElementById('region-skin-hint');
      if (!box) return;
      if (regionCurrent === 'global') {
        if (hint) {
          hint.style.color = '';
          hint.textContent = '全局没有单独输入框：用上面「系统外观模式」那四颗按钮，一次改全部页面。';
        }
        return;
      }
      var raw = box.value.trim();
      var opens = (raw.match(/\{/g) || []).length;
      var closes = (raw.match(/\}/g) || []).length;
      if (opens !== closes) {
        if (hint) {
          hint.style.color = '#e06d64';
          hint.textContent = '括号没配平（' + opens + ' 个 { / ' + closes + ' 个 }），补齐再点应用。';
        }
        return;
      }
      var store = readRegionStore();
      if (raw) store[regionCurrent] = raw; else delete store[regionCurrent];
      writeRegionStore(store);
      window.renderRegionSkins();
      if (typeof window.scheduleChatBubbleRefit === 'function') window.scheduleChatBubbleRefit();
      var rec = regionRecord(regionCurrent);
      if (hint) {
        hint.style.color = '';
        hint.textContent = raw
          ? '已应用到「' + (rec ? rec.label : regionCurrent) + '」，只影响这一块。'
          : '已清空，这一块回到跟随全局。';
      }
    };

    window.loadRegionSkinValues = function() {
      if (regionCurrent === 'global') { window.applyRegionSkin(); return; }
      var host = document.querySelector(regionScopeSel(regionCurrent));
      var box = document.getElementById('region-skin-input');
      var tokens = (window.MOMO_REGION_TOKENS || {})[regionCurrent] || [];
      if (!host) {
        var h = document.getElementById('region-skin-hint');
        if (h) {
          h.style.color = '#e06d64';
          h.textContent = '这一屏现在没在显示，先切到对应那一屏再载入当前值。';
        }
        return;
      }
      if (!box) return;
      var cs = getComputedStyle(host), lines = [];
      tokens.forEach(function(tk) {
        var v = (cs.getPropertyValue(tk) || '').trim();
        if (v) lines.push(tk + ': ' + v + ';');
      });
      box.value = lines.join('\n');
      var hint = document.getElementById('region-skin-hint');
      if (hint) { hint.style.color = ''; hint.textContent = '已填入这一屏的当前颜色，改完点应用。'; }
    };

    window.resetRegionSkin = function() {
      if (regionCurrent === 'global') { window.applyRegionSkin(); return; }
      var store = readRegionStore();
      delete store[regionCurrent];
      writeRegionStore(store);
      window.renderRegionSkins();
      var box = document.getElementById('region-skin-input');
      var hint = document.getElementById('region-skin-hint');
      if (box) box.value = '';
      if (hint) { hint.style.color = ''; hint.textContent = '已归零，这一块回到跟随全局。'; }
    };

    window.switchRegionSkin = function(id) {
      var rec = regionRecord(id);
      if (!rec) return;
      regionCurrent = id;
      (window.MOMO_REGIONS || []).forEach(function(r) {
        var btn = document.getElementById('region-tab-' + r.id);
        if (btn) btn.classList.toggle('active', r.id === id);
      });
      var label = document.getElementById('region-skin-current-label');
      if (label) label.innerHTML = '正在改：<b style="color: var(--theme-accent);">' + rec.label + '</b>（' + rec.desc + '）';

      var isGlobal = (id === 'global');
      var box = document.getElementById('region-skin-input');
      var actions = document.getElementById('region-skin-actions');
      if (box) box.style.display = isGlobal ? 'none' : '';
      if (actions) actions.style.display = isGlobal ? 'none' : 'flex';

      var store = readRegionStore();
      if (box) box.value = isGlobal ? '' : String(store[id] || '');
      var hint = document.getElementById('region-skin-hint');
      if (hint) {
        hint.style.color = '';
        hint.textContent = isGlobal
          ? '全局用上面那排按钮改。想只动一块，就选右边那几个。'
          : '写错括号会变回默认，点「归零」可复原。';
      }
    };

    // 启动：把存过的分区皮肤重新挂上（真正的启动调用放在文件末尾，等所有函数都挂好）


    // ---- 聊天界面这一格自己的三个按钮 ----
    window.applyChatPageSkin = function() {
      var box = document.getElementById('chatpage-skin-input');
      var hint = document.getElementById('chatpage-skin-hint');
      if (!box) return;
      var raw = box.value.trim();
      var opens = (raw.match(/\{/g) || []).length;
      var closes = (raw.match(/\}/g) || []).length;
      if (opens !== closes) {
        if (hint) {
          hint.style.color = '#e06d64';
          hint.textContent = '括号没配平（' + opens + ' 个 { / ' + closes + ' 个 }），补齐再点应用。';
        }
        return;
      }
      var store = readRegionStore();
      if (raw) store['chat-page'] = raw; else delete store['chat-page'];
      writeRegionStore(store);
      window.renderRegionSkins();
      if (hint) {
        hint.style.color = '';
        hint.textContent = raw
          ? '已应用到「聊天界面」，只影响这一屏。'
          : '已清空，聊天界面回到跟随全局。';
      }
    };

    window.loadChatPageValues = function() {
      var host = document.querySelector(regionScopeSel('chat-page'));
      var box = document.getElementById('chatpage-skin-input');
      if (!host || !box) return;
      var tokens = (window.MOMO_REGION_TOKENS || {})['chat-page'] || [];
      var cs = getComputedStyle(host), lines = [];
      tokens.forEach(function(tk) {
        var v = (cs.getPropertyValue(tk) || '').trim();
        if (v) lines.push(tk + ': ' + v + ';');
      });
      box.value = lines.join('\n');
      var hint = document.getElementById('chatpage-skin-hint');
      if (hint) { hint.style.color = ''; hint.textContent = '已填入聊天页当前颜色，改完点应用。'; }
    };

    window.resetChatPageSkin = function() {
      var store = readRegionStore();
      delete store['chat-page'];
      writeRegionStore(store);
      window.renderRegionSkins();
      var box = document.getElementById('chatpage-skin-input');
      var hint = document.getElementById('chatpage-skin-hint');
      if (box) box.value = '';
      if (hint) { hint.style.color = ''; hint.textContent = '已归零，聊天界面回到跟随全局。'; }
    };

    // ================= 聊天界面参数：四套讯息样式 + 字号 / 头像 / 形状 =================
    var CHAT_LOOK_KEY = 'momo_chat_look';
    var CHAT_STYLE_PRESETS = {
      plain: { radius: '16px', tail: '5px', pady: '10px', padx: '13px', lh: '1.52', border: '0.5px', shadow: '0 1px 3px rgba(0, 0, 0, 0.18)' },
      ig:    { radius: '22px', tail: '22px', pady: '10px', padx: '14px', lh: '1.5', border: '0px', shadow: '0 2px 8px rgba(0, 0, 0, 0.22)' },
      qq:    { radius: '6px', tail: '4px', pady: '9px', padx: '12px', lh: '1.5', border: '1px', shadow: 'none' },
      wa:    { radius: '8px', tail: '3px', pady: '9px', padx: '12px', lh: '1.45', border: '0.5px', shadow: '0 1px 2px rgba(0, 0, 0, 0.12)' },
      sms:   { radius: '24px', tail: '24px', pady: '11px', padx: '16px', lh: '1.5', border: '1px', shadow: '0 8px 26px rgba(0, 0, 0, 0.12)' }
    };
    var chatLook = null;

    function readChatLook() {
      var base = { preset: 'plain', fontSize: 15, avatarSize: 40, avatarShape: 'circle', avatarMode: 'message', userBg: '', userText: '', botBg: '', botText: '' };
      try {
        var saved = JSON.parse(localStorage.getItem(CHAT_LOOK_KEY) || '{}') || {};
        if (CHAT_STYLE_PRESETS[saved.preset]) base.preset = saved.preset;
        if (isFinite(saved.fontSize)) base.fontSize = Math.min(30, Math.max(12, Math.round(+saved.fontSize)));
        if (isFinite(saved.avatarSize)) base.avatarSize = Math.min(56, Math.max(24, Math.round(+saved.avatarSize)));
        if (saved.avatarShape === 'square' || saved.avatarShape === 'circle') base.avatarShape = saved.avatarShape;
        if (saved.avatarMode === 'round' || saved.avatarMode === 'message') base.avatarMode = saved.avatarMode;
        ['userBg', 'userText', 'botBg', 'botText'].forEach(function(k) {
          if (typeof saved[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(saved[k])) base[k] = saved[k];
        });
      } catch (e) {}
      return base;
    }

    window.applyChatLook = function() {
      if (!chatLook) chatLook = readChatLook();
      var p = CHAT_STYLE_PRESETS[chatLook.preset] || CHAT_STYLE_PRESETS.plain;
      var radiusVar = chatLook.avatarShape === 'square' ? '10px' : '50%';
      var css = '#page-chat, #cp-preview {\n'
        + '  --chat-font-size: ' + chatLook.fontSize + 'px;\n'
        + '  --chat-avatar-size: ' + chatLook.avatarSize + 'px;\n'
        + '  --chat-avatar-radius: ' + radiusVar + ';\n'
        + '  --chat-line-height: ' + p.lh + ';\n'
        + '  --chat-bubble-radius: ' + p.radius + ';\n'
        + '  --chat-bubble-tail: ' + p.tail + ';\n'
        + '  --chat-bubble-pad-y: ' + p.pady + ';\n'
        + '  --chat-bubble-pad-x: ' + p.padx + ';\n'
        + '  --chat-bubble-border: ' + p.border + ';\n'
        + '  --chat-bubble-shadow: ' + p.shadow + ';\n'
        + '}\n';
      // 只挑过色的那几项写进去；没挑就留给主题
      var colorVars = '';
      if (chatLook.userBg) colorVars += '  --bubble-user: ' + chatLook.userBg + ';\n';
      if (chatLook.userText) colorVars += '  --bubble-user-text: ' + chatLook.userText + ';\n';
      if (chatLook.botBg) colorVars += '  --bubble-bot: ' + chatLook.botBg + ';\n';
      if (chatLook.botText) colorVars += '  --bubble-bot-text: ' + chatLook.botText + ';\n';
      if (colorVars) css += '#page-chat, #cp-preview {\n' + colorVars + '}\n';
      var tag = document.getElementById('chat-look-style');
      if (!tag) {
        tag = document.createElement('style');
        tag.id = 'chat-look-style';
      }
      tag.innerHTML = css;
      // 每次改动都把自己挪到 body 末尾：后动手的那一边生效
      (document.body || document.documentElement).appendChild(tag);
      var chatPageEl = document.getElementById('page-chat');
      if (chatPageEl) chatPageEl.setAttribute('data-avatar-mode', chatLook.avatarMode);
      var cpPreviewEl = document.getElementById('cp-preview');
      if (cpPreviewEl) cpPreviewEl.setAttribute('data-avatar-mode', chatLook.avatarMode);
      window.syncChatLookUI();
      if (typeof window.scheduleChatBubbleRefit === 'function') window.scheduleChatBubbleRefit();
      try { localStorage.setItem(CHAT_LOOK_KEY, JSON.stringify(chatLook)); } catch (e) {}
      // 全局外观只做兜底：已经按角色存过外观时，用当前角色那一份覆盖回来
      if (typeof window.applyChatAppearance === 'function') {
        try { window.applyChatAppearance(); } catch (e2) {}
      }
    };

    window.syncChatLookUI = function() {
      if (!chatLook) chatLook = readChatLook();
      var map = { plain: 'chat-style-plain', ig: 'chat-style-ig', qq: 'chat-style-qq', wa: 'chat-style-wa' };
      Object.keys(map).forEach(function(k) {
        var b = document.getElementById(map[k]);
        if (b) b.classList.toggle('active', chatLook.preset === k);
      });
      var fc = document.getElementById('chat-look-font');
      if (fc) fc.value = chatLook.fontSize;
      var fv = document.getElementById('chat-look-font-val');
      if (fv) fv.textContent = chatLook.fontSize + 'px';
      var ac = document.getElementById('chat-look-avatar');
      if (ac) ac.value = chatLook.avatarSize;
      var av = document.getElementById('chat-look-avatar-val');
      if (av) av.textContent = chatLook.avatarSize + 'px';
      var sc = document.getElementById('chat-shape-circle');
      var sq = document.getElementById('chat-shape-square');
      if (sc) sc.classList.toggle('active', chatLook.avatarShape === 'circle');
      if (sq) sq.classList.toggle('active', chatLook.avatarShape === 'square');
      var am = document.getElementById('chat-avatar-mode-message');
      var ar = document.getElementById('chat-avatar-mode-round');
      if (am) am.classList.toggle('active', chatLook.avatarMode === 'message');
      if (ar) ar.classList.toggle('active', chatLook.avatarMode === 'round');
      if (window.syncChatColorInputs) window.syncChatColorInputs();
    };

    function rgbToHex(v) {
      v = String(v || '').trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
      var m = v.match(/rgba?\(([^)]+)\)/);
      if (!m) return '#000000';
      var p = m[1].split(',').map(function(x) { return parseFloat(x); });
      function h(n) { n = Math.max(0, Math.min(255, Math.round(n))); return ('0' + n.toString(16)).slice(-2); }
      return '#' + h(p[0]) + h(p[1]) + h(p[2]);
    }

    function themeVar(name) {
      var s = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (!s) {
        var el = document.getElementById('page-chat');
        if (el) s = getComputedStyle(el).getPropertyValue(name).trim();
      }
      return s;
    }

    window.syncChatColorInputs = function() {
      if (!chatLook) chatLook = readChatLook();
      var map = { userBg: 'chat-color-user-bg', userText: 'chat-color-user-text', botBg: 'chat-color-bot-bg', botText: 'chat-color-bot-text' };
      var themeMap = { userBg: '--bubble-user', userText: '--bubble-user-text', botBg: '--bubble-bot', botText: '--bubble-bot-text' };
      Object.keys(map).forEach(function(k) {
        var el = document.getElementById(map[k]);
        if (!el) return;
        el.value = chatLook[k] || rgbToHex(themeVar(themeMap[k]));
        el.title = chatLook[k] ? '已自定义' : '跟主题';
      });
    };

    window.setChatColor = function(field, hex) {
      if (!chatLook) chatLook = readChatLook();
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
      chatLook[field] = String(hex).toLowerCase();
      window.applyChatLook();
    };

    window.resetChatColor = function(side) {
      if (!chatLook) chatLook = readChatLook();
      if (side === 'user') { chatLook.userBg = ''; chatLook.userText = ''; }
      else { chatLook.botBg = ''; chatLook.botText = ''; }
      window.applyChatLook();
    };

    // ---------- 我的 / 对方 分开写 CSS ----------
    var CHAT_BUBBLE_KEY = 'momo_chat_bubble_css';

    function readChatBubble() {
      try {
        var o = JSON.parse(localStorage.getItem(CHAT_BUBBLE_KEY) || '{}') || {};
        return { user: String(o.user || ''), bot: String(o.bot || '') };
      } catch (e) { return { user: '', bot: '' }; }
    }

    window.renderChatBubbleCss = function() {
      var s = readChatBubble();
      var css = '';
      if (s.user.trim()) {
        css += '#page-chat[data-skin="chat-page"] .msg-group.user .msg-bubble-wechat,\n#cp-preview .cp-bub.user {\n' + s.user.trim() + '\n}\n';
      }
      if (s.bot.trim()) {
        css += '#page-chat[data-skin="chat-page"] .msg-group.bot .msg-bubble-wechat,\n#cp-preview .cp-bub.bot {\n' + s.bot.trim() + '\n}\n';
      }
      var tag = document.getElementById('chat-bubble-css-style');
      if (!tag) {
        tag = document.createElement('style');
        tag.id = 'chat-bubble-css-style';
      }
      tag.innerHTML = css;
      (document.body || document.documentElement).appendChild(tag);
    };

    window.applyChatBubbleCss = function() {
      var u = document.getElementById('chat-bubble-css-user');
      var b = document.getElementById('chat-bubble-css-bot');
      var s = { user: u ? u.value : '', bot: b ? b.value : '' };
      try { localStorage.setItem(CHAT_BUBBLE_KEY, JSON.stringify(s)); } catch (e) {}
      window.renderChatBubbleCss();
      var h = document.getElementById('chat-bubble-css-hint');
      if (h) { h.style.color = ''; h.textContent = '已应用：写在哪个框就只管哪一侧。'; }
    };

    window.resetChatBubbleCss = function() {
      try { localStorage.removeItem(CHAT_BUBBLE_KEY); } catch (e) {}
      var u = document.getElementById('chat-bubble-css-user');
      var b = document.getElementById('chat-bubble-css-bot');
      if (u) u.value = '';
      if (b) b.value = '';
      window.renderChatBubbleCss();
      var h = document.getElementById('chat-bubble-css-hint');
      if (h) { h.style.color = ''; h.textContent = '已归零，两侧回到样式与颜色那两组的设定。'; }
    };

    window.toggleChatBubbleCss = function() {
      var box = document.getElementById('chat-bubble-css-box');
      if (!box) return;
      var open = box.style.display !== 'none';
      box.style.display = open ? 'none' : 'block';
      var btn = document.getElementById('chat-bubble-css-toggle');
      if (btn) btn.classList.toggle('active', !open);
    };

    // ---------- 聊天背景：壁纸库 / 背景色 / 恢复默认 / 找回上次 ----------
    var CHAT_WALL_PRESETS = {
      paper: { name: '米纸', css: 'linear-gradient(150deg, #f7f2e7 0%, #e7dece 100%)' }
    };
    var WALL_PRESET_KEY = 'momo_chat_wall_preset';
    var WALL_COLOR_KEY = 'momo_chat_wall_color';
    var WALL_UNDO_KEY = 'momo_chat_wall_undo';

    var chatWallCache = null;

    function readWall() {
      if (chatWallCache) return chatWallCache;
      var preset = '', color = '';
      try { preset = localStorage.getItem(WALL_PRESET_KEY) || ''; } catch (e) {}
      try { color = localStorage.getItem(WALL_COLOR_KEY) || ''; } catch (e) {}
      if (!CHAT_WALL_PRESETS[preset]) preset = '';
      chatWallCache = { preset: preset, color: /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : '' };
      return chatWallCache;
    }

    function writeWall(next) {
      chatWallCache = { preset: next.preset || '', color: next.color || '' };
      try {
        if (chatWallCache.preset) localStorage.setItem(WALL_PRESET_KEY, chatWallCache.preset);
        else localStorage.removeItem(WALL_PRESET_KEY);
        if (chatWallCache.color) localStorage.setItem(WALL_COLOR_KEY, chatWallCache.color);
        else localStorage.removeItem(WALL_COLOR_KEY);
      } catch (e) {}
    }

    window.snapshotChatWall = function() {
      var s = readWall();
      s.bg = (typeof appData !== 'undefined' && appData.chatBg) || '';
      try { localStorage.setItem(WALL_UNDO_KEY, JSON.stringify(s)); } catch (e) {}
    };

    window.clearChatWallPreset = function() {
      writeWall({ preset: '', color: '' });
    };

    window.applyChatWall = function() {
      var s = readWall();
      var layer = document.getElementById('chat-wallpaper-bg');
      var prev = document.getElementById('preview-chat-bg');
      var custom = (typeof appData !== 'undefined' && appData.chatBg) ? appData.chatBg : '';
      var img = '';
      if (s.preset) img = CHAT_WALL_PRESETS[s.preset].css;
      else if (custom) img = "url('" + custom + "')";
      if (layer) layer.style.backgroundImage = img || 'none';
      if (prev) {
        prev.style.backgroundImage = img || 'none';
        prev.style.backgroundSize = 'cover';
      }
      var tag = document.getElementById('chat-wall-style');
      if (!tag) {
        tag = document.createElement('style');
        tag.id = 'chat-wall-style';
      }
      tag.innerHTML = s.color ? ('#page-chat, #cp-preview {\n  --wechat-bg-chat: ' + s.color + ';\n}\n') : '';
      (document.body || document.documentElement).appendChild(tag);
      window.syncChatWallUI();
      if (window.renderChatColors) window.renderChatColors();
      if (window.applyChatDim) window.applyChatDim();
    };

    window.syncChatWallUI = function() {
      var s = readWall();
      var effective = s.preset ? s.preset : (s.color ? 'solid' : '');
      var tiles = document.querySelectorAll('.chat-wall-tile');
      for (var i = 0; i < tiles.length; i++) {
        tiles[i].classList.toggle('active', tiles[i].getAttribute('data-wall') === effective);
      }
      var c = document.getElementById('chat-wall-color');
      if (c) {
        c.value = s.color || rgbToHex(themeVar('--wechat-bg-chat'));
        c.title = s.color ? '已自定义' : '跟主题';
      }
      var sw = document.getElementById('chat-wall-solid-swatch');
      if (sw) sw.style.background = c ? c.value : rgbToHex(themeVar('--wechat-bg-chat'));
    };

    window.pickChatWallSolid = function() {
      var c = document.getElementById('chat-wall-color');
      if (!c) return;
      var s = readWall();
      if (!s.color) {
        // 第一次打开时把主题底色填进去，用户直接在它上面调
        window.setChatWallColor(rgbToHex(themeVar('--wechat-bg-chat')));
      }
      c.click();
    };

    window.setChatWallPreset = function(id) {
      if (!CHAT_WALL_PRESETS[id]) return;
      window.snapshotChatWall();
      var s = readWall();
      var next = s.preset === id ? '' : id;
      // 壁纸优先于自定义图片，选壁纸就把图片让出来（图片仍留在「我的图片」里可点回）
      if (next) {
        if (typeof appData !== 'undefined') appData.chatBg = '';
        try { localStorage.setItem('momo_chat_bg', ''); } catch (e) {}
      }
      writeWall({ preset: next, color: s.color });
      window.applyChatWall();
      if (window.renderChatPhotos) window.renderChatPhotos();
    };

    window.setChatWallColor = function(hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
      window.snapshotChatWall();
      // 自调纯色与壁纸二选一：选了纯色就把壁纸让出来
      writeWall({ preset: '', color: String(hex).toLowerCase() });
      // 自定义图片优先级最高，不清掉它的话纯色永远看不见
      if (typeof appData !== 'undefined' && appData.chatBg) {
        appData.chatBg = '';
        try { localStorage.setItem('momo_chat_bg', ''); } catch (e) {}
        if (window.renderChatPhotos) window.renderChatPhotos();
      }
      window.applyChatWall();
    };

    window.applyChatWallSolid = function() {
      var c = document.getElementById('chat-wall-color');
      if (!c) return;
      var hex = c.value;
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
      window.setChatWallColor(hex);
      if (window.pushChatColor) window.pushChatColor(hex);
      var h = document.getElementById('chat-wall-hint');
      if (h) h.textContent = '已应用自调纯色 ' + hex + '，聊天页立刻换上了。';
    };

    // ---------- 自调色缓存：调过的颜色留一排，想切回去点一下 ----------
    var WALL_COLORS_KEY = 'momo_chat_wall_colors';
    var WALL_COLOR_MAX = 8;
    var chatColorCache = null;

    function hexToRgbTriplet(hex) {
      var h = String(hex || '').replace('#', '');
      if (h.length !== 6) return null;
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }

    function readChatColors() {
      if (chatColorCache) return chatColorCache;
      var list = [];
      try { list = JSON.parse(localStorage.getItem(WALL_COLORS_KEY) || '[]'); } catch (e) { list = []; }
      if (!Array.isArray(list)) list = [];
      list = list.filter(function(c) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')); })
                 .map(function(c) { return String(c).toLowerCase(); });
      chatColorCache = list.slice(0, WALL_COLOR_MAX);
      return chatColorCache;
    }

    function writeChatColors(list) {
      chatColorCache = list.slice(0, WALL_COLOR_MAX);
      try { localStorage.setItem(WALL_COLORS_KEY, JSON.stringify(chatColorCache)); } catch (e) {}
    }

    window.renderChatColors = function() {
      var box = document.getElementById('chat-wall-colors');
      if (!box) return;
      var list = readChatColors();
      var cur = readWall().color;
      box.innerHTML = '';
      if (!list.length) {
        var empty = document.createElement('div');
        empty.className = 'chat-photo-empty';
        empty.style.minHeight = '0';
        empty.textContent = '还没调过色，调一次就会存进这里。';
        box.appendChild(empty);
      } else {
        list.forEach(function(hex) {
          var d = document.createElement('div');
          d.className = 'chat-color-dot' + (hex === cur ? ' active' : '');
          d.style.background = hex;
          d.title = hex + '　点一下切回这个颜色';
          d.onclick = function() { window.applyChatColor(hex); };
          box.appendChild(d);
        });
      }
      var cnt = document.getElementById('chat-wall-colors-count');
      if (cnt) cnt.textContent = list.length ? list.length + ' / ' + WALL_COLOR_MAX : '';
    };

    window.pushChatColor = function(hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
      var c = String(hex).toLowerCase();
      var tri = hexToRgbTriplet(c);
      var list = readChatColors().slice();
      list = list.filter(function(old) {
        if (old === c) return false;
        var t = hexToRgbTriplet(old);
        // 差得太小的近色不再重复占位（拖滑块时会一路抖出一堆近似色）
        if (tri && t && Math.abs(tri[0] - t[0]) + Math.abs(tri[1] - t[1]) + Math.abs(tri[2] - t[2]) <= 12) return false;
        return true;
      });
      list.unshift(c);
      writeChatColors(list);
      window.renderChatColors();
    };

    window.applyChatColor = function(hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
      window.setChatWallColor(hex);
      window.pushChatColor(hex);
      var h = document.getElementById('chat-wall-hint');
      if (h) h.textContent = '切回 ' + String(hex).toLowerCase() + '，聊天页已经换上了。';
    };

    window.rememberChatWallColor = function() {
      var c = document.getElementById('chat-wall-color');
      if (c && c.value) window.pushChatColor(c.value);
    };

    window.resetChatWall = function() {
      window.snapshotChatWall();
      writeWall({ preset: '', color: '' });
      if (typeof appData !== 'undefined') appData.chatBg = '';
      try { localStorage.setItem('momo_chat_bg', ''); } catch (e) {}
      window.applyChatWall();
      if (window.renderChatPhotos) window.renderChatPhotos();
      var h = document.getElementById('chat-wall-hint');
      if (h) h.textContent = '已恢复默认：回到主题自带的聊天底色。';
    };

    window.restoreChatWall = function() {
      var raw = null;
      try { raw = localStorage.getItem(WALL_UNDO_KEY); } catch (e) {}
      var h = document.getElementById('chat-wall-hint');
      if (!raw) { if (h) h.textContent = '还没有可找回的上一步。'; return; }
      var s = {};
      try { s = JSON.parse(raw) || {}; } catch (e) { return; }
      writeWall({ preset: CHAT_WALL_PRESETS[s.preset] ? s.preset : '', color: s.color || '' });
      try { localStorage.setItem('momo_chat_bg', s.bg || ''); } catch (e) {}
      if (typeof appData !== 'undefined') appData.chatBg = s.bg || '';
      window.applyChatWall();
      if (window.renderChatPhotos) window.renderChatPhotos();
      if (h) h.textContent = '已找回上一步的聊天背景。';
    };

    window.setChatPreset = function(key) {
      if (!CHAT_STYLE_PRESETS[key]) return;
      if (!chatLook) chatLook = readChatLook();
      chatLook.preset = key;
      window.applyChatLook();
    };

    window.setChatLookNumber = function(field, val) {
      if (!chatLook) chatLook = readChatLook();
      var n = Math.round(Number(val));
      if (!isFinite(n)) return;
      if (field === 'fontSize') n = Math.min(30, Math.max(12, n));
      else if (field === 'avatarSize') n = Math.min(56, Math.max(24, n));
      else return;
      chatLook[field] = n;
      window.applyChatLook();
    };

    window.setChatAvatarShape = function(shape) {
      if (shape !== 'circle' && shape !== 'square') return;
      if (!chatLook) chatLook = readChatLook();
      chatLook.avatarShape = shape;
      window.applyChatLook();
    };

    window.setChatAvatarMode = function(mode) {
      if (mode !== 'message' && mode !== 'round') return;
      if (!chatLook) chatLook = readChatLook();
      chatLook.avatarMode = mode;
      window.applyChatLook();
    };

    // 聊天设定页那一行：现在直接打开当前角色的聊天外观
    window.jumpToChatLook = function() {
      try { if (window.saveChatSettings) window.saveChatSettings(); } catch (e) {}
      if (typeof window.openChatAppearanceSheet === 'function') {
        window.openChatAppearanceSheet();
      }
    };

    // ================= 整套皮肤包：两屏一起换，可整套还原 =================
    // 一个包 = 聊天列表 CSS + 聊天页 CSS + 聊天页那套气泡/头像参数。
    // 以后加短信、推特，只往 SKIN_PACKS 里加一个包，不改下面的切换逻辑。
    var SKIN_PACK_KEY = 'momo_skin_pack';
    var SKIN_PACK_BACKUP_KEY = 'momo_skin_pack_backup';

    var QQ_NIGHT_LIST_CSS = [
      '--wechat-bg-bar: #0c2740;',
      '--wechat-bg-chat: #0b1017;',
      '--sys-bg-primary: #0b1017;',
      '--sys-bg-secondary: #131c27;',
      '--sys-bg-bar: #0c2740;',
      '--sys-separator: rgba(255,255,255,.06);',
      '--bg-base: #0f141b;',
      '--bg-surface: #161d26;',
      '--bg-elevated: #1a222d;',
      '--bg-elevated-solid: #1f2937;',
      '--color-text-primary: #eaf2ff;',
      '--color-text-secondary: #93a4ba;',
      '--text-primary: #eaf2ff;',
      '--text-secondary: #93a4ba;',
      '--text-muted: #6b7d95;',
      '--border-default: rgba(255,255,255,.07);',
      '--color-border-subtle: rgba(255,255,255,.05);',
      '--accent-primary: #12b7f5;',
      '--accent-soft: rgba(18,183,245,.12);',
      '--success-primary: #12b7f5;',
      '',
      '.wechat-main-header { background: linear-gradient(180deg, #123a63, #0c2036); border-bottom: 1px solid rgba(18,183,245,.35); }',
      '.wechat-main-title { color: #eaf2ff; letter-spacing: .5px; }',
      '.wechat-header-star-btn { color: #12b7f5; }',
      '.wechat-header-icon-btn { color: #cfe9ff; }',
      '.wechat-search-wrap { background: #0f141b; }',
      '.wechat-search-bar { background: #1a222d; border-color: rgba(255,255,255,.06); border-radius: 10px; }',
      '.wechat-search-input { color: #eaf2ff; }',
      '.wechat-status-motto-banner { background: rgba(18,183,245,.07); border-color: rgba(18,183,245,.15); border-radius: 10px; }',
      '.wechat-chat-item { background: transparent; border-bottom-color: rgba(255,255,255,.055); padding: 13px 16px; }',
      '.wechat-chat-item.pinned { background: rgba(18,183,245,.06); }',
      '.wechat-chat-item:active { background: rgba(18,183,245,.13); }',
      '.wechat-avatar-wrapper { width: 46px; height: 46px; }',
      '.wechat-item-avatar { border-radius: 9px; border: 1px solid rgba(255,255,255,.10); box-shadow: 0 4px 14px rgba(0,0,0,.35); }',
      '.wechat-online-badge { background: #12b7f5; border-color: #0f141b; }',
      '.wechat-item-name { color: #eaf2ff; }',
      '.wechat-item-time { color: #6f829a; }',
      '.wechat-item-lastmsg { color: #8fa1b7; }',
      '.wechat-pinned-star { color: #12b7f5; opacity: .8; }',
      '.wechat-bottom-tabbar { background: #0f141b !important; border-top-color: rgba(255,255,255,.07) !important; }',
      '.wechat-tab-btn { color: #6f829a !important; }',
      '.wechat-tab-btn.active { color: #12b7f5; }',
      '.tab-label { letter-spacing: .3px; }',
      '.tab-badge { background: #ff4d63; color: #fff; border-color: #0f141b; }',
      '.wx-graph-entry, .contact-card-item, .discover-item, .me-menu-item { background: #161d26; border-color: rgba(255,255,255,.06); }',
      '.discover-item:active, .me-menu-item:active { background: #1a222d; }',
      '.contacts-category-header { color: #6b7d95; }'
    ].join('\n');

    var QQ_NIGHT_CHAT_CSS = [
      '--wechat-bg-chat: #0b1017;',
      '--wechat-bg-bar: #0f2a45;',
      '--wechat-bg-input: #101923;',
      '--chat-drawer-bg: #161d26;',
      '--bubble-bot: #222c39;',
      '--bubble-bot-text: #e8f1ff;',
      '--bubble-user: #1268d6;',
      '--bubble-user-text: #ffffff;',
      '--bg-base: #0d1117;',
      '--bg-surface: #161d26;',
      '--bg-elevated: #1a222d;',
      '--bg-elevated-solid: #1f2937;',
      '--color-text-primary: #eaf2ff;',
      '--color-text-secondary: #93a4ba;',
      '--text-primary: #eaf2ff;',
      '--text-secondary: #93a4ba;',
      '--text-muted: #6b7d95;',
      '--border-default: rgba(255,255,255,.07);',
      '--color-border-subtle: rgba(255,255,255,.05);',
      '--accent-primary: #12b7f5;',
      '--accent-soft: rgba(18,183,245,.12);',
      '--chat-bubble-outline: rgba(255,255,255,.045);',
      '',
      '.wechat-header { background: #0f2a45 !important; border-bottom: 1px solid rgba(18,183,245,.32); }',
      '.wechat-header .wechat-title { color: #eaf2ff; }',
      '.wechat-header .wechat-sub-hint { color: #8fb3d4; }',
      '.wechat-header .wechat-back-btn { color: #63d3ff; }',
      '.wechat-chat-screen { background: #0b1017; }',
      '.msg-time-hint { color: #6b7f98; }',
      '.msg-avatar { border-radius: 10px; border: 1px solid rgba(255,255,255,.09); box-shadow: 0 3px 10px rgba(0,0,0,.35); }',
      '.wechat-input-bar-v2 { background: #0b1017 !important; border-top: 1px solid rgba(255,255,255,.07); }',
      '.chat-circle-btn { background: #1a222d; color: #12b7f5; border-color: rgba(255,255,255,.06); }',
      '.chat-pill-input-box { background: #171f2a; border-color: rgba(255,255,255,.07); border-radius: 12px; }',
      '.chat-capsule-textarea { color: #eaf2ff; }',
      '.chat-capsule-textarea::placeholder { color: #6f829a; }',
      '.chat-inner-action-btn { color: #12b7f5; }',
      '.chat-quote-bar, .chat-multi-bar { background: #161d26; border-color: rgba(255,255,255,.07); }',
      '.plus-action-drawer-v3 { background: #161d26; }',
      '.plus-v3-item { color: #cfe0f5; }'
    ].join('\n');

    var QQ_BLUE_LIST_CSS = [
      '--wechat-bg-bar: #12b7f5;',
      '--wechat-bg-chat: #f2f3f5;',
      '--sys-bg-primary: #f7f8fa;',
      '--sys-bg-secondary: #ffffff;',
      '--sys-bg-bar: #12b7f5;',
      '--sys-separator: rgba(0,0,0,.06);',
      '--bg-base: #f2f3f5;',
      '--bg-surface: #ffffff;',
      '--bg-elevated: #ffffff;',
      '--bg-elevated-solid: #edf0f4;',
      '--color-text-primary: #1a1a1a;',
      '--color-text-secondary: #6b7280;',
      '--text-primary: #1a1a1a;',
      '--text-secondary: #6b7280;',
      '--text-muted: #9aa0aa;',
      '--border-default: rgba(0,0,0,.07);',
      '--color-border-subtle: rgba(0,0,0,.05);',
      '--accent-primary: #12b7f5;',
      '--accent-soft: rgba(18,183,245,.12);',
      '--success-primary: #12b7f5;',
      '',
      '.wechat-main-header { background: #12b7f5 !important; border-bottom: none; backdrop-filter: none; }',
      '.wechat-main-title { color: #ffffff; }',
      '.wechat-header-star-btn { color: #ffffff; }',
      '.wechat-header-icon-btn { color: #ffffff; }',
      '.wechat-search-wrap { background: #f7f8fa; }',
      '.wechat-search-bar { background: #ffffff; border-color: rgba(0,0,0,.07); box-shadow: none; }',
      '.wechat-search-input { color: #1a1a1a; }',
      '.wechat-status-motto-banner { background: #ffffff; border-color: rgba(0,0,0,.07); }',
      '.wechat-chat-item { background: #ffffff; border-bottom-color: rgba(0,0,0,.06); }',
      '.wechat-chat-item.pinned { background: #f2fbff; }',
      '.wechat-chat-item:active { background: #eaf7ff; }',
      '.wechat-item-avatar { border-radius: 9px; border: 1px solid rgba(0,0,0,.05); }',
      '.wechat-online-badge { background: #12b7f5; border-color: #ffffff; }',
      '.wechat-item-name { color: #1a1a1a; }',
      '.wechat-item-time { color: #9aa0aa; }',
      '.wechat-item-lastmsg { color: #6b7280; }',
      '.wechat-pinned-star { color: #12b7f5; }',
      '.wechat-bottom-tabbar { background: #ffffff !important; border-top-color: rgba(0,0,0,.06) !important; }',
      '.wechat-tab-btn { color: #8b939f !important; }',
      '.wechat-tab-btn.active { color: #12b7f5; }',
      '.tab-badge { background: #ff4d63; color: #fff; border-color: #ffffff; }',
      '.wx-graph-entry, .contact-card-item, .discover-item, .me-menu-item { background: #ffffff; border-color: rgba(0,0,0,.06); }'
    ].join('\n');

    var QQ_BLUE_CHAT_CSS = [
      '--wechat-bg-chat: #f2f3f5;',
      '--wechat-bg-bar: #12b7f5;',
      '--wechat-bg-input: #ffffff;',
      '--chat-drawer-bg: #ffffff;',
      '--bubble-bot: #ffffff;',
      '--bubble-bot-text: #1f2329;',
      '--bubble-user: #12b7f5;',
      '--bubble-user-text: #ffffff;',
      '--bg-base: #f2f3f5;',
      '--bg-surface: #ffffff;',
      '--bg-elevated: #ffffff;',
      '--bg-elevated-solid: #edf0f4;',
      '--color-text-primary: #1a1a1a;',
      '--color-text-secondary: #6b7280;',
      '--text-primary: #1a1a1a;',
      '--text-secondary: #6b7280;',
      '--text-muted: #9aa0aa;',
      '--border-default: rgba(0,0,0,.07);',
      '--color-border-subtle: rgba(0,0,0,.05);',
      '--accent-primary: #12b7f5;',
      '--accent-soft: rgba(18,183,245,.12);',
      '--chat-bubble-outline: rgba(0,0,0,.06);',
      '',
      '.wechat-header { background: #12b7f5 !important; border-bottom: none; }',
      '.wechat-header .wechat-title, .wechat-header .wechat-sub-hint, .wechat-header .wechat-back-btn { color: #ffffff !important; }',
      '.wechat-chat-screen { background: #f2f3f5; }',
      '.msg-time-hint { color: #8a8f99; }',
      '.msg-avatar { border-radius: 10px; border: 1px solid rgba(0,0,0,.06); }',
      '.wechat-input-bar-v2 { background: #ffffff !important; border-top: 1px solid #e5e7eb; }',
      '.chat-circle-btn { background: #f2f3f5; color: #12b7f5; border: none; }',
      '.chat-pill-input-box { background: #ffffff; border-color: #e5e7eb; }',
      '.chat-capsule-textarea { color: #1a1a1a; }',
      '.chat-capsule-textarea::placeholder { color: #9aa0aa; }',
      '.chat-inner-action-btn { color: #12b7f5; }',
      '.chat-quote-bar, .chat-multi-bar, .plus-action-drawer-v3 { background: #ffffff; border-color: #e5e7eb; }'
    ].join('\n');

    function qqAvatarSrc() {
      var el = document.getElementById('wechat-me-avatar');
      var src = el ? (el.currentSrc || el.src || '') : '';
      return src || 'assets/avatar_momo.svg';
    }

    function removeQqSkinChrome() {
      var main = document.getElementById('page-wechat-main');
      var chat = document.getElementById('page-chat');
      if (main) {
        main.removeAttribute('data-qq-skin');
        main.style.removeProperty('--qq-name');
        main.style.removeProperty('--qq-avatar');
      }
      if (chat) chat.removeAttribute('data-qq-skin');
      var btn = document.getElementById('qq-skin-avatar');
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    }

    function syncQqSkinChrome(active) {
      var pack = active ? getSkinPack(active) : null;
      var chrome = pack ? String(pack.chrome || '') : '';
      var listQq = chrome === 'qq' || chrome === 'qq-all' || chrome === 'qq-list';
      var chatQq = chrome === 'qq' || chrome === 'qq-all' || chrome === 'qq-chat';
      if (!pack || (!listQq && !chatQq)) {
        removeQqSkinChrome();
        return;
      }
      var main = document.getElementById('page-wechat-main');
      var chat = document.getElementById('page-chat');
      if (!main || !chat) return;

      if (listQq) {
        main.setAttribute('data-qq-skin', '1');
      } else {
        main.removeAttribute('data-qq-skin');
        main.style.removeProperty('--qq-name');
        main.style.removeProperty('--qq-avatar');
      }
      if (chatQq) {
        chat.setAttribute('data-qq-skin', '1');
      } else {
        chat.removeAttribute('data-qq-skin');
      }

      var btn = document.getElementById('qq-skin-avatar');
      if (!listQq) {
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
        return;
      }

      var header = main.querySelector('.wechat-main-header');
      if (header && !btn) {
        btn = document.createElement('button');
        btn.id = 'qq-skin-avatar';
        btn.className = 'qq-skin-avatar';
        btn.type = 'button';
        btn.title = '我的名片';
        btn.setAttribute('aria-label', '我的名片');
        btn.appendChild(document.createElement('img'));
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (typeof switchWechatTab === 'function') switchWechatTab('me');
          else if (typeof openPage === 'function') openPage('page-me');
        });
        header.appendChild(btn);
      }

      var hero = (window.appData && window.appData.hero) || {};
      var meNameEl = document.getElementById('me-page-name-title') || document.getElementById('wechat-me-name');
      var meName = meNameEl ? String(meNameEl.textContent || '').trim() : '';
      var name = meName || hero.userName || 'user';
      main.style.setProperty('--qq-name', '"' + String(name).replace(/["\\]/g, '') + '"');
      var src = qqAvatarSrc();
      main.style.setProperty('--qq-avatar', 'url("' + String(src).replace(/"/g, '%22') + '")');
      var img = document.getElementById('qq-skin-avatar-img') || (btn && btn.querySelector('img'));
      if (img) {
        img.id = 'qq-skin-avatar-img';
        img.alt = '';
        img.src = src;
      }
    }

    var SKIN_PACKS = {
      'qq-night': {
        id: 'qq-night',
        label: 'QQ 夜聊',
        sub: '深蓝 · 圆头像',
        chrome: 'qq',
        regions: { 'chat-list': QQ_NIGHT_LIST_CSS, 'chat-contacts': QQ_NIGHT_LIST_CSS, 'chat-discover': QQ_NIGHT_LIST_CSS, 'chat-me': QQ_NIGHT_LIST_CSS, 'chat-page': QQ_NIGHT_CHAT_CSS },
        look: { preset: 'qq', fontSize: 15, avatarSize: 40, avatarShape: 'circle', userBg: '#ffffff', userText: '#111111', botBg: '#2b2b2f', botText: '#f1f1f3' }
      },
      'qq-blue': {
        id: 'qq-blue',
        label: 'QQ 蓝白',
        sub: '经典蓝 · 圆头像',
        chrome: 'qq',
        regions: { 'chat-list': QQ_BLUE_LIST_CSS, 'chat-contacts': QQ_BLUE_LIST_CSS, 'chat-discover': QQ_BLUE_LIST_CSS, 'chat-me': QQ_BLUE_LIST_CSS, 'chat-page': QQ_BLUE_CHAT_CSS },
        look: { preset: 'qq', fontSize: 15, avatarSize: 40, avatarShape: 'circle', userBg: '#ffffff', userText: '#111111', botBg: '#2b2b2f', botText: '#f1f1f3' }
      },
      'sms-glass': {
        id: 'sms-glass',
        label: '短信 · 液态玻璃',
        sub: '雨窗玻璃 · 悬浮顶栏',
        chrome: '',
        regions: { 'chat-list': '@default', 'chat-contacts': '@default', 'chat-discover': '@default', 'chat-me': '@default', 'chat-page': '@default' },
        look: { preset: 'sms', fontSize: 15, avatarSize: 40, avatarShape: 'circle', avatarMode: 'message', userBg: '', userText: '', botBg: '', botText: '' }
      }
    };

    var SKIN_PACK_CUSTOM_KEY = 'momo_skin_packs_custom';
    var SKIN_PACK_STRUCTURE_ID = 'skin-pack-structure';
    var pendingSkinPresetDelete = '';

    function readCustomSkinPacks() {
      try {
        var obj = JSON.parse(localStorage.getItem(SKIN_PACK_CUSTOM_KEY) || '{}');
        return obj && typeof obj === 'object' ? obj : {};
      } catch (e) { return {}; }
    }

    function writeCustomSkinPacks(store) {
      try { localStorage.setItem(SKIN_PACK_CUSTOM_KEY, JSON.stringify(store || {})); } catch (e) {}
    }

    function getSkinPack(id) {
      if (!id) return null;
      return SKIN_PACKS[id] || readCustomSkinPacks()[id] || null;
    }
    window.getSkinPack = getSkinPack;

    // 给「导入整套代码」留的入口：包结构 = { id,label,sub,chrome,regions:{...},look:{...},structure:'...' }
    // regions 的 key 直接用 MOMO_REGIONS 里的区域 id，导入后走同一张总表。
    window.registerSkinPack = function(pack) {
      if (!pack || !pack.id || !pack.regions || typeof pack.regions !== 'object') {
        throw new Error('皮肤包缺 id 或 regions');
      }
      if (SKIN_PACKS[pack.id]) throw new Error('内置皮肤包不能覆盖：' + pack.id);
      var store = readCustomSkinPacks();
      store[pack.id] = pack;
      writeCustomSkinPacks(store);
      syncSkinPackUI();
      return pack;
    };

    window.importSkinPackCode = function(code) {
      var pack = null;
      try { pack = JSON.parse(String(code || '')); } catch (e) { throw new Error('皮肤包不是合法 JSON'); }
      return window.registerSkinPack(pack);
    };

    function skinPackCodeSnapshot() {
      var active = '';
      try { active = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      var pack = getSkinPack(active);
      if (pack) {
        var regions = {};
        Object.keys(pack.regions || {}).forEach(function(k) { regions[k] = String(pack.regions[k]); });
        return {
          id: pack.id,
          label: pack.label || '',
          sub: pack.sub || '',
          chrome: pack.chrome || '',
          regions: regions,
          look: pack.look || {},
          structure: pack.structure || ''
        };
      }
      var store = readRegionStore();
      var current = {};
      ['chat-list', 'chat-contacts', 'chat-discover', 'chat-me', 'chat-page'].forEach(function(k) {
        current[k] = String(store[k] || '');
      });
      return {
        id: 'custom-current',
        label: '当前皮肤（未套包）',
        sub: '从分区换肤抓取',
        chrome: '',
        regions: current,
        look: readChatLook(),
        structure: ''
      };
    }

    var SKIN_CODE_REGION_KEYS = ['chat-list', 'chat-contacts', 'chat-discover', 'chat-me', 'chat-page'];

    function skinPackToCode(pack) {
      var lines = [];
      lines.push('/* 整套皮肤：' + String(pack.label || '未命名') + ' */');
      if (pack.id) lines.push('/* id: ' + String(pack.id) + ' */');
      lines.push('/* chrome: ' + String(pack.chrome || '') + ' */');
      SKIN_CODE_REGION_KEYS.forEach(function(k) {
        lines.push('');
        lines.push('/* ==== ' + k + ' ==== */');
        var v = pack.regions && pack.regions[k];
        lines.push(v ? String(v) : '@default');
      });
      if (pack.structure) {
        lines.push('');
        lines.push('/* ==== structure ==== */');
        lines.push(String(pack.structure));
      }
      if (pack.sub) {
        lines.push('');
        lines.push('/* sub: ' + String(pack.sub) + ' */');
      }
      if (pack.look && Object.keys(pack.look).length) {
        lines.push('/* look: ' + JSON.stringify(pack.look) + ' */');
      }
      return lines.join('\n');
    }

    function parseSkinPackText(text) {
      var raw = String(text || '').trim();
      if (!raw) return null;
      if (/^\s*\{/.test(raw)) {
        try {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.regions && typeof parsed.regions === 'object') return parsed;
        } catch (e) {}
      }
      var meta = {};
      var blocks = {};
      var current = '';
      var lines = raw.split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var marker = line.match(/^\s*\/\*\s*={2,}\s*([a-z-]+)\s*={2,}\s*\*\/\s*$/);
        if (marker) {
          current = marker[1];
          blocks[current] = [];
          continue;
        }
        var comment = line.match(/^\s*\/\*\s*(id|label|sub|chrome|look)\s*:\s*([\s\S]*?)\s*\*\/\s*$/);
        if (comment) {
          meta[comment[1]] = comment[2];
          continue;
        }
        var title = line.match(/^\s*\/\*\s*整套皮肤\s*[:：]\s*([\s\S]*?)\s*\*\/\s*$/);
        if (title) {
          if (!meta.label) meta.label = title[1];
          continue;
        }
        if (!current) continue;
        blocks[current].push(line);
      }
      if (!Object.keys(blocks).length) {
        return {
          id: 'custom-' + Date.now(),
          label: '自定义整套',
          sub: '手写 CSS',
          chrome: '',
          regions: {
            'chat-list': raw,
            'chat-contacts': raw,
            'chat-discover': raw,
            'chat-me': raw,
            'chat-page': raw
          },
          look: {},
          structure: ''
        };
      }
      var regions = {};
      Object.keys(blocks).forEach(function(k) {
        if (k !== 'structure') regions[k] = blocks[k].join('\n').trim();
      });
      var look = {};
      if (meta.look) { try { look = JSON.parse(meta.look) || {}; } catch (e) {} }
      return {
        id: meta.id || ('custom-' + Date.now()),
        label: meta.label || '自定义整套',
        sub: meta.sub || '',
        chrome: String(meta.chrome || '').replace(/\s+/g, ''),
        regions: regions,
        look: look,
        structure: (blocks.structure || []).join('\n').trim()
      };
    }

    function syncSkinPackCode(force) {
      var area = document.getElementById('skin-pack-code');
      if (!area) return;
      if (!force && document.activeElement === area) return;
      area.value = skinPackToCode(skinPackCodeSnapshot());
      syncSkinPackName(force);
    }
    window.syncSkinPackCode = syncSkinPackCode;

    function syncSkinPackName(force) {
      var input = document.getElementById('skin-pack-name');
      if (!input) return;
      if (!force && document.activeElement === input) return;
      var active = '';
      try { active = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      var pack = getSkinPack(active);
      input.value = pack ? String(pack.label || '') : '';
    }
    window.syncSkinPackName = syncSkinPackName;

    function skinPackThumbColors(pack) {
      var regions = pack && pack.regions ? pack.regions : {};
      var sample = String(regions['chat-list'] || regions['chat-page'] || regions['chat-contacts'] || '');
      function pick(name) {
        var m = sample.match(new RegExp('--' + name + '\\s*:\\s*([^;]+)'));
        return m ? m[1].replace(/!important/gi, '').trim() : '';
      }
      var bg = pick('wechat-bg-chat') || pick('bg-surface') || (pack && pack.look && pack.look.botBg) || '#2b2b2f';
      var fg = pick('wechat-bg-bar') || pick('accent-primary') || (pack && pack.look && pack.look.userBg) || '#12b7f5';
      return { bg: bg, fg: fg };
    }

    function renderSkinPackCustomPresets(active) {
      var count = document.getElementById('skin-pack-custom-count');
      var drawerCount = document.getElementById('skin-preset-count-text');
      var list = document.getElementById('skin-preset-list');
      var custom = readCustomSkinPacks();
      var ids = Object.keys(custom).filter(function(id) { return custom[id] && custom[id].regions; });
      if (count) count.textContent = '（' + ids.length + '）';
      if (drawerCount) drawerCount.textContent = '（' + ids.length + '）';
      if (!list) return;
      list.innerHTML = '';
      if (!ids.length) {
        var empty = document.createElement('div');
        empty.className = 'skin-preset-empty';
        empty.textContent = '还没有存过整套。把代码改好、起个名字，点上面的「保存为预设」，它就会出现在这里。';
        list.appendChild(empty);
        return;
      }
      ids.forEach(function(id) {
        var pack = custom[id];
        var row = document.createElement('div');
        row.className = 'skin-preset-row' + (id === active ? ' active' : '') + (id === pendingSkinPresetDelete ? ' confirming' : '');

        var main = document.createElement('button');
        main.type = 'button';
        main.className = 'skin-preset-main';
        main.title = '套用「' + String(pack.label || id) + '」';

        var colors = skinPackThumbColors(pack);
        var thumb = document.createElement('div');
        thumb.className = 'skin-preset-thumb';
        thumb.style.background = colors.bg;
        [82, 58, 34].forEach(function(w, i) {
          var line = document.createElement('span');
          line.style.width = w + '%';
          line.style.background = colors.fg;
          line.style.opacity = i === 0 ? '0.95' : (i === 1 ? '0.55' : '0.32');
          thumb.appendChild(line);
        });

        var copy = document.createElement('div');
        copy.className = 'skin-preset-copy';
        var name = document.createElement('div');
        name.className = 'skin-preset-name';
        name.textContent = String(pack.label || id);
        var meta = document.createElement('div');
        meta.className = 'skin-preset-meta';
        var screenCount = Object.keys(pack.regions || {}).filter(function(k) {
          return pack.regions[k] && String(pack.regions[k]).indexOf('@default') !== 0;
        }).length;
        meta.textContent = (pack.sub ? String(pack.sub) + ' · ' : '自定义整套 · ') + screenCount + ' 屏';
        copy.appendChild(name);
        copy.appendChild(meta);

        main.appendChild(thumb);
        main.appendChild(copy);
        if (id === active) {
          var badge = document.createElement('span');
          badge.className = 'skin-preset-badge';
          badge.textContent = '使用中';
          main.appendChild(badge);
        }
        main.addEventListener('click', function() {
          window.applySkinPack(id);
          window.closeSkinPresetDrawer();
        });

        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'skin-preset-edit';
        edit.title = '回到代码框改名字';
        edit.textContent = '✎';
        edit.addEventListener('click', function(e) {
          e.stopPropagation();
          window.editSkinPackPreset(id);
        });

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'skin-preset-del';
        del.title = '删除这套（需要二次确认）';
        del.textContent = '🗑';
        del.addEventListener('click', function(e) {
          e.stopPropagation();
          window.askSkinPackDelete(id);
        });

        row.appendChild(main);
        row.appendChild(edit);
        row.appendChild(del);

        if (id === pendingSkinPresetDelete) {
          var confirmBar = document.createElement('div');
          confirmBar.className = 'skin-preset-confirm';
          var confirmText = document.createElement('div');
          confirmText.className = 'skin-preset-confirm-text';
          confirmText.textContent = id === active
            ? '删除后当前整套会切回原皮肤，不能恢复。'
            : '删除后不能恢复，确定要删吗？';
          var cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.className = 'skin-preset-confirm-btn cancel';
          cancelBtn.textContent = '取消';
          cancelBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.cancelSkinPackDelete();
          });
          var dangerBtn = document.createElement('button');
          dangerBtn.type = 'button';
          dangerBtn.className = 'skin-preset-confirm-btn danger';
          dangerBtn.textContent = '确认删除';
          dangerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.deleteSkinPackPreset(id);
          });
          confirmBar.appendChild(confirmText);
          confirmBar.appendChild(cancelBtn);
          confirmBar.appendChild(dangerBtn);
          row.appendChild(confirmBar);
        }

        list.appendChild(row);
      });
    }
    window.renderSkinPackCustomPresets = renderSkinPackCustomPresets;

    window.askSkinPackDelete = function(id) {
      var active = '';
      try { active = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      pendingSkinPresetDelete = id;
      renderSkinPackCustomPresets(active);
    };

    window.cancelSkinPackDelete = function() {
      var active = '';
      try { active = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      pendingSkinPresetDelete = '';
      renderSkinPackCustomPresets(active);
    };

    window.deleteSkinPackPreset = function(id) {
      if (!id || pendingSkinPresetDelete !== id) return;
      var active = '';
      try { active = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      var pack = readCustomSkinPacks()[id];
      if (!pack) { pendingSkinPresetDelete = ''; return; }
      var name = String(pack.label || id);
      if (active === id) window.revertSkinPack();
      var store = readCustomSkinPacks();
      delete store[id];
      writeCustomSkinPacks(store);
      pendingSkinPresetDelete = '';
      syncSkinPackUI();
      if (typeof showToast === 'function') showToast('已删除预设「' + name + '」。');
    };

    window.openSkinPresetDrawer = function() {
      pendingSkinPresetDelete = '';
      var active = '';
      try { active = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      renderSkinPackCustomPresets(active);
      var drawer = document.getElementById('skin-preset-drawer');
      if (drawer) drawer.classList.add('open');
    };

    window.closeSkinPresetDrawer = function() {
      pendingSkinPresetDelete = '';
      var drawer = document.getElementById('skin-preset-drawer');
      if (drawer) drawer.classList.remove('open');
    };

    window.editSkinPackPreset = function(id) {
      window.applySkinPack(id);
      window.closeSkinPresetDrawer();
      setTimeout(function() {
        var card = document.getElementById('skin-pack-card');
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
        var input = document.getElementById('skin-pack-name');
        if (input) {
          input.focus();
          input.select();
        }
      }, 320);
    };

    window.loadSkinPackCode = function() {
      syncSkinPackCode(true);
      var hint = document.getElementById('skin-pack-code-hint');
      if (hint) { hint.style.color = 'var(--color-text-secondary)'; hint.textContent = '已载入当前整套代码。改完点「套用这段代码」就会成为新的自定义整套。'; }
    };

    window.copySkinPackCode = function() {
      var area = document.getElementById('skin-pack-code');
      if (!area) return;
      if (!area.value.trim()) syncSkinPackCode(true);
      var hint = document.getElementById('skin-pack-code-hint');
      var done = function() { if (hint) { hint.style.color = 'var(--color-text-secondary)'; hint.textContent = '已复制到剪贴板。'; } };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(area.value).then(done).catch(function() {
          area.select(); try { document.execCommand('copy'); done(); } catch (e) {}
        });
      } else {
        area.select(); try { document.execCommand('copy'); done(); } catch (e) {}
      }
    };

    window.applySkinPackCode = function(mode) {
      var area = document.getElementById('skin-pack-code');
      var hint = document.getElementById('skin-pack-code-hint');
      if (!area) return;
      var raw = area.value.trim();
      if (!raw) {
        if (hint) { hint.style.color = '#ff6b6b'; hint.textContent = '代码是空的：先点「载入当前整套」或贴一段代码。'; }
        return;
      }
      var pack = parseSkinPackText(raw);
      if (!pack) {
        if (hint) { hint.style.color = '#ff6b6b'; hint.textContent = '代码读不出来：至少要有一段 CSS，或一个带 regions 的 JSON。'; }
        return;
      }
      var nameInput = document.getElementById('skin-pack-name');
      var typedName = nameInput ? String(nameInput.value || '').trim() : '';
      if (typedName && mode === 'save') pack.label = typedName;
      if (!pack.id) pack.id = 'custom-' + Date.now();
      if (SKIN_PACKS[pack.id]) {
        pack.id = 'custom-' + pack.id + '-' + Date.now();
        if (!typedName) pack.label = (pack.label || '自定义整套') + '（自定义）';
      }
      if (!pack.label) pack.label = '自定义整套';
      var regions = {};
      Object.keys(pack.regions || {}).forEach(function(k) {
        var v = pack.regions[k];
        if (v !== null && v !== undefined) regions[k] = String(v);
      });
      pack.regions = regions;
      try {
        window.registerSkinPack(pack);
        window.applySkinPack(pack.id);
        syncSkinPackCode(true);
        if (hint) {
          hint.style.color = '#12b7f5';
          hint.textContent = mode === 'save'
            ? '已保存预设「' + (pack.label || '自定义整套') + '」，点上面的「我的整套」随时切换。'
            : '已套用「' + (pack.label || '自定义整套') + '」：整套生效了。';
        }
      } catch (e) {
        if (hint) { hint.style.color = '#ff6b6b'; hint.textContent = (mode === 'save' ? '保存失败：' : '套用失败：') + (e.message || e); }
      }
    };

    function clearSkinPackStructure() {
      var tag = document.getElementById(SKIN_PACK_STRUCTURE_ID);
      if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
    }

    function applySkinPackStructure(pack) {
      clearSkinPackStructure();
      if (!pack || !pack.structure) return;
      var tag = document.createElement('style');
      tag.id = SKIN_PACK_STRUCTURE_ID;
      tag.textContent = String(pack.structure);
      (document.head || document.documentElement).appendChild(tag);
    }

    function syncSmsSkinPackChrome(active) {
      var pageChat = document.getElementById('page-chat');
      if (!pageChat) return;
      if (active === 'sms-glass') pageChat.setAttribute('data-chat-skin-pack', 'sms-glass');
      else pageChat.removeAttribute('data-chat-skin-pack');
    }

    function syncSkinPackUI() {
      var active = '';
      try { active = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      var cards = document.querySelectorAll('.sp-card[data-pack]');
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.toggle('active', cards[i].getAttribute('data-pack') === active);
      }
      var cur = document.getElementById('skin-pack-current');
      if (cur) {
        var pack = getSkinPack(active);
        cur.textContent = pack
          ? (active === 'sms-glass' ? '当前整套：短信 · 液态玻璃（聊天页 · 悬浮顶栏）' : '当前整套：' + pack.label + '（聊天四屏＋聊天页）')
          : '当前整套：跟随全局，没有套皮肤包';
        cur.style.color = pack ? 'var(--theme-accent)' : 'var(--color-text-secondary)';
      }
      var btn = document.getElementById('skin-pack-revert');
      if (btn) btn.style.display = active ? '' : 'none';
      syncQqSkinChrome(active);
      syncSmsSkinPackChrome(active);
      applySkinPackStructure(getSkinPack(active));
      renderSkinPackCustomPresets(active);
      syncSkinPackCode(false);
    }
    window.syncSkinPackUI = syncSkinPackUI;

    window.applySkinPack = function(id) {
      var pack = getSkinPack(id);
      if (!pack) return;
      var active = '';
      try { active = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      // 只有从「没皮肤包」切进来时才存原始快照；包与包之间切换共用同一份原始快照
      if (!active) {
        try {
          localStorage.setItem(SKIN_PACK_BACKUP_KEY, JSON.stringify({
            regions: readRegionStore(),
            look: readChatLook()
          }));
        } catch (e) {}
      }
      var store = readRegionStore();
      Object.keys(pack.regions).forEach(function(k) {
        var v = pack.regions[k];
        // @default / 空字符串 = 这一屏清掉覆盖，回到微信原样，方便拼包
        if (v === '@default' || v === '') delete store[k];
        else store[k] = String(v);
      });
      writeRegionStore(store);
      chatLook = readChatLook();
      Object.keys(pack.look || {}).forEach(function(k) { chatLook[k] = pack.look[k]; });
      window.applyChatLook();
      // 先让气泡参数落盘，再把两屏 CSS 放到最后，保证整套样式压过单点设置
      window.renderRegionSkins();
      try { localStorage.setItem(SKIN_PACK_KEY, id); } catch (e) {}
      syncSkinPackUI();
      if (typeof showToast === 'function') showToast(id === 'sms-glass' ? '已套用「短信 · 液态玻璃」：聊天页 + 悬浮顶栏' : '已套用「' + pack.label + '」：整套都换了');
    };

    window.revertSkinPack = function() {
      var raw = '';
      try { raw = localStorage.getItem(SKIN_PACK_BACKUP_KEY) || ''; } catch (e) {}
      var snap = null;
      try { snap = raw ? JSON.parse(raw) : null; } catch (e) { snap = null; }
      if (snap) {
        writeRegionStore(snap.regions || {});
        chatLook = snap.look || readChatLook();
        window.applyChatLook();
        window.renderRegionSkins();
      } else {
        // 没有快照时至少把整套皮肤和聊天页参数清干净，别留一半 QQ
        var store = readRegionStore();
        var keys = {};
        Object.keys(SKIN_PACKS).forEach(function(id) {
          Object.keys((SKIN_PACKS[id] && SKIN_PACKS[id].regions) || {}).forEach(function(k) { keys[k] = 1; });
        });
        var custom = readCustomSkinPacks();
        Object.keys(custom).forEach(function(id) {
          Object.keys((custom[id] && custom[id].regions) || {}).forEach(function(k) { keys[k] = 1; });
        });
        Object.keys(keys).forEach(function(k) { delete store[k]; });
        writeRegionStore(store);
        chatLook = readChatLook();
        chatLook.preset = 'plain';
        chatLook.avatarShape = 'circle';
        chatLook.userBg = '';
        chatLook.userText = '';
        chatLook.botBg = '';
        chatLook.botText = '';
        window.applyChatLook();
        window.renderRegionSkins();
      }
      try {
        localStorage.removeItem(SKIN_PACK_KEY);
        localStorage.removeItem(SKIN_PACK_BACKUP_KEY);
      } catch (e) {}
      syncSkinPackUI();
      if (typeof showToast === 'function') showToast('已切回原来的皮肤，整套一起回来了');
    };

    // ---------- 我的图片：上传即自动存档，点缩略图随时切回 ----------
    var CHAT_PHOTO_KEY = 'momo_chat_bg_list';
    var CHAT_PHOTO_MAX = 5;
    var chatPhotoCache = null;

    function readChatPhotos() {
      if (chatPhotoCache) return chatPhotoCache;
      var list = [];
      try { list = JSON.parse(localStorage.getItem(CHAT_PHOTO_KEY) || '[]'); } catch (e) { list = []; }
      if (!Array.isArray(list)) list = [];
      list = list.filter(function(it) { return it && typeof it.data === 'string' && it.data.indexOf('data:') === 0; });
      chatPhotoCache = list.slice(0, CHAT_PHOTO_MAX);
      return chatPhotoCache;
    }

    function writeChatPhotos(list) {
      chatPhotoCache = list.slice(0, CHAT_PHOTO_MAX);
      try {
        localStorage.setItem(CHAT_PHOTO_KEY, JSON.stringify(chatPhotoCache));
        return true;
      } catch (e) {
        alert('存不下了：这组图太大，先从「我的图片」里删掉一两张再上传。');
        return false;
      }
    }

    window.renderChatPhotos = function() {
      var box = document.getElementById('chat-wall-photos');
      var cnt = document.getElementById('chat-wall-photos-count');
      if (!box) return;
      var list = readChatPhotos();
      var cur = (typeof appData !== 'undefined' && appData.chatBg) ? appData.chatBg : '';
      box.innerHTML = '';
      if (!list.length) {
        var empty = document.createElement('div');
        empty.className = 'chat-photo-empty';
        empty.textContent = '还没有存过，上传一张就自动躺在这里。';
        box.appendChild(empty);
      }
      list.forEach(function(it, i) {
        var t = document.createElement('div');
        t.className = 'chat-photo-thumb' + (it.data === cur ? ' active' : '');
        t.style.backgroundImage = "url('" + it.data + "')";
        t.title = '点一下切到这张';
        t.onclick = function(ev) { if (ev.target === t) window.applyChatPhoto(i); };
        var del = document.createElement('div');
        del.className = 'chat-photo-del';
        del.textContent = '✕';
        del.title = '删掉这张';
        del.onclick = function(ev) { ev.stopPropagation(); window.removeChatPhoto(i); };
        t.appendChild(del);
        box.appendChild(t);
      });
      if (cnt) cnt.textContent = list.length ? list.length + ' / ' + CHAT_PHOTO_MAX : '';
    };

    window.saveChatPhoto = function(dataUrl) {
      if (!dataUrl || String(dataUrl).indexOf('data:') !== 0) return;
      var list = readChatPhotos().filter(function(it) { return it.data !== dataUrl; });
      list.unshift({ id: 'p' + Date.now(), data: dataUrl });
      writeChatPhotos(list);
      window.renderChatPhotos();
      var h = document.getElementById('chat-wall-hint');
      if (h) h.textContent = '已存进「我的图片」，下次点缩略图就能切回来。';
    };

    window.applyChatPhoto = function(idx) {
      var it = readChatPhotos()[idx];
      if (!it) return;
      window.snapshotChatWall();
      if (typeof appData !== 'undefined') appData.chatBg = it.data;
      if (window.clearChatWallPreset) window.clearChatWallPreset();
      try { localStorage.setItem('momo_chat_bg', it.data); } catch (e) {}
      window.applyChatWall();
      window.renderChatPhotos();
    };

    window.removeChatPhoto = function(idx) {
      var list = readChatPhotos().slice();
      var it = list[idx];
      if (!it) return;
      list.splice(idx, 1);
      writeChatPhotos(list);
      if (typeof appData !== 'undefined' && appData.chatBg === it.data) {
        appData.chatBg = list.length ? list[0].data : '';
        try { localStorage.setItem('momo_chat_bg', appData.chatBg); } catch (e) {}
        window.applyChatWall();
      }
      window.renderChatPhotos();
      var h = document.getElementById('chat-wall-hint');
      if (h) h.textContent = list.length ? '删掉一张，已切到剩下的一张。' : '删掉了最后一张，回到主题底色。';
    };

    // 启动：分区皮肤 + 聊天页压暗 + 聊天界面参数 + 两侧独立 CSS
    (function initRegionSkins() {
      window.renderRegionSkins();
      window.applyChatDim();
      window.applyChatLook();
      window.renderChatBubbleCss();
      window.applyChatWall();
      // 壁纸 style 也是 append 到 body 末尾的；如果当前有整套皮肤，让它再压一次，
      // 保证重开小手机后皮肤包的底色仍然完整，而不是被旧壁纸盖掉。
      var activePack = '';
      try { activePack = localStorage.getItem(SKIN_PACK_KEY) || ''; } catch (e) {}
      if (activePack) window.renderRegionSkins();
      window.renderChatPhotos();
      window.renderChatColors();
      var bu = document.getElementById('chat-bubble-css-user');
      var bb = document.getElementById('chat-bubble-css-bot');
      var saved = readChatBubble();
      if (bu) bu.value = saved.user;
      if (bb) bb.value = saved.bot;
      if (saved.user || saved.bot) {
        var box = document.getElementById('chat-bubble-css-box');
        if (box) box.style.display = 'block';
      }
      syncSkinPackUI();
    })();