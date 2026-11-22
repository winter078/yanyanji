(function () {
  'use strict';

  // ================= 文件生成：角色真的给你做 Word / Excel / PPT / Markdown =================
  // 结构：
  //   1) 用一次独立的模型调用把内容写成结构化 JSON（不占角色的聊天语气）
  //   2) 用前端库把 JSON 变成真 .docx / .xlsx / .pptx 字节
  //   3) 聊天里落一张可点开下载的卡片；刷新后凭 localStorage 里的 spec 重新生成

  var STORE_KEY = 'momo_artifacts_v1';
  var LIB_V = '20261122-2814';
  var loaded = {};

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('lib load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureLib(kind) {
    if (kind === 'md') return Promise.resolve();
    if (loaded[kind]) return loaded[kind];
    var map = {
      docx: { src: 'js/vendor/docx.umd.js?v=' + LIB_V, global: 'docx' },
      xlsx: { src: 'js/vendor/xlsx.full.min.js?v=' + LIB_V, global: 'XLSX' },
      pptx: { src: 'js/vendor/pptxgen.bundle.js?v=' + LIB_V, global: 'PptxGenJS' }
    };
    var cfg = map[kind];
    if (!cfg) return Promise.reject(new Error('unknown kind: ' + kind));
    if (window[cfg.global]) { loaded[kind] = Promise.resolve(); return loaded[kind]; }
    loaded[kind] = loadScript(cfg.src).then(function () {
      if (!window[cfg.global]) throw new Error('global missing: ' + cfg.global);
    });
    return loaded[kind];
  }

  // ---------- localStorage 产物索引 ----------
  function readAll() {
    try {
      var obj = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
  }

  function writeAll(obj) {
    var keys = Object.keys(obj);
    if (keys.length > 18) {
      keys.sort(function (a, b) { return (obj[a].createdAt || 0) - (obj[b].createdAt || 0); });
      while (keys.length > 18) delete obj[keys.shift()];
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    } catch (e) {
      // 配额满了：从最旧的开始丢，直到能存下
      var again = Object.keys(obj).sort(function (a, b) { return (obj[a].createdAt || 0) - (obj[b].createdAt || 0); });
      while (again.length > 1) {
        delete obj[again.shift()];
        try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); return; } catch (e2) {}
      }
    }
  }

  function getArtifact(id) {
    var all = readAll();
    return all[id] || null;
  }

  function saveArtifact(meta) {
    var all = readAll();
    all[meta.id] = meta;
    writeAll(all);
  }

  // ---------- 工具函数 ----------
  function uid() {
    return 'art_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function safeName(title, ext) {
    var base = String(title || '文件').replace(/[\\/:*?"<>|\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || '文件';
    return base + '.' + ext;
  }

  function formatSize(bytes) {
    var n = Number(bytes || 0);
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  function extOf(kind) {
    return kind === 'docx' ? 'docx' : (kind === 'xlsx' ? 'xlsx' : (kind === 'pptx' ? 'pptx' : 'md'));
  }

  function kindLabel(kind) {
    return kind === 'xlsx' ? 'Excel 表格' : (kind === 'pptx' ? 'PPT 演示' : (kind === 'docx' ? 'Word 文档' : 'Markdown 文档'));
  }

  // ---------- 生成字节 ----------
  async function buildBlob(meta) {
    var spec = meta && meta.spec;
    if (!spec) throw new Error('文件内容已丢失');
    if (meta.kind === 'md') {
      var text = [ '# ' + (spec.title || ''), '', spec.markdown || '' ].join('\n');
      return new Blob([text], { type: 'text/markdown;charset=utf-8' });
    }
    if (meta.kind === 'docx') {
      await ensureLib('docx');
      var d = window.docx;
      var children = [];
      if (spec.title) children.push(new d.Paragraph({ text: spec.title, heading: d.HeadingLevel.TITLE, spacing: { after: 160 } }));
      if (spec.subtitle) children.push(new d.Paragraph({ text: spec.subtitle, spacing: { after: 240 } }));
      (spec.sections || []).forEach(function (sec) {
        if (sec.heading) children.push(new d.Paragraph({ text: sec.heading, heading: d.HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
        (sec.paragraphs || []).forEach(function (p) {
          children.push(new d.Paragraph({ text: String(p || ''), spacing: { after: 100 }, line: 320 }));
        });
        (sec.bullets || []).forEach(function (b) {
          children.push(new d.Paragraph({ text: String(b || ''), bullet: { level: 0 }, spacing: { after: 60 } }));
        });
        if (sec.table && sec.table.headers && sec.table.rows) {
          var rows = [new d.TableRow({
            children: sec.table.headers.map(function (h) {
              return new d.TableCell({ children: [new d.Paragraph({ text: String(h || ''), bold: true })], width: { size: 100 / sec.table.headers.length, type: d.WidthType.PERCENTAGE } });
            })
          })];
          sec.table.rows.forEach(function (r) {
            rows.push(new d.TableRow({
              children: (r || []).map(function (c) {
                return new d.TableCell({ children: [new d.Paragraph({ text: String(c == null ? '' : c) })], width: { size: 100 / sec.table.headers.length, type: d.WidthType.PERCENTAGE } });
              })
            }));
          });
          children.push(new d.Table({ rows: rows, width: { size: 100, type: d.WidthType.PERCENTAGE }, margin: { top: 120, bottom: 120 } }));
        }
      });
      var doc = new d.Document({ sections: [{ properties: {}, children: children }] });
      return await d.Packer.toBlob(doc);
    }
    if (meta.kind === 'xlsx') {
      await ensureLib('xlsx');
      var XLSX = window.XLSX;
      var wb = XLSX.utils.book_new();
      (spec.sheets || []).forEach(function (sheet, i) {
        var headers = sheet.headers || [];
        var rows = (sheet.rows || []).map(function (r) {
          return headers.map(function (_, ci) { return (r && r[ci] != null) ? r[ci] : ''; });
        });
        var aoa = headers.length ? [headers].concat(rows) : rows;
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = headers.map(function (h, ci) {
          var w = Math.max(8, String(h || '').length + 2);
          for (var ri = 0; ri < rows.length && ri < 30; ri++) w = Math.max(w, String(rows[ri][ci] || '').length + 2);
          return { wch: Math.min(40, w) };
        });
        XLSX.utils.book_append_sheet(wb, ws, String(sheet.name || ('Sheet' + (i + 1))).slice(0, 31));
      });
      var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    if (meta.kind === 'pptx') {
      await ensureLib('pptx');
      var pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      var cover = pptx.addSlide();
      cover.background = { color: '1D1E26' };
      cover.addText(spec.title || '演示文稿', { x: 0.8, y: 2.3, w: 11.7, h: 1.3, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center' });
      if (spec.subtitle) cover.addText(spec.subtitle, { x: 0.8, y: 3.7, w: 11.7, h: 0.7, fontSize: 16, color: 'B9BDCB', align: 'center' });
      (spec.slides || []).forEach(function (slide) {
        var s = pptx.addSlide();
        s.addText(slide.title || '', { x: 0.7, y: 0.45, w: 11.9, h: 0.8, fontSize: 26, bold: true, color: '1D1E26' });
        var bullets = (slide.bullets || []).map(function (b) { return { text: String(b || ''), options: { bullet: true, fontSize: 16, color: '33343D', breakLine: true } }; });
        if (bullets.length) s.addText(bullets, { x: 0.85, y: 1.45, w: 11.6, h: 5.2, valign: 'top', lineSpacing: 28 });
        if (slide.note) s.addNotes(String(slide.note));
      });
      return await pptx.write({ outputType: 'blob' });
    }
    throw new Error('unsupported kind');
  }

  async function download(id) {
    var meta = getArtifact(id);
    if (!meta) throw new Error('这个文件已经从本机清理掉了，重新让它做一份吧');
    var blob = await buildBlob(meta);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = meta.name || ('文件.' + extOf(meta.kind));
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (e) {}
      a.remove();
    }, 4000);
    return meta;
  }

  // ---------- 意图判断 ----------
  var DOC_WORDS = /(表格|xlsx|excel|Excel|文档|word|Word|ppt|PPT|幻灯片|演示文稿|报告|总结|复盘|SOP|sop|流程|清单|简历|周报|日报|月报|会议纪要|方案书|计划书|方案)/;

  function detectKind(text) {
    var t = String(text || '');
    if (!DOC_WORDS.test(t)) return '';
    if (/(表格|xlsx|excel|Excel|清单)/.test(t)) return 'xlsx';
    if (/(ppt|PPT|幻灯片|演示文稿)/.test(t)) return 'pptx';
    if (/(文档|word|Word|报告|总结|复盘|SOP|sop|流程|方案|计划书|简历|周报|日报|月报|会议纪要)/.test(t)) return 'docx';
    return '';
  }

  var EXPLICIT_ACTION = /((帮我|给我|替我|麻烦|请|能不能|可以)[^，。！？\n]{0,10}(做|写|生成|整理|列|出|弄|搞))|((做|写|生成|整理|列|出|弄|搞)(一|个|份|张|套|版|成))|(整理成|总结成|汇总成|做成)/;

  function shouldMake(text) {
    var t = String(text || '');
    var kind = detectKind(t);
    if (!kind) return '';
    // 只是问“这个表格怎么做”这种咨询不算，必须带明确的“做一份 / 帮我写”动作
    if (!EXPLICIT_ACTION.test(t)) return '';
    return kind;
  }

  // ---------- 让模型写内容 ----------
  function schemaFor(kind) {
    if (kind === 'xlsx') {
      return '{"title":"表格标题","sheets":[{"name":"Sheet1","headers":["列1","列2"],"rows":[["值1","值2"]]}]}';
    }
    if (kind === 'pptx') {
      return '{"title":"演示标题","subtitle":"副标题（可空）","slides":[{"title":"单页标题","bullets":["要点1","要点2"],"note":"演讲备注（可空）"}]}';
    }
    return '{"title":"文档标题","subtitle":"副标题（可空）","sections":[{"heading":"小节标题","paragraphs":["正文段落"],"bullets":["要点"],"table":{"headers":["列1","列2"],"rows":[["值1","值2"]]}}]}';
  }

  async function draft(kind, userText, contextSnippet) {
    var app = window.appData || {};
    var apiKey = String(app.apiKey || '').trim();
    var apiBase = String(app.apiBase || '').trim();
    if (!apiKey || !apiBase) throw new Error('还没有配置模型 Key');
    var base = apiBase.replace(/\/+$/, '');
    if (base.endsWith('/chat/completions')) base = base.replace('/chat/completions', '');
    var url = base + '/chat/completions';
    var label = kind === 'xlsx' ? 'Excel 表格' : (kind === 'pptx' ? 'PPT 演示文稿' : 'Word 文档');
    var sys = [
      '你是一名专业文档撰写助手，不是角色扮演。根据用户的要求，直接产出一份可以直接拿去用的' + label + '内容。',
      '要求：',
      '1. 内容具体、可执行，不要空话套话；用户没给细节时，按常见工作场景补齐合理内容，并保持中立专业。',
      '2. 素材范围：只把与这次要求直接相关的对话内容当素材，提炼后重写；不要把聊天记录原样搬进文件，无关闲聊、亲密称呼和语气词全部忽略。若素材里包含【刚刚联网检索到的资料】，可以直接引用其中的事实和数字，但涉及来源时要如实标注，绝不编造来源或数据。',
      '3. 中文输出；标题和小标题简洁。',
      '4. 只输出严格 JSON，不要 markdown 代码块，不要解释。',
      '5. JSON 结构必须是：' + schemaFor(kind),
      kind === 'docx' ? '6. Word 文档 4~8 个小节，每节 2~4 段或要点；需要时带一个表格。' : '',
      kind === 'xlsx' ? '6. 表格 1~3 个工作表，每表 5~20 行，列名清晰，数值列给具体数字。' : '',
      kind === 'pptx' ? '6. 演示文稿 6~10 页，每页 3~6 条要点，每条不超过 24 字。' : ''
    ].filter(Boolean).join('\n');
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 90000);
    try {
      var resp = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: app.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: (contextSnippet ? '本次话题相关的对话片段与检索资料（只作素材，不是全部聊天记录）：\n' + contextSnippet + '\n\n' : '') + '用户的要求：' + String(userText || '') }
          ],
          temperature: 0.4,
          max_tokens: 2600
        })
      });
      if (!resp.ok) throw new Error('模型返回 ' + resp.status);
      var data = await resp.json();
      var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      var raw = String(content || '').trim().replace(/```json/gi, '```').replace(/```/g, '').trim();
      var start = raw.indexOf('{');
      var end = raw.lastIndexOf('}');
      if (start < 0 || end <= start) throw new Error('模型没有返回结构化内容');
      var spec = JSON.parse(raw.slice(start, end + 1));
      if (!spec || typeof spec !== 'object') throw new Error('内容格式不对');
      return spec;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- 对外主入口 ----------
  async function maybeCreate(options) {
    var opts = options || {};
    var userText = String(opts.userText || '');
    var kind = shouldMake(userText);
    if (!kind) return null;
    var label = kind === 'xlsx' ? '表格' : (kind === 'pptx' ? 'PPT' : '文档');
    var notice = (window.__momToolNotice && window.__momToolNotice.start)
      ? window.__momToolNotice.start(kind, label)
      : null;
    try {
      var spec = await draft(kind, userText, opts.contextSnippet || '');
      var title = spec.title || (label + ' · ' + new Date().toLocaleDateString('zh-CN'));
      var meta = {
        id: uid(),
        kind: kind,
        title: title,
        name: safeName(title, extOf(kind)),
        spec: spec,
        scopeNote: String(opts.scopeNote || ''),
        createdAt: Date.now(),
        size: ''
      };
      var blob = await buildBlob(meta);
      meta.size = formatSize(blob.size);
      saveArtifact(meta);
      if (window.__momToolNotice && window.__momToolNotice.end) window.__momToolNotice.end(notice, true);
      return meta;
    } catch (err) {
      if (window.__momToolNotice && window.__momToolNotice.end) window.__momToolNotice.end(notice, false);
      console.warn('[Artifact] 生成失败：', err && err.message ? err.message : err);
      return { error: String(err && err.message ? err.message : err) };
    }
  }

  window.MomArtifacts = {
    maybeCreate: maybeCreate,
    download: download,
    get: getArtifact,
    buildBlob: buildBlob,
    kindLabel: kindLabel,
    formatSize: formatSize,
    detectKind: detectKind
  };
})();
