# sumi 画像生成レポート

- 生成日: 2026-10-28
- 使用ツール: 組み込み image_gen（imagegen スキル、CLI 未使用）。
- 方法: 全候補とも sprite_normal.webp を容姿参照として入力した新規場面生成。既存立ち絵の構図は流用せず、各場面の動作・背景・構図を新規生成した。
- 参照画像: sprite_normal.webp。titleart_ref.webp はこのフォルダに存在しないため未使用。
- 容姿の固定点: 黒いキャスケット、短い乱れた黒髪、黒い角眼鏡、濃い眉、褐色寄りの肌、口ひげと顎・輪郭の短い黒ひげ、チャコールのボタンシャツ。腰エプロンは 1・2・4・5 のみ。
- 納品: cand_1.png ～ cand_5.png。全て実ファイルの PNG ヘッダで 1024×1536、縦横比 2:3 を確認。サイズ変更・トリミング・形式変換なし。
- 入力の INSTRUCTIONS.md、prompts.md、sprite_normal.webp は変更していない。
- 保存に関する注記: 成果物は全てこのフォルダ直下。生成ツールは自動で管理領域にも画像を保存するため、そこからこのフォルダへコピーした。管理領域への保存はツールの自動動作であり、フォルダ外の既存ファイルへの手動編集は行っていない。

## 候補ごとの確認結果

評価は各5段階（5が最高）。各画像の生成直後に、容姿・顔・手指・道具・人数・文字混入を目視確認した。道具で隠れた指を含め、すべての指の厳密な可視確認を保証するものではない。

| ファイル | 場面 | 生成方法 | 生成サイズ | 再生成 | 明らかな破綻 | キャラ一貫性 | 場面再現度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cand_1.png | morning_charcoal | 容姿参照付き新規生成 | 1024×1536 | なし（初回採用） | 目視で認めず | 5/5 | 5/5 |
| cand_2.png | mentor_lesson | 容姿参照付き新規生成 | 1024×1536 | なし（初回採用） | 目視で認めず | 5/5 | 5/5 |
| cand_3.png | cardamom_kitchen | 容姿参照付き新規生成 | 1024×1536 | なし（初回採用） | 目視で認めず | 5/5 | 4/5 |
| cand_4.png | winter_doorstep | 容姿参照付き新規生成 | 1024×1536 | なし（初回採用） | 目視で認めず | 5/5 | 4/5 |
| cand_5.png | own_clay_bowl | 容姿参照付き新規生成 | 1024×1536 | なし（初回採用） | 目視で認めず | 5/5 | 5/5 |

### 1. morning_charcoal

朝日が斜めに差す木の店内で、金属トングで立方体の炭を電気ヒーター上に並べる場面。集中した目線、巻いた袖、茶色の腰エプロンを確認。顔と両手に明らかな崩れはなく、人物は一人。読める文字やロゴは見当たらない。

### 2. mentor_lesson

カウンター越しにこちらを見て小さく笑い、粘土製ボウルのアルミ箔へ細いピックで穴を開けている。片手で道具、もう片手でボウルを支える配置を確認。眼鏡・ひげ・髪型と服装の特徴を維持。明らかな顔・手指の破綻、他人物、文字混入は見当たらない。

### 3. cardamom_kitchen

自宅の台所で石の乳鉢と乳棒を使い、緑のカルダモンを潰す。脇のコンロには湯気の立つミルクティーの鍋があり、エプロンは着けていない。明らかな顔・手指の破綻や文字混入は見当たらない。指定の「半目」より目を閉じた表情に寄っているため、場面再現度は4。香りを楽しむ意図は伝わる。

### 4. winter_doorstep

戸口に寄りかかり、両手で一つのマグを持って青い夕暮れの通りへ目を向ける。袖を下ろしたシャツ、濃色ニットのマフラー、茶色の腰エプロン、暖かな店内と寒色の外の対比を確認。明らかな顔・手指の破綻、他人物、文字混入は見当たらない。「雪が降り始めた」指定より既存の積雪が多く、足先も画面下端で一部切れる。場面再現度は4。

### 5. own_clay_bowl

閉店後の暗い店内でスツールに座り、使い込んだ素焼きのシーシャボウルを布で磨いている。手元の道具への穏やかな視線、低い暖色ランプ、小皿の半切りレモンを確認。明らかな顔・手指の破綻、他人物、文字混入は見当たらない。

## 実際に使用したプロンプト

以下は各呼び出しの全文。共通スタイルと prompts.md の該当場面を保持し、参照容姿の固定と場面固有の注意点を追記した。全呼び出しで参照画像に sprite_normal.webp を指定し、背景透過は無効とした。

### cand_1.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

A 46-year-old Japanese man, shisha shop owner and seasoned mentor: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with sleeves rolled to the forearms, brown waist apron, black trousers and black shoes. Early morning before opening inside a small wooden shisha bar called tonari, pale golden sunlight slanting through the window across the counter. He stands behind the counter arranging cubes of coconut charcoal on a small electric heater with metal tongs, calm focused eyes behind his glasses, faint dust motes and a thin wisp of heat shimmer in the light. Three-quarter view, waist-up to thigh-up framing, he fills most of the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, quiet everyday atmosphere. Vertical 2:3 portrait 1024x1536, he is the only person in the image, no text, letters or logos anywhere, all jars and boxes unlabeled.

