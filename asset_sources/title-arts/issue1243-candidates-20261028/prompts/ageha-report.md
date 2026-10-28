# ageha 画像生成レポート

- 実施日: 2026-10-28
- 使用ツール: 組み込み image_gen。CLI/API フォールバックは未使用。
- 生成方法: 全候補とも、sprite_normal.webp と titleart_ref.webp を容姿参照にした新規生成。参照画像の構図の流用・直接編集ではない。
- 保存先: このフォルダ直下の cand_1.png ～ cand_5.png。
- 全候補: PNG、1024 × 1536 px、縦横比2:3。PNGシグネチャと実寸を検証済み。リサイズ・切り抜き・画像加工なし。
- 全候補を生成後に目視確認。顔の崩壊、明らかな指の本数異常、別人化、文字混入、他の人物の混入は見当たらず、再生成は全候補0回。
- 参照画像2点、prompts.md、INSTRUCTIONS.md は変更していない。
- ファイル操作による成果物の作成先はこのフォルダのみ。ただし生成ツールは管理領域に元画像を自動保存する仕様であり、その出力をこのフォルダへコピーした。ツールの自動保存先を指定・抑止する引数はない。外部ファイルの手動編集・削除は行っていない。

## 候補別評価

5段階評価（5が最高）。破綻の有無は目視による判定で、遮蔽された指はすべてを確認できるものではない。

| 候補 | 場面 | 方法 | 生成サイズ | 再生成 | 破綻の有無・内容 | キャラ一貫性 | 場面再現度 |
|---|---|---|---|---|---|---|---|
| cand_1.png | morning_hands | 参照付き新規生成 | 1024×1536 | 無 | 明らかな破綻なし。朝日・手を見つめる表情・カウンター脇の着席を確認。 | 4/5 | 4/5 |
| cand_2.png | gummy_light | 参照付き新規生成 | 1024×1536 | 無 | 明らかな破綻なし。白と赤のグミ、ウインク、無地の袋を確認。 | 5/5 | 4/5 |
| cand_3.png | tropical_cut | 参照付き新規生成 | 1024×1536 | 無 | 明らかな破綻なし。マンゴー、パイナップル、半割りパッションフルーツ、陶製ボウル、閉じ目の笑顔を確認。 | 5/5 | 5/5 |
| cand_4.png | crepe_walk | 参照付き新規生成 | 1024×1536 | 無 | 明らかな破綻なし。夕景、無人の街、いちごクレープ、閉じ目の笑顔を確認。指定との差異は下記。 | 4/5 | 4/5 |
| cand_5.png | winter_lights | 参照付き新規生成 | 1024×1536 | 無 | 明らかな破綻なし。閉じたジャケット、両手の無地カップ、金色の並木イルミネーションを確認。 | 5/5 | 4/5 |

## 残る差異・注意点

- 共通: ハニーブロンドの長いツインテール、画面左のピンク／右のクリーム色のクマ髪飾り、若々しい顔、ヒョウ柄、黒チョーカーを維持。開眼している候補では琥珀色の瞳を確認。原作立ち絵より髪のカールや量感、陰影が強め。
- cand_1: 指を曲げ伸ばす動きは静止画のため開いた手で表現。指定の腰上より広い着席構図。片肩のジャケットが下がり、襟に参照にはないボア風の縁取りがある。
- cand_2: 指定の胸上より広く腰・膝まで含む。白と赤のグミは横に並んで接している。
- cand_3: 果物を切っている最中ではなく、マンゴー片を持ち上げた瞬間。片手はカウンターと果物の陰に一部隠れている。
- cand_4: 指定外のクリーム色マフラーと黒バッグが追加された。口元のクリームは唇より頬寄り。頬のふくらみは控えめ。
- cand_5: 指定の腰上より広く太腿まで入る。金のハートネックレスは閉じたジャケットに隠れている。白い息とカップの湯気が近く、判別がやや曖昧。

## 使用した最終プロンプト

各候補へ同じ2枚の参照画像を添付し、以下の全文を使用した。

### cand_1.png

