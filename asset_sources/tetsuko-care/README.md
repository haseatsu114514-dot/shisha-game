# てつこといっしょ（#2454）の画像素材 ── Codex への依頼（2026-11-06・TKT01）

オーナー「UIとかも本格化したい　コーデックスに画像生成依頼を投げてもいいので再度練って」（2026-11-06）。

今のふれあい画面（PR #2679）は、裏口の壁・戸・ベンチ・小物を CSS の四角と丸で描き、猫は会話用の5表情を切り出して CSS で傾けているだけで、「AIが組んだ仮の画面」に見える。そこで**裏口の背景・猫のしぐさ・小物・UI の部品を、手で描いた素材に置き換える**。
数字・名前・文字・ゲージ・猫の動き（移動・揺れ・まばたき・喉の波）は、これまでどおりコードが描く。素材には焼き込まない。

Claude は画像を生成しない。下の「Codex へ渡す文」をそのまま Codex に渡して生成してもらい、原画を `asset_sources/tetsuko-care/originals/` に置いて push してもらう（ギガファイル便でも可。その場合は SHA-256 を添える）。届いたら Claude が選び、透過・大きさ・足元をそろえて組み込む。**届くまでは今の CSS の絵のまま動く**（`remake/js/minigames/tetsuko-art.js` の `ART_READY` に届いた素材を書くと、その素材だけ差し替わる）。

仕様と遊びの正本は [docs/spec/tetsuko_time.md](../../docs/spec/tetsuko_time.md)。画面の設計（v2）は同じ文書の「6. UI の本格化（v2）」。

Codex への依頼（2026-11-06）: 背景 #2689・猫のしぐさ #2690・小物と UI 部品 #2691。原画はこのフォルダの `originals/` に届く。
2026-11-11 の追加の依頼（CSS で描いている部品をなくす・TKT25〜26）は、このファイルの末尾の「CSS で描いている部品をなくす」。

## 方針（なぜこの見た目か）

- **画面の物はすべて「mukai の裏口にある物」。** 背景は裏口そのもの。小物はムカイさんが店の奥から出してきた物・ましろちゃんが持ってきた物。UI は「はじめの手元」（なでる手・猫じゃらし・ブラシ・小皿）と「てつこ手帳」（ましろちゃんが店に置いている、てつこの記録帳）と「写真」（はじめのスマホで撮ってプリントしたチェキ風の写真）。
- **猫は既存の立ち絵と同じ猫・同じ描き手。** 柄・顔・耳・目の色・体格を変えない（#2454 §11）。別の猫・一般の茶トラを使わない。表情4枚（#2435）は会話用なのでそのまま。ここで作るのは**ふれあい用のしぐさ**（姿勢の違う絵）だけ。
- **背景は背景の規格**（[docs/background_standard.md](../../docs/background_standard.md)）、**UI は日常の紙×ラベンダー＋琥珀**（[UIテーマ](../../docs/spec/ui_paper_lavender.md)・原画 `asset_sources/ui/paper-20261031/`）にそろえる。
  - **2026-11-06 変更（#2717）**: この画面の UI は日常の紙×ラベンダーをやめ、専用テーマ「茶トラと段ボール」にした（[仕様 §7](../../docs/spec/tetsuko_time.md)）。下の「UI の部品」の扱いも参照。
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

**専用テーマへの変更後の扱い（#2717・2026-11-06）**: 画面の UI は専用テーマ「茶トラと段ボール」（生成り `#fff5e4`・焦げ茶の線 `#3b2416`・茶トラの橙 `#f08a2e`・段ボール `#c9965c`・戸の青灰 `#4e6b78`。[仕様 §7](../../docs/spec/tetsuko_time.md)）になった。#2691 で届いた原画（PR #2697）を見て、次のように決めた。

| 部品 | 扱い | 理由・組み込む時の色 |
|---|---|---|
| TKT-UI01 アイコン10個 | **使う（色を変える）** | 形は猫の画面に合う。線を焦げ茶 `#3b2416`、琥珀の差し色を茶トラの橙 `#f08a2e` に変えてから切り出す |
| TKT-UI03 のテープ | **使う（色を変える）** | 一色の半透明なので、段ボールのテープ色（`#b8844a` 前後）へ色相を移す |
| TKT-UI05 肉球の判 | **使う（色を変える）** | インクを `#c25e1c` へ |
| TKT-UI02 手帳・TKT-UI03 写真の枠・TKT-UI04 今日の札・TKT-UI06 反応の帯 | **使わない** | ラベンダーの二重線と煙の渦は日常の紙UIの印で、入れると日常の画面に戻って見える。テーマの CSS で描く（`ART_READY.ui` に書かない） |
| TKT-UI07 道具箱・TKT-UI08 ボタンの台（B・未生成） | **頼まない** | テーマの CSS（段ボールのトレー・焦げ茶の線の丸い札）で描く |

手で描いた部品を新テーマで頼み直す時は、下の UI の共通の文の紙×ラベンダーの所を「cream `#fff5e4` paper with thick dark brown `#3b2416` outlines, tabby orange `#f08a2e` accents and kraft cardboard `#c9965c`; no lavender, no smoke curls」に置き換える。

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

