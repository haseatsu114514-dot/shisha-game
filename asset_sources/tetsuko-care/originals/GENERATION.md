# Issue #2691 generation record

Codex A built-in image generation, 2026-11-06. Each PNG was a separate call except the ten-icon sheet. All assets are original candidates for Claude to select and integrate. `*_candidate*.png` files are alternatives; canonical names are the preferred candidates. No alpha extraction, front-layer splitting, or game integration was done.

## References and roles

| Role | Path | SHA-256 |
|---|---|---|
| Props, approved cat artist's line and shadows | `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png` | `9890e78c6b90f636861ddbabc5657191398dfbe3087bffb24d5704720b4f6f00` |
| Props, mukai color context only | `assets/backgrounds/bg_mukai_shop.png` | `998401f6510d9ef9937b9710b1df1d49507e95e91f7331cbcfb6c1af1afeb4fc` |
| UI, approved cream paper and lavender edge | `assets/ui/paper/panel.png` | `16e6d915ddcfd7422f6026953347aefcaf15f0d3a9f7b147dec76286515261da` |
| UI, approved fine line and smoke-curl motif | `assets/ui/paper/dialogue.png` | `4d13bd1ed55356b9a4ad0f816f4cc0705ee9acdcc1a2138c1f387ff73b2b02ec` |
| `prop_plate_empty.png`, edit target for same dish | `asset_sources/tetsuko-care/originals/prop_plate_full.png` | See file table below |
| `ui_icons.png`, edit target for corrected stop icon | `asset_sources/tetsuko-care/originals/ui_icons_candidate1.png` | See file table below |

Every reference was given a named role and an explicit style-fixing instruction in the generation prompt. The prop references fix drawing style and palette, not the depicted object. The UI references fix paper material and line, not layout.

## Shared prompts

For `prop_ball`, `prop_cushion`, `prop_scratcher`, `prop_tunnel`, `prop_plate_full`, `prop_plate_empty_candidate1`, `prop_teaser_tip`, `prop_teaser_stick`, and `prop_brush`, the exact prompt was **P + `Subject: ` + the subject line below**. The two listed prop references were included.

> **P:** Use case: illustration-story. Generate exactly ONE isolated game prop for Tetsuko's cat care scene. Reference image 1 is the approved Tetsuko sprite, STYLE reference only: same artist's warm dark brown confident outlines and 2-3 shaped flat cel-shadow steps. Reference image 2 is mukai shop COLOR context only. Slightly high front view about 15 degrees. Single flat uniform solid #FF00FF magenta background with no variation, floor or cast shadow. No other objects, cat, text, letters, pseudo-text, numbers, logos, watermark, shisha equipment, glossy shine, 3D, glow, or airbrush. References fix style/palette, not the subject.

| File | Subject line after `Subject: ` |
|---|---|
| `prop_ball.png` | Small reddish orange knitted yarn ball for a cat, soft subtly fuzzy yarn winding, no bell. Centered square composition; target 512x512. |
| `prop_cushion.png` | Square Japanese floor cushion, muted mustard yellow, small tassel at each of four corners, simple stitched center, visibly soft and used. Centered wide composition; target 1536x768. |
| `prop_scratcher.png` | Flat rectangular corrugated cardboard cat scratcher: low kraft box filled with corrugated cardboard strips, a few claw marks, no other marks. Centered wide composition; target 1536x576. |
| `prop_tunnel.png` | Short collapsible teal fabric cat tunnel, near opening turned diagonally toward viewer, wire support rings visible as soft ribs. Hollow mouth, interior, and front rim boundary clearly drawn for separating front layer later. Centered wide composition; target 1536x768. |
| `prop_plate_full.png` | One small white ceramic dish at a slight high angle; a little finely shredded plain chicken breast cat treat on the dish. Plain dish, no markings. Target 768x384 wide composition. |
| `prop_plate_empty_candidate1.png` | One small white ceramic dish, same wide shallow oval shape and angle as its full counterpart, now empty with only a faint food trace. Plain dish, no markings. Target 768x384 wide composition. |
| `prop_teaser_tip.png` | Only the fluffy detachable end of a cat teaser: a small bundle of soft amber and off-white feathers and fur. No rod, string, hook or other toy. Target 512x512 square composition. |
| `prop_teaser_stick.png` | Only one thin, straight bamboo cat teaser rod, perfectly horizontal left to right, no feather, string or tip. Plenty of clear magenta above and below. Target 1536x128 wide strip composition. |
| `prop_brush.png` | One cat slicker brush with a natural wooden handle, viewed slightly from above at an angle, rectangular head with fine short metal bristles. Practical hand tool. Target 768x768 square composition. |

