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


# Issue #3213 — 茶トラと段ボール UI原画候補 (2026-11-11)

Built-in image generation, one image per call. A mandatory set: 14 PNGs across TK-UI01–09, plus one rejected door-state candidate. This is a raw candidate delivery, not a completion claim. No transparency extraction, sprite cutting, resizing, or game integration was performed. B assets were not generated.

## References

- `assets/ui/tetsuko/prop_box.png`, approved drawing/outline and cardboard reference; SHA-256 `17586dba0cf27f537f7d9819bdaec980937e5c909425038dcdb91b16d81ae869`; 274414 bytes.
- `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png`, approved Tetsuko palette/line reference; SHA-256 `9890e78c6b90f636861ddbabc5657191398dfbe3087bffb24d5704720b4f6f00`; 141407 bytes.
- Pressed/active token calls also received the generated normal token as edit target reference 3. Pressed/door tab calls received the normal tab as reference 3. Empty-heart call received full heart as reference 3.

## QA and remaining work

- All generated images were visually inspected. No writing, pseudo-text, shisha equipment, lavender or smoke-curl motif was observed. The warm orange/cream/brown treatment follows the provided approved references. This is a candidate set for Claude selection.
- **Not passed: exact chroma requirement.** The generated backgrounds vary around magenta, rather than being uniform #FF00FF. The raw files have not been color corrected. Claude must correct/key as appropriate before use; this issue must not be closed as fully meeting its exact-background criterion.
- **Not passed: exact requested pixel dimensions.** Actual delivered canvases are recorded below. No upscaling, downscaling, cropping or per-cell slicing has been done. Caption target aspect 6:1 and title target aspect about3.43:1 arrived as3:1 canvases, so final sizing needs care.
- Token, tab and heart state groups have matching canvas sizes, but exact contour pixel alignment is not certified. Overlaid reveal/pressed-state registration must be checked before integration. The active token has a cream center surrounded by orange, rather than a completely orange face.
- Normal/pressed tabs include generated border ornaments. Confirm they fit the intended nine-slice border after sizing. The blue-grey door correction removes the unwanted paw/yarn/tape ornaments.
- `ui_tk_tab_door_candidate1.png` is rejected: it remained mostly cream with only a small blue-grey label. `ui_tk_tab_door.png` is the corrected blue-grey main candidate.
- The icons and effect marks are still sheets. Do not assume a sheet can be used without a cell-placement/crop review.
- LFS upload/PR publication was unavailable in this task environment; do not interpret local/Space preservation as a GitHub commit. No repository state changed.

## Actual PNG files

| File | Pixels | Bytes | SHA-256 |
|---|---:|---:|---|
| `ui_tk_caption.png` | 2172×724 | 1379831 | `4d9a72a3b8731f5c82ce088fd7853e0a9ac29f7310feaf315ef131491fd59eb7` |
| `ui_tk_fx.png` | 1774×887 | 1429623 | `1c254bfea5bcacb6709c967974752fb2a60fa6debf70b5967017d4580a060408` |
| `ui_tk_heart.png` | 1254×1254 | 1262267 | `0ac83fec398bce966339d65be31579e832873e625e2b489c6c277c9d2dbd9ba1` |
| `ui_tk_heart_empty.png` | 1254×1254 | 1236313 | `e14094daa75adda39ea5dca3e66d52e45a0f46212b543ec400b493b883a1dc94` |
| `ui_tk_icons.png` | 2172×724 | 1615897 | `ff6abf2f55dcadf258e9102d165003ab4ba40b1ab5ad01faf6580162b69be211` |
| `ui_tk_pill.png` | 2172×724 | 1439907 | `19663d2cf0d15a4f3da89f35d6b4f21bccb8fb979ac498e2ec034a645962ff14` |
| `ui_tk_tab.png` | 1448×1086 | 1668463 | `e6273aab4376e741fd75c6af9891709070c19b1e9aa81f06fb8c5a5018ce30a7` |
| `ui_tk_tab_door.png` | 1448×1086 | 1261381 | `33385feeaf4d6367f5194213ec72c5cf45113ed51c89d8d351267ccc2b46b78d` |
| `ui_tk_tab_door_candidate1.png` | 1448×1086 | 1672025 | `03418fb1f8e45a11a28d7dbfb6598d7019447ce0164b0205869707b04fd2ab0d` |
| `ui_tk_tab_pressed.png` | 1448×1086 | 1614024 | `da1468c0570177a8aeb4a118f32eb3f801f2d02c513ca01eecb5d513b19d3ec8` |
| `ui_tk_title.png` | 2172×724 | 1687916 | `90895e4a4d2b191a607699f5a9dc844c573fc432e9c9da4d20e7942299b143a9` |
| `ui_tk_token.png` | 1254×1254 | 1651367 | `00d3b9b673f4ec5788bb696fdd6c3c3567190436845909d26675a1f32384a777` |
| `ui_tk_token_active.png` | 1254×1254 | 1667752 | `830312a7bad215a2527d536b9e1651c2ca5a4ba7d1e325b543d47ef9d544ddf2` |
| `ui_tk_token_pressed.png` | 1254×1254 | 1709640 | `51fa3ec084eb95311b8793a9c215682a13f344ae8f765ff7075353011091701e` |
| `ui_tk_wish.png` | 1374×1145 | 1250356 | `65e9ba472c5155a48e8ce59ea53c23891ebbf7ce8b76d39680e4ba4d79a66041` |

