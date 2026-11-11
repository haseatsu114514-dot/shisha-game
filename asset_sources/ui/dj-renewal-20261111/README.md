# DJ ミニゲームのリニューアルの素材（2026-11-11・DJS20〜25）

オーナー「初見だとゲーム性がわかりづらい。お客さんの反応をわかりやすく、フェーダーのどこを動かすかアナウンスと矢印を。画像生成する場合はコーデックスに頼めます。CSS丸出しな見た目は嫌だ」。画面の説明は `remake/previews/dj/README.md`、台帳は `docs/owner_requests.md` の DJS20〜25。

## 経緯

OpenAI の画像 API（`gpt-image-2.5-sunburst`）で作ろうとしたが、クレジット切れ（`credit_balance_exhausted`）で1枚も生成できなかった。そこで次の3つに分けた。

1. **ゲーム共通の夜のUIキットを使う**（新規生成なし）: 板・ボタン・手順のランプ・メダルは `remake/img/ui/craft-night/`（Codex 生成・シーシャ作りと大会で使用中。原画の記録は `asset_sources/ui/craft-night-20261102/`）をそのまま九分割で使う。
2. **機材まわりの部品はスクリプトで描く**: `make_parts.py`（Pillow と numpy。3倍で描いて縮小、乱数は固定）。出力はこのフォルダに原画を置かず、直接 `remake/img/ui/dj/` の WebP にする（スクリプトが原本）。
3. **人物の絵は Codex へ依頼**（Issue #3224）: フロアの観客4枚（盛り上がり4段階）。依頼文は `CODEX_PROMPTS.md`。**未着**。

## make_parts.py が書き出すもの（`remake/img/ui/dj/`）

| ファイル | 大きさ | 使う場所（`remake/previews/dj/style.css`） |
|---|---|---|
| `play-a.webp`・`play-b.webp`・`play-go.webp` | 256×256 | ▶（A 紫・B 水色・「いま押す」金）。表示 104px |
| `xfader-plate.webp` | 920×240 | 横フェーダーの台座。溝は幅 8.5〜91.5 %・高さ 44 %、左右に A（紫）・B（水色）のランプ |
| `pitch-plate.webp` | 136×340 | PITCH フェーダーの台座 |
| `arrow.webp` | 256×256 | 「いま触るところ」の金色の矢印（右向き。CSS で回す） |
| `chevron.webp` | 120×160 | 横フェーダーの向きの矢印、熱のゲージのボーナス線の印 |
| `bubble.webp`・`bubble-cold.webp` | 560×216 | お客さんの声の吹き出し（良い反応／冷めた反応）。文字は載せない |
| `zone.webp`・`zone-ok.webp` | 224×136 | 横フェーダーの光る枠（追いかける先／乗れているとき） |
| `flame.webp` | 96×96 | 選曲カードのノリ（炎5段階） |
| `heat-frame.webp` | 597×160 | フロアの熱のゲージの枠。`craft-night/thermo-frame.webp` を横向きにしたもの（透明な窓は x 48〜547・y 55〜104） |

描き直すときは `python3 asset_sources/ui/dj-renewal-20261111/make_parts.py`（`remake/img/ui/craft-night/thermo-frame.webp` の実体が要る。LFS のポインタのままなら `git lfs pull --include="remake/img/ui/craft-night/*"`）。形や溝の位置を変えたら `style.css` の対応する数値（`.xtrack`・`#crossfader`・`.heat-bar`）も合わせる。

Codex にもっと良い部品を描いてもらう場合は、同じファイル名・同じ大きさ・同じ溝や窓の位置で作れば、コードを変えずに差し替えられる。

## 4枚が届いたら（フロアの観客）

1. 原画（`floor-1.png`〜`floor-4.png`）をこのフォルダの `raw/` に置く（無加工）。
2. 4枚とも同じ範囲で 1536×512 へ縮小して WebP（quality 88）にし、`remake/img/ui/dj/floor-1.webp`〜`floor-4.webp` に置く。
3. `remake/previews/dj/style.css` の `.floor` の `--art-1`〜`--art-4` を新しい4枚に替え、`.floor-art i[data-level]` の `filter`（明るさと彩度の描き分け）を外す。顔が帯に入るよう `background-position`（いまは `center 76%`）を合わせる。
4. 新しい絵は客がこちらを向くので、手前の手のシルエット（`app.mjs` の `makeHands`・`drawHand`）は消すか本数を減らす。光と音符は残してよい。
5. `node remake/test/browser/dj_preview.mjs` と、PC・スマホ表示の目視。
