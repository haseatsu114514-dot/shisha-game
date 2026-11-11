# sk_k15.png 制作記録（画風確認用の1枚目）

## 生成前の構成（docs/shisha_reference.md §4.3）

人物      : hajime。正規立ち絵 `assets/sprites/characters/hajime/chr_hajime_normal.png` を同一人物の正として渡す。
場面      : 完成・喫煙。画面内はハンドルとホースのみで、シーシャ台本体は画面外。
台の型    : 画面外。日本のシーシャバーの業務用の台を想定し、画面には描かない。
HMD       : 画面外。完成・喫煙状態の想定はシリコンボウル＋ロータス型HMDで、画面には描かない。
炭        : HMD内に小さな角炭2〜3個を想定し、画面には描かない。
ホース    : 画面外の台の側面ポートから1本だけ。左端から入り、重力で自然にたわみ、金具を介して手元の硬いハンドルへつながる。分岐・途切れなし。
吸い口    : 硬いハンドル先端の短い使い捨てチップ。首掛けマイチップなし。
構図      : 店内のはじめの上半身を中距離、斜め横顔で描く。顔・口からの煙・手元の動きを画面高さ25〜75%に収める。台は画面外。背景は現代の日本の店内を控えめなトーンで示す。

## 参照

- 本人（顔・髪・服の正）: `assets/sprites/characters/hajime/chr_hajime_normal.png`
- 現在の絵の欄の位置と見え方のみ: `asset_sources/ui/growth-board-skill-manga-20261112/reference/panel_pc.png`, `asset_sources/ui/growth-board-skill-manga-20261112/reference/panel_phone.png`
- 機材の見た目（硬いハンドルの形と接続部のみ）: `asset_sources/shisha-hardware-reference/skin-candidates-issue374/handle-01-yoshio.png`
- `siryou/shisha-hardware-reference/web-refs/images/` はこの環境に存在しない。日本の店の実写は添付できず、§4.2 の文、正規立ち絵、上記の既存機材絵を使用する。機材絵の色・背景・大きさは写さない。

## 生成と検品

生成前の307,200Bコピー検証: 作業フォルダと worktree の SHA-256 が `e93b25304442679d905f94cf80c5ccd647c7ca48450f7ba61e0e26bdf5ecf9dc` で一致。

生成後に記入する。

## 使用した英文プロンプト（採用候補・3回目の全文）

```text
FINAL GENERATION ATTEMPT 3. Composition and printing are critical. EXACTLY ONE visible CHARACTER (Hajime) and exactly ONE visible piece of equipment: a rigid shisha hose handle attached to ONE unbroken hose disappearing off the LEFT EDGE. The whole hookah, HMD, bowl, tray, coals, stem and glass base remain outside the image. No plants. No cap logo/lettering. Frame Hajime a little smaller than a usual manga closeup: his complete face, mouth, gripping hand, full rigid handle, and the start of the hose fit entirely between 25% and 75% of image height. Top and bottom quarters contain only nonessential background, smoke, broad focus lines or coarse black hatching. His cap may extend into top quarter but eyes, brows, nose, mouth, chin, hand and grip all remain central. One long smooth plume of smoke emerges only from his smiling mouth toward right. Draw a clear confident slightly cocky grin with narrow eyes. Use only white ink-paper, solid black, BOLD sparse hatching, and occasional LARGE coarse screentone spots. Avoid tiny dense dot patterns or moiré. A simple believable modern Japanese shop backdrop; no arbitrary décor.

Use case: illustration-story
Asset type: the first single-panel skill illustration for the growth board in the visual novel "水煙前線". Make ONLY sk_k15.png.

REFERENCE IMAGES, WITH DISTINCT ROLES:
Image 1, official Hajime sprite (identity authority): /home/hatch/workspace/shisha-game/work/codex-a-3425-skill-manga-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png . Match his exact youthful face, eye shape, black side-swept hair under his black baseball cap, black zip hoodie, dark shirt and necklace; translate these to monochrome ink.
Image 2, panel_pc.png (placement reference only): /home/hatch/workspace/shisha-game/work/codex-a-3425-skill-manga-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/reference/panel_pc.png . The pink outline marks the UI image slot; never draw the UI, outline, pink, text, or numbers.
Image 3, panel_phone.png (cropping reference only): /home/hatch/workspace/shisha-game/work/codex-a-3425-skill-manga-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/reference/panel_phone.png . Only the center vertical band survives the phone crop; never draw the UI.
Image 4, existing handle artwork (equipment-shape reference only): /home/hatch/workspace/shisha-game/work/codex-a-3425-skill-manga-1112/wt/asset_sources/shisha-hardware-reference/skin-candidates-issue374/handle-01-yoshio.png . Reference the long rigid handle and hose adapter shape only. Do not copy its color, glow, background, scale or floating presentation. This is not a photograph. The siryou Japanese-bar reference photos are unavailable in this environment.

STYLE: one single panel of a black-and-white Japanese manga (weekly shonen/seinen magazine style). Black ink on white paper only: confident inked line art with tapered strokes, solid black fills, and grey shown only as screentone (dot or line tone) or hatching. Absolutely no color, no sepia, no smooth grey gradients or airbrush, no 3D rendering, no photo texture. Manga devices are welcome but used with restraint: speed lines, focus lines, small sparkle or flash marks, impact lines. Use bold lines, generous solid blacks and coarse tones (large dots or bold hatching) so the panel still reads when shrunk to 434x150 px; avoid very fine dot screens that turn into moiré.
CHARACTERS: draw every named character exactly as the attached official game sprite: the same face, eye shape, hair shape, outfit and accessories, translated into black-and-white ink (colors become black, white or one tone). Keep the game's proportions (about 7 heads tall; the petite Ageha about 5.8). Do not invent new outfits or new characters' faces. Unnamed people are simple silhouettes or back views.
FORMAT: 1536x576 px landscape. The whole canvas is the panel: art runs to every edge, with no panel border, no white gutter and no page around it. Keep every face and the key action inside the middle band between 25% and 75% of the height (the phone screen shows only that band); the top and bottom quarters hold only background, smoke or tone.
NEVER: any text — no speech bubbles, no sound-effect lettering or onomatopoeia, no captions, no readable letters on signs, labels, packages or pages, no numbers, no logos, no watermark. Clock faces have no numerals.

1 / sk_k15.png — Hajime (attach his sprite) in three-quarter profile exhales one long, smooth plume of smoke with a confident, slightly cocky grin and narrowed eyes; radiating focus lines and a small sparkle burst behind him; his hand holds a hookah hose handle near his chin, and the hose runs out of the frame to the left. The shop interior is suggested only with tone.

Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.

Only the rigid handle and the hose are in frame; the hookah itself is out of frame. The hose leaves the frame as one unbroken tube. This scene-specific frame instruction controls the visible equipment. Make all visible marks black, white, or coarse printed grey tone only, even though the general hardware reference allows color.

OVERRIDE FOR THIS PANEL'S VISIBLE CONTENT: The scene line is definitive: only rigid handle and hose in frame, no other hookah parts. Keep the handle and gripping hand fully in the central horizontal band. The generic §4.2 hardware paragraph explains how the unseen setup connects; do not draw the unseen setup.
```

