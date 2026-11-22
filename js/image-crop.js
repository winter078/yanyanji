/* 通用图片裁剪层：固定目标比例、拖动/双指缩放、所见即所得 */
(function () {
  if (window.momoCropImage) return;

  var state = null;

  function clampNum(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        resolve({
          img: img,
          cleanup: function () { try { URL.revokeObjectURL(url); } catch (e) {} }
        });
      };
      img.onerror = function () {
        try { URL.revokeObjectURL(url); } catch (e) {}
        reject(new Error('image decode failed'));
      };
      img.src = url;
    });
  }

  function build(host) {
    var el = document.createElement('div');
    el.id = 'momo-crop';
    el.className = 'momo-crop';
    el.innerHTML =
      '<div class="mc-top">' +
        '<button type="button" class="mc-text-btn" id="mc-cancel">取消</button>' +
        '<div class="mc-heading" id="mc-title">调整图片</div>' +
        '<button type="button" class="mc-done-btn" id="mc-ok">用这张</button>' +
      '</div>' +
      '<div class="mc-stage">' +
        '<div class="mc-frame" id="mc-frame">' +
          '<canvas id="mc-canvas"></canvas>' +
          '<div class="mc-grid" id="mc-grid"><i></i><i></i><i></i><i></i></div>' +
        '</div>' +
      '</div>' +
      '<div class="mc-foot">' +
        '<div class="mc-zoom-row">' +
          '<span class="mc-zoom-ico">−</span>' +
          '<input type="range" id="mc-range" min="1" max="3.2" step="0.01" value="1">' +
          '<span class="mc-zoom-ico">＋</span>' +
        '</div>' +
        '<div class="mc-hint" id="mc-hint">拖动图片调整位置，双指缩放</div>' +
      '</div>';
    host.appendChild(el);
    return el;
  }

  function open(file, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      if (state) {
        try { state.finish(null); } catch (e) {}
      }
      var host = opts.host || document.getElementById('phone-screen-root') || document.getElementById('page-forum') || document.body;
      if (!file || !host) { resolve(null); return; }

      var el = build(host);
      var frame = el.querySelector('#mc-frame');
      var canvas = el.querySelector('#mc-canvas');
      var ctx = canvas.getContext('2d');
      var grid = el.querySelector('#mc-grid');
      var range = el.querySelector('#mc-range');
      var titleEl = el.querySelector('#mc-title');
      var hintEl = el.querySelector('#mc-hint');
      var autoAspect = !(opts.aspect > 0);
      var aspect = opts.aspect > 0 ? opts.aspect : 1;

      titleEl.textContent = opts.title || '调整图片';
      hintEl.textContent = opts.hint || '拖动图片调整位置，双指缩放';

      var hostW = host.clientWidth || 390;
      var hostH = host.clientHeight || 844;
      var maxW = Math.min(hostW - 38, opts.maxWidth || 430);
      var maxH = Math.max(180, hostH - 214);
      var fw = maxW;
      var fh = fw / aspect;
      if (fh > maxH) { fh = maxH; fw = fh * aspect; }

      frame.style.width = Math.round(fw) + 'px';
      frame.style.height = Math.round(fh) + 'px';
      if (opts.shape === 'circle') frame.style.borderRadius = '50%';
      else if (opts.shape === 'rounded') frame.style.borderRadius = Math.round(fw * (opts.radiusRatio || 0.22)) + 'px';
      if (opts.shape === 'circle') grid.style.display = 'none';

      state = {
        el: el,
        frame: frame,
        canvas: canvas,
        ctx: ctx,
        img: null,
        file: file,
        fw: fw,
        fh: fh,
        aspect: aspect,
        baseScale: 1,
        scale: 1,
        minZoom: 1,
        maxZoom: 3.2,
        ox: 0,
        oy: 0,
        pointers: {},
        drag: null,
        pinch: null,
        done: false
      };

      function draw() {
        var s = state;
        if (!s || !s.img) return;
        var dpr = window.devicePixelRatio || 1;
        s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        s.ctx.clearRect(0, 0, s.fw, s.fh);
        s.ctx.imageSmoothingQuality = 'high';
        s.ctx.drawImage(s.img, s.ox, s.oy, s.img.width * s.scale, s.img.height * s.scale);
      }

      function clampOffset() {
        var s = state;
        var dw = s.img.width * s.scale;
        var dh = s.img.height * s.scale;
        s.ox = Math.min(0, Math.max(s.fw - dw, s.ox));
        s.oy = Math.min(0, Math.max(s.fh - dh, s.oy));
      }

      function setZoom(z, cx, cy) {
        var s = state;
        if (!s || !s.img) return;
        z = clampNum(z, s.minZoom, s.maxZoom);
        var oldScale = s.scale;
        var newScale = s.baseScale * z;
        var ax = (cx == null ? s.fw / 2 : cx);
        var ay = (cy == null ? s.fh / 2 : cy);
        var imgX = (ax - s.ox) / oldScale;
        var imgY = (ay - s.oy) / oldScale;
        s.scale = newScale;
        s.ox = ax - imgX * newScale;
        s.oy = ay - imgY * newScale;
        clampOffset();
        range.value = z;
        draw();
      }

      function placeImage() {
        var s = state;
        var iw = s.img.width;
        var ih = s.img.height;
        s.baseScale = Math.max(s.fw / iw, s.fh / ih);
        s.scale = s.baseScale;
        s.ox = (s.fw - iw * s.scale) / 2;
        s.oy = (s.fh - ih * s.scale) / 2;
        clampOffset();
        range.value = 1;
        draw();
      }

      function pointerPos(e) {
        var r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }

      canvas.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        var p = pointerPos(e);
        state.pointers[e.pointerId] = p;
        var ids = Object.keys(state.pointers);
        if (ids.length === 1) {
          state.drag = { id: e.pointerId, x: p.x, y: p.y, ox: state.ox, oy: state.oy };
          state.pinch = null;
        } else if (ids.length >= 2) {
          var a = state.pointers[ids[0]];
          var b = state.pointers[ids[1]];
          state.drag = null;
          state.pinch = {
            dist: Math.hypot(b.x - a.x, b.y - a.y),
            zoom: state.scale / state.baseScale
          };
        }
      });

      canvas.addEventListener('pointermove', function (e) {
        if (!state || !state.img) return;
        if (!state.pointers[e.pointerId]) return;
        e.preventDefault();
        var p = pointerPos(e);
        state.pointers[e.pointerId] = p;
        var ids = Object.keys(state.pointers);
        if (ids.length >= 2 && state.pinch) {
          var a = state.pointers[ids[0]];
          var b = state.pointers[ids[1]];
          var dist = Math.hypot(b.x - a.x, b.y - a.y);
          if (state.pinch.dist > 8) setZoom(state.pinch.zoom * (dist / state.pinch.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
        } else if (state.drag && state.drag.id === e.pointerId) {
          state.ox = state.drag.ox + (p.x - state.drag.x);
          state.oy = state.drag.oy + (p.y - state.drag.y);
          clampOffset();
          draw();
        }
      });

      function pointerEnd(e) {
        if (!state) return;
        delete state.pointers[e.pointerId];
        var ids = Object.keys(state.pointers);
        state.pinch = null;
        if (ids.length === 1) {
          var p = state.pointers[ids[0]];
          state.drag = { id: ids[0], x: p.x, y: p.y, ox: state.ox, oy: state.oy };
        } else {
          state.drag = null;
        }
      }
      canvas.addEventListener('pointerup', pointerEnd);
      canvas.addEventListener('pointercancel', pointerEnd);

      canvas.addEventListener('wheel', function (e) {
        if (!state || !state.img) return;
        e.preventDefault();
        var p = pointerPos(e);
        var z = (state.scale / state.baseScale) * (e.deltaY < 0 ? 1.08 : 0.92);
        setZoom(z, p.x, p.y);
      }, { passive: false });

      range.addEventListener('input', function () {
        setZoom(parseFloat(this.value));
      });

      function finish(dataUrl) {
        if (!state || state.done) return;
        state.done = true;
        document.removeEventListener('keydown', onKey);
        var s = state;
        state = null;
        try { s.el.remove(); } catch (e) {}
        if (s.imageHandle) s.imageHandle.cleanup();
        resolve(dataUrl == null ? null : dataUrl);
      }
      state.finish = finish;

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      }
      document.addEventListener('keydown', onKey);
      el.querySelector('#mc-cancel').addEventListener('click', function () { finish(null); });
      el.querySelector('#mc-ok').addEventListener('click', function () {
        var s = state;
        if (!s || !s.img) { finish(null); return; }
        var outW = opts.outWidth || 1000;
        var outH = Math.round(outW / (s.aspect || 1));
        var c = document.createElement('canvas');
        c.width = outW;
        c.height = outH;
        var cx = c.getContext('2d');
        cx.imageSmoothingQuality = 'high';
        cx.fillStyle = '#0b0d0c';
        cx.fillRect(0, 0, outW, outH);
        var ratio = outW / s.fw;
        cx.drawImage(s.img, s.ox * ratio, s.oy * ratio, s.img.width * s.scale * ratio, s.img.height * s.scale * ratio);
        var data = '';
        try { data = c.toDataURL('image/jpeg', opts.quality || 0.86); } catch (err) { data = ''; }
        finish(data || null);
      });

      el.addEventListener('click', function (e) {
        if (e.target === el) finish(null);
      });

      loadImageFile(file).then(function (handle) {
        if (!state) { handle.cleanup(); return; }
        var s = state;
        s.imageHandle = handle;
        s.img = handle.img;
        if (autoAspect && s.img.width && s.img.height) {
          s.aspect = s.img.width / s.img.height;
          s.fw = maxW;
          s.fh = s.fw / s.aspect;
          if (s.fh > maxH) { s.fh = maxH; s.fw = s.fh * s.aspect; }
          frame.style.width = Math.round(s.fw) + 'px';
          frame.style.height = Math.round(s.fh) + 'px';
          if (opts.shape === 'rounded') frame.style.borderRadius = Math.round(s.fw * (opts.radiusRatio || 0.22)) + 'px';
        }
        var dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(s.fw * dpr);
        canvas.height = Math.round(s.fh * dpr);
        canvas.style.width = Math.round(s.fw) + 'px';
        canvas.style.height = Math.round(s.fh) + 'px';
        placeImage();
      }).catch(function (err) {
        finish(null);
        reject(err);
      });
    });
  }

  window.momoCropImage = open;

  /* ---------- 全站图片上传统一先裁剪 ---------- */
  var AUTO_OPTS = {
    'input-global-bg': { aspect: 390 / 844, shape: 'rect', outWidth: 900, title: '调整桌面背景' },
    'input-chat-bg': { aspect: 390 / 844, shape: 'rect', outWidth: 900, title: '调整聊天背景' },
    'input-rp-bg': { aspect: 390 / 844, shape: 'rect', outWidth: 900, title: '调整角色背景' },
    'input-hero-avatar': { aspect: 1, shape: 'circle', outWidth: 480, title: '调整主页头像' },
    'input-bot-avatar': { aspect: 1, shape: 'rounded', radiusRatio: 12 / 64, outWidth: 480, title: '调整角色头像' },
    'input-art-square': { aspect: 1, shape: 'rounded', radiusRatio: 12 / 64, outWidth: 800, title: '调整方形画' },
    'input-sticker-pic': { aspect: 1, shape: 'rounded', radiusRatio: .18, outWidth: 480, title: '调整表情图片' }
  };
  var TITLE_MAP = {
    'input-chat-pic': '调整要发送的图片',
    'xhs-image-input': '调整小紫书图片',
    'album-import-input': '调整相册图片',
    'moment-photo-file-input': '调整朋友圈图片',
    'say-photo-input': '调整纸页配图',
    'char-image-ref-input': '调整角色参考图',
    'input-hero-banner': '调整主页横幅',
    'widget-art-file-input': '调整小组件画',
    'widget-photo-file-input': '调整小组件照片'
  };

  function cropOptsFor(input, index, total) {
    var base = AUTO_OPTS[input.id] || {};
    var o = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) o[k] = base[k];
    if (!(o.aspect > 0)) o.aspect = 0;
    if (!o.outWidth) o.outWidth = 1000;
    o.quality = o.quality || 0.86;
    var title = base.title || TITLE_MAP[input.id] || '调整图片';
    if (total > 1) title += ' ' + (index + 1) + '/' + total;
    o.title = title;
    o.hint = total > 1 ? '拖动图片选位置，双指缩放；下一张会接着弹出来' : '拖动图片调整位置，双指缩放';
    o.host = document.getElementById('phone-screen-root') || document.getElementById('page-forum') || document.body;
    return o;
  }

  function imageAccept(input) {
    var a = (input.accept || '').toLowerCase();
    return !a || a.indexOf('image') >= 0;
  }

  function makeJpegName(name) {
    var base = String(name || 'image').replace(/\.[^.]+$/, '');
    return (base || 'image') + '.jpg';
  }

  async function cropQueue(input, files) {
    if (input.dataset.cropBusy === '1') return;
    input.dataset.cropBusy = '1';
    var results = [];
    try {
      for (var i = 0; i < files.length; i++) {
        var url = await window.momoCropImage(files[i], cropOptsFor(input, i, files.length));
        if (!url) { results = []; break; }
        var blob = null;
        try { blob = await (await fetch(url)).blob(); } catch (e) {}
        if (!blob) { results = []; break; }
        results.push(new File([blob], makeJpegName(files[i].name), { type: 'image/jpeg', lastModified: Date.now() }));
      }
      if (!results.length) {
        try { input.value = ''; } catch (e) {}
        return;
      }
      var dt = null;
      try { dt = new DataTransfer(); results.forEach(function (f) { dt.items.add(f); }); } catch (e) { dt = null; }
      if (dt) {
        try { input.files = dt.files; } catch (e) { dt = null; }
      }
      if (!dt) {
        var fake = { target: input, currentTarget: input, preventDefault: function () {}, stopPropagation: function () {} };
        try {
          Object.defineProperty(input, 'files', { configurable: true, value: results });
        } catch (e) {}
        if (typeof input.onchange === 'function') input.onchange.call(input, fake);
        return;
      }
      input.dataset.cropPass = '1';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(function () { try { input.value = ''; } catch (e) {} }, 120);
    } catch (err) {
      console.warn('[crop] 处理失败', err);
      try { input.value = ''; } catch (e) {}
    } finally {
      delete input.dataset.cropBusy;
    }
  }

  document.addEventListener('change', function (e) {
    var input = e.target;
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return;
    if (input.id && input.id.indexOf('fmp-') === 0) return;
    if (input.dataset && input.dataset.cropOff === '1') return;
    if (input.dataset && input.dataset.cropPass === '1') { delete input.dataset.cropPass; return; }
    if (!imageAccept(input)) return;
    if (!input.files || !input.files.length) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    var files = Array.prototype.slice.call(input.files);
    cropQueue(input, files);
  }, true);
})();
