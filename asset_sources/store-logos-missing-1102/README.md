# 足りない店のロゴ（2026-11-02 SLG）

状態: **候補9案を保存（未採用・オーナーの選定待ち）**。オーナー決定（2026-11-02）: 画像は Codex で生成する（依頼書 [codex-request.md](codex-request.md)）。

Codex が 2026-11-02 に作った候補（1店3案・1536×1024 の透過 PNG）を、オーナーの指示「まず候補として保存し、採用やゲーム反映は選定後に」で無加工のまま置いた。`shishark-{a,b,c}.png`・`dubai-center-cafe-{a,b,c}.png`・`dubai-alley-cafe-{a,b,c}.png`、来歴は `generation.json`、Codex の検品メモは `QA.txt`、ハッシュは `SHA256SUMS`（受け渡し ZIP の sha256 `6717b8657aa335dc301637d412ef89e38087fcb3b25818eb59745d2aaf50d026`）。比較は Codex の [qa/candidates.jpg](qa/candidates.jpg) と、今のロゴ・暗い面・地図の札（82×46）で並べた [qa/candidates-map-frame.jpg](qa/candidates-map-frame.jpg)。**ゲームにはまだ入れていない**（`STORE_LOGOS` は未変更）。

オーナー依頼（2026-11-02）: 「あと足りないロゴとかもあれば生成したい」。台帳 `docs/owner_requests.md` の SLG01〜SLG05。

## 調べた結果: 全章の地図の行き先

地図のピンは、施設アイコン（`remake/js/daily/facility-icons.js` の `SPOT_ICONS`）→ 店のロゴ（`remake/js/core/store-logos.js` の `STORE_LOGOS`・`LOGO_ALIASES`）→ どちらも無ければ盾（白抜きの汎用の「店」の記号。`remake/js/daily/map.js` の `pinSymbol`）の順で出る。到着時の札（`core/store-arrival.js`）も同じ id でロゴを引く。2026-11-02 の main（`198552b0`）で、実際の `hasFacilityIcon`・`hasStoreLogo` に全行き先の id を通して分けた。

| 地図 | ロゴ | 施設アイコン | 盾のまま |
|---|---|---|---|
| 地元（第1章〜。第2章以降・第3/4章の準備期間・第5章も同じ地図） | tonari・KEMURIKUSA・EDEN・PEPPERMINT・Dr.fookah・C.STATION | 喫茶こはく・観音堂・CHOI-ZAP・家・斧投げBar・路地裏シネマ・路上占い・（第5章）博士に連絡する・東京へ（新幹線） | **SHISHARK**（`shishark`）、（第5章）ドバイへ（飛行機）`ch5_to_dubai` |
| 柚ヶ谷（第2章・準備期間・第5章。第2章初日の巡回地図も含む） | MELTY PUFF・神崎煙草店・零-ZERO-・Dr.fookah 柚ヶ谷店・C.STATION 柚ヶ谷店（初日は県大会ホール）・都市型水族館・銭湯・サウナ・ボドゲカフェ | — | なし |
| 東京（第3章） | mukai・煙幕・Smoke & Glory・鉄の煙・Dr.fookah 東京店・クラブSEAM | 公園・CHOI-ZAP・mukaiの奥の部屋・地元と連絡・路上占い | 路地裏の神社（#2166 の場所決定待ち） |
| 東京（第5章） | mukai・Smoke & Glory・鉄の煙・Dr.fookah 東京店 | 公園・屋根裏・地元へ帰る・路上占い | 路地裏の神社（同上） |
| ドバイ（第4章） | FESTA・Dr.fookah ドバイ店 | スーク・なると会う・公式練習会場・クリーク沿い・風の回廊モスク・宿 | **中心地のカフェ**（`ch4_dubai_cafe`）・**路地裏のカフェ**（`ch4_dubai_alley`）、砂漠ツアーのデスク・砂丘・ラクダレース場（MPI07 で依頼済み） |
| ドバイ（第5章） | なし | なし | **路地裏のカフェ**（`ch5_dubai_alley`）、Dr.fookah ドバイ店・スーク・クリーク沿い・風の回廊モスク（絵はあるのに登録漏れ）、シェイクの屋敷・中庭の太陽・客間・地元へ帰る（空港） |

