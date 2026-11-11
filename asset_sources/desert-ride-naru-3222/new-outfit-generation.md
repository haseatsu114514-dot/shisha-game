# なる・新版服装サンドボード原画 台帳

Issue #3306。Codex 内蔵画像生成を使用し、各ポーズを1回ずつ生成した。保存先はこのフォルダ。ゲーム組み込み用の WebP は含まない。

## 参照画像の役割

1. **服装と人物（新版が正）**: `assets/sprites/character_variants/new/naru/chr_naru_normal.png`
2. **ポーズ・構図・大きさ・板の遠近**: `asset_sources/desert-ride-naru-3222/rider_naru_<pose>.png`
3. **画風**: `remake/img/ui/desert_ride/rider_<pose>.webp`
4. **同一人物固定（2枚目以降）**: このフォルダの `rider_naru_ride.png`（生成時の初版）

## 検品結果

| 原画 | 新版服装・旧版要素なし | ポーズ・板の向き | 全身・指先・髪・板 | 四隅・余白・輪郭 |
|---|---|---|---|---|
| `rider_naru_ride.png` | 合格 | 現行原画と照合し合格 | 切れなし | 四隅透過、四辺5%以上、にじみ・ゴミなし |
| `rider_naru_lean_left.png` | 合格 | 現行原画と照合し合格 | 切れなし | 四隅透過、四辺5%以上、にじみ・ゴミなし |
| `rider_naru_lean_right.png` | 合格 | 現行原画と照合し合格 | 切れなし | 四隅透過、四辺5%以上、にじみ・ゴミなし |
| `rider_naru_jump.png` | 合格 | 現行原画と照合し合格 | 切れなし | 四隅透過、四辺5%以上、にじみ・ゴミなし |
| `rider_naru_brace.png` | 合格 | 現行原画と照合し合格 | 切れなし | 四隅透過、四辺5%以上、にじみ・ゴミなし |
| `rider_naru_fall.png` | 合格 | 現行原画と照合し合格 | 切れなし | 四隅透過、四辺5%以上、にじみ・ゴミなし |

6枚とも銀灰色の髪、日焼け肌、焦げ茶とクリームの短いボンバー（袖に白線）、焦げ茶のタートルネック、灰色のワイドカーゴ（焦げ茶・クリームの切替とクリームのフラップポケット）、茶とクリームの厚底靴、焦げ茶のバインディング、クリーム色の板を目視確認。黒と白の旧ボンバー、黒いTシャツ、黒いカーゴ、銀チェーン、白い靴は見られない。転倒は人物と板が分離している。

生成直後の透明画素に残った赤・黄の RGB ノイズを、アルファ値16以下の画素を完全透明にして RGB もゼロにする方法で除去した。四辺に透明余白を追加し、孤立したごく小さい画素を除去した。不透明な本体画素は変更していない。

## 生成時に使用した依頼文全文

### ride

```text
Input image roles: image 1 = outfit and character identity, new portrait at assets/sprites/character_variants/new/naru/chr_naru_normal.png; image 2 = exact pose, framing, scale and board perspective, current original at asset_sources/desert-ride-naru-3222/rider_naru_ride.png; image 3 = anime linework and cel shading style, protagonist at remake/img/ui/desert_ride/rider_ride.webp. Use case: stylized-concept. Asset type: transparent game sprite original.
Game sprite, back view of a 23-year-old Japanese man riding a cream-colored sandboard down a dune.
Same character and the SAME NEW OUTFIT as the attached portrait (image 1, chr_naru_normal.png, new version): short spiky silver-gray hair, tanned skin; a cropped bomber jacket color-blocked in dark brown and cream with white stripes on the sleeves, stand-up collar, front open, ribbed cuffs and hem; a dark brown ribbed turtleneck sweater underneath; wide gray cargo pants with dark brown and cream panels and cream flap pockets on the thighs; chunky brown-and-cream sneakers strapped to the board with dark brown bindings. The back of the jacket follows the front color-blocking (mostly dark brown, cream panels, white sleeve stripes).
Do NOT use the old outfit: no black bomber with white panels, no black T-shirt, no black cargo pants, no silver wallet chain, no white sneakers.
Keep EXACTLY the pose, camera angle, framing, body proportions and board perspective of the attached pose reference (image 2, rider_naru_ride.png) - only the clothes change. Back view only, face not visible.
Clean Japanese anime style with clear outlines and soft cel shading, matching the attached protagonist sprite (image 3, rider_ride.webp).
Fully transparent background (real alpha, not a checkerboard). The whole figure, all fingers, the hair and the whole board inside the frame with at least 5% transparent margin. No ground, no sand, no dust, no shadow, no text, no logos, no other people, no hookah equipment.
File: rider_naru_ride.png
```

### lean_left

