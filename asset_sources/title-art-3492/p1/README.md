# タイトルアート P1 比較

[Issue #3492](https://github.com/haseatsu114514-dot/shisha-game/issues/3492)・[#4028 項目5](https://github.com/haseatsu114514-dot/shisha-game/issues/4028)。同じ人物・衣装・所作を S1（新版立ち絵のセル影）と S2（公式 KV の柔らかい影）で比較する。共通画風は **S1** に決定。

| ゲーム表示 | S1 | S2 |
|---|---|---|
| あげは04 | [![あげは04 S1](ageha04_s1_title_1280x720_dpr1.png)](ageha04_s1_title_1280x720_dpr1.png) | [![あげは04 S2](ageha04_s2_title_1280x720_dpr1.png)](ageha04_s2_title_1280x720_dpr1.png) |
| スミ01 | [![スミ01 S1](sumi01_s1_title_1280x720_dpr1.png)](sumi01_s1_title_1280x720_dpr1.png) | [![スミ01 S2](sumi01_s2_title_1280x720_dpr1.png)](sumi01_s2_title_1280x720_dpr1.png) |

| 対象 | 原寸 PNG | 顔等倍・新版立ち絵との比較 | 560×720 切り抜き |
|---|---|---|---|
| あげは04 | [S1](ageha04_s1.png)・[S2](ageha04_s2.png) | [新版 / S1 / S2](ageha04_faces_1to1.png) | [S1](ageha04_s1_crop_560x720.png)・[S2](ageha04_s2_crop_560x720.png) |
| スミ01 | [S1](sumi01_s1.png)・[S2](sumi01_s2.png) | [新版 / S1 / S2](sumi01_faces_1to1.png) | [S1](sumi01_s1_crop_560x720.png)・[S2](sumi01_s2_crop_560x720.png) |

## 採用判断

両キャラのタイトル表示と顔等倍を確認し、S1 を P2 の画風参照にする。あげはは目元・髪留め・グミの縁、スミは眼鏡・髭・指と布の境が縮小表示でも読み取りやすい。人物の線と影は新版立ち絵に合わせ、背景の灯りには現在の柔らかい塗りを使う。P2 はつむぎ・ましろから2案ずつ比較する。今回の選定対象は画風。P1 原画は 1024×1536 の比較用で、ゲーム用画像の差し替えは各原画の寸法・表示・圧縮を検品してから行う。

## 画風と自己検品

| 対象 | S1 | S2 |
|---|---|---|
| あげは04 | 頬と前髪の影の境がはっきりしており、琥珀の目とウインクが小さな表示でも読みやすい。 | 頬と金髪にラウンジの暖色が回る。グミの透け方は自然で、目元と毛先の線は S1 より淡い。 |
| スミ01 | 眼鏡と髭の輪郭、親指・器の縁・布の境が最も読みやすい。黒シャツのセル影は大きな面で分かれる。 | ランプの光が頬、袖、素焼きの側面へ続く。器を拭く静けさが出る一方、髭と暗い襟は S1 より近い明度になる。 |

- **本人性・所作**　あげはは色違いの熊の髪留め、ツインテール、フープ、チョーカーとハートのペンダント、豹柄、ピンクのトップスを照合。片手のグミを光にかざし、もう一方で袋を支える。顔・グミ・袋はいずれも表示内。スミは帽子、角眼鏡、口髭と顎髭、腕まくり、腰エプロンを照合。2案とも手に持った空のハガルの口縁と穴、狭まる胴、布の接触を読める。下端は指と布に隠れ、脚の全形は確認できない。口径は支える手と同程度。台への装着前で、HMD・炭・ホースは画面に出ない。
- **画面での見え方**　現行タイトルで登場途中と静止後を比較。顔・グミ・器はメニューと重ならない。あげはの上げた腕の外側に左マスクが掛かる。S2 はあげはの指先と暖色背景が近いため、グミの輪郭は S1 の方が読みやすい。原画に UI、文字、透かしの焼き込みは見当たらない。
- **解像度**　全点を実デコード。無加工の 1024×1536、8-bit RGB、不透明 PNG。ICC・sRGB チャンクの埋め込みは確認できず、ブラウザーの既定解釈で比較。Issue の目標 1120×1680 に幅96・高さ144 px 不足する。拡大保存は行っていない。配信 WebP の容量・圧縮、ロード時間、抽選・セーブ回帰は本編組み込み時の検証項目。

## 比較条件

- 原寸は各候補 PNG。顔比較の中央と右は元画素 420×420 を拡縮せず配置。左の新版立ち絵だけ顔を見比べるため拡大した。
- 560×720 は Issue 指定の `cover / center 20%`。1024×1536 を 560×840 に縮小し、上24・下96 px を切った。マスク前の構図を確認できる。
- ゲーム表示は作業ブランチの起点 `7a37de9843521c17c581fe8fbdc37a7d54dd5768` の `remake/` を Chromium で起動。セーブなしの同じ画面で、ブラウザー内の `.title-art` の背景画像だけを候補にして撮影した。1280×720・DPR1 では現行の枠は x=780, y=0, 500×720、右寄せ0、マスクは左0–26%、最終不透明度0.97。CSS・抽選表・正本の変更はない。

- 1280×720（DPR1/2）、1920×1080（DPR1/2）、844×390（DPR3）の5条件で4案を表示し、顔・手元を確認した。1920×1080・DPR2 の実枠は物理幅1500 px で、原画幅1024 px から表示拡大される。端末実機での測定は行っていない。

## 原画の照合

| ファイル | bytes | SHA-256 |
|---|---:|---|
| `ageha04_s1.png` | 2,266,692 | `c21801923f3b2d64578b79e27fa28f6f440cca6cff1d3d3d75dbf6d09e9ad4f2` |
| `ageha04_s2.png` | 2,427,815 | `89324b9006e214a7d42c9ac2058dd80d6218453d7c46436e04ad78b8b33aead7` |
| `sumi01_s1.png` | 1,985,067 | `a16bb3a75d36dbdc7635f76f2f9ed708a5370d5b77860afac618727fa5e2c8de` |
| `sumi01_s2.png` | 1,949,922 | `8a79404e5b111e2c88eef547323d1fded3422d83bc4512c0d812211d2d0a9a33` |

## 生成記録

Codex 内蔵画像生成。あげは各1回、スミ各2回（初稿から掌と器の口径の縮尺を補正）、提出候補は各1枚。要求寸法 1680×2520、不透明、モデルの細版・seed はツールから非開示。A/B/C/E は役割名を付けた参照ボード、F は別の実写ボードで投入した。スミ初稿で用いた E は形状の接写で、提出版では F1/F2 を追加した。

| 役割 | 元ファイル | SHA-256 |
|---|---|---|
| A 本人・衣装 | `remake/img/sprites/character_variants/new/ageha/chr_ageha_normal.webp` | `defe674142dcef84fa6389ce62d4dd0541944e4b407a0b2c4ea1f57a419c6dda` |
| A 本人・衣装 | `remake/img/sprites/character_variants/new/sumi/chr_sumi_normal.webp` | `da4282b304d068c6b8b00a24ae89a81dbf4d855a33b3b62acb341e237630f4dd` |
| B 光・塗り | `asset_sources/promo-site-20261111/keyvisual/kv-a-01.png` | `1d62fd974b66c1dcb9a68ff5ad02adc2b2e467e134015b4486cb16b33a2c61c2` |
| C 構図・所作・場所 | `remake/img/ui/title_arts/title_art_ageha_04_gummy_light.webp` | `4534396e82f09deef842b4565fe5868720fa76cc451e9ec4d5649a646b39e804` |
| C 構図・所作・場所 | `remake/img/ui/title_arts/title_art_sumi_01_own_clay_bowl.webp` | `95affee38f82c9a4c3f6d229ef5efe91313161bfe8b4ddf75fba03335105f4c1` |
| E 器形 | `../siryou/shisha-hardware-reference/web-refs/images/bowl-solaris-suyaki-01.jpg` | `c17dbfc13d5084b3209b7c1a786bd49129ce17f450c12115ec4d21735a2b9690` |
| F1 掌と口径 | `../siryou/shisha-hardware-reference/web-refs/images/hand-holding-packedBowl-01.jpg` | `ac550137bc77581fd8c8669b5585d0423f8036c91566c34685394879a58c9225` |
| F2 手と器の側面 | `../siryou/shisha-hardware-reference/photos/hand-preparingBowl-01.jpg` | `f34a827993ea9010cb036471dc8ea566285fc84ef0388632f537dcdc02368319` |

E/F のパスは非公開の隣接資料リポジトリ siryou（`112d8e8ffca4671b39510411fa1ad39427294d53`）を指す。写真は比較資料に同梱していない。

### 提出版の全文プロンプト

各生成は下記ブロックを「共通 → 対象 → 画風 → スミのみ縮尺補正」の順に空行で連結した。

**共通**

```text
Create one finished, opaque native 1680 × 2520 px portrait 2:3 illustration for the visual novel 水煙前線 -EN:CODE-. The attached labeled contact sheet is input only. Return one full-bleed scene. A is the approved new sprite: exact identity, facial design, proportions and clothes. B is the official key visual: use environment paint, motivated light, material rendering only. C is the adopted title: carry over its scene, expression and action. Do not reproduce the board, labels, old rendering or UI. Use clean tapered Japanese anime linework, matte skin, a softly painted lower-detail background and one motivated lamp with modest fill. Frame seated subject from head to thigh with generous headroom; place face about x67%, y31% and meaningful hands and objects between x40–85%, y22–73%, keep both ponytail clips or the full cap clear of top crop. No printed words, branding, watermark, fade, grain, glitter overlay, pixel texture, plastic gloss or excessive bloom.
```

**あげは04**

```text
Only Ageha, 22, friendly rounded youthful face with large amber eyes, gold blonde high wavy twin tails, pink bear clip on viewer left and cream bear clip on viewer right, hoop earrings, choker and gold heart pendant, leopard jacket over pink top with outlined heart and black pleated skirt. Seated in the warm pink and amber lounge of C, cheerfully winking toward the viewer as her raised right hand delicately holds translucent red and pale bear gummies to the light, just left of her face; other hand holds a little open plain pink-translucent candy pouch. Keep both hands anatomically legible.
```

**スミ01**

```text
Only Sumi, match A's mature gentle face, cap, short dark hair, rectangular black glasses, connected moustache and neat beard, black rolled sleeve shirt and brown waist apron. In C's quiet wood-counter bar he looks down with a small smile while carefully polishing his own handmade unglazed terracotta shisha bowl. Viewer-left hand supports it, other hand presses an ivory cloth against the side; distinct fingers and real contact. E is a real Japanese shop reference for the shape and scale of this unmounted bowl only: palm-wide slightly flared thick rim, shallow open top with small functional holes, narrower clay foot below the cup. No brand or decorative stamp, no coals, foil, HMD, hose or assembled pipe in frame. Amber lamp upper left, cool shadowed shelving; preserve calm working posture.
```

**S1**

```text
STYLE LOCK S1: prioritize A's cel rendering on the entire figure. Confident slightly heavier outer contours, clean interior lines, two or three crisp, deliberately grouped hard-edged shadow values, flat highlights on hair and matte clothing. Reserve painterly softness for the room.
```

**S2**

```text
STYLE LOCK S2: prioritize official B's soft key-visual rendering across the figure and room. Fine controlled contours, broad warm reflected light, softly graduated halftones across cheeks, locks and fabric; retain just enough firm contact shadow to separate fingers and forms. Keep the same character, silhouette, pose, placement, palette and prop story as specified.
```

**スミのみ縮尺補正**

```text
Equipment scale correction: Image 2, F1 shows the real rim-to-palm ratio, F2 shows small detached bowls next to real fingers and a stand. Use F1/F2 for scale and structure only, never copy surroundings or tobacco. E close-up is shape only; ignore its image size. A bare EMPTY handmade bowl, both height and mouth 6–8 cm, rim at most palm width, bowl height about one-third of Sumi's head height. Keep it at his chest plane, held upright close to his midline, x46% y53%, with face around x62% y31%. Let the raised thumb rest visibly beside the rim as a scale cue, fingers below the cup, the cloth touches just one side. He is the subject and the bowl is small. No complete stand in this scene. One isolated neat bowl, no extra pipe fixtures, no stamped shapes.
```
