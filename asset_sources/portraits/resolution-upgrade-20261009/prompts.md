# 立ち絵の作り直し：コピペ用プロンプト（画質・顔の大きさ・画風を1回で）

[調査と方針](README.md)。2026-10-09 オーナー決定：**顔の大きさが中央値から±10%を超える6人だけ直す**／**画風はみんと・アゲハに合わせる**。
1回の生成で1人・1表情。各ブロックの英文と、ブロックに書いたリポジトリの参照画像4枚で1回ずつ生成する。全34表情。参照画像は**エージェントがリポジトリから直接読み込む**（オーナーが保存・添付する必要はない）。

> 2026-10-10 最終更新（要望台帳 PU02・PU05）：主目的は画風と解像度をそろえること。つむぎは頭身の変更で印象が変わったため、元絵の頭・胴・脚の比率と小柄な体格へ戻す。7ブロックの10%縮小指定は撤回し、参照②も元の通常絵を使う。みんとからは描画品質だけを参照する。

> 同日追記（PU03・PU04）：繰り返し生成で色が薄くならないよう、全34ブロックで元画像の色・彩度・明暗を維持する。ましろも少し大きめの丸い顔の方が可愛いという指定を優先し、6ブロック末尾の追記は以前の8%縮小指定に優先する。途中確認の委任により、残りは検品しながら続けて制作する。

| キャラ | いまの顔の大きさ（中央値比） | 直し方 | 画風の直し | 表情数 |
|---|---|---|---|---|
| つむぎ | +18% | 元絵の頭身・胴と脚の長さ・小柄な体格へ戻す。頭の縮小を撤回し、解像度と画風のみ統一（2026-10-10 PU05） | 基準に合わせる | 7 |
| 上園 | +17% | 頭を約14%小さく | 平たい塗り・太い線を基準へ | 5 |
| スミさん | +15% | 頭（帽子込み）を約13%小さく | 基準に合わせる | 5 |
| ましろ | +13% | やや大きめの丸い顔と頬の可愛さを優先。8%縮小は強制しない（2026-10-10追記） | 基準に合わせる | 6 |
| 南雲 | −13% | 頭を約15%大きく | 基準に合わせる | 5 |
| サメちゃん | −10% | 頭（フード込み）を約11%大きく | つやの強い今風の塗り・大きめの目を基準へ | 6 |

顔の大きさの比較図は [face-size-ingame.png](../../reference-sheets/face-size-ingame.png)（`python3 tools/make_reference_sheet.py facesize` で作り直せる）。

> **Claude Code・Codex のチャットでは「立ち絵そろえ」と言えば、下のナビの順に生成→保存→確認→組み込みまで進む**（[portrait-unify スキル](../../../.claude/skills/portrait-unify/SKILL.md)、進捗は [progress.md](progress.md)）。以下は手で投げる場合の手順。

## 進め方ナビ（この順に投げる）

番号は下のブロック番号（`### 1. つむぎ・normal` など）。

**ステップ1：試しの3枚で方向を確かめる**（ここで合格してから量産する）
1. **#1 つむぎ・normal** … 元絵の頭身・小柄な丸さを保ち、解像度と画風だけを揃える（PU05）
2. **#29 サメちゃん・normal** … 塗りを寄せても本人に見えるか（採用したばかりのデザイン）
3. **#8 上園・normal** … 線が細くなり、塗りがみんと・アゲハに近づくか

→ 3枚を Claude に見せて確認。直す点があればここでプロンプトを調整する。

**ステップ2：残りの3人の通常**
4. **#13 スミさん・normal** → 5. **#18 ましろ・normal** → 6. **#24 南雲・normal**

**ステップ3：各キャラの残りの表情**（キャラごとにまとめて）
- **②（同じキャラの通常）には、ステップ1・2で合格した「新しい通常」を添付する。** 表情どうしの顔と頭の大きさがそろいやすい。ただし、つむぎはPU05により、体格を変えた候補を引き継がず「元の通常」を添付する。
- 順番：つむぎ #2〜7 → ましろ #19〜23 → サメちゃん #30〜34 → 上園 #9〜12 → スミさん #14〜17 → 南雲 #25〜28
- 1キャラの全表情がそろったら並べて確認し、`asset_sources/portraits/<id>-remaster-v2/` に置いて commit。キャラ単位で組み込みを頼んでよい。

## リポジトリに触れないチャット（ChatGPTなど）で手作業で頼むときの手順

Codex・Claude Code では「立ち絵そろえ」で済むので、この節は使わない。

1. 添付する4枚をGitHubから保存する（ファイルを開いて `Raw` から保存）。
   - ① いま作り直す表情の現行PNG（各ブロックに書いたパス）
   - ② 同じキャラの `chr_<id>_normal.png`（①が通常のときは省略してよい）
   - ③ 頭身の目標：女性は みんと、男性は アダム の normal。ただし、つむぎは①の元の頭身を保ち、③は描画品質だけの参照
   - ④ 画風の目標：女性は アゲハ、男性は みんと の normal
