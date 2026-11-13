# 一台勝負 トレカデザイン 第1段階

## 案 A：熾火を囲う黒い金属

- マットは夜紫の暗い石とし、札の明度を卓より高く保つ。
- 外枠を黒い金属、内側に種類色の細い二重線として重ねる。
- 左上の数値と名前を先に読み、絵の窓はその下に収める。
- 炭と一口だけ橙系を強め、手札で即座に区別する。
- C は素地、U は鋼、R は金の箔線、SR は二重の箔と動く光にする。
- 暗い面が沈む弱みは、絵の窓の内縁と名前の帯を明るくして補う。

## 案 B：夜紫の紙と刷り箔

- マットを紫の布に見立て、札は明るい紙に刷ったように見せる。
- 枠は紙の余白、種類色の側線、細い箔押しの順に重ねる。
- 名前の帯と数値は濃色で印刷し、絵の窓を一段沈める。
- 一口は珊瑚色の側線と強い種類札で区別する。
- C は単色、U は銀、R は金、SR は広い箔と動く光にする。
- 明るい札が密集して騒がしくなる弱みは、マットの線を細くして補う。

## 生成画像

原画は生成結果をそのまま保存した。使用画像は 1280×720 に切り、WebP に変換した。文字・番号・機材は画像に含めず CSS で構成する。

### 案 A マット

```text
Style: the night-time "lounge goods" of a stylish Japanese shisha bar, drawn for a pixel-painterly visual novel and used as flat game UI parts. Deep night purple (#150d22 ground, #221534 panels, #2e1d45 cards) is the main colour and fills most of the surface, soft lavender light (#c9a7e6) is the secondary colour, warm white (#f6f1fa) is only for faint highlights, and muted gold (#e3bd6e) is a thin single accent line. Calm, chill, dim indirect lighting from one direction, subtle smoke haze. Surfaces are never plain flat fills: keep a faint velvet weave or paper fibre, a soft one-directional light gradient, a thin double rule (gold outside, lavender inside) and a soft inner shadow at the edges so the part reads as a real object. Flat, front-facing, no perspective, no photo realism, no 3D bevels, no neon glow tubes, no rainbow, no strong saturation. Decoration limited to hairlines and small smoke curls; no medieval ornaments, gears, jewels, lace, ribbons or flowers. No shisha pipes or hardware. Never bake in any text, letters, logo, digits, gauges, icons, hearts or watermark.
Use case: game UI texture. Asset type: playmat surface for proposal A. Create one seamless-looking 16:9 flat front-facing dark charcoal and deep night-purple stone/velvet tabletop, sparse fine mineral grain and faint purple fibres, warm one-direction light from upper left, soft ember warmth at bottom edge. No zones, lines, card frames, objects, equipment, text or symbols; CSS will draw all functional marks. Target crop 1280x720. Reference role: the style paragraph above is the sole art-direction reference; keep its palette and pixel-painterly surface treatment fixed.
```

### 案 B マット

```text
Style: the night-time "lounge goods" of a stylish Japanese shisha bar, drawn for a pixel-painterly visual novel and used as flat game UI parts. Deep night purple (#150d22 ground, #221534 panels, #2e1d45 cards) is the main colour and fills most of the surface, soft lavender light (#c9a7e6) is the secondary colour, warm white (#f6f1fa) is only for faint highlights, and muted gold (#e3bd6e) is a thin single accent line. Calm, chill, dim indirect lighting from one direction, subtle smoke haze. Surfaces are never plain flat fills: keep a faint velvet weave or paper fibre, a soft one-directional light gradient, a thin double rule (gold outside, lavender inside) and a soft inner shadow at the edges so the part reads as a real object. Flat, front-facing, no perspective, no photo realism, no 3D bevels, no neon glow tubes, no rainbow, no strong saturation. Decoration limited to hairlines and small smoke curls; no medieval ornaments, gears, jewels, lace, ribbons or flowers. No shisha pipes or hardware. Never bake in any text, letters, logo, digits, gauges, icons, hearts or watermark.
Use case: game UI texture. Asset type: playmat surface for proposal B. Create one seamless-looking 16:9 flat front-facing deep purple woven cloth and subtly fibrous paper tabletop, brighter lavender illumination through centre, quiet muted-gold warmth only near bottom edge. No zones, lines, card frames, objects, equipment, text or symbols; CSS will draw all functional marks. Target crop 1280x720. Reference role: the style paragraph above is the sole art-direction reference; keep its palette and pixel-painterly surface treatment fixed.
```

