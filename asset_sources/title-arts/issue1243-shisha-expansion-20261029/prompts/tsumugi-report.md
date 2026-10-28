# つむぎ タイトルアート追加候補 6〜8

- 生成日: 2026-10-28
- 方法: 内蔵 image_gen による参照画像付き新規生成。参照編集ではなく、場面ごとに新しい構図を指定。
- 参照: sprite_normal.webp（容姿・衣装）、titleart_ref.webp（顔立ち・衣装・色調）。参照ファイルと指示ファイルは変更していない。
- 容姿の優先順位: 一般記述のカーディガン／ワンピースより、参照画像の暗い茶黒色ボブ、赤茶色の瞳、花刺繍の紫ジップパーカー、黒のプリーツスカートを優先。指定の首掛けヘッドホンを追加。
- 全候補: PNG、1024 × 1536、縦横比2:3。リサイズ・トリミング・後処理なし。
- ファイル操作はこのフォルダ内のみ。生成ツール自身の既定キャッシュは自動的にフォルダ外へ作成される仕様で、その出力から納品先へコピーした。

| ファイル | 場面 | 生成方法 | サイズ | バイト数 | 再生成 | キャラ一貫性 /5 | 場面再現度 /5 |
| --- | --- | --- | --- | ---: | --- | ---: | ---: |
| cand_6.png | window_smoke_cat | 参照付き新規生成 | 1024×1536 | 2510496 | 1回 | 5 | 4 |
| cand_7.png | pencil_and_hose | 参照付き新規生成 | 1024×1536 | 2683869 | なし | 5 | 4 |
| cand_8.png | quiet_blend_preparation | 参照付き新規生成 | 1024×1536 | 2421466 | なし | 5 | 5 |

## 目視確認

### cand_6.png
初回は煙に猫の目・顔・胴体が明確に表れ、「自然な煙の偶然」という指定から逸脱したため不採用。1回の再生成で、目・顔・胴体をなくし、葉状の二股の煙と長い流れに変更した。人物右・器具左の新規構図。
最終版に顔の崩壊、明らかな手指異常、別人化、文字の混入は見られない。残る差異: 猫の連想は控えめで葉のようにも見える。ガラスベース左端が画面にわずかにかかり、煙は吐息よりボウル側から立つ表現に寄っている。

### cand_7.png
右手の鉛筆、左手のマウスピース、膝上の無地スケッチブック、無地画面タブレット、器具とつながるホースを確認。猫形の煙なし。
顔の崩壊、明らかな手指異常、別人化、文字の混入は見られない。残る差異: 指定のやや俯瞰した視点より正面寄り。ベースは濃青色の装飾ガラスで透明感が弱い。

### cand_8.png
一方の手で未加熱ボウルを支え、もう一方の手で細いピックを扱う。ブルーベリー、バニラの莢、ミント、別皿のラベンダー、待機中のシーシャ、閉じたスケッチブック、無地画面のタブレットを確認。
顔の崩壊、明らかな手指異常、別人化、文字の混入は見られない。軽微な差異: ピックの先端は最上層の直上というより葉材に触れる位置。表情は満足感より集中が強い。

## 使用プロンプト

以下は最終候補に使用した全文。共通の参照優先指定を各場面の原文に前置し、6番のみ再生成時の構図・煙の制約を末尾に追加した。

### 6

```text
Use case: illustration-story. Generate a NEW scene, vertical 2:3, 1024x1536. Both input images are character identity references, not composition templates. Strictly match Tsumugi's face, chin-length dark brown-black bob and straight bangs, reddish amber eyes, small ear stud, pale skin, and especially the loose deep purple zip-up hooded cardigan with delicate pink and yellow floral embroidery on sleeves, dark pleated skirt, black knee socks from the references. The generic cardigan/plain dress description below must be interpreted in accordance with these actual reference outfit features. Add headphones around neck as requested. Use clean warm anime linework and soft painterly cel shading, not pixel art. Create the specified entirely new staging. No text anywhere.

A 21-year-old Japanese art student, introverted and quiet: black bob-cut hair with bangs slightly covering her eyes while leaving her expression clearly readable, pale complexion, loose cardigan over a simple plain dress, headphones resting around her neck, with a sketchbook and tablet beside her.

She sits in her familiar window seat inside a cozy shisha lounge, quietly holding a connected hose mouthpiece near her lap after a gentle exhale. A complete hookah stands prominently on the small table immediately in front of her, its clear glass base, slender stem, bowl, and looping hose all visible. The lingering smoke rises beside the stem into a loose, fleeting suggestion of a cat with leaf-shaped ears and a flowing smoky tail. Keep this subtle pareidolia within natural translucent smoke: no solid animal, glowing eyes, cartoon outline, or separate creature. She pauses motionless with slightly parted lips, watching in absorbed wonder. Window light illuminates her readable face and the smoke without washing them out. Her closed sketchbook and tablet with a blank screen rest at the edge of the seat. Frame her large from the knees upward, with the hookah and smoke occupying substantial foreground space.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

CRITICAL COMPOSITION: camera faces the window seat from its right side, character seated on the RIGHT HALF looking LEFT at the hookah on the LEFT foreground. Her mouthpiece is down near lap, not chest or mouth. Do NOT copy the reference's left-character/right-hookah pose. Smoke must be overwhelmingly shapeless natural thin white wisps: just two tiny leaflike split wisps and one long curling trail might suggest ears and tail. Absolutely NO cat head, eyes, nose, whiskers, body, paws, recognizable animal anatomy, contour or illustration of a cat. Subtle ambiguous pareidolia only. Glass base fully visible.
```