For `ui_icons_candidate1`, `ui_notebook`, `ui_photo_frame`, `ui_tape`, `ui_memo`, `ui_paw_stamp`, and `ui_caption`, the exact prompt was **U + `Subject: ` + the subject line below**. The two listed UI references were included.

> **U:** Use case: ui-mockup. Generate exactly ONE hand-drawn game UI asset for Tetsuko's care screen. Reference image 1 (approved paper panel) fixes warm cream paper texture #f7f3ed, lavender #69497e ink and edge style. Reference image 2 (approved dialogue panel) fixes fine line weight and small smoke-curl motif. These references fix artist hand and material, not layout. A little amber #d8963f only where useful. Flat front-facing Japanese visual-novel paper goods, fine fibers and faint print grain. Uniform solid #FF00FF magenta background around the piece, no exterior shadow. No text, letters, pseudo-text, digits, logos, gauges, watermark, shisha equipment, photo realism, 3D, glossy shine, glow, gradients, flowers, lace or ornaments.

| File | Subject line after `Subject: ` |
|---|---|
| `ui_icons_candidate1.png` | Only exception allowing multiple items: exactly TEN separate simple line icons in a precisely aligned 5-column by 2-row sheet, cells evenly spaced with empty magenta gaps, target 1280x512. Lavender ink line art with tiny amber accents. Top row left to right: open petting hand; cat teaser wand with fluffy tip; cat slicker brush; small dish with treat; empty bench with cushion. Bottom row left to right: gently closed hand (stop); open cardboard box; small notebook bearing a simple paw stamp; small instant camera; plain back door. No labels or cell borders. |
| `ui_notebook.png` | One open notebook spread lying flat, target 2048x1280. Warm off-white inner pages with fine paper fiber; kraft cover edge peeking around pages; soft center gutter. BOTH PAGES ENTIRELY BLANK, no lines or writing. Only one small lavender masking tape strip at top-left corner. Centered with magenta outside. |
| `ui_photo_frame.png` | One blank instant photograph frame, target 768x896 portrait. Warm white paper border wider at bottom, subtle hand-made paper grain. Inner photo window is PLAIN UNIFORM SOLID #FF00FF magenta, exactly same as outer background, so game can key it out. No picture, marks, labels or text. |
| `ui_tape.png` | One short torn piece of lavender masking tape, target 512x160 wide strip. Looks slightly translucent through fine paper grain, both ends irregular jagged cuts. No writing, symbols, pictures or shadow. |
| `ui_memo.png` | One small off-white blank slip of paper held at top by one short lavender masking tape strip, slightly crooked. Center completely blank for code to place one line later. Target 1024x320 horizontal composition. |
| `ui_paw_stamp.png` | One single cat paw-print rubber stamp mark in lavender ink, slightly faded and tilted, with handmade uneven ink grain. No paper card, words, border, or other marks. Target 256x256 square composition. |
| `ui_caption.png` | One long thin off-white paper strip with hand-torn ends left and right, a faint lavender line near the top edge and near the bottom edge. Plain blank evenly textured center. Target 1536x192 nine-slice horizontal asset; keep all irregularities and decoration in left and right 96 px and top and bottom 40 px borders; central rectangle straight, undecorated and evenly textured. Canvas edges parallel. |

## Individually worded prompts and revisions

