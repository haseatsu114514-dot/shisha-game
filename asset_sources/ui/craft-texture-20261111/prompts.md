# シーシャ作りの「CSSで作った感」をなくす質感の方向の見本（CSL18）Codex用

2026-11-11。オーナー「CSS使ってます感が強い見た目は嫌だ　シーシャ作りパートも」。

今のシーシャ作りのUIは「夜紫の平らな面＋細い線」です。絵の部品（`../craft-night-20261102/`・`../craft-stage-20261110/`）も、その見た目に合わせて「flat game UI parts」として作りました。なので、同じ画風の部品に差し替えても CSS っぽさは消えません。**先に素材感の方向を決めます**。

この依頼で作るのは、方向を選ぶための見本4枚だけです（2方向×2画面）。ゲームには入れません。方向が決まったら、部品ごとの依頼文を別に作ります（実装側の仕事）。

- 下の**コードブロックをそのまま Codex へ貼ります**。
- 参照画像は今の画面の撮影です（1280×720）。**灰色の四角は既存の絵（人物・シーシャの機材・ライバルの顔）の場所**で、灰色のまま残してもらいます。
  - 機材は描かないので、`docs/shisha_reference.md` §4（機材が写る画像の必須手順）の対象外です。
  - 灰色の所に何か描かれた見本は、作り直してもらいます。
- 日本語の文字は、見本では崩れても構いません。位置と大きさだけ保ちます。

## 作る見本

| # | 保存先 | 参照画像 | 方向 |
|---|---|---|---|
| 1 | `mock/pack-A.png` | `refs/pack-masked.png`（詰め方） | A: 木と真鍮 |
| 2 | `mock/pull-A.png` | `refs/pull-masked.png`（吸い出し） | A: 木と真鍮 |
| 3 | `mock/pack-B.png` | `refs/pack-masked.png` | B: ガラスと革 |
| 4 | `mock/pull-B.png` | `refs/pull-masked.png` | B: ガラスと革 |

## Codexへ貼る依頼文

```
あなたへの依頼: シーシャ作りの画面の「見た目の方向」を選ぶ見本を、内蔵の画像生成で 4 枚作ってください（1 回に 1 枚）。
- 各画像は、指定の参照画像を添付し、「COMMON の段落」＋「その方向の段落」を、この順でそのまま英文のプロンプトにする。要約・言い換え・追記をしない。
- 出力は横長 16:9（1536x864、または 1536x1024 を上下で切って 16:9）。加工せず、指定の保存先へ保存する。
- 保存後、asset_sources/ui/craft-texture-20261111/README.md の「見本の記録」の表に 1 枚 1 行で、ファイル名・ピクセル数・bytes・SHA-256・CHECK の結果を書く。
- 各画像の CHECK を原寸で確認し、1 つでも外れたら同じプロンプトで作り直す（3 回作ってもだめなら、どこがだめかを README に書いて次へ進む）。
- 新しい画像は Git LFS になる（git add のあと git lfs ls-files で確認）。本編のコード・CSS・既存の画像は変更しない。
- 終わったら最新 main から作った branch で PR にし、4 枚を本文に並べる（A の 2 枚、B の 2 枚）。

=== COMMON（どの画像でも先頭にそのまま置く）===
Edit the attached screenshot of the hookah-crafting mini-game of a Japanese shisha-bar visual novel (16:9). Keep the exact layout: every panel, card, tag, button, the top step rail, the vertical thermometer, the semicircle dial and every piece of text stay in the same positions and sizes. The flat mid-gray rectangles are placeholders for existing artwork: leave them as flat mid-gray rectangles, draw nothing inside them, and do not draw any hookah, bowl, charcoal, hose or person anywhere in the image. Keep the Japanese text in the same place and size; do not translate it and do not add new text. Repaint only the interface. Right now it looks like flat web CSS: flat translucent purple rectangles, 1-pixel outlines, pill shapes, plain circles and flat gray buttons. Turn every one of these into tactile, hand-crafted game UI made of real materials, with visible thickness, bevelled edges, soft contact shadows, fine surface texture and subtle wear, like the menus of a premium Japanese console or mobile game. Keep the night shisha-bar mood: deep purple surroundings with warm amber lamp light. Do not use flat colour fills or thin uniform outlines anywhere in the interface.

=== 方向 A（木と真鍮）===
Materials: dark oiled walnut boards and trays with a thin inlaid brass edge. Labels and tags are engraved brass name plates. The top step rail is a brass bar with small numbered brass coins; the current step is a polished coin that catches the light. Choice cards are wooden tiles; the selected one glows warm amber from behind, like a lamp under frosted glass. Buttons are thick keys of polished brass or amber glass. The semicircle dial face is coloured enamel set in a brass ring, and the thermometer housing is brass.

=== 方向 B（ガラスと革）===
Materials: smoked frosted-glass tiles with etched, bevelled edges, set into deep plum leather panels with fine stitching, with copper corner caps and rivets. Tags are small copper-framed glass plaques. The top step rail is a copper wire with round glass beads; the current step bead glows violet. Choice cards are glass tiles; the selected one is lit by a soft violet neon rim. Buttons are thick glass keys in copper frames. The dial face is coloured glass segments in a copper ring, and the thermometer housing is copper and glass.

--- 1/4: asset_sources/ui/craft-texture-20261111/mock/pack-A.png ---
参照画像: asset_sources/ui/craft-texture-20261111/refs/pack-masked.png ／ プロンプト: COMMON ＋ 方向 A
--- 2/4: asset_sources/ui/craft-texture-20261111/mock/pull-A.png ---
参照画像: asset_sources/ui/craft-texture-20261111/refs/pull-masked.png ／ プロンプト: COMMON ＋ 方向 A
--- 3/4: asset_sources/ui/craft-texture-20261111/mock/pack-B.png ---
参照画像: asset_sources/ui/craft-texture-20261111/refs/pack-masked.png ／ プロンプト: COMMON ＋ 方向 B
--- 4/4: asset_sources/ui/craft-texture-20261111/mock/pull-B.png ---
参照画像: asset_sources/ui/craft-texture-20261111/refs/pull-masked.png ／ プロンプト: COMMON ＋ 方向 B

CHECK（4 枚とも）:
- 参照画像と同じ配置（上の工程の列・左の柱・中央の面・下の札とボタン・右上の「？」）。大きく動いた部品がない。
- 灰色の四角が灰色のまま残っている。シーシャの機材・人物がどこにも描かれていない。
- UI の面・札・ボタンに、平らな塗り・均一な細い線・角丸のピル形が残っていない（素材の厚み・縁・影がある）。
- A は木と真鍮、B はガラスと革に見え、2 つの方向がはっきり違う。
```

## 受け取った後（実装側）

1. 4枚をオーナーに見せて、方向を選んでもらいます（どちらでもない・混ぜる、も可）。
2. 選ばれた方向で、部品ごとの依頼文を作ります。
   - 部品: 選ぶ札（3状態）・大きな面の枠・説明の帯・柱の札・工程の列と数字の玉・「？」の札・二番手のボタン・ダイヤルの面・一言の板。
   - 今の `craft-stage-20261110/prompts.md` と同じ形で書きます。
3. 部品を九分割で当てて、CSS の平らな面と細い線を消します。
4. シーシャ作りの次は、新版（会話・地図・MENU）にも同じ方向を広げます。LK の作業と重ならない順で進めます。
