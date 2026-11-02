# 規格そろえ：生成プロンプト

[立ち絵の規格](../../../docs/portrait_standard.md)に合わせて、頭の大きさと画風だけを直す依頼文。
顔・表情・ポーズ・衣装・色・全身の高さは変えない。

参照画像はリポジトリのファイルを、エージェントが自分で読み込んで渡す（オーナーに保存・添付を頼まない）。

- ① 対象の表情の現行PNG `assets/sprites/characters/<id>/chr_<id>_<face>.png`（表情差分では、②の前に合格済みの新しい通常原画 `asset_sources/portraits/<id>-remaster-v2/normal-source.png` も入れ、顔の同一性と頭の大きさの基準にする）
- ② 南雲 `assets/sprites/characters/nagumo/chr_nagumo_normal.png`（大人の男性の頭身の目標。6.93頭身）。女性（マキ・路上占い師）は、標準枠の女性の凛 `assets/sprites/characters/rin/chr_rin_normal.png`（6.53頭身）を使い、文中の Nagumo / he を Rin / she に直す
- ③ みんと `assets/sprites/characters/minto/chr_minto_normal.png`・④ あげは `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

## 生成後チェック（1枚ごと）

- [ ] `portrait_metrics.py grid --image` で原画を測り（頭身は縮小しても変わらない）、頭身が区分の規格内（標準6.4〜7.7）。各キャラの「目標」は書き方の目安で、合否は規格の範囲で決める
- [ ] 現行と並べて、顔・表情・手と肩の位置・衣装・小物・体格・色が変わっていない
- [ ] 線・影・ハイライト・描き込みの量が、みんと・あげはと原寸で並べて同じ作品に見える（規格3節）
- [ ] 原画の人物の高さが1300px以上。透過がきれい（手足の間も）。床・影・文字が無い

## 試作3人（通常）

規格外の向きと程度が違う3人で、頭の大きさの直し方と画風の寄せ方を試す。合格したら同じ書き方で残りへ広げる。

### 組長（神崎竜二）（`kumicho`）・normal

現在 6.29頭身 → 目標 6.7頭身（頭を約6%小さく）。参照：① `assets/sprites/characters/kumicho/chr_kumicho_normal.png` ／ ② 南雲 ／ ③ みんと ／ ④ あげは

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, outfit, accessories and colors as image 1. Change ONLY two things: the head-to-body proportion below and the rendering style standard below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and colors. (2) approved Nagumo normal sprite: the TARGET head-to-body proportion of an adult man ONLY (not his face, hair, build or suit). (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 2, 3 and 4.

Character: Kanzaki Ryuji 'the Shisha Kumicho', mature middle-aged Japanese man with stern authority, slicked-back salt-and-pepper hair, moustache, brown aviator sunglasses, beige windowpane double-breasted suit, black shirt, purple tie and pocket square, black leather shoes.
Expression and pose to keep exactly as image 1 (normal: stern composed expression, both hands in trouser pockets, confident stance)

HEAD SIZE CORRECTION: in image 1 the head is too LARGE for the body (about 6.3 heads tall). Make the whole head (face, hair and ears) about 6% SMALLER relative to the body so that he is about 6.7 heads tall, closer to image 2. Keep the same total height from the top of the hair to the shoe soles, the same stance, silhouette and body build; only the head changes scale relative to the body, and the neck and shoulders stay natural. He must still look like the same man of the same age.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rin sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the top of the head (including any hat) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's original local color palette, perceived saturation and light-dark range; do not lighten, desaturate or pastelize anything.
```

### スティーブ（`steve`）・normal

