# Heaven10 runtime採用（#586 / Draft PR587）

ユーザー2026-10-16 04:23:41UTC「フレーバーはこれで行こう」。確認済みLibrary gallery `libfile_321f31ee40f88191bb7993e4b2b3c809` の最終10点のみを採用する。マージ・公開の許可は含まない。owner `codex-c-shop-art-20261016-8e7fb2cb0e`、元claim `38786636524`、thread `01a140d2-7791-7aa2-9b89-4ad03675a977`。

- 採用10: mint, double_apple, blueberry, strawberry, pineapple, lemon, orange, grape, watermelon, cinnamon。
- 原画は `../wing-only-heaven10-v6/outputs/<id>-wings-composite.png` の既存1254角RGBAそのもの。mint/apple/grapeはv3由来v5の同一bytes、残り7はv4候補原画の翼だけをコード合成した最終版。今回の統合で生成・再合成・原画変更は行わない。v6記録のsource-only表記はその時点の履歴として保存。
- 保留8: Dobaj vanilla/coconut/mango/peach/melon/banana、Absal rose/lychee。mainの既存 `remake/img/shop/flavors.webp` と同じ切出しを維持。旧cream個別候補は不採用。メーカー別新規案は今後の作業。
- HMD lotos_hagal/tanukish_lid/amaburst_hms は保留。runtime mappingから除外して従来の文字HMDを表示。原画・旧WebP・v2低突起案等は削除しない。
- 既存ボウル3/炭2、商品ID・順序・名称・メーカー・価格・効果・在庫・セーブ形式は変更しない。#437機材外観、他担当のくじ・斧・ダイス・共有CSSには触れない。

`adoption.json` は現在の10件と固定SHA/配信先、`inventory.json` は全26商品の現状。直下旧adoption21は履歴でありbuildには使用しない。`tools/build_shop_art.py` はコード上の明示10件whitelistと完全一致する選択だけ受け付け、原画SHAを照合して512角RGBA WebPを作る。q88/alpha_q100/method6、測定alpha bbox+2px、一覧66px/詳細112pxに88%の範囲で収める。配信は `remake/img/shop/heaven10/<id>.webp`、合計273,304 bytes。

```sh
python3 tools/build_shop_art.py
python3 tools/build_shop_art.py --check
python3 tools/test_build_shop_art.py
```

`--check` は一時フォルダで実際に全10点を再変換し、配信bytes・mapping・validationが同一か検証する。保留11件の追加/置換、旧source/hash/deliveryへの差替えはnegative testで拒否する。`validation.json` は原画/配信のdecode、RGBA、寸法、alpha、表示窓、SHA、容量。`preserved-native-pngs.json` / `preserved-data.json` は独立pre-edit240PNG/71dataの不変検証用。

画像は実imgのerrorイベントで採用画像→既存植物シート→「フレーバー」文字へ移る。欠落時も価格や購入ボタン、商品名は別のHTMLで維持。詳細・購入・保存のQA結果は `runtime-qa.json`。既存ゲームプレイ10ケース＋新規画像/旧セーブ/fallback9ケースPASS。目視で見つけた文字fallbackのはみ出し修正後は該当3ケースを再実行してPASS。`local-captures.json` はlocalスクリーンショットのSHA/パスで、画像自体はLibraryへuploadしない。旧cream21のスクリーンショット/結果は現在headの証明に使わない。
