# Issue #2689 裏口背景の生成記録

PR #2679 (`claude/sharp-gauss-bm5ru3`) の `README.md`「採用の記録」に相当する、候補原画の記録。2026-11-06、Codex A の組み込み生成機能で作成。**採用・ゲーム組み込みは未実施**。

## 候補原画

| ID | 原画 | サイズ | SHA-256 | 平均輝度 (0–255) | 検品 |
|---|---|---:|---|---:|---|
| day_candidate01 | `originals/bg_mukai_backdoor_day_candidate01.png` | 1672×941, 2,796,771B | `e7ef86a572d193ae5f7fd465608ad5269196bb5aaa42b898a45d710b85734d6b` | 107.94 | 戸・ベンチ・地面は良好。右端の木箱が「箱なし」指定に抵触するため不採用寄り。 |
| day_candidate02 | `originals/bg_mukai_backdoor_day_candidate02.png` | 1672×941, 2,791,722B | `544d7ad649cc3f5cc79ad155fe6190fe288a1d189013d0f213c655d811c24163` | 112.28 | 昼の第一候補。右端の麻袋以外は配置場所が空いている。 |
| night_candidate01 | `originals/bg_mukai_backdoor_night_candidate01.png` | 1672×941, 2,416,718B | `a5285ed4eb867955b02f622d7facdd12d5af05d93864ffd56aa39f1f10295f59` | 68.70 | 昼候補01の同じ場所・構図。灯りと影は読めるが右端の麻袋の置き方に違和感。 |
| night_candidate02 | `originals/bg_mukai_backdoor_night_candidate02.png` | 1672×941, 2,354,713B | `03f5b9077939cba33976dd2784c0bbac131ce746c1a3b1bcc2b6813ee4048042` | 67.17 | 夜の第一候補。昼候補02と同じ戸・ベンチ・ひさし・路地構図。戸上の灯りが点灯。 |

全4枚: PNG・RGB・非0バイト。原寸目視で人物、猫、文字、看板の字、シーシャ機材、鉢植えなし。ベンチ座面・中央の地面・右のひさし下は概ね空き。夜の平均輝度は30以上で壁と地面の細部が読める。**規格未達:** 組み込み生成機能の出力が全て1672×941で、`docs/background_standard.md` の生成2048×1152以上を満たさない。原画を拡大せず保存した。採用には規格を満たす再生成が必要。

## 生成依頼

各候補の生成依頼本文は PR #2679 の `tools/bg_prompts.txt` の TK01/2・TK02/2 を改変せず使用。昼01・02に TK01/2、夜01・02に TK02/2。夜01は昼01、夜02は昼02を「同じ場所・同じ構図」の参照にした。各依頼には参照役割と画風固定の補足を付けた。

### TK01/2（原文）

```text
Anime visual novel background, detailed digital painting, warm lighting, no people, 16:9, painterly brushwork. The back entrance of an old, narrow four-story building in a quiet Tokyo back alley, where a small shisha bar called mukai has its shop upstairs (fictional, not a copy of any real place). Seen from the eye level of a person sitting on a bench, looking at the corner by the back door on a calm, clear afternoon. On the far left, the back door: an old steel door painted blue-grey (the same blue-grey as the attached mukai interior), slightly chipped at the edges, with a small square wired-glass window and a plain lever handle, a small round wall light above it (unlit by day) and one concrete step in front of it. To the right of the door, against the wall, a long simple wooden bench with an olive-green painted frame, its seat top at about 60 percent of the image height; the seat is empty. The wall is weathered pale mortar with a vertical drainpipe and a small air-conditioner outdoor unit high up. In the center, open flat concrete ground with a few cracks and a drain grate, completely empty. On the right, under a short corrugated eave, a dry sheltered corner of the ground left empty; at the very right edge, two or three folded empty burlap coffee-bean sacks stacked neatly on a low wooden crate (the shop owner loves coffee). In the upper right, the narrow alley continues into the distance between buildings, with power lines and a strip of soft blue sky, kept calm and low in contrast. Soft daylight falling into the alley from the upper left, gentle shadows. Quiet, lived-in, a little hidden place where a shop cat naps. Leave the bench seat, the center ground and the right corner empty for game objects. No cat, no animals, no people, no boxes, balls, cushions, pet beds or dishes, no hookah or shisha equipment, no potted plants, no bicycles, no text, no signboards, no posters, no labels, no stencils on the sacks, no logos, no numbers, no watermark. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```

### TK02/2（原文）

```text
Anime visual novel background, detailed digital painting, cool night lighting with one warm lamp pool, no people, 16:9, painterly brushwork. The same back corner of the old narrow building and the same composition as the attached day image (bg_mukai_backdoor_day.png), now late in the evening while the shop upstairs is open. The small round wall light above the blue-grey steel back door is on, casting one warm pool of light over the door, the concrete step and the olive-framed wooden bench; a faint warm glow shows through the small wired-glass window of the door. The center ground and the sheltered corner under the eave on the right are in soft cool shadow but still clearly readable. The folded coffee-bean sacks on the low crate at the right edge catch a little of the lamplight. The alley in the upper right is dark navy with a few distant lit windows and the orange glow of the city above the rooftops, kept calm and low in contrast. Quiet, warm and a little secret, the place where the shop cat waits. Leave the bench seat, the center ground and the right corner empty for game objects. No cat, no animals, no people, no boxes, balls, cushions, pet beds or dishes, no hookah or shisha equipment, no potted plants, no text, no signboards, no posters, no labels, no logos, no numbers, no watermark, no crushed blacks. STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.
```

## 参照画像と役割

- 画風参照: `assets/backgrounds/bg_street_night.png` (SHA-256 `29424b48c8ba10982a6f5e88024687bab1c0901fbcc935332f407a00beb2cc63`)。承認済み屋外・夜の画風に固定。
- 色参照: `assets/backgrounds/bg_mukai_shop.png` (SHA-256 `998401f6510d9ef9937b9710b1df1d49507e95e91f7331cbcfb6c1af1afeb4fc`)。青灰・オリーブ・木の色に使用。
- 同一場所・構図参照: 夜候補01には `originals/bg_mukai_backdoor_day_candidate01.png`、夜候補02には `originals/bg_mukai_backdoor_day_candidate02.png`。
- 画風固定の指示: 上記原文末尾の `STYLE STANDARD (shisha-game backgrounds)` を昼夜すべてに使用し、参照画像と同じ承認済みゲーム背景の筆致・面の塗り・現実的なパースを保つよう役割ラベルとともに補足。

## ベースと後続

- 最新 `origin/main` (`f89d2a7fc6c3a48abc46d49ab53e9c78b57c5ba7`) には `asset_sources/tetsuko-care/README.md` が無い。README は PR #2679 head にだけあるため、本PRは main ベースで `originals/` とこの独立記録だけを追加する。PR #2679 の README へ相乗りしない。
- Claude 側が規格達成後に候補を選び、`assets/backgrounds/` への配置・縮小・台帳・`ART_READY` を担当する。
