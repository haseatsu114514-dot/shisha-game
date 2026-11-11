# あげは：新版の不足表情（2026-11-11）

Issue #3281 の原画台帳。内蔵画像生成を使用し、各表情を1回ずつ生成した。原画は無加工で保存した。ゲーム用への組み込みはオーナーの採用判断後。

## A1 sad

- 原画：`sad-untouched.png`
- 画像：1084×1451px、RGBA 真透過、人物の不透明領域の高さ 1410px。
- 原寸目視：新版通常と比較し、頭・足元・衣装・色・表情・手を確認。必須5項目（塗り、顔、擬似文字、小物接続、画風）を確認。
- 参照画像（渡した順・役割）：
  1. `assets/sprites/character_variants/new/ageha/chr_ageha_normal.png` — 本人：新版の通常
  2. `assets/sprites/characters/ageha/chr_ageha_sad.png` — 写す表情：現行の絵
  3. `assets/sprites/characters/minto/chr_minto_normal.png` — 画風のみ

使用した英文プロンプト全文：

```text
Redraw the attached NEW-VERSION normal sprite of Ageha (image 1) as ONE higher-resolution full-body expression variant with a transparent background. This is NOT a redesign: keep exactly the same person, face design, age, hairstyle, hair and eye colors, outfit, accessories, body size, head size and foot position as image 1, and keep image 1's line weight, shading and color treatment so the two sprites can switch in the game without looking different. Change ONLY the facial expression and the arm/shoulder gesture described at the end, copying them from image 2 (her current sprite of this expression).
Reference roles in order: (1) approved new-version normal sprite of this exact character: highest priority for identity, outfit, colors, proportions and foot position. (2) her current sprite of this exact expression: copy ONLY the expression and the gesture. (3) approved Minto normal sprite: the TARGET rendering style ONLY. Never copy the face, hair, body or outfit of image 3.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Ageha is petite: about 5.8 heads tall, exactly as image 1.
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, the same framing and feet position as image 1 so the two images overlay. No background, floor, shadow on the ground, text, logo, frame or watermark.
Expression: SAD: eyes looking down and a little to the side, eyebrows raised in the middle, a small closed pout; shoulders slightly drawn in; copy the arm and hand gesture of image 2. Still bright-hearted and cute, not crying, no tears.
```
