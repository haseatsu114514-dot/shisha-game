# エピローグCG・告白CG・タイトル絵 原画台帳（Issue #3286）

Codex 内蔵画像生成で作成した原画を無加工で保存。ゲーム本編への組み込みはオーナー採用後。CG は横長の生成原寸、タイトル絵は 1024×1536。不透明 PNG。

## 共通の依頼文（D1〜D9）

以下は Issue #3286 の原文。各 D1〜D9 の場面ブロックの先頭に付けて生成した。役割ラベルと検品時の修正指示を追加した試行もある。

```text
Create one finished visual novel event CG for the Japanese shisha-bar romance game "Suien Zensen -EN:CODE-". Opaque landscape 16:9, 1920x1080 or larger. Japanese 2D anime illustration in the same hand as the attached approved event CG: clean confident outlines, cel shading with two or three clearly shaped shadow steps, warm cinematic light, a detailed painted background; not 3D, not photographic, no airbrush skin gloss, no glow or sparkles. The heroine must be exactly the same person as her attached approved sprite: same face design, eye shape and color, hair, age and build; do not drift toward a generic pretty face. This is a first-person scene seen through the eyes of the protagonist Hajime: never show his face; at most his hand, sleeve, shoulder or his back (short black hair, black zip hoodie). Put the heroine's face and the important hands within the top 65% of the image, because a dialogue window covers the bottom 25%. No text, letters, numbers, logos, UI, borders or watermark; any paper, sign or screen is blank or unreadable. No hookah or shisha equipment anywhere.
```

## D1 `cg_minto_epilogue.png`

- 生成回数: 2 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/minto/chr_minto_ura_normal.png`
  - 本人・笑顔: `assets/sprites/character_variants/new/minto/chr_minto_ura_smile.png`
  - 画風と同一人物: `assets/cgs/cg_minto_confession.png`
- 検品メモ: 栞さんの部屋の背景 `bg_shiori_room_night.png` は生成時点の main 未採用。場所は原文の描写を使用。初回は主人公の顎が写ったため修正。

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the epilogue of Shiori's route. Late at night after she closed her concept cafe, in her small tidy apartment, the two of them cooked a late dinner together. Shiori (her private self: long straight black hair with blunt bangs, green eyes, a beige cable-knit cardigan over a simple blouse and a long skirt; NO concept-cafe costume, NO horns or wings) stands at the small kitchen counter beside the viewer. She has just handed the viewer a small tasting plate (the viewer's hand holds it at the lower right) and now leans her forehead gently against the viewer's shoulder, eyes closed, a tired, relieved little smile, as if saying "I worked hard today... spoil me a little". Warm pendant light, a pot on the stove with a little steam, two plates ready, a pot of mint by the dark window, classic white coffee cups with a thin green rim on a shelf. Quiet, intimate and grown-up.
```

## D2 `cg_tsumugi_epilogue.png`

- 生成回数: 2 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/tsumugi/chr_tsumugi_normal.png`
  - 本人・笑顔: `assets/sprites/character_variants/new/tsumugi/chr_tsumugi_smile.png`
  - 画風と同一人物: `assets/cgs/cg_tsumugi_confession.png`
  - 場所: `assets/backgrounds/bg_tonari_inside_night.png`

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the epilogue of Tsumugi's route. After Hajime's shift at the shisha cafe tonari, late evening, the shop is quiet. The viewer sits at a small table; on it lies Tsumugi's closed sketchbook. Tsumugi (21, petite, brown bob with straight bangs, reddish-brown eyes, small earrings, oversized purple zip hoodie with floral embroidery on the sleeves) sits across the table and gently places the viewer's hand on top of the closed sketchbook with both of her small hands over it, looking up shyly with a small, determined smile, as if saying "the next page... you can't look yet. Today I'll take a break from drawing". A pencil rests beside the sketchbook. Behind her, tonari's irregular Turkish mosaic pendant lamps glow in mixed colors, dark wood and green seating. Warm, quiet, tender.
```

## D3 `cg_ageha_epilogue.png`

