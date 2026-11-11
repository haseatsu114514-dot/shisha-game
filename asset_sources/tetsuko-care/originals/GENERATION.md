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


# Issue #3213「茶トラと段ボール」UI 候補原画（2026-11-11）

A 段 TK-UI01〜09 の14枚を Codex 内蔵画像生成で1点ずつ作成した。B 段は今回の対象外。透過、切り分け、ゲームへの組み込みはしていない。

## 参照画像と役割

| 役割 | パス | SHA-256 |
|---|---|---|
| ① 同じ画面で採用済みの段ボール箱。線と段ボールの描き方を固定 | `assets/ui/tetsuko/prop_box.png` | `17586dba0cf27f537f7d9819bdaec980937e5c909425038dcdb91b16d81ae869` |
| ② てつこの立ち絵。茶トラの橙、胸の白、焦げ茶の輪郭を固定 | `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png` | `9890e78c6b90f636861ddbabc5657191398dfbe3087bffb24d5704720b4f6f00` |

全回で①②を役割ラベル付きで渡し、「画風固定の参照として使い、描く物は PART だけ」と指定した。ハート空の編集回のみ、満の原画を画像①（編集対象）とし、箱を画像②、てつこを画像③とした。

## 指示文

共通文と該当する PART 行を連結して1回1点を生成した。以下は Issue #3213 の「Codex へ渡す文」からの原文。組の各状態には、その回で描く状態名を末尾に指定した。 実際の各回では参照の役割文末に「画風固定の参照として使い、描く物はPARTだけ」と追記した（TK-UI01 では「構図や物体を複写しないでください」も追加）。

```text
ノベルゲーム「水煙前線」の、看板猫てつこと遊ぶミニゲーム画面のUI部品を1枚だけ描いてください。
画面のテーマは「茶トラと段ボール」です。色は、てつこ本人（茶トラの橙・胸の白・輪郭の焦げ茶・鼻の桃色）と段ボールから取ります。
添付①は同じ画面に置いてある採用済みの段ボール箱（線と段ボールの描き方の正本）、②はてつこの立ち絵（色と線の正本）です。

STYLE: hand-drawn game UI in the same artist's hand as the attached cardboard box and Tetsuko sprite. Cream paper #fff5e4 surfaces with thick confident dark brown #3b2416 outlines (about 6 px at this size), tabby orange #f08a2e and deep orange #c25e1c accents, kraft cardboard #c9965c with faint corrugation and fiber, the back-door blue-grey #4e6b78 only where asked, and a touch of nose pink #f39aa6. Flat colors with one or two clean cel-shadow steps, light from the upper left. Warm, cozy and a little handmade, like stickers and cut cardboard. No lavender, no smoke curls, no glossy plastic, no glow, no airbrush gradients, no 3D render, no photo texture.
Never bake in any text, letters, digits, logo or watermark (the game writes all text). No cat face drawn inside the parts unless asked.
FORMAT: flat and front-facing. Plain solid magenta #FF00FF background around the part (the game keys it out); keep the magenta exactly #FF00FF. No drop shadow outside the part. For nine-slice parts, keep every decoration inside the stated border band, keep straight edges parallel to the canvas, and keep the center plain and evenly textured.

PART: （下の一覧から1つを貼る）
```

```text
TK-UI01 ui_tk_icons.png 1536x512 — A sheet of twelve simple icons in a 6 x 2 grid of 256 px cells, each icon centered in its cell with plenty of empty magenta between cells. Thick dark brown outlines with tabby orange and cream fills, the same look in every cell. Top row, left to right: an open hand palm (petting), a cat teaser wand with a fluffy feather tip, a cat slicker brush with a wooden handle, a small white dish with a treat, an open cardboard box (rearranging), a small notebook with a paw-print stamp on the cover. Bottom row: a small instant camera, a simple back door with a small window, a heart, a round thought bubble with three dots inside, a fingertip gently tapping a small box, a person sitting on a bench seen from the side (sitting quietly). No text.
TK-UI02 ui_tk_token.png, ui_tk_token_pressed.png and ui_tk_token_active.png 384x384 each — A round button token about 320 px across, centered. Normal: cream paper face, thick dark brown rim, a solid dark brown "drop" under the bottom edge so it looks like a thick sticker standing up. Pressed: the same token pushed down, the drop almost gone. Active (the tool in hand): the face filled tabby orange with a few soft stripes near the rim, and two small folded cat ears on the top edge, like Tetsuko's head seen from the front. Plain center in all three (the game puts an icon on it). Make three images with exactly the same size and position.
TK-UI03 ui_tk_tab.png, ui_tk_tab_pressed.png and ui_tk_tab_door.png 512x384 each, nine-slice (72 px border on all sides) — A rounded-rectangle paper tab: cream face, thick dark brown outline, a solid dark brown drop under the bottom edge. Pressed: pushed down, drop almost gone. Door: the same tab painted like an old blue-grey #4e6b78 metal back door with a few scuffs. Plain center.
TK-UI04 ui_tk_heart.png and ui_tk_heart_empty.png 160x160 each — A plump hand-drawn heart about 140 px wide, thick dark brown outline. Full: warm pink-red fill with one small highlight. Empty: exactly the same outline and position, cream fill. The game reveals the full heart over the empty one from the bottom up, so both must line up perfectly.
TK-UI05 ui_tk_pill.png 512x160, nine-slice (72 px left and right, 56 px top and bottom) — A rounded pill-shaped cream holder with a thick dark brown outline and a dark brown drop under it, for a row of hearts. Plain inside.
TK-UI06 ui_tk_wish.png 384x320 — A round cream speech bubble that a cat "thinks" with, thick dark brown outline, a short pointed tail at the bottom right, a soft drop under it. Plain inside (the game puts an icon in it).
TK-UI07 ui_tk_caption.png 1536x256, nine-slice (left 112 px, right 56 px, top and bottom 56 px) — A long cream paper strip with rounded corners and a thick dark brown outline, a dark brown drop under it, and on the left end a band of tabby orange and deep orange stripes (the band fits inside the left 112 px). Plain center for one line of text.
TK-UI08 ui_tk_title.png 768x224 — A blank title plate: a rounded cream plate with a thick dark brown outline and drop, two small folded tabby cat ears sticking up from the top edge, a round tabby orange medallion with a cream paw print at the left end (inside the left 200 px), and a thin band of tabby stripes along the bottom edge. The middle stays plain (the game writes the title).
TK-UI09 ui_tk_fx.png 1024x512 — A sheet of eight small effect marks in a 4 x 2 grid of 256 px cells, each centered, thick dark brown outlines: a small pink heart, a four-point yellow sparkle, a cream music note, a light blue sweat drop, a little tuft of orange and white cat fur, a cream paw print, three short curved lines like a purring vibration, a small grumpy puff of air. No text, no letters.
```

