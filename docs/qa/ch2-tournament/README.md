# 第2章 DAY14県大会（Issue #548）

対象: `remake/`。第1章の大会記録を保持したまま、DAY13の終了→DAY14朝→4人の一試合→再挑戦または優勝後の東京案内を接続する。第3章本編と第4章の離脱理由は対象外。

## 保存と初期調整値

- 県大会の状態は `flags._ch2_tournament` version 1。既存DAY14朝の保存には初回だけ追加する。第1章の `state.tournament` は上書きしない。
- 一台の制作・提供・2回のcareは既存処理を呼ぶ。総合評価の20%×5工程と炭・温度ルールは変更しない。課題はストロベリーを使うこと（1g以上、課題葉は既存の支給方式）。
- 審査員は上園・チャコール博士・南雲、各10点。蒸らし終了／提供／1回目調整／2回目調整の4区切りで2・3・2・3点ずつ投入。各区切りの評価順で首位へ投入数−1、次点へ1点。確定票は取り消さず、JSON保存後も累積する。
- **初期調整値**: 比較評価はあげは75・神崎80・REI78。上園の好み補正はあげは+4/REI+1、博士は神崎+3、南雲はREI+3。キャラクターの公式能力値ではない。合計同点は最終の制作評価順（さらに同点ならID順）。南雲の固定逆転票は使用しない。
- 各工程開始前の材料・体力・装備・レシピ・能力と確定済み一台を保存。工程中LOADはその工程の開始へ戻す。工程完了後の消費は保持。再挑戦は大会開始時の資源へ戻し、結果履歴だけ保持する。人間関係・連絡先・思い出・旧LIME・金銭はリセットしない。
- 朝／夜のスミLIMEは別IDで一度だけ受信。新章への行き止まりボタンを出さず、章末でSAVEとタイトル復帰を提供する。

## 検証と再現方法

起動は `python3 remake/tools/serve_preview.py --port 8123`。ブラウザはpinned Playwright 1.62.1 / Chromium。最終SHAのCI・レビュー・マージ・公開状態は[PR #562](https://github.com/haseatsu114514-dot/shisha-game/pull/562)と[Issue #548](https://github.com/haseatsu114514-dot/shisha-game/issues/548)に記録する。途中headの成功を最終headへ流用しない。

| 確認 | 内容 |
| --- | --- |
| `node remake/test/ch2_tournament.mjs` | 各10点の不可逆性、JSON中断復元、確定済み消費、再挑戦、2care未完の結果拒否、第1章・関係保持、良/不良の勝敗。PASS。 |
| `node remake/test/browser/ch2_tournament.mjs` | 6ケース。PC優勝・調整1回目後LOAD・章末LOAD、横持ちタッチの既知/敗北/再挑戦、PCと横持ちの実g操作/手動SAVE/LOAD、既存ルールによる焦がし失敗、欠落台本の復旧。タイミングゲームは既存good/bad/burnフック。各ケースのローカル実行PASS。 |
| `node remake/test/browser/ch2_story.mjs` | 6ケースPASS。DAY4 fixtureから実カレンダー操作でDAY13→14へ到達、物語中断、旧記録、画像/台本失敗の復旧。NEW GAMEから全章通しとは区別する。 |
| `node remake/test/browser/ch1_tournament.mjs` | 10ケースPASS。遅延・欠落画像、未読/既読/SKIP、炭、2回の調整、低予算/保存、PC・横持ち・縦持ちの既存結果表示。 |
| `ch2_main` の初日終了タッチ | 既存「制作中」assertを新しいDAY14案内の厳密比較に更新し、該当ケースPASS。他の初日・日常・試遊の回帰は最終CIでも実行する。 |
| 台詞・保存・docs | 新規台本lint ERROR0/WARN0。全体lint ERROR0/既存WARN328。章境界・LIME整合・docs整合・組版PASS。tidy dry-runの1件は未変更の第1章みんと既存行で、新規台本の整形差分は0。 |

6ケースの個別実行には `CASE_FILTER=<ケース名>`。`BASE_URL` と `CHROME_EXECUTABLE_PATH` で配信先/ブラウザ、`SHOTS` で確認画像の保存先を指定できる。通常の結果JSON・失敗画像は `.codex/artifacts/remake-browser/`、CIではworkflowのartifactへ保存する。

確認画像: [PC配合とヘッダー](pc-mix-header.png)・[横持ち配合とヘッダー](touch-mix-header.png)・[PC結果](pc-result.png)・[横持ち結果](touch-result.png)・[第2章終了](pc-complete.png)。画像はDAY14保存fixtureから実フローを操作したもの。大会用の新素材生成はせず、既存背景・人物・制作素材を使用する。

検出した問題: 空の顔アイコンを既存立ち絵の頭部へ補完、作業風景の旧大会名を当該大会名へ変更、得点欄の縦2pxのはみ出しを第2章に限定して修正。fixtureの審査員配列順と現行LIMEの `replyState` 欠落を修正し、名簿/既存トークの全項目比較は維持。焦がし発生工程は初期温度で変わるため、同じ一台の2回の調整までに必ず制作失敗となることを検証する。失敗assertは削除しない。

実機Safari、通常NEW GAMEから第1章を含む全章通しは未実施。第3章本編・離脱理由の解明・味覚回復は対象外。課題量・比較評価・好み補正・票の投入タイミングは上記の初期調整値であり、実プレイヤーを対象とする難易度調整は別途行う。共有scoreの既存リハーサル/前夜/機材/贈答ボーナスも変更していない。

所有者の予約例外は[Issue記録](https://github.com/haseatsu114514-dot/shisha-game/issues/548#issuecomment-6185232197)。他workerの実停止・未保存差分は未確認。予約台帳の移管・release成功を装わない。
