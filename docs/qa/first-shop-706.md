# 初回買い出しの案内・ミント限定購入（#706 / #701 元22・23）

対象は`errand: mint`・店の経費・初回買い出し未完了の組み合わせだけ。別の準備買い出しや通常営業を制限しない。商品は一覧に残し、他フレーバー・機材・くじの購入を試すとスミさんの注意を表示して拒否する。商品詳細の閲覧や通常の売却処理を変更しない。

案内は選択・購入確定・退店の3段階。矢印を含む短文と対象ボタンの枠で次の操作を示す。別タブ・ミントの出ないフィルターへ移った場合は戻る先を示す。経費済みの旧保存に、再び無料になると表示しない。

## 確認方法

`CHROME_EXECUTABLE_PATH=/usr/bin/chromium TEST_CASES=first-mint-tutorial-pc,first-mint-tutorial-touch node remake/test/browser/shop_ui.mjs`

新規2ケースはPC1280×720・844×390タッチの実click/tapを使う。18商品・機材を表示したまま拒否すること、金銭/在庫/機材/箱/フラグが購入拒否で変化しないこと、くじ演出を開始しないこと、案内の段階と強調対象、通常の無料ミント1箱・保存・二重確定拒否、選択後LOADと古いボタン、初回終了後の他商品購入を検査する。各段階を撮影して文字と操作領域を目視する。

既存のerrand-expense-and-preparation、equipment-sell-kuji、PC/touch batch、shortfall-scroll-discard-stale-state、calendar-shopping-and-showroomを回帰対象とする。構文・diff・daily_consistency・agent docs・Git Safetyも確認する。

## 境界

変更はshop.js・既存ショップテスト・通しテスト・本記録。商品価格/数量上限/所持品形式/行動枠を変更しない。通常営業と別の経費flagを使う準備買い出しは従来どおり。くじはショップの購入入力をcapture段階で止め、既存担当のkuji.jsや抽選・景品データ・商品画像・共有CSSを編集しない。

CIのdirect/street通しは初回買い出しでのくじ成功を期待していたため失敗した。初回はミント購入後もくじの金銭・箱・景品が不変で開封画面が出ないことを検査し、後日の通常来店で1枚購入・500円支払い・景品保存を引き続き検査する。最終検査は初回拒否と通常の1枚購入の両方を必須とする。

本人の明示許可により、この依頼に限る実装予約省略を適用。既存担当・予約は保持。実機Safari・NEW GAMEからの自然到達通しは未検証。ブラウザ場面fixtureと既存calendar回帰を区別し、公開反映はPRのCI/レビュー後に確認する。
