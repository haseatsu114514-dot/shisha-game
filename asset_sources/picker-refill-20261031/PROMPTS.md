# 画像選別の再補充プロンプト（2026-10-31）

> 2026-11-08 追記: 章末予告は廃止し、90年代風（OVA・セル画）の画風も使わないため、予告スチル（`t-trailer-*`）の指示・生成物・参照画像を削除した（オーナー指示・要望台帳 RX01）。

#1980 の残り。オーナー指示（2026-10-31）: ロゴ微調整4件は決定済みのため不要。ひより・ましろ・サメちゃん・予告 第3章03・第4章02 は再補充、第4章03 も補充。
生成: `python3 tools/picker_refill_generate.py --set 20261031 --model gpt-image-2.5-sunburst`（出力は out/<対象ID>/）。共通部分は 1030 の PROMPTS.md から転記。

## 1. `t-ext-hiyori`

```text
【対象】t-ext-hiyori ／ タイトルアート拡充（シーシャ中心） ／ ひより ／ 修正版（残す画像を元に直す）
【使い方】このブロックだけで完結しています。まず元画像を添付し、下の「直す点」だけを編集した版を5通り作ってください（1回に1枚ずつ）。
【元画像（必ず添付・画像1）】title_art_hiyori_new33_parts_wash_rack.png（asset_sources/picker-refill-20261031/refs/ にある選別画面のプレビュー）
【保存先】asset_sources/picker-refill-20261031/out/t-ext-hiyori/ に refill1031-t-ext-hiyori-01.png 〜 refill1031-t-ext-hiyori-05.png
【サイズ】元画像と同じ縦2:3（1024x1536）PNG・不透明
【添付する画像（役割を区別する）】
1. 元画像 title_art_hiyori_new33_parts_wash_rack.png（構図・画風の正。これを編集する）
2. 本人確認用: assets/sprites/characters/hiyori/chr_hiyori_normal.png
3. 場所の正: assets/backgrounds/bg_tonari_inside_day.png（tonariの素材・色。新しい内装を足さない）
4. 機材の実写: 洗浄・乾燥中の部品の実写（ガラスベース・ステム・受け皿・ホース・ボウル）。早見表・構造図は添付しない
【直す点（オーナー指示）】
- 謎植物が多い → 植物をなくす（鉢・つる・吊り草・葉をすべて除去）
- シーシャを図解どおりに（部品の形・積み順・接続を正しく）
【そのまま残す点】
- 構図はこのまま（オーナー指定）。人物・顔・ポーズ・洗い場の配置・光・画風
【前回（1030）からの変更】
- 1030の5枚はどれも採用されなかった（理由の記入なし）。直す点・残す点は同じで、手の動きを5通りに変えて選択肢を広げる。
- 元画像を添付の先頭に置く（1030では最後だった）。

【共通スタイル指針（正本: Draft PR #1287 prompts/<キャラ>.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

IDENTITY (keep exactly as in image 1): Hiyori, 25-year-old Japanese office worker and former tonari part-timer: reddish pink-brown hair in a high ponytail, light bangs, bright brown eyes, soft friendly face, white-ivory lace blouse (opaque lining) with small stand collar and short French sleeves, black slacks.

EDIT RULE: Keep image 1's composition, the woman, her face, pose, the wash/drying rack location, lighting and art style. (1) Remove every plant, pot, vine and leaf; fill those areas with the plain wall, tiles or shelf surface already present. (2) Redraw the shisha parts so they are physically correct for a WASHING / DRYING scene: parts are separated and each is a recognizable real part — a glass water base standing upside-down or upright to drain, a straight metal stem with its round ash tray (tray is a separate wide shallow dish or still on the stem), a hose hung in one simple loop to dry with its rigid handle at one end and its port connector at the other end, and a ceramic bowl (cup on a slim neck) drying rim-down. No charcoal, no HMD with coals, no smoke, no lit parts in a washing scene. Do not merge parts into each other or into the rack. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG: bowl fused to stem, cup-shaped stem top, hose with two handles or three ends, extra unexplained tubes, plants.

--- 1/5: refill1031-t-ext-hiyori-01.png ---
She rinses the clear glass base under the tap, water running inside it; the other parts drying on the rack as in image 1. Hose: one hose on a hook, both ends visible.
8行:
人物      : hiyori
場面      : 準備中（洗浄。炭なし）
台の型    : 分解した部品（ガラスベース・ステム・受け皿・ボウル）
HMD       : なし
炭        : なし
ホース    : 1本をフックに一巻き。両端が見える
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり

--- 2/5: refill1031-t-ext-hiyori-02.png ---
She dries the clear glass base with a white towel, holding it at chest height; stem, tray and bowl on the rack.
8行:
人物      : hiyori
場面      : 準備中（拭き上げ）
台の型    : 分解した部品
HMD       : なし
炭        : なし
ホース    : フックに一巻き
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり

--- 3/5: refill1031-t-ext-hiyori-03.png ---
She holds the clean ceramic bowl up toward the window light with one hand, checking the small holes in its bottom; palm-sized bowl at the same depth as her hand.
8行:
人物      : hiyori
場面      : 準備中（点検）
台の型    : 分解した部品
HMD       : なし
炭        : なし
ホース    : フックに一巻き
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり

--- 4/5: refill1031-t-ext-hiyori-04.png ---
She rinses the rigid hose handle under the tap; the rest of the hose hangs coiled once on the hook beside the sink, port end visible.
8行:
人物      : hiyori
場面      : 準備中（ハンドルの洗浄）
台の型    : 分解した部品
HMD       : なし
炭        : なし
ホース    : 1本。ハンドル側を手に、残りはフックに
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり

--- 5/5: refill1031-t-ext-hiyori-05.png ---
Calm version: only the glass base, stem and bowl on the rack, wide clean wall where the plants were; she glances back over her shoulder at the viewer with a soft smile, wet hands.
8行:
人物      : hiyori
場面      : 準備中（乾燥）
台の型    : ガラスベース・ステム・ボウルのみ
HMD       : なし
炭        : なし
ホース    : フックに一巻き
吸い口    : ハンドルはホースの一端
構図      : 元画像どおり

```

