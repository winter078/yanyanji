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
    var steps = [makeStep('understand', revision ? '读上一版' : '拆需求', 'done')];
    if (opts.hasResearch) steps.push(makeStep('research', '查资料', 'done'));
    else if (opts.wantsResearch) steps.push(makeStep('research', '查资料', 'skip'));
    if (hasImages) steps.push(makeStep('look', '看截图', 'running'));
    steps.push(makeStep('write', revision ? '按你的要求改' : '写内容', hasImages ? 'pending' : 'running'));
    steps.push(makeStep('verify', '检查文件', 'pending'));
    steps.push(makeStep('deliver', '出文件', 'pending'));
    return {
      id: 'work_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      charId: String(opts.charId || ''),
      kind: opts.kind,
      title: (hasImages ? '看图 · ' : '') + (revision ? '改一版 ' : '做一份 ') + kindLabel(opts.kind),
      goal: String(opts.userText || '').replace(/\s+/g, ' ').slice(0, 90),
      status: 'running',
      steps: steps,
      imageCount: hasImages ? (opts.imageCount || 0) : 0,
      imageDropped: hasImages ? (opts.imageDropped || 0) : 0,
      artifactId: '',
      artifactName: '',
      error: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function setStep(task, key, status) {
    (task.steps || []).forEach(function (step) {
      if (step.key === key) step.status = status;
    });
  }

  function emit(task, onUpdate) {
    saveTask(task);
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
    var images = (Array.isArray(opts.images) ? opts.images : []).filter(Boolean).slice(0, 4);
    var hasImages = images.length > 0;
    var imageTotal = Math.max(images.length, Number(opts.imageTotal || 0));
    var imageDropped = Math.max(0, Number(opts.imageDropped || 0) || (imageTotal - images.length));
    var last = lastTaskForChar(charId);
    var revision = false;
    var kind = window.MomArtifacts.wantsFile(userText) || '';
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
          imageCount: images.length,
          imageDropped: imageDropped
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
      imageCount: images.length,
      imageDropped: imageDropped
    });
    emit(task, opts.onUpdate);

    try {
      var made = await window.MomArtifacts.maybeCreate({
        userText: userText,
        contextSnippet: opts.contextSnippet || '',
        scopeNote: '工作包任务',
        kind: kind,
        images: images,
        previousSpec: previousArtifact ? previousArtifact.spec : null,
        silent: true
      });

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
    lastTaskForChar: lastTaskForChar
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
  }

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWorkPackUI, { once: true });
  } else {
    bootWorkPackUI();
  }
})();