```text
Input image roles: image 4 = identity lock using the newly generated rider_naru_ride.png; image 1 = outfit and character identity, new portrait at assets/sprites/character_variants/new/naru/chr_naru_normal.png; image 2 = exact pose, framing, scale and board perspective, current original at asset_sources/desert-ride-naru-3222/rider_naru_lean_left.png; image 3 = anime linework and cel shading style, protagonist at remake/img/ui/desert_ride/rider_lean_left.webp. Use case: stylized-concept. Asset type: transparent game sprite original.
Game sprite, back view of a 23-year-old Japanese man riding a cream-colored sandboard down a dune.
Same character and the SAME NEW OUTFIT as the attached portrait (image 1, chr_naru_normal.png, new version): short spiky silver-gray hair, tanned skin; a cropped bomber jacket color-blocked in dark brown and cream with white stripes on the sleeves, stand-up collar, front open, ribbed cuffs and hem; a dark brown ribbed turtleneck sweater underneath; wide gray cargo pants with dark brown and cream panels and cream flap pockets on the thighs; chunky brown-and-cream sneakers strapped to the board with dark brown bindings. The back of the jacket follows the front color-blocking (mostly dark brown, cream panels, white sleeve stripes).
Do NOT use the old outfit: no black bomber with white panels, no black T-shirt, no black cargo pants, no silver wallet chain, no white sneakers.
Keep EXACTLY the pose, camera angle, framing, body proportions and board perspective of the attached pose reference (image 2, rider_naru_lean_left.png; leaning hard to the screen's left, carving a turn) - only the clothes change. Back view only, face not visible.
Clean Japanese anime style with clear outlines and soft cel shading, matching the attached protagonist sprite (image 3, rider_ride.webp).
Fully transparent background (real alpha, not a checkerboard). The whole figure, all fingers, the hair and the whole board inside the frame with at least 5% transparent margin. No ground, no sand, no dust, no shadow, no text, no logos, no other people, no hookah equipment.
File: rider_naru_lean_left.png
Keep the same new outfit and exact identity as image 4.
```

### lean_right

```text
Input image roles: image 4 = identity lock using the newly generated rider_naru_ride.png; image 1 = outfit and character identity, new portrait at assets/sprites/character_variants/new/naru/chr_naru_normal.png; image 2 = exact pose, framing, scale and board perspective, current original at asset_sources/desert-ride-naru-3222/rider_naru_lean_right.png; image 3 = anime linework and cel shading style, protagonist at remake/img/ui/desert_ride/rider_lean_right.webp. Use case: stylized-concept. Asset type: transparent game sprite original.
Game sprite, back view of a 23-year-old Japanese man riding a cream-colored sandboard down a dune.
Same character and the SAME NEW OUTFIT as the attached portrait (image 1, chr_naru_normal.png, new version): short spiky silver-gray hair, tanned skin; a cropped bomber jacket color-blocked in dark brown and cream with white stripes on the sleeves, stand-up collar, front open, ribbed cuffs and hem; a dark brown ribbed turtleneck sweater underneath; wide gray cargo pants with dark brown and cream panels and cream flap pockets on the thighs; chunky brown-and-cream sneakers strapped to the board with dark brown bindings. The back of the jacket follows the front color-blocking (mostly dark brown, cream panels, white sleeve stripes).
Do NOT use the old outfit: no black bomber with white panels, no black T-shirt, no black cargo pants, no silver wallet chain, no white sneakers.
Keep EXACTLY the pose, camera angle, framing, body proportions and board perspective of the attached pose reference (image 2, rider_naru_lean_right.png; leaning hard to the screen's right) - only the clothes change. Back view only, face not visible.
Clean Japanese anime style with clear outlines and soft cel shading, matching the attached protagonist sprite (image 3, rider_ride.webp).
Fully transparent background (real alpha, not a checkerboard). The whole figure, all fingers, the hair and the whole board inside the frame with at least 5% transparent margin. No ground, no sand, no dust, no shadow, no text, no logos, no other people, no hookah equipment.
File: rider_naru_lean_right.png
Keep the same new outfit and exact identity as image 4.
```

### jump

```text
Input image roles: image 4 = identity lock using the newly generated rider_naru_ride.png; image 1 = outfit and character identity, new portrait at assets/sprites/character_variants/new/naru/chr_naru_normal.png; image 2 = exact pose, framing, scale and board perspective, current original at asset_sources/desert-ride-naru-3222/rider_naru_jump.png; image 3 = anime linework and cel shading style, protagonist at remake/img/ui/desert_ride/rider_jump.webp. Use case: stylized-concept. Asset type: transparent game sprite original.
Game sprite, back view of a 23-year-old Japanese man riding a cream-colored sandboard down a dune.
Same character and the SAME NEW OUTFIT as the attached portrait (image 1, chr_naru_normal.png, new version): short spiky silver-gray hair, tanned skin; a cropped bomber jacket color-blocked in dark brown and cream with white stripes on the sleeves, stand-up collar, front open, ribbed cuffs and hem; a dark brown ribbed turtleneck sweater underneath; wide gray cargo pants with dark brown and cream panels and cream flap pockets on the thighs; chunky brown-and-cream sneakers strapped to the board with dark brown bindings. The back of the jacket follows the front color-blocking (mostly dark brown, cream panels, white sleeve stripes).
Do NOT use the old outfit: no black bomber with white panels, no black T-shirt, no black cargo pants, no silver wallet chain, no white sneakers.
Keep EXACTLY the pose, camera angle, framing, body proportions and board perspective of the attached pose reference (image 2, rider_naru_jump.png; in the air, knees tucked, board tilted) - only the clothes change. Back view only, face not visible.
Clean Japanese anime style with clear outlines and soft cel shading, matching the attached protagonist sprite (image 3, rider_ride.webp).
Fully transparent background (real alpha, not a checkerboard). The whole figure, all fingers, the hair and the whole board inside the frame with at least 5% transparent margin. No ground, no sand, no dust, no shadow, no text, no logos, no other people, no hookah equipment.
File: rider_naru_jump.png
Keep the same new outfit and exact identity as image 4.
```

