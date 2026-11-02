# Codex への依頼: 龍龍水煙所のロゴ・店の背景と、ドバイの葉4種の箱絵（DBS08・DBS03）

このファイルは Codex がそのまま実行する依頼書。まず `AGENTS.md`（Git・通信量・LFS・PR の決まり）を読む。
**PR #2400（龍龍水煙所の店。#2392 のドバイの葉を含む）が main に入ってから始める**（ロゴのプロンプトと `ch4-longlong.js` がそこで入る）。

## 作るもの（すべて候補。オーナーが選ぶまでゲームに入れない・マージしない）

| | 作るもの | プロンプト（言い換えずにそのまま使う） | 案の数 | 候補の保存先（原画は無加工） |
|---|---|---|---|---|
| 1 | 地図のロゴ（`ch4_dubai_longlong`） | `asset_sources/store-logos-missing-1102/longlong-prompt.txt` | A・B・C | `asset_sources/store-logos-missing-1102/longlong-{a,b,c}.png` |
| 2 | 店の背景 `bg_dubai_longlong` | `tools/bg_prompts.txt` の **LL01** | 3案 | `asset_sources/backgrounds/dubai-longlong-20261102/candidate-{a,b,c}.png` |
| 3 | 箱絵4種（Dr.fookah ドバイ店の「ドバイの定番」） | この下の「3. 箱絵」のブロック | 1種3案（計12枚） | `asset_sources/dubai-longlong-art-1102/boxes/<商品ID>-{A,B,C}.png` |

参照画像のうち LFS のものだけ取る: `git lfs pull --include="assets/sprites/characters/master_hookah/chr_master_hookah_normal.png,assets/ui/store_logos/ch3-smoke-and-glory.webp"`（ほかは checkout に実体がある）。

## 1. ロゴ

`asset_sources/store-logos-missing-1102/README.md` の「追加（DBS08）」節がすべて（文字・図案・参照画像3枚・組み込み）。生成・検品・比較画像の作り方は同じフォルダの `codex-request.md` と同じ（1536x1024・透過、A・B・C を1回ずつ）。漢字の崩れ・余計な字・偽の判子は不採用。比較画像は `asset_sources/store-logos-missing-1102/qa/longlong-candidates.jpg`。

## 2. 店の背景（`bg_dubai_longlong`）

- **1枚・時間帯の末尾なし**にする。ドバイの店の背景は1枚で昼夜どちらの枠にも出している（中心地のカフェ `bg_dubai_cafe_day`・路地裏 `bg_dubai_alley_cafe_night`・FESTA `bg_dubai_festa`。`remake/js/core/data.js` の `BG_TIME_BASE` にドバイの場所は無い）。龍龍水煙所の来店の場面も時間帯を見ずに同じ絵を出す（`ch4-dubai-daily.js` の `readPlain`）。そこで窓の外を格子と薄布で隠し、時間帯の読めない店内にする（FESTA・シェイクの屋敷と同じ扱い）。
- 店の個性: 中国の水煙の老舗が、世界大会のあいだだけドバイの建物（クリーム色の漆喰・石の床・空調の吹き出し口）の一区画を借り、本店の黒漆・深紅・古金の調度を持ち込んだ店。翡翠色は少しだけ。EDEN（赤と緑のクッション・モザイクランプ）や `bg_hideaway` と並べて見分けがつくこと。

### 生成前の8行（`docs/shisha_reference.md` §4.3）

```
人物      : なし（背景）
場面      : 客席の台＝完成・提供前（誰も吸っていないので煙なし）／奥の台＝準備中（ボウル未装着。先端は小さな凸型の金属ポスト、ホースは外してある）
台の型    : 日本のシーシャバーの業務用（細いステンレスのステム＋幅の広い透明ガラスのベース、小さめの受け皿）。2台とも同じ型で、ステムは黒い仕上げに古金色の細い輪（LL01 の slim black stainless-steel stem）。彫金の伝統型にしない
HMD       : 客席の台だけ。ターキッシュリッド型（暗い青銅色）1モデル＋80feet系の口の広い低い陶器のハガル（深い翡翠色の釉）
炭        : 客席の台はHMDの中に小さな角炭3個（通気口に赤みが少し見えるだけ）。奥のカウンターの電熱コンロに小さな角炭4個を一列。使い終えた炭は蓋を閉めた壺の中で見せない
ホース    : 客席の台だけ1本。ステム側面のポート → 一度だけたわむ → 硬い木のハンドル。ハンドルは低いテーブルの角に置く。奥の台はホースを外す（置いてあるだけの準備の台なので可。docs/asset_ai_guidance.md「店ごとの個性と照明」）
吸い口    : なし
構図      : 入口のすぐ内側から目の高さで奥を見る。客席の台は画面右の低いテーブルの脇の床で、ソファの背もたれと同じ高さ・同じ奥行き、受け皿とステム上部が見える。中央手前は立ち絵用に空ける。内装は §4.0.5 の日本の型ではなく龍龍水煙所の設定どおり（指定あり。台・HMD・ソファ席だけ日本の店に合わせる）。外光は格子と薄布越しで時間帯が出ない
```