TK-UI02・03 は normal、pressed、active／door を個別に生成した。TK-UI04 は満を生成後、満を編集対象に指定し「外形、輪郭線、位置、サイズ、背景を完全に維持して内側のピンクだけクリーム色にする」と指示して空を生成した。TK-UI05・06 は初回に不要な装飾が入ったため、無地に限定する指示を追加して各1回再生成し、後者を採用した。

## 候補の整形と検査

生成器の原寸と背景のピンクには指定との差があった。各 PNG を指定画素寸法へ縮小し、画像外周につながるマゼンタ色領域を単色 `#FF00FF` に補正した。九分割用の札と反応帯は上下の輪郭が指定の境界帯へ収まるよう上下余白を調整した。ハート空は満の外形マスクと焦げ茶輪郭を転写し、外形の画素一致を確保した。透過化はしていない。

機械検査: 全14枚の実寸、四辺全画素の `#FF00FF`、ハート満／空の外形マスク一致、アイコン12セルと粒8セルの非空を確認した。文字・擬似文字・ロゴ・機材の不在は目視確認した。

## PNG 一覧

| ファイル | 画素寸法 | SHA-256 |
|---|---:|---|
| `ui_tk_caption.png` | 1536×256 | `ab88105b965a47a785e78febbf9ab0f28ee6dd11c801d9848e75c7a47fb7ff7c` |
| `ui_tk_fx.png` | 1024×512 | `80731dad01f12f57ac0620bd69f3c39c82ba25a4dbfdfc0984ec19c5011be128` |
| `ui_tk_heart.png` | 160×160 | `bf0f3bea70d55fad0f448de2bc0140b644ff4a75da09e69584118a736d6a1359` |
| `ui_tk_heart_empty.png` | 160×160 | `2b78729f55b2dd19f5dc2c870745ded67669e84a5931ef4aaf5e357ec772bb3c` |
| `ui_tk_icons.png` | 1536×512 | `34cec0cddd1c04958dc16e79ac2efd9ea27ee80577cf8ef41013f161954acbf3` |
| `ui_tk_pill.png` | 512×160 | `1e98236431193a509e497142a3d0a1b0dedb3f860c01c18e85c699e05e8647ba` |
| `ui_tk_tab.png` | 512×384 | `b386f88530c7b9b4830e4307ec4d32075c306ec708b623c3125a7c2b75d64186` |
| `ui_tk_tab_door.png` | 512×384 | `a675d3a5f8941f496b3f17d1bdf308507a76186bb47951e5bd1c1fe7c107dad7` |
| `ui_tk_tab_pressed.png` | 512×384 | `10fafa4a457c988898b0c48223c396820b57517da8f02aecb8c05cd945f4a9eb` |
| `ui_tk_title.png` | 768×224 | `f1a6fb2727d11eda254476b2f43fc6a490a049cc65ad8678e997cdfeccc1c90a` |
| `ui_tk_token.png` | 384×384 | `b4e22b0da944b1da4bd6f3f225c8aca3154c13ca1f361a9565a50128f812feef` |
| `ui_tk_token_active.png` | 384×384 | `1b854572072470e33adc44bb6fb190fd3b734fae7ca1f3ffae57e353b608d7ac` |
| `ui_tk_token_pressed.png` | 384×384 | `f12b6659c7ae9542c9da7eecceb5a266254f581c2a6e1878a57ac4a39a92377e` |
| `ui_tk_wish.png` | 384×320 | `94667dffab50a3b7cc2763dc54d991fd26d05a52bc7bc5be82597d5ccb2b165c` |
