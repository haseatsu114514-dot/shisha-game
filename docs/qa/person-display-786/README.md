# #786 人物表示の限定修正

Worker: `codex-c-task15-20261020-782-f3a71d8c`
Claim: [39435116120](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39435116120) completed/success、bot6292633706 owner/run一致確認後に実装。
Base: `0b708e26cd453711b2220753f446e1fc9e76fe7a`
Branch: `codex/c-786-person-display-f3a71d8c`

## 保存範囲

- `daily.css`: URLが`/face_hiyori.png`で終わるLIME画像だけ、円枠内の左paddingとobject-positionを調整。円枠・他URL・元画像は変更しない。32/28pxは3px、42pxは4pxのpaddingで顔を中央へ寄せる。
- `engine.js`: samechanかつvoice=korochanの表示文字列だけ「コロちゃん（腹話術）」から「コロちゃん」へ。他の名前・ID・台詞・状態処理は変更しない。
- 既存browserテスト2本は期待する表示名だけを更新。実行済みとは扱わない。

## 検証

通常のmacOS Chrome headless、隔離した一時profile、sandbox無効化なし。既存PNGと本番daily.cssを使う静的fixture。ゲーム全体は起動していない。

- 1100x1050と844x390の静的viewportで、32/28/42pxの円枠サイズ不変、全画像decode、対象URLのpadding/object-position、非対象URL controlの表示属性不変を確認（PASS）。タッチ入力の確認ではない。
- 比較画像を目視し、顔の位置が右へ寄り中央に近づくことを確認。元PNGは160x160・50360 bytes、blob `de682649aacc704c16df45eae5b65687de7b4dcd` と同一。
- 本番engine.jsの名前選択式をVMで評価。samechan+korochanは「コロちゃん」、samechan通常と別人物は既存displayName、地の文は空（4/4 PASS）。VN全体のブラウザ操作テストとは区別する。
- 対象JS/mjsの構文、diff whitespace、Git Safety PASS。検証コマンドの累計は数秒で、タスク合計30分上限内。
- 最初の静的fixtureでは本番base.cssのbox-sizingを再現していなかったため、その画像を成功証跡として使わず補正。最終fixtureは本番のborder-boxを再現している。

[比較画像](icon-crop.png) / [計測値](results.json) / [再現用HTML](fixture.html)

未実施: 実LIMEの一覧/通知/トーク操作、実機Safari/タッチ、既存samechan_portrait・playtest_uiの全browserスイート、独立レビュー、CI、公開確認。ChromeはCVDisplayLinkのOS警告を出したがexit0で画像とDOMを保存した。ページ全体のエラー0という主張はしない。

## 保留: 背景看板

初遭遇は`bg_shishark_preparing_night`。既存WebP209550 bytesを目視し、隣の紺のれんの文字欠けを確認。開店後`bg_shishark`のWebP244780 bytesにも同じ看板がある。両配信画像の確認だけで、画像編集・生成はしていない。#360の素材予約と未保存成果を保持し、担当への境界照合はissuecomment6292608776、回答未受領。

看板限定編集の案: 工事中原画2588398 bytesの取得と局所編集1回。生成出力は不明（仮にPNG1〜5MB、保証不可）。開店後も修正する場合は原画2762706 bytesと別編集1回が追加。原画は未取得。全面背景生成・大量参照取得・新顔生成・課金は行わない。素材範囲の調整と明示承認前は停止する。

## 保存・予約条件

上記のbranch保存後、親から今回の具体的な追加許可を受領: この記録だけをHEAD `[skip ci]` でcommit/pushし、CI未実施・背景未完・マージ禁止を明記した保存専用Draftを作成する。製品・検証差分は `e7fcf257f1d8e01d17e244c9ae05d2b2a49cb9a8` と同一。CI・Ready化・merge・公開・背景編集/生成は許可されていない。
そのDraftのremote headを照合して正式parkし、成功runと最新bot owner/run・保存head一致を確認後、#782を正式resumeする。#782のP2だけを最小修正・境界回帰後、既存Draftへfix commit `[skip ci]` で保存する範囲が今回の許可。各手続の完了前に次の編集へ進まない。別IDや無断releaseで一件制約を回避しない。
