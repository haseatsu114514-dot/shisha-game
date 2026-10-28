# 凛 タイトルアート候補 6–8 生成レポート

## 共通条件
- 生成方法：組み込み image_gen による参照画像付き新規生成。既存画像の部分編集ではなく、各場面を新しい構図で生成した。
- 参照：sprite_normal.webp（容姿の主参照）、titleart_ref.webp（顔・髪・瞳・描画の補助参照）。両画像を目視確認し、毎回両方を入力した。
- 全候補：PNG、1024 × 1536 px、縦横比 2:3。サイズ指定との差異なし。
- 保存後に全画像を目視確認し、Pillow の verify() でPNGの読み込みも確認した。
- 自己評価：5が最良。容姿・場面の評価は目視による主観評価。
- 参照画像、INSTRUCTIONS.md、prompts.md は変更していない。このフォルダへ作成した成果物は候補3枚と本レポートのみ。生成ツール固有の保存先からPNGをコピーした。

## 候補別結果

| 候補 | 場面 | 方法 | 生成サイズ | ファイルのバイト数 | 再生成 | 明らかな破綻 | キャラの一貫性 | 場面の再現度 |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| cand_6.png | midnight_hagal_trial | 参照付き新規生成 | 1024 × 1536 | 2364100 | なし（初回採用） | 目視ではなし | 5/5 | 4/5 |
| cand_7.png | blend_library_command | 参照付き新規生成 | 1024 × 1536 | 2232951 | なし（初回採用） | 目視ではなし | 5/5 | 4/5 |
| cand_8.png | amber_glass_window | 参照付き新規生成 | 1024 × 1536 | 2299475 | なし（初回採用） | 目視ではなし | 4/5 | 4/5 |

### cand_6.png
黒い長髪、重めの前髪と頬沿いのレイヤー、半眼の青灰色の瞳、銀のフープピアス、白シャツ・黒スラックスを維持。深夜の暖色照明、前景の素焼きハガルと炭、ステム、ガラスベース、下げたマウスピースと口元の煙を確認。顔・見える手指に明らかな異常、別人物、文字の混入は見当たらない。
場面上の差分：空いた手に試料容器を持ち、机上に茶葉や香料の皿が追加されている。煙は指定の細い一本より広がりがあり、襟元も指定より開き気味。顔の向きは煙の質を観察するより鑑賞者寄り。

### cand_7.png
両手に別々の開いた缶を持ち、鼻から離れた胸元以下で比較。無地缶の棚、素焼きハガル、暗色リーフ、充填道具を前景に配置。顔・見える手指の明らかな異常、別人物、文字の混入は見当たらない。
場面上の差分：脇のシーシャは組み上げ待ちの部品ではなく、ボウル／カバーを備えた組み上がった姿。襟元は閉じた襟の指定に対しやや開いている。

### cand_8.png
背面斜めから肩越しに振り返る顔、両手で支えるガラス、夕景の窓と琥珀・透明・青系の陳列を確認。顔・見える手指の明らかな異常、別人物や人型の反射、文字の混入は見当たらない。
場面上の差分：持っているガラスベースにはステムとボウルが付いており、空のベース単体の移動という指定から外れる。複数の完成シーシャが並び、一台を中央の主軸とする構成より陳列全体が強い。長髪は腰付近まで伸び、指定よりやや長め。

## 使用プロンプト
prompts.md の各番号の英語プロンプト全文をそのまま使い、次の参照指定を前置した。以下は実際に送信した最終プロンプト全文。

### 6

