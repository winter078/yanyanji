/* =========================================================
   长椅 App（fm-*） · 公共广场：求助 / 问答 / 分享
   帖子来源：① 角色（读聊天记录 + 人设，AI 生成）
             ② NPC（罐头池，零 token）
             ③ 我自己（手写）
   评论：手动选 1-3 人来应，NPC 走罐头，角色走 AI
   ========================================================= */
(function () {
  var K = {
    posts: 'momo_forum_posts_v1',
    state: 'momo_forum_state_v1',
    follow: 'momo_forum_follow_v1',
    profile: 'momo_forum_profile_v1'
  };

  var TYPE_LABEL = { ask: '求助', qa: '问答', share: '分享' };
  var TYPE_HINT = {
    ask: '想把一件事说清楚，等人给个办法',
    qa: '抛一个问题，等人回答',
    share: '只是想说一声，顺手分享'
  };

  // ---------- 基础工具 ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }
  function uid(p) { return (p || 'fm') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmTimeAgo(ms) {
    var now = Date.now();
    var d = now - ms;
    if (d < 0) d = 0;
    if (d < 60 * 1000) return '刚刚';
    if (d < 60 * 60 * 1000) return Math.floor(d / 60000) + ' 分钟前';
    var dt = new Date(ms);
    var today = new Date();
    var sameDay = dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate();
    if (sameDay) {
      if (d < 60 * 60 * 1000 * 6) return Math.floor(d / 3600000) + ' 小时前';
      return '今天 ' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
    }
    var yest = new Date(today.getTime() - 86400000);
    var isYest = dt.getFullYear() === yest.getFullYear() && dt.getMonth() === yest.getMonth() && dt.getDate() === yest.getDate();
    if (isYest) return '昨天 ' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
    if (d < 86400000 * 7) return Math.floor(d / 86400000) + ' 天前';
    return (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
  }

  // ---------- NPC：五个固定邻居 ----------
  var NPCS = [
    {
      id: 'npc-aunt', name: '楼下的阿姨', short: '阿',
      c1: '#D98C6A', c2: '#B4633F',
      sig: '住三楼，什么都管一点',
      tone: '热心、爱操心，说话带“哎哟”“你听我说”，习惯直接给建议，偶尔夹一句养生经验。'
    },
    {
      id: 'npc-geek', name: '万能老哥', short: '万',
      c1: '#5B8FB9', c2: '#2F5F85',
      sig: '什么都会一点，什么都说得出步骤',
      tone: '冷静、话不多但有条理，喜欢拆成 1、2、3 步，偶尔一句凡尔赛。'
    },
    {
      id: 'npc-joke', name: '冷笑话同事', short: '冷',
      c1: '#7C8CB8', c2: '#4E5C86',
      sig: '开口就是一句冷的',
      tone: '一句话自带转折，常把正经话题岔开，情绪价值为负但人不坏。'
    },
    {
      id: 'npc-selfie', name: '自拍学妹', short: '自',
      c1: '#C77FA0', c2: '#965B79',
      sig: '大二，自拍八十张选一张',
      tone: '元气、爱用“啊啊啊”“救命”，关注穿搭吃喝和考试，问题多。'
    },
    {
      id: 'npc-lurk', name: '潜水员', short: '潜',
      c1: '#6E8C7A', c2: '#476153',
      sig: '常年不发言，一说话就挺准',
      tone: '极简，通常一句话，偶尔只有两三个字，但常常说到点上。'
    }
  ];

  function npcById(id) {
    for (var i = 0; i < NPCS.length; i++) if (NPCS[i].id === id) return NPCS[i];
    return null;
  }

  // ---------- NPC 罐头帖（零 token，负责把广场填满） ----------
  var NPC_POSTS = {
    'npc-aunt': [
      { type: 'share', title: '', body: '楼下水果店换老板了，橘子还是十块三斤，比超市实在。我买了五斤，谁来拿点走。', tags: ['楼下的事', '吃'] },
      { type: 'ask', title: '水压是不是又不行了', body: '哎哟，有没有人知道咱这栋楼的水压怎么了？我家热水器今晚一直打不着火，冻得我够呛。', tags: ['楼下的事'] },
      { type: 'qa', title: '', body: '想问问，膝盖上下楼梯疼，是该补钙还是该少爬楼？我这爬了二十年了。', tags: ['身体'] },
      { type: 'share', title: '', body: '腌了一罐糖蒜，谁要拿点回去尝尝，别客气。放我门口，自取。', tags: ['吃'] },
      { type: 'ask', title: '', body: '物业这几天几点下班？我要去交停车费，怕白跑一趟。有人这两天去过吗。', tags: ['楼下的事'] },
      { type: 'share', title: '', body: '早上六点楼下有人在练嗓子，我本来想开窗骂两句，听了半小时，居然还挺好听。', tags: ['楼下的事'] }
    ],
    'npc-geek': [
      { type: 'qa', title: '', body: '笔记本风扇一开机就狂转，是不是灰尘的事？有没有不拆机的办法。', tags: ['数码'] },
      { type: 'share', title: '', body: '充电线接头缠两圈胶布，能用三年。别问我怎么知道的。', tags: ['生活技巧'] },
      { type: 'ask', title: '旧路由器能不能当 AP', body: '有台旧路由器闲着，想给阳台补个信号。有人试过吗，桥接会不会很麻烦。', tags: ['数码'] },
      { type: 'qa', title: '', body: '煮咖啡的水温到底要不要 92 度？我一直用开水，也没喝出什么区别。', tags: ['吃'] },
      { type: 'share', title: '', body: '整理硬盘翻到 2019 年的照片，那会儿我头发还挺多。', tags: ['日常'] },
      { type: 'ask', title: '', body: '紧急：小号螺丝刀找不到了，有没有别的东西能代替，我要拆个键盘。', tags: ['数码'] }
    ],
    'npc-joke': [
      { type: 'share', title: '', body: '今天电梯里有人问我住几楼，我说我住心里。他按了 18 层。', tags: ['废话'] },
      { type: 'qa', title: '', body: '为什么周一总比周日短？因为周日你在过，周一你在熬。', tags: ['废话'] },
      { type: 'share', title: '', body: '办公室的打印机又卡纸了。它大概也不想上班。', tags: ['上班'] },
      { type: 'ask', title: '', body: '有没有人不喝咖啡也能活到下午三点，求方法，很急。', tags: ['上班'] },
      { type: 'share', title: '', body: '体检报告出来了，医生说我除了想太多，没什么毛病。', tags: ['身体'] },
      { type: 'qa', title: '', body: '问：为什么减肥第一天最饿？答：因为你在想它。', tags: ['废话'] }
    ],
    'npc-selfie': [
      { type: 'ask', title: '这条裙子配什么鞋', body: '救命！米色连衣裙配什么鞋啊，我只有一双白球鞋和一双黑玛丽珍，明天就要穿。', tags: ['穿搭'] },
      { type: 'share', title: '', body: '食堂三楼的糖醋里脊回来了！！排队二十分钟我也认了，值。', tags: ['吃'] },
      { type: 'qa', title: '', body: '有人知道学校后门那家照相馆还能不能拍证件照吗，我上周去门关着。', tags: ['学校'] },
      { type: 'ask', title: '', body: '啊啊啊明天面试，穿卫衣是不是太随便了，我好慌，在线等。', tags: ['学校'] },
      { type: 'share', title: '', body: '今天在图书馆看到有人在书里夹了一片银杏叶，好浪漫，我假装没看见。', tags: ['学校'] },
      { type: 'qa', title: '', body: '想问问大家，一个人去看电影会不会很奇怪？我票都买了。', tags: ['日常'] }
    ],
    'npc-lurk': [
      { type: 'qa', title: '', body: '这个公园几点关门？', tags: ['楼下的事'] },
      { type: 'share', title: '', body: '楼下那只橘猫今天允许我摸了一下。', tags: ['日常'] },
      { type: 'ask', title: '', body: '附近哪里能修伞，骨架断了，不舍得扔。', tags: ['生活技巧'] },
      { type: 'share', title: '', body: '今晚的云很像一条鱼。', tags: ['日常'] },
      { type: 'qa', title: '', body: '想问，你们失眠的时候都在干什么。', tags: ['身体'] },
      { type: 'share', title: '', body: '路口那家面馆换了招牌，味道没换。', tags: ['吃'] }
    ]
  };

  // ---------- NPC 罐头回复（按帖子类型分池，贴题又不花钱） ----------
  var NPC_REPLIES = {
    ask: [
      '这事我遇过，先别急，一步一步来。',
      '先试最笨的办法，通常最快。',
      '要不问问旁边的人，别自己硬扛。',
      '我以前也栽在这上面，慢一点就好了。',
      '先放一晚上，明早再看，通常会清楚不少。',
      '别慌，这种小事最后都解决得了。',
      '有个笨办法：先做一半，剩下的明天做。',
      '我也在等答案，蹲一个。'
    ],
    qa: [
      '我感觉是习惯问题，改起来挺难。',
      '这个真看人，我这边正好相反。',
      '试过一次，短期有用，长期没用。',
      '我猜你说得对，但我没证据。',
      '同问，我也想知道。',
      '按我的经验，八成是这样。',
      '得看具体情况，不好一概而论。',
      '我不懂，但我大受震撼。'
    ],
    share: [
      '看饿了。',
      '这个好，记下了。',
      '笑死，你这也太真实。',
      '好会过日子。',
      '下次带我一个。',
      '隔着屏幕都闻到了。',
      '我也想要这种生活。',
      '这条我截图了。'
    ]
  };

  // 潜水员专属的短回复
  var LURK_LINES = ['。', '有道理。', '记下了。', '蹲。', '我也一样。', '这个好。'];

  // ---------- 存储 ----------
  function loadPosts() {
    var v = loadJSON(K.posts, []);
    if (!Array.isArray(v)) return [];
    return v.filter(function (p) { return p && p.id && p.body; }).map(function (p) {
      return {
        id: p.id,
        type: TYPE_LABEL[p.type] ? p.type : 'share',
        authorKind: p.authorKind || 'npc',
        authorId: p.authorId || '',
        authorName: p.authorName || '有人',
        authorAvatar: p.authorAvatar || '',
        title: p.title || '',
        body: p.body || '',
        tags: Array.isArray(p.tags) ? p.tags.filter(Boolean).slice(0, 3) : [],
        createdAt: Number(p.createdAt) || Date.now(),
        solved: !!p.solved,
        bestReplyId: p.bestReplyId || '',
        replies: Array.isArray(p.replies) ? p.replies.filter(function (r) { return r && r.body; }) : []
      };
    });
  }
  function savePosts(list) { saveJSON(K.posts, list.slice(0, 300)); }

  function loadState() {
    var s = loadJSON(K.state, {});
    if (!s || typeof s !== 'object') s = {};
    return {
      lastSeededAt: Number(s.lastSeededAt) || 0,
      lastCharSeedAt: Number(s.lastCharSeedAt) || 0,
      lastNpcAt: Number(s.lastNpcAt) || 0,
      autoLevel: (s.autoLevel === 'quiet' || s.autoLevel === 'lively') ? s.autoLevel : 'normal',
      seenAt: Number(s.seenAt) || 0,
      greetedAt: Number(s.greetedAt) || 0
    };
  }
  function saveState(st) { saveJSON(K.state, st); }

  function loadFollow() {
    var v = loadJSON(K.follow, []);
    return Array.isArray(v) ? v : [];
  }
  function saveFollow(v) { saveJSON(K.follow, v); }
  function isFollowed(charId) {
    var f = loadFollow();
    for (var i = 0; i < f.length; i++) if (f[i] === charId) return true;
    return false;
  }

  // ---------- 运行时状态 ----------
  var fm = {
    tab: 'square',          // square / follow / mine
    filter: 'all',          // all / ask / qa / share
    openId: '',
    picked: {},             // 详情里选中的回复者 { kind:id : true }
    busy: false,
    seeding: false
  };

  function meName() {
    try {
      var a = window.appData || {};
      return (a.userNickname || (a.hero && a.hero.userName) || '我');
    } catch (e) { return '我'; }
  }
  function meAvatar() {
    try {
      var a = window.appData || {};
      return a.userAvatar || a.heroAvatar || '';
    } catch (e) { return ''; }
  }

  function charList() {
    try {
      if (typeof window.getCharacters === 'function') return window.getCharacters() || [];
    } catch (e) {}
    return [];
  }
  function charById(id) {
    var list = charList();
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }

  // ---------- 我的名片 ----------
  var _profCache = null;
  function loadProfile(force) {
    if (_profCache && !force) return _profCache;
    var p = loadJSON(K.profile, null);
    if (!p || typeof p !== 'object') p = {};
    var nm = String(p.name || '').trim() || meName();
    var handle = String(p.handle || '').trim();
    if (!handle) {
      handle = 'me_' + Math.random().toString(36).slice(2, 6);
      p.handle = handle;
      saveJSON(K.profile, p);
    }
    _profCache = {
      name: nm,
      handle: handle,
      bio: String(p.bio || ''),
      avatar: p.avatar || meAvatar(),
      cover: p.cover || ''
    };
    return _profCache;
  }
  function saveProfile(p) {
    _profCache = null;
    saveJSON(K.profile, {
      name: String(p.name || '').slice(0, 16),
      handle: String(p.handle || '').replace(/^@/, '').slice(0, 16),
      bio: String(p.bio || '').slice(0, 30),
      avatar: p.avatar || '',
      cover: p.cover || ''
    });
    loadProfile(true);
  }
  // 帖子里显示的名字：我的一律走名片名，改名字旧帖也跟着变
  function dispName(kind, name) {
    if (kind === 'me') return loadProfile().name;
    return name || '有人';
  }

  // 头像：角色有图就用图，没有就首字渐变圆；NPC 一律渐变圆 + 单字
  function fmAvaHTML(kind, id, name, avatar, size) {
    var cls = 'fm-ava' + (size === 'lg' ? ' fm-ava-lg' : '');
    if (kind === 'npc') {
      var npc = npcById(id);
      var c1 = npc ? npc.c1 : '#6B7280';
      var c2 = npc ? npc.c2 : '#374151';
      var ch = npc ? npc.short : '?';
      return '<div class="' + cls + '" style="background:linear-gradient(135deg,' + c1 + ',' + c2 + ')">' + esc(ch) + '</div>';
    }
    if (kind === 'me') {
      if (avatar) return '<img class="' + cls + '" src="' + esc(avatar) + '" alt="" onerror="this.style.display=\'none\'">';
      return '<div class="' + cls + '" style="background:linear-gradient(135deg,#5B6675,#3C4552)">' + esc(String(name || '我').slice(0, 1)) + '</div>';
    }
    if (avatar) return '<img class="' + cls + '" src="' + esc(avatar) + '" alt="" onerror="this.style.display=\'none\'">';
    return '<div class="' + cls + '" style="background:linear-gradient(135deg,#6C7A8C,#404B58)">' + esc(String(name || '?').slice(0, 1)) + '</div>';
  }

  function typeBadge(t) {
    if (t === 'ask') return '<span class="fm-badge ask">求助</span>';
    if (t === 'qa') return '<span class="fm-badge qa">问答</span>';
    return '<span class="fm-badge share">分享</span>';
  }

  // ---------- 列表 ----------
  function postsForTab() {
    var all = loadPosts().slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var st = loadState();
    if (fm.tab === 'mine') {
      all = all.filter(function (p) {
        if (p.authorKind === 'me') return true;
        return (p.replies || []).some(function (r) { return r.kind === 'me'; });
      });
    } else if (fm.tab === 'follow') {
      all = all.filter(function (p) {
        if (p.authorKind === 'npc') return true;
        return p.authorKind === 'char' && isFollowed(p.authorId);
      });
    }
    if (fm.filter !== 'all') all = all.filter(function (p) { return p.type === fm.filter; });
    return all.slice(0, 80);
  }

  function renderList() {
    var st = loadState();
    var posts = postsForTab();
    var box = document.getElementById('fm-list');
    if (!box) return;

    if (!posts.length) {
      var emptyMsg = fm.tab === 'mine'
        ? '你还没在这里说过话。<br>右下角的笔可以自己发一条。'
        : (fm.tab === 'follow'
          ? '广场上还没有你关注的人。<br>去「广场」点开一个帖子，在里面关注 TA。'
          : '长椅还空着。<br>点右下角让某个角色先坐过来。');
      box.innerHTML = '<div class="fm-empty">' + emptyMsg + '</div>';
      return;
    }

    var html = '';
    posts.forEach(function (p) {
      var isNew = p.createdAt > st.seenAt;
      var replyCount = (p.replies || []).length;
      var lastReply = replyCount ? p.replies[replyCount - 1] : null;
      html += '<div class="fm-post' + (isNew ? ' is-new' : '') + '" onclick="fmOpenPost(\'' + p.id + '\')">';
      html += '<div class="fm-post-head">';
      html += fmAvaHTML(p.authorKind, p.authorId, p.authorName, p.authorAvatar);
      html += '<div class="fm-post-who"><div class="fm-post-name">' + esc(dispName(p.authorKind, p.authorName)) + '</div>';
      html += '<div class="fm-post-sig">' + fmTimeAgo(p.createdAt) + '</div></div>';
      html += typeBadge(p.type);
      html += '</div>';
      if (p.title) html += '<div class="fm-post-title">' + esc(p.title) + '</div>';
      html += '<div class="fm-post-body">' + esc(p.body) + '</div>';
      if ((p.tags || []).length) {
        html += '<div class="fm-tags">' + p.tags.map(function (t) { return '<span class="fm-tag">#' + esc(t) + '</span>'; }).join('') + '</div>';
      }
      html += '<div class="fm-post-foot">';
      html += '<span>' + (replyCount ? ('💬 ' + replyCount + ' 回复') : '还没有人回') + '</span>';
      if (p.bestReplyId) html += '<span class="fm-pill gold">有最佳回答</span>';
      if (p.type === 'ask' && p.solved) html += '<span class="fm-pill green">已解决</span>';
      html += '</div>';
      if (lastReply) {
        html += '<div class="fm-last-reply"><b>' + esc(dispName(lastReply.kind, lastReply.authorName)) + '</b>：' + esc(String(lastReply.body).slice(0, 46)) + '</div>';
      }
      html += '</div>';
    });
    box.innerHTML = html;
  }

  function renderChips() {
    var bar = document.getElementById('fm-chips');
    if (!bar) return;
    if (fm.tab === 'mine') { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    var items = [['all', '全部'], ['ask', '求助'], ['qa', '问答'], ['share', '分享']];
    bar.innerHTML = items.map(function (it) {
      return '<div class="fm-chip' + (fm.filter === it[0] ? ' on' : '') + '" onclick="fmSetFilter(\'' + it[0] + '\')">' + it[1] + '</div>';
    }).join('');
  }

  function renderTabs() {
    var tabs = [['square', '广场'], ['follow', '关注'], ['mine', '我']];
    ['square', 'follow', 'mine'].forEach(function (t) {
      var el = document.getElementById('fm-tab-' + t);
      if (el) el.className = 'fm-tab' + (fm.tab === t ? ' on' : '');
    });
    var st = loadState();
    var unseen = loadPosts().filter(function (p) { return p.createdAt > st.seenAt; }).length;
    var dot = document.getElementById('fm-tab-dot');
    if (dot) {
      if (unseen > 0 && fm.tab !== 'square') { dot.style.display = 'block'; dot.innerText = unseen > 9 ? '9+' : unseen; }
      else dot.style.display = 'none';
    }
  }

  function renderMissed() {
    var st = loadState();
    var el = document.getElementById('fm-missed');
    if (!el) return;
    if (fm.tab === 'mine') { el.style.display = 'none'; return; }
    var unseen = loadPosts().filter(function (p) { return p.createdAt > st.seenAt; }).length;
    if (unseen > 0) {
      el.style.display = 'block';
      el.innerHTML = '你不在的时候，长椅上多了 <b>' + unseen + '</b> 条。';
    } else {
      el.style.display = 'none';
    }
  }

  function fmMarkSeen() {
    var st = loadState();
    var newest = 0;
    loadPosts().forEach(function (p) { if (p.createdAt > newest) newest = p.createdAt; });
    if (newest > st.seenAt) { st.seenAt = newest; saveState(st); }
    renderMissed();
    renderTabs();
  }

  function fmSwitchTab(t) {
    fm.tab = t;
    fm.filter = 'all';
    if (t === 'square') setTimeout(fmMarkSeen, 320);
    renderForumApp();
    var body = document.getElementById('fm-body');
    if (body) body.scrollTop = 0;
  }

  function fmSetFilter(f) {
    fm.filter = f;
    renderChips();
    renderList();
  }

  // ---------- 我的名片（独立版式，跟广场流不一套） ----------
  function renderMeCard() {
    var el = document.getElementById('fm-me');
    if (!el) return;
    var p = loadProfile();
    var posts = loadPosts();
    var mine = posts.filter(function (x) { return x.authorKind === 'me'; });
    var got = 0, myRep = 0;
    posts.forEach(function (x) {
      if (x.authorKind === 'me') got += (x.replies || []).length;
      (x.replies || []).forEach(function (r) { if (r.kind === 'me') myRep++; });
    });

    var html = '<div class="fmp-card">';
    html += '<div class="fmp-cover" style="background-image:url(&quot;' + (p.cover || 'assets/forum-cover.jpg') + '&quot;)">';
    html += '<div class="fmp-cover-fade"></div>';
    html += '</div>';
    html += '<div class="fmp-ava-wrap">';
    if (p.avatar) html += '<img class="fmp-ava" src="' + esc(p.avatar) + '" alt="" onerror="this.style.display=\'none\'">';
    else html += '<div class="fmp-ava fmp-ava-txt">' + esc(String(p.name).slice(0, 1)) + '</div>';
    html += '</div>';
    html += '<div class="fmp-name">' + esc(p.name) + '</div>';
    html += '<div class="fmp-handle">@' + esc(p.handle) + '</div>';
    html += '<div class="fmp-bio">' + (p.bio ? '“' + esc(p.bio) + '”' : '<span class="fmp-bio-empty">还没写签名</span>') + '</div>';
    html += '<div class="fmp-tags">';
    html += mine.length >= 5 ? '<span class="fmp-tag-on">在这儿坐了一段时间</span>' : '<span class="fmp-tag">刚坐下</span>';
    html += '<span class="fmp-tag">' + (loadFollow().length ? '关注了 ' + loadFollow().length + ' 个人' : '还没关注谁') + '</span>';
    html += '</div>';
    html += '<div class="fmp-actions">';
    html += '<button class="fmp-edit" onclick="fmOpenProfileEdit()">✎ 修改资料</button>';
    html += '<button class="fmp-share" onclick="fmOpenCompose(\'me\')">说一句</button>';
    html += '</div>';
    html += '<div class="fmp-stats">';
    html += '<div class="fmp-stat"><b>' + mine.length + '</b><span>帖子</span></div>';
    html += '<div class="fmp-stat"><b>' + got + '</b><span>收到的回应</span></div>';
    html += '<div class="fmp-stat"><b>' + myRep + '</b><span>我回应过</span></div>';
    html += '<div class="fmp-stat"><b>' + loadFollow().length + '</b><span>关注</span></div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="fmp-list-head">我说过的话</div>';
    if (!mine.length) {
      html += '<div class="fmp-empty">你还没在这里说过话。<br><span>点上面的「说一句」，或者去广场看看别人在聊什么。</span></div>';
    } else {
      mine.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 20).forEach(function (x) {
        var rc = (x.replies || []).length;
        html += '<div class="fmp-row" onclick="fmOpenPost(\'' + x.id + '\')">';
        html += '<div class="fmp-row-body">' + esc(String(x.title || x.body).slice(0, 110)) + '</div>';
        html += '<div class="fmp-row-foot">';
        html += '<span class="fmp-row-type ' + x.type + '">' + TYPE_LABEL[x.type] + '</span>';
        html += '<span>' + fmTimeAgo(x.createdAt) + '</span>';
        html += '<span>💬 ' + rc + '</span>';
        if (x.solved) html += '<span class="fm-pill green">已解决</span>';
        html += '</div>';
        html += '</div>';
      });
    }
    el.innerHTML = html;
  }

  // ---------- 修改资料 ----------
  function fmOpenProfileEdit() {
    var p = loadProfile();
    var s = document.getElementById('fm-sheet');
    if (!s) return;
    s.style.display = 'flex';
    var head = p.avatar
      ? '<img src="' + esc(p.avatar) + '" alt="">'
      : '<span>' + esc(String(p.name).slice(0, 1)) + '</span>';
    var html = '<div class="fm-sheet-title">修改资料</div>';
    html += '<div class="fmp-edit-ava-row">';
    html += '<div class="fmp-edit-ava" onclick="var f=document.getElementById(\'fmp-ava-file\');if(f)f.click()">' + head + '</div>';
    html += '<div class="fmp-edit-hint">点头像换一张<br><span>存在本地，不会传出去</span></div>';
    html += '</div>';
    html += '<input type="file" id="fmp-ava-file" accept="image/*" style="display:none" onchange="fmPickProfileAvatar(event)">';
    html += '<div class="fm-hint">封面</div>';
    html += '<div class="fmp-edit-cover" style="background-image:url(&quot;' + (p.cover || 'assets/forum-cover.jpg') + '&quot;)" onclick="var f=document.getElementById(\'fmp-cover-file\');if(f)f.click()"><span>换一张封面</span></div>';
    html += '<input type="file" id="fmp-cover-file" accept="image/*" style="display:none" onchange="fmPickProfileCover(event)">';
    html += '<div class="fm-hint">名字</div><input class="fm-input" id="fmp-name" maxlength="16" value="' + esc(p.name) + '">';
    html += '<div class="fm-hint">ID（挂在名字下面）</div><input class="fm-input" id="fmp-handle" maxlength="16" value="' + esc(p.handle) + '">';
    html += '<div class="fm-hint">一句签名，最多 30 字</div><input class="fm-input" id="fmp-bio" maxlength="30" value="' + esc(p.bio) + '" placeholder="想写就写">';
    html += '<button class="fm-main-btn" onclick="fmSaveProfile()">存下来</button>';
    html += '<button class="fm-ghost-btn" onclick="fmCloseCompose()">算了</button>';
    s.innerHTML = '<div class="fm-sheet-mask" onclick="if(event.target===this)fmCloseCompose()"></div><div class="fm-sheet-body">' + html + '</div>';
  }

  function fmReadEditInputs() {
    var p = loadProfile();
    var nm = document.getElementById('fmp-name');
    var hd = document.getElementById('fmp-handle');
    var bio = document.getElementById('fmp-bio');
    if (nm && nm.value.trim()) p.name = nm.value.trim();
    if (hd) p.handle = hd.value.trim().replace(/^@/, '') || p.handle;
    if (bio) p.bio = bio.value.trim();
    saveProfile(p);
    return p;
  }

  async function fmPickProfileAvatar(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    fmReadEditInputs();
    try {
      var url = '';
      if (typeof window.compressImageBase64 === 'function') url = await window.compressImageBase64(f, 400, 0.85);
      if (url) {
        var p = loadProfile();
        p.avatar = url;
        saveProfile(p);
      }
    } catch (err) {
      console.warn('[forum] 头像处理失败', err);
    }
    fmOpenProfileEdit();
  }

  async function fmPickProfileCover(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    fmReadEditInputs();
    try {
      var url = '';
      if (typeof window.compressImageBase64 === 'function') url = await window.compressImageBase64(f, 1000, 0.82);
      if (url) {
        var p = loadProfile();
        p.cover = url;
        saveProfile(p);
      }
    } catch (err) {
      console.warn('[forum] 封面处理失败', err);
    }
    fmOpenProfileEdit();
  }

  function fmSaveProfile() {
    fmReadEditInputs();
    fmCloseCompose();
    if (fm.tab === 'mine') renderMeCard();
    else renderForumApp();
    window.wxToast && window.wxToast('名片已更新');
  }

  // ---------- 入口 ----------
  function renderForumApp() {
    fm.openId = '';
    var det = document.getElementById('fm-detail');
    if (det) { det.style.display = 'none'; }
    renderChips();
    var listEl = document.getElementById('fm-list');
    var meEl = document.getElementById('fm-me');
    if (fm.tab === 'mine') {
      if (listEl) listEl.style.display = 'none';
      if (meEl) meEl.style.display = 'block';
      renderMeCard();
    } else {
      if (listEl) listEl.style.display = 'block';
      if (meEl) meEl.style.display = 'none';
      renderList();
    }
    renderTabs();
    renderMissed();
    var sub = document.getElementById('fm-sub');
    if (sub) {
      sub.innerText = fm.tab === 'mine' ? '我在这儿的痕迹' : (fm.tab === 'follow' ? '只看关注的人' : '谁都可以坐下说两句');
    }
    // 打开就补一次，不 await：先让人看到已有的，补完再刷
    if (!fm.seeding) fmEnsureFresh();
  }

  // ---------- 详情 ----------
  function findPost(id) {
    var list = loadPosts();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function fmOpenPost(id) {
    fm.openId = id;
    fm.picked = {};
    var det = document.getElementById('fm-detail');
    if (det) det.style.display = 'flex';
    fmRenderDetail();
  }

  function fmClosePost() {
    fm.openId = '';
    var det = document.getElementById('fm-detail');
    if (det) det.style.display = 'none';
    renderForumApp();
  }

  function fmRenderDetail() {
    var p = findPost(fm.openId);
    var box = document.getElementById('fm-det-body');
    if (!box) return;
    if (!p) { box.innerHTML = '<div class="fm-empty">这条不见了。</div>'; return; }

    var head = document.getElementById('fm-det-head-title');
    if (head) head.innerHTML = '<span class="fm-det-crumb">' + esc(dispName(p.authorKind, p.authorName)) + '</span>' + typeBadge(p.type);

    var html = '';
    html += '<div class="fm-det-post">';
    html += '<div class="fm-post-head">';
    html += fmAvaHTML(p.authorKind, p.authorId, p.authorName, p.authorAvatar, 'lg');
    html += '<div class="fm-post-who"><div class="fm-det-name">' + esc(dispName(p.authorKind, p.authorName)) + '</div>';
    html += '<div class="fm-post-sig">' + fmTimeAgo(p.createdAt) + '</div></div>';
    if (p.authorKind === 'char') {
      var fo = isFollowed(p.authorId);
      html += '<button class="fm-mini' + (fo ? ' on' : '') + '" onclick="fmToggleFollow(\'' + esc(p.authorId) + '\')">' + (fo ? '已关注' : '关注') + '</button>';
    }
    html += '</div>';
    if (p.title) html += '<div class="fm-det-title">' + esc(p.title) + '</div>';
    html += '<div class="fm-det-copy">' + esc(p.body).replace(/\n/g, '<br>') + '</div>';
    if ((p.tags || []).length) {
      html += '<div class="fm-tags">' + p.tags.map(function (t) { return '<span class="fm-tag">#' + esc(t) + '</span>'; }).join('') + '</div>';
    }
    html += '<div class="fm-det-ops">';
    if (p.type === 'ask') {
      html += '<button class="fm-op' + (p.solved ? ' done' : '') + '" onclick="fmToggleSolved()">' + (p.solved ? '已解决 ✓' : '这件事解决了') + '</button>';
    }
    html += '<button class="fm-op danger" onclick="fmDeletePost()">删掉这条</button>';
    html += '</div>';
    html += '</div>';

    // 评论
    var reps = p.replies || [];
    html += '<div class="fm-rep-head">' + (reps.length ? (reps.length + ' 条回应') : '还没有人回') + '</div>';
    if (reps.length) {
      reps.forEach(function (r) {
        var isBest = p.bestReplyId && r.id === p.bestReplyId;
        html += '<div class="fm-reply' + (isBest ? ' best' : '') + '">';
        html += fmAvaHTML(r.kind, r.authorId, r.authorName, r.authorAvatar);
        html += '<div class="fm-reply-main">';
        html += '<div class="fm-reply-top"><b>' + esc(dispName(r.kind, r.authorName)) + '</b><span class="fm-reply-time">' + fmTimeAgo(r.createdAt) + '</span></div>';
        html += '<div class="fm-reply-body">' + esc(r.body) + '</div>';
        html += '<div class="fm-reply-ops">';
        if (isBest) html += '<span class="fm-pill gold">最佳回答</span>';
        else if (p.type === 'qa' || p.type === 'ask') html += '<button class="fm-mini" onclick="fmMarkBest(\'' + r.id + '\')">采纳</button>';
        html += '</div>';
        html += '</div></div>';
      });
    }

    // 叫谁来应
    html += '<div class="fm-call">';
    html += '<div class="fm-call-title">叫谁来应</div>';
    html += '<div class="fm-call-sub">选 1–3 个人。NPC 不花 token，角色要花。</div>';
    html += '<div class="fm-call-row">';
    NPCS.forEach(function (n) {
      var key = 'npc:' + n.id;
      var on = fm.picked[key] ? ' on' : '';
      html += '<div class="fm-pick' + on + '" onclick="fmTogglePick(\'' + key + '\')">' + fmAvaHTML('npc', n.id, n.name, '') + '<span>' + esc(n.name) + '</span></div>';
    });
    charList().forEach(function (c) {
      if (!c || !c.id) return;
      var key = 'char:' + c.id;
      var on = fm.picked[key] ? ' on' : '';
      html += '<div class="fm-pick' + on + '" onclick="fmTogglePick(\'' + key + '\')">' + fmAvaHTML('char', c.id, c.name, c.avatar) + '<span>' + esc(c.name) + '</span></div>';
    });
    html += '</div>';
    html += '<button class="fm-call-btn" id="fm-call-btn" onclick="fmGenerateReplies()">让他们来应</button>';
    html += '</div>';

    box.innerHTML = html;
    fmUpdateCallBtn();
  }

  function fmTogglePick(key) {
    if (fm.picked[key]) delete fm.picked[key];
    else {
      var n = Object.keys(fm.picked).length;
      if (n >= 3) { window.wxToast && window.wxToast('一次最多叫三个人'); return; }
      fm.picked[key] = true;
    }
    fmRenderDetail();
  }

  function fmPickCount() { return Object.keys(fm.picked).length; }

  function fmUpdateCallBtn() {
    var btn = document.getElementById('fm-call-btn');
    if (!btn) return;
    var n = fmPickCount();
    btn.innerText = n ? ('让他们来应（' + n + ' 人）') : '让他们来应';
    btn.classList.toggle('dim', !n);
  }

  // 我自己回一句（不花 token）
  function fmSendMyReply() {
    var input = document.getElementById('fm-reply-input');
    if (!input) return;
    var txt = String(input.value || '').trim();
    if (!txt) return;
    var p = findPost(fm.openId);
    if (!p) return;
    var list = loadPosts();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== p.id) continue;
      if (!list[i].replies) list[i].replies = [];
      list[i].replies.push({
        id: uid('fr'),
        kind: 'me',
        authorId: 'me',
        authorName: meName(),
        authorAvatar: meAvatar(),
        body: txt,
        createdAt: Date.now()
      });
      break;
    }
    savePosts(list);
    input.value = '';
    fmRenderDetail();
  }

  function fmMarkBest(replyId) {
    var list = loadPosts();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== fm.openId) continue;
      list[i].bestReplyId = (list[i].bestReplyId === replyId) ? '' : replyId;
      if (list[i].bestReplyId && list[i].type === 'ask') list[i].solved = true;
      break;
    }
    savePosts(list);
    fmRenderDetail();
  }

  function fmToggleSolved() {
    var list = loadPosts();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== fm.openId) continue;
      list[i].solved = !list[i].solved;
      break;
    }
    savePosts(list);
    fmRenderDetail();
  }

  function fmDeletePost() {
    if (!confirm('删掉这条？删了就没法找回。')) return;
    var list = loadPosts().filter(function (p) { return p.id !== fm.openId; });
    savePosts(list);
    fmClosePost();
  }

  function fmToggleFollow(charId) {
    var f = loadFollow();
    var idx = f.indexOf(charId);
    if (idx >= 0) f.splice(idx, 1);
    else f.push(charId);
    saveFollow(f);
    fmRenderDetail();
  }

  // ---------- AI 调用 ----------
  function fmHasAI() {
    var a = window.appData || {};
    return !!a.apiKey;
  }

  async function fmAsk(prompt, temperature) {
    var a = window.appData || {};
    if (!a.apiKey) throw new Error('没有 API Key');
    var base = String(a.apiBase || '').trim().replace(/\/+$/, '');
    if (!base.endsWith('/chat/completions')) base += '/chat/completions';
    var resp = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + a.apiKey },
      body: JSON.stringify({
        model: a.model || 'deepseek-chat',
        messages: [{ role: 'system', content: prompt }],
        temperature: temperature == null ? 0.85 : temperature
      })
    });
    if (!resp.ok) throw new Error('接口异常 ' + resp.status);
    var data = await resp.json();
    var txt = data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || '') : '';
    if (!txt) throw new Error('模型没有返回内容');
    return txt.trim();
  }

  function fmParseJSON(txt) {
    var s = String(txt || '').trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    var i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  // 取某个角色最近的聊天当素材
  function fmRecentChat(charId, limit) {
    try {
      var hist = (typeof window.getChatHistoryForChar === 'function')
        ? (window.getChatHistoryForChar(charId) || []) : [];
      var clean = hist.filter(function (m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !m.recalled;
      }).slice(-(limit || 8));
      if (!clean.length) return '';
      return clean.map(function (m) {
        var t = String(m.content)
          .replace(/\[IMAGE:[\s\S]*?\]/g, '[图片]')
          .replace(/\[SYSTEMHINT:[\s\S]*?\]/g, '')
          .replace(/\[[\w-]+:[\s\S]*?\]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (t.length > 100) t = t.slice(0, 100) + '…';
        return (m.role === 'user' ? meName() : '我') + '：' + t;
      }).join('\n');
    } catch (e) { return ''; }
  }

  // 角色最后聊天时间，用来判断"最近聊过没"
  function fmLastChatAt(charId) {
    try {
      var hist = (typeof window.getChatHistoryForChar === 'function')
        ? (window.getChatHistoryForChar(charId) || []) : [];
      for (var i = hist.length - 1; i >= 0; i--) {
        var m = hist[i];
        if (!m) continue;
        if (typeof m.timestamp === 'number' && isFinite(m.timestamp)) return m.timestamp;
        if (m.time) {
          var d = new Date(m.time);
          if (!isNaN(d.getTime())) return d.getTime();
        }
      }
    } catch (e) {}
    return 0;
  }

  // ---------- 角色发帖 ----------
  var TYPE_RULE = {
    ask: '这次发【求助帖】：写一件确实卡住你的事。要说清你试过什么、卡在哪一步、想让人帮你判断什么。',
    qa: '这次发【问答帖】：抛出一个你真的想知道答案的问题。问题要具体，不要"人生该怎么办"这种大而无当的。',
    share: '这次发【分享帖】：只是想说一声。一件小事、一个发现、一句你此刻想到的话，不用求助也不用提问。'
  };

  async function fmBuildCharPost(char, type) {
    var a = window.appData || {};
    var charName = char.name || '角色';
    var recent = fmRecentChat(char.id, 8);
    var memo = '';
    try {
      if (typeof window.getPalaceMemoryTextFor === 'function') {
        memo = window.getPalaceMemoryTextFor('single', char.id, 7) || '';
      }
    } catch (e) {}
    var nowText = new Date().toLocaleString('zh-CN', { hour12: false });

    var prompt = '你是' + charName + (char.tag ? '（' + char.tag + '）' : '') + '。\n'
      + '【角色设定】' + (String(char.intro || '').slice(0, 600) || '未设置') + '\n'
      + '【口吻参考】' + (String(char.prompt || '').slice(0, 600) || '未设置') + '\n'
      + (char.directives ? '【额外指令】' + String(char.directives).slice(0, 300) + '\n' : '')
      + '【现在】' + nowText + '\n'
      + (memo ? '【你记得的事】' + String(memo).slice(0, 700) + '\n' : '')
      + '【你最近和' + meName() + '的聊天，只作素材，不要写成回复】\n' + (recent || '（最近没怎么聊）') + '\n\n'
      + '你常去一个叫「长椅」的公共广场，那里谁都能坐下来发帖，有些是你不认识的邻居。\n\n'
      + TYPE_RULE[type] + '\n\n'
      + '【硬性要求】\n'
      + '1. 第一人称，口语，像真人在手机上随手打的，不要书面腔，不要写成小说旁白。\n'
      + '2. 正文 40–120 字，必须有具体的东西：物件、时间、地点、数字、动作。\n'
      + '3. 这是公开广场，任何人都会看到。绝对不许提到' + meName() + '的身体、月经、体重、睡眠、钱、家里的私事。只写你自己的事。聊天素材里凡是涉及' + meName() + '私人的部分，一律丢掉。\n'
      + '4. 不要用"姐妹们""家人们""谁懂啊"这类网络套话，不要用感叹号堆情绪。\n'
      + '5. 求助帖和问答帖必须有短标题（不超过 16 字）；分享帖 title 留空字符串。\n'
      + '6. 只输出 JSON，不要解释，不要代码块：{"title":"标题或空","body":"正文","tags":["最多两个短标签"]}';

    var txt = await fmAsk(prompt, 0.92);
    var o = fmParseJSON(txt);
    if (!o) throw new Error('解析失败');
    var body = String(o.body || '').trim();
    if (!body) throw new Error('正文为空');
    return {
      id: uid('fp'),
      type: type,
      authorKind: 'char',
      authorId: char.id,
      authorName: charName,
      authorAvatar: char.avatar || '',
      title: type === 'share' ? '' : String(o.title || '').trim().slice(0, 24),
      body: body.slice(0, 400),
      tags: Array.isArray(o.tags) ? o.tags.map(function (t) { return String(t).replace(/^#/, '').slice(0, 8); }).filter(Boolean).slice(0, 2) : [],
      createdAt: Date.now(),
      solved: false,
      bestReplyId: '',
      replies: []
    };
  }

  // 挑一个该发帖的角色：最近聊过的优先
  function fmPickChar(exclude) {
    var chars = charList().filter(function (c) { return c && c.id; });
    if (!chars.length) return null;
    var cand = chars.filter(function (c) { return (exclude || []).indexOf(c.id) < 0; });
    if (!cand.length) cand = chars;
    var scored = cand.map(function (c) {
      var at = fmLastChatAt(c.id);
      var fresh = at ? Math.max(0, 1 - (Date.now() - at) / (1000 * 60 * 60 * 24 * 10)) : 0;
      return { c: c, w: fresh + Math.random() * 0.6 };
    });
    scored.sort(function (x, y) { return y.w - x.w; });
    return scored[0].c;
  }

  // NPC 罐头帖
  function fmNpcPost() {
    var pool = [];
    NPCS.forEach(function (n) {
      (NPC_POSTS[n.id] || []).forEach(function (t) { pool.push({ npc: n, t: t }); });
    });
    var used = loadPosts().filter(function (p) { return p.authorKind === 'npc'; }).map(function (p) { return p.body; });
    var fresh = pool.filter(function (x) { return used.indexOf(x.t.body) < 0; });
    if (!fresh.length) fresh = pool;
    var it = pick(fresh);
    return {
      id: uid('fp'),
      type: it.t.type,
      authorKind: 'npc',
      authorId: it.npc.id,
      authorName: it.npc.name,
      authorAvatar: it.npc.id,
      title: it.t.title || '',
      body: it.t.body,
      tags: (it.t.tags || []).slice(),
      createdAt: Date.now(),
      solved: false,
      bestReplyId: '',
      replies: []
    };
  }

  // NPC 罐头回复
  function fmNpcReply(npc, type, post) {
    var body;
    if (npc.id === 'npc-lurk') body = pick(LURK_LINES);
    else body = pick(NPC_REPLIES[type] || NPC_REPLIES.share);
    return {
      id: uid('fr'),
      kind: 'npc',
      authorId: npc.id,
      authorName: npc.name,
      authorAvatar: npc.id,
      body: body,
      createdAt: Date.now()
    };
  }

  // ---------- 打开时补帖（懒生成） ----------
  function fmLevelConf() {
    var st = loadState();
    var level = st.autoLevel;
    if (level === 'quiet') return { npcGap: 6 * 3600e3, npcCap: 2, charGap: 24 * 3600e3, charCap: 1 };
    if (level === 'lively') return { npcGap: 3 * 3600e3, npcCap: 5, charGap: 6 * 3600e3, charCap: 3 };
    return { npcGap: 4 * 3600e3, npcCap: 3, charGap: 12 * 3600e3, charCap: 2 };
  }

  async function fmEnsureFresh() {
    if (fm.seeding) return;
    fm.seeding = true;
    var changed = false;
    try {
      var st = loadState();
      var conf = fmLevelConf();
      var now = Date.now();
      var posts = loadPosts();
      var list = posts.slice();

      // 1) NPC 罐头：先把广场铺满
      var npcNeed;
      if (!list.length) npcNeed = 3;
      else {
        var sinceNpc = now - (st.lastNpcAt || 0);
        npcNeed = Math.floor(sinceNpc / conf.npcGap);
      }
      if (npcNeed > conf.npcCap) npcNeed = conf.npcCap;
      if (npcNeed < 0) npcNeed = 0;

      var startStep = list.length ? conf.npcGap : 2 * 3600e3;
      var startBase = now - (list.length ? startStep : 5 * 3600e3);
      for (var i = 0; i < npcNeed; i++) {
        var np = fmNpcPost();
        // 时间戳回填：像你不在的时候陆续发的，而不是一串“刚刚”
        np.createdAt = startBase - i * startStep - randInt(0, 40) * 60e3;
        np.createdAt = Math.max(np.createdAt, now - 86400e3 * 5);
        list.push(np);
        changed = true;
      }

      // 2) 角色帖：按间隔补，最多 charCap 条，静默失败
      var charNeed;
      if (!posts.some(function (p) { return p.authorKind === 'char'; })) charNeed = 1;
      else charNeed = Math.floor((now - (st.lastCharSeedAt || 0)) / conf.charGap);
      if (charNeed > conf.charCap) charNeed = conf.charCap;
      if (charNeed < 0) charNeed = 0;

      if (charNeed > 0 && fmHasAI()) {
        var usedChars = [];
        var charOk = 0;
        for (var c = 0; c < charNeed; c++) {
          var ch = fmPickChar(usedChars);
          if (!ch) break;
          usedChars.push(ch.id);
          try {
            var tp = ['ask', 'qa', 'share'][randInt(0, 2)];
            var post = await fmBuildCharPost(ch, tp);
            post.createdAt = now - (1 + c * 2.5) * 3600e3 - randInt(0, 25) * 60e3;
            post.createdAt = Math.max(post.createdAt, now - 86400e3 * 2);
            list.push(post);
            changed = true;
            charOk++;
          } catch (e) {
            console.warn('[forum] 角色发帖失败', e);
          }
        }
        // 一条都没成：半小时后再试，别每次打开都白烧一次请求
        if (!charOk) {
          st.lastCharSeedAt = now - conf.charGap + 30 * 60e3;
          saveState(st);
        }
      }

      if (changed) {
        savePosts(list);
        st.lastSeededAt = now;
        st.lastNpcAt = now;
        if (list.some(function (p) { return p.authorKind === 'char'; })) st.lastCharSeedAt = now;
        saveState(st);
        if (fm.openId) fmRenderDetail(); else { renderList(); renderTabs(); renderMissed(); }
      }
    } catch (e) {
      console.warn('[forum] 补帖出错', e);
    } finally {
      fm.seeding = false;
    }
  }

  // ---------- 生成回复 ----------
  function fmReplyPrompt(char, post) {
    var a = window.appData || {};
    var lines = (post.replies || []).map(function (r) { return '- ' + r.authorName + '：' + String(r.body).slice(0, 60); }).join('\n');
    return '你是' + (char.name || '角色') + (char.tag ? '（' + char.tag + '）' : '') + '。\n'
      + '【角色设定】' + (String(char.intro || '').slice(0, 500) || '未设置') + '\n'
      + '【口吻参考】' + (String(char.prompt || '').slice(0, 500) || '未设置') + '\n'
      + (char.directives ? '【额外指令】' + String(char.directives).slice(0, 200) + '\n' : '')
      + '\n你在「长椅」广场刷到一个帖子：\n'
      + '【发帖人】' + dispName(post.authorKind, post.authorName) + '\n'
      + '【类型】' + (TYPE_LABEL[post.type] || '分享') + '\n'
      + (post.title ? '【标题】' + post.title + '\n' : '')
      + '【正文】' + post.body + '\n'
      + (lines ? '【已经有人回了】\n' + lines + '\n' : '')
      + '\n你要在下面留一条回应。\n【要求】\n'
      + '1. 15–45 字，口语，像真人刷到帖子随手回的，不要书面语。\n'
      + '2. 要贴着帖子里具体的那个点说，不要泛泛安慰，不要"加油你最棒"这种。\n'
      + '3. 可以不同意、可以吐槽、可以只接一句，不要每个人都热情帮忙。\n'
      + '4. 这是公开广场，不许提用户的隐私（身体、月经、体重、钱、家里的事）。\n'
      + '5. 只输出这句话本身，不要引号、不要"回复："这种前缀、不要解释。';
  }

  async function fmGenerateReplies() {
    var p = findPost(fm.openId);
    if (!p) return;
    var keys = Object.keys(fm.picked);
    if (!keys.length) { window.wxToast && window.wxToast('先在下面选 1–3 个人'); return; }
    if (fm.busy) return;
    fm.busy = true;
    var btn = document.getElementById('fm-call-btn');
    if (btn) { btn.innerText = '正在想…'; btn.disabled = true; }

    try {
      for (var i = 0; i < keys.length; i++) {
        var parts = keys[i].split(':');
        var kind = parts[0], id = parts.slice(1).join(':');
        var cur = findPost(p.id);
        if (!cur) break;
        var already = (cur.replies || []).some(function (r) { return r.kind === kind && r.authorId === id; });
        if (already) continue;

        var reply = null;
        if (kind === 'npc') {
          var npc = npcById(id);
          if (!npc) continue;
          reply = fmNpcReply(npc, cur.type, cur);
        } else {
          var ch = charById(id);
          if (!ch) continue;
          if (!fmHasAI()) continue;
          try {
            var txt = await fmAsk(fmReplyPrompt(ch, cur), 0.88);
            var line = String(txt).trim().replace(/^["“”'‘’「」]/g, '').replace(/["“”'‘’「」]$/g, '').replace(/^回复[:：]\s*/, '').split('\n')[0].trim();
            if (line) {
              reply = {
                id: uid('fr'), kind: 'char', authorId: ch.id, authorName: ch.name || '角色',
                authorAvatar: ch.avatar || '', body: line.slice(0, 120), createdAt: Date.now()
              };
            }
          } catch (e) {
            console.warn('[forum] 回复失败', e);
          }
        }
        if (!reply) continue;
        // 回复时间落在帖子之后、现在之前
        var base = cur.createdAt;
        var span = Math.min(Date.now() - base, 6 * 3600e3);
        reply.createdAt = base + randInt(15, Math.max(30, Math.floor(span / 60000))) * 60e3;
        if (reply.createdAt > Date.now()) reply.createdAt = Date.now() - 60e3;
        if (reply.createdAt <= base) reply.createdAt = base + 60e3;

        var list = loadPosts();
        for (var j = 0; j < list.length; j++) {
          if (list[j].id !== p.id) continue;
          if (!list[j].replies) list[j].replies = [];
          list[j].replies.push(reply);
          break;
        }
        savePosts(list);
        fm.picked[keys[i]] = false;
        delete fm.picked[keys[i]];
        fmRenderDetail();
        var nb = document.getElementById('fm-call-btn');
        if (nb) { nb.innerText = '正在想…'; nb.disabled = true; }
      }
    } finally {
      fm.busy = false;
      fm.picked = {};
      fmRenderDetail();
    }
  }

  // ---------- 发帖弹层 ----------
  var layer = { mode: 'me', type: 'share', charId: '' };

  function fmOpenCompose(mode) {
    layer.mode = mode || 'me';
    layer.type = 'share';
    layer.charId = '';
    fmRenderSheet();
  }
  function fmCloseCompose() {
    var s = document.getElementById('fm-sheet');
    if (s) { s.style.display = 'none'; s.innerHTML = ''; }
  }

  function fmSetComposeMode(m) { layer.mode = m; fmRenderSheet(); }
  function fmSetComposeType(t) { layer.type = t; fmRenderSheet(); }
  function fmSetComposeChar(id) { layer.charId = id; fmRenderSheet(); }

  function fmRenderSheet() {
    var s = document.getElementById('fm-sheet');
    if (!s) return;
    s.style.display = 'flex';
    var body = '';
    body += '<div class="fm-sheet-title">发一条</div>';
    body += '<div class="fm-seg">'
      + '<div class="fm-seg-item' + (layer.mode === 'me' ? ' on' : '') + '" onclick="fmSetComposeMode(\'me\')">我自己发</div>'
      + '<div class="fm-seg-item' + (layer.mode === 'char' ? ' on' : '') + '" onclick="fmSetComposeMode(\'char\')">让角色发</div>'
      + '</div>';

    var typeRow = '<div class="fm-chiprow">'
      + ['ask', 'qa', 'share'].map(function (t) {
        return '<div class="fm-chip' + (layer.type === t ? ' on' : '') + '" onclick="fmSetComposeType(\'' + t + '\')">' + TYPE_LABEL[t] + '</div>';
      }).join('')
      + '</div>';

    if (layer.mode === 'me') {
      body += typeRow;
      body += '<div class="fm-hint">' + TYPE_HINT[layer.type] + '</div>';
      if (layer.type !== 'share') {
        body += '<input class="fm-input" id="fm-c-title" placeholder="一句话标题" maxlength="24">';
      }
      body += '<textarea class="fm-textarea" id="fm-c-body" placeholder="想说什么就说，慢一点也行" maxlength="400"></textarea>';
      body += '<button class="fm-main-btn" onclick="fmSubmitCompose()">发出去</button>';
    } else {
      var chars = charList().filter(function (c) { return c && c.id; });
      if (!chars.length) {
        body += '<div class="fm-hint">还没有角色。先去微信里建一个。</div>';
      } else {
        body += '<div class="fm-hint">让谁在长椅上说话</div>';
        body += '<div class="fm-call-row">';
        chars.forEach(function (c) {
          body += '<div class="fm-pick' + (layer.charId === c.id ? ' on' : '') + '" onclick="fmSetComposeChar(\'' + esc(c.id) + '\')">'
            + fmAvaHTML('char', c.id, c.name, c.avatar) + '<span>' + esc(c.name) + '</span></div>';
        });
        body += '</div>';
        body += typeRow;
        body += '<div class="fm-hint">TA 会从你们最近的聊天和人设里取材，写一条公开的帖。私人的事不会写进去。</div>';
        body += '<button class="fm-main-btn" onclick="fmGenCharPost()">让 TA 发一条</button>';
      }
    }
    body += '<button class="fm-ghost-btn" onclick="fmCloseCompose()">不发了</button>';
    s.innerHTML = '<div class="fm-sheet-mask" onclick="if(event.target===this)fmCloseCompose()"></div><div class="fm-sheet-body">' + body + '</div>';
  }

  function fmSubmitCompose() {
    var type = layer.type;
    var titleEl = document.getElementById('fm-c-title');
    var bodyEl = document.getElementById('fm-c-body');
    var txt = String(bodyEl && bodyEl.value || '').trim();
    if (!txt) { window.wxToast && window.wxToast('先写点什么'); return; }
    var post = {
      id: uid('fp'),
      type: type,
      authorKind: 'me',
      authorId: 'me',
      authorName: meName(),
      authorAvatar: meAvatar(),
      title: type === 'share' ? '' : String(titleEl && titleEl.value || '').trim().slice(0, 24),
      body: txt.slice(0, 400),
      tags: [],
      createdAt: Date.now(),
      solved: false,
      bestReplyId: '',
      replies: []
    };
    var list = loadPosts();
    list.push(post);
    savePosts(list);
    fmCloseCompose();
    fm.tab = 'mine';
    fm.filter = 'all';
    renderForumApp();
    window.wxToast && window.wxToast('发出去了');
  }

  async function fmGenCharPost() {
    if (!layer.charId) { window.wxToast && window.wxToast('先选一个角色'); return; }
    if (!fmHasAI()) { window.wxToast && window.wxToast('先去设置里填 API Key'); return; }
    var ch = charById(layer.charId);
    if (!ch) return;
    var btn = document.querySelector('#fm-sheet .fm-main-btn');
    if (btn) { btn.innerText = 'TA 正在想…'; btn.disabled = true; }
    try {
      var post = await fmBuildCharPost(ch, layer.type);
      var list = loadPosts();
      list.push(post);
      savePosts(list);
      fmCloseCompose();
      fm.tab = 'square';
      fm.filter = 'all';
      renderForumApp();
      window.wxToast && window.wxToast(ch.name + ' 在长椅上发了一条');
    } catch (e) {
      console.warn('[forum] 手动发帖失败', e);
      if (btn) { btn.innerText = '让 TA 发一条'; btn.disabled = false; }
      window.wxToast && window.wxToast('没发出去，待会儿再试');
    }
  }

  // ---------- 设置 ----------
  function fmOpenSettings() {
    var st = loadState();
    var s = document.getElementById('fm-sheet');
    if (!s) return;
    s.style.display = 'flex';
    var levels = [['quiet', '安静', '一天最多一条角色帖'], ['normal', '正常', '半天一条左右'], ['lively', '活跃', '几个小时就有人说话']];
    var html = '<div class="fm-sheet-title">长椅的设置</div>';
    html += '<div class="fm-hint">你不在的时候，这里会自己长出帖子。选一个吵闹程度。</div>';
    html += '<div class="fm-levels">';
    levels.forEach(function (l) {
      html += '<div class="fm-level' + (st.autoLevel === l[0] ? ' on' : '') + '" onclick="fmSetAutoLevel(\'' + l[0] + '\')">'
        + '<b>' + l[1] + '</b><span>' + l[2] + '</span></div>';
    });
    html += '</div>';
    var total = loadPosts().length;
    html += '<div class="fm-hint">现在一共 ' + total + ' 条帖子。清空以后，长椅会重新长。</div>';
    html += '<button class="fm-op danger wide" onclick="fmClearAll()">清空所有帖子</button>';
    html += '<button class="fm-ghost-btn" onclick="fmCloseCompose()">关掉</button>';
    s.innerHTML = '<div class="fm-sheet-mask" onclick="if(event.target===this)fmCloseCompose()"></div><div class="fm-sheet-body">' + html + '</div>';
  }

  function fmSetAutoLevel(l) {
    var st = loadState();
    st.autoLevel = l;
    saveState(st);
    fmOpenSettings();
  }

  function fmClearAll() {
    if (!confirm('清空长椅上所有的帖子？')) return;
    savePosts([]);
    var st = loadState();
    st.lastSeededAt = 0; st.lastNpcAt = 0; st.lastCharSeedAt = 0; st.seenAt = 0;
    saveState(st);
    fmCloseCompose();
    fmClosePost();
    renderForumApp();
  }

  // ---------- 导出 ----------
  window.renderForumApp = renderForumApp;
  window.fmSwitchTab = fmSwitchTab;
  window.fmSetFilter = fmSetFilter;
  window.fmOpenPost = fmOpenPost;
  window.fmClosePost = fmClosePost;
  window.fmTogglePick = fmTogglePick;
  window.fmGenerateReplies = fmGenerateReplies;
  window.fmSendMyReply = fmSendMyReply;
  window.fmMarkBest = fmMarkBest;
  window.fmToggleSolved = fmToggleSolved;
  window.fmDeletePost = fmDeletePost;
  window.fmToggleFollow = fmToggleFollow;
  window.fmOpenCompose = fmOpenCompose;
  window.fmCloseCompose = fmCloseCompose;
  window.fmSetComposeMode = fmSetComposeMode;
  window.fmSetComposeType = fmSetComposeType;
  window.fmSetComposeChar = fmSetComposeChar;
  window.fmSubmitCompose = fmSubmitCompose;
  window.fmGenCharPost = fmGenCharPost;
  window.fmOpenSettings = fmOpenSettings;
  window.fmOpenProfileEdit = fmOpenProfileEdit;
  window.fmPickProfileAvatar = fmPickProfileAvatar;
  window.fmPickProfileCover = fmPickProfileCover;
  window.fmSaveProfile = fmSaveProfile;
  window.fmSetAutoLevel = fmSetAutoLevel;
  window.fmClearAll = fmClearAll;
  window.fmMarkSeen = fmMarkSeen;

  // 页面一直开着时也让它慢慢长：20 分钟摸一次，按间隔算，不会重复补
  setInterval(function () {
    var page = document.getElementById('page-forum');
    if (page && page.style.display !== 'none') fmEnsureFresh();
  }, 20 * 60 * 1000);

  // __FORUM_END__
})();
