// ==========================================================================
// 📅 倒数日 Days Matter 核心逻辑 (纯正暗黑系 · 毫秒级编辑与周绪言实时神经同步)
// ==========================================================================

let daysMatterData = [];
let currentDmFilter = 'all';
let currentViewingDmId = null;
let editingDaysTargetId = null;

// 初始化默认浪漫纪念日数据
function initDefaultDaysMatter() {
  const defaultItems = [
    {
      id: 'dm_1',
      title: '初次相遇',
      date: '2026-01-01',
      category: 'love',
      isPinned: true,
      note: '美好的故事从这一天开始。',
      customQuote: '日子一秒一秒数着，往后每天都有我陪你。'
    }
  ];

  try {
    const saved = localStorage.getItem('momo_days_matter_data');
    if (saved) {
      daysMatterData = JSON.parse(saved);
      if (!Array.isArray(daysMatterData) || daysMatterData.length === 0) {
        daysMatterData = defaultItems;
      }
    } else {
      daysMatterData = defaultItems;
    }
  } catch(e) {
    daysMatterData = defaultItems;
  }
}

function saveDaysMatterData() {
  try {
    localStorage.setItem('momo_days_matter_data', JSON.stringify(daysMatterData));
  } catch(e){}
}

// 供全局/周绪言系统提示词调用的倒数日摘要提取器
window.getDaysMatterSummaryForAi = function() {
  initDefaultDaysMatter();
  if (!daysMatterData || daysMatterData.length === 0) return '暂无倒数日记录。';
  return daysMatterData.map(d => {
    const diff = calculateDaysDiff(d.date);
    const pinTag = d.isPinned ? '【置顶主纪念日】' : '';
    return `- ${pinTag}${d.title}：目标/起始日期为 ${d.date}，截至当前${diff.statusText} ${diff.days} 天。${d.note ? '【专属备忘: ' + d.note + '】' : ''}`;
  }).join('\n');
};

// 健壮计算辅助：防非法日期与时区抖动
function calculateDaysDiff(targetDateStr) {
  try {
    if (!targetDateStr) return { type: 'past', days: 0, statusText: '已经', fullStatus: '已经过去' };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const cleanDate = targetDateStr.replace(/\//g, '-').trim();
    const parts = cleanDate.split('-');
    const y = parseInt(parts[0]) || now.getFullYear();
    const m = (parseInt(parts[1]) || 1) - 1;
    const d = parseInt(parts[2]) || 1;
    const target = new Date(y, m, d);

    const diffMs = today.getTime() - target.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 0) {
      return {
        type: 'past',
        days: diffDays,
        statusText: '已经',
        fullStatus: '已经过去'
      };
    } else {
      return {
        type: 'future',
        days: Math.abs(diffDays),
        statusText: '还有',
        fullStatus: '距离还有'
      };
    }
  } catch(e) {
    return { type: 'past', days: 0, statusText: '已经', fullStatus: '已经过去' };
  }
}