（2026-11-06 #2717 以降、この文の紙×ラベンダーは使わない。扱いは上の「専用テーマへの変更後の扱い」。）

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

## #2691 小物・UI 原画の受領記録（Codex A・2026-11-06）

`originals/` に A の小物9グループ（11ファイル）と UI 6グループ（7ファイル）の候補を保存した。箱・トンネル・ベッド・手帳・写真枠・キャプション、皿とアイコンの一部には別候補もある。採用選定と透過・前縁の切り分け・ゲームへの組み込みは Claude 側で行う。

生成時の全プロンプト、参照画像の役割・パス・SHA-256、各PNGのサイズ・SHA-256、視認時の注意点は [原画生成記録](originals/GENERATION.md) を参照。背景のマゼンタは生成後に `#FF00FF` へ色値をそろえた。画像生成時のキャンバス寸法には依頼目安との差があるため、採用時に整える。

## 小物の採用の記録（2026-11-07・TKT13）

司令塔の指示「#2697 の小物の原画を選んで組み込む」。背景（#2695）と猫（#2715）は直し待ちのため触っていない。UI の原画（#2697 の `ui_*`）も今回は組み込んでいない（TKT09 の判断どおり、使うのはアイコン・テープ・肉球の判だけで、色を変えてから）。

**選んだ候補**: すべて正規名（`prop_*.png`）。別候補（`*_candidate*.png`）は採らない。

| 小物 | 採用 | 理由 |
|---|---|---|
| 段ボール箱 | `prop_box.png` | 口と手前の壁の境目がはっきりしていて、手前の層を一本の線で切れる。角のへこみも依頼どおり。`prop_box_candidate2.png` も同じくらい良いが、テープと角の描き込みで正規名を採った |
| 猫ベッド | `prop_bed.png` | 手前の縁が低く、中のクッションに乗った猫が見える。`prop_bed_candidate2.png` は縁が高く均一で、中の猫がほとんど隠れる |
| トンネル | `prop_tunnel.png` | 手前の口が左、奥の口が右。中の猫を隠して奥（右）からしっぽだけ出す今の動きに合う。`prop_tunnel_candidate2.png` は口の向きが逆 |
| 小皿 | `prop_plate_full.png` / `prop_plate_empty.png` | 正規名どうしは同じ皿の形（空は満杯から食べ物だけを消した編集）。`prop_plate_empty_candidate1.png` は皿の形が違うので採らない |
| ボール・座布団・爪とぎ・じゃらしの先と棒・ブラシ | 正規名（候補は1つだけ） | 文字・機材・テカりなし。猫の絵と同じ線と2〜3段の影 |

**切り出し**: `python3 remake/tools/build_tetsuko_art.py`（原画の実体は `git lfs pull --include="asset_sources/tetsuko-care/originals/prop_*"`、約8MB）。
- マゼンタを透過にする（縁3pxだけ、混ざった分を半透明に戻して色を引き戻す。絵の内側は触らない）。余白を切り、画面の大きさの2倍（@2x）へ LANCZOS で縮小（拡大なし）。
- 手前の層: 箱は口の手前の縁（余白で切った後の y=445）から下＝前のふたと前の壁。ベッドは内側のクッションの下の線（3点を通る弧）より手前の毛足の縁。トンネルは分けない（中の猫は隠れる）。
- 皿の満杯と空は同じ切り出し枠にする（おやつの前後で位置が跳ねない）。ブラシは手元のカーソル（48px の PNG）も作る。
- 画面での大きさ（px）: 箱 330×203・ボール 58×60・座布団 250×135・爪とぎ 230×66・トンネル 300×202・ベッド 290×202・皿 140×88・じゃらしの先 76×102。
- 猫の位置: ベッドの中は絵の内側のクッションの高さまで（-22%）、座布団の上は面の上まで（-16%）上げる。箱の中は今までどおり（手前の層が下半分を隠す）。

**採用版**（実行時は同じ名前の `remake/img/ui/tetsuko/*.webp`、合計約280KB）:

