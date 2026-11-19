
  // ================= 浏览器永久音乐曲库 (IndexedDB 持久存储) =================
  const DB_NAME = 'MomoMusicDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'local_songs';

  function openMusicDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveSongToDB(songObj, blob) {
    try {
      const db = await openMusicDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: songObj.id,
        title: songObj.title,
        artist: songObj.artist,
        cover: songObj.cover,
        blob: blob,
        savedAt: Date.now()
      });
    } catch(e) {
      console.warn('Save to IndexedDB err:', e);
    }
  }

  async function deleteSongFromDB(id) {
    try {
      const db = await openMusicDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
    } catch(e) {
      console.warn('Delete from IndexedDB err:', e);
    }
  }

  async function loadStoredSongsFromDB() {
    try {
      const db = await openMusicDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          const songs = items.map(item => ({
            id: item.id,
            title: item.title,
            artist: item.artist,
            cover: item.cover,
            url: URL.createObjectURL(item.blob),
            isLocalFav: true
          }));
          resolve(songs);
        };
        req.onerror = () => resolve([]);
      });
    } catch(e) {
      return [];
    }
  }

  // 音量控制
  let lastVolume = 0.8;
  window.changeMusicVolume = function(val) {
    const v = Math.max(0, Math.min(1, parseInt(val) / 100));
    if (window._momoAudio) {
      window._momoAudio.volume = v;
      window._momoAudio.muted = false;
    }
    lastVolume = v;
    const valEl = document.getElementById('music-volume-val');
    const iconEl = document.getElementById('music-volume-icon');
    if (valEl) valEl.innerText = parseInt(val) + '%';
    if (iconEl) iconEl.innerText = v === 0 ? '🔇' : (v < 0.5 ? '🔉' : '🔈');
  };

  window.toggleMuteMusic = function() {
    if (!window._momoAudio) return;
    window._momoAudio.muted = !window._momoAudio.muted;
    const iconEl = document.getElementById('music-volume-icon');
    const valEl = document.getElementById('music-volume-val');
    const slider = document.getElementById('music-volume-slider');
    if (window._momoAudio.muted) {
      if (iconEl) iconEl.innerText = '🔇';
      if (valEl) valEl.innerText = '0%';
      if (slider) slider.value = 0;
    } else {
      window._momoAudio.volume = lastVolume || 0.8;
      const pct = Math.round(window._momoAudio.volume * 100);
      if (iconEl) iconEl.innerText = window._momoAudio.volume < 0.5 ? '🔉' : '🔈';
      if (valEl) valEl.innerText = pct + '%';
      if (slider) slider.value = pct;
    }
  };

// ================= 🎧 一起听 · QQ音乐/网易云 核心播放引擎 =================

