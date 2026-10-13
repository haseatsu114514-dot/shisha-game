# 第2章予告の後半3カット — 制作記録

- 制作日: 2026-10-12
- 目的: 第1章終了後に挿入する90年代風の次回予告。夜の静けさと気遣いを通して、勝利の先にある葛藤と仲間の存在を予感させる。
- 制作: OpenAI image generation tool `image_gen.imagegen` によるオリジナル画像生成。既存ゲーム素材を本人性と店舗内装の参考として添付。
- 画風: オーナー依頼に従う90年代後半の手描きセルアニメ。太い輪郭、2段のセル影、控えめな彩度、精緻な背景。通常のゲーム立ち絵のピクセル画風とは意図的に分ける。
- 著作権/由来: 外部作品・実在ロゴ・市販キャラクターの画像は使用していない。人物・店舗参照は当リポジトリの採用済みアセット。90年代アニメという一般的な表現方法を指定し、特定作品や作家の模倣は指定していない。
- 正本確認: `AGENTS.md`、`docs/asset_ai_guidance.md`、`brand/character_profiles.md`、`data/characters.json`。追加ルール `asset_sources/shisha-hardware-reference/heroine-title-cg-rules-20261009.md` は sparse checkout のため `git show HEAD:<path>` で実際に読んだ。
- 機材描写: 全カットで本体・ボウル・HMD・炭・ホース・マウスピースを画面外へ指定。喫煙・制作画面ではないため機材の具体モデルは選定しない。首掛けマイチップも見切れる構図で、鎖だけをマイチップの代用として描いていない。
- 原画: PNGを生成結果から無加工コピーして保存。生成ライブラリだけに残さず、このディレクトリに保管。
- 配信用: `ffmpeg -i <source>.png -c:v libwebp -quality 90 -compression_level 6 <destination>.webp`。画像内容の編集・切り抜き・リサイズは行っていない。
- 寸法: 3枚すべて1448 × 1086px、4:3。不透明背景。

## 04_naru — 夜道、友人として厳しく気遣うなる

- 本人参照: `assets/sprites/characters/naru/chr_naru_normal.png`
- 本人設定: 23歳。好敵手であり友人として静かに苦言を伝える人物。傲慢な悪役・天才気取りにしない。
- 生成元: `/workspace/generated_images/exec-95312550-cf7f-4a7b-9932-a544a83c7e84.png`
- 原画: `04_naru.png`
- ゲーム用: `assets/cgs/ch2_preview/04_naru.webp`

### Exact generation prompt

Generate a BRAND NEW single 4:3 anime keyframe for an original Japanese visual novel's next-episode preview. Use the attached character sprite strictly as the identity reference, NOT the render style. This is Naru, age 23 Japanese young man: maintain exactly his youthful face proportions, slightly tanned skin, amber-gold eyes, tousled short silver hair with the same bang shapes and undercut, silver ear jewelry, black and white oversized streetwear jacket with subtle warm orange lining over a black shirt. His face must be recognizable as the attached man. Draw him in a premium late-1990s hand-painted cel animation style: bold controlled ink outlines, precise 2-step cel shadows, modest color saturation, slight organic paint grain, unusually detailed hand-painted background, beautiful cinematic still, no pixel art, no 3D, no modern airbrushed anime. COMPOSITION: solitary close portrait on a quiet Japanese city night street, head and upper shoulders only, eyes near the upper third. Naru occupies the right half of frame looking slightly toward the unseen friend at camera-left, with an earnest quiet serious expression that conveys a friend's protective concern rather than arrogance or villainy. Closed lips, thoughtful but firm eyes, soft stern eyebrows. Foreground streetlamp cool pale light softly outlines silver hair, warm distant shop windows and dark blue night shadows recede in perspective into the left half of frame. Some damp pavement reflections visible left bottom; detailed unbranded Japanese urban side street, shutters, wires, distant diffuse city lights. Do not add other people. Crop below upper chest: all neck pendant / mouthpiece items are BELOW the frame and entirely unseen; small chain can be tucked inside shirt. IMPORTANT: no hookah/shisha body, no bowls, no HMD, no coals, no hoses, no mouthpieces anywhere in frame, no smoking or cigarette. No text, captions, lettering, signage writing, brands, logos, watermark, borders, or UI. Full-bleed single artwork with an intended 4:3 picture area. Preserve the character identity while adapting the linework and lighting to nostalgic late-1990s television anime.