| ファイル | 画素 | SHA-256 |
|---|---|---|
| `assets/ui/tetsuko/prop_box.png` | 660×406 | `17586dba0cf27f537f7d9819bdaec980937e5c909425038dcdb91b16d81ae869` |
| `assets/ui/tetsuko/prop_box_front.png` | 660×406 | `d3defb9cf18160d9c795fc7b622d10303a918799215637f3ce53d48930e28334` |
| `assets/ui/tetsuko/prop_ball.png` | 116×119 | `c4e724bedac9356c2413deb2c58ba9dfcdc16f536c08f0db5ae32fc30223a2ec` |
| `assets/ui/tetsuko/prop_cushion.png` | 500×269 | `1275f9caeffef0c212459cdaf11f2519d5051e4124ffdca24154851fca81fd44` |
| `assets/ui/tetsuko/prop_scratcher.png` | 460×132 | `3d6187ee8a3e0c344c73263bfd4b9aaa2d02dda10c6dbb5cda7e16436e4a1058` |
| `assets/ui/tetsuko/prop_tunnel.png` | 600×403 | `62bd8cc1e10e07323f07267ed3b526f7334266fc55a554d6ee5a0d8214419419` |
| `assets/ui/tetsuko/prop_bed.png` | 580×404 | `a8c31e4252b9b8c3da8a3749987429beeb15e1bc6f0b0a422758afcdd1fd9e11` |
| `assets/ui/tetsuko/prop_bed_front.png` | 580×404 | `94e5e931ebb2fe1b1b42a6b85ef385dec80bc7ac52de2509b7eeddac0de28068` |
| `assets/ui/tetsuko/prop_plate_full.png` | 280×175 | `905861f00490c9940b771b3bb989022aebfba02f2f5bc3e250c86a0b9dbbecba` |
| `assets/ui/tetsuko/prop_plate_empty.png` | 280×175 | `f0cba2815ea510a54b64c0d2a641e914137ecbfbf0fd6df2a3311825538bb080` |
| `assets/ui/tetsuko/prop_teaser_tip.png` | 152×205 | `be7b904ab768b4c918617f9cbccb9c6adec43e197ecc94294d95f1ae4ce2b94f` |
| `assets/ui/tetsuko/prop_teaser_stick.png` | 1200×46 | `f143b953b07b5cc95bf831c31d972ee5be1b462f61cbd9374b12df511b320ee1` |
| `assets/ui/tetsuko/prop_brush.png` | 240×298 | `bc6dff1f84849ebfa343dc0daabbfab84821f1b99fa4eb3e8678ef7f3c2e67d2` |

元の原画の SHA-256 は [原画生成記録](originals/GENERATION.md) の表と同じ（例: `prop_bed.png` `0c036f35…`、`prop_ball.png` `c17b8e7b…`）。
`remake/js/minigames/tetsuko-art.js` の `ART_READY.props` に box・ball・cushion・scratcher・tunnel・bed・plate・teaser・brush を書いた。lap（はじめの膝・B）は未生成なので CSS のまま。

## CSS で描いている部品をなくす（2026-11-11・TKT25〜26）

オーナー「CSS丸出しのパーツは無くしたい　代わりにイシューにコーデックスで画像生成依頼を投げて何か生成して」（2026-11-11）。

Codex への依頼: UI の部品 #3213（TKT25）・場面と猫 #3214（TKT26）。

手応えの作り直し（[仕様 §10](../../docs/spec/tetsuko_time.md)）の後も、画面の部品の多くは CSS の丸・四角・グラデーションと、細い線の SVG アイコンで描いている。採用済みの絵は小物9点（TKT13）だけ。残りを、**専用テーマ「茶トラと段ボール」**（仕様 §7）の手描きの部品と、猫・場面の絵に置き換える。

### いま CSS・SVG で描いている物と、置き換える絵

| 画面の物（CSS のクラス） | 置き換える絵 | 依頼 |
|---|---|---|
| 手元の道具・上の道具・おねだり・「？」の中のアイコン（`ICONS` の SVG） | `ui_tk_icons.png` | TKT25 |
| 手元の道具の丸い札（`.tt-act-token`）・写真のカメラ（`.tt-shot`） | `ui_tk_token*.png` | TKT25 |
| 上の道具の札（`.tt-tool`）・帰る | `ui_tk_tab*.png` | TKT25 |
| ごきげんのハート（`.tt-heart` の SVG）とハートの台（`.tt-joy`） | `ui_tk_heart*.png`・`ui_tk_pill.png` | TKT25 |
| おねだりの吹き出し（`.tt-wish`） | `ui_tk_wish.png` | TKT25 |
| 反応の帯（`.tt-caption`。左端の茶トラのしま） | `ui_tk_caption.png` | TKT25 |
| 題の札（`.tt-logo`。折れ耳・肉球の丸・しま） | `ui_tk_title.png` | TKT25 |
| 小さな粒（♥・✦・♪ の文字、汗・毛・肉球・喉の波の CSS） | `ui_tk_fx.png` | TKT25 |
| もようがえのトレー（`.tt-drawer`）・小物の札（`.tt-item`）・手帳の札（`.tt-card`） | `ui_tk_tray.png`・`ui_tk_card.png` | TKT25（B） |
| あそびかたの紙（`.tt-help-card`） | `ui_tk_panel.png` | TKT25（B） |
| てつこ手帳の見開き（`.tt-book-spread`）・写真の額（`.tt-polaroid`）・テープ | `ui_tk_book*.png`・`ui_tk_photo.png`・`ui_tk_tape.png` | TKT25（B） |
| 段ボールの外枠（SVG）・入る時の箱のふた（`.tt-intro-flap`）・封のテープ | `ui_tk_frame.png`・`ui_tk_flap.png`・`ui_tk_packtape.png` | TKT25（B） |
| はじめの膝（`.tt-lap`。青い楕円） | `prop_lap.png`（TKT-PROP10） | TKT26 |
| トンネルから出るしっぽ（`.tt-prop-tail`。しまの四角） | `prop_tunnel_tail.png` | TKT26 |
| 跳ぶ・空振り・鳴く・つつく（立ち絵を CSS で縮めて傾けている） | `cat_leap`・`cat_flop`・`cat_mew`・`cat_poke` | TKT26 |
| 歩く・振り返る・伸び（#2690 の B 段・未生成） | `cat_walk_a`・`cat_walk_b`・`cat_lookback`・`cat_stretch` | TKT26（#2690 から移す） |
| 香箱・狙う・前足・抱える・毛づくろい・あくび・へそ天・すりすり（へそ天は今、立ち絵を上下逆さにしている） | #2690 の A 段の候補（PR #2715） | Claude が検品して採否を決める（背景のマゼンタのずれは Claude 側で抜けるので、そのための作り直しは頼まない） |
| 裏口の壁・戸・ベンチ・地面（`.tt-set`） | `bg_mukai_backdoor_{day,night}`（#2689・候補は PR #2695） | 候補が 1672×941 で、背景の規格（生成 2048×1152 以上・拡大しない）に届かず止まっている。オーナー判断待ち |