2. 新しいチャットで、①→②→③→④の順に添付し、そのキャラ・表情のブロックをそのまま貼って送る。
3. できた画像を原寸で見て、下のチェックを確認する。ダメなら同じチャットで、直す点だけを伝えて作り直す（例：「顔を画像1にもっと近づけて」「頭をもう少し小さく」「手の位置を画像1と同じに」）。
4. 1キャラの全表情がそろったら並べて、同じ人物・同じ頭の大きさに見えるか確かめる。
5. 合格した原画を `asset_sources/portraits/<id>-remaster-v2/` に置いて commit（PCに置いたままにしない）。組み込みは Claude／Codex に「resolution-upgrade の受け取り手順で組み込んで」と頼む。

### 生成後チェック（1枚ごと）

- [ ] 人物の高さが1300px以上。背景が透明で、手足の間も抜けている
- [ ] ①と並べて、顔立ち・表情・手と肩の位置・衣装・小物が変わっていない（同じ人物）
- [ ] 頭の大きさが③に近い（ましろは③より少し大きく丸いまま）。つむぎはPU05により①の頭身・胴と脚の長さ・小柄な体格をそのまま維持する。全身の高さ・立ち方は①のまま
- [ ] 画風が④に近い：細くくっきりした線、控えめな段階の陰影。ぼやけ・のっぺり・つやつや・粗いドットがない
- [ ] 若返り・老け・別人化していない
- [ ] 文字・枠・影・床が入っていない

## つむぎ（tsumugi）

### 1. つむぎ・normal

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（描画品質のみ。頭身は①を維持）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY two things: the rendering resolution and crispness, and the rendering style unification below. Keep image 1's original head-to-body ratio and complete body proportions exactly.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): rendering quality only; image 1 remains the sole body-proportion reference. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Tsumugi, quiet 21-year-old adult Japanese illustrator, petite adult build, warm dark-brown softly rounded chin-length bob with straight bangs, warm reddish-brown eyes, small ear stud, loose deep plum zip hoodie with cream drawstrings and dusty-pink/lavender flower and ochre leaf embroidery on the sleeves and chest, short black pleated skirt, dark charcoal knee socks, black chunky lace-up shoes, black drawing tablet.
Expression and pose to keep exactly as image 1 (normal): calm closed mouth, hugging the tablet against her chest with both arms

ORIGINAL PROPORTIONS: preserve image 1's exact original head-to-body ratio, large soft rounded head and cheeks, short compact torso and legs, gentle narrow shoulders, original waist and knee positions, petite body mass and stance. Enlarge the whole original figure uniformly to reach the requested source resolution; do not change any body part's relative scale, length, width or position.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her soft quiet charm and warm brown eyes; do not make her look older. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: prioritize matching resolution and rendering style; Tsumugi may retain a slightly oversized, soft round head close to image 1 because it looks cuter, so do not force the earlier 10% head reduction.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10, superseding all earlier proportion instructions: the entire HEAD SIZE CORRECTION paragraph and the Minto proportion target are cancelled for Tsumugi; match image 1's original head-to-body ratio and body proportions exactly, restoring her compact petite silhouette, original short legs and torso, soft large rounded head and cheeks, narrow gentle shoulders, and original shoulder, waist, knee and shoe positions. Improve only resolution, line crispness and restrained matte rendering style while keeping image 1's figure proportions, expression, pose, outfit and original color strength unchanged; image 2 is the ORIGINAL normal sprite for identity, and must not introduce a taller, slimmer or fashion-model body.
```

### 2. つむぎ・smile

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/tsumugi/chr_tsumugi_smile.png` ／ ② `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（描画品質のみ。頭身は①を維持）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY two things: the rendering resolution and crispness, and the rendering style unification below. Keep image 1's original head-to-body ratio and complete body proportions exactly.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): rendering quality only; image 1 remains the sole body-proportion reference. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Tsumugi, quiet 21-year-old adult Japanese illustrator, petite adult build, warm dark-brown softly rounded chin-length bob with straight bangs, warm reddish-brown eyes, small ear stud, loose deep plum zip hoodie with cream drawstrings and dusty-pink/lavender flower and ochre leaf embroidery on the sleeves and chest, short black pleated skirt, dark charcoal knee socks, black chunky lace-up shoes, black drawing tablet.
Expression and pose to keep exactly as image 1 (smile): gentle smile, holding a stylus near her cheek with the tablet in the other arm

ORIGINAL PROPORTIONS: preserve image 1's exact original head-to-body ratio, large soft rounded head and cheeks, short compact torso and legs, gentle narrow shoulders, original waist and knee positions, petite body mass and stance. Enlarge the whole original figure uniformly to reach the requested source resolution; do not change any body part's relative scale, length, width or position.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her soft quiet charm and warm brown eyes; do not make her look older. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: prioritize matching resolution and rendering style; Tsumugi may retain a slightly oversized, soft round head close to image 1 because it looks cuter, so do not force the earlier 10% head reduction.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10, superseding all earlier proportion instructions: the entire HEAD SIZE CORRECTION paragraph and the Minto proportion target are cancelled for Tsumugi; match image 1's original head-to-body ratio and body proportions exactly, restoring her compact petite silhouette, original short legs and torso, soft large rounded head and cheeks, narrow gentle shoulders, and original shoulder, waist, knee and shoe positions. Improve only resolution, line crispness and restrained matte rendering style while keeping image 1's figure proportions, expression, pose, outfit and original color strength unchanged; image 2 is the ORIGINAL normal sprite for identity, and must not introduce a taller, slimmer or fashion-model body.
```

