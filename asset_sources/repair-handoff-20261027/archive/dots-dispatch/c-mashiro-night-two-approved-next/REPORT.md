# ましろ夜2案・夜台詞candidate

**今回2call/2画像成功保存・保存PNG全体目視済み。旧5枚＋今回2枚＝累計7画像（全未採用）。依頼8案の残1件AGE-Bは既知出力拒否のまま。** 再試行/変形/別経路0、旧5枚再生成/再目視QA0。

## 夜整合candidate

[private conversation quotation omitted]

最小案は `confession_mashiro.lines[0].text` 一箇所だけ、
「休日の昼下がり。ましろちゃんに誘われて、彼女の部屋に遊びに来ていた。」
→「夜。ましろちゃんに誘われて、彼女の部屋に遊びに来ていた。」

中立の夜とし、実callerに無い休日条件を追加せず、仕事後だったという履歴も創作しない。元のaccept/reject/choices/metadata/set_romance/報酬/flags/他台詞は完全保持。後半line20「……翌日の昼下がり。」は別の場面転換なので保持。callerのdaily/slot>=2も変更しない。candidate/data/dialogue/confession.jsonとNIGHT-ALIGNMENT.patchを保存。限定構造比較はJSON有効・1text以外全node同一・翌日保持でPASS。実runtime/PCtouch/LOAD検証ではない。

現在のshow_cg〜hide_cg区間は翌日場面も含む。新画像は当夜の受諾直後なので、実採用/接続時には翌日の行より前で夜CGを隠す等のcue整合が必要。翌日の本文を夜へ一律置換せず、calendarを勝手に進めない。NEXT-DAY-CG-CUE-NOTE.mdへ別受入事項として保存し、本編変更0。

## 画像

| 案 | 結果とQA |
|---|---|
| MAS-A | 1672×941 RGB opaque / 1,972,020B。近景、ましろの笑顔と腕に添える手が主眼。採用の2編み髪/金眼/ベージュknit/白リボンを保持。頭上が切れ、手元が下25%目安にかかるため要修正懸念あり |
| MAS-B | 1672×941 RGB opaque / 2,023,166B。少し引いた横寄り・夜の室内、頭全体とsage skirtが見える。頭上余白は指示10%に未達、手元も下寄り。採用判断前の比較候補 |

2枚計3,995,186B。生成tool返却のinlineと、コピー後のsaved PNGを通常view_image(detail=original)で実view。byte一致/SHA/PNG読込を確認し、元生成ファイルとtask outputの無加工版を保持。prompt全文はprompts/MAS-A.txt・MAS-B.txt。参照path/SHA/bytes/役割/main blobはREFERENCE-RECEIPTS.json、tool結果metadataはTOOL-RECEIPTS.json。下流image model名は返らないため推定しない。

現採用ましろ2PNGと夜home背景は公開blobと既存localcache一致後に実view。専用ましろ部屋はmanifestに無い。bg_home_nightは画風/夜の光だけの参照で、主人公の部屋をましろ所有の正史にしない。Bには本棚/額縁等の参考背景由来の見た目があり、間取り/私物の正史としては未採用と明記。寝具は新CGに描かれず、衣装露出や性的な演出を追加していない。

指が重なる部分は全形状を確認済みと言わない。会話枠は下25%の比較目安で実ゲーム測定ではない。新画像/台詞の実VN/合成PCtouch/Safari/LOAD受入は未実施、Chrome既知拒否再試行0。

## 比較・パケット

comparison.htmlは旧5枚の完了QAを再利用して新MAS2枚を追加。旧folderのcomparisonは無変更。SEVEN-IMAGE-INDEX.jsonに全7枚の既存/新規・出典とQAを区別。packet/asset_sources/review-candidates-20261024/confession-20261025には7原画の無加工copyとQA、今回prompt2、台詞patchを用意。コピーは生成数に含めない。全7枚15,866,437B。元画像も旧5原画も削除/加工しない。

今回の比較HTMLのブラウザ実表示は未実施。相対リンクを静的検査し、CSSで比率保持。GitHub公開停止は維持、新URL/PRなし。旧root/canonicalRoot不一致を修正せず、別root/API書込で迂回せず、commit/push0。本編manifest/SAVE/画像採用0。安全root整合後でも新台詞差分の独立review・必要実受入は別途必要。

## 親素材・安全・次手

炭は親dotが実物寸法調査中。本人の「flat厚み増・cube正方形」方針だけPARENT-MATERIALS-QUEUE.jsonへ保存し、寸法は創作せず旧16枚を保全、C生成/Library取得0。占い師E1/E2も親候補を保持、再生成/接続0。既知LibraryTLS回復証拠なし、再試行/別route0。凛既存CG再利用。

Grok基準mtime開始/各単位前/終了不変。画像通信は承認済8案40–120MB・上限未確定の残2案範囲のみ、非画像大容量へ転用なし。非画像は小text/metadataのみ。clone/newlogin/install/課金/high/秘密/forcepush/保護/TLS/security/sandbox変更0。GitHub書込/975再merge/B968診断/他writer操作0。実quotaエラーなし、別account/modelへ逃がさない。

次手: 本人が7候補を比較選定→必要修正は別指示で判断。夜台詞は安全root解消後に正確HEADへ限定差分・独立review・実受入を経て保存する。新night CGを翌日昼へ持越さないcueを採用時に検証。AGE-Bは停止を維持。
