# ロード漫画7話の表示・比較確認

対象画像HEAD: `98a7f2cc22175feb8531f5b444263b3eaa438efe`。Draft PR [#2560](https://github.com/haseatsu114514-dot/shisha-game/pull/2560)。画像の採用・本編登録はしていない。

## 検証結果

実際の共通 `withLoading` に候補配列をローカル検証時だけ渡し、実際の `loading.css` と `base.css` で描画した。正式な漫画登録JSやゲーム状態は変更していない。使用した3ファイルは作業ブランチ基点・既存checkout・確認時の最新mainでblobが一致した。

- PC 1280×720、スマホ横844×390、スマホ縦390×844、DPR 1、Chromium headless。ブラウザーsandboxは有効（`chromiumSandbox: true`）。安全設定を変更していない。
- **21/21画面 PASS**: 2コマのデコード、1440×960、表示3:2、画面内、準備完了の読書待ち、Enterでの待ち解除。pageerrorは0。
- 実測コマ寸法: PC537×358、横約291×194、縦約347×232 CSS px。縦では実コードの1列表示へ切り替わる。
- 7話すべてのスマホ横・縦を原寸スクリーンショットで目視し、台詞3つ・読む順・顔や手・オチを確認。台詞は読み取れ、画面や枠による文字の欠けは見当たらない。PCは7話を計測・撮影し、ヌール・歓迎の長さ・朝の身支度の3話を目視した。
- 漫画下の補足文は横画面で小さい。現CSSの15px×ステージ倍率から約8.1px相当と推算される（文字そのものの実測ではない）。台詞より読みにくく、共通UI側の確認事項として残す。今回の候補だけで共通UIを変えていない。

[全21画面の計測](metrics.json)、[実行したハーネス](executed-harness.cjs)。実端末・Safari・本編シナリオからの面識解放・タップ送りの検証は未実施。これは共通描画経路のローカル検証であり、実機・全編通しプレイ成功とは扱わない。

| 話 | PC | スマホ横 | スマホ縦 |
| --- | --- | --- | --- |
| 靴の中の砂 | [PC](pc-noor-shoe-sand.jpg) | [横](phone-landscape-noor-shoe-sand.jpg) | [縦](phone-portrait-noor-shoe-sand.jpg) |
| 歓迎の長さ | [PC](pc-saif-welcome-carpet.jpg) | [横](phone-landscape-saif-welcome-carpet.jpg) | [縦](phone-portrait-saif-welcome-carpet.jpg) |
| 開く奥義 | [PC](pc-saif-anime-door.jpg) | [横](phone-landscape-saif-anime-door.jpg) | [縦](phone-portrait-saif-anime-door.jpg) |
| 話す準備 | [PC](pc-saif-listen-cushions.jpg) | [横](phone-landscape-saif-listen-cushions.jpg) | [縦](phone-portrait-saif-listen-cushions.jpg) |
| 小さな担当 | [PC](pc-rashid-small-control.jpg) | [横](phone-landscape-rashid-small-control.jpg) | [縦](phone-portrait-rashid-small-control.jpg) |
| 最高の一言 | [PC](pc-rashid-best-verdict.jpg) | [横](phone-landscape-rashid-best-verdict.jpg) | [縦](phone-portrait-rashid-best-verdict.jpg) |
| 朝の身支度 | [PC](pc-rashid-camel-brush.jpg) | [横](phone-landscape-rashid-camel-brush.jpg) | [縦](phone-portrait-rashid-camel-brush.jpg) |

## 余白の確認

**現表示で欠けがないことと、原画の4%安全余白への適合は別。** 複数の吹き出し外縁が4%未満に近い位置にあり、採用前に再構図または厳密な外縁測定が必要。配信用画像は原画全面の縮小で、切り抜き・fillはしていない。

[原画の近似測定](margins.json)は画像を変更せず、白い連結成分から吹き出しらしい領域を求めたもの。stride 4と6pxの外縁推定なので正確な輪郭測定やOCRではない。『朝の身支度』の空の雲2件は手動で誤検出と注記した。未検出の思考枠や重要な手の余白を完全に保証する検査ではない。[実行コード](executed-margin-analysis.py)。

| 話 | 採用前に直す／厳密確認する余白 |
| --- | --- |
| 靴の中の砂 | 両コマの吹き出し上端が約2%、右コマのはじめの左手も左端に近い |
| 歓迎の長さ | 左コマの吹き出し左右約2〜2.5%・上端約3.3%、右コマ上端も約3.3% |
| 開く奥義 | 左コマの返事の右端が約2.7%。右コマの主要吹き出しは近似測定で4%以上 |
| 話す準備 | 吹き出し上端と左コマの返事の下端が約2.5% |
| 小さな担当 | 左コマの上端と右コマの左端が約2〜2.5% |
| 最高の一言 | 左コマの「悪くない。」の下端が約2.5% |
| 朝の身支度 | 吹き出しの左端・上端が4%境界付近（近似3.7〜4.1%）。厳密確認が必要 |

## 比較の提案（採否ではない）

- **優先比較**: ヌール『靴の中の砂』。台詞と砂山の変化が強く、今回の依頼の中心となる本人がよく見える。
- **スハイルの優先2話**: 『歓迎の長さ』『開く奥義』。接客の明るさが大きな絵の変化と動きで伝わり、2本の型が違う。
- **ハリールの優先2話**: 『小さな担当』『朝の身支度』。小さな道具と大きな動物の対比、人物と動物の身支度の対比が、知識なしでも見える。
- **比較用に保留**: 『話す準備』は小物が多く、『最高の一言』は人物の口癖を知るとより伝わる。どちらも画像を削除・不採用化せず、別のオチの候補として残す。

全7話の状態は引き続き `candidate_unselected` / `registered: false` / `production_ready: false`。最終選別・画風統一・余白の修正や確認・実機確認を経て、採用は別判断とする。