## 生成回数と選定

- 1回目: 台本体とHMD、指定外の植物が写り、顔が中央帯から上へはみ出したため没。
- 2回目: 台本体は消えたが、細かな網点が多く、手元が中央帯の下に寄ったため没。
- 3回目: 台本体・HMDなし、植物なし、1本のホースと硬いハンドルを確認。3回の中で最良のため採用候補とした。
- 生成ツールの出力2048×768を、指定の原画寸法1536×576へ縮尺調整し、グレースケールPNGで保存した。ゲーム用WebPへの変換・組み込みは行っていない。

## 原寸・縮小時の検品（docs/shisha_reference.md §4.4 を含む）

- [x] はじめの黒髪・キャップ・目・黒いフード付き衣装・ペンダントを正規立ち絵と照合。同一人物と判断。
- [x] 台本体・ボウル・HMD・炭・受け皿は画面外。HMDの型やボウルトップの混成・縮尺不整合は画面にない。§4.4 の台の積み順・付け根・HMDモデル・炭・台全体の縮尺は対象外。
- [x] ホースは左端から1本で、金具を介して硬いハンドルに接続。分岐・途切れ・人物を囲む輪なし。台側のポート・パージ弁は画面外で検証対象外。
- [x] 煙ははじめの口元から出る。HMD・ホース根元からの煙なし。
- [x] 首掛けマイチップは描かれていない。ハンドル先端の吸い口は硬い筒として読める。
- [x] 白黒の漫画の1コマ。色・セピア・文字・吹き出し・擬音・数字・ロゴ・透かしなし。絵は全端まで続き、枠線と白い余白なし。
- [x] 434×150相当と中央帯の434×84相当で顔・煙・ハンドルは読める。
- [ ] 指先の一部が高さ25〜75%の中央帯から下へはみ出す。中央帯の縮小表示では握る手の下側が切れる。
- [ ] 背景の網点に細かな部分が残る。434px表示で局所的なモアレの可能性がある。
- [ ] 現代の日本のシーシャ店らしいソファ・窓・棚の表現だが、ゲーム内の特定の背景と同一の場面までは確認できない。

3回の上限に達したため、残項目を隠さずオーナーの画風確認に回す。

画素寸法: **1536×576**。SHA-256: **`2e5e09de4efd2112cfad961202476599b90b1fb75aee85069a6ee4c8a6014186`**。

## 2026-11-12 追加16枚（画風採用後）

- 参照画像の役割: `sk_k15.png`＝採用済み画風の正本、`assets/sprites/characters/<id>/chr_<id>_normal.png`＝人物同一性の正本、PR #3409 の `panel_pc.png` と `panel_phone.png`＝表示位置と切り出しの参考のみ。機材写真＝非公開 `siryou/shisha-hardware-reference/web-refs/images/` の構造・形・実寸比のみ。写真の色・背景・接写での大きさは写さない。参照した写真は `coal-cubes-01.jpg`、`coal-inHmd-glow-01.jpg`、`hmd-lotus-open-01.jpg`、`bowl-silicone-side-01.jpg`、`hand-holding-packedBowl-01.jpg`、`hose-silicone-handle-01.jpg`。これら実写はゲームリポジトリに複製していない。
- 多人数用の参照シート `ref_ageha_kumicho.png` は正規の `ageha` と `kumicho` を左右に配置、`ref_sumi_adam.png` は `sumi` と `adam` を左右に配置した制作時の一時入力。元の正規立ち絵から再作成できる。写真・一時シートは納品物に含めない。
- 生成前コピー検証: 394KB `chr_hajime_normal.png` を作業フォルダへ複製し、元と先の SHA-256 が `6affe667e9cc665b53713c6a2319c1c91792e2e335e8408d9c941c364295e409` で一致。
- ツール出力は2048×768。採用画像を Pillow LANCZOS で1536×576へ縮小し、`L` グレースケールPNGとして保存した。ゲーム用WebPは別PRで作成する。
- 各英文は Codex imagegen に渡した実際の `prompt` 文字列。`Input images` は実際の添付順。画像出力IDは制作時のローカル識別子で、採用済み原画は下記SHA-256が正本。
- `sk_k19` には画像を6枚指定してツールが生成開始前に拒否した呼び出しが1回ある。画像5枚にした後の生成を試行1として数える。
- 中央帯と434×150、434×84の縮小表示を全17枚で確認した。主要な顔・場面は読める。`sk_k14` の台上部、`sk_k09` の握る手、`sk_notebook` の書く手は中央帯の境界近くに残る。`sk_k04` は3回上限で細かい背景トーンが残る。採用済み1枚目の指先と背景トーンの不一致も前節のとおり。大きな文字・吹き出し・擬音・ロゴ・色は目視で見当たらない。印刷向けの細い点が一部残るが、434px縮小では目立つモアレを確認していない。

### `sk_k04.png`

- 試行: 3回。採用: 試行3。Adam and Hajime; third attempt chosen. Hair, apple and greeting read in phone crop.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `3c4fd7069b46da7610ecdcb74de9c31a05d62ef5d7f5f0b0b6a2d6bb28d54bbf`。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/adam/chr_adam_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/panel_pc.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/panel_phone.png`

```text
Create exactly ONE finished game asset: sk_k04.png, a 1536x576 horizontal borderless black-and-white Japanese manga panel. REFERENCE IMAGE ROLES: image 1 is the APPROVED STYLE AUTHORITY sk_k15.png: lock its confident tapered ink line weight, generous solid blacks, broad hatching, restrained sparse/coarse screentone, character rendering, and modern Japanese manga finish. Image 2 is the official Hajime identity authority: preserve his cap, side-swept black hair, youthful face, zip hoodie and necklace. Image 3 is the official Adam identity authority: preserve his face, theatrical expression, outfit and split hair; his own left side is green/light tone and own right side red/darker tone, so front view screen-left is dark. Image 4 is panel_pc placement reference ONLY; image 5 is panel_phone crop reference ONLY; never draw either UI. Scene: inside Adam's flamboyant modern shisha shop Eden, Adam grandly poses holding a single apple high; Hajime smiles warmly and waves back without hesitation. Apples and star anise shapes in restrained background. No hookah in frame. Keep complete faces, Adam's apple/hand and Hajime's entire waving hand including every fingertip wholly inside y=25%-75% (144-432px); outer quarters only nonessential scenery or bold lines. Make figures somewhat smaller than typical closeup to achieve this. All art bleeds to every edge, no panel border or gutter. Pure black and white ink; grey only via broad hatching or LARGE coarse printed halftone, no fine dot screens that moiré at 434px. Absolutely no colors, sepia, gradients, photos, 3D, lettering, signs, speech bubbles, sound effects, numerals, logos, or watermark. Style must match image 1 as the same artist.
```

#### 試行2（没）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-15a3b4f0-7441-4d48-b419-a9c80a10de3d.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/adam/chr_adam_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`

