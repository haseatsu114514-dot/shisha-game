# アダム タイトルアート生成レポート

- 作成日: 2026-10-28
- 参照: `sprite_normal.webp`。このフォルダに `titleart_ref.webp` はありませんでした。
- 方法: 組み込み image_gen による、参照画像付きの新規生成。各場面を個別に生成し、参照の立ち姿は流用していません。
- 全候補: PNG、1024×1536 px、縦横比 2:3。リサイズ・切り抜き・画像の後加工なし。
- 髪は画面左が赤、画面右が緑。角張った成人男性の顔立ち、太い眉、琥珀色の目（開眼時）、黒いヘンリーネックを参照。エプロンは場面3のみ指定どおり省略。
- 全5枚を生成後に個別に目視確認。明らかな顔崩壊、指の本数異常、別人化、読める文字の混入、人物の追加は確認されなかったため、再生成は行っていません。
- ファイル操作による成果物の保存・編集先は本フォルダのみ。参照画像・指示書・prompts.md は変更していません。ただし生成ツールは仕様上、生成物のキャッシュを `/home/hatch/.codex-a/generated_images/` に自動保存します。そこから本フォルダにコピーしています。

## 候補別の確認結果

自己評価は5段階（5が最良）。目視による主観評価です。

| ファイル | 場面 | 生成方法 | 生成サイズ | 再生成 | 明らかな破綻 | キャラの一貫性 | 場面の再現度 |
|---|---|---|---|---|---|---|---|
| cand_1.png | apple_market | 新規生成（容姿参照あり） | 1024×1536 | なし（初回採用） | なし | 4/5 | 5/5 |
| cand_2.png | eden_anise | 新規生成（容姿参照あり） | 1024×1536 | なし（初回採用） | なし | 5/5 | 4/5 |
| cand_3.png | sleepy_cinnamon_morning | 新規生成（容姿参照あり） | 1024×1536 | なし（初回採用） | なし | 4/5 | 5/5 |
| cand_4.png | sunset_proclamation | 新規生成（容姿参照あり） | 1024×1536 | なし（初回採用） | なし | 4/5 | 5/5 |
| cand_5.png | apple_juggle_grin | 新規生成（容姿参照あり） | 1024×1536 | なし（初回採用） | なし | 4/5 | 5/5 |

### cand_1.png
朝の無人の青果店、木箱のりんご、閉じた目と真剣な表情を確認。赤りんごは画面左、緑りんごは画面右で、それぞれ顔の近くに保持。手の指は果実で一部隠れますが、見える範囲に明らかな異常はありません。参照より髪のボリュームと柔らかい顔の印象がやや強めです。

### cand_2.png
静かなラウンジのカウンター、集中した琥珀色の目、指先の星形アニス、真鍮皿、陶製シーシャボウル、小型スケール、左右の赤・緑りんごを確認。スケールの表示は無地。アニスをつまむ手は皿の上方ですが、皿の真上から少しずれています。顔立ちは参照に特によく一致しています。

### cand_3.png
朝日の入る小さなキッチン、寝ぐせ、片目を閉じたあくび、シナモンスティックでかき混ぜるマグ、まな板のりんご片とシナモンを確認。エプロンなし。口を覆う手と飲み物をかき混ぜる手に明らかな指の異常はありません。背景の散らかりは控えめです。

### cand_4.png
夕焼けの屋上、少し見上げる太腿上の構図、画面左に掲げた赤りんご、胸に添えた左手、画面右のエプロンポケットの緑りんごを確認。肩に掛けたコートが風になびき、目を閉じて満足げに微笑んでいます。掲げた手とりんごは画像内に収まっています。

### cand_5.png
ブラインド越しの朝日、ラウンジ、開いた口の無邪気な笑顔、両手の上に浮いたりんごを確認。空中の赤りんごは画面左、緑りんごは画面右。両手は開いた状態で、各手の5本の指を確認できます。参照の硬い表情より柔らかく若々しく見えますが、髪・目・衣装・顔の特徴を維持しています。

## 実際に使用したプロンプト

prompts.md の共通スタイルと各場面の英文全文を使用し、参照画像の役割、容姿の固定条件、サイズおよび必要な構図条件を補足しました。以下が各生成に渡した全文です。

### cand_1.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.


A 28-year-old Japanese man with an eccentric but lovable face, short hairstyle split down the middle in two colors: the half on HIS OWN RIGHT side is red-apple red and the half on HIS OWN LEFT side is green-apple green, so in this front-facing view the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). He wears a black Henley shirt and a waist apron. Morning at an empty outdoor fruit stand with wooden crates of red and green apples (no people, no price tags or signs). Facing the viewer, he holds a red apple in his right hand on screen-left and a green apple in his left hand on screen-right, bringing them near his nose with eyes closed in serious, almost reverent concentration. Soft morning light. Waist-up front view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, calm everyday atmosphere. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos anywhere.


