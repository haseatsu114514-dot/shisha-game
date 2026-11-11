# Issue #3278 占いの札の表 19枚

内蔵画像生成で各回1枚。原画 PNG は未加工。WebP は原寸のまま可逆変換。参照画像は `card-back.webp`（#3254 原画 PNG から参照用に変換）、`card-front-frame.webp`（同）、`bg_uranaishi.webp`（main の既存画像）を毎回添付。

| # | 原画 | 実寸 px | bytes | SHA-256 | CHECK |
|---:|---|---:|---:|---|
| 1 | `raw/09-hermit.png` | 1024×1536 | 3900537 | `bb3a65558ffe751f74cfe19e7199e7d780c0b116ad9a60cf42678e84f00625b9` | PASS |
| 2 | `raw/01-magician.png` | 1024×1536 | 3821834 | `fa41090aff2283e839a5b6cd67d104dc7b174a7ba12371054830878b69243c26` | PASS |
| 3 | `raw/06-lovers.png` | 1024×1536 | 3742539 | `57520f3e244630ca553f2e70272434fda87b323ef241a28ec8280a07e996582a` | PASS |
| 4 | `raw/03-empress.png` | 1024×1536 | 3842933 | `53521d2dcb4fdab638c6ef2cd40c1fab0ff31cfe8bf2bf439abdec2dc4eaf576` | 未達: 星が11個（同一プロンプトで3回生成、2回目を選定） |
| 5 | `raw/17-star.png` | 1024×1536 | 3547016 | `1d2fc467a5391d40fcbccb9aacde59482e335702168583937b6616899f01d0a0` | PASS |
| 6 | `raw/02-high-priestess.png` | 1024×1536 | 3968807 | `21862b27c68f8a695e3ce2b32d4cef29c105bca22e3feb2ddc11d09d6f1b7173` | PASS |
| 7 | `raw/08-strength.png` | 1024×1536 | 3689175 | `867c8c671d0792e8babd5f665fd50318ccfcf85595a467db22b22f362fe7a94f` | PASS |
| 8 | `raw/10-wheel.png` | 1024×1536 | 3870297 | `a620d5c352c7aa2ee7dbc86defb79fa717d2ecbcb4acee8cfa05e290b4b96941` | PASS |
| 9 | `raw/19-sun.png` | 1024×1536 | 3353516 | `a525181338f63e8c6657307e769b4ecf71518e905145f7e040e707e3fc81198f` | PASS |
| 10 | `raw/05-hierophant.png` | 1024×1536 | 3757301 | `6511cc18bf351ce563325ed891e415ec820e184b8ddb3c33b54d0e02bb960d02` | PASS |
| 11 | `raw/18-moon.png` | 1024×1536 | 3650323 | `4f15c05e4eab5a5358e587b00a8ecb1b307780969da3c190a2bd967aaca7cc8e` | PASS |
| 12 | `raw/00-fool.png` | 1024×1536 | 3649434 | `be90df16c79a9a908fa4664c9dbc3c02625032d5415e895f61cf9c3c08b630c3` | PASS |
| 13 | `raw/14-temperance.png` | 1024×1536 | 3856253 | `c12fb6a723f7240970751d7fde59f890383d0d4b47f0ee6a48f0be4a9bf04510` | PASS |
| 14 | `raw/04-emperor.png` | 1024×1536 | 3973219 | `289fab6c4a5b840c0d705cf3e05c0a9c2b160cec68268d4ff192ee22c0a58205` | PASS |
| 15 | `raw/12-hanged.png` | 1024×1536 | 3782432 | `ee1b87a6e6c56a6f68f163c3b42c100981b8dcf0f73e5b9c23dcca174315bec2` | PASS |
| 16 | `raw/20-judgement.png` | 1024×1536 | 3635119 | `9c8b4e1884e85b7b913fe1d7bede208743c2e1649bd105fb9af178af18c9729d` | PASS |
| 17 | `raw/21-world.png` | 1024×1536 | 3333762 | `efd23bad035e1fba55c33c7ef2999052d7d4b61f945ae1e6cc53ab913c3ef544` | PASS |
| 18 | `raw/11-justice.png` | 1024×1536 | 3934089 | `8e587a32c2761e3d8b58868787a0d9b024faf777a608d369f42ba1cc3de74fd6` | PASS |
| 19 | `raw/07-chariot.png` | 1024×1536 | 3793456 | `88d3df63fa6948d95436503665fd037c09f6b26c5c25fd386eba3c6b5a8b21a6` | PASS |

## CHECK 補足

- 19枚とも人物・人の顔・手・人影、文字・数字、シーシャ機材は目視で見当たらない。主役は左右7%の切り取りでも欠けない構図。札裏と同系統の限定色・版画調。
- `06-lovers`: 赤いりんごが画面左、緑が右。
- `03-empress`: 3回とも星12個の条件を満たさず。1回目11個、2回目11個、3回目9個。2回目を最良候補として採用。
- `10-wheel`: 1回目はサメ2匹。2回目は下側に別のサメの尾に見える形が残る。3回目は1匹のサメが車輪に沿って一続きに見えるため採用。

