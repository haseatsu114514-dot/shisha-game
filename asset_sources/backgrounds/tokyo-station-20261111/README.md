# Issue #3285 背景原画 — tokyo-station

- 生成経路: Codex 内蔵画像生成
- 保存形式: 無加工 PNG、1672×941。2048×1152 未満のため採否はオーナー判断。
- ゲームへの組み込み: オーナー採用後。

## 画像台帳

### C3-1 `bg_tokyo_station_day.png`

- 判定: 合格
- 参照画像の役割とパス:
  - 画風: assets/backgrounds/bg_street_night.png
  - 東京の季節感: remake/img/backgrounds/bg_tokyo_park_day.webp（指定 PNG は LFS ポインタで取得停滞、同内容のゲーム用 WebP を使用）

#### 実際の生成依頼文（全文）

```text
Use case: stylized-concept. Asset type: visual novel background. Input images: bg_street_night.png is painting style only; bg_tokyo_park_day.webp is late autumn Tokyo atmosphere and season only. Anime visual novel background, detailed digital painting, warm lighting, no people, 16:9, painterly brushwork. The broad plaza in front of a large Tokyo terminal station on a clear late-autumn afternoon (a fictional station; do not copy any real station facade or landmark). Seen at standing eye level from the plaza: on the left, part of the grand station building with a long stone-and-glass facade, wide entrances and a covered walkway; in the center, an open stone-paved plaza with a few low granite benches; on the right, a wide avenue lined with tall zelkova and ginkgo trees in yellow and russet leaves, leading away between modern office towers with glass curtain walls. Soft afternoon sunlight from the upper left, long gentle shadows of the trees across the paving, a few fallen ginkgo leaves. A big-city place where two people meet and then start walking. Keep the center foreground open for character overlays. No people, no cars in the foreground, no text, no signs with letters, no station name, no clock numerals, no logos, no advertising screens with images, no numbers, no watermark. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```

### C3-2 `bg_tokyo_station_night.png`

- 判定: 合格
- 参照画像の役割とパス:
  - 同じ場所・構図: asset_sources/backgrounds/tokyo-station-20261111/bg_tokyo_station_day.png
  - 夜の画風: assets/backgrounds/bg_street_night.png

#### 実際の生成依頼文（全文）

```text
Use case: lighting-weather. Asset type: visual novel background. Input images: first image is the same place and EXACT composition to preserve; second image is night painting style only. Anime visual novel background, detailed digital painting, cool night lighting with warm accents, no people, 16:9, painterly brushwork. The same station plaza and tree-lined avenue and the EXACT same composition as the attached day image (bg_tokyo_station_day.png), now in the evening. The station facade is softly lit from below with warm light, its entrances glowing; small warm lights are wound around the lower branches of the zelkova trees along the avenue; the office towers show scattered lit windows; a deep navy sky with an orange city glow. The stone paving reflects the warm lights a little. Calm and a little festive, readable everywhere. Keep everything in the same place as the day image. Keep the center foreground open for character overlays. No people, no text, no signs with letters, no station name, no clock numerals, no logos, no numbers, no watermark, no crushed blacks. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```
