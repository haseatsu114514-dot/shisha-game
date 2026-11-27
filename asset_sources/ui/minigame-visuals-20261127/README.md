# ミニゲームの見た目用の生成画像（2026-11-27）

オーナー「ミニゲームのUIや見た目を、ソシャゲや市販ゲームみたいに。最新のイメージ2.6をAPIから使い画像生成も駆使して」「文字で説明しすぎずUIやボタンで視覚的にわかるよう設計していきたい」「画像生成には gpt-image-2.6-sunburst を使ってください」（要望台帳 2026-11-27 の節・DSR98）。

OpenAI の画像 API（`gpt-image-2.6-sunburst`）で生成した原画と、送ったプロンプトの記録。ゲームに入れた絵は、ここから縮小・変換した WebP。

## 砂丘（DESERT RIDE）— `desert/`

**今ゲームで使っている生成の絵は 5 枚**（入口の背景 1、派手なアクションの絵 4）。遊び方の図解 6 枚は、いったん採用した後、オーナーの指示で実際の画面のスクショに替えた（下の「遊び方の絵は、実際の画面のスクショ」）。生成は全部で 12 回（1枚めの試し＝よけるの図解の中画質版は不採用で、保存していない）。

| 原画（`desert/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `how_dodge.png`・`how_jump.png`・`how_spin.png`・`how_boost.png`・`how_carve.png`・`how_flow.png` | 遊び方の図解（DSR98）。**今は使っていない**（DSR101 でスクショに替えた。派手なアクションの絵を作る時の画風の参照にした） | ―（`remake/img/ui/desert_ride_howto/how_*.webp` は、同じ名前のままスクショに差し替え） |
| `fx_plume.png` | 踏み切りの砂の柱（真上へ扇に噴き上がる。ブースト発進の砂にも）（DSR100） | `remake/img/ui/desert_ride/fx_plume.webp` |
| `fx_wake.png` | ブースト中に板の左右へ広がる砂・着地の砂・鋭く切った時の砂（右向きの絵。左は反転）（DSR100） | `…/fx_wake.webp` |
| `fx_wave.png` | カーブの外へ巻き上がる砂の波（右向きの絵。左は反転）（DSR100） | `…/fx_wave.webp` |
| `fx_bolts.png` | ブースト中、体のまわりを走る稲妻（中央は空いている）（DSR100） | `…/fx_bolts.webp` |
| `title_bg.png` | 入口の背景（旗のコースとゴールの見える砂丘） | `remake/img/ui/desert_ride/title_bg.webp` |

- **変換**: 図解は 1536×1024 → 768×512 の WebP（quality 86）。入口の背景は**左右を反転**してから上の 1536×864（16:9）を切り出した WebP（旗のコースが左＝人物の側へ来るように。右は板が載る）。
- **参照画像**: 滑走で採用済みの絵（はじめの背面の各姿勢・岩・カーブの看板・旗・遠景）と、滑走中の実画面を毎回渡して、人物と砂丘の描き方をそろえた（`desert/prompts.md` に1枚ごとの一覧）。
- **検品**（`docs/asset_ai_guidance.md` の必須項目）: 人物は背面だけで顔が写らない／服・髪・板の色は滑走の絵と同じ／文字・擬似文字なし（カーブの看板は矢印の記号だけ）／手・足・板のつながりに崩れなし／実画面で滑走の絵と並べて同じ描き手に見えることを確認。シーシャの機材は写っていない。
- **組み込み**: `remake/js/minigames/desert-ride.js` の `HOWTO_CARDS`・`howCard`（絵はスクショ）、`drawFx`・`drawGroundFx`（派手なアクションの絵）、`remake/css/desert-ride.css` の「遊び方の図解」と入口の背景。
- 原画の SHA-256（先頭16桁）: `how_dodge` 7def0cba9882924c, `how_jump` 4d91ae213f79b358, `how_spin` b95c7dc31b25279f, `how_boost` b6cd0b55d2acd67f, `how_carve` a0a4011802e42699, `how_flow` 14256360440d7249, `title_bg` 73ce60a30fb06f67
- **派手なアクションの絵（DSR100）**: 透過の余白を切り落として、`fx_plume` 512×505・`fx_wake` 640×242・`fx_wave` 640×433・`fx_bolts` 512×507 の WebP（quality 86。4枚で約490KB）。砂が出る点（`origin`）は `remake/js/minigames/desert-ride-art.js` に持つ。検品: 透過（砂色の地と空色の地の両方に置いて、縁に色のにじみ・四角い地が無いことを確認）／人物・板・地面・文字なし／砂は右向き・稲妻は中央が空いている、という指定どおり／実際の滑走に重ねて、踏み切り・着地・ブースト・カーブ・鋭く切った時の5場面を撮って確認。シーシャの機材は写していない。
- 派手なアクションの絵の原画の SHA-256（先頭16桁）: `fx_plume` 002792c1bfe612e1, `fx_wake` 90ba5ee95ea041ae, `fx_wave` 84476f1e94e0a4b0, `fx_bolts` f46e0abca805066f

### 遊び方の絵は、実際の画面のスクショ（DSR101）

オーナー「操作の見本は生成というよりはスクショを使いたい　実際の画面の」。遊び方（「？」）の6枚は、**実際の滑走の画面を撮ったもの**に替えた（DSR100 の絵を入れた後の画面）。

- 撮り方: `desert/howto-screenshots/capture.mjs`。単体ページ（`desert-ride.html`・コースD）を上手なボットに走らせ、各アクションの瞬間に止めて、画面（HUD も含む実際の表示・2倍の解像度）の人物のまわりを 3:2（舞台の上で 720×480）で切り出す。左上の得点の札と右上の速さの札が入らない幅にしてある。下の角には実際のボタンが写る（札では題の帯の下になる）。
- 撮ったままの PNG（1440×960）: `desert/howto-screenshots/how_*.png`。ゲーム用は 768×512 の WebP（quality 84。6枚で約200KB）。
- **「大ジャンプ」**は、回らずに跳んだ所を見せるため、踏み切った直後にボットを外して撮った。ほかの5枚は、ボットが走っている途中をそのまま止めた。**「砂流れ」**は、帯に乗って走っている所（帯に入って 6〜16m。帯が板の下から手前と先へ続いて見える）。最初は帯が体に隠れるのを避けて帯の横に人物を置いて撮っていたが、オーナー「砂流れも乗ってるとこ撮って」（DSR104）で、乗っている所に撮り直した（位置は作っていない。直前の「かすめ」の字が写っている）。
- **2026-11-27 撮り直し**（DSR102・DSR103）: 「よける」は、岩が遠くに小さく写っていて分かりにくかったので、**岩のすぐ横をかすめる瞬間**（人物の 1〜3.5m 先・当たり判定の外 0.4 レーン以内）で撮り直した（コースBの、2つの岩の間をすり抜ける所）。「カーブ」は、カーブの砂の波を控えめにした後の画面で撮り直した。
- 撮り直すと、ボットの走りが毎回少し違うので、同じコマにはならない。
- スクショの SHA-256（先頭16桁）: `how_dodge` 4b49a5f5c71e616b, `how_jump` 6cbe2ed54aad50b7, `how_spin` f8726e41d3a98c13, `how_boost` 10a4ddba6412e78c, `how_carve` 0eb90552cc599819, `how_flow` 8056b0b3d15700bd

## 店番（フロア営業）— `floor/`

採用 3 枚（生成は 4 枚。枠は2枚生成し、まん中に半透明のむらが出た1枚めは不採用で、保存していない）。

| 原画（`floor/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `frame.png` | 開店前・休止・精算の窓の枠（九分割） | `remake/img/ui/tonari-floor/frame-ornate.webp` |
| `ornament.png` | 開店前の窓の上の飾り（モザイクランプと唐草） | `remake/img/ui/tonari-floor/deco-ornament.webp` |
| `ribbon.png` | 営業の名前・「本日の精算」の題札 | `remake/img/ui/tonari-floor/deco-ribbon.webp` |