## Exact generation prompts

### ui_tk_icons.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI01 ui_tk_icons.png, target 1536x512. Sheet of exactly twelve simple icons in 6 x 2 grid of equal 256px cells. Each icon centered, plenty of empty magenta between, no gridlines. Thick brown outlines, orange and cream fills, consistent same style. Top row left to right: open hand palm for petting, cat teaser wand fluffy feather, wooden handled slicker brush, small white treat dish, open cardboard box, notebook paw-print stamp. Bottom row: small instant camera, simple back door small window, heart, round thought bubble three dots, fingertip gently tapping small box, person sitting on bench side view. No text.
```

### ui_tk_token.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI02 target 384x384. ONE round button token 320px across centered. Cream paper face, thick dark brown rim, solid dark brown drop attached under bottom edge like thick standing sticker. Plain empty center, no icon. Normal state.
```

### ui_tk_token_pressed.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI02 pressed state target 384x384. ONE round cream button token, same size and centered position as normal state edit target reference 3, pushed down with attached dark brown drop almost gone. Preserve normal token's outline diameter, canvas and empty center. No icon.
```

### ui_tk_token_active.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI02 active state target 384x384. ONE round button token same size and centered position as normal edit target reference 3. Face tabby orange, few soft deep orange stripes near rim, two small folded cat ears on top edge. Thick brown rim, standing dark brown attached drop below. Plain empty center, no icon. Preserve canvas and token diameter.
```

### ui_tk_tab.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI03 target512x384, nine-slice72px on each edge. ONE rounded rectangular cream paper tab, thick dark brown outline, solid dark brown attached drop under bottom edge. Plain blank center. Edges parallel canvas. Normal state.
```

### ui_tk_tab_pressed.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI03 pressed state target512x384 nine-slice72px. ONE same rounded rectangular cream paper tab as normal target reference3, pushed down, attached brown drop almost gone. Preserve exact outer placement, width, height, plain empty center. No icon.
```

### ui_tk_tab_door.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI03 target512x384 nine-slice72px. Reference3 is exact normal tab edit target. Repaint ALL cream paper including the entire large blank center to flat old blue-grey #4e6b78 painted metal with a few small scuffs at edges. This is the back-door button. It must visibly be BLUE GREY across its whole surface, not a cream paper tab with a blue small label. Remove paw stamp, yarn ball, tape and stitched orange lines. Keep the exact rounded rectangle shape, canvas placement, dark brown outline and dark brown attached drop below. Center plain BLUE GREY with no icon or writing. No extra ornaments.
```

### ui_tk_heart.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI04 target160x160. ONE plump hand-drawn heart140px wide centered thick dark brown outline. Warm pink red fill, one small shaped flat highlight, no gloss. No other object. Keep it only the specified simple heart; no cardboard accents, tape, paw prints or decorative border. Flat cel shading.
```