```text
Use case: stylized-concept. Generate a completely NEW scene illustration, using the two attached images ONLY as character appearance references. Image 1 (sprite_normal.webp) is primary canonical character design. Image 2 (titleart_ref.webp) corroborates identity only; do NOT copy its pose, framing, background or pixel texture. Preserve youthful soft face, honey golden blonde long voluminous wavy high twin ponytails with bangs, pink bear clip on viewer left and cream bear clip on viewer right, amber eyes, gold hoop earrings, black choker with gold ring, gold heart necklace, orange/black leopard print bomber jacket with black cuffs, pink heart top and black pleated skirt as visible. Follow requested outfit modifications for winter. Clean smooth warm anime illustration, NOT pixel art. Exactly one person. NO lettering, logos, watermarks or extra people. Produce one portrait image 1024x1536 (2:3). Reference images are identity references, not edit targets.


Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

Scene 1:

A 22-year-old Japanese woman with a bright, friendly, youthful face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink heart crop top, black pleated skirt, thigh-high stockings, black choker and a gold heart necklace; no heavy makeup. Morning before opening at her shisha shop MELTY PUFF, soft sunlight pouring through the window, she sits alone on a stool by the counter, holding her hand up into the light and slowly flexing her fingers, watching them with a quiet, serious expression that turns into a small relieved smile. Peaceful dust motes in the light. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, tender quiet mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, modest framing.

```

### cand_2.png

```text
Use case: stylized-concept. Generate a completely NEW scene illustration, using the two attached images ONLY as character appearance references. Image 1 (sprite_normal.webp) is primary canonical character design. Image 2 (titleart_ref.webp) corroborates identity only; do NOT copy its pose, framing, background or pixel texture. Preserve youthful soft face, honey golden blonde long voluminous wavy high twin ponytails with bangs, pink bear clip on viewer left and cream bear clip on viewer right, amber eyes, gold hoop earrings, black choker with gold ring, gold heart necklace, orange/black leopard print bomber jacket with black cuffs, pink heart top and black pleated skirt as visible. Follow requested outfit modifications for winter. Clean smooth warm anime illustration, NOT pixel art. Exactly one person. NO lettering, logos, watermarks or extra people. Produce one portrait image 1024x1536 (2:3). Reference images are identity references, not edit targets.


Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

Scene 2:

A 22-year-old Japanese woman, cheerful approachable gyaru with a youthful face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink heart crop top, black choker and gold heart necklace; no heavy makeup. Bright pastel-lit corner of a cute shisha lounge, she holds up a translucent white gummy bear and a red gummy bear between her fingertips toward the light, one eye closed in a playful wink, big happy grin, colorful soft reflections on her cheek, an open plain candy bag in her other hand. Chest-up close framing, she dominates the vertical frame. Warm anime-style illustration, soft painterly cel shading, bright soft light, poppy cheerful mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, candy bag plain.

Keep bomber jacket properly worn on BOTH shoulders. Show exactly two small gummy bears, one milky translucent white and one red, delicately held together in raised hand; other hand holds a plain open bag. Anatomically natural five-fingered hands.
```

### cand_3.png

```text
Use case: stylized-concept. Generate a completely NEW scene illustration, using the two attached images ONLY as character appearance references. Image 1 (sprite_normal.webp) is primary canonical character design. Image 2 (titleart_ref.webp) corroborates identity only; do NOT copy its pose, framing, background or pixel texture. Preserve youthful soft face, honey golden blonde long voluminous wavy high twin ponytails with bangs, pink bear clip on viewer left and cream bear clip on viewer right, amber eyes, gold hoop earrings, black choker with gold ring, gold heart necklace, orange/black leopard print bomber jacket with black cuffs, pink heart top and black pleated skirt as visible. Follow requested outfit modifications for winter. Clean smooth warm anime illustration, NOT pixel art. Exactly one person. NO lettering, logos, watermarks or extra people. Produce one portrait image 1024x1536 (2:3). Reference images are identity references, not edit targets.


Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

Scene 3:

A 22-year-old Japanese woman, intuitive genius shisha player with a youthful friendly face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink heart crop top, black pleated skirt, black choker and gold heart necklace; no heavy makeup. Behind the counter of a cheerful shisha shop, a cutting board with sliced mango, pineapple and halved passion fruit, she holds a piece of mango up, laughing with a joyful closed-eye smile as if she just found the perfect idea, juice glistening, a clay shisha bowl nearby. Warm sunny light. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm bright light, energetic happy mood, juicy tropical colors. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, modest framing.

Keep bomber jacket properly worn on BOTH shoulders. A completely fresh standing-behind-counter composition, not the seated hookah reference pose. Include cutting board, sliced mango, pineapple, halved passion fruit, a clay shisha bowl. Raised hand holds one mango piece; other hand rests naturally near cutting board. Frame waist up.
```