| 案・画像 | ピクセル | bytes | SHA-256 |
|---|---:|---:|---|
| A 原画 `raw/a/mat.png` | 1672×941 | 1993970 | `2bcf63255f8794849f831306a9f4ee7a143de4530a8bf3da1deaa02b8f4d286f` |
| A 使用 PNG `assets/ui/ichidai/skin-a/mat.png` | 1280×720 | 1119924 | `8e315eb4739e4212960d0a4e88835dc799007840c567ace64a0df6f26217a42a` |
| A WebP `remake/img/ui/ichidai/skin-a/mat.webp` | 1280×720 | 47188 | `1f06f5e3b88230c569a5ae6527d23deb350ef8cbbafe1a7c6cc5a6f67c8168ac` |
| B 原画 `raw/b/mat.png` | 1672×941 | 2673533 | `84bfcb5e993a438d15691a172ff09d252a61f32b6cd2de6b84cfc51c1588ae98` |
| B 使用 PNG `assets/ui/ichidai/skin-b/mat.png` | 1280×720 | 1397056 | `717fe5e82f6a275e1da669329cb45c99352065dcac927b869bf627071e96b3d7` |
| B WebP `remake/img/ui/ichidai/skin-b/mat.webp` | 1280×720 | 107886 | `08aa5239a05001524f157e4bb2e34c766048155d83770a8f5585a862c83f0084` |

## 画面と確認方法

`remake/ichidai.html?skin=a` と `?skin=b` で実戦できる。比較表は `docs/design/card_game/design/tcg_compare.html?skin=a` と `?skin=b`。`view=rarity` で同一札のレア度、`offset=0,4,8,12` で札の種類を4件ずつ見る。

`shots/` のファイル名は `<案>-<幅>x<高さ>-<画面>.png`。各案とも 1280×720 と 844×390 の両方を保存した。

| 記号 | 画面 | ファイル名末尾 | 撮影上の補足 |
|---|---|---|---|
| a | 準備・葉10種と手札 | `a-prep.png` | 実戦の準備フェイズ |
| b | 提供・密集状態 | `b-serve-dense.png` | 実戦の提供画面を基に、6枚の炭と人物札が同時にある状態を撮影時の DOM で補った。規則と保存データは変更していない |
| c | 相手が札を使った時 | `c-played.png` | 実戦の卓上に、本体の `tcg()` から作った拡大札を撮影時だけ重ねた |
| d | 審査カードをめくった時 | `d-judge.png` | 実戦の審査演出。撮影時は表示時間を延ばして読める状態にした |
| e | 一覧・13種類を3段 | `e-types-1-4.png` / `e-types-5-8.png` / `e-types-9-12.png` / `e-types-13-13.png` | 同じ `tcg()` の DOM で拡大240px・手札112px・小64px。4分割して原寸を維持 |
| f | レア度 C/U/R/SR | `f-rarity.png` | 同一の人物札で比較。レア度の表示だけ撮影ページで切り替えた |

## 物差しによる自己採点

○＝満たす、△＝改善したい、×＝満たさない。撮影画像を 1280×720 と 844×390 で目視した。

| 依頼書5節の物差し | A | B | 見た結果 |
|---|:---:|:---:|---|
| 1. 手札で種類とコスト | ○ | ○ | 左上の数字と一口の珊瑚色が残る |
| 2. 小さい札で炭 | ○ | ○ | 熱1/2の数値と種火の対称な裏面が別に見える |
| 3. 拡大で名前・文・番号 | ○ | ○ | 文箱と番号行を修正し、下端に収めた |
| 4. C/U/R/SR の順 | △ | ○ | A は C と U の差が弱い。B は銀から金への変化が明瞭 |
| 5. 札と白い文字が主役 | ○ | △ | A は暗い面が退く。B は手札が重なると白い縁の量が増える |
| 6. 同じゲームの家族 | ○ | ○ | 共通の構成と裏面の熾火で揃う |
| 7. 白黒での区別 | △ | △ | 数字と帯の形は残るが、種類の側線は色への依存が残る |
| 8. 集めたくなる拡大札 | ○ | ○ | A は箔、B は紙と箔の差があり、絵の窓も大きい |

