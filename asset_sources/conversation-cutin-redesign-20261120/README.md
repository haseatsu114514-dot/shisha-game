# 会話カットインの再設計：専用の絵（はじめ）の依頼文

要望台帳 `docs/owner_requests.md` の CCR（2026-11-20）。オーナー「会話中にウインドウの近くにはじめの顔が出たりする演出ですが、実物をみた感じしっくりきません。安っぽく見えます」「画像生成はコーデックスを使います」。

いまの会話カットイン（`remake/js/vn/conversation-cutin.js`）は、全身の立ち絵（896×1200）の顔のあたりを切り抜いて縮めている。顔は元の絵で幅150pxほどしかないので、スマホの高精細な画面で線が甘くなる。2026-11-07 のオーナー決定（#2845）「残す案が決まったら、その案の分だけ専用の絵を2〜3枚作る」の分を、ここで作る。

- **状態**（2026-11-20）: 枠・出し方・置き場はオーナーが決定し（台帳 CCR02〜CCR04）、本編に組み込んだ。絵は動揺・沈み・受け取るの3枚が Codex から届き（PR #3978・`originals/`。検品は `originals/QC.md`）、ゲーム用に変換して組み込んだ。大会の決意は #3978 の対象外で仮の絵だったが、2026-11-28 に下の「4/5 決意」の依頼文のまま画像生成API（`gpt-image-2.6-sunburst`・1024×1024・透過・参照4枚は表のとおり）で作り、`originals/hajime_cutin_resolve.png` を 0.85 倍の透過 WebP にして差し替えた（要望台帳 VPT14。候補2枚から1枚。帽子〜あごの高さ 723px・両目が見える・ネックレスなし）。
- **作る枚数**: 動揺・沈み・受け取る・決意の4枚（2026-11-20 オーナー「それで良い」）。照れ（5/5）は今回は作らない。
- **絵の方針**（2026-11-07 オーナー指示・#2845）: 立ち絵の構図・距離感・体の向きを土台にし、視線・手の位置・頭や肩の角度の小さな変化で「カットインになった」と分かるようにする。別の一枚絵のように大きく変えない。立ち絵の表情差分と同じにもしない。
- **使い方**: 帯の中に、帽子のてっぺんから襟元までが入る。胸から下は帯で切れるので、仕草は顔の近く（帽子のつば・首・肩）に置く。

## 参照画像（1回の生成で4枚。リポジトリのファイルを渡す）

| 役割 | ファイル |
|---|---|
| ① 本人（顔・髪・帽子・服・色・画風）。最優先 | `asset_sources/portraits/library-candidates-20261105/new/hajime/<表情>-source.png`（新版の立ち絵の原画 1024×1536。表情は各依頼文に書いたもの） |
| ② 本人の通常（顔の同一性の基準） | `asset_sources/portraits/library-candidates-20261105/new/hajime/normal-source.png` |
| ③④ 画風の目標 | `assets/sprites/character_variants/new/minto/chr_minto_normal.png`・`assets/sprites/character_variants/new/ageha/chr_ageha_normal.png` |

全身を描かないので、[立ち絵の規格](../../docs/portrait_standard.md) 6節の「② 頭身の目標」は使わず、代わりに本人の通常を渡す。画風の英文（3節）はそのまま入れてある。

## Codex に送る文（2026-11-20 オーナーに渡したもの）

```
shisha-game の会話カットイン用に、はじめの胸から上の絵を4枚作ってください。

1. AGENTS.md に従い、最新の origin/main から新しいブランチを切って作業する（フルクローンはしない）。
2. asset_sources/conversation-cutin-redesign-20261120/README.md を読む。依頼文は「1/5 動揺」「2/5 沈み」「3/5 受け取る」「4/5 決意」の4本を、書き換えずにそのまま使う。5/5 の照れは今回は作らない。
3. 参照画像は README の表のとおり、リポジトリのファイルを4枚渡す。LFS は必要なファイルだけ取得する：
   git lfs pull -I "asset_sources/portraits/library-candidates-20261105/new/hajime/*,assets/sprites/character_variants/new/minto/chr_minto_normal.png,assets/sprites/character_variants/new/ageha/chr_ageha_normal.png"
   ① は依頼文ごとに違う（動揺＝surprise、沈み＝sad、受け取る＝smile、決意＝serious の -source.png）。② はどれも normal-source.png。
4. 1回の生成で1枚だけ作る。
5. できた絵を README の「受け取ったあとの確認」と照らし、外れていたら作り直す（1枚につき3回まで）。合格した原画は加工せず、依頼文にあるファイル名で asset_sources/conversation-cutin-redesign-20261120/originals/ に保存する。
6. git lfs ls-files で4枚が LFS 管理になったことを確かめてから commit・push し、Draft PR を作る。PR には4枚の画像と確認項目の結果を書く。ゲームのコード（remake/）は触らない。PR はマージしない（組み込みは Claude 側で行う）。
```

