// =========================================================
// 记账 v3（iCost 形态）· Momo Ledger
// 首页流水 + 数字键盘记账 + 统计环图 + 收支日历 + 账户/预算/分类
// 数据仍沿用 momo_ledger_records_v1，角色感知仍走 getLedgerSummaryForAi
// =========================================================

const LEDGER_STORAGE_KEY = 'momo_ledger_records_v1';
const LEDGER_CUSTOM_CATS_KEY = 'momo_ledger_custom_categories_v1';
const LDG_ACCOUNTS_KEY = 'momo_ledger_accounts_v1';
const LDG_BUDGET_KEY = 'momo_ledger_budget_v1';
const LDG_CAT_COLORS = ['#8FA8C8', '#A79FC2', '#8FB6AE', '#B2A78F', '#B08F92', '#8C9DAE', '#9AA6B4', '#B9C0C9'];

// 预设分类（保留旧 id，旧账目不会丢名字）
const DEFAULT_LEDGER_CATEGORIES = [
  { id: 'art', name: '画材', icon: '🎨' },
  { id: 'tea', name: '奶茶甜品', icon: '🧋' },
  { id: 'food', name: '三餐', icon: '🍚' },
  { id: 'coffee', name: '咖啡', icon: '☕' },
  { id: 'cloth', name: '衣饰', icon: '👗' },
  { id: 'books', name: '书影音', icon: '📚' },
  { id: 'game', name: '娱乐', icon: '🎮' },
  { id: 'cat', name: '猫用品', icon: '🐱' },
  { id: 'snack', name: '零食水果', icon: '🍓' },
  { id: 'home', name: '居家', icon: '🕯️' },
  { id: 'traffic', name: '交通', icon: '🚇' },
  { id: 'medical', name: '医疗', icon: '💊' },
  { id: 'shopping', name: '购物', icon: '🛍️' },
  { id: 'digital', name: '数码', icon: '💻' },
  { id: 'gift', name: '人情', icon: '🎁' },
  { id: 'income_art', name: '稿费', icon: '💰' },
  { id: 'income_other', name: '其他收入', icon: '🧧' },
  { id: 'salary', name: '工资', icon: '🏦' }
];

const DEFAULT_LEDGER_ACCOUNTS = [
  { id: 'cash', name: '现金', icon: '💵', balance: 0 },
  { id: 'wechat', name: '微信', icon: '💬', balance: 0 },
  { id: 'alipay', name: '支付宝', icon: '🅰️', balance: 0 },
  { id: 'bank', name: '银行卡', icon: '🏦', balance: 0 },
  { id: 'credit', name: '信用卡', icon: '💳', balance: 0 }
];

// ---------- 状态 ----------
let lgMonth = '';           // 'YYYY-MM'
let lgType = 'expense';
let lgAmountStr = '0';
let lgSelCat = 'food';
let lgSelAccount = 'cash';
let lgSelDate = '';         // 'YYYY-MM-DD'
let lgStatsMode = 'month';
let lgCalMonth = '';        // 'YYYY-MM'
let lgCalDay = '';

// ---------- 工具 ----------
function lgPad(n) { return (n < 10 ? '0' : '') + n; }

function lgTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + lgPad(d.getMonth() + 1) + '-' + lgPad(d.getDate());
}

function lgMonthOfDate(dateStr) {
  if (!dateStr) return lgTodayStr().slice(0, 7);
  return String(dateStr).slice(0, 7);
}

function lgMoney(n) {
  const v = Number(n) || 0;
  return v.toFixed(2);
}

function lgEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function lgRecTs(r) {
  if (r.ts) return Number(r.ts);
  const d = String(r.date || '').replace(/-/g, '/');
  const t = new Date(d).getTime();
  return isNaN(t) ? Date.now() : t;
}

function lgCatById(id) {
  return getAllLedgerCategories().find(c => c.id === id) ||
    { id: id, name: '其他', icon: '🏷' };
}

function lgCatColor(id) {
  const cats = getAllLedgerCategories();
  const i = cats.findIndex(c => c.id === id);
  return LDG_CAT_COLORS[(i < 0 ? 0 : i) % LDG_CAT_COLORS.length];
}

// ---------- 存储 ----------
function getInitialLedgerData() {
  return [
    {
      id: 'rec_init_1', type: 'expense', catId: 'art',
      title: '数位板替换笔尖与纸胶带', amount: 48.00,
      date: '2026-09-20 14:30', accountId: 'wechat'
    },
    {
      id: 'rec_init_2', type: 'expense', catId: 'tea',
      title: '多肉葡萄奶盖茶', amount: 22.00,
      date: '2026-09-20 16:15', accountId: 'wechat'
    },
    {
      id: 'rec_init_3', type: 'income', catId: 'income_art',
      title: '插画商稿预付款', amount: 2800.00,
      date: '2026-09-19 11:20', accountId: 'bank'
    }
  ];
}

function loadLedgerRecords() {
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) {
      const init = getInitialLedgerData();
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(init));
      return init;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return getInitialLedgerData();
  }
}

function saveLedgerRecords(list) {
  try { localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(list)); }
  catch (e) { console.error('保存账单失败', e); }
}

