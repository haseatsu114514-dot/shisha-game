# ひより タイトルアート拡充・生成レポート

- 生成日: 2026-10-28
- 使用ツール: 組み込み image_gen（CLI/API フォールバック不使用）。
- 方法: 2枚の参照画像を入力した新規場面生成。既存画像の部分編集ではありません。
- 参照: sprite_normal.webp（容姿・衣装の主参照）、titleart_ref.webp（容姿の補助参照）。既存の街路背景・立ち姿は使用せず、場面6・7・8を新しく生成しました。
- 全候補: PNG、1024×1536 px、縦横比2:3。サイズ変換・トリミング・画像加工なし。
- 各画像を目視確認済み。明らかな顔の崩壊、余分な手指、別人化、文字混入は認めず、再生成は実施していません。
- 評価は5段階（5が最良）、目視による主観評価です。

| 候補 | 場面 | 生成方法 | サイズ | バイト数 | 再生成 | 明らかな破綻 | キャラ一貫性 | 場面再現度 |
| --- | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| cand_6.png | peach_scent_composure | 参照付き新規生成 | 1024×1536 | 2,346,335 | なし（初回採用） | なし | 5/5 | 4/5 |
| cand_7.png | one_day_return_service | 参照付き新規生成 | 1024×1536 | 2,158,761 | なし（初回採用） | なし | 5/5 | 5/5 |
| cand_8.png | ponytail_after_hours | 参照付き新規生成 | 1024×1536 | 2,312,517 | なし（初回採用） | なし | 5/5 | 4/5 |

## 目視確認の詳細

### cand_6.png
赤みのあるピンクブラウンの高いポニーテール、茶色の目、顔周りの巻き毛、白い小立襟・レース前立てのブラウス、黒いパンツ、時計・金色の耳飾りを維持。カウンター上の素焼きハガル、ステム、発光感のあるガラスベースを前景に配置。顔と両手は読み取れ、文字・他人物なし。
軽微な差分: 横顔というより正面寄りの三四分角。煙が顔の左縁をわずかに横切るが、目や表情は判読可能。嬉しさは控えめで、桃・紅茶の香り自体は色と雰囲気による暗示。

### cand_7.png
元のブラウスに無地の暖色ブラウンのエプロンを追加。両手で水平に支える縁付きトレイ、ベースを固定する受け部、コンパクトな一台、風防、巻いたホースを確認。顔を遮らず、落ち着いた接客の笑顔。背景は無人の家具のみ。顔・手指の明らかな破綻や文字なし。
下半身は膝付近までの構図で、ローファーは画面外。場面7の指定構図と矛盾する重大な欠落はありません。

### cand_8.png
ソファに座り黒いパンツの脚を組んだ全身と両ローファー、素焼きハガル付きの一台、ホース、広い煙、暖色照明、無地の仕事鞄を確認。髪先は外へ流れ、顔も判読可能。顔・手指の明らかな破綻、文字・他人物なし。
軽微な差分: マウスピースを持つ手は肘掛け上の低い位置ではなく顔の近く。鞄はソファ脇の床ではなく座面の端。ガラスベース下部は前景小物で一部隠れている。ホースは重なりがあり経路が少し読み取りにくい。

## 保存・入力ファイル

納品物はこのフォルダ直下の cand_6.png、cand_7.png、cand_8.png、report.md。
INSTRUCTIONS.md、prompts.md、sprite_normal.webp、titleart_ref.webp は変更していません。
組み込み生成ツールは自身の既定キャッシュにも画像を自動保存します。生成画像を本フォルダへコピーして納品しており、フォルダ外の既存ファイルを手作業で編集・削除していません。

## 実際に送信したプロンプト

以下は prompts.md の各プロンプト全文に、参照画像の役割・同一性と出力仕様の補足を加えた実送信内容です。各呼び出しには sprite_normal.webp、titleart_ref.webp の順で2枚を添付しました。

### 候補6

