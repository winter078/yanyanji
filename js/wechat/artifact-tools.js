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
          // docx 库的 PERCENTAGE 会被写成 w:pct 的千分之一百，百分号数值直接当 pct 用会挤成一条。
          // 这里按 A4 版心宽度换算成绝对 twips，并固定表格布局，列宽才真的分得开。
          var colCount = Math.max(1, sec.table.headers.length);
          var totalTwips = 9020;
          var colW = Math.floor(totalTwips / colCount);
          var cellPara = function (txt, bold) {
            return new d.Paragraph({ text: String(txt == null ? '' : txt), bold: !!bold, spacing: { before: 40, after: 40 } });
          };
          var rows = [new d.TableRow({
            children: sec.table.headers.map(function (h) {
              return new d.TableCell({
                children: [cellPara(h, true)],
                width: { size: colW, type: d.WidthType.DXA },
                shading: { fill: 'F2F3F5' }
              });
            })
          })];
          sec.table.rows.forEach(function (r) {
            var cells = (Array.isArray(r) ? r : []).slice(0, colCount);
            while (cells.length < colCount) cells.push('');
            rows.push(new d.TableRow({
              children: cells.map(function (c) {
                return new d.TableCell({ children: [cellPara(c, false)], width: { size: colW, type: d.WidthType.DXA } });
              })
            }));
          });
          var tableOpts = { rows: rows, width: { size: totalTwips, type: d.WidthType.DXA }, margin: { top: 120, bottom: 120 } };
          if (d.TableLayoutType && d.TableLayoutType.FIXED) tableOpts.layout = d.TableLayoutType.FIXED;
          children.push(new d.Table(tableOpts));
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

  var COMPARE_WORDS = /(对比|比较|对比下|比一下|区别|差异|差别|不同|哪个好|哪个更|哪家|选哪个|怎么选|差在哪|优劣|性价比|PK|pk)/;

  function wantsCompare(text) {
    return COMPARE_WORDS.test(String(text || ''));
  }

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

  function clipText(text, n) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, n || 160);
  }

  function apiFailure(status, body, isVision, model) {
    var lower = String(body || '').toLowerCase();
    var prefix = isVision ? '看截图失败：' : '';
    if (status === 401 || status === 403) return prefix + '模型 Key 没权限或已失效，先去设置里检查 Key。';
    if (status === 404) return prefix + (isVision ? '当前接口找不到识图模型「' + model + '」' : '当前接口找不到模型「' + model + '」') + '，换一个模型再试。';
    if (status === 429) return prefix + '模型额度用完或太忙，过一会儿再试。';
    if (status === 413) return isVision ? '看截图失败：截图太大，模型收不下；先发 1~2 张关键截图，或截短一点。' : '请求内容太大，模型收不下。';
    if (isVision && /too large|payload|size|dimension|resolution|base64|too long/.test(lower)) {
      return '看截图失败：截图太大或格式不对；换清晰的短截图再试。';
    }
    if (isVision && /(图片|图像|截图).*(太大|过大|尺寸|分辨率|格式)|(太大|过大).*(图片|图像|截图)/.test(String(body || ''))) {
      return '看截图失败：截图太大或格式不对；换清晰的短截图再试。';
    }
    if (isVision && /invalid image|image url|failed to fetch image|image.*invalid|url.*invalid/.test(lower)) {
      return '看截图失败：截图没有正确送达模型（链接失效或没上传完）；重新发一次截图。';
    }
    if (isVision && /(不支持|无法识别|不能识别).*(图片|图像|截图)|(图片|图像|截图).*(不支持|无法识别)/.test(String(body || ''))) {
      return '看截图失败：当前模型不支持看图；在设置里选一个支持视觉的模型。';
    }
    if (isVision && /(image|vision|multimodal|modality|content[^\n]{0,20}type)/.test(lower) && /(not support|unsupported|invalid|not allowed|must be|does not)/.test(lower)) {
      return '看截图失败：当前模型不支持看图；在设置里选一个支持视觉的模型。';
    }
    if (isVision && /(model|engine).*(not support|unsupported)/.test(lower)) {
      return '看截图失败：当前模型不支持看图；在设置里选一个支持视觉的模型。';
    }
    if (isVision && (status === 400 || status === 422)) return '看截图失败：模型拒绝了这组截图（' + status + '）；换一张更清晰的截图，或换支持看图的模型。';
    return prefix + '模型接口返回 ' + status + '；先重试，还不行就换模型。';
  }

  async function draft(kind, userText, contextSnippet, previousSpec, images, sourceImageCount) {
    var app = window.appData || {};
    var apiKey = String(app.apiKey || '').trim();
    var apiBase = String(app.apiBase || '').trim();
    var images = (Array.isArray(images) ? images : []).filter(Boolean).slice(0, 8);
    var badImages = images.filter(function (src) {
      return !/^(data:image\/|https?:\/\/)/i.test(String(src || ''));
    });
    if (badImages.length) throw new Error('看截图失败：有 ' + badImages.length + ' 张截图没有正确加载；重新发一次截图。');
    if (!apiKey || !apiBase) throw new Error(images.length ? '看截图失败：还没配置模型 Key；先去设置里填 Key 和接口地址。' : '还没有配置模型 Key');
    var base = apiBase.replace(/\/+$/, '');
    if (base.endsWith('/chat/completions')) base = base.replace('/chat/completions', '');
    var url = base + '/chat/completions';
    var label = kind === 'xlsx' ? 'Excel 表格' : (kind === 'pptx' ? 'PPT 演示文稿' : 'Word 文档');
    var visionModel = String(app.visionModel || '').trim();
    var defaultVision = '[AG]gemini-3.8-flash-tiered';
    if (app.model && !/deepseek|r1/i.test(String(app.model))) defaultVision = app.model;
    var imageModel = visionModel || defaultVision;
    var imageSourceCount = images.length ? Math.max(1, Number(sourceImageCount || 0) || images.length) : 0;
    var compareMode = imageSourceCount >= 2 && wantsCompare(userText);
    var slicedNote = images.length > imageSourceCount ? '其中长截图被切成了上下连续的几段，不要把同一张图的分段当成不同对象。' : '';
    var prevBlock = '';
    if (previousSpec) {
      prevBlock = '【上一版内容 JSON：这是修改任务，不要重新写一份无关的新文档；只改用户要求的部分，其余原样保留】\n' + JSON.stringify(previousSpec);
    }
    var sys = [
      '你是一名专业文档撰写助手，不是角色扮演。根据用户的要求，直接产出一份可以直接拿去用的' + label + '内容。',
      '要求：',
      '1. 内容具体、可执行，不要空话套话；用户没给细节时，按常见工作场景补齐合理内容，并保持中立专业。',
      '2. 素材范围：只把与这次要求直接相关的对话内容当素材，提炼后重写；不要把聊天记录原样搬进文件，无关闲聊、亲密称呼和语气词全部忽略。若素材里包含【刚刚联网检索到的资料】，可以直接引用其中的事实和数字，但涉及来源时要如实标注，绝不编造来源或数据。',
      previousSpec ? '3. 这是修改任务：以【上一版内容 JSON】为基础，按用户这次的要求修改；不要丢掉上一版里用户没有要求改动的部分。' : '3. 中文输出；标题和小标题简洁。',
      previousSpec ? '4. 中文输出；标题和小标题简洁；只输出严格 JSON，不要 markdown 代码块，不要解释。' : '4. 只输出严格 JSON，不要 markdown 代码块，不要解释。',
      '5. JSON 结构必须是：' + schemaFor(kind),
      kind === 'docx' ? '6. Word 文档 4~8 个小节，每节 2~4 段或要点；需要时带一个表格。' : '',
      kind === 'xlsx' ? '6. 表格 1~3 个工作表，每表 5~20 行，列名清晰，数值列给具体数字。' : '',
      kind === 'pptx' ? '6. 演示文稿 6~10 页，每页 3~6 条要点，每条不超过 24 字。' : '',
      images.length ? '7. 用户这轮提供了截图：先仔细读清图片里的文字、表格、界面和数字，再围绕用户的要求写；图片里没有的信息不要编造，看不清就标明“截图中看不清”。' + slicedNote : '',
      compareMode ? '8. 这是多图对比任务：先找出所有截图里能对齐的维度（如价格、规格、职责、薪资、公司规模、条款），用完全相同的一套维度做一张对比表；表头第一列写“对比项”，每个截图对象各占一列。截图里没写的项目写“未提到”，绝对不要猜或补。表格下面写 3~5 条关键差异，最后给一句结论或建议。若这些图没有共同维度，不要硬凑表格，先分别整理，并说明无法直接对比。' : '',
      compareMode && kind === 'docx' ? '9. Word 的第一小节放对比表，后面的小节放关键差异和结论。' : '',
      compareMode && kind === 'xlsx' ? '9. Excel 的第一列写“对比项”，每个对象各占一列；数值保留截图里的数字。' : '',
      compareMode && kind === 'pptx' ? '9. PPT 先用一页放对比表，最后一页给结论。' : ''
    ].filter(Boolean).join('\n');
    var textPrompt = (contextSnippet ? '本次话题相关的对话片段与检索资料（只作素材，不是全部聊天记录）：\n' + contextSnippet + '\n\n' : '') + (prevBlock ? prevBlock + '\n\n' : '') + '用户的要求：' + String(userText || '') + (images.length ? '\n\n（用户实际提供了 ' + imageSourceCount + ' 张截图，这里共 ' + images.length + ' 段图像，请一起看' + (slicedNote ? '；' + slicedNote : '') + '）' : '');
    var userContent = textPrompt;
    if (images.length) {
      userContent = [{ type: 'text', text: textPrompt }].concat(images.map(function (src) {
        return { type: 'image_url', image_url: { url: String(src) } };
      }));
    }
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 90000);
    try {
      var resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({
            model: images.length ? imageModel : (app.model || 'deepseek-chat'),
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: userContent }
            ],
            temperature: 0.4,
            max_tokens: 2600
          })
        });
      } catch (fetchErr) {
        if (fetchErr && (fetchErr.name === 'AbortError' || /abort/i.test(String(fetchErr.message || '')))) {
          throw new Error(images.length ? '看截图失败：识图超时（90 秒）；可能是截图太大或网络慢，先发 1~2 张关键截图再试。' : '生成超时（90 秒），稍后再试。');
        }
        throw new Error(images.length ? '看截图失败：连不上模型接口；检查网络、代理和接口地址后再试。' : '连不上模型接口，检查网络和接口地址。');
      }
      if (!resp.ok) {
        var errBody = '';
        try { errBody = await resp.text(); } catch (e) {}
        console.warn('[Artifact] 模型接口错误：', resp.status, clipText(errBody, 300));
        throw new Error(apiFailure(resp.status, errBody, images.length > 0, images.length ? imageModel : (app.model || 'deepseek-chat')));
      }
      var data;
      try { data = await resp.json(); } catch (e) {
        throw new Error(images.length ? '看截图失败：模型返回的内容无法解析；重试一次。' : '模型返回内容无法解析');
      }
      var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      var raw = String(content || '').trim().replace(/```json/gi, '```').replace(/```/g, '').trim();
      var start = raw.indexOf('{');
      var end = raw.lastIndexOf('}');
      var hasJson = start >= 0 && end > start;
      if (images.length && !hasJson && /看不清|模糊|无法辨认|无法识别|字太小|太糊/.test(raw)) {
        throw new Error('看截图失败：截图里有些内容看不清（模糊或字太小）；换一张更清楚、字大一点的截图再试。');
      }
      if (!raw) throw new Error(images.length ? '看截图失败：模型没有返回内容，可能没看懂截图；换一张更清晰的图再试。' : '模型没有返回内容');
      if (!hasJson) throw new Error(images.length ? '看截图失败：模型看完了，但没按格式输出；重试一次，或换识图模型。' : '模型没有返回结构化内容');
      var spec;
      try { spec = JSON.parse(raw.slice(start, end + 1)); } catch (e) {
        throw new Error(images.length ? '看截图失败：模型返回的格式不对；重试一次，或换识图模型。' : '内容格式不对');
      }
      if (!spec || typeof spec !== 'object') throw new Error(images.length ? '看截图失败：模型返回的内容不是有效文档；重试一次。' : '内容格式不对');
      return spec;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---------- 对外主入口 ----------
  async function maybeCreate(options) {
    var opts = options || {};
    var userText = String(opts.userText || '');
    var kind = opts.kind || shouldMake(userText);
    if (!kind) return null;
    var label = kind === 'xlsx' ? '表格' : (kind === 'pptx' ? 'PPT' : '文档');
    var previousSpec = opts.previousSpec || null;
    var images = (Array.isArray(opts.images) ? opts.images : []).filter(Boolean).slice(0, 8);
    var sourceImageCount = Number(opts.sourceImageCount || 0) || images.length;
    var notice = (!opts.silent && window.__momToolNotice && window.__momToolNotice.start)
      ? window.__momToolNotice.start(kind, label)
      : null;
    try {
      var spec = await draft(kind, userText, opts.contextSnippet || '', previousSpec, images, sourceImageCount);
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
      if (!opts.silent && window.__momToolNotice && window.__momToolNotice.end) window.__momToolNotice.end(notice, true);
      return meta;
    } catch (err) {
      if (!opts.silent && window.__momToolNotice && window.__momToolNotice.end) window.__momToolNotice.end(notice, false);
      console.warn('[Artifact] 生成失败：', err && err.message ? err.message : err);
      return { error: String(err && err.message ? err.message : err) };
    }
  }

  window.MomArtifacts = {
    maybeCreate: maybeCreate,
    wantsFile: function (text) { return shouldMake(text); },
    wantsCompare: wantsCompare,
    download: download,
    get: getArtifact,
    buildBlob: buildBlob,
    kindLabel: kindLabel,
    formatSize: formatSize,
    detectKind: detectKind
  };
})();
