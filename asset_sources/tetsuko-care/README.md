# てつこといっしょ（#2454）の画像素材 ── Codex への依頼（2026-11-06・TKT01）

オーナー「UIとかも本格化したい　コーデックスに画像生成依頼を投げてもいいので再度練って」（2026-11-06）。

今のふれあい画面（PR #2679）は、裏口の壁・戸・ベンチ・小物を CSS の四角と丸で描き、猫は会話用の5表情を切り出して CSS で傾けているだけで、「AIが組んだ仮の画面」に見える。そこで**裏口の背景・猫のしぐさ・小物・UI の部品を、手で描いた素材に置き換える**。
数字・名前・文字・ゲージ・猫の動き（移動・揺れ・まばたき・喉の波）は、これまでどおりコードが描く。素材には焼き込まない。

Claude は画像を生成しない。下の「Codex へ渡す文」をそのまま Codex に渡して生成してもらい、原画を `asset_sources/tetsuko-care/originals/` に置いて push してもらう（ギガファイル便でも可。その場合は SHA-256 を添える）。届いたら Claude が選び、透過・大きさ・足元をそろえて組み込む。**届くまでは今の CSS の絵のまま動く**（`remake/js/minigames/tetsuko-art.js` の `ART_READY` に届いた素材を書くと、その素材だけ差し替わる）。

仕様と遊びの正本は [docs/spec/tetsuko_time.md](../../docs/spec/tetsuko_time.md)。画面の設計（v2）は同じ文書の「6. UI の本格化（v2）」。

Codex への依頼（2026-11-06）: 背景 #2689・猫のしぐさ #2690・小物と UI 部品 #2691。原画はこのフォルダの `originals/` に届く。

## 方針（なぜこの見た目か）

- **画面の物はすべて「mukai の裏口にある物」。** 背景は裏口そのもの。小物はムカイさんが店の奥から出してきた物・ましろちゃんが持ってきた物。UI は「はじめの手元」（なでる手・猫じゃらし・ブラシ・小皿）と「てつこ手帳」（ましろちゃんが店に置いている、てつこの記録帳）と「写真」（はじめのスマホで撮ってプリントしたチェキ風の写真）。
- **猫は既存の立ち絵と同じ猫・同じ描き手。** 柄・顔・耳・目の色・体格を変えない（#2454 §11）。別の猫・一般の茶トラを使わない。表情4枚（#2435）は会話用なのでそのまま。ここで作るのは**ふれあい用のしぐさ**（姿勢の違う絵）だけ。
- **背景は背景の規格**（[docs/background_standard.md](../../docs/background_standard.md)）、**UI は日常の紙×ラベンダー＋琥珀**（[UIテーマ](../../docs/spec/ui_paper_lavender.md)・原画 `asset_sources/ui/paper-20261031/`）にそろえる。
- **AIっぽさを避ける**（[素材規約](../../docs/asset_ai_guidance.md) の納品前チェック）。テカり・グロー・エアブラシの毛・量産型の可愛い猫顔・擬似文字を描かない。
- **シーシャ機材は描かない。** 裏口の背景・小物・UI のどれにも、シーシャ台・ハガル・HMD・炭・ホースを入れない（機材の必須手順が要らない題材にする）。

## 一覧

採用後の保存先: 背景は `assets/backgrounds/`、猫・小物・UI は `assets/ui/tetsuko/`（実行時は `remake/img/ui/tetsuko/` の WebP）。原画は `asset_sources/tetsuko-care/originals/`。
「段」は優先度。**A を先に**。A が揃えば画面の見た目はほぼ置き換わる。

### 背景（2枚・A）

| ID | ファイル名 | サイズ | 中身 |
|---|---|---|---|
| TKT-BG01 | `bg_mukai_backdoor_day.png` | 1920×1080・不透過（生成は 2048×1152 以上） | mukai が入っている古い細長いビルの裏。静かな路地に面した裏口の一角を、座った人の目の高さから見る。昼 |
| TKT-BG02 | `bg_mukai_backdoor_night.png` | 同上 | 同じ場所・同じ構図の夜。戸の上の小さな灯りがついている。真っ黒にしない |