```text
Use case: illustration-story. Generate a NEW scene, not a remake of either reference composition. Image 1 (sprite_normal.webp) is the primary character identity reference; image 2 (titleart_ref.webp) supports face/hair/eye identity and illustration polish only. Match the same Rin, especially long layered wolf-cut black hair, blue-gray half-lidded eyes, silver hoop earrings and small silver pendant, white rolled-sleeve shirt and black slacks. Follow the requested modest clean collar. Do not copy reference pose or background. Output one vertical 1024x1536 PNG.

A 27-year-old Japanese woman: very dark long wolf-cut hair with subtle slate-blue undertones, ending below the bust and above the waist, thick sweeping bangs and cheek-hugging layers, mature languid half-lidded blue-gray eyes, a subtle cool smile, no glasses, silver hoop earrings, clear unpainted nails, white shirt with rolled sleeves and a clean collar, black slacks.

Late at night at her upstairs shisha import desk, she quietly evaluates a dark-leaf blend with jasmine and cardamom notes. An assembled shisha with her personal unglazed terracotta hagal bowl stands prominently on a low side table beside the desk. Its bowl, restrained glowing charcoal, metal stem and glass base remain recognizable. Frame her closely from a slightly low three-quarter angle, with the bowl in the lower foreground and her readable face above it. She has just lowered the mouthpiece and releases a slender, measured ribbon of smoke, watching its texture with professional concentration beneath her languid expression. A warm desk lamp illuminates the clay grain, her relaxed hand and the smoke. Keep her torso upright and modestly framed; the mood is intimate, composed and quietly discerning. Desk surfaces contain only blank folders and unmarked sample containers.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

```

### 7

```text
Use case: illustration-story. Create a completely NEW composition for the scene below. Image 1 (sprite_normal.webp) is the primary character identity reference; image 2 (titleart_ref.webp) supports character appearance and rendering polish only. Preserve Rin's same face, half-lidded blue-gray eyes, very dark long layered wolf-cut, hoop earrings, small silver pendant, white rolled-sleeve shirt and black slacks. Keep her collar modestly buttoned. The pose and setting MUST follow this new scene; do not copy the smoking pose, seated composition or reference background. One vertical 1024x1536 PNG.

A 27-year-old Japanese woman: very dark long wolf-cut hair with subtle slate-blue undertones, ending below the bust and above the waist, thick sweeping bangs and cheek-hugging layers, mature languid half-lidded blue-gray eyes, a subtle cool smile, no glasses, silver hoop earrings, clear unpainted nails, white shirt with rolled sleeves and a clean collar, black slacks.

She stands behind a compact shisha blending counter, backed by an orderly wall of plain, completely unmarked flavor tins. Hold a different open tin in each hand at lower chest height, their contents suggesting two distinct loose-leaf blends. She compares them with slightly narrowed eyes and a knowing, cool smile, keeping both tins well below her nose. In the immediate foreground, her personal unglazed terracotta hagal bowl rests on a preparation mat beside a small portion of dark leaf and a clean packing tool. A substantial shisha stem and glass base stand beside the bowl, ready for assembly. Compose a clear visual triangle between her face, the two tins and the bowl being developed. The subject is her control over the flavor library and the next shisha blend, with the preparation station as a major visual anchor. Use warm shelf lighting and restrained slate-blue accents; no smelling pose, clipboard or shipping boxes.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

```

### 8

```text
Use case: illustration-story. Create a completely NEW composition for the scene below. Image 1 (sprite_normal.webp) is the primary character identity reference; image 2 (titleart_ref.webp) supports character appearance and rendering polish only. Preserve Rin's same face, half-lidded blue-gray eyes, very dark long layered wolf-cut, hoop earrings, small silver pendant, white rolled-sleeve shirt and black slacks. Keep her collar modestly buttoned. The pose and setting MUST follow this new scene; do not copy the smoking pose, seated composition or reference background. One vertical 1024x1536 PNG.

A 27-year-old Japanese woman: very dark long wolf-cut hair with subtle slate-blue undertones, ending below the bust and above the waist, thick sweeping bangs and cheek-hugging layers, mature languid half-lidded blue-gray eyes, a subtle cool smile, no glasses, silver hoop earrings, clear unpainted nails, white shirt with rolled sleeves and a clean collar, black slacks.

Inside a specialist shisha shop just before closing, she rearranges heavy glass shisha bases on a waist-high window display. Show her from a rear three-quarter angle as she turns her head over her shoulder, keeping her face fully readable. Both hands support one glass base just above its new position. A complete unlit shisha with an unglazed terracotta bowl forms the tall central anchor among several empty amber, clear and smoky-blue bases. Warm sunset passes through their curved glass, casting soft colored patches onto her rolled sleeves and the display surface. The shisha display occupies a substantial part of the foreground and visually overlaps her silhouette without hiding her face. Her expression is quietly satisfied after a precise final adjustment. Window reflections show only glass objects, sunset and abstract light, never a duplicate human figure. Dry evening, understated interior, no umbrella or neon signage.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

```


