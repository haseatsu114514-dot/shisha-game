# ましろ タイトルアート追加候補 6–8

## 生成方法・共通確認
- INSTRUCTIONS.md と prompts.md の全文を読み、sprite_normal.webp と titleart_ref.webp を目視確認した。
- 使用ツール: 組み込み image_gen。API／CLI は未使用。
- 方法: 参照画像を入力した新規場面生成。既存画像への局所修正・合成は行っていない。
- 初回は両参照を使用。sprite_normal.webp を容姿・衣装の主参照、titleart_ref.webp を顔立ち・暖かな雰囲気の補助参照とした。
- 6・8 の再生成は構図の引きずりを抑えるため sprite_normal.webp のみを入力し、両参照で確認した容姿を文章でも指定した。
- 全候補は PNG、1024×1536 px（縦横比 2:3）。サイズ変更・切り抜き・画像加工なし。
- 最終候補を各枚目視確認。1人のみ、淡いアッシュブロンドの二本編み、金色の瞳、白いリボン付きブラウス、ベージュのニットカーディガン、セージ色のスカートを確認した。足元はフレーム外。
- 目視では明らかな顔の崩壊、指の本数異常、別人化、文字・署名・ロゴの混入は見当たらない。画像ファイルの読み込み検証も成功した。
- 参照画像、INSTRUCTIONS.md、prompts.md は変更していない。納品ファイルはこのフォルダ直下の4点。生成ツールによる自動保存はツール既定領域に発生するが、手動のファイル作成・変更はこのフォルダ内に限定した。

## 候補別結果

| 候補 | 場面 | 生成方法 | サイズ | 保存バイト数 | 再生成 | キャラ一貫性 /5 | 場面再現度 /5 |
| --- | --- | --- | --- | ---: | --- | ---: | ---: |
| cand_6.png | velvet_dense_exhale | 参照付き新規生成 | 1024×1536 | 2,258,040 | あり・1回 | 5 | 4 |
| cand_7.png | sleepy_tea_audience | 参照付き新規生成 | 1024×1536 | 2,478,328 | なし | 5 | 4 |
| cand_8.png | drifting_spiral_watch | 参照付き新規生成 | 1024×1536 | 2,010,832 | あり・1回 | 5 | 4 |

### cand_6.png
初回は既存タイトルアートに近い頬杖の構図となり、煙の下方への重なりも弱かったため、1回再生成して差し替えた。最終画像は頭を起こし、両腕を下げ、口元から左へ吐いた煙が下部手前へ重なる新構図。顔と目は煙に隠れず、小さな満足の笑みが読み取れる。明らかな人体破綻・文字混入は見当たらない。
残る差異: シーシャのガラスベースは画面左端に少しかかる。金属は指定の暗い金属より暖色の真鍮寄り。煙の一部は炭の背後に重なり、吐煙の流路は厳密には分離しきれていない。

### cand_7.png
背の高い一人掛け椅子、眠たげだが開いた目、長い袖、重厚なシーシャ、湯気の立つ紅茶を確認。窓のない夜の奥まったラウンジとして成立している。明らかな人体破綻・文字混入は見当たらず再生成なし。
残る差異: マウスピースは指定の膝上より胸元寄り。吐煙は卓上低く漂う指定に対して口元寄りで、低い煙の広がりが弱い。器具の金属は暗色より真鍮寄り。紅茶の細い湯気は区別できる。

### cand_8.png
初回は螺旋煙が炭から直接立ち上がるように見えたため、1回再生成して差し替えた。最終画像は右に立つ人物と左上の不規則な螺旋煙、腰近くのマウスピース、器具につながるホースを確認。煙と炭の間には大きな空白があり、炭から濃煙が噴出する見え方は解消。明らかな人体破綻・文字混入は見当たらない。
残る差異: 煙は画面左全高ではなく上半分にまとまり、上端で少し切れる。器具は暗い金属より真鍮寄り。灰茶色の壁は照明でやや暖かいベージュに見える。

## 使用した最終プロンプト
prompts.md の各番号の英語本文を省略せず使用。以下は参照指定と修正指示を含めた実際の最終入力。

### 6