### 3. つむぎ・serious

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/tsumugi/chr_tsumugi_serious.png` ／ ② `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（描画品質のみ。頭身は①を維持）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY two things: the rendering resolution and crispness, and the rendering style unification below. Keep image 1's original head-to-body ratio and complete body proportions exactly.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): rendering quality only; image 1 remains the sole body-proportion reference. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Tsumugi, quiet 21-year-old adult Japanese illustrator, petite adult build, warm dark-brown softly rounded chin-length bob with straight bangs, warm reddish-brown eyes, small ear stud, loose deep plum zip hoodie with cream drawstrings and dusty-pink/lavender flower and ochre leaf embroidery on the sleeves and chest, short black pleated skirt, dark charcoal knee socks, black chunky lace-up shoes, black drawing tablet.
Expression and pose to keep exactly as image 1 (serious): focused gaze down at the tablet, drawing on it with the stylus

ORIGINAL PROPORTIONS: preserve image 1's exact original head-to-body ratio, large soft rounded head and cheeks, short compact torso and legs, gentle narrow shoulders, original waist and knee positions, petite body mass and stance. Enlarge the whole original figure uniformly to reach the requested source resolution; do not change any body part's relative scale, length, width or position.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her soft quiet charm and warm brown eyes; do not make her look older. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: prioritize matching resolution and rendering style; Tsumugi may retain a slightly oversized, soft round head close to image 1 because it looks cuter, so do not force the earlier 10% head reduction.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10, superseding all earlier proportion instructions: the entire HEAD SIZE CORRECTION paragraph and the Minto proportion target are cancelled for Tsumugi; match image 1's original head-to-body ratio and body proportions exactly, restoring her compact petite silhouette, original short legs and torso, soft large rounded head and cheeks, narrow gentle shoulders, and original shoulder, waist, knee and shoe positions. Improve only resolution, line crispness and restrained matte rendering style while keeping image 1's figure proportions, expression, pose, outfit and original color strength unchanged; image 2 is the ORIGINAL normal sprite for identity, and must not introduce a taller, slimmer or fashion-model body.
```

### 4. つむぎ・surprise

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/tsumugi/chr_tsumugi_surprise.png` ／ ② `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（描画品質のみ。頭身は①を維持）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY two things: the rendering resolution and crispness, and the rendering style unification below. Keep image 1's original head-to-body ratio and complete body proportions exactly.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): rendering quality only; image 1 remains the sole body-proportion reference. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Tsumugi, quiet 21-year-old adult Japanese illustrator, petite adult build, warm dark-brown softly rounded chin-length bob with straight bangs, warm reddish-brown eyes, small ear stud, loose deep plum zip hoodie with cream drawstrings and dusty-pink/lavender flower and ochre leaf embroidery on the sleeves and chest, short black pleated skirt, dark charcoal knee socks, black chunky lace-up shoes, black drawing tablet.
Expression and pose to keep exactly as image 1 (surprise): round eyes and a small open mouth, one hand raised beside her face, the tablet in the other arm

ORIGINAL PROPORTIONS: preserve image 1's exact original head-to-body ratio, large soft rounded head and cheeks, short compact torso and legs, gentle narrow shoulders, original waist and knee positions, petite body mass and stance. Enlarge the whole original figure uniformly to reach the requested source resolution; do not change any body part's relative scale, length, width or position.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her soft quiet charm and warm brown eyes; do not make her look older. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: prioritize matching resolution and rendering style; Tsumugi may retain a slightly oversized, soft round head close to image 1 because it looks cuter, so do not force the earlier 10% head reduction.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10, superseding all earlier proportion instructions: the entire HEAD SIZE CORRECTION paragraph and the Minto proportion target are cancelled for Tsumugi; match image 1's original head-to-body ratio and body proportions exactly, restoring her compact petite silhouette, original short legs and torso, soft large rounded head and cheeks, narrow gentle shoulders, and original shoulder, waist, knee and shoe positions. Improve only resolution, line crispness and restrained matte rendering style while keeping image 1's figure proportions, expression, pose, outfit and original color strength unchanged; image 2 is the ORIGINAL normal sprite for identity, and must not introduce a taller, slimmer or fashion-model body.
```

