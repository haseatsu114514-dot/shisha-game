# Issue #3389 C1 原画生成記録

- 採用原画: `one-coal-untouched.png`（第2回、元ファイルからバイト一致コピー）
- 原画 SHA-256: `f900ffeaf5a1e8f171199748f32c630770d3e0ebe4903e096a7633778a9c531a`
- 実寸: `1254×1254` RGBA。生成器は 512×512 の指定にもかかわらず 1254×1254 を返した。原画無加工を優先し、採用判断および512×512派生画像の作成は後工程に委ねる。
- 生成器: Codex 内蔵 image_gen、真の透過指定。

## 参照と役割

- 構造の正: 非公開 `siryou/shisha-hardware-reference/web-refs/images/hmd-twoPiece-woodHandle-01.jpg`（Y2、SHA-256 `7b939e0156b0f4be599c3da82f7059c5b2484afe591aaa801dd336d55381473d`）。作業時に取得・目視確認。写真は本リポジトリにもPRにも含めない。接写は形だけ参照し、写真の中の大きさは写さない。
- 向き・光・透過と画風: `remake/img/shop/equipment/lotos_hagal.webp`（SHA-256 `ee33939bfad083677d8e8a6fa82dbf219bbe55ec9f026b9e904ffc17f01ce498`）。構造や部品形状は写さない。
- 画風: `remake/img/shop/equipment/tanukish_lid.webp`（SHA-256 `58f4060eb1345832ae996d30664d132298e9bc27214350676a164f6e9d61d7f3`）。構造や部品形状は写さない。
- 画風: `remake/img/shop/equipment/amaburst_hms.webp`（SHA-256 `5237068d76fc9b19b5c0030a14f2e93665531448a3b58941bb64a76df1a24e61`）。構造や部品形状は写さない。

## 生成前に決めた8行

```text
人物      : なし。機材単体
場面      : 準備中。ボウルに装着する前のHMD単体
台の型      : 描かない
HMD      : Y2（2026-11-12 オーナー決定。ゲーム内の名前は C1）。6cmの金属筒・蓋・木製取っ手・通気口を同じ1モデルに統一
炭      : 描かない。形の基準はキューブ1個で運用する小型機材
ホース      : 描かない
吸い口      : 描かない
構図      : ショップの3枚と同じ上から斜めの向き・左上の暖色光、紫の影、真の透過。人物や台との縮尺比較は機材単体なので対象外。写真の6cm表記と標準炭約25mmを構造の目安にし、手や台を足さない
```

## 生成と検品

- 生成1: 蓋と本体の構造、透過、光は良いが木製取っ手が一本のみ。Y2の二本に合わず不採用。
- 生成2: 蓋と本体を組み合わせ、各部品の木製取っ手二本、十字状の蓋穴と側面スリットが見える。炭1個用の小型構造として判読でき、76pxでも他のHMDと異なる輪郭。不採用項目は原寸512×512未達。これを採用原画として保存。
- 生成3: 再び木製取っ手が一本のみとなり、構造不一致で不採用。
- 採用原画を原寸で確認: HMD一台のみ、蓋装着、ボウル・炭・人物・手・台・床・文字・数字・ロゴ・枠なし。透明アルファあり、端の欠けなし。背景の塗りと接地影なし。左上の暖色光と紫の影を既存3枚と比較。
- 既知の差分: 原画は 1254×1254 で、Issue指定の 512×512 納品規格とは異なる。写真の構造は視覚照合であり、見えない内部寸法は保証しない。

## 実際に送ったプロンプト全文

### 第1回

- 生成ファイル SHA-256: `33a0f8507755790a313667d8b576b0e801b8018532272205530c619f1b58cdf1`、`1254×1254`

