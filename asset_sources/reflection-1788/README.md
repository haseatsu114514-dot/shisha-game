# #1788 内省背景・Draft比較

最新main `3efd027ea83135d0d6e1963bc8bae75eee5a591d` に対する背景3枚と短い台詞の補完。採用・マージ前の候補。#1788 はまだ完了していない。

## 比較（左: mainの代用背景／右: 今回の生成候補）

![東京の神社](bg_tokyo_shrine_night-comparison.jpg)
![モスクの中庭](bg_dubai_mosque_courtyard-comparison.jpg)
![前夜の水辺](bg_dubai_waterside_dusk-comparison.jpg)

## 生成・権利に関する出所

- 2026-10-30、本タスクの `image_gen.imagegen` で各1枚生成。実モデル名はツール非開示。実送信文は [prompts.txt](prompts.txt)、原画は `generated/`、寸法・SHA256・加工履歴は [generation.json](generation.json)。原画の生成メタデータを保持。
- #1788 の制作依頼とリポジトリの `codex-image-prompt` / `tools/bg_prompts.txt` / `docs/asset_ai_guidance.md` に基づく。外部写真・検索画像・第三者素材の取得や貼り込みなし。画風基準の既存 `bg_eden_shop.png` は目視参照のみ、生成ツールへの添付なし。
- 新規AI出力として保管。外部配布素材のライセンスや作者を流用していない。AI生成の出所を明記しており、実在建築との非類似性や独占的権利の保証を表すものではない。
- 実行用PNGは原画1672×941から1280×720へLanczos縮小。WebPは公式 `build_manifest.py --backgrounds-only` で生成。比較JPGの左は既存ゲーム素材（東京はPNG、ドバイは実配信WebP）。全画像は新規LFS対象。

## 目視QA

3原画を目視。人物・礼拝の所作・読める文字・アラビア書・ロゴ・焼き込みUIは見当たらない。東京は鳥居・手水・狐像、モスクは中庭と回廊、水辺は対岸のモスクを確認。実在施設の画像を生成参照に使わず、模写禁止をプロンプトに指定。モスクの幾何学装飾は文字として読めない。モスク・水辺は神社より滑らかな絵肌なので、画風の採否は比較で確認する。

ナジュラ・モスクは本ゲーム内の架空施設名。見学者の服装・靴・案内を台詞へ追加。前夜は未訪問でも成立するよう「昼に見学した」を除き、夜は見学できない旨を明記。礼拝の操作や施設からの能力授与は追加しない。

## 未完・担当との境界

- ドバイの `DUBAI_MAP_PLACES` 登録と営業時間の**実制限**（礼拝時・金曜午前・夜）、自由行動の画面への接続は未実施。既存ボタンは見学時間を制限していない。台詞だけで実装済みとはしない。
- `ch4.js` / `ch4-progress.js` / `ch4_progress.mjs` は進行中PR #1810 と重複するため触らない。その完了後に既存進行モデルと `spot-hours.js` を使って接続する必要がある。ドバイ章内日と曜日・時刻の対応はまだ実装で持っていないため、現実の礼拝時刻を捏造しない。
- #1807 はミューズ／Codex A のPR #1833。観音堂表示・HUD・地図の印を別実装しない。#1801 のClaudeのC2/C5/C7、無料授業・通貨・移行・画面選定・公開フラグは既存担当へ残す。reflection.js は背景表3行と説明のみ変更し、関数は同一。
- 第2章は新施設なし、第5章は既存施設再利用と #1788 の全2コメントで確定済み。後の訂正で「勝利祈願」「お守り」は撤回。未接続章の導線を今回確定・増設しない。
- 保存スキーマ・既存scene ID・報酬・盤データは変更なし。画像の正式採用と全件完了は未承認。

## 検証

- `python3 tools/lint_dialogue.py growth_reflection`: ERROR 0 / WARN 0。
- `python3 tools/tidy_dialogue_text.py --dry-run`: 既存他ファイルに21件の提案。本変更ファイルへの整形提案なし、他ファイルは変更しない。
- `node remake/test/text_wrap.mjs`: 8800 texts PASS。
- `node remake/test/growth_board.mjs` / `node remake/test/growth_levelup.mjs`: PASS。
- `node tools/ci/run.mjs --kind quick`: **36/36 PASS、失敗0・再試行0**。
- Chromium（1280×720、一時の合成セーブ、プレビュー `?growth=1`）で `reflectAt` の3入口を実行。各場面 → 灯せる盤（`data-mode=light`）→ 閉じるが成功。日付・slot・体力不変。盤は灯さず閉じたため、ノード取得操作や自然進行の自由行動地図からの全経路を検証したという意味ではない。ブラウザ最初の試行は検証スクリプトの存在しない `data-test=vn-text` セレクタでtimeout。実DOM `.vn-text` に直して3/3成功。ゲームコードの修正・判定緩和なし。
- 新背景の1280×720・WebP読込と、実場面の文字表示を下記3スクリーンショットで目視確認。

![東京・実場面](tokyo_shrine-scene.jpg)
![ドバイ・実場面](dubai_mosque-scene.jpg)
![水辺・実場面](dubai_waterside-scene.jpg)