- `prop_box.png`: Use case: illustration-story. Generate ONE isolated game prop: an open plain kraft corrugated cardboard box, big enough for a chubby cat, four flaps folded outward, slightly worn dented corner, one strip of blank paper tape on the side. Slightly high front view about 15 degrees above; clearly defined open interior and front wall boundary for later layering. Same artist's hand as reference image 1: Tetsuko sprite is STYLE reference for warm dark brown confident outline and 2-3 shaped cel shadow steps only. Reference image 2 is COLOR context for mukai blue-gray, olive and wood; do not include the shop. Single solid #FF00FF magenta background, no floor or cast shadow. One object only, centered, 1536x1024 target composition. No text, symbols, printing, logos, cat, shisha equipment, gloss, glow, gradients, 3D or airbrush. The references fix style and palette, not subject; draw the specified box.
- `prop_bed.png`: Use case: illustration-story. One isolated round plush donut cat bed in off-white and beige. Same artist hand as reference image 1, the approved Tetsuko cat sprite: dark brown contour and 2-3 flat cel shadows. Reference image 2 fixes muted mukai colors only. Clearly show open center, interior cushion and raised front rim boundary for later layering. Slightly high front view 15 degrees. Uniform solid #FF00FF magenta background, one object, no floor or cast shadow, no text, marks, logos, pseudo-text, shisha equipment, gloss, 3D, glow, gradient. Target 1536x768 wide composition.
- `prop_plate_empty.png`: Use case: precise-object-edit. Edit target image 1 is the approved full white ceramic cat treat dish. Keep exactly the SAME dish silhouette, diameter, orientation, rim, light and scale. Remove only the shredded chicken, leaving the dish empty with a faint pale trace of food at its center. Do not change the dish or composition. Keep the magenta background. Same artist's hand and 2-3 cel shadow steps. No new objects, text, symbols, pseudo-text, shisha equipment, glossy shine, 3D or cast shadow.
- `ui_icons.png`: Use case: precise-object-edit. Edit target image 1 is a ten-icon sheet on magenta. Change ONLY the lower-left icon: replace the upright open hand with a gently CLOSED FIST, all fingers curled into the palm, conveying STOP. Keep the icon's scale and lavender paper ink style. Preserve the other nine icons, their exact positions, and the uninterrupted magenta background. No white cells or grids, no text, digits, pseudo-text, logos, shisha equipment or new objects. The reference fixes all composition and style; only the lower-left hand changes.

The `*_candidate2.png` files were separate new generations using the same two category references and the following prompt text, prefixed with `Use case: illustration-story. `:

| File | Prompt after prefix |
|---|---|
| `prop_box_candidate2.png` | Generate one alternate candidate of an open kraft corrugated cardboard box, four flaps out, worn corner, blank paper tape on side. Clearly distinguish open interior from front wall and front flap for later layering. Slight high front view 15 degrees. Same artist's hand as reference 1 Tetsuko sprite: dark brown contour, 2-3 flat cel shadows. Reference 2 fixes mukai muted palette only. Plain uniform solid #FF00FF magenta background, no floor or shadow. No cat, text, printing, pseudo-text, logos, shisha equipment, 3D, glow, gradient. Target 1536x1024. |
| `prop_tunnel_candidate2.png` | Generate one alternate candidate of a short teal fabric cat tunnel; front opening angled toward viewer, visible ring ribs, clearly distinguish hollow mouth and front rim for layer splitting. Slight high front view 15 degrees. Same artist's hand as reference 1 Tetsuko sprite: dark brown contour, 2-3 flat cel shadows. Reference 2 fixes mukai muted palette only. Plain uniform solid #FF00FF magenta background, no floor or shadow. No cat, text, printing, pseudo-text, logos, shisha equipment, 3D, glow, gradient. Target 1536x768. |
| `prop_bed_candidate2.png` | Generate one alternate candidate of a clean off-white beige plush donut cat bed; round raised front rim and open inner cushion clearly distinguished for later layering. Slight high front view 15 degrees. Same artist's hand as reference 1 Tetsuko sprite: dark brown contour, 2-3 flat cel shadows. Reference 2 fixes mukai muted palette only. Plain uniform solid #FF00FF magenta background, no floor or shadow. No cat, text, printing, pseudo-text, logos, shisha equipment, 3D, glow, gradient. Target 1536x768. |
| `ui_notebook_candidate2.png` | Generate one alternate candidate of an open notebook spread, two completely blank warm cream pages, narrow kraft cover peeking out, soft center gutter, one lavender tape at upper-left. Flat front-facing. Reference 1 paper panel and reference 2 dialogue panel fix exact paper fiber, lavender line weight, same artist hand. Solid uniform #FF00FF magenta exterior. No text, lines on pages, icons, pseudo-text, logos, shisha equipment, shadow, 3D, glow, gradients. Target 2048x1280. |
| `ui_photo_frame_candidate2.png` | Generate one alternate candidate of a blank instant photo paper frame, portrait, warm white with wider bottom margin. Window and outside background both uniform solid #FF00FF magenta. Reference 1 panel and reference 2 dialogue fix cream paper grain and lavender line weight. Flat front facing. No photo, text, logo, pseudo-text, shisha equipment, exterior shadow, 3D, glow, gradients. Target 768x896. |
| `ui_caption_candidate2.png` | Generate one alternate candidate of a long narrow warm cream paper reaction caption strip. Hand-torn left and right ends, two faint lavender horizontal border lines, plain blank center. For nine-slice, all decoration within side 96 px and top/bottom 40 px; central rectangle straight and evenly textured. Reference 1 panel and reference 2 dialogue fix paper and line style. Uniform solid #FF00FF exterior. No text, pseudo-text, logo, shisha equipment, shadow, 3D, glow, gradients. Target 1536x192. |