## 推す案と次段階への提案

**案 A を推す。** マット上では暗い石と枠線が退き、手札の種類色と熱の数字が先に見える。スマホ横持ちではカード幅が約60pxになるが、黒い面の縁と珊瑚色の一口が残る。案 B は拡大時の文が読みやすく、レア度の順も強い一方、密集した手札では白い縁が連続する。

第2段階前に、A の U の銀縁を C からもう一段離し、白黒でも種類が見分けられる小さな形のしるしを手札帯に追加したい。現行のレア度割り当ては仮のまま維持し、希少度を効果の強さに直結させないことを提案する。図鑑では全66種の未入手を輪郭だけで見せ、拡大札の絵と番号を獲得時に開くと、収集の動機と実戦での読みやすさを両立できる。入手経路と配分はオーナー判断を待つ。

## 第2段階：A 案の本番化（2026-11-12）

既定の表示へ A 案の黒い金属枠、種類色の二重線、箔、しるし、審査カードの表を適用した。`?skin=a` と `?skin=b` は第1段階の比較口として残した。卓面と2種の裏面は以下の新しい絵に差し替えた。枠、文字、数字、しるしは CSS／SVG で描画する。画像は質感と抽象絵だけであり、機材を描いていないため `docs/shisha_reference.md` §4 の機材生成手順の対象外。

### 画像生成プロンプト全文

#### 卓面 `mat.png`

```text
Use case: stylized-concept
Asset type: tabletop playmat surface texture for a Japanese trading card minigame, landscape 16:9
Primary request: a refined dark stone and black metal tabletop surface with subtle midnight-purple undertone, designed to sit beneath brightly colored collectible cards.
Composition: directly overhead, flat and uniform across the whole frame, no perspective, no cards or slots; subdued charcoal slate grain with quiet brushed metallic flecks and barely visible warm ember tint near the extreme edges. Keep center dark and low contrast.
Materials: fine matte stone, slight worn mineral variation, polished black metal undertone.
Constraints: seamless-looking usable surface, no equipment, no objects, no figures, no UI, no border, no markings, no text, no numbers, no logo, no watermark.
```

#### デッキ裏面 `deck-back.png`

```text
Use case: stylized-concept
Asset type: abstract artwork texture for the reverse of a 5:7 collectible card in a Japanese shisha card minigame
Primary request: a vertical, perfectly 180-degree rotationally symmetric arrangement of glowing ember and black metal, like a quiet row of coals when cards are laid sideways. The center has one warm amber ember glow; matching smaller embers above and below. Surround it with charcoal black and deep night purple mineral texture. Leave generous dark margin for a CSS border to be added separately.
Style: elegant premium tabletop game material illustration, restrained light, tactile stone and brushed metal, crisp enough at 36px card width.
Constraints: pure artwork texture only; no card frame, no equipment, no objects, no symbols, no text, no digits, no logos, no watermark. Exact top-bottom symmetry is important.
```

#### 審査カード裏面 `judge-back.png`

```text
Use case: stylized-concept
Asset type: abstract artwork texture for the reverse of a separate judge card in a 5:7 Japanese collectible card minigame
Primary request: a vertical, perfectly 180-degree rotationally symmetric dark violet stone surface with a soft restrained ivory-gold glow at the center and paired lavender reflections above and below. It should clearly differ from a warm ember deck back while belong to the same black metal and dark stone family. Leave generous quiet dark margin for a CSS border to be added separately.
Style: refined premium trading card surface art, tactile polished stone, subtle brushed metal reflection, legible at small card size.
Constraints: artwork texture only; no card frame, no equipment, no people, no objects, no symbols, no text, no digits, no logos, no watermark. Exact top-bottom symmetry is important.
```

### 保存ファイル

