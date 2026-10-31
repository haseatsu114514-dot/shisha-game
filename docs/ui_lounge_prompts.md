# ラウンジUI生成プロンプト（2026-10-03）

画像生成ツールで作った7枚の原本は `assets/ui/lounge/` に保存。文字・数値・塗りの割合は実行時に重ねる。透過背景を指定し、原本の色は画像編集で加工しない。採用した6枚の切り出し・縮小・WebP化は `python3 remake/tools/build_ui_skin.py`。能力アイコン案は比較用として原本とプロンプトを保存。2026-10-04のオーナー指定「漢字と■でやってた1個目のUIが好き」に合わせ、ゲーム内は角ゴシックの漢字＋四角い生成枠を採用する。

地図の看板は初版の金縁・青紫の面を、オーナーの色味の指摘に合わせて画像生成ツールで再編集した。編集の参照は初版の空の看板と差し替え前の地図画面。採用原本は白〜銀の縁・無彩色の面。最新の役割別配色の指示に合わせ、実行時は墨色の共通面にスチール（ライバル店）・アイボリー（家／tonari）・石墨（その他）・茶（ショップ）の低彩度アクセントを重ねる。

## assets/ui/lounge/panel.png

```text
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。

Create ONE new production-ready UI skin sprite for an urban Japanese shisha visual novel, not a full screen mockup. A perfectly front-facing square ink-black / deep plum lacquer panel with a very delicate double aged-brass / champagne-gold rim. Quiet mature boutique lounge mood, tiny pixel-painterly tactile grain, restrained smoked swirls engraved INSIDE ONLY the four corner plates. Sharp refined stepped/chamfered corners, thin frame, not rounded web cards. Center 85% is very dark and nearly uniform for bright Japanese text, absolutely no objects or markings inside. Corners occupy no more than 9% of the width so this image can be nine-sliced into dialogue boxes, HUD date panels, inventory windows and reward cards. All four edges must be straight and thin, with no large protruding decorations. Subtle warm specular highlights and tiny material irregularities make it hand-painted game UI, NOT CSS gradients. No medieval motifs, no gears, no heraldry, no jewels, no fantasy ornament. Target PNG 1024x1024, panel nearly fills canvas with only 10px transparent outer padding. The panel interior is opaque for readability, outside silhouette completely transparent. No baked text, logo, digits, arrows, icons, gauges, hearts, watermark or labels. Asset destination assets/ui/lounge/panel.png; runtime copy remake/img/ui/lounge/panel.webp.
```

## assets/ui/lounge/button.png

```text
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。

Create ONE new production-ready front-facing horizontal rectangular game UI button skin, not a screen mockup. Aspect ratio exactly 4:1, target PNG 1536x384. An ink-black/deep-plum lacquer label plate, nearly flat but visibly hand-painted with fine pixel-painterly grain and subtle worn highlights. Thin refined aged-brass/champagne-gold double outline. Very restrained engraved smoke curl confined to each end cap (endcap width under 7%). The central 85% is dark quiet uncluttered empty space, suitable for bright Japanese choice labels. Same skin will be nine-sliced into small controls, wider choices, name tags and title commands. Rectangular finely chamfered corners, no web pill silhouette. Front view, no perspective, no casts or shadows extending outside shape, no lighting glow outside. Almost fills canvas with 8px transparent outer margin. Panel interior is opaque, outside silhouette fully transparent. Modern Japanese night lounge, not medieval or steampunk. No baked text, logo, digits, icons, gauges, hearts, arrows, watermark or labels. Asset destination assets/ui/lounge/button.png; runtime copy remake/img/ui/lounge/button.webp.
```

## assets/ui/lounge/map-pin.png

```text
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。

Edit the FIRST reference image (the blank map sign asset). The SECOND image is only the original game's palette/style reference, do not draw a screenshot. User feedback: the original sign asset's loud gold/brass rim and slate-blue/purple face are the wrong palette. Preserve the broad rectangular sign, very small centered downward triangular pointer, transparent background, front view, textured painterly game UI, precise compact clean silhouette. CHANGE the frame to subdued IVORY-WHITE and SILVER, very thin bright ivory outer edge with tiny dark charcoal shadow inside, no yellow/gold/brass at all. Reduce corner hardware bulk and remove protruding studs. CHANGE the center to color-neutral charcoal grey with subtle hand-painted fine grain, absolutely no purple/blue or any hue. This neutral image will take the original game's PLACE-SPECIFIC green, red, orange, blue and yellow tints through luminosity blending, retaining their identities. Original game's reference has white-edged colorful destination signs; match that friendly legibility, but render this empty asset with neutral gray so it is tintable. Center medium-dark grey, border near white, simple understated details. Not fantasy equipment, not ornate jewelry. Empty interior with NO baked text, numbers, names, glyphs, portraits, badges, hearts, logos or watermark. No detached glow or drop shadow. Outside silhouette must stay genuinely fully transparent. The sign and triangular tail should nearly fill canvas, leaving only very small transparent margins. Output one PNG asset, same wide sign proportion, not a composite. Store assets/ui/lounge/map-pin.png, runtime remake/img/ui/lounge/map-pin.webp. The original user rejected asset should not be reused for this map.
```

