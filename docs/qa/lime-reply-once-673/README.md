# #673 通常返信の一度だけの確定

実装・実クリック検証commit: `6b2540c8e89979943b969cac7de497cfb11fd383`。
base: `8a5bb15b839205ea13f7c6c83dbc9cf8e3acc79d`。
この記録の追加ではruntime/testを変更しない。実装blobは`results.json`に固定。

## 変更

通常返信の選択を受けた直後に、同じstate/画面か・未確定かを再確認し、
履歴・好感度・done/replyStateを最初の非同期待機前にまとめて確定する。
その後は吹き出し表示のみで、戻る/状態差替え後に次の演出や報酬処理を持ち越さない。
選ばず戻った返信は未確定のまま再開できる。好感度の定義値・倍率・端数、音、
招待分岐、ひよりイベント、保存schema、CSSを変更しない。

返信選択が確定する時点へ報酬の適用を移している。演出途中に閉じても、本編の
スマホcloseによる保存で履歴・報酬・確定状態が一緒に保存される。
途中reloadの保存保証や新しいautosave/receiptは追加していない。

## 実画面回帰

PC Chromium154、1280×720と横タッチ844×390（エミュレーション）。各ケースは新規contextの隔離セーブ。
初期準備以外は本番HUD→トーク→返信→戻る/閉じる/再入室を実click/tapで操作する。
`runItem`/onclickを直接呼ぶ操作を実画面再現に数えない。通常速度・通常motionで確認。

- 単発返信
- 送信直後の戻る/再入室
- 相手の「…」中の戻る/再入室（PC/タッチ）
- 相手の返答が出た後の戻る/再入室
- 演出中に一覧へ戻ってスマホを閉じ、HUDから再度開く
- 選択前に戻って、未確定の返信を再開する

全7ケースPASS、pageerror/failed resourceなし。選択済みの同じ返信ボタンは再入室時に存在せず、
古い待機処理が終わった後も数値と履歴は1回分。実操作でスマホを閉じた保存値も照合。

|記録|以前の二重確定|修正後の全7ケース|
|---|---:|---:|
|好感度（初期10）|12|11|
|端数（初期0.50）|0.20|0.35|
|自分の返信/相手返答|各2|各1|
|read/done|true/true|true/true|
|replyState|replied|replied|
|limeRead内の対象ID|1|1|

[以前の実画面・録画・比較値](https://github.com/haseatsu114514-dot/shisha-game/issues/673)。
[PC修正後](pc-after.png) / [タッチ修正後](touch-after.png) / [各ケースの値・実click時刻・保存結果](results.json)。
画面はゲームviewportと合成テストセーブのみで、認証/個人情報を含まない。

## その他の検証

- `node --experimental-vm-modules --test remake/test/lime_reply_once.mjs`: 9/9 PASS。
  本番phone全モジュールをVMで読み、二つの保留選択、古い選択、state差替え前後、
  未選択の中断、表示例外、0点、既存恋人倍率を制御した単体回帰。実画面試験とは区別する。
  同じテストは修正前の本番ソースで6件失敗し、二重確定と中断中の未確定状態を検出した。
- `node --experimental-vm-modules remake/test/lime_consistency.mjs`: PASS。
- `node --experimental-vm-modules remake/test/entry_phone_audio.mjs`: PASS。
- `node remake/test/browser/lime_evening.mjs`: PC/タッチ・未読/返信待ち/旧expired招待の4/4 PASS。
- 構文・diff whitespace・Git Safety: PASS。

ブラウザ実行例（リポジトリroot、既存依存/ブラウザ/cacheを使用）:

```sh
BASE_URL=http://127.0.0.1:8840/remake/ CHROME_EXECUTABLE_PATH=/usr/bin/chromium \
  ARTIFACT_DIR=/workspace/work/lime673-fix/browser-final \
  node remake/test/browser/lime_reply_once.mjs
```

ローカル検証サーバーは最新baseのコード/dataを配信し、同一Git blobと確認できた既存cacheの素材だけを再利用。
初回は顔アイコン1点のcache不足で5ケースがresource assertに失敗した。最新mainと同一の約50KBを
正規Git objectから用意し、7ケースを再実行してPASS。初回失敗は成功扱いしない。

実機Safari/iPhone、全章通しは未検証。新しい専用テストの手動実行結果と、PR自動CIの結果は区別する。
元音担当の未公開成果との重複リスクはユーザーが受容しているが、停止済み・全成果保全済みとは扱わない。
音の別作業・既存予約は維持し、当修正は通常返信の範囲に限定する。