```text
Use case: illustration-story. Generate a NEW standalone scene using the attached images as character identity references only. Reference 1 (sprite_normal.webp) is authoritative for identity and clothing; reference 2 (titleart_ref.webp) is supporting facial identity and warm mood only. Match her exact bangs, two long thick braids, sleepy golden eyes, rounded face, cardigan, ribbon blouse and skirt. Do not copy either reference composition, pose or pixel/dither texture. Follow this scene prompt in full:
A 22-year-old Japanese woman: pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt, brown shoes.

In a quiet shisha lounge with warm walnut furniture, she enjoys a rich dark-leaf Earl Grey blend. Capture a long, slow exhale from a close three-quarter angle: a dense, velvety stream travels sideways from her lips before folding toward the lower foreground in overlapping soft layers. Smoke density and texture are a major subject, with a luminous thin edge and a substantial opaque core. Keep the plume below her eyes so her face remains clearly readable. Her golden eyes are peacefully half-lidded and the corners of her mouth carry the smallest satisfied smile. One hand holds the lowered mouthpiece; an assembled dark metal shisha with a substantial glass base stands in the lower foreground beside her. A restrained amber backlight reveals the smoke against a muted brown background. She is calmly awake, upright and comfortable; no coughing, packing action or theatrical cloud tricks.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.


CRITICAL composition correction: an entirely NEW close three-quarter viewpoint, woman facing toward image LEFT with her head upright and both arms lowered; NO hand near face, NO cheek resting on palm, NO tilted lounging pose. Lowered mouthpiece near lap in one hand. Exhaled smoke goes LEFT horizontally then folds down toward camera across LOWER foreground, BELOW eyes throughout, substantial velvety opaque layers. Complete shisha including substantial glass base fully inside the frame. Minimal walnut brown background.
```

### 7

```text
Use case: illustration-story. Generate a NEW standalone scene using the attached images as character identity references only. Reference 1 (sprite_normal.webp) is authoritative for identity and clothing; reference 2 (titleart_ref.webp) is supporting facial identity and warm mood only. Match her exact bangs, two long thick braids, sleepy golden eyes, rounded face, cardigan, ribbon blouse and skirt. Do not copy either reference composition, pose or pixel/dither texture. Follow this scene prompt in full:
A 22-year-old Japanese woman: pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt, brown shoes.

She sits upright but deeply relaxed in a high-backed single armchair inside a softly lit evening lounge alcove, away from any window. Her oversized cardigan sleeves cover most of her hands; a few fingertips visibly secure the shisha mouthpiece above her lap. Her eyes remain slightly open, drowsy yet aware, with an air of effortless private luxury. Beside her, a complete dark metal shisha with a broad smoky-glass base occupies a substantial foreground area, its bowl rising near her lower chest. A steaming cup of amber black tea rests on a separate small coaster nearby. Distinguish the tea's fine rising steam from a broader, fading shisha exhalation drifting low across the table. Compose the chair, shisha and tea as a compact arrangement centered on her, like a quietly pampered regular enjoying her usual place. Warm brass lamplight, muted sage textiles, no crown, no attendants, no daytime nap.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

```

### 8

```text
Use case: illustration-story. Generate a NEW standalone scene using the attached images as character identity references only. Reference 1 (sprite_normal.webp) is authoritative for identity and clothing; reference 2 (titleart_ref.webp) is supporting facial identity and warm mood only. Match her exact bangs, two long thick braids, sleepy golden eyes, rounded face, cardigan, ribbon blouse and skirt. Do not copy either reference composition, pose or pixel/dither texture. Follow this scene prompt in full:
A 22-year-old Japanese woman: pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt, brown shoes.

Standing beside a low shisha table in a quiet interior corner, she tilts her chin slightly upward to watch her recently exhaled smoke catch a gentle rising air current. The smoke forms a tall, loose, irregular spiral beside her face, with two broad curling turns and wispy broken edges, an organic air pattern rather than a rigid magical helix. Her usual sleepy eyes open just a little wider with mild curiosity. She holds the mouthpiece near her waist, with its hose visibly leading to a complete shisha in the lower foreground. Compose her large figure on the right and the luminous vertical smoke column on the left, the base and bowl anchoring the lower part of that column without implying that dense smoke erupts directly from the charcoal. Use a restrained low three-quarter viewpoint, a plain warm-gray wall and soft amber rim light that makes the smoke's changing thickness legible. No rings or horizontal smoke curtain.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.


CRITICAL physical correction: the two broad irregular turns of exhaled smoke float ONLY beside her face and ABOVE SHOULDER HEIGHT on image LEFT; the lower end is a wispy broken remnant near her mouth level. Leave a very large CLEAR EMPTY AIR GAP from the shoulder-height smoke to the charcoal bowl down below at her hip. NO smoke whatsoever connected to or rising from charcoal. Bowl and base completely smoke-free. Smoke must visibly originate from her recently exhaled breath, not shisha bowl. Two loose broad curling turns, not a repeating rigid coil. Plain warm-gray wall. Woman stands on RIGHT, slightly upward curious gaze.
```