**絵にしない物**: 擬音（「ごろごろ」など）・数字・名前・反応の文（コードの文字）、猫の足元の影・とっておきの光（光の表現）、動き（跳ぶ・揺れる・ハートが飛ぶ）。

### UI の部品 TKT25（茶トラと段ボール）

保存名は `ui_tk_*.png`（受け取り後、`assets/ui/tetsuko/` と `remake/img/ui/tetsuko/ui_tk_*.webp`。`tetsuko-art.js` の `ART_READY.ui` に `tk_icons` のように書く）。大きさは画面の大きさの約2倍。九分割の物は、飾りを縁の帯の中だけに置き、真ん中は無地で均一にする。

参照画像（毎回・役割を書く）: ①線と段ボールの描き方 `assets/ui/tetsuko/prop_box.png`（採用済みの小物。同じ描き手）、②色と線 `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png`（茶トラの橙・胸の白・焦げ茶の輪郭）。

```
ノベルゲーム「水煙前線」の、看板猫てつこと遊ぶミニゲーム画面のUI部品を1枚だけ描いてください。
画面のテーマは「茶トラと段ボール」です。色は、てつこ本人（茶トラの橙・胸の白・輪郭の焦げ茶・鼻の桃色）と段ボールから取ります。
添付①は同じ画面に置いてある採用済みの段ボール箱（線と段ボールの描き方の正本）、②はてつこの立ち絵（色と線の正本）です。

STYLE: hand-drawn game UI in the same artist's hand as the attached cardboard box and Tetsuko sprite. Cream paper #fff5e4 surfaces with thick confident dark brown #3b2416 outlines (about 6 px at this size), tabby orange #f08a2e and deep orange #c25e1c accents, kraft cardboard #c9965c with faint corrugation and fiber, the back-door blue-grey #4e6b78 only where asked, and a touch of nose pink #f39aa6. Flat colors with one or two clean cel-shadow steps, light from the upper left. Warm, cozy and a little handmade, like stickers and cut cardboard. No lavender, no smoke curls, no glossy plastic, no glow, no airbrush gradients, no 3D render, no photo texture.
Never bake in any text, letters, digits, logo or watermark (the game writes all text). No cat face drawn inside the parts unless asked.
FORMAT: flat and front-facing. Plain solid magenta #FF00FF background around the part (the game keys it out); keep the magenta exactly #FF00FF. No drop shadow outside the part. For nine-slice parts, keep every decoration inside the stated border band, keep straight edges parallel to the canvas, and keep the center plain and evenly textured.

PART: （下の一覧から1つを貼る）
```

