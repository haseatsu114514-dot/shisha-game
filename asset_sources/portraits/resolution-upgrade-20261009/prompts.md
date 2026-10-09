# 立ち絵の画質そろえ：コピペ用プロンプト（前園・南雲・スミさん）

[調査と方針](README.md) の対象A。**1回の生成で1人・1表情**。下の各ブロックを、指定の画像4枚を添付して1回ずつ貼る。
デザイン・表情・ポーズ・身長は変えず、描き込みの細かさだけを上げる依頼。

## チャットで頼むときの手順（ChatGPT・Codexのどちらでも）

1. 添付する4枚をGitHubから保存する（`Raw` で開いて保存）。
   - ① いま作り直す表情の現行PNG（各ブロックに書いたパス）
   - ② 同じキャラの `chr_<id>_normal.png`（①が通常のときは省略してよい）
   - ③ 凛 `assets/sprites/characters/rin/chr_rin_normal.png`（画質だけの参照）
   - ④ みんと `assets/sprites/characters/minto/chr_minto_normal.png`（画質だけの参照）
2. 新しいチャットで、①→②→③→④の順に添付し、そのキャラ・表情のブロックをそのまま貼って送る。
3. できた画像を原寸で見て、下のチェックを確認する。ダメなら同じチャットで「顔を画像1にもっと近づけて」「手の位置を画像1と同じに」など、**直す点だけ**を伝えて作り直す。
4. 1キャラ5表情がそろったら、並べて同じ人物に見えるか確認する。
5. 合格した原画をリポジトリの `asset_sources/portraits/<id>-resolution-v1/` に置いて commit（PCに置いたままにしない）。組み込みはClaude/Codexに「resolution-upgrade の受け取り手順で組み込んで」と頼む。

### 生成後チェック（1枚ごと）

- [ ] 人物の高さが1300px以上（画像の情報で確認）。背景が透明で、手足の間も抜けている
- [ ] ①と並べて、顔・表情・手と肩の位置・衣装・小物・頭身が変わっていない
- [ ] 線が細くくっきり。ぼやけ・のっぺり・粗いドット・つやつやのCG感がない（③④と原寸で比べる）
- [ ] 若返り・痩せ・美形化していない
- [ ] 文字・枠・影・床が入っていない

## 前園（maezono）

### 1. 前園・normal

添付：① `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (normal): gentle small closed-mouth smile, SCREEN-LEFT hand lifted in a friendly greeting wave, SCREEN-RIGHT hand in the trouser pocket

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 2. 前園・smile

添付：① `assets/sprites/characters/maezono/chr_maezono_smile.png` ／ ② `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (smile): both eyes closed, joyful open-mouth smile, the same SCREEN-LEFT greeting hand, SCREEN-RIGHT hand in the pocket

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 3. 前園・serious

添付：① `assets/sprites/characters/maezono/chr_maezono_serious.png` ／ ② `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (serious): thoughtful brows, closed mouth, SCREEN-LEFT hand against the chin, SCREEN-RIGHT hand in the pocket

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 4. 前園・surprise

添付：① `assets/sprites/characters/maezono/chr_maezono_surprise.png` ／ ② `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (surprise): round open eyes and a small O-shaped mouth, SCREEN-LEFT palm raised, SCREEN-RIGHT hand in the pocket

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 5. 前園・excited

添付：① `assets/sprites/characters/maezono/chr_maezono_excited.png` ／ ② `assets/sprites/characters/maezono/chr_maezono_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Maezono, 39-year-old friendly Japanese man, slightly plump adult build, round warm cheeks, short tousled dark brown hair, thin ROUND dark-rim spectacles, clean-shaven, navy blazer with brass buttons, pale blue open-collar shirt without necktie, tan/beige chinos, brown leather belt and brown loafers, small spiral notepad and gold pen in the SCREEN-RIGHT breast pocket.
Expression and pose to keep exactly as image 1 (excited): both eyes open, big delighted open-mouth grin, SCREEN-LEFT fist near the shoulder, SCREEN-RIGHT fist near the waist, leaning forward slightly

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

## 南雲（nagumo）

### 6. 南雲・normal

添付：① `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (normal): authoritative neutral face, both hands down

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 7. 南雲・smile

添付：① `assets/sprites/characters/nagumo/chr_nagumo_smile.png` ／ ② `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (smile): subtle closed-mouth approving smirk with both eyes open, SCREEN-LEFT hand slightly open in welcome

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 8. 南雲・serious

添付：① `assets/sprites/characters/nagumo/chr_nagumo_serious.png` ／ ② `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (serious): furrowed brows and a focused intimidating gaze, small SCREEN-LEFT hand explanatory gesture at the waist

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 9. 南雲・surprise