### 添付する画像（役割ごと。早見表・構造図・`drawing-sheet/`・NG例・この依頼書は渡さない）

| 役割 | 渡すもの | 添える一言 |
|---|---|---|
| 画風 | `assets/backgrounds/bg_eden_shop.png`（店内の基準画像） | 画風と光の質感だけ。構図・ランプ・赤と緑のクッションは真似しない |
| 台の全体・縮尺（必須） | siryou `web-refs/images/` の台から、細いステム＋幅の広いガラスベースの**全体が写る**1枚（一覧は `web-refs/README.md`）と `photos/stand-lounge-japan-01.jpg` | photos は「構造と縮尺だけ。内装・台の装飾は写さない」 |
| HMD・ボウル | `web-refs/images/` の HMD・ボウルから、ターキッシュリッド型が口の広い低い陶器ボウルに載った1枚 | 接写なら「形だけを見る。写真の中の大きさは真似しない」 |
| 炭 | `web-refs/images/` の炭から角炭の1枚 | 同上 |

siryou は非公開リポジトリ（PC では `../siryou/shisha-hardware-reference/`。無ければ `AGENTS.md` のとおり clone）。読めない環境ならオーナーが写真をチャットに添付する。**写真をゲームのリポジトリに入れない**（`generation.json` にはパスだけ書く）。日本の店の内装写真は渡さない（部屋は店の設定で描く）。水烟袋の写真は無いので文で描く。

### 生成と保存

- LL01 を1回ずつ3回生成（2048x1152 以上・16:9・不透過）。原画は無加工で上の保存先へ。同じフォルダに `prompt.txt`（実際に渡した全文）、`generation.json`（ツール・サイズ・SHA-256・添付した参照のパス）、上の8行を写した `README.md`。
- 比較画像 `asset_sources/backgrounds/dubai-longlong-20261102/qa/candidates.jpg`: 3案と、今の仮置き `bg_hideaway`・`bg_eden_shop` を並べ、各案の下に下のチェックの測定値を書く。

### 生成後チェック（`docs/shisha_reference.md` §4.4。原寸で見る。1つでもNGなら作り直す）

- [ ] 積み順: ベース→ステム→受け皿→ハガル→HMD→炭。ステムはベースの口に真っ直ぐ差さる。客席の台はHMD付きで直炭でない。HMDの蓋・通気口が1モデルの組
- [ ] 奥の台の先端は小さな凸型の金属ポストだけ（カップ型・ボウル一体型・大きな先端パーツでない）。ハガル・HMD・炭が載っていない
- [ ] 縮尺を測る（§4.1.1。人物がいないので顔との比は対象外）: ハガル＋HMD＋炭の高さ÷台全体の高さが0.12〜0.2。HMDの径÷受け皿の径が0.3〜0.5。台の上端がソファの背もたれくらい。ハガルの脚が潰れていない
- [ ] ホースはポート→ハンドル、ハンドル→ポートの両方向になぞって1本。分岐・第三の端・途切れ・輪なし。パージ・ボウル・受け皿・ベースの底から生えていない（[NG実例](../shisha-hardware-reference/ng-examples/README.md)。`git show origin/main:asset_sources/shisha-hardware-reference/ng-examples/README.md`）
- [ ] 煙が出ていない。コンロの炭は指先ほどの角炭4個で、炎・赤い岩の山になっていない
- [ ] 水烟袋は手のひら大の真鍮の手持ちの道具で、台・ホース・ガラスのベースが無い（水たばこの台に見えない）。急須はこぶし大・杯は指先ほどで、ハガルと形が混ざっていない
- [ ] 文字なし（漢字・掛け軸・対聯・判子・ラベル・看板の文字・アラビア文字）。旗・赤い星・祭壇・神像など国や宗教の印なし。実在の店・製品に似ていない
- [ ] 窓の外の空・景色が見えず、時間帯が読めない。暗さを焼き込んでいない（影の中も読める）。中央手前が空いている
- [ ] `bg_hideaway`・`bg_eden_shop` と並べて別の店に見える（黒漆・深紅・古金・クリームの漆喰。モザイクランプ・キリム・植物なし）

