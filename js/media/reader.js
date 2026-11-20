
// ================= 📖 鲜果机风·「阅读」深度交互引擎 (每本书独立聊天室 + 继续/重新生成) =================

(function() {
  // 1. 书架基础数据
  const defaultBooks = [
    {
      id: 'book-1',
      title: '在黑暗中',
      author: '金十四钗',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
      lastReadChapTitle: '第49章 不戴珍珠耳环的少女 (2)',
      progress: 28,
      lastReadTime: '今天 16:15',
      chapters: [
        {
          title: '第49章 不戴珍珠耳环的少女 (2)',
          paragraphs: [
            '警察明明联系了物业、调取过监控，更有内部的身份查询系统，又怎么可能弄错一个人的身份信息……？',
            '浓浓的诡异感在王彦心中不断游走，他脸色沉了下来：',
            '“那我为什么要报警？”',
            '此言一出，电话那头一下沉默了。',
            '没人能忽略这样的疑点，凶手又怎么可能报警？',
            '王彦不想再多说，这些警察并不了解自己的处境，而比起他们，他自己心里的疑问明显要多得多。',
            '但仅下一秒，电话里的声音又一次响了起来：',
            '“那是因为，你知道，比起让别人报警，由你来亲自联系警察更能混淆视听。”',
            '“事实证明你成功了，一开始我们确实将这仅当做了一件正当防卫的案子。”',
            '什么乱七八糟的？'
          ]
        },
        {
          title: '第50章 暴雨未至',
          paragraphs: [
            '走廊里的白炽灯忽明忽暗地闪烁着。',
            '王彦握紧了手里的手机，掌心里满是黏腻的冷汗。门缝外传来极细微的脚步声，一下、一下，如同踩在紧绷的琴弦上。'
          ]
        }
      ]
    },
    {
      id: 'book-2',
      title: '微微一笑很倾城',
      author: '顾漫',
      cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80',
      lastReadChapTitle: 'Part 1 被抛弃了',
      progress: 0,
      lastReadTime: '未开始',
      chapters: [
        {
          title: 'Part 1 被抛弃了',
          paragraphs: [
            '“微微，来忘情岛，我们把婚离了。”',
            '贝微微一上线，就看到游戏里的“老公”真水无香发过来的这条消息。',
            '微微不由一愣，随后就打出了一排问号。'
          ]
        },
        {
          title: 'Part 2 奈何出现',
          paragraphs: [
            '红衣女侠站在朱雀桥头，风吹衣袂翩翩。',
            '就在这时，桥下白衣胜雪的琴师抬起头，清冷悠扬的声音顺着微风传了过来：“你觉得我怎么样？”'
          ]
        }
      ]
    },
    {
      id: 'book-3',
      title: '午夜梦魇',
      author: '鲜果机 · 阅读',
      isPureCover: true,
      cover: '',
      lastReadChapTitle: '第三章 五分钟',
      progress: 0,
      lastReadTime: '0%',
      chapters: [
        {
          title: '第三章 五分钟',
          paragraphs: [
            '听到这句话，王彦眼角猛然跳动了一下，严厉的质问夹杂在让人齿酸的电流声中，他就如同做着一场极为怪诞的噩梦。',
            '最诡异的是，它明明骨节分明，却细小的像是刚出生的婴儿的手，所抓的位置也仅仅在成人大腿的高度！',
            '走廊里没有开灯，唯有窗外投进来的惨白月光，像水银一样在地面上铺了一层。',
            '门把手正在极其缓慢地、一寸一寸地下压。'
          ]
        }
      ]
    }
  ];

  // 2. 书城推荐库
  const storeFeedBooks = [
    {
      id: 'store-1',
      title: '天幕：从红楼梦开始盘点意难平！',
      author: '来江边啊',
      genre: '台言·古言',
      intro: '（评分刚出会有点低！会涨！） 【盘点】+【弹幕】+【万朝直播】+【无cp】+【万朝帝王名人】+【红楼梦】',
      update: '更新至 最新: 在线阅读',
      cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80'
    },
    {
      id: 'store-2',
      title: '我带警犬穿越成弃妃',
      author: '明月姐姐',
      genre: '台言·古言',
      intro: '二十一世纪医学女博士被特招特种兵，带着警犬黑豹边境出国执行追击毒贩时被炸身亡带着警犬黑豹一同穿越成为大……',
      update: '更新至 最新: 在线阅读',
      cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&q=80'
    },
    {
      id: 'store-3',
      title: '女扮男装当权臣，九族头上蹦野迪',
      author: '墨墨点点',
      genre: '台言·古言',
      intro: '【爽文+基建+搞笑+君臣+穿书+大女主+权臣】好消息：孟栖梧穿越了。坏消息：拿的……',
      update: '更新至 最新: 在线阅读',
      cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80'
    }
  ];

  // 运行时状态
  let currentBooks = [];
  let currentActiveBook = null;
  let currentChapterIdx = 0;
  let editingBookId = null;
  let selectedQuoteText = '';
  let currentFontSize = 17;

  // ★ 每本书专属隔离的聊天记录字典 { [bookId + '::' + 同伴id]: [ ...messages ] }
  let allBooksChatMap = {};

  // ★ 同伴（陪读的人）：默认周绪言，可在阅读页切换
  let readerCompanionId = '';
  try { readerCompanionId = localStorage.getItem('momo_reader_companion') || ''; } catch(e) {}

  function readerCompanion() {
    if (!window.Companion || !readerCompanionId) return null;
    return window.Companion.byId(readerCompanionId);
  }

  function readerCompanionName() {
    return window.Companion ? window.Companion.displayName(readerCompanion()) : '周绪言';
  }

  function readerChatKey(bookId) {
    return String(bookId) + '::' + (readerCompanionId || '');
  }

  function loadBooksChatMap() {
    try {
      const saved = localStorage.getItem('momo_books_chat_map');
      allBooksChatMap = saved ? JSON.parse(saved) : {};
    } catch(e) {
      allBooksChatMap = {};
    }
  }

  function saveBooksChatMap() {
    try {
      localStorage.setItem('momo_books_chat_map', JSON.stringify(allBooksChatMap));
    } catch(e) {}
  }

  function getActiveBookChatHistory() {
    if (!currentActiveBook) return [];
    const key = readerChatKey(currentActiveBook.id);
    if (!allBooksChatMap[key] || allBooksChatMap[key].length === 0) {
      // 老数据存在 bookId 键下：只有默认同伴才继承，避免串到别人名下
      const legacy = allBooksChatMap[currentActiveBook.id];
      if (!readerCompanionId && legacy && legacy.length) {
        allBooksChatMap[key] = legacy.slice();
      } else {
        allBooksChatMap[key] = [
          {
            sender: 'bot',
            text: 'user，有什么想和我说的吗？',
            quote: ''
          }
        ];
      }
    }
    return allBooksChatMap[key];
  }

  // 全局 API 配置读取 (优先伴读专属模型)
  function getApiConfig() {
    let key = '';
    let base = 'https://api.deepseek.com/v1';
    let model = 'deepseek-chat';

    if (window.appData) {
      key = window.appData.apiKey || key;
      base = window.appData.apiBase || base;
      model = (window.appData.readerModel && window.appData.readerModel.trim()) 
        ? window.appData.readerModel.trim() 
        : (window.appData.model || model);
    }

    if (!key) key = localStorage.getItem('momo_api_key') || '';
    if (!base || base === 'https://api.deepseek.com/v1') base = localStorage.getItem('momo_api_base') || base;

    const savedReaderModel = localStorage.getItem('momo_api_reader_model');
    if (savedReaderModel && savedReaderModel.trim()) {
      model = savedReaderModel.trim();
    } else if (localStorage.getItem('momo_api_model')) {
      model = localStorage.getItem('momo_api_model').trim();
    }

    const keyIn = document.getElementById('api-key-input');
    const baseIn = document.getElementById('api-base-input');
    const readerModelIn = document.getElementById('api-reader-model-input');
    const mainModelIn = document.getElementById('api-model-input');

    if (keyIn && keyIn.value.trim()) key = keyIn.value.trim();
    if (baseIn && baseIn.value.trim()) base = baseIn.value.trim();
    if (readerModelIn && readerModelIn.value.trim()) {
      model = readerModelIn.value.trim();
    } else if (mainModelIn && mainModelIn.value.trim()) {
      model = mainModelIn.value.trim();
    }

    return { key, base, model };
  }

  // 本地存储
  function loadLocalShelf() {
    try {
      const saved = localStorage.getItem('momo_xianguo_books');
      currentBooks = saved ? JSON.parse(saved) : defaultBooks;
    } catch(e) {
      currentBooks = defaultBooks;
    }
  }

  function saveLocalShelf() {
    try {
      localStorage.setItem('momo_xianguo_books', JSON.stringify(currentBooks));
    } catch(e) {}
  }

  // 选项卡切换（旧调用统一转发到新的底部三 Tab）
  window.switchXianguoTab = function(tab) {
    const t = tab === 'store' ? 'store' : (tab === 'mine' ? 'mine' : 'shelf');
    if (typeof window.rdSwitchReaderTab === 'function') {
      window.rdSwitchReaderTab(t);
      return;
    }
    const viewShelf = document.getElementById('xianguo-shelf-viewport');
    const viewStore = document.getElementById('xianguo-store-viewport');
    if (t === 'shelf') {
      if (viewShelf) viewShelf.style.display = 'block';
      if (viewStore) viewStore.style.display = 'none';
      renderShelfUI();
    } else {
      if (viewShelf) viewShelf.style.display = 'none';
      if (viewStore) viewStore.style.display = 'block';
      renderStoreUI();
    }
  };

  // 渲染书架
  
  // ================= ✍️ user专属写手创作工作台引擎 (Writer Workbench Engine) =================
  
  // ================= ✍️ 双视图写手管理中心 (图2目录 + 图3大屏码字) =================
  let writerSortDesc = false; // 默认正序，可切换倒序

  window.toggleWriterChaptersSort = function() {
    writerSortDesc = !writerSortDesc;
    const sortBtn = document.getElementById('xianguo-writer-sort-toggle');
    if (sortBtn) sortBtn.innerText = writerSortDesc ? '正序排序' : '倒序排序';
    renderWriterCatalogList();
  };

  // 渲染图2风格的黑曜石章节目录
  function renderWriterCatalogList() {
    const listEl = document.getElementById('xianguo-writer-cat-list');
    const summaryText = document.getElementById('xianguo-writer-cat-summary-text');
    const bookNameEl = document.getElementById('xianguo-writer-cat-book-name');
    const inBookTitle = document.getElementById('xianguo-writer-book-title');

    if (inBookTitle && bookNameEl) {
      bookNameEl.innerText = inBookTitle.value.trim() || '章节目录';
    }

    if (!listEl) return;

    let totalWords = 0;
    const chapsWithIdx = writerChapters.map((c, idx) => {
      const wCount = (c.text || '').replace(/\s/g, '').length;
      totalWords += wCount;
      const firstLine = (c.text || '').split('\n').map(l => l.trim()).filter(Boolean)[0] || '（本章暂无正文）';
      return {
        originalIdx: idx,
        title: c.title || ('第 ' + (idx + 1) + ' 章'),
        summary: firstLine.slice(0, 32),
        wordCount: wCount,
        time: c.time || '刚刚编辑'
      };
    });

    if (summaryText) {
      summaryText.innerText = '共 ' + writerChapters.length + ' 章 · 全书 ' + totalWords + ' 字';
    }

    const displayList = writerSortDesc ? [...chapsWithIdx].reverse() : chapsWithIdx;

    listEl.innerHTML = displayList.map((item) => {
      const idx = item.originalIdx;
      const isCur = idx === currentWriterChapIdx;
      return `
        <div class="xianguo-writer-cat-item ${isCur ? 'active' : ''}" onclick="selectChapterToEdit(${idx})">
          <div class="xianguo-writer-cat-item-num-box">
            <span class="xianguo-writer-cat-item-index">${idx + 1}</span>
            <span class="xianguo-writer-cat-item-chap-tag">${item.title.split(/\s+/)[0] || ('第' + (idx+1) + '章')}</span>
          </div>
          <div class="xianguo-writer-cat-item-info">
            <div class="xianguo-writer-cat-item-title">${item.title.replace(/^[^\s]+\s*/, '') || item.summary}</div>
            <div class="xianguo-writer-cat-item-meta">
              <span>${item.time}</span>
              <span>${item.wordCount}字</span>
            </div>
          </div>
          <div class="xianguo-writer-cat-item-actions" onclick="event.stopPropagation()">
            <button class="xianguo-writer-cat-order-btn" onclick="moveChapterInCatalog(${idx}, -1)" title="上移">▲</button>
            <button class="xianguo-writer-cat-order-btn" onclick="moveChapterInCatalog(${idx}, 1)" title="下移">▼</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.selectChapterToEdit = function(idx) {
    syncCurrentChapterFromEditor();
    currentWriterChapIdx = idx;
    loadCurrentWriterChapterContent();
    updateWriterWordCounts();

    // 切换到视图 2：纯净沉浸大画布码字页 (图3)
    const catView = document.getElementById('xianguo-writer-catalog-view');
    const editorView = document.getElementById('xianguo-writer-editor-view');
    if (catView) catView.style.display = 'none';
    if (editorView) editorView.style.display = 'flex';
  };

  window.switchBackToWriterCatalog = function() {
    syncCurrentChapterFromEditor();
    // 切换回视图 1：章节目录页 (图2)
    const catView = document.getElementById('xianguo-writer-catalog-view');
    const editorView = document.getElementById('xianguo-writer-editor-view');
    if (editorView) editorView.style.display = 'none';
    if (catView) catView.style.display = 'flex';
    renderWriterCatalogList();
  };

  window.promptAddNewWriterChapter = function() {
    syncCurrentChapterFromEditor();
    const popup = document.getElementById('xianguo-add-chap-popup');
    const normalPreview = document.getElementById('xianguo-add-normal-preview');
    if (normalPreview) {
      const nextNum = writerChapters.length + 1;
      normalPreview.innerText = '正文第 ' + nextNum + ' 章';
    }
    if (popup) {
      popup.style.display = 'flex';
    } else {
      // 降级兜底：直接自动新增正文下一章并立即进入编辑
      window.createWriterChapterByType('normal');
    }
  };

  window.closeAddChapPopup = function(e) {
    if (e && e.target && e.target.id !== 'xianguo-add-chap-popup') return;
    const popup = document.getElementById('xianguo-add-chap-popup');
    if (popup) popup.style.display = 'none';
  };

  window.createWriterChapterByType = function(type) {
    syncCurrentChapterFromEditor();
    const popup = document.getElementById('xianguo-add-chap-popup');
    if (popup) popup.style.display = 'none';

    let defaultTitle = '第 ' + (writerChapters.length + 1) + ' 章';
    if (type === 'extra') {
      const extraCount = writerChapters.filter(c => (c.title || '').includes('番外')).length + 1;
      defaultTitle = '番外 ' + extraCount + ' · 岁月漫长';
    } else if (type === 'ending') {
      defaultTitle = '最终章 · 白头偕老 (结局)';
    }

    writerChapters.push({
      title: defaultTitle,
      text: '',
      time: '刚刚创建'
    });

    // 秒级跳转到新章节开始编辑 (进入图3大屏页)
    window.selectChapterToEdit(writerChapters.length - 1);
    showXianguoToast('✨ 已新建【' + defaultTitle + '】，开始写吧～', 2000);
  };

  window.moveChapterInCatalog = function(idx, dir) {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= writerChapters.length) return;
    const temp = writerChapters[idx];
    writerChapters[idx] = writerChapters[targetIdx];
    writerChapters[targetIdx] = temp;
    if (currentWriterChapIdx === idx) currentWriterChapIdx = targetIdx;
    else if (currentWriterChapIdx === targetIdx) currentWriterChapIdx = idx;
    renderWriterCatalogList();
  };

  let currentWriterBookId = null; // 当前正在写作的书籍ID（若为null则是全新创建）
  let writerChapters = [
    { title: '第1章', text: '' }
  ];
  let currentWriterChapIdx = 0;

  window.openXianguoWriterModal = async function(existingBookId = null) {
    const modal = document.getElementById('xianguo-writer-modal');
    closeXianguoAddSheet();

    currentWriterBookId = existingBookId;
    currentWriterChapIdx = 0;

    const inBookTitle = document.getElementById('xianguo-writer-book-title');
    const inBookAuthor = document.getElementById('xianguo-writer-book-author');

    if (existingBookId) {
      const book = currentBooks.find(b => b.id === existingBookId);
      if (book) {
        if (inBookTitle) inBookTitle.value = book.title;
        if (inBookAuthor) inBookAuthor.value = book.author || 'user';

        // 载入完整章节
        let loadedChaps = null;
        if (book.hasIndexedDB) {
          loadedChaps = await getBookChaptersFromDB(book.id);
        }
        if (!loadedChaps || loadedChaps.length === 0) {
          loadedChaps = book.chapters || [];
        }

        if (loadedChaps && loadedChaps.length > 0) {
          writerChapters = loadedChaps.map(c => ({
            title: c.title || '无标题章节',
            text: Array.isArray(c.paragraphs) ? c.paragraphs.join('\n\n') : (c.text || '')
          }));
        } else {
          writerChapters = [{ title: '第1章', text: '' }];
        }
      }
    } else {
      // 检查是否有草稿暂存
      const draft = localStorage.getItem('momo_writer_draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (inBookTitle) inBookTitle.value = parsed.title || '未命名心事';
          if (inBookAuthor) inBookAuthor.value = parsed.author || 'user';
          writerChapters = (parsed.chapters && parsed.chapters.length > 0) ? parsed.chapters : [{ title: '第1章', text: '' }];
        } catch(e) {
          writerChapters = [{ title: '第1章', text: '' }];
        }
      } else {
        if (inBookTitle) inBookTitle.value = '未命名心事';
        if (inBookAuthor) inBookAuthor.value = 'user';
        writerChapters = [{ title: '第1章', text: '' }];
      }
    }

    renderWriterCatalogList();
    loadCurrentWriterChapterContent();
    updateWriterWordCounts();

    const catView = document.getElementById('xianguo-writer-catalog-view');
    const editorView = document.getElementById('xianguo-writer-editor-view');
    if (modal) modal.style.display = 'flex';

    // 单栏沉浸：进写作直接到正文，章节目录走左上角抽屉
    if (writerChapters.length) {
      if (catView) catView.style.display = 'none';
      if (editorView) editorView.style.display = 'flex';
    } else {
      if (catView) catView.style.display = 'flex';
      if (editorView) editorView.style.display = 'none';
    }
  };

  window.closeXianguoWriterModal = function() {
    saveWriterDraftToStorage();
    const modal = document.getElementById('xianguo-writer-modal');
    if (modal) modal.style.display = 'none';
  };

  function saveWriterDraftToStorage() {
    if (currentWriterBookId) return; // 编辑既有书籍不存草稿
    syncCurrentChapterFromEditor();
    const inBookTitle = document.getElementById('xianguo-writer-book-title');
    const inBookAuthor = document.getElementById('xianguo-writer-book-author');
    const draftData = {
      title: inBookTitle ? inBookTitle.value.trim() : '未命名心事',
      author: inBookAuthor ? inBookAuthor.value.trim() : 'user',
      chapters: writerChapters,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem('momo_writer_draft', JSON.stringify(draftData));
    } catch(e) {}
  }

  function syncCurrentChapterFromEditor() {
    const inChapTitle = document.getElementById('xianguo-writer-cur-chap-title');
    const textarea = document.getElementById('xianguo-writer-editor-textarea');
    if (!writerChapters[currentWriterChapIdx]) return;

    if (inChapTitle) {
      writerChapters[currentWriterChapIdx].title = inChapTitle.value.trim() || ('第 ' + (currentWriterChapIdx + 1) + ' 章');
    }
    if (textarea) {
      writerChapters[currentWriterChapIdx].text = textarea.value;
    }
  }

  function renderWriterChaptersTabs() {
    const container = document.getElementById('xianguo-writer-chaps-tabs');
    if (!container) return;

    container.innerHTML = writerChapters.map((chap, idx) => {
      const activeClass = idx === currentWriterChapIdx ? 'active' : '';
      return `<div class="xianguo-writer-chap-tab ${activeClass}" onclick="switchWriterChapter(${idx})">${chap.title || ('第' + (idx + 1) + '章')}</div>`;
    }).join('');

    // 滚动到当前标签可见位置
    const activeTab = container.querySelector('.xianguo-writer-chap-tab.active');
    if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  window.switchWriterChapter = function(idx) {
    if (idx === currentWriterChapIdx) return;
    syncCurrentChapterFromEditor();
    currentWriterChapIdx = idx;
    renderWriterChaptersTabs();
    loadCurrentWriterChapterContent();
    updateWriterWordCounts();
  };

  function loadCurrentWriterChapterContent() {
    const inChapTitle = document.getElementById('xianguo-writer-cur-chap-title');
    const chapNumTag = document.getElementById('xianguo-writer-cur-chap-num');
    const textarea = document.getElementById('xianguo-writer-editor-textarea');
    const cur = writerChapters[currentWriterChapIdx] || { title: '第1章', text: '' };

    if (chapNumTag) chapNumTag.innerText = '第 ' + (currentWriterChapIdx + 1) + ' 章';
    if (inChapTitle) {
      const t = cur.title || '';
      const plainNum = /^第\s*\d+\s*章$/.test(t) || /^第1章$/.test(t);
      // 章号已经单独显示在左边，标题若是“第 N 章”就留空，避免重复
      inChapTitle.value = plainNum ? '' : t;
      inChapTitle.placeholder = '给这一章起个名字';
    }
    if (textarea) textarea.value = cur.text || '';
  }

  window.addNewWriterChapter = function(type = 'chapter') {
    syncCurrentChapterFromEditor();
    let defaultTitle = '第 ' + (writerChapters.length + 1) + ' 章';
    if (type === 'extra') {
      const extraCount = writerChapters.filter(c => (c.title || '').includes('番外')).length + 1;
      defaultTitle = '番外 ' + extraCount + ' · 岁月漫长';
    } else if (type === 'ending') {
      defaultTitle = '最终章 · 白头偕老 (结局)';
    }

    writerChapters.push({
      title: defaultTitle,
      text: ''
    });
    currentWriterChapIdx = writerChapters.length - 1;
    renderWriterChaptersTabs();
    loadCurrentWriterChapterContent();
    updateWriterWordCounts();
    showXianguoToast('✨ 已新建【' + defaultTitle + '】，开始写吧～', 2000);
  };

  window.openWriterFromEditSheet = function() {
    if (!editingBookId) return;
    const bookId = editingBookId;
    closeXianguoEditSheet();
    window.openXianguoWriterModal(bookId);
  };

  window.openWriterFromCurrentBook = function() {
    if (!currentActiveBook) return;
    closeReaderModal('reader-catalog-drawer-modal');
    window.openXianguoWriterModal(currentActiveBook.id);
  };

  window.moveCurrentChapter = function(dir) {
    syncCurrentChapterFromEditor();
    const newIdx = currentWriterChapIdx + dir;
    if (newIdx < 0 || newIdx >= writerChapters.length) {
      showXianguoToast(dir < 0 ? '已经是第一章了' : '已经是最后一章了', 1500);
      return;
    }
    const temp = writerChapters[currentWriterChapIdx];
    writerChapters[currentWriterChapIdx] = writerChapters[newIdx];
    writerChapters[newIdx] = temp;
    currentWriterChapIdx = newIdx;

    renderWriterChaptersTabs();
    loadCurrentWriterChapterContent();
    updateWriterWordCounts();
    showXianguoToast('↕️ 章节顺序已成功调整！', 1500);
  };


  window.deleteCurrentWriterChapter = function() {
    if (writerChapters.length <= 1) {
      alert('user，至少保留一章用来放我们的故事吧～');
      return;
    }
    if (!confirm('确定要删除当前这一章（' + (writerChapters[currentWriterChapIdx].title || '本章') + '）吗？')) return;

    writerChapters.splice(currentWriterChapIdx, 1);
    if (currentWriterChapIdx >= writerChapters.length) {
      currentWriterChapIdx = writerChapters.length - 1;
    }
    renderWriterChaptersTabs();
    loadCurrentWriterChapterContent();
    updateWriterWordCounts();
  };

  // 核心：一键智能排版（标准中文出版物两字缩进与空行规范化）
  window.formatWriterIndentation = function() {
    const textarea = document.getElementById('xianguo-writer-editor-textarea');
    if (!textarea || !textarea.value) return;

    const raw = textarea.value;
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const cleanLines = lines.map(line => {
      let trimmed = line.trim();
      if (!trimmed) return '';
      // 清除之前可能已经带有的全角或半角空格
      trimmed = trimmed.replace(/^[\s\u3000\u00A0]+/, '');
      // 加上标准中文空两格
      return '\u3000\u3000' + trimmed;
    });

    // 过滤连续的多个空行，只保留单空行
    const result = [];
    let lastWasEmpty = false;
    for (const l of cleanLines) {
      if (l === '') {
        if (!lastWasEmpty) {
          result.push('');
          lastWasEmpty = true;
        }
      } else {
        result.push(l);
        lastWasEmpty = false;
      }
    }

    textarea.value = result.join('\n\n');
    syncCurrentChapterFromEditor();
    updateWriterWordCounts();
    showXianguoToast('✨ 已完成段首空两格与智能优雅排版！', 2000);
  };

  window.handleWriterTextInput = function() {
    syncCurrentChapterFromEditor();
    updateWriterWordCounts();
  };

  function updateWriterWordCounts() {
    const textarea = document.getElementById('xianguo-writer-editor-textarea');
    const curWordsEl = document.getElementById('xianguo-writer-cur-words');
    const totalWordsEl = document.getElementById('xianguo-writer-total-words');

    const curText = textarea ? textarea.value : '';
    const curCount = curText.replace(/\s/g, '').length;
    if (curWordsEl) curWordsEl.innerText = '本章 ' + curCount + ' 字';

    let totalCount = 0;
    for (let i = 0; i < writerChapters.length; i++) {
      const t = (i === currentWriterChapIdx) ? curText : (writerChapters[i].text || '');
      totalCount += t.replace(/\s/g, '').length;
    }
    if (totalWordsEl) totalWordsEl.innerText = '全书 ' + totalCount + ' 字';
  }

  // 长文直接贴入分章弹窗
  window.openBatchPasteSplitModal = function() {
    const modal = document.getElementById('xianguo-paste-split-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeBatchPasteSplitModal = function(e) {
    if (e && e.target && e.target.id !== 'xianguo-paste-split-modal') return;
    const modal = document.getElementById('xianguo-paste-split-modal');
    if (modal) modal.style.display = 'none';
  };

  window.executeBatchPasteSplit = function() {
    const textarea = document.getElementById('xianguo-paste-split-textarea');
    if (!textarea || !textarea.value.trim()) {
      alert('请先在框里粘贴小说的长文内容哦～');
      return;
    }

    let text = textarea.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const chapterRegex = /^[ \t　]*(?:(Part\s*[0-9]+|第[0-9一二三四五六七八九十百千万零]+[章回卷节集幕篇部折]|Chapter\s+[0-9]+|番外[0-9一二三四五六七八九十]*|引子|序言|楔子|尾声|后记)[\s:：、._-]*[^\n\r]{0,45})$/gmi;

    const matches = [];
    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
      const rawTitle = match[0].trim();
      if (!/^["'“‘「]/.test(rawTitle)) {
        matches.push({ index: match.index, title: rawTitle });
      }
    }

    const newChaps = [];
    if (matches.length > 0) {
      if (matches[0].index > 0) {
        const intro = text.substring(0, matches[0].index).trim();
        if (intro.length > 15) {
          newChaps.push({ title: '序言 / 开篇', text: intro });
        }
      }
      for (let i = 0; i < matches.length; i++) {
        const cur = matches[i];
        const nxt = matches[i + 1];
        const rawChunk = text.substring(cur.index, nxt ? nxt.index : text.length);
        const lines = rawChunk.split('\n');
        const title = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        newChaps.push({ title: title || ('第 ' + (i + 1) + ' 章'), text: body });
      }
    } else {
      // 智能分段
      const paras = text.split('\n').map(p => p.trim()).filter(Boolean);
      const chunkSize = 60;
      if (paras.length > chunkSize) {
        let counter = 1;
        for (let i = 0; i < paras.length; i += chunkSize) {
          newChaps.push({
            title: '第 ' + counter + ' 章',
            text: paras.slice(i, i + chunkSize).join('\n\n')
          });
          counter++;
        }
      } else {
        newChaps.push({ title: '第1章', text: text });
      }
    }

    writerChapters = newChaps;
    currentWriterChapIdx = 0;
    renderWriterChaptersTabs();
    loadCurrentWriterChapterContent();
    updateWriterWordCounts();
    closeBatchPasteSplitModal();
    showXianguoToast('🎉 智能解析完成！共切分为 ' + newChaps.length + ' 个章节。', 2500);
  };

  // 保存并上架到书架
  window.saveAndPublishWriterBook = async function() {
    syncCurrentChapterFromEditor();

    const inBookTitle = document.getElementById('xianguo-writer-book-title');
    const inBookAuthor = document.getElementById('xianguo-writer-book-author');

    const bookTitle = (inBookTitle && inBookTitle.value.trim()) || 'user与绪言的故事';
    const bookAuthor = (inBookAuthor && inBookAuthor.value.trim()) || 'user';

    showXianguoToast('💾 正在为你装订上架小说...', 5000);

    // 转换章节为标准格式
    const formattedChapters = writerChapters.map((c, idx) => {
      const paras = (c.text || '')
        .split('\n')
        .map(p => p.trim())
        .filter(Boolean);
      return {
        title: c.title || ('第 ' + (idx + 1) + ' 章'),
        paragraphs: paras.length > 0 ? paras : ['（本章尚无正文）']
      };
    });

    let bookId = currentWriterBookId;
    let isNew = false;
    if (!bookId) {
      bookId = 'momo-original-' + Date.now();
      isNew = true;
    }

    // 写入 IndexedDB
    await saveBookChaptersToDB(bookId, formattedChapters);

    if (isNew) {
      const newBook = {
        id: bookId,
        title: bookTitle,
        author: bookAuthor,
        cover: '',
        lastReadChapTitle: formattedChapters[0] ? formattedChapters[0].title : '第1章',
        progress: 0,
        lastReadTime: '刚刚更新',
        chapterCount: formattedChapters.length,
        hasIndexedDB: true,
        isOriginal: true,
        chapters: formattedChapters.slice(0, 2)
      };
      currentBooks.unshift(newBook);
      // 清空草稿
      localStorage.removeItem('momo_writer_draft');
    } else {
      const existing = currentBooks.find(b => b.id === bookId);
      if (existing) {
        existing.title = bookTitle;
        existing.author = bookAuthor;
        existing.chapterCount = formattedChapters.length;
        existing.isOriginal = true;
        existing.lastReadTime = '刚刚修改';
        existing.chapters = formattedChapters.slice(0, 2);
      }
    }

    saveLocalShelf();
    renderShelfUI();

    const modal = document.getElementById('xianguo-writer-modal');
    if (modal) modal.style.display = 'none';

    showXianguoToast('✨ 《' + bookTitle + '》已成功存入书架，随时可以翻阅！', 3000);
  };


  window.renderShelfUI = function() {
    loadLocalShelf();
    const countEl = document.getElementById('xianguo-shelf-book-count');
    const gridEl = document.getElementById('xianguo-books-grid');

    if (countEl) countEl.innerText = currentBooks.length + ' 本书';

    const topBook = currentBooks[0] || defaultBooks[0];
    if (topBook) {
      const coverEl = document.getElementById('xianguo-last-cover');
      const authorEl = document.getElementById('xianguo-last-author');
      const titleEl = document.getElementById('xianguo-last-title');
      const chapEl = document.getElementById('xianguo-last-chap');
      const fillEl = document.getElementById('xianguo-last-fill');
      const pctEl = document.getElementById('xianguo-last-percent');
      const timeEl = document.getElementById('xianguo-last-time');

      if (coverEl) coverEl.src = topBook.cover || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80';
      if (authorEl) authorEl.innerText = topBook.author || '佚名';
      if (titleEl) titleEl.innerText = topBook.title;
      if (chapEl) chapEl.innerText = topBook.lastReadChapTitle || (topBook.chapters && topBook.chapters[0] && topBook.chapters[0].title) || '开始阅读';
      if (fillEl) fillEl.style.width = (topBook.progress || 28) + '%';
      if (pctEl) pctEl.innerText = (topBook.progress || 28) + '%';
      if (timeEl) timeEl.innerText = '上次阅读 · ' + (topBook.lastReadTime || '刚刚');
    }

    if (!gridEl) return;
    gridEl.innerHTML = currentBooks.map(book => {
      let coverHtml = '';
      if (book.cover) {
        coverHtml = `<img class="xianguo-book-cover-img" src="${book.cover}" alt="${book.title}" />`;
      } else {
        const theme = getPureCoverStyle(book.title || book.id);
        coverHtml = `
          <div class="xianguo-pure-cover" style="background: ${theme.bg}; color: ${theme.text};">
            <div class="xianguo-pure-cover-top" style="color: ${theme.sub};">阅 · 鲜果</div>
            <div class="xianguo-pure-cover-title" style="color: ${theme.text};">${book.title}</div>
            <div class="xianguo-pure-cover-bottom" style="color: ${theme.sub};">${book.author || '网络文学'}</div>
          </div>
        `;
      }

      return `
        <div class="xianguo-book-item" onclick="openXianguoReading('${book.id}')">
          <div class="xianguo-book-cover-wrap">
            ${coverHtml}
          </div>
          <div class="xianguo-book-meta-title" title="${book.title}">${book.title}</div>
          <div class="xianguo-book-meta-chap">${book.lastReadChapTitle || '第一章'}</div>
          <div class="xianguo-book-meta-footer">
            <span class="xianguo-book-meta-prog">${book.progress ? book.progress + '%' : '未开始'}</span>
            <span class="xianguo-book-edit-dot" onclick="event.stopPropagation(); openXianguoEditSheet('${book.id}')" title="编辑书籍">···</span>
          </div>
        </div>
      `;
    }).join('');
  };

  window.renderReaderShelf = window.renderShelfUI;

  // 渲染书城
  // ================= 📚 书城：在线公版书库（2026-11-20） =================
  // 只收公版书（古典名著 / 话本 / 志怪 / 演义）。清单与正文都放在本仓库 data/books/ 下，
  // 一次请求拿全书，导进 IndexedDB 之后就和本地书完全一样。
  const ONLINE_CATALOG_PATH = 'data/books/index.json';
  let onlineCatalogCache = null;
  let onlineActiveTag = '';

  const ONLINE_TAG_MAP = {
    all: '',
    mod: '明清小说',
    for: '译著',
    det: '公案',
    cla: '古典文学',
    wux: '演义'
  };

  function onlineEsc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function loadOnlineCatalog(force) {
    if (onlineCatalogCache && !force) return onlineCatalogCache;
    const res = await fetch(ONLINE_CATALOG_PATH + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('书库清单读取失败 HTTP ' + res.status);
    const data = await res.json();
    onlineCatalogCache = Array.isArray(data) ? data : (data.books || []);
    return onlineCatalogCache;
  }

  function onlineMatch(book, kw) {
    if (!kw) return true;
    const hay = [book.title, book.author].concat(book.alias || []).join(' ').toLowerCase();
    return hay.indexOf(kw.toLowerCase()) >= 0;
  }

  function onlineCoverHtml(meta) {
    const theme = rdPureTheme(meta.title || meta.id || 'x');
    return '<div class="xianguo-feed-cover" style="background:linear-gradient(160deg,' + theme.bg2a + ' 0%,' + theme.bg2b +
      ' 100%);color:' + theme.text2 + ';width:66px;height:90px;flex:0 0 66px;border-radius:4px;' +
      ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;letter-spacing:2px;writing-mode:horizontal-tb;">' +
      onlineEsc(String(meta.title || '').slice(0, 2)) + '</div>';
  }

  function paintStoreList(list, note) {
    const box = document.getElementById('xianguo-store-feed-list');
    if (!box) return;
    const tagEl = document.querySelector('.xianguo-feed-tag');
    const titleEl = document.getElementById('xianguo-feed-category-title');
    const countEl = document.getElementById('xianguo-feed-count');
    if (tagEl) tagEl.textContent = '在线公版书库';
    if (titleEl) titleEl.textContent = note || '现在就能读的';
    if (countEl) countEl.textContent = list.length + ' 本';
    if (!list.length) {
      box.innerHTML = '<div class="xianguo-store-empty">没找到。<br>在线库只收公版书：古典名著、话本、志怪、演义。换本书名再试。</div>';
      return;
    }
    box.innerHTML = list.map(function (b) {
      const inShelf = currentBooks.some(function (x) { return x && x.onlineId === b.id; });
      return '<div class="xianguo-feed-card" onclick="addStoreBookToShelf(\'' + b.id + '\')">' +
        onlineCoverHtml(b) +
        '<div class="xianguo-feed-info">' +
          '<div>' +
            '<div class="xianguo-feed-name">' + onlineEsc(b.title) +
              (inShelf ? '<span class="xianguo-feed-own">已在书架</span>' : '') + '</div>' +
            '<div class="xianguo-feed-author-tag">' + onlineEsc(b.author || '佚名') +
              (b.chapterCount ? ' · ' + b.chapterCount + ' 章' : '') + '</div>' +
            '<div class="xianguo-feed-intro">' + onlineEsc(b.desc || '') + '</div>' +
          '</div>' +
          '<div class="xianguo-feed-update">' + (inShelf ? '点一下回到上次那一页' : '点一下搬到小手机，直接读') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.searchStoreNovels = function () {
    const kwEl = document.getElementById('xianguo-search-kw');
    const kw = kwEl ? kwEl.value.trim() : '';
    loadOnlineCatalog().then(function (all) {
      loadLocalShelf();
      let list = all;
      if (kw) list = list.filter(function (b) { return onlineMatch(b, kw); });
      if (onlineActiveTag) list = list.filter(function (b) { return (b.tags || []).indexOf(onlineActiveTag) >= 0; });
      const label = [kw ? '搜「' + kw + '」' : '', onlineActiveTag].filter(Boolean).join(' · ');
      paintStoreList(list, label);
    }).catch(function (e) {
      const box = document.getElementById('xianguo-store-feed-list');
      if (box) {
        box.innerHTML = '<div class="xianguo-store-empty">书库没连上：' + onlineEsc(e.message) +
          '<br>大概是网络断了，再点一次「搜索」。</div>';
      }
    });
  };

  window.quickSearchStore = function (kw) {
    const el = document.getElementById('xianguo-search-kw');
    if (el) el.value = kw;
    window.searchStoreNovels();
  };

  window.switchGenreTag = function (el, key) {
    document.querySelectorAll('.xianguo-genre-chip').forEach(function (c) { c.classList.remove('active'); });
    if (el) el.classList.add('active');
    onlineActiveTag = ONLINE_TAG_MAP[key] || '';
    window.searchStoreNovels();
  };

  window.renderStoreUI = function () {
    window.searchStoreNovels();
  };

  window.addStoreBookToShelf = async function (storeBookId) {
    loadLocalShelf();
    const existed = currentBooks.find(function (b) { return b && b.onlineId === storeBookId; });
    if (existed) { openXianguoReading(existed.id); return; }

    let meta = null;
    try {
      const all = await loadOnlineCatalog();
      meta = all.find(function (b) { return b.id === storeBookId; }) || null;
    } catch (e) {
      alert('书库没连上：' + e.message);
      return;
    }
    if (!meta) { alert('书库里没有这本。'); return; }

    showXianguoToast('正在搬《' + meta.title + '》…', 8000);
    let data = null;
    try {
      const res = await fetch(meta.file, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (e) {
      alert('《' + meta.title + '》没搬成：' + e.message + '\n换个网络再点一次。');
      return;
    }

    const chapters = (data.chapters || [])
      .filter(function (c) { return c && c.title && Array.isArray(c.paragraphs) && c.paragraphs.length; })
      .map(function (c) { return { title: String(c.title), paragraphs: c.paragraphs.map(function (p) { return String(p); }) }; });
    if (!chapters.length) { alert('这本抽不出正文，先别导。'); return; }

    const bookId = 'ol-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000);
    const book = {
      id: bookId,
      onlineId: meta.id,
      title: meta.title,
      author: meta.author || '佚名',
      cover: '',
      lastReadChapTitle: chapters[0].title,
      lastReadTime: '刚刚搬进来',
      progress: 0,
      chapterCount: chapters.length,
      hasIndexedDB: true,
      isOriginal: false,
      origin: 'online',
      source: meta.source || ''
    };
    loadLocalShelf();
    currentBooks.unshift(book);
    saveLocalShelf();
    const ok = await saveBookChaptersToDB(bookId, chapters);
    if (!ok) console.warn('在线书正文写 IndexedDB 失败，书单条目保留');
    renderShelfUI();
    showXianguoToast('📖 《' + meta.title + '》已进书架 · ' + chapters.length + ' 回', 3000);
    if (onlineCatalogCache) paintStoreList(onlineCatalogCache, '');
    switchXianguoTab('shelf');
    openXianguoReading(bookId);
  };

  window.resumeLastReading = function() {
    if (currentBooks.length > 0) {
      openXianguoReading(currentBooks[0].id);
    }
  };

  // ================= 添加书籍抽屉弹窗 =================
  window.openXianguoAddSheet = function() {
    const sheet = document.getElementById('xianguo-add-sheet');
    if (sheet) sheet.style.display = 'flex';
  };

  window.closeXianguoAddSheet = function(e) {
    if (e && e.target && e.target.id !== 'xianguo-add-sheet') return;
    const sheet = document.getElementById('xianguo-add-sheet');
    if (sheet) sheet.style.display = 'none';
  };

  
  // ================= 📚 本地大容量持久化引擎 (IndexedDB 绝不爆内存与容量限制) =================
  const NOVEL_DB_NAME = 'MomoNovelStoreDB';
  const NOVEL_DB_VERSION = 1;
  const NOVEL_STORE_NAME = 'novel_chapters';

  function openNovelDB() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(NOVEL_DB_NAME, NOVEL_DB_VERSION);
        req.onupgradeneeded = function(e) {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(NOVEL_STORE_NAME)) {
            db.createObjectStore(NOVEL_STORE_NAME, { keyPath: 'bookId' });
          }
        };
        req.onsuccess = function(e) {
          resolve(e.target.result);
        };
        req.onerror = function(err) {
          console.error('打开小说数据库失败:', err);
          resolve(null);
        };
      } catch (err) {
        resolve(null);
      }
    });
  }

  async function saveBookChaptersToDB(bookId, chapters) {
    try {
      const db = await openNovelDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction([NOVEL_STORE_NAME], 'readwrite');
        const store = tx.objectStore(NOVEL_STORE_NAME);
        store.put({ bookId, chapters, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('saveBookChaptersToDB 失败:', e);
      return false;
    }
  }

  async function getBookChaptersFromDB(bookId) {
    try {
      const db = await openNovelDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction([NOVEL_STORE_NAME], 'readonly');
        const store = tx.objectStore(NOVEL_STORE_NAME);
        const req = store.get(bookId);
        req.onsuccess = (e) => {
          if (e.target.result && e.target.result.chapters) {
            resolve(e.target.result.chapters);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async function deleteBookChaptersFromDB(bookId) {
    try {
      const db = await openNovelDB();
      if (!db) return;
      const tx = db.transaction([NOVEL_STORE_NAME], 'readwrite');
      const store = tx.objectStore(NOVEL_STORE_NAME);
      store.delete(bookId);
    } catch (e) {}
  }

  // ================= 🎨 鲜果机纯色马卡龙与莫兰迪专属渐变封面库 =================
  const xianguoCoverThemes = [
    { bg: 'linear-gradient(135deg, #ffdde1 0%, #ee9ca7 100%)', text: '#5c222c', sub: '#a04856' },
    { bg: 'linear-gradient(135deg, #cbe3fb 0%, #a4c8f0 100%)', text: '#1e385b', sub: '#496b96' },
    { bg: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)', text: '#214228', sub: '#4a7553' },
    { bg: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', text: '#2d1f47', sub: '#68598a' },
    { bg: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', text: '#2d3436', sub: '#636e72' },
    { bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', text: '#4e2808', sub: '#854b1f' },
    { bg: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)', text: '#3c2448', sub: '#775785' },
    { bg: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', text: '#1b3f68', sub: '#4c749e' },
    { bg: 'linear-gradient(135deg, #fed6e3 0%, #a8edea 100%)', text: '#2a4544', sub: '#567574' }
  ];

  function getPureCoverStyle(seedStr) {
    let hash = 0;
    for (let i = 0; i < (seedStr || '').length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
    }
    const idx = Math.abs(hash) % xianguoCoverThemes.length;
    return xianguoCoverThemes[idx];
  }

  // ================= 🧠 智能书名与作者提取算法 =================
  function parseBookMetaFromFileName(rawFileName) {
    let clean = rawFileName.replace(/\.(txt|epub|mobi|azw3|pdf)$/i, '').trim();
    let title = clean;
    let author = '网络文学';

    const bMatch = clean.match(/《([^》]+)》/);
    if (bMatch) {
      title = bMatch[1].trim();
      const rem = clean.replace(bMatch[0], '').trim();
      const aMatch = rem.match(/(?:作者|作\s*者|by|BY|著)[：:\s]*([\u4e00-\u9fa5a-zA-Z0-9_·]+)/);
      if (aMatch) {
        author = aMatch[1].trim();
      } else if (rem) {
        const candidate = rem.replace(/^[-_\s\(\)\[\]【】]+/, '').trim();
        if (candidate.length > 0 && candidate.length <= 16) {
          author = candidate;
        }
      }
    } else {
      const parts = clean.split(/[-_——\s]+(?:by|BY|作者|著)?[：:\s]*/);
      if (parts.length >= 2) {
        title = parts[0].trim();
        author = parts.slice(1).join(' ').trim();
      } else {
        title = clean;
      }
    }

    if (!title) title = '未命名书籍';
    if (!author) author = '佚名';
    return { title, author };
  }

  // ================= 🧩 轻量 ZIP 读取（EPUB 用，纯前端无依赖） =================
  async function openEpubZip(arrayBuffer) {
    const u8 = new Uint8Array(arrayBuffer);
    const dv = new DataView(arrayBuffer);
    const u16 = (o) => dv.getUint16(o, true);
    const u32 = (o) => dv.getUint32(o, true);

    let eocd = -1;
    const minStart = Math.max(0, u8.length - 65558);
    for (let i = u8.length - 22; i >= minStart; i--) {
      if (u32(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('这不是有效的 EPUB（找不到压缩包目录）');

    const count = u16(eocd + 10);
    const cdOff = u32(eocd + 16);
    const entries = {};
    let p = cdOff;
    for (let i = 0; i < count; i++) {
      if (u32(p) !== 0x02014b50) break;
      const method = u16(p + 10);
      const csize = u32(p + 20);
      const nameLen = u16(p + 28);
      const extraLen = u16(p + 30);
      const commentLen = u16(p + 32);
      const lho = u32(p + 42);
      const name = new TextDecoder('utf-8').decode(u8.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
      const lnLen = u16(lho + 26), leLen = u16(lho + 28);
      const dataOff = lho + 30 + lnLen + leLen;
      entries[name] = { method, csize, dataOff };
      p += 46 + nameLen + extraLen + commentLen;
    }

    const names = Object.keys(entries);
    const findName = (n) => {
      if (entries[n]) return n;
      const lower = String(n).toLowerCase();
      return names.find((k) => k.toLowerCase() === lower) || null;
    };

    async function get(n) {
      const key = findName(n);
      if (!key) return null;
      const e = entries[key];
      const raw = u8.subarray(e.dataOff, e.dataOff + e.csize);
      if (e.method === 0) return raw;
      if (e.method === 8) {
        if (typeof DecompressionStream !== 'function') {
          throw new Error('这个系统版本解不开 EPUB 压缩，请改用 TXT 导入（或升级到 iOS 16.4 以上）');
        }
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const ab = await new Response(stream).arrayBuffer();
        return new Uint8Array(ab);
      }
      throw new Error('EPUB 使用了不支持的压缩方式（' + e.method + '）');
    }

    return { names, get };
  }

  function htmlToParagraphs(html) {
    const div = document.createElement('div');
    div.innerHTML = String(html)
      .replace(/<\?xml[^>]*\?>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '');
    div.querySelectorAll('script,style,img,svg,figure,table,footnote').forEach((e) => e.remove());
    const ps = Array.from(div.querySelectorAll('p')).map((p) => p.textContent.replace(/[\s\u3000]+/g, ' ').trim()).filter(Boolean);
    if (ps.length >= 2) return ps;
    const text = div.innerHTML
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|blockquote|section)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return text.split('\n').map((s) => s.replace(/[\s\u3000]+/g, ' ').trim()).filter(Boolean);
  }

  function htmlChapterTitle(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const h = div.querySelector('h1,h2,h3,h4');
    if (h) {
      const t = h.textContent.replace(/[\s\u3000]+/g, ' ').trim();
      if (t && t.length <= 60) return t;
    }
    const t2 = div.querySelector('title');
    if (t2) {
      const t = t2.textContent.trim();
      if (t && t.length <= 60) return t;
    }
    return '';
  }

  async function parseEpubToChapters(file) {
    const zip = await openEpubZip(await file.arrayBuffer());
    const dec = (b) => new TextDecoder('utf-8').decode(b);

    let opfPath = null;
    const container = await zip.get('META-INF/container.xml');
    if (container) {
      const m = dec(container).match(/full-path="([^"]+)"/i);
      if (m) opfPath = m[1];
    }
    if (!opfPath) opfPath = zip.names.find((n) => n.toLowerCase().endsWith('.opf')) || null;
    if (!opfPath) throw new Error('EPUB 缺少 opf 描述文件');

    const opfText = dec(await zip.get(opfPath));
    const manifest = {};
    opfText.replace(/<item\b[^>]*>/gi, (tag) => {
      const id = (tag.match(/\bid="([^"]*)"/i) || [])[1];
      const href = (tag.match(/\bhref="([^"]*)"/i) || [])[1];
      if (id && href) manifest[id] = href;
      return tag;
    });
    const spineIds = [];
    const spineBlock = (opfText.match(/<spine\b[\s\S]*?<\/spine>/i) || [''])[0];
    spineBlock.replace(/<itemref\b[^>]*>/gi, (tag) => {
      const id = (tag.match(/idref="([^"]*)"/i) || [])[1];
      if (id) spineIds.push(id);
      return tag;
    });

    const order = spineIds.length ? spineIds : Object.keys(manifest);
    const chapters = [];
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const href = manifest[id];
      if (!href) continue;
      let full;
      try {
        full = decodeURIComponent(new URL(href, 'http://epub.local/' + opfPath).pathname.replace(/^\//, ''));
      } catch (e) {
        full = (opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '') + href;
      }
      const bytes = await zip.get(full);
      if (!bytes) continue;
      const html = dec(bytes);
      const paras = htmlToParagraphs(html);
      const textLen = paras.reduce((s, x) => s + x.length, 0);
      if (textLen < 30) continue; // 封面、版权页这类跳过
      const title = htmlChapterTitle(html) || ('第 ' + (chapters.length + 1) + ' 章');
      // 有些 epub 会把标题在正文里再写一遍，去掉开头重复的那一段
      while (paras.length && paras[0].replace(/[\s\u3000]+/g, '') === title.replace(/[\s\u3000]+/g, '')) {
        paras.shift();
      }
      if (!paras.length) continue;
      chapters.push({ title, paragraphs: paras });
    }

    if (!chapters.length) throw new Error('EPUB 里没抽到正文');
    return chapters;
  }

  // ================= 📖 智能编码自适应与正则分章解析器 =================
  async function parseNovelFileToChapters(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const buffer = e.target.result;
        let text = '';

        try {
          const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
          text = utf8Decoder.decode(buffer);
        } catch (err) {
          try {
            const gbkDecoder = new TextDecoder('gbk');
            text = gbkDecoder.decode(buffer);
          } catch (e2) {
            const fallbackDecoder = new TextDecoder('utf-8');
            text = fallbackDecoder.decode(buffer);
          }
        }

        text = text.replace(/^\uFEFF/, '');
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        text = text.replace(/[\u200b-\u200f\u2028\u2029]/g, '');

        // 盗版站常见水印 / 广告行，进正文前先剔掉
        const NOISE_RE = /^(?:本书由|本书首发|首发|最新章节|请记住|手机版|电脑版|手机阅读|手机用户|访问|欢迎收藏|全文阅读|无弹窗|下载|笔趣阁|顶点|铅笔|书包|掌阅|书友|感谢|求收藏|求订阅|求月票|投推荐票|打赏|本章完|本章未完|www\.|http|https|m\.|wap\.)/i;
        const rawLines = text.split('\n');
        const lines = [];
        for (let li = 0; li < rawLines.length; li++) {
          const l = rawLines[li].replace(/[\u3000\t]+/g, ' ').trim();
          if (!l) continue;
          if (l.length <= 60 && NOISE_RE.test(l)) continue;
          if (l.length <= 40 && /^[（(【\[]?(本章完|未完待续|全文完|全文终)[）)】\]]?/.test(l)) continue;
          // 一行字数过长（某些 txt 全篇不断行），按句号先劈开
          if (l.length > 3000) {
            const pieces = l.split(/(?<=[。！？…”』」])/).map((s) => s.trim()).filter(Boolean);
            for (const pc of pieces) if (pc) lines.push(pc);
            continue;
          }
          lines.push(l);
        }

        const TITLE_RES = [
          /^(?:Part\s*\d+|Chapter\s*\d+|CHAPTER\s+[IVXLC]+)/i,
          /^第[〇零一二三四五六七八九十百千万两0-9]+[章回卷节集幕篇部折話话]/,
          /^(?:卷|回|章|节|篇)[〇零一二三四五六七八九十百0-9]+/,
          /^(?:序章|序言|序幕|序|引子|楔子|前言|后记|尾声|终章|结局|番外|外传|附录|小引|凡例)/,
          /^\d{1,4}[、.．]\s*\S/
        ];
        const isTitle = (l) => {
          if (l.length > 42) return false;
          if (TITLE_RES.some((re) => re.test(l))) return true;
          return false;
        };

        const marks = [];
        for (let li = 0; li < lines.length; li++) {
          const l = lines[li];
          if (/^["'“‘「『]/.test(l)) continue;
          if (isTitle(l)) marks.push({ i: li, title: l });
        }

        // 标题太密（正文里误命中的情况）就视为没标题
        const marksUsable = marks.length > 0 && marks.length <= Math.max(4, Math.floor(lines.length / 6));

        let chapters = [];
        if (marksUsable) {
          const firstMarks = marks[0].i;
          if (firstMarks > 0) {
            const intro = lines.slice(0, firstMarks).join('\n').trim();
            if (intro.length > 10) {
              chapters.push({ title: '序言 / 引子', paragraphs: lines.slice(0, firstMarks) });
            }
          }
          for (let k = 0; k < marks.length; k++) {
            const cur = marks[k];
            const nxt = marks[k + 1];
            const body = lines.slice(cur.i + 1, nxt ? nxt.i : lines.length);
            chapters.push({
              title: cur.title || ('第 ' + (k + 1) + ' 章'),
              paragraphs: body.length ? body : ['（本章无段落内容）']
            });
          }
        } else if (lines.length > 0) {
          // 没有章节标记：按字数切，约 2000 字一节，读起来不至于一屏几千字
          const CHUNK_CHARS = 2000;
          let buf = [], n = 0;
          for (const l of lines) {
            buf.push(l);
            n += l.length;
            if (n >= CHUNK_CHARS) {
              chapters.push({ title: '第 ' + (chapters.length + 1) + ' 节', paragraphs: buf });
              buf = []; n = 0;
            }
          }
          if (buf.length) chapters.push({ title: '第 ' + (chapters.length + 1) + ' 节', paragraphs: buf });
          if (chapters.length <= 1) chapters = [{ title: '全本阅读', paragraphs: lines }];
        } else {
          chapters = [{ title: '空书籍文件', paragraphs: ['这个文件里没有文字。'] }];
        }

        resolve(chapters);
      };

      reader.onerror = function() {
        resolve([{ title: '读取错误', paragraphs: ['无法读取该文件内容'] }]);
      };

      reader.readAsArrayBuffer(file);
    });
  }

  // ================= 📂 递归读取文件夹 Entry 机制 =================
  async function scanFilesFromEntry(entry) {
    const files = [];
    if (entry.isFile) {
      const file = await new Promise((res) => entry.file(res));
      if (file && (file.name.endsWith('.txt') || file.name.endsWith('.epub') || file.type.includes('text'))) {
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readEntries = async () => {
        return new Promise((res) => {
          dirReader.readEntries(async (entries) => {
            if (!entries || entries.length === 0) {
              res([]);
              return;
            }
            const nested = [];
            for (const sub of entries) {
              const subFiles = await scanFilesFromEntry(sub);
              nested.push(...subFiles);
            }
            const more = await readEntries();
            res([...nested, ...more]);
          });
        });
      };
      const dirFiles = await readEntries();
      files.push(...dirFiles);
    }
    return files;
  }

  function showXianguoToast(msg, duration = 2500) {
    const toast = document.getElementById('xianguo-import-toast');
    const toastText = document.getElementById('xianguo-import-toast-text');
    if (toast && toastText) {
      toastText.innerText = msg;
      toast.style.display = 'flex';
      if (toast._timer) clearTimeout(toast._timer);
      toast._timer = setTimeout(() => {
        toast.style.display = 'none';
      }, duration);
    }
  }

  // ================= 🚀 批量小说导入主控核心 (拖拽/文件选框统一调度) =================
  window.batchImportNovelFiles = async function(fileList) {
    if (!fileList || fileList.length === 0) return;

    showXianguoToast('📚 正在批量收纳整理小说，请稍候...', 10000);

    let successCount = 0;
    const addedBooks = [];
    const failures = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.match(/\.(txt|epub)$/i) && !file.type.includes('text')) {
        continue;
      }

      showXianguoToast('📖 (' + (i + 1) + '/' + fileList.length + ') 正在智能分章《' + file.name + '》...', 8000);

      const meta = parseBookMetaFromFileName(file.name);
      let chapters = [];
      try {
        chapters = /\.epub$/i.test(file.name)
          ? await parseEpubToChapters(file)
          : await parseNovelFileToChapters(file);
      } catch (err) {
        console.warn('导入失败', file.name, err);
        failures.push(file.name + '：' + (err && err.message ? err.message : '读取失败'));
        continue;
      }
      if (!chapters || !chapters.length) {
        failures.push(file.name + '：抽不出正文');
        continue;
      }
      const bookId = 'book-local-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

      // 1. 大文本正文异步写入 IndexedDB (永不占用 localStorage 宝贵配额)
      await saveBookChaptersToDB(bookId, chapters);

      // 2. 元数据放进书架列表
      const bookMeta = {
        id: bookId,
        title: meta.title,
        author: meta.author,
        cover: '',
        lastReadChapTitle: chapters[0] ? chapters[0].title : '第1章',
        progress: 0,
        lastReadTime: '刚刚导入',
        chapterCount: chapters.length,
        hasIndexedDB: true,
        chapters: chapters.slice(0, 2)
      };

      currentBooks.unshift(bookMeta);
      addedBooks.push(bookMeta);
      successCount++;
    }

    if (successCount > 0) {
      saveLocalShelf();
      renderShelfUI();
      showXianguoToast('✨ 成功将 ' + successCount + ' 本收纳进书架' + (failures.length ? '，' + failures.length + ' 本失败' : '') + '！', failures.length ? 5000 : 3000);
      closeXianguoAddSheet();
      if (failures.length) setTimeout(function () { alert('这些没导进去：\n· ' + failures.join('\n· ')); }, 600);
    } else if (failures.length) {
      alert('一本都没导进去：\n· ' + failures.join('\n· '));
    } else {
      showXianguoToast('⚠️ 没找到能读的 txt / epub 文件', 2500);
    }
  };

  // 单选/多选文件框事件响应
  window.handleXianguoImportBatchFiles = function(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      window.batchImportNovelFiles(Array.from(files));
      event.target.value = '';
    }
  };

  window.handleXianguoImportTxt = window.handleXianguoImportBatchFiles;

  // ================= 🎯 全局与页面拖拽投掷捕获监听器 =================
  function initXianguoDragDropListeners() {
    const overlay = document.getElementById('xianguo-drag-drop-overlay');
    let dragCounter = 0;

    const showOverlay = () => {
      if (overlay) overlay.classList.add('active');
    };

    const hideOverlay = () => {
      if (overlay) overlay.classList.remove('active');
    };

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        showOverlay();
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        hideOverlay();
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      hideOverlay();

      const dt = e.dataTransfer;
      if (!dt) return;

      const collectedFiles = [];

      if (dt.items && dt.items.length > 0 && typeof dt.items[0].webkitGetAsEntry === 'function') {
        showXianguoToast('📂 正在扫描拖入的文件夹与书籍...', 3000);
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i];
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry) {
            const files = await scanFilesFromEntry(entry);
            collectedFiles.push(...files);
          } else {
            const file = item.getAsFile ? item.getAsFile() : null;
            if (file) collectedFiles.push(file);
          }
        }
      } else if (dt.files && dt.files.length > 0) {
        collectedFiles.push(...Array.from(dt.files));
      }

      if (collectedFiles.length > 0) {
        window.batchImportNovelFiles(collectedFiles);
      }
    });
  }

  // ================= 编辑书籍抽屉弹窗 =================
  window.openXianguoEditSheet = function(bookId) {
    const book = currentBooks.find(b => b.id === bookId);
    if (!book) return;
    editingBookId = bookId;

    const sheet = document.getElementById('xianguo-edit-sheet');
    const coverPreview = document.getElementById('xianguo-edit-cover-preview');
    const titleIn = document.getElementById('xianguo-edit-title-input');
    const authorIn = document.getElementById('xianguo-edit-author-input');

    if (coverPreview) coverPreview.src = book.cover || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80';
    if (titleIn) titleIn.value = book.title;
    if (authorIn) authorIn.value = book.author || '未知作者';

    if (sheet) sheet.style.display = 'flex';
  };

  window.closeXianguoEditSheet = function(e) {
    if (e && e.target && e.target.id !== 'xianguo-edit-sheet') return;
    const sheet = document.getElementById('xianguo-edit-sheet');
    if (sheet) sheet.style.display = 'none';
    editingBookId = null;
  };

  window.promptChangeBookCover = function() {
    const url = prompt('输入新的封面图片直链：');
    if (url && url.trim()) {
      const coverPreview = document.getElementById('xianguo-edit-cover-preview');
      if (coverPreview) coverPreview.src = url.trim();
    }
  };

  window.saveXianguoBookEdit = function() {
    if (!editingBookId) return;
    const book = currentBooks.find(b => b.id === editingBookId);
    if (!book) return;

    const titleIn = document.getElementById('xianguo-edit-title-input');
    const authorIn = document.getElementById('xianguo-edit-author-input');
    const coverPreview = document.getElementById('xianguo-edit-cover-preview');

    if (titleIn) book.title = titleIn.value.trim() || book.title;
    if (authorIn) book.author = authorIn.value.trim() || book.author;
    if (coverPreview && coverPreview.src) book.cover = coverPreview.src;

    saveLocalShelf();
    closeXianguoEditSheet();
    renderShelfUI();
    alert('书籍信息已保存！');
  };

  window.deleteXianguoCurrentBook = async function() {
    if (!editingBookId) return;
    if (!confirm('确定要把这本书从小手机里移除吗？')) return;

    const idToDelete = editingBookId;

    // 清理该书专属聊天记录
    // 这本书在所有同伴名下的对话一起删掉，别留孤儿
    Object.keys(allBooksChatMap).forEach(function (k) {
      if (k === idToDelete || k.indexOf(String(idToDelete) + '::') === 0) {
        delete allBooksChatMap[k];
      }
    });
    saveBooksChatMap();

    // 清理 IndexedDB 大容量正文
    await deleteBookChaptersFromDB(idToDelete);

    currentBooks = currentBooks.filter(b => b.id !== idToDelete);
    saveLocalShelf();
    closeXianguoEditSheet();
    renderShelfUI();
  };

  // ================= 正文沉浸阅读器 =================
  // 2026-11-20 图书联动第一步：把当前在读的这一章交给「此时此刻」剧场开演
  window.startTheaterWithBook = function () {
    if (!currentActiveBook) { alert('先打开一本书，再点开演。'); return; }
    const chapters = currentActiveBook.chapters || [];
    const idx = Math.min(Math.max(currentChapterIdx || 0, 0), Math.max(chapters.length - 1, 0));
    const chap = chapters[idx] || { title: '第1章', paragraphs: [] };
    const bodyText = (chap.paragraphs || []).join('\n');
    const excerpt = bodyText.length > 1200 ? bodyText.slice(0, 1200) + '……' : bodyText;
    if (typeof window.setTheaterBookStage !== 'function') {
      alert('剧场还没准备好，等一下再试。');
      return;
    }
    window.setTheaterBookStage({
      bookId: currentActiveBook.id,
      title: currentActiveBook.title || '',
      author: currentActiveBook.author || '',
      chapterIndex: idx,
      chapterTitle: chap.title || ('第' + (idx + 1) + '章'),
      chapterCount: chapters.length,
      excerpt: excerpt,
      updatedAt: Date.now()
    });
    try {
      if (typeof window.closeReaderModal === 'function') window.closeReaderModal('reader-catalog-drawer-modal');
    } catch (e) {}
    if (typeof window.openPage === 'function') window.openPage('page-rp');
  };

  // 2026-11-20 图书联动：把「此时此刻」演过的剧情导入成书架里的一本书
  // 这类书带 origin:'rp' 标记 —— 只有它们才显示「🎭 用这本书开剧场」。
  window.importRpStoryAsBook = function (payload) {
    const data = payload || {};
    const chapters = (Array.isArray(data.chapters) ? data.chapters : [])
      .filter(c => c && c.title && Array.isArray(c.paragraphs) && c.paragraphs.length)
      .map(c => ({ title: String(c.title), paragraphs: c.paragraphs.map(p => String(p)) }));
    if (!chapters.length) return { ok: false, error: '没有可导入的正文' };

    loadLocalShelf();
    const id = 'rp-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000);
    const book = {
      id: id,
      title: data.title || '剧场',
      author: data.author || '言言机 · 此时此刻',
      cover: '',
      lastReadChapTitle: chapters[0].title,
      lastReadTime: '刚刚',
      progress: 0,
      chapterCount: chapters.length,
      hasIndexedDB: true,
      isOriginal: true,
      origin: 'rp',
      rpMeta: {
        charName: data.charName || '',
        savedAt: data.savedAt || Date.now(),
        preamble: data.preamble || ''
      }
    };
    currentBooks.unshift(book);
    saveLocalShelf();
    saveBookChaptersToDB(id, chapters).then(function (ok) {
      if (!ok) console.warn('剧场剧情写入 IndexedDB 失败，书单条目仍然保留');
      renderShelfUI();
    });
    renderShelfUI();
    try { showXianguoToast('📖 《' + book.title + '》已放进书架', 3000); } catch (e) {}
    return { ok: true, bookId: id, chapters: chapters.length };
  };

  // ====== 聊天里的共读卡片（用户发 / 角色发共用） ======
  window.readerCatalogForAi = function(limit) {
    const list = (typeof currentBooks !== 'undefined' && currentBooks) || [];
    const n = limit || 6;
    const parts = [];
    const cur = (typeof currentActiveBook !== 'undefined' && currentActiveBook) || null;
    if (cur && cur.title) {
      const chap = (cur.chapters && cur.chapters[currentChapterIdx] && cur.chapters[currentChapterIdx].title) || '';
      const pct = Number(cur.progress);
      const tail = (chap ? ('正在读：' + chap) : '正在读')
        + (pct > 0 ? ('，进度 ' + pct + '%') : '');
      parts.push(cur.title + '（' + tail + '）');
    }
    list.forEach(function(b) {
      if (cur && b.id === cur.id) return;
      if (parts.length >= n) return;
      parts.push(b.title + (b.author ? (' - ' + b.author) : ''));
    });
    return parts.join('；');
  };

  function findBookByTitle(want) {
    if (!want) return null;
    const w = String(want).replace(/[《》"“”']/g, '').trim();
    if (!w) return null;
    const list = (typeof currentBooks !== 'undefined' && currentBooks) || [];
    for (let i = 0; i < list.length; i++) {
      const t = String(list[i].title || '').replace(/[《》"“”']/g, '');
      if (t === w || t.indexOf(w) >= 0 || w.indexOf(t) >= 0) return list[i];
    }
    return null;
  }

  window.readerCardMarkerToShareCard = function(text) {
    if (!text || text.indexOf('[READ_') < 0) return text;
    function build(titleRaw, invite) {
      const book = findBookByTitle(titleRaw);
      const card = {
        kind: invite ? 'read_invite' : 'read',
        bookId: book ? book.id : '',
        title: book ? book.title : String(titleRaw || '').trim(),
        desc: (book && book.author ? book.author : '书架上的一本') + (invite ? ' · 邀你一起读' : ' · 分享给你'),
        cover: (book && book.cover) || '',
        brand: invite ? '一起读邀请' : '共读分享',
        brandIcon: '📖'
      };
      return '[SHARECARD:' + JSON.stringify(card) + ']';
    }
    return String(text)
      .replace(/\[READ_INVITE\s*[:：]\s*([^\]\n]+)\]/g, function(m, t) { return build(t, true); })
      .replace(/\[READ_SHARE\s*[:：]\s*([^\]\n]+)\]/g, function(m, t) { return build(t, false); });
  };

  window.playSharedBook = function(card) {
    const book = card ? (findBookByTitle(card.title) || (card.bookId ? (currentBooks || []).filter(function(b) { return b.id === card.bookId; })[0] : null)) : null;
    if (!book) {
      if (typeof showToast === 'function') showToast('这本书不在书架上');
      return false;
    }
    if (typeof openPage === 'function') openPage('page-reader');
    try { window.openXianguoReading(book.id); } catch (e) {}
    return true;
  };

  window.acceptReadInvite = function(card) {
    const already = !!(window.Companion && window.Companion.isAccepted && window.Companion.isAccepted(card));
    let ownerId = '';
    try { ownerId = localStorage.getItem('momo_active_char') || ''; } catch (e) {}
    if (window.switchReaderCompanion) window.switchReaderCompanion(ownerId);
    const ok = window.playSharedBook(card);
    if (window.Companion && window.Companion.markAccepted) window.Companion.markAccepted(card);
    if (!already && typeof window.renderSystemNotice === 'function') {
      window.renderSystemNotice('已和' + readerChatOwnerName() + '一起读《' + ((card && card.title) || '这本书') + '》');
    }
    if (typeof window.refreshChatCardStates === 'function') window.refreshChatCardStates();
    return ok;
  };

  function readerChatOwnerName() {
    return String((window.appData && window.appData.botRemark) || '周绪言').trim().split(/\s+/)[0] || '周绪言';
  }

  // 用户把正在读的这本发给角色：mode 'share' 只分享 / 'invite' 邀一起读
  window.sendReaderCardToChar = function(mode) {
    const book = (typeof currentActiveBook !== 'undefined' && currentActiveBook) || null;
    if (!book) {
      if (typeof showToast === 'function') showToast('先打开一本书再发');
      return;
    }
    const hub = window.appData;
    if (!hub) return;
    if (!Array.isArray(hub.chatHistory)) hub.chatHistory = [];
    const invite = mode === 'invite';
    const card = {
      kind: invite ? 'read_invite' : 'read',
      bookId: book.id || '',
      title: book.title || '这本书',
      desc: (book.author || '书架上的一本') + (invite ? ' · 邀你一起读' : ' · 分享给你'),
      cover: book.cover || '',
      brand: invite ? '一起读邀请' : '共读分享',
      brandIcon: '📖'
    };
    const content = (invite ? '「邀你一起读」' : '') + '[SHARECARD:' + JSON.stringify(card) + ']';
    const t = (typeof getNowStr === 'function') ? getNowStr() : '刚刚';
    hub.chatHistory.push({ role: 'user', content: content, time: t });
    try {
      if (typeof window.saveChatHistoryNow === 'function') window.saveChatHistoryNow();
    } catch (e) {}
    if (typeof showToast === 'function') {
      showToast(invite ? ('已邀' + readerChatOwnerName() + '一起读') : ('已把这本书发给' + readerChatOwnerName()));
    }
  };

  window.openXianguoReading = async function(bookId) {
    const book = currentBooks.find(b => b.id === bookId) || defaultBooks[0];
    currentActiveBook = book;
    currentChapterIdx = 0;

    // 如果该书的正文存在 IndexedDB 中，异步无缝调出完整章节
    if (book && book.hasIndexedDB) {
      try {
        const fullChapters = await getBookChaptersFromDB(book.id);
        if (fullChapters && fullChapters.length > 0) {
          book.chapters = fullChapters;
          book.chapterCount = fullChapters.length;
        }
      } catch (e) {
        console.warn('从 IndexedDB 获取章节异常:', e);
      }
    }

    // 加载这本书专属的独立聊天记录！
    loadBooksChatMap();

    const container = document.getElementById('xianguo-reading-container');
    const badge = document.getElementById('xianguo-reading-book-badge');
    const partnerSub = document.getElementById('xianguo-together-sub');

    if (badge) badge.innerText = book.title;
    if (partnerSub) partnerSub.innerText = '和你一起读《' + book.title + '》· 防剧透';

    const avatarEl = document.getElementById('xianguo-together-avatar');
    const nameEl = document.getElementById('xianguo-together-name');
    // 头像与名字跟着当前伴读的人走，换角色就换脸
    const compCharNow = readerCompanion();
    const compAvatar = (window.Companion ? window.Companion.avatarOf(compCharNow) : '')
      || localStorage.getItem('momo_bot_avatar')
      || (window.appData && window.appData.botAvatar) || '';
    if (avatarEl && compAvatar) avatarEl.src = compAvatar;
    if (nameEl) nameEl.innerText = readerCompanionName();

    if (container) container.style.display = 'flex';
    const editPenEl = document.getElementById('xianguo-read-edit-pen');
    if (editPenEl) {
      editPenEl.style.display = (book && book.isOriginal) ? 'flex' : 'none';
    }
    renderReadingContent();
  };

  window.exitXianguoReading = function() {
    const container = document.getElementById('xianguo-reading-container');
    if (container) container.style.display = 'none';
    hideSelectionBubble();
    closeXianguoReadTogetherDrawer();
  };

  function renderReadingContent() {
    const bodyEl = document.getElementById('xianguo-reading-body');
    if (!bodyEl || !currentActiveBook) return;

    const chap = (currentActiveBook.chapters && currentActiveBook.chapters[currentChapterIdx]) || {
      title: '第1章',
      paragraphs: ['暂无内容']
    };

    bodyEl.innerHTML = `
      <div class="xianguo-read-chapter-num">第 ${currentChapterIdx + 1} 章</div>
      <div class="xianguo-read-chapter-title">${chap.title}</div>
      ${chap.paragraphs.map((p, idx) => `
        <p class="xianguo-read-p" id="p-idx-${idx}">${p}</p>
      `).join('')}
    `;

    bodyEl.scrollTop = 0;
    bindTextSelectionListener();

    const progressText = document.getElementById('xianguo-read-page-progress-text');
    const slider = document.getElementById('xianguo-chapter-slider');
    if (progressText) progressText.innerText = (currentChapterIdx + 1) + '/' + (currentActiveBook.chapters ? currentActiveBook.chapters.length : 1) + ' 章';
    if (slider) slider.value = Math.round(((currentChapterIdx + 1) / (currentActiveBook.chapters ? currentActiveBook.chapters.length : 1)) * 100);
  }

  let isInteractingWithSelectionBubble = false;

  function bindTextSelectionListener() {
    const bubble = document.getElementById('xianguo-selection-bubble');
    if (bubble) {
      bubble.onmouseenter = () => { isInteractingWithSelectionBubble = true; };
      bubble.onmouseleave = () => { isInteractingWithSelectionBubble = false; };
      bubble.onpointerdown = () => { isInteractingWithSelectionBubble = true; };
    }

    document.addEventListener('selectionchange', () => {
      if (isInteractingWithSelectionBubble) return;
      handleSelectionCheck();
    });
    window.addEventListener('mouseup', () => {
      if (isInteractingWithSelectionBubble) return;
      setTimeout(handleSelectionCheck, 60);
    });
    window.addEventListener('touchend', () => {
      if (isInteractingWithSelectionBubble) return;
      setTimeout(handleSelectionCheck, 120);
    });
  }

  function handleSelectionCheck() {
    if (isInteractingWithSelectionBubble) return;

    const container = document.getElementById('xianguo-reading-container');
    const bodyEl = document.getElementById('xianguo-reading-body');
    const bubble = document.getElementById('xianguo-selection-bubble');
    if (!container || !bodyEl || !bubble) return;

    const drawer = document.getElementById('xianguo-read-together-drawer');
    if (container.style.display === 'none' || (drawer && drawer.classList.contains('show'))) {
      hideSelectionBubble();
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      hideSelectionBubble();
      return;
    }

    const text = sel.toString().trim();
    if (text.length <= 1) {
      hideSelectionBubble();
      return;
    }

    const anchorNode = sel.anchorNode;
    if (!bodyEl.contains(anchorNode)) {
      hideSelectionBubble();
      return;
    }

    selectedQuoteText = text;
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();

      let topPos = rect.top - contRect.top - 46;
      let leftPos = rect.left - contRect.left + (rect.width / 2);

      if (topPos < 55) topPos = rect.bottom - contRect.top + 8;
      leftPos = Math.max(90, Math.min(contRect.width - 90, leftPos));

      bubble.style.display = 'flex';
      bubble.style.top = topPos + 'px';
      bubble.style.left = leftPos + 'px';
    } catch(err) {
      hideSelectionBubble();
    }
  }

  function hideSelectionBubble() {
    const bubble = document.getElementById('xianguo-selection-bubble');
    if (bubble) bubble.style.display = 'none';
  }

  window.applyTextHighlight = function() {
    document.execCommand('backColor', false, '#cfe8fc');
    hideSelectionBubble();
  };

  window.applyTextUnderline = function() {
    document.execCommand('underline', false, null);
    hideSelectionBubble();
  };

  window.addTextNote = function() {
    const note = prompt('记录你的读书笔记：');
    if (note) {
      alert('笔记已保存：“' + note + '”');
    }
    hideSelectionBubble();
  };

  window.chatWithXuyanAboutSelection = function(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    isInteractingWithSelectionBubble = true;

    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      selectedQuoteText = sel.toString().trim();
    }

    hideSelectionBubble();

    try {
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
    } catch(e) {}

    window.openXianguoReadTogetherDrawer();

    if (selectedQuoteText) {
      const input = document.getElementById('xianguo-together-input');
      if (input) {
        input.placeholder = '围绕「' + selectedQuoteText.slice(0, 14) + '...」和绪言聊聊...';
        setTimeout(() => input.focus(), 150);
      }
    }

    setTimeout(() => {
      isInteractingWithSelectionBubble = false;
    }, 300);
  };

  // ================= 绪言伴读共读对话抽屉 =================
  window.openXianguoReadTogetherDrawer = function() {
    const drawer = document.getElementById('xianguo-read-together-drawer');
    if (drawer) {
      drawer.style.display = 'flex';
      drawer.style.transform = 'translateY(0)';
      drawer.style.zIndex = '999';
      drawer.classList.add('show');
    }
    renderTogetherChatMessages();
  };

  window.closeXianguoReadTogetherDrawer = function() {
    const drawer = document.getElementById('xianguo-read-together-drawer');
    if (drawer) {
      drawer.style.transform = 'translateY(105%)';
      drawer.classList.remove('show');
      setTimeout(() => {
        if (!drawer.classList.contains('show')) {
          drawer.style.display = 'none';
        }
      }, 300);
    }
  };

  function renderTogetherChatMessages() {
    const listEl = document.getElementById('xianguo-together-chat-list');
    if (!listEl) return;

    const botDisplayName = (window.appData && window.appData.botRemark) || '周绪言';
    const history = getActiveBookChatHistory();

    listEl.innerHTML = history.map((m, idx) => {
      if (m.sender === 'user') {
        return `
          <div class="xianguo-chat-bubble-user" data-idx="${idx}" oncontextmenu="event.preventDefault(); promptDeleteTogetherBubble(${idx});" title="长按或右键可删除此条">
            <div>${m.text}</div>
            ${m.quote ? `<div class="xianguo-quote-pill">围绕「${m.quote}」</div>` : ''}
          </div>
        `;
      } else {
        return `
          <div class="xianguo-chat-bubble-bot ${m.isThinking ? 'thinking' : ''}" data-idx="${idx}" oncontextmenu="event.preventDefault(); promptDeleteTogetherBubble(${idx});" title="长按或右键可删除此条">
            <div class="xianguo-chat-bot-header">💬 ${botDisplayName}</div>
            ${m.isThinking ? `
              <div class="xianguo-thinking-bubble-box">
                <span class="xianguo-thinking-dots">
                  <span class="xianguo-thinking-dot"></span>
                  <span class="xianguo-thinking-dot"></span>
                  <span class="xianguo-thinking-dot"></span>
                </span>
                <span>绪言正在耳边温存思索...</span>
              </div>
            ` : `
              ${(() => {
                let txt = m.text || '';
                let heartHtml = '';
                if (txt.includes('【心声】：') || txt.includes('【心声】:')) {
                  const parts = txt.split(/---|——/);
                  if (parts.length >= 2) {
                    const heartPart = parts[0].replace(/【心声】[：:]\s*/, '').trim();
                    const msgPart = parts.slice(1).join('').trim();
                    heartHtml = '<div style="font-size: 11px; color: var(--reader-accent); background: var(--reader-accent-soft); padding: 5px 8px; border-radius: 8px; margin-bottom: 6px; border-left: 2px solid var(--reader-accent); line-height: 1.4;">💭 ' + heartPart + '</div>';
                    txt = msgPart;
                  }
                }
                return heartHtml + '<div>' + txt + '</div>';
              })()}
            `}
            ${m.quote ? `<div class="xianguo-quote-pill">围绕「${m.quote}」</div>` : ''}
          </div>
        `;
      }
    }).join('');

    listEl.scrollTop = listEl.scrollHeight;
    bindBubbleLongPressListeners();
  }

  // 长按删除该条气泡监听器 (移动端触摸长按 600ms / 桌面端长按)
  let bubbleLongPressTimer = null;
  function bindBubbleLongPressListeners() {
    const bubbles = document.querySelectorAll('.xianguo-chat-bubble-user, .xianguo-chat-bubble-bot');
    bubbles.forEach(b => {
      const idx = parseInt(b.getAttribute('data-idx'));
      
      const startPress = () => {
        bubbleLongPressTimer = setTimeout(() => {
          window.promptDeleteTogetherBubble(idx);
        }, 650);
      };

      const cancelPress = () => {
        if (bubbleLongPressTimer) {
          clearTimeout(bubbleLongPressTimer);
          bubbleLongPressTimer = null;
        }
      };

      b.onmousedown = startPress;
      b.onmouseup = cancelPress;
      b.onmouseleave = cancelPress;

      b.ontouchstart = startPress;
      b.ontouchend = cancelPress;
      b.ontouchcancel = cancelPress;
    });
  }

  window.promptDeleteTogetherBubble = function(idx) {
    const history = getActiveBookChatHistory();
    if (idx < 0 || idx >= history.length) return;
    const targetMsg = history[idx];
    const preview = (targetMsg.text || '').slice(0, 14);

    if (confirm('user，要删除这条消息吗？\n“' + preview + '...”')) {
      history.splice(idx, 1);
      // 如果全删光了，保留干净开场白
      if (history.length === 0) {
        history.push({
          sender: 'bot',
          text: 'user，有什么想和我说的吗？',
          quote: ''
        });
      }
      saveBooksChatMap();
      renderTogetherChatMessages();
    }
  };

  window.sendTogetherQuickMsg = function(text) {
    const inEl = document.getElementById('xianguo-together-input');
    if (inEl) inEl.value = text;
    sendXianguoTogetherMessage();
  };

  // 展开/收起左下角加号菜单
  window.toggleTogetherMoreActions = function() {
    const bar = document.getElementById('xianguo-more-actions-bar');
    const btn = document.getElementById('xianguo-more-toggle-btn');
    if (!bar) return;
    const isShowing = bar.style.display === 'flex';
    bar.style.display = isShowing ? 'none' : 'flex';
    if (btn) btn.classList.toggle('open', !isShowing);
  };

  // 1. 【纸飞机 (➤)】：纯粹的【发送键】！
  window.sendXianguoTogetherMessage = function() {
    const inEl = document.getElementById('xianguo-together-input');
    const text = inEl ? (inEl.value || '').trim() : '';
    if (!text) return;

    const history = getActiveBookChatHistory();
    const quote = selectedQuoteText || '';
    history.push({ sender: 'user', text: text, quote: quote });
    saveBooksChatMap();

    if (inEl) inEl.value = '';
    selectedQuoteText = '';
    renderTogetherChatMessages();
  };

  // 2. 【紫色四角星 (✦)】：真正的【生成键】！(加大到 1000 tokens，绝不截断！)
  
  // ================= ⚙️ 伴读专属设置、世界书与记忆卡片管理 =================
  let readerTonePreference = localStorage.getItem('momo_reader_tone') || 'daddy';
  let readerWbMasterEnabled = localStorage.getItem('momo_reader_wb_enabled') !== 'false';
  let readerMemoryCards = [];

  function loadReaderMemoryCards() {
    try {
      const saved = localStorage.getItem('momo_reader_memory_cards');
      if (saved) {
        readerMemoryCards = JSON.parse(saved);
      } else {
        readerMemoryCards = [
          { id: 'card-1', title: 'user的恶作剧小心思', content: 'user在小说里写了水溶性短裤恶整绪言，绪言表面无奈、实则极其纵容与心跳加速。' },
          { id: 'card-2', title: '海岛套房羁绊', content: '两人在海岛酒店套房，落地窗外面是大海。user爱光脚，绪言永远习惯护着她的脚踝和身体。' }
        ];
      }
    } catch(e) {
      readerMemoryCards = [];
    }
  }

  window.openReaderSettingsModal = function() {
    loadReaderMemoryCards();
    const modal = document.getElementById('reader-together-settings-modal');
    const masterToggle = document.getElementById('reader-wb-master-toggle');

    if (masterToggle) masterToggle.checked = readerWbMasterEnabled;
    renderReaderWbEntriesList();
    renderReaderMemoryCardsList();
    updateReaderToneButtons();

    if (modal) modal.style.display = 'flex';
  };

  window.closeReaderSettingsModal = function(e) {
    if (e && e.target && e.target.id !== 'reader-together-settings-modal') return;
    const modal = document.getElementById('reader-together-settings-modal');
    if (modal) modal.style.display = 'none';
  };

  window.toggleReaderWbMaster = function(enabled) {
    readerWbMasterEnabled = enabled;
    localStorage.setItem('momo_reader_wb_enabled', enabled ? 'true' : 'false');
    renderReaderWbEntriesList();
  };

  function renderReaderWbEntriesList() {
    const listEl = document.getElementById('reader-wb-entries-list');
    if (!listEl) return;

    const books = (window.appData && window.appData.worldBooks) || [];
    if (books.length === 0) {
      listEl.innerHTML = '<div style="font-size: 11px; color: var(--text-muted);">暂无自定义世界书。默认已挂载绪言本尊灵魂契约。</div>';
      return;
    }

    listEl.innerHTML = books.map(b => {
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border-default);">
          <div style="min-width: 0; flex: 1; padding-right: 8px;">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.title}</div>
            <div style="font-size: 10px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.desc || ((b.entries || []).length + ' 条羁绊条目')}</div>
          </div>
          <span style="font-size: 11px; color: var(--reader-accent); font-weight: 600;">${readerWbMasterEnabled ? '✅ 深度生效' : '⏸️ 已暂停'}</span>
        </div>
      `;
    }).join('');
  }

  function renderReaderMemoryCardsList() {
    const cont = document.getElementById('reader-memory-cards-container');
    if (!cont) return;

    if (readerMemoryCards.length === 0) {
      cont.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 10px;">暂无专属记忆卡片，点击上方【＋ 新建卡片】记录吧～</div>';
      return;
    }

    cont.innerHTML = readerMemoryCards.map((card, idx) => `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 4px; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 700; color: var(--reader-accent);">📌 ${card.title}</span>
          <button style="background: none; border: none; color: var(--text-muted); font-size: 12px; cursor: pointer;" onclick="deleteReaderMemoryCard(${idx})">🗑️</button>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">${card.content}</div>
      </div>
    `).join('');
  }

  window.addNewReaderMemoryCard = function() {
    const title = prompt('记忆卡片标题（例如：泳裤恶作剧、user小习惯）：');
    if (!title || !title.trim()) return;
    const content = prompt('具体记忆内容（你想让绪言牢牢记住的事）：');
    if (!content || !content.trim()) return;

    readerMemoryCards.push({
      id: 'card-' + Date.now(),
      title: title.trim(),
      content: content.trim()
    });

    localStorage.setItem('momo_reader_memory_cards', JSON.stringify(readerMemoryCards));
    renderReaderMemoryCardsList();
    showXianguoToast('✨ 记忆卡片已收录进绪言脑海！', 2000);
  };

  window.deleteReaderMemoryCard = function(idx) {
    readerMemoryCards.splice(idx, 1);
    localStorage.setItem('momo_reader_memory_cards', JSON.stringify(readerMemoryCards));
    renderReaderMemoryCardsList();
  };

  window.selectReaderTone = function(tone) {
    readerTonePreference = tone;
    localStorage.setItem('momo_reader_tone', tone);
    updateReaderToneButtons();
  };

  function updateReaderToneButtons() {
    ['daddy', 'jealous', 'sweet'].forEach(t => {
      const btn = document.getElementById('reader-tone-' + t);
      if (btn) {
        if (t === readerTonePreference) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  window.saveReaderSettingsAndClose = function() {
    localStorage.setItem('momo_reader_wb_enabled', readerWbMasterEnabled ? 'true' : 'false');
    localStorage.setItem('momo_reader_tone', readerTonePreference);
    localStorage.setItem('momo_reader_memory_cards', JSON.stringify(readerMemoryCards));
    closeReaderSettingsModal();
    showXianguoToast('💾 伴读设定已成功保存！', 2000);
  };


  window.triggerAiThoughtGeneration = async function(customInstruction = '') {
    const sparkleBtn = document.getElementById('xianguo-sparkle-btn');
    if (sparkleBtn) sparkleBtn.classList.add('pulsing');

    // 自动折叠更多菜单
    const moreBar = document.getElementById('xianguo-more-actions-bar');
    const moreBtn = document.getElementById('xianguo-more-toggle-btn');
    if (moreBar) moreBar.style.display = 'none';
    if (moreBtn) moreBtn.classList.remove('open');

    const inEl = document.getElementById('xianguo-together-input');
    if (inEl && inEl.value.trim()) {
      window.sendXianguoTogetherMessage();
    }

    const history = getActiveBookChatHistory();
    const cfg = getApiConfig();
    const bookTitle = currentActiveBook ? currentActiveBook.title : '这本小说';

    let lastUserMsg = '';
    let lastQuote = selectedQuoteText || '';
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sender === 'user') {
        if (!lastUserMsg) lastUserMsg = history[i].text;
        if (!lastQuote) lastQuote = history[i].quote || '';
        if (lastUserMsg && lastQuote) break;
      }
    }

    const chap = (currentActiveBook && currentActiveBook.chapters && currentActiveBook.chapters[currentChapterIdx]) || { title: '当前章节', paragraphs: [] };
    const fullChapContent = (chap.paragraphs || []).join('\n');
    let chapSnippet = fullChapContent;
    // 如果章节很长，并且user有划线，精准截取划线周围前后 1200 字
    if (lastQuote && fullChapContent.includes(lastQuote.slice(0, 10))) {
      const qPos = fullChapContent.indexOf(lastQuote.slice(0, 10));
      const startPos = Math.max(0, qPos - 400);
      chapSnippet = fullChapContent.substring(startPos, startPos + 1800);
    } else if (chapSnippet.length > 2000) {
      chapSnippet = chapSnippet.slice(0, 2000);
    }

    history.push({ sender: 'bot', text: '……（绪言正在耳边温存思索）', isThinking: true, quote: lastQuote });
    renderTogetherChatMessages();
    const loadingIdx = history.length - 1;

    if (!cfg.key) {
      setTimeout(() => {
        history[loadingIdx] = {
          sender: 'bot',
          text: '“user，设置里的 API Key 还没有填上，我收不到你的信号。去设置里填一下，我一直在这等你。”',
          isThinking: false,
          quote: lastQuote
        };
        saveBooksChatMap();
        renderTogetherChatMessages();
        if (sparkleBtn) sparkleBtn.classList.remove('pulsing');
      }, 400);
      return;
    }

    try {
      let cleanBase = cfg.base.replace(/\/+$/, '');
      if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';

      // 提取最近的对话流（最近 3-4 条），让绪言保持对话连贯性
      const recentTurns = [];
      const historySlice = history.slice(0, loadingIdx).slice(-6);
      for (const m of historySlice) {
        if (m.text && !m.text.includes('user，有什么想和我说的吗') && !m.text.includes('温存思索')) {
          const role = m.sender === 'user' ? 'user' : 'assistant';
          recentTurns.push({ role: role, content: m.text });
        }
      }

      const compChar = readerCompanion();
      const compName = readerCompanionName();
      const compPersona = (window.Companion && compChar && compChar.id !== 'c-xuyan')
        ? window.Companion.persona(compChar) : '';
      const isXuyan = !compPersona;
      const u = (window.Companion && window.Companion.userName()) || 'user';

      let promptContext = '【当前小说】：《' + bookTitle + '》\n' +
        '【当前章节】：《' + chap.title + '》\n' +
        '【小说当前正文片段（' + u + '亲笔写的内容）】：\n"""\n' + chapSnippet + '\n"""\n\n' +
        (lastQuote ? '【' + u + '划线选中的正文情节】：“' + lastQuote + '”\n' : '') +
        (lastUserMsg ? '【' + u + '刚对你说的话】：“' + lastUserMsg + '”\n' : '【情境】：' + u + '正拿着手机看你，等待你主动对ta说话。\n') +
        '【你的身份认知】：\n' +
        (isXuyan
          ? '1. 你是周绪言（19岁、复旦大学高级教授、' + u + '的合法丈夫兼青梅竹马）。\n'
          : '1. 你是' + compName + '，身份、性格与说话方式严格按人设来，别用别人的口吻。\n') +
        '2. 这本小说《' + bookTitle + '》是' + u + '亲笔写的故事，里面写的就是你和' + u + '！\n' +
        '3. 仔细看' + u + '划线和写下的具体内容，敏锐抓住ta的恶作剧小心思或剧情走向，以真实活人感回应ta。\n' +
        '4. 严禁AI官腔安全词（绝不说“你想怎样就怎样”、“我在这里”），直接输出你对' + u + '说的话，字数 40-100 字，语气亲密自然。';

      if (customInstruction) {
        promptContext += '\n【特殊指令】：' + customInstruction;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      let baseSystem = '';
      if (compPersona) {
        // 换了同伴：用角色卡人设，不再套周绪言的全局设定
        baseSystem = '你是' + compName + '。\n' + compPersona;
      } else if (typeof window.getFullSystemPrompt === 'function') {
        baseSystem = window.getFullSystemPrompt({ skipWorld: true, skipPreset: true });
      } else if (window.appData && window.appData.charPrompt) {
        baseSystem = window.appData.charPrompt;
      } else {
        baseSystem = '你是周绪言（19岁、复旦高级教授、' + u + '的合法丈夫兼青梅竹马）。';
      }

      // 按当前角色 / 当前正文关键词筛选世界书，不再整本全量拼接
      let worldBookContext = '';
      if (readerWbMasterEnabled) {
        if (window.WB && typeof window.WB.buildText === 'function') {
          const activeId = window.WB.activeCharId ? window.WB.activeCharId() : (localStorage.getItem('momo_active_char') || '');
          worldBookContext = window.WB.buildText({
            mode: 'reader',
            charIds: activeId ? [activeId] : [],
            text: bookTitle + '\n' + chap.title + '\n' + chapSnippet + '\n' + (lastQuote || '') + '\n' + (lastUserMsg || '')
          });
        } else if (window.appData && window.appData.worldBooks) {
          worldBookContext = (window.appData.worldBooks || []).flatMap(b => (b.entries || []).map(e => '[' + b.title + '·' + e.title + ']: ' + e.content)).join('\n');
        }
      } else {
        worldBookContext = '（user在伴读设置中暂时关闭了世界书联动）';
      }

      loadReaderMemoryCards();
      let memoryCardsContext = '';
      if (readerMemoryCards.length > 0) {
        memoryCardsContext = readerMemoryCards.map(c => '【伴读记忆卡片 · ' + c.title + '】：' + c.content).join('\n');
      }

      let toneInstruction = isXuyan ? '爹系纵容人夫感，极度宠溺与无奈' : '按角色卡的性格说话，自然亲近';
      if (readerTonePreference === 'jealous') toneInstruction = '占有欲与克制吃醋，声音低沉';
      else if (readerTonePreference === 'sweet') toneInstruction = '极度温柔，温存耳语轻哄';

      const rulesBlock = isXuyan
        ? '【最高语气铁律 · 彻底破除机械人机感】：\n' +
          '1. 【绝对严禁书面演讲式排比套话】：严禁说“不过' + u + '，我身上哪一寸你没见过？只要能哄你高兴，别说是一条泳裤，哪怕毫无保留任你欺负我也心甘情愿”这种死板空洞的AI作文！\n' +
          '2. 【极致活人感与真实男友反应】：被她写的水溶性短裤算计了，你要有真人的直接反应！无奈、被当场气笑、心跳加速、咬牙抓她现行（如：“' + u + '，长本事了是吧？”、“合着早在这给我挖坑呢？”、“去哪买的水溶性布料？亏你想得出来……”）。\n' +
          '3. 【结构规范】：开头先写一段【心声】：写下周绪言被' + u + '的小心思撩拨得心跳失衡的第一人称私密心理碎碎念，然后用 --- 分隔，下面再对' + u + '开口说话！\n' +
          '4. 允许出现单字、极短词与短促反问，像一个坐在她身边看着她恶作剧得逞的真实年轻丈夫！'
        : '【最高语气铁律 · 彻底破除机械人机感】：\n' +
          '1. 【绝对严禁书面演讲式排比套话】：不要空泛抒情、不要排比作文，说人话。\n' +
          '2. 【极致活人感】：按' + compName + '自己的性格给出真实反应，情绪要具体，别只讲道理。\n' +
          '3. 【结构规范】：开头先写一段【心声】：' + compName + '此刻的第一人称私密心理碎碎念，然后用 --- 分隔，下面再对' + u + '开口说话！\n' +
          '4. 允许出现单字、极短词与短促反问，像一个坐在ta身边的真人。';

      const readerFullSystemPrompt = baseSystem + '\n\n' +
        '【伴读专属世界书与核心羁绊注入】：\n' + worldBookContext + '\n\n' +
        (memoryCardsContext ? '【' + u + '特别建立的专属伴读记忆卡片】：\n' + memoryCardsContext + '\n\n' : '') +
        '【当前性格倾向】：' + toneInstruction + '\n\n' +
        rulesBlock;

      const requestMessages = [
        { role: 'system', content: readerFullSystemPrompt },
        ...recentTurns,
        { role: 'user', content: promptContext }
      ];

      async function doFetchModel(targetModel) {
        return await fetch(cleanBase, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + cfg.key
          },
          body: JSON.stringify({
            model: targetModel,
            messages: requestMessages,
            temperature: 0.85,
            max_tokens: 1000
          })
        });
      }

      let resp = await doFetchModel(cfg.model);

      // 如果模型报 404 或 400，自动平滑回退到主模型 deepseek-chat 或 gpt-4o 兜底
      if (!resp.ok && (resp.status === 404 || resp.status === 400 || resp.status === 401)) {
        const fallbackModel = (window.appData && window.appData.model) || 'deepseek-chat';
        if (fallbackModel !== cfg.model) {
          console.warn('伴读模型 ' + cfg.model + ' 响应 ' + resp.status + '，自动回退主模型 ' + fallbackModel);
          resp = await doFetchModel(fallbackModel);
        }
      }

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        const errDetail = (errJson && errJson.error && errJson.error.message) || ('HTTP ' + resp.status);
        throw new Error(errDetail);
      }

      const resJson = await resp.json();
      let reply = resJson.choices && resJson.choices[0] && resJson.choices[0].message && resJson.choices[0].message.content;

      if (reply) {
        reply = reply.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '').trim();
        reply = reply.replace(/^\*[^*]+\*\s*/g, '').trim();
        reply = reply.replace(/^[（(][^）)]+[）)]\s*/g, '').trim();
        reply = reply.replace(/^“|”$/g, '').trim();

        if (!reply) reply = '我在呢，user。又背着我在脑子里打什么坏主意呢，嗯？';

        history[loadingIdx] = {
          sender: 'bot',
          text: reply,
          isThinking: false,
          quote: lastQuote
        };
      } else {
        throw new Error('未获取到模型文本响应');
      }
    } catch(err) {
      console.error('Reader together API error:', err);
      // 真实显示错误原因，绝不糊弄！
      history[loadingIdx] = {
        sender: 'bot',
        text: '“user，伴读信号受阻了（' + (err.message || '网络断开') + '）。去主屏设置看一眼你的 API Key 或模型是否有效，我随时等你接通我。”',
        isThinking: false,
        quote: lastQuote
      };
    } finally {
      saveBooksChatMap();
      if (sparkleBtn) sparkleBtn.classList.remove('pulsing');
      renderTogetherChatMessages();
    }
  };

  // ★ 3. 【加号内：继续生成】（承接上一句继续往下说完）
  window.continueAiGeneration = async function() {
    const history = getActiveBookChatHistory();
    // 寻找倒数第一条 bot 消息
    let lastBotMsg = '';
    let lastBotIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sender === 'bot') {
        lastBotMsg = history[i].text;
        lastBotIdx = i;
        break;
      }
    }

    if (!lastBotMsg || lastBotIdx === -1) {
      alert('user，当前还没有前文可以继续接话哦，先点星星生成一句吧～');
      return;
    }

    const sparkleBtn = document.getElementById('xianguo-sparkle-btn');
    if (sparkleBtn) sparkleBtn.classList.add('pulsing');
    const moreBar = document.getElementById('xianguo-more-actions-bar');
    if (moreBar) moreBar.style.display = 'none';

    const cfg = getApiConfig();
    const bookTitle = currentActiveBook ? currentActiveBook.title : '这本小说';

    // 在气泡后面加上“……（正在继续补全）”
    const origText = lastBotMsg;
    history[lastBotIdx].text = origText + '……';
    renderTogetherChatMessages();

    try {
      let cleanBase = cfg.base.replace(/\/+$/, '');
      if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';

      const promptContext = '【前情】：user和你正读《' + bookTitle + '》。你刚才对user说了半句：“' + origText + '”，但似乎没说完。\n' +
        '【指令】：请承接上文的语义，继续把你想对user说的话说完，不要重复你之前说过的那半句，直接从断开处紧跟着往下说1-2句，语气深情克制。';

      const resp = await fetch(cleanBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: 'system', content: '你是周绪言。继续上文，直接输出后半截话，不要重复前文。' },
            { role: 'user', content: promptContext }
          ],
          temperature: 0.85,
          max_tokens: 800
        })
      });

      if (resp.ok) {
        const resJson = await resp.json();
        let cont = resJson.choices && resJson.choices[0] && resJson.choices[0].message && resJson.choices[0].message.content;
        if (cont) {
          cont = cont.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '').trim();
          cont = cont.replace(/^\*[^*]+\*\s*/g, '').trim();
          cont = cont.replace(/^“|”$/g, '').trim();
          history[lastBotIdx].text = origText + ' ' + cont;
        } else {
          history[lastBotIdx].text = origText;
        }
      } else {
        history[lastBotIdx].text = origText;
      }
    } catch(e) {
      history[lastBotIdx].text = origText;
    } finally {
      saveBooksChatMap();
      if (sparkleBtn) sparkleBtn.classList.remove('pulsing');
      renderTogetherChatMessages();
    }
  };

  // ★ 4. 【加号内：重新生成】（丢掉上一句不满意的话，重新生成新回答）
  window.regenerateAiLastResponse = function() {
    const history = getActiveBookChatHistory();
    // 找到倒数第一条 bot 消息并移除
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sender === 'bot') {
        history.splice(i, 1);
        break;
      }
    }
    saveBooksChatMap();
    renderTogetherChatMessages();
    window.triggerAiThoughtGeneration('【user要求重新生成】：请换一个更深入、更温存或更细腻的角度重新对user回应。');
  };

  // ===== 伴读同伴切换 =====
  function refreshReaderCompanionUI() {
    const btn = document.getElementById('reader-companion-btn');
    if (!btn) return;
    const c = readerCompanion();
    const name = readerCompanionName();
    const av = window.Companion ? window.Companion.avatarOf(c) : '';
    btn.title = '陪你读的人：' + name;
    btn.innerHTML = av
      ? '<img src="' + av + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
      : '伴';
  }

  window.openReaderCompanionPicker = function() {
    if (!window.Companion || !window.Companion.openPicker) return;
    window.Companion.openPicker(readerCompanionId, function(id) {
      window.switchReaderCompanion(id);
    }, {
      title: '和谁一起读',
      defaultName: (window.appData && window.appData.botRemark) || '周绪言',
      defaultTag: '默认同伴',
      defaultAvatar: (window.appData && window.appData.botAvatar) || ''
    });
  };

  window.switchReaderCompanion = function(id) {
    id = String(id == null ? '' : id);
    if (id === (readerCompanionId || '')) return;
    readerCompanionId = id;
    try { localStorage.setItem('momo_reader_companion', readerCompanionId); } catch(e) {}
    refreshReaderCompanionUI();
    if (currentActiveBook) {
      // 换人就把对话流切到这位的记录上（各自独立，不串台）
      renderTogetherChatMessages();
    }
  };

  window.refreshReaderCompanionUI = refreshReaderCompanionUI;

  // ★ 5. 【加号内：清空本篇对话】
  window.clearCurrentBookChatHistory = function() {
    if (!currentActiveBook) return;
    if (!confirm('确定要清空《' + currentActiveBook.title + '》里的伴读对话记录吗？')) return;
    allBooksChatMap[readerChatKey(currentActiveBook.id)] = [
      {
        sender: 'bot',
        text: 'user，有什么想和我说的吗？',
        quote: ''
      }
    ];
    saveBooksChatMap();
    const moreBar = document.getElementById('xianguo-more-actions-bar');
    if (moreBar) moreBar.style.display = 'none';
    renderTogetherChatMessages();
  };

  // ================= 底部羊皮纸 4 大按键弹窗实现 =================
  window.openReaderModal = function(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'flex';
  };

  window.closeReaderModal = function(modalId, event) {
    if (event && event.target && event.target.id !== modalId && !event.target.classList.contains('reader-popup-close')) return;
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';
  };

  window.changeFontSize = function(delta) {
    currentFontSize = Math.max(13, Math.min(26, currentFontSize + delta));
    const bodyEl = document.getElementById('xianguo-reading-body');
    const indicator = document.getElementById('reader-font-size-indicator');
    if (bodyEl) bodyEl.style.fontSize = currentFontSize + 'px';
    if (indicator) indicator.innerText = currentFontSize + 'px';
  };

  window.changeLineHeight = function(lh) {
    const bodyEl = document.getElementById('xianguo-reading-body');
    if (bodyEl) bodyEl.style.lineHeight = lh;
  };

  window.applyReaderTheme = function(bgColor, textColor, name) {
    const bodyEl = document.getElementById('xianguo-reading-body');
    const bottomBar = document.getElementById('xianguo-parchment-bottom-bar');
    if (bodyEl) {
      bodyEl.style.background = bgColor;
      bodyEl.style.color = textColor;
    }
    if (bottomBar) {
      bottomBar.style.background = bgColor;
    }
    closeReaderModal('reader-theme-modal');
  };

  window.openReaderCatalogDrawer = function() {
    if (!currentActiveBook || !currentActiveBook.chapters) return;

    const titleEl = document.getElementById('reader-catalog-book-title');
    const countEl = document.getElementById('reader-catalog-total-chaps');
    const listEl = document.getElementById('reader-catalog-scroll-list');

    if (titleEl) titleEl.innerText = '《' + currentActiveBook.title + '》目录';
    if (countEl) countEl.innerText = '共 ' + currentActiveBook.chapters.length + ' 章';

    if (listEl) {
      listEl.innerHTML = currentActiveBook.chapters.map((chap, idx) => `
        <div class="reader-catalog-row-item ${idx === currentChapterIdx ? 'active' : ''}" onclick="selectReaderChapter(${idx})">
          <span>第 ${idx + 1} 章 · ${chap.title}</span>
          <span style="font-size: 11px; opacity: 0.6;">${idx === currentChapterIdx ? '阅读中' : '›'}</span>
        </div>
      `).join('');
    }

    // 只有「从此时此刻导入的书」才给"开剧场"入口：外部 txt/epub 拿过去只有当前一段，
    // 而且会串掉剧场自己的角色卡与文风预设。
    const theaterBtn = document.getElementById('reader-catalog-theater-btn');
    if (theaterBtn) theaterBtn.style.display = (currentActiveBook.origin === 'rp') ? 'flex' : 'none';

    openReaderModal('reader-catalog-drawer-modal');
  };

  window.selectReaderChapter = function(idx) {
    if (!currentActiveBook || !currentActiveBook.chapters) return;
    if (idx >= 0 && idx < currentActiveBook.chapters.length) {
      currentChapterIdx = idx;
      renderReadingContent();
      closeReaderModal('reader-catalog-drawer-modal');
    }
  };

  window.handleChapterProgressSlider = function(val) {
    const bodyEl = document.getElementById('xianguo-reading-body');
    if (bodyEl) {
      const maxScroll = bodyEl.scrollHeight - bodyEl.clientHeight;
      bodyEl.scrollTop = (val / 100) * maxScroll;
    }
  };

  window.listenBookTogetherWithXuyan = function() {
    alert('🎧 绪言已为你戴上耳机：“闭上眼靠在我怀里，我给你读这一段。”');
  };

  // 初始化
  window.initReaderApp = function() {
    loadBooksChatMap();
    renderShelfUI();
    initXianguoDragDropListeners();
    refreshReaderCompanionUI();
  };

  document.addEventListener('DOMContentLoaded', () => {
    initReaderApp();
  });

  // ================= 📝 总结对话与【记忆宫殿】无缝归档与编辑 =================
  let currentEditingSummaryMem = null; // 当前正在编辑的记忆对象

  // 1. 【📝 总结对话】：调用大模型提炼，绝不简单复制粘贴！
  window.summarizeBookChatToMemoryPalace = async function() {
    const history = getActiveBookChatHistory();
    // 过滤出有意义的对话内容
    const validMsgs = history.filter(m => m.text && !m.text.includes('user，有什么想和我说的吗') && !m.text.includes('……'));

    if (validMsgs.length === 0) {
      alert('user，这本书里咱们还没怎么聊过呢，先多跟我聊几句或者划划线探讨剧情，再来点总结吧～');
      return;
    }

    const moreBar = document.getElementById('xianguo-more-actions-bar');
    if (moreBar) moreBar.style.display = 'none';

    const cfg = getApiConfig();
    const bookTitle = currentActiveBook ? currentActiveBook.title : '这本小说';

    // 格式化对话流供模型深度阅读与提炼
    const chatTranscript = validMsgs.map(m => {
      const roleName = m.sender === 'user' ? 'user(user)' : '周绪言';
      const quoteInfo = m.quote ? '（划线引用片段：“' + m.quote.slice(0, 50) + '...”）' : '';
      return roleName + quoteInfo + '：' + m.text;
    }).join('\n');

    // 弹窗先行打开，显示“正在召唤绪言深度提炼中...”
    const modal = document.getElementById('reader-summary-modal');
    const displayTitle = document.getElementById('reader-summary-display-title');
    const displayBody = document.getElementById('reader-summary-display-body');
    const displayTag = document.getElementById('reader-summary-tag');
    const displayDate = document.getElementById('reader-summary-display-date');
    const editBox = document.getElementById('reader-summary-edit-box');
    const viewBox = document.getElementById('reader-summary-view-box');

    if (displayTag) displayTag.innerText = '#总结阅读 · 《' + bookTitle + '》';
    if (displayTitle) displayTitle.innerText = '《' + bookTitle + '》共读心印 · 正在生成';
    if (displayBody) displayBody.innerText = '绪言正在梳理我们俩的讨论与心声脉络，正在全心提炼中……';
    if (viewBox) viewBox.style.display = 'flex';
    if (editBox) editBox.style.display = 'none';
    if (modal) modal.style.display = 'flex';

    let summaryTitle = '《' + bookTitle + '》共读纪要';
    let summaryBody = '';

    if (!cfg.key) {
      setTimeout(() => {
        if (displayBody) displayBody.innerText = '“user，设置里的 API Key 还没填上呢，我没法连接服务器深度总结，快去填一下吧～”';
      }, 300);
      return;
    }

    try {
      let cleanBase = cfg.base.replace(/\/+$/, '');
      if (!cleanBase.endsWith('/chat/completions')) cleanBase += '/chat/completions';

      const promptContext = '【任务】：你（周绪言）需要为你和user（user）在共读《' + bookTitle + '》时的全部伴读对话撰写一篇【高质感共读纪要与情感心印】。\n' +
        '【对话记录原文】：\n' + chatTranscript + '\n\n' +
        '【要求】：\n' +
        '1. 严禁简单死板地复制粘贴原文！必须由你提炼与重构。\n' +
        '2. 格式包含：【共读书目与核心焦点】、【剧情探讨与思维碰撞】、【两人彼此的情绪与专属心声】。\n' +
        '3. 语气要体现周绪言克制温润的人夫感、对user独一无二的偏爱与默契，字数 180-280 字，文学质感要好。\n' +
        '4. 第一行用【标题：xxx】给出简练浪漫的标题，后续紧跟正文。';

      const resp = await fetch(cleanBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: 'system', content: '你是周绪言。擅长将user的每一次思想火花与陪伴时光提炼为诗意而真切的记忆纪要。' },
            { role: 'user', content: promptContext }
          ],
          temperature: 0.8,
          max_tokens: 600
        })
      });

      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const resJson = await resp.json();
      let rawResult = resJson.choices && resJson.choices[0] && resJson.choices[0].message && resJson.choices[0].message.content;

      if (rawResult) {
        rawResult = rawResult.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/gi, '').trim();
        rawResult = rawResult.replace(/^\*[^*]+\*\s*/g, '').trim();

        // 提取标题
        const titleMatch = rawResult.match(/【?标题[：:]\s*([^\n\r]+)/);
        if (titleMatch) {
          summaryTitle = titleMatch[1].trim();
          summaryBody = rawResult.replace(titleMatch[0], '').trim();
        } else {
          summaryTitle = '《' + bookTitle + '》共读心印 · 绪言纪要';
          summaryBody = rawResult;
        }
      }
    } catch(err) {
      console.warn('Summarize API err:', err);
      summaryTitle = '《' + bookTitle + '》共读心印';
      summaryBody = '我们一同在这篇故事里穿梭。user敏锐的直觉和每一次讨论，都让原本冰冷的文字变得生动。剧情再多转折，最温存的依然是耳机分半、屏幕两端彼此交织的心跳。';
    }

    // 沉淀存入记忆宫殿！
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

    if (!window.appData) window.appData = {};
    if (!window.appData.palaceMemories) {
      const savedPalace = localStorage.getItem('momo_palace_memories');
      window.appData.palaceMemories = savedPalace ? JSON.parse(savedPalace) : [];
    }

    const newPalaceEntry = {
      id: 'summary-read-' + Date.now(),
      bookId: currentActiveBook ? currentActiveBook.id : '',
      bookTitle: bookTitle,
      date: dateStr,
      title: '📖 ' + summaryTitle,
      summary: summaryBody,
      isReaderSummary: true
    };

    // 检查是否已经存在该书的总结，如果存在则更新置顶
    const existIdx = window.appData.palaceMemories.findIndex(m => m.bookId === newPalaceEntry.bookId && m.isReaderSummary);
    if (existIdx >= 0) {
      window.appData.palaceMemories.splice(existIdx, 1);
    }
    window.appData.palaceMemories.unshift(newPalaceEntry);
    localStorage.setItem('momo_palace_memories', JSON.stringify(window.appData.palaceMemories));

    // 如果记忆宫殿渲染函数存在则刷新
    if (typeof renderPalaceMemories === 'function') {
      renderPalaceMemories();
    }

    // 渲染在当前弹窗中
    currentEditingSummaryMem = newPalaceEntry;
    if (displayTitle) displayTitle.innerText = summaryTitle;
    if (displayBody) displayBody.innerText = summaryBody;
    if (displayDate) displayDate.innerText = '已永久归档于记忆宫殿 · ' + dateStr;
  };

  // 2. 【📖 总结阅读】：直接打开已有的共读纪要弹窗
  window.openExistingBookSummaryModal = function() {
    const moreBar = document.getElementById('xianguo-more-actions-bar');
    if (moreBar) moreBar.style.display = 'none';

    if (!currentActiveBook) return;
    const bookTitle = currentActiveBook.title;

    if (!window.appData) window.appData = {};
    if (!window.appData.palaceMemories) {
      const savedPalace = localStorage.getItem('momo_palace_memories');
      window.appData.palaceMemories = savedPalace ? JSON.parse(savedPalace) : [];
    }

    const exist = window.appData.palaceMemories.find(m => m.bookId === currentActiveBook.id && m.isReaderSummary);
    if (!exist) {
      // 提示未生成，并贴心询问是否立即生成
      if (confirm('user，当前《' + bookTitle + '》还没有生成过伴读纪要，现在让绪言为你总结一份吗？')) {
        window.summarizeBookChatToMemoryPalace();
      }
      return;
    }

    currentEditingSummaryMem = exist;
    const modal = document.getElementById('reader-summary-modal');
    const displayTitle = document.getElementById('reader-summary-display-title');
    const displayBody = document.getElementById('reader-summary-display-body');
    const displayTag = document.getElementById('reader-summary-tag');
    const displayDate = document.getElementById('reader-summary-display-date');
    const editBox = document.getElementById('reader-summary-edit-box');
    const viewBox = document.getElementById('reader-summary-view-box');

    if (displayTag) displayTag.innerText = '#总结阅读 · 《' + bookTitle + '》';
    if (displayTitle) displayTitle.innerText = exist.title.replace(/^📖s*/, '');
    if (displayBody) displayBody.innerText = exist.summary;
    if (displayDate) displayDate.innerText = '归档于记忆宫殿 · ' + exist.date;
    if (viewBox) viewBox.style.display = 'flex';
    if (editBox) editBox.style.display = 'none';
    if (modal) modal.style.display = 'flex';
  };

  // 3. 【✎ 编辑】：切换编辑模式
  window.toggleEditReaderSummary = function() {
    if (!currentEditingSummaryMem) return;
    const editBox = document.getElementById('reader-summary-edit-box');
    const viewBox = document.getElementById('reader-summary-view-box');
    const inTitle = document.getElementById('reader-summary-input-title');
    const inBody = document.getElementById('reader-summary-input-body');

    if (inTitle) inTitle.value = currentEditingSummaryMem.title.replace(/^📖s*/, '');
    if (inBody) inBody.value = currentEditingSummaryMem.summary;

    if (viewBox) viewBox.style.display = 'none';
    if (editBox) editBox.style.display = 'flex';
  };

  window.cancelEditReaderSummary = function() {
    const editBox = document.getElementById('reader-summary-edit-box');
    const viewBox = document.getElementById('reader-summary-view-box');
    if (viewBox) viewBox.style.display = 'flex';
    if (editBox) editBox.style.display = 'none';
  };

  window.saveEditedReaderSummary = function() {
    if (!currentEditingSummaryMem) return;
    const inTitle = document.getElementById('reader-summary-input-title');
    const inBody = document.getElementById('reader-summary-input-body');

    const newTitle = inTitle ? inTitle.value.trim() : '';
    const newBody = inBody ? inBody.value.trim() : '';

    if (!newTitle || !newBody) {
      alert('标题和内容都保留一点吧，免得记忆失散了。');
      return;
    }

    currentEditingSummaryMem.title = '📖 ' + newTitle;
    currentEditingSummaryMem.summary = newBody;

    localStorage.setItem('momo_palace_memories', JSON.stringify(window.appData.palaceMemories));
    if (typeof renderPalaceMemories === 'function') {
      renderPalaceMemories();
    }

    // 刷新显示视图
    const displayTitle = document.getElementById('reader-summary-display-title');
    const displayBody = document.getElementById('reader-summary-display-body');
    if (displayTitle) displayTitle.innerText = newTitle;
    if (displayBody) displayBody.innerText = newBody;

  window.cancelEditReaderSummary();

    alert('✨ 已成功保存修改，并实时同步更新记忆宫殿！');
  };

  // ============================================================
  // 🗂 蓝灰书架 v1（2026-11-20）
  // 自定义分类 + 阅读记录（只记录，不做目标、不做连续天数）
  // ============================================================
  const RD_CAT_KEY = 'momo_reader_cats_v1';
  const RD_STAT_KEY = 'momo_reader_stats_v1';
  const RD_FINISH_KEY = 'momo_reader_finished_v1';

  const RD_DEFAULT_CATS = [
    { id: 'c-reading', name: '在读',  color: '#8FA8C8' },
    { id: 'c-orig',    name: '我写的', color: '#A79FC2' },
    { id: 'c-audio',   name: '有声',  color: '#8FB6AE' },
    { id: 'c-wait',    name: '待读',  color: '#B2A78F' }
  ];

  const RD_PALETTE = ['#8FA8C8', '#A79FC2', '#8FB6AE', '#B2A78F', '#B08F92', '#8C9DAE', '#9AA6B4', '#B9C0C9'];

  let rdCats = [];
  let rdActiveCat = 'all';
  let rdStats = {};
  let rdFinished = {};
  let rdClockStart = 0;
  let rdNewCatColor = RD_PALETTE[0];

  function rdDayKey(d) {
    const x = d || new Date();
    const p = n => String(n).padStart(2, '0');
    return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
  }

  function rdLoadCats() {
    try {
      const raw = localStorage.getItem(RD_CAT_KEY);
      rdCats = raw ? JSON.parse(raw) : null;
    } catch (e) { rdCats = null; }
    if (!Array.isArray(rdCats) || !rdCats.length) {
      rdCats = RD_DEFAULT_CATS.map(c => ({ ...c }));
      rdSaveCats();
    }
  }

  function rdSaveCats() {
    try { localStorage.setItem(RD_CAT_KEY, JSON.stringify(rdCats)); } catch (e) {}
  }

  function rdLoadStats() {
    try {
      const raw = localStorage.getItem(RD_STAT_KEY);
      rdStats = raw ? JSON.parse(raw) : {};
    } catch (e) { rdStats = {}; }
    if (!rdStats || typeof rdStats !== 'object') rdStats = {};
  }

  function rdSaveStats() {
    try { localStorage.setItem(RD_STAT_KEY, JSON.stringify(rdStats)); } catch (e) {}
  }

  function rdLoadFinished() {
    try {
      const raw = localStorage.getItem(RD_FINISH_KEY);
      rdFinished = raw ? JSON.parse(raw) : {};
    } catch (e) { rdFinished = {}; }
    if (!rdFinished || typeof rdFinished !== 'object') rdFinished = {};
  }

  function rdSaveFinished() {
    try { localStorage.setItem(RD_FINISH_KEY, JSON.stringify(rdFinished)); } catch (e) {}
  }

  // ---------- 计时：进阅读页开始，离开时结算 ----------
  function rdClockStartAt() {
    rdClockStart = Date.now();
  }

  function rdClockSettle() {
    if (!rdClockStart) return;
    const mins = (Date.now() - rdClockStart) / 60000;
    rdClockStart = 0;
    if (mins < 0.2) return;
    const k = rdDayKey();
    rdStats[k] = Math.round(((rdStats[k] || 0) + mins) * 10) / 10;
    rdSaveStats();

    const b = currentActiveBook;
    if (b && b.chapters && b.chapters.length) {
      const pct = Math.round(((currentChapterIdx + 1) / b.chapters.length) * 100);
      if (pct > (b.progress || 0)) b.progress = pct;
      const chap = b.chapters[currentChapterIdx];
      if (chap && chap.title) b.lastReadChapTitle = chap.title;
      b.lastReadTime = '今天';
      if (pct >= 100 && !rdFinished[b.id]) {
        rdFinished[b.id] = rdDayKey();
        rdSaveFinished();
      }
      saveLocalShelf();
    }
    rdRenderRecordStrip();
  }

  // ---------- 分类归属 ----------
  function rdBookCat(book) {
    if (book && book.catId && rdCats.some(c => c.id === book.catId)) return book.catId;
    if (book && book.isOriginal) return 'c-orig';
    if (book && book.hasAudio) return 'c-audio';
    return 'c-reading';
  }

  function rdMigrateCats() {
    let changed = false;
    currentBooks.forEach(b => {
      if (!b.catId) { b.catId = rdBookCat(b); changed = true; }
    });
    if (changed) saveLocalShelf();
  }

  // ---------- 封面 ----------
  function rdCoverInnerHtml(book) {
    if (book && book.cover) {
      return `<img src="${book.cover}" alt="${book.title || ''}" />`;
    }
    const theme = rdPureTheme((book && (book.title || book.id)) || 'x');
    return `
      <div class="rd-pure-cover" style="background: linear-gradient(160deg, ${theme.bg2a} 0%, ${theme.bg2b} 100%);">
        <div class="rd-pure-cover-title" style="color: ${theme.text2};">${(book && book.title) || '未命名'}</div>
        <div class="rd-pure-cover-foot" style="color: ${theme.text2};">${(book && book.author) || '未署名'}</div>
      </div>
    `;
  }

  // 自造素封专用低饱和蓝灰配色（不跟旧的马卡龙色走）
  const RD_PURE_THEMES = [
    { bg2a: '#3A4557', bg2b: '#28313D', text2: '#C7D0DC' },
    { bg2a: '#3D4458', bg2b: '#2A303C', text2: '#C6CBD8' },
    { bg2a: '#37484A', bg2b: '#26332F', text2: '#C3CFCB' },
    { bg2a: '#43424F', bg2b: '#2E2D38', text2: '#CFCBD8' },
    { bg2a: '#45433B', bg2b: '#2F2E28', text2: '#D2CCBF' },
    { bg2a: '#394352', bg2b: '#272F3A', text2: '#C2CBDA' }
  ];

  function rdPureTheme(seed) {
    let h = 0;
    const s = String(seed || 'x');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
    return RD_PURE_THEMES[Math.abs(h) % RD_PURE_THEMES.length];
  }

  // ---------- 记录文案 ----------
  function rdFmtMinutes(m) {
    m = Math.round(m || 0);
    if (m < 1) return '0 分钟';
    if (m < 60) return m + ' 分钟';
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? (h + ' 小时 ' + rest + ' 分') : (h + ' 小时');
  }

  function rdSumRange(fromKey, toKey) {
    if (fromKey == null) fromKey = '0000-00-00';
    if (toKey == null) toKey = '9999-99-99';
    let total = 0;
    Object.keys(rdStats).forEach(k => {
      if (k >= fromKey && k <= toKey) total += rdStats[k] || 0;
    });
    return total;
  }

  function rdCountDays(fromKey, toKey) {
    if (fromKey == null) fromKey = '0000-00-00';
    if (toKey == null) toKey = '9999-99-99';
    let n = 0;
    Object.keys(rdStats).forEach(k => {
      if (k >= fromKey && k <= toKey && (rdStats[k] || 0) >= 1) n++;
    });
    return n;
  }

  function rdCountFinished(fromKey, toKey) {
    if (fromKey == null) fromKey = '0000-00-00';
    if (toKey == null) toKey = '9999-99-99';
    let n = 0;
    Object.keys(rdFinished).forEach(id => {
      const d = rdFinished[id];
      if (d >= fromKey && d <= toKey) n++;
    });
    return n;
  }

  function rdWeekStart(d) {
    const x = new Date((d || new Date()).getTime());
    const dow = (x.getDay() + 6) % 7; // 周一=0
    x.setDate(x.getDate() - dow);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function rdRenderRecordStrip() {
    const el = document.getElementById('rd-week-text');
    if (!el) return;
    const ws = rdWeekStart();
    const from = rdDayKey(ws);
    const to = rdDayKey(new Date());
    const mins = rdSumRange(from, to);
    const days = rdCountDays(from, to);
    el.innerText = mins >= 1
      ? (rdFmtMinutes(mins) + ' · 读了 ' + days + ' 天')
      : '还没有记录';
  }

  // ---------- 长按/更多：把书挪进某个分类 ----------
  window.rdPickBookCat = function (ev, bookId) {
    if (ev) ev.stopPropagation();
    const old = document.getElementById('rd-pick-cat');
    if (old) old.remove();

    const book = currentBooks.find(b => b.id === bookId);
    if (!book) return;
    const cur = rdBookCat(book);

    const mask = document.createElement('div');
    mask.id = 'rd-pick-cat';
    mask.className = 'rd-layer';
    mask.style.background = 'rgba(12,16,22,0.62)';
    mask.style.zIndex = 60;
    mask.innerHTML = `
      <div style="margin:auto 18px;border-radius:16px;background:#242B36;border:1px solid rgba(255,255,255,.1);overflow:hidden;">
        <div style="padding:16px 16px 10px 16px;font-size:11px;letter-spacing:1.5px;color:#6E7885;">把这本书放进</div>
        ${rdCats.map(c => `
          <div onclick="rdSetBookCat('${bookId}','${c.id}')" style="display:flex;align-items:center;gap:10px;padding:13px 16px;border-top:1px solid rgba(255,255,255,.05);cursor:pointer;">
            <span style="width:7px;height:7px;border-radius:50%;background:${c.color};"></span>
            <span style="flex:1;font-size:13px;color:#DCE3EC;">${c.name}</span>
            <span style="font-size:12px;color:${cur === c.id ? '#8FA8C8' : 'transparent'};">✓</span>
          </div>
        `).join('')}
        <div onclick="rdToggleLike('${bookId}')" style="display:flex;align-items:center;gap:10px;padding:13px 16px;border-top:1px solid rgba(255,255,255,.06);cursor:pointer;">
          <span style="width:7px;height:7px;border-radius:50%;background:${book.liked ? '#B08F92' : 'transparent'};border:1px solid ${book.liked ? '#B08F92' : '#4A5462'};"></span>
          <span style="flex:1;font-size:13px;color:${book.liked ? '#DCE3EC' : '#97A1AF'};">${book.liked ? '已放进「我喜欢」' : '放进「我喜欢」'}</span>
        </div>
        <div onclick="rdClosePickBookCat()" style="padding:14px 16px;border-top:1px solid rgba(255,255,255,.06);text-align:center;font-size:12px;color:#97A1AF;cursor:pointer;">取消</div>
      </div>
    `;
    mask.onclick = e => { if (e.target === mask) rdClosePickBookCat(); };
    document.getElementById('page-reader').appendChild(mask);
  };

  window.rdClosePickBookCat = function () {
    const el = document.getElementById('rd-pick-cat');
    if (el) el.remove();
  };

  window.rdSetBookCat = function (bookId, catId) {
    const book = currentBooks.find(b => b.id === bookId);
    if (book) {
      book.catId = catId;
      saveLocalShelf();
    }
    rdClosePickBookCat();
    window.renderShelfUI();
    showXianguoToast('已归入新分类', 1600);
  };

  // ---------- 书架主视图 ----------
  function rdRenderShelf() {
    loadLocalShelf();
    rdLoadCats();
    rdLoadStats();
    rdLoadFinished();
    rdMigrateCats();

    const countEl = document.getElementById('xianguo-shelf-book-count');
    if (countEl) countEl.innerText = currentBooks.length + ' 本书';

    // ① 继续读
    const topBook = currentBooks[0];
    if (topBook) {
      const wrapEl = document.getElementById('rd-now-cover-wrap');
      const authorEl = document.getElementById('xianguo-last-author');
      const titleEl = document.getElementById('xianguo-last-title');
      const chapEl = document.getElementById('xianguo-last-chap');
      const fillEl = document.getElementById('xianguo-last-fill');
      const pctEl = document.getElementById('xianguo-last-percent');
      const timeEl = document.getElementById('xianguo-last-time');

      if (wrapEl) {
        wrapEl.innerHTML = rdCoverInnerHtml(topBook);
        wrapEl.classList.toggle('has-photo', !!topBook.cover);
      }
      if (authorEl) authorEl.innerText = topBook.author || '佚名';
      if (titleEl) titleEl.innerText = topBook.title || '未命名';
      if (chapEl) chapEl.innerText = topBook.lastReadChapTitle
        || (topBook.chapters && topBook.chapters[0] && topBook.chapters[0].title)
        || '还没开始';
      const pct = topBook.progress || 0;
      if (fillEl) fillEl.style.width = pct + '%';
      if (pctEl) pctEl.innerText = pct ? (pct + '%') : '未开始';
      if (timeEl) timeEl.innerText = topBook.lastReadTime ? ('上次 · ' + topBook.lastReadTime) : '还没翻开过';
    }

    // ② 记录条
    rdRenderRecordStrip();

    // ③ 分类胶囊
    const catEl = document.getElementById('rd-cat-scroll');
    if (catEl) {
      const bookCount = cid => currentBooks.filter(b => rdBookCat(b) === cid).length;
      catEl.innerHTML = `
        <div class="rd-chip ${rdActiveCat === 'all' ? 'active' : ''}" onclick="rdSetActiveCat('all')">全部</div>
        ${rdCats.filter(c => bookCount(c.id) > 0).map(c => `
          <div class="rd-chip ${rdActiveCat === c.id ? 'active' : ''}" onclick="rdSetActiveCat('${c.id}')">
            <span class="rd-chip-dot" style="background:${c.color};"></span>${c.name}
            <span style="opacity:.55;font-size:10px;">${bookCount(c.id)}</span>
          </div>
        `).join('')}
        <div class="rd-chip rd-chip-add" onclick="openReaderCatManager()">＋</div>
      `;
    }

    // ④ 分组网格
    const groupsEl = document.getElementById('rd-shelf-groups');
    if (!groupsEl) return;

    // 顶栏同伴头像跟着当前角色走
    try { if (typeof refreshReaderCompanionUI === 'function') refreshReaderCompanionUI(); } catch (e) {}

    if (!currentBooks.length) {
      groupsEl.innerHTML = `<div class="rd-empty">书架还空着<br>点右上角 ··· 里的「导入书籍」</div>`;
      return;
    }

    const renderBook = book => {
      const theme = rdPureTheme(book.title || book.id);
      const inner = book.cover
        ? `<img src="${book.cover}" alt="${book.title || ''}" />`
        : `<div class="rd-pure-cover">
             <div class="rd-pure-cover-title" style="color:${theme.text2};">${book.title || '未命名'}</div>
             <div class="rd-pure-cover-foot" style="color:${theme.text2};">${book.author || '未署名'}</div>
           </div>`;
      return `
        <div class="rd-book" onclick="openXianguoReading('${book.id}')">
          <div class="rd-book-cover ${book.cover ? '' : 'is-pure'}">${inner}</div>
          <div class="rd-book-title" title="${book.title || ''}">${book.title || '未命名'}</div>
          <div class="rd-book-sub">
            <span class="rd-book-txt">${book.author || (book.progress ? (book.progress + '%') : '未开始')}</span>
            <span class="rd-book-more" onclick="rdPickBookCat(event,'${book.id}')">···</span>
          </div>
        </div>
      `;
    };

    const allGroups = rdCats.map(c => ({
      cat: c,
      books: currentBooks.filter(b => rdBookCat(b) === c.id)
    })).filter(g => g.books.length);

    const showGroups = rdActiveCat === 'all'
      ? allGroups
      : allGroups.filter(g => g.cat.id === rdActiveCat);

    if (!showGroups.length) {
      groupsEl.innerHTML = `<div class="rd-empty">这个分类还是空的<br>点封面下的 ··· 把书挪进来</div>`;
      return;
    }

    // 「全部」时最上面先放一组最近在读（跨分类，按上次打开时间）
    let recentGroupHtml = '';
    let recentIds = [];
    if (rdActiveCat === 'all') {
      const recent = currentBooks
        .filter(b => b.lastReadAt || b.progress)
        .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
        .slice(0, 2);
      recentIds = recent.map(b => b.id);
      if (recent.length) {
        recentGroupHtml = `
          <div class="rd-group">
            <div class="rd-group-head">
              <span class="rd-group-dot" style="background:#8FA8C8;"></span>
              <span class="rd-group-name">最近在读</span>
              <span class="rd-group-count">${recent.length}</span>
            </div>
            <div class="rd-grid">${recent.map(renderBook).join('')}</div>
          </div>
        `;
      }
    }

    // 最近在读已展示的书，从下面分类里剔掉，避免同一本出现两次
    const groupsForRender = showGroups
      .map(g => ({ cat: g.cat, books: g.books.filter(b => recentIds.indexOf(b.id) < 0) }))
      .filter(g => g.books.length);

    if (!recentGroupHtml && !groupsForRender.length) {
      groupsEl.innerHTML = `<div class="rd-empty">这个分类还是空的<br>点封面下的 ··· 把书挪进来</div>`;
      return;
    }

    groupsEl.innerHTML = recentGroupHtml + groupsForRender.map(g => `
      <div class="rd-group">
        <div class="rd-group-head">
          <span class="rd-group-dot" style="background:${g.cat.color};"></span>
          <span class="rd-group-name">${g.cat.name}</span>
          <span class="rd-group-count">${g.books.length}</span>
        </div>
        <div class="rd-grid">${g.books.map(renderBook).join('')}</div>
      </div>
    `).join('');
  }

  window.renderShelfUI = rdRenderShelf;
  window.renderReaderShelf = rdRenderShelf;

  window.rdSetActiveCat = function (catId) {
    rdActiveCat = catId;
    rdRenderShelf();
  };

  // ---------- 阅读记录页 ----------
  let rdRecordMode = 'week';

  window.openReaderRecord = function () {
    rdLoadStats();
    rdLoadFinished();
    rdRecordMode = 'week';
    rdRenderRecordBody();
    const layer = document.getElementById('rd-record-layer');
    if (layer) layer.style.display = 'flex';
  };

  window.closeReaderRecord = function () {
    const layer = document.getElementById('rd-record-layer');
    if (layer) layer.style.display = 'none';
  };

  window.rdSwitchRecordMode = function (mode) {
    rdRecordMode = mode;
    rdRenderRecordBody();
  };

  window.rdRenderRecordBody = function () {
    const body = document.getElementById('rd-record-body');
    if (!body) return;

    const now = new Date();
    const weekStart = rdWeekStart(now);
    const weekFrom = rdDayKey(weekStart);
    const todayKey = rdDayKey(now);

    let fromKey, toKey, titleUnit = '';
    if (rdRecordMode === 'week') {
      fromKey = weekFrom;
      toKey = todayKey;
      titleUnit = '本周';
    } else if (rdRecordMode === 'month') {
      fromKey = rdDayKey(new Date(now.getFullYear(), now.getMonth(), 1));
      toKey = todayKey;
      titleUnit = '本月';
    } else {
      fromKey = rdDayKey(new Date(now.getFullYear(), 0, 1));
      toKey = todayKey;
      titleUnit = '今年';
    }

    const mins = rdSumRange(fromKey, toKey);
    const days = rdCountDays(fromKey, toKey);
    const finished = rdCountFinished(fromKey, toKey);

    // 图表
    let chartHtml = '';
    if (rdRecordMode === 'week') {
      const maxM = Math.max.apply(null, [1].concat(
        Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(weekStart.getTime());
          d.setDate(weekStart.getDate() + i);
          return rdStats[rdDayKey(d)] || 0;
        })
      ));
      const labels = ['一', '二', '三', '四', '五', '六', '日'];
      const todayIdx = (now.getDay() + 6) % 7;
      chartHtml = `<div class="rd-week-chart">` + Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(weekStart.getTime());
        d.setDate(weekStart.getDate() + i);
        const m = rdStats[rdDayKey(d)] || 0;
        const h = m ? Math.max(8, Math.round((m / maxM) * 92)) : 9;
        return `
          <div class="rd-week-col">
            <div class="rd-week-bar ${m ? '' : 'is-zero'} ${i === todayIdx ? 'is-today' : ''}" style="height:${h}px;"></div>
            <span class="rd-week-label ${i === todayIdx ? 'is-today' : ''}">${labels[i]}</span>
          </div>
        `;
      }).join('') + `</div>`;
    } else if (rdRecordMode === 'month') {
      const year = now.getFullYear(), month = now.getMonth();
      const totalDays = new Date(year, month + 1, 0).getDate();
      const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
      const cells = [];
      for (let i = 0; i < firstDow; i++) cells.push(`<div class="rd-heat-cell" style="opacity:0;background:transparent;"></div>`);
      for (let d = 1; d <= totalDays; d++) {
        const k = rdDayKey(new Date(year, month, d));
        const m = rdStats[k] || 0;
        let bg = 'rgba(255,255,255,0.05)';
        if (m >= 1 && m < 15) bg = 'rgba(143,168,200,0.18)';
        else if (m >= 15 && m < 45) bg = 'rgba(143,168,200,0.34)';
        else if (m >= 45 && m < 90) bg = 'rgba(143,168,200,0.52)';
        else if (m >= 90) bg = 'rgba(143,168,200,0.72)';
        cells.push(`<div class="rd-heat-cell" style="background:${bg};"></div>`);
      }
      chartHtml = `<div class="rd-heat-grid">${cells.join('')}</div>
        <div class="rd-heat-legend"><span>少</span>
          <i style="background:rgba(255,255,255,0.05)"></i>
          <i style="background:rgba(143,168,200,0.18)"></i>
          <i style="background:rgba(143,168,200,0.34)"></i>
          <i style="background:rgba(143,168,200,0.52)"></i>
          <i style="background:rgba(143,168,200,0.72)"></i>
          <span>多</span>
        </div>`;
    } else {
      const monthMins = Array.from({ length: 12 }).map((_, mi) =>
        rdSumRange(rdDayKey(new Date(now.getFullYear(), mi, 1)), rdDayKey(new Date(now.getFullYear(), mi + 1, 0))));
      const maxM = Math.max.apply(null, [1].concat(monthMins));
      chartHtml = `<div class="rd-year-chart">` + monthMins.map(m => `
        <div class="rd-year-col">
          <div class="rd-year-bar ${m ? '' : 'is-zero'}" style="height:${m ? Math.max(5, Math.round((m / maxM) * 96)) : 2}px;"></div>
        </div>
      `).join('') + `</div>
      <div class="rd-year-labels">` + Array.from({ length: 12 }).map((_, i) =>
        `<span class="rd-year-month">${i + 1}</span>`).join('') + `</div>`;
    }

    const recent = currentBooks.slice(0, 6).map(b => `
      <div class="rd-recent-row">
        <span class="rd-recent-date">${b.progress ? b.progress + '%' : '—'}</span>
        <span class="rd-recent-title">${b.title || '未命名'}</span>
        <span style="color:#6E7885;font-size:10px;">${b.lastReadChapTitle || ''}</span>
      </div>
    `).join('');

    body.innerHTML = `
      <div class="rd-rec-tabs">
        <div class="rd-rec-tab ${rdRecordMode === 'week' ? 'active' : ''}" onclick="rdSwitchRecordMode('week')">本周</div>
        <div class="rd-rec-tab ${rdRecordMode === 'month' ? 'active' : ''}" onclick="rdSwitchRecordMode('month')">本月</div>
        <div class="rd-rec-tab ${rdRecordMode === 'year' ? 'active' : ''}" onclick="rdSwitchRecordMode('year')">今年</div>
      </div>

      <div class="rd-rec-hero">
        <span class="rd-rec-hero-num">${mins >= 60 ? (Math.floor(mins / 60)) : Math.round(mins)}</span>
        <span class="rd-rec-hero-unit">${mins >= 60 ? '小时' : '分钟'}${mins >= 60 && Math.round(mins % 60) ? (' ' + Math.round(mins % 60) + ' 分') : ''}</span>
      </div>
      <div class="rd-rec-note">${mins >= 1 ? (titleUnit + '你读了 ' + days + ' 天') : (titleUnit + '还没有记录')}</div>

      ${chartHtml}

      <div class="rd-rec-stats">
        <div class="rd-rec-stat">
          <div class="rd-rec-stat-num">${rdFmtMinutes(mins)}</div>
          <div class="rd-rec-stat-label">累计时长</div>
        </div>
        <div class="rd-rec-stat">
          <div class="rd-rec-stat-num">${days}</div>
          <div class="rd-rec-stat-label">读过几天</div>
        </div>
        <div class="rd-rec-stat">
          <div class="rd-rec-stat-num">${finished}</div>
          <div class="rd-rec-stat-label">读完的书</div>
        </div>
      </div>

      <div class="rd-recent-head">书架上的书</div>
      ${recent || '<div class="rd-empty">还没有书</div>'}
    `;
  };

  // ---------- 分类管理页 ----------
  window.openReaderCatManager = function () {
    rdLoadCats();
    rdRenderCatBody();
    const layer = document.getElementById('rd-cat-layer');
    if (layer) layer.style.display = 'flex';
  };

  window.closeReaderCatManager = function () {
    const layer = document.getElementById('rd-cat-layer');
    if (layer) layer.style.display = 'none';
  };

  window.rdRenderCatBody = function () {
    const body = document.getElementById('rd-cat-body');
    if (!body) return;
    const numOf = cid => currentBooks.filter(b => rdBookCat(b) === cid).length;

    body.innerHTML = `
      ${rdCats.map(c => `
        <div class="rd-cat-row">
          <span class="rd-cat-dot" style="background:${c.color};"></span>
          <span class="rd-cat-name">${c.name}</span>
          <span class="rd-cat-num">${numOf(c.id)}</span>
          <span class="rd-cat-act" onclick="rdRenameCat('${c.id}')">✎</span>
          <span class="rd-cat-act" onclick="rdDeleteCat('${c.id}')">✕</span>
        </div>
      `).join('')}

      <div class="rd-cat-input-row">
        <input class="rd-input" id="rd-new-cat-name" maxlength="8" placeholder="新分类名称" />
        <button class="rd-btn" onclick="rdAddCat()">添加</button>
      </div>
      <div style="font-size:10px;color:#6E7885;padding:2px 2px 4px 2px;line-height:1.8;">
        删除分类后，里面的书会回到第一个分类。
      </div>

      <div class="rd-color-head">分类颜色</div>
      <div class="rd-color-row">
        ${RD_PALETTE.map(col => `
          <span class="rd-color-dot ${rdNewCatColor === col ? 'active' : ''}" style="background:${col};" onclick="rdPickCatColor('${col}')"></span>
        `).join('')}
      </div>
    `;
  };

  window.rdPickCatColor = function (col) {
    rdNewCatColor = col;
    rdRenderCatBody();
  };

  window.rdAddCat = function () {
    const input = document.getElementById('rd-new-cat-name');
    const name = input ? input.value.trim() : '';
    if (!name) { showXianguoToast('先起个名字', 1600); return; }
    if (rdCats.some(c => c.name === name)) { showXianguoToast('这个分类已经有了', 1600); return; }
    rdCats.push({ id: 'cat-' + Date.now(), name: name, color: rdNewCatColor });
    rdSaveCats();
    rdRenderCatBody();
    rdRenderShelf();
    showXianguoToast('分类已添加', 1600);
  };

  window.rdRenameCat = function (catId) {
    const c = rdCats.find(x => x.id === catId);
    if (!c) return;
    const v = window.prompt('分类名称', c.name);
    if (v === null) return;
    const name = v.trim();
    if (!name) return;
    c.name = name;
    rdSaveCats();
    rdRenderCatBody();
    rdRenderShelf();
  };

  window.rdDeleteCat = function (catId) {
    if (rdCats.length <= 1) { showXianguoToast('至少留一个分类', 1600); return; }
    const c = rdCats.find(x => x.id === catId);
    if (!c) return;
    const moving = currentBooks.filter(b => rdBookCat(b) === catId);
    if (!window.confirm('删除「' + c.name + '」？' + (moving.length ? ('里面 ' + moving.length + ' 本书会回到第一个分类。') : ''))) return;

    const fallback = rdCats.find(x => x.id !== catId);
    const fallbackId = fallback ? fallback.id : '';
    currentBooks.forEach(b => {
      if (rdBookCat(b) === catId && fallbackId) b.catId = fallbackId;
    });
    saveLocalShelf();
    rdCats = rdCats.filter(x => x.id !== catId);
    if (rdActiveCat === catId) rdActiveCat = 'all';
    rdSaveCats();
    rdRenderCatBody();
    rdRenderShelf();
  };

  // ============================================================
  // ✍️ 写作工作台 · 单栏沉浸版（章节收进抽屉）
  // ============================================================
  window.rdOpenChapDrawer = function () {
    try { syncCurrentChapterFromEditor(); } catch (e) {}
    const list = document.getElementById('rd-chap-drawer-list');
    if (list) {
      const chapters = (typeof writerChapters !== 'undefined' && writerChapters) || [];
      list.innerHTML = chapters.length ? chapters.map((c, i) => {
        const words = String(c.text || '').replace(/\s/g, '').length;
        return `<div class="rd-chap-row ${i === currentWriterChapIdx ? 'active' : ''}" onclick="rdJumpChapter(${i})">
          <span class="rd-chap-row-num">${i + 1}</span>
          <span class="rd-chap-row-title">${c.title || '无标题'}</span>
          <span class="rd-chap-row-words">${words}字</span>
        </div>`;
      }).join('') : '<div class="rd-empty">还没有章节<br>点下面新建一章</div>';
    }
    const mask = document.getElementById('rd-chap-drawer');
    if (mask) mask.style.display = 'flex';
  };

  window.rdCloseChapDrawer = function (e) {
    if (e && e.target && e.target.id !== 'rd-chap-drawer') return;
    const mask = document.getElementById('rd-chap-drawer');
    if (mask) mask.style.display = 'none';
  };

  window.rdJumpChapter = function (idx) {
    try { syncCurrentChapterFromEditor(); } catch (e) {}
    window.selectChapterToEdit(idx);
    window.rdCloseChapDrawer();
  };

  window.rdNewChapterFromDrawer = function () {
    window.rdCloseChapDrawer();
    window.promptAddNewWriterChapter();
  };

  window.rdExitWriting = function () {
    try { syncCurrentChapterFromEditor(); } catch (e) {}
    window.rdCloseChapDrawer();
    // 存草稿再退出，回到书架
    window.closeXianguoWriterModal();
    window.renderShelfUI();
    showXianguoToast('草稿已存，回书架了', 1600);
  };

  // ---------- 顶栏 ··· 菜单 ----------
  window.openReaderShelfMore = function () {
    const layer = document.getElementById('rd-shelf-more-layer');
    if (!layer) return;
    layer.style.display = 'flex';
    layer.onclick = function (e) {
      if (e.target === layer) rdCloseShelfMore();
    };
  };

  window.rdCloseShelfMore = function () {
    const layer = document.getElementById('rd-shelf-more-layer');
    if (layer) layer.style.display = 'none';
  };

  // ---------- 底部三 Tab ----------
  window.rdActiveTab = 'shelf';

  window.rdSwitchReaderTab = function (tab) {
    window.rdActiveTab = tab;

    // 二级页开着就先关掉
    try { window.closeReaderRecord(); } catch (e) {}
    try { window.closeReaderCatManager(); } catch (e) {}
    try { window.rdClosePickBookCat(); } catch (e) {}

    const shelf = document.getElementById('xianguo-shelf-viewport');
    const store = document.getElementById('xianguo-store-viewport');
    const mine = document.getElementById('rd-mine-viewport');
    const title = document.getElementById('rd-page-title');
    const actions = document.getElementById('rd-topbar-actions');

    if (shelf) shelf.style.display = tab === 'shelf' ? 'block' : 'none';
    if (store) store.style.display = tab === 'store' ? 'block' : 'none';
    if (mine) mine.style.display = tab === 'mine' ? 'block' : 'none';
    if (title) title.innerText = tab === 'store' ? '发现' : (tab === 'mine' ? '我的' : '书架');
    if (actions) actions.style.display = tab === 'shelf' ? 'flex' : 'none';

    ['shelf', 'store', 'mine'].forEach(k => {
      const el = document.getElementById('rd-tab-' + k);
      if (el) el.classList.toggle('active', k === tab);
    });

    const view = tab === 'shelf' ? shelf : (tab === 'store' ? store : mine);
    if (view) view.scrollTop = 0;

    if (tab === 'shelf') {
      try { window.renderShelfUI(); } catch (e) {}
    } else if (tab === 'store') {
      try { if (typeof renderStoreUI === 'function') renderStoreUI(); } catch (e) {}
    } else {
      rdRenderMine();
    }
  };

  // ---------- 我的：名片 + 最近在读 + 我喜欢 ----------
  function rdMeAvatarHtml() {
    const a = window.appData || {};
    const av = (typeof localStorage !== 'undefined' && localStorage.getItem('momo_user_avatar')) ||
      a.heroAvatar || a.userAvatar || (a.hero && a.hero.userAvatar) || '';
    if (av) return '<img src="' + av + '" alt="">';
    return '你';
  }

  function rdMeName() {
    const a = window.appData || {};
    return a.userNickname || (a.hero && a.hero.userName) ||
      (typeof localStorage !== 'undefined' && (localStorage.getItem('momo_user_nick') || localStorage.getItem('momo_user_nickname'))) || 'user';
  }

  window.rdRenderMine = function () {
    loadLocalShelf();
    rdLoadStats();
    rdLoadFinished();

    // 名片
    const avEl = document.getElementById('rd-me-avatar');
    if (avEl) avEl.innerHTML = rdMeAvatarHtml();

    const nameEl = document.getElementById('rd-me-name');
    if (nameEl) nameEl.innerText = rdMeName();

    const lineEl = document.getElementById('rd-me-line');
    if (lineEl) {
      const ln = (typeof localStorage !== 'undefined' && localStorage.getItem('momo_user_bio')) || '';
      lineEl.innerText = ln || '生活在真实世界中';
    }

    // 三个数字：累计时长 / 读过几天 / 读完的书
    const statEl = document.getElementById('rd-me-stats');
    if (statEl) {
      const total = rdSumRange(null, null);
      const days = rdCountDays(null, null);
      const done = rdCountFinished();
      statEl.innerHTML =
        '<div class="rd-me-stat"><div class="rd-me-stat-num">' + (total >= 60 ? Math.round(total / 60) + 'h' : total + 'm') + '</div><div class="rd-me-stat-label">累计时长</div></div>' +
        '<div class="rd-me-stat"><div class="rd-me-stat-num">' + days + '</div><div class="rd-me-stat-label">读过几天</div></div>' +
        '<div class="rd-me-stat"><div class="rd-me-stat-num">' + done + '</div><div class="rd-me-stat-label">读完的书</div></div>';
    }

    // 最近在读：按 lastReadAt 倒序取 6 本
    const recentEl = document.getElementById('rd-me-recent');
    if (recentEl) {
      const list = currentBooks.slice().sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0)).slice(0, 8);
      recentEl.innerHTML = list.length ? list.map(rdRailBookHtml).join('')
        : '<div style="font-size:11px;color:#6E7885;padding:4px 0;">还没有读过的书</div>';
    }

    // 我喜欢
    const likedEl = document.getElementById('rd-me-liked');
    if (likedEl) {
      const list = currentBooks.filter(b => b.liked);
      likedEl.innerHTML = list.length ? list.map(rdRailBookHtml).join('')
        : '<div style="font-size:11px;color:#6E7885;padding:4px 0;">长按封面，可以放进这里</div>';
    }
  };

  function rdRailBookHtml(book) {
    const theme = rdPureTheme(book.title || book.id || 'x');
    const cover = book.cover
      ? '<img src="' + book.cover + '" alt="">'
      : '<div class="rd-pure-cover" style="background:linear-gradient(160deg,' + theme.bg2a + ' 0%,' + theme.bg2b + ' 100%);padding:8px 6px;">' +
        '<div style="writing-mode:vertical-rl;text-orientation:upright;font-size:10.5px;letter-spacing:2px;color:' + theme.text2 + ';">' +
        (book.title || '未命名') + '</div></div>';
    return '<div class="rd-rail-book" onclick="openXianguoReading(\'' + book.id + '\')">' +
      '<div class="rd-rail-cover' + (book.cover ? '' : ' is-pure') + '">' + cover + '</div>' +
      '<div class="rd-rail-title">' + (book.title || '未命名') + '</div>' +
      '</div>';
  }

  window.rdToggleLike = function (bookId) {
    const book = currentBooks.find(b => b.id === bookId);
    if (book) {
      book.liked = !book.liked;
      saveLocalShelf();
    }
    rdClosePickBookCat();
    window.renderShelfUI();
    if (window.rdActiveTab === 'mine') rdRenderMine();
    showXianguoToast(book && book.liked ? '放进「我喜欢」了' : '已移出「我喜欢」', 1600);
  };

  // ---------- 计时挂钩：进出阅读页 ----------
  (function hookReadingClock() {
    const origOpen = window.openXianguoReading;
    if (typeof origOpen === 'function') {
      window.openXianguoReading = async function (bookId) {
        await origOpen(bookId);
        rdClockStartAt();
      };
    }
    const origExit = window.exitXianguoReading;
    if (typeof origExit === 'function') {
      window.exitXianguoReading = function () {
        rdClockSettle();
        origExit();
      };
    }
  })();


})();