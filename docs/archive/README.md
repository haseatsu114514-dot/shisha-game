# docs/archive — 日付付きの引き継ぎ・計画・記録（履歴）

ここにあるのは**その時点の記録**で、現在の仕様・担当・進捗ではない。ブランチ名・コミットSHA・CI結果・「未接続」「予約待ち」などの状態はすべて当時のもの。Issue予約（claim / release / handoff）は2026-10-23に撤廃済み。

- 現在の正本は `docs/current_documentation_guide.md` の優先順位に従う（`AGENTS.md` → `docs/master_spec.md` / `docs/owner_requests.md` → `brand/` → `docs/gameplay_agent_reference.md`）。
- ここを読むのは、過去の決定の経緯や当時の制作手順を確認したいときだけ。新しい台詞・設定・実装の根拠にしない。
- 相対リンクは移動後に直してあるが、リンク先が削除済みのこともある（例: 旧台本 `data/dialogue/_legacy/` と旧設定資料集は2026-11-02に削除済み）。
- 新しく履歴ファイルを足すときは、ここへ日付付きで置き、現在の正本には確定した内容だけを反映する。

| ファイル | 内容 | 当時 | 現在の正本・反映先 |
|---|---|---|---|
| `claude_handoff_20261003_relationships.md` | 好感度・呼び名・最終交流・専用ハガルの引き継ぎ（旧 `web/` 時代） | 2026-10-03 | `docs/gameplay_agent_reference.md`、`docs/master_spec.md` |
| `claude_handoff_thermal_20261009.md` | 温度による背景変化の引き継ぎ | 2026-10-09 | 実装済み `remake/js/craft/thermal.js` |
| `codex_handoff_city_images.md` / `codex_handoff_street_proto.md` / `codex_handoff_street_set_images.md` / `street_city_design.md` | 街歩き試作の発注書・設計 | 2026-10 | `experiments/proto/street/README.md`（試作は保存のみ） |
| `continue_voice_music_premium_20261010.md` / `sumi_continue_20261010.md` | CONTINUE演出の第1〜2期 | 2026-10-10 | `docs/spec/continue_button_reactions_sfx_20261010.md`（CV35〜46が現行） |
| `motion_endings_20261011.md` | 演出終端・帰宅の扉の修正記録（PR #283） | 2026-10-11 | `remake/README.md`、`docs/owner_requests.md` |
| `player_load_capacity_20261010.md` | ロード容量の実測 | 2026-10-10 | 再計測が必要なら `remake/test/loading_prefetch.mjs` 周辺 |
| `samechan_gothic_shark_handoff.md` | サメちゃん新衣装3案の確認 | 2026-10 | `asset_sources/portraits/samechan-gothic-shark-concepts-v1/` |
| `slot_bonus_notification_20261008.md` | スロットボーナス通知（PF31・32） | 2026-10-08 | `docs/owner_requests.md`、`docs/spec/pakki_slot_spec.md` |
| `plans_post_chapter1_roadmap.md` | 第2章以降のロードマップ | 2026-10-13 | `docs/master_spec.md`、`remake/README.md`「まだ無いもの」 |
| `plans_story_revision.md` | #549 王冠構図と改稿案 | 2026-10 | `brand/story_and_structure.md` |
| `reports_story_review_564_20261016.md` | #564 ストーリー添削と差分 | 2026-10-16 | 反映済み（`data/dialogue/`） |
| `rin_portrait_handoff.md` | 凛 v12 立ち絵の修正と引き継ぎ | 2026-10 | 反映済み（`assets/sprites/characters/rin/`）。手順は `.claude/skills/portrait-fix` |
| `samechan_romcom_route_plan_20261011.md` | サメちゃん恋愛ルート企画（保存のみ・未実装） | 2026-10-11 | 着手時に `brand/` と `docs/spec/post_relationship_gameplay_plan_20261011.md` と合わせて読む |
| `master_spec_2026-06_parts1-4.md` | 開発マスター仕様書の第1部〜第4部（修正26項目・大会パート案・BGM案・モデル別優先順位） | 2026-06 | `docs/master_spec.md`（最新仕様）、`docs/spec/`、`remake/README.md` |
| `owner_requests_2026-06_09.md` | 要望台帳の 2026-09-28 以前の節（旧 `web/` 時代） | 2026-06〜09 | `docs/owner_requests.md` |
| `remake_history_2026-10.md` | リメイク版の作り直し方針・2026-10-01 改稿取り込み・2026-10-17 実プレイ修正 | 2026-10 | `remake/README.md`、`docs/spec/` |