```
TK-UI01 ui_tk_icons.png 1536x512 — A sheet of twelve simple icons in a 6 x 2 grid of 256 px cells, each icon centered in its cell with plenty of empty magenta between cells. Thick dark brown outlines with tabby orange and cream fills, the same look in every cell. Top row, left to right: an open hand palm (petting), a cat teaser wand with a fluffy feather tip, a cat slicker brush with a wooden handle, a small white dish with a treat, an open cardboard box (rearranging), a small notebook with a paw-print stamp on the cover. Bottom row: a small instant camera, a simple back door with a small window, a heart, a round thought bubble with three dots inside, a fingertip gently tapping a small box, a person sitting on a bench seen from the side (sitting quietly). No text.
TK-UI02 ui_tk_token.png, ui_tk_token_pressed.png and ui_tk_token_active.png 384x384 each — A round button token about 320 px across, centered. Normal: cream paper face, thick dark brown rim, a solid dark brown "drop" under the bottom edge so it looks like a thick sticker standing up. Pressed: the same token pushed down, the drop almost gone. Active (the tool in hand): the face filled tabby orange with a few soft stripes near the rim, and two small folded cat ears on the top edge, like Tetsuko's head seen from the front. Plain center in all three (the game puts an icon on it). Make three images with exactly the same size and position.
TK-UI03 ui_tk_tab.png, ui_tk_tab_pressed.png and ui_tk_tab_door.png 512x384 each, nine-slice (72 px border on all sides) — A rounded-rectangle paper tab: cream face, thick dark brown outline, a solid dark brown drop under the bottom edge. Pressed: pushed down, drop almost gone. Door: the same tab painted like an old blue-grey #4e6b78 metal back door with a few scuffs. Plain center.
TK-UI04 ui_tk_heart.png and ui_tk_heart_empty.png 160x160 each — A plump hand-drawn heart about 140 px wide, thick dark brown outline. Full: warm pink-red fill with one small highlight. Empty: exactly the same outline and position, cream fill. The game reveals the full heart over the empty one from the bottom up, so both must line up perfectly.
TK-UI05 ui_tk_pill.png 512x160, nine-slice (72 px left and right, 56 px top and bottom) — A rounded pill-shaped cream holder with a thick dark brown outline and a dark brown drop under it, for a row of hearts. Plain inside.
TK-UI06 ui_tk_wish.png 384x320 — A round cream speech bubble that a cat "thinks" with, thick dark brown outline, a short pointed tail at the bottom right, a soft drop under it. Plain inside (the game puts an icon in it).
TK-UI07 ui_tk_caption.png 1536x256, nine-slice (left 112 px, right 56 px, top and bottom 56 px) — A long cream paper strip with rounded corners and a thick dark brown outline, a dark brown drop under it, and on the left end a band of tabby orange and deep orange stripes (the band fits inside the left 112 px). Plain center for one line of text.
TK-UI08 ui_tk_title.png 768x224 — A blank title plate: a rounded cream plate with a thick dark brown outline and drop, two small folded tabby cat ears sticking up from the top edge, a round tabby orange medallion with a cream paw print at the left end (inside the left 200 px), and a thin band of tabby stripes along the bottom edge. The middle stays plain (the game writes the title).
TK-UI09 ui_tk_fx.png 1024x512 — A sheet of eight small effect marks in a 4 x 2 grid of 256 px cells, each centered, thick dark brown outlines: a small pink heart, a four-point yellow sparkle, a cream music note, a light blue sweat drop, a little tuft of orange and white cat fur, a cream paw print, three short curved lines like a purring vibration, a small grumpy puff of air. No text, no letters.
TK-UI10 (B) ui_tk_tray.png 1600x400, nine-slice (96 px left and right, 80 px top and bottom) — A shallow open cardboard tray seen from above, kraft cardboard with a dark brown outline and visible corrugated edges, plain flat bottom inside.
TK-UI11 (B) ui_tk_card.png 384x384, nine-slice (64 px) — A small cream paper card with rounded corners, thick dark brown outline and a small drop. Plain center.
TK-UI12 (B) ui_tk_panel.png 1536x1024, nine-slice (112 px) — A large cream paper sheet with rounded corners, thick dark brown outline and drop, a few faint paper fibers. Plain center.
TK-UI13 (B) ui_tk_book.png 2048x1024, nine-slice (128 px), and ui_tk_book_spine.png 96x1024 — Book: an open notebook lying flat, kraft cardboard cover showing as a border around two cream pages, faint ruled lines, no spine in the middle (keep the center plain). Spine: only the middle binding strip, tabby orange and deep orange cloth stripes with a dark brown outline, seamless when tiled vertically. Make two images.
TK-UI14 (B) ui_tk_photo.png 768x896 and ui_tk_tape.png 512x160 — Photo: the white border of an instant photo, wider at the bottom, warm white with a dark brown outline; the window inside is plain solid magenta #FF00FF. Tape: a torn piece of kraft paper tape, slightly see-through looking, jagged ends. Make two images.
TK-UI15 (B) ui_tk_frame.png 1024x576, nine-slice (48 px) — A window cut out of a cardboard sheet: a 48 px band of kraft cardboard around the edge with rounded inner corners, the cut edge showing the wavy corrugated layer; the whole inside is plain solid magenta #FF00FF.
TK-UI16 (B) ui_tk_flap.png 1024x1152 and ui_tk_packtape.png 256x1152 — Flap: one closed cardboard box flap filling the image, kraft cardboard with fiber, a faint stamped paw print, no text. Tape: a vertical strip of shiny-free brown packing tape, seamless when tiled vertically. Make two images.
```

### 場面と猫 TKT26

- 膝・しっぽ: 下の文。参照は①画風 `assets/sprites/characters/tetsuko/chr_tetsuko_normal.png`、膝は②服の色 `assets/sprites/characters/hajime/chr_hajime_normal.png`（服の色だけ）、しっぽは②トンネル `assets/ui/tetsuko/prop_tunnel.png`（採用済み。奥の口の向きと大きさを合わせる）。
- 猫のしぐさ: 上の「猫のしぐさ TKT-CAT01〜12」の共通の文（参照の3枚と STYLE STANDARD・IDENTITY・FORMAT）をそのまま使い、POSE だけ下の物を貼る。B 段の TKT-CAT09〜12 も同じ文で頼む。

```
TK-SC01 prop_lap.png 2048x768 — First-person view looking down at your own two knees while sitting on a bench, wearing dark work trousers in the same colors as the attached hajime sprite (use it for clothing colors only). Only the knees and the tops of the thighs side by side, a soft dip between them where a cat can curl up; no hands, no cat, no bench. Same artist's hand as the attached Tetsuko sprite (dark brown outlines, two to three cel-shadow steps). Plain solid magenta #FF00FF background, no floor, no text.
TK-SC02 prop_tunnel_tail.png 512x512 — Only Tetsuko's thick striped orange tail, sticking out of a round dark opening and curling upward at the tip, as if she is hiding inside a cat tunnel. Match her tail stripes in the attached sprite. Draw the tail only from the point where it leaves the opening; no tunnel, no body. Plain solid magenta #FF00FF background.
```

