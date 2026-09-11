#!/usr/bin/env python3
"""Bundle the dependency-free game into one offline HTML file."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent
src = ROOT / "src"
html = (src / "index.html").read_text(encoding="utf-8")
for marker, filename in {"STYLE": "style.css", "ENGINE": "engine.js", "WEAPONS": "weapons.js", "GAME": "game.js", "UI": "ui.js"}.items():
    content = (src / filename).read_text(encoding="utf-8")
    html = html.replace("/*__" + marker + "__*/", content)
output = ROOT / "NeonSpud.html"
output.write_text(html, encoding="utf-8")
print(f"Built {output.name}: {output.stat().st_size:,} bytes")
