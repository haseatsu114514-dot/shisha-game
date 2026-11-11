# カードゲーム「一台勝負」の絵　第1弾（Codex用 画像生成プロンプト）

2026-11-11。オーナー「コーデックスの画像生成とかイシューに依頼出して使ってもいい」。
ゲーム内のミニゲーム「一台勝負」（`remake/ichidai.html`）に出す絵の第1弾。**卓の天板1・葉20・炭3 の24枚**。

- 下の**コードブロックをそのまま Codex へ貼る**（1回の生成で1枚）。
- カードの枠・名前・数字・温度の帯はコードが描く。**絵には文字・数字・枠を描かない。**
- 葉の絵は機材も人物も描かない。炭の3枚だけ、機材の必須手順（`docs/shisha_reference.md` §4）に従う。
- 置き場・変換・確認の手順は [README](../README.md)。

画風について: 卓の天板は現行の夜紫UI（[craft-night の style.txt](../../ui/craft-night-20261102/prompts/style.txt)）の文をそのまま使う。
葉と炭は「1つの題材の絵」で、UI部品用の文（正面・平面・小物を描かない）が合わないため、同じ色（夜紫 #150d22〜#2e1d45・ラベンダーの光 #c9a7e6・金の細い差し色 #e3bd6e）と
同じ描き方（ピクセル寄りの絵画調・一方向の間接照明・薄い煙）のまま、題材の絵用に書き直した STYLE-ART を使う。

## Codexへ貼る依頼文

