# あげは新版 G1（normal）原画

- 原画: `normal-untouched.png`（Codex 画像生成機能の出力を無加工で保存）
- 対象: Issue #3331 の G1 のみ。G2以降はオーナーが G1 の顔を確認した後に進める。

## 参照画像（入力順と役割）

1. `assets/sprites/characters/ageha/chr_ageha_normal.png` — あげは本人の顔・衣装・色・ポーズ・頭身の正本。
2. `assets/sprites/character_variants/new/tsumugi/chr_tsumugi_normal.png` — 新版の線・セル塗り・色処理の画風のみ。
3. `assets/sprites/character_variants/new/samechan/chr_samechan_normal.png` — 新版の線・セル塗り・色処理の画風のみ。

## 英文プロンプト（Issue #3331 の G1 指定全文）

```text
Redraw the attached CURRENT sprite of Ageha (image 1) as ONE higher-resolution full-body character sprite in the NEW-VERSION rendering style of images 2 and 3, with a transparent background. Image 1 is the identity master: keep exactly her face design and cuteness, age (22), big round amber eyes, soft round cheeks, small nose, short gentle chin, friendly smile, honey-blonde wavy twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink crop top, black pleated skirt, garter thigh-high stockings, black choker and gold heart necklace, pink-and-black chunky sneakers, pose, hand positions and body proportions. She must look exactly as cute and youthful as image 1, or cuter: never more mature. Do NOT give her heavy makeup, narrow or cold eyes, a long chin, sharp cheekbones or strong cheek shading.
Reference roles in order: (1) the current Ageha sprite: highest priority for identity, face, outfit, colors, pose and proportions. (2) approved new-version Tsumugi sprite and (3) approved new-version Same-chan sprite: the TARGET rendering style ONLY (line weight, cel shading, color treatment). Never copy their faces, hair, bodies or outfits.
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.
HEAD-TO-BODY STANDARD: the head from the top of the hair (not counting hats, hoods or ornaments) to the chin must be about one seventh of the full height from the top of the hair to the shoe soles (about 7 heads tall). For the petite cast (Tsumugi, Mashiro, Ageha, Same-chan) it is about 5.8 heads tall instead. Ageha is petite: keep image 1's head size and proportions (about 5.8 heads tall).
Output: one PNG with true alpha transparency, portrait orientation, the figure at least 1300 px tall, whole hair and both shoes inside the canvas with a transparent margin. No background, floor, shadow on the ground, text, logo, frame or watermark.
```

採用原画は上記をそのまま使用し、四辺の透過余白を確保するため次の1文だけ末尾に追加して生成した。

```text
Keep at least 30 px of fully transparent margin above the highest hair pixel and below both shoe soles, and at least 30 px at left and right; keep the person over 1300 px tall within those margins.
```