function getAllLedgerCategories() {
  let custom = [];
  try {
    custom = JSON.parse(localStorage.getItem(LEDGER_CUSTOM_CATS_KEY) || '[]');
    if (!Array.isArray(custom)) custom = [];
  } catch (e) { custom = []; }
  return DEFAULT_LEDGER_CATEGORIES.concat(custom);
}

function lgSaveCustomCats(list) {
  try { localStorage.setItem(LEDGER_CUSTOM_CATS_KEY, JSON.stringify(list)); } catch (e) {}
}

function lgLoadAccounts() {
  try {
    const raw = localStorage.getItem(LDG_ACCOUNTS_KEY);
    if (!raw) {
      localStorage.setItem(LDG_ACCOUNTS_KEY, JSON.stringify(DEFAULT_LEDGER_ACCOUNTS));
      return DEFAULT_LEDGER_ACCOUNTS.slice();
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? list : DEFAULT_LEDGER_ACCOUNTS.slice();
  } catch (e) { return DEFAULT_LEDGER_ACCOUNTS.slice(); }
}

function lgSaveAccounts(list) {
  try { localStorage.setItem(LDG_ACCOUNTS_KEY, JSON.stringify(list)); } catch (e) {}
}

function lgLoadBudget() {
  try {
    const raw = localStorage.getItem(LDG_BUDGET_KEY);
    const b = raw ? JSON.parse(raw) : null;
    return { monthly: (b && Number(b.monthly)) || 0 };
  } catch (e) { return { monthly: 0 }; }
}

function lgSaveBudget(b) {
  try { localStorage.setItem(LDG_BUDGET_KEY, JSON.stringify(b)); } catch (e) {}
}

// ---------- 计算 ----------
function lgRecordsOfMonth(month) {
  return loadLedgerRecords().filter(r => lgMonthOfDate(r.date || new Date(lgRecTs(r)).toISOString()) === month);
}

function lgSum(list, type) {
  return list.filter(r => r.type === type).reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

function lgAccountBalance(accId, records) {
  const acc = lgLoadAccounts().find(a => a.id === accId);
  const base = acc ? Number(acc.balance) || 0 : 0;
  return records.reduce((s, r) => {
    const aid = r.accountId || 'cash';
    if (aid !== accId) return s;
    return s + (r.type === 'income' ? (Number(r.amount) || 0) : -(Number(r.amount) || 0));
  }, base);
}

function lgTotalAssets(records) {
  return lgLoadAccounts().reduce((s, a) => s + lgAccountBalance(a.id, records), 0);
}

// ---------- 首页 ----------
function lgFormatMonthLabel(month) {
  const parts = String(month || lgTodayStr().slice(0, 7)).split('-');
  const now = lgTodayStr().slice(0, 7);
  const y = Number(parts[0]), m = Number(parts[1]);
  if (month === now) return m + '月 · 本月';
  return y + '年' + m + '月';
}

function renderLedgerApp() {
  if (!lgMonth) lgMonth = lgTodayStr().slice(0, 7);
  if (!lgSelDate) lgSelDate = lgTodayStr();

  const label = document.getElementById('lg-month-label');
  if (label) label.innerText = lgFormatMonthLabel(lgMonth);

  const records = loadLedgerRecords();
  const monthRecs = lgRecordsOfMonth(lgMonth);
  const expense = lgSum(monthRecs, 'expense');
  const income = lgSum(monthRecs, 'income');

  const expEl = document.getElementById('lg-month-expense');
  if (expEl) expEl.innerText = lgMoney(expense);
  const incEl = document.getElementById('lg-month-income');
  if (incEl) incEl.innerText = lgMoney(income);
  const balEl = document.getElementById('lg-month-balance');
  if (balEl) balEl.innerText = lgMoney(income - expense);
  const assetsEl = document.getElementById('lg-total-assets');
  if (assetsEl) assetsEl.innerText = lgMoney(lgTotalAssets(records));

  // 预算
  const budget = lgLoadBudget();
  const bText = document.getElementById('lg-budget-text');
  const bFill = document.getElementById('lg-budget-fill');
  if (budget.monthly > 0) {
    const left = budget.monthly - expense;
    if (bText) bText.innerText = '¥' + lgMoney(expense) + ' / ¥' + lgMoney(budget.monthly) + (left >= 0 ? '　余 ' + lgMoney(left) : '　超 ' + lgMoney(-left));
    if (bFill) {
      const pct = Math.min(100, Math.max(0, expense / budget.monthly * 100));
      bFill.style.width = pct + '%';
      bFill.style.background = left >= 0 ? 'rgba(143,168,200,.55)' : 'rgba(176,143,146,.7)';
    }
  } else {
    if (bText) bText.innerText = '未设置';
    if (bFill) bFill.style.width = '0%';
  }

  lgRenderFeed(monthRecs);
}

function lgWeekdayCN(ts) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(ts).getDay()];
}

