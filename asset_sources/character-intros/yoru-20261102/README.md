# 針間ヨルの登場カットイン背景（2026-11-02 採用）

Issue #2199 #4。Codex（image_gen）の3案 `background-{A,B,C}.png`（A・C は 1672×941、B は 1672×940。無加工）。説明と指示文は `codex-README.md`・`codex-prompts.md`。

- 採用: **B**（左半分と下側が暗く空き、人物と名前・台詞の帯を置ける。指定に最も合う）。
- グラフィック絵柄の人物絵（#3）が未着のため、旧絵柄（立ち絵＋背景）の登場カットインとして使う。旧絵柄の背景は 1536×1024 なので、高さ1024へ拡大して右寄せで切り出した → `assets/ui/character_intros/yoru.png`（`asset_sources/character-intros/recent-cast/backgrounds/yoru.png` と同じ）。配色と記録は `recent-cast/characters.json` の `yoru`。目録は `python3 remake/tools/build_manifest.py --intros-only yoru`。
- グラフィック絵柄の人物絵が届いたら、`python3 tools/intro_graphic_import.py yoru <原画>` と `--background`（この B の原画）で新しい絵柄にも載せ、`remake/js/vn/intro-graphic.js` の一覧に足す。
