# minto 画像生成レポート

- 参照: `sprite_normal.webp`（容姿・衣装の基準）、`titleart_ref.webp`（顔立ち・衣装細部の補助）。
- 生成ツール: 組み込み `image_gen`。CLI/API フォールバック不使用。
- 方法: 全候補とも参照画像2枚を入力した参照編集方式。既存絵の部分修正ではなく、場面・ポーズ・背景を新しく描画。
- 全画像: PNG、1024×1536 px、縦横比2:3。リサイズ・切り抜き・合成なし。
- `INSTRUCTIONS.md` と `prompts.md` および参照画像は変更していない。
- 保存先: このフォルダ直下の `cand_1.png` 〜 `cand_5.png`。
- 生成ツールは内部保存先にも自動保存する仕様のため、その出力をこのフォルダへコピーした。フォルダ外の既存ファイルに対する編集・削除は行っていない。

## 候補別の確認結果

評価は各5段階（5が最良）。生成結果を目視確認し、保存後にPNG形式と実寸を検証した。

|候補|場面|生成方法|実寸|再生成|破綻・指定との差分|キャラの一貫性|場面の再現度|
|---|---|---|---|---|---|---|---|
|cand_1.png|ribbon_ready|参照編集|1024×1536|なし|明らかな顔・手指の破綻、文字混入なし。鏡像は本人のみ。髪飾りを留める動作、緑の瞳、角・羽・衣装・チョーカーを確認。尻尾は構図と髪に隠れ明瞭でない。|5|5|
|cand_2.png|mint_cloud|参照編集|1024×1536|1回|初稿は頬杖が既存タイトルアートと近かったため不採用。再生成でカウンター越しの立ち姿に変更。最終稿に明らかな顔・手指の破綻、文字混入なし。淡い緑の大きな煙、ウインク、マウスピース、氷とミントを確認。尻尾は明瞭でない。|5|5|
|cand_3.png|melon_cream_soda|参照編集|1024×1536|なし|明らかな顔・手指の破綻、文字混入なし。木のカウンター、琥珀色の照明、緑のソーダ・バニラアイス・赤いチェリー、ストローで飲む動作を確認。上目づかいは控えめ。|5|4|
|cand_4.png|balcony_mint|参照編集|1024×1536|なし|明らかな顔・手指の破綻、文字混入なし。角・髪飾りなし、指定の私服、水やり、閉じた目と穏やかな笑顔を確認。鼻先のミントは「葉1枚」より小さな葉の束に近い。閉眼のため緑の瞳は画面上で確認できない（指定どおりの閉眼）。|4|4|
|cand_5.png|shotengai_stroll|参照編集|1024×1536|なし|明らかな顔・見える手指の破綻、文字混入なし。無人の商店街、背面斜めからの振り返り、私服、肩掛けバッグ、無地の紙袋・ミント・レモンを確認。隠れた指の本数は判定対象外。|5|5|

## 使用プロンプト

`prompts.md` の共通スタイル全文と各番号の英語プロンプト全文を使用。参照画像の役割、容姿の固定点、新規構図、私服時に外す装飾を補足した。以下は各採用画像に送信した最終プロンプト全文。

### cand_1.png

```text
Use case: stylized-concept. Create ONE new finished title-screen illustration for scene 1, not a reference sheet. Reference image 1 is the canonical character design; reference image 2 supports identity and costume details only. Match the exact same adult woman's face, green eyes, straight black hair/blunt bangs, small black horns and bat-wing clips, mint green frills and large chest bow with gold-rimmed black heart, black fitted dress and green heart pendant choker. Do NOT copy the references' pose or setting. Use clean anime illustration, NOT the pixelated texture in reference 2.
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
SCENE:
An adult Japanese woman (29, with a youthful idol-like look), concept cafe owner: long straight black hair with blunt bangs, green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept cafe dress with a large green ribbon and a heart choker, a small devil tail. In a tiny backstage nook of her cafe PEPPERMINT before opening, warm vanity bulbs glowing, she stands in front of a mirror adjusting a bat-wing clip in her hair, turning her head toward the viewer with a confident, determined little smile showing a small fang, her reflection softly visible in the mirror. Chest-up to waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm vanity light, playful everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image (mirror reflection of herself only), no text, letters or logos, modest framing.
```

### cand_2.png

