# IMG-2222: SMOKE LAB と第4・5章CG

Codex 内蔵 imagegen で制作。2026-11-02。各 `*_original.png` は生成機能の出力を無加工コピーしたもの。ゲーム用 PNG は Pillow の Lanczos 縮小のみ（背景1280×720、CG1536×864）。すべて不透明RGB。生成時に実写の機材写真は手元に無く、Issue #2222 指定の構成8行と §4.2 の英文に基づいて制作した。早見表・構造図は生成機能へ添付していない。

## 参照画像と役割

| 画像 | 参照画像 | 役割 |
|---|---|---|
| 背景 | `assets/backgrounds/bg_eden_shop.png` | 2回目の編集で質感のみ。初回出力を編集対象にした |
| ドバイ到着 | `assets/sprites/characters/naru/chr_naru_normal.png`、`chr_naru_smile.png` | なる本人の顔・髪・服 |
| ドバイ到着 | `assets/ui/title_arts/title_art_keyvisual_01.png`、`remake/img/backgrounds/bg_dubai_map.webp` | 質感のみ、ドバイの色調のみ |
| 世界大会の握手 | なるの上記2枚、`assets/sprites/characters/master_hookah/chr_master_hookah_normal.png`、`assets/sprites/characters/sheikh/chr_sheikh_normal.png` | 3人の本人性 |
| 世界大会の握手 | `assets/ui/title_arts/title_art_keyvisual_01.png` | 質感のみ。5枚上限のため会場背景は添付せず、4ステーション構図を文で指定 |
| 9000との対面 | `assets/sprites/characters/shisha_9000/chr_shisha_9000_normal.png`、`assets/sprites/characters/dr_kemuri/chr_dr_kemuri_normal.png` | 本人性 |
| 9000との対面 | `bg_smoke_lab_original.png`、`assets/ui/title_arts/title_art_keyvisual_01.png` | 場所と質感のみ |
| エンディング | `assets/sprites/characters/sumi/chr_sumi_normal.png`、`chr_sumi_smile.png` | スミ本人 |
| エンディング | `remake/img/backgrounds/bg_tonari_inside_night.webp`、`assets/ui/title_arts/title_art_keyvisual_01.png` | 場所と質感のみ |

生成後の編集では直前の生成画像だけを編集対象にした。画像生成ツールの参照画像上限は5枚。

## 生成前の機材構成8行

```text
--- #1 bg_smoke_lab ---
人物      : なし（背景）
場面      : 準備中（ボウル未装着）。勝負の前。ステム先端は小さな凸型の金属ポストだけ。ハガル・HMD・炭・煙なし
台の型    : 2台とも同じ白とステンレスの角型モダンの台、透明なガラスのベース（同じ条件で比べるため）
HMD       : なし（ボウル未装着なので描かない）
炭        : なし
ホース    : 各台1本。ステム側面のポート → 台の天板へたわむ → 硬いハンドル。ハンドルは天板に寝かせる
吸い口    : なし
構図      : 研究室の中央に同じ台が2つ並ぶ。手前に客の椅子が一列（約10席）。奥にロボットの充電台（ロボットは描かない）

--- #3 cg_ch4_world_handshake ---
人物      : なる（手前・握手）、王煙楼・シェイク（遠景の自分の台の前に立つ）
場面      : 決勝が終わった直後。遠景の2台は完成・使用後（炭はHMDの中）。誰も吸っていない瞬間で、台から煙は出さない。舞台の空気にうっすら残る煙は、照明に見える薄い霞として描く
台の型    : 大会支給の銀の金属の台（2台とも同じ）。遠景なので小さい
HMD       : 蓋なしの低い金属の器。2台とも同じ1モデル
炭        : HMDの中に2個ずつ
ホース    : 各台1本。側面ポート → カウンターへたわむ → 硬いハンドルを台に掛ける。人物を囲まない
吸い口    : なし
構図      : 一人称。手前中央でなるが右手を差し出し、画面下からはじめの右手が握る。手と顔は上65%に。遠景は小さくぼかし気味

--- #4 cg_ch5_shisha_9000 ---
人物      : SHISHA-9000（台の向こうに立つ）、チャコール博士（脇の作業台の前）
場面      : 準備中（ボウル未装着）。勝負の前に台をそろえる場面。ハガル・HMD・炭・煙なし
台の型    : #1 と同じ白とステンレスの角型モダンの台が2つ、透明なガラスのベース
HMD       : なし（ボウル未装着なので描かない）
炭        : なし
ホース    : 各台1本。側面ポート → 天板へたわむ → 硬いハンドルを天板に寝かせる。9000 はホースに触れていない
吸い口    : なし
構図      : 一人称。はじめは2台の手前側に立つ。9000 は画面中央やや右の台の向こう、顔（バイザー）は上35%。博士は画面左寄り
```

