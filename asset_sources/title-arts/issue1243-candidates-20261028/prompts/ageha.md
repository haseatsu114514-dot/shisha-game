# ageha 生成プロンプト（Claude Opus 設計・DESIGN.md 抜粋）

## 共通スタイル指定

```
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

各プロンプトの末尾にも、上の要点（画風・2:3・一人だけ・文字なし・健全）を短くまとめて入れてあるので、プロンプト単体で生成できます。

---


## ageha（あげは / 宵野 葉子）

> 「無理な大人っぽさ」を禁じる資料の指示に沿って、全プロンプトで若々しい顔を保つ指定を入れています。

### 1. morning_hands
- コンセプト: 開店前の MELTY PUFF。朝日の中で自分の手を開いたり閉じたりし、感覚を確かめて小さく安堵する。
- 狙い: 主人公だけが知る秘密の気配。明るいギャルの奥の、静かな強さ。
- プロンプト:
```
A 22-year-old Japanese woman with a bright, friendly, youthful face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink heart crop top, black pleated skirt, thigh-high stockings, black choker and a gold heart necklace; no heavy makeup. Morning before opening at her shisha shop MELTY PUFF, soft sunlight pouring through the window, she sits alone on a stool by the counter, holding her hand up into the light and slowly flexing her fingers, watching them with a quiet, serious expression that turns into a small relieved smile. Peaceful dust motes in the light. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, tender quiet mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, modest framing.
```

### 2. gummy_light
- コンセプト: 白と赤のグミベアを指でつまんで光にかざし、片目をつむってにっこり。
- 狙い: 好物を全力で可愛がる「カワイイは最強」のギャル魂。
- プロンプト:
```
A 22-year-old Japanese woman, cheerful approachable gyaru with a youthful face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink heart crop top, black choker and gold heart necklace; no heavy makeup. Bright pastel-lit corner of a cute shisha lounge, she holds up a translucent white gummy bear and a red gummy bear between her fingertips toward the light, one eye closed in a playful wink, big happy grin, colorful soft reflections on her cheek, an open plain candy bag in her other hand. Chest-up close framing, she dominates the vertical frame. Warm anime-style illustration, soft painterly cel shading, bright soft light, poppy cheerful mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, candy bag plain.
```

### 3. tropical_cut
- コンセプト: カウンターでマンゴーやパイナップルを切りながら、勘で「これだ!」と笑い出す。
- 狙い: 得意のトロピカル系と、理屈じゃなくバイブスで作る天才肌。
- プロンプト:
```
A 22-year-old Japanese woman, intuitive genius shisha player with a youthful friendly face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink heart crop top, black pleated skirt, black choker and gold heart necklace; no heavy makeup. Behind the counter of a cheerful shisha shop, a cutting board with sliced mango, pineapple and halved passion fruit, she holds a piece of mango up, laughing with a joyful closed-eye smile as if she just found the perfect idea, juice glistening, a clay shisha bowl nearby. Warm sunny light. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm bright light, energetic happy mood, juicy tropical colors. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, modest framing.
```

### 4. crepe_walk
- コンセプト: 夕方の街角でいちごクレープを頬張り、頬をふくらませたまま満面の笑み。
- 狙い: 読者モデルの顔ではない、22歳の等身大の休日。
- プロンプト:
```
A 22-year-old Japanese woman with a bright, youthful, friendly face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket over a pink heart crop top, black pleated skirt, thigh-high stockings, black choker and gold heart necklace; no heavy makeup. Early evening on an empty city street with soft bokeh shop lights (all signs blank), she walks holding a strawberry-and-cream crepe, one cheek puffed from a big bite, eyes squeezed shut in a joyful closed-eye smile, a dab of cream on her lip. Warm golden-hour light. Thigh-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm evening glow, carefree everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no readable signs, text, letters or logos, modest framing.
```

### 5. winter_lights
- コンセプト: 冬のイルミネーションの並木道。ジャケットの前を閉め、両手でホットドリンクを持って白い息で笑う。
- 狙い: 季節もの。きらめく光とハニーブロンドの相性。
- プロンプト:
```
A 22-year-old Japanese woman with a bright, youthful, friendly face: amber eyes, soft cheeks, small nose, short gentle chin, honey-blonde twin ponytails with pink and cream bear hair clips, leopard-print jacket zipped up against the cold, black pleated skirt, thigh-high stockings, black choker and gold heart necklace; no heavy makeup. Winter night on a tree-lined avenue covered in warm golden fairy-light illuminations, no other people, she holds a paper cup of hot drink in both hands near her face, breath visible, smiling warmly at the viewer with rosy cheeks, soft sparkling bokeh all around. Waist-up framing, she dominates the vertical frame. Warm anime-style illustration, soft painterly cel shading, glowing warm illumination against deep blue night, cozy festive mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, cup plain, no text, letters or logos.
```

---