```
TKT-CAT13 cat_leap.png — Mid-air pounce seen from the side, facing right: the whole body stretched long, front legs reaching forward and up with toes spread, hind legs extended back, tail streaming behind, eyes wide and focused, ears forward. No ground.
TKT-CAT14 cat_flop.png — Just landed after missing a pounce: sprawled on her belly, front legs splayed forward, hind legs tucked, looking back over her shoulder with a slightly ruffled, "that didn't happen" expression. Side view facing right.
TKT-CAT15 cat_mew.png — Sitting upright and looking up at the viewer, mouth open in a short soft meow (small fangs, pink tongue), ears up, eyes round.
TKT-CAT16 cat_poke.png — Sitting and lifting one front paw toward the viewer to poke, the pink paw pads clearly visible, head tilted a little, eyes curious.
```

**納品**（TKT25・TKT26 とも）: 候補の原画を `asset_sources/tetsuko-care/originals/` に置き、PR にする。生成の指示と参照画像のパス・SHA-256 を `originals/GENERATION.md` に追記する。1回の生成で1点（アイコン・粒のシートは1枚で12個・8個）。**透過・切り分け・ゲームへの組み込みはしない**（Claude が選び、マゼンタを抜いて組み込む）。

**受け取った後（Claude）**: マゼンタを抜く（`remake/tools/build_tetsuko_art.py` の流儀）→ `assets/ui/tetsuko/` と WebP → `ART_READY` に名前を書き、その部品の CSS の描画を消す（`[data-art-ui~="tk_…"]` の時だけ絵を使う。届いていない物は今の CSS のまま動く）→ PC とスマホ横で撮って確かめる。スマホ横の下限（文字 実寸11px・押せる所 実寸38px）は絵にしても守る。

## TKT25・26 の採用の記録（2026-11-11）

#3213（UI の部品・A 段）と #3214（場面と猫）の原画を、Codex がオーナー経由（zip）で届けた。`originals/` に置き、生成の指示・参照・SHA-256 は `originals/GENERATION.md` の「Issue #3213 …別の生成」「Issue #3214」の節（Codex の記録をそのまま追記）。

**#3213 は2回分ある**: Codex の PR #3223（マージ済み）が正規名 `ui_tk_*.png` で、依頼どおりの画素数・ちょうどの #FF00FF の原画を入れていた。オーナー経由の zip は別の生成で、大きめの原画（1254〜2172px）。zip の方を `ui_tk_*_candidate2.png` に改名して並べて保存し（不採用の戸は `ui_tk_tab_door_candidate3.png`）、**画面には candidate2 を使った**。理由: 手描きの細部（ちぎれた段ボールの縁・テープ・札の角の飾り）が多く、茶トラと段ボールの画面に合う。持っている道具の札（active）は、#3223 版は顔全体が茶トラのしまで札の上のアイコンが読みにくいが、candidate2 は縁だけがしまで中が無地。原画が大きいので縮めた絵もきれい。#3223 版は消さずに残す（比べ直す時のため）。

**選んだ物**: zip のすべての正規の候補を採用した。`ui_tk_tab_door_candidate3.png`（元の名前は candidate1。ほぼ生成りで、青灰が小さな札だけ）は Codex の記録どおり不採用。B 段（トレー・札・紙・手帳・写真の額・外枠・箱のふた）と、#2690 の B 段（歩く・振り返る・伸び）は届いていない（CSS のまま）。

**切り出し**: `python3 remake/tools/build_tetsuko_art.py ui cats scene`（原画の実体は `git lfs pull --include="asset_sources/tetsuko-care/originals/ui_tk_*_candidate2.png,asset_sources/tetsuko-care/originals/cat_*,asset_sources/tetsuko-care/originals/prop_lap.png,asset_sources/tetsuko-care/originals/prop_tunnel_tail.png"`、約30MB）。
- 背景のマゼンタが #FF00FF ちょうどでなく (236,22,237)〜(244,14,243) と揺れるので、原画の周りの帯から背景の色を測り、その色からの近さで抜いた（`key_tolerant`。縁は測った色との混ざりを戻す）。抜いた後、絵の中にマゼンタの画素は残っていない。
- 組の部品（札の3状態・ハートの満と空）は同じ切り出し枠にした（重ねても形がずれない）。アイコン（6×2）と粒（4×2）はシートを1つずつ切り出し、128px の正方形に置いた（`ui_tk_icon_*`・`ui_tk_fx_*`）。
- 猫のしぐさは、顔の幅（頬から頬）を立ち絵 `chr_tetsuko_normal.png` の約160pxにそろえ、1024×768 の画面の中央下（足元 y=736）に置いた。原画の顔の幅: 跳ぶ 370・空振り 420・鳴く 500・つつく 525px。
- 膝は画面の幅 560px、しっぽは 120px の2倍で書き出した。