function lgRenderFeed(monthRecs) {
  const box = document.getElementById('lg-feed');
  if (!box) return;

  if (!monthRecs.length) {
    box.innerHTML = '<div class="lg-empty">这个月还没有账<br>点右下角 ＋ 记一笔</div>';
    return;
  }

  // 按日分组（倒序）
  const groups = {};
  monthRecs.forEach(r => {
    const key = String(r.date || '').slice(0, 10) || lgTodayStr();
    (groups[key] = groups[key] || []).push(r);
  });
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  box.innerHTML = days.map(day => {
    const list = groups[day].slice().sort((a, b) => lgRecTs(b) - lgRecTs(a));
    const e = lgSum(list, 'expense');
    const i = lgSum(list, 'income');
    const d = new Date(day.replace(/-/g, '/'));
    const dayLabel = (Number(day.slice(5, 7)) + '月' + Number(day.slice(8, 10)) + '日') + ' ' + lgWeekdayCN(d.getTime());
    const isToday = day === lgTodayStr();

    return `
      <div class="lg-day">
        <div class="lg-day-head">
          <span class="lg-day-date">${isToday ? '今天' : dayLabel}</span>
          <span class="lg-day-sum">${e ? '支 ' + lgMoney(e) : ''}${e && i ? ' · ' : ''}${i ? '收 ' + lgMoney(i) : ''}</span>
        </div>
        ${list.map(r => {
          const cat = lgCatById(r.catId);
          const acc = lgLoadAccounts().find(a => a.id === (r.accountId || 'cash'));
          const sign = r.type === 'income' ? '+' : '-';
          return `
            <div class="lg-item" onclick="lgOpenRecord('${r.id}')">
              <div class="lg-item-ico" style="color:${lgCatColor(r.catId)}">${cat.icon}</div>
              <div class="lg-item-mid">
                <div class="lg-item-note">${lgEscape(r.title || r.note || cat.name)}</div>
                <div class="lg-item-sub">${lgEscape(cat.name)}${acc ? ' · ' + lgEscape(acc.name) : ''}</div>
              </div>
              <div class="lg-item-amt ${r.type}">${sign}${lgMoney(r.amount)}</div>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

// ---------- 月份选择 ----------
function lgOpenMonthPicker() {
  const old = document.getElementById('lg-month-picker');
  if (old) old.remove();

  const today = lgTodayStr().slice(0, 7);
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const list = [];
  for (let k = 0; k < 18; k++) {
    const d = new Date(y, m - 1 - k, 1);
    list.push(d.getFullYear() + '-' + lgPad(d.getMonth() + 1));
  }

  const layer = document.createElement('div');
  layer.id = 'lg-month-picker';
  layer.className = 'lg-mask';
  layer.style.zIndex = 70;
  layer.innerHTML = `
    <div class="lg-sheet" onclick="event.stopPropagation()">
      <div class="lg-sheet-title">选择月份</div>
      <div class="lg-month-list">
        ${list.map(ym => `<div class="lg-sheet-row${ym === lgMonth ? ' on' : ''}" onclick="lgPickMonth('${ym}')">${lgFormatMonthLabel(ym)}</div>`).join('')}
      </div>
      <div class="lg-sheet-cancel" onclick="document.getElementById('lg-month-picker').remove()">取消</div>
    </div>`;
  layer.onclick = e => { if (e.target === layer) layer.remove(); };
  layer.style.display = 'flex';
  document.getElementById('page-ledger').appendChild(layer);
}

function lgPickMonth(ym) {
  lgMonth = ym;
  const el = document.getElementById('lg-month-picker');
  if (el) el.remove();
  renderLedgerApp();
}

// ---------- 记账键盘 ----------
function lgOpenKeypad() {
  lgType = 'expense';
  lgAmountStr = '0';
  lgSelCat = 'food';
  lgSelAccount = 'cash';
  lgSelDate = lgTodayStr();
  lgSyncKeypad();
  const layer = document.getElementById('lg-keypad-layer');
  if (layer) layer.style.display = 'flex';
  const note = document.getElementById('lg-kp-note');
  if (note) note.value = '';
}

function lgCloseKeypad() {
  const layer = document.getElementById('lg-keypad-layer');
  if (layer) layer.style.display = 'none';
}

function lgSetType(t) {
  lgType = t;
  // 收入时默认选收入类分类
  if (t === 'income' && !String(lgSelCat).startsWith('income') && lgSelCat !== 'salary') lgSelCat = 'income_art';
  if (t === 'expense' && (String(lgSelCat).startsWith('income') || lgSelCat === 'salary')) lgSelCat = 'food';
  lgSyncKeypad();
}

function lgKey(k) {
  if (k === 'del') {
    lgAmountStr = lgAmountStr.length > 1 ? lgAmountStr.slice(0, -1) : '0';
  } else if (k === 'clear') {
    lgAmountStr = '0';
  } else if (k === '.') {
    if (lgAmountStr.indexOf('.') < 0) lgAmountStr += '.';
  } else {
    const dot = lgAmountStr.indexOf('.');
    if (dot >= 0 && lgAmountStr.length - dot > 2) return; // 最多两位小数
    if (lgAmountStr === '0') lgAmountStr = k;
    else {
      if (lgAmountStr.replace('.', '').length >= 9) return;
      lgAmountStr += k;
    }
  }
  lgSyncKeypad();
}

function lgSyncKeypad() {
  const amt = document.getElementById('lg-kp-amount');
  if (amt) amt.innerText = lgAmountStr;

  const exp = document.getElementById('lg-type-exp');
  const inc = document.getElementById('lg-type-inc');
  if (exp) exp.classList.toggle('active', lgType === 'expense');
  if (inc) inc.classList.toggle('active', lgType === 'income');

  const cats = document.getElementById('lg-kp-cats');
  if (cats) {
    cats.innerHTML = getAllLedgerCategories().map(c => `
      <div class="lg-kp-cat${c.id === lgSelCat ? ' on' : ''}" onclick="lgPickCat('${c.id}')">
        <span class="lg-kp-cat-ico">${c.icon}</span>
        <span class="lg-kp-cat-name">${lgEscape(c.name)}</span>
      </div>`).join('');
  }

  const accEl = document.getElementById('lg-kp-account');
  if (accEl) {
    const acc = lgLoadAccounts().find(a => a.id === lgSelAccount) || lgLoadAccounts()[0];
    accEl.innerText = acc ? acc.name : '现金';
  }

  const dEl = document.getElementById('lg-kp-date');
  if (dEl) {
    const t = lgTodayStr();
    const y = new Date(Date.now() - 86400000);
    const yd = y.getFullYear() + '-' + lgPad(y.getMonth() + 1) + '-' + lgPad(y.getDate());
    dEl.innerText = lgSelDate === t ? '今天' : (lgSelDate === yd ? '昨天' : lgSelDate.slice(5).replace('-', '/'));
  }
}

function lgPickCat(id) {
  lgSelCat = id;
  lgSyncKeypad();
}

function lgSubmitRecord() {
  const amount = Number(lgAmountStr);
  if (!amount || amount <= 0) {
    showXianguoToast('先输个金额', 1400);
    return;
  }

  const noteEl = document.getElementById('lg-kp-note');
  const note = noteEl ? noteEl.value.trim() : '';

  const now = new Date();
  const timePart = lgSelDate === lgTodayStr()
    ? lgPad(now.getHours()) + ':' + lgPad(now.getMinutes())
    : '12:00';

  const rec = {
    id: 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    type: lgType,
    catId: lgSelCat,
    title: note || lgCatById(lgSelCat).name,
    amount: amount,
    date: lgSelDate + ' ' + timePart,
    ts: new Date(lgSelDate.replace(/-/g, '/') + ' ' + timePart).getTime(),
    accountId: lgSelAccount
  };

  const list = loadLedgerRecords();
  list.push(rec);
  saveLedgerRecords(list);

  lgMonth = lgSelDate.slice(0, 7);
  lgCloseKeypad();
  renderLedgerApp();
  showXianguoToast('记好了 · ' + (lgType === 'income' ? '+' : '-') + lgMoney(amount), 1500);
}

function lgOpenDatePicker() {
  const old = document.getElementById('lg-date-picker');
  if (old) old.remove();

  const base = new Date();
  const opts = [];
  for (let k = 0; k < 7; k++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - k);
    const ds = d.getFullYear() + '-' + lgPad(d.getMonth() + 1) + '-' + lgPad(d.getDate());
    const label = k === 0 ? '今天' : k === 1 ? '昨天' : (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + lgWeekdayCN(d.getTime());
    opts.push({ ds, label });
  }

  const layer = document.createElement('div');
  layer.id = 'lg-date-picker';
  layer.className = 'lg-mask';
  layer.style.zIndex = '68';
  layer.innerHTML = `
    <div class="lg-sheet" onclick="event.stopPropagation()">
      <div class="lg-sheet-title">记到哪天</div>
      <div class="lg-month-list">
        ${opts.map(o => `<div class="lg-sheet-row${o.ds === lgSelDate ? ' on' : ''}" onclick="lgPickDate('${o.ds}')">${o.label}</div>`).join('')}
      </div>
      <div class="lg-sheet-cancel" onclick="document.getElementById('lg-date-picker').remove()">取消</div>
    </div>`;
  layer.onclick = e => { if (e.target === layer) layer.remove(); };
  layer.style.display = 'flex';
  document.getElementById('page-ledger').appendChild(layer);
}

function lgPickDate(ds) {
  lgSelDate = ds;
  const el = document.getElementById('lg-date-picker');
  if (el) el.remove();
  lgSyncKeypad();
}

// ---------- 账户选择 ----------
function lgOpenAccountPicker() {
  const layer = document.getElementById('lg-account-layer');
  const listEl = document.getElementById('lg-account-list');
  if (!layer || !listEl) return;
  const accounts = lgLoadAccounts();
  const records = loadLedgerRecords();
  listEl.innerHTML = accounts.map(a => `
    <div class="lg-acc-row${a.id === lgSelAccount ? ' on' : ''}" onclick="lgPickAccount('${a.id}')">
      <span class="lg-acc-ico">${a.icon || '💵'}</span>
      <span class="lg-acc-name">${lgEscape(a.name)}</span>
      <span class="lg-acc-bal">${lgMoney(lgAccountBalance(a.id, records))}</span>
    </div>`).join('');
  layer.style.zIndex = '60';
  layer.style.display = 'flex';
}

function lgPickAccount(id) {
  lgSelAccount = id;
  lgCloseAccountPicker();
  lgSyncKeypad();
}

function lgCloseAccountPicker() {
  const layer = document.getElementById('lg-account-layer');
  if (layer) layer.style.display = 'none';
}

// ---------- 单笔详情 ----------
function lgOpenRecord(id) {
  const old = document.getElementById('lg-rec-detail');
  if (old) old.remove();
  const rec = loadLedgerRecords().find(r => r.id === id);
  if (!rec) return;
  const cat = lgCatById(rec.catId);
  const acc = lgLoadAccounts().find(a => a.id === (rec.accountId || 'cash')) || { name: '现金' };

  const layer = document.createElement('div');
  layer.id = 'lg-rec-detail';
  layer.className = 'lg-mask';
  layer.style.zIndex = 75;
  layer.innerHTML = `
    <div class="lg-sheet" onclick="event.stopPropagation()">
      <div class="lg-sheet-title">${lgEscape(rec.title || cat.name)}</div>
      <div class="lg-detail-row"><span>金额</span><b class="${rec.type}">${rec.type === 'income' ? '+' : '-'}${lgMoney(rec.amount)}</b></div>
      <div class="lg-detail-row"><span>分类</span><b>${cat.icon} ${lgEscape(cat.name)}</b></div>
      <div class="lg-detail-row"><span>账户</span><b>${lgEscape(acc.name)}</b></div>
      <div class="lg-detail-row"><span>时间</span><b>${lgEscape(rec.date || '')}</b></div>
      <div class="lg-sheet-row lg-danger" onclick="lgDeleteRecord('${rec.id}')">删除这笔</div>
      <div class="lg-sheet-cancel" onclick="document.getElementById('lg-rec-detail').remove()">关闭</div>
    </div>`;
  layer.onclick = e => { if (e.target === layer) layer.remove(); };
  layer.style.display = 'flex';
  document.getElementById('page-ledger').appendChild(layer);
}

function lgDeleteRecord(id) {
  if (!confirm('删除这笔记录？')) return;
  const list = loadLedgerRecords().filter(r => r.id !== id);
  saveLedgerRecords(list);
  const d = document.getElementById('lg-rec-detail');
  if (d) d.remove();
  renderLedgerApp();
}

// ---------- 统计 ----------
function lgOpenStats() {
  const layer = document.getElementById('lg-stats-layer');
  if (layer) layer.style.display = 'flex';
  lgRenderStats();
}

function lgCloseStats() {
  const layer = document.getElementById('lg-stats-layer');
  if (layer) layer.style.display = 'none';
}

function lgSetStatsMode(m) {
  lgStatsMode = m;
  const seg = document.getElementById('lg-stats-seg');
  if (seg) {
    seg.children[0].classList.toggle('active', m === 'month');
    seg.children[1].classList.toggle('active', m === 'year');
  }
  lgRenderStats();
}

function lgRenderStats() {
  const records = loadLedgerRecords();
  let pool;
  if (lgStatsMode === 'month') {
    pool = records.filter(r => lgMonthOfDate(r.date) === lgMonth);
  } else {
    const y = lgMonth.slice(0, 4);
    pool = records.filter(r => lgMonthOfDate(r.date).slice(0, 4) === y);
  }
  const expenseRecs = pool.filter(r => r.type === 'expense');
  const total = expenseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const periodEl = document.getElementById('lg-stats-period');
  if (periodEl) periodEl.innerText = lgStatsMode === 'month' ? lgFormatMonthLabel(lgMonth) + ' 支出' : lgMonth.slice(0, 4) + ' 年支出';
  const sumEl = document.getElementById('lg-donut-sum');
  if (sumEl) sumEl.innerText = lgMoney(total);
  const expEl = document.getElementById('lg-stats-expense');
  if (expEl) expEl.innerText = lgMoney(total);

  // 分类聚合
  const byCat = {};
  expenseRecs.forEach(r => {
    byCat[r.catId] = (byCat[r.catId] || 0) + (Number(r.amount) || 0);
  });
  const ranks = Object.keys(byCat)
    .map(id => ({ id: id, amount: byCat[id], cat: lgCatById(id), color: lgCatColor(id) }))
    .sort((a, b) => b.amount - a.amount);

  lgDrawDonut(ranks, total);

  const rankEl = document.getElementById('lg-rank');
  if (rankEl) {
    rankEl.innerHTML = ranks.length ? ranks.map(x => `
      <div class="lg-rank-row">
        <span class="lg-rank-ico">${x.cat.icon}</span>
        <div class="lg-rank-mid">
          <div class="lg-rank-top">
            <span>${lgEscape(x.cat.name)}</span>
            <b>${lgMoney(x.amount)}</b>
          </div>
          <div class="lg-rank-bar"><i style="width:${total ? (x.amount / total * 100) : 0}%;background:${x.color}"></i></div>
        </div>
        <span class="lg-rank-pct">${total ? Math.round(x.amount / total * 100) : 0}%</span>
      </div>`).join('') : '<div class="lg-empty">这段时间还没有支出</div>';
  }

  // 近 6 个月趋势
  const trendEl = document.getElementById('lg-trend-bars');
  if (trendEl) {
    const base = new Date(lgMonth + '-01').getTime();
    const months = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(base);
      d.setMonth(d.getMonth() - k);
      months.push(d.getFullYear() + '-' + lgPad(d.getMonth() + 1));
    }
    const sums = months.map(m => lgSum(records.filter(r => lgMonthOfDate(r.date) === m), 'expense'));
    const max = Math.max.apply(null, sums.concat([1]));
    trendEl.innerHTML = months.map((m, i) => `
      <div class="lg-trend-col">
        <span class="lg-trend-val">${sums[i] ? Math.round(sums[i]) : ''}</span>
        <div class="lg-trend-bar"><i style="height:${Math.max(4, sums[i] / max * 100)}%"></i></div>
        <span class="lg-trend-m">${Number(m.slice(5, 7))}月</span>
      </div>`).join('');
  }
}

function lgDrawDonut(ranks, total) {
  const cv = document.getElementById('lg-donut');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2, rOut = W * 0.44, rIn = W * 0.30;

  if (!ranks.length || !total) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = W * 0.14;
    ctx.beginPath();
    ctx.arc(cx, cy, (rOut + rIn) / 2, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  let start = -Math.PI / 2;
  ranks.forEach(x => {
    const angle = x.amount / total * Math.PI * 2;
    ctx.beginPath();
    ctx.fillStyle = x.color;
    ctx.arc(cx, cy, rOut, start, start + angle);
    ctx.arc(cx, cy, rIn, start + angle, start, true);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    start += angle;
  });
}

// ---------- 日历 ----------
function lgOpenCalendar() {
  if (!lgCalMonth) lgCalMonth = lgMonth;
  lgCalDay = '';
  const layer = document.getElementById('lg-calendar-layer');
  if (layer) layer.style.display = 'flex';
  lgRenderCalendar();
}

function lgCloseCalendar() {
  const layer = document.getElementById('lg-calendar-layer');
  if (layer) layer.style.display = 'none';
}

function lgCalShift(delta) {
  const d = new Date(lgCalMonth + '-01');
  d.setMonth(d.getMonth() + delta);
  lgCalMonth = d.getFullYear() + '-' + lgPad(d.getMonth() + 1);
  lgCalDay = '';
  lgRenderCalendar();
}

function lgRenderCalendar() {
  const title = document.getElementById('lg-cal-title');
  if (title) title.innerText = lgFormatMonthLabel(lgCalMonth);

  const records = loadLedgerRecords();
  const dayMap = {};
  records.forEach(r => {
    const key = String(r.date || '').slice(0, 10);
    if (!key) return;
    if (!dayMap[key]) dayMap[key] = { e: 0, i: 0 };
    if (r.type === 'income') dayMap[key].i += Number(r.amount) || 0;
    else dayMap[key].e += Number(r.amount) || 0;
  });

  const first = new Date(lgCalMonth + '-01');
  const y = first.getFullYear(), m = first.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // 周一起

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<div class="lg-cal-cell empty"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const key = y + '-' + lgPad(m + 1) + '-' + lgPad(d);
    const info = dayMap[key];
    const isToday = key === lgTodayStr();
    const cls = 'lg-cal-cell' + (isToday ? ' today' : '') + (key === lgCalDay ? ' on' : '');
    cells.push(`
      <div class="${cls}" onclick="lgCalPickDay('${key}')">
        <span class="lg-cal-d">${d}</span>
        ${info && info.e ? `<span class="lg-cal-e">${Math.round(info.e)}</span>` : ''}
        ${info && info.i ? `<span class="lg-cal-i">${Math.round(info.i)}</span>` : ''}
      </div>`);
  }

  const grid = document.getElementById('lg-cal-grid');
  if (grid) grid.innerHTML = cells.join('');

  const dayEl = document.getElementById('lg-cal-day');
  if (dayEl) {
    if (!lgCalDay) {
      dayEl.innerHTML = '<div class="lg-cal-hint">点某一天，看当天流水</div>';
    } else {
      const list = records.filter(r => String(r.date || '').slice(0, 10) === lgCalDay)
        .sort((a, b) => lgRecTs(b) - lgRecTs(a));
      if (!list.length) {
        dayEl.innerHTML = '<div class="lg-cal-hint">这一天没有记账</div>';
      } else {
        const e = lgSum(list, 'expense'), i = lgSum(list, 'income');
        dayEl.innerHTML = `
          <div class="lg-cal-day-head">${lgCalDay.slice(5).replace('-', '月') + '日'}　支 ${lgMoney(e)}　收 ${lgMoney(i)}</div>
          ${list.map(r => {
            const cat = lgCatById(r.catId);
            return `<div class="lg-item" onclick="lgOpenRecord('${r.id}')">
              <div class="lg-item-ico" style="color:${lgCatColor(r.catId)}">${cat.icon}</div>
              <div class="lg-item-mid">
                <div class="lg-item-note">${lgEscape(r.title || cat.name)}</div>
                <div class="lg-item-sub">${lgEscape(cat.name)}</div>
              </div>
              <div class="lg-item-amt ${r.type}">${r.type === 'income' ? '+' : '-'}${lgMoney(r.amount)}</div>
            </div>`;
          }).join('')}`;
      }
    }
  }
}

function lgCalPickDay(key) {
  lgCalDay = key;
  lgRenderCalendar();
}

// ---------- 设置 ----------
function lgOpenSettings() {
  const layer = document.getElementById('lg-settings-layer');
  if (layer) layer.style.display = 'flex';
  lgRenderSettings();
}

function lgCloseSettings() {
  const layer = document.getElementById('lg-settings-layer');
  if (layer) layer.style.display = 'none';
}

function lgRenderSettings() {
  const box = document.getElementById('lg-settings-body');
  if (!box) return;
  const budget = lgLoadBudget();
  const accounts = lgLoadAccounts();
  const records = loadLedgerRecords();
  const cats = getAllLedgerCategories();

  box.innerHTML = `
    <div class="lg-set-sec">
      <div class="lg-set-title">月度预算</div>
      <div class="lg-set-inline">
        <input type="number" id="lg-set-budget" class="lg-set-input" value="${budget.monthly || ''}" placeholder="例如 3000" />
        <button class="lg-set-btn" onclick="lgSaveBudgetInput()">保存</button>
      </div>
    </div>

    <div class="lg-set-sec">
      <div class="lg-set-title">账户</div>
      ${accounts.map(a => `
        <div class="lg-set-row">
          <span class="lg-set-ico">${a.icon || '💵'}</span>
          <span class="lg-set-name">${lgEscape(a.name)}</span>
          <input type="number" class="lg-set-input lg-set-bal" value="${Number(a.balance) || 0}"
            onchange="lgSaveAccountBalance('${a.id}', this.value)" />
        </div>`).join('')}
      <div class="lg-set-hint">后面的数字是这个账户的期初余额</div>
    </div>

    <div class="lg-set-sec">
      <div class="lg-set-title">分类</div>
      <div class="lg-set-cats">
        ${cats.map(c => `<span class="lg-set-cat">${c.icon} ${lgEscape(c.name)}</span>`).join('')}
      </div>
      <div class="lg-set-inline">
        <input type="text" id="lg-set-newcat" class="lg-set-input" placeholder="新分类名字" maxlength="8" />
        <button class="lg-set-btn" onclick="lgAddCategory()">添加</button>
      </div>
    </div>

    <div class="lg-set-sec">
      <div class="lg-set-title">数据</div>
      <div class="lg-set-row lg-set-action" onclick="lgExportCsv()"><span class="lg-set-name">导出 CSV</span><span>›</span></div>
      <div class="lg-set-row lg-set-action lg-danger" onclick="lgClearAll()"><span class="lg-set-name">清空全部记录</span><span>›</span></div>
      <div class="lg-set-hint">共 ${records.length} 笔记录</div>
    </div>`;

  // 谁可以看我的账（由 ledger-app.js 注入，插到最前面）
  if (typeof window.laAppendVisPanel === 'function') {
    try { window.laAppendVisPanel(); } catch (e) {}
  }
}

function lgSaveBudgetInput() {
  const el = document.getElementById('lg-set-budget');
  const v = el ? Number(el.value) : 0;
  lgSaveBudget({ monthly: v > 0 ? v : 0 });
  renderLedgerApp();
  showXianguoToast(v > 0 ? '预算设成 ' + lgMoney(v) : '已清空预算', 1500);
}

function lgSaveAccountBalance(id, val) {
  const accounts = lgLoadAccounts();
  const acc = accounts.find(a => a.id === id);
  if (acc) {
    acc.balance = Number(val) || 0;
    lgSaveAccounts(accounts);
    renderLedgerApp();
  }
}

function lgAddCategory() {
  const el = document.getElementById('lg-set-newcat');
  const name = el ? el.value.trim() : '';
  if (!name) return;
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem(LEDGER_CUSTOM_CATS_KEY) || '[]'); } catch (e) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  const icons = ['🏷', '🍜', '🎧', '🚕', '💡', '🐈', '🧴', '🎬'];
  custom.push({ id: 'cat_custom_' + Date.now(), name: name, icon: icons[custom.length % icons.length] });
  lgSaveCustomCats(custom);
  if (el) el.value = '';
  lgRenderSettings();
  lgSyncKeypad();
  showXianguoToast('加了「' + name + '」', 1500);
}