## 実際の生成プロンプト全文

以下は採用原画までの各 imagegen 呼び出しで渡した文面。全呼び出しで `transparent_background=false`。機材3枚については末尾の「追加機材QA」の各前半文に、その下の共通英文全文を改行で直結して送信した。

### #1 背景：初回

```text
Use case: illustration-story
Asset type: visual novel background, landscape 16:9, 1280x720, opaque.
Anime visual novel background, detailed digital painting, cool clean lighting with a warm accent, no people. SMOKE LAB: the research laboratory of a gentle shisha scientist that also works as a small shisha tasting room, on an upper floor of an ordinary Japanese city building (not a sci-fi spaceship). Clean white walls and pale wood, long lab benches with neat rows of plain unlabeled sample tins and glass jars, a few monitors showing abstract curves without any numbers or text, small sensor arrays on stands, soft panel lights in the ceiling. In the center, two identical white-and-stainless square modern shisha stand side by side on two identical small tables for a fair match, each with a small digital scale with a blank display; their bowls are NOT mounted yet, so each stem ends in a small convex metal post, with no bowl, no HMD, no charcoal and no smoke; one hose per hookah sags from the side port onto the tabletop with its rigid handle lying flat. In front, a single row of about ten simple chairs for guests. At the back, an empty alcove with a charging stand for a humanoid robot (no robot in the image). Calm, precise, slightly warm despite all the white. Keep the center foreground open for a character overlay. Fine pixel-painter texture in the established anime background style, not photographic, not glossy 3D. No people, no robot, no text, no labels with writing, no logos, no numbers, no watermark.
Hardware rules: Draw the hookah with correct structure: with the bowl unmounted, each vertical stem ends in only a small convex metal post; no ceramic bowl, HMD or coals. Below the post, wide ash tray, vertical stem, glass base with water in its lower part. Each hookah has exactly one hose from the side port above the base, sagging naturally to a rigid handle lying on the table. No branching, floating or broken hoses. No real brands.
```

### #1 背景：採用編集

```text
Use case: style-transfer. Image 1 is the edit target: preserve the SMOKE LAB architecture, two identical unprepared hookahs, exactly one hose on each, blank scales, seats and empty robot charging alcove. Image 2 is solely the rendering style reference, not its room layout, furniture, colors or hookahs. Convert image 1 from its glossy 3D-rendered appearance into the same hand-painted fine pixel-painter 2D anime visual novel background texture as image 2. Retain bright white and pale wood lab palette, subtle warm accent. Remove the extra freestanding metal fixture at far left and excess plants if possible. Each hookah must have a small convex metal post atop its stem/ash tray, no mounted bowl, HMD, charcoal or smoke. Keep foreground central area usable for character overlay. No people, no robot, no letters, numbers, logos, UI or watermarks. Opaque 16:9 landscape.
```

### #2 ドバイ到着：初回

