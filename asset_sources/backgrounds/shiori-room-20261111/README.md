# Issue #3285 背景原画 — shiori-room

- 生成経路: Codex 内蔵画像生成
- 保存形式: 無加工 PNG、1672×941。2048×1152 未満のため採否はオーナー判断。
- ゲームへの組み込み: オーナー採用後。

## 画像台帳

### C2-1 `bg_shiori_room_day.png`

- 判定: 合格
- 参照画像の役割とパス:
  - 画風: assets/backgrounds/bg_tonari_inside_day.png
  - 配色のみ: assets/sprites/characters/minto/chr_minto_ura_normal.png

#### 実際の生成依頼文（全文）

```text
Use case: stylized-concept. Asset type: visual novel background. Input images: bg_tonari_inside_day.png is style only; chr_minto_ura_normal.png is color palette only, no person should appear. Anime visual novel background, detailed digital painting, warm lighting, no people, 16:9, painterly brushwork. The small, tidy one-bedroom apartment of a 29-year-old woman who runs a concept cafe and is calm and grown-up at home, on a quiet afternoon. Seen from the doorway of the living room: a small dining table for two by the window with a pale mint-green tablecloth, two mismatched wooden chairs, a compact open kitchen on the left with a two-burner stove, a few pans and a cutting board, a small refrigerator. On a dark-wood shelf, a few treasured things from her family's old Japanese kissaten coffee shop: a set of classic white coffee cups with a thin green rim, a worn round paper coaster, a small brass sugar pot, and a framed photo seen too small to show anything. A pot of fresh mint on the balcony beyond the window, lace curtains, soft afternoon daylight across a light wooden floor and a cream-colored rug, a low sofa with a mint-green throw. Warm, quiet, a little nostalgic; cream, mint green and dark wood. No concept-cafe frills, no costumes, no horns or wings anywhere. Keep the center foreground open for character overlays. No people, no text, no logos on cups or coasters, no readable labels, no numbers, no watermark, no hookah or shisha equipment. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```

### C2-2 `bg_shiori_room_night.png`

- 判定: 合格
- 参照画像の役割とパス:
  - 同じ場所・構図: asset_sources/backgrounds/shiori-room-20261111/bg_shiori_room_day.png
  - 夜の画風: assets/backgrounds/bg_street_night.png

#### 実際の生成依頼文（全文）

```text
Use case: lighting-weather. Asset type: visual novel background. Input images: first image is the same place and EXACT composition to preserve; second image is night painting style only. Anime visual novel background, detailed digital painting, warm indoor night lighting, no people, 16:9, painterly brushwork. The same small apartment and the EXACT same composition as the attached day image (bg_shiori_room_day.png), now late at night after she closed her shop. The pendant lamp over the dining table and a small lamp on the shelf are on, casting warm amber light; the kitchen light under the cabinet is on, with a pot and two small plates ready on the counter for a late dinner. The window shows a deep navy night with a few distant lit windows; the mint pot on the balcony is a dark silhouette. Cozy, quiet and intimate, every surface still readable. Keep every piece of furniture in the same place as the day image. Keep the center foreground open for character overlays. No people, no text, no logos, no numbers, no watermark, no hookah or shisha equipment, no crushed blacks. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```