### ui_tk_heart_empty.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI04 target160x160. ONE empty heart with EXACT same outline, canvas position and size as filled heart edit target reference3. Change only interior fill to cream #fff5e4. Preserve contour and position pixel aligned. No other object.
```

### ui_tk_pill.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI05 target512x160 nine-slice72px left/right,56px top/bottom. ONE rounded pill-shaped cream holder thick brown outline dark brown attached drop below. Plain empty center for row of hearts; no hearts or symbols. Only specified simple blank holder; no added paw stamps, tape, yarn balls or other decoration.
```

### ui_tk_wish.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI06 target384x320. ONE round cream cat-thought speech bubble thick dark brown outline, short pointed tail bottom right, soft flat dark attached drop beneath. Completely plain empty center, no dots, icon, text. Only simple blank bubble; no cardboard panels, paw stamps, tape, yarn or other decoration.
```

### ui_tk_caption.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI07 target1536x256 nine-slice left112px,right56px,top/bottom56px. ONE long cream paper strip rounded corners thick brown outline and attached brown drop below. ONLY left end has band tabby orange and deep orange stripes fitting left112px. Plain empty center for one text line. Edges straight parallel canvas. No additional tape, yarn, paw stamp, cat drawings or decorative icons.
```

### ui_tk_title.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI08 target768x224. ONE blank rounded cream title plate thick dark brown outline and attached drop. Two small folded tabby cat ears stick up top edge, round orange medallion with cream paw print at left end inside left200px, thin tabby stripes along bottom edge. Middle stays completely plain empty. No lettering.
```

### ui_tk_fx.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI09 target1024x512. Sheet exactly8 small effect marks in4x2 equal256px cell grid, centered in each with empty magenta spacing, thick dark brown outlines. Top row: pink heart, four-point yellow sparkle, cream music note, light-blue sweat drop. Bottom row: tuft of orange and white cat fur, cream paw print, three short curved lines purring vibration, small grumpy puff of air. No letters/text.
```

### ui_tk_tab_door_candidate1.png

The initial door call used the shared common prompt plus: TK-UI03 door state target512x384 nine-slice72px. ONE same rounded rectangular tab as normal target reference3, painted old blue-grey #4e6b78 metal with a few scuffs and thick dark brown outline and attached drop. Preserve outer placement, width,height. Plain empty center, no door picture or icon. This call was rejected in visual QA and replaced by the exact corrected prompt above.


# Issue #3214 scene and cat originals, 2026-11-11

Built-in image generation, one asset per call. These are unprocessed candidate originals for Claude to choose, key and size. No transparency extraction, resizing, color correction or game integration was performed. Mandatory TK-SC01/TK-SC02/TKT-CAT13–16 delivered. Optional TKT-CAT09–12 not produced in this batch.

## References and roles

| Repository path | Role | SHA-256 |
|---|---|---|
| `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png` | Cat identity, markings, folded ears, proportions and artist hand; props line/shadow style | `9890e78c6b90f636861ddbabc5657191398dfbe3087bffb24d5704720b4f6f00` |
| `assets/sprites/characters/tetsuko/chr_tetsuko_smile.png` | Same artist expression reference; cat generations only | `3df30e566cd75707c686621a87e5071fe11e1ef6cf5faab441d6fb8348959c10` |
| `assets/sprites/characters/tetsuko/chr_tetsuko_sleep.png` | Round body and grouped fur paint; cat generations only | `7cbba9787ff8228d44b188f55f9154f40e1dcba9beba010d8958ce395381876e` |
| `assets/sprites/characters/hajime/chr_hajime_normal.png` | Dark work trouser colors ONLY; lap generation only | `6affe667e9cc665b53713c6a2319c1c91792e2e335e8408d9c941c364295e409` |
| `assets/ui/tetsuko/prop_tunnel.png` | Adopted tunnel rear opening orientation/scale; tail generation only | `62bd8cc1e10e07323f07267ed3b526f7334266fc55a554d6ee5a0d8214419419` |

All three cat references were attached to each new cat-pose generation, in normal/smile/sleep order. Lap used normal/hajime; tail used normal/tunnel. The final flop cleanup edit used only its own preceding candidate as edit target.

## Exact prompts and iteration history