### 5. つむぎ・sad

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/tsumugi/chr_tsumugi_sad.png` ／ ② `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（描画品質のみ。頭身は①を維持）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY two things: the rendering resolution and crispness, and the rendering style unification below. Keep image 1's original head-to-body ratio and complete body proportions exactly.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): rendering quality only; image 1 remains the sole body-proportion reference. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Tsumugi, quiet 21-year-old adult Japanese illustrator, petite adult build, warm dark-brown softly rounded chin-length bob with straight bangs, warm reddish-brown eyes, small ear stud, loose deep plum zip hoodie with cream drawstrings and dusty-pink/lavender flower and ochre leaf embroidery on the sleeves and chest, short black pleated skirt, dark charcoal knee socks, black chunky lace-up shoes, black drawing tablet.
Expression and pose to keep exactly as image 1 (sad): downcast eyes and a small sad mouth, hugging the tablet

ORIGINAL PROPORTIONS: preserve image 1's exact original head-to-body ratio, large soft rounded head and cheeks, short compact torso and legs, gentle narrow shoulders, original waist and knee positions, petite body mass and stance. Enlarge the whole original figure uniformly to reach the requested source resolution; do not change any body part's relative scale, length, width or position.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her soft quiet charm and warm brown eyes; do not make her look older. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: prioritize matching resolution and rendering style; Tsumugi may retain a slightly oversized, soft round head close to image 1 because it looks cuter, so do not force the earlier 10% head reduction.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10, superseding all earlier proportion instructions: the entire HEAD SIZE CORRECTION paragraph and the Minto proportion target are cancelled for Tsumugi; match image 1's original head-to-body ratio and body proportions exactly, restoring her compact petite silhouette, original short legs and torso, soft large rounded head and cheeks, narrow gentle shoulders, and original shoulder, waist, knee and shoe positions. Improve only resolution, line crispness and restrained matte rendering style while keeping image 1's figure proportions, expression, pose, outfit and original color strength unchanged; image 2 is the ORIGINAL normal sprite for identity, and must not introduce a taller, slimmer or fashion-model body.
```

### 6. つむぎ・evil

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/tsumugi/chr_tsumugi_evil.png` ／ ② `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（描画品質のみ。頭身は①を維持）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY two things: the rendering resolution and crispness, and the rendering style unification below. Keep image 1's original head-to-body ratio and complete body proportions exactly.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): rendering quality only; image 1 remains the sole body-proportion reference. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Tsumugi, quiet 21-year-old adult Japanese illustrator, petite adult build, warm dark-brown softly rounded chin-length bob with straight bangs, warm reddish-brown eyes, small ear stud, loose deep plum zip hoodie with cream drawstrings and dusty-pink/lavender flower and ochre leaf embroidery on the sleeves and chest, short black pleated skirt, dark charcoal knee socks, black chunky lace-up shoes, black drawing tablet.
Expression and pose to keep exactly as image 1 (evil): yami-kawaii blank stare: empty eyes without highlights, soft lavender-gray shadow over the eyes, tiny flat mouth, hugging the cracked tablet, cute and comical, never menacing

ORIGINAL PROPORTIONS: preserve image 1's exact original head-to-body ratio, large soft rounded head and cheeks, short compact torso and legs, gentle narrow shoulders, original waist and knee positions, petite body mass and stance. Enlarge the whole original figure uniformly to reach the requested source resolution; do not change any body part's relative scale, length, width or position.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her soft quiet charm and warm brown eyes; do not make her look older. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: prioritize matching resolution and rendering style; Tsumugi may retain a slightly oversized, soft round head close to image 1 because it looks cuter, so do not force the earlier 10% head reduction.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10, superseding all earlier proportion instructions: the entire HEAD SIZE CORRECTION paragraph and the Minto proportion target are cancelled for Tsumugi; match image 1's original head-to-body ratio and body proportions exactly, restoring her compact petite silhouette, original short legs and torso, soft large rounded head and cheeks, narrow gentle shoulders, and original shoulder, waist, knee and shoe positions. Improve only resolution, line crispness and restrained matte rendering style while keeping image 1's figure proportions, expression, pose, outfit and original color strength unchanged; image 2 is the ORIGINAL normal sprite for identity, and must not introduce a taller, slimmer or fashion-model body.
```

### 7. つむぎ・bow

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/tsumugi/chr_tsumugi_bow.png` ／ ② `assets/sprites/characters/tsumugi/chr_tsumugi_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（描画品質のみ。頭身は①を維持）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY two things: the rendering resolution and crispness, and the rendering style unification below. Keep image 1's original head-to-body ratio and complete body proportions exactly.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): rendering quality only; image 1 remains the sole body-proportion reference. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Tsumugi, quiet 21-year-old adult Japanese illustrator, petite adult build, warm dark-brown softly rounded chin-length bob with straight bangs, warm reddish-brown eyes, small ear stud, loose deep plum zip hoodie with cream drawstrings and dusty-pink/lavender flower and ochre leaf embroidery on the sleeves and chest, short black pleated skirt, dark charcoal knee socks, black chunky lace-up shoes, black drawing tablet.
Expression and pose to keep exactly as image 1 (bow): polite bow with closed eyes, head and upper body bowed slightly, both hands in front

