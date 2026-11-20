# 第2〜5章 新規スチル26枚：生成プロンプト

手順・保存先・検品は [README.md](README.md)。ここは Codex の画像生成へ渡す文面の正本。

## 渡し方

1枚の候補ごとに、次の順でつないで1回の生成に渡す。

1. **共通前文**（下のブロックをそのまま）
2. そのシーンの **本文**
3. そのシーンの **3案の振り方** のうち、作る候補（A・B・C）の1行
4. 機材が写るシーンだけ、**機材の文**（下のブロックをそのまま。要約しない）と、そのシーンの「機材の追記」

参照画像はシーンごとの「参照」を、役割の説明つきで添付する（最大5枚）。機材の写真は README の「参照画像のルール」に従う。

### 共通前文

```text
Create one finished visual novel event CG (a story still) for the Japanese shisha-bar game "Suien Zensen -EN:CODE-". Opaque landscape 16:9, at the largest 16:9 size the tool can make (at least 1672x941). Japanese 2D anime illustration in the same hand as the attached approved event CG: clean confident outlines, cel shading with two or three clearly shaped shadow steps, warm cinematic light, a detailed painted background with a fine pixel-painter texture; not 3D, not photographic, no airbrush skin gloss, no rim-light glow, no floating sparkles or light particles. The approved event CG is a rendering-style reference only: do not copy its people, composition, props or equipment. Every named character must be exactly the same person as their attached approved sprite: same face design, eye shape and color, hairstyle and hair color, age, build and outfit; do not drift toward a generic pretty face. Unless the scene says otherwise, the viewer is the protagonist Hajime: never show his face; at most his hands, sleeves, shoulder, back or the back of his head (short black hair under a black cap, black zip hoodie over a black t-shirt). Put every important face, hand and prop within the top 65% of the image, because a dialogue window covers the bottom 25%. No text, letters, numbers, logos, UI, borders or watermark anywhere; any paper, sign, label, bag, phone or monitor screen is blank or unreadable. Unnamed customers, workers and passers-by are ordinary adults with plain everyday faces and clothes, never caricatures.
```

### 機材の文（機材が写るシーンだけ。`docs/shisha_reference.md` §4.2 の英文そのまま）

```text
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.
```

---

# 第2章

## 2-07 `cg_ch2_sofa_wet_cloth`（試作）

**参照**：本人 `assets/sprites/characters/sumi/chr_sumi_serious.png`／場所 `assets/backgrounds/bg_tonari_inside_night.png`／画風 `assets/cgs/cg_ending_tonari_night.png`
**台本**：`ch2_sofa_burn`「スミさんが炭を金属の皿へ戻し、焦げ跡に濡れた布を当てる。」

```text
Scene: chapter 2, night, just before closing at tonari, the small shisha cafe where Hajime works (use the attached room for its irregular Turkish mosaic pendant lamps, dark wood and green leather sofas). Hajime was changing coals and dropped a red-hot coal from his tongs onto a customer's green leather sofa. It is already handled: Sumi (46, the owner; same man as the attached sprite: black flat cap, square black glasses, short beard, charcoal shirt with rolled sleeves, brown waist apron) has put the coal back on a small metal dish and is now pressing a folded wet cloth onto the black scorch mark on the seat with one steady hand, leaning in, eyes on the cloth, calm and focused, not angry. Camera at sofa-seat height. Foreground left: Hajime's own hand frozen in the air, still holding the empty plain steel tongs. Center: Sumi's hand, the wet cloth and the black scorch on the green leather; a thin last wisp of smoke fading. On the low table beside it: the small metal dish with one fingertip-sized cube coal, grey ash with a faint red glow. Background: the customers have stepped back; show only their legs and shoes and a table leg, no faces. Sumi's face is seen in three-quarter profile or partly under his cap brim, not a big close-up. No flames, no injury, no burn on skin, no full hookah in frame. The feeling: the shop protecting its guests in a few quiet seconds.
```

**3案の振り方**
- A: `Variant A: the low sofa-seat angle as described, tongs large in the left foreground.`
- B: `Variant B: camera a little higher, showing Sumi's upper body and his face in profile above the cloth; tongs smaller at the left edge.`
- C: `Variant C: a tighter shot of the tongs, the wet cloth and the scorch in the upper half, with the customers' shoes small in the background.`

**検品**：炭は指先大で炎なし。台が写っていない。スミさんの帽子・眼鏡・ひげが立ち絵と同じ。

## 2-11 `cg_ch2_ageha_lesson`（試作）

**参照**：本人 `assets/sprites/characters/ageha/chr_ageha_normal.png`・`chr_ageha_surprise.png`／場所 `assets/backgrounds/bg_c_station_night.png`／画風 `assets/cgs/cg_ageha_confession.png`／機材の写真1枚
**台本**：`ch2_ageha_lesson`「水を飲んでいた俺は、盛大にむせた。」〜「え、何。ハジメっち、なんでむせてんの？」

**機材8行**
```text
人物      : あげは（ハンドルを持って実演）、名前のない成人客2人（初来店）
場面      : 完成・喫煙（提供済みの1台。この瞬間は誰も吸っていない）
台の型    : 日本の店の業務用。ステンレスの細いステム＋幅の広いガラスベース。客席の低い卓に1台
HMD       : シリコンボウル＋ロータス型HMD（蓋あり）
炭        : HMDの中に2〜3個（蓋で見えにくい）
ホース    : 側面ポート → 卓の上をたわむ → あげはが持つ硬いハンドル。1本だけ
吸い口    : ハンドル先端に使い捨てチップ
構図      : 客席の斜め横。台は3人と同じ奥行きで受け皿とステム上部が写る。手前にはじめの手と水のグラス
```

```text
Scene: chapter 2, day 9, late in a flavor tasting event held in the guest seating of C.STATION Yuzugaya, a bright chain shisha lounge (use the attached room). Two first-time customers, an ordinary adult pair in their twenties in casual clothes, sit stiffly side by side on a sofa, dead serious, listening. Ageha (22; the same bright, friendly, youthful face as her sprite with amber eyes and soft cheeks, honey-blonde twin ponytails with pink and cream bear hair clips, leopard jacket over a pink crop top, black choker, gold heart necklace) sits next to them and earnestly demonstrates how to hold the hose handle, as if about to show a slow, deep inhale. She has just turned her head toward the viewer with an innocent, puzzled look ("Huh? Why are you choking?"), because in the foreground Hajime's hand holding a glass of water has jolted and water is splashing over the rim: he just choked on his drink. The joke is that the lesson is completely innocent and everyone else is completely serious. Ageha's pose is natural and relaxed, not suggestive, not exaggerated. Bright, even ceiling light. One finished hookah stands on the low table in front of them.
Hardware note: the hookah is a modest prop on the table at the same depth as the three of them; its single hose runs from the side port across the table to the handle in Ageha's hand; no smoke from the hookah.
```

