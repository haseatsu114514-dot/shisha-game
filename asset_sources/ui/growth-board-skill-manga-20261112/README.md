# 心得の盤: スキルの絵を白黒の漫画のコマにそろえる（2026-11-12・GB06）

オーナー（2026-11-12・台帳 SBD129）:

> あとは盤のスキルのイメージ画像のとこにはじめやライバルの絵をのっけたりなんかいろんなイメージ画像を載せない　ただし漫画風に統一白黒の　量産型スキルとかは全部じゃなくてもいいけどいい案を

## 0. 今と、変えること

- 盤でスキルを選ぶと、右のパネルの上の絵の欄（`reference/panel_pc.png` の桃色の枠）に、**23個のスキル全部で同じ「はじめの胸から上の立ち絵」**が出る（表情だけスキルごと。`growth-board-screen.js` の `panelPortrait`）。
- これを、**スキルごとの場面を描いた白黒の漫画の1コマ**にする。はじめのほか、ライバルや仲間、審査員も出る。全部を同じ描き手の白黒の漫画としてそろえる。
- 授業（金の札）は今のまま、教えてくれる人の立ち絵。

## 1. 案: 17枚で23個のスキルをまかなう

- **見せ場の13個は1枚ずつ**描く（大会・会話・人と会うスキルや、上の段の大きなスキル）。
- **残りの10個は4枚を分け合う**（日常の朝・作りの手元・記録・蒸らしの静けさ）。同じ場面に属する小さなスキルで、同じ絵でも意味が通る。「量産型」の安いスキル（火種2）はここに入る。
- **人物はその章までに会っている人だけ**にする。盤のスキルは章の数だけ段が開き（第1章＝1段目、第4章＝4段目）、次の段は影絵で先に見える。早い段のスキルに後の章の人物を描くと、正体を先に明かしてしまう。
  - 1段目（第1章〜）: はじめ・スミさん・なる・アダム・みんと・審査員の千須とチャコール博士
  - 2段目（第2章〜）: ＋あげは・組長（リュウジ）・レヰ
  - 3段目（第3章〜）: ＋ヴォルク・綾取 陣・スティーブ
  - 4段目（第4章〜）: ＋シェイク・王煙楼

| # | ファイル（`originals/`） | スキル（段） | 場面 | 人物 | 機材 |
|---|---|---|---|---|---|
| **1** | `sk_k15.png` | 会心の一服 K15（1） | 長い煙を吐き、自信の笑み。集中線と小さなきらめき | はじめ | ハンドルのみ |
| 2 | `sk_k04.png` | 人見知りしない K04（1） | アダムの店で、大げさな身ぶりのアダムに、はじめが気後れせず笑って手を振る | はじめ・アダム | なし |
| 3 | `sk_k07.png` | 空気を読む K07（2） | にぎやかに話すなるの横で、何か言いかけて口をつぐむみんとに、はじめだけが気づく。みんとの肩のそばに小さな煙の印 | はじめ・みんと・なる | なし |
| 4 | `sk_k21.png` | スモークリング K21（2） | はじめの吹いた煙の輪に、あげはが目を丸くして喜ぶ | はじめ・あげは | ハンドルのみ |
| 5 | `sk_k16.png` | 勝負勘 K16（3） | 左右に割ったコマで、はじめとなるの目元。真ん中を稲妻の線 | はじめ・なる | なし |
| 6 | `sk_k10.png` | 審査員の目 K10（3） | 選手の側から見た審査員の席。千須とチャコール博士の鋭い目、眼鏡の光 | 千須・博士 | なし |
| 7 | `sk_k19.png` | 顔が広い K19（3） | 商店街を歩くはじめに、あちこちから声がかかる | はじめ・みんと・アダム・あげは・組長 | なし |
| 8 | `sk_k08.png` | 疲れ知らず K08（3） | 閉店後の tonari。袖をまくり、汗をかいてもまだ笑って「もう一台」 | はじめ | なし |
| 9 | `sk_k12.png` | 大一番の胆力 K12（4） | 世界大会の決勝。目を閉じて一つ深く息をするはじめ、向かいに王者シェイク | はじめ・シェイク | なし |
| 10 | `sk_k13.png` | 声援 K13（4） | はじめの背中越しに、客席で応援するスミさん・みんと・なる・アダム | はじめ・スミさん・みんと・なる・アダム | なし |
| 11 | `sk_k11.png` | 火の番 K11（4） | トングで小さな炭を1つ持ち上げる手元の大写し。奥にはじめの真剣な目 | はじめ | トング・炭 |
| 12 | `sk_k14.png` | 炭の声 K14（4） | 目を閉じて耳を澄ますはじめの横顔。手前のHMDの炭から、細い波の線が耳へ | はじめ | 台の上部（HMD・ボウル・受け皿・ステム） |
| 13 | `sk_k09.png` | 熟練の舌 K09（4） | 目を閉じて味をみるはじめ。まわりに薄いトーンでレモン・ミント・ぶどう・りんご・カルダモン | はじめ | ハンドルのみ |
| 14 | `sk_morning.png` | 早寝早起き K03（1）・空模様 K05（3） | 朝、カーテンを開けて大きく伸びをするはじめ。窓の外に雲の広がる空 | はじめ | なし |
| 15 | `sk_prep.png` | 段取り八分 K01（1）・デンスパック K18（1）・葉の持ち K17（3） | 作業台の手元。シリコンボウルに葉を詰める手と、順に並んだ道具 | はじめ（手） | ボウルと道具（HMD・炭なし） |
| 16 | `sk_notebook.png` | 香りの記憶 K02（2）・メモ魔 K24（2）・目利き K23（2） | 夜の机でレシピ帳に書き込むはじめ。まわりにフレーバーの箱と小さなタッパー | はじめ | なし |
| 17 | `sk_steam_calm.png` | 二枚目のリフレッシュ K06（1）・残り香 K22（3） | 目を閉じて静かに息を整えるはじめ。まわりの雑念の落書きが煙に溶けて消える | はじめ | なし |

