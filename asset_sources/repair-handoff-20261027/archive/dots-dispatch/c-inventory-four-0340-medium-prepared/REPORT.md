# 4件ローカル棚卸し結果

ネット通信0、画像生成0、本編・原画像・共有画像選定入口・SAVE変更0、外部公開0。既知Chrome/ps/TLS/Library等の拒否操作は再試行していません。A1044/TRPGのworker・browser・通しプレイは操作していません。現在mainは取得せず、各保存時SHAを基準として現在とは区別しました。現担当はrootの起動receiptと対象保存資料のみ照合し、記録外の手動作業・未保存成果の不存在は断定していません。変更はこの独立フォルダのレポート/台帳/HTMLだけです。

| 対象 | 実数と結果 | 残る不足 |
|---|---|---|
| 制作UI16工程×3 | 現在案35・保存旧版7＝実画像42、原画23。48枠との差は13。全画像と台帳path/hashを照合、一致 | 現在の本人採否・本編反映未照合。保存時implemented/adopted=falseを現在の採否へ流用しない |
| Issue544設定資料 | 限定探索ではWord/PDF・編集元実体0件。旧資料所在の履歴と設定更新残件を記録 | 正確な既存Word/PDF/編集元/生成手順/Issue本文の所在。文書内容・ページ表示・現在設定との実差分は未確認 |
| CONTINUE10案 | GO-01〜10、対象制作フォルダの画像0。既存「生成0/参照不足」報告を回収 | 現行採用のCONTINUEとGAME OVER全画面＋撮影HEAD/人物参照。不足を背景単体・救済機能コードで代用しない |
| 告白7枚 | AGE-A、SAME-A/B、HIYO-A/B、MAS-A/Bの7PNG・15,866,437B。保存SHA一致 | 保存時は未採用。その後の本人採否/現在main接続は不明。全未採用と現在断定せず、採否未照合として比較 |

## 制作UI

CRAFT-48.jsonに48固定枠＋旧7版、工程、版、原画/比較path、現在hash、保存時hash、採否根拠、本編反映未確認、欠落、重複内容を収録。水入れwater・機材setup・packingは独立。会話UI15/別大会UI15は対象外です。工程内のstandings/countdown/final-vote/resultは元16工程の一部であり別大会15案の混入ではありません。

欠落13枠はcare-A、standings A/B/C、countdown A/B/C、final-vote A/B/C、result A/B/C。care-Aの旧版は存在しますが現行枠の生成済みには数えません。旧版7は作者台帳の現行候補除外で、本人による不採用決定とは区別しています。design/scene-inventory.jsonのmockups欄には古い未生成表記が残るため、更新済capture-manifest.jsonのcurrent/legacy対応と実ファイルを採用した棚卸しです。

比較: [craft-comparison.html](craft-comparison.html)（実在42枚のみ）。未生成枠には架空imgを作りません。

## 設定資料

ISSUE544-INVENTORY.jsonとISSUE544-UPDATE-PLAN.mdへ限定探索範囲と更新計画を保存。読取cacheのowner_requests.mdはCL06で旧setting_book/setting_reference.html/生成ツール削除、SRV03で第3章題「嘘つきたちの夜 / SMOKE AND MIRRORS」の#544編集元/Word/PDF更新を残作業と記録しています。歴史的な作成記録から削除済み資料を復元せず、既存編集元が判明してから現在設定との最小差分を作る計画です。Word/PDF実体を見ていないため文書内容やレイアウトの検証済みとはしていません。

## 告白

CONFESSION-7.jsonで原画7件のpath/hash/寸法と既存QAを収録。既存QAの再目視反復は行わず、今回は画像デコードとバイト整合のみです。保存時f03b0eb3の台本はあげは/ましろにshow_cg呼出があり、対応manifest登録なし。サメ/ひよりは同告白CG呼出なし。これは現在main接続状態の断定ではありません。

ましろは本人の夜指定を保持。保存時night patchはlocal candidateのみ。受諾後の「翌日の昼下がり。」は別場面として有効で、夜CG表示区間がそこまで続く可能性を採用時の表示cue確認事項として残しました。コード/台詞を変更していません。AGE-Bは既知出力拒否の未生成として別管理し、再試行なし。親Library未転送素材を取得済みとは扱いません。

比較: [confession-comparison.html](confession-comparison.html)（現在採否未照合の7枚だけ）。

## 検証と基準

原画23＋候補49＝72画像のPNG等読込、SHA、ファイル所在、候補ID重複、HTMLの相対リンクを確認。node --checkと制御DOMによるロード失敗表示callbackは成功。初期HTMLにカードとリンクが全てあり、JSなしでも一覧を利用できます。実ブラウザ/ゲーム/PCtouch/LOAD表示は未実施で、制御DOMやデコード成功とは区別しています。

基準はBASELINES.json。制作UI a76749f0（2026-10-23保存）、設定資料5ae6bedeの既存cache、告白f03b0eb3（2026-10-25保存）。AGENTSはローカル保存版a21f6ec3を読取一致、最新main同一性のネット照合はしていません。Grok mtime1792584352.0097418は開始/終了とも不変です。

次の入力は、#544の正確な資料所在と、現在の本人採否/接続を示す新しい保存receiptです。CONTINUE制作には現行全画面参照が必要です。今回は不足画像や資料を新規制作・転送して埋めていません。