## 保存先

- 受け取った原画: `asset_sources/conversation-cutin-redesign-20261120/originals/hajime_cutin_<名前>.png`
- ゲーム用: `remake/img/ui/conversation_cutin/hajime_<flustered|downcast|grateful|resolve>.webp`（いまは仮の絵）。

### 届いた絵の組み込み（こちら側の作業）

0. 変換は [fit_cutin.py](fit_cutin.py) で行う（`python3 asset_sources/conversation-cutin-redesign-20261120/fit_cutin.py`）。原画で測った帽子のてっぺん・あご・両目の位置をスクリプトに書いておくと、`ART` に書く値を出力する。3枚（1254×1254・全面マゼンタ）は 0.6 倍に縮めた（頭の高さ 390〜420px。帯での表示は 146px）。
1. 原画は編集しない。マゼンタの背景で届いたものは透過に抜き、端のにじみを消す。
2. 人物の外接箱に余白を少し付けて切り抜き、縮小はしないで WebP にする（帯での頭の高さは 146px、決意の帯は 326px。高精細の画面で2倍近くになるので、原画の 540〜700px をそのまま使う）。同じファイル名で `remake/img/ui/conversation_cutin/` へ上書きする。
3. `remake/js/vn/conversation-cutin.js` の `ART` の `w`・`h`（WebP の寸法）、`face`（顔の中心）、`head`（帽子のてっぺん〜あご）を、その絵で測った値に直す。枠・出し方・置き場は変えない。
4. `node remake/test/conversation_cutin.mjs`（寸法の記録と実物の一致も見る）と `node remake/test/browser/conversation_cutin_2990.mjs` を通し、新版・旧版・スマホ横（844×390）で実画面を見る。

## 受け取ったあとの確認（1枚ごと）

- [ ] ①と並べて同じ人に見える（帽子の3本の波線、髪の跳ね方、茶色の目、黒いパーカーの白い紐と白いファスナー）
- [ ] 線・影・ハイライトの量が、今の新版の立ち絵と同じ（影は2〜3段、リムライトやぼかしが無い）
- [ ] 顔（帽子のてっぺん〜あご）の高さが 500px 以上（決意は 650px 以上）。両目がつばや手で隠れていない
- [ ] 体の向きが①と同じ（見る側から見て少し右向き）
- [ ] 背景が透過で、にじみ・取り残しが無い。枠・文字・煙・集中線・影・小物が描かれていない
- [ ] ペンダントなど、新版の立ち絵に無い物が足されていない

## 依頼文（1回の生成で1枚）

--- 1/5: hajime_cutin_flustered.png（動揺。「その顔（軽い）」用。①は surprise-source.png） ---