### 7

```text
Use case: illustration-story. Generate a NEW scene, vertical 2:3, 1024x1536. Both input images are character identity references, not composition templates. Strictly match Tsumugi's face, chin-length dark brown-black bob and straight bangs, reddish amber eyes, small ear stud, pale skin, and especially the loose deep purple zip-up hooded cardigan with delicate pink and yellow floral embroidery on sleeves, dark pleated skirt, black knee socks from the references. The generic cardigan/plain dress description below must be interpreted in accordance with these actual reference outfit features. Add headphones around neck as requested. Use clean warm anime linework and soft painterly cel shading, not pixel art. Create the specified entirely new staging. No text anywhere.

A 21-year-old Japanese art student, introverted and quiet: black bob-cut hair with bangs slightly covering her eyes while leaving her expression clearly readable, pale complexion, loose cardigan over a simple plain dress, headphones resting around her neck, with a sketchbook and tablet.

In a warmly lit lounge reading nook, she sits diagonally in a comfortable chair with an open sketchbook supported on her lap. Her right hand guides a pencil over the page while her left hand loosely holds a hookah mouthpiece away from her face. She looks up from the page to study a long, naturally curling ribbon of recently exhaled smoke. The pencil's direction, the hose's broad arc, and the smoke's curve create a flowing visual rhythm. Keep all paper blank or softly blurred, with no legible marks; the act of drawing is communicated through her gesture. A complete hookah on a low table occupies the near foreground, with an unmistakable connection between its stem, hose, and her hand. Her tablet lies beside her with a blank screen. Use a slightly elevated three-quarter view showing her thoughtful face, both hands, lap, and the substantial glass base. No cat-shaped smoke in this scene.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

```

### 8

```text
Use case: illustration-story. Generate a NEW scene, vertical 2:3, 1024x1536. Both input images are character identity references, not composition templates. Strictly match Tsumugi's face, chin-length dark brown-black bob and straight bangs, reddish amber eyes, small ear stud, pale skin, and especially the loose deep purple zip-up hooded cardigan with delicate pink and yellow floral embroidery on sleeves, dark pleated skirt, black knee socks from the references. The generic cardigan/plain dress description below must be interpreted in accordance with these actual reference outfit features. Add headphones around neck as requested. Use clean warm anime linework and soft painterly cel shading, not pixel art. Create the specified entirely new staging. No text anywhere.

A 21-year-old Japanese art student, introverted and quiet: black bob-cut hair with bangs slightly covering her eyes while leaving her expression clearly readable, pale complexion, loose cardigan over a simple plain dress, headphones resting around her neck, with a sketchbook and tablet nearby.

Standing alone at the side of a cozy shisha shop's preparation counter, she carefully packs her own unheated bowl with a loose mixture of blueberry, vanilla, and mint flavored shisha tobacco. One hand steadies the bowl on the work surface while the other holds a fine packing pick just above the final layer. She leans slightly closer to appreciate the aroma, her expression quietly concentrated with a small trace of satisfaction. A lavender sprig rests separately on a ceramic saucer beside the bowl; it is a personal scent reference, not an ingredient inside the bowl. A few blueberries, a vanilla pod, and mint leaves sit outside the preparation dish as restrained visual flavor cues. A complete hookah waiting beside her makes the shisha context prominent. Her closed sketchbook and blank-screen tablet rest farther along the counter. Show her face and careful hands together in a close three-quarter composition; no instructor or additional hands appear.

Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing. Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

```

