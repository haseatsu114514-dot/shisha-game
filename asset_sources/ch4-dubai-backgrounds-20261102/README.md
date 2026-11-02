# 第4章ドバイ背景① 原画（Issue #2219）

Codex 内蔵 imagegen で生成。以下は実際に渡した全文。原画は無加工で、ゲーム用 PNG は Pillow Lanczos で 1280×720 RGB に縮小。

## 参照画像

- `assets/backgrounds/bg_eden_shop.png`: 画風のみ（構図は参照しない）
- `remake/img/backgrounds/bg_dubai_map.webp`: 配色・空気感のみ（構図は参照しない）
- 宿の夜のみ `bg_dubai_inn_day_original.png`: 採用済み昼画像を編集対象として添付。

## 生成物とプロンプト

### 1/5 bg_dubai_airport_day.png

- 原画: `bg_dubai_airport_day_original.png`
- サイズ: 2728804 B
- SHA-256: `c14a5219987198a058cb5e87253bb47479c969b3aacbe97cd6aa89a4a4490956`

```text
Use case: illustration-story. Asset type: 16:9 visual novel background. The attached bg_eden_shop.png is STYLE REFERENCE ONLY for fine pixel-painter texture; the attached bg_dubai_map.webp is PALETTE AND ATMOSPHERE REFERENCE ONLY. Do not copy either composition. Anime visual novel background, detailed digital painting, bright lighting, no people, 1280x720, painterly brushwork. The arrivals exit of a modern fictional airport in Dubai at midday, seen from just inside the terminal looking out through tall glass sliding doors that stand open. A polished pale stone floor, a few empty luggage trolleys parked to one side, a large blank flight information board on the wall (no readable text), cool air-conditioned blue-white light inside. Beyond the doors, a blinding white-gold heat haze over the curb lane, date palms and distant sand-colored towers. The contrast between the cool interior and the heat outside is the point of the image. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no hookahs or shisha pipes, no text, no Arabic calligraphy, no signs with writing, no logos, no numbers, no watermark. Do not copy any real airport or landmark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 2/5 bg_dubai_souq_day.png

- 原画: `bg_dubai_souq_day_original.png`
- サイズ: 3349369 B
- SHA-256: `c26ac324516d3ad962b510784931273450a3fde95752c935371e783104116669`

```text
Use case: illustration-story. Asset type: 16:9 visual novel background. Attached bg_eden_shop.png is STYLE REFERENCE ONLY for fine pixel-painter texture; attached bg_dubai_map.webp is PALETTE AND ATMOSPHERE REFERENCE ONLY. Do not copy either composition. Anime visual novel background, detailed digital painting, warm lighting, no people, 1280x720, painterly brushwork. A narrow lane in a fictional old-town spice souq in Dubai in the late morning. A covered roof of old wooden lattice lets thin shafts of sunlight fall onto worn stone paving. On both sides, small open stalls with woven baskets heaped high with red, ochre and golden spice powders, dried rose buds, dried limes and cardamom pods; small brass scoops rest in the piles; copper lanterns and folded textiles hang above the stalls. Dense, fragrant and lively mood even without people. Sand, terracotta, saffron and turquoise accents. No hookahs or tobacco on display. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no Arabic calligraphy, no signs with writing, no price tags with numbers, no logos, no watermark. Do not copy any real landmark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 3/5 bg_dubai_cafe_day.png

- 原画: `bg_dubai_cafe_day_original.png`
- サイズ: 2738736 B
- SHA-256: `fc88db4ac99db65e6cd56dbdbb9a50ffd1d9d97125d3c32d544484bbcf72a76b`

```text
Use case: illustration-story. Asset type: 16:9 visual novel background. Attached bg_eden_shop.png is STYLE REFERENCE ONLY for fine pixel-painter texture; attached bg_dubai_map.webp is PALETTE AND ATMOSPHERE REFERENCE ONLY. Do not copy either composition. Anime visual novel background, detailed digital painting, bright lighting, no people, 1280x720, painterly brushwork. Interior of an ultra-luxurious cafe in central Dubai at midday. Tall floor-to-ceiling windows with a softened view of fictional skyscrapers, a white marble floor, cream upholstered armchairs around small round tables set with crystal water glasses, slim gold accents on the columns, a long pastry counter in the background, a few large potted palms. Bright, quiet, refined and a little intimidating for a young visitor. White, champagne gold and pale sky blue. No hookahs. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no Arabic calligraphy, no menus with writing, no logos, no numbers, no watermark. Do not copy any real cafe or landmark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 4/5 bg_dubai_inn_day.png

- 原画: `bg_dubai_inn_day_original.png`
- サイズ: 2452281 B
- SHA-256: `c90c55ab63637f7177d4d22555496d6aec61240d78b72b9de62a690b0a61908a`

```text
Use case: illustration-story. Asset type: 16:9 visual novel background. Attached bg_eden_shop.png is STYLE REFERENCE ONLY for fine pixel-painter texture; attached bg_dubai_map.webp is PALETTE AND ATMOSPHERE REFERENCE ONLY. Do not copy either composition. Anime visual novel background, detailed digital painting, warm lighting, no people, 1280x720, painterly brushwork. A modest guest room in a small hotel in an older district of Dubai, early afternoon. A single bed with a plain white cover, a small writing desk and chair, a wall-mounted air conditioner, a cool tiled floor with a simple woven rug, a window with sheer curtains showing low sand-colored buildings and a bright pale sky. A closed plain hard equipment case (no logo) stands beside the bed. Clean, practical and slightly worn, a traveler's room. Warm daylight. No hookah. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no Arabic calligraphy, no logos, no numbers, no watermark. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```

### 5/5 bg_dubai_inn_night.png

- 原画: `bg_dubai_inn_night_original.png`
- サイズ: 2331157 B
- SHA-256: `3fd020869f0ddb52eced6517e6c3e99876cf336600b25fcae2e1e6e7846f1861`

```text
Use case: lighting-weather. Asset type: 16:9 visual novel background. Image 1 is the ADOPTED DAYTIME ROOM AND EDIT TARGET: preserve its exact camera, architecture, window, bed, desk, chair, air conditioner, rug, hard equipment case and object placement. Image 2 bg_eden_shop.png is a style reference only for fine pixel-painter texture. Image 3 bg_dubai_map.webp is palette reference only. Anime visual novel background, detailed digital painting, warm lighting, no people, 1280x720, painterly brushwork. The SAME guest room as Image 1, same camera, same furniture and layout, now at night. The desk lamp is on and makes a warm pool of light, the sheer curtains are half open, a deep blue night sky and scattered city lights outside the window, the closed equipment case still beside the bed and a folded towel laid on the floor in front of it. Calm, quiet and a little lonely, the night before a big competition. No hookah or shisha pipe. Keep the center foreground open for a character overlay. Fine pixel-painter texture matching bg_eden_shop.png, not photographic, not glossy 3D. No people, no text, no logos, no numbers, no watermark, no crushed blacks. 16:9, 1280x720 (or 2048x1152 for downsampling), opaque.
```
