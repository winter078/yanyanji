(function () {
  'use strict';

  var PACK_KEY = 'momo_char_work_pack_v1';
  var TASK_KEY = 'momo_work_tasks_v1';
  var TASK_LIMIT = 10;
  var TASK_MAX_AGE = 24 * 60 * 60 * 1000;

  function parseJSON(raw, fallback) {
    try {
      var value = JSON.parse(raw || 'null');
      return value === null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function uniqueIds(ids) {
    var out = [];
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      id = String(id || '').trim();
      if (id && out.indexOf(id) === -1) out.push(id);
    });
    return out;
  }

  function readSelected() {
    var raw = parseJSON(localStorage.getItem(PACK_KEY), []);
    if (Array.isArray(raw)) return uniqueIds(raw);
    if (raw && typeof raw === 'object') {
      return uniqueIds(Object.keys(raw).filter(function (id) { return !!raw[id]; }));
    }
    return [];
  }

  function writeSelected(ids) {
    try {
      localStorage.setItem(PACK_KEY, JSON.stringify(uniqueIds(ids)));
    } catch (e) {}
  }

  function isEnabledForChar(charId) {
    var id = String(charId || '');
    return !!id && readSelected().indexOf(id) !== -1;
  }

  function readTasks() {
    var raw = parseJSON(localStorage.getItem(TASK_KEY), {});
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }

  function writeTasks(map) {
    try {
      localStorage.setItem(TASK_KEY, JSON.stringify(map || {}));
    } catch (e) {
      // 配额满了就只保留最近的任务，避免把聊天存储拖死。
      var fallback = {};
      Object.keys(map || {}).forEach(function (charId) {
        var list = (map[charId] || []).slice(-3);
        fallback[charId] = list;
      });
      try { localStorage.setItem(TASK_KEY, JSON.stringify(fallback)); } catch (e2) {}
    }
  }

  // 页面一关，内存里的生成就断了；把上次留下的 running 标成“已中断”，
  // 否则重开页面会永远显示“进行中”。
  function markInterruptedTasks() {
    var map = readTasks();
    var changed = false;
    Object.keys(map).forEach(function (charId) {
      var list = Array.isArray(map[charId]) ? map[charId] : [];
      list.forEach(function (task) {
        if (!task || task.status !== 'running') return;
        task.status = 'interrupted';
        task.error = '页面关闭或刷新，任务停在这里';
        (task.steps || []).forEach(function (step) {
          if (step && step.status === 'running') step.status = 'fail';
        });
        changed = true;
      });
    });
    if (changed) writeTasks(map);
  }

  function allTasks() {
    var map = readTasks();
    var out = [];
    Object.keys(map).forEach(function (charId) {
      var list = Array.isArray(map[charId]) ? map[charId] : [];
      list.forEach(function (task) {
        if (!task || !task.id) return;
        var copy = clone(task);
        copy.charId = copy.charId || charId;
        out.push(copy);
      });
    });
    out.sort(function (a, b) {
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
    return out;
  }

  function getTask(taskId) {
    var id = String(taskId || '');
    if (!id) return null;
    var list = allTasks();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
  }

  function saveTask(task) {
    if (!task || !task.id || !task.charId) return;
    var map = readTasks();
    var list = Array.isArray(map[task.charId]) ? map[task.charId] : [];
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === task.id) { idx = i; break; }
    }
    var copy = clone(task);
    copy.updatedAt = Date.now();
    if (idx >= 0) list[idx] = copy;
    else list.push(copy);
    list.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    if (list.length > TASK_LIMIT) list = list.slice(-TASK_LIMIT);
    map[task.charId] = list;
    writeTasks(map);
  }

  function lastTaskForChar(charId) {
    var list = readTasks()[String(charId || '')];
    if (!Array.isArray(list)) return null;
    var found = null;
    list.forEach(function (task) {
      if (!task || !task.artifactId) return;
      if (!found || (task.createdAt || 0) > (found.createdAt || 0)) found = task;
    });
    return found;
  }

  function kindLabel(kind) {
    if (kind === 'xlsx') return 'Excel 表格';
    if (kind === 'pptx') return 'PPT 演示';
    if (kind === 'md') return 'Markdown 文档';
    return 'Word 文档';
  }

  function revisionLike(text) {
    var t = String(text || '');
    return /(改一下|改一版|改改|修改|调整|换成|换一版|重做|再来一版|第一段|第二段|第三段|标题|太长|太短|压缩|扩写|删掉|加上|补一下)/.test(t);
  }

  function compareLike(text) {
    if (window.MomArtifacts && typeof window.MomArtifacts.wantsCompare === 'function') {
      return window.MomArtifacts.wantsCompare(text);
    }
    return /(对比|比较|区别|差异|差别|不同|哪个好|哪个更|哪家|选哪个|怎么选|差在哪|优劣|性价比|PK|pk)/.test(String(text || ''));
  }

  function needsResearch(text) {
    var t = String(text || '');
    return /(查|搜|最新|今年|去年|2025|2026|政策|价格|销量|数据|市场|新闻|行情|研究|报告|统计)/.test(t) &&
      !/(刚才|刚刚|这段|这个话题|聊天记录|我们聊|上面的对话)/.test(t);
  }

  function shouldRun(options) {
    var opts = options || {};
    if (window.__groupMode || window.__voiceCallMode) return false;
    var charId = String(opts.charId || '');
    if (!charId || !isEnabledForChar(charId)) return false;
    var text = String(opts.userText || '');
    var imageCount = Number(opts.imageCount || (Array.isArray(opts.images) ? opts.images.length : 0) || 0);
    if (imageCount >= 2 && compareLike(text)) return true;
    if (window.MomArtifacts && typeof window.MomArtifacts.wantsFile === 'function' && window.MomArtifacts.wantsFile(text)) {
      return true;
    }
    var last = lastTaskForChar(charId);
    return !!(last && (Date.now() - (last.createdAt || 0) <= TASK_MAX_AGE) && revisionLike(text));
  }

  function makeStep(key, label, status) {
    return { key: key, label: label, status: status || 'pending' };
  }

  function makeTask(opts) {
    var revision = !!opts.revision;
    var hasImages = !!opts.hasImages;
    var compare = !!opts.compareMode;
    var steps = [makeStep('understand', revision ? '读上一版' : '拆需求', 'done')];
    if (opts.hasResearch) steps.push(makeStep('research', '查资料', 'done'));
    else if (opts.wantsResearch) steps.push(makeStep('research', '查资料', 'skip'));
    if (hasImages) steps.push(makeStep('look', compare ? '看图对比' : '看截图', 'running'));
    steps.push(makeStep('write', revision ? '按你的要求改' : '写内容', hasImages ? 'pending' : 'running'));
    steps.push(makeStep('verify', '检查文件', 'pending'));
    steps.push(makeStep('deliver', '出文件', 'pending'));
    return {
      id: 'work_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      charId: String(opts.charId || ''),
      kind: opts.kind,
      title: (hasImages ? (compare ? '看图对比 · ' : '看图 · ') : '') + (revision ? '改一版 ' : '做一份 ') + kindLabel(opts.kind),
      goal: String(opts.userText || '').replace(/\s+/g, ' ').slice(0, 90),
      status: 'running',
      steps: steps,
      imageCount: hasImages ? (opts.imageCount || 0) : 0,
      imageSegments: hasImages ? (opts.imageSegments || opts.imageCount || 0) : 0,
      imageDropped: hasImages ? (opts.imageDropped || 0) : 0,
      compareMode: compare,
      artifactId: '',
      artifactName: '',
      error: '',
      retryOf: '',
      retriedBy: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  // 用户从旧任务点“继续/重试”时，聊天层会在输入框里留下一个待接手的标记。
  // 只有真正生成了新任务，才把旧任务收口；没有生成（比如 Key 没填）就保留旧任务，避免误锁。
  function takeRetryOrigin(task, charId) {
    var pending = window.__momPendingRetry;
    if (!pending || !pending.taskId || !pending.at) return '';
    if (Date.now() - Number(pending.at) > 120000) {
      window.__momPendingRetry = null;
      return '';
    }
    if (String(pending.charId || '') !== String(charId || '')) return '';
    if (String(pending.goal || '').replace(/\s+/g, ' ').trim().slice(0, 90) !== task.goal) return '';
    window.__momPendingRetry = null;
    return String(pending.taskId);
  }

  function markTaskRetried(oldId, newTask) {
    var map = readTasks();
    var changed = false;
    Object.keys(map).forEach(function (charId) {
      var list = Array.isArray(map[charId]) ? map[charId] : [];
      list.forEach(function (task) {
        if (!task || task.id !== oldId) return;
        if (task.status !== 'error' && task.status !== 'interrupted') return;
        task.status = 'superseded';
        task.error = '';
        task.retriedBy = newTask && newTask.id ? newTask.id : '';
        task.updatedAt = Date.now();
        changed = true;
      });
    });
    if (!changed) return;
    writeTasks(map);
    try { if (window.refreshWorkTaskLedger) window.refreshWorkTaskLedger(); } catch (e) {}
    try { if (window.__momUpsertWorkTask) window.__momUpsertWorkTask(getTask(oldId)); } catch (e) {}
  }

  function setStep(task, key, status) {
    (task.steps || []).forEach(function (step) {
      if (step.key === key) step.status = status;
    });
  }

  function emit(task, onUpdate) {
    saveTask(task);
    try { if (window.refreshWorkTaskLedger) window.refreshWorkTaskLedger(); } catch (e) {}
    if (typeof onUpdate === 'function') {
      try { onUpdate(clone(task)); } catch (e) {}
    }
  }

  async function run(options) {
    var opts = options || {};
    if (!window.MomArtifacts || typeof window.MomArtifacts.maybeCreate !== 'function') return null;
    var charId = String(opts.charId || '');
    if (!charId || !isEnabledForChar(charId)) return null;

    var userText = String(opts.userText || '');
    var images = (Array.isArray(opts.images) ? opts.images : []).filter(Boolean).slice(0, 8);
    var hasImages = images.length > 0;
    var sourceImageCount = hasImages ? Math.max(1, Number(opts.sourceImageCount || opts.imageCount || 0) || images.length) : 0;
    var imageTotal = Math.max(sourceImageCount, Number(opts.imageTotal || 0));
    var imageDropped = Math.max(0, Number(opts.imageDropped || 0) || (imageTotal - sourceImageCount));
    var last = lastTaskForChar(charId);
    var revision = false;
    var compare = hasImages && sourceImageCount >= 2 && compareLike(userText);
    var kind = window.MomArtifacts.wantsFile(userText) || '';
    if (!kind && compare) kind = 'docx';
    if (!kind && last && (Date.now() - (last.createdAt || 0) <= TASK_MAX_AGE) && revisionLike(userText)) {
      kind = last.kind;
      revision = true;
    }
    if (!kind) return null;

    var previousArtifact = null;
    if (revision) {
      previousArtifact = window.MomArtifacts.get(last.artifactId);
      if (!previousArtifact || !previousArtifact.spec) {
        var missing = makeTask({
          charId: charId,
          userText: userText,
          kind: kind,
          revision: true,
          hasResearch: !!opts.toolText,
          wantsResearch: needsResearch(userText),
          hasImages: hasImages,
          imageCount: sourceImageCount,
          imageSegments: images.length,
          imageDropped: imageDropped,
          compareMode: compare
        });
        missing.status = 'error';
        missing.error = '上一版文件已经清理掉了，重新做一份吧';
        missing.steps.forEach(function (step) {
          if (step.key === 'look' || step.key === 'write' || step.key === 'verify' || step.key === 'deliver') step.status = 'skip';
        });
        emit(missing, opts.onUpdate);
        return { task: missing, error: missing.error };
      }
    }

    var task = makeTask({
      charId: charId,
      userText: userText,
      kind: kind,
      revision: revision,
      hasResearch: !!opts.toolText,
      wantsResearch: needsResearch(userText),
      hasImages: hasImages,
      imageCount: sourceImageCount,
      imageSegments: images.length,
      imageDropped: imageDropped,
      compareMode: compare
    });
    var retryOf = takeRetryOrigin(task, charId);
    if (retryOf) task.retryOf = retryOf;
    emit(task, opts.onUpdate);
    if (retryOf) markTaskRetried(retryOf, task);

    try {
      var made = await window.MomArtifacts.maybeCreate({
        userText: userText,
        contextSnippet: opts.contextSnippet || '',
        scopeNote: '工作包任务',
        kind: kind,
        images: images,
        sourceImageCount: sourceImageCount,
        previousSpec: previousArtifact ? previousArtifact.spec : null,
        silent: true
      });

      // 生成期间用户可能点了“取消”；以任务台账为准，取消后不能再把任务改回已完成。
      var current = getTask(task.id);
      if (current && current.status === 'cancelled') {
        return { task: current, cancelled: true };
      }

      if (!made || made.error) {
        throw new Error((made && made.error) || '没有生成文件');
      }

      setStep(task, 'look', 'done');
      setStep(task, 'write', 'done');
      setStep(task, 'verify', 'running');
      emit(task, opts.onUpdate);

      if (!made.id || !made.spec || !made.size) {
        throw new Error('文件没有通过检查');
      }

      setStep(task, 'verify', 'done');
      setStep(task, 'deliver', 'done');
      task.artifactId = made.id;
      task.artifactName = made.name;
      task.status = 'done';
      emit(task, opts.onUpdate);
      return { task: task, artifact: made, toolText: String(opts.toolText || '') };
    } catch (err) {
      var latest = getTask(task.id);
      if (latest && latest.status === 'cancelled') {
        return { task: latest, cancelled: true };
      }
      task.status = 'error';
      task.error = String(err && err.message ? err.message : err);
      if (hasImages) {
        setStep(task, 'look', 'fail');
        setStep(task, 'write', 'skip');
      } else {
        setStep(task, 'write', 'fail');
      }
      setStep(task, 'verify', 'skip');
      setStep(task, 'deliver', 'skip');
      emit(task, opts.onUpdate);
      return { task: task, error: task.error };
    }
  }

  window.WorkPack = {
    selectedIds: readSelected,
    setSelectedIds: function (ids) {
      writeSelected(ids);
      if (typeof window.refreshWorkPackUI === 'function') window.refreshWorkPackUI();
    },
    isEnabledForChar: isEnabledForChar,
    shouldRun: shouldRun,
    run: run,
    lastTaskForChar: lastTaskForChar,
    getTasks: allTasks,
    getTask: getTask,
    cancelTask: cancelTask
  };

  // ================= 插件中心：角色多选 =================
  var bootTries = 0;

  function refreshWorkPackUI() {
    var list = document.getElementById('work-pack-role-list');
    var summary = document.getElementById('work-pack-summary');
    var btn = document.getElementById('work-pack-manage-btn');
    if (!list || !summary) return;

    if (typeof window.getCharacters !== 'function') {
      if (bootTries++ < 30) setTimeout(refreshWorkPackUI, 300);
      return;
    }

    var chars = window.getCharacters() || [];
    var existingIds = chars.map(function (c) { return String((c && c.id) || ''); }).filter(Boolean);
    var ids = readSelected();
    var kept = ids.filter(function (id) { return existingIds.indexOf(id) !== -1; });
    if (kept.length !== ids.length) writeSelected(kept);

    summary.textContent = kept.length ? ('已选 ' + kept.length + ' 个角色') : '未选择角色';
    if (btn) btn.textContent = list.style.display === 'block' ? '收起' : '选择角色';

    list.innerHTML = '';
    if (!chars.length) {
      var empty = document.createElement('div');
      empty.className = 'workpack-empty';
      empty.textContent = '还没有角色，先去微信里建一个。';
      list.appendChild(empty);
      return;
    }

    chars.forEach(function (c) {
      if (!c || !c.id) return;
      var id = String(c.id);
      var row = document.createElement('label');
      row.className = 'workpack-role-row';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = id;
      cb.checked = kept.indexOf(id) !== -1;
      cb.addEventListener('change', function () {
        window.toggleWorkPackCharacter(id, cb.checked);
      });

      var avatar;
      if (c.avatar) {
        avatar = document.createElement('img');
        avatar.className = 'workpack-role-avatar';
        avatar.src = c.avatar;
        avatar.alt = '';
        avatar.loading = 'lazy';
      } else {
        avatar = document.createElement('span');
        avatar.className = 'workpack-role-avatar workpack-role-avatar-text';
        avatar.textContent = String(c.name || '角').trim().slice(0, 1);
      }

      var name = document.createElement('span');
      name.className = 'workpack-role-name';
      name.textContent = c.name || '未命名角色';

      var state = document.createElement('span');
      state.className = 'workpack-role-state';
      state.textContent = cb.checked ? '已启用' : '未启用';

      row.appendChild(cb);
      row.appendChild(avatar);
      row.appendChild(name);
      row.appendChild(state);
      list.appendChild(row);
    });
    try { refreshWorkTaskLedger(); } catch (e) {}
    try { if (window.refreshAppUpdateUI) window.refreshAppUpdateUI(); } catch (e) {}
  }

  function taskState(task) {
    if (task && task.status === 'done') return { cls: 'done', text: '已完成' };
    if (task && task.status === 'error') return { cls: 'error', text: '失败' };
    if (task && task.status === 'interrupted') return { cls: 'warn', text: '已中断' };
    if (task && task.status === 'superseded') return { cls: 'superseded', text: '已转新任务' };
    if (task && task.status === 'cancelled') return { cls: 'cancelled', text: '已取消' };
    return { cls: 'running', text: '进行中' };
  }

  function stepText(status) {
    if (status === 'done') return '完成';
    if (status === 'fail') return '失败';
    if (status === 'skip') return '跳过';
    if (status === 'running') return '进行中';
    return '待开始';
  }

  function taskTime(task) {
    var ts = Number((task && (task.updatedAt || task.createdAt)) || 0);
    if (!ts) return '';
    var d = new Date(ts);
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  var ledgerExpanded = {};

  function taskDetailRows(task) {
    var rows = [];
    rows.push(['状态', taskState(task).text]);
    rows.push(['任务 ID', task.id || '']);
    rows.push(['时间', taskTime(task) || '']);
    rows.push(['来源', task.retryOf ? ('从旧任务继续 · ' + task.retryOf) : '直接发起']);
    if (task.artifactName) rows.push(['产出', task.artifactName]);
    if (task.cancelledReason) rows.push(['取消', task.cancelledReason]);
    if (task.error) rows.push(['错误', task.error]);
    var steps = Array.isArray(task.steps) ? task.steps : [];
    if (steps.length) {
      rows.push(['步骤', steps.map(function (s) {
        return (s && s.label ? s.label : '步骤') + '：' + stepText(s && s.status);
      }).join(' · ')]);
    }
    return rows;
  }

  function appendTaskDetail(row, task) {
    var detail = document.createElement('div');
    detail.className = 'work-task-detail';
    taskDetailRows(task).forEach(function (pair) {
      var line = document.createElement('div');
      line.className = 'work-task-detail-row';
      var label = document.createElement('span');
      label.className = 'work-task-detail-label';
      label.textContent = pair[0];
      var value = document.createElement('span');
      value.className = 'work-task-detail-value';
      value.textContent = pair[1];
      line.appendChild(label);
      line.appendChild(value);
      detail.appendChild(line);
    });
    row.appendChild(detail);
  }

  function cancelTask(taskId) {
    var id = String(taskId || '');
    if (!id) return false;
    var map = readTasks();
    var changed = false;
    Object.keys(map).forEach(function (charId) {
      var list = Array.isArray(map[charId]) ? map[charId] : [];
      list.forEach(function (task) {
        if (!task || task.id !== id || task.status !== 'running') return;
        task.status = 'cancelled';
        task.cancelledReason = '你取消了这次任务';
        task.error = '';
        task.cancelledAt = Date.now();
        task.updatedAt = Date.now();
        (task.steps || []).forEach(function (step) {
          if (step && step.status === 'running') step.status = 'pending';
        });
        changed = true;
      });
    });
    if (!changed) return false;
    writeTasks(map);
    try { if (window.refreshWorkTaskLedger) window.refreshWorkTaskLedger(); } catch (e) {}
    try { if (window.__momUpsertWorkTask) window.__momUpsertWorkTask(getTask(id)); } catch (e) {}
    return true;
  }

  function charNameById(charId) {
    var id = String(charId || '');
    var chars = [];
    try { chars = (typeof window.getCharacters === 'function') ? (window.getCharacters() || []) : []; } catch (e) { chars = []; }
    for (var i = 0; i < chars.length; i++) {
      if (chars[i] && String(chars[i].id || '') === id) return chars[i].name || '未命名角色';
    }
    return '角色';
  }

  function refreshWorkTaskLedger() {
    var listEl = document.getElementById('work-task-ledger-list');
    var summaryEl = document.getElementById('work-task-ledger-summary');
    if (!listEl) return;

    var tasks = allTasks().slice(0, 6);
    if (summaryEl) {
      var active = tasks.filter(function (t) {
        return t.status !== 'done' && t.status !== 'superseded' && t.status !== 'cancelled';
      }).length;
      summaryEl.textContent = tasks.length
        ? ('最近 ' + tasks.length + ' 条' + (active ? ' · ' + active + ' 条未完成' : ''))
        : '还没有任务';
    }

    listEl.innerHTML = '';
    if (!tasks.length) {
      var empty = document.createElement('div');
      empty.className = 'work-task-empty';
      empty.textContent = '工作包角色要文件后，这里会出现任务进度。';
      listEl.appendChild(empty);
      return;
    }

    tasks.forEach(function (task) {
      var state = taskState(task);
      var row = document.createElement('div');
      row.className = 'work-task-row ' + state.cls;

      var main = document.createElement('div');
      main.className = 'work-task-main';

      var title = document.createElement('div');
      title.className = 'work-task-title';
      title.textContent = task.title || '工作包任务';

      var meta = document.createElement('div');
      meta.className = 'work-task-meta';
      var steps = Array.isArray(task.steps) ? task.steps : [];
      var doneSteps = steps.filter(function (s) { return s && (s.status === 'done' || s.status === 'skip'); }).length;
      meta.textContent = charNameById(task.charId) + ' · ' + (taskTime(task) || '') +
        (steps.length ? ' · 步骤 ' + doneSteps + '/' + steps.length : '');

      var stateEl = document.createElement('div');
      stateEl.className = 'work-task-state ' + state.cls;
      stateEl.textContent = state.text;

      main.appendChild(title);
      main.appendChild(meta);
      row.appendChild(main);
      row.appendChild(stateEl);

      var actions = document.createElement('div');
      actions.className = 'work-task-actions';

      var detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'work-task-retry secondary';
      detailBtn.textContent = ledgerExpanded[task.id] ? '收起' : '详情';
      detailBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        ledgerExpanded[task.id] = !ledgerExpanded[task.id];
        refreshWorkTaskLedger();
      });
      actions.appendChild(detailBtn);

      if (task.status === 'running') {
        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'work-task-retry danger';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          cancelTask(task.id);
        });
        actions.appendChild(cancelBtn);
      }

      if ((task.status === 'error' || task.status === 'interrupted') && task.goal) {
        if (task.imageCount) {
          var hint = document.createElement('div');
          hint.className = 'work-task-hint';
          hint.textContent = '带截图的任务要重新发图再试';
          row.appendChild(hint);
        } else {
          var retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'work-task-retry';
          retry.textContent = '重试';
          retry.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (window.__momRetryWorkTask) window.__momRetryWorkTask(task.id);
          });
          actions.appendChild(retry);
        }
      }
      row.appendChild(actions);

      if (task.cancelledReason) {
        var cancelHint = document.createElement('div');
        cancelHint.className = 'work-task-hint';
        cancelHint.textContent = task.cancelledReason;
        row.appendChild(cancelHint);
      }

      if (task.error && (task.status === 'error' || task.status === 'interrupted')) {
        var err = document.createElement('div');
        err.className = 'work-task-hint error';
        err.textContent = task.error;
        row.appendChild(err);
      }

      if (ledgerExpanded[task.id]) appendTaskDetail(row, task);

      listEl.appendChild(row);
    });
  }

  window.refreshWorkTaskLedger = refreshWorkTaskLedger;

  window.refreshWorkPackUI = refreshWorkPackUI;

  window.toggleWorkPackRolePicker = function () {
    var list = document.getElementById('work-pack-role-list');
    if (!list) return;
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
    refreshWorkPackUI();
    if (list.style.display === 'block') {
      try { list.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }
  };

  window.toggleWorkPackCharacter = function (charId, checked) {
    var ids = readSelected();
    var id = String(charId || '');
    if (!id) return;
    if (checked && ids.indexOf(id) === -1) ids.push(id);
    if (!checked) ids = ids.filter(function (x) { return x !== id; });
    writeSelected(ids);
    refreshWorkPackUI();
  };

  function bootWorkPackUI() {
    setTimeout(refreshWorkPackUI, 300);
    setTimeout(refreshWorkTaskLedger, 300);
  }

  markInterruptedTasks();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWorkPackUI, { once: true });
  } else {
    bootWorkPackUI();
  }
})();
