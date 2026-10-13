# 街の斧投げBar・ボドゲカフェ

PR #545 / 関連 #540。ゲームソースは `source.json` のコミット・SHA-256。第2章の街はPR #524の保存済みhead `7f639db` を通常mergeして接続した。#524の統合が先に必要で、本PRだけを公開済みとは扱わない。

## 確認したこと

- `play_spots.mjs`: 最終11項目PASS。PCの10投／横持ちタッチの3投、未面識キャラが出ないソロ表示、完走時だけ料金・体力・根性1P・1行動、再来店は記録閲覧のみ、手動SAVE→再読込→LOAD、無料取消、残高不足、体力0、二重起動、別セーブ・pagehide・画面撤去の取消。第2章の両街の配置、部活設立と帰還、本の購入・二人卓・結末と夜1枠の同時保存、翌朝へ進んでも二重消費なし、章制限・本棚表示中のLOADも確認した。結果: `browser-results.json`（ゲーム・保存処理の `486366a5`）。その後の章内日表示だけの修正 `ea90dab7` はPC／タッチの街・設立2項目を再確認し、`chapter-date-results.json` に保存。通算16→章内2／旧記録3→3の表示と保存日が変わらないことを追加確認した。
- `hiyori_axe_story.mjs`: 既存イベント11項目PASS。前後の会話・実3投・中断・旧保存・友情／恋人・料金・LIME・既読状態を保持。結果: `hiyori-results.json`。
- 斧のモデル16項目、TRPGの物語・部活モデル23項目PASS。TRPG旧schemaの自動／手動保存移行、章境界、日常、LIME、休養の各既存検査もPASS。
- 編集した台本のlintはERROR 0／WARN 0。6625本文の組版、agent docs、Git Safety、diff checkはPASS。TRPG静的書出し40ファイルも成功し、追加した時計モジュールを含む。整形dry-runは範囲外の既存oneesan本文1行だけを検出し、変更していない。

実行はChromium、タッチは844×390のブラウザエミュレーション。独立した日常保存fixtureからの実クリック・実投擲・実TRPGであり、新規開始から第1章全日を遊び終えた検証ではない。実機Safariは未確認。対戦モードと店ロゴ制作は #489 / #540 の別残作業。

## 画面

- [PCの斧記録](axe-record-pc.png) / [タッチの斧記録](axe-record-touch.png)
- [隣町のピン・PC](cafe-map-pc.png) / [タッチ](cafe-map-touch.png)
- [カフェの部活設立・PC](cafe-club-pc.png) / [タッチ](cafe-club-touch.png)

既存の専用斧投げ背景・的・投擲、カフェ画像、TRPG背景と人物素材を再利用。新規画像生成は行っていない。

## 初回失敗と修正

初回のレイアウト検査は、ピンの枠外装飾・祖先が非表示のボタンまで対象にしていた。画面で実物を確認し、表示中のボタンと実際のラベルを検査するよう修正。画面の生成前に測定していた箇所には準備待ちを追加した。

完走後のLOAD検査ではDAY5のfixtureに未読の必須つむぎ会話が残っており、本編の旧保存救済が正しく始まった。過去の必須会話を読了したfixtureに修正し、同じSAVE/LOAD操作を再実行してPASS。失敗ログ `initial-fixture-failures.json` も保存した。

既存VMの依存解決に合わせ、スポットの定義を副作用のない `axe-bar-data.js` へ分離し、ゲーム本体は来店時に読む。CIで休養VMの定義一覧への追加漏れを検出したため登録し、既存の休養・延期・料金検査をローカルで再実行してPASS。CIの最終head状況はPR Checksで追跡する。

## 再現

```sh
python3 remake/tools/serve_preview.py --port 8123
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/play_spots.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/hiyori_axe_story.mjs
node --test remake/test/axe_throw.mjs remake/test/trpg.mjs remake/test/trpg_campaign.mjs
node --experimental-vm-modules remake/test/trpg_campaign_save.mjs
node --experimental-vm-modules remake/test/illness.mjs
```