**3案の振り方**
- A: `Variant A: three-quarter side view; Ageha in the center, the two customers to her left, Hajime's splashing glass in the lower-right foreground (above the bottom quarter).`
- B: `Variant B: the viewer sits across the low table; all three face roughly toward the viewer, the glass small at the near edge.`
- C: `Variant C: a wider view of the lounge seating; the customers on the left, Ageha on the right turning toward the viewer.`

**検品**：あげはの顔が立ち絵と同じ（濃い化粧・細い目・長い顎にしない）。ホース1本、HMDあり。客2人は成人に見える。

## 2-03 `cg_ch2_kanzaki_id_check`

**参照**：本人 `assets/sprites/characters/kumicho/chr_kumicho_normal.png`・`chr_kumicho_serious.png`／場所 `assets/backgrounds/bg_ryuji_shop.png`／画風 `assets/cgs/cg_ch1_sumi_training.png`
**台本**：`remake_ch2_delivery_kumicho`「神崎さんは生年月日を指で押さえて確かめ、両手で丁寧に返してくれた。」

```text
Scene: chapter 2, day 1, inside Kanzaki Tobacco Shop, a shisha shop in the city of Yuzugaya whose interior looks like a movie gang office: dark wood walls, black leather sofas, a polished white marble floor, a big desk and a gold folding screen at the back (use the attached room for the real layout). Hajime came only to deliver a parcel, but the owner demanded his ID first; it was only an age check. Kanzaki Ryuji (53; same man as the attached sprite: tinted glasses, short black-and-white hair, stern brows and moustache, white large-check double-breasted suit, black shirt, purple tie and pocket square) stands close and returns the ID card to the viewer with BOTH hands, carefully and politely, with a slight courteous nod; behind the tinted lenses his eyes are calm. From the lower left, Hajime's own hand reaches up to take it, fingers still a little stiff. The card shows its plain back side: blank, no photo, no text. The comedy: the room and the man look frightening, but his gesture is the most polite thing in the picture. Low camera near the marble floor so Kanzaki looks big, but keep his face, both his hands and the card in the top 65%. His little fingers are naturally hidden by his grip or the card; do not show or deny anything about them. No hookah or shisha equipment in frame. No crest, no characters on the screen, no portraits with readable faces on the walls (keep frames dark or out of focus).
```

**3案の振り方**
- A: `Variant A: low angle, medium shot, Kanzaki towering but bowing slightly as he hands the card back.`
- B: `Variant B: over Hajime's shoulder (his black hoodie shoulder at the lower left), Kanzaki's face and hands larger.`
- C: `Variant C: wider, showing the gold screen and the black sofas, with the handover small but sharp in the center.`

**検品**：色付き眼鏡・口ひげ・白いチェックのダブルスーツ。カードが白紙。小指の有無を描いて断定していない。

## 2-14 `cg_ch2_naru_score_sheet`

**参照**：本人 `assets/sprites/characters/naru/chr_naru_normal.png`・`chr_naru_serious.png`／場所 `assets/backgrounds/kemurikusa.png`／画風 `assets/cgs/cg_naru_after_hours.png`
**台本**：`ch2_naru_confrontation`「なるの手が止まった。」〜「いつもの笑みが、なるの顔から消えていた。」（選択肢の前）

```text
Scene: chapter 2, day 11, night, inside KEMURIKUSA, Naru's warm little shisha shop (use the attached room). Hajime sits at the counter. Naru (23; same man as the attached sprite: short tousled silver-ash hair with a long asymmetric fringe, warm amber eyes, open black stand-collar bomber with white shoulder and sleeve panels, black t-shirt, fine silver chains) stands behind the counter. He was polishing a small empty ceramic shisha bowl with a cloth while telling a warm story about a regular customer, and his hands have just stopped mid-polish. His usual smile is gone: not angry, just quiet, guarded and a little hurt, eyes on the viewer. Camera from Hajime's knee height, looking slightly up. Foreground lower-left, but still above the bottom quarter: Hajime's smartphone in his hand on his lap, its screen glowing cold white with a faint unreadable grid of tiny boxes (a scoring sheet), absolutely no readable numbers or letters. Behind it: the warm amber counter light, Naru's stopped hands with the bowl and cloth, and his face. The cold phone light against the warm shop is the point. No travel bag, no window view, no hookah in frame.
The bowl he holds is small: at the same depth as his hand, held easily in one hand, its mouth narrower than his palm, his fingers around its slim neck; no HMD, no coals, no foil, not thrust toward the camera.
```

**3案の振り方**
- A: `Variant A: the phone large in the left foreground, Naru centered behind the counter.`
- B: `Variant B: the phone smaller at the lower right, Naru larger and closer.`
- C: `Variant C: Naru's face sharp in the center, the phone softly out of focus in the near foreground.`

**検品**：画面に数字・文字がない。なるの表情が怒りでなく「笑みが消えた」。ハガルが手より大きくない。

## 2-17 `cg_ch2_rei_earphone`

**参照**：本人 `assets/sprites/characters/rei/chr_rei_normal.png`／後ろ姿 `assets/sprites/characters/hajime/chr_hajime_normal.png`（服と髪だけ）／場所 `assets/backgrounds/bg_ch2_venue_bench_night.png`／画風 `assets/cgs/cg_naru_after_hours.png`
**台本**：`remake_ch2_eve_rei`「差し出されたイヤホンの片方を、耳に入れた。」〜「（味は遠いままだ。でも、音が消えたあとの静けさは、ちゃんと聞こえた）」

```text
Scene: chapter 2, day 13, the night before the prefectural tournament, a bench outside the venue (use the attached place). Kuraudo (25; the owner of a visual-kei shisha cafe, an ordinary music and fashion fan; same man as the attached sprite: layered black hair with irregular deep burgundy streaks on both sides, never a left/right split dye, restrained eye makeup, the visible neck and hand tattoos of his sprite, embroidered black long coat with red lining, black shirt and waistcoat) sits at the far end of the bench, a black hard equipment case set down between them. He wears one small wireless earbud and listens with his eyes half closed to a quiet guitar song; the other earbud is in Hajime's ear. Camera from the side and slightly behind Hajime: Hajime's shoulder and the back of his head (black cap, black hoodie) at the near side, a lot of empty bench between the two men. Far away, the artificial light of the loading entrance falls on the pavement and ends; the rest is quiet darkness. Mood: the three seconds of silence after a song ends. Two friends sitting apart, not romantic, not a stage performance. No ticket, no poster, no logo on the case.
```

**3案の振り方**
- A: `Variant A: a wide side view of the whole bench.`
- B: `Variant B: from diagonally behind Hajime; Kuraudo in three-quarter view across the empty bench.`
- C: `Variant C: closer on Kuraudo listening, Hajime's shoulder and earbud at the near edge.`

**検品**：メッシュが左右分割になっていない。はじめの顔なし。二人が寄り添っていない。

## 2-16 `cg_ch2_rest_notebook`

**参照**：袖と手 `assets/sprites/characters/hajime/chr_hajime_normal.png`（服だけ）／場所 `assets/backgrounds/bg_home_night.png`／画風 `assets/cgs/cg_ending_tonari_night.png`
**台本**：新しい短い場面（第2章で初めて「家で休む」を選んだ時だけ。#3957）

