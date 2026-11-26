from pathlib import Path

# js/build.js
p = Path('js/build.js')
s = p.read_text(encoding='utf-8')
old = 'window.__LIVE_BUILD__="20261126-0046";'
new = 'window.__LIVE_BUILD__="20261127-0047a";'
if old not in s:
    raise SystemExit('build.js target not found')
p.write_text(s.replace(old, new), encoding='utf-8')

# phone.html: 只改构建号和两个脚本 query，不动其他内容
p = Path('phone.html')
s = p.read_text(encoding='utf-8')
repls = [
    ('<script>window.__BUILD__="20261126-0046";</script>', '<script>window.__BUILD__="20261127-0047a";</script>'),
    ('js/prompt-presets.js?v=20261126-0045c', 'js/prompt-presets.js?v=20261127-0047a'),
    ('js/theater/worldbooks.js?v=20261126-0046e', 'js/theater/worldbooks.js?v=20261127-0047a'),
]
for old, new in repls:
    if old not in s:
        raise SystemExit('phone.html target not found: ' + old)
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')

# prompt-presets.js: 数据从 IndexedDB 迟到时也再跑一次一次性解锁
p = Path('js/prompt-presets.js')
s = p.read_text(encoding='utf-8')
old = "    ensureScenePreset('forum');\n    renderSettings();"
new = "    ensureScenePreset('forum');\n    unlockChatBuiltinsOnce();\n    renderSettings();"
if old not in s:
    raise SystemExit('prompt-presets target not found')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('patched 0047a')
