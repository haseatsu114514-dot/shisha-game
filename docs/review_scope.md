# レビュー対象範囲（矛盾・改行・セリフ点検用）

AI（Claude / GLM 等）や人間がこのリポジトリを「矛盾点・改行・ストーリー・セリフ」で
見渡すときの**対象範囲と除外リスト**。Godot版は凍結中（CLAUDE.md「Godot版は凍結」を参照）
なので、レビューは **`web/` が正史** という前提で行う。

目的:
- **偽の矛盾を防ぐ** … 凍結中の Godot版（`scripts/*.gd`）は web と乖離していくため、
  両方を読むと「言ってることが違う」が大量に湧くが、それは正史の矛盾ではない。
- **トークン/コストを下げる** … 全テキストは約 **800k tokens** あるが、その大半はコードと
  ビルド成果物。下記コア集合なら **約 230k〜375k** で済む。

---

## ✅ レビューする（正史）

| ティア | パス | 目安トークン | 中身 |
|---|---|---|---|
| **コア（最小）** | `data/dialogue/**` ＋ `brand/story_and_structure.md` ＋ `brand/character_profiles.md` | ~230k | 台詞・ストーリー構成・キャラ設定の「正」 |
| 標準（実物） | ＋ `data/*.json`（characters / flavors / equipment / glossary 等）＋ `web/js/game.js` | ~375k | 実際にプレイされるブラウザ版の挙動・データ |
| 仕様照合（必要時のみ） | ＋ `docs/master_spec.md` ＋ `docs/web_version_plan.md` ＋ `docs/owner_requests.md` | +数十k | 仕様・要望台帳と突き合わせるとき |

ヒント:
- 純粋な「セリフの改行・字数（吹き出し溢れ）」は `data/dialogue/**` だけ見ればよい。
- キャラの呼称・設定矛盾は `data/characters.json` ＋ `brand/character_profiles.md` を軸に。

---

## ❌ レビューしない（除外）

| パス | 理由 |
|---|---|
| `scripts/**`（`*.gd`） | **Godot版＝凍結中**。web と二重実装で乖離するため読むと偽の矛盾が出る。約285k tokens のノイズ。 |
| `scenes/**` / `*.tscn` / `*.import` / `*.uid` / `project.godot` | 同上（Godotプロジェクト資産） |
| `assets/**` / `asset_sources/**` | 画像・音声などバイナリ。テキストレビュー対象外（トークンも消費しない） |
| `web/dist/shisha_ch1.html` | 1ファイル配布版の**ビルド成果物**（GitHub Pagesの配信対象。手で読まない・編集しない） |
| `web/js/data.js` | `data/*.json` から**生成された複製**。原本（`data/`）の方を見る |
| `web/lib/**` ・各種 minified / ベンダーJS | 外部ライブラリ |
| `docs/handoff/**` ほか過去の引き継ぎメモ | 履歴資料。常時レビュー不要 |
| `brand/brand` ・ `brand/chapter1（character）` ・ `brand/*_feedback.md` ・ `brand/editorial_notes.md` | **旧設定の残骸／フィードバック履歴**。旧タイトル「煙の向こう側」・旧名「ドクター・ケムリ」等を含み、正史として読むと矛盾が湧く。`brand/**` でも除外 |

> 注: 別ゲーム `riders_rescue/`（Rila Riders Rescue）は 2026-06-14 に削除済み。

---

## 運用メモ

- **正史は web/ ＋ data/ ＋ brand/**。矛盾を見つけたら直すのは原則この3つ（Godot側は触らない）。
- 台詞は `data/dialogue/*.json` が原本。`web/js/data.js` は `python3 web/build_data.py` で再生成されるので**直接編集しない**。
- ツールに範囲を渡すとき:
  - Claude Code は本ファイルと CLAUDE.md を自動で読む。「`docs/review_scope.md` の範囲でレビューして」と指示すれば足りる。
  - 他エージェント（Cline / Cursor / GLM 等）には「レビュー対象は `data/dialogue/`・`brand/`・`data/*.json`・`web/js/game.js` のみ。`scripts/`・`scenes/`・`assets/`・`web/dist/`・`web/js/data.js` は除外」と渡す。
- トークン概算は 2026-06-14 時点の実測（コード≈4文字/token、日本語≈1〜1.8文字/token）。目安。