```text
Scene: chapter 2. Hajime has decided to rest at home today instead of practicing. A close, quiet view beside his bed in his small apartment room (use the attached room), soft diffuse indoor light with the curtains closed, so the time of day is not clear. His hand slides one finger out from between the pages and closes a practice notebook, setting it at the edge of the bedside table. Beyond it, the pillow, and the slope of his shoulder in a black hoodie settling down onto the bed. Only his hand, sleeve and shoulder are visible, never his face. The notebook pages are unreadable lines at most. Calm, a small permission to rest. No clock, no phone screen, no shisha equipment.
```

**3案の振り方**
- A: `Variant A: from above, the hand closing the notebook in the center, the pillow beyond.`
- B: `Variant B: from mattress level, the notebook at the bedside edge in the foreground.`
- C: `Variant C: wider, the bed, the pillow and the closed notebook on the table.`

**検品**：時計・窓の外の時間帯が写っていない。ノートに読める文字なし。

## 2-20 `cg_ch2_ageha_white_bear`

**参照**：本人 `assets/sprites/characters/ageha/chr_ageha_normal.png`・`chr_ageha_smile.png`／場所 `assets/backgrounds/bg_ch2_ageha_closed_night.png`／画風 `assets/cgs/cg_ageha_confession.png`
**台本**：`ch2_tournament_ageha_heart`「棚のホワイトグミベアを手に取る。」〜「あげはは小さく笑って、店の明かりを落とした。」

```text
Scene: chapter 2, the night of the prefectural tournament, after closing at MELTY PUFF, Ageha's pink candy-style shisha shop (use the attached closed-night room). Hajime is NOT here and there is no first-person view: Ageha is alone. She sits on the shop's sofa, having just taken a bag of white gummy bears from the display shelf, holding it in both hands on her lap and looking down at it; the corner of her mouth softens into a small private smile: tired, honest, a little bittersweet. Most of the shop lights are already off; only the shelf light behind her remains, so the white bears glow softly. Ageha (22) is the same person as her sprite: bright, friendly youthful face, amber eyes, soft cheeks, honey-blonde twin ponytails with pink and cream bear clips, leopard jacket over a pink crop top. No tears, no dramatic pose, no heavy makeup, no narrow cold eyes. The bag shows only a simple white bear silhouette, no text. No hookah in frame.
```

**3案の振り方**
- A: `Variant A: a medium shot from the display-case side.`
- B: `Variant B: closer on Ageha and the bag in her hands.`
- C: `Variant C: wider, the dark shop around her and the single shelf light.`

**検品**：はじめが写っていない。泣き顔にしていない。袋に文字なし。

---

# 第3章

## 3-01 `cg_ch3_mashiro_no_craft_day`（試作）

**参照**：本人 `assets/sprites/characters/mashiro/chr_mashiro_normal.png`・`chr_mashiro_smile.png`／場所 `assets/backgrounds/bg_mukai_shop_day.png`／画風 `assets/cgs/cg_mashiro_double_apple.png`
**台本**：`ch3_rest_before_recovery`「ましろは自分の作業台にも布をかけた。」〜「お茶、飲む？」（選択肢の前）

```text
Scene: chapter 3, Tokyo, midday at mukai, a small shisha cafe with no customers yet (use the attached room: blue-grey walls, olive bench, tall windows). Hajime cannot make anything today; his sense of taste feels far away. Mashiro (22; same woman as the attached sprite: pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt) has already closed the flavor tins and put the tongs back on the shelf. Now, across the workbench, she drapes a cloth over HER OWN workbench too: she is taking a break as well, not only for him. She looks at the viewer with a soft, unhurried, sleepy expression. Foreground: Hajime's empty hands resting on the counter, palms down, holding nothing. Background: the empty wall-side sofa seat with cushions, room enough for two. Daylight. No hookah, no readable labels, no food.
```

**3案の振り方**
- A: `Variant A: across the workbench, Mashiro in the center draping the cloth, the empty sofa behind her on the right.`
- B: `Variant B: a side angle so the empty sofa seat is more visible.`
- C: `Variant C: closer on Mashiro's face and the cloth, Hajime's empty hands at the near edge.`

**検品**：ましろの顔が立ち絵と同じ（半目・金の瞳）。手元に道具がない。ソファ席に誰も座っていない。

## 3-21 `cg_ch3_liars_night`

**参照**：本人 `assets/sprites/characters/saku/chr_saku_normal.png`・`assets/sprites/characters/mashiro/chr_mashiro_normal.png`／後ろ姿 `assets/sprites/characters/hajime/chr_hajime_normal.png`（服と髪だけ）／場所 `assets/backgrounds/bg_street_night.png`／画風 `assets/cgs/cg_naru_after_hours.png`
**台本**：`ch3_tournament_eve`「三人は別々の道へ歩き出した。」〜「スマホには、大会のあとに会う約束が残っている。」

```text
Scene: chapter 3, Tokyo, the night before the national tournament, a narrow back street (use the attached street); the small sign of the pop-up shisha shop behind them has just been switched off (dark, unreadable). This is NOT first-person: a wide shot from behind and slightly above. Three young adults have just said goodbye and are walking away in three different directions at a small intersection: Ayatori Jin on the left (23; same man as the attached sprite: uneven espresso-brown hair, short soot-black work jacket with diagonal tabs, cream henley, indigo notebook pouch at his hip), Mashiro on the right (beige knit cardigan, two long braids, sage-green skirt), and Hajime in the center seen only from behind (black cap, black zip hoodie; his face never visible). Ayatori glances back over his shoulder with a faint, uneven smile; Mashiro's head is turned a little too. Three streetlights make three separate pools of light; the gaps between them are dark but calm. Mood: they did not say everything, but they did not part in silence. Keep the two visible faces small but within the top 65%. No hookah, no signs with text.
```

**3案の振り方**
- A: `Variant A: high angle, the whole intersection, three figures small.`
- B: `Variant B: eye level from behind Hajime, his back in the near center, the other two farther away left and right.`
- C: `Variant C: from the side, Ayatori nearer and larger as he looks back.`

**検品**：はじめの顔なし。三人が別の方向へ歩いている。看板が読めない。

## 3-02 `cg_ch3_national_ask_customer`

**参照**：本人 `assets/sprites/characters/saku/chr_saku_wild.png`・`chr_saku_normal.png`／場所 `assets/backgrounds/bg_tournament_stage.png`／画風 `assets/cgs/cg_ch1_tournament_battle.png`／機材の写真1枚
**台本**：`ch3_national_adjustment`「俺は綾取から目を外し、客へ向き直った。」〜「……熱くはないです。軽いけど、嫌な軽さじゃない」

**機材8行**
```text
人物      : 名前のない試喫客（50代・老眼鏡）、綾取（画面左端）
場面      : 完成・喫煙（はじめの大会の台。客が一口吸ったあと）
台の型    : 大会支給の業務用。ステンレスの細いステム＋幅の広いガラスベース
HMD       : シリコンボウル＋ロータス型HMD（蓋あり）
炭        : HMDの中に2〜3個
ホース    : 側面ポート → 台の脇をたわむ → 客が持つ硬いハンドル。1本
吸い口    : ハンドル先端に使い捨てチップ
構図      : はじめ視点。台は客と同じ奥行きで受け皿とステム上部が写る。審査席と客席はぼかす
```

