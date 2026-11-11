# Issue #3254 モーション小物・背景 原画台帳

内蔵画像生成で各画像を1枚ずつ作り、CHECKに外れた画像は同じプロンプトで計3回生成しました。下記は各画像の最良候補の無加工PNGです。すべてCHECK未合格のため、`assets/ui/transitions/` と `remake/img/ui/transitions/` への採用は保留しています。

| # | ファイル名 | ピクセル数 | bytes | SHA-256 | 使った参照 | CHECK の結果 |
|---:|---|---:|---:|---|---|---|
| 1 | `raw/card-back.png` | 1024×1536 | 3488655 | `e6c704adb80733be4e9c347e15a8b92b33da08db76e6efb2dc8a39eef04d5e14` | bg_uranaishi.webp | 不合格（3回）：中央の枝が180度回転対称でない。 |
| 2 | `raw/card-front-frame.png` | 1024×1536 | 2103189 | `de411da8e87f9186321d0b35271bead9f51f783be037292a0390c37f22b3c87e` | bg_uranaishi.webp、card-back.png | 不合格（3回）：窓に濃淡が残り単色ではない。 |
| 3 | `raw/sign-open.png` | 1536×1024 | 1706513 | `38ea3a197b0934058ebb4553c034f0471218b4e4161aceb1965fa56e686073f0` | bg_tonari_inside_night.webp | 不合格（3回）：パネルに濃淡が残り、板も指定寸法より大きい。 |
| 4 | `raw/sign-closed.png` | 1536×1024 | 1686395 | `1125ee27746ebeb3a7c07e0c88ab4e71444537872156fe5d61b4d889a26f55d3` | sign-open.png | 不合格（3回）：sign-openとの外形アルファ一致率は最良99.52%で、ピクセル完全一致ではない。 |
| 5 | `raw/tablet.png` | 1536×1024 | 1422856 | `532a7a5e1308d9543e49b77ca38c26ed59489bd87379ecff15741e5145df89b0` | bg_tonari_inside_night.webp | 不合格（3回）：画面に弱い濃淡が残り単色ではない。 |
| 6 | `raw/stylus.png` | 1254×1254 | 335841 | `7bb47c29ac5982219bbca7ae66b21dc1243139f8501c56ade1a9462e88011af2` | bg_tonari_inside_night.webp | 不合格（3回）：1254×1254で指定1024×1024を超過。輪郭に白いざらつきがある。 |
| 7 | `raw/marker-pink.png` | 1254×1254 | 544763 | `2617c1a0d7fd96c2ab4cb5d3226ae8a7d8f8d2721d77221f2a2eae96c1643fcf` | bg_tonari_inside_night.webp | 不合格（3回）：1254×1254で指定1024×1024を超過。 |
| 8 | `raw/marker-green.png` | 1254×1254 | 543577 | `4131c3e7b126cb6349c9600c52976c9270636fba08374dbb8d2bcee1e0f9b80b` | marker-pink.png | 不合格（3回）：1254×1254で指定1024×1024を超過。marker-pinkとの外形アルファ一致率は最良98.92%。 |
| 9 | `raw/cabin.png` | 1672×941 | 1808390 | `909b55a5115505a8450a8d5bd1827314e70ae26354ef1abaf071e997a914c239` | bg_ch3_train_arrival.webp | 不合格（3回）：1672×941で最低2048×1152未満。窓が単色でなく、トレーが開いている。 |
| 10 | `raw/cloudsea-night.png` | 1672×941 | 1690014 | `9ddfe1532efd1a47a0ad567fca4d544ddccf2fda2dac83f0db3047af9e2bc164` | bg_ch3_train_arrival.webp | 不合格（3回）：1672×941で最低2048×1152未満。 |
| 11 | `raw/cloudsea-dawn.png` | 1672×941 | 1808763 | `0258fbb4efd7bb656ecdb54a406a54fc0a390db06e84b5f6cb28a0ab73d4b94e` | bg_ch3_train_arrival.webp、cloudsea-night.png | 不合格（3回）：1672×941で最低2048×1152未満。 |

## 実際に使った英文プロンプト

STYLE段落と各画像段落をこの順にそのまま連結して使用しました。CHECK行は生成プロンプトに含めていません。

### 1. card-back.png

```text
Style: a limited-palette screen-print look that matches the tarot cards drawn in the attached illustration (bg_uranaishi.webp): deep aubergine purple, distressed metallic gold linework, warm ivory, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no faces, no people, no watermark.

Create ONE tarot card BACK as flat front-facing artwork on a fully transparent background, portrait 1024x1536, exactly centred, upright, with no tilt, no perspective and no shadow. The card is a rounded rectangle about 864 px wide and 1440 px tall (3:5) with a corner radius of about 40 px; everything outside the card is transparent. Design: a deep aubergine ground with fine halftone grain; a distressed gold double border; delicate gold botanical filigree in the four corners; in the exact centre a large gold full-moon disc crossed by one dark botanical sprig silhouette (small leaves on a thin stem), like the cards in the reference. The design is point-symmetric, so it reads the same upside down.
```

