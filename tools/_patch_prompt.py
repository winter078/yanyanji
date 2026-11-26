from pathlib import Path


def edit(path, pairs):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        if old not in s:
            msg = 'missing in ' + path + ': ' + old[:30]
            raise SystemExit(msg)
        s = s.replace(old, new, 1)
    p.write_text(s, encoding='utf-8', newline='\n')


prompt = Path('js/prompt-presets.js')
s = prompt.read_text(encoding='utf-8')

old = (
    "      tags: normalizeTagList(preset.tags),\n"
    "      entries: entries,"
)
new = (
    "      tags: normalizeTagList(preset.tags),\n"
    "      builtinsUnlockedOnce:"
    " preset.builtinsUnlockedOnce === true,\n"
    "      entries: entries,"
)
s = s.replace(old, new, 1)

func = (
    "  // 旧版酒馆导入默认关过一批内置；这里只迁移一次。\n"
    "  function unlockChatBuiltinsOnce() {\n"
    "    let changed = false;\n"
    "    presets.forEach(function(preset) {\n"
    "      if (preset.scope !== 'chat') return;\n"
    "      if (preset.builtinsUnlockedOnce) return;\n"
    "      (preset.entries || []).forEach("
    "function(entry) {\n"
    "        if (entry.kind !== 'builtin') return;\n"
    "        if (entry.enabled !== false) return;\n"
    "        entry.enabled = true;\n"
    "        changed = true;\n"
    "      });\n"
    "      preset.builtinsUnlockedOnce = true;\n"
    "      changed = true;\n"
    "    });\n"
    "    if (changed) {\n"
    "      localStorage.setItem("
    "K_PRESETS, JSON.stringify(presets));\n"
    "    }\n"
    "  }\n"
)
anchor = "  ensureScenePreset('forum');\n"
s = s.replace(
    anchor,
    anchor + func + "  unlockChatBuiltinsOnce();\n",
    1)

reload_old = (
    "  ensureScenePreset('forum');\n"
    "  renderSettings();"
)
reload_new = (
    "  ensureScenePreset('forum');\n"
    "  unlockChatBuiltinsOnce();\n"
    "  renderSettings();"
)
s = s.replace(reload_old, reload_new, 1)

start = s.index("    // 酒馆预设自带 system/main/jailbreak")
end = s.index(
    "    const order = sillyTavernOrder(raw);", start)
s = s[:start] + "    // 导入时不再替用户关闭任何内置。\n" + s[end:]

tag_old = (
    "    preset.tags = normalizeTagList("
    "styleOnly ? ['酒馆文风'] : ['酒馆导入']);\n"
    "    return preset;"
)
tag_new = (
    "    preset.tags = normalizeTagList("
    "styleOnly ? ['酒馆文风'] : ['酒馆导入']);\n"
    "    preset.builtinsUnlockedOnce = true;\n"
    "    return preset;"
)
if tag_old not in s:
    raise SystemExit('missing import tag block')
s = s.replace(tag_old, tag_new, 1)
prompt.write_text(s, encoding='utf-8', newline='\n')

wb = Path('js/theater/worldbooks.js')
s = wb.read_text(encoding='utf-8')
s = s.replace(
    'var MAX_WORLD_CHARS = 9000;',
    'var MAX_WORLD_CHARS = 30000;', 1)
block = (
    "    if (!keywords.length && !constant) {\n"
    "      toast('至少写一个关键词，或者把这条设为常驻');\n"
    "      return;\n"
    "    }\n"
)
s = s.replace(block, '', 1)
s = s.replace(
    "        if (!e.constant && !keywordHit("
    "e.keywords, text)) continue;\n",
    '', 1)
s = s.replace(
    '（世界书较长，后面的条目已省略）',
    '（世界书超过 3 万字，后面的条目已省略；可在世界书里关掉不需要的条目）', 1)
s = s.replace('【世界书 · 按当前场景与关键词筛选】', '【世界书 · 全量】')
wb.write_text(s, encoding='utf-8', newline='\n')

html = Path('phone.html')
s = html.read_text(encoding='utf-8')
s = s.replace(
    '<label>关键词（逗号分隔，命中才注入）</label>',
    '<label>关键词（可选，仅用于整理和搜索）</label>', 1)
s = s.replace(
    '<div class="wb-modal-hint">用专有名词、昵称、地点、物件；'
    '别写“我 / 你 / 今天”这种每句都有的词。</div>',
    '<div class="wb-modal-hint">所有开启的条目都会注入；'
    '关键词不再决定是否出现。</div>', 1)
s = s.replace('<b>常驻</b>', '<b>常驻优先</b>', 1)
s = s.replace(
    '<span>每轮都带上，适合身份、底线、口头禅。每本 2–4 条就够。</span>',
    '<span>只影响排序：常驻条目排在最前。'
    '所有开启的条目每轮都会带上。</span>', 1)
html.write_text(s, encoding='utf-8', newline='\n')

if '命中才注入' in s:
    raise SystemExit('phone hint not replaced')
if '<b>常驻</b>' in s:
    raise SystemExit('phone constant label not replaced')
print('patched')