```text
Edit target image 1 (the just-generated sk_k04 candidate). Correct the framing: shrink/recompose BOTH characters so every face, every raised hand, EVERY fingertip, and Adam's apple sit strictly in the center horizontal band y=25%-75% of the final canvas. The entire upper 25% and lower 25% contain background, focus lines, furniture or smoke-like decoration ONLY. Adam's apple MUST move down into the central band; his exuberant pose should be a lateral gesture, not an arm overhead. Keep the two characters' exact identities and the same underlying scene. STYLE AUTHORITY image 2 is approved sk_k15: match same ink weight, black mass, hatching, and coarse tone. No fine dots: replace fine background halftone with BROAD hatching or large clearly separate dots suitable for 434px display. Image 3 official Adam and image 4 official Hajime define identity. 1536x576-like wide manga panel, art to all edges, absolutely black and white, no text, no hookah, no border. Preserve all other valid content.
```

#### 試行3（採用）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/adam/chr_adam_normal.png`

```text
FINAL THIRD ATTEMPT. Create sk_k04 as a fresh single manga panel with strict compact composition. Approved style reference image 1: exactly the same artist, ink and black masses. Official identity images 2 Hajime and 3 Adam. Crucial geometry on 2048x768 horizontal canvas: the ONLY visible heads and arms occupy the rectangle x=350..1700, y=220..540. Place Adam on left, Hajime on right. Adam's theatrical gesture uses ONE hand holding an apple near shoulder height, y=260..470; his OTHER arm is folded against his torso with no hand extending outward. Hajime waves one hand near his cheek y=300..480. Every fingertip fully above y=550 and below y=220. Their legs and lower torsos may be cropped by the lower edge, but NO HANDS below y=540. Adam wears his distinctive outfit and split hairstyle (screen-left hair dark, screen-right light), Hajime wears black cap and zip hoodie. Both smile; friendly open conversation in Adam's modern Japanese shop, apple and star-anise motifs, no hookah. Outer top/bottom quarters are ONLY broad hatching and background. Black-and-white manga linework, solid blacks, sparse coarse dots large enough for 434px reduction, not tiny dense halftone. Art fills canvas, no border, no text, logos, speech bubbles, sound effects, numerals, colors, gradients, photo or 3D.
```

### `sk_k07.png`

- 試行: 2回。採用: 試行2。Hajime notices Minto while Naru speaks; revised action and closed mouths.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `962fef0d880f611692d1cf9b77a4bca4e9e2878de7d60dfa4ee3d74eb9038f3d`。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/minto/chr_minto_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/naru/chr_naru_normal.png`

```text
Create ONE 1536x576 borderless landscape black-and-white Japanese manga panel. Image 1 = approved sk_k15 STYLE AUTHORITY: lock exact same artist's tapered ink lines, solid black masses, bold hatching and only sparse LARGE coarse halftone. Remaining official sprites = IDENTITY AUTHORITIES in listed order; preserve each exact face, hair, outfit. Keep EVERY face, mouth, hand, fingertip and key action strictly within central y=25%-75%; upper/lower quarters contain only nonessential background. Compose people smaller, at middle height. Art bleeds to edges. No fine dots/moiré at 434px. No color, sepia, smooth greys, gradients, 3D, photos, readable text, letters, numerals, logos, bubbles, sound effects, watermark or panel border.  Output filename sk_k07.png. Scene: lively cafe chat. Naru talks animatedly; Minto beside him starts to speak but quietly stops with a small smile; Hajime between them alone notices and glances toward her. A tiny abstract smoke curl near Minto's shoulder. No hookah on table. Characters from images 2 Hajime, 3 Minto, 4 Naru.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-8da43a82-1c03-4625-8154-313746bcf911.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/naru/chr_naru_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/minto/chr_minto_normal.png`

```text
Image 1 is EDIT TARGET sk_k07 cafe conversation. Correct CHARACTER ACTIONS: NARU is the light-haired man at CENTER, and he must speak animatedly with open mouth and a compact hand gesture by his chest. MINTO is the dark-haired girl at RIGHT, about to say something but silently holds it back with a small restrained smile, lips gently closed. HAJIME is the black-cap man at LEFT, quietly glancing toward Minto and noticing her hesitation; his mouth CLOSED, hands still, NOT speaking. Add a tiny abstract smoke curl by Minto's shoulder. No hookah. Move figures slightly down and make upper/bottom 25% background only. Image 2 approved sk_k15 is STYLE AUTHORITY; images 3 Hajime, 4 Naru, 5 Minto are OFFICIAL IDENTITY AUTHORITIES. Same black-and-white manga artist, bold ink/hatching, large coarse tone, full-bleed 1536x576, all faces/hands central y25%-75%, no fine dots, text, speech bubbles, numerals, logos or watermark.
```

### `sk_k21.png`

- 試行: 2回。採用: 試行2。Second attempt removes the mistaken hookah body; one handle/hose and smoke ring remain.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `93484118d6f7aca4632b1708c2242135c49a5285d393dbaf816554b326707e47`。
- §4.3 事前構成の復元記録（生成条件に用いた構成）:

```text
人物      : hajime, ageha; official sprites attached.
場面      : 完成・喫煙。画面内は硬いハンドルとホースのみ。
台の型    : 現代の日本の店の業務用台を画面外に想定。
HMD       : シリコンボウル＋ロータス型HMDを画面外に想定。
炭        : HMD内に小さな角炭2〜3個を画面外に想定。
ホース    : 台側は画面外、1本だけ左端から入り硬いハンドルへ接続。
吸い口    : ハンドル先端の使い捨てチップ。
構図      : 店内中距離。はじめとあげは、煙の輪、ハンドルを中央帯へ。
```
- §4.4 検品: 完成時のHMD/炭とホースの見える範囲を原寸で照合。画面外の本体接続部は検証対象外。人物・文字なし・白黒・縮小表示は確認。残る不一致は上記の全体注記に記載。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/ageha/chr_ageha_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/shisha-hardware-reference/skin-candidates-issue374/handle-01-yoshio.png`