// 渲染主界面
window.renderDaysMatter = function() {
  initDefaultDaysMatter();
  const listContainer = document.getElementById('daysmatter-list-container');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  // 1. 置顶高光纪念日大卡片
  let pinnedItem = daysMatterData.find(d => d.isPinned) || daysMatterData[0];
  if (pinnedItem) {
    const heroDiff = calculateDaysDiff(pinnedItem.date);
    const heroCatEl = document.getElementById('dm-hero-category');
    const heroTitleEl = document.getElementById('dm-hero-title');
    const heroDateEl = document.getElementById('dm-hero-date');
    const heroNoteEl = document.getElementById('dm-hero-note');
    const heroStatusEl = document.getElementById('dm-hero-status');
    const heroCountEl = document.getElementById('dm-hero-count');

    if (heroCatEl) heroCatEl.innerText = getCategoryName(pinnedItem.category);
    if (heroTitleEl) heroTitleEl.innerText = pinnedItem.title;
    if (heroDateEl) heroDateEl.innerText = (heroDiff.type === 'past' ? '起始：' : '目标：') + pinnedItem.date;
    if (heroNoteEl) heroNoteEl.innerText = pinnedItem.note ? `“${pinnedItem.note}”` : '';
    if (heroStatusEl) heroStatusEl.innerText = heroDiff.statusText;
    if (heroCountEl) heroCountEl.innerText = heroDiff.days;

    const heroBox = document.getElementById('daysmatter-hero-card');
    if (heroBox) {
      heroBox.onclick = () => window.openDaysDetailModal(pinnedItem.id);
    }
  }

  // 2. 更新全部计数
  const allTabBtn = document.getElementById('dm-tab-all');
  if (allTabBtn) allTabBtn.innerText = `全部 (${daysMatterData.length})`;

  // 3. 过滤并按天数渲染列表
  let filtered = daysMatterData.slice();
  if (currentDmFilter !== 'all') {
    filtered = filtered.filter(d => d.category === currentDmFilter);
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; padding: 40px 10px; color: var(--text-muted); font-size: 13.5px;">该分类下暂无记录，点击右上角「+ 添加」记下一笔吧~</div>';
    return;
  }

  filtered.forEach(item => {
    const diff = calculateDaysDiff(item.date);
    const catColor = getCategoryColor(item.category);

    const card = document.createElement('div');
    card.className = 'dm-item-row';
    card.style.cssText = `
      border: 1px solid var(--border-default);
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 0.15s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    `;

    // 左侧色条
    const stripe = document.createElement('div');
    stripe.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: ${catColor};
    `;
    card.appendChild(stripe);

    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'display: flex; flex-direction: column; gap: 3px; padding-left: 6px; flex: 1;';
    leftCol.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${item.title}</span>
        ${item.isPinned ? '<span style="color: var(--days-accent); font-size: 11px;">📌</span>' : ''}
      </div>
      <div style="font-size: 12px; color: var(--text-muted);">${item.date} ${item.note ? '· ' + item.note : ''}</div>
    `;

    const rightActionBox = document.createElement('div');
    rightActionBox.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // 快捷行内编辑小笔头 (无需先点详情，随时一键直达编辑！)
    const editBtn = document.createElement('button');
    editBtn.style.cssText = 'background: var(--palace-highlight-soft); border: 1px solid var(--palace-highlight); color: var(--palace-highlight); width: 28px; height: 28px; border-radius: 8px; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center;';
    editBtn.innerText = '✏️';
    editBtn.title = '编辑此条纪念日';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      window.openDirectEditDaysModal(item.id);
    };

    const rightPill = document.createElement('div');
    rightPill.style.cssText = `
      display: flex;
      align-items: baseline;
      gap: 4px;
      background: var(--bg-base);
      border: 1px solid var(--border-default);
      border-radius: 10px;
      padding: 5px 10px;
    `;
    rightPill.innerHTML = `
      <span style="font-size: 11.5px; color: ${diff.type === 'past' ? 'var(--days-past-color)' : 'var(--days-future-color)'}; font-weight: 600;">${diff.statusText}</span>
      <span style="font-size: 20px; font-weight: 900; color: var(--text-primary); font-family: 'SF Pro Display', -apple-system, sans-serif;">${diff.days}</span>
      <span style="font-size: 10px; color: var(--text-muted); font-weight: 700;">天</span>
    `;

    rightActionBox.appendChild(editBtn);
    rightActionBox.appendChild(rightPill);

    card.appendChild(leftCol);
    card.appendChild(rightActionBox);

    // 点击卡片本体展开明信片详情
    card.onclick = () => window.openDaysDetailModal(item.id);

    listContainer.appendChild(card);
  });
};

function getCategoryName(cat) {
  if (cat === 'love') return '❤️ 恋爱纪念';
  if (cat === 'promise') return '💍 领证生活';
  if (cat === 'holiday') return '🎂 生日节日';
  return '📅 重要日常';
}

function getCategoryColor(cat) {
  if (cat === 'love') return 'var(--days-tag-love)';
  if (cat === 'promise') return 'var(--days-tag-promise)';
  if (cat === 'holiday') return 'var(--days-tag-holiday)';
  return 'var(--days-tag-other)';
}

window.filterDaysMatter = function(catKey) {
  currentDmFilter = catKey;
  const pills = ['all', 'love', 'promise', 'holiday'];
  pills.forEach(p => {
    const el = document.getElementById('dm-tab-' + p);
    if (el) {
      if (p === catKey) {
        el.style.background = 'var(--days-accent-soft)';
        el.style.border = '1px solid var(--days-accent-border)';
        el.style.color = 'var(--days-accent)';
        el.style.fontWeight = '700';
      } else {
        el.style.background = 'var(--bg-surface)';
        el.style.border = '1px solid var(--border-default)';
        el.style.color = 'var(--text-secondary)';
        el.style.fontWeight = '600';
      }
    }
  });
  renderDaysMatter();
};

// 打开详情明信片弹窗
window.openDaysDetailModal = function(itemId) {
  const item = daysMatterData.find(d => d.id === itemId) || daysMatterData[0];
  if (!item) return;
  currentViewingDmId = item.id;

  const diff = calculateDaysDiff(item.date);
  const weeks = Math.floor(diff.days / 7);
  const months = Math.floor(diff.days / 30.4);
  const years = (diff.days / 365.25).toFixed(1);

  document.getElementById('dm-modal-cat-badge').innerText = getCategoryName(item.category);
  document.getElementById('dm-modal-title').innerText = item.title;
  document.getElementById('dm-modal-target-date').innerText = (diff.type === 'past' ? '起始日：' : '目标日：') + item.date;
  document.getElementById('dm-modal-status-text').innerText = diff.fullStatus;
  document.getElementById('dm-modal-big-days').innerText = diff.days;

  document.getElementById('dm-modal-weeks').innerText = weeks + ' 周';
  document.getElementById('dm-modal-months').innerText = months + ' 个月';
  document.getElementById('dm-modal-progress').innerText = diff.type === 'past' ? `第 ${Math.floor(years) + 1} 年` : `还差 ${years} 年`;

  let quote = item.customQuote || item.note;
  if (!quote) {
    if (diff.type === 'past') {
      quote = `从 ${item.date} 走到今天，已经整整 ${diff.days} 天了。不管是第几天，我眼里心里都只有你这一个。`;
    } else {
      quote = `距离 ${item.date} 还有 ${diff.days} 天。日子我都替你一秒一秒数着，那天全依着你。`;
    }
  }
  document.getElementById('dm-modal-xuyan-quote').innerText = `“${quote}”`;

  const pinBtn = document.getElementById('dm-modal-pin-btn');
  if (pinBtn) pinBtn.innerText = item.isPinned ? '取消置顶' : '设为置顶';

  const modal = document.getElementById('modal-daysmatter-detail');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('open');
  }
};