```
あなたへの依頼: カードゲーム「一台勝負」のミニゲームに出す絵を、内蔵の画像生成で 1 回に 1 枚ずつ、24 枚作ってください。
先に asset_sources/card_game/README.md を読む（置き場・受け取った後の手順・確認のしかた）。

決まり:
- 各画像は「STYLE の段落」＋「その画像の段落」を、この順でそのまま英文のプロンプトにする。要約・言い換え・追記をしない。
- 1/24 は STYLE-UI（asset_sources/ui/craft-night-20261102/prompts/style.txt の全文をそのまま）、2〜24 は下の STYLE-ART を先頭に置く。
- 22〜24（炭）は、生成の前に非公開リポジトリ siryou の shisha-hardware-reference/web-refs/images/ にある炭の写真を開いて見る（渡せるなら参照として渡す）。
  プロンプトは「STYLE-ART」→「docs/shisha_reference.md 4.2 の英文をそのまま」→「その画像の段落」の順にする。
  生成後は同 4.1 の炭の行と 4.4 で検品する。
- 生成した PNG は加工せず asset_sources/card_game/art-20261111/raw/<種類>/<id>.png に保存し、README の「原画の記録」に 1 枚 1 行で
  ファイル名・ピクセル数・bytes・SHA-256・CHECK の結果を書く。
- 各画像の CHECK を原寸で確かめ、1 つでも外れたら同じプロンプトで作り直す（3 回作ってもだめなら、どこがだめかを README に書いて次へ進む）。
- 24 枚を通して見て、葉 20 枚が同じ明るさ・同じ大きさ・同じ見る角度にそろっているかを確かめる。1 枚だけ浮くものは作り直す。
- 採用する絵を assets/ui/ichidai/<種類>/<id>.png に置き（加工しない）、python3 remake/tools/build_ichidai_art.py を実行する。
- python3 remake/tools/serve_preview.py --port 8123 を起動して http://127.0.0.1:8123/remake/ichidai.html を開き、
  準備の場の札・手札・炭ゾーン・卓の天板を画面で見て、README の手順 4 の 3 点を確かめる。その画面を写した画像を PR に貼る。
- node tools/ci/run.mjs --kind quick --suites ichidai-rules と node tools/ci/run.mjs --kind browser --suites ichidai を通す。
- 新しい画像は Git LFS になる（git add のあと git lfs ls-files で確認）。ゲームのコード・CSS・既存の画像は変更しない
  （変わってよいのは remake/js/minigames/ichidai-art.js の一覧だけ。スクリプトが書き直す）。
- 終わったら最新 main から作った branch で PR にし、24 枚の一覧・CHECK の結果・画面の画像を本文に書く。

=== STYLE-ART（2〜24 の先頭にそのまま置く）===
Style: a small still-life illustration for a card in a pixel-painterly visual novel set in a stylish Japanese shisha bar at night. Painterly with a subtle pixel grain, soft shading in three or four tones and a clean readable silhouette; not photorealistic, not 3D, not anime line art. Deep night purple (#150d22 to #2e1d45) fills the whole background, with a soft one-directional lavender light (#c9a7e6) from the upper left and a faint warm ember glow from below; warm white (#f6f1fa) only for small highlights, muted gold (#e3bd6e) only as a thin rim accent. Calm, chill, dim indirect lighting, a subtle smoke haze drifting behind the subject. The subject keeps its natural colours, slightly muted, sits exactly centred, fills about 65% of the square frame, and is seen in a three-quarter view from slightly above; use the same size, light and angle for every image in this set. Plain background: no table edge, no extra props, no frame, no border, no vignette ring. Square 1024x1024. Never bake in any text, letters, logo, digits, icons or watermark.

--- 1/24: asset_sources/card_game/art-20261111/raw/table/counter.png ---
（STYLE-UI を先頭に置く）Create ONE empty bar COUNTER TOP seen straight from above, landscape 1536x1024, filling the whole image edge to edge with no frame and no background outside it. Dark stone with a very faint purple cast, an even fine grain, and a soft pool of warmer light in the lower middle that fades to darker corners. The surface must stay quiet and low-contrast, because game cards and text are drawn on top of it. Nothing on the counter: no objects, no shadows of objects, no reflections of lamps.
CHECK: 画像いっぱいに天板だけ／物・影・文字なし／模様が弱く、上に白い文字を置いて読める／四隅が中央より暗い。

--- 2/24: asset_sources/card_game/art-20261111/raw/flavor/lemon.png ---
SUBJECT: one whole lemon and one cut lemon half with two green leaves.
CHECK: レモン1個と半分だけ／中央・約65%／背景は夜紫の無地／文字なし。

--- 3/24: raw/flavor/peach.png ---
SUBJECT: one whole peach and one peach wedge with a single leaf.
CHECK: 桃1個と1切れだけ／中央・約65%／文字なし。

--- 4/24: raw/flavor/mango.png ---
SUBJECT: one whole ripe mango and two cubes of cut mango.
CHECK: マンゴー1個と角切り2つだけ／文字なし。

--- 5/24: raw/flavor/blueberry.png ---
SUBJECT: a small heap of blueberries with two green leaves.
CHECK: ブルーベリーの小山だけ／葡萄に見えない／文字なし。

--- 6/24: raw/flavor/mint.png ---
SUBJECT: one sprig of fresh spearmint with six leaves.
CHECK: ミントの枝1本だけ／葉の縁のぎざぎざが分かる／文字なし。

--- 7/24: raw/flavor/ice_grape.png ---
SUBJECT: a small bunch of dark purple grapes covered in frost, with two ice cubes.
CHECK: 霜のついた葡萄と氷2個だけ／ブルーベリーと見分けがつく／文字なし。

--- 8/24: raw/flavor/cool_mint.png ---
SUBJECT: one sprig of mint lying on a small mound of crushed ice.
CHECK: 砕いた氷の上のミントだけ／6/24 のミントと見分けがつく／文字なし。

--- 9/24: raw/flavor/death_by_ice.png ---
SUBJECT: one tall jagged block of pale blue ice with cold mist flowing off it. No skull, no face, no symbol.
CHECK: 氷の塊1つだけ／どくろ・顔・記号なし／冷たい霧／文字なし。

--- 10/24: raw/flavor/double_apple.png ---
SUBJECT: one red apple and one green apple side by side, with a single star anise in front.
CHECK: 赤と緑のりんご各1個と八角1個だけ／文字なし。

--- 11/24: raw/flavor/cinnamon.png ---
SUBJECT: three cinnamon sticks stacked together with a little ground cinnamon beside them. No string, no ribbon.
CHECK: シナモンスティック3本と粉だけ／紐・リボンなし／文字なし。

--- 12/24: raw/flavor/cardamom.png ---
SUBJECT: a small pile of green cardamom pods, two of them split open showing dark seeds.
CHECK: 緑のカルダモンの莢だけ／割れた莢が2つ／文字なし。

--- 13/24: raw/flavor/black_tea.png ---
SUBJECT: one clear glass cup of amber black tea with a few dry tea leaves beside it. No saucer, no spoon.
CHECK: ガラスの紅茶1杯と茶葉だけ／受け皿・スプーンなし／文字なし。

--- 14/24: raw/flavor/rose.png ---
SUBJECT: a single garden rose in half bloom with two leaves and a short stem.
CHECK: バラ1輪だけ／花束にしない／文字なし。

--- 15/24: raw/flavor/lavender.png ---
SUBJECT: a small loose bundle of five lavender sprigs. No string, no ribbon.
CHECK: ラベンダー5本だけ／紐・リボンなし／背景の紫に沈まず見分けがつく／文字なし。

--- 16/24: raw/flavor/jasmine.png ---
SUBJECT: one sprig of white jasmine flowers with green leaves.
CHECK: 白いジャスミンの枝1本だけ／文字なし。

--- 17/24: raw/flavor/spring_water.png ---
SUBJECT: one clear glass of still water with a single droplet falling into it and one ring of ripple. No ice, no lemon, no straw.
CHECK: 水のグラス1つと水滴だけ／氷・レモン・ストローなし／文字なし。

--- 18/24: raw/flavor/vanilla.png ---
SUBJECT: two dark vanilla pods and one pale vanilla flower.
CHECK: バニラの莢2本と花1輪だけ／文字なし。

--- 19/24: raw/flavor/white_gummy_bear.png ---
SUBJECT: three translucent white gummy bears standing in a small group.
CHECK: 白い半透明のグミベア3つだけ／顔を描き込みすぎない／文字なし。

--- 20/24: raw/flavor/chocolate.png ---
SUBJECT: one broken bar of dark chocolate with two loose pieces. No wrapper.
CHECK: 割れた板チョコと欠片2つだけ／包み紙なし／文字・刻印なし。

--- 21/24: raw/flavor/coffee.png ---
SUBJECT: one small white cup of espresso with a few roasted coffee beans beside it. No saucer, no spoon.
CHECK: エスプレッソ1杯と豆だけ／受け皿・スプーンなし／文字なし。

--- 22/24: raw/card/flat.png（STYLE-ART → docs/shisha_reference.md 4.2 の英文 → この段落）---
SUBJECT: This image shows ONLY charcoal; do not draw the hookah, bowl, heat management device, tray, hose, tongs or any person. Three small FLAT rectangular coconut-shell charcoals, each about fingertip size and only half as tall as it is wide, lying flat and close together. They are covered with a thin coat of grey ash and glow red-orange only in the cracks and along the lower edges. No flames, no sparks, and no smoke rising from the charcoal.
CHECK: 平たい炭3個だけ（5個以上にしない）／厚みが幅の半分ほど／灰色の灰に少し赤／炎・火花なし／炭から煙が出ていない／台・ボウル・HMD・ホース・トング・人物なし／文字なし。

--- 23/24: raw/card/cube.png（STYLE-ART → docs/shisha_reference.md 4.2 の英文 → この段落）---
SUBJECT: This image shows ONLY charcoal; do not draw the hookah, bowl, heat management device, tray, hose, tongs or any person. Three small CUBE-shaped coconut-shell charcoals, each about fingertip size and as tall as it is wide, standing close together. They are covered with a thin coat of grey ash and glow red-orange only in the cracks and along the lower edges. No flames, no sparks, and no smoke rising from the charcoal.
CHECK: 立方体の炭3個だけ／22/24 と並べて、形（平たい・立方体）の違いが一目で分かる／灰色の灰に少し赤／炎・火花なし／炭から煙が出ていない／機材・人物なし／文字なし。

--- 24/24: raw/card/dense_flat.png（STYLE-ART → docs/shisha_reference.md 4.2 の英文 → この段落）---
SUBJECT: This image shows ONLY charcoal; do not draw the hookah, bowl, heat management device, tray, hose, tongs or any person. Three small FLAT rectangular charcoals, each about fingertip size and half as tall as it is wide, with very smooth, dense, deep black surfaces and sharp clean edges. Only a very thin dusting of pale ash, and an even red-orange glow along all the lower edges. No flames, no sparks, and no smoke rising from the charcoal.
CHECK: 平たい炭3個だけ／22/24 より表面がなめらかで黒く、灰が少ない／縁がまんべんなく赤い／炎・火花なし／機材・人物なし／文字なし。
```