- 生成回数: 2 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/ageha/chr_ageha_normal.png`
  - 本人・笑顔: `assets/sprites/characters/ageha/chr_ageha_smile.png`
  - 画風と同一人物: `assets/cgs/cg_ageha_confession.png`
- 検品メモ: あげはの部屋の背景 `bg_ageha_room_night.png` は生成時点の main 未採用。場所は原文の描写を使用。顔・目・輪郭・年齢感を正規立ち絵と比較。

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the epilogue of Ageha's route. A quiet night in Ageha's room; neither of them has moved from the sofa. Ageha (22, the same bright, friendly, youthful face as her approved sprite with amber eyes and soft cheeks, honey-blonde twin ponytails with pink and cream bear hair clips; tonight in a soft oversized cream hoodie over her pink top, loose and relaxed) sits close beside the viewer on a low pink loveseat. She has just tugged the viewer's sleeve (his black hoodie sleeve at the lower edge) and leans her head on his shoulder, eyes half closed, a soft, calm smile instead of her usual big grin: "Gyaru manager is closed today. Your girlfriend is going quiet tonight." Two glasses of water on the low table, warm fairy lights, a teddy bear on the shelf, the city at night through the window. Gentle and honest, not flashy. Keep her face young and bright: no heavy makeup, no narrow cold eyes, no long chin.
```

## D4 `cg_mashiro_epilogue.png`

- 生成回数: 3 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/mashiro/chr_mashiro_normal.png`
  - 本人・笑顔: `assets/sprites/characters/mashiro/chr_mashiro_smile.png`
  - 画風と同一人物: `assets/cgs/cg_mashiro_confession.png`
  - 場所: `assets/backgrounds/bg_mukai_shop.png`
- 検品メモ: **検品未通過**。3回生成したが、つないだ手の一部が画面上65%より下に残る。保存ファイルは3回目の候補原画であり、採用時は手元の構図を再確認・再生成すること。

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the epilogue of Mashiro's route. A closed day at the small Tokyo shisha cafe mukai, soft daylight from the tall window. Mashiro (22, petite, pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse, long sage-green skirt) sits at a small round table across from the viewer. Her toolbox sits closed beside her, untouched. Two mugs of black tea steam gently on the table, one in front of each of them. She has reached across and holds the viewer's hand in both of hers on the tabletop (neither hand holds any tool), her cheek resting a little on her other shoulder, a slow, sleepy, contented smile: "Your hand is warm... this is enough for today." Blue-grey walls, olive bench, a quiet empty shop. Peaceful and unhurried.
```

## D5 `cg_rio_epilogue.png`

- 生成回数: 2 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/rio/chr_rio_normal.png`
  - 本人・笑顔: `assets/sprites/character_variants/new/rio/chr_rio_smile.png`
  - 画風と同一人物: `assets/cgs/cg_rio_confession.png`
  - 場所: `assets/backgrounds/bg_fookah_showroom.png`

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the epilogue of Rio's route. Late at night after she closed the dim second-floor showroom of the shisha wholesale shop Dr.fookah. Rio (27, very dark long wolf-cut hair with a slight slate-blue tint, thick sweeping bangs, languid half-lidded blue-grey eyes, a white shirt with rolled sleeves, black slacks, silver hoop earrings, colorless nails; tonight she wears black-rimmed glasses, as she only does late at night on the second floor) stands by the display counter and holds out a small folded slip of paper between two fingers toward the viewer, with a restrained, slightly embarrassed cool smile, eyes softening at the corners: "It's not a consent form. I measured my ring size." The slip is blank on the visible side. Behind her, glass display shelves with plain lidded tins in soft spotlights, windows covered with black film, a single desk lamp. Quiet, adult and a little shy.
```

## D6 `cg_samechan_epilogue.png`

