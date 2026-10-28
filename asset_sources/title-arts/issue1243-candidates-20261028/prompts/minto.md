# minto 生成プロンプト（Claude Opus 設計・DESIGN.md 抜粋）

## 共通スタイル指定

```
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

各プロンプトの末尾にも、上の要点（画風・2:3・一人だけ・文字なし・健全）を短くまとめて入れてあるので、プロンプト単体で生成できます。

---


## minto（みんと / 緑川 栞）

> 店での衣装と、私服（素の姿・ura）を使い分けています。どちらも「大人の女性」です。

### 1. ribbon_ready
- コンセプト: 開店前の小さな控えスペース。鏡の前でコウモリの羽の髪飾りを留め、キャストの顔に切り替わる瞬間の笑み。
- 狙い: 「客商売の魅せ方」を自分で作る戦略家の、舞台裏の凛々しさ。
- プロンプト:
```
An adult Japanese woman (29, with a youthful idol-like look), concept cafe owner: long straight black hair with blunt bangs, green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept cafe dress with a large green ribbon and a heart choker, a small devil tail. In a tiny backstage nook of her cafe PEPPERMINT before opening, warm vanity bulbs glowing, she stands in front of a mirror adjusting a bat-wing clip in her hair, turning her head toward the viewer with a confident, determined little smile showing a small fang, her reflection softly visible in the mirror. Chest-up to waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm vanity light, playful everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image (mirror reflection of herself only), no text, letters or logos, modest framing.
```

### 2. mint_cloud
- コンセプト: 店内で、ミントの淡い緑がかった大きな煙をふわっと吐き、煙越しにウインク。
- 狙い: 空間ごと飲み込むミントの煙という彼女の武器を、可愛さとして見せる。
- プロンプト:
```
An adult Japanese woman (29, with a youthful idol-like look), concept cafe owner: long straight black hair with blunt bangs, green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept cafe dress with a large green ribbon and heart choker, small devil tail. Inside her cute concept cafe with soft mint-green and black decor, she holds a shisha hose mouthpiece and exhales a big soft billowing cloud of smoke tinted faintly pale mint green, winking playfully at the viewer through the drifting cloud, a small fang visible in her smile, a fresh sprig of mint and a glass of ice on the table. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, soft glowing light through the smoke, cheerful cool palette with warm highlights. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, modest framing.
```

### 3. melon_cream_soda
- コンセプト: 夏の昼下がり、レトロな喫茶の名残があるカウンター席で、緑のクリームソーダをストローで飲みながら上目づかい。
- 狙い: 実家の純喫茶という店の来歴を、ミントグリーンの季節ものとして可愛く匂わせる。
- プロンプト:
```
An adult Japanese woman (29, with a youthful idol-like look), concept cafe owner: long straight black hair with blunt bangs, green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept cafe dress with a large green ribbon and heart choker. Summer afternoon, she sits at a retro wooden counter with a warm vintage kissaten atmosphere (old wood, amber glass lamp), sipping a bright green cream soda with a scoop of vanilla ice cream and a red cherry through a straw, looking up at the viewer with a sweet, mischievous upward glance, condensation on the tall glass. Sunlight through a window casting green-tinted light through the glass. Chest-up framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm summer light, nostalgic playful mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, modest framing.
```

### 4. balcony_mint
- コンセプト: 私服の朝。自宅ベランダで鉢植えのミントに水をやり、一枚つまんで香りを確かめる。
- 狙い: 角も羽もない「お姉さん」の静かな美しさと、ミントへの切実な愛着。
- プロンプト:
```
A quiet, beautiful Japanese woman aged 29: long straight black hair with blunt bangs, green eyes, minimal makeup, no horns and no hair accessories, wearing a beige cable-knit cardigan over a simple top and a dark long skirt. Early morning on a small apartment balcony with potted herbs, soft sunlight, she waters a lush pot of mint with a small watering can, holding one mint leaf between her fingers near her nose, eyes gently closed, a calm, subtly relieved adult smile. Light breeze moving her hair, pale morning sky and soft blurred rooftops behind. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, serene everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### 5. shotengai_stroll
- コンセプト: 夕方の商店街を私服で歩き、ミントの束とレモンの入った紙袋を抱えて、ふと振り返る。
- 狙い: 店の外で見せる控えめで大人びた微笑み。PEPPERMINT の「お姉さん」と同じ人だと気づく前の空気。
- プロンプト:
```
A quiet, elegant Japanese woman aged 29: long straight black hair with blunt bangs, green eyes, minimal makeup, no horns or bat-wing accessories, beige cable-knit cardigan, dark long skirt, a simple shoulder bag. Early evening in an empty, warmly lit Japanese shopping arcade, she walks holding a plain paper bag with fresh mint bunches and lemons peeking out, and glances back over her shoulder toward the viewer with a calm, quietly adult smile, hair swaying. Warm lantern light and soft bokeh of shopfronts with blank signs. Thigh-up to full-body framing, three-quarter back view turning, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm dusk lighting, gentle everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no readable signs, text, letters or logos.
```

---