```text
Use case: compositing. Create one finished visual novel event CG for 水煙前線 -EN:CODE-. Landscape 16:9 composition, opaque full background. Warm, cinematic 2D anime illustration with a fine pixel-painter texture like reference image 3 (texture and rendering density only, do not copy its composition, character or hookah). Reference images 1 and 2 are THE canonical Naru: preserve his face, silver-white short undercut hair, amber eyes, black-and-white track jacket, black cargo pants, chain and white sneakers. Image 4 is only the Dubai color mood reference, not a literal location. Scene: chapter 4, the arrivals exit of a fictional airport in Dubai at midday. First-person point of view of protagonist Hajime: never show his face, only one hand. Naru stands just ahead of the viewer, slightly to the right, lifting a plain black hard equipment case by its handle and squinting with a wry grimace at the blinding heat that pours in through the open glass doors. In lower-left foreground, Hajime's own hand grips the handle of a second identical closed case. Through the doors: white-gold heat haze over a curb lane, date palms, distant sand-colored towers. Cool blue-white terminal light on the inside, hot gold light on the outside. Friendly, slightly excited mood of two rivals traveling together. Keep Naru's face and both case-gripping hands in the top 65% because dialogue covers the bottom 25%. Both cases closed; no hookah visible. Do not copy any real airport. No text, letters, logos, numbers, UI, watermark or borders.
```

### #2 ドバイ到着：採用編集

```text
Use case: precise-object-edit. Edit target is the Dubai airport arrival CG. Preserve Naru's canonical face, silver-white short hair, amber eyes, black-and-white track jacket and friendly heat-struck grimace; preserve the fictional airport, midday Dubai sun and 16:9 painted pixel-texture style. Recompose ONLY both case-carrying actions higher in the picture: Naru's right hand gripping his black case handle and Hajime's left-foreground hand gripping the second black case handle must both be completely above 65% of image height, with case tops around middle height. Shift the two cases upward with the hands so the gesture is visible over a dialogue panel covering the bottom 25%. Keep cases closed and same size; Hajime's face remains unseen. No letters, text, numbers, logos, UI or watermark.
```

### #3 世界大会の握手：初回

```text
Use case: compositing. Create one finished visual novel event CG for 水煙前線 -EN:CODE-. Opaque landscape 16:9, warm cinematic 2D anime illustration with fine pixel-painter shading. Image 1 and 2 are THE canonical Naru: preserve face, short silver-white undercut, amber eyes, black-and-white track jacket and chain. Image 3 is canonical Wang Yanlou: elderly master with long white braid and beard, crimson high-collared jacket. Image 4 is canonical Sheikh: white kandura, gold-trimmed cloak and white ghutra with black agal. Image 5 is only the pixel-painter texture, never copy its character, composition or hookah.
Scene: world championship GRAND SMOKE in Dubai, the moment right after Hajime is announced winner. A large four-station competition stage, dark audience silhouettes beyond. First-person view, never show Hajime's face. In the FOREGROUND, Naru stands facing viewer and reaches out his RIGHT hand for a firm handshake, frustrated but proud half-smile; from bottom-left Hajime's RIGHT hand meets and grips Naru's right hand. Place the ENTIRE clasped hands and Naru's face high in the TOP HALF of the image, clearly above 65% height, because a dialogue box covers the bottom 25%. In softly blurred background, Wang Yanlou and Sheikh stand at their own stations and watch calmly. Audience beyond stage applauds as dark blurred silhouettes. Warm gold spotlights and faint stage haze, no hookah smoke. Far background has TWO small completed silver hookahs, one at each elder's station, same model: glass base with water low, vertical metal stem, wide ash tray, ceramic bowl, low lidless metal HMD cup on bowl rim, two fingertip-sized grey coals INSIDE each HMD. One hose per hookah, from a side stem port above base, sagging to a rigid handle lying on counter. No other hookahs, no branching/broken/floating hoses, no coals directly on foil, no giant equipment. No one smoking. No text, letters, logos, numbers, UI, watermarks or borders.
```