function lgExportCsv() {
  const records = loadLedgerRecords().slice().sort((a, b) => lgRecTs(a) - lgRecTs(b));
  const lines = ['日期,类型,分类,备注,金额,账户'];
  records.forEach(r => {
    const cat = lgCatById(r.catId);
    const acc = lgLoadAccounts().find(a => a.id === (r.accountId || 'cash')) || { name: '现金' };
    lines.push([
      r.date || '',
      r.type === 'income' ? '收入' : '支出',
      cat.name,
      (r.title || '').replace(/,/g, '，'),
      Number(r.amount).toFixed(2),
      acc.name
    ].join(','));
  });
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'momo-ledger-' + lgTodayStr() + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showXianguoToast('CSV 导出了', 1500);
}

function lgClearAll() {
  if (!confirm('清空全部记账记录？这个不能恢复。')) return;
  saveLedgerRecords([]);
  renderLedgerApp();
  lgRenderSettings();
  showXianguoToast('已经清空', 1500);
}

// ---------- 账本可见性（哪些角色能读到） ----------
const LEDGER_VIS_KEY = 'momo_ledger_visibility_v1';

function lgLoadVisibility() {
  try {
    const raw = localStorage.getItem(LEDGER_VIS_KEY);
    if (raw) {
      const o = JSON.parse(raw) || {};
      const mode = ['all', 'only', 'none'].indexOf(o.mode) >= 0 ? o.mode : 'all';
      return {
        mode: mode,
        allow: Array.isArray(o.allow) ? o.allow.map(String) : [],
        block: Array.isArray(o.block) ? o.block.map(String) : []
      };
    }
  } catch (e) {}
  return { mode: 'all', allow: [], block: [] };
}

