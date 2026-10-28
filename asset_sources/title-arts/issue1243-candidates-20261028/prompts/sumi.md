# sumi 生成プロンプト（Claude Opus 設計・DESIGN.md 抜粋）

## 共通スタイル指定

```
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

各プロンプトの末尾にも、上の要点（画風・2:3・一人だけ・文字なし・健全）を短くまとめて入れてあるので、プロンプト単体で生成できます。

---


## sumi（スミさん / 墨田 丈一郎）

### 1. morning_charcoal
- コンセプト: 開店前の tonari。朝日の差すカウンターで炭を並べ、ヒーターの火を見守る。
- 狙い: 師匠の「基本に忠実」な仕事の背中を、朝の静かな光で見せる。
- プロンプト:
```
A 46-year-old Japanese man, shisha shop owner and seasoned mentor: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with sleeves rolled to the forearms, brown waist apron, black trousers and black shoes. Early morning before opening inside a small wooden shisha bar called tonari, pale golden sunlight slanting through the window across the counter. He stands behind the counter arranging cubes of coconut charcoal on a small electric heater with metal tongs, calm focused eyes behind his glasses, faint dust motes and a thin wisp of heat shimmer in the light. Three-quarter view, waist-up to thigh-up framing, he fills most of the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, quiet everyday atmosphere. Vertical 2:3 portrait 1024x1536, he is the only person in the image, no text, letters or logos anywhere, all jars and boxes unlabeled.
```

### 2. mentor_lesson
- コンセプト: カウンター越しに「見てろ」とボウルの穴あけを実演し、こちら（弟子目線）に少しだけ笑う。
- 狙い: 寡黙な師匠のまれな笑みと、確かな手つき。
- プロンプト:
```
A 46-year-old Japanese man, shisha shop owner and mentor: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with sleeves rolled up, brown waist apron. Viewer's point of view across a warm wooden counter in a small cozy shisha bar: he leans slightly forward, demonstrating how to poke neat holes in foil over a clay shisha bowl with a thin pick, and glances up at the viewer with a rare, small, warm knowing smile, as if saying "watch closely". His forearms and hands are clearly drawn and skillful. Warm amber pendant light from above, soft bokeh of shelves behind him. Chest-up to waist-up framing, slight low angle, he dominates the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle warm lighting, calm everyday mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos, all containers unlabeled.
```

### 3. cardamom_kitchen
- コンセプト: 休日、自宅の小さな台所でカルダモンの莢を乳鉢で潰し、鍋のチャイの香りを確かめる。
- 狙い: 好物カルダモンを軸にした「店の外の顔」。エプロンを外した生活感。
- プロンプト:
```
A 46-year-old Japanese man at home on his day off: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with sleeves rolled up, no apron, black trousers. In a small, lived-in home kitchen with afternoon sunlight, he crushes green cardamom pods in a stone mortar and pestle, eyes half-closed as he breathes in the aroma, a small pot of spiced milk tea steaming on the stove beside him, a few loose cardamom pods scattered on the wooden counter. Relaxed, contented expression. Waist-up three-quarter view, he fills most of the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm afternoon light and soft steam, cozy everyday atmosphere. Vertical 2:3 portrait 1024x1536, he is the only person in the image, no text, letters or logos, jars and packets unlabeled.
```

### 4. winter_doorstep
- コンセプト: 冬の夕暮れ、tonariの戸口に立ち、湯気の立つマグを手に通りを眺める。店内の灯りが背中から漏れる。
- 狙い: 季節の冷たさと、店の温かさを一人で背負う「地元の師匠」の佇まい。
- プロンプト:
```
A 46-year-old Japanese man, shisha shop owner: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with sleeves rolled down for the cold, brown waist apron, a dark knit scarf loosely around his neck, black trousers and shoes. Winter dusk, light snow just beginning to fall, he stands in the open wooden doorway of his small local shisha bar, leaning on the door frame, holding a steaming mug in both hands, breath visible, gazing calmly down the quiet street with a faint easy smile. Warm orange light spills from inside the shop behind him, cool blue twilight outside. Full-body to thigh-up framing, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm-cool contrast lighting, peaceful seasonal mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no shop sign text, no letters or logos anywhere.
```

### 5. own_clay_bowl
- コンセプト: 閉店後のカウンターで、自分専用の素焼きハガル（ボウル）を布で磨く。脇には切ったレモン。
- 狙い: 元世界大会ファイナリストの、静かな矜持と道具への愛着。
- プロンプト:
```
A 46-year-old Japanese man, former world-class shisha player turned local shop owner: black newsboy cap over short messy black hair, square black-framed glasses, thick brows, full short black beard, healthy tan skin, charcoal shirt with rolled sleeves, brown waist apron. Late at night after closing, the small shisha bar is dim except for one low warm lamp over the counter. He sits on a stool polishing his own well-worn unglazed terracotta shisha bowl with a soft cloth, looking at it with quiet, nostalgic pride; a halved fresh lemon on a small plate beside him. Soft shadows, gentle glow on his glasses. Waist-up three-quarter view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, low warm lamplight, calm reflective mood. Vertical 2:3 portrait 1024x1536, he is the only person in the image, no text, letters or logos anywhere.
```

---