## assets/ui/lounge/heart.png

```text
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。

Create ONE production-ready UI affinity heart icon on a completely transparent background, not a scene or mockup. Single classic symmetric heart silhouette, upright, very clear when reduced to 16-22 pixels. Rounded generous lobes, clean deep notch, sharp centered bottom tip. Hand-painted pixel-painterly rose pink enamel (#ff6b8d) with subtle warm rim and tiny cream highlight, not plastic 3D. No thick metal cage, ribbon or decorations. Keep the heart bold and simple for readability. The SAME silhouette will be rendered desaturated when empty and clipped from bottom upwards for partial affection fill by game code. Target PNG 512x512, heart occupies about 85% of width and height, fully opaque interior, transparent everywhere outside. No floor shadow, no background, no lettering, digits, logos, gauge, particles, watermark. Asset destination assets/ui/lounge/heart.png, runtime remake/img/ui/lounge/heart.webp.
```

## assets/ui/lounge/gauge.png

```text
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。

Create a production-ready TWO-SPRITE gauge art sheet with TRANSPARENT background. Target PNG 1536x768. Exactly TWO horizontal sprites aligned centrally, clearly separated, no overlapping. In the TOP HALF (y=0 to384): one EMPTY horizontal slim stamina gauge track, wide to height ratio 10:1, charcoal-ink recessed dark groove with a delicate champagne/silver metallic rim, finely chamfered ends, front facing with pixel-painterly tactile texture, absolutely EMPTY, no green fill, no marks. In the BOTTOM HALF (y=384 to768): one standalone narrow HEALTHY GREEN MINT enamel fill strip (#6fcf8f through #c9f07a), no outer frame, ratio 14:1, very subtle painted light grain and tiny restrained bright top edge. Both sprites will be separately cropped and reduced into bars displayed about 92x12 pixels and 220x12 pixels; keep silhouettes compact, clear and clean. NO large elaborate end caps, gems or motifs. The fill strip must be fully opaque with rounded/chamfered compact ends; all outside space transparent. Each sprite nearly fills canvas width, with generous transparent vertical space between rows. No text, letters, numbers, tick marks, percentage, symbols, logo, shadows, background, particles or watermark. Asset sheet assets/ui/lounge/gauge.png, runtime separate gauge-frame.webp and gauge-fill.webp. Game code alone controls fill fraction and low-health color.
```

## assets/ui/lounge/reward.png

2026-10-07（PF01/PF16）: この原型の銀色の二重縁・細かな質感・形を保ったまま、内側の煙模様だけを除いた `assets/ui/lounge/reward-clean.png` を使用する。能力・体力回復とも `remake/img/ui/lounge/reward-clean.webp` を使い、従来の項目色による着色と漢字バッジを維持する。元の `reward.png` は制作履歴として残す。制作記録は `asset_sources/ui/playtest-20261007/README.md`。

```text
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。

Create ONE front-facing horizontal REWARD NOTIFICATION WINDOW SKIN for a Japanese game. Target PNG 1536x512, object wide:height ratio exactly 3:1, almost fills canvas with only tiny outer transparent padding. This is a color-neutral material asset that MUST support runtime full-window color coding: technique=yellow, sense=cyan, guts=orange-red, charm=violet, insight=green, affinity=pink, lover bond=amber. For this reason the ENTIRE image must be GRAYSCALE ONLY (no baked gold, pink or any hue). Charcoal/near-black quiet central panel with fine painterly grain and hints of smoke material in corners; steel-grey and white highlights on thin refined double rim and small chamfered corners. Interior is flat front-facing and fully opaque, very dark enough for bright text. Keep center 85% free of ornaments. Runtime uses luminosity blending on a colored base, tinting both the rim AND the whole panel in the status color. Need noticeable nonflat textured material distinct from CSS gradients, restrained modern lounge style. NOT ornate fantasy, no large metal studs. No text, digits, letters, logos, hearts, portraits, kanji badges, gauge, symbols, watermark, detached shadow or glow outside silhouette. Outside frame transparent. Asset destination assets/ui/lounge/reward.png, runtime remake/img/ui/lounge/reward.webp.
```