### cand_4.png

```text
Use case: stylized-concept. Generate a completely NEW scene illustration, using the two attached images ONLY as character appearance references. Image 1 (sprite_normal.webp) is primary canonical character design. Image 2 (titleart_ref.webp) corroborates identity only; do NOT copy its pose, framing, background or pixel texture. Preserve youthful soft face, honey golden blonde long voluminous wavy high twin ponytails with bangs, pink bear clip on viewer left and cream bear clip on viewer right, amber eyes, gold hoop earrings, black choker with gold ring, gold heart necklace, orange/black leopard print bomber jacket with black cuffs, pink heart top and black pleated skirt as visible. Follow requested outfit modifications for winter. Clean smooth warm anime illustration, NOT pixel art. Exactly one person. NO lettering, logos, watermarks or extra people. Produce one portrait image 1024x1536 (2:3). Reference images are identity references, not edit targets.


Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

Scene 4:

A 22-year-old Japanese woman with a bright, youthful, friendly face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink heart crop top, black pleated skirt, thigh-high stockings, black choker and gold heart necklace; no heavy makeup. Early evening on an empty city street with soft bokeh shop lights (all signs blank), she walks holding a strawberry-and-cream crepe, one cheek puffed from a big bite, eyes squeezed shut in a joyful closed-eye smile, a dab of cream on her lip. Warm golden-hour light. Thigh-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm evening glow, carefree everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no readable signs, text, letters or logos, modest framing.

Keep bomber jacket properly worn on BOTH shoulders. New outdoor walking composition, thigh-up three-quarter view, visibly puffed cheek from a bite, eyes squeezed closed in a happy smile, tiny dab of cream on lip. Crepe has strawberries and cream in a plain unprinted paper cone. Empty street, no humans or silhouettes anywhere.
```

### cand_5.png

```text
Use case: stylized-concept. Generate a completely NEW scene illustration, using the two attached images ONLY as character appearance references. Image 1 (sprite_normal.webp) is primary canonical character design. Image 2 (titleart_ref.webp) corroborates identity only; do NOT copy its pose, framing, background or pixel texture. Preserve youthful soft face, honey golden blonde long voluminous wavy high twin ponytails with bangs, pink bear clip on viewer left and cream bear clip on viewer right, amber eyes, gold hoop earrings, black choker with gold ring, gold heart necklace, orange/black leopard print bomber jacket with black cuffs, pink heart top and black pleated skirt as visible. Follow requested outfit modifications for winter. Clean smooth warm anime illustration, NOT pixel art. Exactly one person. NO lettering, logos, watermarks or extra people. Produce one portrait image 1024x1536 (2:3). Reference images are identity references, not edit targets.


Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

Scene 5:

A 22-year-old Japanese woman with a bright, youthful, friendly face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket zipped up against the cold, black pleated skirt, thigh-high stockings, black choker and gold heart necklace; no heavy makeup. Winter night on a tree-lined avenue covered in warm golden fairy-light illuminations, no other people, she holds a paper cup of hot drink in both hands near her face, breath visible, smiling warmly at the viewer with rosy cheeks, soft sparkling bokeh all around. Waist-up framing, she dominates the vertical frame. Warm anime-style illustration, soft painterly cel shading, glowing warm illumination against deep blue night, cozy festive mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, cup plain, no text, letters or logos.

Keep leopard-print bomber jacket fully zipped closed against cold, covering pink crop top and midriff; collar shows black choker. No added scarf, hats, bags or gloves. Both bare hands gently cradle ONE plain paper cup near her face with anatomically correct fingers. Visible soft breath from mouth and separate gentle steam from cup, warmly smiling open amber eyes at viewer. New waist-up composition on completely empty golden illuminated tree-lined avenue.
```


