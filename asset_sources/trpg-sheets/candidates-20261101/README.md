# TRPG 人物シートの候補（2026-11-01・オーナー共有・未採用）

Codex が `asset_sources/trpg-sheets/README.md` の指示で生成した候補。見た目8人シート（look-a/b/c）と仲間の役9人シート（pc-a/b/c）の3案ずつ。
原画はリサイズ・切り抜き・透過補正をせず保持している（`IMAGE-MANIFEST.json` の SHA-256 と一致）。生成メモは `HANDOFF.txt`・`QA.md`・`prompts.txt`。

- 丸窓での見え方: [docs/qa/trpg-session-rebuild/portrait-candidates-circles.webp](../../../docs/qa/trpg-session-rebuild/portrait-candidates-circles.webp)（上からA・B・C、左8人が見た目、右9人が仲間の役）
- 切り出し: `python3 tools/trpg_crop_portraits.py looks|pcs <sheet.png> <out_dir>`（各マスの最大の形だけを残し、顔の重心で正方形512px）
- **採用はオーナーの選択待ち**。選ばれた案だけを `assets/ui/trpg/`（原寸512px PNG）と `remake/img/ui/trpg/`（lossless WebP）に置き、JSON の `portrait` に書く。
