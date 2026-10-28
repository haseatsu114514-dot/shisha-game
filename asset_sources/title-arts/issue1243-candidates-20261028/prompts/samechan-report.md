# samechan 画像生成レポート

生成日: 2026-10-28

## 方法・参照

- 内蔵 image_gen を使用。5場面とも、sprite_normal.webp と titleart_ref.webp を容姿参照として添付した新規生成。既存画像の部分編集・合成・拡大縮小は行っていない。
- 参照優先: 黒髪とコバルトブルーの差し色・青い瞳・小さなサメ髪留め・黒/青/白のフード衣装・金属飾りを保持。prompts.md の仮色 slate-gray は参照色に置換した。フードの歯形は場面プロンプトに従って追加。
- 右手のサメパペットは、参照の青いサメ、白い腹、金の王冠、青い蝶ネクタイと金の星を継承。
- 画風はピクセル表現ではなく、指定の暖かなアニメ調・柔らかい塗り。全候補で人物は1人、読める文字・ロゴ・透かしなし。
- 納品先はこのフォルダ直下。全画像は PNG、1024×1536、縦横比2:3。画像自体の後加工・形式変換は不要だった。
- ツールが自動保存する生成物をこのフォルダへコピーした。フォルダ外への手動書き込み・既存ファイルの変更は行っていない。

## 候補別の目視確認

評価は5段階（5が最良）。顔・手・腕脚・衣装・文字混入・場面を確認した。右手は人物自身の右を指す。

| ファイル | 場面 | 生成方法 | サイズ | 再生成 | 最終画像の破綻・指定との差 | キャラ一貫性 | 場面再現度 |
|---|---|---|---|---|---|---|---|
| cand_1.png | smoke_ring | 参照付き新規生成 | 1024×1536 | なし | 明らかな顔・手指の破綻なし。カウンター、煙の輪、右手で見上げるパペット、素焼きボウルを確認。輪の周囲にも煙が漂う。 | 5/5 | 5/5 |
| cand_2.png | throne_pose | 参照付き新規生成 | 1024×1536 | なし | 明らかな破綻なし。脚を組んだ全身寄りの低い視点、掲げた右手パペット、笑顔を確認。左腕は背もたれ付近に広げているが、参照由来のシーシャ吸い口も持つ。靴が下端に近い。 | 5/5 | 4/5 |
| cand_3.png | shy_peek | 参照付き新規生成 | 1024×1536 | なし | 明らかな破綻なし。左手でフードを引き、右手パペットで口元を隠し、赤面してこちらを覗く。目の開きは「wide」より控えめ。 | 5/5 | 4/5 |
| cand_4.png | blue_soda_pier | 参照付き新規生成 | 1024×1536 | 1回 | 初回は瓶が口から離れ、ショーツが短かったため再生成。最終版で瓶が唇に接して飲む動作を確認。顔・手指に明らかな破綻なし。ただしショーツは指定の膝丈に届かず太腿丈。パペットも海より手前向き。 | 5/5 | 4/5 |
| cand_5.png | rainy_puddle | 参照付き新規生成 | 1024×1536 | 1回 | 初回の左手は指の分離・本数が不自然に見えたため再生成。最終版は左手を閉じた拳にし、明らかな手指の破綻は見られない。右手パペット、長靴、水たまりへのジャンプと飛沫を確認。 | 5/5 | 5/5 |

再生成は4・5のみ各1回、合計7回生成。最終版を cand_4.png / cand_5.png に採用した。残る指定との差は上表のとおり。候補1〜3は初回画像をそのまま採用。

## 最終プロンプトセット

以下の「容姿固定指示」＋「共通スタイル」＋各番号の「場面指示」を連結して使用した。
初回は場面の前に Scene 番号ラベルを付与。4・5の再生成では末尾に各補正指示を追加した。
元の prompts.md は変更していない。

### 容姿固定指示（全候補共通）

```text
Use case: illustration-story. Create a NEW scene, using both attached images ONLY as character identity and costume references, never reusing their pose/composition. Reference 1 sprite_normal.webp is the primary identity reference; reference 2 titleart_ref.webp corroborates colors and details, but do NOT reproduce its pixel texture or seated composition. Keep her recognizable: adult 20-year-old Japanese woman, short wavy black hair with vivid cobalt-blue streaks and blue curled ends, bright blue eyes, small turquoise shark hairclip, small sharp canine teeth. Black oversized shark hooded jacket with ivory hood border, blue hood lining, blue dorsal fins, blue straps, silver buckles and little silver cross/charm ornaments; cream high-neck inner top; blue-edged black pleated skirt and dark tights where appropriate. Match reference palette instead of the placeholder slate-gray. Hood UP in every image, keep bangs and face readable. Her anatomical RIGHT hand (usually viewer-left when front facing) wears a BLUE shark hand puppet with white belly, black round eyes, triangular teeth, small GOLD CROWN, dark-blue bow tie and gold star; it is a puppet, not another person. Left hand performs other actions. Preserve modest framing, no cleavage emphasis. Scene instructions below override reference pose. For summer scene use specified knee-length shorts, pushed-up sleeves and sneakers; for rainy scene rain boots. Generate exactly one image, 1024x1536 portrait 2:3. Absolutely NO text, letters, numbers, signatures or watermarks. Exactly one human. Reference clothing cross-shaped ornaments are allowed.
```