## 2. `t-ext-mashiro`

```text
【対象】t-ext-mashiro ／ タイトルアート拡充（シーシャ中心） ／ ましろ（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】asset_sources/picker-refill-20261031/out/t-ext-mashiro/ に refill1031-t-ext-mashiro-01.png 〜 refill1031-t-ext-mashiro-05.png
【サイズ】縦2:3・1024x1536 PNG・不透明（透過なし）。タイトル画面右側に置くため、画面左20%は後でUIがかかってもよい余白寄りにし、顔と手元は中央〜右寄りに。
【添付する画像（役割を区別する）】
1. 本人（顔・髪・衣装・年齢感の正）: assets/sprites/characters/mashiro/chr_mashiro_normal.png
2. 画風・質感・描画密度のみ（#1243で採用済みの同キャラのタイトル絵。場面・機材・背景は移さない）: assets/ui/title_arts/title_art_mashiro_04_cherry_petals.png
3. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_mukai_shop.png（第3章・東京のmukai店内。青灰色の壁・オリーブ色の長椅子・珈琲カウンター・夕方の東京の窓景）
4. 機材の実写（形と縮尺）: 各画像で選んだHMDをボウルに装着した実写と、台全体の実写。オーナー手元の元写真（asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md の No.05・06 など）か、installed-and-handheld-scale-20261009.md の出典から取得。※早見表・構造図（drawing-sheet の PNG）は添付しない
【方針】シーシャが主役級のタイトル絵。5枚で行動（喫煙／詰める／炭を置く／休憩）・時間帯・台の型・HMDモデルを変える。背景はmukaiの実背景から切り出した一角として描き、新しい店を作らない。
【前回（1030）からの変更】
- 1030の5枚（長椅子で吐く／カウンターで詰める／閉店後の長椅子／炭を置く／雨の窓辺）はどれも採用されなかった。場面を変えた5枚にする。

【共通スタイル指針（正本: Draft PR #1287 prompts/<キャラ>.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: asset_sources/shisha-hardware-reference/drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.

IDENTITY (follow attached image 1 first; this text only reminds): Mashiro, 22-year-old Japanese woman, staff at mukai (tonari's sister shop in Tokyo): pale ash-blonde hair in two long braids with soft bangs, sleepy half-lidded golden eyes, beige oversized knit cardigan over a white blouse with a small ribbon, long sage-green skirt, brown shoes. Relaxed, gently sleepy, peer-friend vibe. Loves dark-leaf / cigar-leaf blends and heavy dense smoke.

ALWAYS: exactly one hookah in the picture and exactly one hose with one rigid handle. No second hookah, no spare hose or spare mouthpiece lying around. Bowl not yet fitted = the top of the stem is a small convex metal post (never a cup or bowl-shaped stem top). Finished/smoking = HMD on the bowl with coals inside it, never coals directly on foil. Hands holding a bowl or HMD keep them at the same depth as the hand, one-hand size, not pushed toward the camera. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG shapes: hose forking into a Y / a third hose end / hose loop around the character's legs (see asset_sources/shisha-hardware-reference/ng-examples/README.md); squashed short bowl neck; HMD as big as a head; giant red coal rocks or flames; smoke coming out of the HMD, hose root or water base; stem top shaped like a cup.

--- 1/5: refill1031-t-ext-mashiro-01.png ---
Dusk at mukai: Mashiro sits on the olive bench hugging a small cushion, the rigid handle in one hand, and lets out a slow dense exhale that drifts sideways below her eyes; the finished hookah stands on the low table in front of her, ONMO-type HMD with 2 small cube coals inside. Tokyo dusk in the existing window.
8行:
人物      : mashiro
場面      : 完成（喫煙中）
台の型    : 低いテーブルの上の1台
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 1本（ポート→手のハンドル）
吸い口    : なし
構図      : 長椅子・クッションを抱える・窓の夕景

--- 2/5: refill1031-t-ext-mashiro-02.png ---
Afternoon at the mukai coffee counter: Mashiro pours tea from a small teapot into two cups, looking up at the viewer with a sleepy smile as if offering one; the finished hookah stands at the far end of the counter, Kaloud Lotus I+-type HMD with its lid closed, faint glow at the vents, only a thin haze in the air.
8行:
人物      : mashiro
場面      : 完成（休憩中）
台の型    : カウンター端の1台
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 1本。ハンドルは受け皿のふちに掛ける
吸い口    : なし
構図      : お茶を注ぐ手元と顔

--- 3/5: refill1031-t-ext-mashiro-03.png ---
Evening: Mashiro rests her cheek on her folded arms on the counter, gazing sideways at the glass base of the hookah where soft bubbles rise in the lower water; ONMO-type HMD with 2 coals; the handle lies on the counter by her arm.
8行:
人物      : mashiro
場面      : 完成（ぼんやり眺める）
台の型    : カウンターの1台
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 1本（ポート→カウンターに置いたハンドル）
吸い口    : なし
構図      : 腕に頬をのせた横顔とガラスの泡

--- 4/5: refill1031-t-ext-mashiro-04.png ---
Mashiro checks the heat: she holds one hand flat about a palm-width above the open Kaloud Lotus I+-type HMD (lid resting on the tray, 2 coals visible inside) with her eyes closed, concentrating, the other hand holding the rigid handle near her lips.
8行:
人物      : mashiro
場面      : 完成（熱の確認）
台の型    : テーブルの1台
HMD       : Lotus I+型（蓋は受け皿の上・取手1本）
炭        : 小さな角炭2個（見える）
ホース    : 1本（ポート→手のハンドル）
吸い口    : なし
構図      : HMDの上にかざした手と閉じた目

--- 5/5: refill1031-t-ext-mashiro-05.png ---
Night at mukai after closing: Mashiro sits on the bench wrapped in a light blanket, both hands around a warm teacup, smiling softly at the viewer; the hookah stands on the low table beside her with a Kaloud Lotus I+-type HMD, lid closed, faint glow; the rigid handle rests on the tray. Night Tokyo lights in the existing window.
8行:
人物      : mashiro
場面      : 完成（一服の後）
台の型    : 低いテーブルの1台
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 1本。ハンドルは受け皿の上
吸い口    : なし
構図      : 毛布・両手の茶碗・夜の窓

```

