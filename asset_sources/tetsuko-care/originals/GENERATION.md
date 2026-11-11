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


# Issue #3213 — 茶トラと段ボール UI原画候補・別の生成（2026-11-11・オーナー経由の zip）

> Claude 追記: 同じ Issue の、上の節（PR #3223）とは別の生成。オーナーが zip で届けた。正規名は上の節の原画が使っているので、この節の原画は `*_candidate2.png`（不採用の戸は `ui_tk_tab_door_candidate3.png`）に改名して保存した。**画面に使っているのはこちら**（採否の理由は `asset_sources/tetsuko-care/README.md` の「TKT25・26 の採用の記録」）。以下の本文の名前は改名後に置き換えてある。

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
- `ui_tk_tab_door_candidate3.png` is rejected: it remained mostly cream with only a small blue-grey label. `ui_tk_tab_door_candidate2.png` is the corrected blue-grey main candidate.
- The icons and effect marks are still sheets. Do not assume a sheet can be used without a cell-placement/crop review.
- LFS upload/PR publication was unavailable in this task environment; do not interpret local/Space preservation as a GitHub commit. No repository state changed.

## Actual PNG files

| File | Pixels | Bytes | SHA-256 |
|---|---:|---:|---|
| `ui_tk_caption_candidate2.png` | 2172×724 | 1379831 | `4d9a72a3b8731f5c82ce088fd7853e0a9ac29f7310feaf315ef131491fd59eb7` |
| `ui_tk_fx_candidate2.png` | 1774×887 | 1429623 | `1c254bfea5bcacb6709c967974752fb2a60fa6debf70b5967017d4580a060408` |
| `ui_tk_heart_candidate2.png` | 1254×1254 | 1262267 | `0ac83fec398bce966339d65be31579e832873e625e2b489c6c277c9d2dbd9ba1` |
| `ui_tk_heart_empty_candidate2.png` | 1254×1254 | 1236313 | `e14094daa75adda39ea5dca3e66d52e45a0f46212b543ec400b493b883a1dc94` |
| `ui_tk_icons_candidate2.png` | 2172×724 | 1615897 | `ff6abf2f55dcadf258e9102d165003ab4ba40b1ab5ad01faf6580162b69be211` |
| `ui_tk_pill_candidate2.png` | 2172×724 | 1439907 | `19663d2cf0d15a4f3da89f35d6b4f21bccb8fb979ac498e2ec034a645962ff14` |
| `ui_tk_tab_candidate2.png` | 1448×1086 | 1668463 | `e6273aab4376e741fd75c6af9891709070c19b1e9aa81f06fb8c5a5018ce30a7` |
| `ui_tk_tab_door_candidate2.png` | 1448×1086 | 1261381 | `33385feeaf4d6367f5194213ec72c5cf45113ed51c89d8d351267ccc2b46b78d` |
| `ui_tk_tab_door_candidate3.png` | 1448×1086 | 1672025 | `03418fb1f8e45a11a28d7dbfb6598d7019447ce0164b0205869707b04fd2ab0d` |
| `ui_tk_tab_pressed_candidate2.png` | 1448×1086 | 1614024 | `da1468c0570177a8aeb4a118f32eb3f801f2d02c513ca01eecb5d513b19d3ec8` |
| `ui_tk_title_candidate2.png` | 2172×724 | 1687916 | `90895e4a4d2b191a607699f5a9dc844c573fc432e9c9da4d20e7942299b143a9` |
| `ui_tk_token_candidate2.png` | 1254×1254 | 1651367 | `00d3b9b673f4ec5788bb696fdd6c3c3567190436845909d26675a1f32384a777` |
| `ui_tk_token_active_candidate2.png` | 1254×1254 | 1667752 | `830312a7bad215a2527d536b9e1651c2ca5a4ba7d1e325b543d47ef9d544ddf2` |
| `ui_tk_token_pressed_candidate2.png` | 1254×1254 | 1709640 | `51fa3ec084eb95311b8793a9c215682a13f344ae8f765ff7075353011091701e` |
| `ui_tk_wish_candidate2.png` | 1374×1145 | 1250356 | `65e9ba472c5155a48e8ce59ea53c23891ebbf7ce8b76d39680e4ba4d79a66041` |

## Exact generation prompts

