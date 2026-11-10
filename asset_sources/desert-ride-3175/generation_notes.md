# サンドボード専用グラフィック候補（Issue #3175）

2026-11-11。素材候補のみ。ゲームへの組み込み、コード変更、PR は行っていない。

## 事前確認

- 生成開始前に 524,288 バイトのファイルを `/tmp` から本単元フォルダへコピー。コピー元とコピー先のサイズが一致し、SHA-256 も一致した。検証ファイルは削除済み。
- Issue #3175 とオーナー追記を確認し、[着手コメント](https://github.com/haseatsu114514-dot/shisha-game/issues/3175#issuecomment-6770890885)を投稿した。
- 現行 main の `remake/css/desert-ride.css` と、`remake/img/ui/desert_ride/` の昼の砂丘、`remake/img/ui/desert_ride_hud/` のパネル・カーブ看板、ラクダレースのボタン・ダッシュパネルを参照。明るい砂色、橙、クリーム、金縁、革・古銅の質感を合わせた。

## 候補一覧

全ファイルは `presentation/` の RGBA 透過 PNG。寸法はピクセル。右向きの看板とボタンは、左向きの画像生成結果を水平反転した派生画像。

| ファイル | 寸法 | 狙い |
| --- | ---: | --- |
| `presentation/sign_left_a.png` | 1199×1312 | 木柱と橙の看板。大きい曲がり矢印で方向を即読できる。 |
| `presentation/sign_right_a.png` | 1199×1312 | A 案の右カーブ版。 |
| `presentation/sign_left_b.png` | 1199×1312 | 古銅の菱形看板。砂漠の道路標識らしい輪郭。 |
| `presentation/sign_right_b.png` | 1199×1312 | B 案の右カーブ版。 |
| `presentation/button_left_a.png` | 1254×1254 | 革張りの丸ボタン。明色の大矢印。 |
| `presentation/button_right_a.png` | 1254×1254 | A 案の右操作版。 |
| `presentation/button_left_b.png` | 1254×1254 | 橙の角丸ボタン。濃色矢印で砂上でも見分けやすい。 |
| `presentation/button_right_b.png` | 1254×1254 | B 案の右操作版。 |
| `presentation/boost_a.png` | 1254×1254 | グレーの金属面と稲妻。待機中の灰色系に寄せる。 |
| `presentation/boost_b.png` | 1254×1254 | 円形の灰色面と加速翼・稲妻。発動感を強める。 |
| `presentation/jump_a.png` | 1254×1254 | 橙の角丸面と上矢印・砂丘。 |
| `presentation/jump_b.png` | 1254×1254 | 丸い橙ボタンと跳ねるボード。 |
| `presentation/land_a.png` | 1254×1254 | A のジャンプと対になる下矢印・砂丘。 |
| `presentation/land_b.png` | 1254×1254 | B のジャンプと対になる着地衝撃。 |
| `presentation/stick_base_a.png` | 1254×1254 | 革と真鍮の台座。中央は透明。 |
| `presentation/stick_knob_a.png` | 1254×1254 | A と対になる革の丸いつまみ。 |
| `presentation/stick_base_b.png` | 1254×1254 | グレー金属と琥珀色の目盛りの台座。中央は透明。 |
| `presentation/stick_knob_b.png` | 1254×1254 | B と対になるグレーの丸いつまみ。 |

## 再生成用の指示文

以下は画像生成ツールに渡した指示文。全件 `transparent_background: true`。右向きの4点は生成後に左右反転した。

### sign_left_a

> Use case: game asset. Transparent PNG cutout, isolated single roadside LEFT-CURVE warning sign for a bright Arabian desert sandboarding game. Front-facing, symmetrical rectangular amber-orange enamel plate with thick brass border, dark walnut wooden post centered below; one huge bold cream-colored curved arrow bending LEFT, arrowhead unmistakable; gold corner flourishes matching ornate cream parchment and camel-race brass UI. Hand-painted polished 2D game illustration, crisp silhouette, strong contrast at small size, soft dimensional highlights. No words, no digits, no emoji, no ground, no scenery, no shadow beyond object. Entire object visible centered with generous transparent margin. Actual transparent alpha background.

### sign_left_b

> Use case: game asset. Transparent PNG cutout, isolated single roadside LEFT-CURVE warning sign for bright Arabian desert sandboarding game. Distinct alternative: weathered dark bronze metal diamond plate with warm amber inset and rivets on a short sturdy metal stake; one very large ivory curved arrow bending LEFT with unmistakable arrowhead. Ornate but restrained camel-race brass UI details, polished painterly 2D game art, high contrast and legible at small size. Front-facing centered symmetrical silhouette suitable for horizontal mirroring. No text, digits, emoji, ground, scenery, cast shadow or background. Entire object visible with transparent margin. Actual transparent alpha background.

### button_left_a

> Transparent PNG game UI button, single centered round cushioned dark walnut leather and brass button, huge ivory LEFT arrow pointing left, no words. Warm desert arcade illustration with embossed gold rim, polished hand-painted 2D texture, strong contrast and legible at tiny size. Front-on symmetric border suitable for horizontal mirroring. No other objects, no scenery, actual transparent alpha background.

