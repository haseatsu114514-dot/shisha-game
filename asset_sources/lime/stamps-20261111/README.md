# Issue #3420 B1 スタンプ原画

`st_mukai_master_ack/raw.png` — ムカイさんの「助かる」。文言は後で Claude 側が入れる。B2〜B9 は作らない。

## 原画・参照画像

- SHA-256: `7878ce30d2ae833ef434d8e3cfc6a47b37ee905a3cfb742af9dc26960a8113b4`
- PNG: 1254×1254、RGB、無加工
- 参照（画風のみ、文字のない原画）: `asset_sources/lime/issue1226/stamps/st_kumicho_ack/art.png`、`asset_sources/lime/issue1226/stamps/st_kumicho_care/art.png`、`asset_sources/lime/issue1226/stamps/st_minto_cheer/art.png`

## 検品

マグカップ、中折れ帽、お辞儀、上部配置、下の文言用余白、文字なしを原寸で確認。3回生成し、最も余白が広く輪郭が明瞭な3案目を保存。

指定の1024×1024に対し生成原画は1254×1254。背景は白に見えるが厳密な #FFFFFF ではない（左上画素 (254, 253, 255)）。無加工保存の指定に従い、そのまま収録。白抜き・文字入れ前に Claude 側で確認が必要。

## 依頼文全文（Issue #3420 §4-B の B1 まで）

（オーナーが要らない分のブロックを消してから貼る）

```text
【対象】ゲーム内のチャットアプリ「LIME」のスタンプ（絵だけ）。B1 は優先。B2〜B6 は任意。B7〜B9 は保留（今のゲームでは表示されない。オーナーが出すと決めたときだけ作る）。
【使い方】1回の生成で1枚。各「--- ---」の前に、下の COMMON RULES を毎回つける。同じ人の2枚目（B2・B4・B6）は、1枚目の出来上がり（raw.png）も添付して、同じ造形・同じ色にする。
【保存先】asset_sources/lime/stamps-20261111/<ID>/raw.png（無加工・縮小しない）。依頼文の全文・添付した画像のパス・sha256・後で入れる文言を asset_sources/lime/stamps-20261111/README.md に書く。成果は Draft PR に原画として出す（白抜き・文字入れ・ゲームへの組み込みはしない）。画像は Git LFS（AGENTS.md の規則）。
【サイズ】正方形1:1・1024x1024・PNG。背景は真っ白（#FFFFFF）一色。白を抜く作業と文字入れはこちらで行う。
【添付する画像（画風の参考。文字の無い原画）】
- asset_sources/lime/issue1226/stamps/st_kumicho_ack/art.png（物に顔を付けたキャラ）
- asset_sources/lime/issue1226/stamps/st_kumicho_care/art.png（果物のキャラが小さな手で物を持つ）
- asset_sources/lime/issue1226/stamps/st_minto_cheer/art.png（全身のマスコットのポーズ）
※ remake/img/ui/lime/stamps/ のゲーム用は下に文字が入っているので添付しない（文字が移る）。
【文字】絵に文字は描かない。各ブロックの「文言」は、後でこちらが下の空きに入れる（Noto Sans CJK Bold・濃い茶色＋白い縁）。

COMMON RULES (apply to every sticker below):
A chat sticker illustration for a LINE-like messaging app in a cozy visual novel about shisha shops. Match the attached reference stickers in style: one cute mascot-like character made from an object or a fruit, soft hand-drawn colored-pencil and watercolor texture, warm dark-brown outline, gentle shading, simple dot eyes, a small curved mouth and pink blush, tiny rounded nub hands when it needs hands, friendly and calm mood.
Square 1024x1024 canvas with a flat pure white background (#FFFFFF): no ground shadow, no frame, no border. Place the art horizontally centered in the upper part of the canvas, between about 2% and 78% of the height, and leave the bottom 20% completely empty white (a caption will be added there later). Keep one continuous dark outline around the whole character so the white background can be removed cleanly; any white or cream parts of the character must be enclosed by that outline and must not touch the background. It must read clearly at 128 px.
Never include: any text, letters, numbers, onomatopoeia, speech bubbles, emoji, written symbols, logos or watermarks; any human, human face or human hand; any shisha or hookah equipment, charcoal, cigarette or cigar.

--- B1/9（優先）: st_mukai_master_ack ／ 文言（後入れ）「助かる」 ---
For Mukai, a gentle cafe owner who looks hard-boiled but loves sweet lattes. A plump cream-colored coffee mug character wearing a small dark-brown fedora tilted low over one eye, eyes closed in a soft smile, light blush, bowing slightly with its tiny nub hands together as a quiet thank-you; a thin curl of steam rises from behind the hat brim. Calm and warm.