```text
Create ONE 1536x576 borderless landscape black-and-white Japanese manga panel. Image 1 = approved sk_k15 STYLE AUTHORITY: lock exact same artist's tapered ink lines, solid black masses, bold hatching and only sparse LARGE coarse halftone. Remaining official sprites = IDENTITY AUTHORITIES in listed order; preserve each exact face, hair, outfit. Keep EVERY face, mouth, hand, fingertip and key action strictly within central y=25%-75%; upper/lower quarters contain only nonessential background. Compose people smaller, at middle height. Art bleeds to edges. No fine dots/moiré at 434px. No color, sepia, smooth greys, gradients, 3D, photos, readable text, letters, numerals, logos, bubbles, sound effects, watermark or panel border.  Output filename sk_k21.png. Scene: Hajime exhales a PERFECT clearly visible smoke ring from his mouth, floating toward delighted petite Ageha, who is wide eyed with clasped hands. Hajime holds exactly one rigid shisha hose handle, with a single unbroken hose leaving frame left. No hookah body, HMD, bowl, coals or tray visible. Characters from images 2 Hajime and 3 Ageha. Image 4 = equipment SHAPE ONLY, rigid handle and hose connection, never its color or backdrop. Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text. SCENE OVERRIDE: ONLY rigid handle and one hose visible; all other hookah parts are outside frame. All marks monochrome.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/ageha/chr_ageha_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/hose-silicone-handle-01.jpg`

```text
EDIT TARGET image 1, the sk_k21 smoke-ring panel. NONNEGOTIABLE CORRECTION: remove the ENTIRE hookah body/rig (stem, tray, bowl, coals and glass base) from the center foreground and remove its table. Replace that region with simple shop background. Keep exactly one rigid handle in Hajime's hand and one continuous hose exiting the LEFT EDGE only. Preserve the clear smoke ring from Hajime's mouth and Ageha's delighted reaction. Shrink and vertically center both figures so both complete faces, all hands and every fingertip fall strictly between 25% and 75% height. Image 2 is approved sk_k15 STYLE AUTHORITY; lock same manga linework, solid blacks and coarse tone. Images 3 and 4 official Hajime and Ageha IDENTITY AUTHORITIES. Image 5 real hose photo EQUIPMENT SHAPE reference only, not color or background. 1536x576 landscape, full bleed, pure monochrome ink, large coarse dots or hatching, no fine screen, no text, numerals, bubbles, logo, watermark or border.
```

### `sk_k16.png`

- 試行: 1回。採用: 試行1。Two pairs of eyes and divider read in phone crop.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `5e0adc5b74e35e08148ba2dd14ee2818a06a2d4477298bc6afbd4f2b60e9d4e5`。

#### 試行1（採用）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/naru/chr_naru_normal.png`

```text
Draw exactly ONE 1536x576 wide borderless black-and-white manga skill panel for a visual novel. Image 1 is the approved sk_k15 STYLE AUTHORITY: lock identical confident ink line weight, solid black fills, tapered contours, broad hatching and sparse LARGE coarse screentone only. Other images are official IDENTITY AUTHORITIES; preserve each exact face, hair and clothing. Draw key faces, eyes, hands and gestures wholly in central y=25%-75%; top and bottom quarters background only. Art to edges. No fine dot fields or moiré at 434px. No color, sepia, gradient, photo, 3D, text, speech bubbles, SFX, numbers, logos, watermark or page border.  Output asset sk_k16.png. Extreme close split face-off: left Hajime's eyes/brows under his black cap, right Naru's eyes/brows. Both calm and intense, looking across one narrow jagged lightning divider from top to bottom. Their EYES are central-band, never high at the top edge. Spotlight hatching behind. Image 2 Hajime, image 3 Naru.
```

### `sk_k10.png`

- 試行: 1回。採用: 試行1。Judges eyes and distinct outfits read in phone crop.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `19eeb1c31be73a3dd5ac0e18b04a60cff982a0d1df1c8d54464f5219b92305f0`。

#### 試行1（採用）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/sui/chr_sui_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/dr_kemuri/chr_dr_kemuri_normal.png`

```text
Draw exactly ONE 1536x576 wide borderless black-and-white manga skill panel for a visual novel. Image 1 is the approved sk_k15 STYLE AUTHORITY: lock identical confident ink line weight, solid black fills, tapered contours, broad hatching and sparse LARGE coarse screentone only. Other images are official IDENTITY AUTHORITIES; preserve each exact face, hair and clothing. Draw key faces, eyes, hands and gestures wholly in central y=25%-75%; top and bottom quarters background only. Art to edges. No fine dot fields or moiré at 434px. No color, sepia, gradient, photo, 3D, text, speech bubbles, SFX, numbers, logos, watermark or page border.  Output asset sk_k10.png. Contestant's view of judges' table. Sui, dark three-piece suit and folded arms, center-left; Dr. Charcoal Hiura Riichi with messy hair, square black glasses and lab coat, center-right. Sharp evaluating eyes and a glint on glasses. Their FACES and folded hands central band. Plain table, no score cards. Image 2 Sui, image 3 Dr. Charcoal.
```

### `sk_k19.png`