Use the provided sprite_normal.webp as a strict character identity reference, not a composition reference. Match his specific angular face, black rectangular glasses, warm dark brown eyes, eyebrows, short messy black hair under black newsboy cap, connected short mustache and jaw/chin beard, tan skin and charcoal button-up shirt and brown waist apron exactly. Create an entirely new scene and pose according to the scene prompt. A finished single portrait image, 1024x1536 pixels. No contact sheet.
```

### cand_2.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

A 46-year-old Japanese man, shisha shop owner and mentor: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with sleeves rolled up, brown waist apron. Viewer's point of view across a warm wooden counter in a small cozy shisha bar: he leans slightly forward, demonstrating how to poke neat holes in foil over a clay shisha bowl with a thin pick, and glances up at the viewer with a rare, small, warm knowing smile, as if saying "watch closely". His forearms and hands are clearly drawn and skillful. Warm amber pendant light from above, soft bokeh of shelves behind him. Chest-up to waist-up framing, slight low angle, he dominates the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle warm lighting, calm everyday mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos, all containers unlabeled.

Use sprite_normal.webp as strict identity reference only; create a new composition. Match his angular face, rectangular black glasses, dark brown eyes, black newsboy cap, messy black hair, connected short mustache and chin/jaw beard, tan skin, charcoal button-up and brown waist apron. He holds a thin pick over taut foil stretched across a clay shisha bowl, other hand stabilizes the bowl. No speech or typography. One finished 1024x1536 portrait.
```

### cand_3.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

A 46-year-old Japanese man at home on his day off: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with sleeves rolled up, no apron, black trousers. In a small, lived-in home kitchen with afternoon sunlight, he crushes green cardamom pods in a stone mortar and pestle, eyes half-closed as he breathes in the aroma, a small pot of spiced milk tea steaming on the stove beside him, a few loose cardamom pods scattered on the wooden counter. Relaxed, contented expression. Waist-up three-quarter view, he fills most of the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm afternoon light and soft steam, cozy everyday atmosphere. Vertical 2:3 portrait 1024x1536, he is the only person in the image, no text, letters or logos, jars and packets unlabeled.

Use sprite_normal.webp as strict character identity reference only; create an entirely new scene and pose, not the sprite composition. Match his specific angular face, rectangular black glasses, warm dark brown eyes, black newsboy cap, messy black hair, connected short mustache and chin/jaw beard, tan skin and rolled-sleeve charcoal button-up shirt. IMPORTANT: in this home scene REMOVE the apron completely, show charcoal shirt and black trousers, no waist apron. His one hand grips a stone pestle crushing green cardamom, the other steadies the mortar. His eyes relaxed half closed, enjoying aroma; steaming milk tea pot visible beside him on stove. One finished 1024x1536 portrait.
```

### cand_4.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

A 46-year-old Japanese man, shisha shop owner: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with sleeves rolled down for the cold, brown waist apron, a dark knit scarf loosely around his neck, black trousers and shoes. Winter dusk, light snow just beginning to fall, he stands in the open wooden doorway of his small local shisha bar, leaning on the door frame, holding a steaming mug in both hands, breath visible, gazing calmly down the quiet street with a faint easy smile. Warm orange light spills from inside the shop behind him, cool blue twilight outside. Full-body to thigh-up framing, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm-cool contrast lighting, peaceful seasonal mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no shop sign text, no letters or logos anywhere.

Use sprite_normal.webp as strict character identity reference only; create an entirely new scene, viewpoint and pose. Match his specific angular face, rectangular black glasses, dark brown eyes, black newsboy cap, messy black hair, connected short mustache and jaw/chin beard, tan skin, charcoal button-up shirt and brown waist apron. This winter scene requires shirt sleeves rolled DOWN to wrists and a loosely wrapped dark knit scarf. He leans on the open wood doorframe, holds ONE steaming mug with BOTH hands, head turned calmly toward empty snowy street. Show him from cap to thighs or full body, single person, warm interior behind and cool blue winter dusk outside. No signage. One finished 1024x1536 portrait.
```

### cand_5.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

A 46-year-old Japanese man, former world-class shisha player turned local shop owner: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with rolled sleeves, brown waist apron. Late at night after closing, the small shisha bar is dim except for one low warm lamp over the counter. He sits on a stool polishing his own well-worn unglazed terracotta shisha bowl with a soft cloth, looking at it with quiet, nostalgic pride; a halved fresh lemon on a small plate beside him. Soft shadows, gentle glow on his glasses. Waist-up three-quarter view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, low warm lamplight, calm reflective mood. Vertical 2:3 portrait 1024x1536, he is the only person in the image, no text, letters or logos anywhere.

Use sprite_normal.webp as strict character identity reference only; create an entirely new scene and pose. Match his specific angular face, rectangular black glasses, dark brown eyes, black newsboy cap, messy black hair, connected short mustache and chin/jaw beard, tan skin, charcoal button-up shirt with rolled sleeves and brown waist apron. He is clearly seated on a stool behind counter, shown waist-up three-quarter view. His hands carefully polish a small well-worn UNGLAZED terracotta shisha bowl using a soft cloth, his gaze at the bowl with quiet nostalgic pride. The clay bowl is recognizably a hookah bowl, not a teacup. One halved fresh lemon on a small plate beside him. Night, dim shop with ONE low warm lamp illuminating counter, quiet soft shadows. No extra people, no text. One finished 1024x1536 portrait.
```


