/* 生活写入：人机恋角色提议，用户确认后才写进健康 / 账本 / 日记 / 记忆。
   纯 RP 不注入指令；所有写入前的确认卡在这一层收口。 */
(function () {
  'use strict';

  var PERM_KEY = 'momo_life_write_perms_v1';
  var LOG_KEY = 'momo_life_write_log_v1';
  var MODAL_ID = 'life-write-modal';
  var pending = null;

  var KIND_META = {
    period: { label: '经期', title: '帮她把经期记下来' },
    ledger: { label: '账本', title: '帮她把这一笔记下来' },
    diary: { label: '日记', title: '帮她在日记里留一句' },
    memory: { label: '记忆', title: '帮她把这件事记住' }
  };

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function loadPerms() {
    var value = readJson(PERM_KEY, {});
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  }

  function savePerms(value) {
    writeJson(PERM_KEY, value || {});
  }

  function permOf(charId, kind) {
    var id = String(charId || '');
    if (!id || !KIND_META[kind]) return false;
    var perms = loadPerms();
    var row = perms[id];
    if (!row || typeof row !== 'object') return true;
    return row[kind] !== false;
  }

  function setPerm(charId, kind, enabled) {
    var id = String(charId || '');
    if (!id || !KIND_META[kind]) return;
    var perms = loadPerms();
    var row = perms[id] || {};
    row[kind] = !!enabled;
    perms[id] = row;
    savePerms(perms);
  }

  function isAiAware(charId) {
    try {
      if (window.MomMode && typeof window.MomMode.isAiAware === 'function') {
        return !!window.MomMode.isAiAware(charId);
      }
    } catch (e) {}
    return false;
  }

  function humanChars() {
    var list = [];
    try {
      if (typeof window.getCharacters === 'function') list = window.getCharacters() || [];
    } catch (e) { list = []; }
    return list.filter(function (c) {
      if (!c || !c.id || c.deleted) return false;
      return isAiAware(c.id);
    });
  }

  function charNameOf(charId) {
    try {
      if (typeof window.getCharacters === 'function') {
        var list = window.getCharacters() || [];
        var found = list.filter(function (c) { return c && c.id === charId; })[0];
        if (found && found.name) return found.name;
      }
    } catch (e) {}
    return 'TA';
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fmtDate(dateText) {
    var m = String(dateText || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(dateText || '');
    return Number(m[2]) + '月' + Number(m[3]) + '日';
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeItem(raw) {
    var item = raw;
    if (typeof raw === 'string') {
      try { item = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!item || typeof item !== 'object') return null;
    var kind = String(item.kind || '').trim();
    if (kind === 'period_start' || kind === 'period') kind = 'period';
    if (kind === 'expense' || kind === 'income' || kind === 'ledger') kind = 'ledger';
    if (kind === 'remember' || kind === 'memory') kind = 'memory';
    if (kind === 'diary' || kind === 'note') kind = 'diary';
    if (!KIND_META[kind]) return null;

    if (kind === 'period') {
      return {
        kind: 'period',
        date: String(item.date || todayStr()).slice(0, 10),
        note: String(item.note || '').trim().slice(0, 80)
      };
    }

    if (kind === 'diary') {
      return {
        kind: 'diary',
        text: String(item.text || '').trim().slice(0, 500)
      };
    }

    if (kind === 'memory') {
      return {
        kind: 'memory',
        text: String(item.text || item.summary || '').trim().slice(0, 500),
        tags: Array.isArray(item.tags) ? item.tags.map(function (t) { return String(t).slice(0, 12); }).slice(0, 8) : []
      };
    }

    return {
      kind: 'ledger',
      type: item.type === 'income' ? 'income' : 'expense',
      amount: Math.abs(Number(item.amount) || 0),
      title: String(item.title || '').trim().slice(0, 40),
      category: String(item.category || item.cat || '').trim().slice(0, 20),
      date: String(item.date || todayStr()).slice(0, 10),
      accountId: String(item.accountId || 'wechat')
    };
  }

  function promptBlock(charId) {
    if (!isAiAware(charId)) return '';
    var allowed = Object.keys(KIND_META).filter(function (kind) { return permOf(charId, kind); });
    if (!allowed.length) return '';

    var lines = [];
    lines.push('【生活记录能力（仅限 user 主动提到的事实）】');
    lines.push('当 user 明确说起自己的经期、开销、偏好、约定或重要经历，或让你替她记一下时，你可以在回复最末单独一行写一条系统指令。不要猜测，不要每句话都记，一次只写一条。');
    if (allowed.indexOf('period') >= 0) {
      lines.push('经期开始：\n[生活记录: {"kind":"period_start","date":"YYYY-MM-DD","note":"她自己的原话，可省略"}]');
    }
    if (allowed.indexOf('ledger') >= 0) {
      lines.push('记账：\n[生活记录: {"kind":"ledger","type":"expense","amount":32,"title":"咖啡","category":"咖啡","date":"YYYY-MM-DD"}]');
      lines.push('type 只能是 expense 或 income；amount 只写正数；category 用“咖啡/三餐/交通/医疗/购物/奶茶甜品”这类常见分类即可。');
    }
    if (allowed.indexOf('diary') >= 0) {
      lines.push('日记：\n[生活记录: {"kind":"diary","text":"你想写在她今天这页底下的一句话"}]');
      lines.push('日记只写在 user 最近一页纸的底下，不覆盖她的正文；她没有写过页时，系统会告诉你写不了，不要硬写。');
    }
    if (allowed.indexOf('memory') >= 0) {
      lines.push('记一件事：\n[记下来: 她明确说过的偏好、约定、重要经历或关系节点，写完整一句，不要编]');
      lines.push('记忆只记 user 明确说的事实；不要把她随口的气话、玩笑或你自己的推测写进去。');
    }
    lines.push('这些指令 user 看不到。系统会弹一张确认卡，只有她点确认才会真的写进健康、账本或记忆；她拒绝就不写，也不要追问。');
    return lines.join('\n');
  }

  function buildForm(item) {
    if (item.kind === 'period') {
      return '' +
        '<label class="life-write-field">日期<input class="life-write-input" id="lw-date" type="date" value="' + escapeHtml(item.date) + '"></label>' +
        '<label class="life-write-field">备注（可留空）<input class="life-write-input" id="lw-note" type="text" maxlength="80" value="' + escapeHtml(item.note) + '" placeholder="比如：今天来了，肚子有点酸"></label>';
    }
    if (item.kind === 'memory') {
      return '' +
        '<label class="life-write-field">要记住的事<textarea class="life-write-input life-write-textarea" id="lw-memory" rows="4" maxlength="500" placeholder="她想让你记住的事">' + escapeHtml(item.text) + '</textarea></label>' +
        '<label class="life-write-field">标签（可选，用逗号分开）<input class="life-write-input" id="lw-tags" type="text" maxlength="60" value="' + escapeHtml((item.tags || []).join('，')) + '" placeholder="比如：约定，生日"></label>';
    }
    if (item.kind === 'diary') {
      return '' +
        '<label class="life-write-field">写在最近一页底下<textarea class="life-write-input life-write-textarea" id="lw-diary" rows="5" maxlength="500" placeholder="今天想和她说的话">' + escapeHtml(item.text) + '</textarea></label>';
    }
    var typeOptions = '<option value="expense"' + (item.type === 'expense' ? ' selected' : '') + '>支出</option>' +
      '<option value="income"' + (item.type === 'income' ? ' selected' : '') + '>收入</option>';
    return '' +
      '<label class="life-write-field">类型<select class="life-write-input" id="lw-type">' + typeOptions + '</select></label>' +
      '<label class="life-write-field">金额<input class="life-write-input" id="lw-amount" type="number" min="0" step="0.01" value="' + (item.amount || '') + '"></label>' +
      '<label class="life-write-field">记什么<input class="life-write-input" id="lw-title" type="text" maxlength="40" value="' + escapeHtml(item.title) + '" placeholder="比如：咖啡"></label>' +
      '<label class="life-write-field">分类<input class="life-write-input" id="lw-category" type="text" maxlength="20" value="' + escapeHtml(item.category) + '" placeholder="比如：咖啡"></label>' +
      '<label class="life-write-field">日期<input class="life-write-input" id="lw-date" type="date" value="' + escapeHtml(item.date) + '"></label>';
  }

  function summaryOf(item, name) {
    if (item.kind === 'period') {
      return name + ' 想替你记：经期开始 · ' + fmtDate(item.date);
    }
    if (item.kind === 'memory') {
      var shortText = String(item.text || '').replace(/\s+/g, ' ').slice(0, 46);
      return name + ' 想记住：' + shortText + (String(item.text || '').length > 46 ? '…' : '');
    }
    if (item.kind === 'diary') {
      var diaryText = String(item.text || '').replace(/\s+/g, ' ').slice(0, 46);
      return name + ' 想写在你最近一页底下：' + diaryText + (String(item.text || '').length > 46 ? '…' : '');
    }
    return name + ' 想替你记：' + (item.type === 'income' ? '收入' : '支出') + ' ' +
      Number(item.amount || 0).toFixed(2) + ' 元 · ' + (item.title || item.category || '一笔');
  }

  function closeModal() {
    var modal = document.getElementById(MODAL_ID);
    if (modal) modal.remove();
  }

  function requestConfirm(item, charId) {
    return new Promise(function (resolve) {
      closeModal();
      var name = charNameOf(charId);
      var root = document.body;
      var modal = document.createElement('div');
      modal.className = 'avatar-change-mask';
      modal.id = MODAL_ID;
      modal.innerHTML =
        '<div class="avatar-change-card life-write-card">' +
          '<div class="avatar-change-kicker">角色想帮你记</div>' +
          '<div class="avatar-change-title">' + escapeHtml(KIND_META[item.kind].title) + '</div>' +
          '<div class="life-write-summary" id="lw-summary">' + escapeHtml(summaryOf(item, name)) + '</div>' +
          '<div class="life-write-form" id="lw-form">' + buildForm(item) + '</div>' +
          '<div class="life-write-hint">只有你点“记下”才会写进去。写错了可以在插件中心撤销最近一次。</div>' +
          '<div class="avatar-change-actions">' +
            '<button class="avatar-change-btn secondary" type="button" onclick="LifeWriteResolve(false)">这次不记</button>' +
            '<button class="avatar-change-btn primary" type="button" onclick="LifeWriteResolve(true)">记下</button>' +
          '</div>' +
        '</div>';
      root.appendChild(modal);
      pending = { resolve: resolve, item: item, charId: charId };
      modal.classList.add('open');
      setTimeout(function () {
        var input = modal.querySelector('input, select');
        if (input) input.focus();
      }, 30);
    });
  }

  function collectForm(item) {
    var copy = Object.assign({}, item);
    var date = document.getElementById('lw-date');
    if (date) copy.date = date.value || todayStr();
    if (item.kind === 'period') {
      var note = document.getElementById('lw-note');
      if (note) copy.note = note.value.trim();
      return copy;
    }
    if (item.kind === 'memory') {
      var memoryText = document.getElementById('lw-memory');
      var tags = document.getElementById('lw-tags');
      if (memoryText) copy.text = memoryText.value.trim();
      if (tags) copy.tags = tags.value.split(/[，,]/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 8);
      return copy;
    }
    if (item.kind === 'diary') {
      var diaryText = document.getElementById('lw-diary');
      if (diaryText) copy.text = diaryText.value.trim();
      return copy;
    }
    var type = document.getElementById('lw-type');
    var amount = document.getElementById('lw-amount');
    var title = document.getElementById('lw-title');
    var category = document.getElementById('lw-category');
    if (type) copy.type = type.value === 'income' ? 'income' : 'expense';
    if (amount) copy.amount = Math.abs(Number(amount.value) || 0);
    if (title) copy.title = title.value.trim();
    if (category) copy.category = category.value.trim();
    return copy;
  }

  function labelOf(item, result) {
    if (item.kind === 'period') return '经期开始 · ' + fmtDate(item.date);
    if (item.kind === 'memory') {
      var text = String(item.text || '').replace(/\s+/g, ' ').replace(/[。！？!?]+$/, '');
      return text.length > 28 ? text.slice(0, 28) + '…' : text;
    }
    if (item.kind === 'diary') {
      var diary = String(item.text || '').replace(/\s+/g, ' ').replace(/[。！？!?]+$/, '');
      return '日记 · ' + (diary.length > 28 ? diary.slice(0, 28) + '…' : diary);
    }
    var amount = Number(item.amount || 0).toFixed(2);
    return (item.type === 'income' ? '+' : '-') + amount + ' · ' + (item.title || item.category || '一笔');
  }

  function pushLog(entry) {
    var list = readJson(LOG_KEY, []);
    if (!Array.isArray(list)) list = [];
    list.unshift(entry);
    writeJson(LOG_KEY, list.slice(0, 30));
  }

  function apply(item, charId) {
    if (!permOf(charId, item.kind)) return { ok: false, message: '这个角色没有开「' + KIND_META[item.kind].label + '」的记录权限。' };
    if (item.kind === 'period') {
      if (typeof window.healthApplyPeriodStart !== 'function') return { ok: false, message: '健康数据还没准备好，这次没记。' };
      var periodResult = window.healthApplyPeriodStart(item.date, item.note);
      if (!periodResult || !periodResult.ok) {
        return { ok: false, message: '这天已经记过经期开始了，没有重复写。' };
      }
      pushLog({
        id: 'lw_' + Date.now(),
        charId: charId,
        kind: 'period',
        date: item.date,
        label: labelOf(item, periodResult),
        createdAt: Date.now()
      });
      return { ok: true, message: '已记下：' + labelOf(item, periodResult) + '。' };
    }

    if (item.kind === 'diary') {
      if (!item.text) return { ok: false, message: '这一页没有写内容，没写进日记。' };
      if (typeof window.sayApplyCharNote !== 'function') {
        return { ok: false, message: '日记还没准备好，这次没写。' };
      }
      var diaryResult = window.sayApplyCharNote({
        charId: charId,
        charName: charNameOf(charId),
        text: item.text
      });
      if (!diaryResult || !diaryResult.ok) {
        return { ok: false, message: diaryResult && diaryResult.reason === 'no-entry'
          ? '你最近还没有写过一页纸，先开一页，他才能写在这页底下。'
          : '这页日记没写进去，再试一次。' };
      }
      pushLog({
        id: 'lw_' + Date.now(),
        charId: charId,
        kind: 'diary',
        entryId: diaryResult.entryId,
        replyId: diaryResult.reply && diaryResult.reply.id,
        label: labelOf(item, diaryResult),
        createdAt: Date.now()
      });
      return { ok: true, message: '已写在最近一页底下：' + labelOf(item, diaryResult) + '。' };
    }

    if (item.kind === 'memory') {
      if (!item.text) return { ok: false, message: '这次没有写具体内容，没记。' };
      if (!window.MemoryEngine || typeof window.MemoryEngine.remember !== 'function') {
        return { ok: false, message: '记忆库还没准备好，这次没记。' };
      }
      var memoryResult = window.MemoryEngine.remember({
        scope: 'single',
        targetId: charId,
        targetName: charNameOf(charId),
        text: item.text,
        tags: item.tags || []
      });
      if (!memoryResult || !memoryResult.ok) return { ok: false, message: '这件事没写进记忆，再试一次。' };
      pushLog({
        id: 'lw_' + Date.now(),
        charId: charId,
        kind: 'memory',
        recordId: memoryResult.card.id,
        label: labelOf(item, memoryResult),
        createdAt: Date.now()
      });
      if (memoryResult.action === 'merged') {
        return { ok: true, message: '这件事之前记过，已经合并到「' + memoryResult.card.title + '」，没有重复堆。' };
      }
      return { ok: true, message: '已记住：' + labelOf(item, memoryResult) + '。' };
    }

    if (typeof window.ledgerApplyRecord !== 'function') return { ok: false, message: '账本还没准备好，这次没记。' };
    var ledgerResult = window.ledgerApplyRecord(item);
    if (!ledgerResult || !ledgerResult.ok) {
      return { ok: false, message: '这笔账没写进去，金额好像是空的。' };
    }
    pushLog({
      id: 'lw_' + Date.now(),
      charId: charId,
      kind: 'ledger',
      recordId: ledgerResult.record.id,
      label: labelOf(item, ledgerResult),
      createdAt: Date.now()
    });
    return { ok: true, message: '已记一笔：' + labelOf(item, ledgerResult) + '（' + ledgerResult.catName + '）。' };
  }

  async function handleCommand(raw, opts) {
    var item = normalizeItem(raw);
    if (!item) return { ok: false, message: '' };
    var charId = String((opts && opts.charId) || '');
    if (!charId || !isAiAware(charId)) return { ok: false, message: '' };
    if (!permOf(charId, item.kind)) return { ok: false, message: '' };
    var confirmed = await requestConfirm(item, charId);
    if (!confirmed) return { ok: false, message: '这次没记。' };
    return apply(confirmed, charId);
  }

  function resolveModal(agree) {
    if (!pending) return;
    var current = pending;
    pending = null;
    if (!agree) {
      closeModal();
      current.resolve(null);
      return;
    }
    var edited = collectForm(current.item);
    closeModal();
    current.resolve(edited);
  }

  function undoLast(charId) {
    var list = readJson(LOG_KEY, []);
    if (!Array.isArray(list) || !list.length) return false;
    var target = list.filter(function (row) { return !charId || row.charId === charId; })[0];
    if (!target) return false;
    var ok = false;
    if (target.kind === 'period' && typeof window.healthUndoPeriodStart === 'function') {
      ok = window.healthUndoPeriodStart(target.date);
    } else if (target.kind === 'ledger' && typeof window.ledgerUndoRecord === 'function') {
      ok = window.ledgerUndoRecord(target.recordId);
    } else if (target.kind === 'diary' && typeof window.sayUndoCharNote === 'function') {
      ok = window.sayUndoCharNote(target.entryId, target.replyId);
    } else if (target.kind === 'memory' && window.MemoryEngine && typeof window.MemoryEngine.archiveMemory === 'function') {
      ok = window.MemoryEngine.archiveMemory(target.recordId, '用户在插件中心撤销');
    }
    if (!ok) return false;
    writeJson(LOG_KEY, list.filter(function (row) { return row.id !== target.id; }));
    return true;
  }

  function renderPermissionCard() {
    var card = document.getElementById('life-write-perm-card');
    if (!card) return;
    var listEl = card.querySelector('#life-write-role-list');
    var summaryEl = card.querySelector('#life-write-summary');
    var chars = humanChars();
    if (summaryEl) {
      var enabled = chars.filter(function (c) {
        return Object.keys(KIND_META).some(function (kind) { return permOf(c.id, kind); });
      }).length;
      summaryEl.textContent = chars.length
        ? (enabled ? '已允许 ' + enabled + ' 个角色提议生活记录、日记和记忆；写入前都会先问你。' : '目前都关着，角色不会提议记录。')
        : '还没有人机恋角色。先把角色陪伴方式设为「人机恋」再来。';
    }
    if (!listEl) return;
    if (!chars.length) {
      listEl.innerHTML = '<div class="workpack-empty">没有可设置的人机恋角色</div>';
      return;
    }
    listEl.innerHTML = chars.map(function (c) {
      var name = escapeHtml(c.name || '未命名');
      var id = escapeHtml(c.id);
      return '<div class="life-write-role-row">' +
        '<div class="life-write-role-name">' + name + '</div>' +
        '<div class="life-write-chips">' +
          Object.keys(KIND_META).map(function (kind) {
            var on = permOf(c.id, kind);
            return '<button type="button" class="life-write-chip' + (on ? ' on' : '') + '" onclick="LifeWrite.togglePerm(\'' + id + '\',\'' + kind + '\')">' + KIND_META[kind].label + '</button>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function togglePerm(charId, kind) {
    setPerm(charId, kind, !permOf(charId, kind));
    renderPermissionCard();
  }

  function boot() {
    renderPermissionCard();
    function wrapOpenPage() {
      try {
        if (typeof window.openPage === 'function' && !window.openPage.__lifeWriteWrapped) {
          var originalOpenPage = window.openPage;
          var wrappedOpenPage = function (pageId) {
            var result = originalOpenPage.apply(this, arguments);
            if (pageId === 'page-plugins') setTimeout(renderPermissionCard, 80);
            return result;
          };
          wrappedOpenPage.__lifeWriteWrapped = true;
          window.openPage = wrappedOpenPage;
          return true;
        }
      } catch (e) {}
      return false;
    }
    wrapOpenPage();
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      wrapOpenPage();
      if (document.getElementById('life-write-perm-card')) renderPermissionCard();
      if (tries > 20) clearInterval(timer);
    }, 250);
  }

  window.LifeWrite = {
    promptBlock: promptBlock,
    handleCommand: handleCommand,
    apply: apply,
    undoLast: undoLast,
    renderPermissionCard: renderPermissionCard,
    togglePerm: togglePerm,
    parse: normalizeItem,
    _permOf: permOf
  };
  window.LifeWriteResolve = resolveModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