**1枚目（会心の一服）を先に描き、Draft PR に上げてオーナーが画風を見る。** 採用された1枚目を、2枚目以降の「画風の正本」として毎回添付する（17枚を同じ描き手にそろえるため）。

## 2. 絵の大きさと、見える範囲

- 原画は **1536×576**（横長 8:3）。画面の端まで絵で埋める（コマの枠線・白い余白は描かない。枠はゲームが描く）。
- ゲームでの見え方: PC は 434×150（上下が少し切れる）、**スマホ横は 434×84（上下が大きく切れ、高さの 25〜75% の帯だけが見える）**。顔と大事な動きは、この**真ん中の帯（高さの 25%〜75%）**に入れる。上下の4分の1には背景・煙・トーンだけ。
- 434px まで縮むので、細かすぎる網点（モアレになる）は使わず、太い線・黒のベタ・粗いトーン・斜線で描く。

## 3. Codex へ渡す文

共通（全部の冒頭に付ける）:

```
ノベルゲーム「水煙前線」の成長画面「心得の盤」で、スキルの説明の上に出す「漫画の1コマ」を1枚だけ描いてください。
全部のスキルの絵を、同じ描き手の白黒の漫画のコマとしてそろえます。添付の立ち絵は、その人物の顔・髪・服の正本です。添付の画面の図は、絵が出る場所（桃色の枠）と大きさの参考で、桃色の枠や番号は描きません。
（2枚目以降）添付の「1枚目のコマ」が画風の正本です。線の太さ・トーンの使い方・黒の量を、これと同じにしてください。

STYLE: one single panel of a black-and-white Japanese manga (weekly shonen/seinen magazine style). Black ink on white paper only: confident inked line art with tapered strokes, solid black fills, and grey shown only as screentone (dot or line tone) or hatching. Absolutely no color, no sepia, no smooth grey gradients or airbrush, no 3D rendering, no photo texture. Manga devices are welcome but used with restraint: speed lines, focus lines, small sparkle or flash marks, impact lines. Use bold lines, generous solid blacks and coarse tones (large dots or bold hatching) so the panel still reads when shrunk to 434x150 px; avoid very fine dot screens that turn into moiré.
CHARACTERS: draw every named character exactly as the attached official game sprite: the same face, eye shape, hair shape, outfit and accessories, translated into black-and-white ink (colors become black, white or one tone). Keep the game's proportions (about 7 heads tall; the petite Ageha about 5.8). Do not invent new outfits or new characters' faces. Unnamed people are simple silhouettes or back views.
FORMAT: 1536x576 px landscape. The whole canvas is the panel: art runs to every edge, with no panel border, no white gutter and no page around it. Keep every face and the key action inside the middle band between 25% and 75% of the height (the phone screen shows only that band); the top and bottom quarters hold only background, smoke or tone.
NEVER: any text — no speech bubbles, no sound-effect lettering or onomatopoeia, no captions, no readable letters on signs, labels, packages or pages, no numbers, no logos, no watermark. Clock faces have no numerals.
```

