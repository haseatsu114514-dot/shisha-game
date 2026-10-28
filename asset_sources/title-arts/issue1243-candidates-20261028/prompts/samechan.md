# samechan 生成プロンプト（Claude Opus 設計・DESIGN.md 抜粋）

## 共通スタイル指定

```
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

各プロンプトの末尾にも、上の要点（画風・2:3・一人だけ・文字なし・健全）を短くまとめて入れてあるので、プロンプト単体で生成できます。

---


## samechan（サメちゃん / 波多野 なぎさ）

> 髪・目・パーカーの色は資料にないので、フードを深くかぶった形で固定しました。パーカーの色 `slate-gray` は仮です。既存の samechan アートがあれば参照画像として渡し、色はそちらに合わせてください。

### 1. smoke_ring
- コンセプト: SHISHARK のカウンターで、完璧な煙の輪をぽっと吐き、パペットのコロちゃんが下からそれを見上げている。
- 狙い: 得意のスモークトリックと、パペットとの「二人芝居」の可愛さ。
- プロンプト:
```
A 20-year-old Japanese young woman, owner of a shark-themed shisha shop: oversized slate-gray shark hoodie with the hood up and pulled low (the hood has a shark face with white fabric teeth along the brim, small fin on top), her hair mostly hidden under the hood, a shark-shaped hand puppet always worn on her RIGHT hand. Inside her cozy ocean-blue-lit shisha shop SHISHARK, she leans on the counter and puffs a perfect round smoke ring into the air, eyes proud, while the shark puppet on her right hand is tilted up as if watching the ring in amazement; a plain unglazed clay shisha bowl nearby. Soft aqua and warm lamp lighting. Chest-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle underwater-like ambient light, playful cozy mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### 2. throne_pose
- コンセプト: 店のソファにふんぞり返り、パペットを掲げて魔王のように高笑い。ギザ歯風の笑顔全開。
- 狙い: 尊大な魔王口調の「武装」したペルソナを、思いきり楽しく。
- プロンプト:
```
A 20-year-old Japanese young woman playing a demon-king persona: oversized slate-gray shark hoodie with the hood up (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, a shark-shaped hand puppet on her RIGHT hand. She lounges grandly on a big plush sofa in her shark-themed shisha shop SHISHARK, legs crossed, one arm spread along the sofa back, the shark puppet raised high on her right hand with its mouth wide open, laughing a theatrical villain laugh with a jagged, shark-tooth-style grin, dramatic but cute. Ocean-blue ambient light with soft spotlight from above, bubbles-and-wave decor. Full-body slightly low-angle framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, playful dramatic lighting, comedic cute mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere, modest framing.
```

### 3. shy_peek
- コンセプト: フードの縁をぎゅっと引き下げ、パペットの陰から真っ赤な顔でこちらをちらっと覗く。
- 狙い: 武装の奥にある極度の人見知り（素のなぎさ）がのぞく一瞬。
- プロンプト:
```
A 20-year-old shy Japanese young woman: oversized slate-gray shark hoodie with the hood up and pulled down low over her brow by her left hand (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, a shark-shaped hand puppet on her RIGHT hand held up in front of the lower half of her face like a shield. She peeks at the viewer from behind the puppet with wide, nervous eyes and deeply blushing cheeks, the puppet facing the viewer boldly in contrast. Soft cozy shop interior with aqua tones, warm window light, softly blurred background. Close chest-up framing, she dominates the vertical frame. Warm anime-style illustration, soft painterly cel shading, soft warm light, endearing shy mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### 4. blue_soda_pier
- コンセプト: 夏の海辺の桟橋に腰かけ、青いソーダ瓶を飲む。パペットも一緒に海を見ている。
- 狙い: ソーダ系の好みと海のモチーフを重ねた、明るい季節もの。
- プロンプト:
```
A 20-year-old Japanese young woman: oversized slate-gray shark hoodie with the hood up (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, sleeves pushed up for summer, shorts-length hoodie hem over simple knee-length shorts, sneakers, a shark-shaped hand puppet on her RIGHT hand. Bright summer afternoon, she sits on the edge of a wooden pier over sparkling turquoise sea, swinging her legs, drinking a bright blue soda from a plain unlabeled glass bottle in her left hand, the shark puppet on her right hand leaning toward the sea as if longing to swim; seagull-free clear sky with big white clouds. Full-body seated framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, bright summer light, refreshing happy mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### 5. rainy_puddle
- コンセプト: 雨上がりの路地で長靴を履き、水たまりにジャンプ。パペットが「泳いで」いるようにはしゃぐ。
- 狙い: 魔王でも人見知りでもない、20歳の無邪気さ。
- プロンプト:
```
A 20-year-old Japanese young woman: oversized slate-gray shark hoodie with the hood up (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, rain boots, a shark-shaped hand puppet on her RIGHT hand. Just after a rain shower on a quiet residential lane, she hops into a big puddle with a splash, droplets sparkling, the shark puppet on her right hand thrust forward as if diving and swimming through the air, she laughs with a jagged shark-tooth-style grin, cheeks pink. Clearing sky with soft sunlight breaking through clouds, reflections in the wet road. Full-body dynamic framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, fresh post-rain light, joyful playful mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

---

**既存アートとの重複チェック**
- **ひより**：既存の雨上がり・窓辺・夕方の散歩・本屋・ラーメンは避けました。
- **ましろ**：既存の「お茶休憩」と重ならないよう、紅茶はボウル詰めの場面の脇役にとどめました。
- **ミント**：既存の「閉店後」「私服・窓辺」とは、時間帯（開店前・朝）と場所（ベランダ・商店街）を変えています。
- **凛**：既存の「夜の試吸」と重ならないよう、香りの確認は昼の生葉で、吸う場面にはしていません。
- **つむぎ**：タブレットと夕方のスケッチは使っていません。