function lgSaveVisibility(v) {
  try {
    localStorage.setItem(LEDGER_VIS_KEY, JSON.stringify({
      mode: v.mode,
      allow: (v.allow || []).map(String),
      block: (v.block || []).map(String)
    }));
  } catch (e) {}
}

function lgCanSeeLedger(charId) {
  const v = lgLoadVisibility();
  const id = charId ? String(charId) : '';
  if (v.mode === 'none') return false;
  if (v.mode === 'only') {
    if (!id) return false;
    return v.allow.indexOf(id) >= 0;
  }
  // all：默认都可见，单独关掉的角色进 block
  if (!id) return true;
  return v.block.indexOf(id) < 0;
}

function lgIsDebtAcc(a) {
  if (!a) return false;
  if (a.kind === 'debt') return true;
  if (a.kind === 'asset') return false;
  return a.id === 'credit';
}

// ---------- 供角色读取的账本摘要 ----------
window.getLedgerSummaryForAi = function (opts) {
  try {
    const o = opts || {};
    const charId = o.charId || o.characterId || '';
    const charName = o.charName || '这个角色';

    if (!lgCanSeeLedger(charId)) {
      return '【记账本】：user 没让「' + charName + '」看她的账本。你现在不知道她有多少钱、这个月花了多少、工资发没发。不要提到账户、余额、预算、工资这类信息，也不要猜；她要是自己提起钱，就顺着她的话聊，别报数字。';
    }

    const records = loadLedgerRecords();
    const accounts = lgLoadAccounts();
    const balanceOf = function (a) { return lgAccountBalance(a.id, records); };
    const assetAccs = accounts.filter(function (a) { return !lgIsDebtAcc(a); });
    const debtAccs = accounts.filter(lgIsDebtAcc);

    const gross = assetAccs.reduce(function (s, a) { return s + balanceOf(a); }, 0);
    const debt = debtAccs.reduce(function (s, a) { return s + Math.abs(balanceOf(a)); }, 0);
    const net = gross - debt;

    const month = lgTodayStr().slice(0, 7);
    const monthRecs = lgRecordsOfMonth(month);
    const sortedAll = records.slice().sort(function (a, b) { return lgRecTs(b) - lgRecTs(a); });
    const latestMonth = sortedAll.length ? String(sortedAll[0].date || '').slice(0, 7) : '';
    const expense = lgSum(monthRecs, 'expense');
    const income = lgSum(monthRecs, 'income');
    const budget = lgLoadBudget();

    const accLines = accounts.map(function (a) {
      const bal = balanceOf(a);
      return '  · ' + a.name + '：' + bal.toFixed(2) + ' 元' + (lgIsDebtAcc(a) ? '（应付，算负债）' : '');
    }).join('\n');

    const recent = records.slice().sort(function (a, b) { return lgRecTs(b) - lgRecTs(a); }).slice(0, 6).map(function (r) {
      const cat = lgCatById(r.catId);
      return '  · ' + String(r.date || '').slice(0, 16) + '　' + cat.name + '　' + (r.title || '') + '　' + (r.type === 'income' ? '+' : '-') + Number(r.amount).toFixed(2);
    }).join('\n');

    let wageLine = '';
    try {
      const w = JSON.parse(localStorage.getItem('momo_ledger_wage_v1') || '{}') || {};
      const rate = Number(w.rate) || 0;
      const days = Array.isArray(w.days) ? w.days : [];
      if (rate > 0) {
        const pending = days.length * rate;
        wageLine = pending > 0
          ? '- 工资库：已经上班打卡 ' + days.length + ' 天，待入账工资 ' + pending.toFixed(2) + ' 元（还没发），日薪 ' + rate.toFixed(2) + ' 元\n'
          : '- 工资库：日薪 ' + rate.toFixed(2) + ' 元，目前没有攒着的打卡，工资应该是刚结过\n';
      }
    } catch (e) {}

    return '【记账本 · 实时（user 允许你看）】\n' +
      (records.length ? '' : '- 账本目前还没有流水的明细，她刚开始记\n') +
      '- 本月支出：' + expense.toFixed(2) + ' 元；本月收入：' + income.toFixed(2) + ' 元；本月结余：' + (income - expense).toFixed(2) + ' 元\n' +
      (monthRecs.length === 0 && latestMonth && latestMonth !== month ? '- 注意：这个月（' + month + '）她还没记账，最近一笔是 ' + latestMonth + ' 的，别把那时的花费当成这个月的\n' : '') +
      '- 净资产：' + net.toFixed(2) + ' 元（总资产 ' + gross.toFixed(2) + '，总负债 ' + debt.toFixed(2) + '）\n' +
      '- 各账户余额：\n' + accLines + '\n' +
      wageLine +
      (budget.monthly > 0 ? '- 本月预算：' + budget.monthly.toFixed(2) + ' 元，' + (budget.monthly - expense >= 0 ? '还剩 ' + (budget.monthly - expense).toFixed(2) : '已超 ' + (expense - budget.monthly).toFixed(2)) + ' 元\n' : '') +
      (recent ? '- 最近的几笔：\n' + recent + '\n' : '') +
      '*铁律*：这是 user 真实的钱。她有多少、花了多少你都得清楚，不许假装账本是空的；提到钱要具体到账户和金额，但别审问她钱包，也别替她做决定。';
  } catch (e) {
    console.error('账本摘要失败', e);
    return '【记账本】：读取失败。';
  }
};