### Visual QA

原画をview_imageで開き、正規立ち絵と比較。銀髪の前髪/短髪、黄褐色の目、若い輪郭、耳飾り、黒白ジャケットと橙色の内側が本人と一致。口を閉じた静かな厳しさで、威嚇や悪役風ではない。夜道・湿った路面・電線・遠い窓灯りが細かく描かれる。手は画面外。首元のマイチップや機材、煙、文字、ロゴ、透かしは一切見えない。4:3確認済。

## 05_hajime — スマホの白光、はじめの不安

- 本人参照: `assets/sprites/characters/hajime/chr_hajime_normal.png`
- 画風参照: `asset_sources/ch2-preview/01_hajime.png`（描画方法のみ）
- 本人設定: 22歳の普通で感じのよい青年。冷たい強面・別人へ置き換えない。
- 生成元: `/workspace/generated_images/exec-8be51103-e5d2-45c9-ae0b-2315fc491f02.png`
- 原画: `05_hajime.png`
- ゲーム用: `assets/cgs/ch2_preview/05_hajime.webp`

### Exact generation prompt

Generate a BRAND NEW single full-bleed 4:3 anime keyframe for an original Japanese visual novel's next-episode preview. REFERENCE ROLES: first attached normal character sprite is the absolute identity / face / hair / clothing reference for Hajime, age 22 Japanese young man; second image is ONLY the established nostalgic painted cel style and linework of this preview sequence, not his pose or light. Match the youthful ordinary kind face, full clear grey-dark eyes, short messy black hair and long side-swept bangs, black baseball cap with NO emblem or logo, open black zip hoodie with beige drawcords over charcoal black T-shirt. Preserve his recognizable face proportions, don't elongate his jaw or narrow his eyes. Adapt to premium late-1990s hand-painted television cel anime, precise confident ink outlines, 2-step cel shadow shapes, modest saturation, gentle paint grain, very detailed night background, no pixel art or 3D. SCENE AND COMPOSITION: intimate portrait of Hajime alone late at night, positioned on the LEFT half of the frame, looking down at a dark small smartphone held in his RIGHT hand at bottom-center. Light from the screen is cold WHITE and underlights his face, so we instantly understand that a disturbing notification has interrupted his joy. Only a subtle worried expression: stopped smile, parted lips, raised inner brows, a thoughtful unsettled gaze, not melodramatic screaming or horror. Keep him looking like the cheerful man in reference, now with worry. His left hand is outside frame. The back of the smartphone faces the viewer and is plain black with one subtle camera, screen faces Hajime so no UI is visible. HAND: show anatomically natural single right hand wrapped around a normal palm-sized phone. SCREEN CONTENT MUST NOT APPEAR, no text or icons anywhere. Background: a modest Japanese city night pedestrian walkway viewed past his right shoulder, dim cool-blue storefront shutters and a receding dark alley, a few distant warm windows, carefully painted architecture, no other people. Large quiet shadow area to the right of his face. Crop at mid chest, the lower necklaces and all neck pendants / mouthpiece bodies are below frame and completely unseen, chains tucked under his shirt. All hookah/shisha hardware, bowls, heat management systems, coals, hoses, and mouthpieces are ENTIRELY OUTSIDE THE PICTURE. No smoking, smoke, cigarette, pipes, hookahs or tubes anywhere. No lettering, signage words, text, labels, caption, logo, brand, watermark, border, or UI. Mood: a tender young hero suddenly alone with an uneasy silence, a 1990s next-episode teaser of the pressure that comes after victory.

### Visual QA

原画をview_imageで開き、正規立ち絵と画風参照と比較。黒髪、黒キャップ、灰色の大きな目、黒いジップパーカーと薄い引き紐、年齢感を維持。笑いが止まったような控えめな不安の表情で、スマホ白光と背景の寒色が前半の明るい表情と対になる。スマホは自然な手掌サイズで背面のみ見え、手指は端末の周りに自然に収まり、画面文字・UIは写らない。夜の建物・窓灯りに遠近がある。首掛けマイチップ、シーシャ機材/ホース/吸い口、煙、文字、ロゴ、透かしなし。4:3確認済。

## 06_sumi — 閉店後のtonari、スミの眼差し

