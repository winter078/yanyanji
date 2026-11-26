from pathlib import Path

p = Path('js/prompt-presets.js')
s = p.read_text(encoding='utf-8')
old = "if (order) entry.enabled = orderMap[row.key] === true;"
if old not in s:
    raise SystemExit('target not found')
s = s.replace(old, "// order 里的 enabled 不再替用户默认关闭；导入后先全部打开。")
p.write_text(s, encoding='utf-8')
print('patched')