### ui_tk_icons_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI01 ui_tk_icons_candidate2.png, target 1536x512. Sheet of exactly twelve simple icons in 6 x 2 grid of equal 256px cells. Each icon centered, plenty of empty magenta between, no gridlines. Thick brown outlines, orange and cream fills, consistent same style. Top row left to right: open hand palm for petting, cat teaser wand fluffy feather, wooden handled slicker brush, small white treat dish, open cardboard box, notebook paw-print stamp. Bottom row: small instant camera, simple back door small window, heart, round thought bubble three dots, fingertip gently tapping small box, person sitting on bench side view. No text.
```

### ui_tk_token_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI02 target 384x384. ONE round button token 320px across centered. Cream paper face, thick dark brown rim, solid dark brown drop attached under bottom edge like thick standing sticker. Plain empty center, no icon. Normal state.
```

### ui_tk_token_pressed_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI02 pressed state target 384x384. ONE round cream button token, same size and centered position as normal state edit target reference 3, pushed down with attached dark brown drop almost gone. Preserve normal token's outline diameter, canvas and empty center. No icon.
```

### ui_tk_token_active_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI02 active state target 384x384. ONE round button token same size and centered position as normal edit target reference 3. Face tabby orange, few soft deep orange stripes near rim, two small folded cat ears on top edge. Thick brown rim, standing dark brown attached drop below. Plain empty center, no icon. Preserve canvas and token diameter.
```

### ui_tk_tab_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI03 target512x384, nine-slice72px on each edge. ONE rounded rectangular cream paper tab, thick dark brown outline, solid dark brown attached drop under bottom edge. Plain blank center. Edges parallel canvas. Normal state.
```

### ui_tk_tab_pressed_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI03 pressed state target512x384 nine-slice72px. ONE same rounded rectangular cream paper tab as normal target reference3, pushed down, attached brown drop almost gone. Preserve exact outer placement, width, height, plain empty center. No icon.
```

### ui_tk_tab_door_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI03 target512x384 nine-slice72px. Reference3 is exact normal tab edit target. Repaint ALL cream paper including the entire large blank center to flat old blue-grey #4e6b78 painted metal with a few small scuffs at edges. This is the back-door button. It must visibly be BLUE GREY across its whole surface, not a cream paper tab with a blue small label. Remove paw stamp, yarn ball, tape and stitched orange lines. Keep the exact rounded rectangle shape, canvas placement, dark brown outline and dark brown attached drop below. Center plain BLUE GREY with no icon or writing. No extra ornaments.
```

### ui_tk_heart_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI04 target160x160. ONE plump hand-drawn heart140px wide centered thick dark brown outline. Warm pink red fill, one small shaped flat highlight, no gloss. No other object. Keep it only the specified simple heart; no cardboard accents, tape, paw prints or decorative border. Flat cel shading.
```

### ui_tk_heart_empty_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI04 target160x160. ONE empty heart with EXACT same outline, canvas position and size as filled heart edit target reference3. Change only interior fill to cream #fff5e4. Preserve contour and position pixel aligned. No other object.
```

### ui_tk_pill_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI05 target512x160 nine-slice72px left/right,56px top/bottom. ONE rounded pill-shaped cream holder thick brown outline dark brown attached drop below. Plain empty center for row of hearts; no hearts or symbols. Only specified simple blank holder; no added paw stamps, tape, yarn balls or other decoration.
```

### ui_tk_wish_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI06 target384x320. ONE round cream cat-thought speech bubble thick dark brown outline, short pointed tail bottom right, soft flat dark attached drop beneath. Completely plain empty center, no dots, icon, text. Only simple blank bubble; no cardboard panels, paw stamps, tape, yarn or other decoration.
```

### ui_tk_caption_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI07 target1536x256 nine-slice left112px,right56px,top/bottom56px. ONE long cream paper strip rounded corners thick brown outline and attached brown drop below. ONLY left end has band tabby orange and deep orange stripes fitting left112px. Plain empty center for one text line. Edges straight parallel canvas. No additional tape, yarn, paw stamp, cat drawings or decorative icons.
```