```
Draw ONE close-up bust illustration of the existing game character in image 1, for a short reaction cut-in. This is NOT a redesign: keep the same person, face design, age, hair, cap, outfit, colors and rendering style as image 1. Change only the framing, the expression and the small gesture described below.

Reference roles in order: (1) the current sprite of this character with the closest expression: highest priority for identity, face shapes, cap, outfit, colors, line weight and shading. (2) the same character's normal sprite: identity baseline only. (3) approved Minto sprite and (4) approved Ageha sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Hajime, a 22-year-old Japanese man with an ordinary, friendly face. Short messy black hair, brown eyes. Black baseball cap with a small pale-gray emblem of three wavy vertical lines on the front (keep it exactly as in image 1; it is not text). Black zip-up hoodie with white drawstrings and a white zipper tape, black crew-neck T-shirt. No necklace, no pendant, no other accessories.

Framing: bust shot from the upper chest up, like the camera moved closer to the standing sprite. Keep the same body direction as image 1: body and face turned slightly toward the viewer's right, three-quarter view. The head from the top of the cap to the chin is about 540 px tall on a 1024x1024 canvas, placed in the upper-middle. The whole cap is inside the canvas with a clear margin above it. Both shoulders are inside the canvas; only the bottom edge may crop the body.

Expression and gesture (flustered, caught off guard): eyes wide, eyebrows raised, mouth slightly open, smaller than a shout. Chin pulled back a little and shoulders lifted. One hand raised beside his face at chin height with the fingers loosely open, as if startled. No blush, no sweat drops, no symbols.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE figure on a 1024x1024 square canvas, saved as asset_sources/conversation-cutin-redesign-20261120/originals/hajime_cutin_flustered.png. True RGBA transparent background, also between the arm and the head. If transparency is not available, use a flat pure magenta (#ff00ff) background with no gradient. No frame, border, panel, background scene, smoke, speed lines, cast shadow, glow, text, labels, numbers, logo or watermark. No shisha equipment. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's local color palette, saturation and light-dark range; neutral even lighting, no dramatic light.
```

--- 2/5: hajime_cutin_downcast.png（沈み。「その顔（重い）」と敗北用。①は sad-source.png） ---

```
Draw ONE close-up bust illustration of the existing game character in image 1, for a quiet reaction cut-in. This is NOT a redesign: keep the same person, face design, age, hair, cap, outfit, colors and rendering style as image 1. Change only the framing, the expression and the small posture change described below.

Reference roles in order: (1) the current sprite of this character with the closest expression: highest priority for identity, face shapes, cap, outfit, colors, line weight and shading. (2) the same character's normal sprite: identity baseline only. (3) approved Minto sprite and (4) approved Ageha sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Hajime, a 22-year-old Japanese man with an ordinary, friendly face. Short messy black hair, brown eyes. Black baseball cap with a small pale-gray emblem of three wavy vertical lines on the front (keep it exactly as in image 1; it is not text). Black zip-up hoodie with white drawstrings and a white zipper tape, black crew-neck T-shirt. No necklace, no pendant, no other accessories.

Framing: bust shot from the upper chest up, like the camera moved closer to the standing sprite. Keep the same body direction as image 1: body and face turned slightly toward the viewer's right, three-quarter view. The head from the top of the cap to the chin is about 540 px tall on a 1024x1024 canvas, placed in the middle. The whole cap is inside the canvas with a clear margin above it. Both shoulders are inside the canvas; only the bottom edge may crop the body.

Expression and posture (downcast, holding it in): head lowered about ten degrees, gaze dropped toward the floor in front of him, eyelids half lowered, mouth closed in a thin line, eyebrows slightly drawn together. The cap brim casts one clearly shaped cel shadow across the forehead and the top of the eyes; both eyes stay visible under the brim. Shoulders dropped. Hands are out of frame. No tears, no sweat drops, no symbols.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE figure on a 1024x1024 square canvas, saved as asset_sources/conversation-cutin-redesign-20261120/originals/hajime_cutin_downcast.png. True RGBA transparent background. If transparency is not available, use a flat pure magenta (#ff00ff) background with no gradient. No frame, border, panel, background scene, smoke, speed lines, cast shadow on a wall, glow, text, labels, numbers, logo or watermark. No shisha equipment. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's local color palette, saturation and light-dark range; neutral even lighting, no dramatic light.
```

--- 3/5: hajime_cutin_grateful.png（受け取る。絆の締めくくり用。①は smile-source.png） ---