### 2. card-front-frame.png

```text
Style: a limited-palette screen-print look that matches the tarot cards drawn in the attached illustration (bg_uranaishi.webp): deep aubergine purple, distressed metallic gold linework, warm ivory, visible halftone grain and slightly worn ink. Flat graphic shapes with crisp edges. Not a 3D render, not a photograph, no glossy gradients. No text, no letters, no numerals, no roman numerals, no faces, no people, no watermark.

Create the matching tarot card FRONT FRAME on a fully transparent background, portrait 1024x1536, with exactly the same card size, position, corner radius, gold border and grain as the attached card-back.png. Inside the border, replace the artwork with ONE empty picture window: a rounded rectangle about 664 px wide and 1180 px tall, centred, filled with a single flat warm ivory (#f3ead8) and nothing else, outlined by one thin gold line (the game places a different picture in this window). Between the window and the outer border keep only a narrow aubergine band with a small gold filigree ornament at each of the four corners.
```

### 3. sign-open.png

```text
Style: a hand-painted prop for a Japanese anime visual novel, in the same hand as the attached approved game background (bg_tonari_inside_night.webp): detailed digital painting with soft painterly brushwork, realistic proportions and material textures (wood grain, brushed brass, matte plastic), forms built from painted planes rather than outlines, one warm key light from the upper left with a soft cool fill. Clean silhouette that can be cut out. Not a flat vector icon, not a glossy 3D render, not a photograph. Background: fully transparent (real alpha). No cast shadow, no floor, no glow, no hands, no people, no text, no letters, no numbers, no logo, no watermark, no hookah equipment.

Create ONE small hanging DOOR SIGN of a cosy Japanese shisha lounge, seen straight from the front, landscape 1536x1024. A thin brass chain rises from the two upper corners of the plaque to a single small brass ring at the top centre of the image (an upside-down V), so the sign hangs from one hook. The plaque is a horizontal rounded rectangle of dark walnut wood, about 900 px wide and 520 px tall, centred left to right, with a slim brass rim and four tiny brass corner pins. Set into it is a panel of warm cream enamel (#f4ecda), about 760 px by 380 px, perfectly empty and evenly lit (the game writes on it). The whole sign is left-right symmetric.
```

### 4. sign-closed.png

```text
Style: a hand-painted prop for a Japanese anime visual novel, in the same hand as the attached approved game background (bg_tonari_inside_night.webp): detailed digital painting with soft painterly brushwork, realistic proportions and material textures (wood grain, brushed brass, matte plastic), forms built from painted planes rather than outlines, one warm key light from the upper left with a soft cool fill. Clean silhouette that can be cut out. Not a flat vector icon, not a glossy 3D render, not a photograph. Background: fully transparent (real alpha). No cast shadow, no floor, no glow, no hands, no people, no text, no letters, no numbers, no logo, no watermark, no hookah equipment.

Edit the attached sign-open.png. Keep the plaque, rim, pins, chain, ring, size and position exactly the same, pixel-aligned. Change only the inset panel: deep wine-red enamel (#7a2a2e) instead of cream, still perfectly empty and evenly lit (the game writes on it). Darken the brass rim slightly, so the two images read as the front and the back of the same sign.
```

### 5. tablet.png

```text
Style: a hand-painted prop for a Japanese anime visual novel, in the same hand as the attached approved game background (bg_tonari_inside_night.webp): detailed digital painting with soft painterly brushwork, realistic proportions and material textures (wood grain, brushed brass, matte plastic), forms built from painted planes rather than outlines, one warm key light from the upper left with a soft cool fill. Clean silhouette that can be cut out. Not a flat vector icon, not a glossy 3D render, not a photograph. Background: fully transparent (real alpha). No cast shadow, no floor, no glow, no hands, no people, no text, no letters, no numbers, no logo, no watermark, no hookah equipment.

Create ONE drawing TABLET (a slate tablet computer of the kind an art student draws on), lying flat and seen exactly from above, in landscape orientation, landscape 1536x1024, centred. The tablet is about 1400 px wide and 900 px tall with softly rounded corners, a thin matte black bezel about 34 px wide on all four sides, and a slim silver edge. The whole screen is ONE blank drawing canvas: a flat, very slightly warm off-white (#f7f4ee) with nothing on it: no app interface, no toolbar, no icons, no drawing, no reflection streak (the game draws line art on it). One tiny front-camera dot in the middle of the left bezel is allowed. No stylus on it.
```