添付：① `assets/sprites/characters/nagumo/chr_nagumo_surprise.png` ／ ② `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (surprise): eyes wider, mouth slightly open, SCREEN-RIGHT hand lifted slightly to the chest, no comic symbols

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 10. 南雲・thinking

添付：① `assets/sprites/characters/nagumo/chr_nagumo_thinking.png` ／ ② `assets/sprites/characters/nagumo/chr_nagumo_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Nagumo, 45-year-old stern Japanese male executive and contest head judge, tall lean broad-shouldered adult build, angular mature face, strong dark eyebrows, narrow sharp eyes, subtle brow and cheek wrinkles, clean-shaven, swept-back short black hair with a grey patch over the SCREEN-RIGHT temple, dark charcoal three-piece suit with buttoned waistcoat, white shirt, dark patterned tie, white pocket square, black belt with silver buckle, silver wristwatch, polished black lace-up shoes.
Expression and pose to keep exactly as image 1 (thinking): SCREEN-LEFT hand under the chin, SCREEN-RIGHT hand in the trouser pocket, slight sideways gaze

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

## スミさん（sumi）

### 11. スミさん・normal

添付：① `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (normal): calm approachable faint closed-mouth smile, both hands casually tucked into the pockets

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 12. スミさん・smile

添付：① `assets/sprites/characters/sumi/chr_sumi_smile.png` ／ ② `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (smile): warmer friendly smile with slightly parted lips and both eyes gently open, SCREEN-LEFT hand in a small open-palm welcoming gesture just above the waist, the other hand in the pocket

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 13. スミさん・serious

添付：① `assets/sprites/characters/sumi/chr_sumi_serious.png` ／ ② `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (serious): focused eyes, knitted eyebrows and a firm closed mouth, SCREEN-LEFT hand near the lower chest with one index finger up in a small explanatory gesture, SCREEN-RIGHT hand at the apron-side pocket

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 14. スミさん・surprise

添付：① `assets/sprites/characters/sumi/chr_sumi_surprise.png` ／ ② `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (surprise): raised brows, open attentive eyes behind the glasses and a small open 'oh' mouth, SCREEN-LEFT hand drawn slightly up toward the chest with the palm partly open, shoulders slightly raised

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```

### 15. スミさん・thinking

添付：① `assets/sprites/characters/sumi/chr_sumi_thinking.png` ／ ② `assets/sprites/characters/sumi/chr_sumi_normal.png` ／ ③ 凛 normal ／ ④ みんと normal

```
Upscale-remaster the attached CURRENT game sprite (image 1) into ONE higher-resolution full-body character sprite with a transparent background. This is NOT a redesign: keep the exact same person, face, expression, pose, hand and shoulder positions, clothing, accessories, colors and head-to-body proportions as image 1. Only the rendering resolution and crispness should improve.

Reference roles in order: (1) the current sprite of this exact expression: highest priority for identity, expression, pose, outfit and proportions. (2) the same character's normal sprite: face identity check only. (3) approved Rin sprite and (4) approved Minto sprite: ONLY the target rendering quality - fine high-resolution pixel-like game-art texture, thin crisp ink lines, restrained matte multi-step shading. Never copy their faces, hair, bodies or outfits.

Character: Sumi (Sumida Joichiro), seasoned 46-year-old Japanese male shisha shop owner, 182 cm, tall adult masculine build, warm tan skin, angular mature jaw, thick black eyebrows, calm dark brown eyes behind black RECTANGULAR glasses with clear lenses, short black tousled hair under a BLACK soft flat/newsboy cap, black moustache and short full beard around the mouth, chin and jaw, charcoal-black collared shirt with open top button and sleeves rolled below the elbows, long tobacco-brown waist apron without bib, straight black trousers and black leather ankle shoes.
Expression and pose to keep exactly as image 1 (thinking): SCREEN-LEFT hand gently at the beard and chin, SCREEN-RIGHT forearm folded across the torso supporting that elbow, slightly narrowed eyes, contemplative closed mouth, head inclined slightly

Output: ONE complete full-body figure on a tall canvas about 1085x1450, the figure itself at least 1300 px tall from the top of the head to the bottom of the shoes. Include all hair tips, both hands and both entire shoes, with clean transparent margins on every side. True RGBA transparent background, also between the limbs. No floor, cast shadow, glow, border, text, labels, grid or watermark. Not a glossy 3D render, airbrush, photo, blur, added noise or coarse retro pixels. Do not make the man younger, slimmer or more handsome than image 1.
```