構図（ゲームの小物と猫を重ねる位置。1920×1080 での目安）:
- **左 0〜20%**: 裏口の戸（青灰色に塗った古い鉄の戸、小さな窓。戸の上に小さな灯り）。
- **左 13〜38%**: 戸の右の壁ぎわに木のベンチ。**座面の上端は高さの約60%（y≈650）**。座面の上には何も置かない（ゲームが座布団・箱・猫を置く）。
- **中央 45〜70%・下 65〜85%**: 何も置かない平らなコンクリートの地面（ゲームが箱・ボール・爪とぎ・トンネルを置く）。
- **右 70〜90%・下 65〜85%**: ひさしの下の、地面が乾いた角。ここも空ける（ゲームが猫ベッドを置く）。右の端には、ムカイさんの珈琲豆の空き麻袋を2〜3枚たたんで重ねた物と、木の箱を一つだけ（珈琲好きの店の裏らしさ）。
- **右上 65〜100%・上 0〜40%**: 路地の奥と空。細かい描き込みを控え、明暗の差を小さく（ゲームが道具のボタンと今日の様子の札を置く）。
- **下 0〜15%**: 地面だけ（ゲームが操作の帯を置く）。
- 植物は置かない（店の理由がない）。換気扇の外機・縦の排水管くらいはよい。猫・人・小物（箱・ボール・座布団・猫ベッド・皿）・シーシャ機材・文字・看板の字は描かない。

### 猫のしぐさ（A 8枚・B 4枚）

すべて同じ猫・同じ画風・**1回の生成で1つのしぐさ**。背景は単色マゼンタ（#FF00FF）、床・影・小物なし。猫の長い辺が1000px以上。
届いたら Claude が透過にし、**既存の立ち絵と同じ縮尺（顔の幅が `chr_tetsuko_normal.png` の約150pxと同じ）**にそろえて、1024×768 の透明な画面の中央下（体が地面に触れる線 y=736、体の中心 x=512）に置く。

| ID | 段 | ファイル名 | しぐさ | 使う場面 |
|---|---|---|---|---|
| TKT-CAT01 | A | `cat_loaf.png` | 香箱座り。前足を胸の下にたたみ、目を半分閉じて落ち着いている。体はやや左向きの斜め | 落ち着く・座布団の上・様子見の段階の待機 |
| TKT-CAT02 | A | `cat_crouch.png` | 狙う。前を低く、後ろを少し上げ、右上の獲物を目を見開いて見る。しっぽは低く | 猫じゃらしの2回目（身を低くする） |
| TKT-CAT03 | A | `cat_reach.png` | 座ったまま片方の前足を右上へ伸ばして、何かをはたこうとする。指が開く | 猫じゃらしの3回目以降・ブラシを追う・ボールを転がす |
| TKT-CAT04 | A | `cat_hug.png` | 横向きに寝転び、前足2本を胸の前でそろえて何かを抱えこむ形（**おもちゃは描かない**。ゲームが描く）。後ろ足は蹴る前に縮める。目は丸く楽しそう | じゃらしを抱える |
| TKT-CAT05 | A | `cat_groom.png` | 座って、持ち上げた前足をなめる。目を閉じる | 毛づくろい・おやつの後に顔を洗う |
| TKT-CAT06 | A | `cat_yawn.png` | 座って大あくび。口を大きく開け、目をぎゅっと閉じる。小さな牙と桃色の舌。耳は少し後ろ | あくび |
| TKT-CAT07 | A | `cat_belly.png` | へそ天で寝る。仰向けでお腹を見せ、前足をゆるく上へ折り、後ろ足を開く。顔は横へ傾き、目を閉じる（変な寝相） | 変な寝相・お腹を見せて寝る |
| TKT-CAT08 | A | `cat_rub.png` | 横向きで左へ歩きながら、頬と頭の横を前へ押しつける（見えない足にすりすり）。目を閉じて気持ちよさそう。しっぽはまっすぐ上で先だけ曲がる | 初めてすりすり・気を許した段階のなでる |
| TKT-CAT09 | B | `cat_walk_a.png` | 横向きで左へ歩く。一歩目 | 居場所を移るとき（2枚を交互に） |
| TKT-CAT10 | B | `cat_walk_b.png` | 同じ大きさ・同じ足元で二歩目（足の位置だけ違う） | 同上 |
| TKT-CAT11 | B | `cat_lookback.png` | 座って、肩越しに左上（裏口の戸）を振り返る | 戸を見る・ましろちゃんが通る |
| TKT-CAT12 | B | `cat_stretch.png` | 前足を前へ伸ばしてお尻を上げる大きな伸び | 起きたとき・見送りの前 |