```text
Scene: chapter 3, the national shisha tournament in Tokyo, mid-match, the first adjustment round (use the attached stage for lighting and station design). First-person from Hajime at his competition station. He has just turned his eyes away from his rival and toward the customer tasting his hookah: an ordinary customer in their fifties wearing reading glasses, seated on a stool on the right, holding the hose handle, about to answer: neutral, thoughtful, lips just parting. At the left edge, Ayatori Jin (23; same man as the attached sprites) at his own station; the delighted wide-eyed grin he was aiming at Hajime a moment ago is freezing as he notices Hajime is no longer looking at him. The center of the picture is the quiet interval of waiting for an answer. Hajime's own hand rests on the counter near his tongs, not touching the coals. Judges' table and audience are soft and out of focus. No score boards, no numbers, no trophy, no banners with text.
Hardware note: Hajime's single hookah stands on his station at the same depth as the customer; one hose from its side port to the handle in the customer's hand; smoke only faintly from the customer's mouth if at all.
```

**3案の振り方**
- A: `Variant A: the customer large on the right, Ayatori small at the left edge.`
- B: `Variant B: Ayatori larger in the left foreground and slightly blurred, the customer sharp in the center.`
- C: `Variant C: a wider view of the stage with both stations and the customer.`

**検品**：客の返事の中身（笑顔・しかめ面）を決めつけていない。綾取の顔が立ち絵と同じ。ホース1本・HMDあり。

## 3-03 `cg_ch3_half_cake`

**参照**：本人 `assets/sprites/characters/mashiro/chr_mashiro_smile.png`・`assets/sprites/characters/saku/chr_saku_normal.png`／場所 `assets/backgrounds/bg_yohaku_shop_day.png`／絵とクレヨンの質感 `assets/cgs/cg_ch3_childhood_offered_hand.png`
**台本**：`ch3_enmaku_cleanup`「綾取がノートを開くと、黄ばんだ紙がもう一枚。並べると、ケーキが一つになった。」〜「……うん。合わせるのは、会った時でいい」

```text
Scene: chapter 3, the morning Hajime goes home, inside Enmaku, Ayatori's small pop-up shisha shop in Tokyo, whose closing has turned into an extension (use the attached room; a partition curtain still hangs, mirrors freshly polished). The three of them sit at a guest table waiting for water to boil. On the table, between an opened tea tin with its lid off and Ayatori's open indigo notebook, two old, yellowed halves of a child's crayon drawing have just been laid edge to edge, and the simple yellow crayon cake becomes one again (the same child's drawing as in the attached childhood still, now aged paper). Mashiro (left; sprite: two long ash-blonde braids, beige cardigan) smiles softly, a rare open smile. Ayatori (right; sprite: uneven espresso-brown hair, soot-black jacket) looks down at the joined drawing in silence, eyes soft. Hajime is the third seat: only his shoulder and hand at the near edge of the table. Morning light. The joined drawing sits above the bottom quarter. No children, no flashback colors, no hookah, no hand-holding.
```

**3案の振り方**
- A: `Variant A: table-height, the joined drawing in the center, both faces above it.`
- B: `Variant B: slightly higher, showing more of the shop and the hanging curtain.`
- C: `Variant C: closer on the two faces, the drawing in the lower middle (still above the bottom quarter).`

**検品**：ケーキの絵が幼少期のCGと同じ黄色いクレヨンの絵。子ども・回想表現が入っていない。

## 3-04 `cg_ch3_mukai_latte_cat`

**参照**：本人 `assets/sprites/characters/mukai_master/chr_mukai_master_normal.png`・`assets/sprites/characters/mashiro/chr_mashiro_normal.png`／場所 `assets/backgrounds/bg_mukai_shop.png`／画風 `assets/cgs/cg_mashiro_double_apple.png`
**台本**：`ch3_mukai_latte_cat`「泡の上に、丸い背中と、そっぽを向いた顔ができていく。」〜「……そこだけは、うまく描ける」（選択肢の前）

```text
Scene: chapter 3, after closing at mukai, night (use the attached room). Counter-height view. Mukai (48, the hard-boiled, dandy owner; same man as the attached sprite: deep fedora shading his eyes, trimmed beard, dark tailored suit) holds a tiny milk pitcher in his big hand and wiggles it carefully over a sixth latte cup; in the foam, a round-backed cat turned away in a sulk is forming. Five earlier latte cups stand in a row on the counter, each with a slightly different, imperfect foam cat. From the side, Mashiro peeks in, amused. Under the hat brim, a hint of a small smile on Mukai's mouth. The latte art is simple foam lines with ears and a turned-away back, charming but not perfect or cartoon-cute. No real cat in the shop, no phone camera screen, no hookah.
```

**3案の振り方**
- A: `Variant A: counter level, close on the cups and his hands, his face above.`
- B: `Variant B: over Mukai's shoulder, the row of cups and Mashiro across the counter.`
- C: `Variant C: wider, Mashiro larger as she leans in.`

**検品**：帽子で目元が隠れている（立ち絵どおり）。泡の猫がそっぽを向いている。カップが6つ。

---

# 第4章

## 4-03 `cg_ch4_traveler_chair`（試作）

**参照**：顔 `assets/sprites/characters/sheikh/chr_sheikh_normal.png`（顔とひげだけ）／旅装 `remake/img/loading/sheikh-traveler-1.webp`（茶色いフードの外套だけ。吹き出し・文字・はじめの絵は写さない）／場所 `assets/backgrounds/bg_dubai_souq_day.png`／画風 `assets/cgs/cg_ch4_dubai_arrival.png`
**台本**：`ch4_stranger_first`「一緒に日陰へ入る。男は名乗らないまま、椅子を一つ引いた。」〜場面の最後

```text
Scene: chapter 4, Dubai, the edge of a souq at midday (use the attached market for color and architecture). Off the bright main lane, in the deep shade of a narrow side passage. A man in plain travel clothes: a dusty brown hooded travel cloak over a simple beige robe, the hood up but pulled back enough to show his face. He has the same face as the attached sprite (age 52, neatly trimmed beard, calm eyes) but must look like an ordinary traveler: NO white kandura showing, NO gold trim, NO black agal, no jewelry, no rings. Without giving his name, he has just pulled out a simple chair for the viewer, one hand on its backrest, and nods toward it. On a small side table next to the chair: a bottle of water and a glass. In the lower-left foreground, Hajime's hand holds a smartphone with a translation app open; the screen is plain and light with no readable text. Contrast: white-hot sun on the main lane behind, cool blue shade in the passage. Kind, unhurried, a little mysterious. No hookah, no shop signs, no text. Use the attached comic panel only for the cloak's color and shape; never copy its speech bubbles, its text or its drawing of Hajime.
```