### 採用後の組み込み（オーナーが選んでから同じ PR で）

1. 採用原画を LANCZOS で 1920x1080 RGB PNG に縮小し `assets/backgrounds/bg_dubai_longlong.png`（新規画像は LFS。`git lfs ls-files` で確認）→ `python3 remake/tools/build_manifest.py`。
2. `remake/js/chapters/ch4-longlong.js` の `LONGLONG_BG` を `"bg_dubai_longlong"` にし、「仮置き」のコメントを直す。`remake/js/core/data.js` の `BG_NO_NIGHT_TINT` に `"bg_dubai_longlong.png"` を足す（今の `bg_hideaway` と同じく、夜の地図の下見でも色調を掛けない）。
3. `python3 tools/background_catalog.py sync` → `check` → `sheet`。台帳の `prompt` に `tools/bg_prompts.txt LL01`。
4. `node remake/test/ch4_longlong.mjs`、プレビューサーバーを起動して `node remake/test/browser/ch4_dubai_daily.mjs`。ドバイの昼・夜の枠で龍龍水煙所に入り、絵と立ち絵の重なりを実画面で見る。

## 3. 箱絵（`absal_double_apple`・`dobaj_double_apple`・`absal_mint`・`dobaj_mint`）

調べた決まり（2026-11-02 の main）:

- 4種とも `data/flavors.json` にある葉で、メーカーは作中の架空メーカー（`afsahr`＝アフサール、`dobaj`＝ドバジ。`docs/shisha_reference.md` §0）。実在の製品・ロゴ・包装は描かない。
- 箱には文字を入れず、メーカーは**紋章と箱の意匠**で表す（`asset_sources/flavor-packages-maker-fix-20261028/INVENTORY.md`）。アフサール＝淡い色の紙箱・日の出アーチの紋章（正面上と右側面）・斜めの帯・丸い枠の絵（`remake/img/shop/remaining8/lychee.webp` など）。ドバジ＝生成り白の箱・正面左の黒帯と黒い右側面に白い抽象の紋章・流れる帯（`remaining8/mango.webp` など）。
- 書式・参照・変換は直近の NF04（`asset_sources/new-flavor-cartons-nf04/PROMPTS.md`・`README.md`）と同じ: メーカーごとに既存の箱1枚を添付、正方形の透過 PNG（1024px 以上）、1種3案。ゲームでは 512x512 の WebP になり、店の棚では66px前後で見える。
- 今は4種とも絵が無く、店では文字の箱で出る（台帳 DBS03）。