- 生成回数: 2 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/samechan/chr_samechan_normal.png`
  - 本人・笑顔: `assets/sprites/character_variants/new/samechan/chr_samechan_smile.png`
  - 画風と同一人物: `assets/cgs/cg_samechan_confession.png`
  - 店の色: `assets/backgrounds/bg_shishark.png`

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the epilogue of Same-chan's route. An afternoon break inside her ocean-themed shisha bar SHISHARK, sea-blue walls and warm wood, a few wave motifs. Same-chan (an adult woman with a youthful cute face, soft half-lidded blue eyes, a shark-hood with small fins and teeth trim; on her RIGHT hand she always wears the shark hand puppet "Koro-chan" that has a tiny crown) sits on a bench next to the viewer. Beside them stands a little throne-like chair for Koro-chan with a small standing sign on it (the sign is blank). On a laptop on the low table, a shark movie is playing: only a dark underwater shape on the screen, nothing gory. Just before a scary scene, Same-chan grabs the viewer's hand with her LEFT hand, puppet hand raised in front of her mouth, looking away from the screen with a flustered, stubborn pout, showing a hint of her sharp little teeth: "I'll borrow this first." Cozy and funny.
```

## D7 `cg_hiyori_epilogue.png`

- 生成回数: 2 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/hiyori/chr_hiyori_normal.png`
  - 本人・笑顔: `assets/sprites/character_variants/new/hiyori/chr_hiyori_smile.png`
  - 画風と同一人物: `assets/cgs/cg_hiyori_confession.png`
  - 場所: `assets/backgrounds/bg_home_night.png`

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the epilogue of Hiyori's route. After work, in the protagonist's small apartment at night. Hiyori (25, a high ponytail of reddish pink-brown hair with light bangs, bright brown eyes, a friendly soft face; in her after-work office clothes: a cream blouse and dark slacks, her work bag dropped on the floor) has sunk deep into the sofa beside the viewer and leans her cheek on his shoulder, eyes closed, a small relieved smile, the tip of her ponytail brushing his collar: "Just five minutes... lend me your shoulder." On the low table, a bowl of rice and a small dish being warmed up waiting, steam rising a little. Warm desk lamp, the city lights through the window. Tired, safe and a little funny.
```

## D8 `cg_noor_epilogue.png`

- 生成回数: 2 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/noor/chr_noor_normal.png`
  - 本人・笑顔: `assets/sprites/character_variants/new/noor/chr_noor_smile.png`
  - 画風のみ: `assets/cgs/cg_hiyori_confession.png`
  - 場所: `assets/backgrounds/bg_tonari_inside_night.png`

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the epilogue of Noor's route. Early evening at the shisha cafe tonari in Japan. The door has just opened and a big travel suitcase rolled in first. Noor (27, a sun-tanned Emirati woman, black hair loosely tied back, a thin beige scarf around her neck, a rolled-sleeve khaki outdoor shirt, sunglasses pushed up on her head, a big bright smile) stands at the counter in front of the viewer with the large suitcase beside her, and grasps the viewer's hand across the counter with both of hers, eyes shining, half laughing and half moved: "I came... I really came." Behind her, tonari's irregular Turkish mosaic pendant lamps, dark wood, green seating, the evening street through the window. Warm, joyful reunion. No religious symbols; do not make her resemble any real person.
```

## D9 `cg_noor_confession.png`

- 生成回数: 3 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/noor/chr_noor_normal.png`
  - 本人・笑顔: `assets/sprites/character_variants/new/noor/chr_noor_smile.png`
  - 画風のみ: `assets/cgs/cg_samechan_confession.png`
  - 場所: `assets/backgrounds/bg_dubai_dunes_dusk.png`
- 検品メモ: 3回目で手元を上側へ移動。小指の絡み方は採用前にオーナーが原寸で確認すること。

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Scene: the confession of Noor's route (accepted). Sunset on the crest of a sand dune in the Dubai desert, her secret favorite spot she never shows to tour guests. Noor (27, a sun-tanned Emirati woman, black hair loosely tied back with a few strands loose in the wind, a thin beige scarf around her neck, a rolled-sleeve khaki outdoor shirt, sunglasses pushed up on her head) sits beside the viewer on the sand with her knees drawn up. Their hands rest on the sand between them: her little finger has hooked his, and now her whole hand closes around his, palm to palm. She turns toward the viewer with teary, happy eyes and a trembling, shy smile, cheeks warm in the low light: "Not a pinky promise. This. From today, we're lovers." The sun is a deep orange disc sinking behind distant dunes, the ridgelines shifting from red to violet, long soft shadows on the sand. The tour car is far away and out of focus. No religious symbols; do not make her resemble any real person.
```

