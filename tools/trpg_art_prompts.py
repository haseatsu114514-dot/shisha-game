#!/usr/bin/env python3
"""Write the Codex image order for every TRPG scenario from its JSON (spot positions, choices, hypotheses).

Usage: python3 tools/trpg_art_prompts.py  ->  asset_sources/trpg-scenarios/README.md
The background prompt pins each investigation spot to its x/y so the clickable rings land on the painted objects.
"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
catalog = json.loads((ROOT / "data/trpg_catalog.json").read_text(encoding="utf-8"))
STYLE = ("Finely finished premium visual-novel game background, single landscape 16:9 image (1280x720), wide cinematic composition, "
         "carefully painted anime environment concept art with tactile brush detail, restrained colors, high-quality polished indie game art. "
         "NO people, NO silhouettes of people, NO hookah/shisha/waterpipe, NO smoking apparatus, NO text, NO logos, NO watermarks, NO UI. "
         "Interior or scene must stay well lit and readable. Not a photograph, not a 3D render, not flat vector art.")
ATLAS = ("Create a production videogame sprite atlas on a TRANSPARENT background, EXACTLY 3 equal columns by 5 equal rows (15 equal cells), "
         "no grid lines, no frame, no paper panels, no lettering or numbers. Each cell has ONE centered independent detailed hand-painted "
         "storybook object vignette with a 15% clear margin inside its own cell, never crossing a cell boundary. Cohesive premium illustrated "
         "adventure style matching the scenario's background palette: tactile brushwork, crisp silhouettes, a little magical realism. "
         "Not flat UI icons, not photorealistic, no people's faces, no text.")
out = ["# TRPG シナリオの背景と選択肢の絵（Codexへの指示書）", "",
       "`python3 tools/trpg_art_prompts.py` が各シナリオのJSONから自動で書き出す。調査地点の位置（x%, y%）を背景の指示に焼き込むので、画面の光る輪が絵の物の上に来る。",
       "", "## 受け取ったあと", "",
       "1. 背景: 原画 `assets/backgrounds/trpg_<id>_room.png`（1280×720）→ 配信 `remake/img/backgrounds/trpg_<id>_room.webp`（品質90）。JSONの `presentation.image` に `\"../../img/backgrounds/trpg_<id>_room.webp\"`。",
       "2. 選択肢: 原画 `assets/ui/trpg/choices-<id>.png`（透過・3列×5行）→ 配信 `remake/img/ui/trpg/choices-<id>.webp`（lossless）。JSONの `presentation.choiceArt` に `{\"src\": \"../../img/ui/trpg/choices-<id>.webp\", \"rowCount\": 5, \"rows\": {...}}`（下の行番号のとおり）。",
       "3. 新規画像は Git LFS（`git lfs ls-files` で確認）。`node tools/validate_trpg_scenario.mjs` で画像の存在を検査し、`remake/trpg-preview.html?scenario=<id>` で輪と物の位置を目視する。",
       "4. 生成日・SHA-256・目視QAを `asset_sources/trpg-scenarios/generation.json` に残す。", ""]
for entry in catalog["scenarios"]:
    s = json.loads((ROOT / "data" / entry["file"]).read_text(encoding="utf-8"))
    p, sid = s["presentation"], s["id"]
    fields = [*s["flow"]["prepare"], *s["flow"]["serve"], *s["flow"]["twist"]]
    has_bg = bool(p.get("image")); has_atlas = bool(p.get("choiceArt")) and p["choiceArt"].get("rowCount") == 5
    out += [f"## {p['number']} {s['title']}（`{sid}`）", "",
            f"- 背景: {'済' if has_bg else '未生成（いまは backdrop の色で代用）'} / 選択肢の絵: "
            + ('3列×5行で済' if has_atlas else '旧3列×3行あり（思わぬ展開の手だけ文字のカード）。3列×5行で作り直すと全部が絵になる' if p.get('choiceArt') else '未生成（いまは文字のカードで代用）'),
            f"- 行番号: " + ", ".join(f"`{f}`={i}" for i, f in enumerate(fields)) + ", `hypotheses`=4", ""]
    if not has_bg:
        spots = "; ".join(f"{sp['label']} clearly visible around x{sp['x']}% y{sp['y']}%" for sp in s["spots"])
        out += ["```", f"--- background: trpg_{sid}_room.png ---",
                f"{STYLE} Scene: {p.get('sceneAlt', '')} Setting: {p.get('location', '')}. Mood: {p.get('atmosphere', '')}. "
                f"Fictional place from a tabletop story ({p.get('genre', '')}). Concrete click-investigation objects, each a distinct readable prop at its position: {spots}. "
                "Keep the upper-center area slightly calm for a title. Believable scale and clean perspective.", "```", ""]
    if not has_atlas:
        rows = []
        for i, f in enumerate(fields):
            rows.append(f"Row {i + 1} ({p['fields'][f]}), left to right: " + "; ".join(f"({i * 3 + j + 1}) {o['label']} — {o['description']}" for j, o in enumerate(s["options"][f])))
        rows.append("Row 5 (guesses), left to right: " + "; ".join(f"({13 + j}) {h['label']} — {h['description']}" for j, h in enumerate(s["hypotheses"])))
        out += ["```", f"--- choices atlas: choices-{sid}.png ---", ATLAS + " Paint each item as an evocative object or tiny diorama (no people's faces). " + " ".join(rows), "```", ""]
(ROOT / "asset_sources/trpg-scenarios/README.md").write_text("\n".join(out) + "\n", encoding="utf-8")
print("wrote asset_sources/trpg-scenarios/README.md for", len(catalog["scenarios"]), "scenarios")
