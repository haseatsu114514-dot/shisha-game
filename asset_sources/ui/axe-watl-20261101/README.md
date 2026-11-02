# 斧投げ WATL 2026式の板（2026-11-01〜02・AXR06・Codex #2198・ゲームはC案）

斧投げミニゲームを公式（WATL 2026 Hatchet）の的・採点へ再構成した際（台帳 `docs/owner_requests.md` AXR01〜06、設計 `docs/spec/axe_throw.md`「WATL 2026式への再構成」）、板の新規画像を生成しようとしたが、OpenAI 画像API（`gpt-image-2.5-sunburst`）が **クレジット切れ（HTTP 429 `insufficient_quota`）** で生成できなかった。オーナー指示「新規で画像生成が必要な場合はコーデックスに依頼して作成しても可」に従い、Codex への依頼を [Issue #2198](https://github.com/haseatsu114514-dot/shisha-game/issues/2198) にまとめた（プロンプト・受け入れ条件・組み込み手順）。指示文の正本はこのフォルダの `prompts/board.txt`。

2026-11-01 追記（AXR07）: 見やすさのため、中央6割を明るく均一にし、濃い節・黒い傷・強い木目を置かない指示を加えた。

- 指示文: `prompts/board.txt`（1024×1024・透過背景・5枚の縦板・明るく落ち着いた中央・傷は外周だけ・リングや文字は描かない）。
- 現状のゲームは既存の `remake/img/ui/axe_throw/target_board_display.webp`（正方形の板）の上に、SVG で公式比率のマーキング（20mm 黒線・赤ブル・赤縁の青）を描いている。板の実寸は 46.25×48in（2x10 を5枚）として扱い、画像は `remake/js/minigames/axe.js` の `OPAQUE`（不透明範囲の比率）で板の矩形へ引き伸ばしている。

## 受け取ったあとの組み込み

1. 原画を `raw/board.png` に置き、採用版を `assets/ui/axe_throw/target_board_watl.png`、配信用を `remake/img/ui/axe_throw/target_board_watl_display.webp`（800px・lossy q90）にする。既存の `target_board.png` / `target_board_display.webp` は `asset_sources/hiyori-axe-issue477/validate.py` が SHA を検査するので変更しない。
2. `remake/js/minigames/axe.js` の `ART.board` を新しい WebP にし、`OPAQUE` を新画像の不透明範囲（左・右・上・下の比率）に合わせる。
3. `python3 remake/tools/build_manifest.py` で manifest を更新し、`node tools/ci/run.mjs --kind browser --suites axe-throw` で確認する。

## 受領と採用（2026-11-01）

Codex が3案を作成（組み込みツール image_gen・透過、要求1024に対し実寸1254×1254 RGBA、原画無加工）。オーナーがチャットで同じ受け渡しリンクを渡し、比較のうえ **C（琥珀寄り）** を採用した。A・B も原画のまま残すので、差し替えは `remake/js/minigames/axe.js` の `ART.board` と `OPAQUE` だけで済む。

| 原画 | SHA-256（Codex同梱の目録と一致） | 板の不透明範囲（alpha≥250） | 縦横比 w/h | 板の外のalpha点（>8） | 中央6割の明るさ（平均・標準偏差） |
|---|---|---|---|---|---|
| `raw/axe-board-A-pale-honey.png` | `e813d1a611bb860aabd89240331270758d570cf5f06d151feac8a816f4d24fcd` | 82,80〜1172,1174 | 0.996 | 0 | 207・20.1 |
| `raw/axe-board-B-creamy-gold.png` | `be3f9e0f3a17434748e6a848036da63becceeae01d409886cf4a0b7624f64494` | 70,50〜1184,1201 | 0.968 | 595 | 210・23.9 |
| `raw/axe-board-C-amber-honey.png` | `acdd066d952d32544c420a799bf64650dc088e3edc35e1fc48c8fb4b61c83293` | 69,61〜1185,1190 | 0.988 | 7 | 191・22.3 |

Codex 側の説明は `raw/codex-README.txt`・`raw/codex-HANDOFF.txt`・`raw/codex-IMAGE-MANIFEST.json`（受け渡しZIPのCRC検査済み）。

- **選んだ理由**: 3案とも黒いリング・赤・青・灰色の斧が今の板より読みやすい（PC 1280×720・スマホ縦横の実画面で比較）。C は見やすさが A・B とほぼ同じで、夜のラウンジの琥珀色の照明に一番なじむ。公式の 46.25:48 は B が最も近いが、ゲームは板を公式比の矩形へ合わせて描くため差は約2%で目立たない。
- **採用版** `assets/ui/axe_throw/target_board_watl_c.png`（SHA-256 `e7f4665a7d7273f8f38e08d811a474dfdabe9edcd2298759fb960d5ee7dd94e3`）: C の原画のまま、板の外（縁3pxより外）の微小な alpha 点 22938 画素だけを透明にした。板の画素は変えていない。
- **表示用** `remake/img/ui/axe_throw/target_board_watl_c_800.webp`（800px・lossy q90・method 6・alpha 保持、SHA-256 `bb1b0cbb0ff4f596637078fb0eeae9609465e8f6dc7b5b671e52dba8e3a21c83`）。`*_display.webp` の名前は #477 の小物台帳（`asset_sources/hiyori-axe-issue477/validate.py`）が検査する名前なので使わない。
- `axe.js` の `OPAQUE` は 69/1254・1185/1254・61/1254・1190/1254。記録は `adoption.json`。
- 旧 `target_board.png` / `target_board.webp` / `target_board_display.webp` は残す（validate.py が SHA を検査）。
- 板の外縁は画角（得点圏まで）の外になるので、ゲーム中は見えない。

## 2つの板がある理由（2026-11-02）

#2198 には Codex の生成が2回届いた。

- **ゲームが使う板 = C（琥珀寄り）**: オーナーがチャットで直接渡した受け渡しZIP（A・B・Cの3案）から、#2197 で実画面比較して採用。`assets/ui/axe_throw/target_board_watl_c.png`／`remake/img/ui/axe_throw/target_board_watl_c_800.webp`。
- **main に先に入った板（Codex A・2案）**: PR #2225 で画像だけ main に入った（ゲーム未接続）。`assets/ui/axe_throw/target_board_watl.png`／`remake/img/ui/axe_throw/target_board_watl_display.webp`、原画 `raw/board.png`・`raw/board_candidate2.png`。下の「IMG-2198 生成結果」のとおり、中央の濃い節を完全には避けられていない。
- どちらも消さずに残す。ゲームの板を替えるときは `remake/js/minigames/axe.js` の `ART.board` と `OPAQUE`（不透明範囲の比率）を、使う画像に合わせて書き換える。

## IMG-2198 生成結果（2026-11-02）

- 作業者: Codex A（gpt-6-sol 系）。画像は Codex 内蔵 `image_gen` で生成。画像モデルの内部識別子は表示されない。指示文は Issue #2198 と `prompts/board.txt` の全文一致を確認した。
- 採用候補原画: `raw/board.png`（2,078,520 B、SHA-256 `e35098cdd1990da2b0126031956a7d83fdfb6a4adfd54d852deb0ebfa29bdae6`）。原画は生成時の 1254×1254 PNG。透過余白を整えて 1024×1024 の採用版へ縮小した。
- 採用版: `assets/ui/axe_throw/target_board_watl.png`（1,521,172 B、SHA-256 `c794b4789a81d7a2ce53b0e0192f55a892b218591481d3bea8c849`）。alpha≥250 の外接範囲は `(37, 16, 990, 1008)`、幅:高さは `953:992 ≈ 0.961`。
- 表示版: `remake/img/ui/axe_throw/target_board_watl_display.webp`（124,612 B、SHA-256 `fa9a9d00e7cbe8617396e7577a026953dc60c6b2b24c831732d85051dd56f463`）。800×800、WebP lossy q90、alpha 保持。alpha≥250 の外接範囲は `(29, 12, 774, 788)`。接続時の `OPAQUE` は left `0.03625`、right `0.9675`、top `0.015`、bottom `0.985`。
- 不採用案: `raw/board_candidate2.png`（2,410,419 B、SHA-256 `8ea35f790fd81764ea2cad399eee6c8f766b122e1a2bbfb04e3804a863edf3f0`）。中央の濃い節が1案目より目立つ。
- 採用理由と限界: 両案とも5枚の縦板・正面・真の透過・リング等なし・ほぼ公式比率を満たす。両案とも中央6割の濃い節を完全には避けられなかったが、1案目は節が小さく中央の明度が比較的均一。Issue 指定の同一プロンプトで2案生成した上での最良案として残す。
- `#2197` が未マージの時点で `main` の `axe.js` は旧構造なので、ゲームへの接続・PC/スマホ比較・台帳 AXR06 の既存行更新は `#2197` マージ後に行う。
