# ひより 画像生成レポート

生成日: 2026-10-28（UTC）

## 方法と共通確認

- 使用ツール: 組み込み `image_gen`。5場面をそれぞれ独立して新規生成（参照画像付き）。参照画像そのものへの描き足し・構図流用ではない。
- 全候補で `sprite_normal.webp` と `titleart_ref.webp` の両方を容姿参照に使用。赤みのある茶髪、前髪、琥珀色の目、顔立ちを重視。候補1・2はレースブラウスと黒スラックスも参照し、候補3〜5は場面指定の衣装を優先した。
- 全画像は PNG、1024×1536 px、縦横比2:3。サイズ変更・切り抜き・画像加工なし。
- 各候補を個別に目視確認。全画像で人物1名、読める文字・ロゴ・透かしの混入なし。顔の崩壊、明らかな指の増減、明らかな別人化は認めなかった。見えない指は断定していない。
- 再生成は全候補なし（各1回の生成を採用）。
- 入力の指示文・プロンプト・参照画像は変更していない。成果物はこのフォルダ直下に保存した。なお生成サービスはツール管理領域にも原本を自動保存する仕様であり、その原本から本フォルダへコピーした。手動の編集・保存先は本フォルダのみ。

## 候補別評価

評価は5段階（5が最良）の目視による自己評価。

| ファイル | 場面 | 生成方法 | サイズ | 再生成 | 明らかな破綻 | キャラ一貫性 | 場面再現度 |
|---|---|---|---|---|---|---|---|
| cand_1.png | axe_night | 新規生成・参照2枚 | 1024×1536 | なし | なし | 5/5 | 4/5 |
| cand_2.png | rooftop_peach_lunch | 新規生成・参照2枚 | 1024×1536 | なし | なし | 5/5 | 4/5 |
| cand_3.png | riverside_hoodie | 新規生成・参照2枚 | 1024×1536 | なし | なし（手の一部は画面上端） | 5/5 | 4/5 |
| cand_4.png | earl_grey_tart | 新規生成・参照2枚 | 1024×1536 | なし | なし | 5/5 | 4/5 |
| cand_5.png | tonari_student_days | 新規生成・参照2枚 | 1024×1536 | なし | なし | 4/5 | 4/5 |

### cand_1.png

白いレースブラウス、黒パンツ、長いポニーテールを維持。投げ終えた腕、飛ぶ斧、木製標的とレーン、全開の笑顔を確認。斧が大きく前景にあり、投擲方向の奥行きはやや誇張されている。前足先は画面下端で切れる。手指に明らかな本数異常は見当たらない。

### cand_2.png

屋上ベンチ、都市の遠景、両手の桃と口元、脇の黒いバッグを確認。桃にはかじり跡があり幸福感は出ているが、指定の「目を大きく開いて輝かせる」より目を細めた笑顔。明らかな手指の異常は見当たらない。

### cand_3.png

黒い大きめのパーカー、カーゴパンツ、スニーカーで河川敷を歩きながら伸びをする全身構図。閉じた目と大きな笑顔、なびくポニーテールを確認。片腕を曲げてもう一方の腕を伸ばすポーズで、上げた手の一部が上端にかかるため、その指すべての本数は確認できない。明らかな増指や腕の接続異常は見当たらない。

### cand_4.png

クリーム色のニットと淡色カーディガン、口元の紅茶カップ、手前の桃タルト、窓際の午後光を確認。下がり眉とタルト側への視線は出ているが、隠し切れない興奮のきらめきは控えめ。紅茶の種類がアールグレイかどうかは外観だけでは判別できない。

### cand_5.png

ポニーテールなし、黒Tシャツとエプロン、トレイと水のグラス、カウンターと背景のシーシャ器具を確認。明るい接客の笑顔と暖色の回想の雰囲気を再現。後ろ髪は肩付近だが、顔周りの巻き髪は胸元まであり、指定の肩丈よりやや長い。20歳への若返りも控えめ。手はトレイに隠れる部分があるが明らかな異常は見当たらない。