## 実際に使用したプロンプト

### 1/19 `09-hermit`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: IX The Hermit. A lone lantern with a small six-pointed star of warm light inside it hangs from a plain wooden staff planted on a snowy mountain peak at night. A narrow footpath winds up toward it from below, and far down in the valley the warm windows of one small shop glow. Quiet, patient, guiding.
```

CHECK: no person / lantern and staff in the centre / no text.

### 2/19 `01-magician`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: I The Magician. A wooden worktable seen from the front with four tools laid out openly and neatly in a row: a chef's knife, a wooden spoon, a copper pot lid and a small stone mortar with its pestle. Above the table floats a golden lemniscate (an infinity sign). Red roses and white lilies grow along the bottom edge. Everything on the table is in plain view, nothing hidden.
```

CHECK: no person, no hands / exactly four tools on the table / infinity sign above / no hookah equipment / no text.

### 3/19 `06-lovers`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: VI The Lovers, as the Garden of Eden. A single apple tree stands in the centre bearing exactly TWO apples: the apple on the LEFT side of the picture is red and the apple on the RIGHT side is green. A slender serpent coils gently around the trunk. A radiant sun shines above; a small tree of life and a flowering tree stand far behind on either side.
```

CHECK: no person / exactly two apples, red on the left and green on the right / the serpent is calm, not menacing / no text.

### 4/19 `03-empress`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: III The Empress. A cushioned throne seat stands empty in a soft garden of mint leaves (muted sage, not bright green) and ripe wheat. A heart-shaped shield bearing the Venus symbol leans against the seat, twelve small stars float above it in the shape of a crown, a teacup with a sprig of mint rests on the armrest, and a quiet stream runs behind. Warm, welcoming, abundant.
```

CHECK: no person / the throne is empty / twelve stars / no text.

### 5/19 `17-star`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: XVII The Star. A large eight-pointed golden star shines in a deep night sky with seven smaller white eight-pointed stars around it. Below, a still pool receives a stream of water poured from a single clay jug that rests on the bank; a second stream runs onto the grass. A small bird sits in a slender tree, and branches of wisteria hang at one edge. Calm, hopeful.
```

CHECK: no person / one large star and seven small ones / the jug pours by itself, no hands / no text.

### 6/19 `02-high-priestess`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: II The High Priestess. Two pillars stand side by side, one deep aubergine and one ivory, with a heavy curtain hung between them embroidered with pomegranates. Behind the curtain a crescent moon rises. In front of the curtain, on a stone ledge, lie a closed old book with a ribbon marker and a row of three tiny glass sample vials sealed with wax. Mysterious, knowing.
```

CHECK: no person / two pillars, one dark and one light / three sealed vials / no text.

### 7/19 `08-strength`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: VIII Strength. A calm lion lies down with its head lowered peacefully; a loose garland of small flowers is looped around its neck. A golden lemniscate (infinity sign) floats above it, distant mountains rest behind, and the sky is a soft dawn. Gentle strength, not aggression.
```

CHECK: no person / the lion is calm / infinity sign / no text.

### 8/19 `10-wheel`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: X The Wheel of Fortune, by the sea. A great wheel stands half in the sea, its rim carved with waves and its spokes like a ship's wheel. A sleek shark, drawn naturally in profile (not a cartoon), circles the rim like a guardian, and a small crown rests on top of the wheel. In the four corners sit a seagull, an octopus, a sea turtle and a jellyfish, on small clouds. Turning luck, playful but grand.
```

CHECK: no person / one shark, not cartoonish / four sea creatures in the corners / no text.

### 9/19 `19-sun`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: XIX The Sun. A large radiant sun with alternating straight and wavy rays (no face on the sun) fills the upper half. Below it, a row of tall sunflowers stands before a low garden wall, and in the centre a bright swallowtail butterfly in gold and pink flutters with small glittering sparkles around it. Joyful, bright.
```

CHECK: no person / the sun has no face / one swallowtail butterfly in the centre / no text.

### 10/19 `05-hierophant`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: V The Hierophant. Between two tall stone pillars, two crossed keys (one gold, one silver) lie at the bottom. On a low black lacquered stand between the pillars rests a single shallow red sake cup (sakazuki) on a folded sheet of white paper. A triple-tiered crown hangs above, and a thick straw rope with white zigzag paper streamers (shide) is strung across the top. Solemn, a vow of bonds.
```

CHECK: no person / one red sake cup / crossed keys / no text.

