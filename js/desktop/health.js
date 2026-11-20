/* =========================================================
   健康 App（hp-*） · 数据层 + 四 tab 渲染 + 弹层交互
   数据：周期 / 睡眠与梦 / 身体（体重·步数·喝水）/ 机时 / 可见性
   ========================================================= */
(function () {
  var K = {
    cycle: 'momo_health_cycle_v1',
    sleep: 'momo_health_sleep_v1',
    body: 'momo_health_body_v1',
    usage: 'momo_health_usage_v1',
    vis: 'momo_health_visibility_v1'
  };

  var SYMPTOMS = ['痛经', '腰酸', '胸胀', '头痛', '疲惫', '情绪低落', '想吃甜', '失眠'];
  var DREAM_TAGS = ['温暖', '紧张', '追逐', '重逢', '坠落', '奇怪', '想再梦一次'];

  // ---------- 基础工具 ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dateOf(s) {
    var p = String(s || '').split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function addDays(s, n) {
    var d = dateOf(s);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function diffDays(a, b) {
    var x = dateOf(a), y = dateOf(b);
    return Math.round((x - y) / 86400000);
  }
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  function fmtCN(s) {
    var d = dateOf(s);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + WEEK[d.getDay()];
  }
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
  function toast(msg) {
    if (typeof showXianguoToast === 'function') { showXianguoToast(msg, 1600); return; }
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);background:rgba(28,32,40,.95);color:#DDE4EE;padding:9px 16px;border-radius:12px;font-size:12.5px;z-index:9999';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }

  // ---------- 数据读写 ----------
  function getCycle() {
    var v = loadJSON(K.cycle, null) || {};
    return {
      cycleLen: Number(v.cycleLen) || 28,
      periodLen: Number(v.periodLen) || 5,
      starts: Array.isArray(v.starts) ? v.starts.slice() : [],
      ends: (v.ends && typeof v.ends === 'object') ? v.ends : {},
      logs: (v.logs && typeof v.logs === 'object') ? v.logs : {}
    };
  }
  function saveCycle(v) { saveJSON(K.cycle, v); }

  function getSleep() {
    var v = loadJSON(K.sleep, null);
    return Array.isArray(v) ? v : [];
  }
  function saveSleep(v) { saveJSON(K.sleep, v.slice().sort(function (a, b) { return String(b.date) > String(a.date) ? 1 : -1; })); }

  function getBody() {
    var v = loadJSON(K.body, null) || {};
    return {
      height: Number(v.height) || 0,
      weights: Array.isArray(v.weights) ? v.weights : [],
      steps: (v.steps && typeof v.steps === 'object') ? v.steps : {},
      water: (v.water && typeof v.water === 'object') ? v.water : {}
    };
  }
  function saveBody(v) { saveJSON(K.body, v); }

  function getUsage() {
    var v = loadJSON(K.usage, null);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }
  function saveUsage(v) {
    // 只留最近 120 天
    var keys = Object.keys(v).sort();
    while (keys.length > 120) { delete v[keys.shift()]; }
    saveJSON(K.usage, v);
  }

  // ---------- 周期推算 ----------
  function avgCycle(c) {
    var starts = c.starts.slice().sort();
    if (starts.length < 2) return c.cycleLen;
    var gaps = [];
    for (var i = starts.length - 1; i > 0 && gaps.length < 6; i--) {
      var g = diffDays(starts[i], starts[i - 1]);
      if (g > 12 && g < 90) gaps.push(g);
    }
    if (!gaps.length) return c.cycleLen;
    var sum = 0;
    gaps.forEach(function (x) { sum += x; });
    return Math.round(sum / gaps.length);
  }
  function lastStartBefore(c, date) {
    var starts = c.starts.slice().sort();
    var found = '';
    starts.forEach(function (s) { if (s <= date) found = s; });
    return found;
  }
  function nextStart(c, date) {
    var last = lastStartBefore(c, date);
    if (!last) return '';
    var n = addDays(last, avgCycle(c));
    // 若预测日已过且没有新的开始，往后顺延一个周期
    while (n < date) n = addDays(n, avgCycle(c));
    return n;
  }
  function cycleDay(c, date) {
    var last = lastStartBefore(c, date);
    if (!last) return 0;
    return diffDays(date, last) + 1;
  }
  function isPeriodDay(c, date) {
    var log = c.logs[date];
    if (log && log.flow) return true;
    var starts = c.starts.slice().sort();
    var ends = c.ends || {};
    for (var i = starts.length - 1; i >= 0; i--) {
      var s = starts[i];
      var endDate = ends[s] || addDays(s, c.periodLen - 1);
      if (i < starts.length - 1) {
        var nextS = starts[i + 1];
        if (endDate >= nextS) endDate = addDays(nextS, -1);
      }
      if (date >= s && date <= endDate) return true;
    }
    return false;
  }
  function isPredictDay(c, date) {
    var n = nextStart(c, date);
    if (!n) return false;
    var end = addDays(n, c.periodLen - 1);
    return date >= n && date <= end && !isPeriodDay(c, date);
  }
  function phaseOf(c, date) {
    var day = cycleDay(c, date);
    if (!day) return { key: 'none', label: '还没记过', tone: 'muted' };
    var len = avgCycle(c);
    if (isPeriodDay(c, date)) return { key: 'period', label: '经期', tone: 'pink' };
    if (day <= c.periodLen) return { key: 'period', label: '经期', tone: 'pink' };
    if (day <= len - 15) return { key: 'follicular', label: '卵泡期', tone: 'mint' };
    if (day <= len - 13) return { key: 'ovulation', label: '排卵期', tone: 'mint' };
    return { key: 'luteal', label: '黄体期', tone: 'amber' };
  }

  // ---------- 睡眠计算 ----------
  function minutesOf(t) {
    var p = String(t || '').split(':');
    var h = Number(p[0]), m = Number(p[1]);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  }
  function sleepDur(rec) {
    var b = minutesOf(rec.bed), w = minutesOf(rec.wake);
    var d = w - b;
    if (d < 0) d += 1440;
    return d;
  }
  function durText(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + 'h' + (m ? pad(m) : '');
  }
  function lastSleep() {
    var all = getSleep();
    if (!all.length) return null;
    var t = todayStr();
    var today = all.filter(function (r) { return r.date === t; })[0];
    if (today) return today;
    var sorted = all.slice().sort(function (a, b) { return String(b.date) > String(a.date) ? 1 : -1; });
    return sorted[0] || null;
  }

  // ---------- 体重 ----------
  function lastWeight() {
    var b = getBody();
    if (!b.weights.length) return null;
    var sorted = b.weights.slice().sort(function (a, b2) { return String(b2.date) > String(a.date) ? 1 : -1; });
    return sorted[0];
  }

  // ---------- 渲染：今天 ----------
  function renderToday() {
    var c = getCycle();
    var t = todayStr();
    var day = cycleDay(c, t);
    var ph = phaseOf(c, t);
    var nxt = nextStart(c, t);
    var sl = lastSleep();
    var body = getBody();
    var w = lastWeight();
    var usage = getUsage();

    var heroLine = [];
    if (day) heroLine.push('周期第 ' + day + ' 天 · ' + ph.label);
    else heroLine.push('还没记过经期');
    if (nxt) heroLine.push('下次约 ' + (dateOf(nxt).getMonth() + 1) + '月' + dateOf(nxt).getDate() + '日');
    if (sl) heroLine.push('昨晚 ' + durText(sleepDur(sl)));

    var cards = [];

    // 周期卡
    cards.push(card('周期', 'pink', day ? (day + '<small>天</small>') : '—',
      day ? (ph.label + (nxt ? ' · 距下次 ' + Math.max(0, diffDays(nxt, t)) + ' 天' : '')) : '点了「今天来月经了」就开始算',
      'hpSwitchTab(\'cycle\')'));

    // 睡眠卡
    cards.push(card('睡眠', 'blue', sl ? (Math.floor(sleepDur(sl) / 60) + '<small>h</small>') : '—',
      sl ? ('质量 ' + (Number(sl.quality) || 0) + '/5 · ' + (sl.bed || '') + '–' + (sl.wake || '')) : '还没记昨晚',
      'hpSwitchTab(\'sleep\')'));

    // 步数卡
    var steps = Number(body.steps[t]) || 0;
    cards.push(card('步数', 'mint', steps ? (steps.toLocaleString() + '<small>步</small>') : '—',
      steps ? (steps >= 6000 ? '今天走得不错' : '可以再走走') : '点一下手动记步数',
      'hpOpenSteps()'));

    // 体重卡
    cards.push(card('体重', 'amber', w ? (Number(w.kg).toFixed(1) + '<small>kg</small>') : '—',
      w ? weightSub(w) : '记一次体重就有曲线',
      'hpOpenWeight()'));

    // 喝水卡
    var cups = Number(body.water[t]) || 0;
    cards.push(card('喝水', 'mint', cups ? (cups + '<small>杯</small>') : '0<small>杯</small>',
      cups ? (cups >= 8 ? '今天够了' : '还差 ' + (8 - cups) + ' 杯') : '点一下加一杯',
      'hpBumpWater()'));

    // 机时卡
    var mins = Number(usage[t]) || 0;
    cards.push(card('机时', 'blue', mins ? (mins + '<small>分钟</small>') : '0<small>分钟</small>',
      '今天用言言机的时长',
      'hpSwitchTab(\'body\')'));

    var tip = '';
    if (ph.key === 'period') tip = '经期第 ' + (day || 1) + ' 天，热水和休息优先，别硬撑。';
    else if (ph.key === 'luteal') tip = '黄体期，容易累和想吃甜的，体重会虚涨一点，正常。';
    else if (sl && sleepDur(sl) < 360) tip = '昨晚不到 6 小时，今晚早点躺。';
    else if (!sl) tip = '还没记昨晚的睡眠，记一下才能看出规律。';

    document.getElementById('hp-today').innerHTML =
      '<div class="hp-hero">' +
      '<div class="hp-hero-date">' + fmtCN(t) + '</div>' +
      '<div class="hp-hero-line">' + esc(heroLine.join(' · ')) + '</div>' +
      (tip ? '<div class="hp-hero-tip">' + esc(tip) + '</div>' : '') +
      '</div>' +
      '<div class="hp-cards">' + cards.join('') + '</div>';
  }

  function weightSub(w) {
    var b = getBody();
    var sorted = b.weights.slice().sort(function (a, b2) { return String(a.date) > String(b2.date) ? 1 : -1; });
    if (sorted.length < 2) return '记于 ' + String(w.date || '').slice(5);
    var idx = sorted.findIndex(function (x) { return x.date === w.date; });
    var prev = idx > 0 ? sorted[idx - 1] : null;
    if (!prev) return '记于 ' + String(w.date || '').slice(5);
    var d = Number(w.kg) - Number(prev.kg);
    var sign = d >= 0 ? '+' : '';
    return '较上次 ' + sign + d.toFixed(1) + 'kg';
  }

  function card(label, tone, value, sub, onclick) {
    return '<div class="hp-card" onclick="' + onclick + '">' +
      '<div class="hp-card-label"><span class="hp-dot ' + tone + '"></span>' + esc(label) + '</div>' +
      '<div class="hp-card-value">' + value + '</div>' +
      '<div class="hp-card-sub">' + esc(sub) + '</div>' +
      '</div>';
  }

  // ---------- 渲染：周期 ----------
  var calYM = null; // {y, m}

  function renderCycle() {
    var c = getCycle();
    if (!calYM) {
      var n0 = new Date();
      calYM = { y: n0.getFullYear(), m: n0.getMonth() };
    }
    var y = calYM.y, m = calYM.m;
    var first = new Date(y, m, 1);
    var startPad = first.getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startPad; i++) cells.push('<div class="hp-cal-cell mute"></div>');
    var today = todayStr();
    for (var d = 1; d <= days; d++) {
      var ds = y + '-' + pad(m + 1) + '-' + pad(d);
      var cls = 'hp-cal-cell';
      if (isPeriodDay(c, ds)) cls += ' period';
      else if (isPredictDay(c, ds)) cls += ' predict';
      if (ds === today) cls += ' today';
      cells.push('<div class="' + cls + '">' + d + '</div>');
    }

    var avg = avgCycle(c);
    var nxt = nextStart(c, today);
    var lastStart = lastStartBefore(c, today);
    var day = cycleDay(c, today);
    var ph = phaseOf(c, today);

    var starts = c.starts.slice().sort();
    var recent = starts.slice(-6);
    var gaps = [];
    for (var j = 1; j < recent.length; j++) gaps.push(diffDays(recent[j], recent[j - 1]));
    var diffTxt = '—';
    if (gaps.length >= 2) {
      var mean = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
      var dev = Math.round(gaps.reduce(function (a, b) { return a + Math.abs(b - mean); }, 0) / gaps.length);
      diffTxt = '±' + dev + ' 天';
    }

    var log = c.logs[today] || {};
    var syms = Array.isArray(log.symptoms) ? log.symptoms : [];

    var html = '';
    html += '<div class="hp-card-box">';
    html += '<div class="hp-cal-head"><div class="hp-cal-month">' + y + '年' + (m + 1) + '月</div>' +
      '<div class="hp-cal-nav"><button onclick="hpShiftCycleMonth(-1)">‹</button><button onclick="hpShiftCycleMonth(1)">›</button></div></div>';
    html += '<div class="hp-cal-week">' + WEEK.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>';
    html += '<div class="hp-cal-grid">' + cells.join('') + '</div>';
    html += '<div class="hp-legend"><span><i style="background:rgba(233,116,138,.35)"></i>记录到的经期</span><span><i style="border:1px solid #E9748A"></i>预测</span><span><i style="box-shadow:inset 0 0 0 1px #6FD3C0"></i>今天</span></div>';
    html += '</div>';

    html += '<div class="hp-cycle-sum">' +
      '<div><b>' + (avg || 28) + '</b><span>平均周期（天）</span></div>' +
      '<div><b>' + c.periodLen + '</b><span>经期长度（天）</span></div>' +
      '<div><b>' + (diffTxt) + '</b><span>预测波动</span></div>' +
      '</div>';

    html += '<div class="hp-sec"><div class="hp-sec-title"><span>今天的状态</span><span class="hp-link">' +
      (day ? '第 ' + day + ' 天 · ' + ph.label : '未开始') + '</span></div>' +
      '<div class="hp-chips">' +
      SYMPTOMS.map(function (s) {
        return '<span class="hp-chip' + (syms.indexOf(s) >= 0 ? ' on' : '') + '" onclick="hpToggleSymptom(\'' + s + '\')">' + s + '</span>';
      }).join('') +
      '</div></div>';

    var todayIsStart = c.starts.indexOf(today) >= 0;
    var inPeriod = isPeriodDay(c, today);
    var lastS = lastStartBefore(c, today);
    var endedToday = !!(c.ends && lastS && c.ends[lastS] === today);
    var btnLabel = todayIsStart ? '撤销今天的打卡'
      : (endedToday ? '撤销「结束」标记'
        : (inPeriod ? '这次经期结束了' : '今天来月经了'));
    html += '<button class="hp-primary' + ((todayIsStart || inPeriod || endedToday) ? ' ghost' : ' pink') + '" onclick="hpTogglePeriodStart()">' + btnLabel + '</button>';
    if (lastStart) {
      html += '<div class="hp-hint">最近一次开始：' + lastStart + '（' + diffDays(today, lastStart) + ' 天前）' +
        (nxt ? '　预测下次：' + nxt : '') + '</div>';
    } else {
      html += '<div class="hp-hint">记两三次之后，预测会越来越准。</div>';
    }

    document.getElementById('hp-cycle').innerHTML = html;
  }

  // ---------- 渲染：睡眠 ----------
  function renderSleep() {
    var all = getSleep();
    var sl = lastSleep();
    var html = '';

    var dur = sl ? sleepDur(sl) : 0;
    html += '<div class="hp-card-box">';
    html += '<div class="hp-card-label"><span class="hp-dot blue"></span>' + (sl ? (sl.date === todayStr() ? '昨晚' : String(sl.date).slice(5) + ' 那晚') : '还没有记录') + '</div>';
    if (sl) {
      html += '<div class="hp-sleep-hero" style="margin-top:8px"><div class="hp-sleep-big">' + Math.floor(dur / 60) + '</div><div class="hp-sleep-unit">小时 ' + (dur % 60) + ' 分</div></div>';
      html += '<div class="hp-sleep-time"><div>入睡<b>' + esc(sl.bed || '—') + '</b></div><div>起床<b>' + esc(sl.wake || '—') + '</b></div><div>质量<b>' + (Number(sl.quality) || 0) + ' / 5</b></div></div>';
      html += '<div class="hp-quality">' + [1, 2, 3, 4, 5].map(function (i) {
        return '<i class="' + (i <= (Number(sl.quality) || 0) ? 'on' : '') + '"></i>';
      }).join('') + '</div>';
    } else {
      html += '<div class="hp-empty">记一次昨晚，后面就能看出规律</div>';
    }
    html += '</div>';

    html += '<div class="hp-sec"><div class="hp-sec-title"><span>近 14 天</span><span class="hp-link" onclick="hpOpenSleepSheet()">记昨晚</span></div>';
    html += '<div class="hp-card-box">';
    var series = [];
    for (var i = 13; i >= 0; i--) {
      var ds = addDays(todayStr(), -i);
      var rec = all.filter(function (r) { return r.date === ds; })[0];
      series.push({ date: ds, min: rec ? sleepDur(rec) : 0 });
    }
    var maxMin = Math.max(600, Math.max.apply(null, series.map(function (s) { return s.min; })));
    html += '<div class="hp-bars">' + series.map(function (s) {
      var h = s.min ? Math.max(6, Math.round((s.min / maxMin) * 68)) : 3;
      return '<div class="' + (s.min ? '' : 'empty') + '" title="' + (s.min ? durText(s.min) : '没记') + '"><i style="height:' + h + 'px"></i></div>';
    }).join('') + '</div>';
    html += '<div class="hp-bar-labels">' + series.map(function (s) {
      return '<span>' + String(s.date).slice(8) + '</span>';
    }).join('') + '</div>';
    html += '</div></div>';

    // 梦境
    var dreams = all.filter(function (r) { return r.dream && String(r.dream).trim(); });
    html += '<div class="hp-sec"><div class="hp-sec-title"><span>梦境</span><span class="hp-link" onclick="hpOpenDreamSheet()">记一个梦</span></div>';
    if (!dreams.length) {
      html += '<div class="hp-empty">还没记过梦。醒来那几分钟记最清楚。</div>';
    } else {
      dreams.slice(0, 5).forEach(function (r) {
        html += '<div class="hp-dream">' +
          '<div class="hp-dream-head"><span>' + esc(String(r.date).slice(5)) + '</span><span>' + (Number(r.quality) ? '睡 ' + durText(sleepDur(r)) : '') + '</span></div>' +
          '<div class="hp-dream-text">' + esc(r.dream) + '</div>' +
          (Array.isArray(r.tags) && r.tags.length ? '<div class="hp-dream-tags">' + r.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '</div>';
      });
    }
    html += '</div>';

    document.getElementById('hp-sleep').innerHTML = html;
  }

  // ---------- 渲染：身体 ----------
  function renderBody() {
    var b = getBody();
    var w = lastWeight();
    var t = todayStr();
    var bmi = '';
    if (w && b.height) {
      var mtr = b.height / 100;
      bmi = (Number(w.kg) / (mtr * mtr)).toFixed(1);
    }

    var html = '';
    html += '<div class="hp-card-box">';
    html += '<div class="hp-card-label"><span class="hp-dot amber"></span>身体档案</div>';
    html += '<div class="hp-body-two">' +
      '<div class="hp-kv"><span>身高</span><b>' + (b.height ? b.height + '<small style="font-size:12px;color:#8C97A6"> cm</small>' : '—') + '</b></div>' +
      '<div class="hp-kv"><span>体重</span><b>' + (w ? Number(w.kg).toFixed(1) + '<small style="font-size:12px;color:#8C97A6"> kg</small>' : '—') + '</b></div>' +
      '<div class="hp-kv"><span>BMI</span><b>' + (bmi || '—') + '</b></div>' +
      '<div class="hp-kv"><span>喝水（今天）</span><b>' + (Number(b.water[t]) || 0) + '<small style="font-size:12px;color:#8C97A6"> 杯</small></b></div>' +
      '</div>';
    html += '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button class="hp-primary" style="margin-top:0;flex:1;padding:11px;font-size:12.5px" onclick="hpOpenWeight()">记体重</button>' +
      '<button class="hp-primary ghost" style="margin-top:0;flex:1;padding:11px;font-size:12.5px" onclick="hpOpenHeight()">改身高</button>' +
      '</div>';
    html += '</div>';

    // 体重曲线
    html += '<div class="hp-sec"><div class="hp-sec-title"><span>体重曲线</span><span class="hp-link">' + (b.weights.length ? b.weights.length + ' 次记录' : '') + '</span></div><div class="hp-card-box">';
    var pts = b.weights.slice().sort(function (x, y) { return String(x.date) > String(y.date) ? 1 : -1; }).slice(-30);
    html += sparkSVG(pts.map(function (p) { return Number(p.kg); }), pts);
    html += '</div></div>';

    // 步数 / 喝水 / 机时
    var steps = Number(b.steps[t]) || 0;
    var cups = Number(b.water[t]) || 0;
    var mins = Number(getUsage()[t]) || 0;
    html += '<div class="hp-sec"><div class="hp-sec-title"><span>今天</span></div>';
    html += '<div class="hp-cards">' +
      card('步数', 'mint', steps ? steps.toLocaleString() + '<small>步</small>' : '—', steps ? '手记的步数' : '点一下记账', 'hpOpenSteps()') +
      card('喝水', 'mint', cups + '<small>杯</small>', cups >= 8 ? '够了' : '还差 ' + Math.max(0, 8 - cups) + ' 杯', 'hpBumpWater()') +
      card('机时', 'blue', mins + '<small>分钟</small>', '自动累计，每分钟 +1', 'hpSwitchTab(\'body\')') +
      card('睡眠', 'blue', (function () {
        var sl = lastSleep();
        return sl ? (Math.floor(sleepDur(sl) / 60) + '<small>h</small>') : '—';
      })(), '点进去记昨晚的梦', 'hpSwitchTab(\'sleep\')') +
      '</div></div>';

    document.getElementById('hp-body-wrap').innerHTML = html;
  }

  function sparkSVG(values, pts) {
    if (!values.length) return '<div class="hp-empty">还没有体重记录</div>';
    var W = 320, H = 96, pad2 = 8;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (max === min) { max = min + 1; }
    var stepX = values.length > 1 ? (W - pad2 * 2) / (values.length - 1) : 0;
    var coords = values.map(function (v, i) {
      var x = pad2 + stepX * i;
      var y = H - pad2 - ((v - min) / (max - min)) * (H - pad2 * 2);
      return [Math.round(x), Math.round(y)];
    });
    var path = coords.map(function (c, i) { return (i ? 'L' : 'M') + c[0] + ' ' + c[1]; }).join(' ');
    var lastIdx = values.length - 1;
    return '<div class="hp-spark"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<path d="' + path + '" fill="none" stroke="#E7B75F" stroke-width="1.6" stroke-linejoin="round" />' +
      coords.map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="2.4" fill="#E7B75F" />'; }).join('') +
      '</svg>' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;color:#6E7888;margin-top:2px">' +
      '<span>' + esc(String(pts[0].date).slice(5)) + '</span>' +
      '<span>' + esc(String(pts[pts.length - 1].date).slice(5)) + '</span></div>' +
      '<div style="font-size:11px;color:#8C97A6;margin-top:2px">当前 ' + values[lastIdx].toFixed(1) + ' kg · 区间 ' + min.toFixed(1) + '–' + max.toFixed(1) + '</div></div>';
  }

  // ---------- tab 切换 ----------
  var curTab = 'today';
  function hpSwitchTab(name) {
    curTab = name;
    ['today', 'cycle', 'sleep', 'body'].forEach(function (k) {
      var p = document.getElementById('hp-panel-' + k);
      var tab = document.getElementById('hp-tab-' + k);
      if (p) p.style.display = (k === name ? 'block' : 'none');
      if (tab) tab.classList.toggle('on', k === name);
    });
    var bodyEl = document.getElementById('hp-body');
    if (bodyEl) bodyEl.scrollTop = 0;
    hpRenderAll();
  }

  function hpRenderAll() {
    if (curTab === 'today') renderToday();
    else if (curTab === 'cycle') renderCycle();
    else if (curTab === 'sleep') renderSleep();
    else if (curTab === 'body') renderBody();
  }

  // ---------- 弹层通用 ----------
  function openSheet(title, inner, onMount) {
    closeSheet();
    var layer = document.createElement('div');
    layer.className = 'hp-layer';
    layer.id = 'hp-layer';
    layer.innerHTML = '<div class="hp-sheet"><div class="hp-sheet-title"><span>' + title +
      '</span><button class="hp-close" onclick="hpCloseSheet()">×</button></div>' + inner + '</div>';
    layer.addEventListener('click', function (e) {
      if (e.target === layer) closeSheet();
    });
    var host = document.getElementById('page-health') || document.body;
    host.appendChild(layer);
    if (typeof onMount === 'function') onMount(layer);
    return layer;
  }
  function closeSheet() {
    var l = document.getElementById('hp-layer');
    if (l) l.remove();
  }

  // ---------- 交互：周期 ----------
  function hpShiftCycleMonth(n) {
    if (!calYM) return;
    var d = new Date(calYM.y, calYM.m + n, 1);
    calYM = { y: d.getFullYear(), m: d.getMonth() };
    renderCycle();
  }

  function hpToggleSymptom(name) {
    var c = getCycle();
    var t = todayStr();
    var log = c.logs[t] || {};
    var syms = Array.isArray(log.symptoms) ? log.symptoms : [];
    var i = syms.indexOf(name);
    if (i >= 0) syms.splice(i, 1); else syms.push(name);
    log.symptoms = syms;
    c.logs[t] = log;
    saveCycle(c);
    renderCycle();
  }

  function hpTogglePeriodStart() {
    var c = getCycle();
    var t = todayStr();
    var starts = c.starts.slice().sort();
    var last = lastStartBefore(c, t);

    if (starts.indexOf(t) >= 0) {
      c.starts = c.starts.filter(function (s) { return s !== t; });
      if (c.ends && c.ends[t]) delete c.ends[t];
      saveCycle(c);
      toast('撤销了今天的打卡');
      hpRenderAll();
      return;
    }

    if (last && c.ends && c.ends[last] === t) {
      delete c.ends[last];
      saveCycle(c);
      toast('撤销了「结束」标记');
      hpRenderAll();
      return;
    }

    if (last && isPeriodDay(c, t)) {
      c.ends = c.ends || {};
      c.ends[last] = t;
      saveCycle(c);
      toast('记下了，这次经期到 ' + fmtCN(t) + ' 结束');
      hpRenderAll();
      return;
    }

    c.starts.push(t);
    var log = c.logs[t] || {};
    log.flow = log.flow || 'normal';
    c.logs[t] = log;
    saveCycle(c);
    toast('记下了，' + fmtCN(t) + ' 开始');
    hpRenderAll();
  }

  // ---------- 交互：睡眠 / 梦 ----------
  var sheetState = { bed: '23:30', wake: '07:00', quality: 3, date: '' };

  function hpOpenSleepSheet(dateStr) {
    var rec = getSleep().filter(function (r) { return r.date === (dateStr || todayStr()); })[0] || null;
    sheetState.bed = rec && rec.bed ? rec.bed : '23:30';
    sheetState.wake = rec && rec.wake ? rec.wake : '07:00';
    sheetState.quality = rec && rec.quality ? Number(rec.quality) : 3;
    sheetState.date = (dateStr || todayStr());

    openSheet('记昨晚的睡眠',
      '<div class="hp-field"><div class="hp-field-label">日期（哪一晚醒来的）</div>' +
      '<input class="hp-input" id="hp-sl-date" type="date" value="' + sheetState.date + '"></div>' +
      '<div class="hp-row"><div class="hp-field"><div class="hp-field-label">入睡</div>' +
      '<div class="hp-stepper"><button onclick="hpStepTime(\'bed\', -30)">−</button><div class="val" id="hp-bed">' + sheetState.bed + '</div><button onclick="hpStepTime(\'bed\', 30)">+</button></div></div>' +
      '<div class="hp-field"><div class="hp-field-label">起床</div>' +
      '<div class="hp-stepper"><button onclick="hpStepTime(\'wake\', -30)">−</button><div class="val" id="hp-wake">' + sheetState.wake + '</div><button onclick="hpStepTime(\'wake\', 30)">+</button></div></div></div>' +
      '<div class="hp-field"><div class="hp-field-label">睡得怎么样</div><div class="hp-quality" id="hp-q">' +
      [1, 2, 3, 4, 5].map(function (i) {
        return '<i class="' + (i <= sheetState.quality ? 'on' : '') + '" style="width:34px;height:8px" onclick="hpSetQuality(' + i + ')"></i>';
      }).join('') + '</div></div>' +
      '<button class="hp-primary" onclick="hpSaveSleepSheet()">存下来</button>');
  }

  function hpStepTime(which, delta) {
    var cur = which === 'bed' ? sheetState.bed : sheetState.wake;
    var mins = minutesOf(cur) + delta;
    while (mins < 0) mins += 1440;
    while (mins >= 1440) mins -= 1440;
    var v = pad(Math.floor(mins / 60)) + ':' + pad(mins % 60);
    if (which === 'bed') sheetState.bed = v; else sheetState.wake = v;
    var el = document.getElementById(which === 'bed' ? 'hp-bed' : 'hp-wake');
    if (el) el.textContent = v;
  }

  function hpSetQuality(v) {
    sheetState.quality = v;
    var q = document.getElementById('hp-q');
    if (!q) return;
    Array.prototype.forEach.call(q.children, function (c, i) {
      c.classList.toggle('on', i < v);
    });
  }

  function hpSaveSleepSheet() {
    var dEl = document.getElementById('hp-sl-date');
    var date = (dEl && dEl.value) ? dEl.value : sheetState.date;
    var all = getSleep();
    var rec = all.filter(function (r) { return r.date === date; })[0];
    if (!rec) { rec = { date: date }; all.push(rec); }
    rec.bed = sheetState.bed;
    rec.wake = sheetState.wake;
    rec.quality = sheetState.quality;
    saveSleep(all);
    closeSheet();
    toast('记下了 · ' + durText(sleepDur(rec)));
    hpRenderAll();
  }

  function hpOpenDreamSheet() {
    var all = getSleep();
    var t = todayStr();
    var rec = all.filter(function (r) { return r.date === t; })[0] || { date: t };
    var chars = (typeof window.getCharacters === 'function' ? window.getCharacters() : []) || [];
    var tags = Array.isArray(rec.tags) ? rec.tags : [];
    var charOptions = ['<option value="">不给谁说</option>'].concat(chars.filter(function (c) { return c && c.name; }).map(function (c) {
      return '<option value="' + esc(String(c.id)) + '">' + esc(c.name) + '</option>';
    })).join('');

    openSheet('记一个梦',
      '<div class="hp-field"><div class="hp-field-label">梦到了什么</div>' +
      '<textarea class="hp-input hp-textarea" id="hp-dream-text" placeholder="醒来的第一句话就行，不用写完整">' + esc(rec.dream || '') + '</textarea></div>' +
      '<div class="hp-field"><div class="hp-field-label">这梦是什么感觉</div><div class="hp-chips" id="hp-dream-tags">' +
      DREAM_TAGS.map(function (tg) {
        return '<span class="hp-chip mint' + (tags.indexOf(tg) >= 0 ? ' on' : '') + '" onclick="hpToggleDreamTag(\'' + tg + '\')">' + tg + '</span>';
      }).join('') + '</div></div>' +
      '<div class="hp-field"><div class="hp-field-label">想讲给谁听（可选）</div>' +
      '<select class="hp-input" id="hp-dream-to">' + charOptions + '</select></div>' +
      '<button class="hp-primary" onclick="hpSaveDream()">存进梦里</button>',
      function (layer) {
        var sel = layer.querySelector('#hp-dream-to');
        if (sel && rec.to) sel.value = rec.to;
      });
  }

  var dreamTagsDraft = null;
  function hpToggleDreamTag(tg) {
    if (!dreamTagsDraft) {
      var all = getSleep();
      var t = todayStr();
      var rec = all.filter(function (r) { return r.date === t; })[0];
      dreamTagsDraft = Array.isArray(rec && rec.tags) ? rec.tags.slice() : [];
    }
    var i = dreamTagsDraft.indexOf(tg);
    if (i >= 0) dreamTagsDraft.splice(i, 1); else dreamTagsDraft.push(tg);
    var box = document.getElementById('hp-dream-tags');
    if (box) {
      Array.prototype.forEach.call(box.children, function (c) {
        c.classList.toggle('on', dreamTagsDraft.indexOf(c.textContent) >= 0);
      });
    }
  }

  function hpSaveDream() {
    var tEl = document.getElementById('hp-dream-text');
    var toEl = document.getElementById('hp-dream-to');
    var text = tEl ? tEl.value.trim() : '';
    if (!text) { toast('先写一句梦'); return; }
    var all = getSleep();
    var t = todayStr();
    var rec = all.filter(function (r) { return r.date === t; })[0];
    if (!rec) { rec = { date: t, quality: 3 }; all.push(rec); }
    rec.dream = text;
    rec.tags = dreamTagsDraft || [];
    rec.to = toEl ? toEl.value : '';
    saveSleep(all);
    dreamTagsDraft = null;
    closeSheet();
    toast('梦收下了');
    hpRenderAll();
  }

  // ---------- 交互：身体 ----------
  function hpOpenWeight() {
    var w = lastWeight();
    openSheet('记体重',
      '<div class="hp-field"><div class="hp-field-label">体重（kg）</div>' +
      '<input class="hp-input" id="hp-weight-input" type="number" step="0.1" min="20" max="300" value="' + (w ? Number(w.kg) : '') + '"></div>' +
      '<div class="hp-field"><div class="hp-field-label">日期</div><input class="hp-input" id="hp-weight-date" type="date" value="' + (w ? String(w.date) : todayStr()) + '"></div>' +
      '<button class="hp-primary" onclick="hpSaveWeight()">存下来</button>');
  }

  function hpSaveWeight() {
    var iEl = document.getElementById('hp-weight-input');
    var dEl = document.getElementById('hp-weight-date');
    var kg = iEl ? Number(iEl.value) : 0;
    if (!kg || kg <= 0) { toast('填个体重'); return; }
    var date = (dEl && dEl.value) ? dEl.value : todayStr();
    var b = getBody();
    var rec = b.weights.filter(function (x) { return x.date === date; })[0];
    if (rec) rec.kg = kg; else b.weights.push({ date: date, kg: kg });
    saveBody(b);
    closeSheet();
    toast('记下了 ' + kg.toFixed(1) + ' kg');
    hpRenderAll();
  }

  function hpOpenHeight() {
    var b = getBody();
    openSheet('身高',
      '<div class="hp-field"><div class="hp-field-label">身高（cm）</div>' +
      '<input class="hp-input" id="hp-height-input" type="number" step="0.5" min="100" max="230" value="' + (b.height || '') + '"></div>' +
      '<button class="hp-primary" onclick="hpSaveHeight()">存下来</button>');
  }

  function hpSaveHeight() {
    var el = document.getElementById('hp-height-input');
    var h = el ? Number(el.value) : 0;
    if (!h) { toast('填个身高'); return; }
    var b = getBody();
    b.height = h;
    saveBody(b);
    closeSheet();
    hpRenderAll();
  }

  function hpBumpWater() {
    var b = getBody();
    var t = todayStr();
    var cur = Number(b.water[t]) || 0;
    if (cur >= 20) return;
    b.water[t] = cur + 1;
    saveBody(b);
    toast('第 ' + b.water[t] + ' 杯');
    hpRenderAll();
  }

  function hpOpenSteps() {
    var b = getBody();
    var t = todayStr();
    openSheet('今天的步数',
      '<div class="hp-field"><div class="hp-field-label">步数</div>' +
      '<input class="hp-input" id="hp-steps-input" type="number" step="100" min="0" max="60000" value="' + (Number(b.steps[t]) || '') + '"></div>' +
      '<div class="hp-hint">iPhone 的健康数据可以每天导出后导入，后面再加；现在先手记。</div>' +
      '<button class="hp-primary" onclick="hpSaveSteps()">存下来</button>');
  }

  function hpSaveSteps() {
    var el = document.getElementById('hp-steps-input');
    var v = el ? Number(el.value) : 0;
    var b = getBody();
    b.steps[todayStr()] = Math.max(0, Math.min(60000, v || 0));
    saveBody(b);
    closeSheet();
    hpRenderAll();
  }

  // ---------- 可见性 ----------
  function getVis() {
    var v = loadJSON(K.vis, null) || {};
    return {
      privateMode: (v.privateMode === 'only' ? 'only' : 'none'),
      privateAllow: Array.isArray(v.privateAllow) ? v.privateAllow.map(String) : [],
      dailyMode: (['all', 'only', 'none'].indexOf(v.dailyMode) >= 0 ? v.dailyMode : 'all'),
      dailyAllow: Array.isArray(v.dailyAllow) ? v.dailyAllow.map(String) : [],
      dailyBlock: Array.isArray(v.dailyBlock) ? v.dailyBlock.map(String) : []
    };
  }
  function saveVis(v) { saveJSON(K.vis, v); }

  function canSeePrivate(charId) {
    var v = getVis();
    if (v.privateMode !== 'only') return false;
    if (!charId) return false;
    return v.privateAllow.indexOf(String(charId)) >= 0;
  }
  function canSeeDaily(charId) {
    var v = getVis();
    var id = charId ? String(charId) : '';
    if (v.dailyMode === 'none') return false;
    if (v.dailyMode === 'only') {
      if (!id) return false;
      return v.dailyAllow.indexOf(id) >= 0;
    }
    if (!id) return true;
    return v.dailyBlock.indexOf(id) < 0;
  }

  // ---------- 设置弹层 ----------
  function hpOpenSettings() {
    openSheet('健康 · 设置', visPanelHTML() +
      '<div class="hp-field" style="margin-top:18px"><div class="hp-field-label">数据</div>' +
      '<button class="hp-primary ghost" onclick="hpClearAll()">清空健康数据</button></div>' +
      '<div class="hp-hint">周期和梦境是私密档，默认谁都不给看；睡眠、步数、体重、喝水、机时是日常档。角色只能看到你放行的那部分，没放行的连暗示都不会有。</div>');
  }

  function visPanelHTML() {
    var v = getVis();
    var chars = ((typeof window.getCharacters === 'function' ? window.getCharacters() : []) || [])
      .filter(function (c) { return c && c.id && !c.deleted; });

    // 私密档 / 日常档各自的角色开关
    var privateRows = chars.map(function (c) {
      var on = v.privateAllow.indexOf(String(c.id)) >= 0;
      var ava = c.avatar ? '<img src="' + esc(c.avatar) + '">' : '<span>🙂</span>';
      return '<div class="hp-vis-row"><span class="hp-vis-ava">' + ava + '</span>' +
        '<span class="hp-vis-name">' + esc(c.name || '未命名') + '</span>' +
        '<span class="hp-switch' + (on ? ' on' : '') + '" onclick="hpToggleVis(\'private\', \'' + esc(String(c.id)) + '\')"><i></i></span></div>';
    }).join('');

    var dailyRows = chars.map(function (c) {
      var vis = (v.dailyMode === 'only')
        ? v.dailyAllow.indexOf(String(c.id)) >= 0
        : v.dailyBlock.indexOf(String(c.id)) < 0;
      var ava = c.avatar ? '<img src="' + esc(c.avatar) + '">' : '<span>🙂</span>';
      return '<div class="hp-vis-row"><span class="hp-vis-ava">' + ava + '</span>' +
        '<span class="hp-vis-name">' + esc(c.name || '未命名') + '</span>' +
        '<span class="hp-switch' + (vis ? ' on' : '') + '" onclick="hpToggleVis(\'daily\', \'' + esc(String(c.id)) + '\')"><i></i></span></div>';
    }).join('');

    return '<div class="hp-field"><div class="hp-field-label">私密档 · 周期与梦境</div>' +
      '<div class="hp-vis-seg">' +
      '<span class="' + (v.privateMode === 'only' ? 'on' : '') + '" onclick="hpSetVisMode(\'private\', \'only\')">给选中的人看</span>' +
      '<span class="' + (v.privateMode !== 'only' ? 'on' : '') + '" onclick="hpSetVisMode(\'private\', \'none\')">谁都不给看</span>' +
      '</div>' +
      (v.privateMode === 'only' ? (privateRows || '<div class="hp-empty">还没有角色</div>') : '') +
      '</div>' +
      '<div class="hp-field"><div class="hp-field-label">日常档 · 睡眠 / 体重 / 步数 / 喝水 / 机时</div>' +
      '<div class="hp-vis-seg">' +
      '<span class="' + (v.dailyMode === 'all' ? 'on' : '') + '" onclick="hpSetVisMode(\'daily\', \'all\')">全部可见</span>' +
      '<span class="' + (v.dailyMode === 'only' ? 'on' : '') + '" onclick="hpSetVisMode(\'daily\', \'only\')">只给选中的</span>' +
      '<span class="' + (v.dailyMode === 'none' ? 'on' : '') + '" onclick="hpSetVisMode(\'daily\', \'none\')">都不给看</span>' +
      '</div>' +
      (v.dailyMode === 'none' ? '' : (dailyRows || '<div class="hp-empty">还没有角色</div>')) +
      '</div>';
  }

  function refreshVisSheet() {
    var sheet = document.querySelector('#hp-layer .hp-sheet');
    if (!sheet) return;
    sheet.innerHTML = '<div class="hp-sheet-title"><span>健康 · 设置</span><button class="hp-close" onclick="hpCloseSheet()">×</button></div>' +
      visPanelHTML() +
      '<div class="hp-field" style="margin-top:18px"><div class="hp-field-label">数据</div>' +
      '<button class="hp-primary ghost" onclick="hpClearAll()">清空健康数据</button></div>' +
      '<div class="hp-hint">周期和梦境是私密档，默认谁都不给看；睡眠、步数、体重、喝水、机时是日常档。</div>';
  }

  function hpSetVisMode(kind, mode) {
    var v = getVis();
    if (kind === 'private') v.privateMode = (mode === 'only' ? 'only' : 'none');
    else v.dailyMode = (['all', 'only', 'none'].indexOf(mode) >= 0 ? mode : 'all');
    saveVis(v);
    refreshVisSheet();
  }

  function hpToggleVis(kind, id) {
    if (!id) return;
    var v = getVis();
    id = String(id);
    if (kind === 'private') {
      var i = v.privateAllow.indexOf(id);
      if (i >= 0) v.privateAllow.splice(i, 1); else v.privateAllow.push(id);
    } else {
      if (v.dailyMode === 'none') { toast('先换成「只给选中的」或「全部可见」'); return; }
      var arr = (v.dailyMode === 'only') ? v.dailyAllow : v.dailyBlock;
      var j = arr.indexOf(id);
      if (j >= 0) arr.splice(j, 1); else arr.push(id);
    }
    saveVis(v);
    refreshVisSheet();
  }

  function hpClearAll() {
    if (!confirm('清空健康数据？周期、睡眠、梦境、体重都会没有，不能恢复。')) return;
    [K.cycle, K.sleep, K.body, K.usage].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    closeSheet();
    calYM = null;
    hpRenderAll();
    toast('清空了');
  }

  // ---------- 给 AI 的摘要 ----------
  window.getHealthSummaryForAi = function (opts) {
    try {
      var o = opts || {};
      var charId = o.charId || o.characterId || '';
      var charName = o.charName || '这个角色';
      var c = getCycle();
      var t = todayStr();
      var pri = canSeePrivate(charId);
      var dai = canSeeDaily(charId);

      if (!pri && !dai) {
        return '【健康】：user 没让「' + charName + '」看她的身体数据。你不知道她的周期、睡眠、体重、步数，也不要猜、不要问"是不是快来了"，更不要提这些。';
      }

      var lines = ['【健康 · 实时】'];
      var day = cycleDay(c, t);
      var nxt = nextStart(c, t);
      var sl = lastSleep();
      var w = lastWeight();
      var b = getBody();
      var usage = getUsage()[t];

      if (pri) {
        if (day) {
          var ph = phaseOf(c, t);
          lines.push('- 周期：第 ' + day + ' 天（' + ph.label + '）' + (nxt ? '，预测下次 ' + nxt : '') +
            '，平均周期 ' + avgCycle(c) + ' 天、经期 ' + c.periodLen + ' 天');
          var log = c.logs[t] || {};
          if (Array.isArray(log.symptoms) && log.symptoms.length) {
            lines.push('- 今天的状态标签：' + log.symptoms.join('、'));
          }
        } else {
          lines.push('- 周期：她还没记过经期');
        }
        var dreams = getSleep().filter(function (r) { return r.dream && String(r.dream).trim(); }).slice(0, 2);
        if (dreams.length) {
          lines.push('- 最近的梦：' + dreams.map(function (r) {
            return String(r.date).slice(5) + '「' + String(r.dream).slice(0, 60) + '」' +
              (Array.isArray(r.tags) && r.tags.length ? '（' + r.tags.join('/') + '）' : '');
          }).join('；'));
          var toMe = dreams.filter(function (r) { return r.to && String(r.to) === String(charId); });
          if (toMe.length) lines.push('- 她把这个梦标了「想讲给你听」，可以主动提一句');
        }
      }

      if (dai) {
        if (sl) {
          var durMin = sleepDur(sl);
          lines.push('- 睡眠：' + (sl.date === t ? '昨晚（今早起床）' : String(sl.date).slice(5) + ' 起床那晚') +
            ' ' + durText(durMin) + '（' + (sl.bed || '') + '–' + (sl.wake || '') + '），质量 ' + (Number(sl.quality) || 0) + '/5');
        }
        if (w) lines.push('- 体重：' + Number(w.kg).toFixed(1) + ' kg（' + String(w.date).slice(5) + ' 记录）');
        var steps = Number(b.steps[t]) || 0;
        var cups = Number(b.water[t]) || 0;
        if (steps) lines.push('- 步数：今天 ' + steps + ' 步');
        if (cups) lines.push('- 喝水：今天 ' + cups + ' 杯');
        if (usage) lines.push('- 机时：今天在小手机上待了 ' + usage + ' 分钟');
      }

      if (lines.length === 1) lines.push('- 她最近没记什么，别追问');

      lines.push('*铁律*：这是她真实的身体，不是设定。别评判她的体重、别下诊断、别催她早睡；经期和睡眠的事顺着她说，只在她提起时接。');
      return lines.join('\n');
    } catch (e) {
      console.error('健康摘要失败', e);
      return '【健康】：读取失败。';
    }
  };

  // ---------- 渲染入口 ----------
  window.renderHealthApp = function () {
    hpRenderAll();
  };
  window.hpSwitchTab = hpSwitchTab;
  window.hpShiftCycleMonth = hpShiftCycleMonth;
  window.hpToggleSymptom = hpToggleSymptom;
  window.hpTogglePeriodStart = hpTogglePeriodStart;
  window.hpOpenSleepSheet = hpOpenSleepSheet;
  window.hpStepTime = hpStepTime;
  window.hpSetQuality = hpSetQuality;
  window.hpSaveSleepSheet = hpSaveSleepSheet;
  window.hpOpenDreamSheet = hpOpenDreamSheet;
  window.hpToggleDreamTag = hpToggleDreamTag;
  window.hpSaveDream = hpSaveDream;
  window.hpOpenWeight = hpOpenWeight;
  window.hpSaveWeight = hpSaveWeight;
  window.hpOpenHeight = hpOpenHeight;
  window.hpSaveHeight = hpSaveHeight;
  window.hpBumpWater = hpBumpWater;
  window.hpOpenSteps = hpOpenSteps;
  window.hpSaveSteps = hpSaveSteps;
  window.hpOpenSettings = hpOpenSettings;
  window.hpSetVisMode = hpSetVisMode;
  window.hpToggleVis = hpToggleVis;
  window.hpClearAll = hpClearAll;
  window.hpCloseSheet = closeSheet;

  // ---------- 机时自动累计 ----------
  setInterval(function () {
    try {
      if (document.visibilityState !== 'visible') return;
      var t = todayStr();
      var u = getUsage();
      u[t] = (Number(u[t]) || 0) + 1;
      saveUsage(u);
    } catch (e) {}
  }, 60000);
})();
