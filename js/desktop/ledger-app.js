/* =========================================================
   记账 App v4 · iCost 形态（账本 / 资产 / 统计 / 工资库）
   依赖 ledger.js 的存储与工具函数（全局作用域）
   ========================================================= */

(function () {
  'use strict';

  var WAGE_KEY = 'momo_ledger_wage_v1';
  var ASSET_KINDS = ['asset', 'debt'];

  var laTab = 'book';
  var laSearchText = '';
  var laStatsRange = 'month';
  var laStatsOffset = 0;

  // ---------- 工具 ----------
  function laMoney(n) {
    var v = Number(n) || 0;
    var neg = v < 0;
    var s = Math.abs(v).toFixed(2);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-¥' : '¥') + parts.join('.');
  }

  function laSignedMoney(n) {
    var v = Number(n) || 0;
    if (v === 0) return '¥0.00';
    return (v < 0 ? '-¥' : '¥') + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function laTimeOf(dateStr) {
    var s = String(dateStr || '');
    return s.length >= 16 ? s.slice(11, 16) : '';
  }

  function laDateOf(dateStr) {
    return String(dateStr || '').slice(0, 10);
  }

  function laWeekCN(dateStr) {
    var d = new Date(String(dateStr).replace(/-/g, '/'));
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  }

  function laMonthLabel(ym) {
    var p = String(ym).split('-');
    return p[0] + '年' + Number(p[1]) + '月';
  }

  function laShiftMonthStr(ym, delta) {
    var p = String(ym).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
  }

  // ---------- tab ----------
  function laSwitchTab(name) {
    laTab = name;
    ['book', 'assets', 'stats', 'wage'].forEach(function (t) {
      var panel = document.getElementById('la-panel-' + t);
      var tab = document.getElementById('la-tab-' + t);
      if (panel) panel.classList.toggle('active', t === name);
      if (tab) tab.classList.toggle('active', t === name);
    });
    if (name === 'assets') laRenderAssets();
    if (name === 'stats') laRenderStats();
    if (name === 'wage') laRenderWage();
  }

  function laRenderAll() {
    laRenderBook();
    if (laTab === 'assets') laRenderAssets();
    if (laTab === 'stats') laRenderStats();
    if (laTab === 'wage') laRenderWage();
  }

  // ---------- 账本 ----------
  function laFilterRecords(recs) {
    var q = (laSearchText || '').trim().toLowerCase();
    if (!q) return recs;
    return recs.filter(function (r) {
      var cat = lgCatById(r.catId);
      var text = [(r.title || ''), (r.note || ''), cat.name].join(' ').toLowerCase();
      return text.indexOf(q) >= 0;
    });
  }

  function laRenderBook() {
    var labelEl = document.getElementById('la-month-label');
    if (labelEl) labelEl.innerText = laMonthLabel(lgMonth);

    var all = loadLedgerRecords();
    var monthRecs = lgRecordsOfMonth(lgMonth);
    var expense = lgSum(monthRecs, 'expense');
    var income = lgSum(monthRecs, 'income');

    var e1 = document.getElementById('la-total-expense');
    if (e1) e1.innerText = laMoney(expense);
    var i1 = document.getElementById('la-total-income');
    if (i1) i1.innerText = laMoney(income);
    var b1 = document.getElementById('la-total-balance');
    if (b1) b1.innerText = laSignedMoney(income - expense);

    // 预算
    var budget = lgLoadBudget();
    var bText = document.getElementById('la-budget-text');
    var bFill = document.getElementById('la-budget-fill');
    if (budget.monthly > 0) {
      var left = budget.monthly - expense;
      if (bText) bText.innerText = laMoney(expense) + ' / ' + laMoney(budget.monthly) + '　' + (left >= 0 ? '余 ' + laMoney(left) : '超 ' + laMoney(-left));
      if (bFill) {
        bFill.style.width = Math.min(100, Math.max(0, expense / budget.monthly * 100)) + '%';
        bFill.style.background = left >= 0 ? 'rgba(255,197,61,.55)' : 'rgba(240,115,107,.65)';
      }
    } else {
      if (bText) bText.innerText = '未设置';
      if (bFill) bFill.style.width = '0%';
    }

    laRenderBookFeed(laFilterRecords(monthRecs));
  }

  function laRenderBookFeed(recs) {
    var box = document.getElementById('la-feed');
    if (!box) return;

    if (!recs.length) {
      box.innerHTML = '<div class="la-empty">' + (laSearchText ? '没有匹配的记录' : '这个月还没有账<br>点右下角 ＋ 记一笔') + '</div>';
      return;
    }

    var groups = {};
    recs.forEach(function (r) {
      var key = laDateOf(r.date) || lgTodayStr();
      (groups[key] = groups[key] || []).push(r);
    });

    var days = Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); });

    box.innerHTML = days.map(function (day) {
      var list = groups[day].slice().sort(function (a, b) { return lgRecTs(b) - lgRecTs(a); });
      var e = lgSum(list, 'expense'), i = lgSum(list, 'income');
      var d = day.slice(5, 7) + '/' + day.slice(8, 10);
      var head = d + ' ' + laWeekCN(day);
      var sums = [];
      if (e) sums.push('支出: ' + laMoney(e));
      if (i) sums.push('收入: ' + laMoney(i));

      var rows = list.map(function (r) {
        var cat = lgCatById(r.catId);
        var acc = lgLoadAccounts().filter(function (a) { return a.id === (r.accountId || 'cash'); })[0];
        var isInc = r.type === 'income';
        var note = r.title || r.note || '';
        return '' +
          '<div class="la-row" onclick="lgOpenRecord(\'' + r.id + '\')">' +
          '<div class="la-row-ico' + (isInc ? ' income' : '') + '">' + cat.icon + '</div>' +
          '<div class="la-row-mid">' +
          '<div class="la-row-cat">' + lgEscape(cat.name) + '</div>' +
          '<div class="la-row-sub">' + laTimeOf(r.date) + (note ? ' · ' + lgEscape(note) : '') + '</div>' +
          '</div>' +
          '<div class="la-row-right">' +
          '<div class="la-row-amt' + (isInc ? ' income' : '') + '">' + (isInc ? '+' : '-') + laMoney(r.amount).replace('¥', '') + '</div>' +
          '<div class="la-row-acc">' + lgEscape(acc ? acc.name : '现金') + '</div>' +
          '</div>' +
          '</div>';
      }).join('');

      return '<div class="la-day">' +
        '<div class="la-day-head"><span class="la-day-date">' + head + '</span><span>' + sums.join(' · ') + '</span></div>' +
        '<div class="la-day-card">' + rows + '</div>' +
        '</div>';
    }).join('');
  }

  function laShiftMonth(delta) {
    lgMonth = laShiftMonthStr(lgMonth, delta);
    renderLedgerApp();
  }

  function laSearch(v) {
    laSearchText = v || '';
    laRenderBook();
  }

  // ---------- 资产 ----------
  var LA_ACC_SUB = { cash: '现金', wechat: '微信钱包', alipay: '支付宝余额', bank: '储蓄卡', credit: '信用卡' };

  function laKindOf(a) {
    if (a.kind === 'debt' || a.kind === 'asset') return a.kind;
    return a.id === 'credit' ? 'debt' : 'asset';
  }

  function laAccountsOfKind(kind) {
    return lgLoadAccounts().filter(function (a) { return laKindOf(a) === kind; });
  }

  function laAccSub(a) {
    if (LA_ACC_SUB[a.id]) return LA_ACC_SUB[a.id];
    return laKindOf(a) === 'debt' ? '应付 · 欠款' : '资金账户';
  }

  function laRenderAssets() {
    var records = loadLedgerRecords();
    var assets = laAccountsOfKind('asset');
    var debts = laAccountsOfKind('debt');

    var gross = assets.reduce(function (s, a) { return s + lgAccountBalance(a.id, records); }, 0);
    var debtSum = debts.reduce(function (s, a) { return s + Math.abs(lgAccountBalance(a.id, records)); }, 0);
    var net = gross - debtSum;

    var netEl = document.getElementById('la-net-assets');
    if (netEl) {
      netEl.innerText = laSignedMoney(net);
      netEl.classList.toggle('neg', net < 0);
    }
    var gEl = document.getElementById('la-gross-assets');
    if (gEl) gEl.innerText = laSignedMoney(gross);
    var dEl = document.getElementById('la-gross-debt');
    if (dEl) dEl.innerText = laSignedMoney(-debtSum);

    var biEl = document.getElementById('la-borrow-in');
    if (biEl) biEl.innerText = laSignedMoney(debtSum);
    var boEl = document.getElementById('la-borrow-out');
    if (boEl) boEl.innerText = laMoney(0);

    var cntEl = document.getElementById('la-acc-count');
    if (cntEl) cntEl.innerText = '(' + assets.length + ')';
    var sumEl = document.getElementById('la-acc-sum');
    if (sumEl) sumEl.innerText = '余额 ' + laSignedMoney(gross);
    var dcntEl = document.getElementById('la-debt-count');
    if (dcntEl) dcntEl.innerText = '(' + debts.length + ')';
    var dsumEl = document.getElementById('la-debt-sum');
    if (dsumEl) dsumEl.innerText = '欠款 ' + laSignedMoney(debtSum);

    var listEl = document.getElementById('la-asset-list');
    if (listEl) {
      listEl.innerHTML = assets.length ? assets.map(function (a) {
        var bal = lgAccountBalance(a.id, records);
        return '' +
          '<div class="la-acc" onclick="lgOpenSettings()">' +
          '<div class="la-acc-ico">' + (a.icon || '💵') + '</div>' +
          '<div class="la-acc-mid"><div class="la-acc-name">' + lgEscape(a.name) + '</div>' +
          '<div class="la-acc-sub">' + laAccSub(a) + '</div></div>' +
          '<div class="la-acc-amt' + (bal < 0 ? ' neg' : '') + '">' + laSignedMoney(bal) + '</div>' +
          '</div>';
      }).join('') : '<div class="la-list-empty">还没有资金账户</div>';
    }

    var debtList = document.getElementById('la-debt-list');
    if (debtList) {
      debtList.innerHTML = debts.length ? debts.map(function (a) {
        var bal = Math.abs(lgAccountBalance(a.id, records));
        return '' +
          '<div class="la-acc" onclick="lgOpenSettings()">' +
          '<div class="la-acc-ico">' + (a.icon || '💳') + '</div>' +
          '<div class="la-acc-mid"><div class="la-acc-name">' + lgEscape(a.name) + '</div>' +
          '<div class="la-acc-sub">' + laAccSub(a) + '</div></div>' +
          '<div class="la-acc-amt' + (bal > 0 ? ' neg' : '') + '">' + (bal > 0 ? '-' + laMoney(bal) : laMoney(0)) + '</div>' +
          '</div>';
      }).join('') : '<div class="la-list-empty">没有应付账户，点右上 ＋ 新增</div>';
    }
  }

  function laAddAccount() {
    var name = prompt('账户名称（例如：助学贷款 / 花呗）');
    if (!name) return;
    var kindAns = prompt('类型：1 = 资金账户（钱），2 = 应付账户（欠款）', '1');
    var kind = String(kindAns) === '2' ? 'debt' : 'asset';
    var balAns = prompt(kind === 'debt' ? '欠款金额（例如 55850）' : '账户余额（例如 4376.72）', '0');
    var balance = Number(String(balAns).replace(/[^0-9.\-]/g, '')) || 0;
    if (kind === 'debt') balance = Math.abs(balance);

    var list = lgLoadAccounts();
    list.push({
      id: 'acc_' + Date.now(),
      name: String(name).slice(0, 12),
      icon: kind === 'debt' ? '💳' : '💵',
      balance: balance,
      kind: kind
    });
    lgSaveAccounts(list);
    laRenderAssets();
    showXianguoToast('已添加账户 · ' + name, 1500);
  }

  // ---------- 统计 ----------
  function laStatsWindow() {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth(), d = now.getDate();

    if (laStatsRange === 'week') {
      var base = new Date(y, m, d + laStatsOffset * 7);
      var dow = (base.getDay() + 6) % 7;
      var start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dow);
      var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { start: start, end: end, mode: 'day' };
    }
    if (laStatsRange === 'month') {
      var bm = new Date(y, m + laStatsOffset, 1);
      return {
        start: new Date(bm.getFullYear(), bm.getMonth(), 1),
        end: new Date(bm.getFullYear(), bm.getMonth() + 1, 0),
        mode: 'day'
      };
    }
    if (laStatsRange === 'year') {
      return {
        start: new Date(y + laStatsOffset, 0, 1),
        end: new Date(y + laStatsOffset, 11, 31),
        mode: 'month'
      };
    }
    return { start: null, end: null, mode: 'month' };
  }

  function laFmtDay(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function laStatsLabel(win) {
    if (laStatsRange === 'all') return '全部记录';
    if (laStatsRange === 'month') return win.start.getFullYear() + '年' + (win.start.getMonth() + 1) + '月';
    if (laStatsRange === 'year') return win.start.getFullYear() + '年';
    return win.start.getFullYear() + '年' + (win.start.getMonth() + 1) + '月' + win.start.getDate() + '日 ~ ' +
      (win.end.getMonth() + 1) + '月' + win.end.getDate() + '日';
  }

  function laRecordsInWindow(win) {
    var all = loadLedgerRecords();
    if (!win.start) return all;
    var s = laFmtDay(win.start), e = laFmtDay(win.end);
    return all.filter(function (r) {
      var key = laDateOf(r.date);
      return key && key >= s && key <= e;
    });
  }

  function laRenderStats() {
    var win = laStatsWindow();
    var labelEl = document.getElementById('la-stats-period');
    if (labelEl) labelEl.innerText = laStatsLabel(win);

    var recs = laRecordsInWindow(win);
    var expense = lgSum(recs, 'expense');
    var income = lgSum(recs, 'income');

    var days = 1;
    if (win.start) days = Math.max(1, Math.round((win.end - win.start) / 86400000) + 1);

    var se = document.getElementById('la-stat-expense');
    if (se) se.innerText = laMoney(expense);
    var si = document.getElementById('la-stat-income');
    if (si) si.innerText = laMoney(income);
    var sb = document.getElementById('la-stat-balance');
    if (sb) {
      sb.innerText = laSignedMoney(income - expense);
      sb.classList.toggle('neg', income - expense < 0);
    }
    var sa = document.getElementById('la-stat-avg');
    if (sa) sa.innerText = laMoney(expense / days);

    // 柱状
    var buckets = [];
    if (laStatsRange === 'year') {
      for (var mo = 0; mo < 12; mo++) {
        var mm = win.start.getFullYear() + '-' + ('0' + (mo + 1)).slice(-2);
        buckets.push({
          label: (mo + 1) + '月',
          value: recs.filter(function (r) { return laDateOf(r.date).slice(0, 7) === mm; })
            .reduce(function (s, r) { return r.type === 'expense' ? s + (Number(r.amount) || 0) : s; }, 0)
        });
      }
    } else if (laStatsRange === 'all') {
      var byMonth = {};
      recs.forEach(function (r) {
        var k = laDateOf(r.date).slice(0, 7);
        if (!k) return;
        if (!byMonth[k]) byMonth[k] = 0;
        if (r.type === 'expense') byMonth[k] += Number(r.amount) || 0;
      });
      Object.keys(byMonth).sort().forEach(function (k) {
        buckets.push({ label: Number(k.slice(5, 7)) + '月', value: byMonth[k] });
      });
    } else {
      var cur = new Date(win.start.getTime());
      while (cur <= win.end) {
        var key = laFmtDay(cur);
        buckets.push({
          label: String(cur.getDate()),
          value: recs.filter(function (r) { return laDateOf(r.date) === key; })
            .reduce(function (s, r) { return r.type === 'expense' ? s + (Number(r.amount) || 0) : s; }, 0)
        });
        cur.setDate(cur.getDate() + 1);
      }
    }

    var chartEl = document.getElementById('la-chart');
    if (chartEl) {
      var max = Math.max.apply(null, buckets.map(function (b) { return b.value; }).concat([1]));
      var avgEl = document.getElementById('la-stat-chart-avg');
      if (avgEl) {
        var avg = buckets.length ? expense / buckets.length : 0;
        avgEl.innerText = '平均值 ' + laMoney(avg);
      }
      chartEl.innerHTML = buckets.map(function (b, idx) {
        var h = Math.max(4, Math.round(b.value / max * 100));
        var isMax = b.value === max && b.value > 0;
        var showLabel = buckets.length <= 15 || idx % 5 === 0 || idx === buckets.length - 1;
        return '<div class="la-chart-col">' +
          '<div class="la-chart-bar' + (isMax ? ' max' : '') + '" style="height:' + h + '%"></div>' +
          '<span class="la-chart-x">' + (showLabel ? b.label : '') + '</span>' +
          '</div>';
      }).join('');
    }

    // 分类占比
    var byCat = {};
    recs.forEach(function (r) {
      if (r.type !== 'expense') return;
      byCat[r.catId] = (byCat[r.catId] || 0) + (Number(r.amount) || 0);
    });
    var ranks = Object.keys(byCat).map(function (id) {
      var cat = lgCatById(id);
      return { id: id, name: cat.name, icon: cat.icon, color: lgCatColor(id), value: byCat[id], amount: byCat[id] };
    }).sort(function (a, b) { return b.value - a.value; });

    var donutSum = document.getElementById('lg-donut-sum');
    if (donutSum) donutSum.innerText = laMoney(expense).replace('¥', '');

    if (typeof lgDrawDonut === 'function') lgDrawDonut(ranks, expense);

    var rankEl = document.getElementById('la-rank');
    if (rankEl) {
      rankEl.innerHTML = ranks.length ? ranks.map(function (r) {
        var pct = expense ? Math.round(r.value / expense * 100) : 0;
        return '<div class="la-rank-row">' +
          '<div class="la-rank-ico">' + r.icon + '</div>' +
          '<div class="la-rank-mid">' +
          '<div class="la-rank-top"><span>' + lgEscape(r.name) + '</span><span>' + laMoney(r.value) + '</span></div>' +
          '<div class="la-rank-bar"><i style="width:' + pct + '%;background:' + r.color + '"></i></div>' +
          '</div>' +
          '<div class="la-rank-pct">' + pct + '%</div>' +
          '</div>';
      }).join('') : '<div class="la-list-empty">这段时间还没有支出</div>';
    }
  }

  function laSetStatsRange(mode) {
    laStatsRange = mode;
    laStatsOffset = 0;
    var seg = document.getElementById('la-stats-seg');
    if (seg) {
      [].forEach.call(seg.children, function (el) {
        el.classList.toggle('active', el.getAttribute('onclick').indexOf("'" + mode + "'") >= 0);
      });
    }
    laRenderStats();
  }

  function laShiftStats(delta) {
    laStatsOffset += delta;
    laRenderStats();
  }

  // ---------- 工资库 ----------
  function laLoadWage() {
    try {
      var raw = localStorage.getItem(WAGE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        return {
          rate: Number(o.rate) || 0,
          days: Array.isArray(o.days) ? o.days : [],
          settled: Array.isArray(o.settled) ? o.settled : []
        };
      }
    } catch (e) {}
    return { rate: 150, days: [], settled: [] };
  }

  function laSaveWage(w) {
    try { localStorage.setItem(WAGE_KEY, JSON.stringify(w)); } catch (e) {}
  }

  function laRenderWage() {
    var w = laLoadWage();
    var pending = w.days.length * w.rate;

    var pEl = document.getElementById('la-wage-pending');
    if (pEl) pEl.innerText = laMoney(pending);
    var dEl = document.getElementById('la-wage-days');
    if (dEl) dEl.innerText = w.days.length;
    var rEl = document.getElementById('la-wage-rate');
    if (rEl) rEl.innerText = laMoney(w.rate);

    var today = lgTodayStr();
    var btn = document.getElementById('la-punch-btn');
    var punched = w.days.indexOf(today) >= 0;
    if (btn) {
      btn.innerText = punched ? '今天已打卡 · 再点取消' : '今天上班打卡';
      btn.classList.toggle('done', punched);
    }

    // 本月打卡格子
    var month = lgTodayStr().slice(0, 7);
    var parts = month.split('-');
    var y = Number(parts[0]), m = Number(parts[1]) - 1;
    var dim = new Date(y, m + 1, 0).getDate();
    var offset = (new Date(y, m, 1).getDay() + 6) % 7;

    var monthDays = w.days.filter(function (d) { return d.slice(0, 7) === month; });
    var mCnt = document.getElementById('la-wage-month');
    if (mCnt) mCnt.innerText = '(' + monthDays.length + ' 天)';
    var mSum = document.getElementById('la-wage-month-sum');
    if (mSum) mSum.innerText = laMoney(monthDays.length * w.rate);

    var grid = document.getElementById('la-punch-grid');
    if (grid) {
      var cells = [];
      for (var i = 0; i < offset; i++) cells.push('<div class="la-punch-cell empty"></div>');
      for (var d = 1; d <= dim; d++) {
        var key = month + '-' + ('0' + d).slice(-2);
        var on = w.days.indexOf(key) >= 0;
        var isToday = key === today;
        cells.push('<div class="la-punch-cell' + (on ? ' on' : '') + (isToday ? ' today' : '') +
          '" onclick="laTogglePunch(\'' + key + '\')"><span class="d">' + d + '</span></div>');
      }
      grid.innerHTML = cells.join('');
    }

    var settleBtn = document.getElementById('la-settle-btn');
    if (settleBtn) {
      settleBtn.disabled = pending <= 0;
      settleBtn.innerText = pending > 0 ? '发工资了 · 结为进账 ' + laMoney(pending) : '还没有待入账工资';
    }

    var logEl = document.getElementById('la-wage-log');
    if (logEl) {
      logEl.innerHTML = w.settled.length ? w.settled.slice().reverse().map(function (s) {
        return '<div class="la-wage-log-row">' +
          '<div><div class="la-wage-log-main">' + lgEscape(s.date || '') + ' · ' + (s.days || 0) + ' 天</div>' +
          '<div class="la-wage-log-sub">结到 ' + lgEscape(s.account || '现金') + '</div></div>' +
          '<div class="la-wage-log-amt">+' + laMoney(s.amount).replace('¥', '¥') + '</div>' +
          '</div>';
      }).join('') : '<div class="la-list-empty">还没有入账记录</div>';
    }
  }

  function laTogglePunch(key) {
    var w = laLoadWage();
    var idx = w.days.indexOf(key);
    if (idx >= 0) w.days.splice(idx, 1);
    else w.days.push(key);
    w.days.sort();
    laSaveWage(w);
    laRenderWage();
  }

  function laToggleTodayPunch() {
    var key = lgTodayStr();
    var w = laLoadWage();
    var idx = w.days.indexOf(key);
    if (idx >= 0) w.days.splice(idx, 1);
    else w.days.push(key);
    laSaveWage(w);
    laRenderWage();
    showXianguoToast(idx >= 0 ? '已取消今天的打卡' : '今天打卡 · +' + laMoney(laLoadWage().rate), 1500);
  }

  function laOpenWageSetting() {
    var w = laLoadWage();
    var v = prompt('日薪金额（每天打卡记多少）', String(w.rate));
    if (v === null) return;
    var rate = Number(String(v).replace(/[^0-9.]/g, '')) || 0;
    w.rate = rate;
    laSaveWage(w);
    laRenderWage();
    showXianguoToast('日薪已设为 ' + laMoney(rate), 1500);
  }

  function laSettleWage() {
    var w = laLoadWage();
    var pending = w.days.length * w.rate;
    if (pending <= 0) return;

    var old = document.getElementById('la-settle-layer');
    if (old) old.remove();

    var assets = laAccountsOfKind('asset');
    var layer = document.createElement('div');
    layer.id = 'la-settle-layer';
    layer.className = 'lg-mask';
    layer.style.zIndex = '70';
    layer.innerHTML = '<div class="lg-sheet" onclick="event.stopPropagation()">' +
      '<div class="lg-sheet-title">' + laMoney(pending) + ' 结到哪个账户</div>' +
      assets.map(function (a) {
        return '<div class="lg-acc-row" onclick="laDoSettleWage(\'' + a.id + '\')">' +
          '<span class="lg-acc-ico">' + (a.icon || '💵') + '</span>' +
          '<span class="lg-acc-name">' + lgEscape(a.name) + '</span>' +
          '<span class="lg-acc-bal">' + laSignedMoney(lgAccountBalance(a.id, loadLedgerRecords())) + '</span>' +
          '</div>';
      }).join('') +
      '<div class="lg-sheet-cancel" onclick="document.getElementById(\'la-settle-layer\').remove()">取消</div>' +
      '</div>';
    layer.onclick = function (e) { if (e.target === layer) layer.remove(); };
    layer.style.display = 'flex';
    document.getElementById('page-ledger').appendChild(layer);
  }

  function laDoSettleWage(accId) {
    var w = laLoadWage();
    var amount = w.days.length * w.rate;
    if (amount <= 0) return;

    var acc = lgLoadAccounts().filter(function (a) { return a.id === accId; })[0];
    var now = new Date();
    var hh = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);

    var rec = {
      id: 'wage_' + Date.now(),
      type: 'income',
      catId: 'salary',
      title: '工资入账',
      amount: amount,
      date: lgTodayStr() + ' ' + hh,
      ts: now.getTime(),
      accountId: accId
    };
    var list = loadLedgerRecords();
    list.push(rec);
    saveLedgerRecords(list);

    w.settled.push({
      id: rec.id,
      amount: amount,
      days: w.days.length,
      date: lgTodayStr(),
      account: acc ? acc.name : '现金'
    });
    w.days = [];
    laSaveWage(w);

    var layer = document.getElementById('la-settle-layer');
    if (layer) layer.remove();

    renderLedgerApp();
    laRenderWage();
    showXianguoToast('工资已入账 · +' + laMoney(amount), 1800);
  }

  // ---------- 账本可见性：谁可以看我的账 ----------
  function laVisState() {
    return (typeof lgLoadVisibility === 'function') ? lgLoadVisibility() : { mode: 'all', allow: [], block: [] };
  }

  function laVisSave(v) {
    if (typeof lgSaveVisibility === 'function') lgSaveVisibility(v);
  }

  function laVisChars() {
    var list = (typeof window.getCharacters === 'function') ? (window.getCharacters() || []) : [];
    return list.filter(function (c) { return c && c.id && !c.deleted; });
  }

  function laVisPanelHTML() {
    var v = laVisState();
    var rows = laVisChars().map(function (c) {
      var visible = (v.mode === 'only')
        ? v.allow.indexOf(String(c.id)) >= 0
        : v.block.indexOf(String(c.id)) < 0;
      var ava = c.avatar ? '<img src="' + c.avatar + '" alt="">' : '<span>🙂</span>';
      return '<div class="la-vis-row" onclick="laToggleVisChar(\'' + String(c.id).replace(/\'/g, '') + '\')">' +
        '<span class="la-vis-ava">' + ava + '</span>' +
        '<span class="la-vis-name">' + lgEscape(c.name || '未命名') + '</span>' +
        '<span class="la-switch' + (visible ? ' on' : '') + '"><i></i></span>' +
        '</div>';
    }).join('');

    var hint = v.mode === 'all'
      ? '现在所有角色都能看到你的余额、流水和待发工资。想把谁蒙在鼓里，关掉他的开关就行。'
      : (v.mode === 'only'
        ? '只有开着开关的角色能看到。关着的人问起钱，他什么都不知道。'
        : '所有角色都看不到你的账，也不会主动提钱。');

    return '<div class="lg-set-sec la-vis-sec">' +
      '<div class="lg-set-title">谁可以看我的账</div>' +
      '<div class="la-vis-seg">' +
      '<span class="' + (v.mode === 'all' ? 'on' : '') + '" onclick="laSetVisMode(\'all\')">全部可见</span>' +
      '<span class="' + (v.mode === 'only' ? 'on' : '') + '" onclick="laSetVisMode(\'only\')">只给选中的</span>' +
      '<span class="' + (v.mode === 'none' ? 'on' : '') + '" onclick="laSetVisMode(\'none\')">都不给看</span>' +
      '</div>' +
      (v.mode === 'none' ? '' : ('<div class="la-vis-list">' + (rows || '<div class="lg-set-hint">还没有角色</div>') + '</div>')) +
      '<div class="lg-set-hint">' + hint + '</div>' +
      '</div>';
  }

  function laReplaceVisPanel() {
    var body = document.getElementById('lg-settings-body');
    if (!body) return;
    var old = body.querySelector('.la-vis-sec');
    var wrap = document.createElement('div');
    wrap.innerHTML = laVisPanelHTML();
    var sec = wrap.firstElementChild;
    if (!sec) return;
    if (old) body.replaceChild(sec, old);
    else body.insertBefore(sec, body.firstChild);
  }

  function laAppendVisPanel() {
    laReplaceVisPanel();
  }

  function laSetVisMode(mode) {
    var v = laVisState();
    v.mode = (['all', 'only', 'none'].indexOf(mode) >= 0) ? mode : 'all';
    laVisSave(v);
    laReplaceVisPanel();
    showXianguoToast(mode === 'all' ? '所有角色都能看' : (mode === 'only' ? '只给选中的人看' : '都不给看'), 1500);
  }

  function laToggleVisChar(id) {
    if (!id) return;
    var v = laVisState();
    if (v.mode === 'none') {
      showXianguoToast('现在是「都不给看」，先换个模式', 1600);
      return;
    }
    id = String(id);
    var arr = (v.mode === 'only') ? v.allow : v.block;
    var i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    laVisSave(v);
    laReplaceVisPanel();
  }

  // ---------- 导出到全局 ----------
  window.laSwitchTab = laSwitchTab;
  window.laRenderAll = laRenderAll;
  window.laRenderBook = laRenderBook;
  window.laRenderAssets = laRenderAssets;
  window.laRenderStats = laRenderStats;
  window.laRenderWage = laRenderWage;
  window.laShiftMonth = laShiftMonth;
  window.laSearch = laSearch;
  window.laSetStatsRange = laSetStatsRange;
  window.laShiftStats = laShiftStats;
  window.laAddAccount = laAddAccount;
  window.laTogglePunch = laTogglePunch;
  window.laToggleTodayPunch = laToggleTodayPunch;
  window.laSettleWage = laSettleWage;
  window.laDoSettleWage = laDoSettleWage;
  window.laOpenWageSetting = laOpenWageSetting;
  window.laAppendVisPanel = laAppendVisPanel;
  window.laSetVisMode = laSetVisMode;
  window.laToggleVisChar = laToggleVisChar;

  // 包一层 renderLedgerApp，保证旧调用也会刷新新界面
  var origRender = window.renderLedgerApp;
  window.renderLedgerApp = function () {
    if (typeof origRender === 'function') origRender();
    try { laRenderAll(); } catch (e) { console.error('laRenderAll failed', e); }
  };
})();