機材の絵（表の「機材」が「なし」以外: 1・4・11・12・13・15）だけ、場面の文のあとに [シーシャ描写の参考資料 §4.2](../../../docs/shisha_reference.md#42-プロンプトに貼る文) の英文を**そのまま**貼り、下の「場面の一文」を足す。参考写真は siryou の `shisha-hardware-reference/web-refs/images/`（日本の店の手元・ハンドル・HMD・ボウル・炭の写真）から選んで渡し、「形と大きさの関係だけ参考にする。写真の中の大きさは真似しない」と書き添える。生成前に §4.3 の8行を1枚ごとに `GENERATION.md` に書き、生成後は §4.4 で検品する。

一覧（1回の生成で1枚）:

```
1 / sk_k15.png — Hajime (attach his sprite) in three-quarter profile exhales one long, smooth plume of smoke with a confident, slightly cocky grin and narrowed eyes; radiating focus lines and a small sparkle burst behind him; his hand holds a hookah hose handle near his chin, and the hose runs out of the frame to the left. The shop interior is suggested only with tone. [hookah text] Only the rigid handle and the hose are in frame; the hookah itself is out of frame. The hose leaves the frame as one unbroken tube.
2 / sk_k04.png — Inside Adam's flamboyant shisha shop "Eden" (no readable sign): Adam (attach his sprite) strikes a grand theatrical pose holding an apple high; Hajime, without any hesitation, leans in with a bright friendly smile and a small wave, completely at ease. Apples and star anise in the background. Adam's two-tone hair: his own left side is green and his own right side is red, so in a front view screen-left is red; render the red side as a darker tone and the green side as a lighter tone, split at the parting. No hookah in this panel.
3 / sk_k07.png — At a café table during a lively chat: Naru (attach his sprite) talks animatedly; Minto (attach her sprite) seems about to say something but holds it back with a small smile; between them, Hajime alone quietly glances sideways and notices. A tiny curl of smoke drawn as a small mark floats near Minto's shoulder (the game's hint mark). No hookah on the table.
4 / sk_k21.png — Hajime blows a perfect smoke ring that floats forward across the panel; beside him Ageha (attach her sprite) leans in wide-eyed and delighted, hands clasped. Hajime holds a hose handle; the hookah is out of frame. [hookah text] Only the rigid handle and the hose are in frame; the hose leaves the frame as one unbroken tube. The smoke comes from Hajime's mouth.
5 / sk_k16.png — A split face-off: the left half is an extreme close-up of Hajime's eyes and brows, the right half is Naru's; both calm but intense, looking at each other across the middle, where a jagged lightning-like spark line runs from top to bottom. Spotlight tone behind them.
6 / sk_k10.png — The judges' table seen from the contestant's seat: Sui (attach his sprite: navy three-piece suit, arms folded, center) and Dr. Charcoal Hiura Riichi (attach his sprite: messy hair, square black glasses, stained lab coat) study the viewer; light glints off the glasses, intense hatching on their faces. Plain table, no score cards, no numbers.
7 / sk_k19.png — A busy shopping street: Hajime walks through the middle, and from all sides acquaintances call out to him — Minto waving from a shop door, Adam raising an apple, Ageha jumping and waving, the Shisha Kumicho Ryuji giving a cool nod from a corner (attach all their sprites). Hajime laughs and waves back. Shop signs have no readable letters.
8 / sk_k08.png — Late at night in the closed shop "tonari": Hajime rolls up his sleeves after many practice runs, sweat on his brow, a towel over his shoulder, still smiling and ready for one more; a wall clock without numerals; a bottle of water on the counter. No hookah in this panel.
9 / sk_k12.png — The final of the world tournament under a single spotlight: Hajime sits upright and closes his eyes for one deep, calm breath, hands resting still on his knees; across the stage, the reigning champion Sheikh (attach his sprite: white kandura and gold-trimmed ghutra) watches with composure. The huge crowd is a dark silhouette in tone. No hookah in frame.
10 / sk_k13.png — From behind Hajime on a tournament stage (his back and cap brim in the foreground): in the stands, Sumi, Minto, Naru and Adam (attach their sprites) cheer for him — Minto with both arms up, Naru with a fist raised, Adam shouting, Sumi with a calm thumbs-up. No banners with letters.
11 / sk_k11.png — Close-up: Hajime's hand uses metal tongs to lift one small cube charcoal (fingertip-sized, grey ash with glowing cracks drawn as white lines on black, no flames); in the background at the right, Hajime's focused eye under the cap brim. The coal heater is out of frame. [hookah text] Use the coal-handling line: tongs hold one small cube coal; no hookah, bowl or HMD in this panel.
12 / sk_k14.png — Hajime in profile with eyes closed, head tilted slightly, listening intently; at the left, at the same depth, the top part of a hookah: a lotus-type HMD with its lid slightly open showing two or three small coals, sitting on a silicone bowl, with the tray and the upper stem in frame. Delicate wavy manga lines rise from the coals toward his ear, as if he can hear them. [hookah text] Finished setup: coals inside the HMD, never directly on foil. The bowl and HMD together are about half the height of his face.
13 / sk_k09.png — Hajime tastes a puff with eyes closed and a subtle knowing smile; around him, drawn in light tone, floating flavor motifs: a lemon slice, mint leaves, a bunch of grapes, an apple, a cardamom pod. He holds a hose handle near his mouth; a thin stream of smoke leaves his lips; the hookah is out of frame. [hookah text] Only the rigid handle and the hose are in frame; the hose leaves the frame as one unbroken tube.
14 / sk_morning.png — Early morning in Hajime's small room: he pulls open the curtains and stretches with a big yawn as beams of morning light come in; outside the window, a wide sky of clouds drawn in clean tone, with one patch of sun breaking through.
15 / sk_prep.png — Workbench close-up: Hajime's hands press moist shisha tobacco gently but firmly into a silicone bowl with a small packing tool; beside it, tools lined up neatly in order: a roll of foil, a hole poker, tongs, a small clear tub of tobacco. Calm, orderly. [hookah text] Packing stage: bowl only; no HMD and no coals yet.
16 / sk_notebook.png — Hajime at a table at night writing in a thick recipe notebook; the pages show only abstract scribbles and small doodles of leaves and fruit (no readable letters or numbers); around it, flavor packages without logos and small clear tubs of tobacco; he holds one package up and inspects it with a sharp eye.
17 / sk_steam_calm.png — Hajime with eyes closed takes a calm, meditative breath; around him, soft swirling smoke clears away small scribbly "noise" shapes (abstract manga marks, not letters), which dissolve into the smoke. Quiet, still mood.
```

`[hookah text]` の所に §4.2 の英文をそのまま入れる。人物は、表の名前の正規の立ち絵 `assets/sprites/characters/<id>/chr_<id>_normal.png` を添付する（はじめ `hajime`・スミさん `sumi`・なる `naru`・アダム `adam`・みんと `minto`・あげは `ageha`・組長 `kumicho`・千須 `sui`・チャコール博士 `dr_kemuri`・シェイク `sheikh`）。

## 4. 納品（Codex）

- 原画を `asset_sources/ui/growth-board-skill-manga-20261112/originals/` に置き、Draft PR にする。**1枚目（`sk_k15.png`）だけで一度 PR に上げ、オーナーの画風の確認を待つ**。採用されたら残りの16枚。
- `originals/GENERATION.md` に、1枚ごとの英文の全文・添付した画像のパス・機材のある絵の §4.3 の8行と §4.4 の検品結果・各 PNG の画素寸法と SHA-256 を書く。
- 縮小・切り出し・ゲームへの組み込みはしない（Claude が行う）。画像は Git LFS。

## 5. 受け取り後（Claude）

- 検品: 白黒だけ（色が無い）／文字・擬音・数字が無い／人物が立ち絵と同一人物／顔と動きが高さ 25〜75% の帯にある／434×150 と 434×84 に縮めて読める／17枚が同じ描き手に見える／機材は §4.4。
- 変換: `remake/img/ui/growth_board/skill_art/<名前>.webp`（960×360）。白黒のまま（念のため色を抜く）。
- 組み込み: スキルの絵の欄は、その絵があればコマを全面に（`object-fit: cover`、スマホ横は真ん中の帯）、無ければ今のはじめの立ち絵のまま。次の段で先に見えるスキル（今は影絵）は、コマを暗く沈めて影絵にする。まだ現れていないスキルは今までどおり「？」。授業は変えない。
- 盤の新版（暗い面）の上では、紙の白いコマとして見せる（細い白の縁）。