- ロゴで表すべき店（シーシャの店）で盾のままなのは **SHISHARK・中心地のカフェ・路地裏のカフェの3店**。今回の依頼はこの3店。
- 第4章の旧「自由行動」カード（`chapters/ch4.js` の `renderFree`。日常ループに入る前の古いセーブ用）は `ch4_<場所>` でロゴを引くので、`ch4_center_cafe`・`ch4_alley_cafe` も同じロゴへつなぐ。
- 第3章の東京の行程地図（`chapters/ch3-map.js`）の「訪ねた店」（`ch3_shop`）は名前の無い店なので、ロゴは要らない。
- 地図に出ない店（SMOKE LAB・NIGHTSIDE）は対象外。龍龍水煙所は 2026-11-02 に第4章ドバイの地図へ出たので、下の「追加（DBS08）」で依頼する。

## 作るもの

| 店 | 出る地図 | 登録キー（別名） | 今の表示 | プロンプト | ゲーム用の予定ファイル |
|---|---|---|---|---|---|
| SHISHARK（サメちゃんの店） | 地元（第2章以降・準備期間・第5章の通い店） | `shishark` | 盾（汎用の店の記号） | [shishark-prompt.txt](shishark-prompt.txt) | `assets/ui/store_logos/shishark.webp` |
| 中心地のカフェ | ドバイ（第4章） | `ch4_dubai_cafe`（別名 `ch4_center_cafe`） | 盾 | [dubai-center-cafe-prompt.txt](dubai-center-cafe-prompt.txt) | `assets/ui/store_logos/ch4-dubai-center-cafe.webp` |
| 路地裏のカフェ | ドバイ（第4章・第5章） | `ch4_dubai_alley`（別名 `ch4_alley_cafe`・`ch5_dubai_alley`） | 盾 | [dubai-alley-cafe-prompt.txt](dubai-alley-cafe-prompt.txt) | `assets/ui/store_logos/ch4-dubai-alley-cafe.webp` |

### ロゴに入れる文字

- **SHISHARK**: 英字の `SHISHARK` だけ（正本の綴り。読みは「シーシャーク」＝シーシャ＋シャーク、`data/dialogue/samechan.json`）。カタカナの添え字は入れない（画像AIが崩しやすい）。
- **ドバイの2店**: 正本に店名が無い（地図の名前は「中心地のカフェ」「路地裏のカフェ」）。新しい店名を作らず、**文字の無い紋章・看板**にする。アラビア文字・アラビア文字風の飾りも入れない（読めない偽の文字になる）。地図ではピンの下に名前が出るので、文字が無くても店は分かる。オーナーが店名を決めたら、その名前を入れた版を作り直す。

### 図案

- **SHISHARK**: 背景 `bg_shishark`（店先）の看板と同じ意匠にする。ギザ歯で笑う青いサメが浮世絵風の波から飛び出し、真鍮の枠の紺の板に生成り色のセリフ体で SHISHARK。配色は看板の青・歯ぐきの桃色（`remake/js/motions/shark.js` の `SHARK` と同じ #3d82e6・#2457ad・#ff8fb0）。コロちゃん（王冠のパペット）・フード・本人は描かない。
- **中心地のカフェ**: 背景 `bg_dubai_cafe_day`（白い大理石・金の縁・金の格子のアーチ窓・淡い青のダマスク柄・真鍮のランタン・ナツメヤシ）から、金のアーチ窓と格子・紺の七宝・ランタン・ヤシの葉の紋章。最高級店らしく左右対称。
- **路地裏のカフェ**: 背景 `bg_dubai_alley_cafe_night`（黄土色の漆喰・裸電球・換気扇・真鍮のダッラ・無地の缶・赤と緑のキリム）から、使い込んだ木の吊り看板に真鍮のコーヒーポット（ダッラ）と小さなグラス・裸電球・キリムの帯。中心地のカフェと小さくても見分けがつくよう、金の飾り・大理石を使わない。案Cだけ、常連の男がいつも頼む葉の「紫のラベルの缶」（背景にも描かれている）を文字なしで小さく添える。
- 3店とも**シーシャ機材（台・ハガル・ホース・炭）を描かない**（機材を入れると `docs/shisha_reference.md` §4 の構造確認が要る。店名と店の雰囲気のモチーフで作る）。実在の商標・ロゴ・ランドマーク（ブルジュ・ハリファ、帆の形のホテル）、国や宗教の印（三日月・旗・鷹・王冠）にも似せない。

### 3案の出し方

各プロンプトは本文の後ろに `Candidate A/B/C` の1行がある。1回の生成に「本文＋Candidate の1行」を渡し、A・B・C の3回で3案にする（同じ文で3回引くと似た絵が並ぶため、形を変えた3案にした）。