- 試行: 2回。採用: 試行2。Five known characters and street; second attempt reduces raised hands.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `044e4ba02ca04d8e4ccaa90ecb1136e777e07918354b7e12e48b5368bf13f2f3`。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/minto/chr_minto_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/adam/chr_adam_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/ref_ageha_kumicho.png`

```text
Produce ONE 1536x576 black-and-white Japanese manga game skill panel. Image 1 is approved sk_k15 STYLE AUTHORITY: same artist, exact ink weight, tapered lines, solid blacks, bold hatching, only sparse LARGE coarse halftone. Other images are official character IDENTITY AUTHORITIES, preserve the exact faces/hair/clothes. Keep all FACES, HANDS and key action inside y=25%-75% including every fingertip; top/bottom quarters background only. Full bleed without border. No fine dots or moiré at 434px. No color, sepia, smooth grey gradient, 3D, photo, lettering, speech bubbles, SFX, numerals, logos, watermark.  Asset sk_k19.png. Hajime walks through a lively Japanese shopping street. Minto waves from doorway, Adam raises an apple, petite Ageha jumps and waves, Kumicho Ryuji gives a cool nod. Hajime laughs and waves back. ALL FIVE characters visibly distinct, smaller figures so faces and hands center-band. Image 2 Hajime; image 3 Minto; image 4 Adam; image 5 combined reference sheet with Ageha LEFT and Kumicho RIGHT, identity only. Blank unreadable shop signs.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-2b6d0226-f9c5-463e-aa26-7099a5f4b5cf.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/kumicho/chr_kumicho_normal.png`

```text
Image 1 EDIT TARGET sk_k19. Keep exact FIVE people and shopping street. Make all waves COMPACT at shoulder height, and reduce Ageha's jump so her raised hand and Hajime's raised hand remain wholly below y=576 and above y=192 on 2048x768. Move all faces within same band; top and bottom quarters only architecture. Maintain Minto at left doorway, Adam with apple, petite Ageha, Hajime center, Kumicho in pale check suit and sunglasses right. Image 4 official Kumicho identity. Image 2 approved sk_k15 is STYLE AUTHORITY: same manga artist, black ink line, solid blacks, hatching and sparse large coarse tone; image 3 official Hajime is IDENTITY AUTHORITY. Wide 1536x576 full-bleed no border. Absolutely no text, logos, numbers, bubbles, SFX, color, gradient or fine moiré dots.
```

### `sk_k08.png`

- 試行: 2回。採用: 試行2。Second attempt centers rolled sleeve and hand.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `6f575c14c1b35ddb2dd6b315be34281e0f7e9b420161fa3b76680ce21dbf3ecf`。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`

```text
Produce ONE 1536x576 black-and-white Japanese manga game skill panel. Image 1 is approved sk_k15 STYLE AUTHORITY: same artist, exact ink weight, tapered lines, solid blacks, bold hatching, only sparse LARGE coarse halftone. Other images are official character IDENTITY AUTHORITIES, preserve the exact faces/hair/clothes. Keep all FACES, HANDS and key action inside y=25%-75% including every fingertip; top/bottom quarters background only. Full bleed without border. No fine dots or moiré at 434px. No color, sepia, smooth grey gradient, 3D, photo, lettering, speech bubbles, SFX, numerals, logos, watermark.  Asset sk_k08.png. Late night in closed shisha shop tonari. Hajime rolls up sleeves, sweat on brow, towel over shoulder, still smiles and ready for one more practice run. Wall clock without numerals; water bottle on counter. No hookah. Image 2 Hajime identity.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-3edd58e8-55a4-45ef-816b-3f48b9eb5110.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`

```text
Image 1 EDIT TARGET. Recompose Hajime smaller and more centrally. His entire face, sleeve-rolling hands and ALL fingertips must lie strictly between y=192 and y=576 on a 2048x768 canvas. His extended left arm currently leaves the bottom central band; bend both elbows close to his torso and roll his RIGHT sleeve at chest height. Keep sweat, towel, late-night closed shop, clock with no numerals and water bottle. No hookah or extra characters. Image 2 approved sk_k15 STYLE AUTHORITY: same black-white manga artist, ink weight and solid blacks, broad hatching, sparse LARGE coarse tone. Image 3 official Hajime IDENTITY AUTHORITY. 1536x576 full-bleed panel, no fine dots, color, lettering, numerals, logo, bubbles, border or watermark.
```

### `sk_k12.png`

- 試行: 2回。採用: 試行2。Second attempt centers both seated characters and hands.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `af3af5de5e315d487891e86189e4d7c5045b9a651f734907135e1b378d71bca2`。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/sheikh/chr_sheikh_normal.png`

```text
Produce ONE 1536x576 black-and-white Japanese manga game skill panel. Image 1 is approved sk_k15 STYLE AUTHORITY: same artist, exact ink weight, tapered lines, solid blacks, bold hatching, only sparse LARGE coarse halftone. Other images are official character IDENTITY AUTHORITIES, preserve the exact faces/hair/clothes. Keep all FACES, HANDS and key action inside y=25%-75% including every fingertip; top/bottom quarters background only. Full bleed without border. No fine dots or moiré at 434px. No color, sepia, smooth grey gradient, 3D, photo, lettering, speech bubbles, SFX, numerals, logos, watermark.  Asset sk_k12.png. World tournament final under one spotlight. Hajime sits upright, eyes closed for one deep calm breath, hands resting still on knees; across stage reigning champion Sheikh watches composed, white kandura and gold-trimmed ghutra rendered MONOCHROME. Vast crowd as dark silhouettes. No hookah. Image 2 Hajime identity; image 3 Sheikh identity.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-dd6f79f7-abca-4cad-af56-a682a4083bc4.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/sheikh/chr_sheikh_normal.png`

```text
Image 1 EDIT TARGET. Recompose final stage scene with Hajime and Sheikh seated but BOTH pairs of hands at chest or high lap level, fully within y=192..576 on 2048x768; no fingertip below. Their faces also wholly central band. Hajime eyes closed taking a deep calm breath, Sheikh watches composed. Spotlight and dark crowd, no hookah. Do not draw an exhaled smoke plume here. Image 2 approved sk_k15 STYLE AUTHORITY: same black-white manga artist, ink weight and solid blacks, broad hatching, sparse LARGE coarse tone. Image 3 official Hajime IDENTITY AUTHORITY. Image 4 official Sheikh IDENTITY AUTHORITY. 1536x576 full-bleed panel, no fine dots, color, lettering, numerals, logo, bubbles, border or watermark.
```

### `sk_k13.png`

- 試行: 2回。採用: 試行2。Second attempt lowers cheering gestures and leaves stadium architecture above.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `5b82da015ad6bebd9a41bcb290fc48c7b5d79ce0e3938fd79192cfa07a2a53a5`。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/minto/chr_minto_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/naru/chr_naru_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/ref_sumi_adam.png`

```text
One 1536x576 horizontal borderless black-and-white Japanese manga panel for the game growth board. Image 1 = APPROVED STYLE AUTHORITY sk_k15: exactly same illustrator, tapered black ink contours, substantial blacks, bold hatching and only sparse coarse LARGE dots. Other images = OFFICIAL CHARACTER IDENTITY AUTHORITIES; preserve each exact face, hair, clothing. EVERY face, hand, fingertip and key action strictly within central 25%-75% height. Top/bottom quarters background only, art fills edges. Avoid fine halftone/moiré at 434px. No color, sepia, gradients, photos, 3D, letters, numbers, speech bubbles, sound effects, logos, watermark or border.  Asset sk_k13.png. Tournament stage view from behind Hajime, his back/cap brim foreground; in the stands his friends Sumi calm thumbs up, Minto arms raised, Naru fist up, Adam cheering. Make four FRIENDS the visual focus and wholly central-band, distinct silhouettes and recognizable faces. Image 2 Hajime; image 3 Minto; image 4 Naru; image 5 official combined sprite sheet with Sumi LEFT and Adam RIGHT. No banners with marks.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-e9e0a6d0-ca4f-4f50-a2e1-c33e245d16ac.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/sumi/chr_sumi_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/minto/chr_minto_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/naru/chr_naru_normal.png`