### 6. stylus.png

```text
Style: a hand-painted prop for a Japanese anime visual novel, in the same hand as the attached approved game background (bg_tonari_inside_night.webp): detailed digital painting with soft painterly brushwork, realistic proportions and material textures (wood grain, brushed brass, matte plastic), forms built from painted planes rather than outlines, one warm key light from the upper left with a soft cool fill. Clean silhouette that can be cut out. Not a flat vector icon, not a glossy 3D render, not a photograph. Background: fully transparent (real alpha). No cast shadow, no floor, no glow, no hands, no people, no text, no letters, no numbers, no logo, no watermark, no hookah equipment.

Create ONE digital STYLUS PEN for a drawing tablet, square 1024x1024. It lies on a diagonal from the upper right to the lower left at about 45 degrees, with the fine writing tip at the lower left; the whole pen is inside the image with a margin of at least 60 px. A slim matte white barrel with one flat side, a narrow soft-grey tip cone, and one thin lavender ring near the top end. No cap, no cable.
```

### 7. marker-pink.png

```text
Style: a hand-painted prop for a Japanese anime visual novel, in the same hand as the attached approved game background (bg_tonari_inside_night.webp): detailed digital painting with soft painterly brushwork, realistic proportions and material textures (wood grain, brushed brass, matte plastic), forms built from painted planes rather than outlines, one warm key light from the upper left with a soft cool fill. Clean silhouette that can be cut out. Not a flat vector icon, not a glossy 3D render, not a photograph. Background: fully transparent (real alpha). No cast shadow, no floor, no glow, no hands, no people, no text, no letters, no numbers, no logo, no watermark, no hookah equipment.

Create ONE uncapped PAINT MARKER (a chunky water-based poster marker used for doodling on instant photos), square 1024x1024. It lies on a diagonal from the upper right to the lower left at about 45 degrees, with the round bullet tip at the lower left; the whole marker is inside the image with a margin of at least 60 px. A cylindrical body in bright pink (#fc5dac), a blank white label band around the middle with no printing, a short white collar, and a rounded felt tip soaked in the same pink. No cap.
```

### 8. marker-green.png

```text
Style: a hand-painted prop for a Japanese anime visual novel, in the same hand as the attached approved game background (bg_tonari_inside_night.webp): detailed digital painting with soft painterly brushwork, realistic proportions and material textures (wood grain, brushed brass, matte plastic), forms built from painted planes rather than outlines, one warm key light from the upper left with a soft cool fill. Clean silhouette that can be cut out. Not a flat vector icon, not a glossy 3D render, not a photograph. Background: fully transparent (real alpha). No cast shadow, no floor, no glow, no hands, no people, no text, no letters, no numbers, no logo, no watermark, no hookah equipment.

Edit the attached marker-pink.png. Keep the shape, size, angle and position exactly the same, pixel-aligned. Change only the colour of the body and the felt tip from pink to fresh green (#3ac26f). The label band stays white and blank.
```

### 9. cabin.png

```text
STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.

Scene: the window seat of an economy-class cabin on a long-haul night flight, from the eye level of the passenger sitting in it, looking slightly to the right toward the window. Right of centre: ONE aircraft window, a tall rounded rectangle with its shade fully open, about 20% of the image width and 45% of the image height, seen almost front-on, set in the pale curved cabin wall panel. Through the window show ONLY one flat, even, pale grey-blue colour with nothing in it: no clouds, no wing, no stars, no reflections (the game replaces this area with a moving sky). On the left: the back of the seat in front, in dark blue fabric, with its tray table folded up. The cabin lights are dimmed for the night; a single warm reading light from above gives soft highlights on the wall panel and the seat. Keep the upper-left third calm and uncluttered. No screens showing content, no safety card, no airline logo.
```

### 10. cloudsea-night.png

```text
STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.

Scene: the view straight out of an airliner window at cruising altitude at night: a wide sea of clouds below and a deep indigo sky above with small sparse stars, the cloud tops softly lit by moonlight from the upper left. The horizon is level, at about 40% from the top of the image. The cloud layer continues evenly across the whole width with no single focal object, so the picture can slide sideways. No aircraft wing, no window frame, no land, no city lights, no moon disc.
```

### 11. cloudsea-dawn.png

```text
STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.

Scene: the same view and composition as the attached cloudsea-night.png (the same horizon height and the same kind of cloud layer), at first light: a narrow band of orange and rose along the horizon fading upward into pale blue-violet, the cloud tops catching warm pink light on one side and keeping cool violet shadows. No sun disc, no aircraft wing, no window frame, no land.
```