ORIGINAL PROPORTIONS: preserve image 1's exact original head-to-body ratio, large soft rounded head and cheeks, short compact torso and legs, gentle narrow shoulders, original waist and knee positions, petite body mass and stance. Enlarge the whole original figure uniformly to reach the requested source resolution; do not change any body part's relative scale, length, width or position.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her soft quiet charm and warm brown eyes; do not make her look older. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: prioritize matching resolution and rendering style; Tsumugi may retain a slightly oversized, soft round head close to image 1 because it looks cuter, so do not force the earlier 10% head reduction.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10, superseding all earlier proportion instructions: the entire HEAD SIZE CORRECTION paragraph and the Minto proportion target are cancelled for Tsumugi; match image 1's original head-to-body ratio and body proportions exactly, restoring her compact petite silhouette, original short legs and torso, soft large rounded head and cheeks, narrow gentle shoulders, and original shoulder, waist, knee and shoe positions. Improve only resolution, line crispness and restrained matte rendering style while keeping image 1's figure proportions, expression, pose, outfit and original color strength unchanged; image 2 is the ORIGINAL normal sprite for identity, and must not introduce a taller, slimmer or fashion-model body.
```

## 上園（maezono）

### 8. 上園・normal

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (normal): gentle small closed-mouth smile, SCREEN-LEFT hand lifted in a friendly greeting wave, SCREEN-RIGHT hand in the trouser pocket

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 14% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. His current rendering is flat with thick lines: give him the same finer line work, stepped shading and fabric detail as Minto and Ageha, while keeping his round warm friendly face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10: Mashiro may retain a slightly oversized, soft round face and head close to image 1 because it looks cuter; prioritize her full cheeks and gentle sleepy expression, and do not force the earlier 8% head reduction.
```

### 9. 上園・smile

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/maezono/chr_maezono_smile.png` ／ ② `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (smile): both eyes closed, joyful open-mouth smile, the same SCREEN-LEFT greeting hand, SCREEN-RIGHT hand in the pocket

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 14% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. His current rendering is flat with thick lines: give him the same finer line work, stepped shading and fabric detail as Minto and Ageha, while keeping his round warm friendly face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10: Mashiro may retain a slightly oversized, soft round face and head close to image 1 because it looks cuter; prioritize her full cheeks and gentle sleepy expression, and do not force the earlier 8% head reduction.
```

### 10. 上園・serious

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/maezono/chr_maezono_serious.png` ／ ② `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (serious): thoughtful brows, closed mouth, SCREEN-LEFT hand against the chin, SCREEN-RIGHT hand in the pocket

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 14% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. His current rendering is flat with thick lines: give him the same finer line work, stepped shading and fabric detail as Minto and Ageha, while keeping his round warm friendly face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10: Mashiro may retain a slightly oversized, soft round face and head close to image 1 because it looks cuter; prioritize her full cheeks and gentle sleepy expression, and do not force the earlier 8% head reduction.
```

### 11. 上園・surprise

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/maezono/chr_maezono_surprise.png` ／ ② `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (surprise): round open eyes and a small O-shaped mouth, SCREEN-LEFT palm raised, SCREEN-RIGHT hand in the pocket

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 14% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. His current rendering is flat with thick lines: give him the same finer line work, stepped shading and fabric detail as Minto and Ageha, while keeping his round warm friendly face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10: Mashiro may retain a slightly oversized, soft round face and head close to image 1 because it looks cuter; prioritize her full cheeks and gentle sleepy expression, and do not force the earlier 8% head reduction.
```

### 12. 上園・excited

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/maezono/chr_maezono_excited.png` ／ ② `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (excited): both eyes open, big delighted open-mouth grin, SCREEN-LEFT fist near the shoulder, SCREEN-RIGHT fist near the waist, leaning forward slightly

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 14% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. His current rendering is flat with thick lines: give him the same finer line work, stepped shading and fabric detail as Minto and Ageha, while keeping his round warm friendly face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10: Mashiro may retain a slightly oversized, soft round face and head close to image 1 because it looks cuter; prioritize her full cheeks and gentle sleepy expression, and do not force the earlier 8% head reduction.
```

## スミさん（sumi）

### 13. スミさん・normal

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (normal): calm approachable faint closed-mouth smile, both hands casually tucked into the pockets

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 13% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and cap) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his seasoned mature masculine face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 14. スミさん・smile

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/sumi/chr_sumi_smile.png` ／ ② `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (smile): warmer friendly smile with slightly parted lips and both eyes gently open, SCREEN-LEFT hand in a small open-palm welcoming gesture just above the waist, the other hand in the pocket

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 13% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and cap) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his seasoned mature masculine face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 15. スミさん・serious

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/sumi/chr_sumi_serious.png` ／ ② `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (serious): focused eyes, knitted eyebrows and a firm closed mouth, SCREEN-LEFT hand near the lower chest with one index finger up in a small explanatory gesture, SCREEN-RIGHT hand at the apron-side pocket

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 13% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and cap) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his seasoned mature masculine face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 16. スミさん・surprise

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/sumi/chr_sumi_surprise.png` ／ ② `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (surprise): raised brows, open attentive eyes behind the glasses and a small open 'oh' mouth, SCREEN-LEFT hand drawn slightly up toward the chest with the palm partly open, shoulders slightly raised

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 13% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and cap) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his seasoned mature masculine face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 17. スミさん・thinking

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/sumi/chr_sumi_thinking.png` ／ ② `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (thinking): SCREEN-LEFT hand gently at the beard and chin, SCREEN-RIGHT forearm folded across the torso supporting that elbow, slightly narrowed eyes, contemplative closed mouth, head inclined slightly

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 13% SMALLER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and cap) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his seasoned mature masculine face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