### #3 世界大会の握手：採用編集

```text
Use case: precise-object-edit. Edit target is the championship handshake CG. Preserve all characters' identities, clothes, the two completed hookahs and correct single hoses, stage lighting, texture and landscape 16:9 format. Only recompose the main handshake: raise the two clasped hands upward so the entire key handshake fits in the top 60% of the frame, around y=400-500 rather than the lower quarter; show Hajime's arm entering from left-middle rather than bottom edge. Keep Naru's face above the hands and his proud frustrated expression. Keep Wang Yanlou and Sheikh behind their stations. The bottom 25% is reserved for dialogue and must not contain the handshake. No text, logos, numbers, UI, watermark.
```

### #4 SHISHA-9000：採用初回

```text
Use case: compositing. Create one finished visual novel event CG for 水煙前線 -EN:CODE-. Opaque 16:9 landscape. Image 1 is THE canonical SHISHA-9000: preserve the slender bipedal white armor, silver and black joints, gold seams, violet and blue glowing details and robotic mask face, absolutely no human skin, hair or mouth. Image 2 is THE canonical Dr. Charcoal: preserve messy brown hair, glasses, white shirt, stained lab coat, beige chinos and sandals. Image 3 is the actual SMOKE LAB room layout, white-and-pale-wood materials and exactly two matching unprepared modern hookahs. Image 4 is only the fine pixel-painter texture reference, not its composition, character, equipment or smoke. Warm cinematic 2D anime illustration with detailed painted pixel-grain shading, not 3D.
Scene: chapter 5, SMOKE LAB on the morning of the final match. First-person point of view of protagonist Hajime: never show his face. At the back of the room, slightly right of center, SHISHA-9000 stands perfectly still behind one of two identical white-and-stainless shisha tables, arms relaxed, head slightly tilted toward viewer. A small blank inspection tag hangs at the neck seam. To the left, Dr. Charcoal stands by a lab bench holding a blank clipboard and smiling gently. On two tables, the matching hookahs are not prepared: bowls NOT mounted, each vertical stem ends in a small convex metal post over a wide ash tray, no ceramic bowl, HMD, charcoal or smoke. Below, glass base with water only in lower part. Exactly one hose from a side port above the base per hookah, sagging naturally onto the tabletop, connected to a rigid handle lying flat. No hose branching, floating or breaks. Two small digital scales with blank displays. Robot does not touch hoses. Robot face in top 35% and all character faces above top 65%. Quiet, clean, a little eerie but not hostile. No text, letters, logos, numbers, UI, watermark or border.
```

### #5 エンディング：初回

```text
Use case: compositing. Create one finished visual novel event CG for 水煙前線 -EN:CODE-. Opaque 16:9 landscape. Warm cinematic 2D anime illustration with fine pixel-painter texture, not 3D. First-person point of view of protagonist Hajime, never show his face. Image 1 and 2 are THE canonical Sumi, 46 years old: preserve the same face, black flat cap, short black hair, square glasses, beard and mustache, charcoal shirt with rolled sleeves, brown waist apron. Image 3 is the established tonari shop's nighttime interior, especially its irregular Turkish mosaic pendant lamps, green seating, wood, windows; adapt it to a counter view. Image 4 is only the texture and rendering-density reference, not its person, composition, equipment or smoke.
Scene: the ending, a few days after the final match. Late at night after closing at tonari. Viewer sits at the counter. Across the counter, Sumi turns a freshly washed glass upside down onto a folded towel, sleeves rolled up, with a calm, tired, warm little smile, as if about to say 'I'm hungry, let's eat something'. Warm amber mosaic pendant lights, the other clean glasses drying in a row, chairs put up on a few tables in the background, a window showing the quiet night street. On shelf behind him, one small framed photo whose contents cannot be read. Ordinary peaceful night that feels like home. No other people. No hookah or shisha equipment anywhere in frame. Put Sumi's face, the glass and both working hands within the top 65% of the image because dialogue covers the bottom 25%. No text, letters, logos, numbers, UI, watermark, borders.
```