```text
Use case: stylized-concept. Create ONE new title-screen illustration for scene 2. Reference 1 is canonical character identity and costume; reference 2 supports face and details only. Match same adult woman, straight long black hair/blunt bangs, green eyes, black horns, bat-wing clips, mint green frills, large green bow with gold-rimmed black heart, green heart choker. Invent the requested NEW composition, do not copy the seated chin-rest pose from reference 2. Clean smooth anime illustration, no pixel art texture. Keep face visible above and through the pale smoke, anatomically correct hands.
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
SCENE:
An adult Japanese woman (29, with a youthful idol-like look), concept cafe owner: long straight black hair with blunt bangs, green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept cafe dress with a large green ribbon and heart choker, small devil tail. Inside her cute concept cafe with soft mint-green and black decor, she holds a shisha hose mouthpiece and exhales a big soft billowing cloud of smoke tinted faintly pale mint green, winking playfully at the viewer through the drifting cloud, a small fang visible in her smile, a fresh sprig of mint and a glass of ice on the table. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, soft glowing light through the smoke, cheerful cool palette with warm highlights. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, modest framing.
COMPOSITION CORRECTION REQUIRED: she stands upright behind the cafe counter, torso in a three-quarter view, head held upright and tilted playfully, NO chin resting on a hand, NO cheek-touching hand, NO leaning elbow on the counter. One hand holds the mouthpiece at upper-chest level away from the mouth after exhaling; her other hand rests naturally on the counter beside the ice glass. A broad airy mint smoke cloud drifts sideways from her lips across the upper-left of frame. This must be a distinctly NEW pose, unlike reference 2. Cover the chest modestly with the reference dress neckline, no exaggerated cleavage.
```

### cand_3.png

```text
Use case: stylized-concept. Create ONE new title-screen illustration for scene 3. Reference 1 is canonical identity and costume; reference 2 supports face and costume details only. Match same adult woman, straight long black hair/blunt bangs, green eyes, small black horns, bat-wing clips, mint green frills and large green bow with gold-rimmed black heart, green heart choker. New composition at vintage wooden counter. NO shisha equipment, NO smoke, NO chin resting on hand. She is actively sipping soda through a straw and glancing upward at viewer. Costume should fit modestly with natural proportions. Clean smooth anime, no pixel texture.
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
SCENE:
An adult Japanese woman (29, with a youthful idol-like look), concept cafe owner: long straight black hair with blunt bangs, green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept cafe dress with a large green ribbon and heart choker. Summer afternoon, she sits at a retro wooden counter with a warm vintage kissaten atmosphere (old wood, amber glass lamp), sipping a bright green cream soda with a scoop of vanilla ice cream and a red cherry through a straw, looking up at the viewer with a sweet, mischievous upward glance, condensation on the tall glass. Sunlight through a window casting green-tinted light through the glass. Chest-up framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm summer light, nostalgic playful mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, modest framing.
```

### cand_4.png

```text
Use case: stylized-concept. Create ONE new title-screen illustration for scene 4. Both references show the SAME woman's canonical facial identity: preserve her recognizable face, long straight black hair with blunt bangs, adult proportions, green eyes (closed gently in this scene). References are ONLY for identity, NOT costume or setting here. Change completely into specified modest civilian outfit: beige cable-knit cardigan over simple top and dark long skirt. REMOVE ALL horns, bat wings, costume, heart choker, tail and hair ornaments. Age 29, calm adult woman. One hand tips small watering can over mint pot with visible water stream; OTHER hand delicately holds one mint leaf near nose, smelling it with eyes closed. Exactly TWO hands. New serene balcony scene. Clean smooth anime, no pixel texture.
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
SCENE:
A quiet, beautiful Japanese woman aged 29: long straight black hair with blunt bangs, green eyes, minimal makeup, no horns and no hair accessories, wearing a beige cable-knit cardigan over a simple top and a dark long skirt. Early morning on a small apartment balcony with potted herbs, soft sunlight, she waters a lush pot of mint with a small watering can, holding one mint leaf between her fingers near her nose, eyes gently closed, a calm, subtly relieved adult smile. Light breeze moving her hair, pale morning sky and soft blurred rooftops behind. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, serene everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_5.png

```text
Use case: stylized-concept. Create ONE new title-screen illustration for scene 5. Both reference images show same canonical woman: preserve recognizable facial identity, long straight black hair and blunt bangs, vivid green eyes. References are identity ONLY. Replace costume completely with modest civilian beige cable-knit cardigan over simple top, dark LONG skirt, simple shoulder bag. NO horns, NO bat wings, NO hair ornaments, NO heart choker, NO tail. Adult woman 29. NEW three-quarter BACK view of her walking away then looking back over shoulder toward viewer, thigh-up framing, paper grocery bag with mint bunches and lemons embraced in front and visible at side. Hair sways with movement. EMPTY Japanese roofed shopping arcade at warm dusk, no people besides her, absolutely no writing on lanterns/signs/bag. Calm subtly mature smile. Clean smooth anime, no pixel texture.
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
SCENE:
A quiet, elegant Japanese woman aged 29: long straight black hair with blunt bangs, green eyes, minimal makeup, no horns or bat-wing accessories, beige cable-knit cardigan, dark long skirt, a simple shoulder bag. Early evening in an empty, warmly lit Japanese shopping arcade, she walks holding a plain paper bag with fresh mint bunches and lemons peeking out, and glances back over her shoulder toward the viewer with a calm, quietly adult smile, hair swaying. Warm lantern light and soft bokeh of shopfronts with blank signs. Thigh-up to full-body framing, three-quarter back view turning, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm dusk lighting, gentle everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no readable signs, text, letters or logos.
```


