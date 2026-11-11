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
