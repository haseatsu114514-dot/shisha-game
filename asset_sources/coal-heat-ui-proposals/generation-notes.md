# 生成条件と採用境界

## 共通条件

画像生成ツールでA・B・Cを独立した横長のゲーム画面として制作。参照した画像：

- 現行の炭焼き画面 `current-heat.png`（この作業で実ブラウザーから撮影）
- 採用済み `remake/img/ui/making/hajime_craft_heat.webp`
- 採用済み `remake/img/ui/making/stove_coil.webp`

生成指示の要点：

> Japanese indie game 水煙前線 -EN:CODE-. A single landscape gameplay UI mockup, not a browser, poster or diagram. Preserve the dark purple, charcoal black, restrained brass/silver and pixel-painter identity. Preserve the approved protagonist: black steam-mark cap, warm brown eyes, black hoodie, necklace, stainless tongs. Three tactile porous charcoal pieces on one electric stove in a separated triangle; dark texture, red-hot fissures, thin grey ash, one pinpoint white-gold core flash. Subdue the coil to deep red so the flash is the strongest local light. Watch the coal and directly take it at the flash. No gauge stopping, continuous progress rings, rhythm lanes, flipping, fuel adjustment, dragging or giant TAKE button. No result text over live coal. No hookah, bowl, HMD, real brand, extra character or watermark.

人物の実物参考ではなく、正規の人物イラストと既存のゲーム素材を参照。シーシャ描写の早見表・機材ガイド・炭近接資料を読み、炭は小さい角炭・灰と赤熱を区別する。生成モックにシーシャ本体・ホース・ボウル・HMDは要求していない。

## 案ごとの生成指示

### A：熾火クローズアップ

> Retain the six-step 64px top HUD, charcoal step active, small score. Narrow 275px left protagonist scene in TONARI with mosaic lamps and compact existing dialogue. Wide right stove close-up on dark purple surface. Title 炭焼き, instruction 芯が光ったら、炭を取る. Tiny numbered charcoal tags, pinpoint flash. Metallic tongs cursor from the right without occluding coal. Metal collection tray with three empty recesses, 取り上げた炭 and 0 / 3. Small illustrated four-state legend. Avoid blank panels and repeated status cards. Physically handling hot charcoal is the focal experience.

### B：スポットガイド

> Same compact top HUD and narrow left character scene. Larger higher-view stove, three separated coals on one coil. Silver corner brackets indicating generous invisible hit areas; number tags below the art. The perfect charcoal alone has brighter brass brackets and 今. No advance countdown or gauge. Compact 見る → 取る hint. Narrow collection tray below. Cooler violet/silver with focused amber. Coals are not separate cards.

### C：ワンシーン演出

> Remove split scene and minigame panels. One TONARI room with mosaic lamps, dim warm light and shared dark wooden workbench. Approved protagonist on the left, one stove on the right, three distinct coals on its coil, tongs directed toward it. Unobtrusive top six-step HUD, charcoal active, small score. Compact title and instruction. Small collection tray at upper right. Slim existing dialogue at lower left, no coal covered. One coherent camera/perspective with local charcoal bounce light.

## 画像の扱い

- Aの初版はコイルの赤が強く、炭への注目を妨げたため不採用。再編集でコイルの輝度を約65〜75%下げる指定をし、暗い赤のコイルと明るい炭の芯へ分離した。その他の構図・UI・人物・炭・回収皿は維持する指示。初版3案は `iterations/v1/` に保存し、比較ページはAの修正版を使う。
- A修正の指示："ONLY REDUCE THE BRIGHTNESS OF THE ELECTRIC HEATING COIL behind the charcoal by roughly 65–75%. Deep dark wine-red ember color with a narrow dim orange trace. Keep the charcoal's core flash and orange fissures bright, the strongest light on the stove. Keep the same layout, text, character, charcoal, tongs and tray. Not a global color filter."
- 原画は3案とも1672×941。現行の実画面キャプチャーは1280×720。いずれも横長のゲーム画面構図で、比較ページの拡大表示から原画を確認できる。
- 生成結果は静止モックの原画としてPNG保存し、本編アセットやmanifestには登録しない。
- 文字や機材の位置は画像内の構図案。実装では文字・番号・判定・回収個数をDOMで描き、実際の入力・判定・所持状態へ接続する。
- 生成された人物・手・トングは正式差分ではない。採用時は正規画像の本人性と手元・機材の縮尺を再確認して個別に制作する。
- 生成されたコイル・火の粉・発光を、ゲームの難易度や物理仕様として採用しない。
- 比較画像は、比較ページをブラウザーで表示して撮影したもの。原画を修正した画像としては扱わない。
