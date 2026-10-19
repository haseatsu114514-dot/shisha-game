# パッキー導入直後の一回体験（#708 / #701 元32）

説明と遊び方カードを読み終えると「はじめてのスロット」を表示する。既存の抽選・報酬・リプレイ連鎖を共通処理で使う。行動枠・体力・料金は追加消費しない。新規導入中だけイベントflagsへ再開印を保存し、結果・報酬と同じ同期保存で消す。導入済み旧保存への遡及、新しいセーブschema、確定当たり、既存の日常行動の抽選条件変更はない。

## 検証

- 修正前: PC1280×720／844×390タッチで、説明終了後もcount0/pending0/widget0となることを再現。
- `CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/reel_lifecycle.mjs`: 既存の回転中再mount・夜の表示・二重報酬防止・説明再mountと、新規10ケース。初回PC／タッチ、通常リプレイ連鎖、説明中reload、説明完了直後の保存境界、回転中reload、導入済み旧保存2種、行動側で確定済みの回転、説明中のNEW GAMEを検査。通常抽選との回転数・実報酬、行動枠／体力／金銭不変、二重呼出し・再訪で回転が増えないこともassertする。
- `node --experimental-vm-modules remake/test/reel_hints.mjs`: 設定・予告・履歴・旧保存の回帰。
- `CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/paid_action_growth.mjs`: 有料／無料行動・訪問・バイト・招待の成長と回転条件。
- `node --experimental-vm-modules remake/test/daily_consistency.mjs`、構文・diff・agent docs・Git Safety。
- ChromiumでPC／横タッチの初回表示を撮影して目視。`SHOTS`を指定すると同じ画像を保存できる。実機SafariとNEW GAMEから受付までの自然到達通しは未検証。導入関数を実行する場面fixtureでの確認である。

最初のpaid_action_growth実行はブラウザ実行ファイルの環境変数を付け忘れて起動失敗し、既存のsystem Chromiumを指定して再実行。新しいブラウザ・依存・素材は取得していない。最初の画面fixtureは背景切替の幕を待たずに撮影していたため、setBgの完了を待つ形へ直して確認をやり直した。これらを本体不具合や最初から成功した記録へ読み替えない。

## 互換性と保存の限界

導入中の再開印だけを任意のイベントflagsへ置く。旧保存はこの印がないため新しい体験を追加しない。既存のcount/pending/seedと能力値を再利用し、state.jsの固定構造や他PRのschema17を編集しない。説明中に別の状態へ切り替えた古い画面は、その新しい状態に既読を付けない。

回転を見せる前に確定結果・報酬を保存する。表示開始後の再読込では従来どおり演出が省かれる場合があるが、再抽選・二重報酬を行わない。共通saveが失敗する環境での永続化保証や、未閲覧結果receiptの新設は本変更の範囲外。

## 作業境界

本人が2026-10-19のこの依頼に限る実装予約省略を明示許可。予約成功を偽装せず、既存owner／bot台帳は変更していない。最新main a97160aeから独立ブランチで作業。#699のstate・制作工程、#694の炭・授業、#586の商品素材には触れていない。