```text
Image 1 EDIT TARGET sk_k13 tournament cheering panel. Recompose five figures SMALLER and LOWER, leaving a very large top quarter showing only stadium architecture. Every face, fist, hand and fingertip of Sumi, Minto, Naru, Adam must be within y=25%-75% (on 2048x768 canvas, y=192 through 576). NO arm may reach into the top quarter. Minto raises her arms just to shoulder height; Naru and Adam hold their fists at CHEST height; Sumi gives thumbs-up at shoulder height. Preserve identities and scene, Hajime back in foreground. Image 2 is approved sk_k15 STYLE AUTHORITY; image 3 official Sumi identity, image 4 Minto, image 5 Naru. Adam identity comes from edit target; preserve his distinctive split hair. Same black-white manga artist, sparse coarse tones, full-bleed 1536x576, no text, numbers, banners, logos, bubbles or watermark.
```

### `sk_k11.png`

- 試行: 1回。採用: 試行1。Single charcoal cube held by tongs; no hookah body.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `9a548c78237a07bed33cd457808413a67cf2603ef674fa912bc29965cf7e8a7a`。
- §4.3 事前構成の復元記録（生成条件に用いた構成）:

```text
人物      : hajime; official sprite attached.
場面      : 炭を置く準備中。トングで1個の小角炭を持ち上げる。
台の型    : 台本体は画面外。現代の日本の業務用台を想定。
HMD       : 画面外。完成状態のHMDは描かない。
炭        : 指先大の角炭1個をトングで保持。炎なし。
ホース    : 画面外。描かない。
吸い口    : 画面外。描かない。
構図      : 手元の寄り。炭、トング、はじめの目が中央帯にある。
```
- §4.4 検品: 完成時のHMD/炭とホースの見える範囲を原寸で照合。画面外の本体接続部は検証対象外。人物・文字なし・白黒・縮小表示は確認。残る不一致は上記の全体注記に記載。

#### 試行1（採用）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/coal-cubes-01.jpg`

```text
One 1536x576 horizontal black-and-white Japanese manga panel, full bleed, no frame. Image 1 approved sk_k15 is the EXACT STYLE AUTHORITY: same artist's tapered line weight, large black masses, bold hatching and sparse LARGE coarse halftone only. Image 2 is official Hajime IDENTITY AUTHORITY: same cap, black hair, face, zip hoodie. Remaining photos are EQUIPMENT STRUCTURE/SHAPE references only, never copy their color, background or close-up scale. ALL faces, eyes, hands, fingers and focal action strictly inside central 25%-75% height; top/bottom quarters background only. No fine screen/moiré at 434px. No colors, sepia, gradients, letters, numbers, logo, SFX, bubbles, watermark or border.  Asset sk_k11.png. Close view: Hajime's hand holds metal TONGS lifting exactly ONE small fingertip-sized cube charcoal, gray ash depicted as coarse black-and-white hatching, white cracks, NO flame. His focused EYE under cap brim behind at right. Coal heater, hookah, bowl, HMD entirely OUT OF FRAME. Image 3 photo = charcoal cube SHAPE and scale only. Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text. FINAL SCENE OVERRIDE: ONLY one cube coal and tongs are visible equipment. No hookah or bowl, no HMD, no hose.
```

### `sk_k14.png`

- 試行: 2回。採用: 試行2。Second attempt removes unwanted hose handle and mouth smoke; small top assembly remains.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `4092e65d6e9c7a284b5c2df5e2d598efd1a7808481605f0148a03a6da1970f31`。
- §4.3 事前構成の復元記録（生成条件に用いた構成）:

```text
人物      : hajime; official sprite attached.
場面      : 完成・喫煙状態の音を聞く。吸う・吐く場面ではない。
台の型    : 現代の日本の業務用台。上部だけ画面内。
HMD       : ロータス型1モデルをシリコンボウル上に置く。
炭        : 小さな角炭2〜3個がHMD内。炎なし。
ホース    : 画面外。描かない。
吸い口    : 画面外。描かない。
構図      : 同じ奥行きのはじめの横顔とHMD・ボウル・受け皿・上部ステム。
```
- §4.4 検品: 完成時のHMD/炭とホースの見える範囲を原寸で照合。画面外の本体接続部は検証対象外。人物・文字なし・白黒・縮小表示は確認。残る不一致は上記の全体注記に記載。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/coal-inHmd-glow-01.jpg`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/hmd-lotus-open-01.jpg`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/bowl-silicone-side-01.jpg`

```text
One 1536x576 horizontal black-and-white Japanese manga panel, full bleed, no frame. Image 1 approved sk_k15 is the EXACT STYLE AUTHORITY: same artist's tapered line weight, large black masses, bold hatching and sparse LARGE coarse halftone only. Image 2 is official Hajime IDENTITY AUTHORITY: same cap, black hair, face, zip hoodie. Remaining photos are EQUIPMENT STRUCTURE/SHAPE references only, never copy their color, background or close-up scale. ALL faces, eyes, hands, fingers and focal action strictly inside central 25%-75% height; top/bottom quarters background only. No fine screen/moiré at 434px. No colors, sepia, gradients, letters, numbers, logo, SFX, bubbles, watermark or border.  Asset sk_k14.png. Hajime profile with eyes shut, head tilted slightly, listening. Left side at same depth as Hajime: modest hookah TOP ONLY: lotus type HMD slightly open with two or three fingertip-sized coals INSIDE it, on a small silicone bowl with slim neck, horizontal ash tray approximately 2.5 times HMD diameter, upper vertical stem. Delicate hand-drawn sound waves toward his ear, no letters. Bowl+HMD+coals about HALF the height of Hajime's face. Image 3 photo = coals within HMD structure; image 4 = lotus HMD shape only; image 5 = silicone bowl shape only. Closeup photos are SHAPE ONLY, never copy their large scale. Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text. FINAL SCENE OVERRIDE: Only top assembly and upper stem visible; glass base and hose outside frame. Every part black-and-white ink.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-2b5fa7cc-3511-400f-bb4f-306366b0b57a.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/hmd-lotus-open-01.jpg`

```text
Image 1 is EDIT TARGET sk_k14 candidate. Revise this exact scene: Hajime is ONLY listening to the sound of charcoal with EYES CLOSED. Remove the rigid hose handle, hose and ALL smoke from Hajime's mouth. Keep the small top assembly at LEFT but correct its structure and scale: two or three fingertip cube coals INSIDE a low lotus HMD, separate low cup on small silicone bowl with slim neck, above a broad tray and upper vertical stem. HMD+bowl+coals at most HALF Hajime's face height. Image 2 approved sk_k15 is STYLE AUTHORITY, lock its black-and-white manga artist, ink contours, strong blacks and coarse hatching. Image 3 official Hajime is IDENTITY AUTHORITY. Image 4 HMD photo = SHAPE/STRUCTURE only, not photo scale/color. Keep face and equipment action central 25%-75% height. Only nonessential background in outer quarters. One wide 1536x576 full-bleed panel; no fine halftone, no color, letters, logos, bubbles, SFX, watermark or border.
```

### `sk_k09.png`

- 試行: 2回。採用: 試行1。First attempt chosen: second attempt put the handle by the ear rather than mouth.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `b9f3fd9e239719f551831eb2be72ed4b032cd1805f87eb813b7bf04a09c4ce10`。
- §4.3 事前構成の復元記録（生成条件に用いた構成）:

```text
人物      : hajime; official sprite attached.
場面      : 完成・喫煙。味を確かめる。
台の型    : 日本の店の業務用台を画面外に想定。
HMD       : シリコンボウル＋ロータス型を画面外に想定。
炭        : HMD内に小さな角炭2〜3個を画面外に想定。
ホース    : 1本だけ左端から入り硬いハンドルへ接続。台側は画面外。
吸い口    : ハンドル先端の使い捨てチップ。
構図      : はじめの顔・ハンドル・味のモチーフが中央帯。台本体なし。
```
- §4.4 検品: 完成時のHMD/炭とホースの見える範囲を原寸で照合。画面外の本体接続部は検証対象外。人物・文字なし・白黒・縮小表示は確認。残る不一致は上記の全体注記に記載。

#### 試行1（採用）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/hose-silicone-handle-01.jpg`