**3案の振り方**
- A: `Variant A: medium shot, the man and the chair in the shade, the bright lane behind.`
- B: `Variant B: wider, more of the glaring main lane and the dark passage.`
- C: `Variant C: closer on his face and the hand on the chair back.`

**検品**：顔がシェイクと同じ人物に見える（4-15で気づける）。白い正装・金・アガールが見えない。文字・吹き出しがない。

## 4-02 `cg_ch4_festa_welcome`

**参照**：本人 `assets/sprites/characters/da_silva/chr_da_silva_smile.png`・`assets/sprites/characters/naru/chr_naru_normal.png`／場所 `assets/backgrounds/bg_dubai_festa.png`／画風 `assets/cgs/cg_ch4_dubai_arrival.png`／機材の写真1枚
**台本**：`ch4_festa`「太陽は笑って、空いた椅子と水を指した。」〜「来たな、日本の二人！　まず座れ！　暑かった、だろ？　水、飲め！」

**機材8行**
```text
人物      : 太陽（ブースの中で歓迎）、なる（はじめの隣。肩と横顔）
場面      : 完成・喫煙（太陽が自分の一台を吸ったあと。煙の輪は太陽の口から吐いたもの）
台の型    : ステンレスの細いステム＋明るい色のガラスベース（祭りのブースらしい色。装飾は控えめ）
HMD       : シリコンボウル＋ロータス型HMD
炭        : HMDの中に2〜3個
ホース    : 側面ポート → カウンターをたわむ → 太陽が片手に持つ硬いハンドル（もう片方の手で椅子を指す）
吸い口    : ハンドル先端に使い捨てチップ
構図      : ブースのカウンター越し。台は太陽と同じ奥行きで受け皿とステム上部が写る
```

```text
Scene: chapter 4, Dubai, FESTA: Taiyo's lively pop-up shisha booth in a corner of the tournament venue (use the attached place), visitors clapping in rhythm. Taiyo da Silva (28; same man as the attached sprite: tanned, dark curly hair, open tropical-print shirt) has just blown a smoke ring from his mouth that is now dissolving above his head; he laughs and points with his free hand at an empty chair and a glass of cold water waiting for the viewer: "Sit! Drink some water!" A big, generous welcome. Next to the viewer on the near left, Naru (23; same man as the attached sprite: silver-ash hair, black bomber with white panels), only his shoulder and profile, quietly noticing how much room the booth leaves for hoses and seats. Clapping visitors in the background, warm festival colors, but the empty chair and the glass of water are clearly readable in the upper part of the image. Taiyo must NOT look like a judge: no badge, no lanyard, no judges' table.
```

**3案の振り方**
- A: `Variant A: the front of the booth, Taiyo centered, chair and water to the right.`
- B: `Variant B: Naru's shoulder large in the left foreground, Taiyo beyond.`
- C: `Variant C: wider, more of the clapping crowd and the booth.`

**検品**：煙の輪が台やホースから出ていない。審査員を示すものがない。なるの髪色・服が立ち絵どおり。

## 4-05 `cg_ch4_traveler_tongs`

**参照**：顔 `assets/sprites/characters/sheikh/chr_sheikh_normal.png`（顔とひげだけ）／旅装 `remake/img/loading/sheikh-traveler-1.webp`（外套だけ）／場所 `assets/backgrounds/bg_dubai_alley_cafe_night.png`／画風 `assets/cgs/cg_ch4_world_handshake.png`／機材の写真1枚
**台本**：`ch4_stranger_third`「トングを差し出すと、男は受け取って柄を一度拭いた。」〜「空いた手を握って、開く。ドバイへ来てから、一番軽かった。」

**機材8行**
```text
人物      : 旅人（正体はシェイク。旅装）
場面      : 完成・喫煙（旅人の葡萄の一台。吸い口を拭いて置いたところで、この瞬間は誰も吸っていない）
台の型    : 路地裏の古いカフェの台（古い店の演出として指定）。くすんだ真鍮の細いステム＋透明なガラスベース。装飾は控えめ
HMD       : 蓋のない低い金属の器
炭        : HMDの中に2個
ホース    : 側面ポート → 卓へたわむ → 卓に寝かせた硬いハンドル
吸い口    : なし
構図      : 卓すれすれの横位置。台は旅人と同じ奥行きで受け皿とステム上部が写る
```

```text
Scene: chapter 4, Dubai, the night before the world final, a small old cafe in a back alley (use the attached room: old wooden counter, warm lamps, stacked cups). Hajime has come to return the plain steel tongs he borrowed. The traveler (the same man as before: same face as the attached sprite, a dusty brown hooded travel cloak with the hood down, simple beige robe, no gold, no agal, no jewelry) has taken the tongs and is wiping their handle once with a small cloth, eyes lowered, calm and kind. In the near foreground, Hajime's hand that has just let go is opening, palm up and relaxed. On the low table, the traveler's old grape hookah; a faint wisp of smoke he exhaled earlier still hangs above the table, not coming from the hookah. The tongs are ordinary cafe tongs, not kunai-shaped. Their hands do not touch.
Hardware note: this hookah is an old cafe hookah by request (dull brass stem, modest decoration), but its structure follows the rule below; it stays a modest prop at the same depth as the man.
```

**3案の振り方**
- A: `Variant A: low side view at table height, the man, the hookah and Hajime's open hand in one line.`
- B: `Variant B: over the traveler's shoulder toward Hajime's open hand.`
- C: `Variant C: closer on the cloth, the tongs and his hands, his face in the upper part.`

**検品**：4-03と同じ顔・同じ外套。トングがクナイ型でない。煙が台から出ていない。HMDあり。

## 4-15 `cg_ch4_sheikh_reveal`

**参照**：本人 `assets/sprites/characters/sheikh/chr_sheikh_normal.png`・`assets/sprites/characters/naru/chr_naru_normal.png`・`assets/sprites/characters/master_hookah/chr_master_hookah_normal.png`／場所 `assets/backgrounds/bg_dubai_grand_smoke_stage.png`／画風 `assets/cgs/cg_ch4_world_handshake.png`
**台本**：`ch4_tournament_start`「歓声が、一瞬だけ止んだ。男は急ぐでもなく、自分の台の前に立つ。」〜「約束どおり、また吸いに来た。…」

**機材8行**
```text
人物      : シェイク（4つ目の台の前。正装）、なる（手前左。肩と横顔）、王煙楼（3つ目の台）
場面      : 準備中（ボウル未装着）。ステムの先は小さな凸型の金属ポストだけ。ハガル・HMD・炭・煙なし
台の型    : 大会支給の同じ銀の台が4台
HMD       : なし（未装着なので描かない）
炭        : なし
ホース    : 各台1本。側面ポート → 作業台へたわむ → 台に寝かせた硬いハンドル
吸い口    : なし
構図      : はじめ視点。自分の台の端に手。4台が一列に並び、奥の台ほど小さい
```