**画面での使い方**（`ART_READY` に名前を書き、CSS の描画を絵に替えた）: 手元の道具の丸い札（持っている道具は折れ耳の札）・カメラ・「？」の丸 → `tk_token`、上の道具の札・帰る → `tk_tab`、ごきげんのハートと台 → `tk_heart`・`tk_pill`、おねだりの吹き出し → `tk_wish`、反応の帯 → `tk_caption`（九分割）、題の札 → `tk_title`、アイコン → `tk_icons`、粒・喉の波・なでた時の ♡ → `tk_fx`（「ぷいっ」の鼻息は粒の絵がある時だけ出す）。跳ぶ・空振り・鳴く・つつく → しぐさの絵（鳴く・つつくは一瞬で表情の絵に戻す）、膝・トンネルのしっぽ → 小物の絵。

**採用版**（実行時は同じ名前の `remake/img/ui/tetsuko/*.webp`。アイコン12枚・粒8枚は `ui_tk_icon_*`・`ui_tk_fx_*` の 128×128）:

| ファイル | 画素 | SHA-256 |
|---|---|---|
| `assets/ui/tetsuko/ui_tk_token.png` | 320×341 | `29e97a7c2c1266203c72b7390693036c906db0568940f3495b8725cf51068845` |
| `assets/ui/tetsuko/ui_tk_token_pressed.png` | 320×341 | `48e3d885ce66c2cba63293ac8790b458dd1aeffd40d29bfbfa461805387393b7` |
| `assets/ui/tetsuko/ui_tk_token_active.png` | 320×341 | `9db2e222ec9202f3aa3727ae8edc8db6c0daf693b7543f25c06f3979c803e1dd` |
| `assets/ui/tetsuko/ui_tk_tab.png` | 360×258 | `bb9a7febd4e7f0ba6648270317ef90754e034074fa2d48c2ed1570f81cbc815d` |
| `assets/ui/tetsuko/ui_tk_tab_pressed.png` | 360×258 | `6111bf0ee5957ec9444358a02e781f1d9bfe2e5e378cd2a08e804323641f0ae9` |
| `assets/ui/tetsuko/ui_tk_tab_door.png` | 360×258 | `39d26fd0324f346ef5e7db804f9b32c6fb55a2f24895f3ab9ed1a04f04c15194` |
| `assets/ui/tetsuko/ui_tk_heart.png` | 112×99 | `29db44c99168105980db4ef50bfb0919e635dad6099f9edfd7df3f3375d52c8c` |
| `assets/ui/tetsuko/ui_tk_heart_empty.png` | 112×99 | `d199532ddf7a3404a860b64d754f01bb3fc78fefce3fef0c90064c9dfae73084` |
| `assets/ui/tetsuko/ui_tk_pill.png` | 480×132 | `136ba67786b33f6a6b406892999d0f106fc2b7fa8b46a3219834ae338448c251` |
| `assets/ui/tetsuko/ui_tk_wish.png` | 240×208 | `65fe26e2a48796a867df57229185b995742388e4750061432f315608f43f0491` |
| `assets/ui/tetsuko/ui_tk_caption.png` | 1200×191 | `30649d1ef9b25345cb0e262d2051b7fc311397a1a75f849e933895ad230a4709` |
| `assets/ui/tetsuko/ui_tk_title.png` | 720×217 | `7c6f9c1e8303fee940a419bc249217747a4733216cc5620c8c57a585d7092178` |
| `assets/ui/tetsuko/cat_leap.png` | 1024×768 | `6e32223f7f27afe84d4e7843b977df22327a9fe93915823bfc333577eb8a8e30` |
| `assets/ui/tetsuko/cat_flop.png` | 1024×768 | `0acf69870ff3899f1227e208694a9ceb756c17a93d82c6a0998f434acd93c750` |
| `assets/ui/tetsuko/cat_mew.png` | 1024×768 | `f0b23af834719715c37910c9f63a87117e41a3df09cfd62d595b0cb7930fec78` |
| `assets/ui/tetsuko/cat_poke.png` | 1024×768 | `649df080f34bf544787f07e313a17258a4d3f22fd71e0154c7593a3515b43d30` |
| `assets/ui/tetsuko/prop_lap.png` | 1120×402 | `33ecf48d71c10241c3cc6513f20197219d9772591551e58c299c06280edf8676` |
| `assets/ui/tetsuko/prop_tunnel_tail.png` | 240×228 | `5ccd638a9851c8d6d4b383e7a5877f936ec6120a7664f353a63187e7049ff5b0` |

## #2690 の8しぐさ・#2689 の裏口の背景の採用の記録（2026-11-11）

オーナー「推奨で行きます」（裏口の背景を規格に届かない 1672×941 のまま使う／猫の8しぐさの候補を検品して使う、の両方の提案に）。

**しぐさ（#2690 の A 段・PR #2715 の候補）**: 16枚とも既存の立ち絵と同じ猫に見え、文字・小物なし。しぐさごとに1枚選んだ。

| しぐさ | 採用 | 理由 |
|---|---|---|
| 香箱 loaf | `cat_loaf_b.png` | 体がまとまり、半分閉じた目が依頼どおり |
| 狙う crouch | `cat_crouch_a.png` | 右上を見る目がはっきり（じゃらしの方向） |
| 前足 reach | `cat_reach_a.png` | 右上へ伸ばす前足（じゃらしの方向） |
| 抱える hug | `cat_hug_a.png` | 抱える前足と丸い目 |
| 毛づくろい groom | `cat_groom_a.png` | 舌が見えて正面向き |
| あくび yawn | `cat_yawn_a.png` | 正面向きで牙と舌が見える |
| へそ天 belly | `cat_belly_a.png` | 前足をゆるく上げた寝相（今まで立ち絵を上下逆さにしていた所） |
| すりすり rub | `cat_rub_b.png` | しっぽが上で先だけ曲がる（依頼どおり） |