### leap

ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを指定に変えます。①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。
STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her. Produce landscape 1536x1024 canvas.
POSE: Mid-air pounce seen from the side, facing right: the whole body stretched long, front legs reaching forward and up with toes spread, hind legs extended back, tail streaming behind, eyes wide and focused, ears forward (keep folded Scottish Fold shape). No ground.

### flop

ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを指定に変えます。①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。
STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her. Produce landscape 1536x1024 canvas.
POSE: Just landed after missing a pounce: sprawled on her belly, front legs splayed forward, hind legs tucked, looking back over her shoulder with a slightly ruffled, "that didn't happen" expression. Side view with body facing right; head turning back toward left over shoulder. Keep the small folded ears.

### flop_v2

ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを指定に変えます。①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。
STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her. Produce landscape 1536x1024 canvas.
POSE: Just landed after missing a pounce, a comically FLATTENED BELLY-FLOP, not a regular lying or sitting pose. SIDE VIEW with rump on LEFT and extended front paws on RIGHT. Belly/chest pressed flat low to an invisible ground line, both front legs stretched and splayed far to the RIGHT, hind legs tucked on left. Body axis LEFT-TO-RIGHT. Head at right end turned back over the shoulder toward UPPER LEFT with a slightly ruffled embarrassed 'that didn't happen' expression. Keep the round wide face and SMALL FOLDED ears. No ground or cast shadow. The silhouette should clearly convey belly-flop after failed leap, not a relaxed cat.

### flop_v3

Use case: precise-object-edit. Edit target image 1 is the belly-flop Tetsuko candidate. Change ONLY the one white sweat-drop cartoon symbol on her right cheek and the pink blush hatching on both cheeks: remove these marks, restoring the normal orange-and-white fur beneath them. Keep the entire cat's exact pose, four-legged anatomy, expression, folded ears, face, body proportions, outline, fur stripes, colors, magenta background, canvas size and placement completely unchanged. No new marks, objects or text. One isolated cat only.

### mew

ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを指定に変えます。①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。
STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her. Produce landscape 1536x1024 canvas.
POSE: Sitting upright and looking up at the viewer, mouth open in a short soft meow (small fangs, pink tongue), ears lifted slightly but still the same small folded Scottish Fold ears, eyes round. Preserve her short chubby neck and round wide face. Portrait-like centered composition within the landscape canvas.

### mew_v2

ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを指定に変えます。①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。
STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her. Produce PORTRAIT 1024x1536 canvas, with cat approximately 1300 pixels tall.
POSE: Sitting upright and looking up at the viewer, mouth open in a short soft meow (small fangs, pink tongue), ears lifted slightly but still the same small folded Scottish Fold ears, eyes round. Preserve her short chubby neck and round wide face. Centered full body within a PORTRAIT 1024x1536 canvas; cat 1300 px tall and all paws plus tail contained with small margins.

### poke

ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを指定に変えます。①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。
STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her. Produce landscape 1536x1024 canvas.
POSE: Sitting and lifting one front paw toward the viewer to poke, the pink paw pads clearly visible, head tilted a little, eyes curious. Exactly two front legs total: one resting on ground and one lifted; two rear legs seated. Small folded ears. Large centered full-body cat with longest dimension at least 1000 px.

### poke_v2

ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを指定に変えます。①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。
STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her. Produce PORTRAIT 1024x1536 canvas, with cat approximately 1300 pixels tall.
POSE: Sitting and lifting one front paw toward the viewer to poke, the pink paw pads clearly visible, head tilted a little, eyes curious. Exactly two front legs total: one resting on ground and one lifted; two rear legs seated. Small folded ears. Large centered full-body cat with longest dimension at least 1000 px.

### lap

Use case: illustration-story. Asset TK-SC01 prop_lap.png. Reference 1 is Tetsuko sprite for the same artist's dark brown outlines and two to three shaped cel-shadow steps ONLY. Reference 2 is Hajime sprite for dark charcoal work trouser clothing COLORS ONLY; do not draw his body or face. First-person view looking down at your own two knees while sitting on a bench, wearing dark work trousers in the same colors as Hajime. Only the knees and the tops of the thighs side by side, a soft dip between them where a cat can curl up; no hands, no cat, no bench, no shoes, no feet, no torso. Wide 2048x768 canvas with both thighs filling the lower wide silhouette. Plain solid magenta #FF00FF background, no floor, no cast shadow, no text, no watermark, no shisha equipment. A pair of knees viewed from the wearer's eyes, NOT a person standing. Dark brown confident outlines, flat local colors and 2-3 cel shadow steps, no 3D, no photographic texture, no airbrush gradients or glow.