## assets/ui/lounge/stat-icons.png

比較用の未採用案。装飾的な初版と光彩の残った編集版から、黒のフラット線画へ作り直した原本を保存する。右下が空の3列×2段。画面比較後、オーナーが漢字＋四角いバッジを選んだため、実行時のWebPとDOMには使わない。以下は生成時に送ったプロンプト原文。

```text
スタイル: 薄暗いシーシャラウンジの空気。2Dゲーム素材。透過PNG。文字・数字・watermarkは禁止。

For this specific asset, the owner's latest art direction OVERRIDES the painterly and metallic style above: create a BRAND NEW set of five exceptionally SIMPLE FLAT BLACK MONOLINE PICTOGRAMS. Think precise SVG editorial icons printed in solid black ink, NOT an illustration. Use only solid pure BLACK (#000000) strokes with smooth crisp vector-like edges and TRANSPARENT background. ZERO glow, ZERO shadow, ZERO grey, ZERO gradient, ZERO white or colored lighting, ZERO surface texture, ZERO bevel, ZERO reflective material. All outlines have constant medium stroke thickness and simple restrained rounded joins. No realistic detail.

Strict equal 3-column x 2-row layout on transparent PNG 1536x1024. Each cell512x512; each icon fits central 300x300 area. Five icons only, bottom-right cell COMPLETELY EMPTY. Top-left: minimal two-arm charcoal tongs silhouette, one clean rounded hinge, two slightly bent arms, no screw or serrations. Top-middle: three short separated S-curves representing aroma/smoke, OPEN STROKES, not a filled plume. Top-right: simple flame outline plus ONE inner curved stroke. Bottom-left: simple four-point sparkle outline, NO jewel, NO facets, NO additional sparkle. Bottom-middle: minimal almond eye outline and ONE simple iris circle, NO anatomical realism or extra detail. Every icon same optical size and line weight. Only the black stroke is opaque; ALL interiors and surroundings remain fully transparent. Holes must be transparent, not white. Flat calm stylish Japanese boutique lounge graphic design, readable at 32px, maximum 3 geometric parts per icon. NO background plate, frame, UI layout, text, kanji, labels, digits, logo or watermark. The game will invert these pure black line icons into ivory at runtime. Do not bake any brightness or halo into the PNG. Source assets/ui/lounge/stat-icons.png; separate runtime stat-technique.webp etc.
```

---

# 紙×ラベンダーUI生成プロンプト（2026-10-31 日常UI設計案・未生成）

**2026-10-31 生成・組み込み済み**: 実際に送った指示文・原画・SHA・色の合わせ込みは [asset_sources/ui/paper-20261031/](../asset_sources/ui/paper-20261031/README.md)。透過背景が使えなかったため、下の「透過」の指定を「紙が画像の端まで埋まる不透明の絵」に改め、角の丸めと九分割はコードで行った（以下は最初の案として保存）。

設計案 [docs/design/daily-ui-menu-design.md](design/daily-ui-menu-design.md) §6 のための Codex 用プロンプト。Dr.fookah の店内画面（`remake/css/shop.css` の生成り `#f7f3ed`・ラベンダー `#69497e`）を日常パート全体の基調にし、HUD・MENU・会話ウインドウ・ボタンの面を画像生成で作る。**まだ生成していない**。原本は `assets/ui/paper/`、実行時の切り出し・WebP化は `remake/tools/build_ui_skin.py` に `paper` 系を足して行う。文字・数値・ゲージはコードが重ねる。

共通のスタイル指針（各プロンプトの冒頭にそのまま貼る）:

```text
スタイル: 明るい昼のシーシャ屋の「紙もの」。ゲーム内のショップ画面と同じ生成りの紙（#f7f3ed）に、ラベンダー（#69497e）の線と塗り、差し色の琥珀（#d8963f）を少しだけ。手描き風の細かな紙の繊維・わずかな印刷のかすれ・角の軽い丸みを残し、写真調・3D調・強いグラデーション・ネオンは避ける。装飾は細い線と小さな煙の渦だけで、中世風・歯車・宝石・レース・リボンは入れない。
出力: PNG・@2x（実寸の2倍）・透過指定のものは背景完全透過。
NG: 文字/ロゴ/数字/ゲージ/ハート/アイコン/watermark の焼き込み（数値・文言はゲーム側で重ねる）。
```