## Technical cleanup and review notes

The image generator varied the chroma color despite explicit prompts. A deterministic color correction mapped magenta-like pixels to exact `#FF00FF`, preserving the object colors and leaving antialiasing at contours. No transparency or layer extraction was performed. Generated canvases sometimes differ from requested target sizes; Claude will size/crop after selecting assets. `prop_plate_empty_candidate1.png` has a different dish shape and should not be adopted over the corrected canonical plate. `ui_icons_candidate1.png` has an open hand for stop; canonical `ui_icons.png` corrects it.

## Candidate PNG files

The final size and SHA-256 list is recorded below; it is generated from the delivered PNGs.

| File | Pixels | Bytes | SHA-256 |
|---|---:|---:|---|
| `prop_ball.png` | 1254×1254 | 353355 | `c17b8e7b721f9e4dcee07b23e2a8bb9d4587463eb857fe327ab22ef7da767673` |
| `prop_bed.png` | 1774×887 | 575867 | `0c036f355194d4ebe80218f7fe06cb8c959cfe8bfffde94c9bdc74061fb17c27` |
| `prop_bed_candidate2.png` | 1774×887 | 653438 | `e197a30a0c89f653cc11b5914c72cd0da6b424399417ba57e08abbf91c678e4a` |
| `prop_box.png` | 1536×1024 | 1104367 | `4ee82448ba2522374279818ad17868a9476471ffd83b4d961cdde9a7a6be7393` |
| `prop_box_candidate2.png` | 1536×1024 | 1147536 | `ef43ec8bfe2b108b7d0ff26524cab15ccb4b182b7ac8801d3327e4de152019c8` |
| `prop_brush.png` | 1254×1254 | 586770 | `1b52850b355a3a7c8b889e484c1821f64b4f9f9f5146a143df7764621b94d989` |
| `prop_cushion.png` | 1774×887 | 916967 | `0c4b7d36a8423af8e5f7f604c98cf1cd0613123824579514b366036d5fcd6b4a` |
| `prop_plate_empty.png` | 1774×887 | 249950 | `2f90deac8eace16b9fd041fa2483360e834b12bb445d117711e16a6a611e8057` |
| `prop_plate_empty_candidate1.png` | 1774×887 | 266724 | `dfb4c1b1511a5cf39844997756643e794f8154116169f7f20a40d93b807929f2` |
| `prop_plate_full.png` | 1774×887 | 335271 | `b9c2f73042543c346b7ec4bc7f6e29413cdf412cc1f0ee2c3ee63b51f38ec7bb` |
| `prop_scratcher.png` | 2048×768 | 914191 | `2d3466845aa870cf556d3d336a1edaa14cad378cfe6f71fb909230cc4cbd4e8d` |
| `prop_teaser_stick.png` | 1374×1145 | 53277 | `20eca5e19bfd40f43a05165061634e5e085bb1653d097960c17ea7be2834b1fe` |
| `prop_teaser_tip.png` | 1254×1254 | 384064 | `1a405416dcf7f48ed73dea157c1411cd7f1947e53816fe77b916e6dd4f3aec89` |
| `prop_tunnel.png` | 1774×887 | 646788 | `2cbc73580744b919e14e606f92f17fdd6a109297ba110394d327ac71ab75873a` |
| `prop_tunnel_candidate2.png` | 1774×887 | 474138 | `a3aabf05677a1d5b7d99b50bdfc9f18025b723851d0bf96b77ad057e9da5ca26` |
| `ui_caption.png` | 2172×724 | 732191 | `caeffc40a3fe641703c546da7df1100f0f42e338c624deeb2e0ceba0e5cd8115` |
| `ui_caption_candidate2.png` | 2172×724 | 440399 | `03564b0e031e6debc656207791a0760e1f6fffecee8f0732edc8fb937fa8fb0b` |
| `ui_icons.png` | 1983×793 | 630641 | `f75b4d435d5d37a6b6c9c56673ee5a5420687fa6732955da6405203378b46a80` |
| `ui_icons_candidate1.png` | 1983×793 | 654435 | `8201becb8db06ca3b8e0af41eef184432433456bc0cbab41180398e1fe09b37a` |
| `ui_memo.png` | 2172×724 | 1155764 | `bca2b1921cf7973107db19c4776abc3df6ba4afcb666b8a1ffcdb861ab49701a` |
| `ui_notebook.png` | 1586×992 | 1492018 | `d6a5c4fa603d9e44ccdad425c9172e7815b7aa58ddd181d471ff4ea8cf88ca44` |
| `ui_notebook_candidate2.png` | 1586×992 | 1589556 | `7e1999a3371c9480154f2f43c10bb01020744b3015e225d4c9c87820c5a34f0f` |
| `ui_paw_stamp.png` | 1254×1254 | 353722 | `0e2ff4d40b587ff300d33e4e46e9b198f9b0121d49e51a3b9e84d9f7af8ec26c` |
| `ui_photo_frame.png` | 1161×1355 | 634708 | `0e48c544c23a267249fa62f6a0e2b3926c1d0a3761c0386b112ed4ce682e5040` |
| `ui_photo_frame_candidate2.png` | 1161×1355 | 629427 | `b495048d7fa63f1eff927783bd3a1e92b2b354facb067c16bebc228bf7343da4` |
| `ui_tape.png` | 2172×724 | 1141470 | `6f52bf49c4b7a8d9968a2c5be66f32f175695b9293a1e143d9109b954da25bd3` |

