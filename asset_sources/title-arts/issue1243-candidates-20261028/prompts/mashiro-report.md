# mashiro 画像生成レポート

- 生成日: 2026-10-28
- 使用ツール: 組み込み image_gen（CLI/API フォールバック不使用）。
- 生成方法: 全候補とも、2枚の参照画像を入力した新規生成。参照画像そのものの部分編集ではなく、各場面の構図・ポーズを新しく生成した。
- 参照: sprite_normal.webp を容姿・衣装の主参照、titleart_ref.webp を顔立ちの補助参照として毎回指定。
- 出力: 全5枚 PNG、1024×1536 px、縦横比 2:3。サイズ変更・切り抜き・画像加工なし。
- 確認: 各画像を生成後に個別に目視確認。PNGシグネチャ・寸法も確認。
- 評価尺度: 1（低い）〜5（高い）。自己評価であり、完全一致を保証するものではない。

| 候補 | 場面 | 方法 | 生成サイズ | 再生成 | 明らかな破綻 | キャラ一貫性 | 場面再現度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cand_1.png | sunny_nap | 参照付き新規生成 | 1024×1536 | なし | 見当たらず | 5/5 | 5/5 |
| cand_2.png | dark_leaf_pack | 参照付き新規生成 | 1024×1536 | なし | 見当たらず | 5/5 | 5/5 |
| cand_3.png | rooftop_dusk_yawn | 参照付き新規生成 | 1024×1536 | なし | 見当たらず | 5/5 | 4/5 |
| cand_4.png | cherry_petals | 参照付き新規生成 | 1024×1536 | なし | 見当たらず | 5/5 | 5/5 |
| cand_5.png | scared_of_rumor | 参照付き新規生成 | 1024×1536 | なし | 見当たらず | 5/5 | 4/5 |

## 個別の確認所見

1. **cand_1.png**: 窓辺のソファに身体を丸め、袖に頬を預けた昼寝。二本の三つ編み、ほぼ閉じた目、柔らかな微笑、日差しと浮遊する光の粒を確認。顔・手足の明らかな崩れ、文字、他人物は見当たらない。袖の中の指は見えないため本数の直接確認対象外。
2. **cand_2.png**: 暖色の店内カウンターで、黒く湿った葉を陶製ボウルに指で詰める動作。葉の小皿・紅茶・まくった袖・集中した金色の目を確認。見える両手の指に明らかな本数異常や融合は見当たらない。文字や他人物なし。
3. **cand_3.png**: 東京らしい高層建物を背にした屋上、夕焼け、風になびく二本の三つ編みとスカート、袖で覆ったあくびと閉じた目を確認。腰掛け姿勢で、指定の thigh-up よりスカートを広く見せる構図。風による裾の浮きより、布の流れとして表現されている。解剖学的な明らかな破綻、文字や他人物なし。
4. **cand_4.png**: 桜並木を見上げる半開きの口と眠たげな目、前髪・三つ編みに付いた花びら、袖に包まれた手を確認。春の淡い光とセージ色の衣装が調和。顔や見える指の明らかな崩れ、文字や他人物なし。
5. **cand_5.png**: 木製ドアの陰から恐る恐る覗く姿、開いた金色の目、汗粒、暖かな店内と青い夕景、背後の煙を確認。胸元の手はカーディガン前を明確に握るというより、三つ編み付近に添える形になっており、この点は指定との差分。見える両手に明らかな指の異常、文字、他人物・他人物の影は見当たらない。

全候補とも別人化に相当する明らかな容姿の逸脱は見当たらず、指定の明らかな破綻を理由とする再生成は行っていない。参照画像・INSTRUCTIONS.md・prompts.md は変更していない。

## 最終使用プロンプト

各候補には、以下の共通補足、prompts.md の共通スタイル全文、対応する場面プロンプト全文を順に連結して使用した。参照画像2枚は毎回同じ順序で添付。透明背景は指定していない。

### 共通の参照・容姿指定

```text
Use case: stylized-concept. Generate ONE finished title-screen illustration, portrait 2:3, 1024x1536. Both attached images are character identity references ONLY, not composition templates. Image 1 sprite_normal.webp is the primary identity and clothing reference; image 2 titleart_ref.webp supports face identity. Match her pale ash-blonde slightly sage hair, blunt soft bangs and face-framing side locks, exactly TWO thick long braids with small dark ties, sleepy golden eyes, rounded delicate face; oversized beige cable-knit button cardigan, white ruffled-neck blouse with thin white tied ribbon, high-waisted long sage skirt, brown loafers. Preserve this exact character identity. Use a NEW scene and pose as specified below; do not copy the seated hookah-smoking reference pose. Clean anime linework and soft painterly cel shading, no pixel/dither texture from reference 2. Exactly one adult woman. No text, letters, numbers, signatures, logos, watermarks, additional people, or human silhouettes. Modest wholesome framing, accurate hands and anatomy.
```

### 共通スタイル

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

### cand_1.png — SCENE 1

```text
A 22-year-old Japanese woman, gently sleepy same-age peer: pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt, brown shoes. Afternoon break in a cozy small shisha shop in Tokyo, she has dozed off curled on a sofa in a patch of warm sunlight, cheek resting on her cardigan sleeve, braids draped over her shoulder, eyes nearly closed with a soft contented smile. Gentle sunbeams and floating dust motes. Full-body to waist-up framing angled so she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm afternoon sunlight, peaceful drowsy mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_2.png — SCENE 2

```text
A 22-year-old Japanese woman: pale ash-blonde hair in two long braids with soft bangs, half-lidded golden eyes that are quietly sharp and focused now, beige oversized knit cardigan with sleeves pushed up over a white blouse with a small ribbon, long sage-green skirt. At the counter of a small, warm Tokyo shisha shop, she carefully packs dark, moist, almost black shisha leaf into a clay bowl with slender fingers, a small dish of the dark leaf beside her, a teacup of black tea pushed to the side. Low warm lamplight, deep wood tones. Chest-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm low light, calm skilled mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos, containers unlabeled.
```

### cand_3.png — SCENE 3

```text
A 22-year-old Japanese woman: pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt, brown shoes. On a small building rooftop at dusk with a soft hazy Tokyo skyline behind (no readable signs), the wind lifting her braids and skirt hem gently, she covers a big yawn with her cardigan sleeve, eyes squeezed into happy sleepy crescents. Pink-orange sky fading to lavender. Thigh-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm dusk glow, relaxed easygoing mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_4.png — SCENE 4

```text
A 22-year-old Japanese woman: pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt, brown shoes. Spring afternoon under a row of blooming cherry trees, petals drifting, a few petals resting on her braids and bangs unnoticed, she gazes up at the branches with a soft, dreamy, slightly open-mouthed smile, hands tucked in her cardigan sleeves. Gentle pastel sky. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, soft spring sunlight, pink and sage pastel palette, gentle calm mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_5.png — SCENE 5

```text
A 22-year-old Japanese woman: pale ash-blonde hair in two long braids with soft bangs, golden eyes wide open for once with nervous worry, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt. Evening at the doorway of a small Tokyo shisha shop, she peeks timidly around the edge of the wooden door, clutching the cardigan front with one hand, shoulders hunched, a sweat drop of comic anxiety, as if afraid of a scary rumored stranger outside; a faint lingering wisp of heavy smoke drifting behind her inside the warmly lit shop. Waist-up framing, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm interior light against cool evening outside, lighthearted comedic mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no figures or shadows of others, no text, letters or logos.
```