| 店 | A | B | C |
|---|---|---|---|
| SHISHARK | 店先の看板どおり（横長の板の左上からサメ） | 真鍮の丸窓（店の扉と同じ）をサメが突き破る丸い紋章＋下に横長の板 | 小さくても読める横長の文字板（サメは頭と背びれだけ） |
| 中心地のカフェ | 縦長のアーチの紋章 | 地図向けの横長の飾り板（中央にアーチ） | 丸いメダル |
| 路地裏のカフェ | 木の吊り看板 | 壁に直付けの横長の板＋上に裸電球 | 丸いブリキの看板（紫の缶を添える） |

## 画風の基準（参照画像に渡す）

既存の店ロゴは 1536×1024 の透過PNGで作り、768×512 の可逆WebPにして全体を表示している（第2章以降。`asset_sources/ch2-store-logos/README.md`）。店名の文字がいちばん大きい、細かく描き込んだ看板・紋章型（mukai・煙幕・Smoke & Glory・神崎煙草店・零-ZERO-・MELTY PUFF）。地図では生成り色（#fffaf0）の看板の中に 82×46 で出る。第3・4章の地図の詳細欄は暗い面（#1f1a29）に 180×104 で出る。

| 店 | 1枚目（意匠・配色の基準） | 2・3枚目（仕上げの基準。題材と文字は真似しない） |
|---|---|---|
| SHISHARK | `remake/img/backgrounds/bg_shishark.webp` の看板を切り出す（x=700, y=30, 幅610, 高さ320。建物・電灯・右下の黒板を入れない） | `assets/ui/store_logos/ch3-smoke-and-glory.webp`・`assets/ui/store_logos/melty-puff.webp` |
| 中心地のカフェ | `remake/img/backgrounds/bg_dubai_cafe_day.webp`（全体。モチーフと配色だけ） | `assets/ui/store_logos/kanzaki.webp`・`assets/ui/store_logos/ch3-smoke-and-glory.webp` |
| 路地裏のカフェ | `remake/img/backgrounds/bg_dubai_alley_cafe_night.webp` の右上を切り出す（x=560, y=0, 幅720, 高さ320。電球・換気扇・ダッラ・缶・キリム。**台の写る下側を入れない**） | `assets/ui/store_logos/kanzaki.webp`・`assets/ui/store_logos/ch3-smoke-and-glory.webp` |

切り出し例（Pillow）: `Image.open(src).crop((x, y, x + w, y + h)).save(out)`。参照に使う画像は LFS なので、要るものだけ取る（下の依頼書のコマンド）。

## 組み込み手順（オーナーが採用した後）

1. 原画（3案とも）を無加工で `asset_sources/store-logos-missing-1102/<名前>-<a|b|c>.png` に保存する。名前は `shishark`・`dubai-center-cafe`・`dubai-alley-cafe`。`generation.json` にプロンプトのファイル名・使った Candidate・ツール・サイズ・SHA-256・透過の有無・添付した参照を書く（`asset_sources/map-icons-1102/generation.json` と同じ形）。
2. 比較画像 `asset_sources/store-logos-missing-1102/qa/candidates.jpg`: 1店1行で A・B・C を並べ、各案の下に「生成り色 #fffaf0 の 82×46」と「暗い #1f1a29 の 180×104」に縮めた見本を付ける。既存ロゴ（mukai・神崎煙草店・FESTA）を同じ大きさで横に置く。
3. 採用案を、全体を 768×512 に縮めた透過の可逆WebPにして予定ファイル名で置く（第2章のロゴと同じ: `magick <原画>.png -resize 768x512 -define webp:lossless=true <予定ファイル>.webp`）。描き直し・背景の手作業の消去はしない。縁に薄い半透明の光彩が残ったら、SEAM と同じく透過60以下を0にしてよい（`asset_sources/ch3-store-logos/seam/README.md`）。新しい画像は Git LFS（`git lfs ls-files` で確認）。
4. `remake/js/core/store-logos.js` に登録する。`frame` は余白が大きければ、ロゴの外形＋数pxに詰める（SEAM と同じ。地図の 82×46 で小さくなりすぎないように）。

   ```js
   // STORE_LOGOS に追加
   shishark: { name: "SHISHARK", file: "shishark", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
   ch4_dubai_cafe: { name: "中心地のカフェ", file: "ch4-dubai-center-cafe", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
   ch4_dubai_alley: { name: "路地裏のカフェ", file: "ch4-dubai-alley-cafe", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
   // LOGO_ALIASES に追加（ch5_dubai_shop は今の登録漏れ。Dr.fookah の絵を使う）
   ch4_center_cafe: "ch4_dubai_cafe", ch4_alley_cafe: "ch4_dubai_alley", ch5_dubai_alley: "ch4_dubai_alley", ch5_dubai_shop: "shop",
   ```

   白い文字が主のロゴになったら `dark: true` を付ける（地図の看板と到着の札が暗くなる）。
