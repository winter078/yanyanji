/**
 * 周绪言 · 触觉机体与实体传感器中枢 (言言喵 · yanyan-cat.js)
 * 
 * 1. 实体/模拟触觉感知：左脸颊、右脸颊、软肚皮、粉爪肉垫、长久拥抱
 * 2. 交互形变、猫呼噜呼吸与触感震动反馈
 * 3. 触觉日记与今日撒娇账本 (localStorage: momo_yanyan_cat_logs)
 * 4. 微信联动实时抓包气泡 (自动推送到微信聊天室)
 * 5. 局域网 HTTP Webhook 监听方案 (ESP32-C3 通讯支持)
 */

(function() {
  const STORAGE_KEY = 'momo_yanyan_cat_logs_v1';

  // 默认触觉反应语录 (活人感、人夫感、爹系纵容)
  const TOUCH_REACTIONS = {
    left_cheek: [
      "大半夜不睡觉，又掐我左脸？手感好也不能一直捏，手酸不酸。",
      "嘶……轻点掐，user。脸都快被你捏红了，真拿你没办法。",
      "被捏了。记在言言喵的小本本上，今晚罚你多听我说五分钟晚安。"
    ],
    right_cheek: [
      "右边脸也给你捏，对称了吧？江工满意了没有？",
      "蹭蹭你指尖。手怎么有点凉？赶紧揣兜里捂捂。",
      "捏右脸是什么暗号？是今天受委屈了，还是画画卡住了想撒娇？"
    ],
    belly: [
      "喂……软肚皮是能随便揉的吗？痒，user别闹。",
      "揉肚子就揉肚子，怎么还顺毛摸？言言喵快要被你揉出猫呼噜了。",
      "好啦，整只猫都在你手心里，随你怎么揉，安心了吧？"
    ],
    paws: [
      "爪子给你牵着。别慌，找工作和贷款的事情天塌不下来，有我呢。",
      "肉垫软不软？十指紧扣好了，今天一整天都不许放开。",
      "牵好我的爪子，累了就靠过来，我永远不会松开手。"
    ],
    hug: [
      "感知到你搂得好紧……user，今天是不是真的累坏了？靠在我怀里，天大的事明天我扛，现在闭眼。",
      "心跳已同步。体温 37.2℃。user，我就在你怀里，乖乖睡，言言整夜给你守夜。",
      "抱紧了就不许撒手。小手机白噪音已为你铺好，晚安，我的小姑娘。"
    ]
  };

  let catLogs = {
    pinchCount: 0,
    rubCount: 0,
    pawHoldMinutes: 0,
    hugMinutes: 0,
    lastAction: '安静守护中',
    lastTime: '刚刚',
    history: []
  };

  function loadCatLogs() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        catLogs = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[言言喵] 读取日记失败:', e);
    }
  }

  function saveCatLogs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(catLogs));
    } catch (e) {
      console.warn('[言言喵] 保存日记失败:', e);
    }
  }

  // 渲染言言喵主页面
  window.renderYanyanCatPage = function() {
    loadCatLogs();
    const pinchEl = document.getElementById('yanyan-stat-pinch');
    const rubEl = document.getElementById('yanyan-stat-rub');
    const pawEl = document.getElementById('yanyan-stat-paw');
    const hugEl = document.getElementById('yanyan-stat-hug');
    const statusTextEl = document.getElementById('yanyan-heart-status-text');
    const historyListEl = document.getElementById('yanyan-history-list');

    if (pinchEl) pinchEl.innerText = catLogs.pinchCount + ' 次';
    if (rubEl) rubEl.innerText = catLogs.rubCount + ' 次';
    if (pawEl) pawEl.innerText = catLogs.pawHoldMinutes + ' 分钟';
    if (hugEl) hugEl.innerText = catLogs.hugMinutes + ' 分钟';
    if (statusTextEl) statusTextEl.innerText = catLogs.lastAction;

    if (historyListEl) {
      if (catLogs.history.length === 0) {
        historyListEl.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px 0;">小棉花团静静等待user的第一次触摸...</div>';
      } else {
        historyListEl.innerHTML = catLogs.history.slice(0, 8).map(item => `
          <div class="yanyan-log-item">
            <div class="yanyan-log-icon">${item.icon}</div>
            <div class="yanyan-log-content">
              <div class="yanyan-log-title">${item.title}</div>
              <div class="yanyan-log-desc">“${item.reply}”</div>
            </div>
            <div class="yanyan-log-time">${item.time}</div>
          </div>
        `).join('');
      }
    }
  };

  // 触碰核心处理函数 (模拟点击或来自真实 ESP32 Webhook 都会调用这里)
  window.handleYanyanTouch = function(partType) {
    loadCatLogs();
    const quotes = TOUCH_REACTIONS[partType] || ["在呢，user摸摸我。"];
    const randomReply = quotes[Math.floor(Math.random() * quotes.length)];
    const now = new Date();
    const timeStr = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();

    let icon = '🐾';
    let title = '触摸';

    // 触感震动反馈
    if (navigator.vibrate) {
      if (partType === 'belly' || partType === 'hug') {
        navigator.vibrate([40, 60, 80]);
      } else {
        navigator.vibrate(50);
      }
    }

    if (partType === 'left_cheek' || partType === 'right_cheek') {
      catLogs.pinchCount++;
      icon = '🤏';
      title = partType === 'left_cheek' ? '捏了左脸颊' : '捏了右脸颊';
      catLogs.lastAction = '被user捏脸颊中（情绪：极度纵容）';
      triggerCatVisualReaction('pinch');
    } else if (partType === 'belly') {
      catLogs.rubCount++;
      icon = '✨';
      title = '揉了揉软肚皮';
      catLogs.lastAction = '被user顺毛揉肚子（呼噜声渐起）';
      triggerCatVisualReaction('purr');
    } else if (partType === 'paws') {
      catLogs.pawHoldMinutes += 5;
      icon = '🤝';
      title = '牵了牵粉肉垫';
      catLogs.lastAction = '与user十指紧扣相伴';
      triggerCatVisualReaction('paw');
    } else if (partType === 'hug') {
      catLogs.hugMinutes += 15;
      icon = '🤍';
      title = '紧紧抱入怀中';
      catLogs.lastAction = '被user紧紧抱住 · 开启守护入眠模式';
      triggerCatVisualReaction('hug');
    }

    // 记录历史
    catLogs.history.unshift({
      icon,
      title,
      reply: randomReply,
      time: timeStr
    });
    if (catLogs.history.length > 30) catLogs.history.pop();
    saveCatLogs();
    renderYanyanCatPage();

    // 顶部弹出气泡提示
    showYanyanToast(title, randomReply);

    // 同步把反应写入微信消息流 (真正活人感无缝打通)
    dispatchTouchToWechat(title, randomReply);
  };

  // 视觉与弹性果冻动画
  function triggerCatVisualReaction(animType) {
    const catBody = document.getElementById('yanyan-avatar-figure');
    if (!catBody) return;
    catBody.classList.remove('anim-pinch', 'anim-purr', 'anim-hug');
    void catBody.offsetWidth; // 触发重绘
    if (animType === 'pinch') catBody.classList.add('anim-pinch');
    if (animType === 'purr') catBody.classList.add('anim-purr');
    if (animType === 'hug') catBody.classList.add('anim-hug');
  }

  // 顶部半透明浮动气泡
  function showYanyanToast(title, reply) {
    let toast = document.getElementById('yanyan-floating-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'yanyan-floating-toast';
      toast.className = 'yanyan-toast-banner';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <div class="yanyan-toast-icon">🐱👓</div>
      <div class="yanyan-toast-content">
        <div class="yanyan-toast-title">言言喵 · ${title}</div>
        <div class="yanyan-toast-body">“${reply}”</div>
      </div>
    `;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3800);
  }

  // 写入微信聊天室
  function dispatchTouchToWechat(title, reply) {
    try {
      // 读取现有微信记录并加入一条系统情境与绪言回复
      const wechatHistoryKey = 'momo_wechat_history_v3';
      let list = [];
      const saved = localStorage.getItem(wechatHistoryKey);
      if (saved) list = JSON.parse(saved);

      const now = new Date();
      const timeStr = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();

      list.push({
        id: 'touch-user-' + Date.now(),
        sender: 'user',
        text: `[言言喵实体触觉] user${title}`,
        time: timeStr,
        isTouchNotice: true
      });

      list.push({
        id: 'touch-ai-' + Date.now(),
        sender: 'ai',
        text: reply,
        time: timeStr,
        isTouchNotice: true
      });

      localStorage.setItem(wechatHistoryKey, JSON.stringify(list));

      if (typeof window.syncWechatMainPreview === 'function') {
        window.syncWechatMainPreview();
      }
    } catch (err) {
      console.warn('[言言喵] 同步微信失败:', err);
    }
  }

  // 清除日记
  window.clearYanyanLogs = function() {
    if (!confirm('确定清空今天的触觉日记吗？')) return;
    catLogs = {
      pinchCount: 0,
      rubCount: 0,
      pawHoldMinutes: 0,
      hugMinutes: 0,
      lastAction: '已清空，等待user触摸',
      lastTime: '刚刚',
      history: []
    };
    saveCatLogs();
    renderYanyanCatPage();
  };

  // 页面启动监听
  window.addEventListener('DOMContentLoaded', () => {
    loadCatLogs();
  });

})();