```
Draw ONE close-up bust illustration of the existing game character in image 1, for a warm reaction cut-in. This is NOT a redesign: keep the same person, face design, age, hair, cap, outfit, colors and rendering style as image 1. Change only the framing, the expression and the small gesture described below.

Reference roles in order: (1) the current sprite of this character with the closest expression: highest priority for identity, face shapes, cap, outfit, colors, line weight and shading. (2) the same character's normal sprite: identity baseline only. (3) approved Minto sprite and (4) approved Ageha sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Hajime, a 22-year-old Japanese man with an ordinary, friendly face. Short messy black hair, brown eyes. Black baseball cap with a small pale-gray emblem of three wavy vertical lines on the front (keep it exactly as in image 1; it is not text). Black zip-up hoodie with white drawstrings and a white zipper tape, black crew-neck T-shirt. No necklace, no pendant, no other accessories.

Framing: bust shot from the upper chest up, like the camera moved closer to the standing sprite. Keep the same body direction as image 1: body and face turned slightly toward the viewer's right, three-quarter view. The head from the top of the cap to the chin is about 540 px tall on a 1024x1024 canvas, placed in the middle. The whole cap is inside the canvas with a clear margin above it. Both shoulders are inside the canvas; only the bottom edge may crop the body.

Expression and gesture (grateful, taking it to heart): a small closed-mouth smile, eyes gently narrowed and looking at the person in front of him, eyebrows relaxed. Head bowed slightly, the first moment of a small bow. One hand rests flat on his upper chest just below the collarbone; the hand is empty and holds nothing. No blush, no sparkles, no symbols.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE figure on a 1024x1024 square canvas, saved as asset_sources/conversation-cutin-redesign-20261120/originals/hajime_cutin_grateful.png. True RGBA transparent background, also between the arm and the body. If transparency is not available, use a flat pure magenta (#ff00ff) background with no gradient. No frame, border, panel, background scene, smoke, speed lines, cast shadow, glow, text, labels, numbers, logo or watermark. No shisha equipment and no held object. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's local color palette, saturation and light-dark range; neutral even lighting, no dramatic light.
```

--- 4/5: hajime_cutin_resolve.png（決意。大会の目元の帯用。①は serious-source.png） ---

```
Draw ONE tight close-up illustration of the existing game character in image 1, for a full-width "eyes" cut-in band. This is NOT a redesign: keep the same person, face design, age, hair, cap, outfit, colors and rendering style as image 1. Change only the framing, the expression and the small gesture described below.

Reference roles in order: (1) the current sprite of this character with the closest expression: highest priority for identity, face shapes, cap, outfit, colors, line weight and shading. (2) the same character's normal sprite: identity baseline only. (3) approved Minto sprite and (4) approved Ageha sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Hajime, a 22-year-old Japanese man with an ordinary, friendly face. Short messy black hair, brown eyes. Black baseball cap with a small pale-gray emblem of three wavy vertical lines on the front (keep it exactly as in image 1; it is not text). Black zip-up hoodie with white drawstrings and a white zipper tape, black crew-neck T-shirt. No necklace, no pendant, no other accessories.

Framing: head and shoulders only, closer than a bust shot. Keep the same body direction as image 1: body and face turned slightly toward the viewer's right, three-quarter view. The head from the top of the cap to the chin is about 700 px tall on a 1024x1024 canvas. The whole cap is inside the canvas with a small margin above it. The shoulders may be cropped by the left, right and bottom edges.

Expression and gesture (quiet resolve before a contest): chin tucked slightly, eyes looking straight at the viewer from under the cap brim, eyebrows drawn down, mouth closed and firm. Calm and focused, not angry. One hand pinches the edge of the cap brim on the far side of his face and pulls it slightly down. The brim and the hand must NOT cover the eyes: both eyes and both eyebrows are fully visible, with clear space between the brim and the eyebrows. The eye area is the most carefully drawn part of the image.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE figure on a 1024x1024 square canvas, saved as asset_sources/conversation-cutin-redesign-20261120/originals/hajime_cutin_resolve.png. True RGBA transparent background, also between the arm and the head. If transparency is not available, use a flat pure magenta (#ff00ff) background with no gradient. No frame, border, panel, background scene, smoke, speed lines, cast shadow, glow, text, labels, numbers, logo or watermark. No shisha equipment. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's local color palette, saturation and light-dark range; neutral even lighting, no dramatic light.
```

--- 5/5（あとで足す場合）: hajime_cutin_bashful.png（照れ。「顔、赤いよ」と言われる行用。①は surprise-source.png） ---

