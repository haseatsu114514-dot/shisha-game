# rin 生成プロンプト（Claude Opus 設計・DESIGN.md 抜粋）

## 共通スタイル指定

```
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

各プロンプトの末尾にも、上の要点（画風・2:3・一人だけ・文字なし・健全）を短くまとめて入れてあるので、プロンプト単体で生成できます。

---


## rin（凛 / 匂坂 凛）

> 眼鏡はルート進行者だけが見られる深夜の姿なので、今回の5場面はすべて眼鏡なし（コンタクト）にしました。

### 1. sign_here
- コンセプト: 薄暗いショールームで、クリップボードとペンをこちらへ差し出し「サイン、しておく?」とからかうように微笑む。
- 狙い: 「問屋街の魔女」らしい危うさと、大人の余裕。
- プロンプト:
```
A 27-year-old Japanese woman: very dark long wolf-cut hair with subtle slate-blue undertones, ending below the bust and above the waist, thick sweeping bangs and cheek-hugging layers, mature languid half-lidded blue-gray eyes, a subtle cool smile, no glasses, silver hoop earrings, clear unpainted nails, white shirt with rolled sleeves and a clean collar, black slacks. In a dim wholesale showroom with black-filmed windows and shelves of unlabeled flavor tins, she leans slightly toward the viewer, holding out a clipboard with a blank form and a pen, head tilted, teasing knowing smile as if inviting the viewer to sign. Soft cool ambient light with a warm key light on her face. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, moody but gentle lighting, elegant adult mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere, modest framing.
```

### 2. nose_check
- コンセプト: 1階の売り場の棚の前で、表記のない銀袋を開け、葉の香りを目を閉じて確かめる。
- 狙い: 「商材は全部、自分の鼻と肺で確かめる」プロの真剣さ。
- プロンプト:
```
A 27-year-old Japanese woman, flavor importer: very dark long wolf-cut hair with subtle slate-blue undertones, ending below the bust and above the waist, thick sweeping bangs and cheek-hugging layers, half-lidded blue-gray eyes, no glasses, silver hoop earrings, clear unpainted nails, white shirt with rolled sleeves and clean collar, black slacks. Daytime on the ground floor of a wholesale shisha supply shop, shelves of plain unlabeled tins and boxes behind her softly blurred, she opens a plain silver foil pouch and brings it close, eyes closed, inhaling the aroma of the dark moist leaf inside with calm, serious concentration, hair falling forward slightly. Soft daylight from the side. Chest-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, soft natural light, focused professional mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, all packaging blank, no text, letters or logos.
```

### 3. blueberry_break
- コンセプト: 昼休み、ビルの外階段に腰かけて生のブルーベリーをパックからつまむ。気を抜いた素の顔。
- 狙い: 結局ブルーベリーに帰ってくる、という好物設定の可愛げ。
- プロンプト:
```
A 27-year-old Japanese woman: very dark long wolf-cut hair with subtle slate-blue undertones, ending below the bust and above the waist, thick sweeping bangs and cheek-hugging layers, relaxed half-lidded blue-gray eyes, no glasses, silver hoop earrings, clear unpainted nails, white shirt with rolled sleeves, black slacks. Midday break, she sits on an outdoor metal staircase of an old building in a wholesale district, holding a small plain carton of fresh blueberries on her knee and popping one into her mouth, eyes softened in a genuine, slightly crinkled smile. Bright sky, soft shadows, a light breeze in her hair. Full-body seated framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, bright gentle daylight, relaxed everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere, modest framing.
```

### 4. sample_box_alley
- コンセプト: 昼の問屋街の路地を、海外から届いたサンプルの段ボールを抱えて歩き、ちらりと振り返る。
- 狙い: 仕事人としての颯爽さと、街に馴染んだ「魔女」の存在感。
- プロンプト:
```
A 27-year-old Japanese woman: very dark long wolf-cut hair with subtle slate-blue undertones, ending below the bust and above the waist, thick sweeping bangs and cheek-hugging layers, half-lidded blue-gray eyes, subtle cool smile, no glasses, silver hoop earrings, white shirt with rolled sleeves, black slacks. Afternoon in a narrow old wholesale-district alley with stacked crates and shop shutters, all signs blank, she walks carrying a plain cardboard box against her hip and glances back over her shoulder at the viewer with a languid, amused look, hair swaying. Warm afternoon sunlight cutting between buildings. Thigh-up to full-body three-quarter back view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm sunlight and soft shadows, cool confident everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no readable signs, text, letters or logos.
```

### 5. rainy_neon_umbrella
- コンセプト: 雨の夕暮れ、黒フィルムの窓の店先で透明傘を差し、濡れた路面にネオンが滲む。
- 狙い: 季節（梅雨〜秋雨）の湿った空気が、気だるげな色気と似合う。
- プロンプト:
```
A 27-year-old Japanese woman: very dark long wolf-cut hair with subtle slate-blue undertones, ending below the bust and above the waist, thick sweeping bangs and cheek-hugging layers, half-lidded blue-gray eyes, subtle cool smile, no glasses, silver hoop earrings, white shirt with rolled sleeves under a long dark trench coat worn open, black slacks. Rainy early evening in front of a shop with black-filmed windows, she stands under a clear umbrella, raindrops on its surface, looking slightly down toward the viewer with a calm, faintly amused gaze; wet pavement reflecting soft blurred neon glows in purple and teal mixed with warm streetlight. Thigh-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle rainy atmosphere with soft neon bokeh, quiet adult mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no readable signs, text, letters or logos.
```

---