```text
--- 1/4: assets/ui/paper/panel.png ---
（上の共通指針）
Create ONE production-ready UI skin sprite for a bright Japanese shisha-shop visual novel: a front-facing square CREAM PAPER panel (#f7f3ed) with a single thin LAVENDER (#69497e) hairline border about 2px inside the edge, and a second fainter lavender line 6px further in. Very fine hand-drawn paper fiber and a faint diagonal print grain, slightly warmer toward the edges. Corners gently rounded (radius about 3% of width), no corner plates, no stitches. The central 85% must be nearly uniform cream so Japanese text stays readable; corners and edges occupy no more than 8% of the width so the image can be nine-sliced into HUD plates, menu panels, dialogs and the map guide panel. All four edges straight and thin. Target PNG 1024x1024, panel fills the canvas with only 8px transparent outer padding, interior fully opaque, outside fully transparent. No text, logo, digits, icons, gauges, hearts, watermark. Destination assets/ui/paper/panel.png; runtime copy remake/img/ui/paper/panel.webp.

--- 2/4: assets/ui/paper/dialogue.png ---
（上の共通指針）
Create ONE wide dialogue-window skin, aspect exactly 1216:186, target PNG 2432x372 (@2x). A cream paper sheet (#f7f3ed) with softly rounded corners (about 16px at @2x), a thin lavender (#69497e) border, and a very faint lavender smoke curl engraved in the LOWER RIGHT corner only (opacity under 12%, within the right 14% of the width) so two lines of 30px Japanese text across the whole width stay perfectly readable. Along the top edge, 20px below it, a single faint lavender rule that fades out toward both ends. Fine paper fiber texture everywhere, slightly brighter in the middle. The window interior is fully opaque; everything outside the rounded sheet is transparent. No name tag, no buttons, no arrow, no text, no watermark. Destination assets/ui/paper/dialogue.png; runtime remake/img/ui/paper/dialogue.webp. The lavender name tab is a separate sprite (3/4).

--- 3/4: assets/ui/paper/tabs-buttons.png ---
（上の共通指針）
Create a production-ready FOUR-SPRITE sheet on a transparent background, target PNG 1536x1024, sprites aligned on a 2x2 grid with generous transparent gaps and no overlap. TOP-LEFT (768x512 cell): a LAVENDER (#69497e) NAME TAB, aspect 3:1, flat matte fill with a slightly darker 2px bottom edge, top corners rounded, bottom corners square so it sits on the top edge of a paper window; faint paper fiber on the fill. TOP-RIGHT: the same tab shape in CREAM (#fffcf8) with a 2px lavender border, for unselected tabs. BOTTOM-LEFT: a horizontal BUTTON plate, aspect 4:1, cream (#fffcf8) with a 2px lavender border, corners rounded about 4px (@1x), front view, no bevel. BOTTOM-RIGHT: the same button filled solid lavender with a 1px slightly lighter inner line, for the primary button. Every sprite is opaque inside its silhouette and transparent outside, with straight edges and tiny end caps so each can be nine-sliced. No text, icons, arrows, digits, watermark. Destination assets/ui/paper/tabs-buttons.png; runtime separate name-tab.webp, name-tab-off.webp, button.webp, button-primary.webp.

--- 4/4: assets/ui/paper/menu-bg.png ---
（上の共通指針）
Create ONE full-screen MENU BACKGROUND, target PNG 2464x1344 (1232x672 @2x), a large cream paper sheet (#f7f3ed) filling the canvas with only 8px transparent padding and rounded corners of about 8px (@2x). A thin lavender (#69497e) double-line frame runs 24px inside the edge. In the LOWER LEFT corner only, a soft hand-drawn lavender smoke swirl rising from a tiny shisha-bowl silhouette (a small bowl with a metal post on top, NOT a cup shape), all under 10% opacity and within the left 18% and bottom 30% of the sheet, so lists and cards placed over the rest stay readable. Fine paper fiber across the whole sheet, a little warmer near the frame. A 220px-wide (@1x) vertical band on the left, inside the frame, is tinted a very pale lavender (#efe9f0) with a 1px lavender line on its right edge, for the tab column. No text, headings, icons, buttons, digits, watermark. Destination assets/ui/paper/menu-bg.png; runtime remake/img/ui/paper/menu-bg.webp.
```
