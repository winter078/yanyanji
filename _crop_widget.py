from pathlib import Path
from PIL import Image

src = Path(r"D:\xwechat_files\wxid_7ujmg4dnyuja22_0d2a\temp\RWTemp\2026-11\011193bfb21844ae448e90a6ada19a0f.jpg")
out = Path(r"C:\Users\29531\Documents\Codex\2026-09-15\project-context-md-1-18-codex\outputs\_widget_sample3.jpg")

with Image.open(src) as im:
    im.crop((214, 478, 214 + 756, 478 + 320)).save(out, quality=92)

print(out)