座る・笑う・驚く・寝る（丸くなる）の4つは、既存の立ち絵（`chr_tetsuko_{normal,smile,serious,surprise,sleep}.png`）をそのまま使う。

### 小物（A 9点・B 1点）

猫と同じ描き手（輪郭線・2〜3段の影）。少し上から（約15°）見た正面。背景は単色マゼンタ（#FF00FF）、床・影なし。箱・トンネル・ベッドは、猫が中に入ったときに手前の縁が猫に重なるよう、Claude が**手前の壁・縁だけを別の層に切り分ける**ので、口（開いた部分）と手前の面の境目をはっきり描く。

| ID | 段 | ファイル名 | 中身 | 原画の大きさの目安 |
|---|---|---|---|---|
| TKT-PROP01 | A | `prop_box.png` | 開いた段ボール箱（ふたの4枚が外へ開く）。少し使い込んで角がへこむ。側面に貼られた紙のテープ。文字・印刷・ロゴなし | 1536×1024 |
| TKT-PROP02 | A | `prop_ball.png` | 猫用の小さな毛糸玉のボール（赤みの橙）。鈴なし | 512×512 |
| TKT-PROP03 | A | `prop_cushion.png` | 角の房のついた四角い座布団（くすんだからし色。mukai の青灰色の壁・オリーブの長椅子に合う色） | 1536×768 |
| TKT-PROP04 | A | `prop_scratcher.png` | 段ボールの爪とぎ（平たい箱に、波板の段ボールを詰めたもの）。少し引っかき傷 | 1536×576 |
| TKT-PROP05 | A | `prop_tunnel.png` | 布の猫用トンネル（短く、青緑。手前の口が斜めにこちらを向く。輪の骨が見える） | 1536×768 |
| TKT-PROP06 | A | `prop_bed.png` | 丸いふかふかの猫ベッド（ドーナツ形・生成りとベージュ）。新品できれい | 1536×768 |
| TKT-PROP07 | A | `prop_plate_full.png` / `prop_plate_empty.png` | 白い小さな陶器の小皿。full は猫用のおやつ（ささみを細く裂いたもの）が少し、empty は空でうっすら跡。同じ皿・同じ大きさで2枚 | 各768×384 |
| TKT-PROP08 | A | `prop_teaser_tip.png` / `prop_teaser_stick.png` | 猫じゃらし。tip はふわふわの羽と毛の先（琥珀と生成り）だけ、stick は細い竹の棒だけ（まっすぐ横向き）。ゲームが棒を伸ばして先を動かす | tip 512×512・stick 1536×128 |
| TKT-PROP09 | A | `prop_brush.png` | 猫用の木の持ち手のブラシ（スリッカー）。ブラシをかけるときの手元の道具として、斜め上から | 768×768 |
| TKT-PROP10 | B | `prop_lap.png` | はじめの膝（一人称。座って見下ろした自分の両膝。濃い色の作業ズボン）。てつこが膝に乗るときの下敷き。服の色は `assets/sprites/characters/hajime/chr_hajime_normal.png` に合わせる | 2048×768 |

### UI の部品（A 6点・B 2点）

日常の紙×ラベンダー＋琥珀と同じ紙（`asset_sources/ui/paper-20261031/prompts/style.txt`）。文字・数字・擬似文字なし（コードが載せる）。背景は単色マゼンタ（#FF00FF。紙UIの生成で透過が使えなかったため、こちらで抜く）。