## Issue #3214 追加候補（2026-11-11）

Codex の組み込み画像生成を使用。必須6点を各1枚ずつ別の生成で作成した。背景は単色マゼンタを指示したが、生成器の実測値は完全な `#FF00FF` ではない。Issue 本文の指定どおり、透過処理・ゲーム内での縮尺合わせ・組み込みは行っていない。`prop_tunnel_tail.png` のみ、生成器の 1254×1254 出力を指定画素数にするため Pillow の LANCZOS で 512×512 に縮小した。

### 参照画像と役割

| 参照画像 | 役割 | SHA-256 |
|---|---|---|
| `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png` | 全6点の描き手の線と影。猫4点では本人の柄・顔・耳・目・体格の正本。しっぽでは縞の正本 | `9890e78c6b90f636861ddbabc5657191398dfbe3087bffb24d5704720b4f6f00` |
| `assets/sprites/characters/tetsuko/chr_tetsuko_smile.png` | 猫4点の同じ描き手による表情 | `3df30e566cd75707c686621a87e5071fe11e1ef6cf5faab441d6fb8348959c10` |
| `assets/sprites/characters/tetsuko/chr_tetsuko_sleep.png` | 猫4点の丸い体型と毛の塗り | `7cbba9787ff8228d44b188f55f9154f40e1dcba9beba010d8958ce395381876e` |
| `assets/sprites/characters/hajime/chr_hajime_normal.png` | 膝の作業ズボンの色のみ | `6affe667e9cc665b53713c6a2319c1c91792e2e335e8408d9c941c364295e409` |
| `assets/ui/tetsuko/prop_tunnel.png` | しっぽが出るトンネルの口の向きと大きさのみ。絵にはトンネルを入れない | `62bd8cc1e10e07323f07267ed3b526f7334266fc55a554d6ee5a0d8214419419` |

参照は膝が1枚目＝てつこの画風、2枚目＝はじめの服の色。しっぽが1枚目＝てつこの画風と縞、2枚目＝採用済みトンネルの口。猫4点は毎回、1枚目＝本人、2枚目＝表情、3枚目＝丸い体と毛の塗り。各指示文で役割と「同じ描き手の焦げ茶輪郭・2〜3段セル影」を明示し、横並びの参照シートは使用していない。

### 生成指示