### 11/19 `18-moon`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: XVIII The Moon. A large full moon WITHOUT a face, dripping small drops of light, hangs between two dark towers. A winding path runs from a still pool, where a crayfish climbs out, between a black wolf and a pale dog that howl at the moon. Black roses and deep wine-red roses grow along the path. Night, mystery, a little shy.
```

CHECK: no person / the moon has no face / two towers, wolf and dog / no text.

### 12/19 `00-fool`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: 0 The Fool. A small traveller's bundle tied to a walking stick lies at the edge of a cliff under a rising sun, with a single white rose beside it and small paw prints of a dog leading toward the edge. Far below spreads a sea of clouds, and one cloud is softly shaped like a layered cake, as if a sweet that is not there were floating in the air. Free, curious, setting out.
```

CHECK: no person / bundle on a stick at the cliff edge / one cake-shaped cloud / no text.

### 13/19 `14-temperance`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: XIV Temperance. Two cups, one gold and one silver, float in the air, and a single stream of clear water arcs perfectly from one into the other. Thin slices of lemon and lime float on the pool below. Irises grow along the bank, a path leads to a mountain with a soft crown of light, and a small hourglass rests on a rock. Patient, balanced.
```

CHECK: no person, no hands / the stream connects the two cups / lemon and lime slices / hourglass / no text.

### 14/19 `04-emperor`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: IV The Emperor. A heavy iron throne carved with ram heads on its armrests stands on bare rocky mountains under a deep red-orange sky. Resting on the empty seat are an old brass thermometer, a pair of steel calipers and an iron orb. Rigid, symmetrical, measured.
```

CHECK: no person / the throne is empty / thermometer and calipers on the seat / no text.

### 15/19 `12-hanged`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: XII The Hanged Man, without a person. A living T-shaped tree stands at twilight beside a perfectly still pond; from its single bough hangs one small lantern glowing softly. In the pond the whole scene is reflected UPSIDE DOWN, so the tree and lantern also appear inverted below. A thin crescent moon hangs above like a halo. Calm, drowsy, seeing things from another angle.
```

CHECK: no person / T-shaped tree with one hanging lantern / the upside-down reflection is clear / no text.

### 16/19 `20-judgement`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: XX Judgement, as a festival. A golden trumpet sounds from bright clouds with a festive banner hanging from it. Below, confetti and paper streamers rise from the ground like an awakening, a pair of festival drums stands in the foreground, and distant mountains glow. Joyful, loud, "wake up and have fun".
```

CHECK: no person, no angel figure / trumpet with banner / confetti and drums / no text.

### 17/19 `21-world`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: XXI The World, in the desert. A large laurel wreath tied with ribbons encircles a night sky over sand dunes, with a crescent moon and stars inside the wreath. A white falcon perches at the top of the wreath. In the four corners appear a lion, an eagle, a bull and a dove, on small clouds. Complete, accomplished, regal.
```

CHECK: no person, no dancer / the wreath frames the desert sky / falcon on top / four creatures in the corners / no text.

### 18/19 `11-justice`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: XI Justice. A straight sword stands point-down between two pillars, and from its crossguard hang a pair of perfectly balanced brass scales. Around the hilt coils a slender Chinese dragon made of soft smoke-like curls (not fire), its body balanced and calm. A deep red curtain hangs behind. Measured, observant.
```

CHECK: no person / scales level / smoke-curl dragon around the hilt / no text.

### 19/19 `07-chariot`

```text
Style: a limited-palette screen-print tarot illustration that matches the attached card back (card-back.webp) and the tarot cards drawn in the attached bg_uranaishi.webp: deep aubergine purple, distressed metallic gold linework, warm ivory and pale lavender, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges and a few clear value steps. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no watermark.

Create the PICTURE that sits inside the window of a tarot card FRONT: one full-bleed portrait illustration, 2:3 (1024x1536), opaque, filling the whole canvas edge to edge, with NO border, NO frame, NO card edge and NO rounded corners (the game places it inside the gold frame of the attached card-front-frame.png and crops about 7% from the left and right edges, so keep every important shape inside the central 80% of the width and the central 90% of the height). It is emblematic major-arcana artwork, but with NO human figure, NO face, NO hands and NO silhouette of a person: tell the card only through objects, animals, plants, sky and landscape. Keep the ground light (warm ivory and pale lavender, like the window of the attached frame) with the motifs in deep aubergine and distressed gold, so the picture sits naturally inside the gold frame. No hookah, no bowl, no hose, no charcoal, no tobacco leaves.

Arcana: VII The Chariot, in the desert. A sturdy classic boxy four-wheel-drive car (plain, no logos, no visible driver) crests a tall sand dune, seen from the front-left, with a long spray of sand behind it. A canopy of small stars spreads above like the chariot's canopy, and two dunes in the foreground are shaped like crouching sphinxes, one dark and one light. Forward, energetic.
```

CHECK: no person, no driver visible / one car cresting the dune / no logos / no text.