## ましろ（mashiro）

### 18. ましろ・normal

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/mashiro/chr_mashiro_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Mashiro, sleepy gentle 22-year-old adult Japanese woman, petite adult build, pale ash-blonde hair with a faint olive cast, straight bangs, two long loose braids in front of the shoulders, droopy half-lidded golden-amber eyes, soft round cheeks, oversized beige cable-knit cardigan with long sleeves, white blouse with a small ribbon, long sage-green skirt, brown loafers.
Expression and pose to keep exactly as image 1 (normal): calm sleepy half-lidded eyes, small closed mouth, arms relaxed down

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 8% SMALLER relative to the body, moving toward the head-to-body ratio of image 3 but stopping a little short of it. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her sleepy gentle face and golden eyes; do not make her look older or sharper. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.

Owner update 2026-10-10: Mashiro may retain a slightly oversized, soft round face and head close to image 1 because it looks cuter; prioritize her full cheeks and gentle sleepy expression, and do not force the earlier 8% head reduction.
```

### 19. ましろ・smile

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/mashiro/chr_mashiro_smile.png` ／ ② `assets/sprites/characters/mashiro/chr_mashiro_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Mashiro, sleepy gentle 22-year-old adult Japanese woman, petite adult build, pale ash-blonde hair with a faint olive cast, straight bangs, two long loose braids in front of the shoulders, droopy half-lidded golden-amber eyes, soft round cheeks, oversized beige cable-knit cardigan with long sleeves, white blouse with a small ribbon, long sage-green skirt, brown loafers.
Expression and pose to keep exactly as image 1 (smile): soft gentle smile, one sleeve-covered hand raised near her chest

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 8% SMALLER relative to the body, moving toward the head-to-body ratio of image 3 but stopping a little short of it. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her sleepy gentle face and golden eyes; do not make her look older or sharper. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 20. ましろ・serious

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/mashiro/chr_mashiro_serious.png` ／ ② `assets/sprites/characters/mashiro/chr_mashiro_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Mashiro, sleepy gentle 22-year-old adult Japanese woman, petite adult build, pale ash-blonde hair with a faint olive cast, straight bangs, two long loose braids in front of the shoulders, droopy half-lidded golden-amber eyes, soft round cheeks, oversized beige cable-knit cardigan with long sleeves, white blouse with a small ribbon, long sage-green skirt, brown loafers.
Expression and pose to keep exactly as image 1 (serious): slightly serious sleepy gaze, small closed mouth, one hand extended a little to the side palm up

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 8% SMALLER relative to the body, moving toward the head-to-body ratio of image 3 but stopping a little short of it. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her sleepy gentle face and golden eyes; do not make her look older or sharper. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 21. ましろ・surprise

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/mashiro/chr_mashiro_surprise.png` ／ ② `assets/sprites/characters/mashiro/chr_mashiro_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Mashiro, sleepy gentle 22-year-old adult Japanese woman, petite adult build, pale ash-blonde hair with a faint olive cast, straight bangs, two long loose braids in front of the shoulders, droopy half-lidded golden-amber eyes, soft round cheeks, oversized beige cable-knit cardigan with long sleeves, white blouse with a small ribbon, long sage-green skirt, brown loafers.
Expression and pose to keep exactly as image 1 (surprise): eyes opened rounder with a small 'o' mouth, one hand near her chest

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 8% SMALLER relative to the body, moving toward the head-to-body ratio of image 3 but stopping a little short of it. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her sleepy gentle face and golden eyes; do not make her look older or sharper. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 22. ましろ・sad

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/mashiro/chr_mashiro_sad.png` ／ ② `assets/sprites/characters/mashiro/chr_mashiro_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Mashiro, sleepy gentle 22-year-old adult Japanese woman, petite adult build, pale ash-blonde hair with a faint olive cast, straight bangs, two long loose braids in front of the shoulders, droopy half-lidded golden-amber eyes, soft round cheeks, oversized beige cable-knit cardigan with long sleeves, white blouse with a small ribbon, long sage-green skirt, brown loafers.
Expression and pose to keep exactly as image 1 (sad): big sleepy yawn with eyes closed, a sleeve-covered hand covering the open mouth, a small 'Z' sleep mark beside her head as in image 1

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 8% SMALLER relative to the body, moving toward the head-to-body ratio of image 3 but stopping a little short of it. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her sleepy gentle face and golden eyes; do not make her look older or sharper. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 23. ましろ・sleep

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/mashiro/chr_mashiro_sleep.png` ／ ② `assets/sprites/characters/mashiro/chr_mashiro_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Mashiro, sleepy gentle 22-year-old adult Japanese woman, petite adult build, pale ash-blonde hair with a faint olive cast, straight bangs, two long loose braids in front of the shoulders, droopy half-lidded golden-amber eyes, soft round cheeks, oversized beige cable-knit cardigan with long sleeves, white blouse with a small ribbon, long sage-green skirt, brown loafers.
Expression and pose to keep exactly as image 1 (sleep): asleep while standing, both eyes closed, head gently tilted, small peaceful mouth, arms hanging loosely, small 'z' sleep marks beside her head as in image 1

HEAD SIZE CORRECTION: in image 1 the head is too large for the body. Make the whole head about 8% SMALLER relative to the body, moving toward the head-to-body ratio of image 3 but stopping a little short of it. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep her sleepy gentle face and golden eyes; do not make her look older or sharper. Keep a slightly round, soft face with full cheeks and her cute roundness: her head should still read a little larger and softer than Minto's.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

## 南雲（nagumo）

### 24. 南雲・normal

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (normal): authoritative neutral face, both hands down

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 15% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his stern mature executive face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 25. 南雲・smile

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/nagumo/chr_nagumo_smile.png` ／ ② `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (smile): subtle closed-mouth approving smirk with both eyes open, SCREEN-LEFT hand slightly open in welcome

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 15% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his stern mature executive face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 26. 南雲・serious

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/nagumo/chr_nagumo_serious.png` ／ ② `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (serious): furrowed brows and a focused intimidating gaze, small SCREEN-LEFT hand explanatory gesture at the waist

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 15% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his stern mature executive face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 27. 南雲・surprise

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/nagumo/chr_nagumo_surprise.png` ／ ② `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (surprise): eyes wider, mouth slightly open, SCREEN-RIGHT hand lifted slightly to the chest, no comic symbols

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 15% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his stern mature executive face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 28. 南雲・thinking

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/nagumo/chr_nagumo_thinking.png` ／ ② `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ `assets/sprites/characters/adam/chr_adam_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/minto/chr_minto_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Adam normal sprite (assets/sprites/characters/adam/chr_adam_normal.png): the TARGET head-to-body proportion only. (4) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (thinking): SCREEN-LEFT hand under the chin, SCREEN-RIGHT hand in the trouser pocket, slight sideways gaze

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 15% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Keep his stern mature executive face.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