5. テスト: `remake/test/store_logo_fallback.mjs` の別名の表に `ch4_center_cafe`・`ch4_alley_cafe`・`ch5_dubai_alley`・`ch5_dubai_shop` を足し、`shishark`・`ch4_dubai_cafe`・`ch4_dubai_alley` が `hasStoreLogo` で真になることを確かめる。`node --experimental-vm-modules remake/test/store_logo_fallback.mjs`、`node remake/test/store_logos.mjs`（第1章の地図。SHISHARK は第2章からなので変わらない）、`node remake/test/browser/ch4_dubai_daily.mjs` を通す（後の2つはプレビューサーバーを先に起動）。
6. 実画面で確かめる: 第2章以降の地元（SHISHARK `x58 y38` と KEMURIKUSA・EDEN・喫茶こはくの名札が重ならない）、第4章のドバイ（中心地のカフェ `x70 y52`、路地裏のカフェ `x30 y78` とスーク・Dr.fookah ドバイ店）、第5章のドバイ（路地裏のカフェと Dr.fookah ドバイ店 `x40 y50`）。到着時の札にもロゴが出ること。ロゴの看板は盾より横に広い。

## 追加（DBS08・2026-11-02）: 龍龍水煙所

第4章ドバイの日常の地図に、王煙楼の店「龍龍水煙所」（中国伝統の水煙の老舗が世界大会に合わせて出したドバイの店。`ch4_dubai_longlong`、`x58 y50`）が入った（台帳 DBS05・DBS08）。ロゴが無いので今は盾。

| 店 | 出る地図 | 登録キー | 今の表示 | プロンプト | ゲーム用の予定ファイル |
|---|---|---|---|---|---|
| 龍龍水煙所（王煙楼の店のドバイの店） | ドバイ（第4章） | `ch4_dubai_longlong` | 盾 | [longlong-prompt.txt](longlong-prompt.txt) | `assets/ui/store_logos/ch4-longlong.webp` |

- 文字: 正本の店名 `龍龍水煙所`（`data/characters.json` の `master_hookah.affiliation`・`brand/character_profiles.md`。読みはロンロン・シュイイェンスオ、簡体字 龙龙水烟所）。画像AIが漢字を崩しやすいので、A は5字、B は「龍龍」の2字だけ、C は文字なしの3案。崩れた字・余計な字・偽の判子があれば不採用。
- 図案: 黒漆の扁額に深紅の地・古金の縁、祥雲（雲の渦）で描いた細い龍が一匹（王煙楼の「龍の煙」の意匠を、煙そのものではなく雲の渦で表す）。配色は王煙楼の装束（深紅・黒・古金）に寄せ、翡翠色を少し。シーシャ機材・煙の柱・国の印（旗・星）を描かない。
- 参照画像: 1枚目は意匠・配色の基準として王煙楼の立ち絵 `assets/sprites/characters/master_hookah/chr_master_hookah_normal.png`（**装束の色と刺繍の質感だけ**。人物は描かない）、2・3枚目は仕上げの基準 `assets/ui/store_logos/kanzaki.webp`・`assets/ui/store_logos/ch3-smoke-and-glory.webp`。
- 組み込み: 上の手順1〜6と同じ。`STORE_LOGOS` に `ch4_dubai_longlong: { name: "龍龍水煙所", file: "ch4-longlong", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] }`。実画面は第4章のドバイ（龍龍水煙所 `x58 y50` と中心地のカフェ・Dr.fookah の店先・風の回廊モスクの名札が重ならない）。
- 店の背景（`bg_dubai_longlong` の予定）も無く、今は `bg_hideaway` を仮に使っている。背景は `tools/bg_prompts.txt` の共通指針で別に頼む（ここでは作らない）。

## 参考: ロゴではない抜け（今回の依頼書の対象外）

- **第5章のドバイ**: スーク・クリーク沿い・風の回廊モスクは第4章の施設アイコンがあるのに、`SPOT_ICONS` に `ch5_dubai_souq`・`ch5_dubai_creek`・`ch5_dubai_mosque` が無く盾になっている。新しい絵は要らず、`facility-icons.js` に3行足して `remake/test/facility_icons.mjs` の一覧に加えれば出る。
- **第5章のドバイで絵の無い行き先**: シェイクの屋敷・中庭の太陽（太陽が遊びに来ている屋敷の中庭）・客間・地元へ帰る（空港）と、地元の「ドバイへ（飛行機）」。作るなら地図アイコン（`asset_sources/map-icons-1102/` の続き）で、オーナーの判断待ち。