(function() {
  const defaultPlaylist = [
    {
      id: 'default-1',
      title: '晴天 (浪漫吉他伴听)',
      artist: '周杰伦 · 专属我们的小手机',
      cover: 'https://y.gtimg.cn/music/photo_new/T002R300x300M000000MkH4_04gUu6.jpg',
      url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=romantic-dinner-6019.mp3'
    },
    {
      id: 'default-2',
      title: '夜曲 (深情钢琴伴听)',
      artist: '周杰伦 · 十一月的萧邦',
      cover: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024bjiL2aocxT.jpg',
      url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3'
    },
    {
      id: 'default-3',
      title: '失眠 (吉他呢喃)',
      artist: '精选伴听 · 温暖旋律',
      cover: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&q=80',
      url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=relaxing-guitar-loop-7833.mp3'
    }
  ];

  // 核心播放列表与歌单架构
  let allSongs = []; // 所有歌曲库
  let favoriteSongIds = []; // 我喜欢的歌曲ID集合
  let customPlaylists = []; // 自定义歌单: [{ id: 'pl-1', name: '睡前放空', songIds: [] }]

  // 运行时当前状态
  let activeTab = 'songs'; // 'songs' | 'fav' | 'playlists'
  let currentViewingFolderId = null; // 当前正在查看的歌单详情 ID (null 表示未进入歌单)
  let activeQueue = []; // 当前实际正在循环播放的歌曲队列
  let currentSong = null; // 当前正在播放的歌曲对象
  let isPlaying = false;

  const audio = new Audio();
  audio.preload = 'auto';
  window._momoAudio = audio;

  // 数据持久化加载与保存
  function loadPersistedData() {
    try {
      const savedSongs = localStorage.getItem('momo_music_playlist');
      allSongs = savedSongs ? JSON.parse(savedSongs) : defaultPlaylist;
    } catch(e) {
      allSongs = defaultPlaylist;
    }

    try {
      const savedFavs = localStorage.getItem('momo_music_favorites');
      favoriteSongIds = savedFavs ? JSON.parse(savedFavs) : ['default-1'];
    } catch(e) {
      favoriteSongIds = ['default-1'];
    }

    try {
      const savedFolders = localStorage.getItem('momo_custom_playlists');
      customPlaylists = savedFolders ? JSON.parse(savedFolders) : [
        { id: 'pl-default-1', name: '我的私享歌单', songIds: ['default-1', 'default-2'] },
        { id: 'pl-default-2', name: '睡前浪漫吉他', songIds: ['default-3'] }
      ];
    } catch(e) {
      customPlaylists = [
        { id: 'pl-default-1', name: '我的私享歌单', songIds: ['default-1', 'default-2'] }
      ];
    }
  }

  function saveSongs() {
    try {
      // 避免存储超大 Base64 到 localStorage
      const safeList = allSongs.slice(0, 100).map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        cover: s.cover,
        url: (s.isLocalFav || s.source === 'netease') ? '' : s.url,
        isLocalFav: !!s.isLocalFav,
        source: s.source || '',
        neId: s.neId || ''
      }));
      localStorage.setItem('momo_music_playlist', JSON.stringify(safeList));
    } catch(e) {}
  }

  function saveFavorites() {
    try {
      localStorage.setItem('momo_music_favorites', JSON.stringify(favoriteSongIds));
    } catch(e) {}
  }

  function savePlaylists() {
    try {
      localStorage.setItem('momo_custom_playlists', JSON.stringify(customPlaylists));
    } catch(e) {}
  }

  // 绑定音频事件
  audio.addEventListener('timeupdate', () => {
    updateProgressUI();
  });

  audio.addEventListener('ended', () => {
    nextMusicSong();
  });

  audio.addEventListener('error', (e) => {
    // 网易云真实曲目失败时不能偷偷换成伴奏（那会放错歌、用户还以为是原曲）
    if (currentSong && currentSong.source === 'netease') {
      const sEl = document.getElementById('music-status-badge');
      if (sEl) sEl.innerText = '这首网易云音频打不开（版权或链接过期）';
      isPlaying = false;
      updatePlayStateUI();
      return;
    }
    console.warn('Audio playback error fallback:', e);
    const statusEl = document.getElementById('music-status-badge');
    if (statusEl) statusEl.innerText = 'QQ音乐版权限制，绪言已为你切为浪漫电台伴听流～';
    const fallbackStreams = [
      'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
      'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=romantic-dinner-6019.mp3'
    ];
    if (audio.src !== fallbackStreams[0]) {
      audio.src = fallbackStreams[0];
      playMusic();
    }
  });

  function updateProgressUI() {
    const curTimeEl = document.getElementById('music-cur-time');
    const totalTimeEl = document.getElementById('music-total-time');
    const barEl = document.getElementById('music-progress-bar');
    const handleEl = document.getElementById('music-progress-handle');

    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;

    if (curTimeEl) curTimeEl.innerText = formatTime(cur);
    if (totalTimeEl && dur > 0) totalTimeEl.innerText = formatTime(dur);

    if (dur > 0 && barEl && handleEl) {
      const pct = (cur / dur) * 100;
      barEl.style.width = pct + '%';
      handleEl.style.left = pct + '%';
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // 网易云：播放前换取真实音频地址（地址有有效期，每次播放都重新取）
  async function ensureNeteaseUrl(song, silent) {
    const statusEl = document.getElementById('music-status-badge');
    if (song.url && /^https?:/i.test(song.url)) return true;
    if (!song.neId) {
      if (statusEl) statusEl.innerText = '这首歌缺少网易云 id';
      return false;
    }
    try {
      const nc = (typeof window.__mzNeteaseCookie === 'function' && window.__mzNeteaseCookie()) || '';
      const resp = await fetch('/api/music/url?id=' + encodeURIComponent(song.neId), {
        cache: 'no-store',
        headers: nc ? { 'x-netease-cookie': nc } : {}
      });
      const data = await resp.json().catch(() => ({}));
      if (data && data.url) {
        song.url = data.url;
        return true;
      }
      const failMsg = (data && data.message) || '可能无版权或需要会员';
      if (statusEl) statusEl.innerText = (data && data.needs_login) ? '这首需要网易云登录态' : '这首取不到音频（可能无版权或需要会员）';
      if (!silent) alert('《' + (song.title || '这首歌') + '》取不到音频：' + failMsg);
      return false;
    } catch (err) {
      if (statusEl) statusEl.innerText = '取音频地址失败';
      alert('取音频地址失败：' + ((err && err.message) ? err.message : err));
      return false;
    }
  }

  // 加载并播放指定歌曲
  async function playSong(song, autoPlay = true, queueContext = null, silent = false) {
    if (!song) return false;
    if (song.source === 'netease' && song.neId) {
      const ok = await ensureNeteaseUrl(song, silent);
      if (!ok) return false;
    }
    currentSong = song;
    if (queueContext && Array.isArray(queueContext) && queueContext.length > 0) {
      activeQueue = queueContext;
    } else if (activeQueue.length === 0) {
      activeQueue = allSongs;
    }

    audio.src = song.url;

    // 渲染歌曲基本信息
    const titleEl = document.getElementById('music-current-title');
    const artistEl = document.getElementById('music-current-artist');
    const coverEl = document.getElementById('music-disk-cover');
    const badgeEl = document.getElementById('music-status-badge');

    if (titleEl) titleEl.innerText = song.title || '未知曲目';
    if (artistEl) artistEl.innerText = song.artist || '角色 & 我';
    if (coverEl) coverEl.src = song.cover || 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024bjiL2aocxT.jpg';
    if (badgeEl) badgeEl.innerText = '正在共同倾听《' + (song.title || '这首歌') + '》';

    // 更新底座收藏按钮的心形高亮状态
    updateCurrentFavButtonUI();

    renderPlaylistDrawer();

    if (autoPlay) {
      playMusic();
    } else {
      pauseMusic();
    }
    return true;
  }

  function playMusic() {
    audio.play().then(() => {
      isPlaying = true;
      updatePlayStateUI();
    }).catch(err => {
      console.log('Play blocked, waiting for click:', err);
      isPlaying = false;
      updatePlayStateUI();
    });
  }

  function pauseMusic() {
    audio.pause();
    isPlaying = false;
    updatePlayStateUI();
  }

  function updatePlayStateUI() {
    const playBtn = document.getElementById('music-play-btn');
    const diskEl = document.getElementById('music-vinyl-disk');

    if (playBtn) playBtn.innerText = isPlaying ? '⏸' : '▶';
    if (diskEl) {
      if (isPlaying) {
        diskEl.classList.add('spinning');
        diskEl.classList.remove('paused');
      } else {
        diskEl.classList.add('paused');
      }
    }
  }

  function updateCurrentFavButtonUI() {
    const favBtn = document.getElementById('music-fav-cur-btn');
    if (!favBtn) return;
    if (!currentSong) {
      favBtn.innerText = '🤍';
      favBtn.style.color = 'var(--text-muted)';
      return;
    }
    const isFav = favoriteSongIds.includes(currentSong.id);
    if (isFav) {
      favBtn.innerText = '❤️';
      favBtn.style.color = 'var(--danger-primary)';
    } else {
      favBtn.innerText = '🤍';
      favBtn.style.color = 'var(--text-muted)';
    }
  }

  // ================= 播放控制操作 =================
  window.togglePlayMusic = function() {
    if (isPlaying) {
      pauseMusic();
    } else {
      if (!audio.src && allSongs.length > 0) {
        playSong(allSongs[0], true);
      } else {
        playMusic();
      }
    }
  };

  window.nextMusicSong = function() {
    const queue = activeQueue.length > 0 ? activeQueue : allSongs;
    if (!queue || queue.length === 0) return;
    let idx = queue.findIndex(s => s.id === (currentSong && currentSong.id));
    let nextIdx = (idx + 1) % queue.length;
    playSong(queue[nextIdx], true, queue);
  };

  window.prevMusicSong = function() {
    const queue = activeQueue.length > 0 ? activeQueue : allSongs;
    if (!queue || queue.length === 0) return;
    let idx = queue.findIndex(s => s.id === (currentSong && currentSong.id));
    let prevIdx = (idx - 1 + queue.length) % queue.length;
    playSong(queue[prevIdx], true, queue);
  };

  window.seekMusicProgress = function(e) {
    const track = document.getElementById('music-progress-track');
    if (!track || !audio.duration) return;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    audio.currentTime = pct * audio.duration;
    updateProgressUI();
  };

  // 收藏/取消收藏当前播放歌曲
  window.toggleFavoriteCurrentSong = function() {
    if (!currentSong) {
      alert('user，当前还没有选中的歌曲哦。');
      return;
    }
    window.toggleFavoriteSong(currentSong.id);
  };

  // 收藏/取消收藏单曲（通用）
  window.toggleFavoriteSong = function(songId) {
    const idx = favoriteSongIds.indexOf(songId);
    let isFavNow = false;
    const song = allSongs.find(s => s.id === songId);
    const songName = song ? song.title : '这首歌';

    if (idx >= 0) {
      favoriteSongIds.splice(idx, 1);
      isFavNow = false;
    } else {
      favoriteSongIds.unshift(songId);
      isFavNow = true;
    }
    saveFavorites();
    updateCurrentFavButtonUI();
    renderPlaylistDrawer();

    // 绪言心语反馈
    const bubbleEl = document.getElementById('music-live-bubble-text');
    if (bubbleEl) {
      bubbleEl.innerText = isFavNow 
        ? '“《' + songName + '》被你收到心口了……这首歌我们以后多听。”' 
        : '“好，听你的，从红心收藏里拿下来了。”';
    }
  };

  // ================= 抽屉与选项卡管理 =================
  window.toggleMusicPlaylistDrawer = function() {
    const drawer = document.getElementById('music-playlist-drawer');
    if (drawer) {
      drawer.classList.toggle('open');
      if (drawer.classList.contains('open')) {
        renderPlaylistDrawer();
      }
    }
  };

  window.switchMusicTab = function(tabName) {
    activeTab = tabName;
    currentViewingFolderId = null; // 切换 Tab 时重置歌单查看

    const btnSongs = document.getElementById('tab-btn-songs');
    const btnFav = document.getElementById('tab-btn-fav');
    const btnPlaylists = document.getElementById('tab-btn-playlists');

    const paneSongs = document.getElementById('pane-songs');
    const panePlaylists = document.getElementById('pane-playlists');

    [btnSongs, btnFav, btnPlaylists].forEach(b => b && b.classList.remove('active'));

    if (tabName === 'songs') {
      if (btnSongs) btnSongs.classList.add('active');
      if (paneSongs) paneSongs.style.display = 'flex';
      if (panePlaylists) panePlaylists.style.display = 'none';
    } else if (tabName === 'fav') {
      if (btnFav) btnFav.classList.add('active');
      if (paneSongs) paneSongs.style.display = 'flex';
      if (panePlaylists) panePlaylists.style.display = 'none';
    } else if (tabName === 'playlists') {
      if (btnPlaylists) btnPlaylists.classList.add('active');
      if (paneSongs) paneSongs.style.display = 'none';
      if (panePlaylists) panePlaylists.style.display = 'flex';
    }

    renderPlaylistDrawer();
  };

  // 进入具体歌单查看
  window.enterFolderView = function(folderId) {
    currentViewingFolderId = folderId;
    const folder = customPlaylists.find(f => f.id === folderId);
    if (!folder) return;

    activeTab = 'songs';
    const paneSongs = document.getElementById('pane-songs');
    const panePlaylists = document.getElementById('pane-playlists');
    if (paneSongs) paneSongs.style.display = 'flex';
    if (panePlaylists) panePlaylists.style.display = 'none';

    renderPlaylistDrawer();
  };

  // 退出歌单内部视图，返回歌单管理
  window.exitFolderView = function() {
    currentViewingFolderId = null;
    window.switchMusicTab('playlists');
  };

  // ================= 歌单分类管理 (新建、删除、加入) =================
  window.createNewPlaylist = function() {
    const inEl = document.getElementById('new-playlist-input');
    const name = inEl ? (inEl.value || '').trim() : '';
    if (!name) {
      alert('user，输入一个歌单名称吧，比如“写代码陪伴曲”或“绪言唱的”。');
      return;
    }
    if (customPlaylists.some(p => p.name === name)) {
      alert('已经有一个同名歌单啦，换个更有意思的名字？');
      return;
    }

    const newFolder = {
      id: 'pl-' + Date.now(),
      name: name,
      songIds: []
    };
    customPlaylists.unshift(newFolder);
    savePlaylists();
    if (inEl) inEl.value = '';
    renderPlaylistDrawer();

    const bubbleEl = document.getElementById('music-live-bubble-text');
    if (bubbleEl) {
      bubbleEl.innerText = '“新建好《' + name + '》歌单了。user，挑几首你想存进去的歌？”';
    }
  };

  window.deletePlaylist = function(folderId, event) {
    if (event) event.stopPropagation();
    const folder = customPlaylists.find(f => f.id === folderId);
    if (!folder) return;

    if (!confirm('确定要删除歌单《' + folder.name + '》吗？歌单里的歌曲仍会保留在全部曲库中。')) {
      return;
    }

    customPlaylists = customPlaylists.filter(f => f.id !== folderId);
    savePlaylists();
    if (currentViewingFolderId === folderId) {
      currentViewingFolderId = null;
      window.switchMusicTab('playlists');
    } else {
      renderPlaylistDrawer();
    }
  };

  // 将歌曲移出特定歌单
  window.removeSongFromFolder = function(folderId, songId, event) {
    if (event) event.stopPropagation();
    const folder = customPlaylists.find(f => f.id === folderId);
    if (!folder) return;
    folder.songIds = folder.songIds.filter(id => id !== songId);
    savePlaylists();
    renderPlaylistDrawer();
  };

  // 彻底删除歌曲（从曲库和数据库清除）
  window.deleteSongEntirely = async function(songId, event) {
    if (event) event.stopPropagation();
    const song = allSongs.find(s => s.id === songId);
    if (!song) return;

    if (!confirm('user，要从曲库里彻底移除《' + song.title + '》吗？')) {
      return;
    }

    allSongs = allSongs.filter(s => s.id !== songId);
    favoriteSongIds = favoriteSongIds.filter(id => id !== songId);
    customPlaylists.forEach(f => {
      f.songIds = f.songIds.filter(id => id !== songId);
    });

    if (song.isLocalFav) {
      await deleteSongFromDB(songId);
    }

    saveSongs();
    saveFavorites();
    savePlaylists();

    if (currentSong && currentSong.id === songId) {
      if (allSongs.length > 0) {
        playSong(allSongs[0], true);
      } else {
        pauseMusic();
        audio.src = '';
        currentSong = null;
        updatePlayStateUI();
        updateCurrentFavButtonUI();
      }
    } else {
      renderPlaylistDrawer();
    }
  };

  // ================= 模态窗：添加歌曲到歌单 =================
  let songTargetForFolder = null;

  window.openAddToFolderModalForCurrent = function() {
    if (!currentSong) {
      alert('user，当前没有正在播放的歌曲。');
      return;
    }
    window.openAddToFolderModal(currentSong.id);
  };

  window.openAddToFolderModal = function(songId, event) {
    if (event) event.stopPropagation();
    const song = allSongs.find(s => s.id === songId);
    if (!song) return;
    songTargetForFolder = song;

    const modal = document.getElementById('music-add-to-folder-modal');
    const titleEl = document.getElementById('add-to-folder-song-name');
    const listEl = document.getElementById('music-modal-folder-list');

    if (titleEl) titleEl.innerText = '目标曲目：《' + song.title + '》';

    if (listEl) {
      if (customPlaylists.length === 0) {
        listEl.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 10px;">暂无歌单，请在下方快速创建一个～</div>';
      } else {
        listEl.innerHTML = customPlaylists.map(f => {
          const alreadyIn = (f.songIds || []).includes(song.id);
          return `
            <div class="modal-folder-item ${alreadyIn ? 'already-in' : ''}" onclick="toggleSongInFolder('${f.id}', '${song.id}')">
              <span>📁 ${f.name} (${(f.songIds || []).length}首)</span>
              <span>${alreadyIn ? '✓ 已在此歌单' : '＋ 添加'}</span>
            </div>
          `;
        }).join('');
      }
    }

    if (modal) modal.style.display = 'flex';
  };

  window.closeAddToFolderModal = function(event) {
    if (event && event.target && event.target.id !== 'music-add-to-folder-modal') return;
    const modal = document.getElementById('music-add-to-folder-modal');
    if (modal) modal.style.display = 'none';
    songTargetForFolder = null;
  };

  window.toggleSongInFolder = function(folderId, songId) {
    const folder = customPlaylists.find(f => f.id === folderId);
    if (!folder) return;
    if (!folder.songIds) folder.songIds = [];

    const inIdx = folder.songIds.indexOf(songId);
    if (inIdx >= 0) {
      folder.songIds.splice(inIdx, 1);
    } else {
      folder.songIds.push(songId);
    }
    savePlaylists();
    renderPlaylistDrawer();
    window.openAddToFolderModal(songId); // 刷新弹窗状态
  };

  window.quickCreateAndAddSong = function() {
    const input = document.getElementById('modal-quick-folder-name');
    const name = input ? (input.value || '').trim() : '';
    if (!name) {
      alert('请输入歌单名称');
      return;
    }
    if (!songTargetForFolder) return;

    let targetFolder = customPlaylists.find(f => f.name === name);
    if (!targetFolder) {
      targetFolder = {
        id: 'pl-' + Date.now(),
        name: name,
        songIds: [songTargetForFolder.id]
      };
      customPlaylists.unshift(targetFolder);
    } else {
      if (!targetFolder.songIds.includes(songTargetForFolder.id)) {
        targetFolder.songIds.push(songTargetForFolder.id);
      }
    }

    savePlaylists();
    if (input) input.value = '';
    renderPlaylistDrawer();
    window.closeAddToFolderModal();
    alert('已将《' + songTargetForFolder.title + '》加入歌单《' + name + '》！');
  };

  // ================= 渲染抽屉主列表 =================
  function renderPlaylistDrawer() {
    const folderBar = document.getElementById('music-current-folder-bar');
    const folderTitle = document.getElementById('music-current-folder-title');
    const listEl = document.getElementById('music-playlist-list');
    const gridEl = document.getElementById('custom-playlists-grid');

    // 1. 如果当前是歌单分类管理页
    if (activeTab === 'playlists' && !currentViewingFolderId) {
      if (gridEl) {
        if (customPlaylists.length === 0) {
          gridEl.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 24px 0; font-size: 12px;">还没有自建歌单哦，快在上方创建一个吧～</div>';
        } else {
          gridEl.innerHTML = customPlaylists.map(f => {
            const count = (f.songIds || []).length;
            return `
              <div class="playlist-folder-card" onclick="enterFolderView('${f.id}')">
                <div class="playlist-folder-icon">📂</div>
                <div class="playlist-folder-info">
                  <div class="playlist-folder-name">${f.name}</div>
                  <div class="playlist-folder-count">共 ${count} 首音乐 · 点击展开</div>
                </div>
                <div class="playlist-folder-actions">
                  <button class="playlist-folder-del-btn" title="删除歌单" onclick="deletePlaylist('${f.id}', event)">🗑️</button>
                </div>
              </div>
            `;
          }).join('');
        }
      }
      return;
    }

    // 2. 歌曲列表渲染（区分：全部歌曲、我喜欢、歌单内部）
    let displaySongs = [];
    if (currentViewingFolderId) {
      const folder = customPlaylists.find(f => f.id === currentViewingFolderId);
      if (folder) {
        if (folderBar) folderBar.style.display = 'flex';
        if (folderTitle) folderTitle.innerText = '歌单：' + folder.name + ' (' + (folder.songIds || []).length + ')';
        displaySongs = (folder.songIds || []).map(id => allSongs.find(s => s.id === id)).filter(Boolean);
      }
    } else {
      if (folderBar) folderBar.style.display = 'none';
      if (activeTab === 'fav') {
        displaySongs = favoriteSongIds.map(id => allSongs.find(s => s.id === id)).filter(Boolean);
      } else {
        displaySongs = allSongs;
      }
    }

    if (!listEl) return;

    if (displaySongs.length === 0) {
      let emptyHint = '暂无歌曲';
      if (activeTab === 'fav') emptyHint = 'user还没有点过红心收藏哦，听到心动的歌记得点它～';
      else if (currentViewingFolderId) emptyHint = '此歌单还是空的，点击曲库旁边的“➕”添加进去吧！';
      listEl.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 30px 0; font-size: 12px;">${emptyHint}</div>`;
      return;
    }

    listEl.innerHTML = displaySongs.map((s) => {
      const isCur = currentSong && currentSong.id === s.id;
      const isFav = favoriteSongIds.includes(s.id);
      return `
        <div class="playlist-song-item ${isCur ? 'active' : ''}" onclick="playSongById('${s.id}')">
          <img class="playlist-song-cover" src="${s.cover || 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024bjiL2aocxT.jpg'}" alt="cover" />
          <div class="playlist-song-meta">
            <div class="playlist-song-title">${s.title}</div>
            <div class="playlist-song-sub">${s.artist}</div>
          </div>
          <div class="playlist-song-actions" onclick="event.stopPropagation()">
            <button class="song-action-btn ${isFav ? 'faved' : ''}" title="${isFav ? '取消收藏' : '加入我喜欢'}" onclick="toggleFavoriteSong('${s.id}')">
              ${isFav ? '❤️' : '🤍'}
            </button>
            <button class="song-action-btn" title="添加到歌单" onclick="openAddToFolderModal('${s.id}', event)">
              ➕
            </button>
            ${currentViewingFolderId ? `
              <button class="song-action-btn del" title="移出该歌单" onclick="removeSongFromFolder('${currentViewingFolderId}', '${s.id}', event)">
                ✕
              </button>
            ` : `
              <button class="song-action-btn del" title="从曲库移除" onclick="deleteSongEntirely('${s.id}', event)">
                🗑️
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  window.playSongById = function(songId) {
    let sourceQueue = allSongs;
    if (currentViewingFolderId) {
      const folder = customPlaylists.find(f => f.id === currentViewingFolderId);
      if (folder) {
        sourceQueue = (folder.songIds || []).map(id => allSongs.find(s => s.id === id)).filter(Boolean);
      }
    } else if (activeTab === 'fav') {
      sourceQueue = favoriteSongIds.map(id => allSongs.find(s => s.id === id)).filter(Boolean);
    }

    const song = sourceQueue.find(s => s.id === songId) || allSongs.find(s => s.id === songId);
    if (song) {
      playSong(song, true, sourceQueue);
    }
  };

  // ================= 搜索功能 (QQ 音乐官方原生 JSONP) =================
  // ================= 搜索：走自家 Cloudflare 函数（服务端代理网易云，前端不跨域）=================
  window.searchMusicOnline = async function() {
    const inputEl = document.getElementById('music-search-input');
    if (!inputEl) return;
    const kw = (inputEl.value || '').trim();
    if (!kw) {
      alert('user，输入你想听的歌名或歌手，比如“晴天”或者“周杰伦”。');
      return;
    }

    const badgeEl = document.getElementById('music-status-badge');
    if (badgeEl) badgeEl.innerText = '正在网易云音乐里检索《' + kw + '》…';

    try {
      const resp = await fetch('/api/music/search?kw=' + encodeURIComponent(kw), { cache: 'no-store' });
      const data = await resp.json().catch(() => ({}));
      const list = (data && data.songs) || [];
      if (list.length === 0) {
        alert('没有搜到《' + kw + '》，换个关键词试试，或者直接导入本地歌曲。');
        if (badgeEl) badgeEl.innerText = '共同佩戴一副耳机';
        return;
      }

      let addedCount = 0;
      list.forEach(item => {
        const sid = 'ne-' + item.id;
        if (allSongs.some(s => s.id === sid)) return;
        allSongs.unshift({
          id: sid,
          neId: String(item.id),
          source: 'netease',
          title: item.name,
          artist: (item.artist || '网易云音乐') + ' · 网易云',
          cover: item.cover || '',
          url: ''
        });
        addedCount++;
      });

      saveSongs();
      renderPlaylistDrawer();
      inputEl.value = '';

      if (badgeEl) badgeEl.innerText = '搜到 ' + list.length + ' 首，已放进曲库（' + addedCount + ' 首新增）';

      // 自动挑一首现在就能播的（免费歌免登录即可；版权歌要登录态）
      const candidates = list.map(it => allSongs.find(s => s.id === 'ne-' + it.id)).filter(Boolean);
      let started = null;
      for (const c of candidates.slice(0, 5)) {
        const okPlay = await playSong(c, true, allSongs, true);
        if (okPlay) { started = c; break; }
      }
      if (started) {
        const bubbleEl = document.getElementById('music-live-bubble-text');
        if (bubbleEl) bubbleEl.innerText = '“《' + started.title + '》……这首我想和你一起听。”';
      } else if (badgeEl) {
        badgeEl.innerText = '这几首都要登录态，配好网易云 cookie 就能播';
      }
    } catch (err) {
      alert('搜索失败：' + ((err && err.message) ? err.message : err));
      if (badgeEl) badgeEl.innerText = '共同佩戴一副耳机';
    }
  };
  // ================= 本地音频与 VIP 歌曲导入 (持久化至 IndexedDB) =================
  window.handleImportLocalSong = async function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const fileName = file.name.replace(/\.[^/.]+$/, '');
    const blobUrl = URL.createObjectURL(file);
    const userBg = localStorage.getItem('momo_global_bg') || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&q=80';

    const localSong = {
      id: 'local-' + Date.now(),
      title: fileName,
      artist: 'user的本地收藏 · 顶级无损',
      cover: userBg,
      url: blobUrl,
      isLocalFav: true
    };

    // 永久写入本地 IndexedDB，刷新永不丢失
    await saveSongToDB(localSong, file);

    allSongs.unshift(localSong);
    saveSongs();
    playSong(localSong, true, allSongs);
    alert('已成功将《' + fileName + '》永久存储到小手机中！支持放入歌单随时分类聆听～');
  };

  // 粘贴直链
  window.promptAddMusicUrl = function() {
    const url = prompt('请粘贴你的音频直链 (支持 .mp3 / .flac / .m4a 链接)：');
    if (!url || !url.trim()) return;
    const title = prompt('给这首歌起个名字吧：', 'user喜欢的歌') || '浪漫曲目';

    const customSong = {
      id: 'custom-' + Date.now(),
      title: title,
      artist: 'user的私享音频 · 绪言伴听',
      cover: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024bjiL2aocxT.jpg',
      url: url.trim()
    };

    allSongs.unshift(customSong);
    saveSongs();
    playSong(customSong, true, allSongs);
  };

  // 浪漫情话气泡自定义
  window.changeMusicWishQuote = function() {
    const current = document.getElementById('music-wish-text').innerText;
    const quote = prompt('想对绪言说一句什么一起听的情话呢？', current);
    if (quote && quote.trim()) {
      document.getElementById('music-wish-text').innerText = quote.trim();
      localStorage.setItem('momo_music_wish_quote', quote.trim());
    }
  };

  // 初始化音乐播放器
  window.initMusicPlayer = async function() {
    loadPersistedData();

    try {
      const storedLocalSongs = await loadStoredSongsFromDB();
      if (storedLocalSongs && storedLocalSongs.length > 0) {
        storedLocalSongs.forEach(ls => {
          const existIdx = allSongs.findIndex(p => p.id === ls.id || p.title === ls.title);
          if (existIdx >= 0) {
            allSongs[existIdx].url = ls.url; // 重新绑定 Blob URL
            allSongs[existIdx].isLocalFav = true;
          } else {
            allSongs.unshift(ls);
          }
        });
      }
    } catch(e) { console.warn('Restore local songs err:', e); }

    const savedQuote = localStorage.getItem('momo_music_wish_quote');
    if (savedQuote) {
      const qEl = document.getElementById('music-wish-text');
      if (qEl) qEl.innerText = savedQuote;
    }

    // 头像与称谓同步
    const botAvatarEl = document.getElementById('music-avatar-bot');
    const userAvatarEl = document.getElementById('music-avatar-user');
    const botNameEl = document.getElementById('music-name-bot');
    const userNameEl = document.getElementById('music-name-user');

    const botAvatar = localStorage.getItem('momo_bot_avatar') || (window.appData && window.appData.botAvatar) || '';
    const userAvatar = localStorage.getItem('momo_user_avatar') || (window.appData && window.appData.hero && window.appData.hero.userAvatar) || '';

    if (botAvatarEl && botAvatar) botAvatarEl.src = botAvatar;
    if (userAvatarEl && userAvatar) userAvatarEl.src = userAvatar;
    if (botNameEl && window.appData) botNameEl.innerText = window.appData.botRemark || '角色';
    if (userNameEl && window.appData) userNameEl.innerText = (window.appData.hero && (window.appData.hero.userName || window.appData.hero.userHandle)) || '我';

    if (allSongs.length > 0) {
      playSong(allSongs[0], false, allSongs);
    }
  };

  // ================= 一起听耳边气泡对话 =================
  window.openMusicWhisperInput = function() {
    const bar = document.getElementById('music-whisper-bar');
    if (bar) {
      bar.style.display = 'flex';
      const inEl = document.getElementById('music-whisper-input');
      if (inEl) inEl.focus();
    }
  };

  window.closeMusicWhisperInput = function() {
    const bar = document.getElementById('music-whisper-bar');
    if (bar) bar.style.display = 'none';
  };

  window.sendMusicWhisper = async function() {
    const inEl = document.getElementById('music-whisper-input');
    let userText = inEl ? (inEl.value || '').trim() : '';
    if (inEl) inEl.value = '';
    closeMusicWhisperInput();

    const bubbleTextEl = document.getElementById('music-live-bubble-text');
    const song = currentSong || { title: '这首歌' };

    if (bubbleTextEl) {
      bubbleTextEl.innerHTML = '<span class="whisper-loading-wrap">正在耳边温存思索<span class="whisper-dot-pulse"></span><span class="whisper-dot-pulse"></span><span class="whisper-dot-pulse"></span></span>';
    }

    const dataHub = (typeof window.appData !== 'undefined' && window.appData) || (typeof appData !== 'undefined' && appData) || {};
    const apiKey = dataHub.apiKey || localStorage.getItem('momo_api_key') || '';
    let apiBase = dataHub.apiBase || localStorage.getItem('momo_api_base') || 'https://api.openai.com/v1';
    const model = dataHub.model || localStorage.getItem('momo_api_model') || 'deepseek-chat';

    if (userText && dataHub.chatHistory) {
      const timeStr = (typeof getNowStr === 'function') ? getNowStr() : '刚刚';
      dataHub.chatHistory.push({ role: 'user', content: '「🎧 一起听《' + song.title + '》耳语」：' + userText, time: timeStr });
      try {
        if (typeof window.saveChatHistoryNow === 'function') window.saveChatHistoryNow();
        else localStorage.setItem('momo_chat_history', JSON.stringify(dataHub.chatHistory.slice(-50)));
      } catch(e){}
    }

    const romanticPool = [
      '“这首歌的前奏很舒服，戴着耳机慢慢听吧。”',
      '“耳机分你一半，今天想听什么都陪你。”',
      '“很适合现在氛围的一首歌，安安静静听一会儿。”',
      '“旋律停了我也在，随时想听就点开。”',
      '“有你一起听，再平常的歌也觉得格外好听。”'
    ];
    const fallbackText = romanticPool[Math.floor(Math.random() * romanticPool.length)];

    let gotReply = false;

    if (apiKey) {
      try {
        let cleanBase = apiBase.replace(/\/+$/, '');
        if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';

        let promptInstruction = '';
        const userDisplayName = (window.appData && window.appData.hero && window.appData.hero.userName) || '用户';
        const botDisplayName = (window.appData && window.appData.botRemark) || '角色';
        if (userText) {
          promptInstruction = '【情境】：你正和' + userDisplayName + '共戴一副耳机听《' + song.title + '》。对方贴着你耳边说了：“' + userText + '”。请以' + botDisplayName + '的身份，极简耳语回复1句温存陪伴的话（20字以内）：';
        } else {
          promptInstruction = '【情境】：你正和' + userDisplayName + '共戴一副耳机听《' + song.title + '》。请以' + botDisplayName + '的身份，随旋律对TA耳语1句温存陪伴的话（20字以内）：';
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const resp = await fetch(cleanBase, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: '你是用户的专属伴侣。输出极简真切的耳边温存陪伴语，不要AI套话。' },
              { role: 'user', content: promptInstruction }
            ],
            temperature: 0.85,
            max_tokens: 80
          })
        });

        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          let reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
          reply = reply.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '').trim();
          reply = reply.replace(/^“|”$/g, '');
          if (reply) {
            gotReply = true;
            if (bubbleTextEl) bubbleTextEl.innerText = '“' + reply + '”';
            if (dataHub.chatHistory) {
              dataHub.chatHistory.push({ role: 'assistant', content: '「🎧 一起听耳语」：' + reply, time: (typeof getNowStr === 'function') ? getNowStr() : '刚刚' });
              try {
                if (typeof window.saveChatHistoryNow === 'function') window.saveChatHistoryNow();
                else localStorage.setItem('momo_chat_history', JSON.stringify(dataHub.chatHistory.slice(-50)));
              } catch(e){}
            }
          }
        }
      } catch(err) {
        console.warn('Whisper fetch fallback:', err);
      }
    }

    if (!gotReply) {
      setTimeout(() => {
        const finalAns = userText ? ('“听到了……' + userText.slice(0, 10) + '，靠过来点，我都在。”') : fallbackText;
        if (bubbleTextEl) bubbleTextEl.innerText = finalAns;
        if (dataHub.chatHistory) {
          dataHub.chatHistory.push({ role: 'assistant', content: '「🎧 一起听耳语」：' + finalAns.replace(/^“|”$/g, ''), time: (typeof getNowStr === 'function') ? getNowStr() : '刚刚' });
          try {
            if (typeof window.saveChatHistoryNow === 'function') window.saveChatHistoryNow();
            else localStorage.setItem('momo_chat_history', JSON.stringify(dataHub.chatHistory.slice(-50)));
          } catch(e){}
        }
      }, 600);
    }
  };

  // 供新版 UI 层（music-ui.js）读取数据与触发播放，不改动任何播放逻辑
  window.mzBridge = {
    songs: () => allSongs,
    playlists: () => customPlaylists,
    favoriteIds: () => favoriteSongIds,
    current: () => currentSong,
    playing: () => isPlaying,
    play: (song, ctx) => playSong(song, true, ctx || null, true)
  };

  document.addEventListener('DOMContentLoaded', () => {
    initMusicPlayer();
  });
})();
