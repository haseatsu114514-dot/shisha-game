# パッキースロットの生成画像

2026-10-03、Codexの組み込みimage_genで生成。`symbols.png`と`bezel.png`はアルファ付きPNGの出力をそのまま保存。両表示で同じ画像を使用し、図柄はCSSで3×3のアトラスを参照する。図柄の順番・抽選・報酬は変更していない。

元の`symbols.png`は左から、上段が赤7 / BAR / パイナップル冠のベル、中段がチェリー / 水滴 / 煙、下段左がパッキー。下段の残り2マスは透明。現在はベル・チェリー・水滴に使う。パッキーの参照は既存の`assets/ui/face_icons/face_pakki.png`。

表示寸法は `remake/css/reel.css` の `.sym-*` に定義。生成画像内の絵は等分セルの中心や余白が揃っていないため、各輪郭の外側に4pxの透過余白を取った矩形をCSSで参照し、縦横比を保ってコマ中央に配置する。小筐体の最大寸法は基本22px、チェリー21px、赤7は28px、BARは26px、パッキーは23px。拡大筐体ではコマ高と同じ66/26倍で表示する。PNG自体は生成出力のまま変更していない。再生成時は1254pxのアトラス寸法と各切り出し矩形も更新すること。

## 赤7・BAR・炭・パッキーの差し替え

`symbols-premium.png`は、オーナーの参考画像をもとにimage_genで新しく生成した透過PNG（1254×1254、2026-10-03）。参考画像の切り貼りはしていない。2×2の並びは左上から赤7 / BAR、下段が炭 / パッキー。チェリー・水滴・ベルと筐体は既存の画像を使う。

- 赤7: 実機風の横長の輪郭、赤いエナメルと金の縁、内側に薄いシーシャの模様。チェーンやキーホルダーの金具は付けない。
- BAR: 黒いプレート、読みやすい白い文字、金のシーシャ金属部品風の装飾。
- ブランク: 煙から炭3個に変更。内部IDの`smoke`は抽選・リール配列との互換のため維持。
- パッキー: 既存の煙の顔を保ち、金の縁と小さなきらめきを追加。炭のブランクと区別できるようにした。

生成時は4つの図柄を個別の象限に置き、互いの切り出し矩形に混ざらない余白を指定した。生成後の画像加工は行わず、CSSの矩形参照のみで両筐体へ表示する。生成元は`/workspace/generated_images/exec-c8e57ffc-7f97-461e-af13-d4d30d49f09b.png`。

検証: `CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/reel_lifecycle.mjs`（回転中の再表示・夜の回転・初回説明の重複防止）、`remake/test/reel_visuals.html`（図柄の読み込み・寸法・BIG/REGの先告知/後告知と拡大盤の同期）。

## 生成プロンプト: symbols.png

Use case: stylized-concept. Asset type: production 2D raster sprite atlas for the Japanese game 水煙前線 -EN:CODE-, a tiny mascot slot machine. Create one SQUARE image with a precise 3 columns by 3 rows atlas on a genuinely transparent background. Each of the nine cells is exactly equal size. Seven symbols only, each entirely contained and centered in its cell, occupying about 72 percent of the cell, with generous clear space, no grid lines. Row 1 left to right: glossy vivid RED numeral 7 outlined in pale gold; a BLACK rounded BAR plaque with exact white text "BAR"; a golden bell with a small pineapple-leaf crown. Row 2 left to right: two red cherries with green leaves; a vivid cyan water drop for replay; a pale lavender curling puff of smoke with a dark purple outline. Row 3: at LEFT a head-only cute round white fluffy smoke ghost mascot matching the attached reference, little dark eyes, tiny pink cheeks and cute wavy smoke tuft, do not change this mascot into a person or animal; CENTER and RIGHT cells entirely empty transparent. Style: polished illustrated Japanese arcade reel symbols, crisp thick dark purple outlines, clean flat shading with restrained glossy highlights, very readable at 20 pixels, not pixelated, no perspective, no extra decoration. Keep the seven silhouettes distinct; red 7, black BAR, gold bell, red cherries, cyan drop, pale smoke, white mascot face. Reference image is ONLY the identity reference for the mascot in the bottom-left cell. No labels except 7 and BAR. No watermark, no outer frame, no opaque background.

## 生成プロンプト: bezel.png

Use case: stylized-concept. Asset type: raster bezel frame asset for a 2D slot machine in a Japanese illustrated game. Generate one single WIDE LANDSCAPE image, aspect ratio 3:2, containing only a polished rectangular slot reel BEZEL viewed perfectly straight on with no perspective. The entire large rectangular middle opening must be genuinely transparent, as must the exterior outside the frame. A single rectangular opening, not three separate openings, no reels or symbols inside. The frame should sit close to the image edges and be a thin rim, roughly 5 percent of image width on each side and 6 percent of height at top and bottom; central empty transparent opening occupies approximately 90 percent of image width and 88 percent of image height. Rounded chamfered corners, smoked deep aubergine enamel panels, a fine warm gold metal trim along inner and outer edges, subtle cool cyan screws or tiny highlights at four corners, polished illustrated arcade cabinet material, crisp clean bold dark outlines, restrained shine, matches cute glossy red 7/gold bell/purple-outline mascot slot symbols. Uniform structural rim on all sides. Clean usable game UI cutout, legible at small scale, no flourish extending into the central opening, no screen, no decorative mascot, no text, no letters, no numbers, no logo, no watermark, no opaque canvas or fake checkerboard.