- 本人参照: `assets/sprites/characters/sumi/chr_sumi_normal.png`
- 店舗内装参照: `assets/backgrounds/bg_tonari_inside_night.png`（内装・光のみ。参照内の台は移さない）
- 画風参照: `asset_sources/ch2-preview/01_hajime.png`（描画方法のみ、顔はスミ正規立ち絵を優先）
- 本人設定: 46歳、tonariの師匠で良き理解者。黒キャスケット、四角い黒眼鏡、黒ひげ、黒シャツ、茶色の腰エプロン。
- 生成元: `/workspace/generated_images/exec-23181358-1026-4d50-9159-b019f90f1c13.png`
- 原画: `06_sumi.png`
- ゲーム用: `assets/cgs/ch2_preview/06_sumi.webp`

### Exact generation prompt

Generate a BRAND NEW single full-bleed 4:3 anime keyframe for an original Japanese visual novel's next-episode preview. REFERENCE ROLES: first attached normal character sprite is the absolute identity / face / hair / clothing reference for Sumi, age 46 Japanese man; second attached background is ONLY the tonari store's interior identity and lighting (IMPORTANT REMOVE ALL SHISHA HARDWARE from the depicted view); third attached image is ONLY the established nostalgic painted cel style and linework of this preview sequence, never its youthful face. Sumi must remain the recognizable mature mentor in the first reference: healthy tanned complexion, black newsboy cap, short black hair, square black-framed glasses with eyes clearly visible, warm dark eyes, thick natural brows, short full black beard and moustache, black charcoal button-up shirt with sleeves rolled to forearms, plain brown waist apron. Do not make him handsome young adult; preserve his gentle sturdy middle-aged face, nose and beard from the sprite. Render with premium late-1990s hand-painted television cel animation: carefully controlled bold ink outlines, 2-step cel shadows, modest saturation, light organic paint grain, intricate painted wood and glass materials, no pixel art, no 3D. SCENE: tonari after closing, calm familiar wooden counter corner. Sumi in medium-close upper-body portrait on RIGHT half, one forearm relaxed on a clean wood counter in the lower foreground, torso turned slightly to camera left, looking toward unseen Hajime with quiet concern and the reassurance of an experienced mentor. Soft settled near-smile with lips closed; eyes have calm acceptance with serious knowledge behind them. Not ominous, not villain. Keep face the main focus. A brown apron edge visible below black shirt near bottom; no neck jewelry. Behind him on left: wood window framing with deep-blue Japanese city night, olive green sofa corner at far left, warm pale ochre walls, wood beams; several distinctive Turkish mosaic pendant lamps in turquoise, red amber and blue, all different shapes, mosaic patterns, and hanging lengths, plus ordinary warm room lighting so his face is easy to see. Use the attached store background to identify the specific tonari place, NOT as an invitation to copy its hookahs. Compose tightly around clean counter and window, keep storage/display shelves outside frame. No plants or extra foliage. No other people. Crucial: all hookah/shisha BODIES, bowls, HMDs, coals, hoses and mouthpieces are ENTIRELY OFF CAMERA AND INVISIBLE; NOTHING shaped like a shisha on the counter, tables, shelves, foreground or background. The counter may have only a folded clean cloth, no apparatus, no glass vase or ornate pipe. No smoking or smoke. No words, letters, logos, labels, written signage, watermark, captions, borders or UI. Emotion: after the preview's uneasy night, a quiet mentor asks the viewer who this victory was for, with warmth and suspense.

### Visual QA

原画をview_imageで開き、正規立ち絵・tonari夜内装と比較。黒キャスケット、四角い眼鏡、黒髪/黒ひげ、成熟した輪郭、黒い袖まくりシャツ、茶色の腰エプロンが一致。眼鏡越しの落ち着いた目が見え、若い別人や威圧する黒幕になっていない。tonariの木窓、夜の街、緑ソファ、黄色い壁、暖かい木カウンターを維持。モザイクランプは青緑・赤橙・青など模様/吊り長さが異なり、人物は普通の室内照明で十分明るい。カウンター上は布だけで、背景棚やシーシャ本体/ホース/マウスピースは画面外。手元は下端の自然な見切れで破綻なし。観葉植物を追加せず、文字、ロゴ、透かし、煙なし。4:3確認済。