```text
A 25-year-old Japanese woman: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, white-ivory lace blouse with a small stand collar and short French sleeves, black slacks, black loafers. The lace blouse has an opaque lining for modest coverage.

Seated at a warm wooden shisha counter after work, she carefully maintains an elegant, wistful pose: straight posture, slightly lowered chin and a delicate, restrained smile. Her bright eyes betray her excitement as they follow a fresh ribbon of smoke from a peach-and-Earl-Grey shisha. Place her personal unglazed terracotta hagal prominently on a complete shisha beside her, with the bowl, stem and softly illuminated glass base forming a major foreground subject. One hand rests lightly on the counter while the other holds the mouthpiece just below her lips after a gentle exhale. The smoke curves between the bowl and her face without covering her features. Frame her in a close three-quarter view at counter height, emphasizing the contrast between composed body language and sparkling, delighted eyes. Convey peach notes through soft peach-colored light and tea-brown accents, not floating fruit or literal scent symbols. No food, office paperwork or flashback imagery.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

Use case: illustration-story. Input image 1 sprite_normal.webp is the primary character identity and exact clothing reference. Input image 2 titleart_ref.webp is supplementary identity reference, not a composition template. Keep the same mature soft face, amber-brown eyes, reddish dusty rose-brown long wavy high ponytail tied in black, long curled cheek strands, small gold earrings, wristwatch, ivory stand collar blouse with vertical lace panels, opaque lining, short French sleeves. Create the entirely new scene described above; do not copy standing pose, hand-near-ear pose or street background. Smooth anime rendering, no pixel texture. Output one portrait PNG 1024x1536. Save requested deliverable within current folder as cand_6.png if supported.
```

### 候補7

```text
A 25-year-old Japanese woman: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, white-ivory lace blouse with a small stand collar and short French sleeves, black slacks, black loafers. The lace blouse has an opaque lining for modest coverage. Add a plain, unmarked warm-brown work apron over this exact outfit.

In the present day, she has returned to her familiar shisha lounge for a single shift. She pauses in the aisle beside an empty service table, carrying a compact, fully assembled shisha on a sturdy raised-rim tray held level with both hands at waist height. Its broad glass base sits securely in a fitted recess; the hose is neatly coiled on the tray, and a fitted wind cover contains the top assembly. Make the whole shisha substantial and clearly recognizable, with the tray and apparatus occupying the lower central foreground while her face remains unobstructed above. Her small, practiced smile expresses warm hospitality and the confidence of a former staff member who remembers the work. A few loose ponytail strands suggest her just-completed step, but the tray remains steady. Use a frontal three-quarter view and warm pendant lighting. Show only empty furnishings beyond her: no customer, recipient hand, school uniform or nostalgic flashback treatment.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

Use case: illustration-story. Input image 1 sprite_normal.webp is the primary character identity and exact clothing reference. Input image 2 titleart_ref.webp is supplementary identity reference, not a composition template. Keep the same mature soft face, amber-brown eyes, reddish dusty rose-brown long wavy high ponytail tied in black, long curled cheek strands, small gold earrings, wristwatch, ivory stand collar blouse with vertical lace panels, opaque lining, short French sleeves, black trousers and loafers. Add the specified plain warm brown apron. Create the entirely new scene described above; do not copy standing street pose or hand-near-ear pose. Both hands support tray safely; wind cover, stem and glass base of compact shisha must all fit above tray. Smooth anime rendering, no pixel texture. Output one portrait PNG 1024x1536. Save requested deliverable within current folder as cand_7.png if supported.
```

### 候補8

```text
A 25-year-old Japanese woman: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, white-ivory lace blouse with a small stand collar and short French sleeves, black slacks, black loafers. The lace blouse has an opaque lining for modest coverage.

After work in a cozy evening shisha lounge, she has just settled into a deep sofa and crossed her trouser-clad legs gracefully. Her posture is poised, her shoulders relaxed, and her soft face shows dreamy enjoyment as she watches a broad, translucent ribbon of exhaled smoke rise beside her. She holds the mouthpiece lightly in one hand over the sofa arm. A complete shisha with her personal unglazed terracotta hagal and a luminous clear glass base stands prominently on the low table in the near foreground, its hose drawing a sweeping curve toward her hand. The tip of her high ponytail still arcs outward from a tiny cheerful movement as she settled, a subtle physical trace of excitement beneath her elegant composure; no cartoon motion marks. Use an eye-level diagonal view along the sofa, showing her seated figure from head to loafers while keeping her face legible. Warm peach and amber lamps, quiet evening depth, a plain work bag tucked beside the sofa.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

Use case: illustration-story. Input image 1 sprite_normal.webp is the primary character identity and exact clothing reference. Input image 2 titleart_ref.webp is supplementary identity reference, not a composition template. Keep the same mature soft face, amber-brown eyes, reddish dusty rose-brown long wavy high ponytail tied in black, long curled cheek strands, small gold earrings, wristwatch, ivory stand collar blouse with vertical lace panels, opaque lining, short French sleeves, black tailored trousers, black belt with silver rectangular buckle and black gold-bit loafers. Create the entirely new seated sofa scene described above; do not copy standing street pose or hand-near-ear pose. Full seated body and both loafers inside frame, clearly crossed trouser legs, ponytail tip gently lifted, one continuous hose linking complete foreground shisha to mouthpiece in her hand over sofa arm. Smooth anime rendering, no pixel texture. Output one portrait PNG 1024x1536. Save requested deliverable within current folder as cand_8.png if supported.
```