| ID | 段 | ファイル名 | 中身 | 大きさ |
|---|---|---|---|---|
| TKT-UI01 | A | `ui_icons.png` | アイコン10個のシート（5列×2行、各256px のマス。マスの間は空ける）。ラベンダーの墨の線＋少しの琥珀。上段: なでる手（開いた手のひら）・猫じゃらし・ブラシ・小皿（おやつ）・座って見守る（ベンチと座布団）。下段: 止める（握った手）・もようがえ（段ボール箱）・てつこ手帳（肉球の判の付いた手帳）・写真（小さなインスタントカメラ）・帰る（裏口の戸） | 1280×512 |
| TKT-UI02 | A | `ui_notebook.png` | 見開きの手帳（クラフト紙の表紙の縁がのぞく、生成りの中紙、真ん中のとじ目）。左右とも中は無地（ゲームが写真と札を並べる）。左上に小さなラベンダーのマスキングテープ1枚 | 2048×1280 |
| TKT-UI03 | A | `ui_photo_frame.png` / `ui_tape.png` | 写真の枠: インスタント写真の白い縁（下が広い）。窓は単色マゼンタ（抜いて写真を入れる）。テープ: ラベンダーの半透明に見えるマスキングテープの切れ端（両端がぎざぎざ） | 枠 768×896・テープ 512×160 |
| TKT-UI04 | A | `ui_memo.png` | 今日の様子を書く札: 生成りの小さな紙片をラベンダーのテープで留めたもの。中は無地 | 1024×320 |
| TKT-UI05 | A | `ui_paw_stamp.png` | ラベンダーのインクで押した肉球の判（少しかすれ、少し傾く） | 256×256 |
| TKT-UI06 | A | `ui_caption.png` | 反応の一行を載せる帯: 生成りの紙の細長い帯、左右の端は手でちぎった形。中央は無地。**九分割（左右96px・上下40px）** | 1536×192 |
| TKT-UI07 | B | `ui_toolbox.png` | もようがえの道具箱: 浅い木の箱を上から見た、横長の引き出し（内側は無地の板）。**九分割（左右96px・上下64px）** | 1600×400 |
| TKT-UI08 | B | `ui_button.png` / `ui_button_pressed.png` | 操作のボタンの台: 生成りの紙の丸い札にラベンダーの細い縁。pressed は少し沈んだ影。中は無地（アイコンをコードが載せる） | 各384×384 |

## Codex へ渡す文（コピペ用）

### 背景 TKT-BG01・TKT-BG02

`tools/bg_prompts.txt` の「TK01/2」「TK02/2」をそのまま使う。参照画像として**画風の基準 `assets/backgrounds/bg_street_night.png`（屋外・夜）と `bg_mukai_shop.png`（mukai の店の色）**を渡す。夜は昼の採用画像を「同じ場所・同じ構図」の参照として渡す。

### 猫のしぐさ TKT-CAT01〜12

参照画像（毎回3枚・役割を書く）: ①本人 `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png`（柄・顔・体格・画風）、②同じ描き手の表情 `chr_tetsuko_smile.png`、③寝姿の参考 `chr_tetsuko_sleep.png`（丸くなる体の形と毛の塗り）。横並びのシートにしない。