### #5 エンディング：編集1

```text
Use case: precise-object-edit. Edit target is the quiet tonari ending CG. Preserve Sumi's canonical face, cap, glasses, beard, charcoal rolled-sleeve shirt, brown waist apron, warm peaceful smile, irregular colorful Turkish mosaic lamps, night street, other upside-down glasses, painterly 16:9 style. Change ONLY the central glass action: his right hand is in the act of setting a freshly washed, completely upside-down clear drinking glass onto a folded dry towel on the counter in front of him. The glass rim points down, base points up, and the towel is flat beneath it. His left hand rests near the towel. Both hands and glass entirely above 65% of image height, not hidden by the bottom dialogue box. Remove the cloth currently wrapped around the glass. No hookah in frame, no text, numbers, logos, UI or watermark.
```

### #5 エンディング：採用編集2

```text
Use case: precise-object-edit. Keep this same ending scene, Sumi's identity, clothing, bar, mosaic lamps, palette, upside-down clear glass and towel. Adjust camera framing so the key action of Sumi setting the upside-down glass on the folded towel is visibly HIGHER: glass and BOTH hands entirely inside the top 60% of the image (all above y=565 of a 941-pixel canvas). The bottom 25% will be covered by a visual novel dialogue panel. You may make Sumi slightly smaller or shift the counter toward mid-frame to accomplish this, but retain natural anatomy and perspective. Full opaque 16:9 illustration. No shisha equipment, text, letters, numbers, logos, watermark or UI.
```

### 追加機材QA：#1 背景（採用原画への最終編集）

```text
Use case: precise-object-edit. Preserve this established SMOKE LAB background's 2D pixel-painter style, white and pale-wood room, two identical white/stainless hookahs, clear bases, two small blank scales, chairs and empty back alcove. This scene is BEFORE assembly: both hookah bowls are UNMOUNTED, so there must be no bowls, HMDs, coals or smoke; each stem ends in a small convex metal post. Ensure the one hose per hookah traces from the side port to the hard handle resting on its tabletop. Maintain no people or robot, no letters, numbers or UI. The following general structure rule applies only to the parts actually installed in this scene; its finished-setup lines are conditional and do not call for bowls/HMD/coals here.
```

### 追加機材QA：#3 握手（採用原画への最終編集）

```text
Use case: precise-object-edit. Preserve this championship handshake CG, Naru/Wang Yanlou/Sheikh identities and clothing, top-half handshake placement, warm stage lights and 2D pixel-painter rendering. Perform a strict visual quality pass on the two finished silver hookahs behind Naru: identical low lidless HMD with two small coals contained inside each, ceramic bowl below, wide tray, stem, clear water base; exactly one hose from side port to hard handle on each counter, no floating branches or smoke from equipment. Do not alter the handshake or add other hookahs. Keep faces and clasped hands above the bottom dialogue area. The following full general rule is included verbatim for hardware accuracy; for these finished rigs all listed components apply.
```

### 追加機材QA：#4 9000（不採用となった中間出力）

```text
Use case: precise-object-edit. Preserve this SMOKE LAB event CG exactly in its established anime pixel-painter style: canonical white-and-gold robot with purple/blue light eyes and no human face or hair, canonical bespectacled scientist at left with blank clipboard, two identical white/stainless unprepared hookahs, two blank scales, lab and 16:9 layout. Do a strict hardware check. Both bowls are UNMOUNTED, so each stem ends in only a small convex metal post above its tray, with no bowls, HMD, coals or smoke. Exactly one unbroken side-port hose to a rigid handle lying flat on each tabletop. Robot never touches hose. No writing or numbers on tag, monitors, scales or elsewhere. The following general structure rule applies only to installed parts; finished-setup components must not be added to this before-assembly scene.
```

