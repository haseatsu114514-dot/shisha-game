# docs/archive — 日付付きの引き継ぎ・計画・記録（履歴）

ここにあるのは**その時点の記録**で、現在の仕様・担当・進捗ではない。ブランチ名・コミットSHA・CI結果・「未接続」「予約待ち」などの状態はすべて当時のもの。Issue予約（claim / release / handoff）は2026-10-23に撤廃済み。

- 現在の正本は `docs/current_documentation_guide.md` の優先順位に従う（`AGENTS.md` → `docs/master_spec.md` / `docs/owner_requests.md` → `brand/` → `docs/gameplay_agent_reference.md`）。
- ここを読むのは、過去の決定の経緯や当時の制作手順を確認したいときだけ。新しい台詞・設定・実装の根拠にしない。
- 相対リンクは移動後に直してあるが、リンク先が削除済みのこともある（例: `data/dialogue/ch2_ageha.json` は `_legacy/` へ隔離済み）。
- 新しく履歴ファイルを足すときは、ここへ日付付きで置き、現在の正本には確定した内容だけを反映する。

| ファイル | 内容 | 当時 | 現在の正本・反映先 |
|---|---|---|---|
| `ai-handoff.md` | 開発状況スナップショットと再開手順 | 2026-10-15 | 進行中の作業は GitHub の Issue / PR を直接見る |
| `character_intro_art_handoff.md` | 4人の登場カットイン確認用 | 2026-10 | `asset_sources/character-intros/` |
| `character_voice_audit.md` | 口調・呼称監査 | 2026-10-11 | `brand/character_profiles.md`「声と表記の運用」 |
| `claude_handoff_20261003_relationships.md` | 好感度・呼び名・最終交流・専用ハガルの引き継ぎ（旧 `web/` 時代） | 2026-10-03 | `docs/gameplay_agent_reference.md`、`docs/master_spec.md` |
| `claude_handoff_thermal_20261009.md` | 温度による背景変化の引き継ぎ | 2026-10-09 | 実装済み `remake/js/craft/thermal.js` |
| `codex_handoff_city_images.md` / `codex_handoff_street_proto.md` / `codex_handoff_street_set_images.md` / `street_city_design.md` | 街歩き試作の発注書・設計 | 2026-10 | `experiments/proto/street/README.md`（試作は保存のみ） |
| `continue_voice_music_premium_20261010.md` / `sumi_continue_20261010.md` | CONTINUE演出の第1〜2期 | 2026-10-10 | `docs/continue_button_reactions_sfx_20261010.md`（CV35〜46が現行） |
| `motion_endings_20261011.md` | 演出終端・帰宅の扉の修正記録（PR #283） | 2026-10-11 | `remake/README.md`、`docs/owner_requests.md` |
| `player_load_capacity_20261010.md` | ロード容量の実測 | 2026-10-10 | 再計測が必要なら `remake/test/loading_prefetch.mjs` 周辺 |
| `samechan_gothic_shark_handoff.md` | サメちゃん新衣装3案の確認 | 2026-10 | `asset_sources/portraits/samechan-gothic-shark-concepts-v1/` |
| `slot_bonus_notification_20261008.md` | スロットボーナス通知（PF31・32） | 2026-10-08 | `docs/owner_requests.md`、`docs/pakki_slot_spec.md` |
| `image-decisions-20261025/` | 画像採否のスナップショット | 2026-10-25 | `docs/owner_requests.md` 2026-10-24〜25 の節 |
| `plans_ch1_completion_scope.md` | 第1章完成の優先範囲 | 2026-10-12 | 第1〜3章は接続済み |
| `plans_ch2_followup_inventory_563.md` | 第2章3店の続編棚卸し（予約時代の記録を含む） | 2026-10-15 | `docs/owner_requests.md` #929 の節、`data/dialogue/ch2_*.json` |
| `plans_post_chapter1_roadmap.md` | 第2章以降のロードマップ | 2026-10-13 | `docs/master_spec.md`、`remake/README.md`「まだ無いもの」 |
| `plans_story_revision.md` | #549 王冠構図と改稿案 | 2026-10 | `brand/story_and_structure.md` |
| `reports_story_review_564_20261016.md` / `reports_story_edit_564_changes.md` | #564 ストーリー添削と差分 | 2026-10-16 | 反映済み（`data/dialogue/`） |
| `reports_loading_screens_1060_plan_20261027.md` | ロード画面計画 | 2026-10-27 | 実装済み `remake/js/core/loading-prefetch.js` |
| `reports_issue1081-i04-ch2-shop-assets-20261028.md` / `reports_issue1081-k01-slot-left-reel-20261028.md` | #1081 の棚卸し | 2026-10-28 | `docs/pakki_slot_spec.md`、`asset_sources/` |