### button_left_b

> Transparent PNG game UI button, single centered rounded-square amber and terracotta enamel button with beveled antique brass rim, huge dark chocolate LEFT arrow pointing left, no words. Arabian desert sandboarding game, polished hand-painted 2D game asset, tactile raised surface, crisp silhouette, readable at tiny size. Front-on symmetric shape suitable for horizontal mirroring. No extra objects, no scenery, actual transparent alpha background.

### boost_a

> Transparent PNG game UI BOOST button, single centered rounded-square graphite gray brushed metal and dark leather button with aged brass rim. Large ivory stylized lightning bolt as main symbol, tiny legible word BOOST below in bold uppercase if feasible, silver highlights and tactile raised surface. Matches warm ornate desert sandboarding HUD, polished hand-painted 2D game art, crisp at small size. No other objects, no scenery, actual transparent alpha background.

### boost_b

> Transparent PNG game UI BOOST button, single centered circular charcoal gray enamel button with thick bronze rim and small orange glow accents. Huge ivory winged speed chevron and lightning emblem, small word BOOST below in bold uppercase if feasible. Pressable embossed tactile look, hand-painted polished 2D desert racing UI style, high contrast at small size. No other objects, no scenery, actual transparent alpha background.

### jump_a

> Transparent PNG game UI JUMP button, single centered rounded-square warm burnt orange enamel button with thick antique brass rim. Huge bold ivory UP arrow rising above a small curved sand dune, pressable raised tactile surface. Tiny word JUMP below if legible. Polished hand-painted 2D Arabian desert sandboarding UI, bright high contrast, no other objects, no scenery, actual transparent alpha background.

### jump_b

> Transparent PNG game UI JUMP button, single centered circular vivid amber-orange leather and enamel button with bronze rim. Huge ivory leaping board silhouette and UP arrow, visually clear at small size; tiny word JUMP below if legible. Warm sunlit polished hand-painted 2D racing UI, embossed tactile shape. No other objects, no scenery, actual transparent alpha background.

### land_a

> Transparent PNG game UI LAND button, single centered rounded-square warm burnt orange enamel button with thick antique brass rim, matching a jump control family. Huge bold ivory DOWN arrow pointing toward a simple curved sand dune, pressable raised tactile surface. Tiny word LAND below if legible. Polished hand-painted 2D Arabian desert sandboarding UI, high contrast, no other objects, no scenery, actual transparent alpha background.

### land_b

> Transparent PNG game UI LAND button, single centered circular vivid amber-orange leather and enamel button with bronze rim, matching a jump control family. Huge ivory downward arrow and sand impact motif, visually clear at small size; tiny word LAND below if legible. Warm sunlit polished hand-painted 2D racing UI, embossed tactile shape. No other objects, no scenery, actual transparent alpha background.

### stick_base_a

> Transparent PNG isolated VIRTUAL JOYSTICK BASE RING only, a circular dark walnut leather outer rim bound with antique brass, ornate desert camel-race game UI style. Large empty transparent hole in the center (see-through alpha), ring occupies most of square canvas. Front-facing exact centered circle, polished 2D hand-painted tactile material, no knob, no arrows, no text, no background, no cast shadow. Make inner hole truly transparent.

### stick_base_b

> Transparent PNG isolated VIRTUAL JOYSTICK BASE RING only, a circular bronze and graphite metal outer rim with warm amber scale ticks, matching sandboarding desert HUD. Large empty transparent hole in center (see-through alpha), ring occupies most of square canvas. Front-facing centered circle, polished 2D hand-painted tactile material, no knob, no arrows, no text, no background, no cast shadow. Make inner hole truly transparent.

### stick_knob_a

> Transparent PNG isolated VIRTUAL JOYSTICK KNOB only, centered circular domed walnut leather thumb grip with brass rim, matching an ornate camel-race desert game UI. Small embossed ivory four-point compass mark at center, no letters. Front-facing round tactile polished hand-painted 2D asset, clean silhouette. No ring/base, no scenery, no other objects, actual transparent alpha background.

### stick_knob_b

> Transparent PNG isolated VIRTUAL JOYSTICK KNOB only, centered circular domed graphite gray metal and dark leather thumb grip with aged bronze rim, matching a sandboarding desert HUD. Tiny amber four-point compass mark at center, no letters. Front-facing round tactile polished hand-painted 2D asset, clean silhouette. No ring/base, no scenery, no other objects, actual transparent alpha background.

## 検証と注意

- 全18点が 0 バイトではない PNG で、RGBA のアルファ値は 0 から 255 を含む。両スティック台座の中心画素はアルファ 0。
- 画像生成結果は原寸の候補。ゲーム内の表示サイズ・タップ領域・押下状態は組み込み単元で調整する。
- `stick_base_a.png` は外周に薄い半透明の生成ノイズが残るため、採用時は外周を確認する。
