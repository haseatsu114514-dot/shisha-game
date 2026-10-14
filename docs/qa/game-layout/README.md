# 本編2画面の可逆な表示試作（#554 / Draft #555）

保存されたタイトル版 `51bc6455226b377884b036b7ed2ce6e06f10b10a` の既存ブランチを継続。
原画・台詞・設定・料金・進行・保存schemaは変更しない。確認までマージ・公開しない。

正式transfer run38535546994 → そのrun指定のstatus38535708922 SUCCESS。
旧担当の停止はオーナー確認済み。元環境へのアクセスがなく未コミット/未push差分は未確認。
GitHub保存headとこの環境のcleanブランチのみ回収し、追加差分の不存在を断定していない。

## 起動と復旧

ルートで `python3 remake/tools/serve_preview.py --port 8123`、`http://127.0.0.1:8123/remake/`。
タイトルで「DS風」を選びNEW GAMEまたは既存のLOADを使う。本編上端でも通常版/DS風を切り替えられる。
PCは左右、スマホ縦は同寸の上下と10pxの隙間。上は既存背景・立ち絵・作業風景、下は同じ会話・選択・操作DOM。
ゲーム進行・入力・保存処理は既存モジュールを一つだけ使用。DOMの複製・移設を行わない。

復旧は `?titleLayout=normal`。通常タイトルを優先し、ゲームセーブを書き換えず、保存されたDS設定にも優先する。
表示キーは従来の `suien_title_layout` のみ。ゲームのsave/configと別。不正値や読書き不能では通常版。
DS用CSSが届かない本編も通常の寸法へ戻し、復旧入口を残す。

## 対応範囲と境界

会話本文・3択・AUTO/SKIP/LOG/用語、日常のピン地図・tonariサブメニュー、既存の一台通し練習・工程の結果、日常精算・MENUからのセーブ/ロード。
制作の操作パネルは元の座標/文字/押す大きさを保ち、下画面を縦横スクロールして触る。全面的なレスポンシブ化ではない。
完成後の結果は既存の制作記録と日常の行動枠精算。新しい結果画面・スコア・セーブ項目は足していない。
HUD体力カードの表示はDSでは省き、既存のステータス操作から確認する。

TRPG・街歩き・ショップ・大会固有画面など未対応の画面は通常表示に戻す。上端にその旨と復帰入口を表示する。
画面転換・通知・初登場の演出は既存の全画面レイヤーを使用する。全章のDS化・実機Safariは未検証。

## 検証方法

```sh
BASE_URL=http://127.0.0.1:8123/remake/ CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/game_layout.mjs
BASE_URL=http://127.0.0.1:8123/remake/ CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/title_layout.mjs
BASE_URL=http://127.0.0.1:8123/remake/ CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/save_load.mjs
```

ブラウザcontextは使い捨て。旧schema14を本来のLOADへ渡し、実モジュールで過去の未読場面を読んで日常へ到達する。
PC/タッチ・通常/DSの4通しで、実地図→tonari→配合/パッキングの実入力→一台制作→2回調整→記録と1行動の精算→手動保存→実再読込LOADを検査。
タイミング工程だけは既存 `craftTest.auto="good"` を使う。手動で全工程を完走したと主張しない。
所持金・関係・既存読了の維持、制作回数/成功/提供/配合/調整数/slot、表示切替によるstate不変、復旧URL、CSS欠落、2画面の同寸・間隔・実3択をassertする。

初回の新テストはturboの自動選択と手入力が競合し、旧セーブ再開で実読了が追加される期待値と不一致だった。
自動会話を止め、読了後を比較基準にし、再読込完了を待つよう修正。画面位置の検査で見つかったCSS優先順位も修正。
タッチ通しの途中版で、会話枠の自動スクロールにより座標が(0,0)へ移り、固定の通常版ボタンにタップが当たって失敗した。入力ログと[失敗JSON](initial-touch-failure.json)、[失敗画像](initial-touch-failure.png)を保存。
外側のステージはclipし、操作パネルの内部だけをスクロールする。短い縦画面の外側スクロールは64pxの入口を除いたviewportへ限定する。切替/場面変更時は外側スクロールを戻す。LOAD直後の寸法変化を防ぎ、会話入力は表示完了を待つ。ケース間の画面/入力もブラウザごとに分離した。