### tail

Use case: illustration-story. Asset TK-SC02 prop_tunnel_tail.png. Reference 1 is the approved Tetsuko sprite for this exact cat's thick orange-and-brown striped tail, grouped fur tufts, dark brown outlines and 2-3 cel-shadow steps. Reference 2 is the approved teal tunnel ONLY for alignment with its small far/rear round opening behind the cylinder (rear mouth at upper right of image); do NOT draw the tunnel itself. Draw only Tetsuko's thick striped orange tail sticking out from the implied rear opening and curling upward at the tip. Tail root starts toward lower left, curls up and to the right. The root can be a small dark cut-off cross-section, but do not draw a hole disk, tunnel rim, body, paws or other objects. It must be a tail-only overlay, from where it leaves the opening. Plain solid magenta #FF00FF background. Square 512x512 canvas, fully contained tail with a little margin. No floor, no cast shadow, no text, no watermark, no shisha equipment. Same artist's warm dark brown outline and two to three shaped flat cel-shadow steps, no glow, gradient, 3D or photographic fur.

## Selection and QA

- Selected `leap`, `flop_v3`, `mew_v2`, `poke_v2`, `lap`, `tail`. Earlier flop faced the wrong way; v2 corrected right-facing body and flattened posture, v3 removed the sweat-drop symbol. A little warm cheek hatching remains. Initial mew/poke were regenerated on portrait canvases so the cat itself exceeds 1000 px.
- Visually inspected identity, folded ears, golden eyes, orange/white markings, round build, confident brown contour, grouped fur/cel steps, pose, paws, full-body framing, absence of text and equipment. These remain candidates, not an adoption decision. Final flop has rightward front paws and head turning upper-left.
- Approximate magenta from the image generator is retained unchanged, as allowed by #3214. Corners are not exact #FF00FF. Claude should key them with tolerance.
- `prop_lap` is exactly 2048×768. Tail output is 1254×1254 rather than requested 512×512: retain as original, Claude sizes later. Its root-to-tip direction matches the tunnel rear side; exact overlay scale/fit remains an integration check. Lap reaches the bottom canvas edge intentionally.
- Cats have subject bounding-box longest sides >1000 px (leap 1409; flop 1424; mew 1085; poke 1170), using a loose magenta exclusion only for measurement, never output editing. No object clipped.
- No runtime/source code touched. No browser test needed or run for original-only delivery. Repository/LFS commit and PR are pending because this executor has no Git checkout or LFS-upload connection; do not commit pointers without uploaded objects or bypass LFS with regular blobs.

## Delivered PNGs

| Filename | Pixels | Bytes | SHA-256 |
|---|---:|---:|---|
| `cat_flop.png` | 1536×1024 | 1511469 | `0c084e4aac569c07a9fc1ef9c1d4d7e97ece888ca28c6bfb6f209b77c31a9a29` |
| `cat_leap.png` | 1536×1024 | 1521628 | `5595380015c1796575559a17e15945521b7a8239358978c979981a4918bce75d` |
| `cat_mew.png` | 1024×1536 | 1619499 | `32486f60b589fbda344bb89e70191ec4befee356bf3999d3274650f1b8bff709` |
| `cat_poke.png` | 1024×1536 | 1617434 | `b499046b5ba0b151c6319991021f60a865405ca9d75bf3ffe369d9ac7edf5673` |
| `prop_lap.png` | 2048×768 | 1323164 | `21dc398a3d710b991e15c54e1b6c6f86a91a25c771e84e12b30235aeba415b05` |
| `prop_tunnel_tail.png` | 1254×1254 | 1358623 | `8fc4ab83c9b707b410077d53314f3a9490d650f89a60ce79391fd49d1779364a` |
