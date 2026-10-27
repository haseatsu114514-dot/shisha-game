# プリクラ初回無料・再訪400円 / ソロ案

## 今回の成果

[Draft PR1066](https://github.com/haseatsu114514-dot/shisha-game/pull/1066) を保存。HEAD **e4e4aa3ff2562b59b8a7f8364ee8f7cb5dec52a4**、branch `codex/c-purikura-revisit-400-20261027`、base main `0ad0e797cde6236b339e805fa8c6836be3c4f23f`。

変更は3path（製品1/回帰1/既存CI登録1）。**初回無料の既存あげはとのサービスを作り直さず、以後1回400円**。モード/同行相手ごとに無料を復活させない。料金以外の新しい行動・体力・報酬なし。ソロ段階と追加素材は案のみ、画像作成0。本編main反映/採用/merge/Ready化0。

通常CI [40447619661](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/40447619661) はplan/quick/result成功。DraftのbrowserはSKIPで未受入。C追加作者のため別担当独立reviewが必要。実PC/touch/AUTO/SKIP/menu LOAD/ギャラリー表示の受入をCI緑で置換しない。

## 実装と確定位置

- `remake/js/chapters/ch2-purikura.js`：再訪のモード選択前と受取ボタンに400円表示。所持金不足は撮影前に案内、写真/支払/履歴は進めず、任意撮影を見送って既存の来店処理へ戻れる。
- 利用可能額は既存spendableMoneyから呼出し元の店代を確保した残り。**既存の帰宅切符200円と店代3000円を写真へ流用しない**。写真単体利用可能額0/399/400/401円、別に来店費込み3599/3600円を検証。実店舗訪問で所持金400円だけなら、来店代と帰宅代のため撮影できない場合がある。これを写真代400円の変更と混同しない。
- 全offerに同ownerの二重entry guard。await後にowner/章日slot/phase/Abortを照合し、signalをVNへ渡す。初回VN自体の未完では無料権と記念品を消費しない。正常初回の既存半分こ場面を完読する境界は保持。
- 再訪は受取modalの値がtrueの時だけ、在店ゲスト/資金を再確認し、400円・既存history・同来店offer stampを確定しsave。受取取消では0円/履歴なしで再試行可。辞退は既存どおりoffer stampだけで、正常写真完了数へ数えない。
- 神崎の挨拶は別の既存正常読了保存を維持。後続写真を取消しても正常挨拶を消さない。神崎写真のkeepsakeと既存写真/所持品/ギャラリー読取形式を保持。新flag/schema/移行/全state巻戻しなし。
- `remake/test/purikura_fee.mjs` と既存game-logicへの1commandのみ。registryの他entry/commandはJSON意味比較で全保持。workflow/timeout/assert削除変更なし。

なお現行初回サービスはあげはとの固定pairであり、今回初回をソロ選択へ再設計しない。最初の正常サービス後に選ぶソロも再訪なので400円。ソロ履歴は正常受取済みmode=soloだけで、画像再表示や同伴分をソロ回数へ混ぜない。

## 固定ソース・限定回帰

開始/公開前/終了でmain exact0ad0一致。対象元blob `c2c8d272b591880220f9bdbfced917bbaad237da`。SOURCE-RECEIPTS.json、FIX.patch、CANDIDATE-BLOBS.json参照。

同一期待の実export API回帰：**旧18PASS/29FAIL → 候補47PASS/0FAIL**。

実offer/keepsakes/travel-budget/purikura-photo/ryuji-visit/rulesと、公開statsから変更せず抽出した実addMoneyを使用。state/save・Map/JSON load・VN/modal/el/在店候補・busは制御port。本人SAVE/実localStorage/ブラウザは使っていない。実stats全体をVMで実行したという意味ではない。

確認範囲:
- 既存初回0/399/400/401/999999円無料、同来店二重確定なし、翌来店の400円。
- 再訪0/399/400/401、不足時に撮影sceneなし。店代/帰り運賃の確保、正常資源/slot/所持品不変。
- solo/pair/guest(REI/神崎)切替でも400円。正常履歴、隔離JSON再LOAD、同来店再表示、既存写真/他keepsakeの保持。
- 招待VN/モード/相手選択/撮影VN/受取待機のcancel/Abort/throw/owner差替。初回sceneのcancel/欠落/throw/Abort/owner交代、preabort。
- 同owner二重entry、同owner日付変更、受取取消後再試行、資金が受取中に変化、受取前にゲストが去るケース。例外後lock解放。神崎挨拶と後続写真取消の分離。
- 実code/driver構文2件PASS。初期baseline二重entry probeで2つ目の未解決Promiseを待つdriver不備がありexit13。第2entryを通常解決できるdriverに直した後、同一期待で最終RED/GREENを再実行した。deadline/timeout変更で通したものではない。

実browser/menu LOAD・画像可読・実音/可聴・実ギャラリーは未実施。Node47を実画面合格にしない。受入場面/別review/attachはATTACH-AND-REVIEW-REQUEST.json。

## ソロ進行・素材（未採用/未実装）

[SOLO-PLAN.md](SOLO-PLAN.md)、SOLO-PROGRESSION-AND-MATERIALS.jsonへ保存。

推奨は「恥ずかしい→慣れる/ハマる→腕組みドヤ顔のシュール」の3段階。初回/2〜3/4以降は例で、**本人指定の確定閾値ではない**。初回/以降だけの2段階代案もある。今回の製品は従来のsolo sceneと「一人で初挑戦！」を保持し、段階台詞/写真/カウンタはまだ追加していない。

現行manifest blob32046d7fには初回あげは、strip/soft/gal3種、神崎CGが登録。現在のstickerPhotoは人物smile立ち絵を表示。manifest配列/表情一覧だけで新しい腕組みや恥ずかしいポーズを検証済みとはしない。今回人物/CG画素のviewなし。

旧#947の2原画は既存receiptと正確localpath/bytesの存在を再確認。規格未達/未採用候補のまま保持し、現在の3登録stripへ対応するものと推定しない。旧4コマCG/人物参照の既存receiptも整理したが、現在採用正本との新たな画素一致は未確認。採用済み/候補/未確認を分け、画像を作り直していない。

将来最小素材案はS1/S2を既存表示と台詞で残し、S3の構図2案を比較して1枚採用。中間ポーズも必要なら2案×2場面=4出力。既存人物正本を制作前に実viewし、衣装/髪/顔を保持する。標準built-in image_gen以外へ送信しない。今回tool呼出0。

通信目安は2案10〜40MB、4案20〜80MBだが、参照枚数/出力寸法/圧縮/重複転送の厳密上限不明。**本日の画像通信免除はなく、実行前に別の対象別通信承認が必要**。今回は見積だけ、参照新取得/画像生成/Library/upload/採用0。

## 重複・作者・公開安全

今回公式PREFLIGHT12:54:50は短期残54%/週53%、Sol/medium対応、同SID重複0。START PID88658。Grok1792584352.0097418は開始/公開前/終了不変。実担当の不在は古いPIDのみで断定せず、既存公開PR12件/小Issue検索/対象ソース/関連local receiptを照合。専任の400円PR/Issueは検索範囲で未発見（全未報告workspaceが空という証明ではない）。#921の追加代金なしという旧本文は今回の本人明示料金指示でこの写真部分のみ置換。新Issue投稿なし。

A1065は`a1065-manual-pitch-play-revision-sol-medium`稼働資料と公開HEADba6cb4eeをread。DJ branch/checkout/config/未保存成果不触。1046手動writer/1050→1051→1058/1054→1057→1063の既存範囲へ混入なし。1052/1053/1059〜1062実行0、動機資料反復0。

最新AGENTS blob0ce35e32でAPI-only許可を確認。親main tree51957d30を保持し、3blobのみのtree7682306b、parentmainのcommit e4e4を作成。自branch期待main/forcefalseでref更新。他branch/directmain/force操作0。checkoutを使用していないのでroot/hooks/check_git_safetyは対象外で、実施済みと偽らない。

終了時API refはe4e4一致、公開3blobは全てlocal候補と一致、未pushコード0。新PR1066作成済みを再作成しない。native attach_artifact toolが未提供のため、rootへこの確定URLのattachを依頼する。自己review/Ready/merge0。独立review・最新通常CI・実受入・未解決/競合なし等の条件を満たすまではmergeしない。

通信は保守予算8MiBの小textmetadata/ソースのみ、3候補合計104983bytes。wire実測とは区別。media/全tree/依存/巨大log/artifactなど量不明の取得0。既知Chrome/ps/fileURL/LibraryTLS/root/CIjob/log/annotations/artifactの拒否反復/別経路0。新clone/環境/login/install/課金/high/秘密/DBコピー移動削除/恒久設定/保護変更0。新画像生成/本編画像採用なし。

MERGED: なし / PENDING: #1066(別担当review・実browser受入・root attach) / ISSUES: 新規なし、#921関連境界のみ / BRANCH: codex/c-purikura-revisit-400-20261027 / NEXT: exact e4e4の別担当review、通常browser受入。ソロ閾値/素材制作は別判断。