最終ローカル検証：本編9ケース、タイトル18ケース、既存save_load6ケースすべてPASS。通常復帰後のMENUと、会話中のキーボード切替も検査した。未読場面を持つ旧オートセーブの起動でもDSの会話・復旧入口・所持金/好感度/読了データを確認。

- [本編9結果](game-results.json)、[タイトル18結果](title-results.json)、[追加旧オートロード検査](auto-regression-results.json)、[実行ソースと不変の本体SHA256](source-sha256.json)。
- 保存回帰6件：全枠、旧schema自動/手動、不正JSON、PC、タッチ、通常版の縦持ち案内。
- PNGの全デコード/寸法、構文、文書リンク、diff/Git SafetyがPASS。workflowはYAMLパース確認。actionlintは未導入。
- 最終headのCI・レビュー・競合はPRへ記録。ローカル成功をCI成功と混同しない。

| 比較 | 通常版 | DS風 |
| --- | --- | --- |
| PCのマップ | [通常](pc-normal-map.png) | [左右](pc-ds-map.png) |
| PCの制作 | [通常](pc-normal-mix.png) | [左右](pc-ds-mix.png) |
| スマホのマップ（通常は横、DSは縦） | [通常](touch-normal-map.png) | [上下](touch-ds-map.png) |
| スマホの制作（通常は横、DSは縦） | [通常](touch-normal-mix.png) | [上下](touch-ds-mix.png) |

会話と3択は[PC](pc-ds-conversation.png)／[タッチ](touch-ds-conversation.png)、精算後は[PC](pc-ds-result.png)／[タッチ](touch-ds-result.png)。
[短い操作動画](touch-walkthrough.mp4)は無音・2倍速。旧セーブから読了、通常復帰/DS再選択、配合と詰めの実入力、制作・精算・保存/実ロード・復旧URLを含む。タイミング工程は上記の既存autoを使用。[録画原本のハッシュと変換方法](video-source.json)も保存した。

通常復帰後の入口は中央上へ移し、従来の右上MENU/LIMEを覆わない。会話のEnter/Spaceを入口のネイティブ操作と分離する。短い縦画面の外側スクロールも、通常復帰/場面変更時に0へ戻る。

実機Safari・新規開始から全章通し・手動で全タイミング工程を完走する検証・未対応画面のDS化は未実施。予約は確認待ちとして保持し、公開・マージしない。

## 再引き継ぎとCI打切りの確認

保存head `14e437d6c98bcffa5ad649044a56e670991b115c` を維持し、同headの既存画像・動画・ソースhashを照合して一致を確認。実装・画像・会話・進行・保存形式とテストのassertionは今回変更していない。正式transfer38571421315／同run指定status38571679526のSUCCESSとowner/Issue/run実ログ一致後に継続した。現task ownerはcodex-review554-20261014-f86710a7。施設ownerとは同じチャットの別タスクIDで、複数タスク保持は所有者の今回限りの明示例外。双方のブランチは混ぜず、Draft・予約を保持する。

[キャンセルの証拠と変更範囲](cancel-diagnosis.json)。run38561221826は上記head、attempt1。chromiumのcheck annotationに「The job has exceeded the maximum execution time of 30m0s」、終了ログに「The operation was canceled.」を確認。最終developer-tool検査まで到達し、同runの可逆表示/前夜/単工程jobは成功している。エージェントの利用制限と同じ原因とは断定しない。

本編ソースを変更せず、フルブラウザjobの実行時間上限だけ30→40分にした。テストの削除、期待値・数値許容幅・ゲーム内タイマーの変更はない。既存タイトル18、本編9、保存6の同一ソース再検証と、新しいheadの最終CI結果はPR #555／Issue #554のコメントで対象SHAと共に記録する。旧headの成功を新headの成功として扱わない。

元担当の別環境の未commit/未追跡/未pushはアクセスできず未確認。停止は所有者申告が根拠であり、直接live status照会済みとは記録しない。実機Safari・全章手動通し・施設とDSの統合QAは未実施。新しい画像生成は行わず、既存の比較画面と操作動画をそのまま再利用する。マージ・公開・Issue終了は行わない。