## 3. `t-ext-samechan`

```text
【対象】t-ext-samechan ／ タイトルアート拡充（シーシャ中心） ／ サメちゃん（新規補充・全没） ／ 新規補充（全没）
【使い方】このブロックだけで完結しています。5枚は1回に1枚ずつ別々に生成してください（まとめて1枚のシートにしない）。
【保存先】asset_sources/picker-refill-20261031/out/t-ext-samechan/ に refill1031-t-ext-samechan-01.png 〜 refill1031-t-ext-samechan-05.png
【サイズ】縦2:3・1024x1536 PNG・不透明（透過なし）。タイトル画面右側に置くため、画面左20%は後でUIがかかってもよい余白寄りにし、顔と手元は中央〜右寄りに。
【添付する画像（役割を区別する）】
1. 本人（顔・髪・衣装・年齢感の正）: assets/sprites/characters/samechan/chr_samechan_normal.png
2. 画風・質感・描画密度のみ（#1243で採用済みの同キャラのタイトル絵。場面・機材・背景は移さない）: assets/ui/title_arts/title_art_samechan_04_throne_pose.png
3. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_shishark.png（SHISHARK店内）
4. 場所の正（ゲーム内の実背景。家具・壁・照明・色の基準。新しい内装を作らない）: assets/backgrounds/bg_shishark_preparing_night.png（準備中の夜。3枚目で使う）
5. 機材の実写（形と縮尺）: 各画像で選んだHMDをボウルに装着した実写と、台全体の実写。オーナー手元の元写真（asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md の No.05・06 など）か、installed-and-handheld-scale-20261009.md の出典から取得。※早見表・構造図（drawing-sheet の PNG）は添付しない
【方針】シーシャ中心。パペット（コロちゃん）は必ず右手、シーシャの作業とハンドルは左手。過去QCでホースの遠端が画面外に抜けて接続を確認できない点が残ったため、5枚ともホースの両端（側面ポートとハンドル）を画面内に入れる。
【前回（1030）からの変更】
- 1030の5枚（詰める／ブースで吐く／夜に炭を置く／通路を運ぶ／煙の輪）はどれも採用されなかった。場面を変えた5枚にする。パペットは右手、作業とハンドルは左手、ホースの両端を画面内に入れる点は同じ。

【共通スタイル指針（正本: Draft PR #1287 prompts/<キャラ>.md「共通スタイル指定」から転記・改変なし）】
Warm anime-style illustration matching a cozy slice-of-life visual novel: clean confident linework, soft painterly cel shading, gentle warm lighting with soft bloom, calm friendly everyday atmosphere, rich but soft color palette. Vertical portrait composition, aspect ratio 2:3 (1024x1536), designed as a title-screen key visual: one single character is the clear, large focal point (figure fills roughly 60–80% of the frame height, face clearly readable), background softly detailed with gentle depth of field. Exactly one person in the image; no other people, no crowds, no silhouettes of bystanders. Absolutely no text, letters, numbers, logos, watermarks or readable signage; all packaging, paper, screens and signs are blank or blurred. Wholesome, modest framing; no suggestive posing. High quality, detailed face and hands, correct anatomy.
Negative: text, lettering, logo, watermark, signature, extra people, crowd, extra fingers, deformed hands, blurry face, nsfw, revealing clothing, pixel art, photorealistic, 3d render.

【シーシャ構造（正本: asset_sources/shisha-hardware-reference/drawing-sheet/README.md「プロンプトに貼る文」English・改変なし）】
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

HMD MODEL MENU (pick exactly ONE per image as written in that image's 8 lines; never mix parts):
- ONMO-type: a low open-top aluminium cup with small side slits, NO lid, NO chimney, NO handle; about 7.5cm wide and 3cm high; holds 2 cube coals.
- Kaloud Lotus I+-type: a low metal heat manager with its own matching vented lid and ONE short side handle; about 7.5cm body; with the lid closed it holds 2 cube coals hidden under the lid (only a faint glow at the vents).
Both sit on the rim of a ceramic bowl that has a cup on a slim neck/foot. The bowl's total height is about 1.3–1.5x the HMD width (do not squash the neck). Ash tray about 2.5x HMD width. No real brand names, logos or engraved text.

OWNER'S SELECTION CRITERIA (2026-10-30, these decide adoption):
- Wrong shisha hardware is the No.1 rejection reason: the bowl top (tobacco bowl / "hagal"), the coals, the HMD (heat management device) and how they sit together must be physically correct. When unsure, show less hardware rather than invent parts.
- Plants: none indoors. Do not add potted plants, hanging vines, ivy, herb pots or mysterious foliage. (Outdoor street trees only where the scene truly needs them, small and few.)
- Backgrounds must be the game's real locations from the attached official background images. Do not invent a new shop interior, new windows, counters or shelf walls.

IDENTITY (follow attached image 1 first; this text only reminds): Samechan (Nagisa), 20-year-old Japanese young woman of ordinary adult height, owner of the shark-themed shisha shop SHISHARK: oversized slate-gray shark hoodie with the hood up (shark face with white fabric teeth along the brim, small fin on top), hair mostly hidden, soft half-lidded eyes with blue highlights, small jagged shark-tooth grin, plain dark full-length trousers. A crowned shark hand puppet (Koro-chan) is ALWAYS worn on her RIGHT hand; it is a fabric toy, not alive. She does shisha work with her LEFT hand. Her personal hookah bowl is an unglazed terracotta bowl.

ALWAYS: exactly one hookah in the picture and exactly one hose with one rigid handle. No second hookah, no spare hose or spare mouthpiece lying around. Bowl not yet fitted = the top of the stem is a small convex metal post (never a cup or bowl-shaped stem top). Finished/smoking = HMD on the bowl with coals inside it, never coals directly on foil. Hands holding a bowl or HMD keep them at the same depth as the hand, one-hand size, not pushed toward the camera. Absolutely no text, letters, numbers, logos, brand marks, signatures, watermarks, UI, subtitles, borders or panels baked into the image.
NG shapes: hose forking into a Y / a third hose end / hose loop around the character's legs (see asset_sources/shisha-hardware-reference/ng-examples/README.md); squashed short bowl neck; HMD as big as a head; giant red coal rocks or flames; smoke coming out of the HMD, hose root or water base; stem top shaped like a cup.

--- 1/5: refill1031-t-ext-samechan-01.png ---
Inside SHISHARK: Samechan tests the draw, holding the rigid handle in her LEFT hand at her lips with puffed cheeks, while the shark puppet on her RIGHT hand covers its own eyes as if nervous; the finished hookah on the counter has an ONMO-type HMD with 2 coals.
8行:
人物      : samechan（右手にコロちゃん）
場面      : 完成（試し吸い）
台の型    : カウンターの1台
HMD       : ONMO型（蓋なし）
炭        : 小さな角炭2個（HMD内）
ホース    : 1本（ポート→左手のハンドル）。両端が見える
吸い口    : なし
構図      : 頬をふくらませた顔とパペット

--- 2/5: refill1031-t-ext-samechan-02.png ---
Samechan sits on a high stool at her ocean-blue counter, RIGHT hand with the puppet raised in a little cheer, a small soft exhale from her lips; LEFT hand holds the handle low; the hookah stands beside her with a Kaloud Lotus I+-type HMD, lid closed.
8行:
人物      : samechan（右手にコロちゃん）
場面      : 完成（喫煙中）
台の型    : カウンターの1台
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 1本（ポート→左手のハンドル）。両端が見える
吸い口    : なし
構図      : スツール・パペットを上げる

--- 3/5: refill1031-t-ext-samechan-03.png ---
Choosing a flavor at SHISHARK: Samechan holds a small blank tobacco tin to her nose with her LEFT hand, eyes closed in delight, the puppet on her RIGHT hand leaning in to sniff too; on the counter the hookah body waits with no bowl fitted (the stem top is a small convex metal post), hose coiled on the tray.
8行:
人物      : samechan（右手にコロちゃん）
場面      : 準備中（フレーバー選び・炭なし）
台の型    : ボウル未装着の本体（先端は小さい凸型金属ポスト）
HMD       : なし
炭        : なし
ホース    : 1本（ポート→受け皿に置いたハンドル）
吸い口    : なし
構図      : 缶を嗅ぐ顔とパペット

--- 4/5: refill1031-t-ext-samechan-04.png ---
SHISHARK back counter in the evening: Samechan turns small cube coals on an electric coal heater with tongs in her LEFT hand, coals glowing red ON THE HEATER only; the puppet on her RIGHT hand watches from a safe distance; the finished hookah with an ONMO-type HMD (empty, waiting) stands behind on the counter.
8行:
人物      : samechan（右手にコロちゃん）
場面      : 準備中（炭おこし）
台の型    : 後ろのカウンターの1台
HMD       : ONMO型（まだ空）
炭        : 電気ヒーターの上の角炭（ボウルには載せない）
ホース    : 1本（ポート→受け皿に置いたハンドル）
吸い口    : なし
構図      : トングとヒーター、見守るパペット

--- 5/5: refill1031-t-ext-samechan-05.png ---
Close portrait in SHISHARK booth light: Samechan rests her chin on the puppet on her RIGHT hand and lets a thin stream of smoke drift sideways from her lips, the rigid handle held loosely in her LEFT hand near her shoulder; the top of the hookah (Kaloud Lotus I+-type HMD, lid closed) is visible in the lower corner with its tray and the hose port.
8行:
人物      : samechan（右手にコロちゃん）
場面      : 完成（喫煙中）
台の型    : 画面下の1台（上半分が見える）
HMD       : Lotus I+型（蓋を閉じる・取手1本）
炭        : 小さな角炭2個（蓋の下）
ホース    : 1本（ポート→左手のハンドル）。両端が見える
吸い口    : なし
構図      : パペットに顎をのせた寄り

```

