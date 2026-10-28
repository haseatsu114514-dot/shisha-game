# adam 生成プロンプト（Claude Opus 設計・DESIGN.md 抜粋）

## 共通スタイル指定

```
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

各プロンプトの末尾にも、上の要点（画風・2:3・一人だけ・文字なし・健全）を短くまとめて入れてあるので、プロンプト単体で生成できます。

---


## adam（アダム / 吾妻 大夢）

> 髪の左右の色は全プロンプトで「正面寄りの構図」に固定し、りんごも同じ側（画面左＝赤、画面右＝緑）に揃えました。

### 1. apple_market
- コンセプト: 朝の青果店の店先で、りんごを一つずつ鼻に近づけ、目を閉じて香りを聞き比べる（人はいない）。
- 狙い: 変人ぶりの裏の「一つの味を掘り下げる」本物の職人性。
- プロンプト:
```
A 28-year-old Japanese man with an eccentric but lovable face, short hairstyle split down the middle in two colors: the half on HIS OWN RIGHT side is red-apple red and the half on HIS OWN LEFT side is green-apple green, so in this front-facing view the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). He wears a black Henley shirt and a waist apron. Morning at an empty outdoor fruit stand with wooden crates of red and green apples (no people, no price tags or signs). Facing the viewer, he holds a red apple in his right hand on screen-left and a green apple in his left hand on screen-right, bringing them near his nose with eyes closed in serious, almost reverent concentration. Soft morning light. Waist-up front view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, calm everyday atmosphere. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos anywhere.
```

### 2. eden_anise
- コンセプト: EDEN のカウンターで星形のアニスを指先でつまみ、静かに配合を量る。ふだんの演技を忘れた真顔。
- 狙い: 芝居がかった男が見せる、仕事中だけの静けさのギャップ。
- プロンプト:
```
A 28-year-old Japanese man, double apple shisha specialist: short hairstyle split down the middle in two colors, HIS OWN RIGHT half red-apple red and HIS OWN LEFT half green-apple green, so facing the viewer the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). Black Henley shirt with sleeves pushed up, waist apron. Inside his modern, softly lit shisha lounge EDEN, standing behind the counter facing the viewer, he holds a single star anise between his fingertips above a small brass dish, a clay shisha bowl and a tiny scale in front of him, a red apple on the screen-left side of the counter and a green apple on the screen-right side. His usual theatrical grin is gone: quiet, intensely focused eyes. Warm lamp light, soft bokeh shelves of plain unlabeled tins. Chest-up to waist-up front view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm low light, calm mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos.
```

### 3. sleepy_cinnamon_morning
- コンセプト: 自宅の朝、寝ぐせ頭のまま、りんごとシナモンの温かい飲み物を作りながら大あくび。
- 狙い: 資料にある「少し散らかった私生活感」。アダムを名乗る前の素の人間味。
- プロンプト:
```
A 28-year-old Japanese man at home in the morning: short hair messy with bed head, split down the middle in two colors, HIS OWN RIGHT half red-apple red and HIS OWN LEFT half green-apple green, so facing the viewer the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). Wearing a slightly rumpled black Henley shirt, no apron. In a slightly cluttered small apartment kitchen, sunlight through the window, he faces the viewer while stirring a mug of warm apple drink with a cinnamon stick, mid-yawn with one eye squeezed shut, apple slices and a few cinnamon sticks on a cutting board. Lovable, unguarded private-life vibe. Waist-up front view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, cozy everyday mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos anywhere.
```

### 4. sunset_proclamation
- コンセプト: 夕焼けの屋上、片手を胸に、もう片手でりんごを空へ掲げて「ダブルアップルこそ宇宙の原点」と言い放つ決めポーズ。
- 狙い: ローランド風の過剰な自己演出が「愛すべき変人」として一番映える場面。
- プロンプト:
```
A 28-year-old Japanese man with a dramatic, self-styled persona, playful confidence: short hairstyle split down the middle in two colors, HIS OWN RIGHT half red-apple red and HIS OWN LEFT half green-apple green, so facing the viewer the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). Black Henley shirt, waist apron, a long dark coat over his shoulders billowing in the wind. On a rooftop at golden sunset, facing the viewer, he holds a shining red apple raised high in his right hand on screen-left, his left hand pressed theatrically to his chest, a green apple tucked in his apron pocket on screen-right, eyes closed with a grand, blissful smile. Warm orange-pink sky, soft lens flare, wind. Thigh-up front view, slight low angle, heroic but comedic. Warm anime-style illustration, soft painterly cel shading, warm sunset glow, lighthearted mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos anywhere.
```

### 5. apple_juggle_grin
- コンセプト: EDEN の開店前、赤と緑のりんごを片手ずつ放り上げて遊ぶ。少年みたいな笑顔。
- 狙い: 自己演出ではなく、本気で好きなものに無邪気な瞬間。温度感の柔らかい一枚。
- プロンプト:
```
A 28-year-old Japanese man, eccentric but lovable: short hairstyle split down the middle in two colors, HIS OWN RIGHT half red-apple red and HIS OWN LEFT half green-apple green, so facing the viewer the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). Black Henley shirt, waist apron. Before opening in his modern shisha lounge, daylight through blinds, he faces the viewer and playfully tosses apples: a red apple in mid-air above his right hand on screen-left and a green apple above his left hand on screen-right, a boyish, genuinely happy open-mouthed grin. A few loose red and green apples in a bowl on the counter behind him. Waist-up front view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, soft striped daylight, cheerful everyday mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos anywhere.
```

---

