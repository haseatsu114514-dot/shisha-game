# 公式プロモーションサイト（promo/）

「水煙前線 -EN:CODE-」の公式サイト。ビルド不要の静的ページで、このフォルダの中だけで完結する（ゲームのフォルダは読まない）。
公開先は GitHub Pages の `/promo/`（`.github/workflows/deploy-pages.yml` が main への push で配置する）。

```bash
# 手元で見る（リポジトリのルートで）
python3 -m http.server 8124 --bind 127.0.0.1
# → http://127.0.0.1:8124/promo/
```

## つくり

| 場所 | 中身 |
|---|---|
| `index.html` | 文章と構成。**文章はここを直接書き換える**（人物・店も1人ずつ書いてある） |
| `css/site.css` | 配置と文字組み。色や質感は画像で出し、CSSで模様を描かない |
| `js/site.js` | 絵の切り替え・人物の切り替え・地図の昼夜・拡大表示。外部ライブラリなし |
| `img/` | サイト用に大きさを整えた絵（下のスクリプトの出力）。`img/sources.json` は「どの絵から作ったか」の記録 |
| `fonts/` | サイトで使う文字だけを入れた軽いフォント |
| `tools/` | 絵・フォントの作り直し、画面の撮影、点検（公開物には入れない） |

画面の質感は3種類の「地」と小さな部品で作っている。

- **紙**（導入・舞台）、**ラベンダーの紙**（作品情報）、**夜の紙**（登場人物・場面・フッター）、**カウンターの木目**（遊びかた）
- **ちぎった紙の縁**（暗い面と紙の面の境目）、**マスキングテープ**（画面写真の上）、**短冊**（人物の一言）
- **ボタン**はゲームのシーシャ作りの現行スキンのボタンの絵（金・白）をそのまま使う

絵はすべてゲームの採用済み素材で、サイト用に描き足した人物やシーシャ機材は無い。

## 載せる絵は「ゲームの今の採用」だけ

没にした絵・差し替え前の絵を載せないよう、**どの絵を使うかはゲームのコードの採用表から読む**（`tools/build_images.py`）。

| サイトの絵 | 読む採用表 |
|---|---|
| トップのキービジュアル（1キャラ1枚） | `remake/js/core/title-art-unlock.js` の `TITLE_KEY_VISUALS` |
| 立ち絵・顔 | 採用済みの新版 `remake/img/sprites/character_variants/new/`・`ui/face_icons/new/`（`portrait-style.js` の既定） |
| 人物の背景とポスター調の絵・置き方 | 登場カットインの新しい絵柄（`remake/js/vn/intro-graphic.js` の `FRAME_OVERRIDES`） |
| 人物の肩書き・一言・色 | `data/characters.json` の `intro_cutin`（`index.html` に書いてある。変えたら合わせる） |
| 章題の絵 | `remake/js/core/chapter-title-art.js`（採用済みの1枚絵をそのまま。人物を切り分けた絵は使わない） |
| 店の中の絵 | `remake/js/daily/spots.js` の `SPOT_PREVIEW`（入ったときの背景） |
| 店のロゴ | `remake/js/core/store-logos.js` の採用部分 |
| ボタン | `remake/css/craft-paper.css` の `--cp-button-amber`・`--cp-button-primary` |
| 遊びかたの画面 | ゲームを動かして撮る（プレイヤーの既定の見た目＝新版で撮る） |

```bash
python3 promo/tools/build_images.py --check   # ゲーム側の絵・採用が、書き出した後に変わっていないか（絵の実体が無くても調べられる）
```

**公開のたびに、公開用の手順がサイトの絵をゲームの今の採用から作り直す**ので、ゲーム側で立ち絵やキービジュアルを差し替えれば、公開されるサイトも次から同じ絵になる。
リポジトリに入っている `img/` は、手元やプレビューで見るための写し。採用を変えた（別の場面の絵にした・店の背景を替えた）ときは、絵に添えた説明文（`index.html` の `alt` と `data-caption`）が合っているかを見て、下の手順で写しも作り直す。画面写真（`img/system/`）は自動では変わらない。

## 更新のしかた

### 文章を直す

`index.html` を書き換える。**新しい漢字を足したらフォントを作り直す**（足りない字は端末の明朝体・ゴシック体で出る）。

```bash
pip install fonttools brotli        # 初回だけ
python3 promo/tools/build_fonts.py  # フォントを作り直す
python3 promo/tools/build_fonts.py --check   # 足りない字が無いかだけ見る
```

### ゲームの絵が差し替わったら

```bash
git lfs pull --include="$(python3 promo/tools/build_images.py --sources | paste -sd, -)"   # 元にする絵だけ取得
python3 promo/tools/build_images.py          # 全部（一部だけなら hero / story / cast / world / gallery / ui）
```

書き出しの最後に、`index.html` の `<img>` の `width`・`height` と、人物のポスター調の絵の置き方（ゲームの登場カットインと同じ数字）を自動で合わせる。

### 質感パーツ（紙・木目・縁・テープ・OGP・アイコン）

```bash
python3 promo/tools/build_parts.py --textures asset_sources/promo-site-20261111/textures
```

### 画面写真（遊びかた）