```text
生成前に決める8行（計画どおり）:
人物      : なし。機材単体
場面      : 準備中。ボウルに装着する前のHMD単体
台の型      : 描かない
HMD      : Y2（2026-11-12 オーナー決定。ゲーム内の名前は C1）。6cmの金属筒・蓋・木製取っ手・通気口を同じ1モデルに統一
炭      : 描かない。形の基準はキューブ1個で運用する小型機材
ホース      : 描かない
吸い口      : 描かない
構図      : ショップの3枚と同じ上から斜めの向き・左上の暖色光、紫の影、真の透過。人物や台との縮尺比較は機材単体なので対象外。写真の6cm表記と標準炭約25mmを構造の目安にし、手や台を足さない

画風固定の指示文: ショップ機材の既存絵と同じ上から斜めの向き・左上の暖色光・紫の影・真の透過で描く。構造は Y2 の1モデルだけに従い、他の機材の形は混ぜない

Draw ONE isolated low-temperature hookah heat-management device (HMD) equipment icon for the visual-novel game. This is a standalone detached equipment sprite BEFORE installation on any bowl. Draw ONLY the HMD, with its own lid seated normally; no bowl, foil, charcoal, hookah stem, ash tray, base, hose, hand, person, floor or backdrop. This subject restriction takes precedence over the general structural context below.
Reference roles IN ORDER: image 1 is the owner-selected physical Y2 reference, for one coherent mechanical structure ONLY. It has a compact approximately 6cm stainless-steel cylindrical body, a fitted cap, side ventilation slots and wooden handles. Keep the lid, body, vent layout and handles from this ONE model. Do not add a Lotus silicone grip, ONMO rim or Amavost domed lid. The photo shows disassembled parts; output ONE assembled object, not an exploded diagram or two copies. The photo is shape-only context: do not reproduce the photo, its white lined page, captions, text, brands or exact surface marks.
Images 2, 3 and 4 are the game's existing shop equipment icons (lotos_hagal, tanukish_lid, amaburst_hms): copy ONLY their three-quarter top-down camera, upper-left warm lighting, purple metal shadows, pixel-painter edge texture, overall level of detail and transparent presentation. Their mechanical designs are NOT reference parts. Keep a small complete readable silhouette, enough transparent margin and no halo or cast ground shadow. The wood handles and compact double-cylinder profile should remain distinguishable from the other HMDs at 76px.
The chamber should read as a compact one-cube low-heat device, not a large multi-coal basket. Ordinary cube coals are about 25mm, but do not draw any coal and do not shrink the outer metal body to cube size. Preserve the proportions of the selected real device. No huge lid, chimney, extra tubes, fictional vents or merged parts.

General project structural context, copied verbatim; only the HMD portions apply to this detached icon:
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.

Final subject and output restriction: ONLY ONE detached compact HMD, lid properly seated, no charcoal or other equipment. No real logo, brand, letters, numbers, watermark or border. One square true-alpha RGBA PNG, requested canvas 512 x 512, no background. Preserve the original generated file unchanged and record its actual dimensions if the generator returns a different size.
```

### 第2回

- 生成ファイル SHA-256: `f900ffeaf5a1e8f171199748f32c630770d3e0ebe4903e096a7633778a9c531a`、`1254×1254`

```text
生成前に決める8行（計画どおり）:
人物      : なし。機材単体
場面      : 準備中。ボウルに装着する前のHMD単体
台の型      : 描かない
HMD      : Y2（2026-11-12 オーナー決定。ゲーム内の名前は C1）。6cmの金属筒・蓋・木製取っ手・通気口を同じ1モデルに統一
炭      : 描かない。形の基準はキューブ1個で運用する小型機材
ホース      : 描かない
吸い口      : 描かない
構図      : ショップの3枚と同じ上から斜めの向き・左上の暖色光、紫の影、真の透過。人物や台との縮尺比較は機材単体なので対象外。写真の6cm表記と標準炭約25mmを構造の目安にし、手や台を足さない

画風固定の指示文: ショップ機材の既存絵と同じ上から斜めの向き・左上の暖色光・紫の影・真の透過で描く。構造は Y2 の1モデルだけに従い、他の機材の形は混ぜない

Draw ONE isolated low-temperature hookah heat-management device (HMD) equipment icon for the visual-novel game. This is a standalone detached equipment sprite BEFORE installation on any bowl. Draw ONLY the HMD, with its own lid seated normally; no bowl, foil, charcoal, hookah stem, ash tray, base, hose, hand, person, floor or backdrop. This subject restriction takes precedence over the general structural context below.
Reference roles IN ORDER: image 1 is the owner-selected physical Y2 reference, for one coherent mechanical structure ONLY. It has a compact approximately 6cm stainless-steel cylindrical body, a fitted cap, side ventilation slots and wooden handles. Keep the lid, body, vent layout and handles from this ONE model. Do not add a Lotus silicone grip, ONMO rim or Amavost domed lid. The photo shows disassembled parts; output ONE assembled object, not an exploded diagram or two copies. The photo is shape-only context: do not reproduce the photo, its white lined page, captions, text, brands or exact surface marks.
Images 2, 3 and 4 are the game's existing shop equipment icons (lotos_hagal, tanukish_lid, amaburst_hms): copy ONLY their three-quarter top-down camera, upper-left warm lighting, purple metal shadows, pixel-painter edge texture, overall level of detail and transparent presentation. Their mechanical designs are NOT reference parts. Keep a small complete readable silhouette, enough transparent margin and no halo or cast ground shadow. The wood handles and compact double-cylinder profile should remain distinguishable from the other HMDs at 76px.
The chamber should read as a compact one-cube low-heat device, not a large multi-coal basket. Ordinary cube coals are about 25mm, but do not draw any coal and do not shrink the outer metal body to cube size. Preserve the proportions of the selected real device. No huge lid, chimney, extra tubes, fictional vents or merged parts.

General project structural context, copied verbatim; only the HMD portions apply to this detached icon:
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.

Final subject and output restriction: ONLY ONE detached compact HMD, lid properly seated, no charcoal or other equipment. No real logo, brand, letters, numbers, watermark or border. One square true-alpha RGBA PNG, requested canvas 512 x 512, no background. Preserve the original generated file unchanged and record its actual dimensions if the generator returns a different size.

Second-attempt QA correction: The first result showed only one wooden handle. The selected Y2 reference has TWO separate wooden handles, one on the cap and one on the lower metal base. In the ONE assembled HMD, both handles must be visibly distinct and emerge from their correct respective components. Rotate the single object to reveal both; keep the cap fitted onto the base. Maintain the selected photo's compact 6cm diameter proportions, not a wide multi-coal chamber. Leave clear transparent margins around the entire silhouette.
```