```
ノベルゲーム「水煙前線」の看板猫てつこの、ふれあい用のしぐさの絵を1枚だけ描いてください。
添付①②③は採用済みのてつこの立ち絵です。同じ猫・同じ描き手で、しぐさ（姿勢）だけを下の指定に変えます。
①は柄・顔・耳・目の色・体格・画風の正本、②は同じ描き手の表情、③は丸くなった体の形と毛の塗りの参考です。

STYLE STANDARD (Tetsuko, shisha-game): draw this cat in exactly the same artist's hand as the attached approved Tetsuko sprites. Japanese 2D visual-novel game art; confident dark brown outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; fur shown as a few grouped tufts at the silhouette edge, never hundreds of thin strands; small catchlights in the eyes only. No airbrush gradients, no rim light or glow, no photographic fur texture, no 3D render, no chibi deformation.
IDENTITY (must match the attachments): Tetsuko, the shop cat of the shisha bar mukai in Tokyo. A bright orange tabby Scottish Fold: small folded ears, a round wide face, a white inverted V on the bridge of the nose, a pink nose, big golden eyes, white chin, chest, belly and paws, broad orange stripes, a thick striped tail. Same body size and proportions as the attachments: chubby and soft, not slim. Do not turn her into a generic orange cat; do not change her markings, ear shape, eye color or face.
FORMAT: one cat, one pose, full body, nothing else. Plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no toys or objects, no text, no watermark. The cat at least 1000 pixels across her longest side, with a small margin around her.

POSE: （下の一覧から1つを貼る）
```

しぐさ（1回に1つ）:

```
TKT-CAT01 cat_loaf.png — Loaf position: lying with all four paws tucked under her chest, eyes half closed, calm and content. Body turned slightly to the viewer's left, three-quarter view.
TKT-CAT02 cat_crouch.png — Hunting crouch: front body low to the ground, hindquarters slightly raised, eyes wide and fixed on a small target to the upper right, ears forward, tail low. Three-quarter view facing right.
TKT-CAT03 cat_reach.png — Sitting upright and stretching one front paw up and forward to the upper right to bat at something, toes spread. The other paw on the ground. Eyes on the paw.
TKT-CAT04 cat_hug.png — Lying on her side, both front paws curled together at her chest as if hugging a small toy, but draw NO toy (the game draws it). Hind legs bunched as if about to kick. Eyes big and playful.
TKT-CAT05 cat_groom.png — Sitting and licking a raised front paw, eyes closed, tongue just visible.
TKT-CAT06 cat_yawn.png — Sitting with a huge yawn: mouth wide open, tiny fangs and pink tongue, eyes squeezed shut, ears slightly back.
TKT-CAT07 cat_belly.png — Sleeping belly-up: on her back showing the white belly, front paws folded loosely in the air, hind legs splayed, face tilted to one side, eyes closed. A funny, relaxed sleeping pose.
TKT-CAT08 cat_rub.png — Side view, walking toward the left and pushing her cheek and the side of her head forward against an unseen leg, eyes closed with pleasure, tail straight up with the tip slightly curled.
TKT-CAT09 cat_walk_a.png — Side view, walking toward the left, first step of a two-frame walk cycle (left front paw forward).
TKT-CAT10 cat_walk_b.png — Exactly the same cat, size and ground line as TKT-CAT09, second step of the walk cycle (right front paw forward). Attach TKT-CAT09 as a fourth reference.
TKT-CAT11 cat_lookback.png — Sitting and looking back over her shoulder toward the upper left, ears turned that way, as if a door just opened.
TKT-CAT12 cat_stretch.png — A big front stretch: front legs reaching forward on the ground, chest low, hindquarters up, tail up, eyes half closed.
```

### 小物 TKT-PROP01〜10

参照画像: ①画風 `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png`（同じ描き手の線と影）、②色 `assets/backgrounds/bg_mukai_shop.png`（mukai の青灰色・オリーブ・木）。

```
ノベルゲーム「水煙前線」の、看板猫てつこと遊ぶ画面に置く小物の絵を1枚だけ描いてください。
置き場所は東京のシーシャバー mukai の裏口（古いビルの裏の静かな路地）。ムカイさんが店の奥から出してきた、ふだん使いの物です。
添付①は同じ画面に出る猫の採用絵（線と影の描き方をそろえる）、②は mukai の店の色（青灰色の壁・オリーブ・木）です。

STYLE: the same artist's hand as the attached Tetsuko sprite: Japanese 2D visual-novel game art, confident dark brown outlines slightly heavier on the outer silhouette, flat local colors with two to three clearly shaped cel-shadow steps, light from the upper left. Honest, slightly used everyday objects with simple shapes. No glossy plastic, no glow, no airbrush, no photographic texture, no 3D render, no cute decorations or bows.
VIEW: a slightly high front view, about 15 degrees from above, as seen by a person sitting on a bench. The object stands on the ground, centered.
FORMAT: one object only, plain solid magenta #FF00FF background (the game keys it out). No floor, no cast shadow, no cat, no text, letters, logos, printing or watermark. For containers (box, tunnel, bed), draw a clear edge between the open mouth/inside and the front wall or rim, because the game cuts the front part into a separate layer so the cat can sit inside.

OBJECT: （下の一覧から1つを貼る）
```

