# 現行資料の参照ガイド（2026-10-30）

## 正本と優先順位

1. 最新の明示的なオーナー指示と取得済み承認。依頼された仕様変更に再承認を求めない。結果を大きく変える曖昧さだけ確認する。
2. 開発・Git安全ルール: `AGENTS.md` が唯一の正本。Claude Code は `CLAUDE.md` から読み込む。
3. 実際に動く現行コード・データ: `remake/`（起動・テストは [remake/README.md](../remake/README.md)）、`data/`（台詞・共有データ）、`assets/`（素材）。
4. 仕様・オーナー要望: [master_spec.md](master_spec.md)（冒頭の「本書の読み方」から）と [owner_requests.md](owner_requests.md)（新しい順の台帳。冒頭の「読み方」から）。
5. 物語・人物: [brand/](../brand/README.md)（`story_and_structure.md`・`character_profiles.md`）と `data/characters.json`・`data/story_routes.json`。
6. ゲームの規則・台詞の書き方: [gameplay_agent_reference.md](gameplay_agent_reference.md)。画像・素材: [asset_ai_guidance.md](asset_ai_guidance.md)。シーシャの工程・機材・用語の参照先一覧: [shisha_reference.md](shisha_reference.md)。
7. 成長（経験値・レベル・心得の盤）: 決定は [stat-design/ADDENDUM-BOARD-LAYOUT.md](stat-design/ADDENDUM-BOARD-LAYOUT.md)、実装仕様は [stat-design/SPEC.md](stat-design/SPEC.md)（第2版）。第2版の3能力は `GROWTH_BOARD=false` の裏で未公開。プレイヤーに見える能力は従来の5種類（`gameplay_agent_reference.md`）。
8. レビュー範囲: [review_scope.md](review_scope.md)。

## UIの文字基準（#1352）

- 本文・通常の操作表示・数字・通貨は `remake/css/base.css` の `--font` を使う。数字の整列は実際の字幅で確認し、`tabular-nums` の指定だけを等幅の証拠にしない。
- ドット体は `--font-dot` を介して使う。登録された実体は400のみなので、ドット体の太さを上げて強調したことにしない。会話用の明朝と制作画面用の明朝は用途を分け、収録字・数字・記号を確認してから使う。
- 12px未満の文字は読ませる情報に使わない。12〜13pxの文字はウェイト700以上・字間0.02em以下を目安とし、長文や重要な操作文は大きくする。実際の画面でPC・横向きスマホ・縦向きスマホの読みやすさを確認する。
- Georgia は見出しや演出数字などの飾りに限る例外。通常UIや購買情報には使わない。装飾が情報を担う場合は、読みやすい本文書体の表示も確保する。

## 二次資料・履歴の扱い

- [archive/setting_book/](archive/setting_book/README.md) は2026-10-31に退避した旧**二次資料**（根拠にしない）。数値・価格・機材説明は `data/*.json` が正。`archive/setting_reference.html` はそこからの生成物。
- [archive/](archive/README.md) は日付付きの引き継ぎ・計画・記録の**履歴**。ブランチ名・SHA・CI結果・「未接続」「予約待ち」は当時の状態で、新しい台詞・設定・実装の根拠にしない。`docs/qa/` は検証記録（約0.7GB）。どちらも `.claudeignore` で自動参照から外してあり、必要なときだけ開く。
- `docs/reports/` と `docs/design/` に残るのはオーナー未決定の提案・設計案。採用扱いにしない。決まったら正本へ反映し、ファイルは `archive/` へ移す。
- 改稿前の台本は `data/dialogue/_legacy/`。旧 `web/`・Godot版は廃止済みで、`docs/master_spec.md` に残る `web/js/` 等のパスは履歴。
- 旧資料の整理・削除は、参照先と失われる情報を確認したうえで行う。日付付きの新規MDは必要な場合だけ作り、`docs/` 直下に増やさず `archive/` か該当する正本へ。

## 日常の作業で読むもの

| 作業 | 最初に読む |
|---|---|
| 第2〜5章・キャラの作り込み（第1章に揃える） | [chapter_parity_audit.md](chapter_parity_audit.md)（第1章の基準チェックリストと章・キャラごとの不足） |
| 台詞・会話イベントの追加・編集 | `.claude/skills/dialogue-edit`、`text-style`、`gameplay_agent_reference.md`、必要なら `shisha_reference.md` |
| 設定の矛盾点検・ストーリー改善 | `.claude/skills/canon-check`、`story-review`、`review_scope.md`、`brand/` |
| 画像・CG・立ち絵 | `.claude/skills/codex-image-prompt`、`portrait-fix`、`character-portrait-remaster`、`asset_ai_guidance.md` |
| BGM | `.claude/skills/suno-bgm-prompt`、`bgm_suno_prompts.md` |
| オーナーの要望・バグ報告 | `.claude/skills/owner-request`、`owner_requests.md` |
| テスト・CI | `.claude/skills/web-build-test`、`remake/README.md`、`tools/ci/suites.json` |
| 開発者コンソールの補助 | `dev_inspector.md`、`dev_event_preview.md`、`dev_event_rehearsal.md`、`remake_browser_checks.md` |

## AI間の引き継ぎ

- 進行中の作業は GitHub の Issue / PR を直接見る（スナップショット文書は作らない）。Issue予約（claim / release / handoff）は2026-10-23に撤廃済みで、過去資料に残る予約手順は無効。
- 作業開始: 現在のブランチと関連する正本を確認。過去の引き継ぎを丸ごと読み込まない。保存済みPRは既存ブランチで継続する。
- 作業終了: PR本文に変更内容・テスト・未完了事項・次の一手を記載。長期に残すべき確定仕様だけ該当する正本へ反映する。

## 博士の外見と旧資料の区別（#2190 P05）

本人訂正により、博士の七三・水色シャツ・青チェックネクタイは撤回済み。採用済みの乱れた茶髪・黒縁の四角い眼鏡・開襟の白シャツ・染みのある白衣を基準にする。人物データ・本文・生成指示が食い違っても、古い文へ画像を戻さない。

- 根拠：[採用記録](../asset_sources/adoptions/ch1-art-20261008/README.md)、[採用立ち絵](../assets/sprites/characters/dr_kemuri/chr_dr_kemuri_normal.png)、[人物正本](../brand/character_profiles.md)、`data/characters.json` の `dr_kemuri`。
- 現役の生成参照：`tools/make_reference_sheet.py` の博士欄と [カットイン人物欄](../asset_sources/character-intros/graphic-20261031/characters.tsv)。`visual_concepts` も採用済み外見に合わせる。
- 履歴：[旧台詞差分表](archive/reports_story_edit_564_changes.md)と [#452 QA](qa/issue452-regular/README.md)の原ログ・過去画像は証拠として保持し、現在の外見の根拠にしない。元の生成プロンプトの旧名「炭場創」も現在名を決める根拠にせず、人物ID `dr_kemuri` と現行の火浦理一を参照する。
- 追跡テキスト全域（hidden skills・制作用プロンプトを含む）の七三／水色シャツ／青チェックと英語の side-part／blue shirt／plaid tie／necktie、および博士名・IDを照合。他人物の上園の水色シャツ、サイの横分け、神崎のネクタイは今回の博士の撤回対象と混同しない。旧設定資料集は上記のとおり退避済みで、他人物の外見や未確定の設定をこの点検で変更しない。