### ui_tk_title_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI08 target768x224. ONE blank rounded cream title plate thick dark brown outline and attached drop. Two small folded tabby cat ears stick up top edge, round orange medallion with cream paw print at left end inside left200px, thin tabby stripes along bottom edge. Middle stays completely plain empty. No lettering.
```

### ui_tk_fx_candidate2.png

```text
ノベルゲーム「水煙前線」の看板猫てつこのミニゲーム「てつこといっしょ」のUI素材を1点だけ生成。参照①prop_boxは採用済み段ボール箱、線と段ボールの描き方の正本。参照②chr_tetsuko_normalは本人の色と線の正本。両方と同じ描き手。Use case: illustration-story. STYLE: hand-drawn game UI, theme tabby orange and cardboard. Cream paper #fff5e4 surfaces, thick confident dark brown #3b2416 outlines about 6px, tabby orange #f08a2e and deep orange #c25e1c, kraft cardboard #c9965c faint corrugation and fiber, blue-grey #4e6b78 only where requested, nose pink #f39aa6. Flat colors with one or two clean cel shadows, upper left light. Warm handmade stickers and cut cardboard. No lavender, smoke curls, glossy plastic, glow, airbrush gradients, 3D or photographic texture. No text, letters, digits, logo, watermark, cat face unless asked. Flat front-facing. Exact solid #FF00FF magenta background, including all empty canvas, no exterior cast shadow. For nine-slice keep decorations inside requested border bands, edges parallel and center plain evenly textured. PART: TK-UI09 target1024x512. Sheet exactly8 small effect marks in4x2 equal256px cell grid, centered in each with empty magenta spacing, thick dark brown outlines. Top row: pink heart, four-point yellow sparkle, cream music note, light-blue sweat drop. Bottom row: tuft of orange and white cat fur, cream paw print, three short curved lines purring vibration, small grumpy puff of air. No letters/text.
```

### ui_tk_tab_door_candidate3.png

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

## Issue #3243：TK-UI10〜20 候補原画（2026-11-11）

内蔵画像生成で1回に1点ずつ生成し、出力 PNG を加工せず保存した。Issue の ID とファイル名を数えると14ファイル（UI13・UI14・UI16 が各2枚）になる。本文の「13ファイル」と数が食い違うため、ファイル名の列挙を優先した。

### 参照画像と役割

| 役割 | 指定パス | SHA-256 | 取得元 |
|---|---|---|---|
| ① 線・紙・段ボールの縁の正本 | `assets/ui/tetsuko/ui_tk_token.png` | `29e97a7c2c1266203c72b7390693036c906db0568940f3495b8725cf51068845` | PR #3238 のブランチからファイルのみ取得 |
| ② 点線・肉球の判・テープの飾り方の正本 | `assets/ui/tetsuko/ui_tk_tab.png` | `bb9a7febd4e7f0ba6648270317ef90754e034074fa2d48c2ed1570f81cbc815d` | PR #3238 のブランチからファイルのみ取得 |
| ③ 色の正本（茶トラの橙・胸の白・焦げ茶の輪郭） | `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png` | `9890e78c6b90f636861ddbabc5657191398dfbe3087bffb24d5704720b4f6f00` | main の LFS 実体 |

毎回、次の役割ラベルと画風固定文を共通文の前に渡した。

```
参照画像① assets/ui/tetsuko/ui_tk_token.png（添付1）＝この組の線・紙・段ボールの縁の正本。
参照画像② assets/ui/tetsuko/ui_tk_tab.png（添付2）＝点線・肉球の判・テープの飾り方の正本。
参照画像③ assets/sprites/characters/tetsuko/chr_tetsuko_normal.png（添付3）＝色の正本（茶トラの橙・胸の白・焦げ茶の輪郭）。
①②と同じ描き手に見える画風で固定してください。
```

### 生成指示

以下は Issue 本文の共通文と PART 一覧の原文。各生成で共通文の `PART: （下の一覧から1つを貼る）` を該当 PART 行に置き換えた。

```
ノベルゲーム「水煙前線」の、看板猫てつこと遊ぶミニゲーム画面のUI部品を1枚だけ描いてください。
画面のテーマは「茶トラと段ボール」です。添付①②は、この画面ですでに使っている札の絵（線・紙・段ボールの縁・飾りの正本）、③はてつこの立ち絵（色の正本）です。①②と同じ描き手・同じ紙に見えるように描いてください。