- **変換**: 透過の余白を切り落として、枠は 768×768、飾りは幅 1100、題札は幅 1000 の WebP（quality 90）。
- **参照画像**: 採用済みの部品（板 `panel`・金の札 `card-primary`・ランプ `lamp-on`・メダル `medal-s`）を渡して、材質（茄子紺の漆・真鍮・モザイクの石）をそろえた（`floor/prompts.md`）。
- **検品**: 文字・擬似文字なし／シーシャの機材は描いていない（ランプと唐草だけ）／枠は四隅だけに飾りがあり、辺はまっすぐな二重線（九分割で伸ばしても崩れない）／透過の縁に色のにじみなし／実画面で既存の部品（金の札・気分の札）と並べて確認。
- **組み込み**: `remake/css/tonari-floor.css` の「開店前・休止・精算の窓の見た目」（TFL67）。
- 原画の SHA-256（先頭16桁）: `frame` 942047f941c64e6c, `ornament` e60626ea4815baa7, `ribbon` 883cfbdaf9987a4a

## 斧投げ — `axe/`

採用 4 枚（生成 4 枚）。オーナー「斧投げとボドゲも頼む」（AXV01）。

| 原画（`axe/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `how_aim.png` | 遊び方の図解「ねらう」（横と縦の線が赤い中心で交わる） | `remake/img/ui/axe_throw/howto/how_aim.webp` |
| `how_throw.png` | 遊び方の図解「投げる」（手元の斧と、上へ弾く矢印） | `…/how_throw.webp` |
| `how_score.png` | 遊び方の図解「得点」（刃が赤い中心に刺さる） | `…/how_score.webp` |
| `how_killshot.png` | 遊び方の図解「キルショット」（青い点に刺さる） | `…/how_killshot.webp` |

- **変換**: 1536×1024 → 768×512 の WebP（quality 86）。
- **参照画像**: 斧投げの実画面（レーンと的）・的の切り出し・斧の絵を渡して、木のレーン・的の輪と赤青の点・斧の形をそろえた（`axe/prompts.md`）。
- **検品**: 人物は手だけ（顔なし）／文字・数字なし（実物の的にある 1〜4 の数字は入れていない）／的の輪・赤い点・青い点の並びは実物と同じ／斧の刃と柄のつながりに崩れなし／実画面のレーンと並べて確認。シーシャの機材は写っていない。
- **組み込み**: `remake/js/minigames/axe-rules.js` の `HOW_CARDS`、`remake/css/axe-throw.css` の「遊び方の図解」。
- 原画の SHA-256（先頭16桁）: `how_aim` 2d01e9a07476156a, `how_throw` 9544f0db51cc9902, `how_score` 654bef0b970bffe6, `how_killshot` e7b5b50ed827170a

## ボドゲカフェ（TRPG）— `trpg/`

採用 3 枚（生成 4 枚）。オーナー「斧投げとボドゲも頼む」（TRP10）、「本をめくってシナリオを決めるような洒落たものにしたい」（TRP11）。

| 原画（`trpg/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `book_locked.png` | 本棚の未解放の本の札（鎖と錠の掛かった本） | `remake/img/ui/trpg/book-locked.webp` |
| `dice_icon.png` | マイダイスを買う札の絵（透過） | `remake/img/ui/trpg/icon-dice.webp` |
| `book_open.png` | 物語を選ぶ画面の、開いた本（透過。紙面は無地で、絵と字は画面が重ねる）（TRP11） | `remake/img/ui/trpg/book-open.webp` |
| `book_open_portrait.png` | 縦画面の試作の、物語を選ぶ画面の本。上下に開く（背が横に真ん中を通る）。紙面は無地（VPG15） | `remake/img/ui/trpg/book-open-portrait.webp` |

