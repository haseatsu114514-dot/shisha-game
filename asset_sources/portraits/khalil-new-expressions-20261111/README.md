# ハリール：新版の不足表情（2026-11-11）

Issue #3281 の原画台帳。内蔵画像生成を使用し、各表情を1回ずつ生成した。原画は無加工で保存した。ゲーム用への組み込みはオーナーの採用判断後。

## A13 smile

- 原画：`smile-untouched.png`
- 画像：1054×1492px、RGBA 真透過、人物の不透明領域の高さ 1399px。
- 原寸目視：新版通常と比較し、頭・足元・衣装・色・表情・手を確認。必須5項目（塗り、顔、擬似文字、小物接続、画風）を確認。
- 参照画像（渡した順・役割）：
  1. `assets/sprites/character_variants/new/khalil/chr_khalil_normal.png` — 本人：新版の通常
  2. `assets/sprites/characters/sui/chr_sui_normal.png` — 大人の男性の頭身のみ
  3. `assets/sprites/characters/minto/chr_minto_normal.png` — 画風のみ
  4. `assets/sprites/characters/ageha/chr_ageha_normal.png` — 画風のみ

使用した英文プロンプト全文：

```text
Expression variant of the SAME character. Reference roles IN ORDER: image 1 is the APPROVED new-version Khalil normal sprite: keep this exact person's face design, age, hair, skin tone, outfit, accessories, colors, head size and head-to-body ratio, linework, figure height and standing position, so that image 1 and this sprite can switch in the game without the head changing size or the feet moving. Image 2 Sui is head-to-body proportion context only, never identity. Images 3 Minto and 4 Ageha are rendering-style context only; never copy their faces, hair, bodies or clothes. Change only the facial expression and the small matching pose change described below. Do not add props that are not in image 1.

Japanese 2D visual-novel game art in the same artist's hand as the approved Minto, Ageha and Rio sprites: confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two or three clearly shaped cel-shadow steps; a few deliberate hair highlight bands and small eye catchlights. Keep image 1's line weight, shading and color treatment. No skin gloss, airbrush gradients, rim light, glow, photographic texture, fabric micro-detail, dense ornamental noise or generic pretty-face drift.

Output ONE complete figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the top of the hair or headcloth to the soles. Entire hair or headcloth, both hands (five fingers each) and both shoes visible with a transparent margin on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid, watermark or extra objects.
Expression: a rare, restrained smile: only the corners of the mouth relax under the beard, the eyes soften slightly; still reserved and quiet, not a grin, no teeth. Pose, remote control and headcloth exactly as image 1.
```