window.closeDaysDetailModal = function() {
  const modal = document.getElementById('modal-daysmatter-detail');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
};

// 一键直达编辑 (无论是从列表点 ✏️ 还是从详情点编辑，100% 灵敏打开！)
window.openDirectEditDaysModal = function(itemId) {
  const item = daysMatterData.find(d => d.id === itemId);
  if (!item) return;

  editingDaysTargetId = item.id;
  window.closeDaysDetailModal();

  const titleEl = document.getElementById('modal-dm-form-title');
  if (titleEl) titleEl.innerText = '修改纪念 / 倒数日';

  document.getElementById('input-dm-title').value = item.title || '';
  document.getElementById('input-dm-date').value = item.date || '';
  document.getElementById('input-dm-cat').value = item.category || 'love';
  document.getElementById('input-dm-note').value = item.note || '';
  document.getElementById('input-dm-pinned').checked = !!item.isPinned;

  const createModal = document.getElementById('modal-daysmatter-create');
  if (createModal) {
    createModal.style.display = 'flex';
    createModal.classList.add('open');
  }
};

// 详情明信片内部的编辑按钮
window.handleEditCurrentDaysItem = function() {
  if (!currentViewingDmId) return;
  window.openDirectEditDaysModal(currentViewingDmId);
};

// 置顶与删除
window.handlePinCurrentItem = function() {
  if (!currentViewingDmId) return;
  daysMatterData.forEach(d => {
    if (d.id === currentViewingDmId) d.isPinned = !d.isPinned;
    else d.isPinned = false;
  });
  saveDaysMatterData();
  window.closeDaysDetailModal();
  renderDaysMatter();
};

window.handleDeleteCurrentDaysItem = function() {
  if (!currentViewingDmId) return;
  if (confirm('确定从倒数日中移除这一天吗？')) {
    daysMatterData = daysMatterData.filter(d => d.id !== currentViewingDmId);
    saveDaysMatterData();
    window.closeDaysDetailModal();
    renderDaysMatter();
  }
};

// 新建弹窗
window.openCreateDaysModal = function() {
  editingDaysTargetId = null;
  const titleEl = document.getElementById('modal-dm-form-title');
  if (titleEl) titleEl.innerText = '记录新的纪念 / 倒数日';

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  document.getElementById('input-dm-title').value = '';
  document.getElementById('input-dm-date').value = `${yyyy}-${mm}-${dd}`;
  document.getElementById('input-dm-cat').value = 'love';
  document.getElementById('input-dm-note').value = '';
  document.getElementById('input-dm-pinned').checked = false;

  const modal = document.getElementById('modal-daysmatter-create');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('open');
  }
};

window.closeCreateDaysModal = function() {
  const modal = document.getElementById('modal-daysmatter-create');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  editingDaysTargetId = null;
};

// 保存新建或修改
window.saveDaysMatterItem = function() {
  const title = document.getElementById('input-dm-title').value.trim();
  const date = document.getElementById('input-dm-date').value;
  const category = document.getElementById('input-dm-cat').value;
  const note = document.getElementById('input-dm-note').value.trim();
  const isPinned = document.getElementById('input-dm-pinned').checked;

  if (!title || !date) {
    alert('请把事件名称和日期填好哦，正等着给你数着呢。');
    return;
  }

  if (isPinned) {
    daysMatterData.forEach(d => d.isPinned = false);
  }

  if (editingDaysTargetId) {
    const target = daysMatterData.find(d => d.id === editingDaysTargetId);
    if (target) {
      target.title = title;
      target.date = date;
      target.category = category;
      target.note = note;
      target.isPinned = isPinned;
      delete target.customQuote;
    }
  } else {
    const newItem = {
      id: 'dm_' + Date.now(),
      title,
      date,
      category,
      isPinned,
      note
    };
    daysMatterData.unshift(newItem);
  }

  saveDaysMatterData();
  window.closeCreateDaysModal();
  renderDaysMatter();
  alert(editingDaysTargetId ? '✨ 纪念日与日期已更新！' : '✨ 已记录新的重要日子！');
};

// 页面加载自动就绪
window.addEventListener('DOMContentLoaded', () => {
  initDefaultDaysMatter();
});