原画16枚と生成記録 `originals/GENERATION_RECORD_2690.md` は、PR #2715 のブランチと同じ中身でこのフォルダに置いた（後で #2715 がマージされても衝突しない）。顔の幅（頬から頬）: 香箱 485・狙う 430・前足 477・抱える 420・毛づくろい 490・あくび 477・へそ天 450・すりすり 400px（横顔なので少し小さめ）を立ち絵の 160px にそろえた（`remake/tools/build_tetsuko_art.py cats`）。B 段（歩く2枚・振り返る・伸び）は #3214 で依頼中。

**裏口の背景（#2689・PR #2695）**: 案02の昼・夜を採用（Codex の推奨。案01の昼は右端に木箱があり「箱なし」に反する）。1672×941 のまま `assets/backgrounds/bg_mukai_backdoor_{day,night}.png` に置き、`python3 remake/tools/build_manifest.py --backgrounds-only …` で WebP と一覧、`tools/background_catalog.py` の台帳に「オーナー承認・この画面専用」の `accepted` を書いた。原画4枚と記録 `GENERATION_RECORD_BG_2689.md` は PR #2695 と同じ中身。
- 画面では、背景を寄せる舞台の層（`.tt-cam-set` の `.tt-backdrop`）に置き、てつこと一緒に寄せる。CSS の壁・戸・ベンチ・地面（`.tt-set`）は出さない。
- 絵のベンチの座面は y≈420 なので、ベンチの上の居場所と置き場所を y=424 に合わせた。床・寝床の置き場所は今の座標のまま絵の地面・ひさしの下に合う。
- 裏口が出てくる会話の背景は替えていない（TKT15。この背景を使うのは、てつこといっしょの画面だけ）。
- 撮った写真も、この背景を背にして見せる（TKT30。撮った時の昼・夜）。

**手持ちの絵で置き換えた小さな部品**: 道具の名前の札（ハートの台の絵）、もようがえ・手帳・あそびかたの「おわる／閉じる」と「このしぐさを探す」（上の道具の札の絵）、「？」の中のアイコンの丸（丸い札の絵）。

**トンネルのしっぽの置き方を直した（TKT29）**: 最初はトンネルの横の宙に浮き、切れた根元が見えていた。奥の口（トンネルの絵の右の縁）の後ろから地面に沿って出て上へ巻くように置き直し、トンネルの絵より奥の層にして根元を縁に隠した。絵（`prop_tunnel_tail.png`）は作り直していない。

**採用版**（実行時は `remake/img/ui/tetsuko/*.webp`・`remake/img/backgrounds/*.webp`）:

| ファイル | 画素 | SHA-256 |
|---|---|---|
| `assets/ui/tetsuko/cat_loaf.png` | 1024×768 | `0d5587f69eae1f652125074dc3cb2fc0e27ecd601a18d92a5bb785b8cfbc867a` |
| `assets/ui/tetsuko/cat_crouch.png` | 1024×768 | `bb923295e89432749990d1fcf624e0207b6bbadbd56fafa00ee076be048bc6b5` |
| `assets/ui/tetsuko/cat_reach.png` | 1024×768 | `dd4f9cafc16c927734719a08ed762958989e11eb26bf2e965a6a3a033e6a7b2b` |
| `assets/ui/tetsuko/cat_hug.png` | 1024×768 | `dcf902c2b0c306c032a1ab0bf3e1bb2bafd4c3ed241907faf8bd679b1732c140` |
| `assets/ui/tetsuko/cat_groom.png` | 1024×768 | `cc4414e74822c0de08327fc6c0dace5dc93e8382d30dd855d11526ea5480f089` |
| `assets/ui/tetsuko/cat_yawn.png` | 1024×768 | `26c16113fffaea23cabad3a6f8f998464b00c0e3ae261d65b8e9921e0af424a9` |
| `assets/ui/tetsuko/cat_belly.png` | 1024×768 | `fdf4a3ee9703948bf0f94f269217bd29226bbc2260d41042b5301b88881484e0` |
| `assets/ui/tetsuko/cat_rub.png` | 1024×768 | `75636f1d8e81d7b1544b2bfb195116dd8429ae083558685f1956cf2899cfb648` |
| `assets/backgrounds/bg_mukai_backdoor_day.png` | 1672×941 | `544d7ad649cc3f5cc79ad155fe6190fe288a1d189013d0f213c655d811c24163` |
| `assets/backgrounds/bg_mukai_backdoor_night.png` | 1672×941 | `03f5b9077939cba33976dd2784c0bbac131ce746c1a3b1bcc2b6813ee4048042` |

**まだ CSS の物**（#3243・TKT27 で依頼）: もようがえのトレー・小さな札・あそびかたの紙・手帳の見開き・写真の額とテープ・段ボールの外枠・入る時の箱のふた・置き場所のしるし・「新」のシール・名前の札・まだ見つけていないしぐさの札。