```text
Scene: chapter 4, GRAND SMOKE, the world final in Dubai, the very start (use the attached stage). Four identical competition stations in a row on a big stage; a packed dark audience beyond; warm spotlights. First-person from Hajime at his own station: his hand rests on the edge of his counter at the lower left, above the bottom quarter. On the near left, Naru at the next station, his shoulder and profile turned the same way as the viewer. At the far end of the row, at the fourth station, the man who has just walked in stands calmly before his station in a white kandura and a white ghutra with a black agal (same man as the attached sheikh sprite): the same face as the plain traveler Hajime met in the market, now in formal dress. A spotlight catches him; the crowd's cheer has stopped for a moment (frozen audience silhouettes). At the third station, Wang Yanlou (same man as the attached sprite: elderly master, long white braid and beard, crimson high-collared jacket) glances toward him. Hajime's surprise is told only by the camera turning toward the far end. No judges' table in frame, no banners or screens with letters.
Hardware precedence: this scene is BEFORE setup. The structure rule below applies only to the parts actually present: no bowls, no HMD, no coals, no smoke; each stem ends in a small convex metal post.
```

**3案の振り方**
- A: `Variant A: as described, the row of stations receding to the far right.`
- B: `Variant B: more distant, the Sheikh small but clearly lit by his spotlight.`
- C: `Variant C: a longer lens that compresses the four stations, Naru's shoulder softly blurred in front.`

**検品**：4台とも未装着（ポストだけ）。審査席・太陽が写っていない。シェイクの顔が4-03・4-05と同じ人物。

## 4-19 `cg_ch4_young_sumi_water`

**参照**：本人 `assets/sprites/characters/sumi/chr_sumi_normal.png`・`chr_sumi_thinking.png`（若い頃に描き直す元）／場所 `assets/backgrounds/bg_dubai_alley_cafe_night.png`（カウンターと壁だけ。時間帯は変える）／画風 `assets/cgs/cg_ch4_dubai_arrival.png`
**台本**：`ch4_ending` シェイクの「注文より先に、水が置かれた」〜「カルダモンだけの、軽い一台だった」（回想の挿入）

```text
Scene: chapter 4, a memory from fifteen years ago, told by the Sheikh. NOT first-person. The same small old cafe in a Dubai back alley as the attached room (same old wooden counter and walls), but in late-afternoon daylight, with slightly faded, warm memory tones, still the same clean anime rendering: no sepia filter, no film grain, no vignette blur. Behind the counter, a young Sumi: the same man as the attached sprite but about 31 years old: same face design, black flat cap, square black glasses, a shorter and neater beard, a slimmer build, a plain dark shirt with rolled sleeves and a borrowed cafe apron. Before any order is taken, he sets a glass of water in front of a customer. The customer is a tired man in plain travel clothes seen only from behind (a younger version of the traveler, about 37; his face is never shown), sitting a little slumped on a stool. Sumi's expression is quiet and attentive, a little worn himself (he lost a final yesterday), not a broad smile. No hookah set up, no trophy, no medal, no text.
```

**3案の振り方**
- A: `Variant A: over the customer's shoulder, Sumi facing the viewer across the counter.`
- B: `Variant B: a side view along the counter, both men in profile (the customer's face hidden by his hood).`
- C: `Variant C: wider, the whole small room in afternoon light.`

**検品**：若いスミさんが今の立ち絵と同じ人物に見える。客の顔が見えない。古い写真風の加工をしていない。**若い頃の見た目（帽子・ひげ）はこの採用で決まる**ので、オーナーが確認する。

## 4-11 `cg_ch4_noor_pencil_x`

**参照**：本人 `assets/sprites/characters/noor/chr_noor_normal.png`・`chr_noor_smile.png`／場所 `assets/backgrounds/bg_dubai_cafe_salim_day.png`／画風 `assets/cgs/cg_ch4_dubai_arrival.png`
**台本**：`ch4_noor_story_pencil_line`「彼女は鉛筆の尻で、×のまんなかをこつんと叩いた。」〜「で、ハジメを乗せるなら二本目。…」

```text
Scene: chapter 4, Dubai, Cafe Oasis, the cafe of Noor's father with a desert-tour desk (use the attached room), daytime. On the table lies a hand-drawn pencil route map of the dunes with NO words or numbers: wavy dune contours, one old pencil line that was never erased, a small × mark beside it, and a fresh second line drawn a little apart with gentler curves. Noor (27; same woman as the attached sprite: sun-tanned, black hair loosely tied back, thin beige scarf around her neck, khaki outdoor shirt with rolled sleeves, sunglasses on her head) taps the middle of the × with the eraser end of her pencil, grinning: rueful pride about the day she got her car stuck in the sand. Hajime leans in from the near side; only his forearm and hand on the table. Bright desert daylight through the window. No religious symbols, no hookah, no text on the map.
```

**3案の振り方**
- A: `Variant A: over the table, the map in the center, Noor across from the viewer.`
- B: `Variant B: Noor's face larger, the map and pencil in the lower middle (above the bottom quarter).`
- C: `Variant C: a side angle along the table.`

**検品**：地図に文字・数字なし。×と線が2本読める。ヌールの顔が立ち絵と同じ。

## 4-09 `cg_ch4_creek_dhow`

**参照**：袖と手 `assets/sprites/characters/hajime/chr_hajime_normal.png`（服だけ）／色調 `assets/backgrounds/bg_dubai_souq_day.png`（色だけ）／画風 `assets/cgs/cg_ch4_dubai_arrival.png`
**台本**：`ch4_creek_dhow`「男たちが一列に並んで、荷を手から手へ放っていく。」〜「積み上がっていく荷は、雑に見えて、どの段も平らにならされていた。」

```text
Scene: chapter 4, Dubai Creek, daytime. An old wooden dhow with a high curved bow is moored at the quay. On the quay, a mountain of mixed cargo: sacks, cardboard boxes, a refrigerator wrapped in plastic, bundles of tyres. A line of workers passes the cargo from hand to hand onto the boat with short calls, never stopping; on the deck the cargo is stacked in tiers, each layer leveled flat: heavy items at the bottom, light and water-sensitive items on top. Hajime watches from outside the line at the near edge: only his hand on a quay railing and his black hoodie sleeve. Blue water, hot white sun, low sandstone-colored buildings across the creek. The workers are ordinary, dignified working people seen mostly in motion, faces small and natural, no caricature. No text on boxes or on the boat, no flags, no logos. No hookah.
```

**3案の振り方**
- A: `Variant A: along the line of workers toward the boat.`
- B: `Variant B: from slightly above, looking down on the leveled tiers on deck.`
- C: `Variant C: a wide view of the creek, the boat and the quay.`

**検品**：荷の段が平らに見える。箱・船体に文字なし。人物が戯画化されていない。

---

# 第5章

## 5-10 `cg_ch5_doctor_yunomi`（試作）

**参照**：本人 `assets/sprites/characters/dr_kemuri/chr_dr_kemuri_normal.png`・`chr_dr_kemuri_smile.png`／場所 `assets/backgrounds/bg_tonari_inside_day.png`／画風 `assets/cgs/cg_ch1_dr_kemuri_hook.png`
**台本**：`ch5_unrecorded_day`「戻ると、博士は湯のみを両手で包んでいた。大会の映像は止まったままだ。」〜「……さて。勝負の日の話を、しましょうか」

