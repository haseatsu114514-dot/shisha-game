# パッキー：新版の不足表情（2026-11-11）

Issue #3281 の原画台帳。内蔵画像生成を使用し、各表情を1回ずつ生成した。原画は無加工で保存した。ゲーム用への組み込みはオーナーの採用判断後。

## A8 excited

- 原画：`excited-untouched.png`
- 画像：1084×1451px、RGBA 真透過、人物の不透明領域の高さ 1282px。
- 原寸目視：新版通常と比較し、頭・足元・衣装・色・表情・手を確認。必須5項目（塗り、顔、擬似文字、小物接続、画風）を確認。
- 参照画像（渡した順・役割）：
  1. `assets/sprites/character_variants/new/pakki/chr_pakki_normal.png` — 本人：新版の通常
  2. `assets/sprites/characters/pakki/chr_pakki_excited.png` — 写す表情：現行の絵
  3. `assets/sprites/characters/minto/chr_minto_normal.png` — 画風のみ

使用した英文プロンプト全文：

```text
Redraw the attached NEW-VERSION normal sprite of Pakki (image 1), the tournament MC mascot, as ONE full-body EXCITED expression variant with a transparent background. Pakki is a small round white fluffy smoke-cloud creature with a curled pointed smoke swirl on top, black oval eyes with tiny white gleams, pink round cheeks, little mitten hands and two short rounded feet, a vivid red bowtie, holding a gold-and-black shisha mouthpiece like a microphone with its navy hose. This is NOT a redesign: keep exactly image 1's silhouette, size, cloud scallops, colors, bowtie, mouthpiece, hose, line weight, shading and foot position, so the two sprites can switch in the game without the body changing size.
Change ONLY the face and the arm pose to match image 2 (his current EXCITED sprite): big open happy mouth, sparkling eyes, the free mitten hand thrown up high, the mouthpiece hand raised toward the mouth as if shouting into a microphone. The hose stays ONE continuous hose from the mouthpiece as in image 1: no fork, no second end, no break.
Reference roles in order: (1) approved new-version normal sprite: highest priority for design, colors, size and foot position. (2) current excited sprite: copy ONLY the expression and the pose. (3) approved Minto normal sprite: rendering-style hint ONLY, never her face or body.
No ears, nose, teeth, human body, costume, new hat, extra limbs, rainbow smoke, sparkles, text, logo, frame or watermark. Output: one PNG with true alpha transparency, the same canvas framing and feet position as image 1, at least 1300 px tall canvas. No background, floor or ground shadow.
```
