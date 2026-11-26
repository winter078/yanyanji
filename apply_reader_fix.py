# -*- coding: utf-8 -*-
import os

ROOT = os.path.dirname(os.path.abspath(__file__))


def replace_once(rel, old, new):
    path = os.path.join(ROOT, rel)
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s: expected 1 match, got %d' % (rel, count))
    text = text.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


name_fn = """  function readerCompanionName() {
    return window.Companion ? window.Companion.displayName(readerCompanion()) : '周绪言';
  }
"""

helper = """  function readerCompanionAvatar() {
    const c = readerCompanion();
    if (window.Companion) {
      const av = window.Companion.avatarOf(c);
      if (av) return av;
    }
    // 默认同伴才回落到主角色头像，避免换到没头像的角色时还顶着上一个人的脸
    return c ? '' : ((window.appData && window.appData.botAvatar) || localStorage.getItem('momo_bot_avatar') || '');
  }

  // 阅读页里的「角色伴读」卡片：名字、脸、副标题都要跟着当前同伴走
  function refreshReaderCompanionHeader() {
    const name = readerCompanionName();
    const nameEl = document.getElementById('xianguo-together-name');
    if (nameEl) nameEl.innerText = name;

    const avatarEl = document.getElementById('xianguo-together-avatar');
    if (avatarEl) {
      const av = readerCompanionAvatar();
      if (av) {
        avatarEl.src = av;
        avatarEl.style.visibility = '';
      } else {
        avatarEl.removeAttribute('src');
        avatarEl.style.visibility = 'hidden';
      }
    }

    const subEl = document.getElementById('xianguo-together-sub');
    if (subEl && currentActiveBook) {
      subEl.innerText = name + '和你一起读《' + currentActiveBook.title + '》· 防剧透';
    }
  }
"""

replace_once('js/media/reader.js', name_fn, name_fn + '\n' + helper)

old_block = """    const container = document.getElementById('xianguo-reading-container');
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
"""

new_block = """    const container = document.getElementById('xianguo-reading-container');
    const badge = document.getElementById('xianguo-reading-book-badge');

    if (badge) badge.innerText = book.title;
    refreshReaderCompanionHeader();

    if (container) container.style.display = 'flex';
"""

replace_once('js/media/reader.js', old_block, new_block)
replace_once(
    'js/media/reader.js',
    "    const botDisplayName = (window.appData && window.appData.botRemark) || '周绪言';\n",
    "    const botDisplayName = readerCompanionName();\n"
)
replace_once(
    'js/media/reader.js',
    """    btn.innerHTML = av
      ? '<img src="' + av + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
      : '伴';
""",
    """    btn.innerHTML = av
      ? '<img src="' + av + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
      : (String(name).charAt(0) || '伴');
"""
)
replace_once(
    'js/media/reader.js',
    """    refreshReaderCompanionUI();
    if (currentActiveBook) {
""",
    """    refreshReaderCompanionUI();
    refreshReaderCompanionHeader();
    if (currentActiveBook) {
"""
)

entry = """    {
      build: '20261126-0036',
      title: '一起读换人后，名字和头像会跟着变',
      items: [
        '阅读页右上角的伴读头像可以直接换人；换完阅读页里的伴读名字、头像和「和谁一起读」都会立刻更新到新角色。',
        '一起读对话里的角色名也会跟着换，不再一直顶着原来的名字。',
        '换到没有头像的角色时，会显示名字首字，不再看起来像没切换。'
      ]
    },
"""
marker = "    {\n      build: '20261126-0035',"
path = os.path.join(ROOT, 'js/app-changelog.js')
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()
if "build: '20261126-0036'" not in text:
    if text.count(marker) != 1:
        raise SystemExit('app-changelog marker not unique')
    text = text.replace(marker, entry + marker, 1)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)

replace_once('js/build.js', 'window.__LIVE_BUILD__="20261126-0035";\n', 'window.__LIVE_BUILD__="20261126-0036";\n')
replace_once('phone.html', 'js/media/reader.js?v=20261120-2235', 'js/media/reader.js?v=20261126-0036a')

print('reader companion fix applied')
