# Issue #3420 B1 スタンプ原画

## 全員分の追加と組み込み（2026-11-11、オーナー指示）

B2〜B9も作成し、第4・5章の `lineMedia` を有効化。以下の旧依頼文の担当分担・保留は今回のオーナー指示で更新。原画は無加工保存。

![128pxプレビュー](preview.png)

生成ツール・依頼文全文は [generation.json](generation.json)。B2は専用全文、それ以外は common_prompt と各 prompts の連結。B1の記録は下に保持。B3の帽子・ベスト、B5の帽子は生成時に画風参照から付いた装飾で、2枚目も同じ造形を参照。

変換: 原画を1024pxへLANCZOS縮小。RGB各成分235以上・成分差20以下の領域のうち左上と接続した背景のみ透過。内部のクリーム色は保持。art.png に Noto Sans CJK Bold 108px、中心 (512,943)、#3A261A、白縁9pxで文言合成し master.png、320px RGBAへLANCZOS縮小。原画とゲーム用の文字なし・透過・余白・小サイズを目視確認。

| ID | 文言 | 差し込み先 | 原画 SHA-256 |
|---|---|---|---|
| `st_da_silva_great` | 最高！ | `casual_lime.people.da_silva` | `f9a5d54a88ac67d2878aae083bbca673ae258bd52d0cd30d76317f2645c7a2ce` |
| `st_master_hookah_wait` | 待っている | `casual_lime.people.master_hookah` | `91e0d506c124f554bd6fba4549085db4eb37f337a8951735068a2d95e1c59a1b` |
| `st_mukai_master_ack` | 助かる | `templates.mukai_baito.accept_reply` | `7878ce30d2ae833ef434d8e3cfc6a47b37ee905a3cfb742af9dc26960a8113b4` |
| `st_mukai_master_latte` | まあ、一杯 | `casual_lime.people.mukai_master` | `5487a855cc9be21d10bd6ef6f91ff1211bed262ba2e0df4c9b5c812b83559e05` |
| `st_noor_morning` | おはよう！ | `lover.morningStamp.noor` | `5eb1701b5fe4f5e7ad596a0e7238e706e6be2216e54fed1f7021575098096a88` |
| `st_saku_ack` | 了解 | `casual_lime.people.saku` | `9c04cb199e21f209795ce28f9b1223d20ff0f69ece28a376ac34580ddd9de010` |
| `st_saku_guess` | 予想どおり | `casual_lime.people.saku` | `dc4383b032b0f531e77c38d31f224040bc3576e9395dc42883f3a5cd6861deee` |
| `st_steve_ok` | オーケー | `casual_lime.people.steve` | `f68fd58264b5399f7891ebf2feb5621ee0bb9addd3f9e682a600aa8fc702ed15` |
| `st_steve_wait` | 急ぐなよ | `casual_lime.people.steve` | `279f8543b227d98943a7aa46dfd9199585963c48530909179583f954d47c8a0f` |

## B1原画の当初依頼・履歴

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