## サメちゃん（samechan）

### 29. サメちゃん・normal

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/samechan/chr_samechan_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Samechan (Same-chan), petite 20-year-old adult Japanese woman, black hair with deep blue inner color, blue eyes, small pointed shark teeth when smiling, black-and-light-blue shark-hood jacket with fin and buckles, cream top, black skirt with garter, black tights, chunky sneakers, holding her crowned blue shark plush 'Koro-chan'.
Expression and pose to keep exactly as image 1 (normal): relaxed half-lidded blue eyes and a small toothy smile, hugging the shark plush in one arm, other hand raised in a little wave

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 11% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and the shark hood) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Her current rendering is glossier, more modern-gacha than the rest of the cast, with larger sparkling eyes: tone it down to the same matte restrained shading and natural highlights as Minto and Ageha, and keep her eye size relative to her face similar to Minto's, while keeping her blue eyes, cute shark-tooth grin and identity.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 30. サメちゃん・smile

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/samechan/chr_samechan_smile.png` ／ ② `assets/sprites/characters/samechan/chr_samechan_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Samechan (Same-chan), petite 20-year-old adult Japanese woman, black hair with deep blue inner color, blue eyes, small pointed shark teeth when smiling, black-and-light-blue shark-hood jacket with fin and buckles, cream top, black skirt with garter, black tights, chunky sneakers, holding her crowned blue shark plush 'Koro-chan'.
Expression and pose to keep exactly as image 1 (smile): both eyes closed with joyful curved lids and a small open toothy smile, same plush and wave

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 11% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and the shark hood) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Her current rendering is glossier, more modern-gacha than the rest of the cast, with larger sparkling eyes: tone it down to the same matte restrained shading and natural highlights as Minto and Ageha, and keep her eye size relative to her face similar to Minto's, while keeping her blue eyes, cute shark-tooth grin and identity.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 31. サメちゃん・serious

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/samechan/chr_samechan_serious.png` ／ ② `assets/sprites/characters/samechan/chr_samechan_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Samechan (Same-chan), petite 20-year-old adult Japanese woman, black hair with deep blue inner color, blue eyes, small pointed shark teeth when smiling, black-and-light-blue shark-hood jacket with fin and buckles, cream top, black skirt with garter, black tights, chunky sneakers, holding her crowned blue shark plush 'Koro-chan'.
Expression and pose to keep exactly as image 1 (serious): softly half-lidded intent eyes, small closed pout, index finger raised in a small explanation, plush in the other arm

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 11% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and the shark hood) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Her current rendering is glossier, more modern-gacha than the rest of the cast, with larger sparkling eyes: tone it down to the same matte restrained shading and natural highlights as Minto and Ageha, and keep her eye size relative to her face similar to Minto's, while keeping her blue eyes, cute shark-tooth grin and identity.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 32. サメちゃん・surprise

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/samechan/chr_samechan_surprise.png` ／ ② `assets/sprites/characters/samechan/chr_samechan_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Samechan (Same-chan), petite 20-year-old adult Japanese woman, black hair with deep blue inner color, blue eyes, small pointed shark teeth when smiling, black-and-light-blue shark-hood jacket with fin and buckles, cream top, black skirt with garter, black tights, chunky sneakers, holding her crowned blue shark plush 'Koro-chan'.
Expression and pose to keep exactly as image 1 (surprise): round wide blue eyes and a small startled open mouth, free hand slightly open

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 11% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and the shark hood) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Her current rendering is glossier, more modern-gacha than the rest of the cast, with larger sparkling eyes: tone it down to the same matte restrained shading and natural highlights as Minto and Ageha, and keep her eye size relative to her face similar to Minto's, while keeping her blue eyes, cute shark-tooth grin and identity.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 33. サメちゃん・excited

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/samechan/chr_samechan_excited.png` ／ ② `assets/sprites/characters/samechan/chr_samechan_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Samechan (Same-chan), petite 20-year-old adult Japanese woman, black hair with deep blue inner color, blue eyes, small pointed shark teeth when smiling, black-and-light-blue shark-hood jacket with fin and buckles, cream top, black skirt with garter, black tights, chunky sneakers, holding her crowned blue shark plush 'Koro-chan'.
Expression and pose to keep exactly as image 1 (excited): breathless excited talking face, eyes a little more open, small open panting mouth with one or two shark teeth, a tiny sweat bead, index finger raised

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 11% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and the shark hood) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Her current rendering is glossier, more modern-gacha than the rest of the cast, with larger sparkling eyes: tone it down to the same matte restrained shading and natural highlights as Minto and Ageha, and keep her eye size relative to her face similar to Minto's, while keeping her blue eyes, cute shark-tooth grin and identity.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```

