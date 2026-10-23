# #711 保存前メタデータレビュー

2026-10-19。対象は `asset_sources/adam-eden-711-anatomical-20261019/` の README、inventory、adoption、recipe、before/after、`qa/asset-validation.json`。本番候補は読み取り専用で確認した。

**結論：確認範囲に保存を妨げる矛盾・ハッシュ不一致・ローカル参照欠落はない。最新headでのCIと実画面の確認は引き続き未実施。**

## 確認結果

- 左右の基準は本人左が緑、本人右が赤。正面では画面左が赤／右が緑、EDENの対のリンゴも同じ画面配置。横向きは解剖学的な左右に従い、青への置換や反転を行わない記述で統一されている。
- before 9点とafter 9点をデコードし、実bytes・SHA-256・Git blob SHA-1を再計算した。beforeはadoptionの元ハッシュおよびinventoryのbase-main入力記録と一致。afterはadoptionの出力記録および対応する本番候補PNGと一致する。EDENのPNG別名も同一bytes。
- 本番候補19パスの実ファイルが `inventory.output_files`、`adoption.runtime_outputs`、`qa/asset-validation.json` の3資料で一致する。各資料のパス集合も同一。記載された画像サイズ・モードも実デコード値と一致する。
- recipeの8入力blobはbeforeと一致し、8マスクは二値画像。各before/afterを再比較した変更画素数、サイズ維持、alpha維持、マスク外の不変性はasset-validationの記録と一致する。顔アイコンには既存256色再量子化によるRGB差の例外が明記され、立ち絵の顔画素保持と混同していない。
- 5立ち絵の旧previewとintroの旧v4原画との同一blob関係は、修正前のbase-mainに限定して記録されている。現在のafterを過去原画と同一とする記述ではない。EDENロゴは採用済みarchive/v1原画を保持する扱いで、後の候補シートへの置換はない。背景・大会CGの別生成archiveが未確定であることも明記されている。
- 正しいロゴ、実Adamの右向きレイヤー、章タイトル、および無関係な素材は保持扱い。`naru.png`が実Adam、`adam.png`が銀髪Naruという実体と名前の相違も正しく説明されている。保持対象8レコード・歴史資料23パスと出力19パスの重複はない。recipeの修正先は既存採用assetsで、他担当の過去原画・採用記録・不採用候補を出力先にしていない。
- README相対リンク17件とadoptionのevidence参照先は全てローカルに存在する。before/after、recipeのsnapshot・maskパスも解決できる。再現例の `--snapshot-inputs` は保存済みbeforeを読み、通常の実行で元blobの不一致を停止し、指定した別output-rootへ出力する実装と整合する。
- candidateとrelease採用が区別され、PC1280×720、横持ち844×390、最新head CI、スクリーンショット目視確認、最終競合確認の未完了が明記されている。`PR_HEAD_SHA`と実checkoutの`TEST_REF`を区別する説明もある。

## 確認範囲の限界

今回、新規通信・原画編集・追加の大きな画像目視検査・ブラウザ実行は行っていない。外部URL8件のHTTP応答は再取得していない。main固定の過去資料リンクは記録されたcommitとパスに基づく確認であり、未取得のselected-D原画や全ての保持WebPを新たにデコードしたという意味ではない。歴史資料の保持確認は候補出力との非重複に基づき、remote branch/treeの最終保存結果はrootの責任範囲とする。

## 確認したメタデータのSHA-256

以下は本短報作成直前に読み取ったbytesを特定する。後のCI追記などによる更新は別の確認時点となる。

| ファイル | SHA-256 |
| --- | --- |
| README.md | `dbf5c93963b8c9adcbdf9c7c9abff2e772829fa77160c7a0634e28023e391bbe` |
| inventory.json | `21cd9f2a8023513f4f480c7e62195c9740718d0a6827242ff7bb365ce756dd39` |
| adoption.json | `4fb37e83e9ed062aea73628241054c320af27e05a417e7a679c05529d6a10991` |
| recipe.json | `00f94a44a38af1fcb4fc8e6ea375632557b8b722482fe286bff95983302bae6c` |
| qa/asset-validation.json | `0c26128ce6a4b1cf095efe031f38db3205810b8098f5e626747eec94b8d9a09b` |