```text
Common rules for every image below:
Create ONE isolated upright rectangular shisha tobacco carton for a fictional game manufacturer.
Match the attached reference carton exactly in packaging design system: the same 3/4 perspective,
compact proportions, softly rendered matte paper, gentle studio light, emblem placement, layout and
illustration style. Truly transparent background, square canvas (1024x1024 or larger), the whole
carton fully inside the frame with generous margins, no cast shadow on the background.
No words, letters, numerals, readable labels or watermark. No people, no hookah, no other products.
This is an original fictional game asset, not a reproduction of a real product.

--- 1/4: asset_sources/dubai-longlong-art-1102/boxes/absal_double_apple-{A,B,C}.png （添付: remake/img/shop/remaining8/lychee.webp） ---
Keep the pale matte paper carton style of the reference, the same small dark sunrise-over-water-lines
emblem on the upper front and on the right side, the diagonal ribbon across the front and the round
cream vignette. Change the carton color to warm pale sand beige, the diagonal ribbon to a deep
apple-red ribbon, and the round vignette illustration to one red apple and one green apple side by
side with a single star anise pod in front of them, drawn in the same clean geometric painted style
as the lychee.

--- 2/4: asset_sources/dubai-longlong-art-1102/boxes/absal_mint-{A,B,C}.png （添付: remake/img/shop/remaining8/lychee.webp） ---
Keep the pale matte paper carton style of the reference, the same small dark sunrise-over-water-lines
emblem on the upper front and on the right side, the diagonal ribbon across the front and the round
cream vignette. Change the carton color to pale cool blue-grey, the diagonal ribbon to a deep
spearmint-green ribbon, and the round vignette illustration to a sprig of spearmint with pointed,
serrated dark green leaves, drawn in the same clean geometric painted style as the lychee.

--- 3/4: asset_sources/dubai-longlong-art-1102/boxes/dobaj_double_apple-{A,B,C}.png （添付: remake/img/shop/remaining8/mango.webp） ---
Keep the cream-white carton of the reference with the black vertical band on the left of the front and
the black right side panel, the same small white stylized emblem on both black areas, and the flowing
swoosh ribbon. Change the swoosh ribbon colors to glossy apple red and fresh apple green and replace
the mango illustration with one glossy red apple and one green apple, slightly overlapping, drawn in
the same flat illustrated style.

--- 4/4: asset_sources/dubai-longlong-art-1102/boxes/dobaj_mint-{A,B,C}.png （添付: remake/img/shop/remaining8/mango.webp） ---
Keep the cream-white carton of the reference with the black vertical band on the left of the front and
the black right side panel, the same small white stylized emblem on both black areas, and the flowing
swoosh ribbon. Change the swoosh ribbon colors to cool mint green and soft white and replace the mango
illustration with a fresh sprig of peppermint with soft, rounded bright green leaves, drawn in the
same flat illustrated style.
```

### 生成後チェックと比較画像

- [ ] 箱が1つだけで全体が画像内。背景が本当に透過（市松模様・影なし）
- [ ] 文字・数字・実在のロゴが無い。紋章は参照の箱と同じ形（アフサールの日の出アーチ／ドバジの白い抽象マーク）
- [ ] 中身が商品名どおり（赤と緑のりんご2個、アフサールは八角1つ。ミントはアフサールが尖ったスペアミント、ドバジが丸いペパーミント）
- [ ] 66px に縮めて、同じ味のアフサールとドバジ、日本の店の AF の黒箱（`remake/img/shop/heaven10/double_apple.webp`・`mint.webp`）を見分けられる
- 比較画像 `asset_sources/dubai-longlong-art-1102/qa/boxes.jpg`: 1種1行で A・B・C、横に参照の箱と同じ味の AF の箱、各案の下に66pxの縮小。`generation.json` にプロンプト・ツール・サイズ・SHA-256・添付した参照を書く（NF04 の `codex-generation-log.json` と同じ中身）。

### 採用後の組み込み（オーナーが選んでから同じ PR で）

1. 採用原画の SHA-256 を `asset_sources/dubai-longlong-art-1102/boxes/sources.json` に固定し、NF04 と同じ変換（alpha≤4 を0 → 512x512 LANCZOS → WebP q88、箱の範囲を測る）で `remake/img/shop/dubai/<商品ID>.webp` と `remake/js/daily/shop-art-dubai.js`（`DUBAI_FLAVOR_ART`）を作る。`tools/build_new_flavor_art.py` と `remake/test/shop_new_flavors_dubai.mjs` は NF04 の7種ちょうどを前提にしているので、NF04 の表には足さない（同じ形の変換を別に用意する）。
2. `remake/js/daily/shop.js` の `generatedFlavorArt` に `DUBAI_FLAVOR_ART` を足し、`remake/test/shop_new_flavors_dubai.mjs` に「4種とも512角・配信先・文字の箱に落ちない」を足す。Dr.fookah ドバイ店で4種が箱で出ることを実画面（PC・タッチ）で見る。

## PR

1. 最新 `origin/main` から branch を作り、候補（原画・`generation.json`・比較画像）を保存して **Ready for review** で PR を出す。比較画像3つ（ロゴ・背景・箱）を PR に貼る。
2. **オーナーが採用案を選ぶまでゲームに入れず、マージしない**。不採用は作り直す。
3. 採用後、上の各「組み込み」を同じ PR で行い、台帳 `docs/owner_requests.md` の DBS08（背景・ロゴ）と DBS03（「4種の箱絵はまだ無く」）を更新する。
