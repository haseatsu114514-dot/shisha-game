# Issue #3420 LIME アイコン原画

6人の本人寄り A 案と物モチーフ B 案。PNG 原画を無加工・不透明で保存。オーナーが各人1枚を選ぶ。ゲームへの組み込みは Claude 側。

## ファイル・参照画像・SHA-256

| 原画 | 参照画像（役割） | SHA-256 |
|---|---|---|
| `noor-a.png` | `assets/sprites/character_variants/new/noor/chr_noor_normal.png（人物の正）`<br>`assets/ui/face_icons/face_noor.png（顔比較）`<br>`assets/ui/lime/rio-a.png（画風・形式）` | `49ee87f2fd3adefeaa9f916e3e609b935aa62a3928888904320b126afc3ff4dd` |
| `noor-b.png` | `assets/ui/lime/volk-a.png（画風・形式）`<br>`assets/ui/lime/kumicho-b.png（画風・形式）` | `dd2b9303a61a8db60fdcda35df940f094bd0148999076b79e1231c5cae3e15b8` |
| `saku-a.png` | `assets/sprites/character_variants/new/saku/chr_saku_normal.png（人物の正）`<br>`assets/ui/face_icons/new/face_saku.png（顔比較）`<br>`assets/ui/lime/sui-a.png（画風・形式）` | `726584c796a89dc8cdf1f07e00623544a3e7e410ea4c238df1f3b96828eb1605` |
| `saku-b.png` | `assets/ui/lime/volk-a.png（画風・形式）`<br>`assets/ui/lime/kumicho-b.png（画風・形式）` | `1c00fc14a490410ca3dc47784ac7b342d6bd17bf7bc7738f31182af3958e6e2c` |
| `steve-a.png` | `assets/sprites/character_variants/new/steve/chr_steve_normal.png（人物の正）`<br>`assets/ui/face_icons/new/face_steve.png（顔比較）`<br>`assets/ui/lime/sui-a.png（画風・形式）` | `9892643e285d16745d036852537458f72c41f8fe9aaa8c6c5b1e681ec1c10f95` |
| `steve-b.png` | `assets/ui/lime/volk-a.png（画風・形式）`<br>`assets/ui/lime/kumicho-b.png（画風・形式）` | `bbf15a7c42d1fd422b5d983561c2d7060e989e6ac3ee67ee55adb5bceb5550e7` |
| `master_hookah-a.png` | `assets/sprites/character_variants/new/master_hookah/chr_master_hookah_normal.png（人物の正）`<br>`assets/ui/face_icons/new/face_master_hookah.png（顔比較）`<br>`assets/ui/lime/sui-a.png（画風・形式）` | `d5449f0118f3d7cae145c59731990fb12f895cc4cce10f845bd9e648cdb43cf0` |
| `master_hookah-b.png` | `assets/ui/lime/volk-a.png（画風・形式）`<br>`assets/ui/lime/kumicho-b.png（画風・形式）` | `6e9499569a6fb33d910f6c07ea2d469822206d6436e225ba32075ef5af77b85f` |
| `da_silva-a.png` | `assets/sprites/character_variants/new/da_silva/chr_da_silva_normal.png（人物の正）`<br>`assets/ui/face_icons/new/face_da_silva.png（顔比較）`<br>`assets/ui/lime/sui-a.png（画風・形式）` | `1d83e15126f1a13752cf23f33480970bd4797bcd7617fd51d17d668614cc2cda` |
| `da_silva-b.png` | `assets/ui/lime/volk-a.png（画風・形式）`<br>`assets/ui/lime/kumicho-b.png（画風・形式）` | `90be9a7118c90b5d34997f193a90c6dfc01d2f5b19387428396ab46306e0f4b5` |
| `mukai_master-a.png` | `assets/sprites/character_variants/new/mukai_master/chr_mukai_master_normal.png（人物の正）`<br>`assets/ui/face_icons/new/face_mukai_master.png（顔比較）`<br>`assets/ui/lime/sui-a.png（画風・形式）` | `1810b0b79e151392b01490dab58ab401b5184c1d3fa8fce701dc29c2bff73b9c` |
| `mukai_master-b.png` | `assets/ui/lime/volk-a.png（画風・形式）`<br>`assets/ui/lime/kumicho-b.png（画風・形式）` | `769283e19820d4958d3ef6f7cbd593831d4295134f7c2fbcbf971cc40598daa1` |