### 共通スタイル

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

### cand_1.png 場面指示

```text
A 20-year-old Japanese young woman, owner of a shark-themed shisha shop: oversized slate-gray shark hoodie with the hood up and pulled low (the hood has a shark face with white fabric teeth along the brim, small fin on top), her hair mostly hidden under the hood, a shark-shaped hand puppet always worn on her RIGHT hand. Inside her cozy ocean-blue-lit shisha shop SHISHARK, she leans on the counter and puffs a perfect round smoke ring into the air, eyes proud, while the shark puppet on her right hand is tilted up as if watching the ring in amazement; a plain unglazed clay shisha bowl nearby. Soft aqua and warm lamp lighting. Chest-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle underwater-like ambient light, playful cozy mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_2.png 場面指示

```text
A 20-year-old Japanese young woman playing a demon-king persona: oversized slate-gray shark hoodie with the hood up (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, a shark-shaped hand puppet on her RIGHT hand. She lounges grandly on a big plush sofa in her shark-themed shisha shop SHISHARK, legs crossed, one arm spread along the sofa back, the shark puppet raised high on her right hand with its mouth wide open, laughing a theatrical villain laugh with a jagged, shark-tooth-style grin, dramatic but cute. Ocean-blue ambient light with soft spotlight from above, bubbles-and-wave decor. Full-body slightly low-angle framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, playful dramatic lighting, comedic cute mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere, modest framing.
```

### cand_3.png 場面指示

```text
A 20-year-old shy Japanese young woman: oversized slate-gray shark hoodie with the hood up and pulled down low over her brow by her left hand (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, a shark-shaped hand puppet on her RIGHT hand held up in front of the lower half of her face like a shield. She peeks at the viewer from behind the puppet with wide, nervous eyes and deeply blushing cheeks, the puppet facing the viewer boldly in contrast. Soft cozy shop interior with aqua tones, warm window light, softly blurred background. Close chest-up framing, she dominates the vertical frame. Warm anime-style illustration, soft painterly cel shading, soft warm light, endearing shy mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_4.png 場面指示

```text
A 20-year-old Japanese young woman: oversized slate-gray shark hoodie with the hood up (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, sleeves pushed up for summer, shorts-length hoodie hem over simple knee-length shorts, sneakers, a shark-shaped hand puppet on her RIGHT hand. Bright summer afternoon, she sits on the edge of a wooden pier over sparkling turquoise sea, swinging her legs, drinking a bright blue soda from a plain unlabeled glass bottle in her left hand, the shark puppet on her right hand leaning toward the sea as if longing to swim; seagull-free clear sky with big white clouds. Full-body seated framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, bright summer light, refreshing happy mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

再生成時の追加指示:

```text
CRITICAL SCENE DETAILS: wear modest KNEE-LENGTH SHORTS reaching just above knees, NOT short shorts or a skirt. The plain blue soda bottle neck MUST touch her lips as she is actively drinking. Both feet in sneakers visible, seated on pier. Right hand puppet turned toward sea.
```

### cand_5.png 場面指示

```text
A 20-year-old Japanese young woman: oversized slate-gray shark hoodie with the hood up (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, rain boots, a shark-shaped hand puppet on her RIGHT hand. Just after a rain shower on a quiet residential lane, she hops into a big puddle with a splash, droplets sparkling, the shark puppet on her right hand thrust forward as if diving and swimming through the air, she laughs with a jagged shark-tooth-style grin, cheeks pink. Clearing sky with soft sunlight breaking through clouds, reflections in the wet road. Full-body dynamic framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, fresh post-rain light, joyful playful mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

再生成時の追加指示:

```text
CRITICAL ANATOMY: her LEFT hand is a small relaxed CLOSED FIST held out to balance the jump, with natural knuckles and one thumb; do not draw spread fingers. Correct two arms and two legs. Her RIGHT hand remains INSIDE shark puppet, thrust forward. Black and blue waterproof RAIN BOOTS, puddle jumping splash.
```