Input image is the sole character identity reference, not the composition. Match precisely his angular adult face, sharp amber eyes, thick dark eyebrows, athletic build, swept center-part red screen-left and leaf-green screen-right hair, small loose strands, black three-button Henley with pushed-up sleeves and tied black waist apron. New composition per scene above, no copied standing sprite layout. Render one finished portrait image at 1024x1536.
```

### cand_2.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.


A 28-year-old Japanese man, double apple shisha specialist: short hairstyle split down the middle in two colors, HIS OWN RIGHT half red-apple red and HIS OWN LEFT half green-apple green, so facing the viewer the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). Black Henley shirt with sleeves pushed up, waist apron. Inside his modern, softly lit shisha lounge EDEN, standing behind the counter facing the viewer, he holds a single star anise between his fingertips above a small brass dish, a clay shisha bowl and a tiny scale in front of him, a red apple on the screen-left side of the counter and a green apple on the screen-right side. His usual theatrical grin is gone: quiet, intensely focused eyes. Warm lamp light, soft bokeh shelves of plain unlabeled tins. Chest-up to waist-up front view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm low light, calm mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos.


Input image: character identity reference only. Preserve his angular adult Japanese face, sharp amber eyes, thick dark eyebrows, athletic physique, swept center-part red screen-left / leaf-green screen-right hair, black three-button Henley with pushed-up sleeves, tied black waist apron. New scene composition as specified; don't copy sprite pose. One finished 1024x1536 portrait. Tiny scale must have no readable digits, blank dark display. Exactly one intact star anise pinched naturally between thumb and index finger.
```

### cand_3.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.


A 28-year-old Japanese man at home in the morning: short hair messy with bed head, split down the middle in two colors, HIS OWN RIGHT half red-apple red and HIS OWN LEFT half green-apple green, so facing the viewer the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). Wearing a slightly rumpled black Henley shirt, no apron. In a slightly cluttered small apartment kitchen, sunlight through the window, he faces the viewer while stirring a mug of warm apple drink with a cinnamon stick, mid-yawn with one eye squeezed shut, apple slices and a few cinnamon sticks on a cutting board. Lovable, unguarded private-life vibe. Waist-up front view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, gentle morning light, cozy everyday mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos anywhere.


Input image is character identity reference only. Preserve his angular adult face, sharp amber eyes, thick dark eyebrows, athletic physique, red screen-left / leaf-green screen-right center-part hair, black three-button Henley. Change hair to morning bedhead, no apron as scene requires. Brand new kitchen composition and yawning action, not sprite layout. One finished portrait 1024x1536. His visible open eye is amber. Stir with one cinnamon stick; natural correctly formed hands.
```

### cand_4.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.


A 28-year-old Japanese man with a dramatic, self-styled persona, playful confidence: short hairstyle split down the middle in two colors, HIS OWN RIGHT half red-apple red and HIS OWN LEFT half green-apple green, so facing the viewer the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). Black Henley shirt, waist apron, a long dark coat over his shoulders billowing in the wind. On a rooftop at golden sunset, facing the viewer, he holds a shining red apple raised high in his right hand on screen-left, his left hand pressed theatrically to his chest, a green apple tucked in his apron pocket on screen-right, eyes closed with a grand, blissful smile. Warm orange-pink sky, soft lens flare, wind. Thigh-up front view, slight low angle, heroic but comedic. Warm anime-style illustration, soft painterly cel shading, warm sunset glow, lighthearted mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos anywhere.


Input image is sole character identity reference only. Match angular adult face, thick dark eyebrows, athletic build, swept center-part red screen-left and leaf-green screen-right hair; same black three-button Henley and tied black waist apron. Add dark coat draped over shoulders per scene. Entire raised hand AND red apple must be visible inside the top edge, thigh-up heroic/comedic composition, eyes closed blissful smile. Green apple visibly tucked into screen-right apron pocket, left hand over chest. New rooftop scene, not reference sprite pose. One finished portrait 1024x1536.
```

### cand_5.png

```text
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.


A 28-year-old Japanese man, eccentric but lovable: short hairstyle split down the middle in two colors, HIS OWN RIGHT half red-apple red and HIS OWN LEFT half green-apple green, so facing the viewer the SCREEN-LEFT half is red and the SCREEN-RIGHT half is green (never blue). Black Henley shirt, waist apron. Before opening in his modern shisha lounge, daylight through blinds, he faces the viewer and playfully tosses apples: a red apple in mid-air above his right hand on screen-left and a green apple above his left hand on screen-right, a boyish, genuinely happy open-mouthed grin. A few loose red and green apples in a bowl on the counter behind him. Waist-up front view, he fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, soft striped daylight, cheerful everyday mood. Vertical 2:3 portrait 1024x1536, only this one man in the image, no text, letters or logos anywhere.


Input image: sole character identity reference only, not pose or composition. Match angular adult face, amber eyes, thick dark eyebrows, athletic build, swept center-part red screen-left / leaf-green screen-right hair, same black three-button Henley with pushed-up sleeves and tied black waist apron. Both hands open naturally underneath flying apples, exactly two airborne apples: red screen-left, green screen-right, separated clearly from fingers. Genuine boyish open-mouthed happy grin while retaining adult facial identity. New lounge scene as described, striped daylight. One finished portrait 1024x1536.
```

