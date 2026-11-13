# Issue #3214 の残り（歩く2枚・振り返る・伸び）の生成記録

オーナー経由の zip（2026-11-11）の `GENERATION-3214-remaining-append.md` をそのまま置いた。`GENERATION.md` は複数の PR が末尾に書き足して衝突しやすいので、別のファイルにした。採用した候補と切り出しは `../README.md` の採用の記録を見る。


# Issue #3214 remaining optional cat poses, 2026-11-11

Generated with built-in image_gen, one PNG per call. This is an unprocessed candidate delivery; no alpha extraction, crop, upscale, downscale or game integration. No Issue closure. Current main references verified against Git LFS SHA-256.

## Reference paths and SHA-256

| Path | SHA-256 |
|---|---|
| `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png` | `9890e78c6b90f636861ddbabc5657191398dfbe3087bffb24d5704720b4f6f00` |
| `assets/sprites/characters/tetsuko/chr_tetsuko_smile.png` | `3df30e566cd75707c686621a87e5071fe11e1ef6cf5faab441d6fb8348959c10` |
| `assets/sprites/characters/tetsuko/chr_tetsuko_sleep.png` | `7cbba9787ff8228d44b188f55f9154f40e1dcba9beba010d8958ce395381876e` |

Normal: identity/style; smile: expression; sleep: round body/fur. Every call attached all three in that order. All walk B calls also attached cat_walk_a.png as reference 4.

## PNG dimensions and SHA-256

| File | Pixels | SHA-256 |
|---|---|---|
| `cat_lookback.png` | 1084x1451 | `d9c8e5ee20d0b7e99574b5b8bf78ac011dadd5d95d6dd0a9bf8ca96287afeff5` |
| `cat_lookback_candidate2.png` | 1086x1448 | `8707b57c67b03028f9fec3166f8f197e647f15c19ceb3a832b7aaa8b3e346a30` |
| `cat_stretch.png` | 1312x1199 | `33eae92ff08a2eb0d1833ad26b072b622c99d0ae456063a5aae21091e7a86081` |
| `cat_walk_a.png` | 1536x1024 | `8adc827dfcbb8bf6f6aeb567cd88292362a85d7e9e60f39821c96bcb2e4fea8d` |
| `cat_walk_b.png` | 1536x1024 | `2a70abe3950e517edcc30ec7b9d92d6f21e3699db5ed263f4a63080765cd7aca` |
| `cat_walk_b_candidate2.png` | 1536x1024 | `e217ac241ceb058afee8fda20ef05f0f75f15b426f56052835ce6e9dd594e1e7` |
| `cat_walk_b_candidate3.png` | 1536x1024 | `a287e5ec57b5dc5dea97c32b5b76d1d3d2b52c77b9a3d6aeeeef7728c53fe99c` |

## Quality and deviations

- Preferred review candidates: cat_walk_a.png; cat_walk_b_candidate3.png; cat_lookback_candidate2.png; cat_stretch.png. Do not treat canonical cat_walk_b.png as selected: its foreleg phase does not alternate clearly.
- walk B first and candidate2 repeat the A foreleg phase; retained as rejected originals for traceability. Candidate3 visibly alternates the forelegs.
- Walk A and B candidate3 are both 1536x1024 and have matching torso/head/tail framing. Approximate non-magenta bounds are A (139,145)-(1429,885), B3 (139,144)-(1429,880). Contact baseline differs by about 5px and the hind-leg phase is not fully alternating; not a pixel-exact seamless animation. Claude should judge alignment and animation after extraction. No adjustment was made.
- First lookback cat itself is approximately 980px tall, under the requested 1000px longest-side minimum. Candidate2 remedies this by a fresh generation, not upscaling. The explicit 1536x2048 canvas request in this retry was not honored; actual dimensions are recorded above.
- Walk face is three-quarter rather than strict profile. Lookback is a mild backward/up-left head turn, not a rear view.
- All candidates visibly preserve orange tabby, folded ears, broad face, white muzzle/chest/paws and thick striped tail. Fine fur strokes remain more numerous than the strict grouped-tuft style request; final same-artist judgment belongs to recipient.
- Backgrounds are near-magenta, not exact #FF00FF (top-left RGB roughly 241–245,15–19,240–242); acceptable only under user's latest relaxed background instruction. No floor, text, props, cast shadow or UI was observed.

## Exact generation prompts

### cat_walk_a

```text
ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。
添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを下の指定に変えます。
①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。

STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her.

POSE: Side view, walking toward the left, first step of a two-frame walk cycle (left front paw forward).
```

### cat_walk_b

```text
ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。
添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを下の指定に変えます。
①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。

STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her.

POSE: Exactly the same cat, size and ground line as TKT-CAT09, second step of the walk cycle (right front paw forward). Attach TKT-CAT09 as a fourth reference.
```

### cat_lookback

```text
ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。
添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを下の指定に変えます。
①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。

STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her.

POSE: Sitting and looking back over her shoulder toward the upper left, ears turned that way, as if a door just opened.
```

### cat_stretch

```text
ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。
添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを下の指定に変えます。
①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。

STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her.

POSE: A big front stretch: front legs reaching forward on the ground, chest low, hindquarters up, tail up, eyes half closed.
```

### cat_walk_b_candidate2

```text
ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。
添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを下の指定に変えます。
①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。

STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her.

POSE: Exactly the same cat, size and ground line as TKT-CAT09, second step of the walk cycle (right front paw forward). Attach TKT-CAT09 as a fourth reference.
Correction for this second walk-cycle frame: the fourth reference is frame A. Keep its face, torso, tail, body size, framing and foot baseline unchanged. Change ONLY the leg pose: the NEAR front leg that reaches left in A must now be planted back under the chest; the FAR front leg must reach forward toward the left. Clearly alternate which front leg is forward, not only the hind leg. No additional legs.

```

### cat_walk_b_candidate3

```text
ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。
添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを下の指定に変えます。
①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。

STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her.

POSE: Exactly the same cat, size and ground line as TKT-CAT09, second step of the walk cycle (right front paw forward). Attach TKT-CAT09 as a fourth reference.
Frame A is reference 4. For frame B, visibly swap the two forelegs' positions. The foreleg nearest the viewer (on the visible flank/chest, currently vertical with paw near x=610) must stretch diagonally down-left to put its paw at x=250. The far foreleg (currently extended toward x=250) must instead stand vertically under the chest at x=610, partly hidden behind the near leg. Do not repeat the foreleg silhouette of frame A. Keep the same head, torso, tail, camera, 1536x1024 canvas and contact baseline y=880. Only change the walking leg phase.

```

### cat_lookback_candidate2

```text
ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。
添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを下の指定に変えます。
①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。

STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her.

POSE: Sitting and looking back over her shoulder toward the upper left, ears turned that way, as if a door just opened.
Output a portrait 1536x2048 canvas. Fill the canvas with the cat, with the cat itself at least 1300 pixels tall. Small margins, full tail and paws visible. No resizing or upscaling an earlier image.

```
