後続のユーザー指示による別表情の修正は [追加修正記録](../face-corrections-followup/README.md) を参照。この資料の「他表情は未変更」は先行2枚の修正時点の記録。

# あげは悲しみ：顎の黒白二重縁を修正

ユーザーが指摘した先行1枚 `sad` を標準image_genで全身から描き直し、ローカルの素材PNG・可逆WebPへ反映した。公開反映と最終版へのユーザーの見た目確認は未了。

[修正前／反映版の顔](sad-v1-face-compare.png)は白・灰・暗背景、150%・原寸・50%の比較。[全身比較](sad-v1-full-compare.png)、[実ゲーム・スマホ寸法](../../../docs/qa/portrait-jawline/runtime-review/ageha-after-844.jpg)、[全5表情の切り替え](../../../docs/qa/portrait-jawline/runtime-review/ageha-all-expressions.png)も確認した。

顎の強い黒線と明るい縁の重なりを弱め、肌から首を連続した絵として再描画。悲しい眉と口、頬に添えた手、金髪ツインテール、クマの髪飾り、チョーカーとネックレス、豹柄ジャケット等の衣装を維持した。別AIも肌の継ぎ目・片目だけの潰れなしと判定。ただし元より描線と陰影が滑らかで、頬と目が少し丸く柔らかい印象になる。元画素の完全維持ではない。

`sad-v1-source.png` は無加工の生成原画。人物高1390pxから既存の969pxへ均一縮小し、896×1200へ配置後、全体を左へ4px平行移動して足元を合わせた。前回不採用の顎の細帯合成は使用していない。全RGBAでPNG/WebP一致、足元差1px未満。通常・他3表情・顔アイコンは変更していない。

実参照とSHA-256は `generation.json`、生成指示は `sad-v1-prompt.txt`。元画像は `../jawline-cleanup/ageha-sad-before.png`。統合結果は [integration-check.json](../../../docs/qa/portrait-jawline/integration-check.json)。残る4表情の顎の濃さは点検一覧の修正候補として残す。
