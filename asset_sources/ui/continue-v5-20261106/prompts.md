# CONTINUE V5（#2524）Codex用 画像生成プロンプト

2026-11-06。オーナー「必要であれば画像生成プロンプト書いて。コーデックスに渡したい」「キャラも新バージョンを出したい」。
各ブロックをそのままCodexへ貼る。参照画像はリポジトリのファイルを**エージェントが自分で読み込んで渡す**（横並びのシートにしない。1回の生成で1人・1表情）。
受け取り後の組み込みは [README](README.md) の手順。

## A. 新版（`character_variants/new`）に足りない表情（CONTINUEで新版を使うため）

CONTINUEは「台本の全表情が新版にそろう人物だけ新版」で表示する（`remake/js/chapters/continue-view.js` の `continuePortraitStyle`）。
2026-11-06時点で新版がそろうのは スミさん・つむぎ・栞・サメちゃん・ひより。次の3人は不足分があるため現行のまま。

| 人物 | CONTINUEで使う表情 | 新版にあるもの | **足りないもの（生成）** |
|---|---|---|---|
| あげは `ageha` | surprise / serious / excited / smile | normal | **surprise, serious, excited, smile** |
| ましろ `mashiro` | sleep / normal / sad / smile | normal, yawn | **sad, smile, sleep** |
| 凛想 `rio` | serious / normal / smile | （新版なし） | **normal を先に作り、合格後に serious, smile** |

共通の約束（[立ち絵の規格](../../../docs/portrait_standard.md) 3節・6節）: 896×1200へ縮小だけで配置できるよう人物の高さ1300px以上、マゼンタや背景を描かず透過、床・影・文字なし。画風の英文（STYLE STANDARD）は一字一句そのまま。小柄（あげは・ましろ）は5.8頭身、凛想は標準（7頭身）。

参照画像の役割（表情差分）:
- (1) **新版の通常** `assets/sprites/character_variants/new/<id>/chr_<id>_normal.png` — 顔・髪・衣装・色・頭の大きさの正本（最優先）
- (2) **現行のその表情** `assets/sprites/characters/<id>/chr_<id>_<face>.png` — 表情と腕・肩の仕草だけを写す
- (3) みんと営業姿 `assets/sprites/characters/minto/chr_minto_normal.png`・(4) あげは `assets/sprites/characters/ageha/chr_ageha_normal.png` — 画風の目標だけ（あげは本人の生成では (4) を省く）

### A-1 あげは `ageha` × surprise

参照: (1) `assets/sprites/character_variants/new/ageha/chr_ageha_normal.png` (2) `assets/sprites/characters/ageha/chr_ageha_surprise.png` (3) `assets/sprites/characters/minto/chr_minto_normal.png`

```
Redraw the attached NEW-VERSION normal sprite of Ageha (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, hairstyle, hair and eye colors, outfit, accessories, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current SURPRISE sprite): eyes wide open, mouth open in a small "o", eyebrows up, one hand lifted near the chest. Keep the gyaru personality bright and cute, not frightened.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite: the TARGET rendering style ONLY. Never copy the face, hair, body or outfit of image 3.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Ageha is petite: about 5.8 heads tall, exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/ageha-new-expressions-20261106/surprise-untouched.png.
```

### A-2 あげは `ageha` × serious

参照: (1) 新版通常 (2) `assets/sprites/characters/ageha/chr_ageha_serious.png` (3) みんと

```
Redraw the attached NEW-VERSION normal sprite of Ageha (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, hairstyle, hair and eye colors, outfit, accessories, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current SERIOUS sprite): brows drawn together, mouth closed firmly, steady eyes; a competitive, focused look, not angry.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite: the TARGET rendering style ONLY. Never copy the face, hair, body or outfit of image 3.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Ageha is petite: about 5.8 heads tall, exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/ageha-new-expressions-20261106/serious-untouched.png.
```

### A-3 あげは `ageha` × excited