## 検品

全12枚は 1254×1254、RGB・不透明、文字・ロゴ・シーシャ機材なし。人物案は新版立ち絵の顔・髪・服を参照。丸抜き縮小で各主題を識別できる。

厳密な中央70%の安全円から、人物の肩や手、`noor-a.png` のサングラス、`noor-b.png` のボード先端などがはみ出す。`noor-b.png` は同じ依頼文で3回生成し、最も中心に収まる3案目を保存した。その他は既存の `noor-a.png` を含め各1案を保存。採否と円形表示の確認をお願いする。

## 依頼文全文（Issue #3420 §4-A）

```text
【対象】ゲーム内のチャットアプリ「LIME」のアカウントアイコン。6人×2案＝12枚（A＝本人寄り／B＝物モチーフ。オーナーが1人1枚えらぶ）
【使い方】1回の生成で1枚。12枚を1枚のシートにまとめない。各「--- n/12 ---」の前に、下の COMMON RULES を毎回つけて生成する。
【保存先】asset_sources/lime-icons-20261111/ に、各ブロックのファイル名で保存（無加工・縮小しない）。依頼文の全文・添付した画像のパス・各ファイルの sha256 を asset_sources/lime-icons-20261111/README.md に書く。成果は Draft PR に原画として出す（ゲームへの組み込み・lime-icons.js の変更はしない）。画像は Git LFS（AGENTS.md の規則。git add のあと git lfs ls-files で確認）。
【サイズ】正方形1:1・1024x1024以上・PNG・不透明（背景色あり）。ゲームでは丸く切り抜いて 28〜136px で出す。主題は中央の円（幅の約70%）に収める。四隅は切れてよい。
【添付する画像（役割を区別する）】
1. 本人（顔・髪・服・年齢感の正）: assets/sprites/character_variants/new/<id>/chr_<id>_normal.png
2. 今の代わりの顔（顔の比べ用）: assets/ui/face_icons/new/face_<id>.png（ヌールだけ assets/ui/face_icons/face_noor.png）
3. 採用済みアイコンの例（形式と画風の参考だけ。内容は真似しない）: A案は男性 assets/ui/lime/sui-a.png、女性 assets/ui/lime/rio-a.png ／ B案は assets/ui/lime/volk-a.png と assets/ui/lime/kumicho-b.png
（B案には 1・2 は要らない）
【方針】オーナー「LIMEアイコン。本人用・私用のどちらか1枚でよい。本人寄りか物モチーフ」。その人が自分で選んで設定しそうなアイコンにする。前回の没理由: 細長い物・細い線の物は小さいと分からない → 太く単純な形にする。

COMMON RULES (apply to every icon below):
This is the profile icon that this character would choose for his or her own account in a LINE-like chat app inside a cozy slice-of-life visual novel about shisha shops. Square 1:1 image, 1024x1024 or larger, opaque background. It will be shown cropped to a circle at 28-136 px, so: one clear subject, large and centered inside the central circle (about 70% of the width), strong simple silhouette and value contrast that still reads at 28 px, plain or softly blurred background; the corners may be cropped.
Style: match the attached adopted icons (image 3). Person icons use the same calm anime-style painting as the game's character art (clean confident linework, soft cel shading, warm gentle light). Object icons are a soft painterly still life with a warm edge light and a minimal plain or dark background.
Person icons: exactly one person, the SAME person as image 1 (same face, eye color, hairstyle, skin tone, age, body type and clothes). Do not redesign, rejuvenate or beautify into a different person; adult facial proportions. Head, hair and hat fully inside the circle with a safe margin. No phone or camera visible. No other people.
Never include: any text, letters, numbers, numerals or tick marks on dials, logos, brand marks, signatures, watermarks, UI, frames, borders, circle masks or stickers; any shisha or hookah equipment (hookah, bowl, heat management device, charcoal, hose, tongs) and no Chinese water pipe; no cigarettes or cigars; no thin long tool as the main subject; no religious symbols.

--- 1/12: noor-a.png（ヌール・本人寄り。添付 1・2・3=rio-a.png）---
Noor Al-Salim, 27, from the UAE: a cheerful, energetic desert tour guide who also helps at her father's shisha cafe; a caring big-sister type who laughs easily. Tanned skin, dark hair loosely tied back, sunglasses pushed up on her head, a thin beige sand scarf around her neck, khaki outdoor shirt with rolled sleeves, as in image 1. Selfie-like close head-and-shoulders shot on top of a sand dune in warm late-afternoon light, the wind lifting the scarf a little, big bright grin, eyes to the viewer. Background: a soft orange dune ridge and pale sky, simple and blurred. Not resembling any real person.

--- 2/12: noor-b.png（ヌール・物モチーフ。添付 3=volk-a.png・kumicho-b.png）---
A single sandboard planted upright in a rippled sand dune at golden-hour sunset, seen from a low angle, with a long soft shadow and a few grains of blowing sand. The board is wide and chunky, plain warm orange and cream with one simple stripe, with NO letters or logos. Large bold silhouette in the center, warm sky gradient behind. No people, no vehicles, no animals.

--- 3/12: saku-a.png（綾取・本人寄り。添付 1・2・3=sui-a.png）---
Jin Ayatori, 23, a young Japanese shisha shop owner who spreads exaggerated rumors about his own shop for fun; friendly and light, a little unreliable, hard to read. Slim compact build, soft round face, uneven wavy espresso-brown hair, warm amber eyes, a one-sided, faintly knowing smile; same clothes as image 1. Close head-and-shoulders shot, three-quarter view. He holds one small cream-colored tasting card up beside his cheek between two fingers, as if keeping a secret; the card is completely blank. Dim warm background of softly blurred hanging fabric partitions.

--- 4/12: saku-b.png（綾取・物モチーフ。添付 3=volk-a.png・kumicho-b.png）---
A small closed indigo notebook lying at a slight angle on a dark wooden counter, with one blank cream-colored tasting card tucked between its pages and sticking out like a bookmark. Notebook and card are completely blank (no writing, no marks, no suits, no pictures); it must not look like a tarot or playing card. Chunky simple shapes, centered; dark warm background with a soft side light. Playful but slightly mysterious mood.

--- 5/12: steve-a.png（スティーブ・本人寄り。添付 1・2・3=sui-a.png）---
Steve A. Ash, 30, a white American shisha craftsman who works at low heat and keeps time with a small timer; cheerful with guests, exact about seconds. Round heavy build, warm focused eyes behind vintage glasses, short dark curly hair, neat beard, colorful retro geometric-pattern camp shirt under a dark work apron, as in image 1. Friendly selfie-like head-and-shoulders shot with a warm grin, holding a small round chrome kitchen timer up next to his cheek; the timer dial is blank (one small pointer only, no numbers, no ticks). Warm diner-like background, softly blurred. Draw his body type naturally and respectfully, never as a joke.

--- 6/12: steve-b.png（スティーブ・物モチーフ。添付 3=volk-a.png・kumicho-b.png）---
A halved lemon and a halved lime side by side with their juicy cut faces up, next to a small round chrome kitchen timer whose dial is blank (one pointer only, no numbers, no ticks), on a warm wooden counter. Fresh and bright; all three chunky objects close together in the center; dark teal background with a soft warm light.

--- 7/12: master_hookah-a.png（王煙楼・本人寄り。添付 1・2・3=sui-a.png）---
Wang Yanlou, 58, a dignified Chinese master shisha craftsman known by the title "Master Hookah"; short but proud and upright like an old martial artist; calm, few words, sharp yet gentle eyes. Long white hair in a single braid, long white beard tied at the end, thick sharp white eyebrows, deep wrinkles, tanned skin, deep crimson high-collared jacket with black frog-knot buttons, as in image 1. A formal bust portrait rather than a selfie: three-quarter view, calm sharp gaze to the viewer with the faintest smile, hands not shown. Plain deep jade-green to charcoal background with a soft warm rim light. No magic aura, no smoke dragon, no talismans.

--- 8/12: master_hookah-b.png（王煙楼・物モチーフ。添付 3=volk-a.png・kumicho-b.png）---
A small cluster of fresh red lychees on a dark lacquered wooden tray, one lychee peeled to show its glossy translucent white flesh, with a single green leaf. Bold rounded shapes, centered; plain deep jade-green background with a warm light. A dignified, quiet still life. No cups.

--- 9/12: da_silva-a.png（太陽・本人寄り。添付 1・2・3=sui-a.png）---
Taiyo (Henrique da Silva Taiyo), 28, a Japanese-Brazilian shisha showman whose motto is that shisha is a festa; sunny, overwhelmingly cheerful, a generous host. Tanned skin, athletic build, dark curly hair, wide joyful grin, vibrant green tropical shirt with red and yellow hibiscus open over a white tank top, as in image 1. Energetic selfie-like head-and-shoulders shot, laughing with one eye winking, one open hand raised beside his face in a big wave (the hand fully inside the circle). Bright sunny background with soft colorful bokeh like a street festival.

--- 10/12: da_silva-b.png（太陽・物モチーフ。添付 3=volk-a.png・kumicho-b.png）---
One halved passion fruit showing bright golden pulp and dark seeds, next to one whole wrinkled purple passion fruit, on a warm surface, in front of a bright sunny orange-and-yellow background with soft sun rays. Bold, cheerful, simple, centered.

--- 11/12: mukai_master-a.png（ムカイさん・本人寄り。添付 1・2・3=sui-a.png）---
Shikari Mukai, 48, owner of the Tokyo cafe-shisha bar "mukai": he looks like a hard-boiled dandy but is gentle, speaks in a calm low voice, loves coffee and secretly prefers sweet lattes. Dark brown fedora worn low, black hair with some gray, well-trimmed beard, brown suit jacket over a dark vest and an open-collar white shirt, as in image 1. Head-and-shoulders shot in a dim warm cafe, the hat brim slightly shading his eyes, calm faint smile, holding a plain white coffee cup near his chest. The whole hat inside the circle with a margin. No cigar, no cigarette, no smoke.

--- 12/12: mukai_master-b.png（ムカイさん・物モチーフ。添付 3=volk-a.png・kumicho-b.png）---
A dark brown fedora hat resting on a wooden cafe counter beside a tall glass of sweet latte topped with a swirl of whipped cream and a drizzle of caramel: the hard-boiled hat next to a cute sweet drink. Both chunky and close together in the center; dim warm background. No cigar, no cigarette, no print on the glass.

【生成後チェック】丸く切り抜いて 28px に縮めても何か分かる／主題・頭・帽子が中央の円に収まる／本人寄りは image 1 と同じ顔・髪・肌の色・年齢感・体型（別人・若返りなし）／文字・数字・ロゴ・透かし・枠なし（タイマーの文字盤も無地）／シーシャの機材・水煙具・葉巻・たばこなし／スマホの写り込みなし／採用済みの林檎・紅茶・猫・カードのアイコンと並べて見分けがつく
```