## D10 `title_art_noor_01_dune_sunset.png`

- 生成回数: 1 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/noor/chr_noor_normal.png`
  - 本人・笑顔: `assets/sprites/character_variants/new/noor/chr_noor_smile.png`
  - タイトル絵の画風と人物サイズのみ: `assets/ui/title_arts/title_art_hiyori_06_riverside_hoodie.png`
  - タイトル絵の画風と人物サイズのみ: `assets/ui/title_arts/title_art_samechan_04_throne_pose.png`
  - 場所: `assets/backgrounds/bg_dubai_dunes_day.png`

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Create one title-screen key visual of a single heroine for the Japanese shisha-bar romance game "Suien Zensen -EN:CODE-". Opaque PORTRAIT 2:3, 1024x1536. Japanese 2D anime illustration in the same hand as the attached approved title arts: clean confident outlines, cel shading with two or three shadow steps, warm cinematic light, a detailed painted background; not 3D, not photographic, no airbrush gloss. The heroine must be exactly the same person as her attached approved sprite.
Noor (27, a sun-tanned Emirati woman who guides desert tours and helps at her father's shisha cafe in Dubai; black hair loosely tied back with a few loose strands in the wind, a thin beige scarf around her neck fluttering, a rolled-sleeve khaki outdoor shirt, sunglasses pushed up on her head) stands on the crest of a golden sand dune in the late afternoon, holding a sandboard upright beside her with one hand and waving toward the viewer with the other, a big confident, playful grin: "On the sand, I won't lose." Fine sand blowing off the ridge, rippled dunes stretching away, a 4x4 car small in the distance, a clear sky turning warm gold. Upper body and most of the legs in frame, face in the upper third. No text, letters, numbers, logos, UI, borders or watermark. No religious symbols; do not make her resemble any real person. No hookah.
```

## D11 `title_art_hajime_01_first_shift.png`

- 生成回数: 2 回
- 参照画像:
  - 本人: `assets/sprites/character_variants/new/hajime/chr_hajime_normal.png`
  - 本人・笑顔: `assets/sprites/characters/hajime/chr_hajime_smile.png`
  - タイトル絵の画風と人物サイズのみ: `assets/ui/title_arts/title_art_naru_01_bakery_morning.png`
  - タイトル絵の画風と人物サイズのみ: `assets/ui/title_arts/title_art_sumi_01_own_clay_bowl.png`
  - 場所: `assets/backgrounds/bg_street_night.png`

依頼文（Issue 原文の全文。D1〜D9 は上記共通前文を先頭に付ける）:

```text
Create one title-screen key visual of a single character for the Japanese shisha-bar game "Suien Zensen -EN:CODE-". Opaque PORTRAIT 2:3, 1024x1536. Japanese 2D anime illustration in the same hand as the attached approved title arts: clean confident outlines, cel shading with two or three shadow steps, warm cinematic light, a detailed painted background; not 3D, not photographic, no airbrush gloss. The character must be exactly the same person as his attached approved sprite.
Hajime (22, a likable, ordinary, polite young man; the same face, short black hair, black cap, black zip hoodie and silver tag necklace as his sprite) stands just outside the open door of the small, warm shisha cafe "tonari" in an old shopping street of a Japanese town at dusk, tying a brown waist apron around his hoodie before his shift, glancing back toward the viewer with a modest, slightly nervous but hopeful smile, as if about to say "Welcome". Warm light and a faint wisp of smoke spill from the doorway behind him; irregular colorful Turkish mosaic lamps are visible inside; the street glows with shop lights and a deep blue-violet evening sky. Upper body and most of the legs in frame, face in the upper third. No text, letters, numbers, logos, shop signs with writing, UI, borders or watermark. No hookah in frame.
```