参照: (1) 新版通常 (2) `assets/sprites/characters/ageha/chr_ageha_excited.png` (3) みんと

```
Redraw the attached NEW-VERSION normal sprite of Ageha (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, hairstyle, hair and eye colors, outfit, accessories, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current EXCITED sprite): big open-mouthed grin, sparkling eyes, one fist pumped up beside her face; pure gyaru hype energy.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite: the TARGET rendering style ONLY. Never copy the face, hair, body or outfit of image 3.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Ageha is petite: about 5.8 heads tall, exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/ageha-new-expressions-20261106/excited-untouched.png.
```

### A-4 あげは `ageha` × smile

参照: (1) 新版通常 (2) `assets/sprites/characters/ageha/chr_ageha_smile.png` (3) みんと

```
Redraw the attached NEW-VERSION normal sprite of Ageha (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, hairstyle, hair and eye colors, outfit, accessories, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current SMILE sprite): warm closed-eye or half-closed smile, relaxed shoulders, a friendly peace sign or open hand if image 2 shows one.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite: the TARGET rendering style ONLY. Never copy the face, hair, body or outfit of image 3.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Ageha is petite: about 5.8 heads tall, exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/ageha-new-expressions-20261106/smile-untouched.png.
```

### A-5 ましろ `mashiro` × sad

参照: (1) `assets/sprites/character_variants/new/mashiro/chr_mashiro_normal.png` (2) `assets/sprites/characters/mashiro/chr_mashiro_sad.png` (3) みんと (4) あげは

```
Redraw the attached NEW-VERSION normal sprite of Mashiro (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, two long pale braids, hair and eye colors, beige knit cardigan over white blouse, sage-green long skirt, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current SAD sprite): eyes slightly downcast and soft, brows gently lowered, small closed mouth; a quiet, drowsy sadness, never crying or dramatic.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Mashiro is petite: about 5.8 heads tall, exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/mashiro-new-expressions-20261106/sad-untouched.png.
```

### A-6 ましろ `mashiro` × smile

参照: (1) 新版通常 (2) `assets/sprites/characters/mashiro/chr_mashiro_smile.png` (3) みんと (4) あげは

```
Redraw the attached NEW-VERSION normal sprite of Mashiro (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, two long pale braids, hair and eye colors, beige knit cardigan over white blouse, sage-green long skirt, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current SMILE sprite): a slow, sleepy, gentle smile with relaxed half-lidded eyes; calm shoulders; no teeth showing.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Mashiro is petite: about 5.8 heads tall, exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/mashiro-new-expressions-20261106/smile-untouched.png.
```

### A-7 ましろ `mashiro` × sleep

参照: (1) 新版通常 (2) `assets/sprites/characters/mashiro/chr_mashiro_sleep.png` (3) みんと (4) あげは

```
Redraw the attached NEW-VERSION normal sprite of Mashiro (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, two long pale braids, hair and eye colors, beige knit cardigan over white blouse, sage-green long skirt, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current SLEEP sprite): both eyes fully closed, head tilted a little, mouth slightly open as if dozing off standing up; peaceful. Do NOT draw "z" letters, sleep bubbles or any symbols: the game draws those in code.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture, ignore any drawn symbols. (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Mashiro is petite: about 5.8 heads tall, exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/mashiro-new-expressions-20261106/sleep-untouched.png.
```

### A-8 凛想 `rio` × normal（新版の通常を先に作る）

参照: (1) `assets/sprites/characters/rio/chr_rio_normal.png`（現行の通常＝本人の正本） (2) `assets/sprites/characters/minto/chr_minto_normal.png` (3) `assets/sprites/characters/ageha/chr_ageha_normal.png`。頭身の目標は本人（標準・6.53頭身）なので別人の参照は不要。