```text
Draw one wide 1536x576 manga skill illustration, no frame, art to all edges. Image 1 sk_k15 is the APPROVED STYLE AUTHORITY; lock same artist, tapered line art, black fills, broad hatching and sparse LARGE coarse printed dots. Image 2 official Hajime sprite is IDENTITY AUTHORITY; retain exact cap, hair, face and hoodie. Other photos are EQUIPMENT SHAPE/STRUCTURE ONLY, not color or scale. Strictly keep EVERY face, hand, fingertip and focal action in central y=25%-75%; top/bottom quarters only background. Readable when reduced to 434px, no fine dots/moiré. Monochrome ink only, no text, letters, numerals, logos, bubbles, sound effects, gradients, color, photo, 3D, watermark.  Asset sk_k09.png. Hajime closes eyes and tastes a puff with a subtle knowing smile. Floating FLAVOR MOTIFS around him in light coarse tone: recognizable lemon slice, mint leaves, grape cluster, apple, cardamom pod. One rigid hose handle near his mouth, ONE unbroken hose exits left. Smoke leaves his lips only. Image 3 is real handle/hose SHAPE reference only. Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text. FINAL OVERRIDE: hookah body, HMD, bowl, coals, tray all OUT OF FRAME; ONLY ONE handle and hose visible. Keep handle and gripping fingers CENTRAL.
```

#### 試行2（没）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-b17f5177-b622-413c-a3f1-8b4c1b6f1ff9.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/hose-silicone-handle-01.jpg`

```text
Image 1 EDIT TARGET sk_k09. Move Hajime's entire handle-gripping hand, thumb and EVERY fingertip UP and make it smaller so all of it lies within y=192..576 on 2048x768 canvas. The rigid handle and hose also remain in that central band. Keep eyes closed subtle knowing smile, mouth smoke and distinct lemon, mint, grapes, apple, cardamom motifs. Exactly one hose exits left, no hookah body. Image 4 photo = handle shape ONLY, not color or composition. Image 2 approved sk_k15 is STYLE AUTHORITY: same manga artist, black ink line, solid blacks, hatching and sparse large coarse tone; image 3 official Hajime is IDENTITY AUTHORITY. Wide 1536x576 full-bleed no border. Absolutely no text, logos, numbers, bubbles, SFX, color, gradient or fine moiré dots.
```

### `sk_morning.png`

- 試行: 1回。採用: 試行1。Morning room, curtain gesture and sky read in phone crop.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `29b396b157e3197b9571f5d7a94b62a1e7820e1799da906244c3620928364b46`。

#### 試行1（採用）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`

```text
One 1536x576 horizontal borderless black-and-white Japanese manga panel for the game growth board. Image 1 = APPROVED STYLE AUTHORITY sk_k15: exactly same illustrator, tapered black ink contours, substantial blacks, bold hatching and only sparse coarse LARGE dots. Other images = OFFICIAL CHARACTER IDENTITY AUTHORITIES; preserve each exact face, hair, clothing. EVERY face, hand, fingertip and key action strictly within central 25%-75% height. Top/bottom quarters background only, art fills edges. Avoid fine halftone/moiré at 434px. No color, sepia, gradients, photos, 3D, letters, numbers, speech bubbles, sound effects, logos, watermark or border.  Asset sk_morning.png. Hajime in his small bedroom at early morning, pulls open curtains and stretches with a big yawn, wide cloudy sky outside, one sunbreak. BOTH HANDS and face strictly central-band, even fingertips, body smaller. Image 2 official Hajime identity.
```

### `sk_prep.png`

- 試行: 2回。採用: 試行2。Second attempt changes to hands-only workbench; no unwanted mouth smoke.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `3b2c755f583c4f8ac480c912a1ceccc3d544dc8c662203cd1597431fa75fff4b`。
- §4.3 事前構成の復元記録（生成条件に用いた構成）:

```text
人物      : hajimeの手; official sprite attached.
場面      : 詰める段階。ボウルに葉を詰める。
台の型    : 台本体なし。現代の日本の業務用台に後で取り付けるボウル。
HMD       : まだ置かない。画面内にもなし。
炭        : まだ扱わない。画面内にもなし。
ホース    : 画面外。描かない。
吸い口    : 画面外。描かない。
構図      : 上から作業台の手元。手・小さなボウル・整列した道具を中央帯へ。
```
- §4.4 検品: 完成時のHMD/炭とホースの見える範囲を原寸で照合。画面外の本体接続部は検証対象外。人物・文字なし・白黒・縮小表示は確認。残る不一致は上記の全体注記に記載。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/bowl-silicone-side-01.jpg`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/hand-holding-packedBowl-01.jpg`