`img/system/` はゲームの実画面（1280x720 を2倍で撮ったもの）。`tools/capture/` のスクリプトが、ゲームを実際に動かして候補を書き出す。

```bash
python3 remake/tools/serve_preview.py --port 8123      # ゲームを起動
export PROMO_SHOTS=/tmp/promo-shots                    # 書き出し先（リポジトリの外）
node promo/tools/capture/map.cjs                       # 地図（昼・夜）
node promo/tools/capture/vn.cjs sumi                   # 会話（sumi / tsumugi / minto / adam / naru）
node promo/tools/capture/lime.cjs                      # スマホの連絡
node promo/tools/capture/craft.cjs                     # シーシャ作り（配合・詰め・穴あけ・炭）
node promo/tools/capture/tournament.cjs                # 大会（開幕・審査員・中間投票・結果発表）
node promo/tools/capture/axe.cjs                       # 斧投げ
node promo/tools/capture/reel.cjs                      # スロット
python3 promo/tools/build_images.py screens $PROMO_SHOTS   # 採用する画面を img/system/ へ書き出す
```

- **プレイヤーが実際に見る見た目で撮る。** ゲームは自動操作のブラウザでは見た目の様式を旧版にするので（`remake/js/core/look.js`）、撮影側でその印を外し、既定の様式（新版）で撮っている（`capture/common.cjs`）。既定の様式が変わったら撮り直す。
- どの画面をどの名前で使うかは `build_images.py` の `SCREENS`。斧投げとスロットは連続で撮った候補（`$PROMO_SHOTS/candidates/`）から1枚選び、`SCREENS` にある名前で `$PROMO_SHOTS/` に置いてから書き出す。
- 撮影スクリプトはゲームの内部（`remake/js/` のモジュールや `data-test` 属性）を直接呼ぶ。ゲームの画面や進行を作り変えたら、動かなくなった所を直す。セーブはブラウザの中だけで、リポジトリのファイルは変えない。
- 載せるのは第1〜2章の画面まで。デバッグ表示・読み込み途中・台詞の出かけは撮らない。

### 点検

```bash
node promo/tools/check.mjs                    # CIの quick でも動く
python3 promo/tools/build_images.py --check   # ゲームの今の採用と合っているか
```

`check.mjs` は、絵・フォントの参照切れ、ページ内リンク、人物と店の切り替えの対応、どこからも使っていない絵が `img/` に残っていないかを見る。

## 「遊ぶ」ボタンと公開先

- 「遊ぶ」は `../remake/`（公開先でサイトの隣にあるゲーム本体）へのリンク。サイトをドメインの直下へ置く場合は、`index.html` の `../remake/` 3か所を `./remake/` に変える。
- 公開前に「遊ぶ」を止めたいときは、`index.html` の `<body data-play="open">` を `data-play="soon"` にする。3か所のボタンが「近日公開」に変わり、リンクが外れる。
- SNSで共有されたときの絵と説明は `index.html` 冒頭の `og:` の行。公開先のURLを変えたら `og:url` と `og:image` も直す。

## 載せる内容の決まり

`docs/marketing/sns_operation.md` に合わせる。

- 人物・店・場面は**第1〜2章で出会う範囲**まで。第3章以降は章題だけを載せている。
- 「公式で伏せること」（本名・正体・味覚の不調・第5章の中身など）は書かない。みんとは「自称20歳」の表記のまま。
- AIの開示文・喫煙の注意書きは足さない。喫煙をすすめる言い回しを使わない（千須の「吸えば分かる」は載せていない）。
- 公式タグは `#水煙前線` と `#水煙前線ファンアート`。

## 素材の出典

| 素材 | 出典 | ライセンス |
|---|---|---|
| 絵（キービジュアル・人物・背景・店ロゴ・CG・ボタン・画面写真） | ゲームの採用済み素材（`remake/img/`・`assets/ui/store_logos/`）。1枚ずつの対応は `img/sources.json` | 本作 |
| 紙の地 | [ambientCG Paper001](https://ambientcg.com/view?id=Paper001)（1K-JPG・Color／Displacement） | CC0 1.0 |
| クラフト紙の地 | [ambientCG Paper006](https://ambientcg.com/view?id=Paper006)（1K-JPG・Color） | CC0 1.0 |
| カウンターの木目 | [ambientCG Wood067](https://ambientcg.com/view?id=Wood067)（1K-JPG・Color） | CC0 1.0 |
| Zen Old Mincho／Zen Kaku Gothic New／DotGothic16 | ゲームに同梱のフォント（`remake/fonts/`・`assets/fonts/`）から切り出し | SIL OFL 1.1 |
| Cormorant Garamond | [google/fonts の ofl/cormorantgaramond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond) から英数字だけ切り出し | SIL OFL 1.1 |

ambientCG のテクスチャは 2026-11-11 に取得（作者 ambientCG / Lennart Demes。CC0 のため表記は任意）。原本は `asset_sources/promo-site-20261111/textures/`。
ちぎった紙の縁・テープは、その紙の地から `build_parts.py` が形を付けて作る（乱数の種は固定）。フォントのライセンス文は `fonts/OFL-*.txt`。