## 使用プロンプト

以下の共通補足、`prompts.md` の共通スタイル全文、各候補に対応する場面プロンプト全文を、この順で連結して使用した。候補ごとの場面の前には `SCENE 1:`〜`SCENE 5:` を付けた。参照画像2枚は毎回別途入力した。

### 共通補足（実際の投入文）

```
Use case: illustration-story. Generate ONE new title-screen key illustration, vertical portrait 2:3, 1024x1536. Both supplied images are character identity references, NOT composition templates. Match Hiyori's face and reddish dusty rose-brown hair, airy bangs and long curled sidelocks, amber brown eyes, soft adult facial features, hair volume and coloration precisely. For scenes 1-4 preserve the high long wavy ponytail tied with a thin black tie; scene 5 intentionally has shoulder-length loose hair. Follow scene-specific clothing and pose over reference pose/clothing where explicitly different. Do not reproduce the reference street setting or ear-touching pose. No pixel art or dithering. 
```

### 共通スタイル（実際の投入文）

```
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.
```

### cand_1.png

```
SCENE 1:
A 25-year-old Japanese woman: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, white-ivory lace blouse with a small stand collar and short French sleeves, black slacks, black loafers, no bag, no ID badge or lanyard. At an indoor axe-throwing venue with wooden lanes and a round wooden target board (no text or numbers), she has just released a throw, one arm extended forward, ponytail swinging, the axe flying toward the target, her face lit up with a huge, unguarded, delighted grin, energetic healthy posture. Warm industrial lighting with wood tones. Full-body to thigh-up dynamic three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm lighting, fun energetic mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_2.png

```
SCENE 2:
A 25-year-old Japanese office worker: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, white-ivory lace blouse with a small stand collar and short French sleeves, black slacks, black loafers, no ID badge or lanyard. Lunch break on a quiet office building rooftop under a clear sky, sitting on a bench, she bites into a ripe white peach held in both hands, eyes sparkling wide with pure happiness, cheeks round, a little juice on her fingers, a small black handbag beside her. Bright midday light, soft city skyline blurred behind. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, bright gentle daylight, cheerful everyday mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_3.png

```
SCENE 3:
A 25-year-old Japanese woman on her day off: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, black oversized hoodie, cargo pants, sneakers, boyish casual style. Fresh weekend morning on a grassy riverside embankment, sparkling river and soft blue sky, she stretches both arms high overhead mid-stride, eyes squeezed shut, laughing loudly with an open-mouthed carefree grin, ponytail bouncing in the breeze. Clear morning sunlight. Full-body three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, bright fresh morning light, energetic refreshing mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

### cand_4.png

```
SCENE 4:
A 25-year-old Japanese woman: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, wearing a soft cream knit sweater under a light cardigan, gently feminine outfit. In a cozy cafe with warm wood and soft afternoon light, she holds a teacup of Earl Grey tea elegantly near her lips, trying to pose with a wistful, melancholic downcast expression and slightly lowered brows, but her eyes are sneaking sideways toward a glossy peach tart on the table, sparkling with barely hidden excitement. Comedic charming duality. Chest-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm afternoon light, gentle playful mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no menus with text, no letters or logos.
```

### cand_5.png

```
SCENE 5:
A 20-year-old Japanese university student in a nostalgic flashback: reddish pink-brown medium-length hair (shoulder length, NOT a ponytail), light bangs, bright brown eyes, soft friendly face, plain black T-shirt with a staff apron. Inside a small, warm wooden local shisha bar called tonari, she stands behind the counter holding a small tray with a glass of water, giving the viewer a bright, energetic, open smile, as if greeting a regular. Warm amber lamp light with a soft nostalgic haze and slightly sun-faded colors. Waist-up three-quarter view, she fills the vertical frame. Warm anime-style illustration, soft painterly cel shading, warm nostalgic lighting, cheerful memory mood. Vertical 2:3 portrait 1024x1536, she is the only person in the image, no text, letters or logos anywhere.
```

