# Issue #3285 背景原画 — tokyo-benten

- 生成経路: Codex 内蔵画像生成
- 保存形式: 無加工 PNG、1672×941。2048×1152 未満のため採否はオーナー判断。
- ゲームへの組み込み: オーナー採用後。

## 画像台帳

### C4-1 `bg_tokyo_benten_day.png`

- 判定: 合格
- 参照画像の役割とパス:
  - 画風: assets/backgrounds/bg_street_night.png
  - 同じ公園: remake/img/backgrounds/bg_tokyo_park_day.webp
  - お堂の形: remake/img/backgrounds/bg_tokyo_map_day.webp の右下を切り抜いた作業用参照（単元フォルダ tokyo-map-benten-crop.png）

#### 実際の生成依頼文（全文）

```text
Anime visual novel background, detailed digital painting, warm lighting, no people, 16:9, painterly brushwork. A small fictional Benzaiten hall standing on the water of a pond in a large public park in Tokyo on a clear late-autumn afternoon, in the same fictional park as the attached bg_tokyo_park_day.png (Ueno mood, but not a copy of any real park, temple or shrine). Seen at standing eye level from the shore path, looking along a short wooden bridge with low wooden railings that crosses the water to a wooden deck built out over the pond. On the deck stands a modest single-story hall no bigger than a small house, matching the hall on the pond in the attached map crop: a dark blue-grey tiled hip-and-gable roof with gently upturned eaves, warm natural wood walls and pillars with only a few muted vermilion accents, one low wooden step, closed latticed wooden doors so the interior cannot be seen, and a plain wooden offering box without any writing. A pair of small stone lanterns (unlit) stands at the shore end of the bridge. The pond is calm and mirrors the soft afternoon sky; clusters of lotus leaves turning brown at the edges, no flowers, and a few fallen ginkgo leaves drifting on the water. Behind the hall, ginkgo and zelkova trees in yellow and russet, and a few city buildings rising above the treeline in the far distance. Quiet, small and unpretentious, a place where a visitor stops to think. Keep the center foreground (the near end of the bridge) open for a character overlay. No people, no animals, no statues of deities, no idols, no torii, no text, no plaques, no name boards, no banners or flags with writing, no paper slips with writing, no signboards, no logos, no numbers, no watermark, no glowing beams, halos or magical effects. Do not copy any real temple, shrine or landmark. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```

### C4-2 `bg_tokyo_benten_night.png`

- 判定: 合格
- 参照画像の役割とパス:
  - 同じ場所・構図: asset_sources/backgrounds/tokyo-benten-20261111/bg_tokyo_benten_day.png
  - 同じ公園の夜: remake/img/backgrounds/bg_tokyo_park_night.webp
  - 夜の画風: assets/backgrounds/bg_street_night.png

#### 実際の生成依頼文（全文）

```text
Anime visual novel background, detailed digital painting, cool night lighting with warm lantern pools, no people, 16:9, painterly brushwork. The same fictional pond hall and the same composition as the attached day image (bg_tokyo_benten_day.png), now at night. The short wooden bridge and the deck are lit by the pair of small stone lanterns at the shore end of the bridge and one old-fashioned park street lamp on the shore path (the same lamp style as bg_tokyo_park_night.png), each casting a narrow warm pool of light; a faint warm glow shows through the closed latticed doors of the hall, with nothing visible inside. The dark pond reflects the lantern light as soft streaks; the lotus leaves are dark shapes edged with a little warm light. The trees behind the hall are dark silhouettes with warm light on the nearest leaves, and a deep navy sky with a gentle orange city glow above the treeline. Still and calm, a place to stop and think quietly. Keep the center foreground (the near end of the bridge) open for a character overlay. No people, no animals, no statues of deities, no idols, no torii, no text, no plaques, no name boards, no banners or flags with writing, no paper slips with writing, no signboards, no logos, no numbers, no watermark, no glowing beams, halos or magical effects, no crushed blacks. Do not copy any real temple, shrine or landmark. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```