```
TKT-PROP01 prop_box.png 1536x1024 — An open corrugated cardboard box, the four top flaps folded outward, slightly worn with a dented corner, a strip of paper tape on one side. Plain kraft brown, no printing. Big enough for a chubby cat to sit inside.
TKT-PROP02 prop_ball.png 512x512 — A small knitted yarn ball for cats, reddish orange, soft and slightly fuzzy. No bell.
TKT-PROP03 prop_cushion.png 1536x768 — A square Japanese floor cushion (zabuton) with small tassels at the four corners, muted mustard yellow with a simple stitched center.
TKT-PROP04 prop_scratcher.png 1536x576 — A flat corrugated cardboard cat scratcher: a low kraft box packed with corrugated cardboard strips, with a few claw marks.
TKT-PROP05 prop_tunnel.png 1536x768 — A short collapsible fabric cat tunnel in teal, its near opening turned toward the viewer at an angle, the wire rings showing as soft ribs.
TKT-PROP06 prop_bed.png 1536x768 — A round plush donut-shaped cat bed in off-white and beige, new and clean, with a soft raised rim.
TKT-PROP07 prop_plate_full.png and prop_plate_empty.png 768x384 each — A small white ceramic dish. Full: a little shredded plain chicken breast cat treat on it. Empty: the same dish, same size and angle, empty with a faint trace. Make two images.
TKT-PROP08 prop_teaser_tip.png 512x512 and prop_teaser_stick.png 1536x128 — A cat teaser toy in two separate images. Tip: only the fluffy end, a small bundle of feathers and fur in amber and off-white. Stick: only a thin straight bamboo rod, lying perfectly horizontal.
TKT-PROP09 prop_brush.png 768x768 — A cat slicker brush with a wooden handle, seen from slightly above at an angle, as the tool in your hand when brushing a cat.
TKT-PROP10 prop_lap.png 2048x768 — First-person view looking down at your own two knees while sitting on a bench, wearing dark work trousers in the same colors as the attached hajime sprite (attach assets/sprites/characters/hajime/chr_hajime_normal.png for clothing colors only). Only the knees and thighs, no hands, no cat.
```

### UI の部品 TKT-UI01〜08

参照画像: ①紙の基準 `assets/ui/paper/panel.png`（同じ紙・同じラベンダー）、②会話窓 `assets/ui/paper/dialogue.png`（線の太さと煙の小さな曲線）。

```
ノベルゲーム「水煙前線」の、看板猫てつこと遊ぶ画面のUI部品を1枚だけ描いてください。
日常パートのUI（添付①②の紙×ラベンダー）と同じ紙・同じ線で、猫と過ごす画面に合わせて、ましろちゃんが店に置いている「てつこ手帳」や写真の雰囲気を足します。

Style: the "paper goods" of a bright daytime shisha shop in a Japanese pixel-painterly visual novel. The same warm cream paper as the game's shop screen (#f7f3ed), with lavender (#69497e) lines and fills, and only a touch of amber (#d8963f). Keep fine hand-drawn paper fiber and faint print grain. Avoid photo realism, 3D rendering, perspective, drop shadows, strong gradients and neon. Decoration is limited to thin lines and small smoke curls; no medieval ornaments, gears, jewels, lace, ribbons or flowers.
Never bake in any text, letters, logo, digits, gauges or watermark. (Only TKT-UI01 draws icons; the other parts draw no icons or hearts.)
FORMAT: flat, front-facing. Plain solid magenta #FF00FF background around the part (the game keys it out). No drop shadow outside the part. For nine-slice parts, keep all decoration inside the stated border band, keep straight edges parallel to the canvas, and keep the center plain and evenly textured.

PART: （下の一覧から1つを貼る）
```