現在 8.04頭身 → 目標 7.4頭身（頭を約9%大きく）。参照：① `assets/sprites/characters/steve/chr_steve_normal.png` ／ ② 南雲 ／ ③ みんと ／ ④ あげは

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, outfit, accessories and colors as image 1. Change ONLY two things: the head-to-body proportion below and the rendering style standard below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and colors. (2) approved Nagumo normal sprite: the TARGET head-to-body proportion of an adult man ONLY (not his face, hair, build or suit). (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 2, 3 and 4.

Character: Steve Davis, 30-year-old white American man, clearly obese rounded silhouette with large capable hands, short slightly tousled dark brown hair, short beard, glasses, patterned retro teal-and-cream shirt with abstract motifs (no letters), dark practical apron, brown trousers and shoes, holding a tiny kitchen timer and a recipe card.
Expression and pose to keep exactly as image 1 (normal: warm focused small smile, timer held up in one hand, recipe card in the other)

HEAD SIZE CORRECTION: in image 1 the head is too SMALL for the body (about 8.0 heads tall). Make the whole head (face, hair and ears) about 9% LARGER relative to the body so that he is about 7.4 heads tall, like image 2. Keep the same total height from the top of the hair to the shoe soles, the same stance, silhouette and body build; only the head changes scale relative to the body, and the neck and shoulders stay natural. He must still look like the same man of the same age.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rin sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the top of the head (including any hat) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's original local color palette, perceived saturation and light-dark range; do not lighten, desaturate or pastelize anything.
```

### ヴォルク（`volk`）・normal

現在 9.04頭身 → 目標 7.4頭身（頭を約22%大きく）。参照：① `assets/sprites/characters/volk/chr_volk_normal.png` ／ ② 南雲 ／ ③ みんと ／ ④ あげは

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, outfit, accessories and colors as image 1. Change ONLY two things: the head-to-body proportion below and the rendering style standard below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and colors. (2) approved Nagumo normal sprite: the TARGET head-to-body proportion of an adult man ONLY (not his face, hair, build or suit). (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 2, 3 and 4.

Character: Volk Ivanov, adult Russian man, tall and broad-shouldered, angular masculine face, very short ash-blond hair, pale blue eyes, black turtleneck, long charcoal coat, belt, black trousers and boots.
Expression and pose to keep exactly as image 1 (normal: serious reserved expression, arms relaxed at his sides, upright stance)

HEAD SIZE CORRECTION: in image 1 the head is too SMALL for the body (about 9.0 heads tall). Make the whole head (face, hair and ears) about 22% LARGER relative to the body so that he is about 7.4 heads tall, like image 2. Keep the same total height from the top of the hair to the shoe soles, the same stance, silhouette and body build; only the head changes scale relative to the body, and the neck and shoulders stay natural. He must still look like the same man of the same age.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rin sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the top of the head (including any hat) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's original local color palette, perceived saturation and light-dark range; do not lighten, desaturate or pastelize anything.
```

## みんと営業姿（頭を私服に合わせる）

参照：① 対象の表情の現行PNG `assets/sprites/characters/minto/chr_minto_<face>.png` ／ ② みんと私服 `assets/sprites/characters/minto/chr_minto_ura_normal.png`（同じ人物の頭の大きさの目標）／ ③ あげは `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の確認だけ）。表情は normal・smile・sad・surprise・wink の5つ。営業姿はみんと自身が画風の基準なので、画風は変えない。

```
Redraw the attached CURRENT game sprite of Minto (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same face design, eyes, expression, pose, hands, outfit, accessories, colors and rendering style as image 1. Change ONLY the head size.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for everything except head size. (2) the SAME woman in her casual outfit: the TARGET head size relative to her body ONLY (not her clothes or pose). (3) approved Ageha sprite: rendering-quality check only; never copy her face, hair or outfit.

Character: Minto, adult Japanese woman with a youthful idol-like face, long straight black hair with blunt bangs, mint-green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept-cafe dress with a large green ribbon and heart choker, black thigh-high stockings and platform shoes.

HEAD SIZE: in image 1 her head is smaller relative to her body than in image 2 (about 7.0 heads tall versus about 6.4). Make her whole head (face, hair, horns) about 10% LARGER relative to her body so that she matches image 2, about 6.4 heads tall. Keep the same total height from the top of the hair to the shoe soles, the same stance and the same slim build; the neck and shoulders stay natural.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure at least 1300 px tall. Include all hair tips, horns, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background. No floor, cast shadow, glow, border, text or watermark. Preserve image 1's original colors, saturation and light-dark range.
```

## 表情差分：サイ・零・マキ・太陽（TS11）

2026-11-02 オーナー「推奨のをお願い」で、通常はサイB・零C-v2・マキB・太陽Bに決まった。残りの表情を、この新しい通常と同じ頭の大きさで作る。全表情が合格したら、キャラ単位で組み込む。

参照画像（エージェントが自分で読み込んで渡す）：① 対象の表情の現行PNG `assets/sprites/characters/<id>/chr_<id>_<face>.png` ／ ② 合格した通常の原画 `asset_sources/portraits/<id>-remaster-v2/normal-source.png` ／ ③ 頭身の文脈（男性は南雲、マキは凛）／ ④ みんと ／ ⑤ あげは（画風だけ）。

合格の条件：②と同じ頭の大きさ（会話画面で±5%以内。`tools/portrait_metrics.py grid --image` で測る）、①の表情・手・ポーズのまま、髪・手・靴が切れていない。

### 六角サイ（`sai`）　②＝`sai-remaster-v2/normal-source.png（推奨B）`

#### smile

```
Identity-preserving redraw of a full-body visual-novel sprite: 六角サイ (sai) SMILE expression. Reference roles IN ORDER: image 1 is the current smile sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new sai normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Rokukaku Sai, 28-year-old Japanese male board-game cafe owner, slim tall adult, tidy black hair with a loose swept side part and a small curled lock, dark green waistcoat over an ivory shirt with rolled sleeves, long charcoal cafe apron with small brass fastenings, small hexagonal brass pin, short pencil in the apron pocket, dark trousers, brown leather shoes. No glasses. Kind, calmly unreadable; never a villain.
Expression and pose to keep from image 1 (smile): narrow closed smiling eyes (curved lines, no irises), a slightly wider gentle closed-mouth smile, both empty hands loosely clasped in front of the apron, listening head tilt. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### serious

```
Identity-preserving redraw of a full-body visual-novel sprite: 六角サイ (sai) SERIOUS expression. Reference roles IN ORDER: image 1 is the current serious sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new sai normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Rokukaku Sai, 28-year-old Japanese male board-game cafe owner, slim tall adult, tidy black hair with a loose swept side part and a small curled lock, dark green waistcoat over an ivory shirt with rolled sleeves, long charcoal cafe apron with small brass fastenings, small hexagonal brass pin, short pencil in the apron pocket, dark trousers, brown leather shoes. No glasses. Kind, calmly unreadable; never a villain.
Expression and pose to keep from image 1 (serious): eyes narrowly open with calm grey irises, composed small closed mouth, one hand raised palm-up at chest height as if explaining, the other hand resting at the apron. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### surprise

```
Identity-preserving redraw of a full-body visual-novel sprite: 六角サイ (sai) SURPRISE expression. Reference roles IN ORDER: image 1 is the current surprise sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new sai normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Rokukaku Sai, 28-year-old Japanese male board-game cafe owner, slim tall adult, tidy black hair with a loose swept side part and a small curled lock, dark green waistcoat over an ivory shirt with rolled sleeves, long charcoal cafe apron with small brass fastenings, small hexagonal brass pin, short pencil in the apron pocket, dark trousers, brown leather shoes. No glasses. Kind, calmly unreadable; never a villain.
Expression and pose to keep from image 1 (surprise): eyes open showing grey irises, small open mouth, one hand touching his chin, the other forearm across his waist. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### thinking

```
Identity-preserving redraw of a full-body visual-novel sprite: 六角サイ (sai) THINKING expression. Reference roles IN ORDER: image 1 is the current thinking sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new sai normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Rokukaku Sai, 28-year-old Japanese male board-game cafe owner, slim tall adult, tidy black hair with a loose swept side part and a small curled lock, dark green waistcoat over an ivory shirt with rolled sleeves, long charcoal cafe apron with small brass fastenings, small hexagonal brass pin, short pencil in the apron pocket, dark trousers, brown leather shoes. No glasses. Kind, calmly unreadable; never a villain.
Expression and pose to keep from image 1 (thinking): half-open eyes glancing aside, index finger resting on his lips, the other arm across his waist supporting that elbow. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

### 零-REI-（`rei`）　②＝`rei-remaster-v2/normal-source.png（推奨C-v2）`

#### sad

```
Identity-preserving redraw of a full-body visual-novel sprite: 零-REI- (rei) SAD expression. Reference roles IN ORDER: image 1 is the current sad sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new rei normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: REI, 25-year-old Japanese visual-kei cafe manager, lean androgynous adult man, asymmetric layered hair deep blood-red on one side and jet black on the other, pale skin, dark eyeliner, burgundy eyes, rose and floral tattoos on neck and hands, black nails, fitted black velvet long coat with red lining, red/silver floral trim, silver buttons and waist chains, black shirt and waistcoat, narrow black trousers, black leather boots. Shy and serious behind the bold look; never sneering.
Expression and pose to keep from image 1 (sad): eyes lowered or closed, head tilted down, small downturned mouth, one hand gripping the coat front at his chest. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### serious

```
Identity-preserving redraw of a full-body visual-novel sprite: 零-REI- (rei) SERIOUS expression. Reference roles IN ORDER: image 1 is the current serious sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new rei normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: REI, 25-year-old Japanese visual-kei cafe manager, lean androgynous adult man, asymmetric layered hair deep blood-red on one side and jet black on the other, pale skin, dark eyeliner, burgundy eyes, rose and floral tattoos on neck and hands, black nails, fitted black velvet long coat with red lining, red/silver floral trim, silver buttons and waist chains, black shirt and waistcoat, narrow black trousers, black leather boots. Shy and serious behind the bold look; never sneering.
Expression and pose to keep from image 1 (serious): level focused gaze, closed mouth, the same cuff-adjusting pose as the normal. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### smile

```
Identity-preserving redraw of a full-body visual-novel sprite: 零-REI- (rei) SMILE expression. Reference roles IN ORDER: image 1 is the current smile sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new rei normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: REI, 25-year-old Japanese visual-kei cafe manager, lean androgynous adult man, asymmetric layered hair deep blood-red on one side and jet black on the other, pale skin, dark eyeliner, burgundy eyes, rose and floral tattoos on neck and hands, black nails, fitted black velvet long coat with red lining, red/silver floral trim, silver buttons and waist chains, black shirt and waistcoat, narrow black trousers, black leather boots. Shy and serious behind the bold look; never sneering.
Expression and pose to keep from image 1 (smile): soft small closed-mouth smile with slightly narrowed eyes, the same cuff-adjusting pose. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### surprise

```
Identity-preserving redraw of a full-body visual-novel sprite: 零-REI- (rei) SURPRISE expression. Reference roles IN ORDER: image 1 is the current surprise sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new rei normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: REI, 25-year-old Japanese visual-kei cafe manager, lean androgynous adult man, asymmetric layered hair deep blood-red on one side and jet black on the other, pale skin, dark eyeliner, burgundy eyes, rose and floral tattoos on neck and hands, black nails, fitted black velvet long coat with red lining, red/silver floral trim, silver buttons and waist chains, black shirt and waistcoat, narrow black trousers, black leather boots. Shy and serious behind the bold look; never sneering.
Expression and pose to keep from image 1 (surprise): eyes wide, lips slightly parted, hands near the chest and cuff as in image 1. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

### 斧崎マキ（`maki`）　②＝`maki-remaster-v2/normal-source.png（推奨B）`

#### excited

```
Identity-preserving redraw of a full-body visual-novel sprite: 斧崎マキ (maki) EXCITED expression. Reference roles IN ORDER: image 1 is the current excited sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new maki normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Rin is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Onozaki Maki, 34-year-old Japanese woman who runs an axe-throwing bar, tall athletic adult with broad shoulders and strong forearms, short swept-back dark auburn hair with a copper streak, amber eyes, freckles, rust-red rolled-sleeve work shirt over a charcoal undershirt, worn dark-brown leather work apron with brass rivets and a small axe-shaped pin, dark work trousers, sturdy lace-up boots. No axe or handheld weapon.
Expression and pose to keep from image 1 (excited): big open-mouth laugh, eyes open and bright, one fist raised beside her shoulder, the other fist lowered at her side, energetic lean. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### serious

```
Identity-preserving redraw of a full-body visual-novel sprite: 斧崎マキ (maki) SERIOUS expression. Reference roles IN ORDER: image 1 is the current serious sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new maki normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Rin is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Onozaki Maki, 34-year-old Japanese woman who runs an axe-throwing bar, tall athletic adult with broad shoulders and strong forearms, short swept-back dark auburn hair with a copper streak, amber eyes, freckles, rust-red rolled-sleeve work shirt over a charcoal undershirt, worn dark-brown leather work apron with brass rivets and a small axe-shaped pin, dark work trousers, sturdy lace-up boots. No axe or handheld weapon.
Expression and pose to keep from image 1 (serious): focused level look, closed mouth, one index finger raised as if making a point, the other hand on her hip. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### smile

```
Identity-preserving redraw of a full-body visual-novel sprite: 斧崎マキ (maki) SMILE expression. Reference roles IN ORDER: image 1 is the current smile sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new maki normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Rin is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Onozaki Maki, 34-year-old Japanese woman who runs an axe-throwing bar, tall athletic adult with broad shoulders and strong forearms, short swept-back dark auburn hair with a copper streak, amber eyes, freckles, rust-red rolled-sleeve work shirt over a charcoal undershirt, worn dark-brown leather work apron with brass rivets and a small axe-shaped pin, dark work trousers, sturdy lace-up boots. No axe or handheld weapon.
Expression and pose to keep from image 1 (smile): one eye closed in a laughing wink, teeth-showing grin, a thumbs-up with one hand, the other hand on her hip. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### surprise

```
Identity-preserving redraw of a full-body visual-novel sprite: 斧崎マキ (maki) SURPRISE expression. Reference roles IN ORDER: image 1 is the current surprise sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new maki normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Rin is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Onozaki Maki, 34-year-old Japanese woman who runs an axe-throwing bar, tall athletic adult with broad shoulders and strong forearms, short swept-back dark auburn hair with a copper streak, amber eyes, freckles, rust-red rolled-sleeve work shirt over a charcoal undershirt, worn dark-brown leather work apron with brass rivets and a small axe-shaped pin, dark work trousers, sturdy lace-up boots. No axe or handheld weapon.
Expression and pose to keep from image 1 (surprise): wide eyes, open mouth, both hands raised palms out at shoulder height. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

### ダ・シルヴァ太陽（`da_silva`）　②＝`da_silva-remaster-v2/normal-source.png（推奨B）`

#### excited

```
Identity-preserving redraw of a full-body visual-novel sprite: ダ・シルヴァ太陽 (da_silva) EXCITED expression. Reference roles IN ORDER: image 1 is the current excited sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new da_silva normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Da Silva Taiyo, 28-year-old Brazilian man, tanned athletic adult, dark curly mid-short hair, warm brown eyes, red/yellow tropical floral dark-green short-sleeve shirt open over a white tank top, ivory wide trousers, brown crossed-strap leather sandals, green/yellow wristband. No props.
Expression and pose to keep from image 1 (excited): big open-mouth laugh with a wink, one arm raised high reaching outward with an open five-finger hand, the other fist pumped near his shoulder. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### serious

```
Identity-preserving redraw of a full-body visual-novel sprite: ダ・シルヴァ太陽 (da_silva) SERIOUS expression. Reference roles IN ORDER: image 1 is the current serious sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new da_silva normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Da Silva Taiyo, 28-year-old Brazilian man, tanned athletic adult, dark curly mid-short hair, warm brown eyes, red/yellow tropical floral dark-green short-sleeve shirt open over a white tank top, ivory wide trousers, brown crossed-strap leather sandals, green/yellow wristband. No props.
Expression and pose to keep from image 1 (serious): calm level gaze, closed mouth, arms folded across his chest. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### smile

```
Identity-preserving redraw of a full-body visual-novel sprite: ダ・シルヴァ太陽 (da_silva) SMILE expression. Reference roles IN ORDER: image 1 is the current smile sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new da_silva normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Da Silva Taiyo, 28-year-old Brazilian man, tanned athletic adult, dark curly mid-short hair, warm brown eyes, red/yellow tropical floral dark-green short-sleeve shirt open over a white tank top, ivory wide trousers, brown crossed-strap leather sandals, green/yellow wristband. No props.
Expression and pose to keep from image 1 (smile): confident teeth-showing smile, one arm reaching forward and down with an open hand, the other hand in his trouser pocket. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

#### surprise

```
Identity-preserving redraw of a full-body visual-novel sprite: ダ・シルヴァ太陽 (da_silva) SURPRISE expression. Reference roles IN ORDER: image 1 is the current surprise sprite: keep its exact expression, mouth, head angle, hand and shoulder positions, pose, clothing, accessories and colors. Image 2 is the APPROVED new da_silva normal original: use THIS SAME person's face design, age, head size and head-to-body ratio (about 7 heads tall), linework and figure scale, so that image 2 and this sprite can switch in the game without the head changing size. Image 3 Nagumo is head-to-body proportion context only, never identity. Images 4 Minto and 5 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes.

Character: Da Silva Taiyo, 28-year-old Brazilian man, tanned athletic adult, dark curly mid-short hair, warm brown eyes, red/yellow tropical floral dark-green short-sleeve shirt open over a white tank top, ivory wide trousers, brown crossed-strap leather sandals, green/yellow wristband. No props.
Expression and pose to keep from image 1 (surprise): wide eyes, small open mouth, one arm reaching outward with a spread hand, the other hand in his trouser pocket. Match image 2's head size, NOT image 1's smaller head.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

## 作り直し：路上占い師・シェイク・王煙楼（TS12）

1回目（TS10）は「頭を約○%大きく」の指示で、頭が2〜9%しか大きくならず、規格（6.4〜7.7頭身）に届かなかった。フード・頭巾・長いひげで頭頂やあごが隠れているのが原因とみられる。今回は**画像の中の大きさをpxで**指定する。参照画像は①現行の通常、②南雲（頭身の文脈だけ）、③みんと・④あげは（画風だけ）。

合格の条件：目の高さからあごまでの長さが、全身の高さ（頭・フードの上端〜靴底）の目安の値以上。全身1400pxなら、路上占い師 約85px・シェイク 約100px・王煙楼 約85px。顔・年齢・衣装・ポーズは①のまま。

### 路上占い師（`uranaishi`）・normal

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY the head size and the rendering style standard below. Image 2 Nagumo is ONLY adult head-to-body proportion context (about 7 heads tall), never his face, hair, build or clothes. Images 3 Minto and 4 Ageha are ONLY rendering-style references.

Character: the street fortune teller, an elderly woman with a warm knowing smile, silver hair with small braids, wrinkles, a deep purple layered hooded robe with burgundy sash and lining, gold ornaments and tassels, three tarot cards fanned in one hand, the other palm open and extended toward the viewer, brown shoes.

HEAD SIZE (the previous attempt failed because a percentage instruction barely changed the head): Under the hood the skull is hidden, so size the FACE: in a figure about 1400 px tall (hood top to soles), the distance from the eye line to the chin must be about 85 px (now it is about 67 px), and the face from the eyebrows to the chin about 125 px. Enlarge the whole face, hair, ears and hood opening together, not only the hood. Keep the total figure height, the robe silhouette, both hands, the cards and the stance. The character must still look like the same person of the same age.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

### シェイク（`sheikh`）・normal

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY the head size and the rendering style standard below. Image 2 Nagumo is ONLY adult head-to-body proportion context (about 7 heads tall), never his face, hair, build or clothes. Images 3 Minto and 4 Ageha are ONLY rendering-style references.

Character: Sheikh Al-Ghariyan, a 52-year-old Emirati man with a calm composed face, tan skin, dark beard with grey, white ghutra headcloth with a black agal, white kandura with a gold-trimmed outer robe, ring and wristwatch, black and gold shoes, one hand lowered and the other near his abdomen.

HEAD SIZE (the previous attempt failed because a percentage instruction barely changed the head): The skull is hidden by the headcloth, so size the FACE: in a figure about 1400 px tall (headcloth top to soles), the distance from the eye line to the chin (under the beard) must be about 100 px (now it is about 79 px). Enlarge the whole face, beard, headcloth and agal together. Keep the total figure height, the robe silhouette, both hands and the stance. The character must still look like the same person of the same age.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

### 王煙楼（`master_hookah`）・normal

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY the head size and the rendering style standard below. Image 2 Nagumo is ONLY adult head-to-body proportion context (about 7 heads tall), never his face, hair, build or clothes. Images 3 Minto and 4 Ageha are ONLY rendering-style references.

Character: Wang Yanlou, a stern 58-year-old Chinese shisha master, white hair tied in a long braid, long white beard tied at the end, wrinkles, arms folded, crimson frog-button jacket with a half cape and gold cuffs, black trousers and shoes, one coiled hose with a rigid brass handle stored at the waist.

HEAD SIZE (the previous attempt failed because a percentage instruction barely changed the head): The chin is hidden by the long beard, so size the FACE: in a figure about 1400 px tall (hair top to soles), the distance from the eye line to the lower lip must be about 70 px, and to the estimated chin under the beard about 85 px (now about 65 px). Enlarge the whole head, hair, ears and beard together. Keep the total figure height, the folded arms, the cape and the stance. The stored hose is ONE continuous coiled hose with exactly two ends: a small metal connector at one end and a rigid brass handle with a mouthpiece at the other. It never forks, breaks, floats or shows a third end. It is stored, not connected to any hookah; draw no hookah, bowl, coal or smoke. Follow docs/shisha_reference.md section 4 and pass one hose-and-handle photograph from siryou web-refs as a structure-only reference. The character must still look like the same person of the same age.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

## 作り直し：サイフ・ラシード（TS13）

2026-11-02 第4章で追加された2人。`portrait_metrics.py check` でサイフ 8.62頭身・ラシード 9.75頭身（全員で最も頭が小さい）。オーナー「作り直して良い　見た目は今のがいいけど」で作り直す。**顔・衣装・色・ポーズ・持ち物は今の絵のまま、頭の大きさだけ**を直す。

TS10 で「頭を約○%大きく」が効かなかったので、TS12 と同じく**画像の中の大きさをpxで**指定する。目標は南雲の実測（全身1400pxのとき、目〜あご 84px・頭頂〜あご 201px・頬の幅 113px）。
参照画像は①現行の通常、②南雲（頭身の文脈だけ）、③みんと・④あげは（画風だけ）。

合格の条件：全身1400px換算で、サイフは目〜あご 約85px（今69px）・頭頂〜あご 約195px（今162px）、ラシードは目〜あご 約92px（今72px）。`portrait_metrics.py grid --image` で原画を測り、頭身が 6.4〜7.7。顔・衣装・持ち物・ポーズが①と同じ。

### サイフ（`saif`）・normal

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY the head size and the rendering style standard below. The owner likes the current look: whenever the style references and image 1 disagree, stay closer to image 1. Image 2 Nagumo is ONLY adult head-to-body proportion context (about 7 heads tall), never his face, hair, build or clothes. Images 3 Minto and 4 Ageha are ONLY rendering-style references.

Character: Saif, a 24-year-old Emirati young man, tall and slim, warm brown skin, short cropped black hair with a neat fade, a thin trimmed beard along the jaw and chin, big friendly eyes, a relaxed closed-mouth smile with a slight head tilt. Black short-sleeved polo shirt with no logo or letters, sand-colored slim chinos, white sneakers, thin brown leather cords on the right wrist. Pose kept from image 1: right hand raised at shoulder height holding a small round brass flavor tin, left hand in the trouser pocket, weight on one leg.

HEAD SIZE (a percentage instruction did not work last time, so use pixels): in a figure about 1400 px tall (hair top to soles), the distance from the eye line to the chin must be about 85 px (now about 69 px), and from the top of the hair to the chin about 195 px (now about 162 px), so that he is about 7 heads tall like image 2. Enlarge the whole head, hair, ears and beard together with natural neck and shoulders. Keep the total figure height, the slim long-legged silhouette, both hands, the tin and the stance. He must still look like the same young man.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

### ラシード（`rashid`）・normal

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY the head size and the rendering style standard below. The owner likes the current look: whenever the style references and image 1 disagree, stay closer to image 1. Image 2 Nagumo is ONLY adult head-to-body proportion context (about 7 heads tall), never his face, hair, build or clothes. Images 3 Minto and 4 Ageha are ONLY rendering-style references.

Character: Rashid, a 56-year-old Emirati man, sun-tanned face with deep wrinkles, short grey-and-white beard and moustache, calm sharp eyes, a slight knowing closed-mouth smile. Red-and-white checked ghutra headcloth held by a black agal, the cloth ends falling over both shoulders and down the back. White long-sleeved kandura reaching the ankles, an old sand-colored utility vest with pockets over it, brown leather shoes. Pose kept from image 1: right hand at waist height holding a small black car-key-sized remote controller with a short wrist strap, left hand in the vest or kandura pocket, upright relaxed stance.

HEAD SIZE (a percentage instruction did not work last time, so use pixels): the skull is hidden by the headcloth, so size the FACE: in a figure about 1400 px tall (headcloth top to soles), the distance from the eye line to the chin (under the beard) must be about 92 px (now about 72 px), and the face width at the cheekbones about 120 px (now about 98 px). Enlarge the whole face, beard, headcloth and agal together, with natural neck and shoulders. Keep the total figure height, the long kandura silhouette, both hands, the remote and the stance. He must still look like the same man of the same age.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rin sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Preserve image 1's original local colors, saturation and light-dark range. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the hair top to the soles. Entire hair, both hands and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
```

## 試作1回目でわかったこと（2026-11-02）

Codex が上の3つの英文で各3案（計9案）を生成した。頭身は次のとおりで、指定した拡大率どおりにはならなかった。

| キャラ | 指定 | 結果（Codex の計測／Claude の計測） |
|---|---|---|
| 組長 | 6.29→6.7（頭を6%小さく） | A 7.17／7.41、B 7.45／7.17、C 7.10／6.75 |
| スティーブ | 8.04→7.4（頭を9%大きく） | A 6.89／6.80、B 6.99／6.98、C 6.88／6.74 |
| ヴォルク | 9.04→7.4（頭を22%大きく） | A 7.70／7.53、B 7.70／7.64、C 7.92／7.72 |

- 拡大率の指定は効かず、元の頭身にかかわらず約6.8〜7.7頭身に寄った。参照②（南雲・6.93頭身）に引っ張られたとみられる。残りの人は拡大率を書かず、「image 2 と同じ約7頭身」と書くほうが確実。
- 頭頂・あごの読み取りには1枚あたり±4px（約±0.2頭身）の差が出る。境目の案は2人で測る。
- 頭身のほかに、余白の不足（スティーブA・ヴォルクAは足底が画像の端に接する）、透明度の低いノイズ、髪・靴の艶の残りがあった。

## 残りの人（試作の結果を見てから書く）

試作の書き方に、各キャラの人物の行（`Character:`）と表情の行を入れて作る。人物の行は下の既存プロンプトから写す。頭の大きさは「約○%大きく」ではなく「image 2 と同じ約7頭身に」と書く（下の「試作1回目でわかったこと」）。

| キャラ | 現在 | 頭の拡大 | 表情 | 人物の行の出典 |
|---|---:|---:|---|---|
| 六角サイ（`sai`） | 8.39 | 約13% | normal・smile・serious・surprise・thinking | asset_sources/venue-staff/sai/normal-prompt.txt |
| 零-REI-（`rei`） | 8.67 | 約17% | normal・smile・serious・surprise・sad | asset_sources/ch2-characters/rei/normal-prompt.txt |
| 斧崎マキ（`maki`） | 8.74 | 約18% | normal・smile・serious・surprise・excited | asset_sources/venue-staff/maki/normal-prompt.txt |
| 路上占い師（`uranaishi`） | 8.78 | 約19% | normal・smile・serious・surprise・sad | asset_sources/portraits/style-unify-20261026/uranaishi/normal-prompt.txt |
| シェイク（`sheikh`） | 8.88 | 約20% | normal・smile・serious・surprise・smug | asset_sources/portraits/expressions-5-20261102/sheikh/prompt.txt |
| 王煙楼（`master_hookah`） | 8.98 | 約21% | normal・smile・serious・surprise・sad・angry・laugh | （原画の記録なし。data/characters.json の外見メモから書く） |
| ダ・シルヴァ太陽（`da_silva`） | 9.08 | 約23% | normal・smile・serious・surprise・excited | asset_sources/portraits/expressions-5-20261102/da_silva/prompt.txt |

上園（6.38頭身）は測定の誤差の範囲の境目なので、オーナーが望むときだけ作り直す。みんとの私服（営業姿より頭が12%大きい）は、どちらに合わせるかオーナーに聞いてから決める。
