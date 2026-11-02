# 規格そろえ：生成プロンプト

[立ち絵の規格](../../../docs/portrait_standard.md)に合わせて、頭の大きさと画風だけを直す依頼文。
顔・表情・ポーズ・衣装・色・全身の高さは変えない。

参照画像はリポジトリのファイルを、エージェントが自分で読み込んで渡す（オーナーに保存・添付を頼まない）。

- ① 対象の表情の現行PNG `assets/sprites/characters/<id>/chr_<id>_<face>.png`（表情差分では、②の前に合格済みの新しい通常原画 `asset_sources/portraits/<id>-remaster-v2/normal-source.png` も入れ、顔の同一性と頭の大きさの基準にする）
- ② 南雲 `assets/sprites/characters/nagumo/chr_nagumo_normal.png`（大人の男性の頭身の目標。6.93頭身）。女性（マキ・路上占い師）は、標準枠の女性の凛 `assets/sprites/characters/rin/chr_rin_normal.png`（6.53頭身）を使い、文中の Nagumo / he を Rin / she に直す
- ③ みんと `assets/sprites/characters/minto/chr_minto_normal.png`・④ あげは `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

## 生成後チェック（1枚ごと）

- [ ] `portrait_metrics.py grid --image` で原画を測り（頭身は縮小しても変わらない）、頭身が区分の規格内（標準6.4〜7.7）。各キャラの「目標」は書き方の目安で、合否は規格の範囲で決める
- [ ] 現行と並べて、顔・表情・手と肩の位置・衣装・小物・体格・色が変わっていない
- [ ] 線・影・ハイライト・描き込みの量が、みんと・あげはと原寸で並べて同じ作品に見える（規格3節）
- [ ] 原画の人物の高さが1300px以上。透過がきれい（手足の間も）。床・影・文字が無い

## 試作3人（通常）

規格外の向きと程度が違う3人で、頭の大きさの直し方と画風の寄せ方を試す。合格したら同じ書き方で残りへ広げる。

### 組長（神崎竜二）（`kumicho`）・normal

現在 6.29頭身 → 目標 6.7頭身（頭を約6%小さく）。参照：① `assets/sprites/characters/kumicho/chr_kumicho_normal.png` ／ ② 南雲 ／ ③ みんと ／ ④ あげは

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, outfit, accessories and colors as image 1. Change ONLY two things: the head-to-body proportion below and the rendering style standard below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and colors. (2) approved Nagumo normal sprite: the TARGET head-to-body proportion of an adult man ONLY (not his face, hair, build or suit). (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 2, 3 and 4.

Character: Kanzaki Ryuji 'the Shisha Kumicho', mature middle-aged Japanese man with stern authority, slicked-back salt-and-pepper hair, moustache, brown aviator sunglasses, beige windowpane double-breasted suit, black shirt, purple tie and pocket square, black leather shoes.
Expression and pose to keep exactly as image 1 (normal: stern composed expression, both hands in trouser pockets, confident stance)

HEAD SIZE CORRECTION: in image 1 the head is too LARGE for the body (about 6.3 heads tall). Make the whole head (face, hair and ears) about 6% SMALLER relative to the body so that he is about 6.7 heads tall, closer to image 2. Keep the same total height from the top of the hair to the shoe soles, the same stance, silhouette and body build; only the head changes scale relative to the body, and the neck and shoulders stay natural. He must still look like the same man of the same age.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rin sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the top of the head (including any hat) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's original local color palette, perceived saturation and light-dark range; do not lighten, desaturate or pastelize anything.
```

### スティーブ（`steve`）・normal

