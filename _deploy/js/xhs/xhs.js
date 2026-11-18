// ============================================================
// 小紫书 · 单机版
// 数据全部存 localStorage；图片从本地相册选，压缩后存 dataURL
// ============================================================

(function () {
  'use strict';

  var XHS_KEY = 'momo_xhs_v1';
  var MAX_IMAGES = 4;
  var activeTab = 'discover';
  var profileTab = 'notes';
  var currentNoteId = null;
  var draft = { images: [], title: '', content: '', tags: '' };
  var toastTimer = null;
  var state = null;
  var xhsRoleOpen = false;
  var xhsRoleContacts = [];
  var xhsGeneratingId = '';
  var xhsProfileDraft = null;
  var xhsProfileImageTarget = 'avatar';

  var SEED_IMAGES = {
    portrait: 'assets/xhs/xhs01.jpg',
    coffee: 'assets/xhs/xhs02.jpg',
    books: 'assets/xhs/xhs03.jpg',
    flowers: 'assets/xhs/xhs04.jpg',
    road: 'assets/xhs/xhs05.jpg',
    desk: 'assets/xhs/xhs07.jpg',
    mountain: 'assets/xhs/xhs08.jpg'
  };

  // 种子图的真实宽高比，详情页画廊按它铺满；首页封面仍用 note.ratio 做裁切
  var SEED_IMAGE_RATIOS = {
    'xhs-seed-1': 0.667,
    'xhs-seed-2': 1.5,
    'xhs-seed-3': 1.5,
    'xhs-seed-4': 1.5,
    'xhs-seed-5': 0.667,
    'xhs-seed-6': 1.5,
    'xhs-seed-7': 1.5,
    'xhs-seed-8': 1.5
  };

  function author(name, handle, color) {
    return { name: name, handle: handle, avatar: '', color: color || '#b2b5da', isMe: false };
  }

  var SEED_AUTHORS = {
    jzm: author('user', '@jiangzhimo', '#c9c2e1'),
    xuyan: author('周绪言', '@xuyan', '#c8d4df'),
    alan: author('阿岚', '@alan', '#d9c8c4'),
    xiaoman: author('小满', '@xiaoman', '#d8d1b9')
  };

  function seedNotes() {
    var now = Date.now();
    var all = [
      {
        id: 'xhs-seed-1',
        title: '把周末过成一块慢慢融化的黄油',
        content: '在厦门老城区走了很久，拐进一条没有名字的巷子。\n\n光落在旧墙上，像一块被晒软的黄油。没有计划的一天，反而最像生活。',
        images: [SEED_IMAGES.portrait],
        ratio: 0.75,
        author: SEED_AUTHORS.jzm,
        likes: 326,
        collects: 88,
        createdAt: now - 95 * 60000,
        nearby: true,
        comments: [
          { name: '小满', text: '这条巷子我也去过，下午四点的光最好看。', time: '1小时前' },
          { name: '阿岚', text: '好喜欢这种不赶路的感觉。', time: '42分钟前' }
        ]
      },
      {
        id: 'xhs-seed-2',
        title: '在街角咖啡店读到第 37 页',
        content: '今天没有点常喝的那杯，换成了燕麦拿铁。\n书翻到第 37 页的时候，窗外开始下雨。',
        images: [SEED_IMAGES.coffee, SEED_IMAGES.books],
        ratio: 1.2,
        author: SEED_AUTHORS.xuyan,
        likes: 208,
        collects: 54,
        createdAt: now - 3 * 60 * 60000,
        nearby: true,
        comments: [
          { name: 'user', text: '第 37 页写了什么？突然很好奇。', time: '2小时前' }
        ]
      },
      {
        id: 'xhs-seed-3',
        title: '最近在看的几本，都是慢书',
        content: '不急着读完的那种书。\n每天睡前看几页，像给一天留一个很轻的句号。',
        images: [SEED_IMAGES.books],
        ratio: 1.35,
        author: SEED_AUTHORS.alan,
        likes: 157,
        collects: 73,
        createdAt: now - 7 * 60 * 60000,
        nearby: false,
        comments: []
      },
      {
        id: 'xhs-seed-4',
        title: '路过一片橘子色的花',
        content: '本来只是去买面包，结果在路口停下来拍了十分钟。\n\n春天有时候就是这样，不打招呼地出现。',
        images: [SEED_IMAGES.flowers],
        ratio: 0.8,
        author: SEED_AUTHORS.xiaoman,
        likes: 96,
        collects: 21,
        createdAt: now - 11 * 60 * 60000,
        nearby: true,
        comments: [
          { name: '周绪言', text: '这个颜色很像傍晚的橘灯。', time: '3小时前' }
        ]
      },
      {
        id: 'xhs-seed-5',
        title: '往海边的路上，风把云吹得很低',
        content: '没有目的地的公路，车窗外的红色山体一直退后。\n\n如果今天一定要有一个结论，那就是：出来走走是对的。',
        images: [SEED_IMAGES.road],
        ratio: 1.4,
        author: SEED_AUTHORS.jzm,
        likes: 421,
        collects: 133,
        createdAt: now - 18 * 60 * 60000,
        nearby: true,
        comments: [
          { name: '阿岚', text: '这条路上次开过，日落的时候是金色的。', time: '5小时前' }
        ]
      },
      {
        id: 'xhs-seed-6',
        title: '第一次发笔记，先放一张桌面',
        content: '把最近在用的本子、咖啡和电脑摆在一起。\n\n以后这里会放一些画画之外的日常。',
        images: [SEED_IMAGES.desk],
        ratio: 1.0,
        author: { name: '我', handle: '@momo', avatar: '', color: '#c9c2e1', isMe: true },
        likes: 18,
        collects: 6,
        createdAt: now - 26 * 60 * 60000,
        nearby: false,
        comments: [
          { name: '小满', text: '欢迎开张！桌面很好看。', time: '昨天' }
        ]
      },
      {
        id: 'xhs-seed-7',
        title: '山里的光落下来时，所有声音都变小了',
        content: '清晨五点半出发，走到山脊的时候刚好赶上第一束光。\n\n风很大，但人很安静。',
        images: [SEED_IMAGES.mountain],
        ratio: 1.5,
        author: SEED_AUTHORS.xuyan,
        likes: 512,
        collects: 201,
        createdAt: now - 30 * 60 * 60000,
        nearby: false,
        comments: [
          { name: 'user', text: '这一张的光太好了。', time: '昨天' },
          { name: '小满', text: '早起的人会收到山送的礼物。', time: '昨天' }
        ]
      },
      {
        id: 'xhs-seed-8',
        title: '给今天留一张不完美但很喜欢的照片',
        content: '光线有点偏，构图也没有对齐。\n但按下快门的那一刻，我是开心的。',
        images: [SEED_IMAGES.flowers, SEED_IMAGES.road],
        ratio: 0.86,
        author: SEED_AUTHORS.alan,
        likes: 64,
        collects: 12,
        createdAt: now - 42 * 60 * 60000,
        nearby: false,
        comments: []
      }
    ];
    return all.filter(function (n) { return n.author && n.author.isMe; });
  }

  function defaultProfile() {
    var profile = {
      name: '我',
      handle: '@momo',
      avatar: '',
      cover: '',
      bio: '把日子过成喜欢的样子。画画、散步、偶尔发呆。'
    };
    try {
      var hero = JSON.parse(localStorage.getItem('momo_hero_data') || '{}');
      if (hero.userName) profile.name = hero.userName;
      if (hero.userHandle) profile.handle = hero.userHandle;
    } catch (e) {}
    return profile;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(XHS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var beforeCount = Array.isArray(parsed.notes) ? parsed.notes.length : 0;
        var normalized = normalizeState(parsed);
        if (normalized.notes.length !== beforeCount) {
          saveStateObject(normalized);
        }
        return normalized;
      }
    } catch (e) {}
    var fresh = {
      version: 1,
      notes: seedNotes(),
      liked: {},
      collected: {},
      followed: ['user', '周绪言'],
      profile: defaultProfile()
    };
    saveStateObject(fresh);
    return normalizeState(fresh);
  }

  function normalizeState(s) {
    s = s || {};
    if (!Array.isArray(s.notes)) s.notes = [];
    if (!s.liked || typeof s.liked !== 'object') s.liked = {};
    if (!s.collected || typeof s.collected !== 'object') s.collected = {};
    if (!Array.isArray(s.followed)) s.followed = [];
    if (!s.profile) s.profile = defaultProfile();
    if (typeof s.profile.name !== 'string' || !s.profile.name) s.profile.name = '我';
    if (typeof s.profile.handle !== 'string' || !s.profile.handle) s.profile.handle = '@momo';
    if (typeof s.profile.avatar !== 'string') s.profile.avatar = '';
    if (typeof s.profile.cover !== 'string') s.profile.cover = '';
    if (typeof s.profile.bio !== 'string') s.profile.bio = '';
    s.notes = s.notes.filter(function (n) {
      return !(n && typeof n.id === 'string' && /^xhs-seed-/.test(n.id) && (!n.author || !n.author.isMe));
    });
    s.notes = s.notes.map(function (n) {
      if (!Array.isArray(n.images)) n.images = [];
      if (!Array.isArray(n.comments)) n.comments = [];
      if (!n.author) n.author = { name: '我', handle: '@momo', avatar: '', isMe: true };
      if (typeof n.likes !== 'number') n.likes = 0;
      if (typeof n.collects !== 'number') n.collects = 0;
      if (typeof n.ratio !== 'number' || !n.ratio) n.ratio = 0.75;
      if (typeof n.imageRatio !== 'number' || !n.imageRatio) n.imageRatio = SEED_IMAGE_RATIOS[n.id] || n.ratio;
      if (!n.createdAt) n.createdAt = Date.now();
      return n;
    });
    return s;
  }

  function saveStateObject(s) {
    try {
      localStorage.setItem(XHS_KEY, JSON.stringify(s));
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveState() {
    var ok = saveStateObject(state);
    if (!ok) showXhsToast('本地存储空间不够了，换一张小一点的图再试');
    return ok;
  }

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function initialOf(a) {
    var name = (a && a.name) ? a.name : '?';
    return name.slice(-1);
  }

  function avatarHtml(a) {
    if (a && a.avatar) {
      return '<img class="xhs-avatar" src="' + esc(a.avatar) + '" alt="" loading="lazy">';
    }
    return '<span class="xhs-avatar-fallback">' + esc(initialOf(a)) + '</span>';
  }

  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function timeText(ts) {
    var diff = Math.max(0, Date.now() - (Number(ts) || Date.now()));
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return minutes + '分钟前';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + '小时前';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + '天前';
    var d = new Date(Number(ts));
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function getNote(id) {
    for (var i = 0; i < state.notes.length; i++) {
      if (state.notes[i].id === id) return state.notes[i];
    }
    return null;
  }

  function isLiked(id) { return !!state.liked[id]; }
  function isCollected(id) { return !!state.collected[id]; }

  function isFollowed(name) {
    return state.followed.indexOf(name) >= 0;
  }

  function visibleNotes() {
    if (activeTab === 'follow') {
      return state.notes.filter(function (n) { return n.author && n.author.isMe ? true : isFollowed(n.author ? n.author.name : ''); });
    }
    if (activeTab === 'nearby') {
      return state.notes.filter(function (n) { return !!n.nearby; });
    }
    return state.notes;
  }

  function coverHtml(note, extraClass) {
    var src = note.images && note.images[0] ? note.images[0] : '';
    var ratio = Number(note.ratio) || 0.75;
    return '<div class="xhs-cover ' + (extraClass || '') + '" style="aspect-ratio:' + ratio + '">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.style.opacity=0">' : '') +
      '</div>';
  }

  function noteCardHtml(note) {
    var liked = isLiked(note.id);
    return '<div class="xhs-card" onclick="openXhsNote(\'' + note.id + '\')">' +
      coverHtml(note) +
      '<div class="xhs-card-title">' + esc(note.title) + '</div>' +
      '<div class="xhs-card-foot">' + avatarHtml(note.author) +
        '<span class="xhs-card-author">' + esc(note.author.name) + '</span>' +
        '<span class="xhs-card-like ' + (liked ? 'liked' : '') + '"><span class="heart">♥</span>' + formatCount(note.likes) + '</span>' +
      '</div>' +
    '</div>';
  }

  function renderFeed() {
    var feed = $('xhs-feed');
    if (!feed) return;
    var list = visibleNotes();
    if (!list.length) {
      feed.innerHTML = '<div class="xhs-empty">' + (activeTab === 'follow' ? '关注的人还没有发笔记。' : '这一带暂时没有新笔记。') + '</div>';
      return;
    }
    feed.innerHTML = list.map(noteCardHtml).join('');
  }

  function setXhsTab(tab) {
    activeTab = tab;
    var buttons = document.querySelectorAll('#xhs-tabs .xhs-tab');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-tab') === tab);
    }
    renderFeed();
    var feed = $('xhs-feed');
    if (feed) feed.scrollTop = 0;
  }

  function showXhsHome() {
    closeXhsProfileEditor();
    var home = $('xhs-home');
    var profile = $('xhs-profile');
    if (home) home.style.display = 'flex';
    if (profile) profile.style.display = 'none';
    var navHome = $('xhs-nav-home');
    var navMe = $('xhs-nav-me');
    if (navHome) navHome.classList.add('active');
    if (navMe) navMe.classList.remove('active');
    renderFeed();
  }

  function exitXhsApp() {
    closeXhsCommentDrawer();
    closeXhsNoteMenu();
    closeXhsProfileEditor();
    if (typeof window.openPage === 'function') {
      window.openPage('page-home');
      return;
    }
    document.body.classList.remove('view-active-subpage');
    var page = $('page-xhs');
    if (page) {
      page.classList.remove('active');
      page.style.display = 'none';
    }
  }

  function showXhsProfile() {
    var home = $('xhs-home');
    var profile = $('xhs-profile');
    if (home) home.style.display = 'none';
    if (profile) profile.style.display = 'flex';
    var navHome = $('xhs-nav-home');
    var navMe = $('xhs-nav-me');
    if (navHome) navHome.classList.remove('active');
    if (navMe) navMe.classList.add('active');
    renderProfile();
  }

  function xhsCoverAttr(url) {
    if (!url) return '';
    return ' style="background-image: linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.02) 46%, rgba(0,0,0,0.12)), url(&quot;' + esc(url) + '&quot;); background-size: cover; background-position: center;"';
  }

  function renderProfile() {
    var profile = $('xhs-profile');
    if (!profile) return;
    var myNotes = state.notes.filter(function (n) { return n.author && n.author.isMe; });
    var savedNotes = state.notes.filter(function (n) { return isCollected(n.id); });
    var shown = profileTab === 'saved' ? savedNotes : myNotes;
    var totalLikes = myNotes.reduce(function (sum, n) { return sum + (Number(n.likes) || 0); }, 0);

    profile.innerHTML =
      '<div class="xhs-profile-cover' + (state.profile.cover ? ' has-cover' : '') + '"' + xhsCoverAttr(state.profile.cover) + '>' +
        '<div class="xhs-profile-bar">' +
          '<button onclick="showXhsHome()">‹ 首页</button>' +
          '<span>个人主页</span>' +
          '<button class="xhs-profile-edit-btn" onclick="openXhsProfileEditor()">编辑</button>' +
        '</div>' +
        '<div class="xhs-profile-avatar-wrap"><div class="xhs-profile-avatar">' +
          (state.profile.avatar ? '<img src="' + esc(state.profile.avatar) + '" alt="">' : esc((state.profile.name || '我').slice(-1))) +
        '</div></div>' +
      '</div>' +
      '<div class="xhs-profile-info">' +
        '<div class="xhs-profile-name">' + esc(state.profile.name || '我') + '</div>' +
        '<div class="xhs-profile-handle">' + esc(state.profile.handle || '@momo') + '</div>' +
        '<div class="xhs-profile-bio">' + esc(state.profile.bio || '') + '</div>' +
        '<div class="xhs-profile-stats">' +
          '<div class="xhs-stat"><b>' + myNotes.length + '</b>笔记</div>' +
          '<div class="xhs-stat"><b>' + formatCount(totalLikes) + '</b>获赞</div>' +
          '<div class="xhs-stat"><b>' + savedNotes.length + '</b>收藏</div>' +
        '</div>' +
      '</div>' +
      '<div class="xhs-profile-tabs">' +
        '<button class="xhs-profile-tab ' + (profileTab === 'notes' ? 'active' : '') + '" onclick="setXhsProfileTab(\'notes\')">笔记</button>' +
        '<button class="xhs-profile-tab ' + (profileTab === 'saved' ? 'active' : '') + '" onclick="setXhsProfileTab(\'saved\')">收藏</button>' +
      '</div>' +
      (shown.length
        ? '<div class="xhs-profile-grid">' + shown.map(noteCardHtml).join('') + '</div>'
        : '<div class="xhs-empty">' + (profileTab === 'saved' ? '还没有收藏笔记。' : '还没有发布笔记。') + '</div>');
  }

  function setXhsProfileTab(tab) {
    profileTab = tab;
    renderProfile();
  }

  function openXhsProfileEditor() {
    closeXhsCommentDrawer();
    closeXhsNoteMenu();
    var page = $('page-xhs');
    if (!page) return;
    var mask = $('xhs-profile-editor');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'xhs-profile-editor';
      mask.className = 'xhs-drawer-mask xhs-profile-editor-mask';
      mask.onclick = function (event) {
        if (event.target === mask) closeXhsProfileEditor();
      };
      page.appendChild(mask);
    }
    xhsProfileDraft = {
      avatar: state.profile.avatar || '',
      cover: state.profile.cover || ''
    };
    xhsProfileImageTarget = 'avatar';
    mask.innerHTML =
      '<div class="xhs-drawer xhs-profile-editor-sheet">' +
        '<div class="xhs-drawer-grab"></div>' +
        '<div class="xhs-drawer-head">' +
          '<div class="xhs-drawer-head-title">编辑名片</div>' +
          '<button class="xhs-drawer-close" onclick="closeXhsProfileEditor()" aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="xhs-drawer-body xhs-profile-editor-body">' +
          '<div class="xhs-profile-cover-edit" id="xhs-cover-edit-preview" onclick="pickXhsProfileImage(\'cover\')">' +
            '<span class="xhs-profile-cover-hint">更换封面</span>' +
          '</div>' +
          '<div class="xhs-profile-avatar-edit-row">' +
            '<div class="xhs-profile-avatar-edit" id="xhs-avatar-edit-preview"></div>' +
            '<button type="button" class="xhs-profile-image-btn" onclick="pickXhsProfileImage(\'avatar\')">更换头像</button>' +
            '<span class="xhs-profile-avatar-note">小紫书内独立头像，不影响手机主头像</span>' +
          '</div>' +
          '<label class="xhs-profile-field">' +
            '<span>昵称</span>' +
            '<input id="xhs-profile-name-input" type="text" maxlength="20" value="' + esc(state.profile.name || '我') + '" placeholder="给自己起个名字">' +
          '</label>' +
          '<label class="xhs-profile-field">' +
            '<span>紫书号</span>' +
            '<input id="xhs-profile-handle-input" type="text" maxlength="24" value="' + esc(state.profile.handle || '@momo') + '" placeholder="@momo">' +
          '</label>' +
          '<label class="xhs-profile-field">' +
            '<span>个性签名</span>' +
            '<textarea id="xhs-profile-bio-input" maxlength="80" rows="3" placeholder="写一句留给别人看的话">' + esc(state.profile.bio || '') + '</textarea>' +
          '</label>' +
          '<input id="xhs-profile-image-input" class="xhs-profile-file" type="file" accept="image/*" onchange="handleXhsProfileImageInput(event)">' +
        '</div>' +
        '<div class="xhs-profile-editor-foot">' +
          '<button type="button" class="xhs-profile-save" onclick="saveXhsProfileEditor()">保存名片</button>' +
        '</div>' +
      '</div>';
    mask.style.display = 'flex';
    renderXhsProfileEditorAssets();
  }

  function closeXhsProfileEditor() {
    var mask = $('xhs-profile-editor');
    if (mask) mask.style.display = 'none';
    xhsProfileDraft = null;
    xhsProfileImageTarget = 'avatar';
  }

  function renderXhsProfileEditorAssets() {
    if (!xhsProfileDraft) return;
    var cover = $('xhs-cover-edit-preview');
    if (cover) {
      cover.classList.toggle('has-cover', !!xhsProfileDraft.cover);
      if (xhsProfileDraft.cover) {
        cover.style.backgroundImage = 'linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0.02) 46%, rgba(0,0,0,0.10)), url("' + xhsProfileDraft.cover + '")';
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
      } else {
        cover.style.backgroundImage = '';
      }
    }
    var avatar = $('xhs-avatar-edit-preview');
    if (avatar) {
      avatar.innerHTML = xhsProfileDraft.avatar
        ? '<img src="' + esc(xhsProfileDraft.avatar) + '" alt="">'
        : esc((state.profile.name || '我').slice(-1));
    }
  }

  function pickXhsProfileImage(kind) {
    if (!xhsProfileDraft) return;
    xhsProfileImageTarget = kind === 'cover' ? 'cover' : 'avatar';
    var input = $('xhs-profile-image-input');
    if (input) input.click();
  }

  function handleXhsProfileImageInput(event) {
    var input = event && event.target;
    var files = input && input.files ? input.files : [];
    if (!files.length || !xhsProfileDraft) {
      if (input) input.value = '';
      return;
    }
    var target = xhsProfileImageTarget;
    var file = files[0];
    if (input) input.value = '';
    compressImage(file, target === 'avatar' ? 720 : 1280).then(function (item) {
      if (!item || !xhsProfileDraft) {
        showXhsToast('图片没能读取，换一张试试');
        return;
      }
      xhsProfileDraft[target] = item.src;
      renderXhsProfileEditorAssets();
      showXhsToast(target === 'cover' ? '封面已选好，保存后生效' : '头像已选好，保存后生效');
    });
  }

  function saveXhsProfileEditor() {
    if (!xhsProfileDraft) return;
    var name = String(($('xhs-profile-name-input') || {}).value || '').trim() || '我';
    var handle = String(($('xhs-profile-handle-input') || {}).value || '').trim();
    if (!handle || handle === '@') handle = '@momo';
    if (handle.charAt(0) !== '@') handle = '@' + handle;
    var bio = String(($('xhs-profile-bio-input') || {}).value || '').trim();
    var avatar = xhsProfileDraft.avatar || '';
    var cover = xhsProfileDraft.cover || '';
    var oldProfile = state.profile;
    var oldAuthors = [];
    state.notes.forEach(function (n) {
      if (n.author && n.author.isMe) oldAuthors.push({ note: n, author: n.author });
    });
    state.profile = Object.assign({}, state.profile, {
      name: name.slice(0, 20),
      handle: handle.slice(0, 24),
      avatar: avatar,
      cover: cover,
      bio: bio.slice(0, 80)
    });
    state.notes.forEach(function (n) {
      if (n.author && n.author.isMe) {
        n.author = Object.assign({}, n.author, {
          name: state.profile.name,
          handle: state.profile.handle,
          avatar: state.profile.avatar
        });
      }
    });
    if (!saveStateObject(state)) {
      state.profile = oldProfile;
      oldAuthors.forEach(function (item) { item.note.author = item.author; });
      showXhsToast('本地空间不够了，换一张小一点的封面或头像');
      return;
    }
    closeXhsProfileEditor();
    renderProfile();
    showXhsToast('名片已更新');
  }

  function openXhsNote(id) {
    var note = getNote(id);
    if (!note) return;
    closeXhsCommentDrawer();
    closeXhsNoteMenu();
    closeXhsProfileEditor();
    currentNoteId = id;
    var view = $('xhs-note-view');
    if (view) view.style.display = 'flex';
    renderNoteDetail();
  }

  function closeXhsNote() {
    closeXhsCommentDrawer();
    closeXhsNoteMenu();
    currentNoteId = null;
    var view = $('xhs-note-view');
    if (view) view.style.display = 'none';
    renderFeed();
    if ($('xhs-profile') && $('xhs-profile').style.display === 'flex') renderProfile();
  }

  function galleryHtml(note) {
    if (!note.images.length) {
      return '<div class="xhs-detail-slide"></div>';
    }
    var ratio = Number(note.imageRatio) || Number(note.ratio) || 0.75;
    if (ratio < 0.5) ratio = 0.5;
    if (ratio > 2.2) ratio = 2.2;
    return '<div class="xhs-detail-gallery" id="xhs-gallery" style="aspect-ratio:' + ratio + ';" onscroll="onXhsGalleryScroll(this)">' +
      note.images.map(function (src) {
        return '<div class="xhs-detail-slide"><img src="' + esc(src) + '" alt="" onerror="this.style.opacity=0"></div>';
      }).join('') +
    '</div>' +
    (note.images.length > 1
      ? '<div class="xhs-gallery-dots" id="xhs-gallery-dots">' + note.images.map(function (_, i) {
          return '<span class="xhs-dot ' + (i === 0 ? 'active' : '') + '" data-index="' + i + '" onclick="scrollXhsGallery(' + i + ')"></span>';
        }).join('') + '</div>'
      : '');
  }

  function commentsHtml(note) {
    var comments = note.comments || [];
    var head = '<div class="xhs-comments-head"><span>共 ' + comments.length + ' 条评论</span>' +
      '<button class="xhs-generate-btn" onclick="openXhsCommentDrawer()">生成评论</button></div>';
    if (!comments.length) {
      return head + '<div class="xhs-empty" style="padding:18px 0 6px;">还没有评论，来坐第一排。</div>';
    }
    return head +
      comments.map(function (c) {
        return '<div class="xhs-comment">' +
          avatarHtml({ name: c.name || '?', avatar: c.avatar || '' }) +
          '<div class="xhs-comment-main">' +
            '<div class="xhs-comment-name">' + esc(c.name || '') + '</div>' +
            '<div class="xhs-comment-text">' + esc(c.text || '') + '</div>' +
            '<div class="xhs-comment-time">' + esc(c.time || '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
  }

  function renderNoteDetail() {
    var view = $('xhs-note-view');
    var note = getNote(currentNoteId);
    if (!view || !note) return;
    var liked = isLiked(note.id);
    var collected = isCollected(note.id);
    var followed = note.author.isMe || isFollowed(note.author.name);
    var tags = (note.tags || []).map(function (t) { return '<span>#' + esc(t.replace(/^#/, '')) + '</span>'; }).join(' ');
    if (!tags && note.content) {
      var inlineTags = note.content.match(/#[^\s#]+/g);
      if (inlineTags) tags = inlineTags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join(' ');
    }

    view.innerHTML =
      '<div class="xhs-detail-head">' +
        '<button class="xhs-icon-btn" onclick="closeXhsNote()" aria-label="返回">' +
          '<svg viewBox="0 0 24 24"><path d="M14.5 5.5L7.5 12l7 6.5"/></svg>' +
        '</button>' +
        '<div class="xhs-detail-author">' + avatarHtml(note.author) +
          '<div><div class="xhs-detail-author-name">' + esc(note.author.name) + '</div>' +
          '<div class="xhs-profile-handle" style="margin-top:1px;font-size:9.5px;">' + esc(note.author.handle || '') + '</div></div>' +
        '</div>' +
        (note.author.isMe ? '' : '<button class="xhs-follow-btn ' + (followed ? 'following' : '') + '" id="xhs-follow-btn" onclick="toggleXhsFollow(\'' + esc(note.author.name) + '\')">' + (followed ? '已关注' : '关注') + '</button>') +
      '</div>' +
      '<div class="xhs-detail-scroll" id="xhs-detail-scroll">' +
        galleryHtml(note) +
        '<div class="xhs-detail-body">' +
          '<div class="xhs-detail-title">' + esc(note.title) + '</div>' +
          '<div class="xhs-detail-text">' + esc(note.content) + '</div>' +
          (tags ? '<div class="xhs-detail-tags">' + tags + '</div>' : '') +
          '<div class="xhs-detail-meta">' + timeText(note.createdAt) + (note.nearby ? ' · 附近' : '') + '</div>' +
          '<div class="xhs-comments" id="xhs-comments">' +
            '<div id="xhs-comment-list">' + commentsHtml(note) + '</div>' +
            '<div class="xhs-comment-composer">' +
              '<input class="xhs-comment-input" id="xhs-comment-input" maxlength="200" placeholder="说点什么..." onkeydown="if(event.key===\'Enter\'){sendXhsComment();}">' +
              '<button class="xhs-comment-send" onclick="sendXhsComment()">发送</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="xhs-detail-actions">' +
        '<button class="xhs-action-btn ' + (liked ? 'liked' : '') + '" id="xhs-like-btn" onclick="toggleXhsLike()">' +
          '<svg viewBox="0 0 24 24"><path d="M12 20.2s-6.8-4.1-8.6-8.1C1.8 8.7 3.6 5.7 6.8 5.7c1.9 0 3.4 1.1 4.1 2.3.8-1.2 2.3-2.3 4.1-2.3 3.2 0 5 3 3.4 6.4-1.8 4-8.4 8.1-8.4 8.1z"/></svg>' +
          '<span id="xhs-like-count">' + formatCount(note.likes) + '</span>' +
        '</button>' +
        '<button class="xhs-action-btn ' + (collected ? 'collected' : '') + '" id="xhs-collect-btn" onclick="toggleXhsCollect()">' +
          '<svg viewBox="0 0 24 24"><path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/></svg>' +
          '<span id="xhs-collect-count">' + formatCount(note.collects) + '</span>' +
        '</button>' +
        '<button class="xhs-action-btn" onclick="focusXhsComment()">' +
          '<svg viewBox="0 0 24 24"><path d="M5 6.5a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 6.5v5a2.5 2.5 0 0 1-2.5 2.5H11l-3.8 2.6v-2.6A2.5 2.5 0 0 1 5 11.5z"/></svg>' +
          '<span id="xhs-comment-count">' + (note.comments || []).length + '</span>' +
        '</button>' +
        '<div class="xhs-action-spacer"></div>' +
        (note.author.isMe ? '<button class="xhs-action-btn xhs-delete-link" onclick="openXhsNoteMenu()">删除</button>' : '') +
        '<button class="xhs-action-btn" onclick="closeXhsNote()">收起</button>' +
      '</div>';
  }

  function toggleXhsLike() {
    var note = getNote(currentNoteId);
    if (!note) return;
    var liked = !isLiked(note.id);
    state.liked[note.id] = liked;
    note.likes = Math.max(0, (Number(note.likes) || 0) + (liked ? 1 : -1));
    saveState();
    var btn = $('xhs-like-btn');
    var count = $('xhs-like-count');
    if (btn) btn.classList.toggle('liked', liked);
    if (count) count.textContent = formatCount(note.likes);
    renderFeed();
  }

  function toggleXhsCollect() {
    var note = getNote(currentNoteId);
    if (!note) return;
    var collected = !isCollected(note.id);
    state.collected[note.id] = collected;
    note.collects = Math.max(0, (Number(note.collects) || 0) + (collected ? 1 : -1));
    saveState();
    var btn = $('xhs-collect-btn');
    var count = $('xhs-collect-count');
    if (btn) btn.classList.toggle('collected', collected);
    if (count) count.textContent = formatCount(note.collects);
  }

  function toggleXhsFollow(name) {
    if (!name) return;
    var idx = state.followed.indexOf(name);
    if (idx >= 0) state.followed.splice(idx, 1);
    else state.followed.push(name);
    saveState();
    var btn = $('xhs-follow-btn');
    var followed = isFollowed(name);
    if (btn) {
      btn.classList.toggle('following', followed);
      btn.textContent = followed ? '已关注' : '关注';
    }
    renderFeed();
  }

  function refreshXhsComments(note) {
    var list = $('xhs-comment-list');
    if (list) list.innerHTML = commentsHtml(note);
    var count = $('xhs-comment-count');
    if (count) count.textContent = (note.comments || []).length;
  }

  function sendXhsComment() {
    var note = getNote(currentNoteId);
    var input = $('xhs-comment-input');
    if (!note || !input) return;
    var text = input.value.trim();
    if (!text) return;
    note.comments = note.comments || [];
    note.comments.push({ name: state.profile.name || '我', avatar: state.profile.avatar || '', text: text, time: '刚刚' });
    if (!saveState()) return;
    input.value = '';
    refreshXhsComments(note);
    showXhsToast('评论已发送');
  }

  function focusXhsComment() {
    var input = $('xhs-comment-input');
    if (!input) return;
    input.focus();
    if (input.scrollIntoView) input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function onXhsGalleryScroll(el) {
    var dots = document.querySelectorAll('#xhs-gallery-dots .xhs-dot');
    if (!dots.length) return;
    var index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('active', i === index);
  }

  function scrollXhsGallery(index) {
    var el = $('xhs-gallery');
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: 'smooth' });
  }

  function openXhsSearch() {
    var panel = $('xhs-search');
    if (!panel) return;
    if (!$('xhs-search-input')) {
      panel.innerHTML =
        '<div class="xhs-search-head">' +
          '<input class="xhs-search-input" id="xhs-search-input" placeholder="搜索笔记、用户、话题" oninput="handleXhsSearchInput(this.value)">' +
          '<button class="xhs-search-cancel" onclick="closeXhsSearch()">取消</button>' +
        '</div>' +
        '<div class="xhs-search-body" id="xhs-search-body"></div>';
    }
    panel.style.display = 'flex';
    var input = $('xhs-search-input');
    if (input) {
      input.value = '';
      setTimeout(function () { input.focus(); }, 30);
    }
    renderSearchResults('');
  }

  function closeXhsSearch() {
    var panel = $('xhs-search');
    if (panel) panel.style.display = 'none';
  }

  function handleXhsSearchInput(value) {
    renderSearchResults(value || '');
  }

  function searchNotes(query) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    return state.notes.filter(function (n) {
      var hay = [n.title, n.content, (n.author && n.author.name) || ''].concat(n.tags || []).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function renderSearchResults(query) {
    var body = $('xhs-search-body');
    if (!body) return;
    var q = query.trim();
    if (!q) {
      var hot = ['厦门散步', '咖啡店', '桌面日常', '山里的光', '画画记录'];
      body.innerHTML = '<div class="xhs-hot-title">大家都在搜</div><div class="xhs-hot-list">' +
        hot.map(function (t) { return '<button class="xhs-hot-chip" onclick="openXhsSearchTag(\'' + esc(t) + '\')">' + esc(t) + '</button>'; }).join('') +
        '</div>';
      return;
    }
    var results = searchNotes(q);
    if (!results.length) {
      body.innerHTML = '<div class="xhs-empty">没有找到和「' + esc(q) + '」相关的笔记。</div>';
      return;
    }
    body.innerHTML = results.map(function (n) {
      return '<div class="xhs-search-row" onclick="openXhsNoteFromSearch(\'' + n.id + '\')">' +
        '<div class="xhs-search-thumb">' + (n.images && n.images[0] ? '<img src="' + esc(n.images[0]) + '" alt="">' : '') + '</div>' +
        '<div class="xhs-search-row-main">' +
          '<div class="xhs-search-row-title">' + esc(n.title) + '</div>' +
          '<div class="xhs-search-row-meta">' + esc(n.author.name) + ' · ♥ ' + formatCount(n.likes) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openXhsSearchTag(tag) {
    var input = $('xhs-search-input');
    if (input) input.value = tag;
    renderSearchResults(tag);
  }

  function openXhsNoteFromSearch(id) {
    closeXhsSearch();
    openXhsNote(id);
  }

  function openXhsComposer() {
    draft = { images: [], title: '', content: '', tags: '' };
    var panel = $('xhs-composer');
    if (panel) panel.style.display = 'flex';
    renderComposer();
  }

  function closeXhsComposer() {
    var panel = $('xhs-composer');
    if (panel) panel.style.display = 'none';
    draft = { images: [], title: '', content: '', tags: '' };
  }

  function renderComposer() {
    var panel = $('xhs-composer');
    if (!panel) return;
    panel.innerHTML =
      '<div class="xhs-composer-head">' +
        '<button class="xhs-composer-cancel" onclick="closeXhsComposer()">取消</button>' +
        '<div class="xhs-composer-title">发布笔记</div>' +
        '<button class="xhs-composer-publish" id="xhs-publish-btn" onclick="publishXhsNote()">发布</button>' +
      '</div>' +
      '<div class="xhs-composer-scroll">' +
        '<div class="xhs-image-grid" id="xhs-image-grid"></div>' +
        '<div class="xhs-composer-note">最多 4 张，从本地相册选择；图片会压缩后保存到本地。</div>' +
        '<div class="xhs-field">' +
          '<input class="xhs-title-input" id="xhs-title-input" maxlength="30" placeholder="写一个标题" value="' + esc(draft.title) + '" oninput="updateXhsDraft(\'title\', this.value)">' +
          '<textarea class="xhs-content-input" id="xhs-content-input" maxlength="1000" placeholder="分享这一刻的想法..." oninput="updateXhsDraft(\'content\', this.value)">' + esc(draft.content) + '</textarea>' +
        '</div>' +
        '<input class="xhs-tags-input" id="xhs-tags-input" maxlength="80" placeholder="#话题 #日常（可留空）" value="' + esc(draft.tags) + '" oninput="updateXhsDraft(\'tags\', this.value)">' +
      '</div>';
    renderDraftImages();
  }

  function renderDraftImages() {
    var grid = $('xhs-image-grid');
    if (!grid) return;
    var html = draft.images.map(function (im, i) {
      return '<div class="xhs-image-cell"><img src="' + esc(im.src) + '" alt="">' +
        '<button class="xhs-image-remove" onclick="removeXhsDraftImage(' + i + ')" aria-label="移除">×</button></div>';
    }).join('');
    if (draft.images.length < MAX_IMAGES) {
      html += '<label class="xhs-image-add" for="xhs-image-input">+<span>添加图片</span></label>';
    }
    grid.innerHTML = html;
  }

  function updateXhsDraft(field, value) {
    draft[field] = value;
  }

  function removeXhsDraftImage(index) {
    draft.images.splice(index, 1);
    renderDraftImages();
  }

  function handleXhsImageInput(event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    var remaining = MAX_IMAGES - draft.images.length;
    if (remaining <= 0) {
      showXhsToast('最多只能选 4 张图片');
      return;
    }
    var picked = files.slice(0, remaining);
    if (files.length > remaining) showXhsToast('最多只能选 4 张，已取前 ' + remaining + ' 张');
    Promise.all(picked.map(compressImage)).then(function (items) {
      var valid = items.filter(Boolean);
      draft.images = draft.images.concat(valid);
      renderDraftImages();
      if (valid.length < picked.length) showXhsToast('有图片没能读取，换一张试试');
    });
  }

  function compressImage(file, maxSize) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var max = maxSize || 1080;
            var scale = Math.min(1, max / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve({ src: canvas.toDataURL('image/jpeg', 0.72), ratio: img.width / img.height });
          } catch (e) {
            resolve(null);
          }
        };
        img.onerror = function () { resolve(null); };
        img.src = reader.result;
      };
      reader.onerror = function () { resolve(null); };
      reader.readAsDataURL(file);
    });
  }

  function publishXhsNote() {
    var title = ($('xhs-title-input') ? $('xhs-title-input').value : draft.title).trim();
    var content = ($('xhs-content-input') ? $('xhs-content-input').value : draft.content).trim();
    var tagsRaw = ($('xhs-tags-input') ? $('xhs-tags-input').value : draft.tags).trim();
    if (!draft.images.length) {
      showXhsToast('至少选一张图片');
      return;
    }
    if (!title) {
      showXhsToast('写一个标题再发布');
      return;
    }
    var tags = tagsRaw.split(/[\s,，]+/).filter(Boolean).map(function (t) {
      return t.charAt(0) === '#' ? t : '#' + t;
    });
    var note = {
      id: 'xhs-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      title: title,
      content: content,
      tags: tags,
      images: draft.images.map(function (im) { return im.src; }),
      ratio: draft.images[0].ratio || 0.75,
      imageRatio: draft.images[0].ratio || 0.75,
      author: {
        name: state.profile.name || '我',
        handle: state.profile.handle || '@momo',
        avatar: state.profile.avatar || '',
        isMe: true
      },
      likes: 0,
      collects: 0,
      createdAt: Date.now(),
      nearby: false,
      comments: []
    };
    state.notes.unshift(note);
    if (!saveState()) {
      state.notes.shift();
      return;
    }
    closeXhsComposer();
    showXhsHome();
    renderFeed();
    openXhsNote(note.id);
    showXhsToast('已发布到本地');
  }

  // ---------------- 生成评论 / 删除笔记 ----------------
  var XHS_NETIZEN_NAMES = ['小满', '阿岚', '山茶', '一只小岛', '半糖去冰', '南风', '橘猫年糕', '阿柚', '晚风收信', '一颗青梅'];

  var XHS_NETIZEN_TEXTS = [
    '这张图的质感太好了，忍不住收藏。',
    '求问这是哪里，周末想去坐一下午。',
    '好喜欢这种安安静静的日常。',
    '同款桌面，看到键盘就觉得很亲切。',
    '光落在桌上的样子好温柔。',
    '这条我先收着，下次照着过一天。',
    '看得我也想放下手机了。',
    '氛围感拉满，具体又说不上来哪里好。'
  ];

  function getXhsContacts() {
    try {
      if (typeof window.getCharacters === 'function') {
        var live = window.getCharacters();
        if (Array.isArray(live)) {
          return live.filter(function (c) { return c && c.name; });
        }
      }
    } catch (e) {}
    try {
      var saved = JSON.parse(localStorage.getItem('momo_characters') || '[]');
      if (Array.isArray(saved)) return saved.filter(function (c) { return c && c.name; });
    } catch (e2) {}
    return [];
  }

  function openXhsCommentDrawer() {
    var note = getNote(currentNoteId);
    var page = $('page-xhs');
    if (!note || !page) return;
    var mask = $('xhs-comment-drawer');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'xhs-comment-drawer';
      mask.className = 'xhs-drawer-mask';
      mask.onclick = function (event) {
        if (event.target === mask) closeXhsCommentDrawer();
      };
      page.appendChild(mask);
    }
    xhsRoleOpen = false;
    xhsGeneratingId = '';
    mask.innerHTML =
      '<div class="xhs-drawer">' +
        '<div class="xhs-drawer-grab"></div>' +
        '<div class="xhs-drawer-head">' +
          '<div class="xhs-drawer-head-title">生成评论</div>' +
          '<button class="xhs-drawer-close" onclick="closeXhsCommentDrawer()" aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="xhs-drawer-body">' +
          '<div class="xhs-drawer-section">' +
            '<button class="xhs-drawer-section-head" onclick="toggleXhsRoleSection()">' +
              '<span class="xhs-drawer-section-title">角色评论</span>' +
              '<span class="xhs-drawer-section-note">从通讯录挑一位</span>' +
              '<span class="xhs-drawer-chevron" id="xhs-role-chevron">展开</span>' +
            '</button>' +
            '<div class="xhs-role-list" id="xhs-role-list"></div>' +
          '</div>' +
          '<div class="xhs-drawer-section">' +
            '<div class="xhs-drawer-section-head static"><span class="xhs-drawer-section-title">网友点赞和评论</span></div>' +
            '<div class="xhs-netizen-box">' +
              '<div class="xhs-netizen-copy">随机增加这条笔记的点赞和收藏，并追加 2 条网友评论。</div>' +
              '<button class="xhs-netizen-btn" onclick="generateXhsNetizen()">生成一波网友互动</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    mask.style.display = 'flex';
    renderXhsRoleList();
  }

  function closeXhsCommentDrawer() {
    var mask = $('xhs-comment-drawer');
    if (mask) mask.style.display = 'none';
    xhsGeneratingId = '';
  }

  function renderXhsRoleList() {
    var list = $('xhs-role-list');
    if (!list) return;
    var note = getNote(currentNoteId);
    if (!note) { list.innerHTML = ''; return; }
    xhsRoleContacts = getXhsContacts();
    if (!xhsRoleContacts.length) {
      list.innerHTML = '<div class="xhs-drawer-empty">通讯录还没有好友。先去通讯录添加角色卡，再回来生成评论。</div>';
      return;
    }
    list.innerHTML = xhsRoleContacts.map(function (c, index) {
      var done = (note.comments || []).some(function (item) {
        return (item.characterId && item.characterId === c.id) || (!item.characterId && item.name === c.name);
      });
      var busy = xhsGeneratingId && xhsGeneratingId === c.id;
      var action = busy ? '生成中…' : (done ? '已评论' : '生成');
      return '<button class="xhs-role-row ' + (done || busy ? 'done' : '') + '" ' +
        (done || busy ? 'disabled' : '') +
        ' onclick="generateXhsRoleComment(' + index + ')">' +
        avatarHtml({ name: c.name, avatar: c.avatar || '' }) +
        '<span class="xhs-role-info">' +
          '<span class="xhs-role-name">' + esc(c.name) + '</span>' +
          '<span class="xhs-role-tag">' + esc(c.tag || c.intro || '通讯录好友') + '</span>' +
        '</span>' +
        '<span class="xhs-role-action">' + action + '</span>' +
      '</button>';
    }).join('');
  }

  function toggleXhsRoleSection() {
    xhsRoleOpen = !xhsRoleOpen;
    var list = $('xhs-role-list');
    var chevron = $('xhs-role-chevron');
    if (list) list.classList.toggle('open', xhsRoleOpen);
    if (chevron) chevron.textContent = xhsRoleOpen ? '收起' : '展开';
    if (xhsRoleOpen) renderXhsRoleList();
  }

  function requestXhsRoleComment(char, note) {
    return new Promise(function (resolve, reject) {
      var app = window.appData || {};
      var base = String(app.apiBase || localStorage.getItem('momo_api_base') || '').trim().replace(/\/+$/, '');
      var key = String(app.apiKey || localStorage.getItem('momo_api_key') || '').trim();
      var model = String(app.model || localStorage.getItem('momo_api_model') || 'deepseek-chat').trim();
      if (!key) { reject(new Error('NO_KEY')); return; }
      if (!base) base = 'https://api.deepseek.com/v1';
      var url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
      var persona = (char.prompt || char.intro || char.tag || '').slice(0, 1200);
      var directive = (char.directives || '').slice(0, 500);
      var system = '你正在扮演' + (char.name || '一个角色') + '。' +
        (char.tag ? '身份：' + char.tag + '。' : '') +
        (persona ? '角色设定：' + persona + '。' : '') +
        (directive ? '补充要求：' + directive + '。' : '') +
        '你刷到了一条小紫书笔记，请以角色本人的口吻写一条自然、口语化、有细节的短评论，不超过 60 个字。' +
        '只输出评论正文，不要加引号、不要解释、不要动作描写、不要自称 AI。';
      var tags = (note.tags || []).join(' ');
      var user = '笔记标题：' + (note.title || '') + '\n' +
        '笔记正文：' + String(note.content || '').slice(0, 600) + '\n' +
        '作者：' + ((note.author && note.author.name) || '') + '\n' +
        (tags ? '话题：' + tags : '');
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          max_tokens: 120,
          temperature: 0.85
        })
      }).then(function (resp) {
        if (!resp.ok) {
          return resp.text().then(function (body) {
            throw new Error('HTTP ' + resp.status + (body ? ': ' + body.slice(0, 80) : ''));
          });
        }
        return resp.json();
      }).then(function (data) {
        var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!content) throw new Error('EMPTY');
        var text = String(content).replace(/^\s*["“”']+|["“”']\s*$/g, '').replace(/\s+/g, ' ').trim();
        if (!text) throw new Error('EMPTY');
        resolve(text.slice(0, 120));
      }).catch(reject);
    });
  }

  function generateXhsRoleComment(index) {
    var note = getNote(currentNoteId);
    var char = xhsRoleContacts[index];
    if (!note || !char || xhsGeneratingId) return;
    var done = (note.comments || []).some(function (item) {
      return (item.characterId && item.characterId === char.id) || (!item.characterId && item.name === char.name);
    });
    if (done) { showXhsToast('这位好友已经评论过了'); return; }
    var app = window.appData || {};
    var key = String(app.apiKey || localStorage.getItem('momo_api_key') || '').trim();
    if (!key) {
      showXhsToast('先到设置里填 API Key，角色才能生成评论');
      return;
    }
    xhsGeneratingId = char.id || char.name;
    renderXhsRoleList();
    requestXhsRoleComment(char, note).then(function (text) {
      var noteNow = getNote(currentNoteId);
      if (!noteNow) { xhsGeneratingId = ''; return; }
      noteNow.comments = noteNow.comments || [];
      noteNow.comments.push({
        name: char.name,
        avatar: char.avatar || '',
        text: text,
        time: '刚刚',
        characterId: char.id || ''
      });
      if (!saveState()) {
        noteNow.comments.pop();
        xhsGeneratingId = '';
        renderXhsRoleList();
        return;
      }
      xhsGeneratingId = '';
      closeXhsCommentDrawer();
      refreshXhsComments(noteNow);
      showXhsToast('已生成 ' + char.name + ' 的评论');
    }).catch(function (err) {
      xhsGeneratingId = '';
      if (err && err.message === 'NO_KEY') {
        showXhsToast('先到设置里填 API Key，角色才能生成评论');
      } else {
        showXhsToast('生成失败，检查设置里的 API 配置');
      }
      renderXhsRoleList();
    });
  }

  function generateXhsNetizen() {
    var note = getNote(currentNoteId);
    if (!note) return;
    var beforeLikes = Number(note.likes) || 0;
    var beforeCollects = Number(note.collects) || 0;
    var beforeComments = (note.comments || []).length;
    var names = XHS_NETIZEN_NAMES.filter(function (name) {
      return !(note.comments || []).some(function (c) { return c.name === name; });
    });
    if (!names.length) names = ['路过的网友'];
    var texts = XHS_NETIZEN_TEXTS.slice().sort(function () { return Math.random() - 0.5; });
    note.likes = beforeLikes + 4 + Math.floor(Math.random() * 9);
    note.collects = beforeCollects + 1 + Math.floor(Math.random() * 3);
    note.comments = note.comments || [];
    for (var i = 0; i < 2; i++) {
      note.comments.push({
        name: names[i % names.length],
        text: texts[i % texts.length],
        time: '刚刚'
      });
    }
    if (!saveState()) {
      note.likes = beforeLikes;
      note.collects = beforeCollects;
      note.comments.length = beforeComments;
      return;
    }
    closeXhsCommentDrawer();
    refreshXhsComments(note);
    var likeCount = $('xhs-like-count');
    var collectCount = $('xhs-collect-count');
    if (likeCount) likeCount.textContent = formatCount(note.likes);
    if (collectCount) collectCount.textContent = formatCount(note.collects);
    showXhsToast('网友点赞和评论已生成');
  }

  function ensureXhsNoteMenu() {
    var page = $('page-xhs');
    if (!page) return null;
    var mask = $('xhs-note-menu');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'xhs-note-menu';
      mask.className = 'xhs-sheet-mask';
      mask.onclick = function (event) {
        if (event.target === mask) closeXhsNoteMenu();
      };
      page.appendChild(mask);
    }
    return mask;
  }

  function openXhsNoteMenu() {
    var note = getNote(currentNoteId);
    if (!note || !note.author || !note.author.isMe) return;
    var mask = ensureXhsNoteMenu();
    if (!mask) return;
    mask.innerHTML =
      '<div class="xhs-sheet">' +
        '<div class="xhs-sheet-title">删除后，这条笔记和它下面的评论会从这台手机上消失，不能恢复。</div>' +
        '<button class="xhs-sheet-btn danger" onclick="deleteXhsNote()">删除笔记</button>' +
        '<button class="xhs-sheet-btn plain" onclick="closeXhsNoteMenu()">取消</button>' +
      '</div>';
    mask.style.display = 'flex';
  }

  function closeXhsNoteMenu() {
    var mask = $('xhs-note-menu');
    if (mask) mask.style.display = 'none';
  }

  function deleteXhsNote() {
    var note = getNote(currentNoteId);
    if (!note) return;
    var id = note.id;
    state.notes = state.notes.filter(function (n) { return n.id !== id; });
    delete state.liked[id];
    delete state.collected[id];
    saveState();
    closeXhsNoteMenu();
    closeXhsNote();
    renderFeed();
    renderProfile();
    showXhsToast('笔记已删除');
  }

  function showXhsToast(message) {
    var page = $('page-xhs');
    if (!page) return;
    var old = page.querySelector('.xhs-toast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.className = 'xhs-toast';
    toast.textContent = message;
    page.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 220);
    }, 2200);
  }

  function renderXhsApp() {
    state = loadState();
    activeTab = 'discover';
    profileTab = 'notes';
    currentNoteId = null;
    closeXhsCommentDrawer();
    closeXhsNoteMenu();
    closeXhsProfileEditor();
    var page = $('page-xhs');
    if (!page) return;
    var home = $('xhs-home');
    var profile = $('xhs-profile');
    var noteView = $('xhs-note-view');
    var search = $('xhs-search');
    var composer = $('xhs-composer');
    if (home) home.style.display = 'flex';
    if (profile) profile.style.display = 'none';
    if (noteView) noteView.style.display = 'none';
    if (search) search.style.display = 'none';
    if (composer) composer.style.display = 'none';
    var tabs = document.querySelectorAll('#xhs-tabs .xhs-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === 'discover');
    var navHome = $('xhs-nav-home');
    var navMe = $('xhs-nav-me');
    if (navHome) navHome.classList.add('active');
    if (navMe) navMe.classList.remove('active');
    renderFeed();
  }

  window.renderXhsApp = renderXhsApp;
  window.exitXhsApp = exitXhsApp;
  window.setXhsTab = setXhsTab;
  window.showXhsHome = showXhsHome;
  window.showXhsProfile = showXhsProfile;
  window.setXhsProfileTab = setXhsProfileTab;
  window.openXhsProfileEditor = openXhsProfileEditor;
  window.closeXhsProfileEditor = closeXhsProfileEditor;
  window.pickXhsProfileImage = pickXhsProfileImage;
  window.handleXhsProfileImageInput = handleXhsProfileImageInput;
  window.saveXhsProfileEditor = saveXhsProfileEditor;
  window.openXhsNote = openXhsNote;
  window.closeXhsNote = closeXhsNote;
  window.toggleXhsLike = toggleXhsLike;
  window.toggleXhsCollect = toggleXhsCollect;
  window.toggleXhsFollow = toggleXhsFollow;
  window.sendXhsComment = sendXhsComment;
  window.focusXhsComment = focusXhsComment;
  window.openXhsCommentDrawer = openXhsCommentDrawer;
  window.closeXhsCommentDrawer = closeXhsCommentDrawer;
  window.toggleXhsRoleSection = toggleXhsRoleSection;
  window.generateXhsRoleComment = generateXhsRoleComment;
  window.generateXhsNetizen = generateXhsNetizen;
  window.openXhsNoteMenu = openXhsNoteMenu;
  window.closeXhsNoteMenu = closeXhsNoteMenu;
  window.deleteXhsNote = deleteXhsNote;
  window.onXhsGalleryScroll = onXhsGalleryScroll;
  window.scrollXhsGallery = scrollXhsGallery;
  window.openXhsSearch = openXhsSearch;
  window.closeXhsSearch = closeXhsSearch;
  window.handleXhsSearchInput = handleXhsSearchInput;
  window.openXhsSearchTag = openXhsSearchTag;
  window.openXhsNoteFromSearch = openXhsNoteFromSearch;
  window.openXhsComposer = openXhsComposer;
  window.closeXhsComposer = closeXhsComposer;
  window.handleXhsImageInput = handleXhsImageInput;
  window.updateXhsDraft = updateXhsDraft;
  window.removeXhsDraftImage = removeXhsDraftImage;
  window.publishXhsNote = publishXhsNote;
})();