```
Draw ONE close-up bust illustration of the existing game character in image 1, for a short reaction cut-in. This is NOT a redesign: keep the same person, face design, age, hair, cap, outfit, colors and rendering style as image 1. Change only the framing, the expression and the small gesture described below.

Reference roles in order: (1) the current sprite of this character: highest priority for identity, face shapes, cap, outfit, colors, line weight and shading (do not copy its surprised expression). (2) the same character's normal sprite: identity baseline only. (3) approved Minto sprite and (4) approved Ageha sprite: the TARGET rendering style ONLY. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Hajime, a 22-year-old Japanese man with an ordinary, friendly face. Short messy black hair, brown eyes. Black baseball cap with a small pale-gray emblem of three wavy vertical lines on the front (keep it exactly as in image 1; it is not text). Black zip-up hoodie with white drawstrings and a white zipper tape, black crew-neck T-shirt. No necklace, no pendant, no other accessories.

Framing: bust shot from the upper chest up, like the camera moved closer to the standing sprite. Keep the same body direction as image 1: body turned slightly toward the viewer's right, three-quarter view. The head from the top of the cap to the chin is about 540 px tall on a 1024x1024 canvas, placed in the middle. The whole cap is inside the canvas with a clear margin above it. Both shoulders are inside the canvas; only the bottom edge may crop the body.

Expression and gesture (bashful, he does not notice he is blushing): eyes turned away to one side, an awkward small closed-mouth smile, eyebrows slightly raised. One simple flat cel-shaded patch of pink on each cheek; no hatching lines, no steam, no symbols. One hand behind his neck with the elbow raised beside his head.

STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

Output: ONE figure on a 1024x1024 square canvas, saved as asset_sources/conversation-cutin-redesign-20261120/originals/hajime_cutin_bashful.png. True RGBA transparent background, also between the arm and the head. If transparency is not available, use a flat pure magenta (#ff00ff) background with no gradient. No frame, border, panel, background scene, smoke, speed lines, cast shadow, glow, text, labels, numbers, logo or watermark. No shisha equipment. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Preserve image 1's local color palette, saturation and light-dark range; neutral even lighting, no dramatic light.
```

## 帯の寸法（舞台 1280×720 の座標）

オーナーに見せた試作の値で、2026-11-20 に `remake/js/vn/conversation-cutin.js`（`FRAMES`・`KINDS`）・`remake/css/vn/conversation-cutin.css` へ移した。正本はそちら。試作の HTML（絵は埋め込んでいない雛形）は [mock/comparison-page.template.html](mock/comparison-page.template.html)。

| 部品 | 値 |
|---|---|
| 寄りの帯（共通の形） | 幅425・高さ212、左端 x0 から。多角形 `0,22 425,0 384,197 0,212`。右の斜辺の外側10pxに細い飾り線 `435,2 394,199`（2026-11-20 オーナー「今ウインドウが大きいのでカットインの少し小さく」で試作の0.85倍に。元は幅500・高さ250） |
| 寄りの帯の高さ | 相手の行もはじめ自身の行も y264（下端 y476・新版の名前のすぐ上）にそろえる（2026-11-20 オーナー「カットインは出す位置を統一したい」「下よりなやつが好き」。それまでは相手の行だけ y112 の相手の顔の高さに出していた） |
| 帯の中 | いまの背景を1.5倍・ぼかし6px・明るさ0.82で敷き、夜紫のグラデーションを重ねる。顔の後ろに淡い光。敗北は彩度を落とした暗い青紫 |
| 絵の置き方 | 帽子のてっぺん〜あごが約146px（`FRAMES` の寄りの帯の `head`）。顔の中心を帯の (223,149) に置く。帽子も帯の中に収める（オーナー「収めるで」。はじめは帽子だけ帯の上の線より手前に最大40px出していた） |
| 線 | 金 `#e7c98f` 1.6px＋ラベンダーの淡い光。受け取るだけ琥珀 `#f0b060` |
| 目元の帯（決意） | 全幅1280・高さ162、y220（オーナー「もう少し下げて中央へ」で y142 から下げた）。顔の中心は画面の左右の真ん中（x640）。多角形 `0,24 1280,0 1280,138 0,162`。帯より上の画面を暗くする（会話の帯は暗くしない） |
| 出入り | その顔（軽い）：左から0.2秒で開く→約1.15秒で自分から閉じる。その顔（重い）・敗北：0.5秒で浮かぶ→次の行で0.3秒かけて消える。受け取る：12px持ち上がりながら0.36秒→次の行で消える。決意：0.16秒で開く→0.8秒→縦につぶれて消える |
| 変えないもの | SKIP・ターボ・LOG・CG・選択肢・登場カットインの間は出さない。1会話1回。動きを減らす設定では出入りの動きを止める |
