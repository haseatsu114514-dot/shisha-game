# レビュー対象範囲（矛盾・改行・セリフ点検用）

AI（Claude / GLM 等）や人間がこのリポジトリを「矛盾点・改行・ストーリー・セリフ」で
見渡すときの**対象範囲と除外リスト**（2026-10-30 更新）。旧 `web/`・Godot版は削除済み（AGENTS.md「Git Safety」を参照）。
レビューは **`remake/` ＋ `data/` ＋ `brand/` が唯一の正史** という前提で行う。

目的:
- **偽の矛盾を防ぐ** … ビルド成果物や外部ライブラリを読むと正史でない差異が出る。
- **トークン/コストを下げる** … 下記コア集合なら **約 230k〜375k** で済む。

---

## ✅ レビューする（正史）

| ティア | パス | 目安トークン | 中身 |
|---|---|---|---|
| **コア（最小）** | `data/dialogue/**` ＋ `brand/story_and_structure.md` ＋ `brand/character_profiles.md` | ~230k | 台詞・ストーリー構成・キャラ設定の「正」 |
| 標準（実物） | ＋ `data/*.json`（characters / flavors / equipment / glossary 等）＋ `remake/js/` | ~375k | 実際にプレイされるブラウザ版の挙動・データ |
| 仕様照合（必要時のみ） | ＋ `docs/master_spec.md` ＋ `docs/owner_requests.md` | +数十k | 仕様・要望台帳と突き合わせるとき |

ヒント:
- 純粋な「セリフの改行・字数（吹き出し溢れ）」は `data/dialogue/**` だけ見ればよい。
- キャラの呼称・設定矛盾は `data/characters.json` ＋ `brand/character_profiles.md` を軸に。

---

## ❌ レビューしない（除外）

| パス | 理由 |
|---|---|
| `assets/**` / `asset_sources/**` | 画像・音声などバイナリ。テキストレビュー対象外（トークンも消費しない） |
| `remake/data/manifest.json` | 画像から生成した目録。台詞・設定の正本ではない |
| 各種 minified / ベンダーJS | 外部ライブラリ |
| `data/dialogue/_legacy/**` | 改稿前の台本の隔離先。正史の根拠にしない（混線は `tools/check_story_canon.py` が検出） |
| `docs/archive/**` / `docs/qa/**` | 日付付きの引き継ぎ・計画・検証記録。当時の状態であり現在の仕様ではない |
| `docs/setting_book/**` / `docs/setting_reference.html` | 二次資料と生成物。数値・設定が食い違えば `data/`・`brand/` が正 |

> 注: Godot版（`project.godot` 等）は 2026-06-15、旧設定残骸（`brand/brand`・`brand/chapter1（character）`・`docs/handoff/`）は 2026-06-16、旧ブラウザ版 `web/` は 2026-10-07 に削除済み。

---

## 運用メモ

- **正史は remake/ ＋ data/ ＋ brand/**。矛盾を見つけたら直すのはこの3つ。
- 台詞は `data/dialogue/*.json` が原本。現行版はそのJSONを直接読む。
- ツールに範囲を渡すとき:
  - Claude Code は CLAUDE.md から AGENTS.md を読み、レビュー時には本ファイルを参照する。「`docs/review_scope.md` の範囲でレビューして」と指示すれば足りる。
  - 他エージェント（Cline / Cursor / GLM 等）には「レビュー対象は `data/dialogue/`・`brand/`・`data/*.json`・`remake/js/` のみ。`assets/`・`remake/data/manifest.json` は除外」と渡す。
- トークン概算は 2026-06-14 時点の実測（コード≈4文字/token、日本語≈1〜1.8文字/token）。その後台本が増えているので目安。