現在 8.04頭身 → 目標 7.4頭身（頭を約9%大きく）。参照：① `assets/sprites/characters/steve/chr_steve_normal.png` ／ ② 南雲 ／ ③ みんと ／ ④ あげは

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, outfit, accessories and colors as image 1. Change ONLY two things: the head-to-body proportion below and the rendering style standard below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and colors. (2) approved Nagumo normal sprite: the TARGET head-to-body proportion of an adult man ONLY (not his face, hair, build or suit). (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 2, 3 and 4.

Character: Steve Davis, 30-year-old white American man, clearly obese rounded silhouette with large capable hands, short slightly tousled dark brown hair, short beard, glasses, patterned retro teal-and-cream shirt with abstract motifs (no letters), dark practical apron, brown trousers and shoes, holding a tiny kitchen timer and a recipe card.
Expression and pose to keep exactly as image 1 (normal: warm focused small smile, timer held up in one hand, recipe card in the other)

HEAD SIZE CORRECTION: in image 1 the head is too SMALL for the body (about 8.0 heads tall). Make the whole head (face, hair and ears) about 9% LARGER relative to the body so that he is about 7.4 heads tall, like image 2. Keep the same total height from the top of the hair to the shoe soles, the same stance, silhouette and body build; only the head changes scale relative to the body, and the neck and shoulders stay natural. He must still look like the same man of the same age.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rin sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the top of the head (including any hat) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's original local color palette, perceived saturation and light-dark range; do not lighten, desaturate or pastelize anything.
```

### ヴォルク（`volk`）・normal

現在 9.04頭身 → 目標 7.4頭身（頭を約22%大きく）。参照：① `assets/sprites/characters/volk/chr_volk_normal.png` ／ ② 南雲 ／ ③ みんと ／ ④ あげは

```
Redraw the attached CURRENT game sprite (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, age, expression, pose, hand and shoulder positions, outfit, accessories and colors as image 1. Change ONLY two things: the head-to-body proportion below and the rendering style standard below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and colors. (2) approved Nagumo normal sprite: the TARGET head-to-body proportion of an adult man ONLY (not his face, hair, build or suit). (3) approved Minto normal sprite and (4) approved Ageha normal sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 2, 3 and 4.

Character: Volk Ivanov, adult Russian man, tall and broad-shouldered, angular masculine face, very short ash-blond hair, pale blue eyes, black turtleneck, long charcoal coat, belt, black trousers and boots.
Expression and pose to keep exactly as image 1 (normal: serious reserved expression, arms relaxed at his sides, upright stance)

HEAD SIZE CORRECTION: in image 1 the head is too SMALL for the body (about 9.0 heads tall). Make the whole head (face, hair and ears) about 22% LARGER relative to the body so that he is about 7.4 heads tall, like image 2. Keep the same total height from the top of the hair to the shoe soles, the same stance, silhouette and body build; only the head changes scale relative to the body, and the neck and shoulders stay natural. He must still look like the same man of the same age.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rin sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure at least 1300 px tall from the top of the head (including any hat) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's original local color palette, perceived saturation and light-dark range; do not lighten, desaturate or pastelize anything.
```

## みんと営業姿（頭を私服に合わせる）

参照：① 対象の表情の現行PNG `assets/sprites/characters/minto/chr_minto_<face>.png` ／ ② みんと私服 `assets/sprites/characters/minto/chr_minto_ura_normal.png`（同じ人物の頭の大きさの目標）／ ③ あげは `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の確認だけ）。表情は normal・smile・sad・surprise・wink の5つ。営業姿はみんと自身が画風の基準なので、画風は変えない。

```
Redraw the attached CURRENT game sprite of Minto (image 1) as ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same face design, eyes, expression, pose, hands, outfit, accessories, colors and rendering style as image 1. Change ONLY the head size.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for everything except head size. (2) the SAME woman in her casual outfit: the TARGET head size relative to her body ONLY (not her clothes or pose). (3) approved Ageha sprite: rendering-quality check only; never copy her face, hair or outfit.

Character: Minto, adult Japanese woman with a youthful idol-like face, long straight black hair with blunt bangs, mint-green eyes, small black devil horns and bat-wing hair accessories, black and neon-green off-shoulder concept-cafe dress with a large green ribbon and heart choker, black thigh-high stockings and platform shoes.

HEAD SIZE: in image 1 her head is smaller relative to her body than in image 2 (about 7.0 heads tall versus about 6.4). Make her whole head (face, hair, horns) about 10% LARGER relative to her body so that she matches image 2, about 6.4 heads tall. Keep the same total height from the top of the hair to the shoe soles, the same stance and the same slim build; the neck and shoulders stay natural.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure at least 1300 px tall. Include all hair tips, horns, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background. No floor, cast shadow, glow, border, text or watermark. Preserve image 1's original colors, saturation and light-dark range.
```

## 試作1回目でわかったこと（2026-11-02）

Codex が上の3つの英文で各3案（計9案）を生成した。頭身は次のとおりで、指定した拡大率どおりにはならなかった。

| キャラ | 指定 | 結果（Codex の計測／Claude の計測） |
|---|---|---|
| 組長 | 6.29→6.7（頭を6%小さく） | A 7.17／7.41、B 7.45／7.17、C 7.10／6.75 |
| スティーブ | 8.04→7.4（頭を9%大きく） | A 6.89／6.80、B 6.99／6.98、C 6.88／6.74 |
| ヴォルク | 9.04→7.4（頭を22%大きく） | A 7.70／7.53、B 7.70／7.64、C 7.92／7.72 |

- 拡大率の指定は効かず、元の頭身にかかわらず約6.8〜7.7頭身に寄った。参照②（南雲・6.93頭身）に引っ張られたとみられる。残りの人は拡大率を書かず、「image 2 と同じ約7頭身」と書くほうが確実。
- 頭頂・あごの読み取りには1枚あたり±4px（約±0.2頭身）の差が出る。境目の案は2人で測る。
- 頭身のほかに、余白の不足（スティーブA・ヴォルクAは足底が画像の端に接する）、透明度の低いノイズ、髪・靴の艶の残りがあった。

## 残りの人（試作の結果を見てから書く）

試作の書き方に、各キャラの人物の行（`Character:`）と表情の行を入れて作る。人物の行は下の既存プロンプトから写す。頭の大きさは「約○%大きく」ではなく「image 2 と同じ約7頭身に」と書く（下の「試作1回目でわかったこと」）。

| キャラ | 現在 | 頭の拡大 | 表情 | 人物の行の出典 |
|---|---:|---:|---|---|
| 六角サイ（`sai`） | 8.39 | 約13% | normal・smile・serious・surprise・thinking | asset_sources/venue-staff/sai/normal-prompt.txt |
| 零-REI-（`rei`） | 8.67 | 約17% | normal・smile・serious・surprise・sad | asset_sources/ch2-characters/rei/normal-prompt.txt |
| 斧崎マキ（`maki`） | 8.74 | 約18% | normal・smile・serious・surprise・excited | asset_sources/venue-staff/maki/normal-prompt.txt |
| 路上占い師（`uranaishi`） | 8.78 | 約19% | normal・smile・serious・surprise・sad | asset_sources/portraits/style-unify-20261026/uranaishi/normal-prompt.txt |
| シェイク（`sheikh`） | 8.88 | 約20% | normal・smile・serious・surprise・smug | asset_sources/portraits/expressions-5-20261102/sheikh/prompt.txt |
| 王煙楼（`master_hookah`） | 8.98 | 約21% | normal・smile・serious・surprise・sad・angry・laugh | （原画の記録なし。data/characters.json の外見メモから書く） |
| ダ・シルヴァ太陽（`da_silva`） | 9.08 | 約23% | normal・smile・serious・surprise・excited | asset_sources/portraits/expressions-5-20261102/da_silva/prompt.txt |

上園（6.38頭身）は測定の誤差の範囲の境目なので、オーナーが望むときだけ作り直す。みんとの私服（営業姿より頭が12%大きい）は、どちらに合わせるかオーナーに聞いてから決める。
