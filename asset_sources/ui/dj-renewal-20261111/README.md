# DJ ミニゲームのリニューアルの素材（2026-11-11・DJS20〜25）

オーナー「初見だとゲーム性がわかりづらい。お客さんの反応をわかりやすく、フェーダーのどこを動かすかアナウンスと矢印を。画像生成する場合はコーデックスに頼めます。CSS丸出しな見た目は嫌だ」。画面の説明は `remake/previews/dj/README.md`、台帳は `docs/owner_requests.md` の DJS20〜25。

## 経緯

OpenAI の画像 API（`gpt-image-2.5-sunburst`）で作ろうとしたが、クレジット切れ（`credit_balance_exhausted`）で1枚も生成できなかった。そこで次の3つに分けた。

1. **ゲーム共通の夜のUIキットを使う**（新規生成なし）: 板・ボタン・手順のランプ・メダルは `remake/img/ui/craft-night/`（Codex 生成・シーシャ作りと大会で使用中。原画の記録は `asset_sources/ui/craft-night-20261102/`）をそのまま九分割で使う。
2. **機材まわりの部品はスクリプトで描く**: `make_parts.py`（Pillow と numpy。3倍で描いて縮小、乱数は固定）。出力はこのフォルダに原画を置かず、直接 `remake/img/ui/dj/` の WebP にする（スクリプトが原本）。
3. **人物の絵は Codex へ依頼**（Issue #3224）: こっちを向いて盛り上がる観客4枚（盛り上がり4段階）と、同じ構図で誰もいない店内1枚。顔のある4枚は PR #3233 で届いたが、オーナーの判断（DJS31）で客は**シルエット**にした。シルエットの4枚と店内の1枚は 2026-11-11 に zip で届き、`raw/` に置いて組み込んだ（DJS32。下の「フロアの2層」）。

## make_parts.py が書き出すもの（`remake/img/ui/dj/`）

| ファイル | 大きさ | 使う場所（`remake/previews/dj/style.css`） |
|---|---|---|
| `play-a.webp`・`play-b.webp`・`play-go.webp` | 256×256 | ▶（A 紫・B 水色・「いま押す」金）。表示 90px。台座の受け皿に収まる |
| `deck-strip.webp` | 640×200 | デッキの下の台座（DJS27）。表示窓 = 幅 2.2〜68.8 %・高さ 11〜89 %、▶ の受け皿の中心 = 幅 84.4 %。右デッキは CSS で左右反転 |
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

## フロアの2層（DJS32・Codex の5枚）

`make_parts.py` の `floor_pov()` が、Codex の5枚（`raw/`）から作る。

| 出力（`remake/img/ui/dj/`） | 元（`raw/`・2172×724） | 加工 |
|---|---|---|
| `floor-room.webp` 1600×533 | `floor-room.png`（誰もいない店内） | 幅 1600 に縮小するだけ |
| `floor-pov-1`〜`4.webp` 1600×436（透過） | `floor-sil-1`〜`4.png`（シルエットの客。1 冷えている・2 様子見・3 踊っている・4 最高潮） | 行 180 から下を切り出し（`BAND_TOP`）、上 52 行をぼかして透明に（`BAND_FADE`）、下に暗い余白 48 行（`BAND_PAD`。拍で帯が上がったときに絵の外が見えないように）。色は変えない |

- 画面では2枚を同じ位置に重ね、絵の高さの 31% から下を映す（`style.css` の `.room`・`.band`。`100cqw` はフロアの幅）。横長の画面でも上げた手が切れにくい。
- 熱ごとの照明は絵の側（`floor-sil-N`）にある。奥の店内には CSS で少しだけ明るさの差を付けている（冷えたときは暗く、最高潮で明るく）。
- 届いた記録: `SILHOUETTE_GENERATION_RECORD.md`（生成の順番・指示・目視の検査）、`manifest.json`（5枚の寸法と SHA-256）、`inputs/`（Codex に渡した元の4枚。チャットで渡したため 1536×512 の JPEG。元の PNG は PR #3233 の `raw/floor-1`〜`4.png`）。
- 記録にあるとおり、元の絵とは画素単位では一致しない（生成で輪郭や腕の角度が少し変わる）。客がシルエットなので、顔ありの版より向きは読み取りにくい（ポーズで分かる）。

### その前（DJS28・手元の素材）

画像 API がクレジット切れだったので、`bg-purple.webp`（空の店内）と、以前の候補 a 案 `asset_sources/ui/dj-floor-crowd-20261102/crowd-a.png` の中央の観客を切り出して重ねていた（客は小さな影絵で、向きやポーズは読み取れなかった）。