### 34. サメちゃん・ventriloquism

参照画像（リポジトリのパス。エージェントが読み込む）：① `assets/sprites/characters/samechan/chr_samechan_ventriloquism.png` ／ ② `assets/sprites/characters/samechan/chr_samechan_normal.png` ／ ③ `assets/sprites/characters/minto/chr_minto_normal.png`（頭身の目標）／ ④ `assets/sprites/characters/ageha/chr_ageha_normal.png`（画風の目標）

```
Remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the same person, face design, expression, pose, hand and shoulder positions, clothing, accessories and colors as image 1. Change ONLY three things: the rendering resolution and crispness, the head size correction below, and the rendering style unification below.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose and outfit. (2) the same character's normal sprite: face identity check only. (3) approved Minto normal sprite (assets/sprites/characters/minto/chr_minto_normal.png): the TARGET head-to-body proportion only. (4) approved Ageha normal sprite (assets/sprites/characters/ageha/chr_ageha_normal.png): the TARGET rendering style only. Never copy the faces, hair, bodies or outfits of images 3 and 4.

Character: Samechan (Same-chan), petite 20-year-old adult Japanese woman, black hair with deep blue inner color, blue eyes, small pointed shark teeth when smiling, black-and-light-blue shark-hood jacket with fin and buckles, cream top, black skirt with garter, black tights, chunky sneakers, holding her crowned blue shark plush 'Koro-chan'.
Expression and pose to keep exactly as image 1 (ventriloquism): holding the shark plush up in front of her face with both hands so the plush covers her whole face, ventriloquist pose

HEAD SIZE CORRECTION: in image 1 the head is too small for the body. Make the whole head about 11% LARGER relative to the body, so that the head-to-body ratio matches image 3. The character must still look like the same person of the same age.
Keep the same total figure height and the same overall silhouette and stance; only the head (face, hair and the shark hood) changes scale relative to the body, and the neck and shoulders stay natural.

STYLE UNIFICATION: match the approved Minto and Ageha sprites - fine high-resolution pixel-like game-art texture, thin crisp dark ink lines, restrained matte multi-step shading, small hand-drawn grain, natural non-glossy highlights. Her current rendering is glossier, more modern-gacha than the rest of the cast, with larger sparkling eyes: tone it down to the same matte restrained shading and natural highlights as Minto and Ageha, and keep her eye size relative to her face similar to Minto's, while keeping her blue eyes, cute shark-tooth grin and identity.

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head (including any hood or cap) to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels.

Owner update 2026-10-10: preserve image 1's original local color palette, perceived saturation and light-dark range; resolution and style unification must not lighten, desaturate or pastelize the hair, clothing, skin or accessories, and every expression must anchor its colors to its original runtime reference rather than to earlier generated images.
```