- **変換**: 本は 768×512 の WebP（quality 86）。ダイスは透過の余白を切り落として 256×256 の WebP（quality 92）。開いた本は透過の余白を切り落として 1526×995 の WebP（quality 88・約87KB）。紙面の位置（横 6.0〜49.2%／51.3〜94.6%、縦 3.4〜89.0%）を測って、CSS の置き場に使っている。
- **参照画像**: 本棚の実画面と TRPG の場面絵を渡して、深い青緑と真鍮の配色・背景の描き方をそろえた（`trpg/prompts.md`）。
- **開いた本の検品**（2案から1案目を採用。2案目は紙面が少し広いが、本が画像の上端と左右の端に接していて、表紙の縁が切れていた。1案目も左の端には接しているが、角の金具と小口は欠けていない）: 真上から見た歪みのない見開き／左右の頁が同じ大きさ／紙面に字・絵・線・しみなし／透過の縁に色のにじみなし／実画面で絵・題・ボタンを重ねて、紙面からはみ出さないことを確認。
- **検品**: 文字・数字なし（本の表紙に題字なし。ダイスの面は星と点だけで、数字は入れていない）／鎖と錠のつながりに崩れなし／透過の縁に色のにじみなし／実画面で他の本の札と並べて確認。
- **組み込み**: `remake/css/trpg-theme.css` の「本棚の文字を減らし、印と顔で見せる」（TRP10）と「本をめくって物語を選ぶ」（TRP11）。
- 原画の SHA-256（先頭16桁）: `book_locked` f2dd53fffecad4d0, `dice_icon` c4ae0219c3887db9, `book_open` 581c2719a0642b5d, `book_open_portrait` 2da296ecddedce5f
- **上下に開く本（VPG15）**: オーナー「TRpGは本を捲る風な選択画面とか最近作ったはずなのでそれを」。縦では横開きの見開きが小さくなるので、同じ画風の「上下に開く本」を `book-open.webp` を参照に渡して1枚生成した。768×1152 の WebP（quality 88・約62KB）。紙面の位置は絵の画素から測った値（上の紙 縦 5.0〜46.7%・下の紙 49.1〜91.4%・横 5.9〜93.9%・背 48.2%）を `remake/previews/portrait-stage/frame/trpg.css` が使う。**検品**: 本は真っすぐで傾きなし／紙面は無地（字・数字・線なし）／表紙の青緑・角の金具・赤いしおりの紐は横開きの本と同じ／四隅が画像の端に接するが、角の金具は欠けていない