### brace

```text
Input image roles: image 4 = identity lock using the newly generated rider_naru_ride.png; image 1 = outfit and character identity, new portrait at assets/sprites/character_variants/new/naru/chr_naru_normal.png; image 2 = exact pose, framing, scale and board perspective, current original at asset_sources/desert-ride-naru-3222/rider_naru_brace.png; image 3 = anime linework and cel shading style, protagonist at remake/img/ui/desert_ride/rider_brace.webp. Use case: stylized-concept. Asset type: transparent game sprite original.
Game sprite, back view of a 23-year-old Japanese man riding a cream-colored sandboard down a dune.
Same character and the SAME NEW OUTFIT as the attached portrait (image 1, chr_naru_normal.png, new version): short spiky silver-gray hair, tanned skin; a cropped bomber jacket color-blocked in dark brown and cream with white stripes on the sleeves, stand-up collar, front open, ribbed cuffs and hem; a dark brown ribbed turtleneck sweater underneath; wide gray cargo pants with dark brown and cream panels and cream flap pockets on the thighs; chunky brown-and-cream sneakers strapped to the board with dark brown bindings. The back of the jacket follows the front color-blocking (mostly dark brown, cream panels, white sleeve stripes).
Do NOT use the old outfit: no black bomber with white panels, no black T-shirt, no black cargo pants, no silver wallet chain, no white sneakers.
Keep EXACTLY the pose, camera angle, framing, body proportions and board perspective of the attached pose reference (image 2, rider_naru_brace.png; deep crouch bracing for the landing) - only the clothes change. Back view only, face not visible.
Clean Japanese anime style with clear outlines and soft cel shading, matching the attached protagonist sprite (image 3, rider_ride.webp).
Fully transparent background (real alpha, not a checkerboard). The whole figure, all fingers, the hair and the whole board inside the frame with at least 5% transparent margin. No ground, no sand, no dust, no shadow, no text, no logos, no other people, no hookah equipment.
File: rider_naru_brace.png
Keep the same new outfit and exact identity as image 4.
```

### fall

```text
Input image roles: image 4 = identity lock using the newly generated rider_naru_ride.png; image 1 = outfit and character identity, new portrait at assets/sprites/character_variants/new/naru/chr_naru_normal.png; image 2 = exact pose, framing, scale and board perspective, current original at asset_sources/desert-ride-naru-3222/rider_naru_fall.png; image 3 = anime linework and cel shading style, protagonist at remake/img/ui/desert_ride/rider_fall.webp. Use case: stylized-concept. Asset type: transparent game sprite original.
Game sprite, back view of a 23-year-old Japanese man riding a cream-colored sandboard down a dune.
Same character and the SAME NEW OUTFIT as the attached portrait (image 1, chr_naru_normal.png, new version): short spiky silver-gray hair, tanned skin; a cropped bomber jacket color-blocked in dark brown and cream with white stripes on the sleeves, stand-up collar, front open, ribbed cuffs and hem; a dark brown ribbed turtleneck sweater underneath; wide gray cargo pants with dark brown and cream panels and cream flap pockets on the thighs; chunky brown-and-cream sneakers strapped to the board with dark brown bindings. The back of the jacket follows the front color-blocking (mostly dark brown, cream panels, white sleeve stripes).
Do NOT use the old outfit: no black bomber with white panels, no black T-shirt, no black cargo pants, no silver wallet chain, no white sneakers.
Keep EXACTLY the pose, camera angle, framing, body proportions and board perspective of the attached pose reference (image 2, rider_naru_fall.png; tumbling sideways, the board completely detached) - only the clothes change. Back view only, face not visible.
Clean Japanese anime style with clear outlines and soft cel shading, matching the attached protagonist sprite (image 3, rider_ride.webp).
Fully transparent background (real alpha, not a checkerboard). The whole figure, all fingers, the hair and the whole board inside the frame with at least 5% transparent margin. No ground, no sand, no dust, no shadow, no text, no logos, no other people, no hookah equipment.
File: rider_naru_fall.png
Keep the same new outfit and exact identity as image 4.
```