STYLE: hand-drawn game UI in exactly the same hand as attachments 1 and 2. Cream paper #fff5e4 surfaces with fine paper fiber, thick confident dark brown #3b2416 outlines, tabby orange #f08a2e and deep orange #c25e1c accents, kraft cardboard #c9965c with torn edges and visible corrugation, small strips of paper tape, tiny paw-print stamps only as corner decoration. Flat colors with one or two clean cel-shadow steps, light from the upper left. No lavender, no smoke curls, no glossy plastic, no glow, no airbrush gradients, no 3D render, no photo texture.
Never bake in any text, letters, digits, question marks, logo or watermark (the game writes all text).
FORMAT: flat and front-facing. Plain solid magenta #FF00FF background around the part (the game keys it out); keep the magenta exactly #FF00FF. No drop shadow outside the part. For nine-slice parts, keep every decoration inside the stated border band (corners especially), keep straight edges parallel to the canvas, and keep the center plain and evenly textured.

PART: （下の一覧から1つを貼る）
```

```
TK-UI10 ui_tk_tray.png 1600x400, nine-slice (96 px left and right, 80 px top and bottom) — A shallow open cardboard tray seen from above, kraft cardboard with a dark brown outline, torn and corrugated rim, a short strip of tape on one corner, plain flat bottom inside.
TK-UI11 ui_tk_card.png 384x384, nine-slice (64 px) — A small cream paper card with rounded corners, thick dark brown outline and a small dark brown drop under it, a tiny tape piece on one top corner. Plain center.
TK-UI12 ui_tk_panel.png 1536x1024, nine-slice (112 px) — A large cream paper sheet with rounded corners, thick dark brown outline and drop, a few faint paper fibers, two small tape pieces on the top corners. Plain center.
TK-UI13 ui_tk_book.png 2048x1024, nine-slice (128 px), and ui_tk_book_spine.png 96x1024 — Book: an open notebook lying flat, kraft cardboard cover showing as a border around two cream pages, faint ruled lines, no spine in the middle (keep the center plain). Spine: only the middle binding strip, tabby orange and deep orange cloth stripes with a dark brown outline, seamless when tiled vertically. Make two images.
TK-UI14 ui_tk_photo.png 768x896 and ui_tk_tape.png 512x160 — Photo: the white border of an instant photo, wider at the bottom, warm white with a dark brown outline; the window inside is plain solid magenta #FF00FF. Tape: a torn piece of kraft paper tape, slightly see-through looking, jagged ends. Make two images.
TK-UI15 ui_tk_frame.png 1024x576, nine-slice (48 px) — A window cut out of a cardboard sheet: a 48 px band of kraft cardboard around the edge with rounded inner corners, the cut edge showing the wavy corrugated layer; the whole inside is plain solid magenta #FF00FF.
TK-UI16 ui_tk_flap.png 1024x1152 and ui_tk_packtape.png 256x1152 — Flap: one closed cardboard box flap filling the image, kraft cardboard with fiber, a faint stamped paw print, no text. Tape: a vertical strip of matte brown packing tape, seamless when tiled vertically. Make two images.
TK-UI17 ui_tk_slot.png 512x320, nine-slice (72 px) — A spot on the floor marked out with four L-shaped pieces of orange paper tape at the corners, like a place marked for a cat bed, slightly glowing warm. Only the four corner pieces and a very faint warm wash inside; the center is otherwise plain.
TK-UI18 ui_tk_badge.png 160x160 — A small round sticker in nose pink #f39aa6 with a thick dark brown outline and a white glint, slightly tilted, like a "new" sticker. Plain center (the game writes one character on it).
TK-UI19 ui_tk_nametag.png 384x128, nine-slice (48 px left and right) — A small tabby orange name tag with a thick dark brown outline, a punched hole on the left end and a tiny string. Plain center (the game writes a name on it).
TK-UI20 ui_tk_unknown.png 256x256 — A soft dark brown silhouette of a sitting chubby Scottish Fold cat (small folded ears, round face, thick tail) inside a dashed cream circle, like an unfound entry in a sticker album. No question mark, no letters.
```

UI13・UI14・UI16 の2枚組は、1回に1点とするため各呼び出しの冒頭に `この1回では <ファイル名> の1点だけを描いてください。` を付けた。UI14 のテープと UI16 の封テープは単体を得るため再生成し、それぞれ `写真の額を描かず、テープだけを画面に置いてください。` と `箱のふたを描かず、縦の封テープだけを画面に置いてください。` も付けた。ただし再生成後も両部品が同じキャンバスに混在した。

### 保存ファイルと機械検査

| 原画 | 実寸 | 指定寸法 | SHA-256 | 背景角の #FF00FF |
|---|---:|---:|---|---|
| `ui_tk_card.png` | 1254×1254 | 384×384 | `92470c1d53ba25cc56289e6ecfec1787ac5e90d3c1f79745fb75ed050768bb4c` | 不合格 |
| `ui_tk_book.png` | 1774×887 | 2048×1024 | `01efe546e6d4e8373793af61a88a36320dc12dddb590efb92038619d1ff79273` | 不合格 |
| `ui_tk_book_spine.png` | 1214×1295 | 96×1024 | `d97a2e7498e11e20cd787dc8787c3a893e9d5f945dfa9dd8267aecb864b6472b` | 不合格 |
| `ui_tk_panel.png` | 1536×1024 | 1536×1024 | `dd3131852462c6e3bd34cb1a641e988fbb9c276ec1c2fba70b0963d67b742d5d` | 不合格 |
| `ui_tk_tray.png` | 2172×724 | 1600×400 | `8d9914483e14ac2a6d342cbe1a0ae049a4c4bdc64453a8048f14ce91797b000e` | 不合格 |
| `ui_tk_slot.png` | 1586×992 | 512×320 | `c3290b0aefc3c30c6b5e5884e1e92db54dde219fb2c20ed66e9f99055b42d4da` | 不合格 |
| `ui_tk_photo.png` | 1161×1354 | 768×896 | `b707b6b928667b3ed4096189cdfba55e5bfed68ccdf0bbc3947ecffa07c7e58a` | 不合格 |
| `ui_tk_tape.png` | 2172×724 | 512×160 | `41c5e9b37b1dbc395db0f7fd633757f8642d7182299e9544006a95a2d6bebae7` | 不合格 |
| `ui_tk_frame.png` | 1672×941 | 1024×576 | `61552212e6d6b4c8cf909f9a452af659d537129343f97dd2eb08bec483f132e5` | 不合格 |
| `ui_tk_flap.png` | 1182×1330 | 1024×1152 | `9e9a1425f24f580834e1cf92b180174e87f92f5fad2c9e7417ae88e5142b957a` | 不合格 |
| `ui_tk_packtape.png` | 1182×1330 | 256×1152 | `6cf602c47e96e09b5367379979fc4e92d65333c4517b0bd9e012aae25f4d8e2a` | 不合格 |
| `ui_tk_badge.png` | 1254×1254 | 160×160 | `12921db61178d183c81f518e659634ba74c014d9e4becde1e271b6df78c3ec10` | 不合格 |
| `ui_tk_nametag.png` | 2172×724 | 384×128 | `142f928db219e7c97f845e137804b28edae039b9e0b4781c70e57499328fff6d` | 不合格 |
| `ui_tk_unknown.png` | 1254×1254 | 256×256 | `0e463e69b4a6735be39cc3a2b377aab2215e617c83d9ddd30fda0b1589cc2550` | 不合格 |

### 目視検査と採用上の注意

- 線と紙の色調は参照①②に近い。文字・数字・疑似文字・ロゴ・透かし・シーシャ機材は目視では見当たらない。
- 全ファイルで背景角が正確な #FF00FF ではなく色むらがあり、背景単色条件に不合格。指定寸法にも `ui_tk_panel.png` を除き不一致。出力 PNG を加工しない条件を守り、原画はそのまま残した。
- `ui_tk_tape.png` は写真枠とテープ、`ui_tk_packtape.png` は箱のふたと封テープが1枚に混在。再生成後も解消していない。
- `ui_tk_book.png` は中央に背が描かれ、専用の背画像と重なる。`ui_tk_slot.png` は四隅テープのほかに紙面と点線があり、中心が無地という条件に不合格。
- nine-slice の角飾りと中央の均一性は、寸法不一致と上記の構成問題があるため採用可能とは判定できない。これらは未採用の候補原画として扱う。
- 透過・切り分け・色補正・ゲーム組み込みは行っていない。
