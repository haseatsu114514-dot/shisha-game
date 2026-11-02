# 斧投げ WATL 2026式の板（2026-11-01・AXR06・Codex依頼 #2198）

斧投げミニゲームを公式（WATL 2026 Hatchet）の的・採点へ再構成した際（台帳 `docs/owner_requests.md` AXR01〜06、設計 `docs/spec/axe_throw.md`「WATL 2026式への再構成」）、板の新規画像を生成しようとしたが、OpenAI 画像API（`gpt-image-2.5-sunburst`）が **クレジット切れ（HTTP 429 `insufficient_quota`）** で生成できなかった。オーナー指示「新規で画像生成が必要な場合はコーデックスに依頼して作成しても可」に従い、Codex への依頼を [Issue #2198](https://github.com/haseatsu114514-dot/shisha-game/issues/2198) にまとめた（プロンプト・受け入れ条件・組み込み手順）。指示文の正本はこのフォルダの `prompts/board.txt`。

2026-11-01 追記（AXR07）: 見やすさのため、中央6割を明るく均一にし、濃い節・黒い傷・強い木目を置かない指示を加えた。

- 指示文: `prompts/board.txt`（1024×1024・透過背景・5枚の縦板・明るく落ち着いた中央・傷は外周だけ・リングや文字は描かない）。
- 現状のゲームは既存の `remake/img/ui/axe_throw/target_board_display.webp`（正方形の板）の上に、SVG で公式比率のマーキング（20mm 黒線・赤ブル・赤縁の青）を描いている。板の実寸は 46.25×48in（2x10 を5枚）として扱い、画像は `remake/js/minigames/axe.js` の `OPAQUE`（不透明範囲の比率）で板の矩形へ引き伸ばしている。

## 受け取ったあとの組み込み

1. 原画を `raw/board.png` に置き、採用版を `assets/ui/axe_throw/target_board_watl.png`、配信用を `remake/img/ui/axe_throw/target_board_watl_display.webp`（800px・lossy q90）にする。既存の `target_board.png` / `target_board_display.webp` は `asset_sources/hiyori-axe-issue477/validate.py` が SHA を検査するので変更しない。
2. `remake/js/minigames/axe.js` の `ART.board` を新しい WebP にし、`OPAQUE` を新画像の不透明範囲（左・右・上・下の比率）に合わせる。
3. `python3 remake/tools/build_manifest.py` で manifest を更新し、`node tools/ci/run.mjs --kind browser --suites axe-throw` で確認する。

## IMG-2198 生成結果（2026-11-02）

- 作業者: Codex A（gpt-6-sol 系）。画像は Codex 内蔵 `image_gen` で生成。画像モデルの内部識別子は表示されない。指示文は Issue #2198 と `prompts/board.txt` の全文一致を確認した。
- 採用候補原画: `raw/board.png`（2,078,520 B、SHA-256 `e35098cdd1990da2b0126031956a7d83fdfb6a4adfd54d852deb0ebfa29bdae6`）。原画は生成時の 1254×1254 PNG。透過余白を整えて 1024×1024 の採用版へ縮小した。
- 採用版: `assets/ui/axe_throw/target_board_watl.png`（1,521,172 B、SHA-256 `c794b4789a81d7a2ce53b0e0192f55a892b218591481d3bea8c849`）。alpha≥250 の外接範囲は `(37, 16, 990, 1008)`、幅:高さは `953:992 ≈ 0.961`。
- 表示版: `remake/img/ui/axe_throw/target_board_watl_display.webp`（124,612 B、SHA-256 `fa9a9d00e7cbe8617396e7577a026953dc60c6b2b24c831732d85051dd56f463`）。800×800、WebP lossy q90、alpha 保持。alpha≥250 の外接範囲は `(29, 12, 774, 788)`。接続時の `OPAQUE` は left `0.03625`、right `0.9675`、top `0.015`、bottom `0.985`。
- 不採用案: `raw/board_candidate2.png`（2,410,419 B、SHA-256 `8ea35f790fd81764ea2cad399eee6c8f766b122e1a2bbfb04e3804a863edf3f0`）。中央の濃い節が1案目より目立つ。
- 採用理由と限界: 両案とも5枚の縦板・正面・真の透過・リング等なし・ほぼ公式比率を満たす。両案とも中央6割の濃い節を完全には避けられなかったが、1案目は節が小さく中央の明度が比較的均一。Issue 指定の同一プロンプトで2案生成した上での最良案として残す。
- `#2197` が未マージの時点で `main` の `axe.js` は旧構造なので、ゲームへの接続・PC/スマホ比較・台帳 AXR06 の既存行更新は `#2197` マージ後に行う。
