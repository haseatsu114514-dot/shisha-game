"""Expand '&' in stage_src.css to the full selector prefix and write remake/css/craft-stage.css.

The repo's CSS avoids native nesting (older iPhones), so the committed file uses plain selectors.
"""
import pathlib
import re

PREFIX = "html body.craft-stage:not(.game-ds) .bench[data-mode]"
src = pathlib.Path(__file__).with_name("stage_src.css").read_text(encoding="utf-8")  # 書く場所: このフォルダの stage_src.css
out = []
depth = 0
for line in src.splitlines():
    stripped = line.strip()
    # Only selector lines (outside declaration blocks, not comments) get the prefix.
    is_selector = depth == 0 and stripped and not stripped.startswith(("/*", "*", "-", "@")) and ("{" in line or stripped.endswith(","))
    if is_selector:
        line = re.sub(r"&", PREFIX, line)
    out.append(line)
    depth += line.count("{") - line.count("}")
text = "/* 生成ファイル。直すときは asset_sources/ui/craft-stage-20261110/stage_src.css を直し、同じフォルダの build_stage_css.py で作り直す。 */\n" + "\n".join(out) + "\n"
assert "&" not in re.sub(r"/\*.*?\*/", "", text, flags=re.S), "unexpanded &"
(pathlib.Path(__file__).resolve().parents[3] / "remake/css/craft-stage.css").write_text(text, encoding="utf-8")
print(len(text), "bytes")