この呼び出しでは共通英文の完成状態の記述に引っ張られ、HMD・炭・煙・使用中の人物が描かれたため不採用。次の編集で撤去した。

### #4 9000：採用最終編集

```text
Use case: precise-object-edit. Image 1 is the edit target; image 2 is the correct prior state and hardware reference. Restore the exact BEFORE-SETUP scene of image 2 while retaining the canonical robot and doctor, SMOKE LAB room and two matching tables. REMOVE both ceramic bowls, both HMD cups, all coals and all smoke completely. REMOVE the extra hoses being held by the doctor and robot and restore their original clipboard and relaxed arms. Each hookah must have only a little convex metal post on top of its stem and wide tray, a clear base with water low, and exactly one hose from the side stem port to a hard handle resting on the same tabletop. Do not allow a hose in anyone's hands, mouth or body. Nothing is burning or smoking yet. Preserve pixel-painter 2D style, blank scales, 16:9 landscape. No text, numbers, logos or UI.
```

### 共通英文全文（上記3件の末尾にそのまま接続）

```text
Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. The stem goes straight down into the mouth of the base through a rubber grommet; the base is not an aquarium. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.
```

## SHA-256

| 原画 | SHA-256 | ゲーム用PNG | SHA-256 |
|---|---|---|---|
| `bg_smoke_lab_original.png` | `e611604a28c3fdfa36f2009dcf4b76d50ed019d5835b1c1bc1d08eaf78a72fde` | `assets/backgrounds/bg_smoke_lab.png` | `55d99fc7a1429bf3db0e8cbfbe13d63930a19c8a3588a7e044647fbdc96304f5` |
| `cg_ch4_dubai_arrival_original.png` | `b34562afcf43e3fa4ea532395b74f02b012b8261f17ece8d0188933a066db14e` | `assets/cgs/cg_ch4_dubai_arrival.png` | `801d6085826ea8afcfdb6cba8e01d448fc1cc38f708156c9e981fd3af397ed50` |
| `cg_ch4_world_handshake_original.png` | `9901423ebeb404842be75f1fd18f998629c7825c9a3c6b435e5f7b0506e8ae30` | `assets/cgs/cg_ch4_world_handshake.png` | `33cac733a689f0652dc616b2064369bdeb77f5d16a5110f3e334edeb61a7e4f8` |
| `cg_ch5_shisha_9000_original.png` | `c9f8d9f7eb15b5742494809f525a8129b2f01b501a873629b0ea14a79e92f904` | `assets/cgs/cg_ch5_shisha_9000.png` | `6123436f265c5c39ed3904b6d4d8e24f537ad78a61efad3c34b99a829e92a9ac` |
| `cg_ending_tonari_night_original.png` | `b7a34cde6cf4ab06fed8b007ea6c6548ae9195256d55b703ec61f0a90de9e347` | `assets/cgs/cg_ending_tonari_night.png` | `9e5e01b5313a91df780693003269dc0a8b07aec7cfb32c0053834d54aeccb270` |

## 原寸検品メモ

- #1/#4: 両方とも台2台、未装着ポスト、HMD・炭・煙なし。ホースは各台の側面ポートからハンドルまで各1本。#1 は椅子が約7席となり、指定の「約10席」より少ない。充電台も採用編集で明瞭ではない。
- #3: なる・王煙楼・シェイクの容姿は立ち絵と整合。台2台の低いHMDに炭2個、側面ポートからホース1本を確認。握手は編集後、会話枠より上。
- #2/#5: 顔と主動作は会話枠より上。#5 の手元は上65%に完全には収まらないが、下25%の会話枠には重ならない。
- はじめの顔・ヒロイン・画像内の文字やロゴ、数字、UI、透かしは見当たらない。