| 画像 | ピクセル数 | bytes | SHA-256 |
|---|---:|---:|---|
| 原画 `asset_sources/card_game/design-20261111/stage2/mat.png` | 1672×941 | 2267395 | `bbc9265503c98464d954afdfbdca55d67a574c73075a1b52e2a06fe8e5c6e344` |
| 素材 PNG `assets/ui/ichidai/table/mat.png` | 1672×941 | 2267395 | `bbc9265503c98464d954afdfbdca55d67a574c73075a1b52e2a06fe8e5c6e344` |
| 使用 WebP `remake/img/ui/ichidai/table/mat.webp` | 1280×720 | 25618 | `de8fd60c66a4c1b34e0f6ae20fa18f81e5bb8bc45af738eeab9336bc0fe0c294` |
| 原画 `asset_sources/card_game/design-20261111/stage2/deck-back.png` | 1060×1484 | 1994979 | `9fd867c69da1d4c288b25660659f53bf7bc3ca24fa19023e075f22ced939d698` |
| 素材 PNG `assets/ui/ichidai/back/deck.png` | 1060×1484 | 1994979 | `9fd867c69da1d4c288b25660659f53bf7bc3ca24fa19023e075f22ced939d698` |
| 使用 WebP `remake/img/ui/ichidai/back/deck.webp` | 400×560 | 11600 | `224ed2a43ccd9e0630a79e1269e2e76d751ef7efa49546eb8b42e4e676c33811` |
| 原画 `asset_sources/card_game/design-20261111/stage2/judge-back.png` | 1060×1484 | 1859833 | `3d039635aafcfc141a589429c2079bdf9c2add2458c772c147e9760a3eee148a` |
| 素材 PNG `assets/ui/ichidai/back/judge.png` | 1060×1484 | 1859833 | `3d039635aafcfc141a589429c2079bdf9c2add2458c772c147e9760a3eee148a` |
| 使用 WebP `remake/img/ui/ichidai/back/judge.webp` | 400×560 | 7502 | `6e03fc22d64d2e9c50571f90480baf6ea70a48cb20338b8c2f6e31728fbca585` |

WebP への変換は `ffmpeg` で卓面 1280×720、裏面 400×560 に縮小した。裏面の縦横比は A 案の札と同じ 5:7。

### 本編ショップとの機材画像照合

ショップ `shop.js` は `shop-equipment-art.js` を優先し、該当しないボウルは `craft/art.js` のシーシャ作り用画像を使う。第2段階では一台勝負の炭カード（フラット、キューブ、高密度フラット）、雲窯ファンネル、ロートス／アマバースト／タヌキッシュの HMD を、ショップ採用の `shop/equipment-v2/` の同一ファイルへ揃えた。シリコン、80beat、素焼きのボウルは従来どおりショップと同じ `ui/making/` 系を参照する。炭焼き中の冷／赤／焼け／種火は機材の型を示す商品画像ではなく、進行状態を示す専用画像なので維持した。ビッグタヌキッシュとワンコールはショップに対応する専用画像がないため既存の代用表示を維持した。

### 画面確認

`stage2/shots/` に 1280×720 と 844×390 の両方を保存した。a は実戦の準備と葉10種・手札、b は実戦の提供、c は相手が使った札の拡大、d は審査カード、e は札13種類を4分割した一覧、f は同一人物札の C/U/R/SR 比較。b の密集画面は実戦の卓を基に炭6枚・炭焼き場3枚を撮影時だけ DOM 複製で補った。c は本体 `tcg()` の拡大札を撮影時だけ重ね、d は本体の審査カード DOM と同じ構造・既存の `PUFFS.long` の文を撮影時だけ重ねた。撮影用の変更はゲームコードへ保存していない。

| 物差し | A 案・本番 | 確認結果 |
|---|:---:|---|
| 手札で種類と必要火力 | ○ | 左上の数字と種類別の枠、珊瑚の一口札が分かれる |
| 小さい札の炭と種火 | ○ | 炭は灰色の絵と熱、種火は橙の裏面で区別できる |
| 拡大札の読みやすさ | ○ | 名前・文・番号・レア度を 240px で読める |
| レア度の段差 | ○ | C の素地、U の銀、R の金、SR の二重箔 |
| マット上で札が主役 | ○ | 暗い石を低コントラストにし、枠より札を明るくした |
| 札の家族感 | ○ | 黒金属の外枠と種類色の細線を共通化した |
| 白黒での判別 | △ | 数字・★・しるしが残るが、葉の系統差は絵にも依存する |
| 集めたくなるか | ○ | 拡大札の金属枠と R/SR の箔に段差がある |