```text
Scene: chapter 5, daytime at tonari (use the attached room). Dr. Charcoal (38; same man as the attached sprite: messy dark brown hair, black square glasses, green eyes, short stubble, open-collar white shirt, white lab coat with green and brown stains and three pens in the breast pocket) sits at the counter, today as a customer. He has pushed his laptop to the side; its screen shows a paused, blurred video frame with no readable interface. He holds a Japanese teacup (yunomi) in both hands, warming them, and the warm amber light of the shop falls on his lab-coat sleeve. His expression is quiet, a little caught off guard, thinking. Seen at an angle from the guest side: the viewer is Hajime coming back from serving another customer, his hand holding a water pitcher at the near edge. Sumi is out of frame. No hookah in frame.
```

**3案の振り方**
- A: `Variant A: diagonal view, the doctor and the pushed-aside laptop together.`
- B: `Variant B: across the counter, the doctor facing the viewer.`
- C: `Variant C: closer on his hands around the teacup and his face.`

**検品**：パソコンの画面が読めない。白衣の染みとペン3本。台が写っていない。

## 5-21 `cg_ch5_party_toast`

**参照**：本人 `assets/sprites/characters/sumi/chr_sumi_smile.png`・`assets/sprites/characters/naru/chr_naru_smile.png`／場所 `assets/backgrounds/bg_tonari_inside_night.png`／画風 `assets/cgs/cg_ending_tonari_night.png`
**台本**：`ch5_party_open`「グラスが鳴って、拍手が起きた。」〜「今日だけなんだ」

```text
Scene: chapter 5, a weekend night; tonari has closed early for a private celebration (use the attached room with its irregular Turkish mosaic pendant lamps). Hajime has just walked in as the guest of honor. Sumi (46; same man as the attached sprite) raises his glass toward the viewer with a rare, open, proud smile: "Congratulations, world champion." Beside him, Naru (23; same man as the attached sprite) raises his glass too, with a teasing grin. Behind them, several guests at the tables are seen only as soft, out-of-focus backs and silhouettes raising glasses and clapping: no identifiable faces, no specific heroines. In the background someone holds up a phone with a dark screen (they were just stopped from replaying the world final video). Plain glasses with no branding. Warm, noisy, happy. No hookah in frame, no banners, no text.
```

**3案の振り方**
- A: `Variant A: from the entrance, Sumi and Naru in the middle distance, guests behind.`
- B: `Variant B: closer on Sumi and Naru raising their glasses.`
- C: `Variant C: wider, the whole room celebrating, the two still clearly in focus.`

**検品**：はっきり顔が分かるのはスミさんとなるだけ（ほかの客は誰とも読めない）。エンディングCG（閉店後にグラスを伏せる構図）に似せていない。

## 5-14 `cg_ch5_regular_hose_lap`

**参照**：場所 `assets/backgrounds/bg_smoke_lab.png`／奥の機体 `assets/sprites/characters/shisha_9000/chr_shisha_9000_normal.png`／画風 `assets/cgs/cg_ch5_shisha_9000.png`／機材の写真1枚
**台本**：`ch5_relationship_before_second_cup`「帰郷した夜、水を先に出した客がいた。今日はホースを膝に置いて、待っている。」〜「うん。今日は時間、あるから」

**機材8行**
```text
人物      : 名前のない常連客（第2・3章と同じ人。30代の会社員）、SHISHA-9000（奥・ぼかし）
場面      : 完成・喫煙（二台目の前。客は一度吸って、ホースを膝に置いて待っている）
台の型    : SMOKE LABの白とステンレスの角型モダンの台（背景と同じ型）、透明なガラスベース
HMD       : シリコンボウル＋ロータス型HMD
炭        : HMDの中に2〜3個
ホース    : 側面ポート → 卓からたわむ → 客の膝の上の硬いハンドル
吸い口    : ハンドル先端に使い捨てチップ
構図      : 客席の目線。客は最前列の椅子、台は客と同じ奥行き。奥の同型の台に9000（ぼかし）
```

```text
Scene: chapter 5, the final match at SMOKE LAB, just before the second hookah (use the attached lab). A regular customer of tonari, an ordinary office worker in their early thirties in business casual with a wristwatch, sits in the front row of guest chairs with the hose handle resting on their lap, waiting. They have just looked up at the viewer after a breath, relaxed, with a small easy expression: "Today, I've got time." The viewer is Hajime at his table, at the customer's eye level, not across a competition counter. Behind, the other guests as soft silhouettes; on the far side, out of focus, the white humanoid robot SHISHA-9000 (same design as the attached sprite) at its own identical table. Clean white and pale-wood lab. No numbers on any screen, no vote boards.
Hardware note: Hajime's single hookah stands on the table at the customer's depth; its one hose runs from the side port down to the handle on the customer's lap.
```

**3案の振り方**（客の性別は台本で決まっていないので、3案で振ってオーナーが決める）
- A: `Variant A: the customer is a man; seated three-quarter view, the hookah to his side.`
- B: `Variant B: the customer is a woman; front view across the small table.`
- C: `Variant C: the customer is a man; a slightly wider view with more of the guest rows and the far robot.`

**検品**：9000がぼけていて主役にならない。画面・票の数字なし。**この客の見た目は後の章でも同じ人として使う**ので、採用時に記録する。

## 5-19 `cg_ch5_cocreation_notes`

**参照**：本人 `assets/sprites/characters/dr_kemuri/chr_dr_kemuri_normal.png`・`assets/sprites/characters/shisha_9000/chr_shisha_9000_normal.png`／場所 `assets/backgrounds/bg_smoke_lab.png`／画風 `assets/cgs/cg_ch5_shisha_9000.png`／機材の写真1枚
**台本**：`ch5_doctor_cocreation`「博士が胸ポケットのペンを抜いた。画面の数字と、俺の言葉を、メモに並べて書く。」〜「隣で、9000が二人の手元を見ていた。…」

**機材8行**
```text
人物      : 博士（メモを書く）、SHISHA-9000（卓の横で二人の手元を見る）
場面      : 完成・喫煙（二人で作った一台。はじめが吸い出した直後）
台の型    : SMOKE LABの白とステンレスの角型モダンの台
HMD       : シリコンボウル＋ロータス型HMD
炭        : HMDの中に2〜3個
ホース    : 側面ポート → 卓 → はじめが持つ硬いハンドル
吸い口    : ハンドル先端に使い捨てチップ
構図      : 半分消灯したラボの中距離。台は三者と同じ奥行き
```

```text
Scene: chapter 5, after the match, SMOKE LAB with half of the guest lights turned off (use the attached lab); only the doctor, the robot and Hajime remain, making one hookah together. Dr. Charcoal (same man as the attached sprite) sits at the table, having just pulled a pen from his breast pocket, writing two kinds of notes side by side in a small notebook (scribbles only, unreadable); a monitor beside him shows abstract curves with no numbers. Hajime's hand on the near side holds the hose handle; he has just tasted and described the flavor. SHISHA-9000 (same design as the attached sprite: slender white armor, silver and black joints, gold seams, violet and blue lights, a robotic mask face with no human skin or hair) stands beside the table, head tilted slightly down, watching their hands, still and attentive, touching nothing. Cool lab light with one warm desk lamp. Quiet, after the noise.
Hardware note: one finished hookah between the three at the same depth; one hose from its side port to the handle in Hajime's hand; the robot never holds a hose; no smoke from the equipment.
```