## 縦画面の試作 — `portrait/`（VPG09）

オーナー「縦レイアウトにした中で…さらに簡略化で視覚でわかるようにできそうな情報を生成したりとか見直して」「見た目しょぼいのは生成したりとかAPIで」。縦画面C案「煙の舞台」の試作（`remake/previews/portrait-stage/`）で使う絵。プロンプトは `portrait/prompts.md`。

| 原画（`portrait/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `desert_stats.png`（3列×2段の6つの印） | 砂丘の結果の記録の名前（時間・コンボ・転倒・着地・トリック・ブースト）を、字ではなく印で見せる（縦だけ。`frame/desert.css`） | `remake/img/ui/desert_ride_result/stat_time.webp`・`stat_combo.webp`・`stat_fall.webp`・`stat_land.webp`・`stat_trick.webp`・`stat_boost.webp` |
| `tk_deck.png` | 「てつこといっしょ」の縦の操作の板の地（段ボール箱の底。上の縁に段ボールの断面）（`frame/tetsuko.css`） | `remake/img/ui/tetsuko/ui_tk_deck_portrait.webp` |
| `tk_book_portrait.png` | 「てつこといっしょ」の縦の手帳の台紙（縦開きのリング手帳。上の紙にしぐさの札、下の紙に写真と一言）（`frame/tetsuko.css`） | `remake/img/ui/tetsuko/ui_tk_book_portrait.webp` |

- **変換**: 印は升ごとに絵の入っている範囲を切り出し、正方形にそろえて 192×192 の WebP（quality 92）。板の地は 1280×853 の WebP（quality 88・不透明）。手帳は透過の余白を切り落とした 986×1517 の WebP（quality 90）。紙の位置（上の紙 7〜45%・下の紙 51〜89%・左右 5〜95%）は絵の画素から測り、CSS の置き場所に使っている
- **検品**: 文字・擬似文字なし／印は砂丘のボタン・メダルと同じ革と金の作りで、6つとも升からはみ出していない／手帳は真っすぐで、紙は無地／板の地は物や字が無く、うすい足あとだけ
- 原画の SHA-256（先頭16桁）: `desert_stats` 59b1a3d333235607, `tk_deck` 5f168678e1813678, `tk_book_portrait` 08bd0a1ae27f2fbb

## 砂丘の結果のメダルと札（DSR106・VPG19）— `desert/originals/`

オーナー「メダルのデザインがなんか合成感すごい　ちゃんとランクごとのメダルを生成で作ってあげて　CSS感がある部分は綺麗にしたい」「コンボはアイコンがわかりずらかっただけなのでコンボって英語で書いたアイコンにしよう　チェーンと」。プロンプトは `desert/prompts.md` の末尾。

| 原画 | 使う所 | ゲームの絵 |
|---|---|---|
| `medal_S.png`・`medal_A.png`・`medal_B.png`・`medal_C.png` | 結果の評価のメダル（字は金属の浮き彫りとして絵に入っている。S 金・A 赤銅・B 銀・C 青銅） | `remake/img/ui/desert_ride_result/rank_s.webp`・`rank_a.webp`・`rank_b.webp`・`rank_c.webp`（512×512） |
| `plate_rank.png` | ランクの名前（「最高の一本」など）と段の札（「中級」など）の革の名札。字はコード | `…/plate_rank.webp`（720×150。影を除いた範囲で切り出し） |
| `stamp_best.png` | 自己ベスト更新の赤い漆の札。字はコード | `…/stamp_best.webp`（900×234。絵の傾き 約4.3° を水平に直して切り出し、CSS で −4° に傾ける） |
| `stat_combo.png` | 縦の結果の「最高コンボ」の印（英字 COMBO と鎖） | `…/stat_combo.webp`（192×192。前の鎖と炎だけの印を置き換え） |

- **参照画像**: 採用済みのメダル（`medal_s`・`medal_a`）・勝ちのリボン・記録の板と、縦の結果の印（`portrait/originals/desert_stats.png`）を渡して、革と金の作りをそろえた
- **検品**: メダルの字はそれぞれ S・A・B・C の1字だけで、正立・中央。ほかの字・数字なし／COMBO の綴りが正しい（C・O・M・B・O）／名札と漆の札は中が空いていて、字・擬似文字なし
- 前のメダル（`medal_s|a|b|c.webp`。#3686）は使わなくなったが、絵は残してある（記録は `asset_sources/desert-ride-result-3686/`）
- 原画の SHA-256（先頭16桁）: `medal_S` 700feed14fc7f58c, `medal_A` b6e00a350b0b21ed, `medal_B` 15ceaf4ef4a07b66, `medal_C` ce833681a67c2e2d, `plate_rank` 15c3cc44395ed591, `stamp_best` b9d25adfa4adbfc9, `stat_combo` f3c4f8c02ab4ce6e

## ミニゲームの題字のロゴ（DSR108・CRF29）— `logos/`

オーナー「あと各ミニゲームのタイトルは生成して　今なんかデザートライドとかダサいしロゴ」。CSS の金のグラデーションの字（砂丘）や、字だけの題字（ラクダ）を、**絵の入ったロゴ**に替えた。プロンプトは `logos/prompts.md`。

| 原画（`logos/originals/`） | 使う所 | ゲームの絵 |
|---|---|---|
| `logo_desert_ride.png` | 砂丘の入口の題字（夕日・砂丘・砂を切って走る板。横の入口・縦の入口とも）（`remake/css/desert-ride.css` の末尾・`frame/desert.css`） | `remake/img/ui/desert_ride/logo.webp`（900×605） |
| `logo_camel_race.png` | ラクダレースの入口の題字（走るラクダとロボット騎手・赤いリボン・ゴールの旗。単独ページの入口・縦の大会選び）（`remake/js/camel-race-page.js`・`frame/camel.css`）。レース中の小さな題字は前の `word-title.webp` のまま | `remake/img/ui/camel_race/ui/logo.webp`（900×550） |
| `logo_tetsuko.png` | 「てつこといっしょ」の題字（丸い手書き風のひらがなと、寝そべるてつこ・足あと） | `remake/img/ui/tetsuko/ui_tk_logo.webp`（820×390） |

- **変換**: 透過の余白を切り落とし、横 900px（てつこは 820px）に縮めた WebP（quality 90・透過あり）。
- **検品**: 綴りが正しい（DESERT RIDE・CAMEL RACE・てつこといっしょ）。ほかの字・擬似文字なし／人物は背面か小さく顔なし（砂丘）／ロボット騎手はラクダレースの絵と同じ作り／てつこは毛色がゲームの絵と同じ。
- 原画の SHA-256（先頭16桁）: `logo_desert_ride` 3e65c260581a2bf7, `logo_camel_race` 0f1f023a5e361a03, `logo_tetsuko` cc89f937cf1e5cb2

## 砂丘の縦の下り坂の遠景（DSR109）— `desert/originals/`

オーナー「サンドボードは縦画面のやつでもこんな感じでレース中にも坂をくだってる立体感がわかりやすくしたい」「必要に応じて生成してもいい」（見本は入口の絵 `title_bg.webp`）。縦の滑走中に、坂の下に広がる谷を見下ろす遠景。プロンプトは `desert/prompts.md` の末尾。

| 原画 | 使う所 | ゲームの絵 |
|---|---|---|
| `valley_day.png` | 縦の滑走中の遠景（目の高さの稜線〜坂の下の谷）。上の空は透明で、ゲームの空の絵と太陽を後ろに描く（`desert-ride.js` の `DOWNHILL`・`backdropFit`） | `remake/img/ui/desert_ride/valley_day.webp`（1536×652） |
| `valley_dusk.png` | 同じ構図の夕方。ゴールへ近づくほど昼の上に重ねる | `remake/img/ui/desert_ride/valley_dusk.webp`（1536×652） |

- **変換**: 原画の上の透明な空（行 0〜371）を切り落とし、1536×652 の WebP（quality 80・透過あり）。遠くの稜線の足元（目の高さ）は切り出した絵の 38 行目（`DESERT_VALLEY_ART.horizon`）
- **検品**: 人物・コース・旗・杭・岩・太陽・字なし／空は透明で、稜線の上端（行 381〜411）だけ半透明のぼかし／夕方は昼と同じ砂丘の形・同じ地平線の高さ／左右に並べて反転しても稜線の高さがそろう
- 横（既定）では読まない（`DESERT_ART` とは別の `DESERT_VALLEY_ART`。`loadDesertArt({ valley: true })` の時だけ）
- 原画の SHA-256（先頭16桁）: `valley_day` 7cd8ff7e5a025890, `valley_dusk` c426aae4a9817c9a