### 第3回

- 生成ファイル SHA-256: `eba09b087587fd685ab3cc318876f2ecc92063b831fafd4d70ddaeb801f3d2e8`、`1254×1254`

```text
生成前に決める8行（計画どおり）:
人物      : なし。機材単体
場面      : 準備中。ボウルに装着する前のHMD単体
台の型      : 描かない
HMD      : Y2（2026-11-12 オーナー決定。ゲーム内の名前は C1）。6cmの金属筒・蓋・木製取っ手・通気口を同じ1モデルに統一
炭      : 描かない。形の基準はキューブ1個で運用する小型機材
ホース      : 描かない
吸い口      : 描かない
構図      : ショップの3枚と同じ上から斜めの向き・左上の暖色光、紫の影、真の透過。人物や台との縮尺比較は機材単体なので対象外。写真の6cm表記と標準炭約25mmを構造の目安にし、手や台を足さない

画風固定の指示文: ショップ機材の既存絵と同じ上から斜めの向き・左上の暖色光・紫の影・真の透過で描く。構造は Y2 の1モデルだけに従い、他の機材の形は混ぜない

Draw ONE isolated low-temperature hookah heat-management device (HMD) equipment icon for the visual-novel game. This is a standalone detached equipment sprite BEFORE installation on any bowl. Draw ONLY the HMD, with its own lid seated normally; no bowl, foil, charcoal, hookah stem, ash tray, base, hose, hand, person, floor or backdrop. This subject restriction takes precedence over the general structural context below.
Reference roles IN ORDER: image 1 is the owner-selected physical Y2 reference, for one coherent mechanical structure ONLY. It has a compact approximately 6cm stainless-steel cylindrical body, a fitted cap, side ventilation slots and wooden handles. Keep the lid, body, vent layout and handles from this ONE model. Do not add a Lotus silicone grip, ONMO rim or Amavost domed lid. The photo shows disassembled parts; output ONE assembled object, not an exploded diagram or two copies. The photo is shape-only context: do not reproduce the photo, its white lined page, captions, text, brands or exact surface marks.
Images 2, 3 and 4 are the game's existing shop equipment icons (lotos_hagal, tanukish_lid, amaburst_hms): copy ONLY their three-quarter top-down camera, upper-left warm lighting, purple metal shadows, pixel-painter edge texture, overall level of detail and transparent presentation. Their mechanical designs are NOT reference parts. Keep a small complete readable silhouette, enough transparent margin and no halo or cast ground shadow. The wood handles and compact double-cylinder profile should remain distinguishable from the other HMDs at 76px.
The chamber should read as a compact one-cube low-heat device, not a large multi-coal basket. Ordinary cube coals are about 25mm, but do not draw any coal and do not shrink the outer metal body to cube size. Preserve the proportions of the selected real device. No huge lid, chimney, extra tubes, fictional vents or merged parts.

General project structural context, copied verbatim; only the HMD portions apply to this detached icon:
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. Keep the hookah to real scale: the whole hookah is 60–80 cm tall (on the floor its top reaches a seated person's chest or shoulder). The bowl is a small cup about 6–8 cm tall, with a mouth narrower than an adult's palm; the HMD has the same diameter as the bowl mouth and is only two fingers tall. Bowl + HMD + coals together are only 10–12 cm tall: about 1/6 to 1/7 of the hookah's height and about half the height of the character's face. The tray is about 2.5× the HMD width; coals are fingertip-sized. Do NOT draw an oversized bowl or HMD: the hookah is a modest prop, the character is the subject. Place the hookah at the same depth as the character, with the tray and the upper stem in frame, not in the foreground. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Base the hookah and the room on present-day Japanese shisha bars: a slim stainless-steel stem with a wide glass base and a small tray, a silicone bowl with a lotus-type HMD (or another HMD named in the scene), in a Japanese shisha café or bar interior (sofa seating, bright café style or dim indirect lighting). No ornate Middle-Eastern engraved hookah unless asked. Colors and finishes are free; no real brands, logos or text.

Final subject and output restriction: ONLY ONE detached compact HMD, lid properly seated, no charcoal or other equipment. No real logo, brand, letters, numbers, watermark or border. One square true-alpha RGBA PNG, requested canvas 512 x 512, no background. Preserve the original generated file unchanged and record its actual dimensions if the generator returns a different size.

Third-attempt QA correction: Maintain the correct TWO separate wooden handles, one on the lid and one on the base, as in the previous attempt. Render the mechanical object with the three supplied shop icons' subtly pixel-painted edge texture and restrained sprite detail, rather than a polished product render. Keep the complete silhouette compact and centered with ample empty transparent margins. Produce a native 512 by 512 pixel transparent PNG canvas if available. Do not add any background or shadow plane.
```