```
TKT-UI01 ui_icons.png 1280x512 — A sheet of ten simple icons in a 5 x 2 grid of 256 px cells, each icon centered in its cell with empty space between cells, drawn as lavender ink line art with a little amber fill. Top row, left to right: an open hand (petting), a cat teaser wand with a fluffy tip, a cat brush, a small dish with a treat, a bench with a cushion (sitting quietly beside the cat). Bottom row: a gently closed hand (stop), an open cardboard box (rearrange), a small notebook with a paw-print stamp, a small instant camera, a simple back door. No text, no numbers.
TKT-UI02 ui_notebook.png 2048x1280 — An open notebook spread lying flat: off-white inner pages with fine fiber, a kraft paper cover edge peeking out around the pages, a soft center gutter. Both pages completely plain (the game places photos and labels). One small lavender masking tape strip at the top left corner.
TKT-UI03 ui_photo_frame.png 768x896 and ui_tape.png 512x160 — Frame: the white border of an instant photo, wider at the bottom, slightly warm white; the photo window inside is filled with plain solid magenta #FF00FF (the game puts the picture there). Tape: a torn piece of lavender masking tape that looks slightly translucent, with jagged ends. Make two images.
TKT-UI04 ui_memo.png 1024x320 — A small off-white slip of paper stuck on with a short piece of lavender tape at the top, slightly crooked. Plain inside (the game writes one line on it).
TKT-UI05 ui_paw_stamp.png 256x256 — A cat paw-print rubber stamp mark in lavender ink, slightly faded and slightly tilted.
TKT-UI06 ui_caption.png 1536x192 nine-slice (left and right 96 px, top and bottom 40 px) — A long strip of off-white paper with hand-torn left and right ends and a faint lavender line near the top and bottom edges. Plain center.
TKT-UI07 ui_toolbox.png 1600x400 nine-slice (left and right 96 px, top and bottom 64 px) — A shallow wooden tray seen straight from above, like a pulled-out drawer: light worn wood rim, plain board inside.
TKT-UI08 ui_button.png and ui_button_pressed.png 384x384 each — A round cream paper token with a thin lavender rim. Pressed: the same token pressed in, with a shallower inner shadow. Plain center (the game puts an icon on it). Make two images.
```

## 受け取った後（Claude の作業）

1. 原画を `originals/` に置き、SHA-256 と生成の指示をこの README の採用の記録に書く。不採用の候補は `review/` の比較図に残す。
2. 透過: マゼンタを抜き、端のにじみを消す（立ち絵と同じ扱い）。猫は顔の幅で既存の立ち絵と同じ縮尺にそろえ、1024×768 の画面の y=736・x=512 に置く。箱・トンネル・ベッドは手前の壁・縁を `*_front.png` に切り分ける。
3. 背景は規格どおり 1920×1080 へ縮小して `assets/backgrounds/` に置き、`python3 remake/tools/build_manifest.py`・`python3 tools/background_catalog.py sync`。`remake/js/core/data.js` の `BG_TIME_BASE` に `bg_mukai_backdoor` は登録済み。
4. 猫・小物・UI は `assets/ui/tetsuko/` に置き、WebP を `remake/img/ui/tetsuko/` に作る。`remake/js/minigames/tetsuko-art.js` の `ART_READY` に届いた素材の名前を書くと、その素材だけ CSS の絵から差し替わる。
5. PC（1280×720）とスマホ横で、猫の足元・箱の中・ベッドの縁・膝・道具箱・手帳を撮って確かめる。
6. 裏口の背景は、裏口が出てくる会話（`ch3_double_apple` のケースを運ぶ場面・恋人の夜のベンチ・大会前夜の帰り道・てつこの段階会話）にも使えるので、差し替えるかをオーナーに聞く（今回は差し替えない）。