**3案の振り方**
- A: `Variant A: a side three-shot, the doctor, the hookah and the robot in one line.`
- B: `Variant B: over Hajime's shoulder toward the doctor's notebook, the robot behind him.`
- C: `Variant C: wider, the half-dark lab around the one lit table.`

**検品**：メモ・画面に読める数字なし。9000が何も持っていない。ホース1本。

## 5-20 `cg_ch5_sumi_pulls_chair`

**参照**：本人 `assets/sprites/characters/sumi/chr_sumi_normal.png`／場所 `assets/backgrounds/bg_tonari_inside_night.png`／画風 `assets/cgs/cg_ending_tonari_night.png`（描き方だけ。構図は使わない）
**台本**：`ch5_return_to_tonari`「tonariへ帰ると、先に戻っていたスミさんが、カウンターの椅子を引いた。」〜「（混ざったままで、俺だった）」

```text
Scene: chapter 5, the night of the final match. Hajime opens tonari's door (use the attached room with its mosaic lamps). Sumi, who came back first, has pulled out a counter chair for him. View from the door at Hajime's eye level: the back of the chair turned slightly toward the viewer, Sumi's hand still resting on its backrest. Sumi (same man as the attached sprite: charcoal shirt with rolled sleeves, brown waist apron) is shown from the chest down, or with his face turned away and shadowed by his cap brim; his face is not the focus, the hand and the chair are. Two glasses of water on the counter. Warm and quiet. Do NOT repeat the ending still's composition: no glass being set on a towel, no frontal Sumi behind the counter. No hookah, no trophy, no text.
```

**3案の振り方**
- A: `Variant A: Sumi's face cut off by the top of the frame; hand and chair in the center.`
- B: `Variant B: Sumi's face turned away under the cap shadow.`
- C: `Variant C: wider, Sumi small and in shadow, the chair lit by a lamp.`

**検品**：エンディングの `cg_ending_tonari_night` と並べて別の絵に見える。椅子と手が上65%。

## 5-07 `cg_ch5_tsumugi_serves_hajime`

**参照**：本人 `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png`・`chr_tsumugi_smile.png`／場所 `assets/backgrounds/bg_tonari_inside_day.png`／画風 `assets/cgs/cg_tsumugi_smoke_color.png`／機材の写真1枚
**台本**：`ch5_tsumugi_makes_for_hajime`「お待たせしました。最初は、ゆっくりどうぞ」〜「……うまい。熱が、ちょうどいい」

**機材8行**
```text
人物      : つむぎ（エプロン姿でハンドルを渡す）
場面      : 完成・喫煙（提供の瞬間。まだ誰も吸っていない）
台の型    : 日本の店の業務用。ステンレスの細いステム＋幅の広いガラスベース
HMD       : シリコンボウル＋ロータス型HMD
炭        : HMDの中に2〜3個
ホース    : 側面ポート → 卓 → つむぎが両手で差し出す硬いハンドル
吸い口    : ハンドル先端に使い捨てチップ
構図      : 奥の席から。台は卓の上で、つむぎと同じ奥行き
```

```text
Scene: chapter 5, daytime at tonari (use the attached room). It is Hajime's day off; he came as a customer and sits in the back seat where Tsumugi used to draw. Tsumugi (21; same woman as the attached sprite: petite, brown bob with straight bangs, reddish-brown eyes, small earrings, oversized purple zip hoodie with floral embroidery on the sleeves, now with a plain brown waist apron like the shop owner's over it) hands him the hose handle with both hands, a small careful nod, a quiet, serious little smile: "Take it slowly at first." Hajime's hand reaches in from the lower right to receive it. Calm, soft lavender-tinted daylight. No tablet, no sketchbook.
Hardware note: one finished hookah on the table at Tsumugi's depth; its one hose runs from the side port to the handle she is offering; no smoke yet.
```

**3案の振り方**
- A: `Variant A: from the back seat, Tsumugi standing at the table edge and offering the handle.`
- B: `Variant B: a side view, both hands meeting at the handle in the upper middle.`
- C: `Variant C: closer on Tsumugi's face and her two hands on the handle.`

**検品**：つむぎの顔・パーカーが立ち絵と同じ。タブレット・スケッチブックなし。ホース1本・HMDあり。

## 5-06 `cg_ch5_adam_two_bowls`

**参照**：本人 `assets/sprites/characters/adam/chr_adam_normal.png`・`chr_adam_serious.png`／場所 `assets/backgrounds/bg_eden_shop.png`／画風 `assets/cgs/cg_ch1_sumi_training.png`／機材の写真1枚
**台本**：`ch5_free_eden_adam`「順に吸う。アダムは黙って、こちらの顔を見ていた。」〜「……分かる日が来たな」

**機材8行**
```text
人物      : アダム
場面      : 完成・喫煙（二台を順に吸ったあと）
台の型    : 2台とも同じ型。ステンレスの細いステム＋幅の広いガラスベース（ガラスの色だけ赤と緑）
HMD       : 2台とも同じシリコンボウル＋ロータス型HMD
炭        : 各HMDの中に2個
ホース    : 各台1本。側面ポート → 卓 → 硬いハンドル。片方ははじめの手、もう片方は卓に寝かせる
吸い口    : ハンドル先端に使い捨てチップ
構図      : カウンター越し。2台はアダムと同じ奥行きで受け皿とステム上部が写る
```

```text
Scene: chapter 5, EDEN, Adam's apple-themed shisha shop (use the attached room). Adam (28; same man as the attached sprite: hair green on HIS OWN left side and red on HIS OWN right side, so in a front view the screen-left side is red and the screen-right side is green; short hairstyle, black henley shirt, waist apron) has made two hookahs from two different tubs of double apple and watched Hajime taste them in turn. Now he leans forward on the counter, chin on his laced fingers, silent, studying the viewer's face with intense, quiet attention; no grand performance this time. Two identical hookahs stand between them (one with a red-tinted glass base, one green); the viewer's hand holds the hose handle of one, the other handle lies on the counter. Beside them, two lidded tubs with small handwritten stickers that are unreadable scribbles. Apple red and green accents, a calm mood.
Hardware note: both hookahs are modest props at Adam's depth; each has exactly one hose from its own side port to its own handle; the two hoses never cross into one; no smoke from the equipment.
```

**3案の振り方**
- A: `Variant A: across the counter, Adam centered between the two hookahs.`
- B: `Variant B: from a slight side angle, the two hookahs in a row and Adam beyond.`
- C: `Variant C: closer on Adam's face and laced fingers, the hookahs lower in the frame (above the bottom quarter).`

**検品**：髪の左右（正面で画面左が赤）。2台とも同じ型・HMD。ホースが各1本で交差して溶けていない。タッパーのシールが読めない。
