# ショップUI #505 の実画面・検証

PR: https://github.com/haseatsu114514-dot/shisha-game/pull/510

`review-entry-{pc,touch}.png` は画像付きの入店前選択、`review-shop-{pc,touch}.png` はミント2箱＋ブルーベリー1箱を選択した本編画面。所持金12,800円、合計4,650円、購入後8,150円の入力例。タッチはChromiumの横持ち844×390エミュレーションであり、実機計測ではない。

## 確認結果

実装開始時のmainはe96b7cf。最新main d4e097e（LIMEの行動前確認、ひよりの更新）を競合なく取り込み、646ad9fでショップ全10ケースと日常ロジックを再確認した。

| 確認 | 結果 |
| --- | --- |
| `browser/shop_ui.mjs` | 10/10 PASS。PC・タッチ、18品、混在購入、合計と残金、保存、経費の一度きり、準備12g、機材上限、非売品・装備中の売却拒否、くじ、選択解除、スクロール、旧画面・別セーブ、3秒以上の行き先選択、実日常ループ、体力不足での見送り |
| `navigation_transitions.mjs` | 7/7 PASS。店舗メニューは入店演出後に表示 |
| `store_logos.mjs` | 18ケース PASS |
| `browser/lime_appointment_recovery.mjs` | 7/7 PASS。買い物後の資金不足と約束の保存 |
| `browser/action_context.mjs` | day4-shopping、day5-shopping PASS。買い物で行動枠を使わない |
| `browser/minto_invite_reminder.mjs` | 最新main取り込み後18/18 PASS。買い物は無料、2Fだけ約束の確認対象。PC／タッチの歩行導線も確認 |
| `browser/ch1_eve.mjs` | stock-rescue-before-full-practice PASS |
| `playthrough.mjs` | 第1章通し PASS。チュートリアル、ロード、敗北→再挑戦→優勝。詳細はplaythrough.txt |
| `daily_consistency.mjs` / `illness.mjs` | PASS。最新main取り込み後にも確認 |

追加した通知テストの初回はローカルの疎なチェックアウトに `experiments/proto/street/` がなく歩行2ケースが失敗した。必要な既存ファイルを取得後、同じスイート18ケースを再実行して全件PASS。ゲームコードの変更による対処ではない。

生成素材は読み込みエラーなし。18種類を目視確認し、原画の切り出し窓を指定した。経費ラベルの横幅超過は修正して再確認。くじ・売却タブでは、未選択時の購入欄を隠す。2Fへの入店演出は体力確認後に予約するため、見送った場面へロゴを持ち越さない。

## 既存の制約

変更前のmainでも `bonds.mjs:99` は期待値5に対し3で失敗した。既存Issue #447（fixtureと現行の実回答条件の不一致）で追跡中。このPRでは関係値や恋愛の条件を変えていない。贈り物の非売品・売却不可は新しいショップ実画面テストでも検証済み。

予約workerは `codex-shop-purple-20261013-f716d295`。claim run 38352822385、status検証run 38353627973。未マージのため予約を保持する。