猫4点に共通して与えた画風・本人・形式の指示：2D ノベルゲーム用のてつこの全身絵を1枚。参照①を本人の橙色の広い縞、鼻の白い逆V、白い顎・胸・腹・足、折れ耳、金色の目、ふっくらした体格、画風の正本とする。参照②は同じ描き手の表情、参照③は丸い体と毛の塗り。焦げ茶の輪郭線（外周は太め）、輪郭にまとめた毛束、2〜3段のセル影を維持。長辺1000px以上、周囲に少し余白。背景は均一な `#FF00FF`。猫1匹のみ、床・影・おもちゃ・小物・文字・ウォーターマークなし。自然な体の構造と参照猫の同一性を保つ。

| ファイル | 個別の POSE 指示 |
|---|---|
| `cat_leap.png` | Mid-air pounce in side view, facing right; body stretched long; front legs reaching forward and up with toes spread; hind legs extended back; thick striped tail streaming behind; eyes wide and focused; ears forward. |
| `cat_flop.png` | After missing a pounce, sprawled on her belly, front legs splayed forward, hind legs tucked, glancing back over her shoulder with a slightly ruffled, sheepish expression. Side view facing right. |
| `cat_mew.png` | Sitting upright, looking up at the viewer and giving a short soft meow; mouth open with tiny fangs and pink tongue; folded ears lifted, eyes round. |
| `cat_poke.png` | Sitting and lifting ONE front paw toward the viewer to poke, pink paw pads clearly visible; head tilted a little, eyes curious. |

膝の採用指示（初回は出力段階で安全システムにより失敗したため、服の素材を主語にして再生成）：

> Illustrate a family-friendly clothing prop for a 2D Japanese visual novel. WIDE 2048x768. Reference image 1 defines the artist's dark brown outline and crisp 2–3 step cel shading. Reference image 2 defines ONLY the charcoal color of work trousers. Draw the two fabric-covered rounded knee shapes of a seated person from a downward first-person viewpoint, with the upper thigh fabric leading toward the lower edge of frame. There is a soft dip between the knees. Fill the lower third with continuation of the two trouser legs, cropping before the waist. Image must show trouser cloth only. No waist, belt, pockets, shoes, skin, hands, face, cat, furniture, floor, writing, or watermark. Plain uniform solid #FF00FF magenta surrounding the trouser silhouette.

しっぽの指示：

> Create a square 512x512 pixel 2D visual-novel prop illustration containing ONLY Tetsuko's detached visible tail segment. Reference image 1 defines the cat's thick orange tail, broad tabby stripes, dark brown outlines, and crisp 2–3 step cel shading by the same artist. Reference image 2 defines the orientation and scale of the rear mouth of the adopted teal play tunnel; use its opening only to understand where the tail emerges, but do NOT draw any part of the tunnel or its opening. Show the orange striped tail starting at the lower left and curling upward at the tip, as though emerging from a round opening just outside the canvas. Tail only, no body, no paws, no tunnel, no props. Uniform solid #FF00FF magenta background, no floor, shadow, writing, or watermark. Fit the whole visible tail inside the canvas with a small margin.

### 追加 PNG の実測

| ID | ファイル | 画素寸法 | SHA-256 |
|---|---|---:|---|
| TK-SC01 | `prop_lap.png` | 2048×768 | `e3a63d191a0cc59e19902bb2f437839cdab300cc7a7424cc718f66dc78f9da64` |
| TK-SC02 | `prop_tunnel_tail.png` | 512×512 | `4e48b17fae4a11288eee3f49ce687f126ecd7df7075dabe3c1e95dc90120d293` |
| TKT-CAT13 | `cat_leap.png` | 1719×915 | `752ad29ac53be461322bbb4486ee4a7beccfd1bd856605d81ec22dcedc40e08c` |
| TKT-CAT14 | `cat_flop.png` | 1774×887 | `b9398df270f31c3e4c8c0bc589dc66834a0c6f915aa54f87fb02b33a3feb50f0` |
| TKT-CAT15 | `cat_mew.png` | 1084×1451 | `9803da39bca8ae14105b1af31a30b7732427ba112d9a257c12cc2202885e6dd0` |
| TKT-CAT16 | `cat_poke.png` | 1084×1451 | `6a4e6ce96484f5abade0737a2afa63742411535736b4c72821c0a418bba3d373` |