```
Redraw the attached CURRENT game sprite of Rio (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age (27, a calm adult a few years older than the protagonist), expression, pose, hand and shoulder positions, outfit and colors as image 1: long dark hair with a slight blue tint in a wolf cut, thick flowing bangs and cheek-framing layers reaching between the chest and the waist; sleepy narrow half-lidded eyes with a cool restrained smile; white shirt with rolled-up sleeves and black slacks; silver hoop earrings; colorless nails; no glasses; no test strips on the chest. Change ONLY the rendering style standard below, keeping her current head-to-body proportion.
Reference roles in order: (1) the current sprite: highest priority for identity, expression, pose, outfit, colors and proportions. (2) approved Minto normal sprite and (3) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 2 and 3.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Rio is standard: keep her current proportion of about 6.5 heads tall.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/rio-new-expressions-20261106/normal-untouched.png.
```

### A-9 凛想 `rio` × serious（A-8 合格後）

参照: (1) A-8 で合格した新版通常の原画 (2) `assets/sprites/characters/rio/chr_rio_serious.png` (3) みんと (4) あげは

```
Redraw the attached NEW-VERSION normal sprite of Rio (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, hairstyle, hair and eye colors, white shirt with rolled sleeves, black slacks, silver hoop earrings, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current SERIOUS sprite): eyes a little more open and level, brows straight, mouth closed; an evaluating, analytical look, composed rather than angry.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Rio is standard: exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/rio-new-expressions-20261106/serious-untouched.png.
```

### A-10 凛想 `rio` × smile（A-8 合格後）

参照: (1) A-8 で合格した新版通常の原画 (2) `assets/sprites/characters/rio/chr_rio_smile.png` (3) みんと (4) あげは

```
Redraw the attached NEW-VERSION normal sprite of Rio (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, hairstyle, hair and eye colors, white shirt with rolled sleeves, black slacks, silver hoop earrings, body size, head size and foot position as image 1. Change ONLY the facial expression and the arm/shoulder gesture to match image 2 (her current SMILE sprite): a lazy teasing smile with the corners of the eyes softened, head tilted very slightly; adult and unhurried, not a bright girlish grin.
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Rio is standard: exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark. Save as asset_sources/portraits/rio-new-expressions-20261106/smile-untouched.png.
```

## B. 新案「記憶の暗室」専用の背景（任意）

新案はいまは採用中の暗いステージ `assets/ui/continue/backdrop_stage.png` を暗く落として使っている。専用の背景を作るならこの1枚。見出し・数字・ボタン・人物・輪はコードが描くので焼き込まない。

参照: `asset_sources/ui/continue-v4-20261010/generated/backdrop-stage.png`（画風と暗さの基準）、`assets/backgrounds/bg_tonari_inside_night.png`（作品の画風）

```
Anime visual novel background, detailed digital painting, no people, painterly brushwork. Create ONE empty, almost black interior backdrop for the CONTINUE screen of the Japanese shisha visual novel 水煙前線 -EN:CODE-: the inside of the protagonist's head right after a defeat, like a quiet darkroom. Use the attached dark stage backdrop as the reference for darkness, restraint and the fine painterly texture; do not copy its floor pool of light. Composition: a single very soft, cool silver-lavender light source high at the upper left third, falling as a faint diagonal haze toward the lower center; the right 40% of the image stays deep charcoal-black with almost no detail so that text can sit on it; a barely visible thin layer of drifting shisha smoke low in the frame; a few tiny floating dust motes. No floor tiles, no walls with edges, no furniture, no shisha equipment, no neon, no windows, no characters, no silhouettes, no borders, logos, words, UI, digits, symbols or watermark. Keep the middle-left spacious and uncluttered for a large character portrait overlaid in code. Average brightness low but with readable gradation in the shadows (not a flat black image). Generate a wide 16:9 PNG at 2048x1152 or larger for downsampling to 1280x720. Opaque background. Intended source asset: asset_sources/ui/continue-v5-20261106/generated/backdrop-inner.png; runtime copy assets/ui/continue/backdrop_inner.png.
```