```text
Draw one wide 1536x576 manga skill illustration, no frame, art to all edges. Image 1 sk_k15 is the APPROVED STYLE AUTHORITY; lock same artist, tapered line art, black fills, broad hatching and sparse LARGE coarse printed dots. Image 2 official Hajime sprite is IDENTITY AUTHORITY; retain exact cap, hair, face and hoodie. Other photos are EQUIPMENT SHAPE/STRUCTURE ONLY, not color or scale. Strictly keep EVERY face, hand, fingertip and focal action in central y=25%-75%; top/bottom quarters only background. Readable when reduced to 434px, no fine dots/moiré. Monochrome ink only, no text, letters, numerals, logos, bubbles, sound effects, gradients, color, photo, 3D, watermark.  Asset sk_prep.png. Workbench close-up. Hajime's hands gently press moist shisha leaf into a SMALL silicone bowl with slim neck using a small packing tool. Neatly aligned foil roll, hole poker, tongs and one small clear tobacco tub. No HMD, no coals. Image 3 real silicone bowl shape only; image 4 hand-held packed bowl for HAND-TO-BOWL SCALE only; do not copy large photographic scale. Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text. FINAL OVERRIDE: This is PACKING STAGE, only bowl and tools; NO hookah stand, HMD or coals. Bowl mouth no wider than adult palm, stem visible. Fingers and bowl strictly central-band.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-40392083-7e97-4875-a698-6d2867fcd819.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/siryou-refs/hand-holding-packedBowl-01.jpg`

```text
Image 1 is EDIT TARGET sk_prep. Change the composition to a TOP-DOWN close view of the WORKBENCH and HAJIME'S HANDS ONLY. Remove Hajime's face, entire head, body, and all smoke. This packing stage contains a SMALL silicone bowl with slim neck full of moist tobacco, one hand stabilizing it, other hand gently packing with a tool. Align foil roll, hole poker, tongs and one clear tobacco tub. Place ALL hand/fingers, bowl and tools between y=25%-75% height, with margin so no fingertip crosses the band. Top/bottom quarters = dark simple counter hatching only. Image 2 sk_k15 is approved STYLE AUTHORITY, same black ink manga artist. Image 3 official Hajime sprite = identity of hands/clothing only. Image 4 real hand-held bowl photo = bowl shape and hand-to-bowl SCALE only, never photo coloring/close-up scale. NO HMD, coals, flame, hookah stand, handle, hose or smoke. ONE 1536x576 full-bleed monochrome manga panel, coarse halftone/hatching, no fine dots, no text, numerals, logo, bubbles or watermark.
```

### `sk_notebook.png`

- 試行: 2回。採用: 試行2。Second attempt raises notebook and pencil toward central band.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `613e0c59360377f55381624c7f8fd1f9f3c03b5de51d9d7ec3598c29b3dd86be`。

#### 試行1（没）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`

```text
One 1536x576 horizontal borderless black-and-white Japanese manga panel for the game growth board. Image 1 = APPROVED STYLE AUTHORITY sk_k15: exactly same illustrator, tapered black ink contours, substantial blacks, bold hatching and only sparse coarse LARGE dots. Other images = OFFICIAL CHARACTER IDENTITY AUTHORITIES; preserve each exact face, hair, clothing. EVERY face, hand, fingertip and key action strictly within central 25%-75% height. Top/bottom quarters background only, art fills edges. Avoid fine halftone/moiré at 434px. No color, sepia, gradients, photos, 3D, letters, numbers, speech bubbles, sound effects, logos, watermark or border.  Asset sk_notebook.png. Hajime at a desk at night writing a thick recipe notebook, while holding up and carefully inspecting one plain flavor package. Notebook pages show abstract marks and leaf/fruit doodles ONLY, absolutely no readable writing. Other blank packages and clear small tobacco tubs. His face, BOTH hands, pencil and package strictly central-band. Image 2 official Hajime identity.
```

#### 試行2（採用）— 英文プロンプト全文

添付順: `/home/hatch/.codex-a/generated_images/01a1ccd4-8ebc-7781-90f9-b57dfde9cd02/exec-e745e478-da60-48c0-adbf-78417c419af8.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`

```text
Image 1 EDIT TARGET. Recompose the entire recipe NOTEBOOK and both WRITING and package-inspecting hands UP into the central band y=192..576 on 2048x768. The writing pencil tip and page where he writes must be visible at phone crop, not below it. Place notebook on a raised slanted desk at chest height, or tilt camera down. Keep his face and package central too. Only abstract marks/fruit/leaf doodles on pages, no readable writing. No hookah. Image 2 approved sk_k15 STYLE AUTHORITY: same black-white manga artist, ink weight and solid blacks, broad hatching, sparse LARGE coarse tone. Image 3 official Hajime IDENTITY AUTHORITY. 1536x576 full-bleed panel, no fine dots, color, lettering, numerals, logo, bubbles, border or watermark.
```

### `sk_steam_calm.png`

- 試行: 1回。採用: 試行1。Quiet breathing and dissolving abstract noise; no equipment.
- 寸法: 1536×576、グレースケールPNG。SHA-256: `0caa88bbfe40183a6096cd60e80f01fe80d25d0ee24a6311ae792183c7edcfe9`。

#### 試行1（採用）— 英文プロンプト全文

添付順: `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/asset_sources/ui/growth-board-skill-manga-20261112/originals/sk_k15.png`, `/home/hatch/workspace/shisha-game/work/codex-a-3425-rest-1112/wt/assets/sprites/characters/hajime/chr_hajime_normal.png`

```text
Draw one wide 1536x576 manga skill illustration, no frame, art to all edges. Image 1 sk_k15 is the APPROVED STYLE AUTHORITY; lock same artist, tapered line art, black fills, broad hatching and sparse LARGE coarse printed dots. Image 2 official Hajime sprite is IDENTITY AUTHORITY; retain exact cap, hair, face and hoodie. Other photos are EQUIPMENT SHAPE/STRUCTURE ONLY, not color or scale. Strictly keep EVERY face, hand, fingertip and focal action in central y=25%-75%; top/bottom quarters only background. Readable when reduced to 434px, no fine dots/moiré. Monochrome ink only, no text, letters, numerals, logos, bubbles, sound effects, gradients, color, photo, 3D, watermark.  Asset sk_steam_calm.png. Hajime rests quietly with closed eyes and takes a calm meditative breath. Around him, soft curling smoke dissolves abstract scribbly noise shapes, NOT letters. Quiet still mood with broad white open space and dark black ink. NO hookah and NO equipment. Face and any hands strictly central-band.
```
